import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { auth } from "../lib/firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";

import { router } from "expo-router";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function handleLogin() {
    setErrorMsg("");
    if (!email || !password) {
      setErrorMsg("Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);

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

  if (resetMode) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.card}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>We'll send a reset link to your email</Text>
          {errorMsg ? <View style={styles.errorBox}><Text style={styles.errorText}>⚠️ {errorMsg}</Text></View> : null}
          {successMsg ? <View style={styles.successBox}><Text style={styles.successText}>✅ {successMsg}</Text></View> : null}
          <TextInput
            style={styles.input} placeholder="Email address" placeholderTextColor="#999"
            value={resetEmail} onChangeText={(t) => { setResetEmail(t); setErrorMsg(""); setSuccessMsg(""); }}
            keyboardType="email-address" autoCapitalize="none" autoFocus
          />
          <TouchableOpacity style={styles.btn} onPress={handleForgotPassword} disabled={resetLoading}>
            {resetLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send Reset Link</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={() => setResetMode(false)}>
            <Text style={styles.linkText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>UniLag Navigator</Text>
          <Text style={styles.subtitle}>Campus Navigation System</Text>
          {errorMsg ? <View style={styles.errorBox}><Text style={styles.errorText}>⚠️ {errorMsg}</Text></View> : null}
          <TextInput
            style={styles.input} placeholder="Email address" placeholderTextColor="#999"
            value={email} onChangeText={(t) => { setEmail(t); setErrorMsg(""); }}
            keyboardType="email-address" autoCapitalize="none"
          />
          <TextInput
            style={styles.input} placeholder="Password" placeholderTextColor="#999"
            value={password} onChangeText={(t) => { setPassword(t); setErrorMsg(""); }}
            secureTextEntry
          />
          <TouchableOpacity onPress={() => { setResetMode(true); setErrorMsg(""); }} style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Login</Text>}
          </TouchableOpacity>
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.replace("/register")}>
              <Text style={styles.registerLink}>Register</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a5c38" },
  scroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 28, width: "100%",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, elevation: 5,
  },
  title: { fontSize: 26, fontWeight: "bold", color: "#1a5c38", textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#888", textAlign: "center", marginBottom: 24 },
  errorBox: { backgroundColor: "#fff0f0", borderWidth: 1, borderColor: "#ffcccc", borderRadius: 8, padding: 12, marginBottom: 14 },
  errorText: { color: "#cc0000", fontSize: 13, textAlign: "center" },
  successBox: { backgroundColor: "#f0fff4", borderWidth: 1, borderColor: "#99eebb", borderRadius: 8, padding: 12, marginBottom: 14 },
  successText: { color: "#1a5c38", fontSize: 13, textAlign: "center" },
  input: { borderWidth: 1.5, borderColor: "#e0e0e0", borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 14, color: "#333" },
  forgotBtn: { alignSelf: "flex-end", marginBottom: 16, marginTop: -6 },
  forgotText: { color: "#1a5c38", fontSize: 13, fontWeight: "600" },
  btn: { backgroundColor: "#1a5c38", borderRadius: 10, padding: 15, alignItems: "center", marginTop: 4 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  linkBtn: { marginTop: 16, alignItems: "center" },
  linkText: { color: "#1a5c38", fontSize: 14, fontWeight: "600" },
  registerRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  registerText: { color: "#888", fontSize: 13 },
  registerLink: { color: "#1a5c38", fontSize: 13, fontWeight: "700" },
});