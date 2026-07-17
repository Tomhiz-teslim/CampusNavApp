import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Magnetometer } from "expo-sensors";

interface Props {
  userLat: number;
  userLng: number;
  destLat: number;
  destLng: number;
  distanceMetres: number;
}

function bearingTo(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function lowPass(current: number, previous: number, alpha = 0.15): number {
  let diff = current - previous;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return (previous + alpha * diff + 360) % 360;
}

export default function CompassPointer({
  userLat,
  userLng,
  destLat,
  destLng,
  distanceMetres,
}: Props) {
  // NOTE: all hooks must run unconditionally, on every render, in the same
  // order — that's a hard React rule, not a style preference. The old code
  // had `if (!userLat || ...) return null;` BEFORE the useState/useRef/
  // useEffect calls below. That's a real crash bug: if this component ever
  // stays mounted across a render where one of the props is briefly falsy
  // (e.g. a GPS glitch returning 0 for latitude while reacquiring a fix —
  // a known real-device behavior, not hypothetical) React throws "Rendered
  // fewer hooks than expected" and crashes that render tree. Hooks now run
  // first unconditionally; the invalid-props check only gates what we
  // *render*, not which hooks get called.
  const [heading, setHeading] = useState(0);
  const smoothedHeading = useRef(0);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const lastRotation = useRef(0);

  const hasValidProps = !!(userLat && userLng && destLat && destLng);

  useEffect(() => {
    Magnetometer.setUpdateInterval(100);
    const sub = Magnetometer.addListener(({ x, y }) => {
      let raw = Math.atan2(y, x) * (180 / Math.PI);
      raw = (raw + 360) % 360;
      smoothedHeading.current = lowPass(raw, smoothedHeading.current);
      setHeading(smoothedHeading.current);
    });
    return () => sub.remove();
  }, []);

  // Guard the bearing math too — bearingTo() with undefined/0 coords would
  // otherwise run every render even while props are invalid.
  const targetBearing = hasValidProps
    ? bearingTo(userLat, userLng, destLat, destLng)
    : 0;

  let arrowRotation = (targetBearing - heading + 360) % 360;

  let delta = arrowRotation - lastRotation.current;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  const newRotation = hasValidProps
    ? lastRotation.current + delta
    : lastRotation.current;
  lastRotation.current = newRotation;

  useEffect(() => {
    if (!hasValidProps) return;
    Animated.timing(rotateAnim, {
      toValue: newRotation,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [newRotation, hasValidProps]);

  const spin = rotateAnim.interpolate({
    inputRange: [-360, 0, 360, 720],
    outputRange: ["-360deg", "0deg", "360deg", "720deg"],
    extrapolate: "extend",
  });

  // All hooks have now run — safe to bail out of rendering.
  if (!hasValidProps) return null;

  const distLabel =
    distanceMetres < 1000
      ? `${Math.round(distanceMetres)}m away`
      : `${(distanceMetres / 1000).toFixed(1)}km away`;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Head this way</Text>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <View style={styles.arrowWrapper}>
          <View style={styles.arrowHead} />
          <View style={styles.arrowShaft} />
        </View>
      </Animated.View>
      <Text style={styles.distance}>{distLabel}</Text>
      {distanceMetres < 15 && (
        <Text style={styles.arrivedHint}>You should be there — look around!</Text>
      )}
    </View>
  );
}

const ARROW_COLOR = "#4A90E2";

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    backgroundColor: "#fff",
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  label: {
    fontSize: 13,
    color: "#888",
    marginBottom: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  arrowWrapper: {
    alignItems: "center",
    height: 120,
    justifyContent: "flex-start",
  },
  arrowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 22,
    borderRightWidth: 22,
    borderBottomWidth: 44,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: ARROW_COLOR,
  },
  arrowShaft: {
    width: 14,
    height: 76,
    backgroundColor: ARROW_COLOR,
    borderRadius: 7,
  },
  distance: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: "700",
    color: "#222",
  },
  arrivedHint: {
    marginTop: 8,
    fontSize: 14,
    color: "#27AE60",
    fontWeight: "600",
  },
});