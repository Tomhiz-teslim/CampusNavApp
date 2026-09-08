import {
  BookOpen,
  Building2,
  Dumbbell,
  GraduationCap,
  Home,
  Stethoscope,
  Utensils,
} from "lucide-react-native";
import React from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import { CATEGORY_COLORS } from "../lib/campusData";

export const CATEGORY_ICON: Record<string, React.ComponentType<any>> = {
  faculty: GraduationCap,
  hostel: Home,
  admin: Building2,
  food: Utensils,
  library: BookOpen,
  medical: Stethoscope,
  sport: Dumbbell,
};

export function BuildingMarker({
  building,
  isSelected,
  onPress,
}: {
  building: any;
  isSelected?: boolean;
  onPress: () => void;
}) {
  const colors = CATEGORY_COLORS[building.category] || CATEGORY_COLORS.admin;
  const Icon = CATEGORY_ICON[building.category] || Building2;
  return (
    <Marker
      coordinate={{
        latitude: building.latitude,
        longitude: building.longitude,
      }}
      onPress={onPress}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={false}
    >
      <View style={mStyles.pinWrap}>
        {isSelected && <View style={mStyles.pinHalo} />}
        <View
          style={[
            mStyles.pin,
            { backgroundColor: colors.pin, borderColor: colors.dot },
            isSelected && mStyles.pinSelected,
          ]}
        >
          <Icon size={14} color="#fff" strokeWidth={2.4} />
        </View>
      </View>
      <View style={[mStyles.pinTail, { borderTopColor: colors.pin }]} />
    </Marker>
  );
}

export function FriendMarker({
  friend,
  photo,
}: {
  friend: any;
  photo?: string | null;
}) {
  const [tracks, setTracks] = React.useState(Platform.OS === "android");

  React.useEffect(() => {
    if (Platform.OS !== "android") return;
    const t = setTimeout(() => setTracks(false), 600);
    return () => clearTimeout(t);
  }, [photo]);

  return (
    <Marker
      coordinate={{ latitude: friend.latitude, longitude: friend.longitude }}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracks}
    >
      <View style={mStyles.friendPin}>
        {photo ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${photo}` }}
            style={mStyles.friendPhoto}
          />
        ) : (
          <Text style={mStyles.friendInitial}>
            {(friend.name || "?")[0].toUpperCase()}
          </Text>
        )}
      </View>
      <View style={mStyles.friendTail} />
      <View style={mStyles.friendLabel}>
        <Text style={mStyles.friendLabelText}>
          {friend.name?.split(" ")[0]}
        </Text>
      </View>
    </Marker>
  );
}

export const mStyles = StyleSheet.create({
  pinWrap: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  pinHalo: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(26,92,56,0.18)",
    borderWidth: 1.5,
    borderColor: "rgba(26,92,56,0.35)",
  },
  pinSelected: {
    transform: [{ scale: 1.15 }],
  },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  emoji: { fontSize: 12 },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    alignSelf: "center",
    marginTop: -1,
  },
  friendPin: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#0891B2",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  friendInitial: { fontSize: 16, fontWeight: "700", color: "#fff" },
  friendPhoto: { width: 32, height: 32, borderRadius: 16 },
  friendTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#0891B2",
    alignSelf: "center",
    marginTop: -1,
  },
  friendLabel: {
    backgroundColor: "#0891B2",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 2,
    alignSelf: "center",
  },
  friendLabelText: { fontSize: 10, color: "#fff", fontWeight: "700" },
});
