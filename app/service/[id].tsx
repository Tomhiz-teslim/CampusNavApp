import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { onValue, ref } from "firebase/database";
import { database } from "../../lib/firebase";
import {
  ChevronLeft,
  Flag,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  ShoppingBag,
} from "lucide-react-native";
import { TrustChip } from "../../components/TrustChip";
import {
  formatDistance,
  normalizePhone,
  SERVICE_CATEGORIES,
  type ServiceListing,
} from "../../lib/serviceShared";

const GREEN = "#1a5c38";
const GREEN_TINT = "#EAF6EE";
const BG = "#F5F7F5";

export default function ServiceDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [service, setService] = useState<ServiceListing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const unsub = onValue(ref(database, `services/${id}`), (snap) => {
      setService(snap.exists() ? { id, ...snap.val() } : null);
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={22} color="#fff" strokeWidth={2.4} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{cat?.label ?? "Service"}</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Identity */}
        <View style={styles.identityRow}>
          <View style={styles.iconCircle}>
            <CatIcon size={30} color={GREEN} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{service.name}</Text>
            <Text style={styles.provider}>{service.providerName}</Text>
          </View>
        </View>

        {/* Trust row */}
        <View style={styles.trustRow}>
          {showRating && (
            <TrustChip variant="rating" value={service.rating!} count={service.ratingCount} />
          )}
          {service.verified && <TrustChip variant="verified" />}
        </View>

        {/* Description */}
        {service.description ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>ABOUT</Text>
            <Text style={styles.description}>{service.description}</Text>
          </View>
        ) : null}

        {/* Location */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>LOCATION</Text>
          <View style={styles.locationRow}>
            <MapPin size={15} color="#666" strokeWidth={2.2} />
            <Text style={styles.locationText}>
              {service.location || "No location description provided"}
            </Text>
          </View>
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
});