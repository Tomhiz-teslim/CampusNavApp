import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { Marker } from "react-native-maps";
import { CATEGORY_COLORS } from "../lib/campusData";

export function BuildingMarker({
  building,
  onPress,
}: {
  building: any;
  onPress: () => void;
}) {
  const colors = CATEGORY_COLORS[building.category] || CATEGORY_COLORS.admin;
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
      <View
        style={[
          mStyles.pin,
          { backgroundColor: colors.pin, borderColor: colors.dot },
        ]}
      >
        <Text style={mStyles.emoji}>{building.icon}</Text>
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
  return (
    <Marker
      coordinate={{ latitude: friend.latitude, longitude: friend.longitude }}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={false}
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
    backgroundColor: "#e67e22",
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
    borderTopColor: "#e67e22",
    alignSelf: "center",
    marginTop: -1,
  },
  friendLabel: {
    backgroundColor: "#e67e22",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 2,
    alignSelf: "center",
  },
  friendLabelText: { fontSize: 10, color: "#fff", fontWeight: "700" },
});

