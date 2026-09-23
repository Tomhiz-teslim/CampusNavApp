import { useEffect, useState } from "react";
import * as ExpoLocation from "expo-location";
import { PhotoCarousel } from "../../components/ServicePhotos";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { onValue, ref, remove, serverTimestamp, set } from "firebase/database";
import { auth, database } from "../../lib/firebase";
import MapView, { Marker } from "react-native-maps";
import {
  ChevronLeft,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Share2,
  ShoppingBag,
} from "lucide-react-native";
import { TrustChip } from "../../components/TrustChip";
import {
  formatDistance,
  formatWeeklyHours,
  getDistanceMeters,
  isOpenNow,
  normalizePhone,
  SERVICE_CATEGORIES,
  type ServiceListing,
} from "../../lib/serviceShared";

const GREEN = "#1a5c38";
const GREEN_TINT = "#EAF6EE";
const BG = "#F5F7F5";
const HERO_HEIGHT = 220;

export default function ServiceDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [service, setService] = useState<ServiceListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const userId = auth.currentUser?.uid ?? null;

  useEffect(() => {
    (async () => {
      try {
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
        setUserLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        /* silent — page just falls back to the text location */
      }
    })();
  }, []);

  useEffect(() => {
    if (!id) return;
    const unsub = onValue(ref(database, `services/${id}`), (snap) => {
      setService(snap.exists() ? { id, ...snap.val() } : null);
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (!userId || !id) return;
    const unsub = onValue(ref(database, `bookmarks/${userId}/${id}`), (snap) => {
      setIsFavorited(snap.exists());
    });
    return () => unsub();
  }, [userId, id]);

  useEffect(() => {
    if (!userId || !id || !service) return;
    set(ref(database, `recentlyViewed/${userId}/${id}`), serverTimestamp()).catch(() => {});
  }, [userId, id, service?.id]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={GREEN} size="large" />
      </View>
    );
  }

  if (!service) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.notFoundText}>This listing is no longer available.</Text>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cat = SERVICE_CATEGORIES.find((c) => c.key === service.category);
  const CatIcon = cat?.icon ?? ShoppingBag;
  const showRating = typeof service.rating === "number" && (service.ratingCount ?? 0) >= 3;
  const distanceM =
    userLoc && service.latitude != null && service.longitude != null
      ? getDistanceMeters(userLoc.lat, userLoc.lng, service.latitude, service.longitude)
      : null;
  const openNow = isOpenNow(service.hours);
  const hoursRows = formatWeeklyHours(service.hours);
  const hasMapPin = service.latitude != null && service.longitude != null;

  function openWhatsApp() {
    if (!service!.whatsapp) return;
    Linking.openURL(`https://wa.me/${normalizePhone(service!.whatsapp)}`).catch(() =>
      Alert.alert("Error", "Could not open WhatsApp.")
    );
  }
  function openCall() {
    if (!service!.phone) return;
    Linking.openURL(`tel:${service!.phone}`).catch(() =>
      Alert.alert("Error", "Could not make a call.")
    );
  }
  function openDirections() {
    if (service!.latitude == null || service!.longitude == null) {
      Alert.alert("No location set", "This business hasn't added a campus GPS location yet.");
      return;
    }
    router.push({
      pathname: "/home",
      params: {
        eventLat: service!.latitude,
        eventLng: service!.longitude,
        eventName: service!.name,
        eventDesc: service!.description || "",
      },
    });
  }
  function handleReport() {
    Alert.alert(
      "Report this listing",
      "Let us know if something's wrong with this listing and our team will review it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report",
          style: "destructive",
          onPress: () => Alert.alert("Reported", "Thanks — our team will take a look."),
        },
      ]
    );
  }

  function handleShare() {
    Share.share({
      message: `Check out ${service!.name} on Campus Services${
        service!.description ? ` — ${service!.description}` : ""
      }`,
    }).catch(() => {});
  }

  function toggleFavorite() {
    if (!userId || !id) return;
    const bookmarkRef = ref(database, `bookmarks/${userId}/${id}`);
    if (isFavorited) {
      remove(bookmarkRef).catch(() => Alert.alert("Error", "Could not remove bookmark."));
    } else {
      set(bookmarkRef, serverTimestamp()).catch(() => Alert.alert("Error", "Could not save bookmark."));
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.heroWrap}>
        {service.photos?.[0] ? (
          <PhotoCarousel photos={service.photos} height={HERO_HEIGHT} />
        ) : (
          <View style={[styles.heroImage, styles.heroImagePlaceholder]}>
            <CatIcon size={44} color={GREEN} strokeWidth={1.8} />
          </View>
        )}
        <TouchableOpacity onPress={() => router.back()} style={styles.heroBackBtn}>
          <ChevronLeft size={22} color="#fff" strokeWidth={2.4} />
        </TouchableOpacity>
        <View style={styles.heroActionsRow}>
          <TouchableOpacity onPress={toggleFavorite} style={styles.heroIconBtn}>
            <Heart
              size={18}
              color={isFavorited ? "#e0455f" : "#fff"}
              fill={isFavorited ? "#e0455f" : "transparent"}
              strokeWidth={2.2}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.heroIconBtn}>
            <Share2 size={18} color="#fff" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
        {service.verified && (
          <View style={styles.heroVerifiedBadge}>
            <Text style={styles.heroVerifiedText}>✓ Verified Provider</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Identity */}
        <View style={styles.identityRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{service.name}</Text>
            <Text style={styles.provider}>{cat?.label ?? service.providerName}</Text>
          </View>
        </View>

        {/* Trust row */}
        <View style={styles.trustRow}>
          {showRating && (
            <TrustChip variant="rating" value={service.rating!} count={service.ratingCount} />
          )}
          {distanceM != null && (
            <TrustChip variant="distance" label={formatDistance(distanceM)} />
          )}
          {openNow != null && <TrustChip variant="open" isOpen={openNow} />}
        </View>

        {/* Trait tags */}
        {service.tags && service.tags.length > 0 && (
          <View style={styles.chipWrapRow}>
            {service.tags.map((tag) => (
              <View key={tag} style={styles.traitChip}>
                <Text style={styles.traitChipText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Description */}
        {service.description ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>ABOUT</Text>
            <Text style={styles.description}>{service.description}</Text>
          </View>
        ) : null}

        {/* Services offered */}
        {service.servicesOffered && service.servicesOffered.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>SERVICES</Text>
            <View style={styles.chipWrapRow}>
              {service.servicesOffered.map((s) => (
                <View key={s} style={styles.serviceChip}>
                  <Text style={styles.serviceChipText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Business hours */}
        {hoursRows.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>BUSINESS HOURS</Text>
            {hoursRows.map((row) => (
              <View key={row.label} style={styles.hoursRow}>
                <Text style={styles.hoursDayText}>{row.label}</Text>
                <Text
                  style={[styles.hoursValueText, row.value === "Closed" && styles.hoursValueClosed]}
                >
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Location */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>LOCATION</Text>
          <View style={styles.locationRow}>
            <MapPin size={15} color="#666" strokeWidth={2.2} />
            <Text style={styles.locationText}>
              {service.location || "No location description provided"}
            </Text>
          </View>
          {hasMapPin && (
            <View style={styles.miniMapWrap}>
              <MapView
                style={styles.miniMap}
                pointerEvents="none"
                initialRegion={{
                  latitude: service.latitude!,
                  longitude: service.longitude!,
                  latitudeDelta: 0.004,
                  longitudeDelta: 0.004,
                }}
              >
                <Marker coordinate={{ latitude: service.latitude!, longitude: service.longitude! }} />
              </MapView>
            </View>
          )}
          <TouchableOpacity
            style={[styles.directionsBtn, service.latitude == null && styles.btnDisabled]}
            onPress={openDirections}
            activeOpacity={0.85}
          >
            <Navigation size={15} color="#fff" strokeWidth={2.3} />
            <Text style={styles.directionsBtnText}>Get Directions</Text>
          </TouchableOpacity>
        </View>

        {/* Contact */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>CONTACT</Text>
          <View style={styles.contactRow}>
            <TouchableOpacity
              style={[styles.contactBtn, !service.whatsapp && styles.btnDisabled]}
              onPress={openWhatsApp}
              disabled={!service.whatsapp}
              activeOpacity={0.85}
            >
              <MessageCircle size={17} color="#fff" strokeWidth={2.2} />
              <Text style={styles.contactBtnText}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactBtn, styles.contactBtnAlt, !service.phone && styles.btnDisabled]}
              onPress={openCall}
              disabled={!service.phone}
              activeOpacity={0.85}
            >
              <Phone size={17} color={GREEN} strokeWidth={2.2} />
              <Text style={[styles.contactBtnText, styles.contactBtnTextAlt]}>Call</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Report */}
        <TouchableOpacity style={styles.reportLink} onPress={handleReport}>
          <Flag size={13} color="#aaa" strokeWidth={2.2} />
          <Text style={styles.reportText}>Report this listing</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: BG, gap: 14, padding: 24 },
  notFoundText: { fontSize: 15, color: "#666", textAlign: "center" },
  backLink: { paddingVertical: 10, paddingHorizontal: 20 },
  backLinkText: { color: GREEN, fontSize: 14, fontWeight: "700" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: GREEN,
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700", flex: 1, textAlign: "center" },

  content: { padding: 16, paddingBottom: 40 },

  identityRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12 },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: GREEN_TINT,
    alignItems: "center", justifyContent: "center",
  },
  name: { fontSize: 20, fontWeight: "800", color: "#1a1a1a" },
  provider: { fontSize: 13, color: "#888", marginTop: 2 },

  trustRow: { flexDirection: "row", gap: 8, marginBottom: 20 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#999", letterSpacing: 1, marginBottom: 10 },
  description: { fontSize: 14, color: "#444", lineHeight: 21 },

  locationRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 14 },
  locationText: { flex: 1, fontSize: 14, color: "#444", lineHeight: 20 },
  directionsBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: GREEN, borderRadius: 12, paddingVertical: 12,
  },
  directionsBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  contactRow: { flexDirection: "row", gap: 10 },
  contactBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#25D366", borderRadius: 12, paddingVertical: 13,
  },
  contactBtnAlt: { backgroundColor: GREEN_TINT, borderWidth: 1.5, borderColor: "#c8e6d4" },
  contactBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  contactBtnTextAlt: { color: GREEN },
  btnDisabled: { opacity: 0.4 },

  reportLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 16 },
  reportText: { fontSize: 12, color: "#aaa", fontWeight: "500" },

  heroWrap: { width: "100%", height: HERO_HEIGHT, position: "relative", backgroundColor: GREEN_TINT },
  heroImage: { width: "100%", height: "100%" },
  heroImagePlaceholder: { alignItems: "center", justifyContent: "center" },
  heroBackBtn: {
    position: "absolute", top: 56, left: 14,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  heroActionsRow: { position: "absolute", top: 56, right: 14, flexDirection: "row", gap: 8 },
  heroIconBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  heroVerifiedBadge: {
    position: "absolute", bottom: 12, left: 14,
    backgroundColor: "#fff", borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  heroVerifiedText: { fontSize: 12, fontWeight: "700", color: GREEN },

  chipWrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  traitChip: { backgroundColor: GREEN_TINT, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 6 },
  traitChipText: { fontSize: 12, fontWeight: "600", color: GREEN },
  serviceChip: { backgroundColor: "#f2f2f2", borderRadius: 12, paddingHorizontal: 11, paddingVertical: 6 },
  serviceChipText: { fontSize: 12, fontWeight: "600", color: "#555" },

  hoursRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  hoursDayText: { fontSize: 13.5, color: "#444", fontWeight: "600" },
  hoursValueText: { fontSize: 13.5, color: "#444" },
  hoursValueClosed: { color: "#c0392b", fontWeight: "600" },

  miniMapWrap: { height: 130, borderRadius: 12, overflow: "hidden", marginBottom: 14, borderWidth: 1, borderColor: "#eee" },
  miniMap: { width: "100%", height: "100%" },
});