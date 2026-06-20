import React, { useEffect, useRef } from "react";
import { View, Animated } from "react-native";


export function TabSkeleton({ rows = 4 }: { rows?: number }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });
  return (
    <View style={{ paddingVertical: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Animated.View
          key={i}
          style={{
            opacity,
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: "#f0f0f0",
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: "#e8e8e8",
              marginRight: 12,
            }}
          />
          <View style={{ flex: 1, gap: 6 }}>
            <View
              style={{
                height: 13,
                backgroundColor: "#e8e8e8",
                borderRadius: 6,
                width: "70%",
              }}
            />
            <View
              style={{
                height: 11,
                backgroundColor: "#f0f0f0",
                borderRadius: 6,
                width: "45%",
              }}
            />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}
