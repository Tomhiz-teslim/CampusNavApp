import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const REASONS = [
  "Wrong or misleading information",
  "Scam or fraud",
  "Inappropriate content",
  "Business no longer exists",
  "Something else",
];

export function ReportModal({
  visible, onClose, onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <Text style={s.title}>Report this listing</Text>
          <Text style={s.sub}>What's wrong with it?</Text>
          {REASONS.map((r) => (
            <TouchableOpacity key={r} style={s.row} onPress={() => onSubmit(r)} activeOpacity={0.7}>
              <Text style={s.rowText}>{r}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={s.cancel} onPress={onClose}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 20, paddingBottom: 32,
  },
  title: { fontSize: 17, fontWeight: "800", color: "#1a1a1a" },
  sub: { fontSize: 13, color: "#888", marginTop: 2, marginBottom: 10 },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  rowText: { fontSize: 15, color: "#333", fontWeight: "500" },
  cancel: { alignItems: "center", paddingTop: 16 },
  cancelText: { fontSize: 15, color: "#888", fontWeight: "600" },
});