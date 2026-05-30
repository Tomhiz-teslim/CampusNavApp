import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { database } from "../lib/firebase";
import { ref, onValue } from "firebase/database";

interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  time: string;
  category: string;
  locationName: string;
  location: string;
  latitude: number;
  longitude: number;
  dateTimestamp?: number | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  Academic: "#4A90D9",
  Social: "#E67E22",
  Sports: "#27AE60",
  Cultural: "#8E44AD",
  Religious: "#C0392B",
  Workshop: "#16A085",
  Career: "#D35400",
  Health: "#1ABC9C",
  Other: "#7F8C8D",
};

// ── Robust date parser (works on Android & iOS) ───────────────────
// Handles: "2026-06-15", "15/06/2026", "June 15, 2026", "15 June 2026", etc.
function parseDateToTimestamp(dateStr?: string): number | null {
  if (!dateStr || !dateStr.trim()) return null;
  const s = dateStr.trim();

  // 1. ISO: YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const ts = Date.UTC(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]), 12, 0, 0);
    return isNaN(ts) ? null : ts;
  }

  // 2. DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const a = parseInt(slashMatch[1]);
    const b = parseInt(slashMatch[2]);
    const y = parseInt(slashMatch[3]);
    // If first part > 12 it must be day
    const day = a > 12 ? a : a;
    const month = a > 12 ? b : b;
    const ts = Date.UTC(y, month - 1, day, 12, 0, 0);
    return isNaN(ts) ? null : ts;
  }

  // 3. DD-MM-YYYY
  const dashDMY = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashDMY) {
    const ts = Date.UTC(parseInt(dashDMY[3]), parseInt(dashDMY[2]) - 1, parseInt(dashDMY[1]), 12, 0, 0);
    return isNaN(ts) ? null : ts;
  }

  // 4. Month name: "June 15, 2026" / "Jun 15 2026" / "15 June 2026"
  const MONTHS: Record<string, number> = {
    jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11,
    january:0,february:1,march:2,april:3,june:5,july:6,august:7,
    september:8,october:9,november:10,december:11,
  };
  const namedA = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (namedA) {
    const m = MONTHS[namedA[1].toLowerCase()];
    if (m !== undefined) {
      const ts = Date.UTC(parseInt(namedA[3]), m, parseInt(namedA[2]), 12, 0, 0);
      return isNaN(ts) ? null : ts;
    }
  }
  const namedB = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (namedB) {
    const m = MONTHS[namedB[2].toLowerCase()];
    if (m !== undefined) {
      const ts = Date.UTC(parseInt(namedB[3]), m, parseInt(namedB[1]), 12, 0, 0);
      return isNaN(ts) ? null : ts;
    }
  }

  // 5. Last resort: native parse
  const native = Date.parse(s);
  return isNaN(native) ? null : native;
}

// Resolve the best timestamp for an event
function resolveEventTimestamp(event: Event): number | null {
  // Prefer stored dateTimestamp (saved by admin panel)
  if (event.dateTimestamp && !isNaN(event.dateTimestamp)) return event.dateTimestamp;
  // Fall back to parsing the date string
  return parseDateToTimestamp(event.date);
}

// Format date for display
function formatEventDate(event: Event): string {
  const ts = resolveEventTimestamp(event);
  if (!ts) return event.date && event.date.trim() ? event.date : "Date TBD";
  const d = new Date(ts);
  const datePart = d.toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
  return event.time ? `${datePart} · ${event.time}` : datePart;
}

export default function EventsScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("All");

  const categories = ["All", "Academic", "Social", "Sports", "Cultural", "Career", "Health", "Religious", "Workshop", "Other"];

  useEffect(() => {
    const eventsRef = ref(database, "events");
    const unsub = onValue(eventsRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list: Event[] = Object.entries(data).map(([id, val]: any) => ({ id, ...val }));

        // Sort: upcoming first (soonest first), then past (most recent first)
        const now = Date.now();
        list.sort((a, b) => {
          const aTs = resolveEventTimestamp(a);
          const bTs = resolveEventTimestamp(b);
          const aUp = aTs && aTs >= now;
          const bUp = bTs && bTs >= now;
          if (aUp && bUp) return (aTs ?? 0) - (bTs ?? 0);
          if (aUp) return -1;
          if (bUp) return 1;
          return (bTs ?? 0) - (aTs ?? 0);
        });

        setEvents(list);
      } else {
        setEvents([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = filter === "All" ? events : events.filter((e) => e.category === filter);

  const handleGetDirections = (event: Event) => {
  router.push({
    pathname: "/home",
    params: {
      eventLat: event.latitude,
      eventLng: event.longitude,
      eventName: event.locationName || event.location || event.name,
      eventIcon: "📌",
      eventDesc: event.description || "",
    },
  });
};

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Campus Events</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.filterChip, filter === cat && styles.filterChipActive]}
            onPress={() => setFilter(cat)}
          >
            <Text style={[styles.filterChipText, filter === cat && styles.filterChipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Events List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#2ECC71" />
          <Text style={styles.loadingText}>Loading events…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyEmoji}>🗓️</Text>
          <Text style={styles.emptyTitle}>No events found</Text>
          <Text style={styles.emptySubtitle}>
            {filter === "All" ? "Check back later for upcoming events." : `No ${filter} events right now.`}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {filtered.map((event) => {
            const ts = resolveEventTimestamp(event);
            const upcoming = ts ? ts >= Date.now() : true; // no date = assume upcoming
            const catColor = CATEGORY_COLORS[event.category] ?? "#7F8C8D";
            return (
              <View key={event.id} style={[styles.card, !upcoming && styles.cardPast]}>
                {/* Category + status */}
                <View style={styles.cardTop}>
                  <View style={[styles.catBadge, { backgroundColor: catColor + "22" }]}>
                    <Text style={[styles.catBadgeText, { color: catColor }]}>{event.category}</Text>
                  </View>
                  {upcoming ? (
                    <View style={styles.upcomingBadge}>
                      <Text style={styles.upcomingText}>Upcoming</Text>
                    </View>
                  ) : (
                    <View style={styles.pastBadge}>
                      <Text style={styles.pastText}>Past</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.eventName}>{event.name}</Text>

                {event.description ? (
                  <Text style={styles.eventDesc} numberOfLines={2}>{event.description}</Text>
                ) : null}

                <View style={styles.metaRow}>
                  <Text style={styles.metaIcon}>🕐</Text>
                  <Text style={styles.metaText}>{formatEventDate(event)}</Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaIcon}>📍</Text>
                  <Text style={styles.metaText}>
                    {event.locationName || event.location || "Campus"}
                  </Text>
                </View>

                {upcoming && event.latitude && event.longitude ? (
                  <TouchableOpacity
                    style={styles.directionsBtn}
                    onPress={() => handleGetDirections(event)}
                  >
                    <Text style={styles.directionsBtnText}>🗺️  Get Directions</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7F5" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1A5C38",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  backIcon: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },

  filterRow: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E8EDE8" },
  filterContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: "row" },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: "#C8D8C8", backgroundColor: "#fff",
  },
  filterChipActive: { backgroundColor: "#1A5C38", borderColor: "#1A5C38" },
  filterChipText: { fontSize: 13, color: "#555", fontWeight: "500" },
  filterChipTextActive: { color: "#fff" },

  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingText: { marginTop: 12, color: "#888", fontSize: 15 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#333", marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: "#888", textAlign: "center" },

  listContent: { padding: 16, gap: 14 },

  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
    borderLeftWidth: 4, borderLeftColor: "#2ECC71",
  },
  cardPast: { opacity: 0.65, borderLeftColor: "#BDC3C7" },

  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  catBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  catBadgeText: { fontSize: 12, fontWeight: "600" },
  upcomingBadge: { backgroundColor: "#E8F8F0", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  upcomingText: { fontSize: 12, color: "#1A5C38", fontWeight: "600" },
  pastBadge: { backgroundColor: "#F0F0F0", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  pastText: { fontSize: 12, color: "#888", fontWeight: "600" },

  eventName: { fontSize: 17, fontWeight: "700", color: "#1A1A1A", marginBottom: 4 },
  eventDesc: { fontSize: 13, color: "#666", marginBottom: 10, lineHeight: 19 },

  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  metaIcon: { fontSize: 13 },
  metaText: { fontSize: 13, color: "#555" },

  directionsBtn: {
    marginTop: 12, backgroundColor: "#1A5C38",
    borderRadius: 10, paddingVertical: 10, alignItems: "center",
  },
  directionsBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});