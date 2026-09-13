import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { onValue, ref } from "firebase/database";
import { database } from "../lib/firebase";
import { ChevronLeft, Search as SearchIcon, X, Clock } from "lucide-react-native";
import { CategoryChip } from "../components/CategoryChip";
import { ServiceCardCompact } from "../components/ServiceCardCompact";
import { SERVICE_CATEGORIES, type ServiceListing } from "../lib/serviceShared";

const GREEN = "#1a5c38";
const BG = "#F5F7F5";
const MAX_RECENTS = 5;

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [recents, setRecents] = useState<string[]>([]);

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

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return services.filter((s) => {
      const catLabel = SERVICE_CATEGORIES.find((c) => c.key === s.category)?.label ?? "";
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        catLabel.toLowerCase().includes(q)
      );
    });
  }, [services, query]);

  function commitSearch(term: string) {
    const clean = term.trim();
    if (!clean) return;
    setRecents((prev) => [clean, ...prev.filter((r) => r !== clean)].slice(0, MAX_RECENTS));
  }

  function handleCategoryTap(key: string) {
    const label = SERVICE_CATEGORIES.find((c) => c.key === key)?.label ?? "";
    setQuery(label);
    commitSearch(label);
  }

  const showingResults = query.trim().length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={22} color="#fff" strokeWidth={2.4} />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <SearchIcon size={16} color="#9aa39a" strokeWidth={2.2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search food, laundry, barber, tutors…"
            placeholderTextColor="#9aa39a"
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => commitSearch(query)}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
              <X size={15} color="#9aa39a" strokeWidth={2.4} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!showingResults ? (
          <>
            {recents.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>RECENT SEARCHES</Text>
                <View style={styles.recentsList}>
                  {recents.map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={styles.recentRow}
                      onPress={() => setQuery(r)}
                    >
                      <Clock size={14} color="#999" strokeWidth={2.2} />
                      <Text style={styles.recentText}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.sectionLabel}>BROWSE BY CATEGORY</Text>
            <View style={styles.categoryWrap}>
              {SERVICE_CATEGORIES.filter((c) => c.key !== "all").map((cat) => (
                <CategoryChip
                  key={cat.key}
                  icon={cat.icon}
                  label={cat.label}
                  onPress={() => handleCategoryTap(cat.key)}
                />
              ))}
            </View>
          </>
        ) : loading ? (
          <ActivityIndicator color={GREEN} size="large" style={{ marginTop: 40 }} />
        ) : results.length === 0 ? (
          <View style={styles.emptyState}>
            <SearchIcon size={36} color="#ccc" strokeWidth={1.8} />
            <Text style={styles.emptyTitle}>No results for "{query}"</Text>
            <Text style={styles.emptySub}>Try a different term or browse a category instead.</Text>
          </View>
        ) : (
          results.map((service) => {
            const cat = SERVICE_CATEGORIES.find((c) => c.key === service.category);
            return (
              <ServiceCardCompact
                key={service.id}
                service={service}
                distanceM={null}
                categoryIcon={cat?.icon ?? SearchIcon}
                categoryLabel={cat?.label ?? service.category}
                onPress={() => {
                  commitSearch(query);
                  router.push(`/service/${service.id}` as any);
                }}
              />
            );
          })
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
    gap: 10,
    backgroundColor: GREEN,
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 12,
  },
  backBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#1a1a1a" },

  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#999",
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },

  recentsList: { marginBottom: 22 },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  recentText: { fontSize: 14, color: "#333", fontWeight: "500" },

  categoryWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  emptyState: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#555" },
  emptySub: { fontSize: 13, color: "#aaa", textAlign: "center", paddingHorizontal: 30 },
});