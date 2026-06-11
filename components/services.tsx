/**
 * ServicesTab.tsx
 * Campus Service Directory for CampusNav
 *
 * HOW IT WORKS:
 *  - Providers pay ₦500/month → listing goes active
 *  - Listing auto-hides when expiresAt < Date.now()
 *  - Viewers browse & contact providers externally (call / WhatsApp)
 *  - No in-app booking or payments between users
 *
 * FIREBASE NODES USED:
 *  /services/{serviceId}  — all listings (active & inactive)
 *  /subscriptions/{userId} — subscription records
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { get, onValue, push, ref, remove, set, update } from "firebase/database";
import { auth, database } from "../lib/firebase"; // adjust path if needed

// ─── Types ────────────────────────────────────────────────────────────────────
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
  location: string;
  active: boolean;
  expiresAt: number;
  createdAt: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SUBSCRIPTION_FEE = 500; // ₦500
const SUBSCRIPTION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const SERVICE_CATEGORIES = [
  { key: "all",     icon: "🛍️", label: "All" },
  { key: "barber",  icon: "💇", label: "Barbing" },
  { key: "tutor",   icon: "📚", label: "Tutoring" },
  { key: "laundry", icon: "👕", label: "Laundry" },
  { key: "food",    icon: "🍱", label: "Food" },
  { key: "design",  icon: "🎨", label: "Design" },
  { key: "tech",    icon: "💻", label: "Tech" },
  { key: "fashion", icon: "👗", label: "Fashion" },
  { key: "other",   icon: "⚡", label: "Other" },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  barber:  { bg: "#EDE9FE", text: "#6D28D9" },
  tutor:   { bg: "#DBEAFE", text: "#1D4ED8" },
  laundry: { bg: "#D1FAE5", text: "#065F46" },
  food:    { bg: "#FEF3C7", text: "#92400E" },
  design:  { bg: "#FCE7F3", text: "#9D174D" },
  tech:    { bg: "#E0F2FE", text: "#0369A1" },
  fashion: { bg: "#FDF4FF", text: "#7E22CE" },
  other:   { bg: "#F3F4F6", text: "#374151" },
};

// ─── Helper ───────────────────────────────────────────────────────────────────
function daysLeft(expiresAt: number): number {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24)));
}

// ─── Service Card ─────────────────────────────────────────────────────────────
function ServiceCard({ service }: { service: ServiceListing }) {
  const cat = SERVICE_CATEGORIES.find(c => c.key === service.category);
  const color = CATEGORY_COLORS[service.category] ?? CATEGORY_COLORS.other;

  function openWhatsApp() {
    const num = service.whatsapp.replace(/\D/g, "");
    const intl = num.startsWith("234") ? num : `234${num.replace(/^0/, "")}`;
    Linking.openURL(`https://wa.me/${intl}`).catch(() =>
      Alert.alert("Error", "Could not open WhatsApp."),
    );
  }

  function openCall() {
    Linking.openURL(`tel:${service.phone}`).catch(() =>
      Alert.alert("Error", "Could not make a call."),
    );
  }

  function openInstagram() {
    const handle = service.instagram.replace("@", "");
    Linking.openURL(`https://instagram.com/${handle}`).catch(() =>
      Alert.alert("Error", "Could not open Instagram."),
    );
  }

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.top}>
        <View style={[cardStyles.iconBox, { backgroundColor: color.bg }]}>
          <Text style={cardStyles.icon}>{cat?.icon ?? "⚡"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.name} numberOfLines={1}>{service.name}</Text>
          <View style={[cardStyles.catPill, { backgroundColor: color.bg }]}>
            <Text style={[cardStyles.catPillText, { color: color.text }]}>
              {cat?.label ?? service.category}
            </Text>
          </View>
        </View>
      </View>

      <Text style={cardStyles.desc} numberOfLines={3}>{service.description}</Text>

      {service.location ? (
        <Text style={cardStyles.location}>📍 {service.location}</Text>
      ) : null}

      <Text style={cardStyles.provider}>By {service.providerName}</Text>

      <View style={cardStyles.actions}>
        {service.phone ? (
          <TouchableOpacity style={cardStyles.callBtn} onPress={openCall}>
            <Text style={cardStyles.callBtnText}>📞 Call</Text>
          </TouchableOpacity>
        ) : null}
        {service.whatsapp ? (
          <TouchableOpacity style={cardStyles.waBtn} onPress={openWhatsApp}>
            <Text style={cardStyles.waBtnText}>💬 WhatsApp</Text>
          </TouchableOpacity>
        ) : null}
        {service.instagram ? (
          <TouchableOpacity style={cardStyles.igBtn} onPress={openInstagram}>
            <Text style={cardStyles.igBtnText}>📸 Instagram</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  top: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 12 },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  icon: { fontSize: 24 },
  name: { fontSize: 15, fontWeight: "800", color: "#1a1a1a", marginBottom: 4 },
  catPill: {
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  catPillText: { fontSize: 11, fontWeight: "700" },
  desc: { fontSize: 13, color: "#555", lineHeight: 19, marginBottom: 8 },
  location: { fontSize: 12, color: "#888", marginBottom: 4 },
  provider: { fontSize: 12, color: "#aaa", marginBottom: 12 },
  actions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  callBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "#1a5c38",
  },
  callBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  waBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "#25D366",
  },
  waBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  igBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "#E1306C",
  },
  igBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});

// ─── Listing Form Modal ───────────────────────────────────────────────────────
function ListingFormModal({
  visible,
  existing,
  userName,
  onClose,
  onSaved,
}: {
  visible: boolean;
  existing: ServiceListing | null;
  userName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    category: "other",
    description: "",
    phone: "",
    whatsapp: "",
    instagram: "",
    location: "",
  });
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
    } else {
      setForm({ name: "", category: "other", description: "", phone: "", whatsapp: "", instagram: "", location: "" });
    }
    setError("");
  }, [visible, existing]);

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
      whatsapp: form.whatsapp.trim(),
      instagram: form.instagram.trim(),
      location: form.location.trim(),
      updatedAt: Date.now(),
    };

    try {
      if (existing) {
        // Edit existing listing — preserve active/expiresAt
        await update(ref(database, `services/${existing.id}`), payload);
      } else {
        // New listing — starts inactive until payment
        payload.active = false;
        payload.expiresAt = 0;
        payload.createdAt = Date.now();
        await set(push(ref(database, "services")), payload);
      }
      onSaved();
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
          {saving ? <ActivityIndicator color="#1a5c38" /> : <Text style={formStyles.save}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={formStyles.body} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        {error ? (
          <View style={formStyles.errorBox}>
            <Text style={formStyles.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        <Text style={formStyles.label}>Service Name *</Text>
        <TextInput
          style={formStyles.input}
          placeholder="e.g. John's Barbing / Maths Tutoring"
          value={form.name}
          onChangeText={t => { setError(""); setForm(p => ({ ...p, name: t })); }}
        />

        <Text style={formStyles.label}>Category *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {SERVICE_CATEGORIES.filter(c => c.key !== "all").map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[formStyles.chip, form.category === cat.key && formStyles.chipActive]}
              onPress={() => setForm(p => ({ ...p, category: cat.key }))}
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
          placeholder="What do you offer? Prices, availability, etc."
          value={form.description}
          onChangeText={t => setForm(p => ({ ...p, description: t }))}
          multiline
          numberOfLines={3}
        />

        <Text style={formStyles.label}>Phone Number</Text>
        <TextInput
          style={formStyles.input}
          placeholder="e.g. 08012345678"
          value={form.phone}
          onChangeText={t => setForm(p => ({ ...p, phone: t }))}
          keyboardType="phone-pad"
        />

        <Text style={formStyles.label}>WhatsApp Number</Text>
        <TextInput
          style={formStyles.input}
          placeholder="e.g. 08012345678 (can be same as phone)"
          value={form.whatsapp}
          onChangeText={t => setForm(p => ({ ...p, whatsapp: t }))}
          keyboardType="phone-pad"
        />

        <Text style={formStyles.label}>Instagram (optional)</Text>
        <TextInput
          style={formStyles.input}
          placeholder="@yourhandle"
          value={form.instagram}
          onChangeText={t => setForm(p => ({ ...p, instagram: t }))}
          autoCapitalize="none"
        />

        <Text style={formStyles.label}>Location (optional)</Text>
        <TextInput
          style={formStyles.input}
          placeholder="e.g. Near Moremi Hall, Akoka"
          value={form.location}
          onChangeText={t => setForm(p => ({ ...p, location: t }))}
        />

        <View style={formStyles.noticeBox}>
          <Text style={formStyles.noticeTitle}>💡 How it works</Text>
          <Text style={formStyles.noticeText}>
            After saving, activate your listing by paying ₦{SUBSCRIPTION_FEE}/month.
            Your listing will be visible to all students for 30 days.
            If you don't renew, it will be hidden automatically.
          </Text>
        </View>
      </ScrollView>
    </Modal>
  );
}

const formStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
    paddingTop: Platform.OS === "ios" ? 20 : 16,
  },
  title: { fontSize: 17, fontWeight: "700", color: "#222" },
  cancel: { color: "#888", fontSize: 15 },
  save: { color: "#1a5c38", fontSize: 15, fontWeight: "700" },
  body: { flex: 1, backgroundColor: "#f5f5f5", padding: 16 },
  errorBox: {
    backgroundColor: "#fff1f1",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#f5c2c2",
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: "#c0392b", fontSize: 13, fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    padding: 13,
    fontSize: 14,
    color: "#333",
    marginBottom: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    marginRight: 8,
    gap: 5,
  },
  chipActive: { backgroundColor: "#1a5c38", borderColor: "#1a5c38" },
  chipIcon: { fontSize: 14 },
  chipText: { fontSize: 12, fontWeight: "600", color: "#555" },
  chipTextActive: { color: "#fff" },
  noticeBox: {
    backgroundColor: "#e8f5ee",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#c8e6d4",
    padding: 14,
    marginTop: 8,
  },
  noticeTitle: { fontSize: 14, fontWeight: "700", color: "#1a5c38", marginBottom: 6 },
  noticeText: { fontSize: 13, color: "#2d6a4f", lineHeight: 19 },
});

// ─── My Listing Panel ─────────────────────────────────────────────────────────
function MyListingPanel({
  myService,
  userName,
  onEdit,
  onDelete,
  onActivate,
}: {
  myService: ServiceListing | null;
  userName: string;
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
      ]),
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
          Just ₦{SUBSCRIPTION_FEE}/month to stay visible.
        </Text>
      </View>
    );
  }

  const isActive = myService.active && myService.expiresAt > Date.now();
  const days = daysLeft(myService.expiresAt);
  const expiringSoon = isActive && days <= 5;

  return (
    <View style={myStyles.card}>
      <View style={myStyles.statusRow}>
        <View style={[myStyles.statusDot, { backgroundColor: isActive ? "#22c55e" : "#ef4444" }]} />
        <Text style={[myStyles.statusText, { color: isActive ? "#15803d" : "#dc2626" }]}>
          {isActive ? `Active · ${days} day${days !== 1 ? "s" : ""} left` : "Inactive — not visible to students"}
        </Text>
      </View>

      {expiringSoon && (
        <View style={myStyles.warningBox}>
          <Text style={myStyles.warningText}>⚠️ Expiring soon! Renew to stay visible.</Text>
        </View>
      )}

      <Text style={myStyles.listingName}>{myService.name}</Text>
      <Text style={myStyles.listingCat}>
        {SERVICE_CATEGORIES.find(c => c.key === myService.category)?.icon}{" "}
        {SERVICE_CATEGORIES.find(c => c.key === myService.category)?.label}
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

      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity style={myStyles.payBtn} onPress={onActivate} activeOpacity={0.85}>
          <Text style={myStyles.payBtnText}>
            {isActive ? "🔄 Renew — ₦500/month" : "⚡ Activate — ₦500/month"}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      <Text style={myStyles.payNote}>
        Payment activates your listing for 30 days. Transfer ₦500 to confirm.
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
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  statusRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 13, fontWeight: "700" },
  warningBox: {
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FCD34D",
    padding: 10,
    marginBottom: 12,
  },
  warningText: { color: "#92400E", fontSize: 12, fontWeight: "600" },
  listingName: { fontSize: 18, fontWeight: "800", color: "#1a1a1a", marginBottom: 4 },
  listingCat: { fontSize: 13, color: "#666", marginBottom: 6 },
  listingDesc: { fontSize: 13, color: "#888", lineHeight: 18, marginBottom: 14 },
  actions: { flexDirection: "row", gap: 10, marginBottom: 14 },
  editBtn: {
    flex: 1,
    backgroundColor: "#e8f5ee",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#c8e6d4",
  },
  editBtnText: { color: "#1a5c38", fontSize: 14, fontWeight: "700" },
  deleteBtn: {
    backgroundColor: "#fff1f1",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#ffd5d5",
    width: 48,
  },
  deleteBtnText: { fontSize: 18 },
  payBtn: {
    backgroundColor: "#1a5c38",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  payBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  payNote: { fontSize: 11, color: "#aaa", textAlign: "center", lineHeight: 16 },
});

// ─── Payment Modal ─────────────────────────────────────────────────────────────
/**
 * PAYMENT INTEGRATION NOTE:
 * Replace this stub with your actual Paystack integration.
 * Recommended: react-native-paystack-webview
 *   npm install react-native-paystack-webview
 *
 * After successful payment:
 *   1. Update /services/{serviceId} → { active: true, expiresAt: now + 30days }
 *   2. Write /subscriptions/{userId} → { status: "active", paidAt, expiresAt, amount: 500 }
 */
function PaymentModal({
  visible,
  serviceId,
  userId,
  userEmail,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  serviceId: string;
  userId: string;
  userEmail: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [processing, setProcessing] = useState(false);

  // ── STUB: replace with real Paystack call ──
  async function handlePay() {
    setProcessing(true);

    /*
    // ── EXAMPLE with react-native-paystack-webview ──
    // You would navigate to a Paystack screen and handle the callback.
    // On success callback:
    */

    // For now we simulate a manual confirmation flow:
    Alert.alert(
      "Complete Payment",
      `Transfer ₦${SUBSCRIPTION_FEE} to our account:\n\nBank: First Bank\nAcc No: 1234567890\nName: CampusNav Services\n\nThen tap "I've Paid" to notify admin.`,
      [
        { text: "Cancel", style: "cancel", onPress: () => setProcessing(false) },
        {
          text: "I've Paid",
          onPress: async () => {
            // Mark as pending admin verification
            // In production, replace with Paystack webhook verification
            const now = Date.now();
            const expiresAt = now + SUBSCRIPTION_DURATION_MS;
            try {
              await update(ref(database, `services/${serviceId}`), {
                active: true, // set to false if you want admin to manually approve
                expiresAt,
              });
              await set(ref(database, `subscriptions/${userId}`), {
                serviceId,
                status: "active",
                paidAt: now,
                expiresAt,
                amount: SUBSCRIPTION_FEE,
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
      ],
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={payStyles.container}>
        <View style={payStyles.handle} />
        <Text style={payStyles.title}>Activate Your Listing</Text>
        <Text style={payStyles.subtitle}>Be visible to students for 30 days</Text>

        <View style={payStyles.priceBox}>
          <Text style={payStyles.priceLabel}>Monthly subscription</Text>
          <Text style={payStyles.price}>₦{SUBSCRIPTION_FEE}</Text>
          <Text style={payStyles.priceSub}>Renews every 30 days · Cancel anytime</Text>
        </View>

        <View style={payStyles.benefitsList}>
          {[
            "✅ Visible to all UNILAG students",
            "✅ Searchable by service category",
            "✅ Direct contact button on your card",
            "✅ Auto-hidden if you don't renew",
          ].map((b, i) => (
            <Text key={i} style={payStyles.benefit}>{b}</Text>
          ))}
        </View>

        <TouchableOpacity
          style={[payStyles.payBtn, processing && { opacity: 0.6 }]}
          onPress={handlePay}
          disabled={processing}
        >
          {processing
            ? <ActivityIndicator color="#fff" />
            : <Text style={payStyles.payBtnText}>⚡ Pay ₦{SUBSCRIPTION_FEE} & Activate</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={payStyles.cancelBtn} onPress={onClose}>
          <Text style={payStyles.cancelBtnText}>Not now</Text>
        </TouchableOpacity>

        <Text style={payStyles.footnote}>
          {/* Replace with your actual Paystack public key integration */}
          Secure payment via Paystack · ₦{SUBSCRIPTION_FEE}/30 days
        </Text>
      </View>
    </Modal>
  );
}

const payStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 24,
    alignItems: "center",
    paddingTop: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ddd",
    marginBottom: 24,
  },
  title: { fontSize: 22, fontWeight: "800", color: "#1a1a1a", marginBottom: 6 },
  subtitle: { fontSize: 15, color: "#888", marginBottom: 24 },
  priceBox: {
    backgroundColor: "#f0f7f3",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#c8e6d4",
    padding: 20,
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  priceLabel: { fontSize: 13, color: "#4a8c63", fontWeight: "600", marginBottom: 6 },
  price: { fontSize: 40, fontWeight: "900", color: "#1a5c38", marginBottom: 4 },
  priceSub: { fontSize: 12, color: "#888" },
  benefitsList: { width: "100%", marginBottom: 28, gap: 10 },
  benefit: { fontSize: 14, color: "#333", fontWeight: "500" },
  payBtn: {
    backgroundColor: "#1a5c38",
    borderRadius: 16,
    padding: 18,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  payBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  cancelBtn: { padding: 12 },
  cancelBtnText: { color: "#888", fontSize: 14 },
  footnote: { fontSize: 11, color: "#bbb", marginTop: 12, textAlign: "center" },
});

// ─── MAIN SERVICES TAB ─────────────────────────────────────────────────────────
/**
 * Main export — plug this directly into HomeScreen.tsx
 * Props:
 *   userId   — from your auth state
 *   userName — from your Firebase user profile
 */
export default function ServicesTab({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [view, setView] = useState<"browse" | "mine">("browse");
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [myService, setMyService] = useState<ServiceListing | null>(null);
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const user = auth.currentUser;

  // ── Load all active services ──
  useEffect(() => {
    const unsub = onValue(ref(database, "services"), snap => {
      const data = snap.val() || {};
      const now = Date.now();
      const all: ServiceListing[] = Object.entries(data)
        .map(([id, v]: any) => ({ id, ...v }))
        .filter((s: ServiceListing) => {
          // My own listing: always include (so I can see/manage it)
          if (s.userId === userId) return true;
          // Others: only show active & not expired
          return s.active && s.expiresAt > now;
        });

      const mine = all.find(s => s.userId === userId) ?? null;
      setMyService(mine);

      // Public list excludes my own (I see it in "My Listing" tab)
      const publicList = all
        .filter(s => s.userId !== userId && s.active && s.expiresAt > now)
        .sort((a, b) => b.createdAt - a.createdAt);

      setServices(publicList);
      setLoading(false);
    });
    return () => unsub();
  }, [userId]);

  // ── Filtered browse list ──
  const filtered = useMemo(() => {
    return services.filter(s => {
      const matchCat = filterCat === "all" || s.category === filterCat;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        s.providerName.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [services, filterCat, search]);

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
          {/* Search */}
          <View style={tabStyles.searchBar}>
            <Text style={tabStyles.searchIcon}>🔍</Text>
            <TextInput
              style={tabStyles.searchInput}
              placeholder="Search services…"
              placeholderTextColor="#999"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              onSubmitEditing={Keyboard.dismiss}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Text style={tabStyles.clearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Category chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={tabStyles.chipRow}
            keyboardShouldPersistTaps="handled"
          >
            {SERVICE_CATEGORIES.map(cat => (
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

          {/* Results count */}
          <Text style={tabStyles.resultCount}>
            {loading ? "Loading…" : `${filtered.length} service${filtered.length !== 1 ? "s" : ""} available`}
          </Text>

          {/* List */}
          <ScrollView
            style={tabStyles.list}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            {loading ? (
              <ActivityIndicator color="#1a5c38" size="large" style={{ marginTop: 40 }} />
            ) : filtered.length === 0 ? (
              <View style={tabStyles.emptyState}>
                <Text style={tabStyles.emptyIcon}>🔍</Text>
                <Text style={tabStyles.emptyTitle}>No services found</Text>
                <Text style={tabStyles.emptySub}>
                  {search ? `No results for "${search}"` : "No services in this category yet."}
                </Text>
              </View>
            ) : (
              filtered.map(s => <ServiceCard key={s.id} service={s} />)
            )}
          </ScrollView>
        </>
      )}

      {/* ── MY LISTING VIEW ── */}
      {view === "mine" && (
        <ScrollView style={tabStyles.list} showsVerticalScrollIndicator={false}>
          <MyListingPanel
            myService={myService}
            userName={userName}
            onEdit={() => setShowForm(true)}
            onDelete={handleDeleteListing}
            onActivate={() => {
              if (!myService) {
                Alert.alert("Save First", "Please save your listing details before activating.");
                return;
              }
              setShowPayment(true);
            }}
          />

          {/* Create listing CTA if none exists */}
          {!myService && (
            <TouchableOpacity style={tabStyles.createBtn} onPress={() => setShowForm(true)}>
              <Text style={tabStyles.createBtnText}>➕ Create My Listing</Text>
            </TouchableOpacity>
          )}

          <Text style={tabStyles.helpText}>
            Questions? Contact us via WhatsApp for listing support.
          </Text>
        </ScrollView>
      )}

      {/* ── MODALS ── */}
      <ListingFormModal
        visible={showForm}
        existing={myService}
        userName={userName}
        onClose={() => setShowForm(false)}
        onSaved={() => {
          // After saving a new listing, prompt to activate
          if (!myService) {
            setTimeout(() => {
              Alert.alert(
                "Listing Saved! 🎉",
                "Your listing is saved but not yet visible. Activate it for ₦500/month.",
                [
                  { text: "Later" },
                  { text: "Activate Now", onPress: () => setShowPayment(true) },
                ],
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
          userEmail={user?.email ?? ""}
          onClose={() => setShowPayment(false)}
          onSuccess={() => setShowPayment(false)}
        />
      )}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  root: { flex: 1 },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
  },
  toggleBtnActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  toggleText: { fontSize: 13, fontWeight: "600", color: "#888" },
  toggleTextActive: { color: "#1a5c38", fontWeight: "800" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: "#333" },
  clearText: { fontSize: 14, color: "#999", paddingHorizontal: 4 },
  chipRow: { marginBottom: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#ddd",
    backgroundColor: "#f5f5f5",
    marginRight: 8,
  },
  chipActive: { backgroundColor: "#1a5c38", borderColor: "#1a5c38" },
  chipIcon: { fontSize: 13 },
  chipText: { fontSize: 12, fontWeight: "600", color: "#555" },
  chipTextActive: { color: "#fff" },
  resultCount: { fontSize: 12, color: "#aaa", marginBottom: 10, textAlign: "center" },
  list: { flex: 1 },
  emptyState: { alignItems: "center", paddingTop: 50 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#555", marginBottom: 6 },
  emptySub: { fontSize: 13, color: "#aaa", textAlign: "center" },
  createBtn: {
    backgroundColor: "#1a5c38",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  createBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  helpText: { fontSize: 12, color: "#bbb", textAlign: "center", paddingBottom: 20 },
});