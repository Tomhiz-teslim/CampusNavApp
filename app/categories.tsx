import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { onValue, ref } from "firebase/database";
import { database } from "../lib/firebase";
import { ChevronLeft, Search } from "lucide-react-native";
import {
  GREEN,
  GREEN_TINT,
  BG,
  SERVICE_CATEGORIES,
  type ServiceListing,
} from "../lib/serviceShared";

export default function CategoriesScreen() {
  const router = useRouter();
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onValue(ref(database, "services"), (snap) => {
      const data = snap.val() || {};
      const now = Date.now();
      const active: ServiceListing[] = Object.entries(data)
        .map(([id, v]: any) => ({ id, ...v }))
        .filter((s: ServiceListing) => s.active && s.expiresAt > now);
      setServices(active);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of services) {
      map[s.category] = (map[s.category] ?? 0) + 1;
    }
    return map;
  }, [services]);

  const categories = SERVICE_CATEGORIES.filter((c) => c.key !== "all");

  function handleTap(key: string) {
    router.push({ pathname: "/service", params: { category: key } } as any);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronLeft size={22} color="#fff" strokeWidth={2.4} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Categories</Text>
        <TouchableOpacity onPress={() => router.push("/search" as any)} style={styles.iconBtn}>
          <Search size={20} color="#fff" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>BROWSE BY CATEGORY</Text>

        {loading ? (
          <ActivityIndicator color={GREEN} size="large" style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.grid}>
            {categories.map((cat) => {
              const count = counts[cat.key] ?? 0;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={styles.card}
                  activeOpacity={0.8}
                  onPress={() => handleTap(cat.key)}
                >
                  <View style={styles.iconBox}>
                    <cat.icon size={22} color={GREEN} strokeWidth={2} />
                  </View>
                  <Text style={styles.cardLabel} numberOfLines={1}>{cat.label}</Text>
                  <Text style={styles.cardCount}>
                    {count} service{count !== 1 ? "s" : ""}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: GREEN,
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  iconBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },

  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9aa39a",
    letterSpacing: 0.8,
    marginBottom: 14,
  },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: GREEN_TINT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  cardLabel: { fontSize: 14.5, fontWeight: "700", color: "#1a1a1a", marginBottom: 3 },
  cardCount: { fontSize: 12, color: "#9aa39a", fontWeight: "500" },
});