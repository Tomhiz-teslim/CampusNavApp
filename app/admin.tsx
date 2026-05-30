import { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform,
} from "react-native";
import { auth, database } from "../lib/firebase";
import { ref, onValue, update, remove, push, set } from "firebase/database";
import { signOut } from "firebase/auth";
import { router } from "expo-router";

type Tab = "locations" | "events" | "users";

interface LocationDoc {
  id: string;
  name: string;
  description?: string;
  category?: string;
  status: "pending" | "approved" | "rejected";
  submittedBy?: string;
  submittedByEmail?: string;
  latitude?: number;
  longitude?: number;
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
}

interface UserDoc {
  id: string;
  email?: string;
  displayName?: string;
  role?: string;
}

export default function AdminScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("locations");

  const [locations, setLocations] = useState<LocationDoc[]>([]);
  const [locFilter, setLocFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const [events, setEvents] = useState<EventDoc[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventDoc | null>(null);
  const [eventForm, setEventForm] = useState({
    name: "", description: "", category: "Academic",
    date: "", time: "", location: "", latitude: "", longitude: "",
  });
  const [savingEvent, setSavingEvent] = useState(false);

  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Realtime Database listeners ──────────────────────────────────
  useEffect(() => {
    const unsubLoc = onValue(ref(database, "locations"), (snap) => {
      const data = snap.val() || {};
      const arr: LocationDoc[] = Object.entries(data).map(([id, val]: any) => ({ id, ...val }));
      // Sort newest first (by id which is push key)
      arr.reverse();
      setLocations(arr);
    });

    const unsubEv = onValue(ref(database, "events"), (snap) => {
      const data = snap.val() || {};
      const arr: EventDoc[] = Object.entries(data).map(([id, val]: any) => ({ id, ...val }));
      arr.reverse();
      setEvents(arr);
    });

    const unsubUsers = onValue(ref(database, "users"), (snap) => {
      const data = snap.val() || {};
      const arr: UserDoc[] = Object.entries(data).map(([id, val]: any) => ({ id, ...val }));
      setUsers(arr);
      setLoading(false);
    });

    return () => {
      unsubLoc();
      unsubEv();
      unsubUsers();
    };
  }, []);

  // ── Location actions ─────────────────────────────────────────────
  async function approveLocation(id: string) {
    await update(ref(database, `locations/${id}`), { status: "approved" });
  }
  async function rejectLocation(id: string) {
    await update(ref(database, `locations/${id}`), { status: "rejected" });
  }
  function deleteLocation(id: string) {
    Alert.alert("Delete Location", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove(ref(database, `locations/${id}`)) },
    ]);
  }

  // ── Event actions ────────────────────────────────────────────────
  function openAddEvent() {
    setEditingEvent(null);
    setEventForm({ name: "", description: "", category: "Academic", date: "", time: "", location: "", latitude: "", longitude: "" });
    setShowEventModal(true);
  }
  function openEditEvent(ev: EventDoc) {
    setEditingEvent(ev);
    setEventForm({
      name: ev.name ?? "", description: ev.description ?? "",
      category: ev.category ?? "Academic", date: ev.date ?? "",
      time: ev.time ?? "", location: ev.location ?? "",
      latitude: ev.latitude?.toString() ?? "", longitude: ev.longitude?.toString() ?? "",
    });
    setShowEventModal(true);
  }
  async function saveEvent() {
    if (!eventForm.name.trim()) { Alert.alert("Error", "Event name is required"); return; }
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
      updatedAt: Date.now(),
    };
    try {
      if (editingEvent) {
        await update(ref(database, `events/${editingEvent.id}`), payload);
      } else {
        payload.createdAt = Date.now();
        const newRef = push(ref(database, "events"));
        await set(newRef, payload);
      }
      setShowEventModal(false);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
    setSavingEvent(false);
  }
  function deleteEvent(id: string) {
    Alert.alert("Delete Event", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove(ref(database, `events/${id}`)) },
    ]);
  }

  // ── Sign out ─────────────────────────────────────────────────────
  function handleSignOut() {
    Alert.alert("Sign Out", "Sign out of admin panel?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => { await signOut(auth); router.replace("/login"); } },
    ]);
  }

  const filteredLocations = locFilter === "all" ? locations : locations.filter(l => l.status === locFilter);
  const pendingCount = locations.filter(l => l.status === "pending").length;
  const EVENT_CATEGORIES = ["Academic", "Social", "Sports", "Cultural", "Career", "Health", "Other"];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a5c38" />
        <Text style={styles.loadingText}>Loading admin panel...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <Text style={styles.headerSub}>UniLag Navigator</Text>
        </View>
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(["locations", "events", "users"] as Tab[]).map(tab => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === "locations" ? `📍 Locations${pendingCount > 0 ? ` (${pendingCount})` : ""}` :
               tab === "events" ? "🗓️ Events" : "👥 Users"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── LOCATIONS TAB ── */}
      {activeTab === "locations" && (
        <View style={styles.tabContent}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
            {(["pending", "approved", "rejected", "all"] as const).map(f => (
              <TouchableOpacity key={f} style={[styles.chip, locFilter === f && styles.chipActive]} onPress={() => setLocFilter(f)}>
                <Text style={[styles.chipText, locFilter === f && styles.chipTextActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}{f === "pending" && pendingCount > 0 ? ` • ${pendingCount}` : ""}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {filteredLocations.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📍</Text>
                <Text style={styles.emptyText}>No {locFilter === "all" ? "" : locFilter} locations</Text>
              </View>
            ) : filteredLocations.map(loc => (
              <View key={loc.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{loc.name}</Text>
                  <View style={[styles.badge, loc.status === "approved" ? styles.badgeGreen : loc.status === "rejected" ? styles.badgeRed : styles.badgeOrange]}>
                    <Text style={styles.badgeText}>{loc.status}</Text>
                  </View>
                </View>
                {loc.description ? <Text style={styles.cardDesc}>{loc.description}</Text> : null}
                {loc.category ? <Text style={styles.cardMeta}>Category: {loc.category}</Text> : null}
                {loc.submittedByEmail ? <Text style={styles.cardMeta}>Submitted by: {loc.submittedByEmail}</Text> : null}
                {loc.latitude && loc.longitude ? <Text style={styles.cardMeta}>📌 {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}</Text> : null}
                <View style={styles.cardActions}>
                  {loc.status !== "approved" && (
                    <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => approveLocation(loc.id)}>
                      <Text style={styles.actionBtnText}>✅ Approve</Text>
                    </TouchableOpacity>
                  )}
                  {loc.status !== "rejected" && (
                    <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => rejectLocation(loc.id)}>
                      <Text style={styles.actionBtnText}>❌ Reject</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => deleteLocation(loc.id)}>
                    <Text style={styles.actionBtnText}>🗑️ Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── EVENTS TAB ── */}
      {activeTab === "events" && (
        <View style={styles.tabContent}>
          <TouchableOpacity style={styles.addBtn} onPress={openAddEvent}>
            <Text style={styles.addBtnText}>＋ Add New Event</Text>
          </TouchableOpacity>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {events.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🗓️</Text>
                <Text style={styles.emptyText}>No events yet</Text>
              </View>
            ) : events.map(ev => (
              <View key={ev.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{ev.name}</Text>
                  {ev.category ? <View style={styles.badgeBlue}><Text style={styles.badgeText}>{ev.category}</Text></View> : null}
                </View>
                {ev.description ? <Text style={styles.cardDesc}>{ev.description}</Text> : null}
                {ev.date || ev.time ? <Text style={styles.cardMeta}>📅 {ev.date}{ev.time ? ` at ${ev.time}` : ""}</Text> : null}
                {ev.location ? <Text style={styles.cardMeta}>📍 {ev.location}</Text> : null}
                <View style={styles.cardActions}>
                  <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => openEditEvent(ev)}>
                    <Text style={styles.actionBtnText}>✏️ Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => deleteEvent(ev.id)}>
                    <Text style={styles.actionBtnText}>🗑️ Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── USERS TAB ── */}
      {activeTab === "users" && (
        <View style={styles.tabContent}>
          <Text style={styles.sectionCount}>{users.length} registered user{users.length !== 1 ? "s" : ""}</Text>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {users.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyText}>No users found</Text>
              </View>
            ) : users.map(u => (
              <View key={u.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{u.displayName || u.email || "Unknown User"}</Text>
                  <View style={[styles.badge, u.role === "admin" ? styles.badgeGreen : styles.badgeGrey]}>
                    <Text style={styles.badgeText}>{u.role || "user"}</Text>
                  </View>
                </View>
                {u.email ? <Text style={styles.cardMeta}>✉️ {u.email}</Text> : null}
                <Text style={styles.cardMeta}>🆔 {u.id}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── EVENT MODAL ── */}
      <Modal visible={showEventModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEventModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEventModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingEvent ? "Edit Event" : "New Event"}</Text>
            <TouchableOpacity onPress={saveEvent} disabled={savingEvent}>
              {savingEvent ? <ActivityIndicator color="#1a5c38" /> : <Text style={styles.modalSave}>Save</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Event Name *</Text>
            <TextInput style={styles.fieldInput} placeholder="e.g. Faculty Orientation" value={eventForm.name} onChangeText={t => setEventForm(p => ({ ...p, name: t }))} />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput style={[styles.fieldInput, styles.fieldTextarea]} placeholder="What is this event about?" value={eventForm.description} onChangeText={t => setEventForm(p => ({ ...p, description: t }))} multiline numberOfLines={3} />

            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {EVENT_CATEGORIES.map(cat => (
                <TouchableOpacity key={cat} style={[styles.chip, eventForm.category === cat && styles.chipActive, { marginRight: 8 }]} onPress={() => setEventForm(p => ({ ...p, category: cat }))}>
                  <Text style={[styles.chipText, eventForm.category === cat && styles.chipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Date</Text>
            <TextInput style={styles.fieldInput} placeholder="e.g. 2025-09-15" value={eventForm.date} onChangeText={t => setEventForm(p => ({ ...p, date: t }))} />

            <Text style={styles.fieldLabel}>Time</Text>
            <TextInput style={styles.fieldInput} placeholder="e.g. 10:00 AM" value={eventForm.time} onChangeText={t => setEventForm(p => ({ ...p, time: t }))} />

            <Text style={styles.fieldLabel}>Location Name</Text>
            <TextInput style={styles.fieldInput} placeholder="e.g. Main Auditorium" value={eventForm.location} onChangeText={t => setEventForm(p => ({ ...p, location: t }))} />

            <Text style={styles.fieldLabel}>Latitude (for map directions)</Text>
            <TextInput style={styles.fieldInput} placeholder="e.g. 6.5158" value={eventForm.latitude} onChangeText={t => setEventForm(p => ({ ...p, latitude: t }))} keyboardType="decimal-pad" />

            <Text style={styles.fieldLabel}>Longitude (for map directions)</Text>
            <TextInput style={styles.fieldInput} placeholder="e.g. 3.3864" value={eventForm.longitude} onChangeText={t => setEventForm(p => ({ ...p, longitude: t }))} keyboardType="decimal-pad" />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f5f5f5" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f5f5" },
  loadingText: { marginTop: 12, color: "#666", fontSize: 15 },
  header: {
    backgroundColor: "#1a5c38", paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
  },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "bold" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 2 },
  signOutBtn: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  signOutText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  tabBar: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e8e8e8" },
  tab: { flex: 1, paddingVertical: 13, alignItems: "center" },
  tabActive: { borderBottomWidth: 2.5, borderBottomColor: "#1a5c38" },
  tabText: { fontSize: 12, color: "#999", fontWeight: "600" },
  tabTextActive: { color: "#1a5c38" },
  tabContent: { flex: 1 },
  filterRow: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  filterRowContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: "#ddd", backgroundColor: "#fff" },
  chipActive: { backgroundColor: "#1a5c38", borderColor: "#1a5c38" },
  chipText: { fontSize: 13, color: "#555", fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  sectionCount: { padding: 14, color: "#666", fontSize: 13 },
  addBtn: { margin: 16, backgroundColor: "#1a5c38", borderRadius: 10, padding: 14, alignItems: "center" },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "bold" },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 12 },
  emptyState: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: "#999", fontSize: 15 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#222", flex: 1, marginRight: 8 },
  cardDesc: { fontSize: 13, color: "#555", marginBottom: 6 },
  cardMeta: { fontSize: 12, color: "#888", marginBottom: 3 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#fff", textTransform: "uppercase" },
  badgeGreen: { backgroundColor: "#1a5c38" },
  badgeRed: { backgroundColor: "#cc2222" },
  badgeOrange: { backgroundColor: "#d97706" },
  badgeBlue: { backgroundColor: "#1e6fad", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeGrey: { backgroundColor: "#888" },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  actionBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  actionBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },
  approveBtn: { backgroundColor: "#1a5c38" },
  rejectBtn: { backgroundColor: "#d97706" },
  deleteBtn: { backgroundColor: "#cc2222" },
  editBtn: { backgroundColor: "#1e6fad" },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee", backgroundColor: "#fff",
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#222" },
  modalCancel: { color: "#888", fontSize: 15 },
  modalSave: { color: "#1a5c38", fontSize: 15, fontWeight: "700" },
  modalBody: { flex: 1, backgroundColor: "#f5f5f5", padding: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 6, marginTop: 4 },
  fieldInput: { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1.5, borderColor: "#e0e0e0", padding: 13, fontSize: 14, color: "#333", marginBottom: 12 },
  fieldTextarea: { minHeight: 80, textAlignVertical: "top" },
});