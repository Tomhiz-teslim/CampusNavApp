import React, { useState } from "react";
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ref, set, update } from "firebase/database";
import { database } from "../lib/firebase";
import { CheckCircle2, Zap } from "lucide-react-native";
import { GREEN, SUBSCRIPTION_FEE, SUBSCRIPTION_DURATION_MS } from "../lib/serviceShared";

export function PaymentModal({
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
              Alert.alert("Listing Activated!", "Your service is now visible to all students for 30 days.");
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
            "Visible to all UNILAG students",
            "Searchable by service category",
            "Direct WhatsApp & call buttons on your card",
            "Walking directions if you add a GPS spot",
            "Auto-hidden if you don't renew",
          ].map((b, i) => (
            <View key={i} style={payStyles.benefitRow}>
              <CheckCircle2 size={15} color={GREEN} strokeWidth={2.2} />
              <Text style={payStyles.benefit}>{b}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={[payStyles.payBtn, payStyles.rowBox, { justifyContent: "center" }, processing && { opacity: 0.6 }]} onPress={handlePay} disabled={processing}>
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Zap size={16} color="#fff" strokeWidth={2.4} />
              <Text style={payStyles.payBtnText}>Pay ₦{SUBSCRIPTION_FEE.toLocaleString()} & Activate</Text>
            </>
          )}
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
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  benefit: { fontSize: 14, color: "#333", fontWeight: "500", flex: 1 },
  payBtn: { backgroundColor: GREEN, borderRadius: 16, padding: 18, width: "100%", alignItems: "center", marginBottom: 12 },
  rowBox: { flexDirection: "row", alignItems: "center", gap: 6 },
  payBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  cancelBtn: { padding: 12 },
  cancelBtnText: { color: "#888", fontSize: 14 },
  footnote: { fontSize: 11, color: "#bbb", marginTop: 12, textAlign: "center" },
});