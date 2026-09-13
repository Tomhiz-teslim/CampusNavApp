import { ComponentType } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { LucideProps } from "lucide-react-native";
import { TrustChip } from "./TrustChip";
import type { ServiceListing } from "../lib/serviceShared";

const GREEN = "#1a5c38";
const GREEN_TINT = "#EAF6EE";

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export interface ServiceCardCompactProps {
  service: ServiceListing;
  distanceM: number | null;
  categoryIcon: ComponentType<LucideProps>;
  categoryLabel: string;
  onPress: () => void;
}

export function ServiceCardCompact({
  service,
  distanceM,
  categoryIcon: CategoryIcon,
  categoryLabel,
  onPress,
}: ServiceCardCompactProps) {
  const showRating = typeof service.rating === "number" && (service.ratingCount ?? 0) >= 3;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.iconCircle}>
        <CategoryIcon size={22} color={GREEN} strokeWidth={2} />
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{service.name}</Text>
        <Text style={styles.category} numberOfLines={1}>{categoryLabel}</Text>

        <View style={styles.chipRow}>
          {showRating ? (
            <TrustChip variant="rating" value={service.rating!} count={service.ratingCount} />
          ) : service.verified ? (
            <TrustChip variant="verified" />
          ) : null}

          {distanceM != null ? (
            <TrustChip variant="distance" label={formatDistance(distanceM)} />
          ) : service.location ? (
            <TrustChip variant="distance" label={service.location} />
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GREEN_TINT,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  name: { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  category: { fontSize: 12, color: "#8a938a", marginTop: 1, marginBottom: 6, fontWeight: "500" },
  chipRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
});

export default ServiceCardCompact;