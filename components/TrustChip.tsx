import { Star, CheckCircle2, MapPin } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

const GREEN = "#1a5c38";

type TrustChipProps =
  | { variant: "rating"; value: number; count?: number }
  | { variant: "verified" }
  | { variant: "distance"; label: string };

export function TrustChip(props: TrustChipProps) {
  if (props.variant === "verified") {
    return (
      <View style={[styles.chip, styles.chipVerified]}>
        <CheckCircle2 size={12} color={GREEN} strokeWidth={2.4} />
        <Text style={[styles.text, styles.textVerified]}>Verified</Text>
      </View>
    );
  }

  if (props.variant === "rating") {
    return (
      <View style={styles.chip}>
        <Star size={12} color="#d97706" strokeWidth={2.2} fill="#d97706" />
        <Text style={styles.text}>
          {props.value.toFixed(1)}
          {props.count ? ` (${props.count})` : ""}
        </Text>
      </View>
    );
  }

  // distance
  return (
    <View style={styles.chip}>
      <MapPin size={12} color="#888" strokeWidth={2.2} />
      <Text style={styles.text} numberOfLines={1}>
        {props.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3F5F3",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    maxWidth: 160,
  },
  chipVerified: { backgroundColor: "#EAF6EE" },
  text: { fontSize: 11.5, fontWeight: "600", color: "#556155" },
  textVerified: { color: GREEN },
});

export default TrustChip;