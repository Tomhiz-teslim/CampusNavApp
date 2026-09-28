import { limitToLast, onValue, push, query, ref, set } from "firebase/database";
import { ArrowLeft, Send } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { database } from "../lib/firebase";

type Msg = { id: string; from: string; text: string; ts: number };

export default function ChatScreen({
  userId,
  friend,
  photo,
  onClose,
}: {
  userId: string;
  friend: { uid: string; name: string };
  photo?: string | null;
  onClose: () => void;
}) {
  const chatId = [userId, friend.uid].sort().join("_");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const listRef = useRef<FlatList<Msg>>(null);

  useEffect(() => {
    const q = query(ref(database, `chats/${chatId}/messages`), limitToLast(100));
    const unsub = onValue(q, (snap) => {
      const data = snap.val() || {};
      setMessages(
        Object.entries(data)
          .map(([id, v]: any) => ({ id, ...v }))
          .sort((a: Msg, b: Msg) => a.ts - b.ts),
      );
    });
    return () => unsub();
  }, [chatId]);

  function send() {
    const t = text.trim();
    if (!t) return;
    setText("");
    set(push(ref(database, `chats/${chatId}/messages`)), {
      from: userId,
      text: t,
      ts: Date.now(),
    });
  }

  return (
    <KeyboardAvoidingView
      style={s.wrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={22} color="#111" strokeWidth={2.4} />
        </TouchableOpacity>
        {photo ? (
          <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarFallback]}>
            <Text style={s.avatarText}>{(friend.name || "?")[0].toUpperCase()}</Text>
          </View>
        )}
        <Text style={s.name} numberOfLines={1}>{friend.name}</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, flexGrow: 1, justifyContent: "flex-end" }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text style={s.empty}>Say hi to {friend.name.split(" ")[0]} 👋</Text>}
        renderItem={({ item }) => {
          const mine = item.from === userId;
          return (
            <View style={[s.bubble, mine ? s.mine : s.theirs]}>
              <Text style={[s.msgText, mine && { color: "#fff" }]}>{item.text}</Text>
            </View>
          );
        }}
      />

      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder="Message…"
          placeholderTextColor="#999"
          multiline
        />
        <TouchableOpacity style={s.sendBtn} onPress={send}>
          <Send size={18} color="#fff" strokeWidth={2.4} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#fff", zIndex: 50 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: Platform.OS === "ios" ? 56 : 36,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { backgroundColor: "#1a5c38", justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#fff", fontWeight: "700" },
  name: { flex: 1, fontSize: 16, fontWeight: "700", color: "#111" },
  empty: { textAlign: "center", color: "#aaa", marginBottom: 20 },
  bubble: { maxWidth: "78%", borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9, marginBottom: 6 },
  mine: { alignSelf: "flex-end", backgroundColor: "#1a5c38", borderBottomRightRadius: 4 },
  theirs: { alignSelf: "flex-start", backgroundColor: "#f0f2f1", borderBottomLeftRadius: 4 },
  msgText: { fontSize: 14, color: "#222" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    paddingBottom: Platform.OS === "ios" ? 30 : 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  input: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: "#f5f7f6",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#222",
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#1a5c38",
    justifyContent: "center",
    alignItems: "center",
  },
});