import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { GREEN, DAY_LABEL, DAY_ORDER, type Day, type WeeklyHours } from "../lib/serviceShared";

export type HoursDraft = Record<Day, { open: boolean; from: string; to: string }>;

export function defaultDraft(): HoursDraft {
  const d = {} as HoursDraft;
  for (const day of DAY_ORDER) {
    d[day] = { open: day !== "sun", from: "08:00", to: "18:00" };
  }
  return d;
}

export function draftFromHours(h?: WeeklyHours): HoursDraft | null {
  if (!h || Object.keys(h).length === 0) return null;
  const d = defaultDraft();
  for (const day of DAY_ORDER) {
    const e = h[day];
    if (!e || e === "closed") d[day] = { ...d[day], open: false };
    else d[day] = { open: true, from: e.open, to: e.close };
  }
  return d;
}

export function normalizeTime(raw: string): string | null {
  const t = raw.trim();
  let h: number;
  let m: number;
  if (t.includes(":")) {
    const [a, b = ""] = t.split(":");
    h = parseInt(a, 10);
    m = parseInt(b || "0", 10);
  } else {
    const digits = t.replace(/\D/g, "");
    if (!digits) return null;
    if (digits.length <= 2) { h = parseInt(digits, 10); m = 0; }
    else { h = parseInt(digits.slice(0, -2), 10); m = parseInt(digits.slice(-2), 10); }
  }
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function validateDraft(d: HoursDraft): string | null {
  for (const day of DAY_ORDER) {
    const r = d[day];
    if (!r.open) continue;
    const from = normalizeTime(r.from);
    const to = normalizeTime(r.to);
    if (!from || !to) return `${DAY_LABEL[day]}: enter valid times like 08:00.`;
    if (from >= to) return `${DAY_LABEL[day]}: closing time must be after opening time.`;
  }
  if (DAY_ORDER.every((day) => !d[day].open)) return "Open at least one day, or turn hours off.";
  return null;
}

export function draftToHours(d: HoursDraft): WeeklyHours {
  const out: WeeklyHours = {};
  for (const day of DAY_ORDER) {
    const r = d[day];
    out[day] = r.open
      ? { open: normalizeTime(r.from)!, close: normalizeTime(r.to)! }
      : "closed";
  }
  return out;
}

export function HoursEditor({
  draft, onChange,
}: {
  draft: HoursDraft | null;
  onChange: (d: HoursDraft | null) => void;
}) {
  function patch(day: Day, p: Partial<HoursDraft[Day]>) {
    if (!draft) return;
    onChange({ ...draft, [day]: { ...draft[day], ...p } });
  }

  function blurTime(day: Day, key: "from" | "to") {
    if (!draft) return;
    const fixed = normalizeTime(draft[day][key]);
    if (fixed) patch(day, { [key]: fixed });
  }

  function copyMonToAll() {
    if (!draft) return;
    const mon = draft.mon;
    const next = { ...draft };
    for (const day of DAY_ORDER) next[day] = { ...mon };
    onChange(next);
  }

  return (
    <View style={s.wrap}>
      <View style={s.headRow}>
        <Text style={s.label}>Business hours (optional)</Text>
        <Switch
          value={!!draft}
          onValueChange={(on) => onChange(on ? defaultDraft() : null)}
          trackColor={{ true: GREEN, false: "#ddd" }}
        />
      </View>

      {draft && (
        <View style={s.card}>
          {DAY_ORDER.map((day) => {
            const r = draft[day];
            return (
              <View key={day} style={s.row}>
                <Text style={s.day}>{DAY_LABEL[day]}</Text>
                <Switch
                  value={r.open}
                  onValueChange={(v) => patch(day, { open: v })}
                  trackColor={{ true: GREEN, false: "#ddd" }}
                  style={{ transform: [{ scale: 0.8 }] }}
                />
                {r.open ? (
                  <View style={s.times}>
                    <TextInput
                      style={s.time}
                      value={r.from}
                      onChangeText={(t) => patch(day, { from: t })}
                      onBlur={() => blurTime(day, "from")}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                    />
                    <Text style={s.to}>to</Text>
                    <TextInput
                      style={s.time}
                      value={r.to}
                      onChangeText={(t) => patch(day, { to: t })}
                      onBlur={() => blurTime(day, "to")}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                    />
                  </View>
                ) : (
                  <Text style={s.closed}>Closed</Text>
                )}
              </View>
            );
          })}
          <TouchableOpacity onPress={copyMonToAll} style={s.copyBtn} activeOpacity={0.7}>
            <Text style={s.copyText}>Copy Monday's hours to every day</Text>
          </TouchableOpacity>
          <Text style={s.hint}>Use 24-hour time, e.g. 08:00 to 20:00.</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 16 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 13, fontWeight: "600", color: "#555" },
  card: {
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1.5,
    borderColor: "#e0e0e0", padding: 12, marginTop: 8,
  },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 3 },
  day: { width: 40, fontSize: 13.5, fontWeight: "700", color: "#333" },
  times: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 6 },
  time: {
    width: 68, textAlign: "center", backgroundColor: "#F5F7F5", borderRadius: 8,
    borderWidth: 1, borderColor: "#e4e8e4", paddingVertical: 7, fontSize: 14, color: "#333",
  },
  to: { fontSize: 12, color: "#999" },
  closed: { marginLeft: 10, fontSize: 13.5, color: "#c0392b", fontWeight: "600" },
  copyBtn: { alignSelf: "flex-start", marginTop: 8, paddingVertical: 4 },
  copyText: { color: GREEN, fontSize: 12.5, fontWeight: "700" },
  hint: { fontSize: 11.5, color: "#999", marginTop: 6 },
});