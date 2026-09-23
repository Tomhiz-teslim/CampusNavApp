import React, { useEffect, useRef } from "react";
import { Animated, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AlertTriangle, Pencil, RotateCw, ShoppingBag, Trash2 } from "lucide-react-native";
import { GREEN, GREEN_BRIGHT, SUBSCRIPTION_FEE, ServiceListing, SERVICE_CATEGORIES, daysLeft, formatPriceRange, isOpenNow } from "../lib/serviceShared";

export function MyListingPanel({
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
        <View style={myStyles.emptyIconBox}>
          <ShoppingBag size={32} color="#bbb" strokeWidth={1.8} />
        </View>
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
        <View style={[myStyles.warningBox, myStyles.rowBox]}>
          <AlertTriangle size={14} color="#92400E" strokeWidth={2.2} />
          <Text style={myStyles.warningText}>
            {onTrial ? "Trial ending soon!" : "Expiring soon!"} Renew to stay visible.
          </Text>
        </View>
      )}

      {myService.photos && myService.photos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          style={myStyles.photoStrip}
        >
          {myService.photos.map((uri, i) => (
            <Image
              key={uri}
              source={{ uri }}
              style={i === 0 ? myStyles.photoCover : myStyles.photoThumb}
            />
          ))}
        </ScrollView>
      ) : (
        <TouchableOpacity style={myStyles.photoNudge} onPress={onEdit} activeOpacity={0.8}>
          <Text style={myStyles.photoNudgeText}>+ Add photos to get more views</Text>
        </TouchableOpacity>
      )}

      <Text style={myStyles.listingName}>{myService.name}</Text>
      <View style={myStyles.listingCatRow}>
        {(() => {
          const CatIcon = SERVICE_CATEGORIES.find((c) => c.key === myService.category)?.icon;
          return CatIcon ? <CatIcon size={13} color="#666" strokeWidth={2.2} /> : null;
        })()}
        <Text style={myStyles.listingCat}>
          {SERVICE_CATEGORIES.find((c) => c.key === myService.category)?.label}
        </Text>
      </View>
      <Text style={myStyles.listingDesc} numberOfLines={2}>{myService.description}</Text>

      {(() => {
        const priceLabel = formatPriceRange(myService.priceMin, myService.priceMax);
        const openNow = isOpenNow(myService.hours);
        if (!priceLabel && openNow == null) return null;
        return (
          <View style={myStyles.metaRow}>
            {priceLabel ? <Text style={myStyles.metaText}>{priceLabel}</Text> : null}
            {openNow != null ? (
              <Text style={[myStyles.metaText, { color: openNow ? GREEN : "#cc2222" }]}>
                {openNow ? "Open now" : "Closed"}
              </Text>
            ) : null}
          </View>
        );
      })()}

      <View style={myStyles.actions}>
        <TouchableOpacity style={[myStyles.editBtn, myStyles.rowBox]} onPress={onEdit}>
          <Pencil size={14} color={GREEN} strokeWidth={2.2} />
          <Text style={myStyles.editBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={myStyles.deleteBtn} onPress={onDelete}>
          <Trash2 size={17} color="#cc2222" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      {!isActive && (
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity style={[myStyles.payBtn, myStyles.rowBox, { justifyContent: "center" }]} onPress={onActivate} activeOpacity={0.85}>
            <RotateCw size={16} color="#fff" strokeWidth={2.4} />
            <Text style={myStyles.payBtnText}>
              Renew — ₦{SUBSCRIPTION_FEE.toLocaleString()}/month
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
  emptyIconBox: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#f0f0f0",
    alignItems: "center", justifyContent: "center",
    marginBottom: 14,
  },
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
  listingCatRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  listingCat: { fontSize: 13, color: "#666" },
  listingDesc: { fontSize: 13, color: "#888", lineHeight: 18, marginBottom: 14 },
  metaRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  metaText: { fontSize: 12, fontWeight: "700", color: "#556155" },
  actions: { flexDirection: "row", gap: 10, marginBottom: 14 },
  editBtn: { flex: 1, backgroundColor: "#EAF6EE", borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1.5, borderColor: "#c8e6d4" },
  editBtnText: { color: GREEN, fontSize: 14, fontWeight: "700" },
  deleteBtn: { backgroundColor: "#fff1f1", borderRadius: 10, padding: 12, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#ffd5d5", width: 48 },
  payBtn: { backgroundColor: GREEN, borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 10 },
  payBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  payNote: { fontSize: 11, color: "#aaa", textAlign: "center", lineHeight: 16 },
  rowBox: { flexDirection: "row", alignItems: "center", gap: 6 },
  photoStrip: { marginBottom: 14 },
  photoCover: { width: 200, height: 120, borderRadius: 14, backgroundColor: "#EAF6EE" },
  photoThumb: { width: 120, height: 120, borderRadius: 14, backgroundColor: "#EAF6EE" },
  photoNudge: {
    borderWidth: 1.5, borderColor: GREEN, borderStyle: "dashed", borderRadius: 14,
    paddingVertical: 14, alignItems: "center", marginBottom: 14, backgroundColor: "#f6fbf8",
  },
  photoNudgeText: { color: GREEN, fontSize: 13, fontWeight: "700" },
});