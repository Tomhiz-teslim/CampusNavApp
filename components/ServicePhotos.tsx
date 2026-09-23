import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Image, ScrollView, StyleSheet,
  Text, TouchableOpacity, useWindowDimensions, View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, X } from "lucide-react-native";
import { GREEN, GREEN_TINT } from "../lib/serviceShared";
import { uploadImage } from "../lib/uploadImage";

const MAX_PHOTOS = 5;

export function PhotoPicker({
  photos,
  onChange,
  onUploadingChange,
}: {
  photos: string[];
  onChange: (photos: string[]) => void;
  onUploadingChange?: (busy: boolean) => void;
}) {
  const [uploading, setUploading] = useState(0);

  useEffect(() => {
    onUploadingChange?.(uploading > 0);
  }, [uploading]);

  async function pick() {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0 || uploading) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo access to add service images.");
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.6,
    });
    if (res.canceled) return;

    setUploading(res.assets.length);
    try {
      const urls = await Promise.all(res.assets.map((a) => uploadImage(a.uri)));
      onChange([...photos, ...urls]);
    } catch {
      Alert.alert("Upload failed", "Check your connection and try again.");
    } finally {
      setUploading(0);
    }
  }

  function remove(url: string) {
    onChange(photos.filter((p) => p !== url));
  }

  function makeCover(url: string) {
    onChange([url, ...photos.filter((p) => p !== url)]);
  }

  return (
    <View>
      <Text style={pStyles.label}>PHOTOS ({photos.length}/{MAX_PHOTOS})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {photos.map((url, i) => (
          <TouchableOpacity key={url} activeOpacity={0.9} onPress={() => makeCover(url)}>
            <Image source={{ uri: url }} style={pStyles.thumb} />
            {i === 0 && (
              <View style={pStyles.coverBadge}>
                <Text style={pStyles.coverText}>Cover</Text>
              </View>
            )}
            <TouchableOpacity style={pStyles.removeBtn} onPress={() => remove(url)} hitSlop={8}>
              <X size={12} color="#fff" strokeWidth={3} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {Array.from({ length: uploading }).map((_, i) => (
          <View key={`u${i}`} style={[pStyles.thumb, pStyles.center]}>
            <ActivityIndicator color={GREEN} />
          </View>
        ))}

        {photos.length + uploading < MAX_PHOTOS && (
          <TouchableOpacity style={[pStyles.thumb, pStyles.add, pStyles.center]} onPress={pick}>
            <ImagePlus size={24} color={GREEN} strokeWidth={2} />
            <Text style={pStyles.addText}>Add</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <Text style={pStyles.hint}>Tap a photo to make it the cover.</Text>
    </View>
  );
}

export function PhotoCarousel({ photos, height }: { photos: string[]; height: number }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  return (
    <View style={{ width, height }}>
      <FlatList
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={photos}
        keyExtractor={(u, i) => u + i}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <Image source={{ uri: item }} style={{ width, height }} resizeMode="cover" />
        )}
      />
      {photos.length > 1 && (
        <View style={pStyles.dots}>
          {photos.map((_, i) => (
            <View key={i} style={[pStyles.dot, i === index && pStyles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const pStyles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: "700", color: "#9aa39a", letterSpacing: 0.8, marginBottom: 10 },
  thumb: { width: 92, height: 92, borderRadius: 14, backgroundColor: GREEN_TINT },
  center: { alignItems: "center", justifyContent: "center" },
  add: { borderWidth: 1.5, borderColor: GREEN, borderStyle: "dashed", backgroundColor: "#fff" },
  addText: { fontSize: 12, fontWeight: "600", color: GREEN, marginTop: 4 },
  coverBadge: {
    position: "absolute", bottom: 6, left: 6, backgroundColor: GREEN,
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
  },
  coverText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  removeBtn: {
    position: "absolute", top: 5, right: 5, width: 20, height: 20, borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center",
  },
  hint: { fontSize: 11.5, color: "#9aa39a", marginTop: 8 },
  dots: {
    position: "absolute", bottom: 12, right: 14, flexDirection: "row", gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { backgroundColor: "#fff", width: 16 },
});