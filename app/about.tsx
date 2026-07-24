import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";

// Bump this with each release — there's no auto-versioning wired up yet.
const APP_VERSION = "1.0.0";

const FEATURES = [
  { icon: "🗺️", label: "Campus map & directions" },
  { icon: "🗓️", label: "Events calendar" },
  { icon: "🍽️", label: "Cafeteria finder" },
  { icon: "🚌", label: "Shuttle routes" },
  { icon: "🔎", label: "Lost & found" },
  { icon: "📍", label: "Community-submitted locations" },
  { icon: "🚨", label: "Emergency contacts" },
];

export default function AboutScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About Compass</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.logoWrap}>
          <Image
            source={require("../assets/images/app_logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>Compass</Text>
          <Text style={styles.appTagline}>UNILAG Navigator</Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>Version {APP_VERSION}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardText}>
            Compass helps UNILAG students find their way around campus — navigation,
            events, cafeterias, shuttle routes, and community-contributed locations,
            all in one place.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>WHAT'S INSIDE</Text>
        <View style={styles.card}>
          {FEATURES.map((f, i) => (
            <View key={f.label} style={[styles.featureRow, i === FEATURES.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>BUILT BY</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>
            Even Technologies — a student-built project for the UNILAG community.
          </Text>
        </View>

        <Text style={styles.footerNote}>
          Compass is under active development. Found a bug or have a suggestion?
          Reach us from Help & Support.
        </Text>

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

  content: { padding: 16 },

  logoWrap: { alignItems: "center", marginVertical: 24 },
  logo: { width: 96, height: 96, marginBottom: 12 },
  appName: { fontSize: 22, fontWeight: "800", color: "#1a5c38" },
  appTagline: { fontSize: 13, color: "#888", marginTop: 2, marginBottom: 10 },
  versionBadge: {
    backgroundColor: "#e8f5ee",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  versionText: { fontSize: 12, fontWeight: "700", color: "#1a5c38" },

  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#999",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 20,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  cardText: { fontSize: 14, color: "#555", lineHeight: 21 },

  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  featureIcon: { fontSize: 18, width: 24, textAlign: "center" },
  featureLabel: { fontSize: 14, color: "#333", fontWeight: "500" },

  footerNote: {
    fontSize: 12,
    color: "#aaa",
    textAlign: "center",
    marginTop: 24,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
});