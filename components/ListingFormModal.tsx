import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import * as ExpoLocation from "expo-location";
import { push, ref, set, update } from "firebase/database";
import { auth, database } from "../lib/firebase";
import { AlertTriangle, CheckCircle2, Lightbulb, Satellite } from "lucide-react-native";
import { CategoryChip } from "./CategoryChip";
import { PhotoPicker } from "./ServicePhotos";
import {
  GREEN, GREEN_TINT, BG, SUBSCRIPTION_FEE, TRIAL_DURATION_MS,
  ServiceListing, SERVICE_CATEGORIES,
} from "../lib/serviceShared";

export function ListingFormModal({
  visible, existing, userName, onClose, onSaved,
}: {
  visible: boolean;
  existing: ServiceListing | null;
  userName: string;
  onClose: () => void;
  onSaved: (isNew: boolean) => void;
}) {
  const [form, setForm] = useState({
    name: "", category: "food", description: "",
    phone: "", whatsapp: "", instagram: "", location: "",
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photosBusy, setPhotosBusy] = useState(false);

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        category: existing.category,
        description: existing.description,
        phone: existing.phone,
        whatsapp: existing.whatsapp,
        instagram: existing.instagram,
        location: existing.location,
      });
      setPhotos(existing.photos ?? []);
      setCoords(
        existing.latitude != null && existing.longitude != null
          ? { lat: existing.latitude, lng: existing.longitude }
          : null
      );
    } else {
      setForm({ name: "", category: "food", description: "", phone: "", whatsapp: "", instagram: "", location: "" });
      setCoords(null);
      setPhotos([]);
    }
    setError("");
  }, [visible, existing]);

  async function handleGetGPS() {
    setGpsLoading(true);
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Enable location access to add your GPS position.");
        setGpsLoading(false);
        return;
      }
      const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.BestForNavigation });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      setError("Could not get your location. Try again.");
    }
    setGpsLoading(false);
  }

  async function handleSave() {
    setError("");
    if (photosBusy) { setError("Photos are still uploading. Wait a moment."); return; }
    if (!form.name.trim()) { setError("Service name is required."); return; }
    if (!form.description.trim()) { setError("Please add a short description."); return; }
    if (!form.phone.trim() && !form.whatsapp.trim()) {
      setError("Add at least one contact method (phone or WhatsApp).");
      return;
    }

    setSaving(true);
    const user = auth.currentUser;
    if (!user) { setError("You must be logged in."); setSaving(false); return; }

    const payload: any = {
      userId: user.uid,
      providerName: userName || user.email || "Provider",
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim(),
      phone: form.phone.trim(),
      whatsapp: form.whatsapp.trim() || form.phone.trim(),
      instagram: form.instagram.trim(),
      location: form.location.trim(),
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      photos,
      updatedAt: Date.now(),
    };

    try {
      const isNew = !existing;
      if (existing) {
        await update(ref(database, `services/${existing.id}`), payload);
      } else {
        const now = Date.now();
        payload.active = true;
        payload.isTrial = true;
        payload.expiresAt = now + TRIAL_DURATION_MS;
        payload.verified = false;
        payload.createdAt = now;
        await set(push(ref(database, "services")), payload);
      }
      onSaved(isNew);
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to save. Try again.");
    }
    setSaving(false);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={formStyles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={formStyles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={formStyles.title}>{existing ? "Edit Listing" : "New Listing"}</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={GREEN} /> : <Text style={formStyles.save}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={formStyles.body} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        {error ? (
          <View style={[formStyles.errorBox, formStyles.rowBox]}>
            <AlertTriangle size={15} color="#c0392b" strokeWidth={2.2} />
            <Text style={formStyles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={formStyles.label}>Business Name *</Text>
        <TextInput
          style={formStyles.input}
          placeholder="e.g. Kemi's Kitchen / John's Barbing"
          placeholderTextColor="#bbb"
          value={form.name}
          onChangeText={(t) => { setError(""); setForm((p) => ({ ...p, name: t })); }}
        />

        <Text style={formStyles.label}>Category *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {SERVICE_CATEGORIES.filter((c) => c.key !== "all").map((cat) => (
            <CategoryChip
              key={cat.key}
              icon={cat.icon}
              label={cat.label}
              active={form.category === cat.key}
              onPress={() => setForm((p) => ({ ...p, category: cat.key }))}
            />
          ))}
        </ScrollView>

        <Text style={formStyles.label}>Description *</Text>
        <TextInput
          style={[formStyles.input, { minHeight: 80, textAlignVertical: "top" }]}
          placeholder="One line about what you offer"
          placeholderTextColor="#bbb"
          value={form.description}
          onChangeText={(t) => setForm((p) => ({ ...p, description: t }))}
          multiline
          numberOfLines={3}
        />

        <View style={{ marginBottom: 16 }}>
          <PhotoPicker photos={photos} onChange={setPhotos} onUploadingChange={setPhotosBusy} />
        </View>

        <Text style={formStyles.label}>Phone Number</Text>
        <TextInput
          style={formStyles.input}
          placeholder="e.g. 08012345678"
          placeholderTextColor="#bbb"
          value={form.phone}
          onChangeText={(t) => setForm((p) => ({ ...p, phone: t }))}
          keyboardType="phone-pad"
        />

        <Text style={formStyles.label}>WhatsApp Number</Text>
        <TextInput
          style={formStyles.input}
          placeholder="e.g. 08012345678 (can be same as phone)"
          placeholderTextColor="#bbb"
          value={form.whatsapp}
          onChangeText={(t) => setForm((p) => ({ ...p, whatsapp: t }))}
          keyboardType="phone-pad"
        />

        <Text style={formStyles.label}>Instagram (optional)</Text>
        <TextInput
          style={formStyles.input}
          placeholder="@yourhandle"
          placeholderTextColor="#bbb"
          value={form.instagram}
          onChangeText={(t) => setForm((p) => ({ ...p, instagram: t }))}
          autoCapitalize="none"
        />

        <Text style={formStyles.label}>Location description (optional)</Text>
        <TextInput
          style={formStyles.input}
          placeholder="e.g. Near Moremi Hall, Akoka"
          placeholderTextColor="#bbb"
          value={form.location}
          onChangeText={(t) => setForm((p) => ({ ...p, location: t }))}
        />

        <Text style={formStyles.label}>Campus GPS Location (optional)</Text>
        <TouchableOpacity style={formStyles.gpsBtn} onPress={handleGetGPS} disabled={gpsLoading}>
          {gpsLoading ? (
            <ActivityIndicator color={GREEN} size="small" />
          ) : coords ? (
            <CheckCircle2 size={20} color={GREEN} strokeWidth={2.2} />
          ) : (
            <Satellite size={20} color={GREEN} strokeWidth={2.2} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={formStyles.gpsBtnTitle}>
              {coords ? "Location captured" : "Use My Current Location"}
            </Text>
            {coords && (
              <Text style={formStyles.gpsBtnCoords}>{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</Text>
            )}
          </View>
        </TouchableOpacity>
        <Text style={formStyles.gpsNote}>
          Lets students tap "Directions" to walk straight to you. Stand at your spot when capturing.
        </Text>

        <View style={formStyles.noticeBox}>
          <View style={formStyles.rowBox}>
            <Lightbulb size={15} color={GREEN} strokeWidth={2.2} />
            <Text style={formStyles.noticeTitle}>How it works</Text>
          </View>
          <Text style={formStyles.noticeText}>
            {existing
              ? "Editing your listing keeps its current active/trial status — no need to pay again."
              : `Your listing goes live immediately with a FREE 30-day trial. After that, it's just ₦${SUBSCRIPTION_FEE.toLocaleString()}/month to stay visible to students.`}
          </Text>
        </View>
      </ScrollView>
    </Modal>
  );
}

const formStyles = StyleSheet.create({
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee",
    backgroundColor: "#fff", paddingTop: Platform.OS === "ios" ? 20 : 16,
  },
  title: { fontSize: 17, fontWeight: "700", color: "#222" },
  cancel: { color: "#888", fontSize: 15 },
  save: { color: GREEN, fontSize: 15, fontWeight: "700" },
  body: { flex: 1, backgroundColor: BG, padding: 16 },
  errorBox: { backgroundColor: "#fff1f1", borderRadius: 10, borderWidth: 1.5, borderColor: "#f5c2c2", padding: 12, marginBottom: 16 },
  errorText: { color: "#c0392b", fontSize: 13, fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1.5, borderColor: "#e0e0e0",
    padding: 13, fontSize: 14, color: "#333", marginBottom: 12,
  },
  gpsBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#f0f7f3", borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: "#c8e6d4", marginBottom: 8,
  },
  gpsBtnTitle: { fontSize: 14, fontWeight: "600", color: GREEN },
  gpsBtnCoords: { fontSize: 11, color: "#4a8c63", marginTop: 2 },
  gpsNote: { fontSize: 12, color: "#888", marginBottom: 12, lineHeight: 17 },
  noticeBox: { backgroundColor: GREEN_TINT, borderRadius: 12, borderWidth: 1.5, borderColor: "#c8e6d4", padding: 14, marginTop: 8 },
  noticeTitle: { fontSize: 14, fontWeight: "700", color: GREEN },
  noticeText: { fontSize: 13, color: "#2d6a4f", lineHeight: 19, marginTop: 6 },
  rowBox: { flexDirection: "row", alignItems: "center", gap: 6 },
});