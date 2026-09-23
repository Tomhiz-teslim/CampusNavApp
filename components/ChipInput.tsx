import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Plus, X } from "lucide-react-native";
import { GREEN, GREEN_TINT } from "../lib/serviceShared";

export function ChipInput({
  label, placeholder, values, onChange, suggestions = [], max = 8,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
  max?: number;
}) {
  const [text, setText] = useState("");

  function add(raw: string) {
    const v = raw.trim().slice(0, 30);
    if (!v || values.length >= max) return;
    if (values.some((x) => x.toLowerCase() === v.toLowerCase())) { setText(""); return; }
    onChange([...values, v]);
    setText("");
  }

  const unused = suggestions.filter(
    (sg) => !values.some((x) => x.toLowerCase() === sg.toLowerCase())
  );

  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>

      {values.length > 0 && (
        <View style={s.chips}>
          {values.map((v) => (
            <View key={v} style={s.chip}>
              <Text style={s.chipText}>{v}</Text>
              <TouchableOpacity onPress={() => onChange(values.filter((x) => x !== v))} hitSlop={8}>
                <X size={12} color={GREEN} strokeWidth={3} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {values.length < max && (
        <View style={s.row}>
          <TextInput
            style={s.input}
            placeholder={placeholder}
            placeholderTextColor="#bbb"
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => add(text)}
            returnKeyType="done"
            maxLength={30}
          />
          <TouchableOpacity style={s.addBtn} onPress={() => add(text)} activeOpacity={0.8}>
            <Plus size={18} color="#fff" strokeWidth={2.6} />
          </TouchableOpacity>
        </View>
      )}

      {values.length < max && unused.length > 0 && (
        <View style={s.chips}>
          {unused.map((sg) => (
            <TouchableOpacity key={sg} style={s.suggest} onPress={() => add(sg)} activeOpacity={0.7}>
              <Text style={s.suggestText}>+ {sg}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 6, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: GREEN_TINT, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 6,
  },
  chipText: { fontSize: 12.5, fontWeight: "600", color: GREEN },
  row: { flexDirection: "row", gap: 8, marginBottom: 8 },
  input: {
    flex: 1, backgroundColor: "#fff", borderRadius: 10, borderWidth: 1.5,
    borderColor: "#e0e0e0", padding: 12, fontSize: 14, color: "#333",
  },
  addBtn: {
    width: 46, borderRadius: 10, backgroundColor: GREEN,
    alignItems: "center", justifyContent: "center",
  },
  suggest: {
    borderWidth: 1, borderColor: "#dbe5dd", borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#fff",
  },
  suggestText: { fontSize: 12, color: "#6b756b", fontWeight: "600" },
});