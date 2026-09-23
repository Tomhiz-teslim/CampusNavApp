import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Store } from "lucide-react-native";
import { GREEN } from "../lib/serviceShared";

export function ProviderBanner({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.wrap}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Become a Service Provider</Text>
        <Text style={styles.sub}>Grow your business. Reach more students.</Text>
        <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.85}>
          <Text style={styles.btnText}>List Your Service</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.iconWrap}>
        <Store size={44} color="#fff" strokeWidth={1.6} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center", backgroundColor: GREEN,
    borderRadius: 18, padding: 18, marginBottom: 18,
  },
  title: { color: "#fff", fontSize: 17, fontWeight: "800", marginBottom: 4 },
  sub: { color: "rgba(255,255,255,0.8)", fontSize: 12.5, marginBottom: 14 },
  btn: {
    alignSelf: "flex-start", backgroundColor: "#fff",
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9,
  },
  btnText: { color: GREEN, fontSize: 13, fontWeight: "700" },
  iconWrap: {
    width: 76, height: 76, borderRadius: 20, marginLeft: 12,
    backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center",
  },
});