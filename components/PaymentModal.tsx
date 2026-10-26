import { get, onValue, ref, set, update } from "firebase/database";
import { BellRing, CheckCircle2, Clock, Send } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { database } from "../lib/firebase";
import { sendPush } from "../lib/notifications";
import { GREEN, SUBSCRIPTION_FEE } from "../lib/serviceShared";

const BANK = {
  bank: "Access Bank",
  accountNumber: "1959572440",
  accountName: "Sanusi Oluwatomiwa",
};

const REMIND_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

async function notifyAdmins(title: string, body: string, serviceId: string) {
  try {
    const snap = await get(ref(database, "users"));
    const users = snap.val() || {};
    await Promise.all(
      Object.entries(users)
        .filter(([, u]: any) => u?.role === "admin")
        .map(([uid]) =>
          sendPush(uid, title, body, { type: "payment", serviceId }),
        ),
    );
  } catch (e) {
    console.log("Admin notify failed:", e);
  }
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PaymentModal({
  visible,
  serviceId,
  userId,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  serviceId: string;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [senderName, setSenderName] = useState("");
  const [senderBank, setSenderBank] = useState("");
  const [amountPaid, setAmountPaid] = useState(String(SUBSCRIPTION_FEE));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [request, setRequest] = useState<any>(null);
  const [now, setNow] = useState(Date.now());
  const reference = `CN-${serviceId.slice(-6).toUpperCase()}`;

  // Live status of this listing's payment request
  useEffect(() => {
    if (!visible || !serviceId) return;
    const unsub = onValue(
      ref(database, `paymentRequests/${serviceId}`),
      (snap) => {
        setRequest(snap.val());
      },
    );
    return () => unsub();
  }, [visible, serviceId]);

  const isPending = request?.status === "pending";
  const wasRejected = request?.status === "rejected";

  // Tick every second while waiting, to drive the countdown
  useEffect(() => {
    if (!visible || !isPending) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [visible, isPending]);

  const lastBase = Math.max(
    request?.createdAt || 0,
    request?.lastRemindedAt || 0,
  );
  const remainingMs = lastBase + REMIND_COOLDOWN_MS - now;
  const canRemind = isPending && remainingMs <= 0;

  async function handleSubmit() {
    setError("");
    const amount = parseInt(amountPaid.replace(/[^0-9]/g, ""), 10);
    if (!senderName.trim()) {
      setError("Enter the account name you paid from.");
      return;
    }
    if (!senderBank.trim()) {
      setError("Enter the bank you paid from.");
      return;
    }
    if (!Number.isFinite(amount) || amount < SUBSCRIPTION_FEE) {
      setError(
        `Amount must be at least ₦${SUBSCRIPTION_FEE.toLocaleString()}.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      await set(ref(database, `paymentRequests/${serviceId}`), {
        serviceId,
        userId,
        reference,
        amount: SUBSCRIPTION_FEE,
        amountPaid: amount,
        senderName: senderName.trim(),
        senderBank: senderBank.trim(),
        note: note.trim(),
        status: "pending",
        createdAt: Date.now(),
      });
      notifyAdmins(
        "New payment to confirm",
        `${senderName.trim()} sent ₦${amount.toLocaleString()} · ${reference}`,
        serviceId,
      );
      setSubmitting(false);
      onSuccess();
    } catch (e: any) {
      setError(e.message || "Could not submit. Try again.");
      setSubmitting(false);
    }
  }

  async function handleRemind() {
    if (!canRemind || !request) return;
    setReminding(true);
    try {
      await update(ref(database, `paymentRequests/${serviceId}`), {
        lastRemindedAt: Date.now(),
      });
      await notifyAdmins(
        "Payment waiting for confirmation",
        `${request.senderName} is waiting · ₦${Number(request.amountPaid || request.amount).toLocaleString()} · ${request.reference}`,
        serviceId,
      );
      Alert.alert(
        "Reminder sent",
        "The admin has been notified. You can remind again in 10 minutes.",
      );
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not send reminder. Try again.");
    }
    setReminding(false);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={payStyles.scroll}
          contentContainerStyle={payStyles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={payStyles.handle} />

          {isPending ? (
            <>
              <View style={payStyles.waitIcon}>
                <Clock size={34} color={GREEN} strokeWidth={2} />
              </View>
              <Text style={payStyles.title}>Waiting for confirmation</Text>
              <Text style={payStyles.waitText}>
                Payment submitted. Please give the admin some time to confirm
                your payment. Your listing goes live as soon as it's confirmed.
              </Text>

              <View style={payStyles.summaryBox}>
                <Text style={payStyles.summaryLine}>
                  Amount: ₦
                  {Number(
                    request.amountPaid || request.amount,
                  ).toLocaleString()}
                </Text>
                <Text style={payStyles.summaryLine}>
                  From: {request.senderName} ({request.senderBank})
                </Text>
                <Text style={payStyles.summaryLine}>
                  Reference: {request.reference}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  payStyles.payBtn,
                  payStyles.rowBox,
                  (!canRemind || reminding) && { opacity: 0.5 },
                ]}
                onPress={handleRemind}
                disabled={!canRemind || reminding}
              >
                {reminding ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <BellRing size={16} color="#fff" strokeWidth={2.4} />
                    <Text style={payStyles.payBtnText}>
                      {canRemind
                        ? "Remind admin now"
                        : `Remind admin in ${formatCountdown(remainingMs)}`}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={payStyles.remindNote}>
                You can send a reminder every 10 minutes. It sends the admin a
                notification.
              </Text>

              <TouchableOpacity style={payStyles.cancelBtn} onPress={onClose}>
                <Text style={payStyles.cancelBtnText}>Close</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={payStyles.title}>Renew Your Listing</Text>
              <Text style={payStyles.subtitle}>
                Be visible to students for 30 more days
              </Text>

              {wasRejected ? (
                <Text style={payStyles.error}>
                  Your last payment couldn't be confirmed. Check the details and
                  submit again.
                </Text>
              ) : null}

              <View style={payStyles.priceBox}>
                <Text style={payStyles.priceLabel}>Monthly subscription</Text>
                <Text style={payStyles.price}>
                  ₦{SUBSCRIPTION_FEE.toLocaleString()}
                </Text>
                <Text style={payStyles.priceSub}>30 days of visibility</Text>
              </View>

              <Text style={payStyles.stepLabel}>
                STEP 1 · Transfer to this account
              </Text>
              <View style={payStyles.bankBox}>
                <Text style={payStyles.bankLine}>{BANK.bank}</Text>
                <Text style={payStyles.bankNumber} selectable>
                  {BANK.accountNumber}
                </Text>
                <Text style={payStyles.bankLine}>{BANK.accountName}</Text>
                <View style={payStyles.refBox}>
                  <Text style={payStyles.refLabel}>
                    Put this in the narration / remark
                  </Text>
                  <Text style={payStyles.refValue} selectable>
                    {reference}
                  </Text>
                </View>
              </View>

              <Text style={payStyles.stepLabel}>
                STEP 2 · Tell us about your transfer
              </Text>

              {error ? <Text style={payStyles.error}>{error}</Text> : null}

              <Text style={payStyles.fieldLabel}>
                Account name you paid from *
              </Text>
              <TextInput
                style={payStyles.input}
                placeholder="e.g. Kemi Adeyemi"
                placeholderTextColor="#bbb"
                value={senderName}
                onChangeText={(t) => {
                  setError("");
                  setSenderName(t);
                }}
              />

              <Text style={payStyles.fieldLabel}>Bank you paid from *</Text>
              <TextInput
                style={payStyles.input}
                placeholder="e.g. GTBank, Opay, Kuda"
                placeholderTextColor="#bbb"
                value={senderBank}
                onChangeText={(t) => {
                  setError("");
                  setSenderBank(t);
                }}
              />

              <Text style={payStyles.fieldLabel}>Amount sent (₦) *</Text>
              <TextInput
                style={payStyles.input}
                value={amountPaid}
                onChangeText={(t) => {
                  setError("");
                  setAmountPaid(t);
                }}
                keyboardType="number-pad"
              />

              <Text style={payStyles.fieldLabel}>Note (optional)</Text>
              <TextInput
                style={payStyles.input}
                placeholder="Anything that helps us find your payment"
                placeholderTextColor="#bbb"
                value={note}
                onChangeText={setNote}
              />

              <TouchableOpacity
                style={[
                  payStyles.payBtn,
                  payStyles.rowBox,
                  submitting && { opacity: 0.6 },
                ]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Send size={16} color="#fff" strokeWidth={2.4} />
                    <Text style={payStyles.payBtnText}>I've Paid · Submit</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={payStyles.cancelBtn} onPress={onClose}>
                <Text style={payStyles.cancelBtnText}>Not now</Text>
              </TouchableOpacity>

              <View style={payStyles.rowBox}>
                <CheckCircle2 size={12} color="#bbb" strokeWidth={2.2} />
                <Text style={payStyles.footnote}>
                  Activated after the admin confirms your transfer
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const payStyles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#fff" },
  container: {
    padding: 24,
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 48,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ddd",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: { fontSize: 15, color: "#888", marginBottom: 20 },
  waitIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#f0f7f3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    marginTop: 8,
  },
  waitText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
  },
  summaryBox: {
    width: "100%",
    backgroundColor: "#fafafa",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#eee",
    padding: 14,
    marginBottom: 20,
    gap: 4,
  },
  summaryLine: { fontSize: 13, color: "#444", fontWeight: "600" },
  remindNote: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 6,
  },
  priceBox: {
    backgroundColor: "#f0f7f3",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#c8e6d4",
    padding: 16,
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  priceLabel: {
    fontSize: 13,
    color: "#4a8c63",
    fontWeight: "600",
    marginBottom: 4,
  },
  price: { fontSize: 36, fontWeight: "900", color: GREEN, marginBottom: 2 },
  priceSub: { fontSize: 12, color: "#888" },
  stepLabel: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "800",
    color: "#9aa39a",
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 4,
  },
  bankBox: {
    width: "100%",
    backgroundColor: "#fafafa",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#eee",
    padding: 16,
    alignItems: "center",
    marginBottom: 22,
  },
  bankLine: { fontSize: 14, color: "#555", fontWeight: "600" },
  bankNumber: {
    fontSize: 28,
    fontWeight: "900",
    color: "#111",
    letterSpacing: 2,
    marginVertical: 6,
  },
  refBox: {
    marginTop: 12,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    width: "100%",
  },
  refLabel: { fontSize: 11, color: "#92400E", fontWeight: "600" },
  refValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#92400E",
    marginTop: 2,
    letterSpacing: 1,
  },
  error: {
    alignSelf: "stretch",
    backgroundColor: "#fff1f1",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#f5c2c2",
    color: "#c0392b",
    fontSize: 13,
    fontWeight: "600",
    padding: 12,
    marginBottom: 10,
  },
  fieldLabel: {
    alignSelf: "flex-start",
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 6,
  },
  input: {
    alignSelf: "stretch",
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    padding: 13,
    fontSize: 14,
    color: "#333",
    marginBottom: 12,
  },
  payBtn: {
    backgroundColor: GREEN,
    borderRadius: 16,
    padding: 18,
    width: "100%",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  rowBox: { flexDirection: "row", alignItems: "center", gap: 6 },
  payBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  cancelBtn: { padding: 12 },
  cancelBtnText: { color: "#888", fontSize: 14 },
  footnote: { fontSize: 11, color: "#bbb" },
});
