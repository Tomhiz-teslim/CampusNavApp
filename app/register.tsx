import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { auth, database } from "../lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { ref, set } from "firebase/database";
import { router } from "expo-router";

const FACULTIES = [
  "Arts", "Business Administration", "Education", "Engineering",
  "Environmental Sciences", "Law", "Medicine", "Pharmacy",
  "Sciences", "Social Sciences", "Veterinary Medicine",
];

export default function RegisterScreen() {
  const [fullName, setFullName] = useState("");
  const [matricNo, setMatricNo] = useState("");
  const [email, setEmail] = useState("");
  const [faculty, setFaculty] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join UniLag Navigator</Text>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
            </View>
          ) : null}

          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor="#999"
            value={fullName}
            onChangeText={(t) => { setFullName(t); setErrorMsg(""); }}
            autoCapitalize="words"
          />

          <TextInput
            style={styles.input}
            placeholder="Matric number (optional)"
            placeholderTextColor="#999"
            value={matricNo}
            onChangeText={(t) => { setMatricNo(t); setErrorMsg(""); }}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="#999"
            value={email}
            onChangeText={(t) => { setEmail(t); setErrorMsg(""); }}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.input, styles.facultyPicker]}
            onPress={() => setShowFaculties(!showFaculties)}
          >
            <Text style={faculty ? styles.facultySelected : styles.facultyPlaceholder}>
              {faculty || "Select faculty (optional)"}
            </Text>
            <Text style={styles.arrow}>{showFaculties ? "▲" : "▼"}</Text>
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

          <TextInput
            style={styles.input}
            placeholder="Password (min 6 characters)"
            placeholderTextColor="#999"
            value={password}
            onChangeText={(t) => { setPassword(t); setErrorMsg(""); }}
            secureTextEntry
          />

          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor="#999"
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); setErrorMsg(""); }}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.btn}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Create Account</Text>}
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace("/login")}>
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a5c38",
  },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    paddingVertical: 40,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 28,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#1a5c38",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginBottom: 24,
  },
  errorBox: {
    backgroundColor: "#fff0f0",
    borderWidth: 1,
    borderColor: "#ffcccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: "#cc0000",
    fontSize: 13,
    textAlign: "center",
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    marginBottom: 14,
    color: "#333",
  },
  facultyPicker: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  facultyPlaceholder: {
    color: "#999",
    fontSize: 15,
  },
  facultySelected: {
    color: "#333",
    fontSize: 15,
  },
  arrow: {
    color: "#999",
    fontSize: 12,
  },
  dropdown: {
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    marginBottom: 14,
    marginTop: -8,
    overflow: "hidden",
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dropdownText: {
    fontSize: 15,
    color: "#333",
  },
  btn: {
    backgroundColor: "#1a5c38",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginTop: 4,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  loginText: {
    color: "#888",
    fontSize: 13,
  },
  loginLink: {
    color: "#1a5c38",
    fontSize: 13,
    fontWeight: "700",
  },
});