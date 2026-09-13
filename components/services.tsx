import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import * as ExpoLocation from "expo-location";
import { onValue, ref } from "firebase/database";
import { database } from "../lib/firebase";
import { router } from "expo-router";
import { Search, ShoppingBag } from "lucide-react-native";
import { CategoryChip } from "./CategoryChip";
import { ServiceCardCompact } from "./ServiceCardCompact";
import {
  GREEN, GREEN_TINT, BG, ServiceListing, SERVICE_CATEGORIES,
  getDistanceMeters,
} from "../lib/serviceShared";

export default function ServicesTab({ userId }: { userId: string }) {
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
        setUserLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        /* silent — cards just fall back to the text location */
      }
    })();
  }, []);

  useEffect(() => {
    const unsub = onValue(ref(database, "services"), (snap) => {
      const data = snap.val() || {};
      const now = Date.now();
      const publicList: ServiceListing[] = Object.entries(data)
        .map(([id, v]: any) => ({ id, ...v }))
        .filter((s: ServiceListing) => s.userId !== userId && s.active && s.expiresAt > now)
        .sort((a, b) => b.createdAt - a.createdAt);

      setServices(publicList);
      setLoading(false);
    });
    return () => unsub();
  }, [userId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const withDistance = services
      .filter((s) => {
        const matchCat = filterCat === "all" || s.category === filterCat;
        const matchSearch =
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.location.toLowerCase().includes(q) ||
          SERVICE_CATEGORIES.find((c) => c.key === s.category)?.label.toLowerCase().includes(q);
        return matchCat && matchSearch;
      })
      .map((s) => ({
        service: s,
        distance:
          userLoc && s.latitude != null && s.longitude != null
            ? getDistanceMeters(userLoc.lat, userLoc.lng, s.latitude, s.longitude)
            : null,
      }));

    withDistance.sort((a, b) => {
      if (a.distance != null && b.distance != null) return a.distance - b.distance;
      if (a.distance != null) return -1;
      if (b.distance != null) return 1;
      return (b.service.rating ?? 0) - (a.service.rating ?? 0);
    });

    return withDistance;
  }, [services, filterCat, search, userLoc]);

  return (
    <View style={tabStyles.root}>
      <ScrollView
        style={tabStyles.list}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <Text style={tabStyles.pageTitle}>Campus Services</Text>

        <TouchableOpacity
          style={tabStyles.searchBar}
          activeOpacity={0.8}
          onPress={() => router.push("/search" as any)}
        >
          <Search size={16} color="#9aa39a" strokeWidth={2.2} />
          <Text style={tabStyles.searchPlaceholder}>Search food, laundry, barber, tutors…</Text>
        </TouchableOpacity>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={tabStyles.chipRow}
          contentContainerStyle={{ paddingRight: 8 }}
          keyboardShouldPersistTaps="handled"
        >
          {SERVICE_CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat.key}
              icon={cat.icon}
              label={cat.label}
              active={filterCat === cat.key}
              onPress={() => setFilterCat(cat.key)}
            />
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={GREEN} size="large" style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={tabStyles.emptyState}>
            <Search size={36} color="#ccc" strokeWidth={1.8} />
            <Text style={tabStyles.emptyTitle}>No services found</Text>
            <Text style={tabStyles.emptySub}>
              {search ? `No results for "${search}"` : "No services in this category yet."}
            </Text>
          </View>
        ) : (
          filtered.map(({ service, distance }) => {
            const cat = SERVICE_CATEGORIES.find((c) => c.key === service.category);
            return (
              <ServiceCardCompact
                key={service.id}
                service={service}
                distanceM={distance}
                categoryIcon={cat?.icon ?? ShoppingBag}
                categoryLabel={cat?.label ?? service.category}
                onPress={() => router.push(`/service/${service.id}` as any)}
              />
            );
          })
        )}

        <View style={tabStyles.ctaCard}>
          <Text style={tabStyles.ctaHeadline}>Own a Business on Campus?</Text>
          <Text style={tabStyles.ctaBody}>
            List your business FREE for 30 days so students can discover your services.
            After the free trial, continue your listing for only ₦1,000 per month.
          </Text>
          <TouchableOpacity
            style={tabStyles.ctaBtn}
            activeOpacity={0.85}
            onPress={() => router.push("/my-services" as any)}
          >
            <Text style={tabStyles.ctaBtnText}>List Your Business</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  list: { flex: 1, paddingHorizontal: 16 },
  pageTitle: { fontSize: 26, fontWeight: "800", color: "#1a1a1a", marginTop: 18, marginBottom: 14 },
  searchBar: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: "#e9ede9",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
    marginBottom: 14, gap: 10,
  },
  searchPlaceholder: { flex: 1, fontSize: 15, color: "#9aa39a" },
  chipRow: { marginBottom: 18 },
  emptyState: { alignItems: "center", paddingTop: 50, paddingBottom: 20, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#555" },
  emptySub: { fontSize: 13, color: "#aaa", textAlign: "center" },
  ctaCard: {
    marginTop: 10, backgroundColor: GREEN_TINT, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: "#d3ecd9",
  },
  ctaHeadline: { fontSize: 16.5, fontWeight: "800", color: GREEN, marginBottom: 6 },
  ctaBody: { fontSize: 13, color: "#4c5c4f", lineHeight: 19, marginBottom: 16 },
  ctaBtn: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  ctaBtnText: { color: "#fff", fontSize: 14.5, fontWeight: "700" },
});