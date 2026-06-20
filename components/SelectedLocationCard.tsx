import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { CATEGORY_COLORS } from "../lib/campusData";
import { haversineMetres } from "../lib/navUtils";

export function SelectedLocationCard({
  selected,
  userLocation,
  onGetDirections,
  onClose,
}: {
  selected: any;
  userLocation: { latitude: number; longitude: number } | null;
  onGetDirections: () => void;
  onClose: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(80)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const colors = CATEGORY_COLORS[selected.category] || CATEGORY_COLORS.admin;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 70,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const hoursMatch = selected.description?.match(
    /([A-Z][a-z]{0,2}[–—-][A-Z][a-z]{0,2}\s+\d[^,)]*|\d{1,2}[ap]m[–—-]\d{1,2}[ap]m|24 hours)/i,
  );
  const hoursText = hoursMatch ? hoursMatch[0] : null;

  function isOpenNow(hoursStr: string | null): boolean | null {
    if (!hoursStr) return null;
    if (hoursStr.toLowerCase().includes("24")) return true;
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const isWeekday = day >= 1 && day <= 5;
    if (hoursStr.toLowerCase().includes("mon–fri") && !isWeekday) return false;
    if (hoursStr.toLowerCase().includes("mon–sat") && day === 0) return false;
    const timeMatch = hoursStr.match(/(\d{1,2})([ap]m)[–-](\d{1,2})([ap]m)/i);
    if (!timeMatch) return null;
    const toHour = (h: string, ampm: string) => {
      let n = parseInt(h);
      if (ampm.toLowerCase() === "pm" && n !== 12) n += 12;
      if (ampm.toLowerCase() === "am" && n === 12) n = 0;
      return n;
    };
    const open = toHour(timeMatch[1], timeMatch[2]);
    const close = toHour(timeMatch[3], timeMatch[4]);
    return hour >= open && hour < close;
  }

  const openStatus = isOpenNow(hoursText);

  const distM = userLocation
    ? haversineMetres(
        userLocation.latitude,
        userLocation.longitude,
        selected.latitude,
        selected.longitude,
      )
    : null;
  const distLabel =
    distM == null
      ? null
      : distM < 1000
        ? `${Math.round(distM)} m`
        : `${(distM / 1000).toFixed(1)} km`;

  return (
    <Animated.View
      style={[
        scStyles.wrapper,
        { transform: [{ translateY: slideAnim }], opacity: fadeAnim },
      ]}
    >
      <View style={[scStyles.accentBar, { backgroundColor: colors.pin }]} />
      <View style={scStyles.inner}>
        <View
          style={[
            scStyles.iconBubble,
            { backgroundColor: colors.dot, borderColor: colors.pin + "33" },
          ]}
        >
          <Text style={scStyles.iconText}>{selected.icon}</Text>
        </View>
        <View style={scStyles.info}>
          <Text style={scStyles.name} numberOfLines={1}>
            {selected.name}
          </Text>
          <View style={scStyles.metaRow}>
            <View style={[scStyles.catPill, { backgroundColor: colors.pin }]}>
              <Text style={scStyles.catPillText}>
                {selected.category === "other"
                  ? "community"
                  : selected.category}
              </Text>
            </View>
            {distLabel && (
              <View style={scStyles.distChip}>
                <Text style={scStyles.distText}>📍 {distLabel}</Text>
              </View>
            )}
            {hoursText && (
              <View style={scStyles.hoursChip}>
                <Text style={scStyles.hoursText}>🕐 {hoursText}</Text>
              </View>
            )}
            {openStatus !== null && (
              <View
                style={[
                  scStyles.hoursChip,
                  { backgroundColor: openStatus ? "#e8f5e9" : "#ffebee" },
                ]}
              >
                <Text
                  style={[
                    scStyles.hoursText,
                    { color: openStatus ? "#2e7d32" : "#c62828" },
                  ]}
                >
                  {openStatus ? "● Open" : "● Closed"}
                </Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={scStyles.closeBtn}
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={scStyles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          style={[scStyles.dirBtn, { backgroundColor: "#1a5c38" }]}
          onPress={onGetDirections}
          activeOpacity={0.85}
        >
          <View
            style={[scStyles.dirBtnGlow, { backgroundColor: "#1a5c3840" }]}
          />
          <Text style={scStyles.dirBtnIcon}>🧭</Text>
          <Text style={scStyles.dirBtnText}>Get Directions</Text>
          <View style={scStyles.dirArrowCircle}>
            <Text style={scStyles.dirArrowText}>→</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const scStyles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 130,
    left: 14,
    right: 14,
    backgroundColor: "#fff",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
    overflow: "hidden",
  },
  accentBar: { height: 4, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    paddingBottom: 10,
  },
  iconBubble: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1.5,
  },
  iconText: { fontSize: 26 },
  info: { flex: 1 },
  name: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1a1a1a",
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  catPill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  catPillText: {
    fontSize: 11,
    color: "#fff",
    fontWeight: "700",
    textTransform: "capitalize",
  },
  distChip: {
    backgroundColor: "#f0f0f0",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  distText: { fontSize: 11, color: "#555", fontWeight: "600" },
  hoursChip: {
    backgroundColor: "#f0f7f3",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  hoursText: { fontSize: 11, color: "#1a5c38", fontWeight: "600" },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },
  closeBtnText: { fontSize: 12, color: "#888", fontWeight: "700" },
  dirBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    overflow: "hidden",
  },
  dirBtnGlow: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    top: -20,
    left: -20,
  },
  dirBtnIcon: { fontSize: 18, marginRight: 10 },
  dirBtnText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.2,
  },
  dirArrowCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  dirArrowText: { fontSize: 16, color: "#fff", fontWeight: "700" },
});