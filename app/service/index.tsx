import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { auth } from "../../lib/firebase";
import ServicesTab from "../../components/services";

const GREEN = "#1a5c38";

export default function ServiceScreen() {
  const [userId] = useState(auth.currentUser?.uid ?? "");

  if (!userId) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={GREEN} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#fff" strokeWidth={2.4} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Campus Services</Text>
        <View style={styles.backBtn} />
      </View>
      <ServicesTab userId={userId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7F5" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F7F5" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: GREEN, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16,
  },
  backBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
});