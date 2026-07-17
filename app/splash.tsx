import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";

const { width } = Dimensions.get("window");

// NOTE: This screen is purely presentational. It used to navigate to
// /login on a hardcoded 3s timer, which raced with the auth check in
// _layout.tsx — that race is what caused logged-in users to sometimes
// flicker back to the login screen on cold start. All navigation
// decisions now live in _layout.tsx, driven by Firebase auth state.
export default function SplashScreen() {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <Animated.Image
          source={require("../assets/images/app_logo.png")}
          style={[styles.logo, { opacity, transform: [{ scale }] }]}
          resizeMode="contain"
        />
      </View>
      <Animated.View style={[styles.brandTag, { opacity }]}>
        <Text style={styles.brandFrom}>from</Text>
        <Text style={styles.brandName}>EVEN Technologies</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: width * 0.85,
    height: width * 0.85,
  },
  brandTag: {
    alignItems: "center",
    paddingBottom: 48,
  },
  brandFrom: {
    fontSize: 13,
    color: "#999",
    marginBottom: 2,
  },
  brandName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a5c38",
    letterSpacing: 0.3,
  },
});