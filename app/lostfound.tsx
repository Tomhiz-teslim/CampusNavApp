import * as ImagePicker from "expo-image-picker";
import { push, ref, onValue, set } from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { auth, database } from "../lib/firebase";
import { StyledModal, useStyledModal } from "./StyledModal";

type LostFoundCategory =
  | "Phone"
  | "ID Card"
  | "Wallet"
  | "Keys"
  | "Laptop"
  | "Bag"
  | "Other";

const CATEGORIES: LostFoundCategory[] = [
  "Phone",
  "ID Card",
  "Wallet",
  "Keys",
  "Laptop",
  "Bag",
  "Other",
];

const CATEGORY_ICONS: Record<LostFoundCategory, string> = {
  Phone: "📱",
  "ID Card": "🪪",
  Wallet: "👛",
  Keys: "🔑",
  Laptop: "💻",
  Bag: "🎒",
  Other: "📦",
};

const LF_CATEGORY_COLORS: Record<LostFoundCategory, { pin: string; dot: string }> = {
  Phone: { pin: "#1A73E8", dot: "#e8f0fe" },
  "ID Card": { pin: "#7c3aed", dot: "#ede9fe" },
  Wallet: { pin: "#d97706", dot: "#fef3c7" },
  Keys: { pin: "#e67e22", dot: "#fdf0e3" },
  Laptop: { pin: "#0891b2", dot: "#e0f7fa" },
  Bag: { pin: "#c0392b", dot: "#fdecea" },
  Other: { pin: "#4a8c63", dot: "#e8f5ee" },
};

interface LostFoundItem {
  id: string;
  title: string;
  category: LostFoundCategory;
  description: string;
  location: string;
  dateFound: string;
  photoBase64?: string | null;
  phone: string;
  reporterId?: string;
  createdAt: number;
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function timeAgo(createdAt: number) {
  const diffMs = Date.now() - createdAt;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function LostFoundScreen() {
  const router = useRouter();
  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { config: modal, alert: showAlert } = useStyledModal();

  useEffect(() => {
    const unsub = onValue(ref(database, "lostFoundItems"), (snap) => {
      setLoaded(true);
      const data = snap.val() || {};
      const list: LostFoundItem[] = Object.entries(data).map(
        ([id, v]: any) => ({ id, ...v }),
      );
      list.sort((a, b) => b.createdAt - a.createdAt);
      setItems(list);
    });
    return () => unsub();
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.title?.toLowerCase().includes(q) ||
        it.description?.toLowerCase().includes(q) ||
        it.category?.toLowerCase().includes(q) ||
        it.location?.toLowerCase().includes(q),
    );
  }, [items, search]);

  function handleCall(phone: string) {
    const cleaned = phone.replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${cleaned}`).catch(() => {
      showAlert("Couldn't place call", "Try dialing the number manually.", "📞");
    });
  }

  return (
    <View style={styles.container}>
      <StyledModal {...modal} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lost & Found</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.body}>
        {/* Search bar */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by item, e.g. 'iPhone', 'Student ID'…"
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Report button */}
        <TouchableOpacity
          style={styles.reportBtn}
          onPress={() => setShowForm(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.reportBtnIcon}>➕</Text>
          <Text style={styles.reportBtnText}>Report Found Item</Text>
        </TouchableOpacity>

        {/* Feed */}
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {!loaded ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#2ECC71" />
              <Text style={styles.loadingText}>Loading items…</Text>
            </View>
          ) : filteredItems.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={styles.emptyEmoji}>🔎</Text>
              <Text style={styles.emptyTitle}>
                {search ? "No matching items" : "No items reported yet"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {search
                  ? "Try another keyword or check back later."
                  : "Be the first to report a found item!"}
              </Text>
            </View>
          ) : (
            filteredItems.map((item) => (
              <LostFoundCard key={item.id} item={item} onCall={handleCall} />
            ))
          )}
        </ScrollView>
      </View>

      {showForm && (
        <ReportFoundItemModal
          onClose={() => setShowForm(false)}
          onSubmitted={() => {
            setShowForm(false);
            showAlert(
              "✅ Reported!",
              "Thanks for helping reunite this item with its owner.",
              "🙌",
            );
          }}
          onError={() =>
            showAlert("Something went wrong", "Please try again.", "⚠️")
          }
        />
      )}
    </View>
  );
}

// ── Feed card ────────────────────────────────────────────────────────────
function LostFoundCard({
  item,
  onCall,
}: {
  item: LostFoundItem;
  onCall: (phone: string) => void;
}) {
  const colors = LF_CATEGORY_COLORS[item.category] || LF_CATEGORY_COLORS.Other;

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.topRow}>
        {item.photoBase64 ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${item.photoBase64}` }}
            style={cardStyles.thumb}
          />
        ) : (
          <View style={[cardStyles.thumb, cardStyles.thumbPlaceholder]}>
            <Text style={{ fontSize: 26 }}>
              {CATEGORY_ICONS[item.category] || "📦"}
            </Text>
          </View>
        )}

        <View style={cardStyles.info}>
          <View style={cardStyles.titleRow}>
            <Text style={cardStyles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={[cardStyles.pill, { backgroundColor: colors.dot }]}>
              <Text style={[cardStyles.pillText, { color: colors.pin }]}>
                {CATEGORY_ICONS[item.category]} {item.category}
              </Text>
            </View>
          </View>

          {!!item.description && (
            <Text style={cardStyles.desc} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          <View style={cardStyles.metaRow}>
            <Text style={cardStyles.metaText}>📍 {item.location}</Text>
            <Text style={cardStyles.metaDot}>·</Text>
            <Text style={cardStyles.metaText}>🗓️ {item.dateFound}</Text>
          </View>
          <Text style={cardStyles.postedAgo}>{timeAgo(item.createdAt)}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={cardStyles.callBtn}
        onPress={() => onCall(item.phone)}
        activeOpacity={0.85}
      >
        <Text style={cardStyles.callBtnText}>📞 Call Finder · {item.phone}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Report form modal ───────────────────────────────────────────────────
function ReportFoundItemModal({
  onClose,
  onSubmitted,
  onError,
}: {
  onClose: () => void;
  onSubmitted: () => void;
  onError: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<LostFoundCategory>("Phone");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [dateFound, setDateFound] = useState(todayLabel());
  const [phone, setPhone] = useState("");
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isValid =
    title.trim().length > 0 &&
    location.trim().length > 0 &&
    phone.trim().length >= 7;

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    setPickingPhoto(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        quality: 0.4,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets?.[0]?.base64) {
        setPhotoBase64(result.assets[0].base64);
      }
    } finally {
      setPickingPhoto(false);
    }
  }

  async function handleSubmit() {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      const newRef = push(ref(database, "lostFoundItems"));
      await set(newRef, {
        title: title.trim(),
        category,
        description: description.trim(),
        location: location.trim(),
        dateFound: dateFound.trim(),
        phone: phone.trim(),
        photoBase64: photoBase64 || null,
        reporterId: auth.currentUser?.uid || null,
        createdAt: Date.now(),
      });
      onSubmitted();
    } catch {
      onError();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal animationType="slide" transparent onRequestClose={onClose}>
      <View style={formStyles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ width: "100%" }}
        >
          <View style={formStyles.sheet}>
            <View style={formStyles.handle} />
            <View style={formStyles.headerRow}>
              <Text style={formStyles.header}>Report Found Item</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={formStyles.closeX}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: "100%" }}
            >
              <Text style={formStyles.label}>Item name / title *</Text>
              <TextInput
                style={formStyles.input}
                placeholder="e.g. Black iPhone 13"
                placeholderTextColor="#999"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={formStyles.label}>Category *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 4 }}
              >
                {CATEGORIES.map((cat) => {
                  const active = category === cat;
                  const colors = LF_CATEGORY_COLORS[cat];
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        formStyles.chip,
                        active && {
                          backgroundColor: colors.pin,
                          borderColor: colors.pin,
                        },
                      ]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text style={formStyles.chipIcon}>
                        {CATEGORY_ICONS[cat]}
                      </Text>
                      <Text
                        style={[
                          formStyles.chipText,
                          active && formStyles.chipTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={formStyles.label}>Description</Text>
              <TextInput
                style={[formStyles.input, formStyles.textArea]}
                placeholder="Any distinguishing details (color, case, stickers…)"
                placeholderTextColor="#999"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              <Text style={formStyles.label}>Location found *</Text>
              <TextInput
                style={formStyles.input}
                placeholder="e.g. Faculty of Science, near the library"
                placeholderTextColor="#999"
                value={location}
                onChangeText={setLocation}
              />

              <Text style={formStyles.label}>Date found</Text>
              <TextInput
                style={formStyles.input}
                value={dateFound}
                onChangeText={setDateFound}
                placeholder={todayLabel()}
                placeholderTextColor="#999"
              />

              <Text style={formStyles.label}>Photo (optional)</Text>
              <TouchableOpacity
                style={formStyles.photoPicker}
                onPress={handlePickPhoto}
                disabled={pickingPhoto}
              >
                {pickingPhoto ? (
                  <ActivityIndicator color="#1a5c38" />
                ) : photoBase64 ? (
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${photoBase64}` }}
                    style={formStyles.photoPreview}
                  />
                ) : (
                  <>
                    <Text style={{ fontSize: 22 }}>📷</Text>
                    <Text style={formStyles.photoPickerText}>Add a photo</Text>
                  </>
                )}
              </TouchableOpacity>
              {photoBase64 && (
                <TouchableOpacity onPress={() => setPhotoBase64(null)}>
                  <Text style={formStyles.removePhoto}>Remove photo</Text>
                </TouchableOpacity>
              )}

              <Text style={formStyles.label}>Your phone number *</Text>
              <TextInput
                style={formStyles.input}
                placeholder="So the owner can reach you"
                placeholderTextColor="#999"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={[
                  formStyles.submitBtn,
                  !isValid && formStyles.submitBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!isValid || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={formStyles.submitBtnText}>Submit Report</Text>
                )}
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────
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
  body: { flex: 1, padding: 16 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: "#333" },
  clearText: { fontSize: 14, color: "#999", paddingHorizontal: 4 },
  reportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a5c38",
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 14,
    gap: 8,
    shadowColor: "#1a5c38",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  reportBtnIcon: { fontSize: 16, color: "#fff" },
  reportBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  listContent: { paddingBottom: 32 },
  centerBox: { alignItems: "center", justifyContent: "center", paddingVertical: 60, paddingHorizontal: 20 },
  loadingText: { marginTop: 12, color: "#888", fontSize: 15 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#333", marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: "#888", textAlign: "center", lineHeight: 20 },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  topRow: { flexDirection: "row" },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginRight: 12,
  },
  thumbPlaceholder: {
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
  },
  info: { flex: 1 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  title: { fontSize: 15, fontWeight: "700", color: "#222", flexShrink: 1 },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: "700" },
  desc: { fontSize: 13, color: "#777", marginTop: 4, lineHeight: 18 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 6, flexWrap: "wrap" },
  metaText: { fontSize: 12, color: "#999" },
  metaDot: { fontSize: 12, color: "#ccc", marginHorizontal: 6 },
  postedAgo: { fontSize: 11, color: "#bbb", marginTop: 3 },
  callBtn: {
    backgroundColor: "#e8f0fe",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 12,
  },
  callBtnText: { color: "#1A73E8", fontSize: 14, fontWeight: "700" },
});

const formStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 30 : 18,
    maxHeight: "88%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ddd",
    alignSelf: "center",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  header: { fontSize: 17, fontWeight: "800", color: "#1a5c38" },
  closeX: { fontSize: 18, color: "#999", padding: 4 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    marginBottom: 6,
    marginTop: 12,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: "#222",
  },
  textArea: { minHeight: 70, textAlignVertical: "top" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#ddd",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    gap: 5,
  },
  chipIcon: { fontSize: 13 },
  chipText: { fontSize: 12, color: "#555", fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  photoPicker: {
    height: 100,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#ddd",
    borderStyle: "dashed",
    backgroundColor: "#fafafa",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    overflow: "hidden",
  },
  photoPickerText: { fontSize: 12, color: "#999", fontWeight: "600" },
  photoPreview: { width: "100%", height: "100%" },
  removePhoto: {
    fontSize: 12,
    color: "#c0392b",
    marginTop: 6,
    textAlign: "right",
  },
  submitBtn: {
    backgroundColor: "#1a5c38",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  submitBtnDisabled: { backgroundColor: "#a8c3b3" },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});