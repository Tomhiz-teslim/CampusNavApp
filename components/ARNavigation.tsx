import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { DeviceMotion } from "expo-sensors";

const { width: W, height: H } = Dimensions.get("window");

function bearingTo(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
): number {
  const dLng = ((toLng - fromLng) * Math.PI) / 180;
  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getArrow(maneuver: string): string {
  if (!maneuver) return "↑";
  if (maneuver.includes("turn-right"))  return "→";
  if (maneuver.includes("turn-left"))   return "←";
  if (maneuver.includes("sharp-right")) return "↱";
  if (maneuver.includes("sharp-left"))  return "↰";
  if (maneuver.includes("uturn"))       return "↩";
  if (maneuver.includes("roundabout"))  return "↻";
  return "↑";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
}

interface Props {
  userLocation: { latitude: number; longitude: number };
  destination: { name: string; latitude: number; longitude: number };
  heading: number;
  currentInstruction: string;
  distanceToNext: string;
  nextManeuver: string;
  eta: string;
  onExit: () => void;
}

export default function ARNavigation({
  userLocation,
  destination,
  heading,
  currentInstruction,
  distanceToNext,
  nextManeuver,
  eta,
  onExit,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [showAR, setShowAR] = useState(true);

  const pulse      = useRef(new Animated.Value(1)).current;
  const slideDown  = useRef(new Animated.Value(-160)).current;
  const slideUp    = useRef(new Animated.Value(180)).current;
  const arrowScale = useRef(new Animated.Value(0)).current;

  // ── Bearing & distance ────────────────────────────────────────────────────
  const bearing = bearingTo(
    userLocation.latitude, userLocation.longitude,
    destination.latitude,  destination.longitude,
  );
  const distM = haversineM(
    userLocation.latitude, userLocation.longitude,
    destination.latitude,  destination.longitude,
  );
  const deltaAngle = ((bearing - heading + 540) % 360) - 180;
  const abs = Math.abs(deltaAngle);

  const distLabel = distM < 1000
    ? `${Math.round(distM)} m`
    : `${(distM / 1000).toFixed(1)} km`;

  let arrowSymbol = "↑";
  if (abs > 20 && abs <= 60)  arrowSymbol = deltaAngle > 0 ? "↗" : "↖";
  else if (abs > 60 && abs <= 120) arrowSymbol = deltaAngle > 0 ? "→" : "←";
  else if (abs > 120) arrowSymbol = deltaAngle > 0 ? "↩" : "↪";

  let dirLabel = "Continue straight";
  if (abs > 20 && abs <= 90)  dirLabel = deltaAngle > 0 ? "Turn right" : "Turn left";
  else if (abs > 90) dirLabel = deltaAngle > 0 ? "Turn around right" : "Turn around left";

  // ── Animations ────────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideDown,  { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      Animated.spring(slideUp,    { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      Animated.spring(arrowScale, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0,  duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Tilt detection ────────────────────────────────────────────────────────
  useEffect(() => {
    DeviceMotion.setUpdateInterval(200);
    const sub = DeviceMotion.addListener(({ rotation }) => {
      if (!rotation) return;
      const pitch = ((rotation.beta ?? 0) * 180) / Math.PI;
      setShowAR(pitch > 22);
    });
    return () => sub.remove();
  }, []);

  // ── Permission screens ────────────────────────────────────────────────────
  if (!permission) {
    return (
      <View style={s.fill}>
        <Text style={{ color: "#fff", marginTop: 100, textAlign: "center" }}>
          Loading camera…
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={s.permBox}>
        <Text style={s.permIcon}>📷</Text>
        <Text style={s.permTitle}>Camera Access Needed</Text>
        <Text style={s.permSub}>
          AR navigation needs your camera to overlay directions on the real world.
        </Text>
        <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
          <Text style={s.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.permSkip} onPress={onExit}>
          <Text style={s.permSkipText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── MAIN AR VIEW ──────────────────────────────────────────────────────────
  return (
    <View style={s.fill}>

      {/* FULL SCREEN CAMERA */}
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* Dark vignette top */}
      <View style={s.vignetteTop} pointerEvents="none" />

      {/* Dark vignette bottom */}
      <View style={s.vignetteBottom} pointerEvents="none" />

      {/* ── TOP INSTRUCTION BANNER ── */}
      <Animated.View style={[s.topBanner, { transform: [{ translateY: slideDown }] }]}>
        <View style={s.bannerRow}>
          <View style={s.maneuverBox}>
            <Text style={s.maneuverArrow}>{getArrow(nextManeuver)}</Text>
          </View>
          <View style={s.instructionBox}>
            <Text style={s.instructionText} numberOfLines={2}>
              {stripHtml(currentInstruction)}
            </Text>
            <Text style={s.instructionDist}>In {distanceToNext}</Text>
          </View>
          <TouchableOpacity style={s.xBtn} onPress={onExit}>
            <Text style={s.xBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* ETA strip inside banner */}
        <View style={s.etaStrip}>
          <Text style={s.etaStripText}>⏱ {eta}</Text>
          <View style={s.etaStripDot} />
          <Text style={s.etaStripText}>📍 {distLabel} remaining</Text>
        </View>
      </Animated.View>

      {/* ── COMPASS ── */}
      <View style={s.compass} pointerEvents="none">
        <Text style={s.compassN}>N</Text>
        <Text style={s.compassDeg}>{Math.round(heading)}°</Text>
      </View>

      {/* ── CENTRE: AR Arrow OR Tilt Hint ── */}
      {showAR ? (
        <View style={s.arrowArea} pointerEvents="none">
          {/* Subtle lane lines */}
          <View style={s.laneRow}>
            {[0,1,2].map(i => <View key={i} style={s.laneLine} />)}
          </View>

          {/* Big direction arrow */}
          <Animated.View
            style={[
              s.arrowBubble,
              { transform: [{ scale: pulse }, { scale: arrowScale }] },
            ]}
          >
            <Text style={s.arrowSymbol}>{arrowSymbol}</Text>
          </Animated.View>

          {/* Label below arrow */}
          <View style={s.dirLabelBox}>
            <Text style={s.dirLabel}>{dirLabel}</Text>
          </View>
        </View>
      ) : (
        <View style={s.tiltHintArea} pointerEvents="none">
          <View style={s.tiltHintCard}>
            <Text style={s.tiltHintIcon}>📱</Text>
            <Text style={s.tiltHintText}>Tilt phone up to see AR arrows</Text>
          </View>
        </View>
      )}

      {/* ── BOTTOM BAR ── */}
      <Animated.View style={[s.bottomBar, { transform: [{ translateY: slideUp }] }]}>
        {/* Drag handle */}
        <View style={s.dragHandle} />

        <View style={s.bottomRow}>
          <View style={s.bottomStat}>
            <Text style={s.bottomVal}>{eta}</Text>
            <Text style={s.bottomLbl}>ETA</Text>
          </View>
          <View style={s.bottomDivider} />
          <View style={s.bottomStat}>
            <Text style={s.bottomVal}>{distLabel}</Text>
            <Text style={s.bottomLbl}>Remaining</Text>
          </View>
          <View style={s.bottomDivider} />
          <View style={[s.bottomStat, { flex: 2 }]}>
            <Text style={s.bottomVal} numberOfLines={1}>{destination.name}</Text>
            <Text style={s.bottomLbl}>Destination</Text>
          </View>
        </View>

        <TouchableOpacity style={s.exitARBtn} onPress={onExit}>
          <Text style={s.exitARText}>Exit AR</Text>
        </TouchableOpacity>
      </Animated.View>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Root — covers everything
  fill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    elevation: 999,
    backgroundColor: "#000",
  },

  // Vignette
  vignetteTop: {
    position: "absolute", top: 0, left: 0, right: 0,
    height: H * 0.3,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  vignetteBottom: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: H * 0.32,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  // Top banner
  topBanner: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    backgroundColor: "#1A73E8",
    paddingTop: Platform.OS === "ios" ? 56 : 38,
    zIndex: 10,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  bannerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  maneuverBox: {
    width: 58, height: 58,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.22)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  maneuverArrow: { fontSize: 32, color: "#fff" },
  instructionBox: { flex: 1 },
  instructionText: {
    fontSize: 19, fontWeight: "800",
    color: "#fff", lineHeight: 26,
  },
  instructionDist: {
    fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 4,
  },
  xBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
    marginLeft: 10,
  },
  xBtnText: { fontSize: 16, color: "#fff", fontWeight: "700" },

  // ETA strip inside banner
  etaStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  etaStripText: {
    fontSize: 13, color: "rgba(255,255,255,0.92)", fontWeight: "600",
  },
  etaStripDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.4)",
    marginHorizontal: 10,
  },

  // Compass
  compass: {
    position: "absolute",
    top: Platform.OS === "ios" ? 178 : 148,
    right: 16,
    width: 52, height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.62)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    zIndex: 10,
  },
  compassN: { fontSize: 17, color: "#FF4136", fontWeight: "900" },
  compassDeg: { fontSize: 9, color: "rgba(255,255,255,0.7)", fontWeight: "600" },

  // AR arrow area
  arrowArea: {
    position: "absolute",
    top: H * 0.33,
    left: 0, right: 0,
    alignItems: "center",
  },
  laneRow: {
    flexDirection: "row",
    gap: 22,
    marginBottom: 18,
    opacity: 0.22,
  },
  laneLine: {
    width: 3, height: 46,
    backgroundColor: "#fff",
    borderRadius: 2,
  },
  arrowBubble: {
    width: 124, height: 124,
    borderRadius: 62,
    backgroundColor: "rgba(26,115,232,0.92)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.75)",
    shadowColor: "#1A73E8",
    shadowOpacity: 1,
    shadowRadius: 45,
    elevation: 30,
  },
  arrowSymbol: { fontSize: 64, color: "#fff" },
  dirLabelBox: {
    marginTop: 18,
    backgroundColor: "rgba(0,0,0,0.58)",
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  dirLabel: {
    fontSize: 16, fontWeight: "700", color: "#fff",
  },

  // Tilt hint
  tiltHintArea: {
    position: "absolute",
    top: H * 0.35,
    left: 0, right: 0,
    alignItems: "center",
  },
  tiltHintCard: {
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 22,
    paddingHorizontal: 30,
    paddingVertical: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  tiltHintIcon: { fontSize: 52, marginBottom: 12 },
  tiltHintText: {
    fontSize: 16, fontWeight: "600",
    color: "rgba(255,255,255,0.88)",
    textAlign: "center",
  },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 38 : 22,
    zIndex: 10,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  dragHandle: {
    width: 38, height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  bottomStat: { flex: 1, alignItems: "center" },
  bottomVal: { fontSize: 17, fontWeight: "800", color: "#111" },
  bottomLbl: { fontSize: 11, color: "#888", marginTop: 3 },
  bottomDivider: { width: 1, height: 38, backgroundColor: "#eee" },

  exitARBtn: {
    backgroundColor: "#1A73E8",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  exitARText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  // Permission
  permBox: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0a0a1a",
    justifyContent: "center",
    alignItems: "center",
    padding: 36,
    zIndex: 999,
    elevation: 999,
  },
  permIcon: { fontSize: 60, marginBottom: 20 },
  permTitle: {
    fontSize: 24, fontWeight: "800",
    color: "#fff", marginBottom: 12, textAlign: "center",
  },
  permSub: {
    fontSize: 15, color: "rgba(255,255,255,0.6)",
    textAlign: "center", lineHeight: 22, marginBottom: 36,
  },
  permBtn: {
    backgroundColor: "#1A73E8", borderRadius: 14,
    paddingHorizontal: 40, paddingVertical: 16,
    marginBottom: 14, width: "100%", alignItems: "center",
  },
  permBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  permSkip: { padding: 10 },
  permSkipText: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
});