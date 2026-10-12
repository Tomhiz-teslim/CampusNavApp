import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TextInputProps, TouchableOpacity,
  Image, ImageBackground, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { Compass, Eye, EyeOff, Lock, LogIn, Mail } from "lucide-react-native";
import { auth, database } from "../lib/firebase";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  // GoogleAuthProvider,
  // signInWithCredential,
} from "firebase/auth";
import { ref, get, set } from "firebase/database";
// import * as WebBrowser from "expo-web-browser";
// import * as Google from "expo-auth-session/providers/google";
import { router } from "expo-router";

// ── Google Sign-In: fully wired below, just disabled for now. ──────────────
// later on i will make it possible when i want to upload the app to Play
// store and app store (Google OAuth needs the app to be on a signed release
// build / store listing to fully validate — re-enable by uncommenting the
// imports above and the block marked GOOGLE SIGN-IN below, then pointing the
// Google button's onPress at handleGoogleSignIn).

// WebBrowser.maybeCompleteAuthSession();

// const GOOGLE_WEB_CLIENT_ID = "407873622972-bru14q2e9qvc9lb2nvasgl9g6l0h2n15.apps.googleusercontent.com";
// const GOOGLE_ANDROID_CLIENT_ID = "407873622972-iik25a7m5qe5ki9ep5rrhsijpdqd2ukb.apps.googleusercontent.com";
// const GOOGLE_IOS_CLIENT_ID = "407873622972-q338efs78bc2q6326f10of1t267pti54.apps.googleusercontent.com";

const GREEN = "#0f5c36";
const MUTED_BLUE = "#8aa4c8";

// ── Shared pieces ────────────────────────────────────────────────────────────
function AuthHeader() {
  return (
    <ImageBackground
      source={require("../assets/images/loginbck.jpg")}
      style={styles.header}
      resizeMode="cover"
    >
      <View style={styles.headerOverlay} />
      <Image
        source={require("../assets/images/logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.tagline}>
        Find your way around the University of Lagos, see events and connect
        with friends.
      </Text>
    </ImageBackground>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthHeader />
        <View style={styles.card}>{children}</View>
        <View style={styles.compassCircle} pointerEvents="none">
          <Compass size={26} color="#fff" strokeWidth={1.8} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  icon,
  right,
  ...props
}: { icon: React.ReactNode; right?: React.ReactNode } & TextInputProps) {
  return (
    <View style={styles.field}>
      {icon}
      <TextInput
        style={styles.fieldInput}
        placeholderTextColor="#8aa0bd"
        {...props}
      />
      {right}
    </View>
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // const [googleLoading, setGoogleLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ── GOOGLE SIGN-IN (disabled — see note above) ──────────────────────────
  // const [request, response, promptAsync] = Google.useAuthRequest({
  //   webClientId: GOOGLE_WEB_CLIENT_ID,
  //   androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  //   iosClientId: GOOGLE_IOS_CLIENT_ID,
  // });

  // useEffect(() => {
  //   if (response?.type === "success") {
  //     const { id_token } = response.params;
  //     handleGoogleCredential(id_token);
  //   } else if (response?.type === "error") {
  //     setErrorMsg("Google sign-in failed. Please try again.");
  //     setGoogleLoading(false);
  //   } else if (response?.type === "cancel" || response?.type === "dismiss") {
  //     setGoogleLoading(false);
  //   }
  // }, [response]);

  // async function handleGoogleCredential(idToken: string) {
  //   setErrorMsg("");
  //   try {
  //     const credential = GoogleAuthProvider.credential(idToken);
  //     const { user } = await signInWithCredential(auth, credential);

  //     const userRef = ref(database, "users/" + user.uid);
  //     const snap = await get(userRef);
  //     if (!snap.exists()) {
  //       await set(userRef, {
  //         fullName: user.displayName || "",
  //         matricNo: "",
  //         email: user.email || "",
  //         faculty: "",
  //         createdAt: Date.now(),
  //       });
  //     }

  //     router.replace("/home");
  //   } catch (error: any) {
  //     setErrorMsg(error.message || "Google sign-in failed. Please try again.");
  //   }
  //   setGoogleLoading(false);
  // }

  // async function handleGoogleSignIn() {
  //   setErrorMsg("");
  //   setSuccessMsg("");
  //   setGoogleLoading(true);
  //   try {
  //     const result = await promptAsync();
  //     if (result.type !== "success") {
  //       setGoogleLoading(false);
  //     }
  //   } catch {
  //     setErrorMsg("Could not start Google sign-in. Please try again.");
  //     setGoogleLoading(false);
  //   }
  // }
  // ─────────────────────────────────────────────────────────────────────────

  async function handleLogin() {
    setErrorMsg("");
    setSuccessMsg("");
    if (!email || !password) {
      setErrorMsg("Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      router.replace("/home");
    } catch (error: any) {
      setLoading(false);
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
        setErrorMsg("Invalid email or password");
      } else if (error.code === "auth/user-not-found") {
        setErrorMsg("No account found with this email");
      } else {
        setErrorMsg(error.message);
      }
    }
  }

  async function handleForgotPassword() {
    setErrorMsg("");
    setSuccessMsg("");
    if (!resetEmail) {
      setErrorMsg("Please enter your email");
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim().toLowerCase());
      setResetLoading(false);
      setSuccessMsg("Password reset email sent!");
    } catch (error: any) {
      setResetLoading(false);
      setErrorMsg(error.message);
    }
  }

  const messages = (
    <>
      {errorMsg ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
        </View>
      ) : null}
      {successMsg ? (
        <View style={styles.successBox}>
          <Text style={styles.successText}>✅ {successMsg}</Text>
        </View>
      ) : null}
    </>
  );

  if (resetMode) {
    return (
      <Shell>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>We'll send a reset link to your email</Text>
        {messages}
        <Field
          icon={<Mail size={22} color={GREEN} strokeWidth={2.2} />}
          placeholder="Email address"
          value={resetEmail}
          onChangeText={(t) => { setResetEmail(t); setErrorMsg(""); setSuccessMsg(""); }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoFocus
        />
        <TouchableOpacity style={styles.btn} onPress={handleForgotPassword} disabled={resetLoading}>
          {resetLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send Reset Link</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => { setResetMode(false); setErrorMsg(""); setSuccessMsg(""); }}
        >
          <Text style={styles.registerLink}>Back to Login</Text>
        </TouchableOpacity>
      </Shell>
    );
  }

  return (
    <Shell>
      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>Log in to your Campus Navigator account</Text>
      {messages}

      <Field
        icon={<Mail size={22} color={GREEN} strokeWidth={2.2} />}
        placeholder="Email address"
        value={email}
        onChangeText={(t) => { setEmail(t); setErrorMsg(""); setSuccessMsg(""); }}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Field
        icon={<Lock size={22} color={GREEN} strokeWidth={2.2} />}
        placeholder="Password"
        value={password}
        onChangeText={(t) => { setPassword(t); setErrorMsg(""); setSuccessMsg(""); }}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        right={
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {showPassword ? (
              <Eye size={22} color="#4b5563" strokeWidth={2.2} />
            ) : (
              <EyeOff size={22} color="#4b5563" strokeWidth={2.2} />
            )}
          </TouchableOpacity>
        }
      />

      <TouchableOpacity
        onPress={() => { setResetMode(true); setErrorMsg(""); setSuccessMsg(""); }}
        style={styles.forgotBtn}
      >
        <Text style={styles.forgotText}>Forgot password?</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <LogIn size={24} color="#fff" strokeWidth={2.2} />
            <Text style={styles.btnText}>Log In</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Google Sign-In is still disabled — see the commented block above.
          To enable it later, replace this onPress with handleGoogleSignIn. */}
      <TouchableOpacity
        style={styles.googleBtn}
        activeOpacity={0.85}
        onPress={() => {
          setErrorMsg("");
          setSuccessMsg("Google Sign-In is coming soon");
        }}
      >
        <Text style={styles.googleG}>G</Text>
        <Text style={styles.googleText}>Continue with Google</Text>
      </TouchableOpacity>

      <View style={styles.registerRow}>
        <Text style={styles.registerText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => router.replace("/register")}>
          <Text style={styles.registerLink}>Create Account</Text>
        </TouchableOpacity>
      </View>
    </Shell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: GREEN },
  scroll: { flexGrow: 1 },

  header: {
    height: 300,
    paddingTop: Platform.OS === "ios" ? 70 : 52,
    paddingHorizontal: 24,
    backgroundColor: GREEN,
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12,84,48,0.72)",
  },
  logo: { width: 290, height: 110, marginLeft: -6 },
  tagline: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 10,
    maxWidth: 330,
  },

  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    marginTop: -34,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 60,
  },
  compassCircle: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(15,92,54,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },

  title: { fontSize: 32, fontWeight: "800", color: GREEN, marginBottom: 6 },
  subtitle: { fontSize: 16, fontWeight: "600", color: MUTED_BLUE, marginBottom: 24 },

  errorBox: { backgroundColor: "#fff0f0", borderWidth: 1, borderColor: "#ffcccc", borderRadius: 12, padding: 12, marginBottom: 14 },
  errorText: { color: "#cc0000", fontSize: 13, textAlign: "center" },
  successBox: { backgroundColor: "#f0fff4", borderWidth: 1, borderColor: "#99eebb", borderRadius: 12, padding: 12, marginBottom: 14 },
  successText: { color: GREEN, fontSize: 13, textAlign: "center" },

  field: {
    flexDirection: "row",
    alignItems: "center",
    height: 60,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d6e0ea",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 18,
    marginBottom: 16,
    gap: 16,
  },
  fieldInput: { flex: 1, fontSize: 16, color: "#1f2937", height: "100%" },

  forgotBtn: { alignSelf: "flex-end", marginTop: -4, marginBottom: 18 },
  forgotText: { color: GREEN, fontSize: 14, fontWeight: "700" },

  btn: {
    height: 60,
    borderRadius: 16,
    backgroundColor: GREEN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  btnText: { color: "#fff", fontSize: 19, fontWeight: "700" },
  linkBtn: { marginTop: 18, alignItems: "center" },

  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#d6e0ea" },
  dividerText: { marginHorizontal: 14, color: MUTED_BLUE, fontSize: 14, fontWeight: "600" },

  googleBtn: {
    height: 60,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d6e0ea",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  googleG: { fontSize: 24, fontWeight: "800", color: "#4285F4" },
  googleText: { fontSize: 17, fontWeight: "700", color: "#0f3a5f" },

  registerRow: { flexDirection: "row", justifyContent: "center", marginTop: 26 },
  registerText: { color: MUTED_BLUE, fontSize: 15, fontWeight: "500" },
  registerLink: { color: GREEN, fontSize: 15, fontWeight: "800" },
});