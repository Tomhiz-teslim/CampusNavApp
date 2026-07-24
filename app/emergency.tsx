import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { database } from "../lib/firebase";
import { ref, onValue } from "firebase/database";

// ── Emergency Contacts (fallback defaults) ──────────────────────────────────
// Real numbers should live in the Firebase `emergencyContacts` node so
// admins can update them without an app release. These are shown only
// until that node has data — replace with UNILAG's actual lines before
// shipping, or push real data into Firebase directly.
type EmergencyContact = { id: string; name: string; number: string; sub?: string };
type EmergencyGroup = { category: string; icon: string; contacts: EmergencyContact[] };

const DEFAULT_EMERGENCY_CONTACTS: EmergencyGroup[] = [
  {
    category: "Campus Security",
    icon: "🚨",
    contacts: [
      { id: "sec-main", name: "Main Gate Security Post", number: "08000000001" },
      { id: "sec-akoka", name: "Akoka Gate Security Post", number: "08000000002" },
    ],
  },
  {
    category: "Health Centre",
    icon: "🏥",
    contacts: [
      { id: "health-centre", name: "University Health Centre", number: "08000000003", sub: "24/7 emergency line" },
    ],
  },
  {
    category: "Hall Wardens",
    icon: "🏠",
    contacts: [
      { id: "warden-male", name: "Male Halls Warden", number: "08000000004" },
      { id: "warden-female", name: "Female Halls Warden", number: "08000000005" },
    ],
  },
];

export default function EmergencyScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<EmergencyGroup[]>(DEFAULT_EMERGENCY_CONTACTS);
  const [loading, setLoading] = useState(true);
  const [usingDefaults, setUsingDefaults] = useState(true);

  useEffect(() => {
    const unsub = onValue(ref(database, "emergencyContacts"), (snap) => {
      const data = snap.val();
      if (data && Array.isArray(data) && data.length > 0) {
        setGroups(data);
        setUsingDefaults(false);
      } else if (data && typeof data === "object" && Object.keys(data).length > 0) {
        // Also accept an object-of-groups shape (Firebase push keys etc.)
        setGroups(Object.values(data) as EmergencyGroup[]);
        setUsingDefaults(false);
      } else {
        setGroups(DEFAULT_EMERGENCY_CONTACTS);
        setUsingDefaults(true);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  function call(number: string) {
    const cleaned = number.replace(/[^0-9+]/g, "");
    if (!cleaned) return;
    Alert.alert(
      "Call this number?",
      cleaned,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Call", onPress: () => Linking.openURL(`tel:${cleaned}`) },
      ]
    );
  }

  // Primary SOS number: first contact of the first group (Campus Security
  // by convention), used for the big one-tap button up top.
  const sosContact = groups[0]?.contacts?.[0];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emergency Contacts</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#1a5c38" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {sosContact && (
            <TouchableOpacity style={styles.sosBtn} onPress={() => call(sosContact.number)} activeOpacity={0.85}>
              <Text style={styles.sosBtnIcon}>🆘</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sosBtnTitle}>Emergency — Call Security Now</Text>
                <Text style={styles.sosBtnSub}>{sosContact.name}</Text>
              </View>
            </TouchableOpacity>
          )}

          {usingDefaults && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                ⚠️ These are placeholder numbers. An admin needs to add real contacts to the `emergencyContacts` node in Firebase.
              </Text>
            </View>
          )}

          {groups.map((group, gi) => (
            <View key={group.category ?? gi} style={styles.group}>
              <Text style={styles.groupTitle}>
                {group.icon} {group.category}
              </Text>
              {group.contacts?.map((c, ci) => (
                <TouchableOpacity
                  key={c.id ?? ci}
                  style={styles.contactRow}
                  activeOpacity={0.7}
                  onPress={() => call(c.number)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>{c.name}</Text>
                    {c.sub ? <Text style={styles.contactSub}>{c.sub}</Text> : null}
                    <Text style={styles.contactNumber}>{c.number}</Text>
                  </View>
                  <View style={styles.callBtn}>
                    <Text style={styles.callBtnText}>📞 Call</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
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

  centerBox: { flex: 1, alignItems: "center", justifyContent: "center" },

  content: { padding: 16 },

  sosBtn: {
    backgroundColor: "#cc2222",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
    shadowColor: "#cc2222",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sosBtnIcon: { fontSize: 30 },
  sosBtnTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  sosBtnSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },

  notice: {
    backgroundColor: "#fffbec",
    borderWidth: 1,
    borderColor: "#f0d070",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  noticeText: { color: "#b07d00", fontSize: 12, lineHeight: 17 },

  group: { marginBottom: 20 },
  groupTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#888",
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  contactName: { fontSize: 15, fontWeight: "700", color: "#222" },
  contactSub: { fontSize: 12, color: "#888", marginTop: 2 },
  contactNumber: { fontSize: 13, color: "#1a5c38", marginTop: 4, fontWeight: "600" },
  callBtn: {
    backgroundColor: "#1a5c38",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 10,
  },
  callBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});