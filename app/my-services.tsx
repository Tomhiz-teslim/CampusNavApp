import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { ArrowLeft, Plus } from "lucide-react-native";
import { onValue, ref, remove } from "firebase/database";
import { auth, database } from "../lib/firebase";
import { ListingFormModal } from "../components/ListingFormModal";
import { MyListingPanel } from "../components/MyListingPanel";
import { PaymentModal } from "../components/PaymentModal";
import { GREEN, BG, ServiceListing } from "../lib/serviceShared";

export default function MyServicesScreen() {
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [myService, setMyService] = useState<ServiceListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    setUserId(user.uid);

    const unsubProfile = onValue(ref(database, `users/${user.uid}`), (snap) => {
      const d = snap.val();
      if (d) setUserName(d.fullName || d.name || "");
    });

    const unsubService = onValue(ref(database, "services"), (snap) => {
      const data = snap.val() || {};
      const mine = Object.entries(data)
        .map(([id, v]: any) => ({ id, ...v }))
        .find((s: ServiceListing) => s.userId === user.uid);
      setMyService(mine ?? null);
      setLoading(false);
    });

    return () => {
      unsubProfile();
      unsubService();
    };
  }, []);

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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#fff" strokeWidth={2.4} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Listing</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {loading ? (
          <ActivityIndicator color={GREEN} size="large" style={{ marginTop: 40 }} />
        ) : (
          <>
            <MyListingPanel
              myService={myService}
              onEdit={() => setShowForm(true)}
              onDelete={handleDeleteListing}
              onActivate={() => setShowPayment(true)}
            />

            {!myService && (
              <TouchableOpacity style={styles.createBtn} onPress={() => setShowForm(true)}>
                <Plus size={16} color="#fff" strokeWidth={2.6} />
                <Text style={styles.createBtnText}>Create My Listing</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.helpText}>
              Questions? Contact us via WhatsApp for listing support.
            </Text>
          </>
        )}
      </ScrollView>

      <ListingFormModal
        visible={showForm}
        existing={myService}
        userName={userName}
        onClose={() => setShowForm(false)}
        onSaved={(isNew) => {
          if (isNew) {
            setTimeout(() => {
              Alert.alert("You're Live!", "Your listing is now visible to students for a free 30-day trial.");
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: GREEN, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16,
  },
  backBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  body: { flex: 1 },
  createBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: GREEN, borderRadius: 14, padding: 16, marginBottom: 16,
  },
  createBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  helpText: { fontSize: 12, color: "#bbb", textAlign: "center", paddingBottom: 20 },
});