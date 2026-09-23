import { ComponentType } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { LucideProps } from "lucide-react-native";
import { TrustChip } from "./TrustChip";
import { formatPriceRange, isOpenNow, type ServiceListing } from "../lib/serviceShared";

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
  /** Use in narrow horizontal-scroll contexts (e.g. "Near You") — stacks
   * icon-over-text instead of squeezing a row layout into a fixed column width. */
  compact?: boolean;
  /** Vertical image-card layout for "Popular right now" style carousels. */
  featured?: boolean;
}

export function ServiceCardCompact({
  service,
  distanceM,
  categoryIcon: CategoryIcon,
  categoryLabel,
  onPress,
  compact = false,
  featured = false,
}: ServiceCardCompactProps) {
  const showRating = typeof service.rating === "number" && (service.ratingCount ?? 0) >= 3;
  const priceLabel = formatPriceRange(service.priceMin, service.priceMax);
  const openNow = isOpenNow(service.hours);

  if (featured) {
    return (
      <TouchableOpacity style={styles.featuredCard} onPress={onPress} activeOpacity={0.85}>
        <View style={styles.featuredImageWrap}>
          {service.photos?.[0] ? (
            <Image source={{ uri: service.photos[0] }} style={styles.featuredImage} />
          ) : (
            <View style={[styles.featuredImage, styles.featuredImagePlaceholder]}>
              <CategoryIcon size={26} color={GREEN} strokeWidth={2} />
            </View>
          )}
          {showRating && (
            <View style={styles.featuredRatingBadge}>
              <Text style={styles.featuredRatingText}>★ {service.rating!.toFixed(1)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.featuredName} numberOfLines={1}>{service.name}</Text>
        <Text style={styles.featuredCategory} numberOfLines={1}>{categoryLabel}</Text>
        {priceLabel && <Text style={styles.featuredPrice} numberOfLines={1}>{priceLabel}</Text>}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.iconCircle, compact && styles.iconCircleCompact]}>
        <CategoryIcon size={compact ? 18 : 22} color={GREEN} strokeWidth={2} />
      </View>

      <View style={compact ? undefined : styles.body}>
        <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1}>
          {service.name}
        </Text>
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

          {priceLabel ? <TrustChip variant="price" label={priceLabel} /> : null}

          {openNow != null ? <TrustChip variant="open" isOpen={openNow} /> : null}
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
  cardCompact: {
    flexDirection: "column",
    alignItems: "flex-start",
    marginBottom: 0,
    gap: 8,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GREEN_TINT,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleCompact: { width: 36, height: 36, borderRadius: 18 },
  body: { flex: 1 },
  name: { fontSize: 15.5, fontWeight: "800", color: "#1a1a1a", letterSpacing: -0.2 },
  nameCompact: { fontSize: 14 },
  category: { fontSize: 12, color: "#a3aba3", marginTop: 2, marginBottom: 6, fontWeight: "500" },
  chipRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },

  featuredCard: { width: 148 },
  featuredImageWrap: {
    width: 148, height: 108, borderRadius: 14, overflow: "hidden",
    marginBottom: 8, position: "relative",
  },
  featuredImage: { width: "100%", height: "100%" },
  featuredImagePlaceholder: { backgroundColor: GREEN_TINT, alignItems: "center", justifyContent: "center" },
  featuredRatingBadge: {
    position: "absolute", top: 6, right: 6,
    backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  featuredRatingText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  featuredName: { fontSize: 14, fontWeight: "800", color: "#1a1a1a" },
  featuredCategory: { fontSize: 12, color: "#a3aba3", marginTop: 2, fontWeight: "500" },
  featuredPrice: { fontSize: 12, color: GREEN, fontWeight: "700", marginTop: 3 },
});

export default ServiceCardCompact;