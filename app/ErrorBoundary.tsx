import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

interface Props {
  children: React.ReactNode;
}
interface State {
  error: Error | null;
}

// Catches JS render errors anywhere below it in the tree and shows a
// recoverable screen instead of letting the whole app go down. This does
// NOT catch native crashes (a bad native module still takes the app down —
// see the AR gate in home.tsx for that class of problem) but it does catch
// the much more common case: a null/undefined access, a bad prop, a render
// exception in one screen. For a live demo, "tap to retry" beats a hard
// crash back to the home screen icon every time.
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          <TouchableOpacity style={styles.btn} onPress={this.reset}>
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center", padding: 32,
  },
  icon: { fontSize: 40, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  message: { fontSize: 13, color: "#888", textAlign: "center", marginBottom: 24 },
  btn: { backgroundColor: "#1a5c38", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});