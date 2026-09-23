import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { ProviderBanner } from "./ProviderBanner";
import * as ExpoLocation from "expo-location";
import { onValue, ref } from "firebase/database";
import { database } from "../lib/firebase";
import { router, useLocalSearchParams } from "expo-router";
import { MoreHorizontal, Search, ShoppingBag, Store } from "lucide-react-native";
import { ServiceCardCompact } from "./ServiceCardCompact";
import {
  GREEN, GREEN_TINT, BG, ServiceListing, SERVICE_CATEGORIES,
  getDistanceMeters,
} from "../lib/serviceShared";

export default function ServicesTab({ userId }: { userId: string }) {
  const { category: incomingCategory } = useLocalSearchParams<{ category?: string }>();
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [filterCat, setFilterCat] = useState(incomingCategory || "all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [bookmarkIds, setBookmarkIds] = useState<{ id: string; savedAt: number }[]>([]);
  const [recentIds, setRecentIds] = useState<{ id: string; viewedAt: number }[]>([]);

  useEffect(() => {
    if (incomingCategory) setFilterCat(incomingCategory);
  }, [incomingCategory]);

  useEffect(() => {
    const unsub = onValue(ref(database, `bookmarks/${userId}`), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([sid, savedAt]: any) => ({ id: sid, savedAt: Number(savedAt) || 0 }))
        .sort((a, b) => b.savedAt - a.savedAt);
      setBookmarkIds(list);
    });
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    const unsub = onValue(ref(database, `recentlyViewed/${userId}`), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([sid, viewedAt]: any) => ({ id: sid, viewedAt: Number(viewedAt) || 0 }))
        .sort((a, b) => b.viewedAt - a.viewedAt)
        .slice(0, 10);
      setRecentIds(list);
    });
    return () => unsub();
  }, [userId]);

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

  // "Near You" is discovery content, not a filtered view — it's always
  // distance-sorted regardless of category/search, and only makes sense
  // to show when we actually have a location fix.
  const nearYou = useMemo(() => {
    if (!userLoc) return [];
    return services
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s) => ({
        service: s,
        distance: getDistanceMeters(userLoc.lat, userLoc.lng, s.latitude!, s.longitude!),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8);
  }, [services, userLoc]);

  const popular = useMemo(() => {
    return [...services]
      .filter((s) => typeof s.rating === "number")
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 8);
  }, [services]);

  const bookmarkedServices = useMemo(() => {
    const map = new Map(services.map((s) => [s.id, s]));
    return bookmarkIds.map((b) => map.get(b.id)).filter(Boolean) as ServiceListing[];
  }, [services, bookmarkIds]);

  const recentlyViewedServices = useMemo(() => {
    const map = new Map(services.map((s) => [s.id, s]));
    return recentIds.map((r) => map.get(r.id)).filter(Boolean) as ServiceListing[];
  }, [services, recentIds]);

  const isDefaultView = filterCat === "all" && search.trim().length === 0;

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
        <Text style={tabStyles.heroSubtitle}>Find what you need, right here on campus.</Text>

        <TouchableOpacity
          style={tabStyles.searchBar}
          activeOpacity={0.8}
          onPress={() => router.push("/search" as any)}
        >
          <Search size={16} color="#9aa39a" strokeWidth={2.2} />
          <Text style={tabStyles.searchPlaceholder}>Search for services…</Text>
        </TouchableOpacity>

        <View style={tabStyles.categoryGrid}>
          {SERVICE_CATEGORIES.filter((c) => c.key !== "all").slice(0, 7).map((cat) => {
            const active = filterCat === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={tabStyles.gridItem}
                activeOpacity={0.8}
                onPress={() => setFilterCat(active ? "all" : cat.key)}
              >
                <View style={[tabStyles.gridIconBox, active && tabStyles.gridIconBoxActive]}>
                  <cat.icon size={20} color={active ? "#fff" : GREEN} strokeWidth={2.1} />
                </View>
                <Text style={tabStyles.gridLabel} numberOfLines={1}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={tabStyles.gridItem} activeOpacity={0.8} onPress={() => router.push("/categories" as any)}>
            <View style={tabStyles.gridIconBox}>
              <MoreHorizontal size={20} color={GREEN} strokeWidth={2.1} />
            </View>
            <Text style={tabStyles.gridLabel}>More</Text>
          </TouchableOpacity>
        </View>

        {isDefaultView && (
          <ProviderBanner onPress={() => router.push("/my-services" as any)} />
        )}

        {isDefaultView && popular.length > 0 && (
          <View style={tabStyles.popularSection}>
            <View style={tabStyles.sectionHeaderRow}>
              <Text style={tabStyles.sectionLabel}>POPULAR RIGHT NOW</Text>
              <TouchableOpacity onPress={() => router.push({ pathname: "/service-list", params: { type: "popular" } } as any)}>
                <Text style={tabStyles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 8, gap: 12 }}
            >
              {popular.map((service) => {
                const cat = SERVICE_CATEGORIES.find((c) => c.key === service.category);
                return (
                  <ServiceCardCompact
                    key={service.id}
                    service={service}
                    distanceM={null}
                    categoryIcon={cat?.icon ?? ShoppingBag}
                    categoryLabel={cat?.label ?? service.category}
                    onPress={() => router.push(`/service/${service.id}` as any)}
                    featured
                  />
                );
              })}
            </ScrollView>
          </View>
        )}

        {isDefaultView && bookmarkedServices.length > 0 && (
          <View style={tabStyles.popularSection}>
            <View style={tabStyles.sectionHeaderRow}>
              <Text style={tabStyles.sectionLabel}>MY BOOKMARKS</Text>
              <TouchableOpacity onPress={() => router.push({ pathname: "/service-list", params: { type: "bookmarks" } } as any)}>
                <Text style={tabStyles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 8, gap: 12 }}
            >
              {bookmarkedServices.slice(0, 8).map((service) => {
                const cat = SERVICE_CATEGORIES.find((c) => c.key === service.category);
                return (
                  <ServiceCardCompact
                    key={service.id}
                    service={service}
                    distanceM={null}
                    categoryIcon={cat?.icon ?? ShoppingBag}
                    categoryLabel={cat?.label ?? service.category}
                    onPress={() => router.push(`/service/${service.id}` as any)}
                    featured
                  />
                );
              })}
            </ScrollView>
          </View>
        )}

        {isDefaultView && recentlyViewedServices.length > 0 && (
          <View style={tabStyles.popularSection}>
            <View style={tabStyles.sectionHeaderRow}>
              <Text style={tabStyles.sectionLabel}>RECENTLY VIEWED</Text>
              <TouchableOpacity onPress={() => router.push({ pathname: "/service-list", params: { type: "recent" } } as any)}>
                <Text style={tabStyles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 8 }}
            >
              {recentlyViewedServices.slice(0, 8).map((service) => {
                const cat = SERVICE_CATEGORIES.find((c) => c.key === service.category);
                return (
                  <View key={service.id} style={tabStyles.nearYouCard}>
                    <ServiceCardCompact
                      service={service}
                      distanceM={null}
                      categoryIcon={cat?.icon ?? ShoppingBag}
                      categoryLabel={cat?.label ?? service.category}
                      onPress={() => router.push(`/service/${service.id}` as any)}
                      compact
                    />
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {isDefaultView && nearYou.length > 0 && (
          <View style={tabStyles.nearYouSection}>
            <Text style={tabStyles.sectionLabel}>NEAR YOU</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 8 }}
            >
              {nearYou.map(({ service, distance }) => {
                const cat = SERVICE_CATEGORIES.find((c) => c.key === service.category);
                return (
                  <View key={service.id} style={tabStyles.nearYouCard}>
                    <ServiceCardCompact
                      service={service}
                      distanceM={distance}
                      categoryIcon={cat?.icon ?? ShoppingBag}
                      categoryLabel={cat?.label ?? service.category}
                      onPress={() => router.push(`/service/${service.id}` as any)}
                      compact
                    />
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {!isDefaultView || nearYou.length === 0 ? null : (
          <Text style={tabStyles.sectionLabel}>ALL SERVICES</Text>
        )}

        {loading ? (
          <ActivityIndicator color={GREEN} size="large" style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={tabStyles.emptyState}>
            <Search size={36} color="#ccc" strokeWidth={1.8} />
            <Text style={tabStyles.emptyTitle}>No services found</Text>
            <Text style={tabStyles.emptySub}>
              {search ? `No results for "${search}"` : "No services in this category yet."}
            </Text>
            {(filterCat !== "all" || search.trim().length > 0) && (
              <TouchableOpacity
                style={tabStyles.emptyResetBtn}
                activeOpacity={0.8}
                onPress={() => {
                  setFilterCat("all");
                  setSearch("");
                }}
              >
                <Text style={tabStyles.emptyResetText}>See all services</Text>
              </TouchableOpacity>
            )}
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

      </ScrollView>

      <TouchableOpacity
        style={tabStyles.listBusinessFab}
        activeOpacity={0.85}
        onPress={() => router.push("/my-services" as any)}
      >
        <Store size={20} color="#fff" strokeWidth={2.2} />
      </TouchableOpacity>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  listBusinessFab: {
    position: "absolute",
    bottom: 20,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: GREEN,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  list: { flex: 1, paddingHorizontal: 16 },
  pageTitle: { fontSize: 22, fontWeight: "800", color: "#1a1a1a", marginTop: 18, marginBottom: 4 },
  heroSubtitle: { fontSize: 13.5, color: "#8a938a", marginBottom: 16, lineHeight: 19 },
  searchBar: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: "#e9ede9",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
    marginBottom: 14, gap: 10,
  },
  searchPlaceholder: { flex: 1, fontSize: 15, color: "#9aa39a" },
  categoryGrid: {
    flexDirection: "row", flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  gridItem: { width: "23%", alignItems: "center", marginBottom: 16 },
  gridIconBox: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: GREEN_TINT,
    alignItems: "center", justifyContent: "center",
    marginBottom: 6,
  },
  gridIconBoxActive: { backgroundColor: GREEN },
  gridLabel: { fontSize: 11.5, color: "#555", fontWeight: "600", textAlign: "center" },
  popularSection: { marginBottom: 22 },
  sectionHeaderRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 10,
  },
  seeAllText: { fontSize: 12.5, fontWeight: "700", color: GREEN },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9aa39a",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  nearYouSection: { marginBottom: 22 },
  nearYouCard: { width: 240, marginRight: 10 },
  emptyState: { alignItems: "center", paddingTop: 50, paddingBottom: 20, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#555" },
  emptySub: { fontSize: 13, color: "#aaa", textAlign: "center" },
  emptyResetBtn: {
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: GREEN,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyResetText: { color: GREEN, fontSize: 13, fontWeight: "700" },
});