import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { get, onValue, ref, remove, set } from "firebase/database";
import { Star } from "lucide-react-native";
import { database } from "../lib/firebase";

const GOLD = "#d97706";

async function syncAggregate(serviceId: string) {
  const snap = await get(ref(database, `ratings/${serviceId}`));
  const all = Object.values(snap.val() || {}) as { stars: number }[];
  const count = all.length;
  const avg = count ? all.reduce((sum, r) => sum + Number(r.stars), 0) / count : null;
  await Promise.all([
    set(ref(database, `services/${serviceId}/rating`), avg == null ? null : Math.round(avg * 10) / 10),
    set(ref(database, `services/${serviceId}/ratingCount`), count || null),
  ]);
}

export function RateService({
  serviceId, ownerId, uid,
}: {
  serviceId: string;
  ownerId: string;
  uid: string | null;
}) {
  const [mine, setMine] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const unsub = onValue(ref(database, `ratings/${serviceId}/${uid}`), (snap) => {
      setMine(snap.exists() ? Number(snap.val().stars) || 0 : 0);
    });
    return () => unsub();
  }, [serviceId, uid]);

  if (!uid || uid === ownerId) return null;

  async function rate(stars: number) {
    if (busy) return;
    setBusy(true);
    try {
      if (stars === mine) {
        await remove(ref(database, `ratings/${serviceId}/${uid}`));
      } else {
        await set(ref(database, `ratings/${serviceId}/${uid}`), { stars, createdAt: Date.now() });
      }
      await syncAggregate(serviceId);
    } catch {
      Alert.alert("Error", "Could not save your rating. Try again.");
    }
    setBusy(false);
  }

  return (
    <View style={s.card}>
      <Text style={s.label}>RATE THIS SERVICE</Text>
      <View style={s.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} onPress={() => rate(n)} hitSlop={6} activeOpacity={0.7}>
            <Star
              size={32}
              color={GOLD}
              fill={n <= mine ? GOLD : "transparent"}
              strokeWidth={2}
            />
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.hint}>
        {mine ? "Thanks! Tap your rating again to remove it." : "Tap a star to rate."}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: "#f0f0f0", alignItems: "center",
  },
  label: {
    alignSelf: "flex-start", fontSize: 11, fontWeight: "700",
    color: "#999", letterSpacing: 1, marginBottom: 12,
  },
  stars: { flexDirection: "row", gap: 10 },
  hint: { fontSize: 12, color: "#999", marginTop: 10 },
});