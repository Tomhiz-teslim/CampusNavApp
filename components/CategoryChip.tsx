import { ComponentType } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import type { LucideProps } from "lucide-react-native";

const GREEN = "#1a5c38";

export interface CategoryChipProps {
  icon: ComponentType<LucideProps>;
  label: string;
  active?: boolean;
  onPress: () => void;
}

export function CategoryChip({ icon: Icon, label, active, onPress }: CategoryChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Icon size={15} color={active ? "#fff" : "#556155"} strokeWidth={2.2} />
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e2e8e2",
    backgroundColor: "#fff",
    marginRight: 8,
  },
  chipActive: { backgroundColor: GREEN, borderColor: GREEN },
  label: { fontSize: 13, fontWeight: "600", color: "#556155" },
  labelActive: { color: "#fff" },
});

export default CategoryChip;