/**
 * ServicesTab.tsx
 * Campus Service Directory for CampusNav
 *
 * HOW IT WORKS:
 *  - New listings go live immediately with a 30-day FREE trial (isTrial: true)
 *  - After the trial ends, the listing hides until the provider pays ₦1,000/month
 *  - Listing auto-hides when expiresAt < Date.now()
 *  - Viewers browse & contact providers externally (call / WhatsApp) or get
 *    walking directions if the provider added a campus GPS location
 *  - No in-app booking or payments between users
 *
 * FIREBASE NODES USED:
 *  /services/{serviceId}   — all listings (active & inactive)
 *  /subscriptions/{userId} — subscription/payment records
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ExpoLocation from "expo-location";
import { onValue, push, ref, remove, set, update } from "firebase/database";
import { auth, database } from "../lib/firebase"; // adjust path if needed
import { router } from "expo-router";

// ─── Theme ──────────────────────────────────────────────────────────────────
const GREEN = "#1a5c38";
const GREEN_BRIGHT = "#2ECC71";
const GREEN_TINT = "#EAF6EE";
const BG = "#F5F7F5";

// ─── Types ──────────────────────────────────────────────────────────────────
export interface ServiceListing {
  id: string;
  userId: string;
  providerName: string;
  name: string;
  category: string;
  description: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  location: string; // human-readable, e.g. "Near Moremi Hall, Akoka"
  latitude?: number | null;
  longitude?: number | null;
  active: boolean;
  isTrial?: boolean;
  expiresAt: number;
  createdAt: number;
  rating?: number;
  ratingCount?: number;
  verified?: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────
const SUBSCRIPTION_FEE = 1000; // ₦1,000/month after the free trial
const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days free
const SUBSCRIPTION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days per paid cycle

export const SERVICE_CATEGORIES = [
  { key: "all",            icon: "🛍️", label: "All" },
  { key: "food",           icon: "🍽️", label: "Food" },
  { key: "laundry",        icon: "👕", label: "Laundry" },
  { key: "printing",       icon: "🖨️", label: "Printing" },
  { key: "barber",         icon: "💈", label: "Barber" },
  { key: "phone_repair",   icon: "📱", label: "Phone Repair" },
  { key: "laptop_repair",  icon: "💻", label: "Laptop Repair" },
  { key: "tutors",         icon: "📚", label: "Tutors" },
  { key: "photography",    icon: "📸", label: "Photography" },
  { key: "delivery",       icon: "🚚", label: "Delivery" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
function daysLeft(expiresAt: number): number {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24)));
}

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
function normalizePhone(raw: string): string {
  const num = raw.replace(/\D/g, "");
  return num.startsWith("234") ? num : `234${num.replace(/^0/, "")}`;
}

// ─── Service Card ───────────────────────────────────────────────────────────
function ServiceCard({ service, distanceM }: { service: ServiceListing; distanceM: number | null }) {
  const cat = SERVICE_CATEGORIES.find((c) => c.key === service.category);

  function openWhatsApp() {
    Linking.openURL(`https://wa.me/${normalizePhone(service.whatsapp)}`).catch(() =>
      Alert.alert("Error", "Could not open WhatsApp.")
    );
  }
  function openCall() {
    Linking.openURL(`tel:${service.phone}`).catch(() => Alert.alert("Error", "Could not make a call."));
  }
  function openDirections() {
    if (service.latitude == null || service.longitude == null) {
      Alert.alert("No location set", "This business hasn't added a campus GPS location yet.");
      return;
    }
    router.push({
      pathname: "/home",
      params: {
        eventLat: service.latitude,
        eventLng: service.longitude,
        eventName: service.name,
        eventIcon: cat?.icon ?? "🛍️",
        eventDesc: service.description || "",
      },
    });
  }

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.top}>
        <View style={cardStyles.logoCircle}>
          <Text style={cardStyles.logoEmoji}>{cat?.icon ?? "🛍️"}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={cardStyles.nameRow}>
            <Text style={cardStyles.name} numberOfLines={1}>{service.name}</Text>
            {service.verified && (
              <View style={cardStyles.verifiedBadge}>
                <Text style={cardStyles.verifiedText}>✓ Verified</Text>
              </View>
            )}
          </View>
          <Text style={cardStyles.category}>{cat?.label ?? service.category}</Text>
        </View>
      </View>

      <Text style={cardStyles.desc} numberOfLines={1}>{service.description}</Text>

      <View style={cardStyles.metaRow}>
        {typeof service.rating === "number" && (
          <View style={cardStyles.metaPill}>
            <Text style={cardStyles.metaPillText}>
              ⭐ {service.rating.toFixed(1)}{service.ratingCount ? ` (${service.ratingCount})` : ""}
            </Text>
          </View>
        )}
        {distanceM != null ? (
          <View style={cardStyles.metaPill}>
            <Text style={cardStyles.metaPillText}>📍 {formatDistance(distanceM)}</Text>
          </View>
        ) : service.location ? (
          <View style={cardStyles.metaPill}>
            <Text style={cardStyles.metaPillText} numberOfLines={1}>📍 {service.location}</Text>
          </View>
        ) : null}
      </View>

      <View style={cardStyles.actions}>
        <TouchableOpacity
          style={[cardStyles.iconBtn, !service.whatsapp && cardStyles.iconBtnDisabled]}
          onPress={openWhatsApp}
          disabled={!service.whatsapp}
        >
          <Text style={cardStyles.iconBtnText}>💬</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[cardStyles.iconBtn, !service.phone && cardStyles.iconBtnDisabled]}
          onPress={openCall}
          disabled={!service.phone}
        >
          <Text style={cardStyles.iconBtnText}>📞</Text>
        </TouchableOpacity>
        <TouchableOpacity style={cardStyles.directionsBtn} onPress={openDirections} activeOpacity={0.85}>
          <Text style={cardStyles.directionsBtnText}>🧭 Directions</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  top: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 12 },
  logoCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: GREEN_TINT,
    justifyContent: "center", alignItems: "center",
  },
  logoEmoji: { fontSize: 22 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 16, fontWeight: "700", color: "#1a1a1a", flexShrink: 1 },
  category: { fontSize: 12.5, color: "#8a938a", marginTop: 2, fontWeight: "500" },
  verifiedBadge: { backgroundColor: GREEN_TINT, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  verifiedText: { fontSize: 10.5, fontWeight: "700", color: GREEN },
  desc: { fontSize: 13.5, color: "#666", lineHeight: 19, marginBottom: 10 },
  metaRow: { flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  metaPill: { backgroundColor: "#F3F5F3", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 200 },
  metaPillText: { fontSize: 12, fontWeight: "600", color: "#556155" },
  actions: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#F3F5F3",
    alignItems: "center", justifyContent: "center",
  },
  iconBtnDisabled: { opacity: 0.35 },
  iconBtnText: { fontSize: 18 },
  directionsBtn: { flex: 1, backgroundColor: GREEN, borderRadius: 21, paddingVertical: 11, alignItems: "center" },
  directionsBtnText: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
});

// ─── Listing Form Modal ─────────────────────────────────────────────────────
function ListingFormModal({
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
      setCoords(
        existing.latitude != null && existing.longitude != null
          ? { lat: existing.latitude, lng: existing.longitude }
          : null
      );
    } else {
      setForm({ name: "", category: "food", description: "", phone: "", whatsapp: "", instagram: "", location: "" });
      setCoords(null);
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
      updatedAt: Date.now(),
    };

    try {
      const isNew = !existing;
      if (existing) {
        // Edit existing listing — preserve active/expiresAt/trial status
        await update(ref(database, `services/${existing.id}`), payload);
      } else {
        // New listing — goes live immediately with a 30-day free trial
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
          <View style={formStyles.errorBox}>
            <Text style={formStyles.errorText}>⚠️ {error}</Text>
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
            <TouchableOpacity
              key={cat.key}
              style={[formStyles.chip, form.category === cat.key && formStyles.chipActive]}
              onPress={() => setForm((p) => ({ ...p, category: cat.key }))}
            >
              <Text style={formStyles.chipIcon}>{cat.icon}</Text>
              <Text style={[formStyles.chipText, form.category === cat.key && formStyles.chipTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
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
          ) : (
            <Text style={formStyles.gpsBtnIcon}>📡</Text>
          )}
          <View style={{ flex: 1 }}>
            <Text style={formStyles.gpsBtnTitle}>
              {coords ? "Location captured ✓" : "Use My Current Location"}
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
          <Text style={formStyles.noticeTitle}>💡 How it works</Text>
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
  chip: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: "#ddd", backgroundColor: "#fff", marginRight: 8, gap: 5,
  },
  chipActive: { backgroundColor: GREEN, borderColor: GREEN },
  chipIcon: { fontSize: 14 },
  chipText: { fontSize: 12, fontWeight: "600", color: "#555" },
  chipTextActive: { color: "#fff" },
  gpsBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#f0f7f3", borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: "#c8e6d4", marginBottom: 8,
  },
  gpsBtnIcon: { fontSize: 20 },
  gpsBtnTitle: { fontSize: 14, fontWeight: "600", color: GREEN },
  gpsBtnCoords: { fontSize: 11, color: "#4a8c63", marginTop: 2 },
  gpsNote: { fontSize: 12, color: "#888", marginBottom: 12, lineHeight: 17 },
  noticeBox: { backgroundColor: GREEN_TINT, borderRadius: 12, borderWidth: 1.5, borderColor: "#c8e6d4", padding: 14, marginTop: 8 },
  noticeTitle: { fontSize: 14, fontWeight: "700", color: GREEN, marginBottom: 6 },
  noticeText: { fontSize: 13, color: "#2d6a4f", lineHeight: 19 },
});

// ─── My Listing Panel ───────────────────────────────────────────────────────
function MyListingPanel({
  myService, onEdit, onDelete, onActivate,
}: {
  myService: ServiceListing | null;
  onEdit: () => void;
  onDelete: () => void;
  onActivate: () => void;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  if (!myService) {
    return (
      <View style={myStyles.emptyWrap}>
        <Text style={myStyles.emptyIcon}>🛍️</Text>
        <Text style={myStyles.emptyTitle}>No listing yet</Text>
        <Text style={myStyles.emptyDesc}>
          Get discovered by hundreds of students on campus.{"\n"}
          Free for your first 30 days.
        </Text>
      </View>
    );
  }

  const isActive = myService.active && myService.expiresAt > Date.now();
  const onTrial = !!myService.isTrial && isActive;
  const days = daysLeft(myService.expiresAt);
  const expiringSoon = isActive && days <= 5;

  return (
    <View style={myStyles.card}>
      <View style={myStyles.statusRow}>
        <View style={[myStyles.statusDot, { backgroundColor: isActive ? GREEN_BRIGHT : "#ef4444" }]} />
        <Text style={[myStyles.statusText, { color: isActive ? "#15803d" : "#dc2626" }]}>
          {isActive
            ? onTrial
              ? `Free trial · ${days} day${days !== 1 ? "s" : ""} left`
              : `Active · ${days} day${days !== 1 ? "s" : ""} left`
            : "Inactive — not visible to students"}
        </Text>
      </View>

      {expiringSoon && (
        <View style={myStyles.warningBox}>
          <Text style={myStyles.warningText}>
            ⚠️ {onTrial ? "Trial ending soon!" : "Expiring soon!"} Renew to stay visible.
          </Text>
        </View>
      )}

      <Text style={myStyles.listingName}>{myService.name}</Text>
      <Text style={myStyles.listingCat}>
        {SERVICE_CATEGORIES.find((c) => c.key === myService.category)?.icon}{" "}
        {SERVICE_CATEGORIES.find((c) => c.key === myService.category)?.label}
      </Text>
      <Text style={myStyles.listingDesc} numberOfLines={2}>{myService.description}</Text>

      <View style={myStyles.actions}>
        <TouchableOpacity style={myStyles.editBtn} onPress={onEdit}>
          <Text style={myStyles.editBtnText}>✏️ Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={myStyles.deleteBtn} onPress={onDelete}>
          <Text style={myStyles.deleteBtnText}>🗑️</Text>
        </TouchableOpacity>
      </View>

      {!isActive && (
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity style={myStyles.payBtn} onPress={onActivate} activeOpacity={0.85}>
            <Text style={myStyles.payBtnText}>
              🔄 Renew — ₦{SUBSCRIPTION_FEE.toLocaleString()}/month
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <Text style={myStyles.payNote}>
        {isActive
          ? onTrial
            ? "Enjoy your free trial! You'll be able to renew once it ends."
            : "Your subscription renews every 30 days."
          : `Payment reactivates your listing for 30 days. Transfer ₦${SUBSCRIPTION_FEE.toLocaleString()} to confirm.`}
      </Text>
    </View>
  );
}

const myStyles = StyleSheet.create({
  emptyWrap: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 52, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#222", marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 21 },
  card: {
    backgroundColor: "#fff", borderRadius: 20, padding: 18, marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  statusRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 13, fontWeight: "700" },
  warningBox: { backgroundColor: "#FEF3C7", borderRadius: 8, borderWidth: 1, borderColor: "#FCD34D", padding: 10, marginBottom: 12 },
  warningText: { color: "#92400E", fontSize: 12, fontWeight: "600" },
  listingName: { fontSize: 18, fontWeight: "800", color: "#1a1a1a", marginBottom: 4 },
  listingCat: { fontSize: 13, color: "#666", marginBottom: 6 },
  listingDesc: { fontSize: 13, color: "#888", lineHeight: 18, marginBottom: 14 },
  actions: { flexDirection: "row", gap: 10, marginBottom: 14 },
  editBtn: { flex: 1, backgroundColor: GREEN_TINT, borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1.5, borderColor: "#c8e6d4" },
  editBtnText: { color: GREEN, fontSize: 14, fontWeight: "700" },
  deleteBtn: { backgroundColor: "#fff1f1", borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1.5, borderColor: "#ffd5d5", width: 48 },
  deleteBtnText: { fontSize: 18 },
  payBtn: { backgroundColor: GREEN, borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 10 },
  payBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  payNote: { fontSize: 11, color: "#aaa", textAlign: "center", lineHeight: 16 },
});

// ─── Payment Modal ──────────────────────────────────────────────────────────
function PaymentModal({
  visible, serviceId, userId, onClose, onSuccess,
}: {
  visible: boolean;
  serviceId: string;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [processing, setProcessing] = useState(false);

  async function handlePay() {
    setProcessing(true);
    Alert.alert(
      "Complete Payment",
      `Transfer ₦${SUBSCRIPTION_FEE} to our account:\n\nBank: First Bank\nAcc No: 1234567890\nName: CampusNav Services\n\nThen tap "I've Paid" to notify admin.`,
      [
        { text: "Cancel", style: "cancel", onPress: () => setProcessing(false) },
        {
          text: "I've Paid",
          onPress: async () => {
            const now = Date.now();
            const expiresAt = now + SUBSCRIPTION_DURATION_MS;
            try {
              await update(ref(database, `services/${serviceId}`), {
                active: true,
                isTrial: false,
                expiresAt,
              });
              await set(ref(database, `subscriptions/${userId}`), {
                serviceId, status: "active", paidAt: now, expiresAt, amount: SUBSCRIPTION_FEE,
              });
              setProcessing(false);
              onSuccess();
              onClose();
              Alert.alert("✅ Listing Activated!", "Your service is now visible to all students for 30 days.");
            } catch (e: any) {
              Alert.alert("Error", e.message);
              setProcessing(false);
            }
          },
        },
      ]
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={payStyles.container}>
        <View style={payStyles.handle} />
        <Text style={payStyles.title}>Renew Your Listing</Text>
        <Text style={payStyles.subtitle}>Be visible to students for 30 more days</Text>

        <View style={payStyles.priceBox}>
          <Text style={payStyles.priceLabel}>Monthly subscription</Text>
          <Text style={payStyles.price}>₦{SUBSCRIPTION_FEE.toLocaleString()}</Text>
          <Text style={payStyles.priceSub}>Renews every 30 days · Cancel anytime</Text>
        </View>

        <View style={payStyles.benefitsList}>
          {[
            "✅ Visible to all UNILAG students",
            "✅ Searchable by service category",
            "✅ Direct WhatsApp & call buttons on your card",
            "✅ Walking directions if you add a GPS spot",
            "✅ Auto-hidden if you don't renew",
          ].map((b, i) => (
            <Text key={i} style={payStyles.benefit}>{b}</Text>
          ))}
        </View>

        <TouchableOpacity style={[payStyles.payBtn, processing && { opacity: 0.6 }]} onPress={handlePay} disabled={processing}>
          {processing ? <ActivityIndicator color="#fff" /> : <Text style={payStyles.payBtnText}>⚡ Pay ₦{SUBSCRIPTION_FEE.toLocaleString()} & Activate</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={payStyles.cancelBtn} onPress={onClose}>
          <Text style={payStyles.cancelBtnText}>Not now</Text>
        </TouchableOpacity>

        <Text style={payStyles.footnote}>Secure payment · ₦{SUBSCRIPTION_FEE.toLocaleString()}/30 days</Text>
      </View>
    </Modal>
  );
}

const payStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 24, alignItems: "center", paddingTop: 16 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#ddd", marginBottom: 24 },
  title: { fontSize: 22, fontWeight: "800", color: "#1a1a1a", marginBottom: 6 },
  subtitle: { fontSize: 15, color: "#888", marginBottom: 24 },
  priceBox: { backgroundColor: "#f0f7f3", borderRadius: 16, borderWidth: 2, borderColor: "#c8e6d4", padding: 20, alignItems: "center", width: "100%", marginBottom: 20 },
  priceLabel: { fontSize: 13, color: "#4a8c63", fontWeight: "600", marginBottom: 6 },
  price: { fontSize: 40, fontWeight: "900", color: GREEN, marginBottom: 4 },
  priceSub: { fontSize: 12, color: "#888" },
  benefitsList: { width: "100%", marginBottom: 28, gap: 10 },
  benefit: { fontSize: 14, color: "#333", fontWeight: "500" },
  payBtn: { backgroundColor: GREEN, borderRadius: 16, padding: 18, width: "100%", alignItems: "center", marginBottom: 12 },
  payBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  cancelBtn: { padding: 12 },
  cancelBtnText: { color: "#888", fontSize: 14 },
  footnote: { fontSize: 11, color: "#bbb", marginTop: 12, textAlign: "center" },
});

// ─── MAIN SERVICES TAB ──────────────────────────────────────────────────────
export default function ServicesTab({ userId, userName }: { userId: string; userName: string }) {
  const [view, setView] = useState<"browse" | "mine">("browse");
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [myService, setMyService] = useState<ServiceListing | null>(null);
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  // Quietly grab the user's location for "distance from you" — never blocks the UI.
  useEffect(() => {
    (async () => {
      try {
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
        setUserLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        /* silent — cards just fall back to the text location */
      }
    })();
  }, []);

  useEffect(() => {
    const unsub = onValue(ref(database, "services"), (snap) => {
      const data = snap.val() || {};
      const now = Date.now();
      const all: ServiceListing[] = Object.entries(data)
        .map(([id, v]: any) => ({ id, ...v }))
        .filter((s: ServiceListing) => {
          if (s.userId === userId) return true; // always show my own listing
          return s.active && s.expiresAt > now;
        });

      setMyService(all.find((s) => s.userId === userId) ?? null);

      const publicList = all
        .filter((s) => s.userId !== userId && s.active && s.expiresAt > now)
        .sort((a, b) => b.createdAt - a.createdAt);

      setServices(publicList);
      setLoading(false);
    });
    return () => unsub();
  }, [userId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const withDistance = services
      .filter((s) => {
        const matchCat = filterCat === "all" || s.category === filterCat;
        const matchSearch =
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.location.toLowerCase().includes(q) ||
          SERVICE_CATEGORIES.find((c) => c.key === s.category)?.label.toLowerCase().includes(q);
        return matchCat && matchSearch;
      })
      .map((s) => ({
        service: s,
        distance:
          userLoc && s.latitude != null && s.longitude != null
            ? getDistanceMeters(userLoc.lat, userLoc.lng, s.latitude, s.longitude)
            : null,
      }));

    withDistance.sort((a, b) => {
      if (a.distance != null && b.distance != null) return a.distance - b.distance;
      if (a.distance != null) return -1;
      if (b.distance != null) return 1;
      return (b.service.rating ?? 0) - (a.service.rating ?? 0);
    });

    return withDistance;
  }, [services, filterCat, search, userLoc]);

  function handleDeleteListing() {
    Alert.alert("Delete Listing", "This will permanently remove your listing.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!myService) return;
          await remove(ref(database, `services/${myService.id}`));
          await remove(ref(database, `subscriptions/${userId}`));
        },
      },
    ]);
  }

  return (
    <View style={tabStyles.root}>
      <ScrollView
        style={tabStyles.list}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <Text style={tabStyles.pageTitle}>Campus Services</Text>

        {/* ── View toggle ── */}
        <View style={tabStyles.toggleRow}>
          <TouchableOpacity
            style={[tabStyles.toggleBtn, view === "browse" && tabStyles.toggleBtnActive]}
            onPress={() => setView("browse")}
          >
            <Text style={[tabStyles.toggleText, view === "browse" && tabStyles.toggleTextActive]}>
              🔍 Browse Services
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[tabStyles.toggleBtn, view === "mine" && tabStyles.toggleBtnActive]}
            onPress={() => setView("mine")}
          >
            <Text style={[tabStyles.toggleText, view === "mine" && tabStyles.toggleTextActive]}>
              📋 My Listing
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── BROWSE VIEW ── */}
        {view === "browse" && (
          <>
            <View style={tabStyles.searchBar}>
              <Text style={tabStyles.searchIcon}>🔍</Text>
              <TextInput
                style={tabStyles.searchInput}
                placeholder="Search food, laundry, barber, tutors…"
                placeholderTextColor="#9aa39a"
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
                onSubmitEditing={Keyboard.dismiss}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                  <Text style={tabStyles.clearText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={tabStyles.chipRow}
              contentContainerStyle={{ paddingRight: 8 }}
              keyboardShouldPersistTaps="handled"
            >
              {SERVICE_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[tabStyles.chip, filterCat === cat.key && tabStyles.chipActive]}
                  onPress={() => setFilterCat(cat.key)}
                >
                  <Text style={tabStyles.chipIcon}>{cat.icon}</Text>
                  <Text style={[tabStyles.chipText, filterCat === cat.key && tabStyles.chipTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {loading ? (
              <ActivityIndicator color={GREEN} size="large" style={{ marginTop: 40 }} />
            ) : filtered.length === 0 ? (
              <View style={tabStyles.emptyState}>
                <Text style={tabStyles.emptyIcon}>🔍</Text>
                <Text style={tabStyles.emptyTitle}>No services found</Text>
                <Text style={tabStyles.emptySub}>
                  {search ? `No results for "${search}"` : "No services in this category yet."}
                </Text>
              </View>
            ) : (
              filtered.map(({ service, distance }) => (
                <ServiceCard key={service.id} service={service} distanceM={distance} />
              ))
            )}

            {/* ── CTA ── */}
            <View style={tabStyles.ctaCard}>
              <Text style={tabStyles.ctaHeadline}>Own a Business on Campus?</Text>
              <Text style={tabStyles.ctaBody}>
                List your business FREE for 30 days so students can discover your services.
                After the free trial, continue your listing for only ₦1,000 per month.
              </Text>
              <TouchableOpacity
                style={tabStyles.ctaBtn}
                activeOpacity={0.85}
                onPress={() => {
                  setView("mine");
                  if (!myService) setShowForm(true);
                }}
              >
                <Text style={tabStyles.ctaBtnText}>List Your Business</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── MY LISTING VIEW ── */}
        {view === "mine" && (
          <>
            <MyListingPanel
              myService={myService}
              onEdit={() => setShowForm(true)}
              onDelete={handleDeleteListing}
              onActivate={() => setShowPayment(true)}
            />

            {!myService && (
              <TouchableOpacity style={tabStyles.createBtn} onPress={() => setShowForm(true)}>
                <Text style={tabStyles.createBtnText}>➕ Create My Listing</Text>
              </TouchableOpacity>
            )}

            <Text style={tabStyles.helpText}>
              Questions? Contact us via WhatsApp for listing support.
            </Text>
          </>
        )}
      </ScrollView>

      {/* ── MODALS ── */}
      <ListingFormModal
        visible={showForm}
        existing={myService}
        userName={userName}
        onClose={() => setShowForm(false)}
        onSaved={(isNew) => {
          if (isNew) {
            setTimeout(() => {
              Alert.alert(
                "You're Live! 🎉",
                "Your listing is now visible to students for a free 30-day trial."
              );
            }, 400);
          }
        }}
      />

      {myService && (
        <PaymentModal
          visible={showPayment}
          serviceId={myService.id}
          userId={userId}
          onClose={() => setShowPayment(false)}
          onSuccess={() => setShowPayment(false)}
        />
      )}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  list: { flex: 1, paddingHorizontal: 16 },
  pageTitle: { fontSize: 26, fontWeight: "800", color: "#1a1a1a", marginTop: 18, marginBottom: 14 },

  toggleRow: {
    flexDirection: "row", backgroundColor: "#eef1ee", borderRadius: 14, padding: 4, marginBottom: 16,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: "center" },
  toggleBtnActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 5, elevation: 2 },
  toggleText: { fontSize: 13, fontWeight: "600", color: "#888" },
  toggleTextActive: { color: GREEN, fontWeight: "800" },

  searchBar: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 12 : 4,
    borderWidth: 1, borderColor: "#e9ede9",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
    marginBottom: 14, gap: 10,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, color: "#1a1a1a" },
  clearText: { fontSize: 14, color: "#9aa39a", paddingHorizontal: 4 },

  chipRow: { marginBottom: 18 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1.5, borderColor: "#e2e8e2", backgroundColor: "#fff", marginRight: 8,
  },
  chipActive: { backgroundColor: GREEN, borderColor: GREEN },
  chipIcon: { fontSize: 14 },
  chipText: { fontSize: 13, fontWeight: "600", color: "#556155" },
  chipTextActive: { color: "#fff" },

  emptyState: { alignItems: "center", paddingTop: 50, paddingBottom: 20 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#555", marginBottom: 6 },
  emptySub: { fontSize: 13, color: "#aaa", textAlign: "center" },

  ctaCard: {
    marginTop: 10, backgroundColor: GREEN_TINT, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: "#d3ecd9",
  },
  ctaHeadline: { fontSize: 16.5, fontWeight: "800", color: GREEN, marginBottom: 6 },
  ctaBody: { fontSize: 13, color: "#4c5c4f", lineHeight: 19, marginBottom: 16 },
  ctaBtn: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  ctaBtnText: { color: "#fff", fontSize: 14.5, fontWeight: "700" },

  createBtn: { backgroundColor: GREEN, borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 16 },
  createBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  helpText: { fontSize: 12, color: "#bbb", textAlign: "center", paddingBottom: 20 },
});