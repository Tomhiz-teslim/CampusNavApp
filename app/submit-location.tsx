import { ComponentType, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, ScrollView, ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";
import { auth, database } from "../lib/firebase";
import { ref, onValue, push, set } from "firebase/database";
import { router } from "expo-router";
import { StyledModal, useStyledModal } from "./StyledModal";
import {
  AlertTriangle,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronLeft,
  Clock,
  GraduationCap,
  Home,
  Landmark,
  MapPin,
  Pencil,
  Satellite,
  Stethoscope,
  Trophy,
  Utensils,
  X,
  XCircle,
} from "lucide-react-native";

const SUBMIT_CATEGORIES: {
  key: string;
  label: string;
  Icon: ComponentType<any>;
}[] = [
  { key: "classroom", label: "Classroom", Icon: Building2 },
  { key: "faculty",   label: "Faculty",   Icon: GraduationCap },
  { key: "hostel",    label: "Hostel",    Icon: Home },
  { key: "admin",     label: "Admin",     Icon: Landmark },
  { key: "food",      label: "Food Spot", Icon: Utensils },
  { key: "library",   label: "Library",   Icon: BookOpen },
  { key: "medical",   label: "Medical",   Icon: Stethoscope },
  { key: "sport",     label: "Sport",     Icon: Trophy },
  { key: "other",     label: "Other",     Icon: MapPin },
];

const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; Icon: ComponentType<any> }
> = {
  pending:  { label: "Under Review", color: "#b45309", bg: "#fef3c7", Icon: Clock },
  approved: { label: "Approved",     color: "#166534", bg: "#dcfce7", Icon: CheckCircle2 },
  declined: { label: "Declined",     color: "#991b1b", bg: "#fee2e2", Icon: XCircle },
  rejected: { label: "Declined",     color: "#991b1b", bg: "#fee2e2", Icon: XCircle },
};

export default function SubmitLocationScreen() {
  const { config: modal, alert: showAlert, hideModal } = useStyledModal();

  const [userName, setUserName]           = useState("");
  const [userId, setUserId]               = useState("");
  const [locName, setLocName]             = useState("");
  const [locDesc, setLocDesc]             = useState("");
  const [locCategory, setLocCategory]     = useState("classroom");
  const [locCoords, setLocCoords]         = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading]       = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    setUserId(user.uid);

    const unsubUser = onValue(ref(database, `users/${user.uid}`), (snap) => {
      const d = snap.val();
      if (d) setUserName(d.fullName || d.name || "");
    });

    // ── Listen to pendingLocations (pending + declined items) ─────────────
    let pendingMine: any[] = [];
    let approvedMine: any[] = [];

    function mergeAndSet() {
      // Merge both lists, deduplicate by originalId (approved items carry the
      // pendingLocations key as their id), sort newest first.
      const merged = [
        ...approvedMine,
        // Only show pending/declined items that haven't moved to approved yet
        ...pendingMine.filter(
          (p) => !approvedMine.some((a) => a.originalId === p.id || a.id === p.id)
        ),
      ].sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
      setMySubmissions(merged);
    }

   const unsubPending = onValue(ref(database, "pendingLocations"), (snap) => {
      const data = snap.val() || {};
      pendingMine = Object.entries(data)
        .filter(([, v]: any) => v.submittedBy === user.uid)
        .map(([id, v]: any) => ({
          id,
          ...v,
          status: v.status || "pending",
        }));
      mergeAndSet();
    });

    const unsubApproved = onValue(ref(database, "approvedLocations"), (snap) => {
      const data = snap.val() || {};
      approvedMine = Object.entries(data)
        .filter(([, v]: any) => v.submittedBy === user.uid)
        .map(([id, v]: any) => ({
          id,
          originalId: id,
          ...v,
          status: "approved",
        }));
      mergeAndSet();
    });

    return () => {
      unsubUser();
      unsubPending();
      unsubApproved();
    };
  }, []);

  async function handleGetGPS() {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showAlert("Permission denied", "Enable location access in your device settings.", MapPin);
        setGpsLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      setLocCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      showAlert("Error", "Could not get your location. Try again.", AlertTriangle);
    }
    setGpsLoading(false);
  }

  async function handleSubmit() {
    if (!locName.trim()) {
      showAlert("Missing name", "Please enter a location name.", Pencil);
      return;
    }
    if (!locCoords) {
      showAlert("No coordinates", "Tap 'Use My Current Location' first.", MapPin);
      return;
    }

    setSubmitting(true);
    try {
      const newRef = push(ref(database, "pendingLocations"));
      await set(newRef, {
        name:          locName.trim(),
        description:   locDesc.trim(),
        category:      locCategory,
        latitude:      locCoords.lat,
        longitude:     locCoords.lng,
        submittedBy:   userId,
        submitterName: userName,
        status:        "pending",
        submittedAt:   Date.now(),
      });
      setLocName("");
      setLocDesc("");
      setLocCoords(null);
      setLocCategory("classroom");
      showAlert(
        "Submitted!",
        "Your location has been sent for review. It will appear on the map once an admin approves it.",
        CheckCircle2
      );
    } catch {
      showAlert("Error", "Submission failed. Please try again.", AlertTriangle);
    }
    setSubmitting(false);
  }

  return (
    <View style={styles.container}>
      <StyledModal {...modal} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={22} color="#fff" strokeWidth={2.4} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Submit a Location</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Know a spot missing from the map? Walk to it and submit — an admin will review and add it.
        </Text>

        {/* Name */}
        <Text style={styles.fieldLabel}>Location Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Room 101, CS Block"
          placeholderTextColor="#bbb"
          value={locName}
          onChangeText={setLocName}
        />

        {/* Description */}
        <Text style={styles.fieldLabel}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          placeholder="e.g. 2nd floor, opposite the elevator"
          placeholderTextColor="#bbb"
          value={locDesc}
          onChangeText={setLocDesc}
          multiline
          numberOfLines={3}
        />

        {/* Category */}
        <Text style={styles.fieldLabel}>Category *</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.catRow}
          keyboardShouldPersistTaps="handled"
        >
          {SUBMIT_CATEGORIES.map((c) => {
            const active = locCategory === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[styles.catChip, active && styles.catChipActive]}
                onPress={() => setLocCategory(c.key)}
              >
                <c.Icon size={14} color={active ? "#fff" : "#555"} strokeWidth={2.3} />
                <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* GPS */}
        <Text style={styles.fieldLabel}>Your Current Location *</Text>
        <TouchableOpacity style={styles.gpsBtn} onPress={handleGetGPS} disabled={gpsLoading}>
          {gpsLoading ? (
            <ActivityIndicator color="#1a5c38" size="small" />
          ) : locCoords ? (
            <CheckCircle2 size={20} color="#1a5c38" strokeWidth={2.2} />
          ) : (
            <Satellite size={20} color="#1a5c38" strokeWidth={2.2} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.gpsBtnTitle}>
              {locCoords ? "Location captured" : "Use My Current Location"}
            </Text>
            {locCoords && (
              <Text style={styles.gpsBtnCoords}>
                {locCoords.lat.toFixed(5)}, {locCoords.lng.toFixed(5)}
              </Text>
            )}
          </View>
          {locCoords && (
            <TouchableOpacity onPress={() => setLocCoords(null)}>
              <X size={16} color="#999" strokeWidth={2.4} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
        {locCoords && (
          <View style={styles.gpsNoteRow}>
            <MapPin size={12} color="#888" strokeWidth={2.2} />
            <Text style={styles.gpsNote}>
              Make sure you're physically at the spot for best accuracy.
            </Text>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>Submit for Review</Text>
          )}
        </TouchableOpacity>

        {/* My past submissions */}
        {mySubmissions.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>My Submissions</Text>
            {mySubmissions.map((sub) => {
              const meta = STATUS_META[sub.status] || STATUS_META.pending;
              const cat  = SUBMIT_CATEGORIES.find((c) => c.key === sub.category);
              const CatIcon = cat?.Icon || MapPin;
              return (
                <View key={sub.id} style={styles.subCard}>
                  <View style={styles.subIconBox}>
                    <CatIcon size={18} color="#1a5c38" strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subName}>{sub.name}</Text>
                    <Text style={styles.subCat}>{cat?.label || sub.category}</Text>
                    {sub.status === "approved" && (
                      <Text style={styles.subOnMap}>Visible on the map</Text>
                    )}
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                    <meta.Icon size={11} color={meta.color} strokeWidth={2.4} />
                    <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: "#f5f5f5" },
  header:            { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 55, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#1a5c38" },
  backBtn:           { width: 34 },
  headerTitle:       { color: "#fff", fontSize: 18, fontWeight: "bold" },
  content:           { padding: 16 },
  subtitle:          { fontSize: 13, color: "#888", lineHeight: 19, marginBottom: 20, backgroundColor: "#fff", borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: "#1a5c38" },
  fieldLabel:        { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 7, marginTop: 14 },
  input:             { backgroundColor: "#fff", borderRadius: 12, padding: 13, fontSize: 14, color: "#333", borderWidth: 1.5, borderColor: "#eee", shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  inputMulti:        { minHeight: 90, textAlignVertical: "top" },
  catRow:            { marginBottom: 4 },
  catChip:           { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, borderWidth: 1.5, borderColor: "#ddd", backgroundColor: "#fff", paddingHorizontal: 13, paddingVertical: 8, marginRight: 8 },
  catChipActive:     { backgroundColor: "#1a5c38", borderColor: "#1a5c38" },
  catChipText:       { fontSize: 12, fontWeight: "600", color: "#555" },
  catChipTextActive: { color: "#fff" },
  gpsBtn:            { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#f0f7f3", borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: "#c8e6d4" },
  gpsBtnTitle:       { fontSize: 14, fontWeight: "600", color: "#1a5c38" },
  gpsBtnCoords:      { fontSize: 11, color: "#4a8c63", marginTop: 2 },
  gpsNoteRow:        { flexDirection: "row", alignItems: "flex-start", gap: 5, marginTop: 7 },
  gpsNote:           { fontSize: 12, color: "#888", lineHeight: 17, flex: 1 },
  submitBtn:         { backgroundColor: "#1a5c38", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 22, shadowColor: "#1a5c38", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnText:     { color: "#fff", fontSize: 15, fontWeight: "700" },
  historySection:    { marginTop: 28 },
  historyTitle:      { fontSize: 13, fontWeight: "700", color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  subCard:           { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 12, padding: 13, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  subIconBox:        { width: 38, height: 38, borderRadius: 10, backgroundColor: "#f0faf4", justifyContent: "center", alignItems: "center" },
  subName:           { fontSize: 14, fontWeight: "600", color: "#333" },
  subCat:            { fontSize: 12, color: "#888", marginTop: 2 },
  subOnMap:          { fontSize: 11, color: "#166534", marginTop: 3, fontWeight: "600" },
  statusPill:        { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  statusText:        { fontSize: 12, fontWeight: "700" },
});