import { useState } from "react";
import {
  View, Text, TextInput, TextInputProps, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import {
  ChevronDown, ChevronLeft, ChevronUp, Eye, EyeOff, GraduationCap,
  Landmark, Lock, Mail, User, UserPlus,
} from "lucide-react-native";
import { auth, database } from "../lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { ref, set } from "firebase/database";
import { router } from "expo-router";

const GREEN = "#0f5c36";
const MUTED = "#6b7f99";

const FACULTIES = [
  "Arts", "Business Administration", "Education", "Engineering",
  "Environmental Sciences", "Law", "Medicine", "Pharmacy",
  "Sciences", "Social Sciences", "Veterinary Medicine",
];

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
        placeholderTextColor="#7b8ea8"
        {...props}
      />
      {right}
    </View>
  );
}

export default function RegisterScreen() {
  const [fullName, setFullName] = useState("");
  const [matricNo, setMatricNo] = useState("");
  const [email, setEmail] = useState("");
  const [faculty, setFaculty] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showFaculties, setShowFaculties] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleRegister() {
    setErrorMsg("");

    if (!fullName || !email || !password || !confirmPassword) {
      setErrorMsg("Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const { user } = await createUserWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );

      await updateProfile(user, { displayName: fullName });

      await set(ref(database, "users/" + user.uid), {
        fullName,
        matricNo,
        email: email.trim().toLowerCase(),
        faculty,
        createdAt: Date.now(),
      });

      setLoading(false);
      Alert.alert(
        "Account Created!",
        "You can now use the app.",
        [{ text: "Continue", onPress: () => router.replace("/home") }]
      );

    } catch (error: any) {
      setLoading(false);
      if (error.code === "auth/email-already-in-use") {
        setErrorMsg("An account with this email already exists");
      } else if (error.code === "auth/invalid-email") {
        setErrorMsg("Please enter a valid email address");
      } else {
        setErrorMsg(error.message);
      }
    }
  }

  const iconProps = { size: 22, color: GREEN, strokeWidth: 2 };

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
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerShine} />
          <TouchableOpacity
            onPress={() => router.replace("/login")}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.backBtn}
          >
            <ChevronLeft size={30} color="#fff" strokeWidth={2.4} />
          </TouchableOpacity>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join Campus Navigator</Text>
          <View style={styles.stepsRow}>
            <View style={[styles.step, styles.stepActive]} />
            <View style={styles.step} />
            <View style={styles.step} />
          </View>
        </View>

        {/* ── Form card ── */}
        <View style={styles.card}>
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
            </View>
          ) : null}

          <Field
            icon={<User {...iconProps} />}
            placeholder="Full name"
            value={fullName}
            onChangeText={(t) => { setFullName(t); setErrorMsg(""); }}
            autoCapitalize="words"
          />

          <Field
            icon={<GraduationCap {...iconProps} />}
            placeholder="Matriculation number (optional)"
            value={matricNo}
            onChangeText={(t) => { setMatricNo(t); setErrorMsg(""); }}
            autoCapitalize="none"
          />

          <Field
            icon={<Mail {...iconProps} />}
            placeholder="Email address"
            value={email}
            onChangeText={(t) => { setEmail(t); setErrorMsg(""); }}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={styles.field}
            activeOpacity={0.8}
            onPress={() => setShowFaculties(!showFaculties)}
          >
            <Landmark {...iconProps} />
            <Text
              style={[styles.facultyText, !faculty && { color: "#7b8ea8" }]}
              numberOfLines={1}
            >
              {faculty || "Select faculty (optional)"}
            </Text>
            {showFaculties ? (
              <ChevronUp size={22} color="#0b3d27" strokeWidth={2.4} />
            ) : (
              <ChevronDown size={22} color="#0b3d27" strokeWidth={2.4} />
            )}
          </TouchableOpacity>

          {showFaculties && (
            <View style={styles.dropdown}>
              {FACULTIES.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setFaculty(f);
                    setShowFaculties(false);
                    setErrorMsg("");
                  }}
                >
                  <Text style={styles.dropdownText}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Field
            icon={<Lock {...iconProps} />}
            placeholder="Password (min 6 characters)"
            value={password}
            onChangeText={(t) => { setPassword(t); setErrorMsg(""); }}
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

          <Field
            icon={<Lock {...iconProps} />}
            placeholder="Confirm password"
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); setErrorMsg(""); }}
            secureTextEntry={!showConfirm}
            autoCapitalize="none"
            right={
              <TouchableOpacity
                onPress={() => setShowConfirm((v) => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showConfirm ? (
                  <Eye size={22} color="#4b5563" strokeWidth={2.2} />
                ) : (
                  <EyeOff size={22} color="#4b5563" strokeWidth={2.2} />
                )}
              </TouchableOpacity>
            }
          />

          <TouchableOpacity
            style={styles.btn}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <UserPlus size={24} color="#86efac" strokeWidth={2.2} />
                <Text style={styles.btnText}>Create Account</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace("/login")}>
              <Text style={styles.loginLink}>Log In</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footerTag}>Explore  ·  Navigate  ·  Discover</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { flexGrow: 1 },

  header: {
    backgroundColor: GREEN,
    paddingTop: Platform.OS === "ios" ? 64 : 46,
    paddingHorizontal: 24,
    paddingBottom: 44,
    overflow: "hidden",
  },
  headerShine: {
    position: "absolute",
    right: -60,
    top: -80,
    width: 200,
    height: 460,
    backgroundColor: "rgba(255,255,255,0.07)",
    transform: [{ rotate: "28deg" }],
  },
  backBtn: { alignSelf: "flex-start", marginBottom: 22, marginLeft: -6 },
  title: { fontSize: 38, fontWeight: "800", color: "#fff" },
  subtitle: { fontSize: 20, color: "rgba(255,255,255,0.78)", marginTop: 6, fontWeight: "500" },
  stepsRow: { flexDirection: "row", gap: 12, marginTop: 22 },
  step: { width: 52, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)" },
  stepActive: { backgroundColor: "#22c55e" },

  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    marginTop: -30,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 36,
  },

  errorBox: { backgroundColor: "#fff0f0", borderWidth: 1, borderColor: "#ffcccc", borderRadius: 12, padding: 12, marginBottom: 14 },
  errorText: { color: "#cc0000", fontSize: 13, textAlign: "center" },

  field: {
    flexDirection: "row",
    alignItems: "center",
    height: 60,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d6e0ea",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 18,
    marginBottom: 14,
    gap: 16,
  },
  fieldInput: { flex: 1, fontSize: 16, color: "#1f2937", height: "100%" },
  facultyText: { flex: 1, fontSize: 16, color: "#1f2937" },

  dropdown: {
    borderWidth: 1,
    borderColor: "#d6e0ea",
    borderRadius: 16,
    marginTop: -6,
    marginBottom: 14,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  dropdownItem: { paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: "#f0f3f6" },
  dropdownText: { fontSize: 15, color: "#1f2937" },

  btn: {
    height: 62,
    borderRadius: 16,
    backgroundColor: GREEN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 6,
  },
  btnText: { color: "#fff", fontSize: 19, fontWeight: "700" },

  loginRow: { flexDirection: "row", justifyContent: "center", marginTop: 22 },
  loginText: { color: MUTED, fontSize: 15 },
  loginLink: { color: GREEN, fontSize: 15, fontWeight: "800" },

  footerTag: {
    textAlign: "right",
    color: GREEN,
    fontSize: 12,
    marginTop: 44,
  },
});