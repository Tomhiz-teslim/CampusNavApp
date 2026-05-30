import { useEffect, useState, useMemo } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Linking, Platform,
} from "react-native";
import * as Location from "expo-location";
import { router } from "expo-router";

// ─── Shuttle Routes Data ──────────────────────────────────────────
const SHUTTLE_ROUTES = [
  {
    id: "r1",
    name: "School Gate → Campus (CITS/New Hall)",
    description: "From the main school gate to campus, stopping at CITS and New Hall",
    startPoint: { name: "Main School Gate", latitude: 6.5176848, longitude: 3.3854527 },
    endPoint: { name: "Campus Center", latitude: 6.5180000, longitude: 3.3900000 },
    stops: [
      { name: "New Hall", latitude: 6.51920, longitude: 3.39090 },
      { name: "CITS", latitude: 6.5170000, longitude: 3.3875000 },
    ],
    color: "#1a5c38",
    emoji: "🚌",
    operatingHours: "6:00 AM - 8:00 PM",
    frequency: "Every 2-3 mins",
  },
  {
    id: "r2",
    name: "Gate → DLI (FSS Stop)",
    description: "From gate to DLI, stopping at Faculty of Social Sciences",
    startPoint: { name: "Main School Gate", latitude: 6.5173077, longitude: 3.3860083 },
    endPoint: { name: "DLI Center", latitude: 6.5150000, longitude: 3.3850000 },
    stops: [
      { name: "Faculty of Social Sciences", latitude: 6.51580, longitude: 3.39170 },
    ],
    color: "#1e6fad",
    emoji: "🚐",
    operatingHours: "6:30 AM - 7:30 PM",
    frequency: "Every 2-3 mins",
  },
  {
    id: "r3",
    name: "Campus → Gate (New Hall/Sports)",
    description: "From campus center to gate, stopping at New Hall and Sports Center",
    startPoint: { name: "Campus Center", latitude: 6.5178580, longitude: 3.3974170 },
    endPoint: { name: "Main School Gate", latitude: 6.5176848, longitude: 3.3854527 },
    stops: [
      { name: "New Hall", latitude: 6.51920, longitude: 3.39090 },
      { name: "Sports Center", latitude: 6.51850, longitude: 3.39200 },
    ],
    color: "#d97706",
    emoji: "🚌",
    operatingHours: "6:00 AM - 8:00 PM",
    frequency: "Every 2-3 mins",
  },
  {
    id: "r4",
    name: "DLI → Gate (New Hall/Sports)",
    description: "From DLI to gate, stopping at New Hall and Sports Center",
    startPoint: { name: "DLI Center", latitude: 6.5123607, longitude: 3.3906012 },
    endPoint: { name: "Main School Gate", latitude: 6.5173077, longitude: 3.3860083 },
    stops: [
      { name: "New Hall", latitude: 6.51920, longitude: 3.39090 },
      { name: "Sports Center", latitude: 6.51850, longitude: 3.39200 },
    ],
    color: "#9333ea",
    emoji: "🚐",
    operatingHours: "6:30 AM - 7:30 PM",
    frequency: "Every 2-3 mins",
  },
];

// ─── Utility: Calculate distance between two points (Haversine) ────
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── Route Card Component ─────────────────────────────────────────
interface RouteCardProps {
  route: (typeof SHUTTLE_ROUTES)[0];
  distance?: number;
  onPress: () => void;
}

function RouteCard({ route, distance, onPress }: RouteCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.routeCard, { borderLeftColor: route.color }]}
    >
      <View style={styles.routeCardHeader}>
        <View style={styles.routeCardTitleRow}>
          <Text style={styles.routeEmoji}>{route.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeName}>{route.name}</Text>
            <Text style={styles.routeDesc}>{route.description}</Text>
          </View>
        </View>
        {distance !== undefined && (
          <View style={[styles.distanceBadge, { backgroundColor: route.color + "15" }]}>
            <Text style={[styles.distanceText, { color: route.color }]}>
              📍 {distance < 0.1 ? "< 0.1" : distance.toFixed(2)} km
            </Text>
          </View>
        )}
      </View>

      <View style={styles.routeCardDetails}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>⏰ Hours</Text>
          <Text style={styles.detailValue}>{route.operatingHours}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>⏱️ Frequency</Text>
          <Text style={styles.detailValue}>{route.frequency}</Text>
        </View>
      </View>

      <View style={styles.routeStops}>
        <Text style={styles.stopsLabel}>Stops ({route.stops.length})</Text>
        <View style={styles.stopsList}>
          {route.stops.map((stop, idx) => (
            <View key={idx} style={styles.stopBadge}>
              <Text style={styles.stopBadgeText}>{stop.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.routeCardFooter}>
        <Text style={[styles.viewDetailsBtn, { color: route.color }]}>
          View Details →
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Route Detail Modal Content ────────────────────────────────────
interface RouteDetailProps {
  route: (typeof SHUTTLE_ROUTES)[0];
  userLocation?: { latitude: number; longitude: number };
  onClose: () => void;
}

function RouteDetailModal({ route, userLocation, onClose }: RouteDetailProps) {
  const startDistance = userLocation
    ? calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        route.startPoint.latitude,
        route.startPoint.longitude
      )
    : null;

    const handleGetDirections = () => {
    onClose();
    router.push({
        pathname: "/home",  // correct - it's app/home.tsx
        params: {
        eventLat: String(route.startPoint.latitude),
        eventLng: String(route.startPoint.longitude),
        eventName: route.name,
        eventIcon: route.emoji,
        eventDesc: route.description,
        },
    });
    };
  return (
    <View style={styles.detailModal}>
      <ScrollView
        contentContainerStyle={styles.detailContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={[styles.detailHeader, { backgroundColor: route.color + "10" }]}
        >
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.detailTitle}>{route.name}</Text>
          <View style={{ width: 30 }} />
        </View>

        {/* Route Overview */}
        <View style={styles.detailSection}>
          <Text style={styles.sectionTitle}>Route Overview</Text>
          <Text style={styles.routeDescription}>{route.description}</Text>

          <View style={styles.routeFlow}>
            <View style={styles.flowPoint}>
              <View style={[styles.flowDot, { backgroundColor: route.color }]} />
              <Text style={styles.flowText}>{route.startPoint.name}</Text>
            </View>

            {route.stops.map((stop, idx) => (
              <View key={idx}>
                <View style={styles.flowLine} />
                <View style={styles.flowPoint}>
                  <View style={[styles.flowDot, { backgroundColor: route.color }]} />
                  <Text style={styles.flowText}>{stop.name}</Text>
                </View>
              </View>
            ))}

            <View>
              <View style={styles.flowLine} />
              <View style={styles.flowPoint}>
                <View style={[styles.flowDot, { backgroundColor: route.color }]} />
                <Text style={styles.flowText}>{route.endPoint.name}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Operating Information */}
        <View style={styles.detailSection}>
          <Text style={styles.sectionTitle}>Schedule</Text>
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>🕐</Text>
              <View>
                <Text style={styles.infoLabel}>Operating Hours</Text>
                <Text style={styles.infoValue}>{route.operatingHours}</Text>
              </View>
            </View>
            <View style={[styles.infoRow, { marginTop: 12 }]}>
              <Text style={styles.infoIcon}>⏱️</Text>
              <View>
                <Text style={styles.infoLabel}>Frequency</Text>
                <Text style={styles.infoValue}>{route.frequency}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stops Details */}
        <View style={styles.detailSection}>
          <Text style={styles.sectionTitle}>All Stops</Text>
          {route.stops.map((stop, idx) => (
            <View key={idx} style={styles.stopDetailItem}>
              <View style={[styles.stopDetailDot, { backgroundColor: route.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.stopDetailName}>{stop.name}</Text>
                <Text style={styles.stopDetailCoords}>
                  {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Distance Info */}
        {startDistance !== null && (
          <View style={[styles.detailSection, { backgroundColor: "#f0faf4" }]}>
            <Text style={styles.sectionTitle}>📍 Distance to Start</Text>
            <Text style={styles.distanceInfo}>
              {startDistance < 0.1
                ? "You are at or very near the starting point! 🎯"
                : `${startDistance.toFixed(2)} km away`}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.detailActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: route.color }]}
            onPress={handleGetDirections}
          >
            <Text style={styles.actionBtnText}>🗺️ Get Directions</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#ddd" }]}
            onPress={onClose}
          >
            <Text style={[styles.actionBtnText, { color: "#555" }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Main Shuttle Screen ──────────────────────────────────────────
export default function ShuttleScreen() {
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRoute, setSelectedRoute] = useState<(typeof SHUTTLE_ROUTES)[0] | null>(null);
  const [sortBy, setSortBy] = useState<"nearest" | "name">("nearest");

  useEffect(() => {
    requestLocationPermission();
  }, []);

  async function requestLocationPermission() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        fetchLocation();
      } else {
        setError("Location permission not granted. Tap to enable.");
      }
      setLoading(false);
    } catch {
      setError("Could not request location permission");
      setLoading(false);
    }
  }

  async function fetchLocation() {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      setError("");
    } catch {
      setError("Could not get your location. Check GPS settings.");
    }
  }

  // Calculate distances from user to each route's start point
  const routesWithDistance = useMemo(() => {
    if (!userLocation) return SHUTTLE_ROUTES.map(r => ({ ...r, distance: undefined }));

    return SHUTTLE_ROUTES.map(route => ({
      ...route,
      distance: calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        route.startPoint.latitude,
        route.startPoint.longitude
      ),
    }));
  }, [userLocation]);

  // Sort routes
  const sortedRoutes = useMemo(() => {
    const routes = [...routesWithDistance];
    if (sortBy === "nearest" && userLocation) {
      return routes.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    }
    return routes.sort((a, b) => a.name.localeCompare(b.name));
  }, [routesWithDistance, sortBy, userLocation]);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🚌 Shuttle Routes</Text>
        <Text style={styles.headerSub}>Navigate campus with ease</Text>
      </View>

      {/* Error Banner */}
      {error && (
        <TouchableOpacity
          style={styles.errorBanner}
          onPress={fetchLocation}
        >
          <Text style={styles.errorText}>⚠️ {error} Tap to retry</Text>
        </TouchableOpacity>
      )}

      {/* Sort Controls */}
      <View style={styles.sortBar}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <TouchableOpacity
          style={[
            styles.sortBtn,
            sortBy === "nearest" && styles.sortBtnActive,
          ]}
          onPress={() => setSortBy("nearest")}
          disabled={!userLocation}
        >
          <Text
            style={[
              styles.sortBtnText,
              sortBy === "nearest" && styles.sortBtnTextActive,
            ]}
          >
            📍 Nearest
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.sortBtn,
            sortBy === "name" && styles.sortBtnActive,
          ]}
          onPress={() => setSortBy("name")}
        >
          <Text
            style={[
              styles.sortBtnText,
              sortBy === "name" && styles.sortBtnTextActive,
            ]}
          >
            A-Z Name
          </Text>
        </TouchableOpacity>
      </View>

      {/* Loading State */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1a5c38" />
          <Text style={styles.loadingText}>Getting your location…</Text>
        </View>
      ) : (
        /* Routes List */
        <ScrollView
          style={styles.routesList}
          contentContainerStyle={styles.routesListContent}
          showsVerticalScrollIndicator={false}
        >
          {sortedRoutes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🚌</Text>
              <Text style={styles.emptyText}>No shuttle routes available</Text>
            </View>
          ) : (
            sortedRoutes.map(route => (
              <RouteCard
                key={route.id}
                route={route}
                distance={route.distance}
                onPress={() => setSelectedRoute(route)}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Route Detail Modal */}
      {selectedRoute && (
        <View style={styles.modalOverlay}>
          <RouteDetailModal
            route={selectedRoute}
            userLocation={userLocation || undefined}
            onClose={() => setSelectedRoute(null)}
          />
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  // Header
  header: {
    backgroundColor: "#1a5c38",
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
  headerSub: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
  },

  // Error Banner
  errorBanner: {
    backgroundColor: "#fffbec",
    borderBottomWidth: 1,
    borderColor: "#f0d070",
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
  },
  errorText: {
    color: "#b07d00",
    fontSize: 13,
    fontWeight: "600",
  },

  // Sort Bar
  sortBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#eee",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  sortLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
  },
  sortBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#f0f0f0",
  },
  sortBtnActive: {
    backgroundColor: "#1a5c38",
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  sortBtnTextActive: {
    color: "#fff",
  },

  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#666",
    fontSize: 14,
  },

  // Routes List
  routesList: {
    flex: 1,
  },
  routesListContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    paddingBottom: 20,
  },

  // Route Card
  routeCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderLeftWidth: 5,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  routeCardHeader: {
    marginBottom: 12,
  },
  routeCardTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  routeEmoji: {
    fontSize: 28,
  },
  routeName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#222",
    marginBottom: 3,
  },
  routeDesc: {
    fontSize: 12,
    color: "#888",
    lineHeight: 16,
  },
  distanceBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  distanceText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Route Card Details
  routeCardDetails: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#f0f0f0",
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: "#999",
    fontWeight: "600",
    marginBottom: 3,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#333",
  },

  // Route Stops
  routeStops: {
    marginBottom: 10,
  },
  stopsLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
    marginBottom: 8,
  },
  stopsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  stopBadge: {
    backgroundColor: "#f5f5f5",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  stopBadgeText: {
    fontSize: 11,
    color: "#555",
    fontWeight: "600",
  },

  // Route Card Footer
  routeCardFooter: {
    paddingTop: 10,
    alignItems: "center",
  },
  viewDetailsBtn: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Detail Modal
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  detailModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  detailContent: {
    paddingBottom: 30,
  },

  // Detail Header
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: "#f0f0f0",
  },
  closeBtn: {
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: {
    fontSize: 20,
    color: "#666",
    fontWeight: "600",
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
    flex: 1,
    textAlign: "center",
  },

  // Detail Section
  detailSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: "#f0f0f0",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#222",
    marginBottom: 12,
  },
  routeDescription: {
    fontSize: 13,
    color: "#666",
    lineHeight: 20,
  },

  // Route Flow
  routeFlow: {
    marginTop: 16,
    marginLeft: 8,
  },
  flowPoint: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  flowDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  flowLine: {
    width: 2,
    height: 16,
    backgroundColor: "#ddd",
    marginLeft: 5,
  },
  flowText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },

  // Info Box
  infoBox: {
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoIcon: {
    fontSize: 18,
  },
  infoLabel: {
    fontSize: 11,
    color: "#999",
    fontWeight: "600",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
  },

  // Stop Detail Item
  stopDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#f0f0f0",
    gap: 12,
  },
  stopDetailDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stopDetailName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
    marginBottom: 2,
  },
  stopDetailCoords: {
    fontSize: 11,
    color: "#999",
  },

  // Distance Info
  distanceInfo: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1a5c38",
  },

  // Detail Actions
  detailActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 15,
    color: "#999",
  },
});