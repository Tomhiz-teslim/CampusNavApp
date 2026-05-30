import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";

export interface ModalButton {
  text: string;
  style?: "default" | "destructive" | "cancel";
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  icon?: string;
  buttons: ModalButton[];
}

export function StyledModal({ visible, title, message, icon, buttons }: Props) {
  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      <View style={s.overlay}>
        <View style={s.card}>
          {icon ? <Text style={s.icon}>{icon}</Text> : null}
          <Text style={s.title}>{title}</Text>
          {message ? <Text style={s.message}>{message}</Text> : null}
          <View style={[s.btnRow, buttons.length > 2 && s.btnCol]}>
            {buttons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  s.btn,
                  buttons.length <= 2 && { flex: 1 },
                  btn.style === "destructive" && s.btnDestructive,
                  btn.style === "cancel"      && s.btnCancel,
                  btn.style === "default"     && s.btnPrimary,
                  (!btn.style)               && s.btnPrimary,
                ]}
                onPress={btn.onPress}
                activeOpacity={0.8}
              >
                <Text style={[
                  s.btnText,
                  btn.style === "destructive" && s.btnTextDestructive,
                  btn.style === "cancel"      && s.btnTextCancel,
                  (btn.style === "default" || !btn.style) && s.btnTextPrimary,
                ]}>
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Hook for easy usage anywhere ─────────────────────────────────────────────
import { useState } from "react";

export interface ModalConfig {
  visible: boolean;
  title: string;
  message?: string;
  icon?: string;
  buttons: ModalButton[];
}

const HIDDEN: ModalConfig = { visible: false, title: "", buttons: [] };

export function useStyledModal() {
  const [config, setConfig] = useState<ModalConfig>(HIDDEN);

  function showModal(
    title: string,
    message: string,
    buttons: ModalButton[],
    icon?: string
  ) {
    setConfig({ visible: true, title, message, icon, buttons });
  }

  function hideModal() {
    setConfig((c) => ({ ...c, visible: false }));
  }

  function confirm(
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText = "Confirm",
    icon?: string,
    destructive = false
  ) {
    setConfig({
      visible: true, title, message, icon,
      buttons: [
        { text: "Cancel", style: "cancel", onPress: hideModal },
        { text: confirmText, style: destructive ? "destructive" : "default", onPress: () => { hideModal(); onConfirm(); } },
      ],
    });
  }

  function alert(title: string, message: string, icon?: string) {
    setConfig({
      visible: true, title, message, icon,
      buttons: [{ text: "OK", style: "default", onPress: hideModal }],
    });
  }

  return { config, showModal, hideModal, confirm, alert };
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  card:             { backgroundColor: "#fff", borderRadius: 20, padding: 24, width: "100%", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  icon:             { fontSize: 40, marginBottom: 10 },
  title:            { fontSize: 17, fontWeight: "700", color: "#1a1a1a", textAlign: "center", marginBottom: 8 },
  message:          { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 20, marginBottom: 20 },
  btnRow:           { flexDirection: "row", gap: 10, width: "100%" },
  btnCol:           { flexDirection: "column" },
  btn:              { borderRadius: 12, paddingVertical: 13, alignItems: "center", justifyContent: "center" },
  btnPrimary:       { backgroundColor: "#1a5c38" },
  btnDestructive:   { backgroundColor: "#e74c3c" },
  btnCancel:        { backgroundColor: "#f0f0f0" },
  btnText:          { fontSize: 15, fontWeight: "700" },
  btnTextPrimary:   { color: "#fff" },
  btnTextDestructive:{ color: "#fff" },
  btnTextCancel:    { color: "#555" },
});