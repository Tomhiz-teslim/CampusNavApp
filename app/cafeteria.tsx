import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";

interface Cafeteria {
  id: string;
  name: string;
  description: string;
  hours: string;
  latitude: number;
  longitude: number;
  tags: string[];
}

// ── Replace these with your actual campus cafeteria coordinates ──────────────
const CAFETERIAS: Cafeteria[] = [
  {
    id: "caf1",
    name: "Dangote Cafeteria",
    description: "Main cafeteria — Mon–Fri 7am–7pm",
    hours: "7:00 AM – 7:00 PM",
    latitude: 6.51730,
    longitude: 3.39200,
    tags: ["Breakfast", "Lunch", "Dinner"],
  },
  {
    id: "caf2",
    name: "SUB Cafeteria",
    description: "Student Union canteen — Mon–Fri 8am–8pm",
    hours: "8:00 AM – 8:00 PM",
    latitude: 6.51695,
    longitude: 3.39095,
    tags: ["Coffee", "Snacks"],
  },
  {
    id: "caf3",
    name: "Science Canteen",
    description: "Canteen near Faculty of Science — Mon–Sat 7am–8pm",
    hours: "7:00 AM – 8:00 PM",
    latitude: 6.51770,
    longitude: 3.39350,
    tags: ["Lunch", "Dinner", "Local Food"],
  },
];
// ────────────────────────────────────────────────────────────────────────────

function getDistanceMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function CafeteriaScreen() {
  const router = useRouter();
  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [closestId, setClosestId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") { setLocating(false); return; }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = loc.coords;
        setUserLoc({ latitude, longitude });

        // Find closest
        let minDist = Infinity;
        let closest = CAFETERIAS[0].id;
        CAFETERIAS.forEach((c) => {
          if (c.latitude === 0 && c.longitude === 0) return; // skip placeholder
          const d = getDistanceMeters(latitude, longitude, c.latitude, c.longitude);
          if (d < minDist) { minDist = d; closest = c.id; }
        });
        setClosestId(closest);
      } catch { /* silent */ }
      setLocating(false);
    })();
  }, []);

  const handleDirections = (caf: Cafeteria) => {
  router.push({
    pathname: "/home",
    params: {
      eventLat: caf.latitude,   // was destLat
      eventLng: caf.longitude,  // was destLng
      eventName: caf.name,      // was destName
      eventIcon: "🍽️",
      eventDesc: caf.description,
    },
  });
};

  const cafeteriasWithDistance = CAFETERIAS.map((c) => {
    const dist =
      userLoc && c.latitude !== 0
        ? getDistanceMeters(userLoc.latitude, userLoc.longitude, c.latitude, c.longitude)
        : null;
    return { ...c, dist };
  }).sort((a, b) => {
    if (a.dist === null) return 1;
    if (b.dist === null) return -1;
    return a.dist - b.dist;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Campus Cafeterias</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Location banner */}
      <View style={styles.banner}>
        {locating ? (
          <View style={styles.bannerRow}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.bannerText}>  Locating you…</Text>
          </View>
        ) : userLoc ? (
          <Text style={styles.bannerText}>📍 Showing nearest cafeteria first</Text>
        ) : (
          <Text style={styles.bannerText}>⚠️ Enable location for distance info</Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {cafeteriasWithDistance.map((caf, idx) => {
          const isClosest = caf.id === closestId;
          return (
            <View key={caf.id} style={[styles.card, isClosest && styles.cardClosest]}>
              {isClosest && (
                <View style={styles.closestBadge}>
                  <Text style={styles.closestBadgeText}>⚡ Closest to you</Text>
                </View>
              )}

              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                  <Text style={styles.iconEmoji}>🍽️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cafName}>{caf.name}</Text>
                  <Text style={styles.cafHours}>🕐 {caf.hours}</Text>
                </View>
                {caf.dist !== null && (
                  <View style={styles.distBadge}>
                    <Text style={styles.distText}>{formatDistance(caf.dist)}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.cafDesc}>{caf.description}</Text>

              {/* Tags */}
              <View style={styles.tagsRow}>
                {caf.tags.map((t) => (
                  <View key={t} style={styles.tag}>
                    <Text style={styles.tagText}>{t}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.dirBtn, isClosest && styles.dirBtnClosest]}
                onPress={() => handleDirections(caf)}
              >
                <Text style={styles.dirBtnText}>🗺️  Get Directions</Text>
              </TouchableOpacity>
            </View>
          );
        })}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7F5" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1A5C38",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  backIcon: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },

  banner: {
    backgroundColor: "#2ECC71",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  bannerRow: { flexDirection: "row", alignItems: "center" },
  bannerText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  listContent: { padding: 16, gap: 14 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: "#BDC3C7",
  },
  cardClosest: { borderLeftColor: "#2ECC71", borderWidth: 1.5, borderColor: "#2ECC71" },

  closestBadge: {
    backgroundColor: "#E8F8F0",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  closestBadgeText: { fontSize: 12, color: "#1A5C38", fontWeight: "700" },

  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#E8F8F0",
    alignItems: "center", justifyContent: "center",
  },
  iconEmoji: { fontSize: 22 },

  cafName: { fontSize: 16, fontWeight: "700", color: "#1A1A1A" },
  cafHours: { fontSize: 12, color: "#888", marginTop: 2 },

  distBadge: {
    backgroundColor: "#F0F4F0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distText: { fontSize: 12, fontWeight: "700", color: "#1A5C38" },

  cafDesc: { fontSize: 13, color: "#666", lineHeight: 19, marginBottom: 10 },

  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  tag: {
    backgroundColor: "#F0F4F0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tagText: { fontSize: 12, color: "#1A5C38", fontWeight: "500" },

  dirBtn: {
    backgroundColor: "#1A5C38",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  dirBtnClosest: { backgroundColor: "#2ECC71" },
  dirBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});