import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import { signOut } from "firebase/auth";
import { get, onValue, ref, remove, set, update } from "firebase/database";
import {
  AlertTriangle,
  Bell,
  Building2,
  Calendar,
  Camera,
  Car,
  Check,
  ChevronRight,
  Compass,
  EyeOff,
  Flag,
  Footprints,
  History,
  Home,
  LocateFixed,
  LogOut,
  MapPin,
  Navigation,
  Play,
  Route,
  Search,
  ShoppingBag,
  User,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView from "react-native-map-clustering";
import { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import CompassPointer from "../components/CompassPointer";
import {
  BuildingMarker,
  CATEGORY_ICON,
  FriendMarker,
  mStyles,
} from "../components/mapMarkers";
import { SelectedLocationCard } from "../components/SelectedLocationCard";
import { TabSkeleton } from "../components/tabSkele";
import { BUILDINGS, CAMPUS_BOUNDS, CATEGORY_COLORS } from "../lib/campusData";
import { DirectionsResult, fetchDirections } from "../lib/directions";
import { auth, database } from "../lib/firebase";
import {
  distanceToPolylineMetres,
  getDirectionLabel,
  hasPassedWaypoint,
  haversineMetres,
  kalmanFilter,
  KalmanState,
  snapToRoute,
  stripHtml,
} from "../lib/navUtils";
import { StyledModal, useStyledModal } from "./StyledModal";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ── Selected Location Card ────────────────────────────────────────────────────

// ── Marker components ─────────────────────────────────────────────────────────

const CATEGORIES = [
  "all",
  "faculty",
  "hostel",
  "food",
  "library",
  "medical",
  "sport",
  "admin",
];

const MONTH_ABBR = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
function getEventDateBadge(
  dateStr?: string,
): { day: string; month: string } | null {
  if (!dateStr) return null;
  const iso = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const m = parseInt(iso[2], 10) - 1;
    return { day: iso[3], month: MONTH_ABBR[m] ?? "" };
  }
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return {
      day: String(parsed.getDate()),
      month: MONTH_ABBR[parsed.getMonth()],
    };
  }
  return null;
}

// ── AR gate ──────────────────────────────────────────────────────────────────
// AR features almost always depend on native camera/motion modules that
// Expo Go's fixed runtime doesn't include (it only ships the native modules
// Expo bundled at build time). A plain top-level `import ARNavigation from
// "../components/ARNavigation"` gets evaluated the instant this file loads —
// i.e. right after every login — so if that component references an
// unsupported native module, it can crash the whole app before AR mode is
// ever toggled on. Routing it through `require()` inside this gate means
// Expo Go never touches that module at all; a standalone/dev-client build
// (Constants.appOwnership !== "expo") still gets the real thing.
const isExpoGo = Constants.appOwnership === "expo";

function ARNavigationGate(props: any) {
  if (isExpoGo) {
    return (
      <View style={arGateStyles.wrap}>
        <Text style={arGateStyles.title}>
          AR mode isn't available in Expo Go
        </Text>
        <Text style={arGateStyles.body}>
          Run this from a development or standalone build to use AR navigation.
        </Text>
        <TouchableOpacity style={arGateStyles.btn} onPress={props.onExit}>
          <Text style={arGateStyles.btnText}>Back to map</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const ARNavigation = require("../components/ARNavigation").default;
  return <ARNavigation {...props} />;
}

const arGateStyles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.9)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  title: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  body: { color: "#ccc", fontSize: 13, textAlign: "center", marginBottom: 20 },
  btn: {
    backgroundColor: "#1a5c38",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 24,
  },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});

const REROUTE_THRESHOLD_M = 25;
const ARRIVAL_THRESHOLD_M = 18;
const STEP_ADVANCE_WALKING_M = 20;
const STEP_ADVANCE_DRIVING_M = 60;

// Default map density: with ~94 buildings + community locations, showing
// everything at once (the old behaviour) buries the map in pins regardless
// of where the user actually is. In the default "all categories, no search"
// view we only show what's within this radius of the user — tapping a
// category chip or typing a search term bypasses this entirely (see
// isDefaultView in visibleBuildings below), since those are explicit asks
// to see a full set, not a default we should be limiting.
const DEFAULT_VISIBILITY_RADIUS_M = 700;
// Used as the distance-from center before userLocation resolves (cold
// start / permission not yet granted), so density behaves consistently
// instead of jumping from "nothing" to "everything" once GPS comes in.
// Matches the centroid your category-chip handler already re-centers to.
const FALLBACK_CAMPUS_CENTER = { latitude: 6.517, longitude: 3.393 };

// ── Tab skeleton loader ───────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Android-only fix: react-native-maps snapshots custom View markers into a
// bitmap. If tracksViewChanges is false from the very first render, and that
// first render fires before the View (emoji/colors) has actually painted —
// which happens here because `loc` streams in asynchronously from Firebase —
// the marker gets frozen as a blank bitmap forever. Keeping tracksViewChanges
// true for one short window after mount lets it snapshot for real, then we
// freeze it off so we don't pay the perf cost long-term. iOS doesn't need
// this (no snapshotting there) so it's skipped on that platform.
function CommunityLocationMarker({
  loc,
  onPress,
}: {
  loc: any;
  onPress: () => void;
}) {
  const [tracks, setTracks] = useState(Platform.OS === "android");

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const t = setTimeout(() => setTracks(false), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <Marker
      coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
      onPress={onPress}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracks}
    >
      <View
        style={[
          mStyles.pin,
          { backgroundColor: "#7c3aed", borderColor: "#ede9fe" },
        ]}
      >
        <MapPin size={14} color="#fff" strokeWidth={2.4} />
      </View>
      <View style={[mStyles.pinTail, { borderTopColor: "#7c3aed" }]} />
    </Marker>
  );
}

function HighlightMatch({
  text,
  query,
  textStyle,
  matchStyle,
}: {
  text: string;
  query: string;
  textStyle: any;
  matchStyle: any;
}) {
  if (!query) return <Text style={textStyle}>{text}</Text>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <Text style={textStyle}>{text}</Text>;
  return (
    <Text style={textStyle}>
      {text.slice(0, idx)}
      <Text style={matchStyle}>{text.slice(idx, idx + query.length)}</Text>
      {text.slice(idx + query.length)}
    </Text>
  );
}

export default function HomeScreen() {
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("home");
  const [filterCat, setFilterCat] = useState("all");
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Directions / navigation
  const [directions, setDirections] = useState<DirectionsResult | null>(null);
  const [loadingDirs, setLoadingDirs] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [navigating, setNavigating] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [displayUserLocation, setDisplayUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const interpolationFrameRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const [travelMode, setTravelMode] = useState<"walking" | "driving">(
    "walking",
  );
  const [rerouting, setRerouting] = useState(false);
  const [followUser, setFollowUser] = useState(true);
  const [muted, setMuted] = useState(false);
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [communityLoaded, setCommunityLoaded] = useState(false);
  const [arMode, setArMode] = useState(false);

  // ── NEW: distance to destination for CompassPointer ──
  const [distanceToDestination, setDistanceToDestination] =
    useState<number>(9999);

  // ETA live update
  const [liveEta, setLiveEta] = useState<string>("");
  const [heading, setHeading] = useState(0);
  const headingHistoryRef = useRef<number[]>([]);
  const speedHistoryRef = useRef<number[]>([]);
  const kalmanRef = useRef<KalmanState | null>(null);

  const panelAnim = useRef(new Animated.Value(0)).current;
  const reroutingAnim = useRef(new Animated.Value(0)).current;

  const [events, setEvents] = useState<any[]>([]);
  const [communityLocations, setCommunityLocations] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const [friends, setFriends] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [friendUsername, setFriendUsername] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);
  const [friendLocations, setFriendLocations] = useState<any[]>([]);
  const [allUsersCache, setAllUsersCache] = useState<Record<string, any>>({});
  const [userSuggestions, setUserSuggestions] = useState<any[]>([]);
  const [friendPhotos, setFriendPhotos] = useState<
    Record<string, string | null>
  >({});
  const [sharingLocation, setSharingLocation] = useState(true);

  const { config: modal, confirm, alert: showAlert } = useStyledModal();

  const params = useLocalSearchParams<{
    eventLat?: string;
    eventLng?: string;
    eventName?: string;
    eventIcon?: string;
    eventDesc?: string;
  }>();

  const sharingLocationRef = useRef(true);
  const mapRef = useRef<any>(null);
  const stepsScrollRef = useRef<ScrollView>(null);
  const locationWatchRef = useRef<any>(null);
  const directionsRef = useRef<DirectionsResult | null>(null);
  const selectedRef = useRef<any>(null);
  const navigatingRef = useRef(false);
  const arrivedRef = useRef(false);
  const mutedRef = useRef(false);
  const isReroutingRef = useRef(false);
  const activeStepRef = useRef(0);
  const rerouteCountRef = useRef<number>(0);
  const consecutiveOffRouteRef = useRef<number>(0);
  const lastRerouteTimeRef = useRef<number>(0);
  const lastSpokenStepRef = useRef<number>(-1);
  const handleLiveNavigationRef = useRef<any>(() => {});
  const arrivalCountRef = useRef(0);
  const lastCameraUpdateRef = useRef(0);
  const lastLocationTimestampRef = useRef<number>(0);
  const speakTimeoutRef = useRef<any>(null);
  const headingWatchRef = useRef<any>(null);
  const pendingDestinationRef = useRef<any>(null);
  const userLocationRef = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const selectedVoiceRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    async function pickBestVoice() {
      const voices = await Speech.getAvailableVoicesAsync();

      // Priority list — first match wins
      const preferred = [
        "com.apple.ttsbundle.Samantha-premium",
        "com.apple.ttsbundle.siri_female_en-US_compact",
        "com.apple.ttsbundle.Karen-premium",
        "com.apple.ttsbundle.Daniel-premium",
        "com.apple.voice.compact.en-US.Samantha",
        "en-us-x-sfg#female_1-local",
        "en-us-x-tpc-local",
        "en-au-x-aud#female_1-local",
      ];

      for (const id of preferred) {
        if (voices.find((v) => v.identifier === id)) {
          selectedVoiceRef.current = id;
          return;
        }
      }

      // Fallback: any premium/enhanced en-US female voice
      const premiumUS = voices.find(
        (v) =>
          v.language?.startsWith("en") &&
          (v.quality === Speech.VoiceQuality.Enhanced ||
            v.identifier?.includes("premium")),
      );
      if (premiumUS) {
        selectedVoiceRef.current = premiumUS.identifier;
        return;
      }

      // Last resort: any English voice
      const anyEnglish = voices.find((v) => v.language?.startsWith("en"));
      if (anyEnglish) selectedVoiceRef.current = anyEnglish.identifier;
    }

    pickBestVoice();
  }, []);

  function speakInstruction(text: string, muted: boolean) {
    if (muted) return;
    if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
    speakTimeoutRef.current = setTimeout(() => {
      Speech.stop();
      Speech.speak(stripHtml(text), {
        language: "en-US",
        rate: 0.88,
        pitch: 1.05,
        voice: selectedVoiceRef.current,
      });
    }, 300);
  }

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    directionsRef.current = directions;
  }, [directions]);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    navigatingRef.current = navigating;
  }, [navigating]);
  useEffect(() => {
    activeStepRef.current = activeStep;
  }, [activeStep]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // CHANGE 9: Smooth marker interpolation loop — runs at ~30 fps.
  // Each tick lerps displayUserLocation 25% of the way toward the real
  // GPS userLocation. This gives a smooth "glide" instead of teleport jumps.
  useEffect(() => {
    if (interpolationFrameRef.current)
      clearInterval(interpolationFrameRef.current);

    interpolationFrameRef.current = setInterval(() => {
      const target = userLocationRef.current;
      if (!target) return;

      setDisplayUserLocation((prev) => {
        if (!prev) return target;
        const LERP = navigatingRef.current ? 0.25 : 0.4; // faster when navigating
        const newLat = prev.latitude + LERP * (target.latitude - prev.latitude);
        const newLng =
          prev.longitude + LERP * (target.longitude - prev.longitude);
        // Stop updating when within 0.00001 deg (~1m) to avoid infinite micro-updates
        const delta =
          Math.abs(newLat - target.latitude) +
          Math.abs(newLng - target.longitude);
        if (delta < 0.000005) return target;
        return { latitude: newLat, longitude: newLng };
      });
    }, 33); // ~30 fps

    return () => {
      if (interpolationFrameRef.current)
        clearInterval(interpolationFrameRef.current);
    };
  }, []); // runs once; reads navigatingRef live via ref

  const smoothedHeading = useMemo(() => {
    const sinSum = headingHistoryRef.current.reduce(
      (acc, h) => acc + Math.sin((h * Math.PI) / 180),
      0,
    );
    const cosSum = headingHistoryRef.current.reduce(
      (acc, h) => acc + Math.cos((h * Math.PI) / 180),
      0,
    );
    return headingHistoryRef.current.length
      ? ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360
      : heading;
  }, [heading]);

  useEffect(() => {
    if (!navigating || !followUser || !userLocation) return;
    const now = Date.now();
    if (now - lastCameraUpdateRef.current < 300) return; // was 800ms
    lastCameraUpdateRef.current = now;

    const avgSpeed =
      speedHistoryRef.current.length > 0
        ? speedHistoryRef.current.reduce((a, b) => a + b, 0) /
          speedHistoryRef.current.length
        : 0;

    const zoom =
      travelMode === "driving"
        ? avgSpeed > 13
          ? 15
          : avgSpeed > 6
            ? 16
            : 17
        : 19;

    mapRef.current?.animateCamera(
      {
        center: {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        },
        heading: smoothedHeading,
        pitch: travelMode === "driving" ? 55 : 65,
        zoom,
      },
      { duration: 350 },
    );
  }, [smoothedHeading, navigating, followUser, userLocation, travelMode]);

  useEffect(() => {
    if (params.eventLat && params.eventLng && params.eventName) {
      const dest = {
        name: params.eventName,
        latitude: parseFloat(params.eventLat),
        longitude: parseFloat(params.eventLng),
        icon: params.eventIcon || "📌",
        description: params.eventDesc || "",
        category: "event",
      };

      setSelected(dest);
      setDirections(null);
      setNavigating(false);
      setActiveTab("home");

      const loc = userLocationRef.current;
      if (loc) {
        setLoadingDirs(true);
        fetchDirections(
          loc.latitude,
          loc.longitude,
          dest.latitude,
          dest.longitude,
          travelMode,
        ).then((result) => {
          setLoadingDirs(false);
          if (!result) {
            showAlert("No route found", "Could not calculate a route.", Route);
            return;
          }
          setDirections(result);
          setTimeout(() => {
            mapRef.current?.fitToCoordinates(
              [
                loc,
                ...result.polylinePoints,
                { latitude: dest.latitude, longitude: dest.longitude },
              ],
              {
                edgePadding: { top: 120, right: 40, bottom: 380, left: 40 },
                animated: true,
              },
            );
          }, 400);
        });
      } else {
        pendingDestinationRef.current = dest;
        setTimeout(() => {
          mapRef.current?.animateToRegion(
            {
              latitude: dest.latitude,
              longitude: dest.longitude,
              latitudeDelta: 0.004,
              longitudeDelta: 0.004,
            },
            800,
          );
        }, 500);
      }
    }
  }, [params.eventLat, params.eventName]);

  useEffect(() => {
    if (directions || loadingDirs) {
      Animated.spring(panelAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 10,
      }).start();
    } else {
      Animated.spring(panelAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 10,
      }).start();
    }
  }, [directions, loadingDirs]);

  useEffect(() => {
    Animated.timing(reroutingAnim, {
      toValue: rerouting ? 1 : 0,
      duration: rerouting ? 200 : 350,
      useNativeDriver: true,
    }).start();
  }, [rerouting]);

  useEffect(() => {
    const dbUnsubscribers: (() => void)[] = [];
    const friendUnsubscribers: (() => void)[] = [];

    async function setup() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });
        const pos = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setUserLocation(pos);
        userLocationRef.current = pos;

        if (pendingDestinationRef.current) {
          const dest = pendingDestinationRef.current;
          pendingDestinationRef.current = null;
          setSelected(dest);
          setLoadingDirs(true);
          fetchDirections(
            pos.latitude,
            pos.longitude,
            dest.latitude,
            dest.longitude,
            "walking",
          ).then((result) => {
            setLoadingDirs(false);
            if (!result) {
              showAlert(
                "No route found",
                "Could not calculate a route.",
                Route,
              );
              return;
            }
            setDirections(result);
            mapRef.current?.fitToCoordinates(
              [
                pos,
                ...result.polylinePoints,
                { latitude: dest.latitude, longitude: dest.longitude },
              ],
              {
                edgePadding: { top: 120, right: 40, bottom: 380, left: 40 },
                animated: true,
              },
            );
          });
        }

        locationWatchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 0,
            timeInterval: 800,
          },
          (loc) => {
            const accuracy = loc.coords.accuracy ?? 999;
            const accuracyLimit = navigatingRef.current ? 180 : 120;
            const now = Date.now();
            const timeSinceLast = now - lastLocationTimestampRef.current;
            const forceAccept = navigatingRef.current && timeSinceLast > 2000; // was 3000
            if (accuracy > accuracyLimit && !forceAccept) return;
            lastLocationTimestampRef.current = now;
            kalmanRef.current = kalmanFilter(
              loc.coords.latitude,
              loc.coords.longitude,
              accuracy,
              loc.coords.speed ?? 0,
              kalmanRef.current,
            );
            const pos = {
              latitude: kalmanRef.current.lat,
              longitude: kalmanRef.current.lng,
            };
            if (
              loc.coords.speed != null &&
              loc.coords.speed > 0.5 &&
              loc.coords.heading != null &&
              loc.coords.heading >= 0
            ) {
              setHeading(loc.coords.heading);
            }

            setUserLocation(pos);
            const user = auth.currentUser;
            if (user && sharingLocationRef.current) {
              set(ref(database, `locations/${user.uid}`), {
                ...pos,
                updatedAt: Date.now(),
              });
            }
            userLocationRef.current = pos;
            handleLiveNavigationRef.current(pos, loc.coords.speed ?? 0);

            if (pendingDestinationRef.current) {
              const dest = pendingDestinationRef.current;
              pendingDestinationRef.current = null;
              setSelected(dest);
              setLoadingDirs(true);
              fetchDirections(
                pos.latitude,
                pos.longitude,
                dest.latitude,
                dest.longitude,
                "walking",
              ).then((result) => {
                setLoadingDirs(false);
                if (!result) {
                  showAlert(
                    "No route found",
                    "Could not calculate a route.",
                    Route,
                  );
                  return;
                }
                setDirections(result);
                mapRef.current?.fitToCoordinates(
                  [
                    pos,
                    ...result.polylinePoints,
                    { latitude: dest.latitude, longitude: dest.longitude },
                  ],
                  {
                    edgePadding: { top: 120, right: 40, bottom: 380, left: 40 },
                    animated: true,
                  },
                );
              });
            }
          },
        );

        headingWatchRef.current = await Location.watchHeadingAsync((h) => {
          const raw = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          headingHistoryRef.current = [
            ...headingHistoryRef.current.slice(-4),
            raw,
          ];
          const sinSum = headingHistoryRef.current.reduce(
            (acc, h) => acc + Math.sin((h * Math.PI) / 180),
            0,
          );
          const cosSum = headingHistoryRef.current.reduce(
            (acc, h) => acc + Math.cos((h * Math.PI) / 180),
            0,
          );
          const smoothed =
            ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360;
          setHeading(smoothed);
        });
      } // closes: if (status === "granted")

      const user = auth.currentUser;
      if (user) {
        setUserId(user.uid);

        const unsubUserProfile = onValue(
          ref(database, `users/${user.uid}`),
          (snap) => {
            const d = snap.val();
            if (d) setUserName(d.fullName || d.name || "");
          },
        );
        const unsubAllUsers = onValue(ref(database, "users"), (snap) => {
          const data = snap.val() || {};
          setAllUsersCache(data);
          const photos: Record<string, string | null> = {};
          Object.entries(data).forEach(([uid, v]: any) => {
            photos[uid] = v.photoBase64 || null;
          });
          setFriendPhotos(photos);
        });
        const unsubFriends = onValue(
          ref(database, `friends/${user.uid}`),
          (snap) => {
            setFriendsLoaded(true);
            friendUnsubscribers.forEach((u) => u());
            friendUnsubscribers.length = 0;

            const data = snap.val() || {};
            const accepted = Object.entries(data)
              .filter(([, v]: any) => v.status === "accepted")
              .map(([uid, v]: any) => ({ uid, ...v }));
            setFriends(accepted);

            accepted.forEach((f: any) => {
              const unsub = onValue(
                ref(database, `locations/${f.uid}`),
                (locSnap) => {
                  const loc = locSnap.val();
                  if (loc)
                    setFriendLocations((prev) => [
                      ...prev.filter((fl) => fl.uid !== f.uid),
                      { uid: f.uid, name: f.name, ...loc },
                    ]);
                  else
                    setFriendLocations((prev) =>
                      prev.filter((fl) => fl.uid !== f.uid),
                    );
                },
              );
              friendUnsubscribers.push(unsub);
            });
          },
        );

        const unsubRequests = onValue(
          ref(database, `friendRequests/${user.uid}`),
          (snap) => {
            const data = snap.val() || {};
            const pending = Object.entries(data)
              .filter(([, v]: any) => v.status === "pending")
              .map(([uid, v]: any) => ({ uid, ...v }));
            setFriendRequests(pending);
          },
        );
        dbUnsubscribers.push(
          unsubUserProfile,
          unsubAllUsers,
          unsubFriends,
          unsubRequests,
        );
      }

      const unsubEvents = onValue(ref(database, "events"), (snap) => {
        setEventsLoaded(true);
        const data = snap.val() || {};
        setEvents(
          Object.entries(data)
            .map(([id, v]: any) => ({ id, ...v }))
            .sort((a: any, b: any) => b.createdAt - a.createdAt),
        );
      });
      const unsubApproved = onValue(
        ref(database, "approvedLocations"),
        (snap) => {
          setCommunityLoaded(true);
          const data = snap.val() || {};
          setCommunityLocations(
            Object.entries(data).map(([id, v]: any) => ({
              id: `comm_${id}`,
              ...v,
              isCommunity: true,
            })),
          );
        },
      );
      dbUnsubscribers.push(unsubEvents, unsubApproved);
    }

    setup();
    return () => {
      locationWatchRef.current?.remove();
      headingWatchRef.current?.remove();
      dbUnsubscribers.forEach((u) => u());
      friendUnsubscribers.forEach((u) => u());
      Speech.stop();
      if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
      // CHANGE 9: Clean up interpolation loop
      if (interpolationFrameRef.current)
        clearInterval(interpolationFrameRef.current);
    };
  }, []);

  useEffect(() => {
    sharingLocationRef.current = sharingLocation;
    const user = auth.currentUser;
    if (!user) return;
    if (!sharingLocation) remove(ref(database, `locations/${user.uid}`));
    else if (userLocation)
      set(ref(database, `locations/${user.uid}`), {
        ...userLocation,
        updatedAt: Date.now(),
      });
  }, [sharingLocation]);

  // ── Live navigation ────────────────────────────────────────────────────────
  const handleLiveNavigation = useCallback(
    async (pos: { latitude: number; longitude: number }, speed: number = 0) => {
      const _sinSum = headingHistoryRef.current.reduce(
        (acc, h) => acc + Math.sin((h * Math.PI) / 180),
        0,
      );
      const _cosSum = headingHistoryRef.current.reduce(
        (acc, h) => acc + Math.cos((h * Math.PI) / 180),
        0,
      );
      const smoothedHeading = headingHistoryRef.current.length
        ? ((Math.atan2(_sinSum, _cosSum) * 180) / Math.PI + 360) % 360
        : heading;
      const dirs = directionsRef.current;
      const dest = selectedRef.current;
      if (!navigatingRef.current || !dirs || !dest) return;

      // CHANGE 6: snapToRoute now returns null when user is outside 12-20 m
      // snap radius. In that case we show the real (Kalman-filtered) GPS
      // position so the marker reflects where the user actually is, not a
      // projected point on a road they've left. This matches Google Maps
      // behaviour: snap when close, show real position when off-route.
      const snapped = snapToRoute(
        pos,
        dirs.polylinePoints,
        smoothedHeading,
        speed,
      );
      const distFromRoute = distanceToPolylineMetres(pos, dirs.polylinePoints);
      const displayPos = snapped ?? pos; // real GPS when snapped is null
      const navPos = displayPos;

      // ── NEW: update distance state for CompassPointer ──
      const distToDest = haversineMetres(
        navPos.latitude,
        navPos.longitude,
        dest.latitude,
        dest.longitude,
      );
      setDistanceToDestination(distToDest);

      // Upcoming turn voice warning
      const currentStep = dirs.steps[activeStepRef.current] as any;
      if (currentStep?.endLocation) {
        const distToTurn = haversineMetres(
          pos.latitude,
          pos.longitude,
          currentStep.endLocation.lat,
          currentStep.endLocation.lng,
        );
        const WARN_500_KEY = activeStepRef.current * 10 + 1;
        const WARN_200_KEY = activeStepRef.current * 10 + 2;

        if (
          distToTurn < 520 &&
          distToTurn > 450 &&
          lastSpokenStepRef.current !== WARN_500_KEY
        ) {
          lastSpokenStepRef.current = WARN_500_KEY;
          speakInstruction(
            `In 500 metres, ${stripHtml(currentStep.instruction)}`,
            mutedRef.current,
          );
        }
        if (
          distToTurn < 220 &&
          distToTurn > 150 &&
          lastSpokenStepRef.current !== WARN_200_KEY
        ) {
          lastSpokenStepRef.current = WARN_200_KEY;
          speakInstruction(
            `In 200 metres, ${stripHtml(currentStep.instruction)}`,
            mutedRef.current,
          );
        }
      }

      const totalDist =
        (dirs.steps as any[])?.reduce(
          (acc: number, s: any) => acc + (s.distanceValue || 0),
          0,
        ) ?? 999;
      const dynamicArrivalThreshold =
        totalDist < 200 ? 22 : ARRIVAL_THRESHOLD_M;

      // Require N consecutive readings inside the threshold before declaring arrival
      const ARRIVAL_CONSEC_REQUIRED = 4;
      if (distToDest < dynamicArrivalThreshold) {
        arrivalCountRef.current += 1;
        if (
          arrivedRef.current ||
          arrivalCountRef.current < ARRIVAL_CONSEC_REQUIRED
        )
          return;
        arrivedRef.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setNavigating(false);
        setDirections(null);
        Speech.stop();
        speakInstruction(`You have arrived at ${dest.name}.`, mutedRef.current);
        mapRef.current?.animateCamera(
          {
            center: { latitude: dest.latitude, longitude: dest.longitude },
            zoom: 20,
            pitch: 0,
            heading: 0,
          },
          { duration: 1000 },
        );
        setTimeout(() => {
          showAlert("Arrived!", `You have reached ${dest.name}.`, Flag);
        }, 800);
        return;
      } else {
        arrivalCountRef.current = 0;
      }

      const steps = dirs.steps as any[];

      if (steps.length > 0) {
        let nextStep = activeStepRef.current;

        while (nextStep < steps.length - 1) {
          const s = steps[nextStep] as any;
          if (!s?.endLocation) break;

          const distToEnd = haversineMetres(
            pos.latitude,
            pos.longitude,
            s.endLocation.lat,
            s.endLocation.lng,
          );

          const nextS = steps[nextStep + 1] as any;
          const passed = nextS?.startLocation
            ? hasPassedWaypoint(
                pos,
                s.endLocation.lat,
                s.endLocation.lng,
                nextS.startLocation.lat,
                nextS.startLocation.lng,
                speed,
              )
            : false;

          const threshold =
            travelMode === "driving"
              ? STEP_ADVANCE_DRIVING_M
              : STEP_ADVANCE_WALKING_M;

          if (distToEnd < threshold || passed) {
            nextStep++;
          } else {
            break;
          }
        }

        if (nextStep !== activeStepRef.current) {
          setActiveStep(nextStep);
          activeStepRef.current = nextStep;
          stepsScrollRef.current?.scrollTo({
            y: nextStep * 80,
            animated: true,
          });
          const STEP_SPOKEN_KEY = nextStep * 10 + 9;
          if (lastSpokenStepRef.current !== STEP_SPOKEN_KEY) {
            lastSpokenStepRef.current = STEP_SPOKEN_KEY;
            const upcomingStep = steps[nextStep] as any;
            speakInstruction(
              `Now, ${stripHtml(upcomingStep.instruction)}`,
              mutedRef.current,
            );
          }
          if (followUser) {
            const zoom =
              travelMode === "driving"
                ? speed > 13
                  ? 15
                  : speed > 6
                    ? 16
                    : 17
                : 19;
            mapRef.current?.animateCamera(
              {
                center: { latitude: pos.latitude, longitude: pos.longitude },
                zoom,
                pitch: travelMode === "driving" ? 55 : 65,
                heading: smoothedHeading,
              },
              { duration: 700 },
            );
          }
          return;
        }
      }

      const currentStepEndDist = currentStep?.endLocation
        ? haversineMetres(
            pos.latitude,
            pos.longitude,
            currentStep.endLocation.lat,
            currentStep.endLocation.lng,
          )
        : 0;
      const remainingDist =
        currentStepEndDist +
        (steps as any[])
          .slice(activeStepRef.current + 1)
          .reduce((acc: number, s: any) => acc + (s.distanceValue || 0), 0);

      const GPS_SPEED_THRESHOLD = 0.5;
      const WALKING_DEFAULT = 1.4;
      const DRIVING_DEFAULT = 8.3;

      speedHistoryRef.current = [...speedHistoryRef.current.slice(-4), speed];
      const avgSpeed =
        speedHistoryRef.current.reduce((a, b) => a + b, 0) /
        speedHistoryRef.current.length;
      const effectiveSpeed =
        avgSpeed > GPS_SPEED_THRESHOLD
          ? avgSpeed
          : travelMode === "walking"
            ? WALKING_DEFAULT
            : DRIVING_DEFAULT;

      const etaSecs = remainingDist / effectiveSpeed;
      const etaMins = Math.round(etaSecs / 60);
      setLiveEta(etaMins < 1 ? "< 1 min" : `${etaMins} min`);

      // CHANGE 10: distFromRoute already computed above after snap decision.
      // Re-use it here instead of calling distanceToPolylineMetres twice.
      const distToRoute = distFromRoute; // removed duplicate computation
      const now = Date.now();

      // CHANGE 10: Debug logging — only in __DEV__ builds so it doesn't
      // affect production performance. Shows the 4 pipeline stages:
      // raw GPS → Kalman filtered → snap decision → distance from route.
      if (__DEV__) {
        console.log(
          `[NAV] raw=(${pos.latitude.toFixed(6)},${pos.longitude.toFixed(6)})` +
            ` filtered=(same as pos — Kalman runs in watchPosition callback)` +
            ` snapped=${snapped ? `(${snapped.latitude.toFixed(6)},${snapped.longitude.toFixed(6)})` : "NULL(using raw)"}` +
            ` distFromRoute=${distToRoute.toFixed(1)}m` +
            ` distToDest=${distToDest.toFixed(1)}m` +
            ` speed=${speed.toFixed(2)}m/s`,
        );
      }
      const cooldown = Math.min(
        5000 * Math.pow(2, rerouteCountRef.current),
        40000,
      );
      const gpsIsReliable = (kalmanRef.current?.variance ?? 999) < 100;

      if (
        distToRoute > REROUTE_THRESHOLD_M &&
        gpsIsReliable &&
        distToDest > 40
      ) {
        consecutiveOffRouteRef.current += 1;
        const shouldReroute =
          consecutiveOffRouteRef.current >= 3 &&
          now - lastRerouteTimeRef.current > cooldown;

        if (shouldReroute && !isReroutingRef.current) {
          isReroutingRef.current = true;
          lastRerouteTimeRef.current = now;
          rerouteCountRef.current += 1;
          consecutiveOffRouteRef.current = 0;

          setRerouting(true);

          const rerouteMessage =
            rerouteCountRef.current === 1
              ? "Recalculating route."
              : rerouteCountRef.current === 2
                ? "Off route. Finding new path."
                : "Route updated.";
          speakInstruction(rerouteMessage, mutedRef.current);

          const bothOnCampus =
            pos.latitude > CAMPUS_BOUNDS.minLat &&
            pos.latitude < CAMPUS_BOUNDS.maxLat &&
            pos.longitude > CAMPUS_BOUNDS.minLng &&
            pos.longitude < CAMPUS_BOUNDS.maxLng &&
            dest.latitude > CAMPUS_BOUNDS.minLat &&
            dest.latitude < CAMPUS_BOUNDS.maxLat &&
            dest.longitude > CAMPUS_BOUNDS.minLng &&
            dest.longitude < CAMPUS_BOUNDS.maxLng;

          const rerouteMode = bothOnCampus ? "walking" : travelMode;

          const result = await fetchDirections(
            pos.latitude,
            pos.longitude,
            dest.latitude,
            dest.longitude,
            rerouteMode,
          );
          isReroutingRef.current = false;
          setRerouting(false);

          if (result) {
            rerouteCountRef.current = 0;
            setDirections(result);
            directionsRef.current = result;
            setActiveStep(0);
            activeStepRef.current = 0;
            lastSpokenStepRef.current = -1;

            const firstStep = result?.steps[0] as any;
            if (firstStep) {
              lastSpokenStepRef.current = 9;
              speakInstruction(
                `Starting navigation. ${stripHtml(firstStep.instruction)}`,
                muted,
              );
            }

            mapRef.current?.fitToCoordinates(
              [
                pos,
                ...result.polylinePoints,
                { latitude: dest.latitude, longitude: dest.longitude },
              ],
              {
                edgePadding: { top: 160, right: 40, bottom: 360, left: 40 },
                animated: true,
              },
            );
          } else {
            speakInstruction(
              "Could not find a new route. Continue if possible.",
              mutedRef.current,
            );
          }
        }
      } else {
        consecutiveOffRouteRef.current = 0;

        if (followUser && navigatingRef.current) {
          const zoom =
            travelMode === "driving"
              ? speed > 13
                ? 15
                : speed > 6
                  ? 16
                  : 17
              : 19;
          mapRef.current?.animateCamera(
            {
              center: { latitude: pos.latitude, longitude: pos.longitude },
              zoom,
              pitch: travelMode === "driving" ? 55 : 65,
              heading: smoothedHeading,
            },
            { duration: 300 },
          );
        }
      }
    },
    [travelMode, followUser],
  );

  useEffect(() => {
    handleLiveNavigationRef.current = handleLiveNavigation;
  }, [handleLiveNavigation]);

  // ── Friends helpers ────────────────────────────────────────────────────────
  function getUserDisplayName(v: any): string {
    return v.fullName || v.name || v.displayName || v.username || "";
  }
  function formatFriendDistance(metres: number): string {
    if (metres < 50) return "Right nearby";
    if (metres < 1000) return `${Math.round(metres)}m away`;
    return `${(metres / 1000).toFixed(1)}km away`;
  }
  function getUserSearchTokens(v: any): string[] {
    return [v.fullName, v.name, v.displayName, v.username, v.email]
      .filter(Boolean)
      .map((s: string) => s.toLowerCase());
  }
  function handleUsernameChange(text: string) {
    setFriendUsername(text);
    const q = text.trim().toLowerCase();
    if (q.length < 2) {
      setUserSuggestions([]);
      return;
    }
    const results = Object.entries(allUsersCache)
      .filter(
        ([uid, v]: any) =>
          uid !== userId && getUserSearchTokens(v).some((t) => t.includes(q)),
      )
      .map(([uid, v]: any) => ({
        uid,
        displayName: getUserDisplayName(v),
        username: v.username || v.email || "",
        initials: (getUserDisplayName(v) || "?")[0].toUpperCase(),
      }))
      .slice(0, 6);
    setUserSuggestions(results);
  }
  async function handleSendRequest(
    targetUid: string,
    targetDisplayName: string,
    targetUsername: string,
  ) {
    setAddingFriend(true);
    try {
      const existing = await get(
        ref(database, `friends/${userId}/${targetUid}`),
      );
      if (existing.exists()) {
        showAlert(
          "Already added",
          "Already friends or request pending.",
          Users,
        );
        setAddingFriend(false);
        return;
      }
      await update(ref(database, `friendRequests/${targetUid}/${userId}`), {
        name: userName,
        status: "pending",
        sentAt: Date.now(),
      });
      await update(ref(database, `friends/${userId}/${targetUid}`), {
        name: targetDisplayName,
        username: targetUsername,
        status: "pending_sent",
        sentAt: Date.now(),
      });
      showAlert(
        "Request sent!",
        `Friend request sent to ${targetDisplayName}.`,
        Check,
      );
      setFriendUsername("");
      setUserSuggestions([]);
    } catch {
      showAlert("Error", "Something went wrong. Try again.", AlertTriangle);
    }
    setAddingFriend(false);
  }
  async function handleAcceptRequest(
    fromUid: string,
    fromName: string,
    fromUsername: string,
  ) {
    await update(ref(database, `friends/${userId}/${fromUid}`), {
      name: fromName,
      username: fromUsername,
      status: "accepted",
      acceptedAt: Date.now(),
    });
    await update(ref(database, `friends/${fromUid}/${userId}`), {
      name: userName,
      username: "",
      status: "accepted",
      acceptedAt: Date.now(),
    });
    await remove(ref(database, `friendRequests/${userId}/${fromUid}`));
    showAlert("Friends!", `You and ${fromName} are now friends.`, Check);
  }
  async function handleDeclineRequest(fromUid: string) {
    await remove(ref(database, `friendRequests/${userId}/${fromUid}`));
  }
  async function handleRemoveFriend(friendUid: string, friendName: string) {
    confirm(
      "Remove Friend",
      `Remove ${friendName} from your friends list?`,
      async () => {
        await remove(ref(database, `friends/${userId}/${friendUid}`));
        await remove(ref(database, `friends/${friendUid}/${userId}`));
        setFriendLocations((prev) => prev.filter((f) => f.uid !== friendUid));
      },
      "Remove",
      User,
      true,
    );
  }

  // ── Search: recent searches persistence ────────────────────────────────────
  async function addRecentSearch(building: any) {
    const entry = {
      id: building.id,
      name: building.name,
      category: building.category,
      latitude: building.latitude,
      longitude: building.longitude,
      description: building.description,
      icon: building.icon,
    };
    const next = [
      entry,
      ...recentSearches.filter((r) => r.id !== entry.id),
    ].slice(0, 5);
    setRecentSearches(next);
    AsyncStorage.setItem("recentSearches", JSON.stringify(next));
  }

  function handleSelectBuilding(b: any) {
    addRecentSearch(b);
    setSelected(b);
    setSearch("");
    setSearchFocused(false);
    Keyboard.dismiss();
    mapRef.current?.animateToRegion(
      {
        latitude: b.latitude,
        longitude: b.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      },
      600,
    );
  }

  // ── Directions actions ─────────────────────────────────────────────────────
  async function handleGetDirections() {
    if (!selected) return;

    let location = userLocation;

    if (!location) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showAlert(
          "Location unavailable",
          "Please enable location services.",
          MapPin,
        );
        return;
      }
      try {
        setLoadingDirs(true);
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        location = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setUserLocation(location);
      } catch {
        setLoadingDirs(false);
        showAlert(
          "Location unavailable",
          "Could not get your position. Try again.",
          MapPin,
        );
        return;
      }
    }

    setLoadingDirs(true);
    setDirections(null);
    setActiveStep(0);
    setNavigating(false);
    setRerouting(false);
    setLiveEta("");

    const originOnCampus =
      location.latitude > CAMPUS_BOUNDS.minLat &&
      location.latitude < CAMPUS_BOUNDS.maxLat &&
      location.longitude > CAMPUS_BOUNDS.minLng &&
      location.longitude < CAMPUS_BOUNDS.maxLng;
    const destOnCampus =
      selected.latitude > CAMPUS_BOUNDS.minLat &&
      selected.latitude < CAMPUS_BOUNDS.maxLat &&
      selected.longitude > CAMPUS_BOUNDS.minLng &&
      selected.longitude < CAMPUS_BOUNDS.maxLng;
    const effectiveMode =
      originOnCampus && destOnCampus ? "walking" : travelMode;

    const result = await fetchDirections(
      location.latitude,
      location.longitude,
      selected.latitude,
      selected.longitude,
      effectiveMode,
    );

    setLoadingDirs(false);
    if (!result) {
      showAlert("No route found", "Could not calculate a route.", Route);
      return;
    }

    setDirections(result);
    mapRef.current?.fitToCoordinates(
      [
        location,
        ...result.polylinePoints,
        { latitude: selected.latitude, longitude: selected.longitude },
      ],
      {
        edgePadding: { top: 120, right: 40, bottom: 380, left: 40 },
        animated: true,
      },
    );
  }

  useEffect(() => {
    if (selected && userLocation) {
      handleGetDirections();
    }
  }, [travelMode]);

  useEffect(() => {
    AsyncStorage.getItem("travelMode").then((saved) => {
      if (saved === "walking" || saved === "driving") setTravelMode(saved);
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("recentSearches").then((saved) => {
      if (saved) {
        try {
          setRecentSearches(JSON.parse(saved));
        } catch {}
      }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("travelMode", travelMode);
  }, [travelMode]);

  function handleStartNavigation() {
    speedHistoryRef.current = [];
    rerouteCountRef.current = 0;
    consecutiveOffRouteRef.current = 0;
    lastRerouteTimeRef.current = 0;
    arrivedRef.current = false;
    isReroutingRef.current = false;
    setDistanceToDestination(9999); // ── NEW: reset on start

    setNavigating(true);
    setActiveStep(0);
    setFollowUser(true);
    lastSpokenStepRef.current = -1;
    arrivalCountRef.current = 0;
    const firstStep = directions?.steps[0] as any;
    if (firstStep) {
      speakInstruction(`Starting navigation. ${firstStep.instruction}`, muted);
    }
    if (userLocation) {
      mapRef.current?.animateCamera(
        {
          center: {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          },
          zoom: 18,
          pitch: 65,
          heading: heading,
        },
        { duration: 800 },
      );
    }
  }

  // Split the route polyline into "already walked" vs "remaining" so the
  // map can shade them differently. This used to run inline in JSX (an
  // O(n) scan over every route point) on every single render of the
  // screen — including renders triggered by unrelated state like friend
  // location updates or event list refreshes — and allocated brand new
  // coordinate arrays each time, which forces react-native-maps to tear
  // down and rebuild the native polyline layer repeatedly. Memoizing it
  // ties the work to the values that actually matter.
  const routeSplit = useMemo(() => {
    if (!directions || !userLocation) {
      return {
        traveled: [] as { latitude: number; longitude: number }[],
        remaining: [] as { latitude: number; longitude: number }[],
      };
    }
    let closestIdx = 0;
    let minDist = Infinity;
    directions.polylinePoints.forEach((pt, i) => {
      const d = haversineMetres(
        userLocation.latitude,
        userLocation.longitude,
        pt.latitude,
        pt.longitude,
      );
      if (d < minDist) {
        minDist = d;
        closestIdx = i;
      }
    });
    return {
      traveled: directions.polylinePoints.slice(0, closestIdx + 1),
      remaining: directions.polylinePoints.slice(closestIdx),
    };
  }, [directions, userLocation]);

  function handleStopNavigation() {
    setNavigating(false);
    setFollowUser(false);
    setDistanceToDestination(9999); // ── NEW: reset on stop
    Speech.stop();
    setLiveEta("");
    mapRef.current?.animateCamera(
      { heading: 0, pitch: 0, zoom: 16 },
      { duration: 600 },
    );
    if (directions && userLocation && selected) {
      mapRef.current?.fitToCoordinates(
        [
          userLocation,
          ...directions.polylinePoints,
          { latitude: selected.latitude, longitude: selected.longitude },
        ],
        {
          edgePadding: { top: 100, right: 40, bottom: 380, left: 40 },
          animated: true,
        },
      );
    }
  }

  function handleCancelDirections() {
    setDirections(null);
    setNavigating(false);
    setActiveStep(0);
    setRerouting(false);
    setFollowUser(false);
    setDistanceToDestination(9999); // ── NEW: reset on cancel
    Speech.stop();
    setLiveEta("");
  }

  async function handleLogout() {
    confirm(
      "Log out?",
      "You'll need to sign in again to use the app.",
      async () => {
        await signOut(auth);
        router.replace("/login");
      },
      "Log Out",
      LogOut,
      true,
    );
  }

  async function handleShareLocation() {
    if (!userLocation) {
      showAlert(
        "Location unavailable",
        "Your location isn't ready yet.",
        MapPin,
      );
      return;
    }
    const url = `[maps.google.com](https://maps.google.com/?q=${userLocation.latitude},${userLocation.longitude})`;
    await Share.share({
      message: `My current location on UNILAG campus: ${url}`,
      title: "Share My Location",
    });
  }

  const eventOccupiedCoords = useMemo(
    () =>
      new Set(
        events
          .filter((ev) => ev.latitude && ev.longitude)
          .map(
            (ev) => `${ev.latitude?.toFixed(4)},${ev.longitude?.toFixed(4)}`,
          ),
      ),
    [events],
  );

  const visibleBuildings = useMemo(() => {
    return [
      ...BUILDINGS,
      ...communityLocations.map((loc) => ({
        id: loc.id,
        name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        icon: loc.icon || "📍",
        description: loc.description || "Community location",
        category: loc.category || "other",
      })),
    ]
      .filter((b) => {
        const coordKey = `${b.latitude?.toFixed(4)},${b.longitude?.toFixed(4)}`;
        if (eventOccupiedCoords.has(coordKey)) return false;
        const matchesCategory =
          search.length > 0 || filterCat === "all" || b.category === filterCat;
        const matchesSearch =
          b.name.toLowerCase().includes(search.toLowerCase()) ||
          b.description.toLowerCase().includes(search.toLowerCase()) ||
          b.category.toLowerCase().includes(search.toLowerCase());
        if (!matchesCategory || !matchesSearch) return false;

        // Proximity gate — only for the default browse state (no search,
        // no category chip selected). A chip tap or a search term is an
        // explicit request to see a full set, so it skips this cutoff.
        const isDefaultView = search.length === 0 && filterCat === "all";
        if (isDefaultView) {
          const center = userLocation ?? FALLBACK_CAMPUS_CENTER;
          const distFromCenter = haversineMetres(
            center.latitude,
            center.longitude,
            b.latitude,
            b.longitude,
          );
          if (distFromCenter > DEFAULT_VISIBILITY_RADIUS_M) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (!userLocation) return 0;
        return (
          haversineMetres(
            userLocation.latitude,
            userLocation.longitude,
            a.latitude,
            a.longitude,
          ) -
          haversineMetres(
            userLocation.latitude,
            userLocation.longitude,
            b.latitude,
            b.longitude,
          )
        );
      });
  }, [
    communityLocations,
    eventOccupiedCoords,
    search,
    filterCat,
    userLocation,
  ]);

  const matchingEvents = useMemo(() => {
    if (search.length === 0) return [];
    const q = search.toLowerCase();
    return events.filter(
      (ev) =>
        ev.name?.toLowerCase().includes(q) ||
        ev.locationName?.toLowerCase().includes(q) ||
        ev.description?.toLowerCase().includes(q),
    );
  }, [events, search]);

  // Independent of search/category filters — always "closest 5", used only
  // in the focused-empty search state.
  const nearbyPlaces = useMemo(() => {
    if (!userLocation) return [];
    return [...BUILDINGS]
      .sort(
        (a, b) =>
          haversineMetres(
            userLocation.latitude,
            userLocation.longitude,
            a.latitude,
            a.longitude,
          ) -
          haversineMetres(
            userLocation.latitude,
            userLocation.longitude,
            b.latitude,
            b.longitude,
          ),
      )
      .slice(0, 5);
  }, [userLocation]);

  // ── Google Maps style top instruction banner ───────────────────────────────
  function renderNavBanner() {
    if (!navigating || !directions) return null;
    const step = directions.steps[activeStep] as any;
    if (!step) return null;
    const nextStep = directions.steps[activeStep + 1] as any;
    const arrow = getDirectionLabel(step.maneuver);

    return (
      <View style={styles.navBannerContainer}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.reroutingOverlay,
            {
              opacity: reroutingAnim,
              transform: [
                {
                  translateY: reroutingAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <ActivityIndicator color="#fff" size="small" />
          <Text style={styles.reroutingOverlayText}> Rerouting…</Text>
        </Animated.View>
        <View style={styles.navBannerCard}>
          <View style={styles.navArrowBox}>
            <Text style={styles.navArrowText}>{arrow}</Text>
          </View>
          <View style={styles.navInstructionBox}>
            <Text style={styles.navInstructionText} numberOfLines={2}>
              {stripHtml(step.instruction)}
            </Text>
            <Text style={styles.navInstructionDist}>In {step.distance}</Text>
          </View>
          <TouchableOpacity
            style={styles.muteBtn}
            onPress={() => setMuted((v) => !v)}
          >
            {muted ? (
              <VolumeX size={13} color="#fff" strokeWidth={2.4} />
            ) : (
              <Volume2 size={13} color="#fff" strokeWidth={2.4} />
            )}
            <Text style={styles.arBtnText}>{muted ? "Muted" : "Sound"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.arBtn}
            onPress={() => setArMode(true)}
          >
            <Camera size={13} color="#fff" strokeWidth={2.4} />
            <Text style={styles.arBtnText}>AR</Text>
          </TouchableOpacity>
        </View>
        {nextStep && (
          <View style={styles.navNextStrip}>
            <Text style={styles.navNextLabel}>Then </Text>
            <Text style={styles.navNextArrow}>
              {getDirectionLabel(nextStep.maneuver)}
            </Text>
            <Text style={styles.navNextText} numberOfLines={1}>
              {stripHtml(nextStep.instruction)}
            </Text>
            <Text style={styles.navNextDist}>{nextStep.distance}</Text>
          </View>
        )}
      </View>
    );
  }

  // ── ETA bar ────────────────────────────────────────────────────────────────
  function renderNavEtaBar() {
    if (!navigating || !directions) return null;

    const avgSpeed =
      speedHistoryRef.current.length > 0
        ? speedHistoryRef.current.reduce((a, b) => a + b, 0) /
          speedHistoryRef.current.length
        : 0;
    const speedKmh = Math.round(avgSpeed * 3.6);
    const speedLabel = speedKmh > 1 ? `${speedKmh} km/h` : "–";

    const distanceNum = parseFloat(directions.totalDistance);
    const stepsLabel = !isNaN(distanceNum)
      ? `~${Math.round((distanceNum * 1000) / 0.762)} steps`
      : "steps";

    return (
      <View style={styles.etaBar}>
        <View style={styles.etaItem}>
          <Text style={styles.etaValue}>
            {liveEta || directions.totalDuration}
          </Text>
          <Text style={styles.etaLabel}>ETA</Text>
        </View>
        <View style={styles.etaDivider} />
        <View style={styles.etaItem}>
          <Text style={styles.etaValue}>{directions.totalDistance}</Text>
          <Text style={styles.etaLabel}>
            {travelMode === "walking" ? stepsLabel : "Distance"}
          </Text>
        </View>
        <View style={styles.etaDivider} />
        <View style={styles.etaItem}>
          <Text style={styles.etaValue}>{speedLabel}</Text>
          <Text style={styles.etaLabel}>Speed</Text>
        </View>
        <View style={styles.etaDivider} />
        <View style={styles.etaItem}>
          {travelMode === "walking" ? (
            <Footprints size={18} color="#222" strokeWidth={2.2} />
          ) : (
            <Car size={18} color="#222" strokeWidth={2.2} />
          )}
          <Text style={styles.etaLabel}>{travelMode}</Text>
        </View>
        <TouchableOpacity
          style={styles.etaEndBtn}
          onPress={handleStopNavigation}
        >
          <Text style={styles.etaEndText}>End</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Directions panel ───────────────────────────────────────────────────────
  function renderDirectionsPanel() {
    if (loadingDirs)
      return (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#1a5c38" size="large" />
          <View style={{ marginLeft: 14 }}>
            <Text style={styles.loadingTitle}>Calculating route…</Text>
            <Text style={styles.loadingSubtitle}>to {selected?.name}</Text>
          </View>
        </View>
      );
    if (!directions) return null;

    return (
      <>
        {!navigating && (
          <>
            <View style={styles.dirSummaryRow}>
              <View>
                <Text style={styles.dirDuration}>
                  {liveEta || directions.totalDuration}
                </Text>
                <Text style={styles.dirDistMode}>
                  {directions.totalDistance} · {travelMode}
                </Text>
              </View>
              <View style={styles.dirActions}>
                <TouchableOpacity
                  style={styles.startNavBtn}
                  onPress={handleStartNavigation}
                >
                  <Play size={14} color="#fff" strokeWidth={2.4} fill="#fff" />
                  <Text style={styles.startNavBtnText}>Start</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={handleCancelDirections}
                >
                  <X size={16} color="#555" strokeWidth={2.4} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  travelMode === "walking" && styles.modeBtnActive,
                ]}
                onPress={() => setTravelMode("walking")}
              >
                <Footprints
                  size={16}
                  color={travelMode === "walking" ? "#1A73E8" : "#555"}
                  strokeWidth={2.2}
                />
                <Text
                  style={[
                    styles.modeBtnText,
                    travelMode === "walking" && styles.modeBtnTextActive,
                  ]}
                >
                  Walk
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  travelMode === "driving" && styles.modeBtnActive,
                ]}
                onPress={() => setTravelMode("driving")}
              >
                <Car
                  size={16}
                  color={travelMode === "driving" ? "#1A73E8" : "#555"}
                  strokeWidth={2.2}
                />
                <Text
                  style={[
                    styles.modeBtnText,
                    travelMode === "driving" && styles.modeBtnTextActive,
                  ]}
                >
                  Drive
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        <ScrollView
          ref={stepsScrollRef}
          style={styles.stepsList}
          showsVerticalScrollIndicator={false}
        >
          {(directions.steps as any[]).map((step, i) => {
            const isDone = navigating && i < activeStep;
            const isActive = navigating && i === activeStep;
            return (
              <View
                key={i}
                style={[
                  styles.stepRow,
                  isActive && styles.stepRowActive,
                  isDone && styles.stepRowDone,
                ]}
              >
                <View
                  style={[
                    styles.stepBullet,
                    isActive && styles.stepBulletActive,
                    isDone && styles.stepBulletDone,
                  ]}
                >
                  <Text
                    style={[
                      styles.stepBulletText,
                      (isActive || isDone) && styles.stepBulletTextLight,
                    ]}
                  >
                    {getDirectionLabel(step.maneuver)}
                  </Text>
                </View>
                <View style={styles.stepBody}>
                  <Text
                    style={[
                      styles.stepInstruction,
                      isActive && styles.stepInstructionActive,
                      isDone && styles.stepInstructionDone,
                    ]}
                  >
                    {stripHtml(step.instruction)}
                  </Text>
                  <Text style={styles.stepMeta}>{step.distance}</Text>
                </View>
                {isActive && <View style={styles.stepActivePip} />}
              </View>
            );
          })}
        </ScrollView>
      </>
    );
  }

  // ── Friends tab ────────────────────────────────────────────────────────────
  function renderFriendsTab() {
    return (
      <ScrollView
        style={styles.friendsScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.tabTitleRow}>
          <Users size={16} color="#1a5c38" strokeWidth={2.4} />
          <Text style={styles.tabTitleText}>Friends</Text>
        </View>
        <View style={styles.sharingCard}>
          <View style={styles.sharingLeft}>
            <View style={styles.sharingIconBox}>
              {sharingLocation ? (
                <MapPin size={18} color="#1a5c38" strokeWidth={2.2} />
              ) : (
                <EyeOff size={18} color="#1a5c38" strokeWidth={2.2} />
              )}
            </View>
            <View>
              <Text style={styles.sharingTitle}>Share My Location</Text>
              <Text style={styles.sharingSub}>
                {sharingLocation
                  ? "Visible to friends on map"
                  : "Hidden from friends"}
              </Text>
            </View>
          </View>
          <Switch
            value={sharingLocation}
            onValueChange={(val) => {
              setSharingLocation(val);
              if (!val)
                showAlert(
                  "Location hidden",
                  "Friends can no longer see you.",
                  EyeOff,
                );
            }}
            trackColor={{ false: "#ddd", true: "#4a8c63" }}
            thumbColor={sharingLocation ? "#1a5c38" : "#aaa"}
          />
        </View>

        <View style={styles.tabTitleRow}>
          <UserPlus size={14} color="#888" strokeWidth={2.4} />
          <Text style={styles.sectionLabelText}>Add Friend</Text>
        </View>
        <View style={styles.addFriendCard}>
          <View style={styles.addFriendRow}>
            <TextInput
              style={styles.addFriendInput}
              placeholder="Type a name or username…"
              placeholderTextColor="#999"
              value={friendUsername}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {friendUsername.length > 0 && (
              <TouchableOpacity
                style={styles.clearSearchBtn}
                onPress={() => {
                  setFriendUsername("");
                  setUserSuggestions([]);
                }}
              >
                <X size={14} color="#999" strokeWidth={2.4} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        {userSuggestions.length > 0 && (
          <View style={styles.suggestionsBox}>
            {userSuggestions.map((s) => (
              <TouchableOpacity
                key={s.uid}
                style={styles.suggestionRow}
                onPress={() =>
                  handleSendRequest(s.uid, s.displayName, s.username)
                }
                disabled={addingFriend}
              >
                <View style={styles.suggestionAvatar}>
                  {friendPhotos[s.uid] ? (
                    <Image
                      source={{
                        uri: `data:image/jpeg;base64,${friendPhotos[s.uid]}`,
                      }}
                      style={styles.suggestionAvatarImg}
                    />
                  ) : (
                    <Text style={styles.suggestionAvatarText}>
                      {s.initials}
                    </Text>
                  )}
                </View>
                <View style={styles.suggestionInfo}>
                  <Text style={styles.suggestionName}>{s.displayName}</Text>
                  {s.username ? (
                    <Text style={styles.suggestionSub}>@{s.username}</Text>
                  ) : null}
                </View>
                <View style={styles.sendRequestBtn}>
                  {addingFriend ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.sendRequestText}>Add +</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {friendUsername.length >= 2 && userSuggestions.length === 0 && (
          <Text style={styles.noResultsText}>
            No users found for "{friendUsername}"
          </Text>
        )}

        {friendRequests.length > 0 && (
          <>
            <View style={styles.tabTitleRow}>
              <Bell size={14} color="#d97706" strokeWidth={2.4} />
              <Text style={styles.sectionLabelText}>Requests</Text>
              <View style={[styles.tabCountBadge, styles.tabCountBadgeAmber]}>
                <Text
                  style={[
                    styles.tabCountBadgeText,
                    styles.tabCountBadgeTextAmber,
                  ]}
                >
                  {friendRequests.length}
                </Text>
              </View>
            </View>
            {friendRequests.map((req) => (
              <View key={req.uid} style={styles.requestCard}>
                <View style={styles.friendAvatar}>
                  {friendPhotos[req.uid] ? (
                    <Image
                      source={{
                        uri: `data:image/jpeg;base64,${friendPhotos[req.uid]}`,
                      }}
                      style={styles.friendAvatarImg}
                    />
                  ) : (
                    <Text style={styles.friendAvatarText}>
                      {(req.name || "?")[0].toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{req.name}</Text>
                  <Text style={styles.friendEmail}>
                    {req.username || req.email}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={() =>
                    handleAcceptRequest(
                      req.uid,
                      req.name,
                      req.username || req.email || "",
                    )
                  }
                >
                  <Check size={15} color="#fff" strokeWidth={2.6} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={() => handleDeclineRequest(req.uid)}
                >
                  <X size={15} color="#888" strokeWidth={2.6} />
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        <View style={styles.tabTitleRow}>
          <View style={styles.onlineDot} />
          <Text style={styles.sectionLabelText}>My Friends</Text>
          {friends.length > 0 && (
            <View style={styles.tabCountBadge}>
              <Text style={styles.tabCountBadgeText}>{friends.length}</Text>
            </View>
          )}
        </View>
        {!friendsLoaded ? (
          <TabSkeleton rows={3} />
        ) : friends.length === 0 ? (
          <Text style={styles.emptyText}>
            No friends yet. Search by username above!
          </Text>
        ) : (
          [...friends]
            .sort((a, b) => {
              const locA = friendLocations.find((fl) => fl.uid === a.uid);
              const locB = friendLocations.find((fl) => fl.uid === b.uid);
              if (locA && !locB) return -1;
              if (!locA && locB) return 1;
              if (!locA || !locB || !userLocation) return 0;
              return (
                haversineMetres(
                  userLocation.latitude,
                  userLocation.longitude,
                  locA.latitude,
                  locA.longitude,
                ) -
                haversineMetres(
                  userLocation.latitude,
                  userLocation.longitude,
                  locB.latitude,
                  locB.longitude,
                )
              );
            })
            .map((f) => {
              const loc = friendLocations.find((fl) => fl.uid === f.uid);
              return (
                <View key={f.uid} style={styles.friendCard}>
                  <View style={styles.friendAvatarWrap}>
                    <View style={styles.friendAvatar}>
                      {friendPhotos[f.uid] ? (
                        <Image
                          source={{
                            uri: `data:image/jpeg;base64,${friendPhotos[f.uid]}`,
                          }}
                          style={styles.friendAvatarImg}
                        />
                      ) : (
                        <Text style={styles.friendAvatarText}>
                          {(f.name || "?")[0].toUpperCase()}
                        </Text>
                      )}
                    </View>
                    {loc && <View style={styles.friendOnlineDot} />}
                  </View>
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{f.name}</Text>
                    <View style={styles.friendMetaRow}>
                      <View
                        style={[
                          styles.friendStatusDot,
                          loc
                            ? styles.friendStatusDotLive
                            : styles.friendStatusDotHidden,
                        ]}
                      />
                      <Text style={styles.friendEmail}>
                        {loc && userLocation
                          ? formatFriendDistance(
                              haversineMetres(
                                userLocation.latitude,
                                userLocation.longitude,
                                loc.latitude,
                                loc.longitude,
                              ),
                            )
                          : loc
                            ? "Sharing location"
                            : "Location hidden"}
                      </Text>
                    </View>
                  </View>
                  {loc && (
                    <TouchableOpacity
                      style={styles.locateBtn}
                      onPress={async () => {
                        const dest = {
                          name: f.name,
                          latitude: loc.latitude,
                          longitude: loc.longitude,
                          icon: "👤",
                          description: "Friend's live location",
                          category: "friend",
                        };
                        setSelected(dest);
                        setDirections(null);
                        setActiveStep(0);
                        setNavigating(false);
                        setActiveTab("home");

                        const location = userLocationRef.current;
                        if (!location) {
                          mapRef.current?.animateToRegion(
                            {
                              latitude: loc.latitude,
                              longitude: loc.longitude,
                              latitudeDelta: 0.005,
                              longitudeDelta: 0.005,
                            },
                            800,
                          );
                          return;
                        }

                        setLoadingDirs(true);
                        const result = await fetchDirections(
                          location.latitude,
                          location.longitude,
                          loc.latitude,
                          loc.longitude,
                          travelMode,
                        );
                        setLoadingDirs(false);

                        if (!result) {
                          showAlert(
                            "No route found",
                            "Could not calculate a route to your friend.",
                            Route,
                          );
                          return;
                        }

                        setDirections(result);
                        mapRef.current?.fitToCoordinates(
                          [
                            location,
                            ...result.polylinePoints,
                            {
                              latitude: loc.latitude,
                              longitude: loc.longitude,
                            },
                          ],
                          {
                            edgePadding: {
                              top: 120,
                              right: 40,
                              bottom: 380,
                              left: 40,
                            },
                            animated: true,
                          },
                        );
                      }}
                    >
                      <Navigation size={16} color="#1A73E8" strokeWidth={2.4} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleRemoveFriend(f.uid, f.name)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={14} color="#bbb" strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>
              );
            })
        )}
      </ScrollView>
    );
  }

  // ── Events tab ─────────────────────────────────────────────────────────────
  function renderEventsTab() {
    return (
      <>
        <View style={styles.tabTitleRow}>
          <Calendar size={16} color="#1a5c38" strokeWidth={2.4} />
          <Text style={styles.tabTitleText}>Campus Events</Text>
          {events.length > 0 && (
            <View style={styles.tabCountBadge}>
              <Text style={styles.tabCountBadgeText}>{events.length}</Text>
            </View>
          )}
        </View>
        <ScrollView
          style={styles.buildingsList}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {!eventsLoaded ? (
            <TabSkeleton rows={3} />
          ) : events.length === 0 ? (
            <Text style={styles.emptyText}>
              No events yet. Check back soon!
            </Text>
          ) : (
            events.map((ev) => (
              <TouchableOpacity
                key={ev.id}
                style={styles.eventCard}
                activeOpacity={0.75}
                onPress={() => {
                  mapRef.current?.animateToRegion(
                    {
                      latitude: ev.latitude,
                      longitude: ev.longitude,
                      latitudeDelta: 0.003,
                      longitudeDelta: 0.003,
                    },
                    600,
                  );
                  setSelectedEvent(ev);
                  setActiveTab("home");
                }}
              >
                <View style={styles.eventAccentBar} />
                <View style={styles.eventIconBox}>
                  <Calendar size={20} color="#d97706" strokeWidth={2.2} />
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventName} numberOfLines={1}>
                    {ev.name}
                  </Text>
                  <View style={styles.eventDatePill}>
                    <Text style={styles.eventDatePillText}>
                      {ev.date}
                      {ev.time ? ` · ${ev.time}` : ""}
                    </Text>
                  </View>
                  <View style={styles.eventLocRow}>
                    <MapPin size={11} color="#888" strokeWidth={2.2} />
                    <Text style={styles.eventLoc} numberOfLines={1}>
                      {ev.locationName}
                    </Text>
                  </View>
                  {ev.description ? (
                    <Text style={styles.eventDesc} numberOfLines={2}>
                      {ev.description}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.dirArrow}>
                  <ChevronRight size={18} color="#ccc" strokeWidth={2} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </>
    );
  }

  // ── Bottom sheet content ───────────────────────────────────────────────────
  function renderBottomContent() {
    if (directions || loadingDirs) return renderDirectionsPanel();

    return (
      <>
        <View style={{ display: activeTab === "home" ? "flex" : "none" }}>
          <View style={styles.searchBar}>
            <Search size={18} color="#64748B" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search campus locations…"
              placeholderTextColor="#999"
              value={search}
              onFocus={() => setSearchFocused(true)}
              onChangeText={(text) => {
                setSearch(text);
                if (text.length > 0) setFilterCat("all");
              }}
              returnKeyType="search"
              onSubmitEditing={() => {
                setSearchFocused(false);
                Keyboard.dismiss();
              }}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <X size={18} color="#64748B" style={{ paddingHorizontal: 4 }} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterRow}
            keyboardShouldPersistTaps="handled"
          >
            {CATEGORIES.map((cat) => {
              const colors = CATEGORY_COLORS[cat] || {
                pin: "#1a5c38",
                dot: "#e8f5ee",
              };
              const active = filterCat === cat;
              const ChipIcon =
                cat === "all" ? Compass : CATEGORY_ICON[cat] || Building2;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.filterChip,
                    active && {
                      backgroundColor: cat === "all" ? "#1a5c38" : colors.pin,
                      borderColor: cat === "all" ? "#1a5c38" : colors.pin,
                    },
                  ]}
                  onPress={() => {
                    setFilterCat(cat);
                    if (cat !== "all") {
                      const first = BUILDINGS.find((b) => b.category === cat);
                      if (first) {
                        setTimeout(() => {
                          mapRef.current?.animateToRegion(
                            {
                              latitude: first.latitude,
                              longitude: first.longitude,
                              latitudeDelta: 0.008,
                              longitudeDelta: 0.008,
                            },
                            700,
                          );
                        }, 100);
                      }
                    } else {
                      mapRef.current?.animateToRegion(
                        {
                          latitude: 6.517,
                          longitude: 3.393,
                          latitudeDelta: 0.008,
                          longitudeDelta: 0.008,
                        },
                        700,
                      );
                    }
                  }}
                >
                  <ChipIcon
                    size={14}
                    color={active ? "#fff" : colors.pin}
                    strokeWidth={2.2}
                    style={{ marginRight: 5 }}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {searchFocused && search.length === 0 ? (
            <View style={styles.searchFocusedPanel}>
              {recentSearches.length > 0 && (
                <>
                  <Text style={styles.searchSectionLabel}>Recent</Text>
                  {recentSearches.map((b) => (
                    <TouchableOpacity
                      key={`recent-${b.id}`}
                      style={styles.resultItem}
                      onPress={() => handleSelectBuilding(b)}
                    >
                      <View
                        style={[
                          styles.resultIconBox,
                          {
                            backgroundColor: (
                              CATEGORY_COLORS[b.category] ||
                              CATEGORY_COLORS.admin
                            ).dot,
                          },
                        ]}
                      >
                        <History size={16} color="#64748B" strokeWidth={2.2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultName}>{b.name}</Text>
                        <Text style={styles.resultDesc}>{b.description}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}
              {nearbyPlaces.length > 0 && (
                <>
                  <Text style={styles.searchSectionLabel}>Nearby</Text>
                  {nearbyPlaces.map((b) => {
                    const NearbyIcon = CATEGORY_ICON[b.category] || Building2;
                    const nearbyColors =
                      CATEGORY_COLORS[b.category] || CATEGORY_COLORS.admin;
                    return (
                      <TouchableOpacity
                        key={`nearby-${b.id}`}
                        style={styles.resultItem}
                        onPress={() => handleSelectBuilding(b)}
                      >
                        <View
                          style={[
                            styles.resultIconBox,
                            { backgroundColor: nearbyColors.dot },
                          ]}
                        >
                          <NearbyIcon
                            size={16}
                            color={nearbyColors.pin}
                            strokeWidth={2.2}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.resultName}>{b.name}</Text>
                          <Text style={styles.resultDesc}>{b.description}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
              {recentSearches.length === 0 && nearbyPlaces.length === 0 && (
                <Text style={styles.emptyText}>
                  Start typing to search campus locations.
                </Text>
              )}
            </View>
          ) : search.length > 0 ? (
            <ScrollView
              style={styles.searchResults}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {matchingEvents.length > 0 && (
                <>
                  <Text style={styles.searchSectionLabel}>Events</Text>
                  {matchingEvents.map((ev) => (
                    <TouchableOpacity
                      key={`event-${ev.id}`}
                      style={styles.resultItem}
                      onPress={() => {
                        setSearch("");
                        Keyboard.dismiss();
                        mapRef.current?.animateToRegion(
                          {
                            latitude: ev.latitude,
                            longitude: ev.longitude,
                            latitudeDelta: 0.003,
                            longitudeDelta: 0.003,
                          },
                          600,
                        );
                        setSelectedEvent(ev);
                      }}
                    >
                      <View
                        style={[
                          styles.resultIconBox,
                          { backgroundColor: "#fef3c7" },
                        ]}
                      >
                        <Calendar size={16} color="#d97706" strokeWidth={2.2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <HighlightMatch
                          text={ev.name}
                          query={search}
                          textStyle={styles.resultName}
                          matchStyle={styles.resultMatchHighlight}
                        />
                        <Text style={styles.resultDesc}>
                          {ev.date}
                          {ev.time ? ` · ${ev.time}` : ""} · {ev.locationName}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.categoryPill,
                          { backgroundColor: "#fef3c7" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryPillText,
                            { color: "#d97706" },
                          ]}
                        >
                          event
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  <Text style={styles.searchSectionLabel}>Places</Text>
                </>
              )}
              {visibleBuildings.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={styles.resultItem}
                  onPress={() => handleSelectBuilding(b)}
                >
                  {(() => {
                    const ResultIcon =
                      b.category === "other"
                        ? MapPin
                        : CATEGORY_ICON[b.category] || Building2;
                    const resultColors =
                      CATEGORY_COLORS[b.category] || CATEGORY_COLORS.admin;
                    return (
                      <View
                        style={[
                          styles.resultIconBox,
                          { backgroundColor: resultColors.dot },
                        ]}
                      >
                        <ResultIcon
                          size={16}
                          color={resultColors.pin}
                          strokeWidth={2.2}
                        />
                      </View>
                    );
                  })()}
                  <View style={{ flex: 1 }}>
                    <HighlightMatch
                      text={b.name}
                      query={search}
                      textStyle={styles.resultName}
                      matchStyle={styles.resultMatchHighlight}
                    />
                    <HighlightMatch
                      text={b.description}
                      query={search}
                      textStyle={styles.resultDesc}
                      matchStyle={styles.resultMatchHighlight}
                    />
                  </View>
                  <View
                    style={[
                      styles.categoryPill,
                      {
                        backgroundColor:
                          b.category === "other"
                            ? "#ede9fe"
                            : (
                                CATEGORY_COLORS[b.category] ||
                                CATEGORY_COLORS.admin
                              ).dot,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        {
                          color:
                            b.category === "other"
                              ? "#7c3aed"
                              : (
                                  CATEGORY_COLORS[b.category] ||
                                  CATEGORY_COLORS.admin
                                ).pin,
                        },
                      ]}
                    >
                      {b.category === "other" ? "community" : b.category}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              {visibleBuildings.length === 0 && matchingEvents.length === 0 && (
                <View style={styles.noResultsBox}>
                  <Text style={styles.emptyText}>
                    No matches for "{search}"
                  </Text>
                  <Text style={styles.noResultsHint}>
                    Try browsing a category instead:
                  </Text>
                  <View style={styles.noResultsChipRow}>
                    {CATEGORIES.filter((c) => c !== "all").map((cat) => {
                      const colors =
                        CATEGORY_COLORS[cat] || CATEGORY_COLORS.admin;
                      const ChipIcon = CATEGORY_ICON[cat] || Building2;
                      return (
                        <TouchableOpacity
                          key={`noresult-${cat}`}
                          style={[
                            styles.noResultsChip,
                            { borderColor: colors.pin },
                          ]}
                          onPress={() => {
                            setSearch("");
                            setFilterCat(cat);
                          }}
                        >
                          <ChipIcon
                            size={13}
                            color={colors.pin}
                            strokeWidth={2.2}
                          />
                          <Text
                            style={[
                              styles.noResultsChipText,
                              { color: colors.pin },
                            ]}
                          >
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
          ) : null}
        </View>

        {/* BUILDINGS TAB */}
        <View style={{ display: activeTab === "buildings" ? "flex" : "none" }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterRow}
            keyboardShouldPersistTaps="handled"
          >
            {CATEGORIES.map((cat) => {
              const colors = CATEGORY_COLORS[cat] || {
                pin: "#1a5c38",
                dot: "#e8f5ee",
              };
              const active = filterCat === cat;
              const ChipIcon =
                cat === "all" ? Compass : CATEGORY_ICON[cat] || Building2;
              return (
                <TouchableOpacity
                  key={`places-chip-${cat}`}
                  style={[
                    styles.filterChip,
                    active && {
                      backgroundColor: cat === "all" ? "#1a5c38" : colors.pin,
                      borderColor: cat === "all" ? "#1a5c38" : colors.pin,
                    },
                  ]}
                  onPress={() => setFilterCat(cat)}
                >
                  <ChipIcon
                    size={14}
                    color={active ? "#fff" : colors.pin}
                    strokeWidth={2.2}
                    style={{ marginRight: 5 }}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.tabTitleRow}>
            <MapPin size={16} color="#1a5c38" strokeWidth={2.4} />
            <Text style={styles.tabTitleText}>
              {filterCat === "all"
                ? "All Locations"
                : `${filterCat.charAt(0).toUpperCase()}${filterCat.slice(1)} Locations`}{" "}
              (
              {filterCat === "all"
                ? communityLoaded
                  ? BUILDINGS.length + communityLocations.length
                  : BUILDINGS.length
                : BUILDINGS.filter((b) => b.category === filterCat).length}
              )
            </Text>
          </View>
          <ScrollView
            style={styles.buildingsList}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            {BUILDINGS.filter(
              (b) => filterCat === "all" || b.category === filterCat,
            ).map((b) => {
              const colors =
                CATEGORY_COLORS[b.category] || CATEGORY_COLORS.admin;
              return (
                <TouchableOpacity
                  key={b.id}
                  style={styles.buildingItem}
                  onPress={() => {
                    setSelected(b);
                    setActiveTab("home");
                    mapRef.current?.animateToRegion(
                      {
                        latitude: b.latitude,
                        longitude: b.longitude,
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                      },
                      600,
                    );
                  }}
                >
                  {(() => {
                    const BIcon = CATEGORY_ICON[b.category] || Building2;
                    return (
                      <View
                        style={[
                          styles.buildingIconBox,
                          { backgroundColor: colors.dot },
                        ]}
                      >
                        <BIcon size={18} color={colors.pin} strokeWidth={2.2} />
                      </View>
                    );
                  })()}
                  <View style={styles.buildingInfo}>
                    <Text style={styles.buildingName}>{b.name}</Text>
                    <Text style={styles.buildingDesc}>{b.description}</Text>
                  </View>
                  <View
                    style={[
                      styles.categoryPill,
                      { backgroundColor: colors.dot },
                    ]}
                  >
                    <Text
                      style={[styles.categoryPillText, { color: colors.pin }]}
                    >
                      {b.category}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* FRIENDS TAB */}
        <View style={{ display: activeTab === "friends" ? "flex" : "none" }}>
          {renderFriendsTab()}
        </View>

        {/* EVENTS TAB */}
        <View style={{ display: activeTab === "events" ? "flex" : "none" }}>
          {renderEventsTab()}
        </View>
      </>
    );
  }

  const searchActive = searchFocused || search.length > 0;
  const bottomSheetTall =
    activeTab === "buildings" ||
    activeTab === "friends" ||
    activeTab === "events" ||
    !!directions ||
    (activeTab === "home" && searchActive);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StyledModal {...modal} />

      {/* ── MAP ── */}
      <MapView
        mapRef={(ref: any) => {
          mapRef.current = ref;
        }}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation={false}
        showsMyLocationButton={!navigating}
        showsCompass={true}
        rotateEnabled={true}
        pitchEnabled={true}
        showsBuildings={true}
        showsPointsOfInterest={false}
        initialRegion={{
          latitude: 6.517,
          longitude: 3.393,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        }}
        onPanDrag={() => {
          if (navigating) setFollowUser(false);
          if (searchFocused) {
            setSearchFocused(false);
            Keyboard.dismiss();
          }
        }}
        customMapStyle={[]}
        // ── Clustering (react-native-map-clustering) ──
        // Off while actively navigating: at that point there's really
        // just the route + destination to look at, and clustering math
        // on every region change is wasted work during a GPS-driven
        // camera that's already moving every ~800ms.
        clusteringEnabled={!navigating}
        clusterColor="#1a5c38"
        clusterTextColor="#fff"
        radius={100}
        minPoints={2}
        spiralEnabled={false}
        preserveClusterPressBehavior={false}
        edgePadding={{ top: 120, left: 40, right: 40, bottom: 380 }}
      >
        {(displayUserLocation ?? userLocation) && (
          <Marker
            coordinate={displayUserLocation ?? userLocation!}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
            rotation={smoothedHeading} // CHANGE 8: was `heading` (jerky raw value)
          >
            <View
              style={{
                width: 80,
                height: 80,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  width: 70,
                  height: 70,
                  borderRadius: 35,
                  backgroundColor: "rgba(66,133,244,0.15)",
                }}
              />
              {navigating && (
                <View
                  style={{
                    position: "absolute",
                    width: 0,
                    height: 0,
                    borderLeftWidth: 18,
                    borderRightWidth: 18,
                    borderBottomWidth: 50,
                    borderLeftColor: "transparent",
                    borderRightColor: "transparent",
                    borderBottomColor: "rgba(66,133,244,0.25)",
                    bottom: "50%",
                    transform: [{ translateY: 8 }],
                  }}
                />
              )}
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: "#fff",
                  justifyContent: "center",
                  alignItems: "center",
                  shadowColor: "#000",
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 6,
                }}
              >
                <View
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: "#4285F4",
                  }}
                />
              </View>
            </View>
          </Marker>
        )}

        {visibleBuildings.map((building) => (
          <BuildingMarker
            key={building.id}
            building={building}
            isSelected={selected?.id === building.id}
            onPress={() => {
              setSelected(building);
              setDirections(null);
              setNavigating(false);
            }}
          />
        ))}

        {friendLocations
          .filter((f) => Date.now() - (f.updatedAt || 0) < 5 * 60 * 1000)
          .map((f) => (
            <FriendMarker key={f.uid} friend={f} photo={friendPhotos[f.uid]} />
          ))}

        {communityLocations.map((loc) => (
          <CommunityLocationMarker
            key={loc.id}
            loc={loc}
            onPress={() => {
              setSelected({
                ...loc,
                description: loc.description || "Community submitted",
              });
              setDirections(null);
              setNavigating(false);
            }}
          />
        ))}

        {events
          .filter((ev) => ev.latitude && ev.longitude)
          .map((ev) => (
            <Marker
              key={ev.id}
              coordinate={{ latitude: ev.latitude, longitude: ev.longitude }}
              onPress={() => setSelectedEvent(ev)}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              <View
                style={[
                  mStyles.pin,
                  { backgroundColor: "#d97706", borderColor: "#fef3c7" },
                ]}
              >
                <Calendar size={14} color="#fff" strokeWidth={2.4} />
              </View>
              <View style={[mStyles.pinTail, { borderTopColor: "#d97706" }]} />
            </Marker>
          ))}

        {navigating && routeSplit.traveled.length > 1 && (
          <Polyline
            coordinates={routeSplit.traveled}
            strokeColor="#9bbcf5"
            strokeWidth={6}
            lineCap="round"
          />
        )}
        {routeSplit.remaining.length > 1 && (
          <Polyline
            coordinates={routeSplit.remaining}
            strokeColor="#1A73E8"
            strokeWidth={navigating ? 8 : 5}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapView>

      {/* ── OVERLAYS ── */}
      {renderNavBanner()}
      {renderNavEtaBar()}

      {/* ── COMPASS POINTER (auto-shows under 200m while navigating) ── */}
      {navigating &&
        userLocation &&
        selected &&
        distanceToDestination <= 200 &&
        distanceToDestination > 15 && (
          <View
            style={{
              position: "absolute",
              bottom: Platform.OS === "ios" ? 360 : 335,
              left: 0,
              right: 0,
            }}
          >
            <CompassPointer
              userLat={userLocation.latitude}
              userLng={userLocation.longitude}
              destLat={selected.latitude}
              destLng={selected.longitude}
              distanceMetres={distanceToDestination}
            />
          </View>
        )}

      {/* Campus Services FAB — only in the calm, default map state */}
      {!navigating &&
        !directions &&
        !loadingDirs &&
        activeTab === "home" &&
        !searchFocused &&
        search.length === 0 && (
          <TouchableOpacity
            style={styles.servicesFab}
            onPress={() => router.push("./service")}
            activeOpacity={0.85}
          >
            <ShoppingBag size={22} color="#fff" strokeWidth={2.2} />
          </TouchableOpacity>
        )}

      {/* Re-centre button */}
      {navigating && !followUser && (
        <TouchableOpacity
          style={styles.recentreBtn}
          onPress={() => {
            setFollowUser(true);
            if (userLocation)
              mapRef.current?.animateCamera(
                {
                  center: {
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                  },
                  zoom: travelMode === "driving" ? 17 : 19,
                  pitch: travelMode === "driving" ? 55 : 65,
                  heading: smoothedHeading,
                },
                { duration: 600 },
              );
          }}
          activeOpacity={0.85}
        >
          <View style={styles.recentreBtnInner}>
            <LocateFixed size={22} color="#1A73E8" strokeWidth={2.2} />
          </View>
        </TouchableOpacity>
      )}

      {/* ── TOP BAR ── */}
      {!navigating && (
        <View style={styles.topBar}>
          <View style={styles.topLeft}>
            <Text style={styles.appName}>CampusNav</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.sharingPill,
              sharingLocation && styles.sharingPillActive,
            ]}
            onPress={() => setActiveTab("friends")}
          >
            {sharingLocation ? (
              <MapPin size={12} color="#1a5c38" strokeWidth={2.4} />
            ) : (
              <EyeOff size={12} color="#555" strokeWidth={2.4} />
            )}
            <Text style={styles.sharingPillText}>
              {sharingLocation ? "Live" : "Hidden"}
            </Text>
          </TouchableOpacity>
          {friendRequests.length > 0 && (
            <View style={styles.requestBadge}>
              <Text style={styles.requestBadgeText}>
                {friendRequests.length}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── SELECTED CARD ── */}
      {selected &&
        !directions &&
        !loadingDirs &&
        activeTab === "home" &&
        !navigating && (
          <SelectedLocationCard
            selected={selected}
            userLocation={userLocation}
            onGetDirections={handleGetDirections}
            onClose={() => setSelected(null)}
          />
        )}

      {/* ── EVENT POPUP ── */}
      {selectedEvent && !directions && !loadingDirs && !navigating && (
        <View style={styles.selectedCard}>
          <View style={[styles.eventIconBox, { marginRight: 12 }]}>
            <Calendar size={22} color="#d97706" strokeWidth={2.2} />
          </View>
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedName}>{selectedEvent.name}</Text>
            <Text style={styles.selectedCoords}>
              {selectedEvent.date}
              {selectedEvent.time ? ` · ${selectedEvent.time}` : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.directionsBtn}
            onPress={() => {
              setSelected({
                name: selectedEvent.name,
                latitude: selectedEvent.latitude,
                longitude: selectedEvent.longitude,
                description: `📍 ${selectedEvent.locationName}`,
                icon: selectedEvent.icon || "📌",
              });
              setSelectedEvent(null);
            }}
          >
            <Text style={styles.directionsBtnText}>Directions</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedEvent(null)}
            style={{ paddingLeft: 8 }}
          >
            <X size={16} color="#999" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── BOTTOM SHEET ── */}
      {!navigating && (
        <View style={[styles.keyboardAvoid, { bottom: keyboardHeight }]}>
          <View
            style={[
              styles.bottomSheet,
              bottomSheetTall && {
                maxHeight: Math.min(520, SCREEN_HEIGHT - keyboardHeight - 140),
              },
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1 }}
            >
              {renderBottomContent()}
            </ScrollView>
            {!directions && !loadingDirs && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.bottomNavScroll}
                contentContainerStyle={styles.bottomNavContent}
                keyboardShouldPersistTaps="handled"
              >
                {[
                  { tab: "home", Icon: Home, label: "Home" },
                  { tab: "buildings", Icon: MapPin, label: "Places" },
                  { tab: "friends", Icon: Users, label: "Friends" },
                  { tab: "events", Icon: Calendar, label: "Events" },
                ].map(({ tab, Icon, label }) => (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      styles.navItem,
                      activeTab === tab && styles.navItemActive,
                    ]}
                    onPress={() => {
                      setActiveTab(tab);
                      if (tab === "buildings") {
                        mapRef.current?.animateToRegion(
                          {
                            latitude: 6.517,
                            longitude: 3.393,
                            latitudeDelta: 0.008,
                            longitudeDelta: 0.008,
                          },
                          600,
                        );
                      }
                    }}
                  >
                    <View>
                      <Icon
                        size={20}
                        color={activeTab === tab ? "#1A73E8" : "#999"}
                        strokeWidth={activeTab === tab ? 2.4 : 2}
                      />
                      {tab === "friends" && friendRequests.length > 0 && (
                        <View style={styles.navBadge}>
                          <Text style={styles.navBadgeText}>
                            {friendRequests.length}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.navLabel,
                        activeTab === tab && styles.navActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.navItem}
                  onPress={() => router.push("../account")}
                >
                  <User size={20} color="#999" strokeWidth={2} />
                  <Text style={styles.navLabel}>Dashboard</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      )}

      {/* ── NAVIGATION STEPS SHEET ── */}
      {navigating && directions && (
        <View style={styles.navStepsSheet}>{renderDirectionsPanel()}</View>
      )}

      {/* ── AR MODE OVERLAY ── */}
      {arMode && navigating && directions && selected && userLocation && (
        <ARNavigationGate
          userLocation={userLocation}
          destination={selected}
          heading={smoothedHeading}
          currentInstruction={
            (directions.steps[activeStep] as any)?.instruction ?? ""
          }
          distanceToNext={(directions.steps[activeStep] as any)?.distance ?? ""}
          nextManeuver={(directions.steps[activeStep] as any)?.maneuver ?? ""}
          eta={liveEta || directions.totalDuration}
          onExit={() => setArMode(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  topBar: {
    position: "absolute",
    top: 55,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  topLeft: { flex: 1 },
  appName: { fontSize: 15, fontWeight: "600", color: "#1a5c38" },
  campusSubtitle: {
    fontSize: 11,
    color: "#4a8c63",
    fontWeight: "600",
    marginTop: 1,
  },
  sharingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#eee",
    marginRight: 6,
  },
  sharingPillActive: { backgroundColor: "#e8f5ee" },
  sharingPillText: { fontSize: 12, fontWeight: "700", color: "#555" },
  requestBadge: {
    backgroundColor: "#e74c3c",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    paddingHorizontal: 5,
  },
  requestBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  selectedCard: {
    position: "absolute",
    top: 130,
    left: 16,
    right: 80,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  selectedIcon: { fontSize: 28, marginRight: 12 },
  selectedInfo: { flex: 1 },
  selectedName: { fontSize: 14, fontWeight: "700", color: "#1a5c38" },
  selectedCoords: { fontSize: 12, color: "#999", marginTop: 2 },
  closeText: { fontSize: 16, color: "#999" },
  directionsBtn: {
    backgroundColor: "#1A73E8",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  directionsBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  navBannerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  reroutingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8711a",
    paddingVertical: 10,
  },
  reroutingOverlayText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  navBannerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A73E8",
    paddingTop: Platform.OS === "ios" ? 54 : 32,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  navArrowBox: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  navArrowText: { fontSize: 28, color: "#fff", fontWeight: "900" },
  navInstructionBox: { flex: 1 },
  navInstructionText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 24,
  },
  navInstructionDist: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 3,
  },
  muteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 10,
  },
  navNextStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#155bb5",
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  navNextLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginRight: 4,
  },
  navNextArrow: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "700",
    marginRight: 6,
  },
  navNextText: { fontSize: 13, color: "#fff", flex: 1 },
  navNextDist: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginLeft: 8 },

  etaBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: Platform.OS === "ios" ? 32 : 14,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 12,
  },
  etaItem: { alignItems: "center", flex: 1 },
  etaValue: { fontSize: 16, fontWeight: "700", color: "#222" },
  etaLabel: {
    fontSize: 11,
    color: "#888",
    marginTop: 2,
    textTransform: "capitalize",
  },
  etaDivider: { width: 1, height: 32, backgroundColor: "#eee" },
  etaEndBtn: {
    backgroundColor: "#e8f0fe",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginLeft: 16,
  },
  etaEndText: { color: "#1A73E8", fontWeight: "700", fontSize: 14 },

  navStepsSheet: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 112 : 88,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.35,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    overflow: "hidden",
  },

  recentreBtn: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 420 : 400,
    right: 16,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  recentreBtnInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  recentreBtnIcon: { fontSize: 26, color: "#1A73E8" },

  servicesFab: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 300 : 280,
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1a5c38",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },

  keyboardAvoid: { position: "absolute", bottom: 0, left: 0, right: 0 },
  bottomSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  bottomSheetTall: { maxHeight: 520 },

  loadingRow: { flexDirection: "row", alignItems: "center", padding: 20 },
  loadingTitle: { fontSize: 16, fontWeight: "700", color: "#222" },
  loadingSubtitle: { fontSize: 13, color: "#888", marginTop: 2 },

  dirSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  dirDuration: { fontSize: 20, fontWeight: "800", color: "#222" },
  dirDistMode: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
    textTransform: "capitalize",
  },
  dirActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
    gap: 10,
  },
  startNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1A73E8",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  stopNavBtn: { backgroundColor: "#e53935" },
  startNavBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  cancelBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtnText: { color: "#555", fontSize: 16, fontWeight: "700" },

  progressBar: {
    height: 3,
    backgroundColor: "#eee",
    borderRadius: 2,
    marginBottom: 12,
    overflow: "hidden",
  },
  progressFill: { height: 3, backgroundColor: "#1A73E8", borderRadius: 2 },

  modeRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#ddd",
    backgroundColor: "#f5f5f5",
    paddingVertical: 9,
  },
  modeBtnActive: { backgroundColor: "#e8f0fe", borderColor: "#1A73E8" },
  modeBtnIcon: { fontSize: 16 },
  modeBtnText: { fontSize: 13, fontWeight: "600", color: "#555" },
  modeBtnTextActive: { color: "#1A73E8" },

  stepsList: { maxHeight: 220 },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  stepRowActive: { backgroundColor: "#e8f0fe", borderRadius: 10 },
  stepRowDone: { opacity: 0.5 },
  stepBullet: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  stepBulletActive: { backgroundColor: "#1A73E8" },
  stepBulletDone: { backgroundColor: "#34a853" },
  stepBulletText: { fontSize: 15, color: "#555" },
  stepBulletTextLight: { color: "#fff" },
  stepBody: { flex: 1 },
  stepInstruction: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    lineHeight: 18,
  },
  stepInstructionActive: { color: "#1A73E8" },
  stepInstructionDone: { color: "#888" },
  stepMeta: { fontSize: 12, color: "#999", marginTop: 3 },
  stepActivePip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1A73E8",
    alignSelf: "center",
    marginLeft: 8,
  },

  bottomNavScroll: {
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  bottomNavContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 10,
    paddingHorizontal: 4,
    minWidth: "100%",
  },
  navItem: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  navItemActive: { backgroundColor: "#e8f0fe" },
  navIcon: { fontSize: 22 },
  navLabel: { fontSize: 11, color: "#999", marginTop: 4 },
  navActive: { color: "#1A73E8", fontWeight: "700" },
  navBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    backgroundColor: "#e74c3c",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  navBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee",
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: "#222" },
  clearText: { fontSize: 14, color: "#999", paddingHorizontal: 4 },
  filterRow: { marginBottom: 10 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#ddd",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
  },
  filterChipIcon: { fontSize: 13, marginRight: 5 },
  filterChipText: { fontSize: 12, color: "#555", fontWeight: "600" },
  filterChipTextActive: { color: "#fff" },
  locationCount: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  searchResults: { maxHeight: 220, marginBottom: 8 },
  searchFocusedPanel: { maxHeight: 320, marginBottom: 8 },
  searchSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginTop: 10,
    marginBottom: 4,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  resultIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  resultName: { fontSize: 14, fontWeight: "600", color: "#333" },
  resultDesc: { fontSize: 12, color: "#999", marginTop: 2 },

  previewSection: { marginBottom: 16 },
  previewHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  previewHeaderText: { fontSize: 13, fontWeight: "700", color: "#333" },
  previewSeeAll: { fontSize: 12, fontWeight: "600", color: "#1a5c38" },

  avatarStripRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarStripItem: { position: "relative" },
  avatarStripAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1a5c38",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarStripImg: { width: 40, height: 40, borderRadius: 20 },
  avatarStripText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  avatarStripDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#2fae60",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarStripMore: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eef2ef",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarStripMoreText: { color: "#1a5c38", fontWeight: "700", fontSize: 12 },

  eventPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  eventPreviewBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#f0f7f3",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  eventPreviewBadgeDay: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1a5c38",
    lineHeight: 17,
  },
  eventPreviewBadgeMonth: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4a8c63",
    letterSpacing: 0.4,
  },
  eventPreviewInfo: { flex: 1 },
  eventPreviewName: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  eventPreviewMeta: { fontSize: 12, color: "#888", marginTop: 2 },
  eventPreviewMore: {
    fontSize: 11,
    color: "#aaa",
    marginTop: 8,
    marginLeft: 56,
  },

  tabTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  tabTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  tabTitleText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  buildingsList: { maxHeight: 360, marginBottom: 8 },
  buildingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  buildingIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  buildingIcon: { fontSize: 20 },
  buildingInfo: { flex: 1 },
  buildingName: { fontSize: 14, fontWeight: "600", color: "#333" },
  buildingDesc: { fontSize: 12, color: "#999", marginTop: 2 },
  categoryPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  categoryPillText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },

  friendsScroll: { maxHeight: 400 },
  sharingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f0f7f3",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#c8e6d4",
  },
  sharingLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  sharingIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#e8f5ee",
    justifyContent: "center",
    alignItems: "center",
  },
  sharingTitle: { fontSize: 14, fontWeight: "700", color: "#1a5c38" },
  sharingSub: { fontSize: 12, color: "#4a8c63", marginTop: 2 },
  addFriendCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#eee",
    padding: 4,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  addFriendRow: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  addFriendInput: {
    flex: 1,
    backgroundColor: "transparent",
    borderRadius: 10,
    padding: 11,
    paddingRight: 36,
    fontSize: 14,
    color: "#333",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#888",
    marginBottom: 8,
    marginTop: 4,
  },
  sectionLabelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#888",
  },
  tabCountBadge: {
    backgroundColor: "#e8f5ee",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  tabCountBadgeText: { color: "#1a5c38", fontSize: 11, fontWeight: "700" },
  tabCountBadgeAmber: { backgroundColor: "#fef3c7" },
  tabCountBadgeTextAmber: { color: "#b45309" },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1a5c38",
  },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fffdf6",
    borderRadius: 14,
    padding: 11,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "#f5e2a8",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 11,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  friendAvatarWrap: { position: "relative", marginRight: 11 },
  friendOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2fae60",
    borderWidth: 2,
    borderColor: "#fff",
  },
  friendAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#1a5c38",
    justifyContent: "center",
    alignItems: "center",
  },
  friendAvatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  friendAvatarImg: { width: 42, height: 42, borderRadius: 21 },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  friendMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  friendStatusDot: { width: 6, height: 6, borderRadius: 3 },
  friendStatusDotLive: { backgroundColor: "#2fae60" },
  friendStatusDotHidden: { backgroundColor: "#ccc" },
  friendEmail: { fontSize: 12, color: "#888" },
  acceptBtn: {
    backgroundColor: "#1a5c38",
    borderRadius: 17,
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },
  acceptBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  declineBtn: {
    backgroundColor: "#f5f5f5",
    borderRadius: 17,
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },
  declineBtnText: { color: "#888", fontWeight: "700", fontSize: 14 },
  locateBtn: {
    backgroundColor: "#e8f0fe",
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  emptyText: {
    fontSize: 13,
    color: "#aaa",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  resultMatchHighlight: { fontWeight: "800", color: "#1a5c38" },
  noResultsBox: { paddingVertical: 12 },
  noResultsHint: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 10,
  },
  noResultsChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  noResultsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 8,
  },
  noResultsChipText: { fontSize: 12, fontWeight: "600" },
  clearSearchBtn: { position: "absolute", right: 12, padding: 4 },
  suggestionsBox: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#e0ede8",
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  suggestionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1a5c38",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  suggestionAvatarText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  suggestionAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  suggestionInfo: { flex: 1 },
  suggestionName: { fontSize: 14, fontWeight: "600", color: "#222" },
  suggestionSub: { fontSize: 12, color: "#888", marginTop: 1 },
  sendRequestBtn: {
    backgroundColor: "#1a5c38",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sendRequestText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  noResultsText: {
    fontSize: 13,
    color: "#aaa",
    textAlign: "center",
    marginBottom: 10,
  },

  eventCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    overflow: "hidden",
  },
  eventAccentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: "#d97706",
  },
  eventIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#fef3c7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  eventInfo: { flex: 1 },
  eventName: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  eventDatePill: {
    alignSelf: "flex-start",
    backgroundColor: "#fef3c7",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    marginBottom: 3,
  },
  eventDatePillText: { fontSize: 11, color: "#b45309", fontWeight: "700" },
  eventLocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  eventLoc: { fontSize: 12, color: "#888" },
  eventDesc: { fontSize: 12, color: "#aaa", marginTop: 3 },
  dirArrow: { justifyContent: "center", paddingLeft: 8 },

  arBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
  },
  arBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
});
