import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { auth, database } from "../lib/firebase";
import { ref, onValue, update, remove } from "firebase/database";
import { signOut, deleteUser } from "firebase/auth";

export default function SettingsScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = onValue(ref(database, `users/${user.uid}/settings`), (snap) => {
      const d = snap.val() || {};
      setNotificationsEnabled(d.notificationsEnabled ?? true);
      setLocationSharingEnabled(d.locationSharingEnabled ?? true);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function saveSetting(key: string, value: boolean) {
    if (!user) return;
    setSaving(true);
    try {
      await update(ref(database, `users/${user.uid}/settings`), { [key]: value });
    } catch (e: any) {
      Alert.alert("Couldn't save", e.message || "Please try again.");
    }
    setSaving(false);
  }

  function toggleNotifications(value: boolean) {
    setNotificationsEnabled(value);
    saveSetting("notificationsEnabled", value);
  }

  function toggleLocationSharing(value: boolean) {
    setLocationSharingEnabled(value);
    saveSetting("locationSharingEnabled", value);
  }

  function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => { await signOut(auth); router.replace("/login"); } },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "This permanently deletes your account and profile data. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: confirmDeleteAccount },
      ]
    );
  }

  async function confirmDeleteAccount() {
    if (!user) return;
    setDeleting(true);
    try {
      await remove(ref(database, `users/${user.uid}`));
      await deleteUser(user);
      router.replace("/login");
    } catch (e: any) {
      setDeleting(false);
      if (e.code === "auth/requires-recent-login") {
        Alert.alert(
          "Please sign in again",
          "For security, deleting your account requires a recent sign-in. Sign out and log back in, then try again."
        );
      } else {
        Alert.alert("Couldn't delete account", e.message || "Please try again.");
      }
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#1a5c38" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Push Notifications</Text>
              <Text style={styles.rowSub}>Event reminders, submission updates & alerts</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: "#e0e0e0", true: "#a8d5bb" }}
              thumbColor={notificationsEnabled ? "#1a5c38" : "#f4f3f4"}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>PRIVACY</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Share Location with Friends</Text>
              <Text style={styles.rowSub}>Lets accepted friends see your live location</Text>
            </View>
            <Switch
              value={locationSharingEnabled}
              onValueChange={toggleLocationSharing}
              trackColor={{ false: "#e0e0e0", true: "#a8d5bb" }}
              thumbColor={locationSharingEnabled ? "#1a5c38" : "#f4f3f4"}
            />
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => router.push("/home" as any)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Manage Friends</Text>
              <Text style={styles.rowSub}>Add, remove, or block friends from the Friends tab</Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {saving && (
          <View style={styles.savingRow}>
            <ActivityIndicator size="small" color="#1a5c38" />
            <Text style={styles.savingText}>  Saving…</Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>ACCOUNT</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={handleSignOut}>
            <Text style={[styles.rowLabel, { color: "#1a5c38" }]}>Sign Out</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={handleDeleteAccount} disabled={deleting}>
            {deleting ? (
              <ActivityIndicator size="small" color="#cc2222" />
            ) : (
              <Text style={[styles.rowLabel, { color: "#cc2222" }]}>Delete Account</Text>
            )}
          </TouchableOpacity>
        </View>

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

  centerBox: { flex: 1, alignItems: "center", justifyContent: "center" },

  content: { padding: 16 },

  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#999",
    letterSpacing: 1,
    marginBottom: 8,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  rowLabel: { fontSize: 15, fontWeight: "600", color: "#222" },
  rowSub: { fontSize: 12, color: "#999", marginTop: 2 },
  rowArrow: { fontSize: 20, color: "#ccc", marginLeft: 8 },
  divider: { height: 1, backgroundColor: "#f0f0f0" },

  savingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 10 },
  savingText: { color: "#888", fontSize: 12 },
});