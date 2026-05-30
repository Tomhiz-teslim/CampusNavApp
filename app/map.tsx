import { useState } from "react";
import {
  View, Text, TouchableOpacity,
  StyleSheet, TextInput,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { router } from "expo-router";

const BUILDINGS = [
  { id: 1, name: "Faculty of Engineering", latitude: 6.5158, longitude: 3.3896, icon: "🏛️" },
  { id: 2, name: "Faculty of Sciences", latitude: 6.5165, longitude: 3.3910, icon: "🔬" },
  { id: 3, name: "Faculty of Arts", latitude: 6.5172, longitude: 3.3882, icon: "📚" },
  { id: 4, name: "Faculty of Law", latitude: 6.5180, longitude: 3.3920, icon: "⚖️" },
  { id: 5, name: "Main Library", latitude: 6.5145, longitude: 3.3900, icon: "📖" },
  { id: 6, name: "Senate Building", latitude: 6.5152, longitude: 3.3875, icon: "🏢" },
  { id: 7, name: "Student Union Building", latitude: 6.5138, longitude: 3.3915, icon: "🎓" },
  { id: 8, name: "University Health Centre", latitude: 6.5190, longitude: 3.3905, icon: "🏥" },
  { id: 9, name: "Sports Centre", latitude: 6.5130, longitude: 3.3888, icon: "⚽" },
  { id: 10, name: "Main Gate", latitude: 6.5120, longitude: 3.3870, icon: "🚪" },
];

export default function MapScreen() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);

  const filtered = BUILDINGS.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Campus Map</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search buildings..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Map */}
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: 6.5155,
          longitude: 3.3896,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {filtered.map((building) => (
          <Marker
            key={building.id}
            coordinate={{
              latitude: building.latitude,
              longitude: building.longitude,
            }}
            title={building.name}
            description="Tap for details"
            onPress={() => setSelected(building)}
          />
        ))}
      </MapView>

      {/* Selected building card */}
      {selected && (
        <View style={styles.card}>
          <Text style={styles.cardIcon}>{selected.icon}</Text>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{selected.name}</Text>
            <Text style={styles.cardCoords}>
              {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setSelected(null)}
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 55,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#1a5c38",
  },
  backBtn: {
    width: 60,
  },
  backText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  searchContainer: {
    padding: 12,
    backgroundColor: "#1a5c38",
  },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#333",
  },
  map: {
    flex: 1,
  },
  card: {
    position: "absolute",
    bottom: 30,
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  cardIcon: {
    fontSize: 30,
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a5c38",
  },
  cardCoords: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    fontSize: 16,
    color: "#999",
  },
});