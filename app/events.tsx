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
import {
  Calendar,
  CalendarX,
  ChevronLeft,
  Clock,
  MapPin,
  Navigation,
} from "lucide-react-native";

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

const MONTH_ABBR = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

// ── Robust date parser (works on Android & iOS) ───────────────────
// Handles: "2026-06-15", "15/06/2026", "June 15, 2026", "15 June 2026", etc.
function parseDateToTimestamp(dateStr?: string): number | null {
  if (!dateStr || !dateStr.trim()) return null;
  const s = dateStr.trim();

  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const ts = Date.UTC(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]), 12, 0, 0);
    return isNaN(ts) ? null : ts;
  }

  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const a = parseInt(slashMatch[1]);
    const b = parseInt(slashMatch[2]);
    const y = parseInt(slashMatch[3]);
    const ts = Date.UTC(y, b - 1, a, 12, 0, 0);
    return isNaN(ts) ? null : ts;
  }

  const dashDMY = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashDMY) {
    const ts = Date.UTC(parseInt(dashDMY[3]), parseInt(dashDMY[2]) - 1, parseInt(dashDMY[1]), 12, 0, 0);
    return isNaN(ts) ? null : ts;
  }

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

  const native = Date.parse(s);
  return isNaN(native) ? null : native;
}

function resolveEventTimestamp(event: Event): number | null {
  if (event.dateTimestamp && !isNaN(event.dateTimestamp)) return event.dateTimestamp;
  return parseDateToTimestamp(event.date);
}

function formatEventDate(event: Event): string {
  const ts = resolveEventTimestamp(event);
  if (!ts) return event.date && event.date.trim() ? event.date : "Date TBD";
  const d = new Date(ts);
  const datePart = d.toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
  return event.time ? `${datePart} · ${event.time}` : datePart;
}

function getDateBadge(ts: number | null): { day: string; month: string } | null {
  if (!ts) return null;
  const d = new Date(ts);
  return { day: String(d.getUTCDate()), month: MONTH_ABBR[d.getUTCMonth()] };
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
          <ChevronLeft size={22} color="#fff" strokeWidth={2.4} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIconBox}>
            <Calendar size={15} color="#fff" strokeWidth={2.2} />
          </View>
          <Text style={styles.headerTitle}>Campus Events</Text>
        </View>
        <View style={{ width: 34 }} />
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
          <ActivityIndicator size="large" color="#1a5c38" />
          <Text style={styles.loadingText}>Loading events…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centerBox}>
          <View style={styles.emptyIconBox}>
            <CalendarX size={30} color="#bbb" strokeWidth={1.8} />
          </View>
          <Text style={styles.emptyTitle}>No events found</Text>
          <Text style={styles.emptySubtitle}>
            {filter === "All" ? "Check back later for upcoming events." : `No ${filter} events right now.`}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {filtered.map((event) => {
            const ts = resolveEventTimestamp(event);
            const upcoming = ts ? ts >= Date.now() : true;
            const catColor = CATEGORY_COLORS[event.category] ?? "#7F8C8D";
            const badge = getDateBadge(ts);
            return (
              <View key={event.id} style={[styles.card, !upcoming && styles.cardPast]}>
                <View style={styles.cardRow}>
                  <View style={[styles.dateBadge, { backgroundColor: catColor + "18" }]}>
                    {badge ? (
                      <>
                        <Text style={[styles.dateBadgeDay, { color: catColor }]}>{badge.day}</Text>
                        <Text style={[styles.dateBadgeMonth, { color: catColor }]}>{badge.month}</Text>
                      </>
                    ) : (
                      <Calendar size={18} color={catColor} strokeWidth={2.2} />
                    )}
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.cardTopRow}>
                      <View style={[styles.catBadge, { backgroundColor: catColor + "18" }]}>
                        <Text style={[styles.catBadgeText, { color: catColor }]}>{event.category}</Text>
                      </View>
                      <View style={styles.statusWrap}>
                        <View style={[styles.statusDot, { backgroundColor: upcoming ? "#2ECC71" : "#bbb" }]} />
                        <Text style={[styles.statusLabel, !upcoming && styles.statusLabelPast]}>
                          {upcoming ? "Upcoming" : "Past"}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.eventName}>{event.name}</Text>

                    {event.description ? (
                      <Text style={styles.eventDesc} numberOfLines={2}>{event.description}</Text>
                    ) : null}

                    <View style={styles.metaRow}>
                      <Clock size={12} color="#999" strokeWidth={2.2} />
                      <Text style={styles.metaText}>{formatEventDate(event)}</Text>
                    </View>

                    <View style={styles.metaRow}>
                      <MapPin size={12} color="#999" strokeWidth={2.2} />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {event.locationName || event.location || "Campus"}
                      </Text>
                    </View>
                  </View>
                </View>

                {upcoming && event.latitude && event.longitude ? (
                  <TouchableOpacity
                    style={styles.directionsBtn}
                    onPress={() => handleGetDirections(event)}
                    activeOpacity={0.75}
                  >
                    <Navigation size={14} color="#1a5c38" strokeWidth={2.4} />
                    <Text style={styles.directionsBtnText}>Get Directions</Text>
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
    width: 34, height: 34,
    alignItems: "center", justifyContent: "center",
  },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  headerIconBox: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },

  filterRow: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E8EDE8" },
  filterContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: "row" },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: "#E0E6E0", backgroundColor: "#fff",
  },
  filterChipActive: { backgroundColor: "#1A5C38", borderColor: "#1A5C38" },
  filterChipText: { fontSize: 13, color: "#666", fontWeight: "600" },
  filterChipTextActive: { color: "#fff" },

  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingText: { marginTop: 12, color: "#888", fontSize: 15 },
  emptyIconBox: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "#f0f0f0",
    alignItems: "center", justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#333", marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: "#888", textAlign: "center" },

  listContent: { padding: 16, gap: 12 },

  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardPast: { opacity: 0.6 },
  cardRow: { flexDirection: "row", gap: 12 },

  dateBadge: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  dateBadgeDay: { fontSize: 17, fontWeight: "800", lineHeight: 19 },
  dateBadgeMonth: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },

  cardBody: { flex: 1 },
  cardTopRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 6,
  },
  catBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  catBadgeText: { fontSize: 11, fontWeight: "700" },
  statusWrap: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 11.5, color: "#1a5c38", fontWeight: "600" },
  statusLabelPast: { color: "#999" },

  eventName: { fontSize: 16, fontWeight: "700", color: "#1A1A1A", marginBottom: 3 },
  eventDesc: { fontSize: 13, color: "#777", marginBottom: 8, lineHeight: 18 },

  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  metaText: { fontSize: 12.5, color: "#666", flex: 1 },

  directionsBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    marginTop: 12,
    backgroundColor: "#f0faf4",
    borderRadius: 10, paddingVertical: 10,
  },
  directionsBtnText: { color: "#1a5c38", fontSize: 13.5, fontWeight: "700" },
});