import { useEffect, useState } from "react";
import { Stack, router, useRootNavigationState, useSegments } from "expo-router";
import { auth } from "../lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import SplashScreen from "./splash";
import ErrorBoundary from "./ErrorBoundary";

// Screens that don't require a signed-in user.
const PUBLIC_ROUTES = new Set(["login", "register"]);

export default function RootLayout() {
  const rootState = useRootNavigationState();
  const segments = useSegments();

  const [user, setUser] = useState<User | null>(null);
  // `initializing` is true until Firebase has told us, at least once,
  // whether a session is persisted. We keep the splash screen up for
  // that whole window so nothing else can flash on screen first.
  const [initializing, setInitializing] = useState(true);

  // Keep the splash up for at least 5s regardless of how fast Firebase
  // resolves, so it doesn't just flash by on a fast connection.
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), 3000);
    return () => clearTimeout(t);
  }, []);

  // Subscribe to auth state once. onAuthStateChanged fires immediately
  // with the persisted session (if any) on startup, then again on every
  // sign-in/sign-out — so this single listener drives all navigation.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  // Redirect based on auth state, but only after the router is mounted
  // and the initial auth check has resolved — this is what prevents the
  // flicker between splash/login/home on cold start.
  useEffect(() => {
    if (!rootState?.key || initializing || !minTimeElapsed) return;

    const currentRoute = segments[0] ?? "";
    const onPublicRoute = PUBLIC_ROUTES.has(currentRoute);

    if (!user && !onPublicRoute) {
      // Not authenticated and trying to view a protected screen.
      router.replace("/login");
    } else if (user && onPublicRoute) {
      // Authenticated but sitting on login/register (e.g. after a
      // successful login, or reopening the app with a saved session).
      router.replace("/home");
    }
  }, [rootState?.key, initializing, minTimeElapsed, user, segments]);

  // Keep the splash screen mounted until we know the auth state. This
  // is the "no flickering" requirement: we never briefly render login
  // or home before the redirect above has a chance to run.
  if (initializing || !minTimeElapsed) {
    return <SplashScreen />;
  }

  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="home" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="account" />
        <Stack.Screen name="events" />
        <Stack.Screen name="cafeteria" />
        <Stack.Screen name="shuttle" />
        <Stack.Screen name="submit-location" />
        <Stack.Screen name="emergency" />
        <Stack.Screen name="campus-directory" />
        <Stack.Screen name="help-support" />
        <Stack.Screen name="about" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="map" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ErrorBoundary>
  );
}