import { useEffect } from "react";
import { Stack, router, useRootNavigationState } from "expo-router";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function RootLayout() {
  const rootState = useRootNavigationState();

  useEffect(() => {
    if (!rootState?.key) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/home");
      } else {
        router.replace("/login");
      }
    });
    return () => unsubscribe();
  }, [rootState?.key]);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="home" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="account" />
      <Stack.Screen name="events" />
      <Stack.Screen name="cafeteria" />
      <Stack.Screen name="splash" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}