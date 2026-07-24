import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Linking,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { auth, database } from "../lib/firebase";
import { ref, push, set } from "firebase/database";

// ── Contact channels ─────────────────────────────────────────────────────
// Swap these for the real support inbox / WhatsApp line before release.
const SUPPORT_EMAIL = "support@compass-unilag.app";
const SUPPORT_WHATSAPP = "2348000000000"; // international format, no leading +

const FAQS = [
  {
    q: "How do I get directions to a building?",
    a: "Open Campus Directory, Cafeterias, or Events from the Account tab, tap any location, and hit \"Get Directions\" — it'll drop a pin and route on the Home map.",
  },
  {
    q: "Why can't I see a location I submitted?",
    a: "Submitted locations go through admin review first. Check Submit a Location on your Account tab — your submission's status (Under Review, Approved, Declined) shows there.",
  },
  {
    q: "How do I share my location with friends?",
    a: "Location-sharing with friends can be toggled from the Friends tab on Home.",
  },
  {
    q: "I found/lost an item on campus — what do I do?",
    a: "Use Lost & Found on your Account tab to report a lost item or search items others have found.",
  },
  {
    q: "How do I update my profile details?",
    a: "Go to Account, tap \"Edit\" at the top of your profile, update your details, then tap \"Save\".",
  },
];

export default function HelpSupportScreen() {
  const router = useRouter();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function openEmail() {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Compass App Support")}`);
  }

  function openWhatsApp() {
    Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}`);
  }

  async function handleSendFeedback() {
    setError("");
    if (!message.trim()) {
      setError("Please write a message first.");
      return;
    }
    setSending(true);
    try {
      const user = auth.currentUser;
      const newRef = push(ref(database, "supportMessages"));
      await set(newRef, {
        message: message.trim(),
        userId: user?.uid ?? null,
        userEmail: user?.email ?? null,
        submittedAt: Date.now(),
        status: "open",
      });
      setMessage("");
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    } catch (e: any) {
      setError(e.message || "Couldn't send your message. Try again.");
    }
    setSending(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Quick contact */}
        <View style={styles.contactRow}>
          <TouchableOpacity style={styles.contactBtn} onPress={openEmail} activeOpacity={0.8}>
            <Text style={styles.contactBtnIcon}>✉️</Text>
            <Text style={styles.contactBtnText}>Email Us</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.contactBtn, styles.contactBtnWhatsapp]} onPress={openWhatsApp} activeOpacity={0.8}>
            <Text style={styles.contactBtnIcon}>💬</Text>
            <Text style={styles.contactBtnText}>WhatsApp Us</Text>
          </TouchableOpacity>
        </View>

        {/* FAQ */}
        <Text style={styles.sectionTitle}>FREQUENTLY ASKED</Text>
        <View style={styles.faqList}>
          {FAQS.map((item, i) => {
            const open = openIdx === i;
            return (
              <TouchableOpacity
                key={item.q}
                style={styles.faqCard}
                activeOpacity={0.8}
                onPress={() => setOpenIdx(open ? null : i)}
              >
                <View style={styles.faqQRow}>
                  <Text style={styles.faqQ}>{item.q}</Text>
                  <Text style={styles.faqChevron}>{open ? "▲" : "▼"}</Text>
                </View>
                {open && <Text style={styles.faqA}>{item.a}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Feedback form */}
        <Text style={styles.sectionTitle}>SEND US A MESSAGE</Text>
        <View style={styles.feedbackCard}>
          {sent && (
            <View style={styles.successBox}>
              <Text style={styles.successText}>✅ Message sent — we'll get back to you.</Text>
            </View>
          )}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}
          <TextInput
            style={styles.feedbackInput}
            placeholder="Describe your issue, bug, or suggestion…"
            placeholderTextColor="#aaa"
            value={message}
            onChangeText={(t) => { setMessage(t); setError(""); }}
            multiline
            numberOfLines={5}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSendFeedback} disabled={sending}>
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Send Message</Text>}
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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

  contactRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  contactBtn: {
    flex: 1,
    backgroundColor: "#1a5c38",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    gap: 6,
  },
  contactBtnWhatsapp: { backgroundColor: "#25D366" },
  contactBtnIcon: { fontSize: 22 },
  contactBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#999",
    letterSpacing: 1,
    marginBottom: 10,
  },

  faqList: { marginBottom: 24 },
  faqCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  faqQRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  faqQ: { flex: 1, fontSize: 14, fontWeight: "600", color: "#222", marginRight: 10 },
  faqChevron: { fontSize: 11, color: "#999" },
  faqA: { fontSize: 13, color: "#666", lineHeight: 19, marginTop: 10 },

  feedbackCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  successBox: { backgroundColor: "#f0fff4", borderWidth: 1, borderColor: "#99eebb", borderRadius: 8, padding: 12, marginBottom: 14 },
  successText: { color: "#1a5c38", fontSize: 13, textAlign: "center" },
  errorBox: { backgroundColor: "#fff0f0", borderWidth: 1, borderColor: "#ffcccc", borderRadius: 8, padding: 12, marginBottom: 14 },
  errorText: { color: "#cc0000", fontSize: 13, textAlign: "center" },
  feedbackInput: {
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    padding: 13,
    fontSize: 14,
    color: "#333",
    minHeight: 110,
    textAlignVertical: "top",
    marginBottom: 14,
  },
  sendBtn: { backgroundColor: "#1a5c38", borderRadius: 10, padding: 14, alignItems: "center" },
  sendBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});