import { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Linking,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";

// Bump this with each release — there's no auto-versioning wired up yet.
const APP_VERSION = "1.0.0";

const FEATURES = [
  { icon: "🗺️", label: "Interactive Campus Map", sub: "Explore UNILAG visually, in real time" },
  { icon: "🧭", label: "Smart Navigation", sub: "Turn-by-turn directions to any spot" },
  { icon: "🗓️", label: "Campus Events", sub: "Never miss what's happening on campus" },
  { icon: "🔎", label: "Lost & Found", sub: "Report or search for lost items" },
  { icon: "🛍️", label: "Campus Services", sub: "Discover services offered by students" },
  { icon: "🍽️", label: "Cafeteria Info", sub: "Find food spots near you" },
  { icon: "🚌", label: "Shuttle Info", sub: "Routes, stops & schedules" },
  { icon: "📍", label: "Key Campus Locations", sub: "Halls, faculties, offices & more" },
  { icon: "✨", label: "Student-Friendly Design", sub: "Simple, fast, and built for you" },
];

const WHY_US = [
  { icon: "⏱️", text: "Saves time finding locations" },
  { icon: "🎓", text: "Helps new students settle in quickly" },
  { icon: "🚶", text: "Makes campus exploration easier" },
  { icon: "🔗", text: "Connects students with campus services" },
  { icon: "🇳🇬", text: "Built specifically for Nigerian universities" },
];

const CONTACT = [
  { icon: "✉️", label: "Email", value: "support@campusnav.app", url: "mailto: tomhizb12@gmail.com" },
  { icon: "📷", label: "Instagram", value: "@campusnav", url: "https://instagram.com/campusnav" },
  { icon: "💼", label: "LinkedIn", value: "Even Tech", url: "https://linkedin.com/company/eventech" },
];

export default function AboutScreen() {
  const router = useRouter();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About CampusNav</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        >
          {/* Logo / Identity */}
          <View style={styles.logoWrap}>
            <View style={styles.logoRing}>
              <Image
                source={require("../assets/images/app_logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>CampusNav</Text>
            <Text style={styles.appTagline}>Your guide to UNILAG</Text>
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>Version {APP_VERSION}</Text>
            </View>
          </View>

          {/* 1. App Introduction */}
          <View style={styles.card}>
            <Text style={styles.cardText}>
              CampusNav helps university students easily find lecture halls, faculties,
              departments, hostels, offices, libraries, cafeterias, banks, ATMs, shuttle
              stops, and other important locations on campus — while also giving access
              to useful campus services, starting with the University of Lagos (UNILAG).
            </Text>
          </View>

          {/* 2. Our Mission */}
          <Text style={styles.sectionTitle}>OUR MISSION</Text>
          <View style={[styles.card, styles.missionCard]}>
            <Text style={styles.missionIcon}>🎯</Text>
            <Text style={[styles.cardText, { flex: 1 }]}>
              CampusNav exists to make campus life easier — helping students navigate
              confidently, discover campus services, and stay connected with useful
              information, all in one place.
            </Text>
          </View>

          {/* 3. Key Features */}
          <Text style={styles.sectionTitle}>KEY FEATURES</Text>
          <View style={styles.featuresGrid}>
            {FEATURES.map((f) => (
              <View key={f.label} style={styles.featureCard}>
                <View style={styles.featureIconWrap}>
                  <Text style={styles.featureIcon}>{f.icon}</Text>
                </View>
                <Text style={styles.featureLabel}>{f.label}</Text>
                <Text style={styles.featureSub}>{f.sub}</Text>
              </View>
            ))}
          </View>

          {/* 4. Why CampusNav */}
          <Text style={styles.sectionTitle}>WHY CAMPUSNAV?</Text>
          <View style={styles.card}>
            {WHY_US.map((w, i) => (
              <View
                key={w.text}
                style={[
                  styles.whyRow,
                  i === WHY_US.length - 1 && { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 },
                ]}
              >
                <Text style={styles.whyIcon}>{w.icon}</Text>
                <Text style={styles.whyText}>{w.text}</Text>
              </View>
            ))}
          </View>

          {/* 5. Version Information */}
          <Text style={styles.sectionTitle}>VERSION INFORMATION</Text>
          <View style={styles.card}>
            <View style={styles.infoLine}>
              <Text style={styles.infoLineLabel}>Version</Text>
              <Text style={styles.infoLineValue}>{APP_VERSION}</Text>
            </View>
            <View style={styles.infoLine}>
              <Text style={styles.infoLineLabel}>Developed by</Text>
              <Text style={styles.infoLineValue}>Even Tech</Text>
            </View>
            <View style={[styles.infoLine, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoLineLabel}>Built with</Text>
              <Text style={styles.infoLineValue}>Expo React Native & Firebase</Text>
            </View>
          </View>

          {/* 6. Contact & Support */}
          <Text style={styles.sectionTitle}>CONTACT & SUPPORT</Text>
          <View style={styles.card}>
            {CONTACT.map((c, i) => (
              <TouchableOpacity
                key={c.label}
                onPress={() => openLink(c.url)}
                style={[
                  styles.contactRow,
                  i === CONTACT.length - 1 && { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 },
                ]}
                activeOpacity={0.7}
              >
                <View style={styles.contactIconWrap}>
                  <Text style={styles.contactIcon}>{c.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactLabel}>{c.label}</Text>
                  <Text style={styles.contactValue}>{c.value}</Text>
                </View>
                <Text style={styles.contactArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 7. Footer */}
          <Text style={styles.footerNote}>CampusNav © 2026 • Built by Even Tech</Text>

          <View style={{ height: 32 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const GREEN = "#1a5c38";
const GREEN_LIGHT = "#e8f5ee";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7F5" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: GREEN,
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
  logoRing: {
    width: 108,
    height: 108,
    borderRadius: 28,
    backgroundColor: GREEN_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  logo: { width: 72, height: 72 },
  appName: { fontSize: 24, fontWeight: "800", color: GREEN },
  appTagline: { fontSize: 13, color: "#888", marginTop: 3, marginBottom: 12 },
  versionBadge: {
    backgroundColor: GREEN_LIGHT,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  versionText: { fontSize: 12, fontWeight: "700", color: GREEN },

  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#999",
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 22,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardText: { fontSize: 14, color: "#555", lineHeight: 21 },

  missionCard: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  missionIcon: { fontSize: 22, marginTop: 1 },

  // Feature cards grid
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  featureCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: GREEN_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  featureIcon: { fontSize: 19 },
  featureLabel: { fontSize: 13.5, fontWeight: "700", color: "#222", marginBottom: 3 },
  featureSub: { fontSize: 11.5, color: "#999", lineHeight: 15 },

  whyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  whyIcon: { fontSize: 18, width: 24, textAlign: "center" },
  whyText: { fontSize: 14, color: "#333", fontWeight: "500", flex: 1 },

  infoLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  infoLineLabel: { fontSize: 13.5, color: "#888", fontWeight: "500" },
  infoLineValue: { fontSize: 13.5, color: "#222", fontWeight: "700" },

  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  contactIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: GREEN_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  contactIcon: { fontSize: 17 },
  contactLabel: { fontSize: 12, color: "#999", fontWeight: "600" },
  contactValue: { fontSize: 14, color: "#222", fontWeight: "600", marginTop: 1 },
  contactArrow: { fontSize: 20, color: "#ccc" },

  footerNote: {
    fontSize: 12,
    color: "#aaa",
    textAlign: "center",
    marginTop: 28,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
});