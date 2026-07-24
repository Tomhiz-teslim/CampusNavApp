import { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  SectionList,
} from "react-native";
import { useRouter } from "expo-router";

const BUILDINGS = [
  {
    id: "b1",
    name: "Independence Hall",
    latitude: 6.5178,
    longitude: 3.3912,
    category: "hostel",
  },
  {
    id: "b2",
    name: "Jaja Hostel",
    latitude: 6.5165,
    longitude: 3.3887,
    category: "hostel",
  },
  {
    id: "b3",
    name: "Mariere Hall",
    latitude: 6.519,
    longitude: 3.3906,
    category: "hostel",
  },
  {
    id: "b4",
    name: "Moremi Hall",
    latitude: 6.5182,
    longitude: 3.3894,
    category: "hostel",
  },
  {
    id: "b5",
    name: "Queen Idia Hall",
    latitude: 6.5184,
    longitude: 3.3899,
    category: "hostel",
  },
  {
    id: "b6",
    name: "Sultan Bello Hall",
    latitude: 6.5176,
    longitude: 3.389,
    category: "hostel",
  },
  {
    id: "b7",
    name: "Fabian Olusanya Hall",
    latitude: 6.518,
    longitude: 3.3886,
    category: "hostel",
  },
  {
    id: "b8",
    name: "Biobaku Hall",
    latitude: 6.5187,
    longitude: 3.39,
    category: "hostel",
  },
  {
    id: "b9",
    name: "Mellanbay Hostel",
    latitude: 6.5174,
    longitude: 3.3884,
    category: "hostel",
  },
  {
    id: "b10",
    name: "New Hall",
    latitude: 6.5192,
    longitude: 3.3909,
    category: "hostel",
  },
  {
    id: "b11",
    name: "Faculty of Arts",
    latitude: 6.517,
    longitude: 3.3918,
    category: "faculty",
  },
  {
    id: "b12",
    name: "Faculty of Business Admin.",
    latitude: 6.515,
    longitude: 3.3915,
    category: "faculty",
  },
  {
    id: "b13",
    name: "Faculty of Education",
    latitude: 6.5155,
    longitude: 3.3905,
    category: "faculty",
  },
  {
    id: "b14",
    name: "Faculty of Engineering",
    latitude: 6.5168,
    longitude: 3.394,
    category: "faculty",
  },
  {
    id: "b15",
    name: "Faculty of Environmental",
    latitude: 6.5162,
    longitude: 3.3933,
    category: "faculty",
  },
  {
    id: "b16",
    name: "Faculty of Law",
    latitude: 6.5161,
    longitude: 3.3921,
    category: "faculty",
  },
  {
    id: "b17",
    name: "Faculty of Medicine (CMS)",
    latitude: 6.5145,
    longitude: 3.3925,
    category: "faculty",
  },
  {
    id: "b18",
    name: "Faculty of Pharmacy",
    latitude: 6.5148,
    longitude: 3.393,
    category: "faculty",
  },
  {
    id: "b19",
    name: "Faculty of Science",
    latitude: 6.5176,
    longitude: 3.3931,
    category: "faculty",
  },
  {
    id: "b20",
    name: "Faculty of Social Sciences",
    latitude: 6.5158,
    longitude: 3.3917,
    category: "faculty",
  },
  {
    id: "b21",
    name: "Faculty of Dental Sciences",
    latitude: 6.5143,
    longitude: 3.3922,
    category: "faculty",
  },
  {
    id: "b22",
    name: "Faculty of Nursing",
    latitude: 6.5146,
    longitude: 3.3927,
    category: "faculty",
  },
  {
    id: "b23",
    name: "Computer Science Dept.",
    latitude: 6.51515,
    longitude: 3.39999,
    category: "faculty",
  },
  {
    id: "b24",
    name: "Postgraduate School",
    latitude: 6.5164,
    longitude: 3.3908,
    category: "faculty",
  },
  {
    id: "b25",
    name: "Quadrangle",
    latitude: 6.51528,
    longitude: 3.39964,
    category: "faculty",
  },
  {
    id: "b26",
    name: "Senate Building",
    latitude: 6.51722,
    longitude: 3.39028,
    category: "admin",
  },
  {
    id: "b27",
    name: "Registry",
    latitude: 6.5173,
    longitude: 3.3901,
    category: "admin",
  },
  {
    id: "b28",
    name: "Bursary",
    latitude: 6.5171,
    longitude: 3.39,
    category: "admin",
  },
  {
    id: "b29",
    name: "ICT Centre",
    latitude: 6.5166,
    longitude: 3.3928,
    category: "admin",
  },
  {
    id: "b30",
    name: "Student Union Building",
    latitude: 6.517,
    longitude: 3.391,
    category: "admin",
  },
  {
    id: "b31",
    name: "Vice-Chancellor's Office",
    latitude: 6.5174,
    longitude: 3.3904,
    category: "admin",
  },
  {
    id: "b32",
    name: "UNILAG Main Gate",
    latitude: 6.51395,
    longitude: 3.38795,
    category: "admin",
  },
  {
    id: "b33",
    name: "UNILAG Chapel",
    latitude: 6.5175,
    longitude: 3.3905,
    category: "admin",
  },
  {
    id: "b34",
    name: "UNILAG Mosque",
    latitude: 6.5177,
    longitude: 3.3907,
    category: "admin",
  },
  {
    id: "b35",
    name: "UNILAG Bookshop",
    latitude: 6.51695,
    longitude: 3.3911,
    category: "admin",
  },
  {
    id: "b36",
    name: "UNILAG Hotel (Lagoon)",
    latitude: 6.5205,
    longitude: 3.3935,
    category: "admin",
  },
  {
    id: "b37",
    name: "Security Post (Main Gate)",
    latitude: 6.514,
    longitude: 3.388,
    category: "admin",
  },
  {
    id: "b38",
    name: "Security Post (Akoka Gate)",
    latitude: 6.5204,
    longitude: 3.392,
    category: "admin",
  },
  {
    id: "b39",
    name: "Works & Physical Planning",
    latitude: 6.5168,
    longitude: 3.3896,
    category: "admin",
  },
  {
    id: "b40",
    name: "Amala Joint",
    latitude: 6.5169,
    longitude: 3.3908,
    category: "food",
  },
  {
    id: "b41",
    name: "Dangote Cafeteria",
    latitude: 6.5173,
    longitude: 3.392,
    category: "food",
  },
  {
    id: "b42",
    name: "Science Canteen",
    latitude: 6.5177,
    longitude: 3.3935,
    category: "food",
  },
  {
    id: "b43",
    name: "Engineering Canteen",
    latitude: 6.5165,
    longitude: 3.3942,
    category: "food",
  },
  {
    id: "b44",
    name: "Moremi Cafeteria",
    latitude: 6.5183,
    longitude: 3.3896,
    category: "food",
  },
  {
    id: "b45",
    name: "SUB Cafeteria",
    latitude: 6.51695,
    longitude: 3.39095,
    category: "food",
  },
  {
    id: "b46",
    name: "Food Kiosk Area",
    latitude: 6.5165,
    longitude: 3.3913,
    category: "food",
  },
  {
    id: "b47",
    name: "Main Library",
    latitude: 6.5168,
    longitude: 3.3915,
    category: "library",
  },
  {
    id: "b48",
    name: "Faculty of Law Library",
    latitude: 6.51615,
    longitude: 3.3922,
    category: "library",
  },
  {
    id: "b49",
    name: "Science Library",
    latitude: 6.51755,
    longitude: 3.393,
    category: "library",
  },
  {
    id: "b50",
    name: "Education Library",
    latitude: 6.51545,
    longitude: 3.3906,
    category: "library",
  },
  {
    id: "b51",
    name: "E-Library (ICT Centre)",
    latitude: 6.51665,
    longitude: 3.39275,
    category: "library",
  },
  {
    id: "b52",
    name: "University Health Centre",
    latitude: 6.516,
    longitude: 3.3905,
    category: "medical",
  },
  {
    id: "b53",
    name: "LASUTH (Teaching Hospital)",
    latitude: 6.5142,
    longitude: 3.3916,
    category: "medical",
  },
  {
    id: "b54",
    name: "CMS Pharmacy",
    latitude: 6.51475,
    longitude: 3.3929,
    category: "medical",
  },
  {
    id: "b55",
    name: "Dental Clinic",
    latitude: 6.5144,
    longitude: 3.3921,
    category: "medical",
  },
  {
    id: "b56",
    name: "Athletics Track",
    latitude: 6.5188,
    longitude: 3.3925,
    category: "sport",
  },
  {
    id: "b57",
    name: "Sport Centre",
    latitude: 6.5185,
    longitude: 3.392,
    category: "sport",
  },
  {
    id: "b58",
    name: "Swimming Pool",
    latitude: 6.5186,
    longitude: 3.3923,
    category: "sport",
  },
  {
    id: "b59",
    name: "Tennis Court",
    latitude: 6.5187,
    longitude: 3.3918,
    category: "sport",
  },
  {
    id: "b60",
    name: "Basketball Court",
    latitude: 6.5184,
    longitude: 3.3916,
    category: "sport",
  },
  {
    id: "b61",
    name: "Football Field",
    latitude: 6.519,
    longitude: 3.3922,
    category: "sport",
  },
  {
    id: "b62",
    name: "Multipurpose Hall",
    latitude: 6.5182,
    longitude: 3.3919,
    category: "sport",
  },
];

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  hostel:  { label: "Hostels",           icon: "🏠" },
  faculty: { label: "Faculties",         icon: "🎓" },
  admin:   { label: "Administration",    icon: "🏛️" },
  food:    { label: "Cafeterias & Food", icon: "🍽️" },
  library: { label: "Libraries",         icon: "📚" },
  medical: { label: "Medical",           icon: "🏥" },
  sport:   { label: "Sport",             icon: "⚽" },
};

export default function CampusDirectoryScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? BUILDINGS.filter((b) => b.name.toLowerCase().includes(q))
      : BUILDINGS;

    const byCategory: Record<string, typeof BUILDINGS> = {};
    filtered.forEach((b) => {
      const key = b.category ?? "other";
      if (!byCategory[key]) byCategory[key] = [];
      byCategory[key].push(b);
    });

    // Keep a stable, sensible category order rather than object-key order.
    const order = ["faculty", "admin", "hostel", "library", "medical", "food", "sport"];
    return order
      .filter((key) => byCategory[key]?.length)
      .map((key) => ({
        title: CATEGORY_META[key]?.label ?? key,
        icon: CATEGORY_META[key]?.icon ?? "📍",
        data: byCategory[key].sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [search]);

  function handleDirections(building: (typeof BUILDINGS)[number]) {
    router.push({
      pathname: "/home",
      params: {
        eventLat: building.latitude,
        eventLng: building.longitude,
        eventName: building.name,
        eventIcon: CATEGORY_META[building.category]?.icon ?? "📍",
        eventDesc: CATEGORY_META[building.category]?.label ?? "",
      },
    });
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Campus Directory</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search buildings, offices, faculties…"
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {sections.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyTitle}>No matches</Text>
          <Text style={styles.emptySubtitle}>Try a different search term.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>
              {section.icon}  {section.title.toUpperCase()}
            </Text>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => handleDirections(item)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowCoords}>
                  {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                </Text>
              </View>
              <View style={styles.dirBtn}>
                <Text style={styles.dirBtnText}>🗺️ Directions</Text>
              </View>
            </TouchableOpacity>
          )}
        />
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

  searchWrap: { backgroundColor: "#1A5C38", padding: 12 },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#333",
  },

  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#333", marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: "#888", textAlign: "center" },

  listContent: { padding: 16, paddingBottom: 32 },

  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 8,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  rowName: { fontSize: 14, fontWeight: "700", color: "#222" },
  rowCoords: { fontSize: 11, color: "#999", marginTop: 2 },
  dirBtn: {
    backgroundColor: "#1a5c38",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 10,
  },
  dirBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});