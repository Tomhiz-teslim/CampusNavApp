import * as Location from "expo-location";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import {
  get,
  onValue,
  push,
  ref,
  remove,
  set,
  update,
} from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, database } from "../lib/firebase";
import ServicesTab from "../components/services";

// ── Hardcoded campus buildings (same as map screen) ──────────────────────────
const BUILDINGS = [
  {
    id: "b1",
    name: "Independence Hall",
    latitude: 6.5178,
    longitude: 3.3912,
    category: "hostel",
  },
  {
    id: "b2",
    name: "Jaja Hostel",
    latitude: 6.5165,
    longitude: 3.3887,
    category: "hostel",
  },
  {
    id: "b3",
    name: "Mariere Hall",
    latitude: 6.519,
    longitude: 3.3906,
    category: "hostel",
  },
  {
    id: "b4",
    name: "Moremi Hall",
    latitude: 6.5182,
    longitude: 3.3894,
    category: "hostel",
  },
  {
    id: "b5",
    name: "Queen Idia Hall",
    latitude: 6.5184,
    longitude: 3.3899,
    category: "hostel",
  },
  {
    id: "b6",
    name: "Sultan Bello Hall",
    latitude: 6.5176,
    longitude: 3.389,
    category: "hostel",
  },
  {
    id: "b7",
    name: "Fabian Olusanya Hall",
    latitude: 6.518,
    longitude: 3.3886,
    category: "hostel",
  },
  {
    id: "b8",
    name: "Biobaku Hall",
    latitude: 6.5187,
    longitude: 3.39,
    category: "hostel",
  },
  {
    id: "b9",
    name: "Mellanbay Hostel",
    latitude: 6.5174,
    longitude: 3.3884,
    category: "hostel",
  },
  {
    id: "b10",
    name: "New Hall",
    latitude: 6.5192,
    longitude: 3.3909,
    category: "hostel",
  },
  {
    id: "b11",
    name: "Faculty of Arts",
    latitude: 6.517,
    longitude: 3.3918,
    category: "faculty",
  },
  {
    id: "b12",
    name: "Faculty of Business Admin.",
    latitude: 6.515,
    longitude: 3.3915,
    category: "faculty",
  },
  {
    id: "b13",
    name: "Faculty of Education",
    latitude: 6.5155,
    longitude: 3.3905,
    category: "faculty",
  },
  {
    id: "b14",
    name: "Faculty of Engineering",
    latitude: 6.5168,
    longitude: 3.394,
    category: "faculty",
  },
  {
    id: "b15",
    name: "Faculty of Environmental",
    latitude: 6.5162,
    longitude: 3.3933,
    category: "faculty",
  },
  {
    id: "b16",
    name: "Faculty of Law",
    latitude: 6.5161,
    longitude: 3.3921,
    category: "faculty",
  },
  {
    id: "b17",
    name: "Faculty of Medicine (CMS)",
    latitude: 6.5145,
    longitude: 3.3925,
    category: "faculty",
  },
  {
    id: "b18",
    name: "Faculty of Pharmacy",
    latitude: 6.5148,
    longitude: 3.393,
    category: "faculty",
  },
  {
    id: "b19",
    name: "Faculty of Science",
    latitude: 6.5176,
    longitude: 3.3931,
    category: "faculty",
  },
  {
    id: "b20",
    name: "Faculty of Social Sciences",
    latitude: 6.5158,
    longitude: 3.3917,
    category: "faculty",
  },
  {
    id: "b21",
    name: "Faculty of Dental Sciences",
    latitude: 6.5143,
    longitude: 3.3922,
    category: "faculty",
  },
  {
    id: "b22",
    name: "Faculty of Nursing",
    latitude: 6.5146,
    longitude: 3.3927,
    category: "faculty",
  },
  {
    id: "b23",
    name: "Computer Science Dept.",
    latitude: 6.51515,
    longitude: 3.39999,
    category: "faculty",
  },
  {
    id: "b24",
    name: "Postgraduate School",
    latitude: 6.5164,
    longitude: 3.3908,
    category: "faculty",
  },
  {
    id: "b25",
    name: "Quadrangle",
    latitude: 6.51528,
    longitude: 3.39964,
    category: "faculty",
  },
  {
    id: "b26",
    name: "Senate Building",
    latitude: 6.51722,
    longitude: 3.39028,
    category: "admin",
  },
  {
    id: "b27",
    name: "Registry",
    latitude: 6.5173,
    longitude: 3.3901,
    category: "admin",
  },
  {
    id: "b28",
    name: "Bursary",
    latitude: 6.5171,
    longitude: 3.39,
    category: "admin",
  },
  {
    id: "b29",
    name: "ICT Centre",
    latitude: 6.5166,
    longitude: 3.3928,
    category: "admin",
  },
  {
    id: "b30",
    name: "Student Union Building",
    latitude: 6.517,
    longitude: 3.391,
    category: "admin",
  },
  {
    id: "b31",
    name: "Vice-Chancellor's Office",
    latitude: 6.5174,
    longitude: 3.3904,
    category: "admin",
  },
  {
    id: "b32",
    name: "UNILAG Main Gate",
    latitude: 6.51395,
    longitude: 3.38795,
    category: "admin",
  },
  {
    id: "b33",
    name: "UNILAG Chapel",
    latitude: 6.5175,
    longitude: 3.3905,
    category: "admin",
  },
  {
    id: "b34",
    name: "UNILAG Mosque",
    latitude: 6.5177,
    longitude: 3.3907,
    category: "admin",
  },
  {
    id: "b35",
    name: "UNILAG Bookshop",
    latitude: 6.51695,
    longitude: 3.3911,
    category: "admin",
  },
  {
    id: "b36",
    name: "UNILAG Hotel (Lagoon)",
    latitude: 6.5205,
    longitude: 3.3935,
    category: "admin",
  },
  {
    id: "b37",
    name: "Security Post (Main Gate)",
    latitude: 6.514,
    longitude: 3.388,
    category: "admin",
  },
  {
    id: "b38",
    name: "Security Post (Akoka Gate)",
    latitude: 6.5204,
    longitude: 3.392,
    category: "admin",
  },
  {
    id: "b39",
    name: "Works & Physical Planning",
    latitude: 6.5168,
    longitude: 3.3896,
    category: "admin",
  },
  {
    id: "b40",
    name: "Amala Joint",
    latitude: 6.5169,
    longitude: 3.3908,
    category: "food",
  },
  {
    id: "b41",
    name: "Dangote Cafeteria",
    latitude: 6.5173,
    longitude: 3.392,
    category: "food",
  },
  {
    id: "b42",
    name: "Science Canteen",
    latitude: 6.5177,
    longitude: 3.3935,
    category: "food",
  },
  {
    id: "b43",
    name: "Engineering Canteen",
    latitude: 6.5165,
    longitude: 3.3942,
    category: "food",
  },
  {
    id: "b44",
    name: "Moremi Cafeteria",
    latitude: 6.5183,
    longitude: 3.3896,
    category: "food",
  },
  {
    id: "b45",
    name: "SUB Cafeteria",
    latitude: 6.51695,
    longitude: 3.39095,
    category: "food",
  },
  {
    id: "b46",
    name: "Food Kiosk Area",
    latitude: 6.5165,
    longitude: 3.3913,
    category: "food",
  },
  {
    id: "b47",
    name: "Main Library",
    latitude: 6.5168,
    longitude: 3.3915,
    category: "library",
  },
  {
    id: "b48",
    name: "Faculty of Law Library",
    latitude: 6.51615,
    longitude: 3.3922,
    category: "library",
  },
  {
    id: "b49",
    name: "Science Library",
    latitude: 6.51755,
    longitude: 3.393,
    category: "library",
  },
  {
    id: "b50",
    name: "Education Library",
    latitude: 6.51545,
    longitude: 3.3906,
    category: "library",
  },
  {
    id: "b51",
    name: "E-Library (ICT Centre)",
    latitude: 6.51665,
    longitude: 3.39275,
    category: "library",
  },
  {
    id: "b52",
    name: "University Health Centre",
    latitude: 6.516,
    longitude: 3.3905,
    category: "medical",
  },
  {
    id: "b53",
    name: "LASUTH (Teaching Hospital)",
    latitude: 6.5142,
    longitude: 3.3916,
    category: "medical",
  },
  {
    id: "b54",
    name: "CMS Pharmacy",
    latitude: 6.51475,
    longitude: 3.3929,
    category: "medical",
  },
  {
    id: "b55",
    name: "Dental Clinic",
    latitude: 6.5144,
    longitude: 3.3921,
    category: "medical",
  },
  {
    id: "b56",
    name: "Athletics Track",
    latitude: 6.5188,
    longitude: 3.3925,
    category: "sport",
  },
  {
    id: "b57",
    name: "Sport Centre",
    latitude: 6.5185,
    longitude: 3.392,
    category: "sport",
  },
  {
    id: "b58",
    name: "Swimming Pool",
    latitude: 6.5186,
    longitude: 3.3923,
    category: "sport",
  },
  {
    id: "b59",
    name: "Tennis Court",
    latitude: 6.5187,
    longitude: 3.3918,
    category: "sport",
  },
  {
    id: "b60",
    name: "Basketball Court",
    latitude: 6.5184,
    longitude: 3.3916,
    category: "sport",
  },
  {
    id: "b61",
    name: "Football Field",
    latitude: 6.519,
    longitude: 3.3922,
    category: "sport",
  },
  {
    id: "b62",
    name: "Multipurpose Hall",
    latitude: 6.5182,
    longitude: 3.3919,
    category: "sport",
  },
];

// ─── Robust date parser ───────────────────────────────────────────
function parseDateToTimestamp(dateStr: string): number | null {
  if (!dateStr || !dateStr.trim()) return null;
  const s = dateStr.trim();

  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const ts = Date.UTC(
      parseInt(isoMatch[1]),
      parseInt(isoMatch[2]) - 1,
      parseInt(isoMatch[3]),
      12,
      0,
      0,
    );
    return isNaN(ts) ? null : ts;
  }

  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const a = parseInt(slashMatch[1]);
    const b = parseInt(slashMatch[2]);
    const y = parseInt(slashMatch[3]);
    if (a > 12) {
      const ts = Date.UTC(y, b - 1, a, 12, 0, 0);
      return isNaN(ts) ? null : ts;
    }
    const ts = Date.UTC(y, b - 1, a, 12, 0, 0);
    return isNaN(ts) ? null : ts;
  }

  const dashDMY = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashDMY) {
    const ts = Date.UTC(
      parseInt(dashDMY[3]),
      parseInt(dashDMY[2]) - 1,
      parseInt(dashDMY[1]),
      12,
      0,
      0,
    );
    return isNaN(ts) ? null : ts;
  }

  const MONTHS: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };
  const namedA = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (namedA) {
    const m = MONTHS[namedA[1].toLowerCase()];
    if (m !== undefined) {
      const ts = Date.UTC(
        parseInt(namedA[3]),
        m,
        parseInt(namedA[2]),
        12,
        0,
        0,
      );
      return isNaN(ts) ? null : ts;
    }
  }
  const namedB = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (namedB) {
    const m = MONTHS[namedB[2].toLowerCase()];
    if (m !== undefined) {
      const ts = Date.UTC(
        parseInt(namedB[3]),
        m,
        parseInt(namedB[1]),
        12,
        0,
        0,
      );
      return isNaN(ts) ? null : ts;
    }
  }

  const native = Date.parse(s);
  return isNaN(native) ? null : native;
}

function formatEventDate(dateStr?: string, timestamp?: number | null): string {
  const ts = timestamp ?? (dateStr ? parseDateToTimestamp(dateStr) : null);
  if (!ts) return dateStr || "Date TBD";
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Types ────────────────────────────────────────────────────────
type AdminTab = "locations" | "events" | "users";
type CoordMode = "search" | "gps" | "manual";

interface LocationDoc {
  id: string;
  name: string;
  description?: string;
  category?: string;
  status: "pending" | "approved" | "rejected";
  submittedByEmail?: string;
  submittedBy?: string;
  submitterName?: string;
  latitude?: number;
  longitude?: number;
  submittedAt?: number;
  createdAt?: number;
  _path?: string;
}
interface EventDoc {
  id: string;
  name: string;
  description?: string;
  category?: string;
  date?: string;
  time?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  dateTimestamp?: number | null;
}
interface UserDoc {
  id: string;
  email?: string;
  fullName?: string;
  role?: string;
  faculty?: string;
}

// ─── Inline Error Banner ──────────────────────────────────────────
function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorBannerIcon}>⚠️</Text>
      <Text style={styles.errorBannerText}>{message}</Text>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────
export default function AccountScreen() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    get(ref(database, `users/${user.uid}/role`)).then((snap) => {
      setIsAdmin(snap.exists() && snap.val() === "admin");
    });
  }, []);

  if (isAdmin === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a5c38" />
      </View>
    );
  }

  return isAdmin ? <AdminPanel /> : <UserAccount />;
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN PANEL
// ═══════════════════════════════════════════════════════════════════
function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>("locations");
  const [locations, setLocations] = useState<LocationDoc[]>([]);
  const [pendingLocations, setPendingLocations] = useState<LocationDoc[]>([]);
  const [locFilter, setLocFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("pending");
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [users, setUsers] = useState<UserDoc[]>([]);

  // ── Event modal state ──
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventDoc | null>(null);
  const [eventForm, setEventForm] = useState({
    name: "",
    description: "",
    category: "Academic",
    date: "",
    time: "",
    location: "",
    latitude: "",
    longitude: "",
  });
  const [eventError, setEventError] = useState("");
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventCoordMode, setEventCoordMode] = useState<CoordMode>("search");
  const [locationSearch, setLocationSearch] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [approvedCommunityLocations, setApprovedCommunityLocations] = useState<
    any[]
  >([]);

  // ── Location modal state ──
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationDoc | null>(
    null,
  );
  const [locForm, setLocForm] = useState({
    name: "",
    description: "",
    category: "Academic",
    latitude: "",
    longitude: "",
  });
  const [locError, setLocError] = useState("");
  const [savingLoc, setSavingLoc] = useState(false);
  const [locCoordMode, setLocCoordMode] = useState<CoordMode>("gps");
  const [locGpsLoading, setLocGpsLoading] = useState(false);

  const EVENT_CATEGORIES = [
    "Academic",
    "Social",
    "Sports",
    "Cultural",
    "Career",
    "Health",
    "Other",
  ];
  const LOC_CATEGORIES = [
    "Academic",
    "Administrative",
    "Sports",
    "Food & Drink",
    "Health",
    "Library",
    "Hostel",
    "Other",
  ];

  useEffect(() => {
    const unsubLoc = onValue(ref(database, "locations"), (snap) => {
      const data = snap.val() || {};
      setLocations(
        Object.entries(data)
          .map(([id, v]: any) => ({
            id,
            ...v,
            status: v.status ?? "approved",
            _path: "locations",
          }))
          .reverse(),
      );
    });
    const unsubPending = onValue(ref(database, "pendingLocations"), (snap) => {
      const data = snap.val() || {};
      setPendingLocations(
        Object.entries(data)
          .map(([id, v]: any) => ({
            id,
            ...v,
            status: v.status ?? "pending",
            _path: "pendingLocations",
          }))
          .reverse(),
      );
    });
    const unsubEv = onValue(ref(database, "events"), (snap) => {
      const data = snap.val() || {};
      const now = Date.now();
      setEvents(
        Object.entries(data)
          .map(([id, v]: any) => {
            const stored = v.dateTimestamp;
            const parsed =
              stored && !isNaN(stored) ? stored : parseDateToTimestamp(v.date);
            return { id, ...v, dateTimestamp: parsed };
          })
          .sort((a: any, b: any) => {
            const aTs = a.dateTimestamp;
            const bTs = b.dateTimestamp;
            const aFuture = aTs && aTs >= now;
            const bFuture = bTs && bTs >= now;
            if (aFuture && bFuture) return aTs - bTs;
            if (aFuture) return -1;
            if (bFuture) return 1;
            return (bTs ?? 0) - (aTs ?? 0);
          }),
      );
    });
    const unsubUsers = onValue(ref(database, "users"), (snap) => {
      const data = snap.val() || {};
      setUsers(Object.entries(data).map(([id, v]: any) => ({ id, ...v })));
    });
    const unsubApproved = onValue(
      ref(database, "approvedLocations"),
      (snap) => {
        const data = snap.val() || {};
        setApprovedCommunityLocations(
          Object.entries(data).map(([id, v]: any) => ({
            id: `comm_${id}`,
            name: v.name,
            category: v.category ?? "other",
            latitude: v.latitude,
            longitude: v.longitude,
            source: "community" as const,
          })),
        );
      },
    );
    return () => {
      unsubLoc();
      unsubPending();
      unsubEv();
      unsubUsers();
      unsubApproved();
    };
  }, []);

  // ── Location actions ──
  const approveLocation = async (id: string) => {
    const loc = [...locations, ...pendingLocations].find((l) => l.id === id);
    if (!loc) return;
    const sourcePath = loc._path || "pendingLocations";
    try {
      await update(ref(database, `${sourcePath}/${id}`), {
        status: "approved",
      });
      await set(ref(database, `approvedLocations/${id}`), {
        name: loc.name ?? "",
        description: loc.description ?? "",
        category: loc.category ?? "",
        latitude: loc.latitude ?? null,
        longitude: loc.longitude ?? null,
        submittedBy: loc.submittedBy ?? "",
        submittedByEmail: loc.submittedByEmail ?? "",
        submitterName: (loc as any).submitterName ?? "",
        icon: (loc as any).icon ?? "📍",
        approvedAt: Date.now(),
        status: "approved",
      });
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to approve location.");
    }
  };

  const rejectLocation = async (id: string) => {
    const loc = [...locations, ...pendingLocations].find((l) => l.id === id);
    const sourcePath = loc?._path || "locations";
    await update(ref(database, `${sourcePath}/${id}`), { status: "rejected" });
    await remove(ref(database, `approvedLocations/${id}`));
  };

  const deleteLocation = (id: string) =>
    Alert.alert("Delete", "Delete this location?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const loc = [...locations, ...pendingLocations].find(
            (l) => l.id === id,
          );
          const sourcePath = loc?._path || "locations";
          await remove(ref(database, `${sourcePath}/${id}`));
          await remove(ref(database, `approvedLocations/${id}`));
        },
      },
    ]);

  // ── GPS helpers ──
  async function getGPS(
    setCoords: (lat: string, lng: string) => void,
    setLoading: (v: boolean) => void,
    setError: (v: string) => void,
  ) {
    setLoading(true);
    setError("");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError(
          "Location permission denied. Please allow location access and try again.",
        );
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCoords(
        loc.coords.latitude.toFixed(6),
        loc.coords.longitude.toFixed(6),
      );
    } catch {
      setError("Could not get your location. Make sure GPS is enabled.");
    }
    setLoading(false);
  }

  // ── All searchable locations ──
  const allSearchableLocations = useMemo(() => {
    const fromDB = locations
      .filter((l) => !!l.name)
      .map((l) => ({
        id: l.id,
        name: l.name,
        category: l.category ?? "",
        latitude: l.latitude,
        longitude: l.longitude,
        source: "db" as const,
      }));

    const fromBuildings = BUILDINGS.map((b) => ({
      id: String(b.id),
      name: b.name,
      category: b.category,
      latitude: b.latitude,
      longitude: b.longitude,
      source: "map" as const,
    }));

    const fromCommunity = approvedCommunityLocations.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category ?? "other",
      latitude: c.latitude,
      longitude: c.longitude,
      source: "community" as const,
    }));

    const existingNames = new Set(fromDB.map((l) => l.name.toLowerCase()));
    const uniqueBuildings = fromBuildings.filter(
      (b) => !existingNames.has(b.name.toLowerCase()),
    );

    // Add building names before filtering community
    uniqueBuildings.forEach((b) => existingNames.add(b.name.toLowerCase()));

    const uniqueCommunity = fromCommunity.filter(
      (c) => !existingNames.has(c.name.toLowerCase()),
    );

    const result = [...fromDB, ...uniqueBuildings, ...uniqueCommunity];

    // Debug log
    console.log(
      `allSearchableLocations: DB=${fromDB.length}, Buildings=${uniqueBuildings.length}, Community=${uniqueCommunity.length}, Total=${result.length}`,
    );

    return result;
  }, [locations, approvedCommunityLocations]);

  const searchResults = useMemo(() => {
    const q = locationSearch.trim().toLowerCase();
    if (!q) return allSearchableLocations;
    return allSearchableLocations.filter((l) =>
      l.name.toLowerCase().includes(q),
    );
  }, [locationSearch, allSearchableLocations]);

  // ── Event modal ──
  function openAddEvent() {
    setEditingEvent(null);
    setEventForm({
      name: "",
      description: "",
      category: "Academic",
      date: "",
      time: "",
      location: "",
      latitude: "",
      longitude: "",
    });
    setEventError("");
    setLocationSearch("");
    setEventCoordMode("search");
    setShowEventModal(true);
  }
  function openEditEvent(ev: EventDoc) {
    setEditingEvent(ev);
    setEventForm({
      name: ev.name ?? "",
      description: ev.description ?? "",
      category: ev.category ?? "Academic",
      date: ev.date ?? "",
      time: ev.time ?? "",
      location: ev.location ?? "",
      latitude: ev.latitude?.toString() ?? "",
      longitude: ev.longitude?.toString() ?? "",
    });
    setEventError("");
    setLocationSearch(ev.location ?? "");
    setEventCoordMode(ev.latitude ? "manual" : "search");
    setShowEventModal(true);
  }

  async function saveEvent() {
    setEventError("");
    if (!eventForm.name.trim()) {
      setEventError("Event name is required.");
      return;
    }
    if (!eventForm.date.trim()) {
      setEventError("Please enter a date for the event.");
      return;
    }
    const dateTimestamp = parseDateToTimestamp(eventForm.date.trim());
    if (!dateTimestamp) {
      setEventError(
        `"${eventForm.date}" isn't a recognised date format. Try: 2026-06-15, 15/06/2026, or June 15, 2026`,
      );
      return;
    }
    setSavingEvent(true);
    const payload: any = {
      name: eventForm.name.trim(),
      description: eventForm.description.trim(),
      category: eventForm.category,
      date: eventForm.date.trim(),
      time: eventForm.time.trim(),
      location: eventForm.location.trim(),
      latitude: eventForm.latitude ? parseFloat(eventForm.latitude) : null,
      longitude: eventForm.longitude ? parseFloat(eventForm.longitude) : null,
      dateTimestamp,
      updatedAt: Date.now(),
    };
    try {
      if (editingEvent) {
        await update(ref(database, `events/${editingEvent.id}`), payload);
      } else {
        payload.createdAt = Date.now();
        await set(push(ref(database, "events")), payload);
      }
      setShowEventModal(false);
    } catch (e: any) {
      setEventError(e.message || "Failed to save event. Please try again.");
    }
    setSavingEvent(false);
  }

  const deleteEvent = (id: string) =>
    Alert.alert("Delete", "Delete this event?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => remove(ref(database, `events/${id}`)),
      },
    ]);

  // ── Location modal ──
  function openAddLocation() {
    setEditingLocation(null);
    setLocForm({
      name: "",
      description: "",
      category: "Academic",
      latitude: "",
      longitude: "",
    });
    setLocError("");
    setLocCoordMode("gps");
    setShowLocationModal(true);
  }
  function openEditLocation(loc: LocationDoc) {
    setEditingLocation(loc);
    setLocForm({
      name: loc.name ?? "",
      description: loc.description ?? "",
      category: loc.category ?? "Academic",
      latitude: loc.latitude?.toString() ?? "",
      longitude: loc.longitude?.toString() ?? "",
    });
    setLocError("");
    setLocCoordMode(loc.latitude ? "manual" : "gps");
    setShowLocationModal(true);
  }
  async function saveLocation() {
    setLocError("");
    if (!locForm.name.trim()) {
      setLocError("Location name is required.");
      return;
    }
    if (!locForm.latitude || !locForm.longitude) {
      setLocError("Coordinates are required. Use GPS or enter them manually.");
      return;
    }
    const lat = parseFloat(locForm.latitude);
    const lng = parseFloat(locForm.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      setLocError("Invalid coordinates. Please check the values entered.");
      return;
    }
    setSavingLoc(true);
    const user = auth.currentUser;
    const payload: any = {
      name: locForm.name.trim(),
      description: locForm.description.trim(),
      category: locForm.category,
      latitude: lat,
      longitude: lng,
      status: "approved",
      submittedByEmail: user?.email ?? "admin",
      updatedAt: Date.now(),
    };
    try {
      if (editingLocation) {
        await update(ref(database, `locations/${editingLocation.id}`), payload);
        await update(
          ref(database, `approvedLocations/${editingLocation.id}`),
          payload,
        );
      } else {
        payload.createdAt = Date.now();
        const newRef = push(ref(database, "locations"));
        await set(newRef, payload);
        await set(ref(database, `approvedLocations/${newRef.key}`), {
          ...payload,
          approvedAt: Date.now(),
        });
      }
      setShowLocationModal(false);
    } catch (e: any) {
      setLocError(e.message || "Failed to save location. Please try again.");
    }
    setSavingLoc(false);
  }

  function handleSignOut() {
    Alert.alert("Sign Out", "Sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut(auth);
          router.replace("/login");
        },
      },
    ]);
  }

  const allAdminLocations = useMemo(() => {
    const locMap = new Map<string, LocationDoc>();
    locations.filter((l) => !!l.name).forEach((l) => locMap.set(l.id, l));
    pendingLocations
      .filter((p) => !!p.name)
      .forEach((p) => {
        if (!locMap.has(p.id)) locMap.set(p.id, p);
      });
    return Array.from(locMap.values()).sort(
      (a, b) =>
        (b.submittedAt || b.createdAt || 0) -
        (a.submittedAt || a.createdAt || 0),
    );
  }, [locations, pendingLocations]);

  const filteredLocations =
    locFilter === "all"
      ? allAdminLocations
      : allAdminLocations.filter((l) => l.status === locFilter);
  const pendingCount = pendingLocations.filter(
    (l) => l.status === "pending",
  ).length;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.adminHeader}>
        <View>
          <Text style={styles.adminHeaderTitle}>Admin Panel</Text>
          <Text style={styles.adminHeaderSub}>UniLag Navigator</Text>
        </View>
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(["locations", "events", "users"] as AdminTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab === "locations"
                ? `📍 Locations${pendingCount > 0 ? ` (${pendingCount})` : ""}`
                : tab === "events"
                  ? "🗓️ Events"
                  : "👥 Users"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── LOCATIONS TAB ── */}
      {activeTab === "locations" && (
        <View style={{ flex: 1 }}>
          <View style={styles.tabToolbar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRowContent}
            >
              {(["pending", "approved", "rejected", "all"] as const).map(
                (f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.chip, locFilter === f && styles.chipActive]}
                    onPress={() => setLocFilter(f)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        locFilter === f && styles.chipTextActive,
                      ]}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                      {f === "pending" && pendingCount > 0
                        ? ` • ${pendingCount}`
                        : ""}
                    </Text>
                  </TouchableOpacity>
                ),
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.toolbarAddBtn}
              onPress={openAddLocation}
            >
              <Text style={styles.toolbarAddText}>＋ Add</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.listContent}>
            {filteredLocations.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📍</Text>
                <Text style={styles.emptyText}>
                  No {locFilter === "all" ? "" : locFilter} locations
                </Text>
              </View>
            ) : (
              filteredLocations.map((loc) => (
                <View key={loc.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{loc.name}</Text>
                    <View
                      style={[
                        styles.badge,
                        loc.status === "approved"
                          ? styles.badgeGreen
                          : loc.status === "rejected"
                            ? styles.badgeRed
                            : styles.badgeOrange,
                      ]}
                    >
                      <Text style={styles.badgeText}>{loc.status}</Text>
                    </View>
                  </View>
                  {loc.description ? (
                    <Text style={styles.cardDesc}>{loc.description}</Text>
                  ) : null}
                  {loc.category ? (
                    <Text style={styles.cardMeta}>
                      Category: {loc.category}
                    </Text>
                  ) : null}
                  {loc.submittedByEmail ? (
                    <Text style={styles.cardMeta}>
                      By: {loc.submittedByEmail}
                    </Text>
                  ) : null}
                  {(loc as any).submitterName ? (
                    <Text style={styles.cardMeta}>
                      👤 {(loc as any).submitterName}
                    </Text>
                  ) : null}
                  {loc.latitude ? (
                    <Text style={styles.cardMeta}>
                      📌 {loc.latitude?.toFixed(5)}, {loc.longitude?.toFixed(5)}
                    </Text>
                  ) : null}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.editBtn]}
                      onPress={() => openEditLocation(loc)}
                    >
                      <Text style={styles.actionBtnText}>✏️ Edit</Text>
                    </TouchableOpacity>
                    {loc.status !== "approved" && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.approveBtn]}
                        onPress={() => approveLocation(loc.id)}
                      >
                        <Text style={styles.actionBtnText}>✅ Approve</Text>
                      </TouchableOpacity>
                    )}
                    {loc.status !== "rejected" && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.rejectBtn]}
                        onPress={() => rejectLocation(loc.id)}
                      >
                        <Text style={styles.actionBtnText}>❌ Reject</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.deleteBtn]}
                      onPress={() => deleteLocation(loc.id)}
                    >
                      <Text style={styles.actionBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      )}

      {/* ── EVENTS TAB ── */}
      {activeTab === "events" && (
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={styles.addBtn} onPress={openAddEvent}>
            <Text style={styles.addBtnText}>＋ Add New Event</Text>
          </TouchableOpacity>
          <ScrollView contentContainerStyle={styles.listContent}>
            {events.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🗓️</Text>
                <Text style={styles.emptyText}>No events yet</Text>
              </View>
            ) : (
              events.map((ev) => {
                const ts = ev.dateTimestamp;
                const isUpcoming = ts ? ts >= Date.now() : false;
                return (
                  <View key={ev.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>{ev.name}</Text>
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 6,
                          alignItems: "center",
                        }}
                      >
                        {ev.category ? (
                          <View style={styles.badgeBlue}>
                            <Text style={styles.badgeText}>{ev.category}</Text>
                          </View>
                        ) : null}
                        {ts ? (
                          isUpcoming ? (
                            <View style={styles.badgeGreen}>
                              <Text style={styles.badgeText}>upcoming</Text>
                            </View>
                          ) : (
                            <View style={styles.badgeGrey}>
                              <Text style={styles.badgeText}>past</Text>
                            </View>
                          )
                        ) : null}
                      </View>
                    </View>
                    {ev.description ? (
                      <Text style={styles.cardDesc}>{ev.description}</Text>
                    ) : null}
                    <Text style={styles.cardMeta}>
                      📅 {formatEventDate(ev.date, ts)}
                      {ev.time ? ` at ${ev.time}` : ""}
                    </Text>
                    {ev.location ? (
                      <Text style={styles.cardMeta}>📍 {ev.location}</Text>
                    ) : null}
                    {ev.latitude ? (
                      <Text style={styles.cardMeta}>
                        📌 {ev.latitude?.toFixed(5)}, {ev.longitude?.toFixed(5)}
                      </Text>
                    ) : null}
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.editBtn]}
                        onPress={() => openEditEvent(ev)}
                      >
                        <Text style={styles.actionBtnText}>✏️ Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.deleteBtn]}
                        onPress={() => deleteEvent(ev.id)}
                      >
                        <Text style={styles.actionBtnText}>🗑️ Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {/* ── USERS TAB ── */}
      {activeTab === "users" && (
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionCount}>
            {users.length} registered user{users.length !== 1 ? "s" : ""}
          </Text>
          <ScrollView contentContainerStyle={styles.listContent}>
            {users.map((u) => (
              <View key={u.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>
                    {u.fullName || u.email || "Unknown"}
                  </Text>
                  <View
                    style={[
                      styles.badge,
                      u.role === "admin" ? styles.badgeGreen : styles.badgeGrey,
                    ]}
                  >
                    <Text style={styles.badgeText}>{u.role || "user"}</Text>
                  </View>
                </View>
                {u.email ? (
                  <Text style={styles.cardMeta}>✉️ {u.email}</Text>
                ) : null}
                {u.faculty ? (
                  <Text style={styles.cardMeta}>🎓 {u.faculty}</Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ════════════════════════════════════════════
          EVENT MODAL
      ════════════════════════════════════════════ */}
      <Modal
        visible={showEventModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEventModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEventModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingEvent ? "Edit Event" : "New Event"}
            </Text>
            <TouchableOpacity onPress={saveEvent} disabled={savingEvent}>
              {savingEvent ? (
                <ActivityIndicator color="#1a5c38" />
              ) : (
                <Text style={styles.modalSave}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <ErrorBanner message={eventError} />

            <Text style={styles.fieldLabel}>Event Name *</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. Faculty Orientation"
              value={eventForm.name}
              onChangeText={(t) => {
                setEventError("");
                setEventForm((p) => ({ ...p, name: t }));
              }}
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldTextarea]}
              placeholder="What is this event about?"
              value={eventForm.description}
              onChangeText={(t) =>
                setEventForm((p) => ({ ...p, description: t }))
              }
              multiline
              numberOfLines={3}
            />

            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
            >
              {EVENT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.chip,
                    eventForm.category === cat && styles.chipActive,
                    { marginRight: 8 },
                  ]}
                  onPress={() => setEventForm((p) => ({ ...p, category: cat }))}
                >
                  <Text
                    style={[
                      styles.chipText,
                      eventForm.category === cat && styles.chipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.fieldLabel}>Date *</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. 2026-06-15"
                  value={eventForm.date}
                  onChangeText={(t) => {
                    setEventError("");
                    setEventForm((p) => ({ ...p, date: t }));
                  }}
                />
                <Text style={styles.fieldHint}>
                  YYYY-MM-DD, DD/MM/YYYY, or "June 15, 2026"
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Time</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. 10:00 AM"
                  value={eventForm.time}
                  onChangeText={(t) => setEventForm((p) => ({ ...p, time: t }))}
                />
              </View>
            </View>

            {eventForm.date.trim()
              ? (() => {
                  const ts = parseDateToTimestamp(eventForm.date.trim());
                  return ts ? (
                    <View style={styles.dateParsedBox}>
                      <Text style={styles.dateParsedText}>
                        📅 Parsed as:{" "}
                        {new Date(ts).toLocaleDateString("en-GB", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                        {ts >= Date.now()
                          ? "  ✅ upcoming"
                          : "  ⚠️ this date is in the past"}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.dateUnparsedBox}>
                      <Text style={styles.dateUnparsedText}>
                        ⚠️ Date not recognised — try: 2026-06-15
                      </Text>
                    </View>
                  );
                })()
              : null}

            <View style={styles.coordSectionBox}>
              <Text style={styles.coordSectionTitle}>
                📍 Event Location & Coordinates
              </Text>
              <Text style={styles.coordSectionSub}>
                Choose how to set the event location
              </Text>

              <View style={styles.coordModeRow}>
                {(
                  [
                    { key: "search", label: "🔍 Search Map" },
                    { key: "gps", label: "📡 GPS" },
                    { key: "manual", label: "✍️ Manual" },
                  ] as { key: CoordMode; label: string }[]
                ).map((m) => (
                  <TouchableOpacity
                    key={m.key}
                    style={[
                      styles.coordModeBtn,
                      eventCoordMode === m.key && styles.coordModeBtnActive,
                    ]}
                    onPress={() => {
                      setEventCoordMode(m.key);
                      setEventError("");
                    }}
                  >
                    <Text
                      style={[
                        styles.coordModeBtnText,
                        eventCoordMode === m.key &&
                          styles.coordModeBtnTextActive,
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {eventCoordMode === "search" && (
                <View>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Type to search campus locations…"
                    value={locationSearch}
                    onChangeText={(t) => {
                      setLocationSearch(t);
                      if (eventForm.location && t !== eventForm.location) {
                        setEventForm((p) => ({
                          ...p,
                          location: "",
                          latitude: "",
                          longitude: "",
                        }));
                      }
                    }}
                  />
                  {allSearchableLocations.length === 0 ? (
                    <View style={styles.noResultsBox}>
                      <Text style={styles.noResultsText}>
                        No campus locations found.
                      </Text>
                    </View>
                  ) : searchResults.length === 0 &&
                    locationSearch.trim() !== "" ? (
                    <View style={styles.noResultsBox}>
                      <Text style={styles.noResultsText}>
                        No locations match "{locationSearch}"
                      </Text>
                    </View>
                  ) : (
                    <View>
                      {searchResults.map((loc) => (
                        <TouchableOpacity
                          key={loc.id}
                          style={[
                            styles.searchResult,
                            eventForm.location === loc.name &&
                              styles.searchResultSelected,
                          ]}
                          onPress={() => {
                            setEventForm((p) => ({
                              ...p,
                              location: loc.name,
                              latitude: loc.latitude?.toString() ?? "",
                              longitude: loc.longitude?.toString() ?? "",
                            }));
                            setLocationSearch(loc.name);
                          }}
                        >
                          <View style={styles.searchResultInner}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                                marginBottom: 2,
                              }}
                            >
                              <Text style={styles.searchResultName}>
                                {loc.name}
                              </Text>
                              <View
                                style={[
                                  styles.sourceTag,
                                  loc.source === "map"
                                    ? styles.sourceTagMap
                                    : loc.source === "community"
                                      ? { backgroundColor: "#ede9fe" }
                                      : styles.sourceTagDB,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.sourceTagText,
                                    loc.source === "community"
                                      ? { color: "#7c3aed" }
                                      : {},
                                  ]}
                                >
                                  {loc.source === "map"
                                    ? "map"
                                    : loc.source === "community"
                                      ? "community"
                                      : "added"}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.searchResultMeta}>
                              {loc.category ?? ""}
                              {loc.latitude
                                ? `  ·  ${loc.latitude.toFixed(4)}, ${loc.longitude?.toFixed(4)}`
                                : "  ·  no coords"}
                            </Text>
                          </View>
                          {eventForm.location === loc.name && (
                            <Text style={styles.searchResultCheck}>✓</Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {eventForm.latitude && eventForm.longitude ? (
                    <View style={styles.coordConfirmed}>
                      <Text style={styles.coordConfirmedText}>
                        ✅ {eventForm.location} —{" "}
                        {parseFloat(eventForm.latitude).toFixed(5)},{" "}
                        {parseFloat(eventForm.longitude).toFixed(5)}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.coordHint}>
                      Tap a location to auto-fill its coordinates
                    </Text>
                  )}
                </View>
              )}

              {eventCoordMode === "gps" && (
                <View>
                  <Text style={styles.fieldLabel}>Location Name</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. Main Auditorium"
                    value={eventForm.location}
                    onChangeText={(t) =>
                      setEventForm((p) => ({ ...p, location: t }))
                    }
                  />
                  <TouchableOpacity
                    style={[styles.gpsBtn, gpsLoading && styles.gpsBtnDisabled]}
                    disabled={gpsLoading}
                    onPress={() =>
                      getGPS(
                        (lat, lng) =>
                          setEventForm((p) => ({
                            ...p,
                            latitude: lat,
                            longitude: lng,
                          })),
                        setGpsLoading,
                        setEventError,
                      )
                    }
                  >
                    {gpsLoading ? (
                      <>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={styles.gpsBtnText}>
                          {" "}
                          Getting location…
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.gpsBtnText}>
                        📡 Generate Coordinates from GPS
                      </Text>
                    )}
                  </TouchableOpacity>
                  {eventForm.latitude && eventForm.longitude ? (
                    <View style={styles.coordConfirmed}>
                      <Text style={styles.coordConfirmedText}>
                        ✅ Captured: {parseFloat(eventForm.latitude).toFixed(6)}
                        , {parseFloat(eventForm.longitude).toFixed(6)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}

              {eventCoordMode === "manual" && (
                <View>
                  <Text style={styles.fieldLabel}>Location Name</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. Main Auditorium"
                    value={eventForm.location}
                    onChangeText={(t) =>
                      setEventForm((p) => ({ ...p, location: t }))
                    }
                  />
                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.fieldLabel}>Latitude</Text>
                      <TextInput
                        style={styles.fieldInput}
                        placeholder="e.g. 6.5158"
                        value={eventForm.latitude}
                        onChangeText={(t) =>
                          setEventForm((p) => ({ ...p, latitude: t }))
                        }
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Longitude</Text>
                      <TextInput
                        style={styles.fieldInput}
                        placeholder="e.g. 3.3864"
                        value={eventForm.longitude}
                        onChangeText={(t) =>
                          setEventForm((p) => ({ ...p, longitude: t }))
                        }
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ════════════════════════════════════════════
          LOCATION MODAL
      ════════════════════════════════════════════ */}
      <Modal
        visible={showLocationModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLocationModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowLocationModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingLocation ? "Edit Location" : "Add Location"}
            </Text>
            <TouchableOpacity onPress={saveLocation} disabled={savingLoc}>
              {savingLoc ? (
                <ActivityIndicator color="#1a5c38" />
              ) : (
                <Text style={styles.modalSave}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <ErrorBanner message={locError} />

            <Text style={styles.fieldLabel}>Location Name *</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. Faculty of Science Building"
              value={locForm.name}
              onChangeText={(t) => {
                setLocError("");
                setLocForm((p) => ({ ...p, name: t }));
              }}
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldTextarea]}
              placeholder="What is at this location?"
              value={locForm.description}
              onChangeText={(t) =>
                setLocForm((p) => ({ ...p, description: t }))
              }
              multiline
              numberOfLines={3}
            />

            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
            >
              {LOC_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.chip,
                    locForm.category === cat && styles.chipActive,
                    { marginRight: 8 },
                  ]}
                  onPress={() => setLocForm((p) => ({ ...p, category: cat }))}
                >
                  <Text
                    style={[
                      styles.chipText,
                      locForm.category === cat && styles.chipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.coordSectionBox}>
              <Text style={styles.coordSectionTitle}>📌 Coordinates *</Text>
              <Text style={styles.coordSectionSub}>
                Required for map directions
              </Text>

              <View style={styles.coordModeRow}>
                {(
                  [
                    { key: "gps", label: "📡 GPS" },
                    { key: "manual", label: "✍️ Manual" },
                  ] as { key: CoordMode; label: string }[]
                ).map((m) => (
                  <TouchableOpacity
                    key={m.key}
                    style={[
                      styles.coordModeBtn,
                      locCoordMode === m.key && styles.coordModeBtnActive,
                    ]}
                    onPress={() => {
                      setLocCoordMode(m.key);
                      setLocError("");
                    }}
                  >
                    <Text
                      style={[
                        styles.coordModeBtnText,
                        locCoordMode === m.key && styles.coordModeBtnTextActive,
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {locCoordMode === "gps" && (
                <View>
                  <TouchableOpacity
                    style={[
                      styles.gpsBtn,
                      locGpsLoading && styles.gpsBtnDisabled,
                    ]}
                    disabled={locGpsLoading}
                    onPress={() =>
                      getGPS(
                        (lat, lng) =>
                          setLocForm((p) => ({
                            ...p,
                            latitude: lat,
                            longitude: lng,
                          })),
                        setLocGpsLoading,
                        setLocError,
                      )
                    }
                  >
                    {locGpsLoading ? (
                      <>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={styles.gpsBtnText}>
                          {" "}
                          Getting location…
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.gpsBtnText}>
                        📡 Generate Coordinates from GPS
                      </Text>
                    )}
                  </TouchableOpacity>
                  {locForm.latitude && locForm.longitude ? (
                    <View style={styles.coordConfirmed}>
                      <Text style={styles.coordConfirmedText}>
                        ✅ Captured: {parseFloat(locForm.latitude).toFixed(6)},{" "}
                        {parseFloat(locForm.longitude).toFixed(6)}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.coordHint}>
                      Stand at the location and tap the button to capture exact
                      coordinates
                    </Text>
                  )}
                </View>
              )}

              {locCoordMode === "manual" && (
                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.fieldLabel}>Latitude</Text>
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="e.g. 6.5158"
                      value={locForm.latitude}
                      onChangeText={(t) => {
                        setLocError("");
                        setLocForm((p) => ({ ...p, latitude: t }));
                      }}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Longitude</Text>
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="e.g. 3.3864"
                      value={locForm.longitude}
                      onChangeText={(t) => {
                        setLocError("");
                        setLocForm((p) => ({ ...p, longitude: t }));
                      }}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// REGULAR USER ACCOUNT
// ═══════════════════════════════════════════════════════════════════
function UserAccount() {
  const user = auth.currentUser;
  const [userData, setUserData] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [form, setForm] = useState({
    fullName: "", faculty: "", matricNo: "", phone: "",
  });
  const [showServices, setShowServices] = useState(false);
  const [infoPanel, setInfoPanel] = useState<{ title: string; icon: string; body: string } | null>(null);

  const FACULTIES = [
    "Engineering", "Science", "Arts", "Law", "Education",
    "Business Admin.", "Social Sciences", "Medicine (CMS)",
    "Pharmacy", "Environmental", "Dental Sciences", "Nursing",
  ];

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onValue(ref(database, `users/${user.uid}`), snap => {
      if (snap.exists()) {
        const d = snap.val();
        setUserData(d);
        setForm({
          fullName: d.fullName ?? "",
          faculty:  d.faculty  ?? "",
          matricNo: d.matricNo ?? "",
          phone:    d.phone    ?? "",
        });
      }
    });
    return () => unsubscribe();
  }, []);

  async function handleSave() {
    if (!form.fullName.trim()) {
      Alert.alert("Required", "Please enter your full name.");
      return;
    }
    setSaving(true);
    try {
      await update(ref(database, `users/${user!.uid}`), {
        fullName: form.fullName.trim(),
        faculty:  form.faculty.trim(),
        matricNo: form.matricNo.trim(),
        phone:    form.phone.trim(),
        updatedAt: Date.now(),
      });
      setSaveSuccess(true);
      setEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save. Try again.");
    }
    setSaving(false);
  }

  function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => { await signOut(auth); router.replace("/login"); } },
    ]);
  }

  const initials = userData?.fullName
    ? userData.fullName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  const CAMPUS_TOOLS: {
    icon: string; label: string; sub: string;
    route?: string; action?: () => void;
    info?: { title: string; icon: string; body: string };
  }[] = [
    { icon: "📍", label: "Submit a Location", sub: "Add a new campus spot to the map", route: "/submit-location" },
    { icon: "🗓️", label: "Events",            sub: "Browse upcoming campus events",    route: "/events" },
    { icon: "🍽️", label: "Find a Cafeteria",  sub: "Locate food spots near you",       route: "/cafeteria" },
    { icon: "🚌", label: "Shuttle Routes",    sub: "Schedules, stops & directions",    route: "/shuttle" },
  ];

  // Moved here from the Home screen's old "Services" tab, plus the
  // additional account-level items requested for this section. Items
  // with a `route` navigate to an existing screen; items with `info`
  // open a lightweight in-app panel (there's no dedicated screen/data
  // source for these yet — see the handover notes).
  const FEATURES: {
    icon: string; label: string; sub: string;
    route?: string; action?: () => void;
    info?: { title: string; icon: string; body: string };
  }[] = [
    {
      icon: "🛍️", label: "Campus Services", sub: "Directory of services around campus",
      action: () => setShowServices(true),
    },
    {
      icon: "🚨", label: "Emergency Contacts", sub: "Security, health centre & wardens",
      route: "/emergency",
    },
    {
      icon: "🔎", label: "Lost & Found", sub: "Report or search for lost items",
      route: "/lostfound",
    },
    {
      icon: "📖", label: "Campus Directory", sub: "Departments, offices & contacts",
      route: "/campus-directory",
    },
    {
      icon: "💬", label: "Help & Support", sub: "Get help using Compass",
      route: "/help-support",
    },
    {
      icon: "ℹ️", label: "About Compass", sub: "App info & version",
      route: "/about",
    },
    {
      icon: "⚙️", label: "Settings", sub: "Notifications & privacy",
      route: "/settings",
    },
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.userContent}>

      {/* ── HERO TOP ── */}
      <View style={styles.profileHeader}>
        {/* decorative circles */}
        <View style={styles.heroBubble1} />
        <View style={styles.heroBubble2} />

        {/* Edit / Save button */}
        <TouchableOpacity
          style={styles.heroEditBtn}
          onPress={() => editing ? handleSave() : setEditing(true)}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.heroEditBtnText}>{editing ? "💾 Save" : "✏️ Edit"}</Text>
          }
        </TouchableOpacity>

        {/* Avatar */}
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>

        {/* Name — editable inline */}
        {editing ? (
          <TextInput
            style={styles.nameEditInput}
            value={form.fullName}
            onChangeText={t => setForm(p => ({ ...p, fullName: t }))}
            placeholder="Full Name"
            placeholderTextColor="rgba(255,255,255,0.5)"
            autoFocus
          />
        ) : (
          <Text style={styles.profileName}>{userData?.fullName ?? "—"}</Text>
        )}

        <Text style={styles.profileEmail}>{user?.email}</Text>

        {/* Faculty + Matric badges */}
        <View style={styles.heroBadgeRow}>
          {userData?.faculty  ? <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>🎓 {userData.faculty}</Text></View>  : null}
          {userData?.matricNo ? <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>🪪 {userData.matricNo}</Text></View> : null}
          {userData?.phone    ? <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>📱 {userData.phone}</Text></View>    : null}
        </View>

        {saveSuccess && (
          <View style={styles.heroSuccessToast}>
            <Text style={styles.heroSuccessText}>✅ Profile updated!</Text>
          </View>
        )}
      </View>

      {/* ── EDIT FORM (appears below hero when editing) ── */}
      {editing && (
        <View style={styles.editCard}>
          <Text style={styles.editCardTitle}>Edit Your Details</Text>

          <Text style={styles.fieldLabel}>Faculty</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {FACULTIES.map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.chip, form.faculty === f && styles.chipActive, { marginRight: 8 }]}
                onPress={() => setForm(p => ({ ...p, faculty: f }))}
              >
                <Text style={[styles.chipText, form.faculty === f && styles.chipTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Matric Number</Text>
          <TextInput
            style={styles.fieldInput}
            value={form.matricNo}
            onChangeText={t => setForm(p => ({ ...p, matricNo: t }))}
            placeholder="e.g. 190404001"
            placeholderTextColor="#bbb"
          />

          <Text style={styles.fieldLabel}>Phone Number</Text>
          <TextInput
            style={styles.fieldInput}
            value={form.phone}
            onChangeText={t => setForm(p => ({ ...p, phone: t }))}
            placeholder="e.g. 08012345678"
            placeholderTextColor="#bbb"
            keyboardType="phone-pad"
          />

          <TouchableOpacity
            style={styles.cancelEditBtn}
            onPress={() => setEditing(false)}
          >
            <Text style={styles.cancelEditBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── CAMPUS TOOLS (merged with the old Features section below — ── */}
      {/* one header, one continuous list). CAMPUS_TOOLS items only ever */}
      {/* carry a `route`, so the shared onPress logic below still works. */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CAMPUS TOOLS</Text>
        {[...CAMPUS_TOOLS, ...FEATURES].map(item => (
          <TouchableOpacity
            key={item.label}
            style={styles.featureRow}
            activeOpacity={0.7}
            onPress={() => {
              if (item.route) router.push(item.route as any);
              else if (item.action) item.action();
              else if (item.info) setInfoPanel(item.info);
            }}
          >
            <View style={styles.featureIconWrap}>
              <Text style={styles.featureIcon}>{item.icon}</Text>
            </View>
            <View style={styles.featureLabelWrap}>
              <Text style={styles.featureLabel}>{item.label}</Text>
              <Text style={styles.featureSub}>{item.sub}</Text>
            </View>
            <Text style={styles.featureArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── SIGN OUT (unchanged) ── */}
      <TouchableOpacity style={styles.signOutFullBtn} onPress={handleSignOut}>
        <Text style={styles.signOutFullText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Campus Services — full component, moved here from Home */}
      <Modal visible={showServices} animationType="slide" onRequestClose={() => setShowServices(false)}>
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={styles.servicesModalHeader}>
            <Text style={styles.servicesModalHeaderTitle}>Campus Services</Text>
            <TouchableOpacity onPress={() => setShowServices(false)} style={styles.servicesModalCloseBtn}>
              <Text style={styles.servicesModalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ServicesTab userId={user?.uid ?? ""} userName={userData?.fullName ?? ""} />
        </View>
      </Modal>

      {/* Simple info panel for the placeholder Features items */}
      <Modal visible={!!infoPanel} transparent animationType="fade" onRequestClose={() => setInfoPanel(null)}>
        <View style={styles.infoOverlay}>
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>{infoPanel?.icon}</Text>
            <Text style={styles.infoTitle}>{infoPanel?.title}</Text>
            <Text style={styles.infoBody}>{infoPanel?.body}</Text>
            <TouchableOpacity style={styles.infoCloseBtn} onPress={() => setInfoPanel(null)}>
              <Text style={styles.infoCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f5f5f5" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  row: { flexDirection: "row" },

  errorBanner: {
    backgroundColor: "#fff1f1",
    borderWidth: 1.5,
    borderColor: "#f5c2c2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  errorBannerIcon: { fontSize: 16, marginRight: 8, marginTop: 1 },
  errorBannerText: {
    color: "#c0392b",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    lineHeight: 20,
  },

  adminHeader: {
    backgroundColor: "#1a5c38",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  adminHeaderTitle: { color: "#fff", fontSize: 22, fontWeight: "bold" },
  adminHeaderSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginTop: 2,
  },
  signOutBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  signOutText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e8e8e8",
  },
  tab: { flex: 1, paddingVertical: 13, alignItems: "center" },
  tabActive: { borderBottomWidth: 2.5, borderBottomColor: "#1a5c38" },
  tabText: { fontSize: 11, color: "#999", fontWeight: "600" },
  tabTextActive: { color: "#1a5c38" },
  // ── Improved profile hero ──────────────────────────────────────
  heroBubble1: {
    position: "absolute", width: 200, height: 200, borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.06)", top: -60, left: -60,
  },
  heroBubble2: {
    position: "absolute", width: 150, height: 150, borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.06)", bottom: -40, right: -30,
  },
  heroEditBtn: {
    position: "absolute", top: 56, right: 20,
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
  },
  heroEditBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  avatarRing: {
  width: 88,
  height: 88,
  borderRadius: 44,        // exactly half of 88 ✓
  borderWidth: 3,
  borderColor: "rgba(255,255,255,0.4)",
  justifyContent: "center",
  alignItems: "center",
  marginBottom: 12,        // margin goes on the RING, not the inner avatar
},
  nameEditInput: {
    color: "#fff", fontSize: 20, fontWeight: "bold",
    borderBottomWidth: 1.5, borderBottomColor: "rgba(255,255,255,0.5)",
    paddingBottom: 4, marginBottom: 6, minWidth: 180, textAlign: "center",
  },
  heroBadgeRow: {
    flexDirection: "row", flexWrap: "wrap",
    justifyContent: "center", gap: 8, marginTop: 10, paddingHorizontal: 20,
  },
  heroBadge: {
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
  heroBadgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  heroSuccessToast: {
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 7, marginTop: 12,
  },
  heroSuccessText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  // ── Edit form card ──────────────────────────────────────────
  editCard: {
    margin: 16, backgroundColor: "#fff", borderRadius: 16, padding: 18,
    shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  editCardTitle: { fontSize: 15, fontWeight: "700", color: "#1a5c38", marginBottom: 16 },
  cancelEditBtn: {
    marginTop: 4, padding: 13, borderRadius: 10,
    borderWidth: 1.5, borderColor: "#eee", alignItems: "center",
  },
  cancelEditBtnText: { color: "#888", fontSize: 14, fontWeight: "600" },

  tabToolbar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  filterRowContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  toolbarAddBtn: {
    backgroundColor: "#1a5c38",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 12,
    marginVertical: 8,
  },
  toolbarAddText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#1a5c38", borderColor: "#1a5c38" },
  chipText: { fontSize: 13, color: "#555", fontWeight: "600" },
  chipTextActive: { color: "#fff" },

  listContent: { padding: 16, gap: 12 },
  emptyState: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: "#999", fontSize: 15 },
  sectionCount: { padding: 14, color: "#666", fontSize: 13 },
  addBtn: {
    margin: 16,
    backgroundColor: "#1a5c38",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "bold" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#222",
    flex: 1,
    marginRight: 8,
  },
  cardDesc: { fontSize: 13, color: "#555", marginBottom: 6 },
  cardMeta: { fontSize: 12, color: "#888", marginBottom: 3 },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  },
  actionBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  actionBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },
  approveBtn: { backgroundColor: "#1a5c38" },
  rejectBtn: { backgroundColor: "#d97706" },
  deleteBtn: { backgroundColor: "#cc2222" },
  editBtn: { backgroundColor: "#1e6fad" },

  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
    textTransform: "uppercase",
  },
  badgeGreen: {
    backgroundColor: "#1a5c38",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeRed: {
    backgroundColor: "#cc2222",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeOrange: {
    backgroundColor: "#d97706",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeBlue: {
    backgroundColor: "#1e6fad",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeGrey: {
    backgroundColor: "#888",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#222" },
  modalCancel: { color: "#888", fontSize: 15 },
  modalSave: { color: "#1a5c38", fontSize: 15, fontWeight: "700" },
  modalBody: { flex: 1, backgroundColor: "#f5f5f5", padding: 16 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 6,
    marginTop: 4,
  },
  fieldInput: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    padding: 13,
    fontSize: 14,
    color: "#333",
    marginBottom: 12,
  },
  fieldTextarea: { minHeight: 80, textAlignVertical: "top" },
  fieldHint: {
    fontSize: 11,
    color: "#aaa",
    marginTop: -8,
    marginBottom: 10,
    fontStyle: "italic",
  },

  dateParsedBox: {
    backgroundColor: "#f0faf4",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#b7e4c7",
    padding: 10,
    marginBottom: 12,
  },
  dateParsedText: { color: "#1a5c38", fontSize: 12, fontWeight: "600" },
  dateUnparsedBox: {
    backgroundColor: "#fffbec",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f0d070",
    padding: 10,
    marginBottom: 12,
  },
  dateUnparsedText: { color: "#b07d00", fontSize: 12, fontWeight: "600" },

  coordSectionBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e8e8e8",
    padding: 14,
    marginBottom: 12,
  },
  coordSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#222",
    marginBottom: 2,
  },
  coordSectionSub: { fontSize: 12, color: "#888", marginBottom: 14 },
  coordModeRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  coordModeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#ddd",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
  },
  coordModeBtnActive: { backgroundColor: "#1a5c38", borderColor: "#1a5c38" },
  coordModeBtnText: { fontSize: 12, fontWeight: "700", color: "#555" },
  coordModeBtnTextActive: { color: "#fff" },
  gpsBtn: {
    backgroundColor: "#1a5c38",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 10,
  },
  gpsBtnDisabled: { opacity: 0.6 },
  gpsBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  coordConfirmed: {
    backgroundColor: "#f0faf4",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#b7e4c7",
    padding: 10,
    marginTop: 4,
  },
  coordConfirmedText: { color: "#1a5c38", fontSize: 13, fontWeight: "600" },
  coordHint: { color: "#aaa", fontSize: 12, marginTop: 4, fontStyle: "italic" },

  searchResult: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
  },
  searchResultInner: { flex: 1 },
  searchResultName: { fontSize: 14, fontWeight: "600", color: "#222" },
  searchResultMeta: { fontSize: 12, color: "#888", marginTop: 2 },
  searchResultCheck: { color: "#1a5c38", fontSize: 18, fontWeight: "bold" },
  noResultsBox: {
    backgroundColor: "#fffbec",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#f0d070",
  },
  noResultsText: { color: "#b07d00", fontSize: 13 },
  searchListHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#aaa",
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  searchResultSelected: { backgroundColor: "#f0faf4", borderColor: "#b7e4c7" },
  sourceTag: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  sourceTagMap: { backgroundColor: "#e8f5ee" },
  sourceTagDB: { backgroundColor: "#eff6ff" },
  sourceTagText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#555",
    textTransform: "uppercase",
  },

  // ── User Account ──────────────────────────────────────────────
  userContent: { paddingBottom: 40 },
  profileHeader: {
    backgroundColor: "#1a5c38",
    paddingTop: 60,
    paddingBottom: 32,
    alignItems: "center",
     position: "relative",   // ← add
    overflow: "hidden",  
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#fff", fontSize: 26, fontWeight: "bold" },
  profileName: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  profileEmail: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 4 },
  profileFaculty: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    marginTop: 4,
  },
  profileMatric: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2 },

  section: { margin: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#999",
    letterSpacing: 1,
    marginBottom: 8,
  },

  featureRow: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  featureIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#f0faf4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  featureIcon: { fontSize: 20 },
  featureLabelWrap: { flex: 1 },
  featureLabel: { fontSize: 15, color: "#222", fontWeight: "600" },
  featureSub: { fontSize: 12, color: "#aaa", marginTop: 2 },
  featureArrow: { fontSize: 20, color: "#ccc", marginLeft: 8 },

  servicesModalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: 55, paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: "#1a5c38",
  },
  servicesModalHeaderTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  servicesModalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  servicesModalCloseText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  infoOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center", alignItems: "center", paddingHorizontal: 28,
  },
  infoCard: {
    backgroundColor: "#fff", borderRadius: 18, padding: 24, width: "100%",
    alignItems: "center",
  },
  infoIcon: { fontSize: 34, marginBottom: 10 },
  infoTitle: { fontSize: 17, fontWeight: "700", color: "#1a1a1a", marginBottom: 8, textAlign: "center" },
  infoBody: { fontSize: 13, color: "#666", lineHeight: 19, textAlign: "center", marginBottom: 18 },
  infoCloseBtn: { backgroundColor: "#1a5c38", borderRadius: 10, paddingVertical: 11, paddingHorizontal: 28 },
  infoCloseText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  signOutFullBtn: {
    margin: 16,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#ffcccc",
  },
  signOutFullText: { color: "#cc2222", fontSize: 15, fontWeight: "700" },
});