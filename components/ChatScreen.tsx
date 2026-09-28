import {
  endAt,
  get,
  limitToLast,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  set,
  serverTimestamp,
  update,
} from "firebase/database";
import { sendPush, setOpenChatUid } from "../lib/notifications";
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

export const DAY_MS = 24 * 60 * 60 * 1000;
export const chatIdFor = (a: string, b: string) => [a, b].sort().join("_");

// Deletes messages older than 24h from the database
export async function purgeExpiredChat(chatId: string) {
  try {
    const q = query(
      ref(database, `chats/${chatId}/messages`),
      orderByChild("ts"),
      endAt(Date.now() - DAY_MS),
    );
    const snap = await get(q);
    const updates: Record<string, null> = {};
    snap.forEach((child) => {
      updates[child.key as string] = null;
    });
    if (Object.keys(updates).length)
      await update(ref(database, `chats/${chatId}/messages`), updates);
  } catch {}
}

export default function ChatScreen({
  userId,
  friend,
  photo,
    onClose,
  myName,
}: {
  userId: string;
  friend: { uid: string; name: string };
  photo?: string | null;
    onClose: () => void;
  myName?: string;
}) {
  const chatId = [userId, friend.uid].sort().join("_");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const listRef = useRef<FlatList<Msg>>(null);

  useEffect(() => {
    purgeExpiredChat(chatId);
    const q = query(ref(database, `chats/${chatId}/messages`), limitToLast(100));
    const unsub = onValue(q, (snap) => {
      const data = snap.val() || {};
      setMessages(
        Object.entries(data)
          .map(([id, v]: any) => ({ id, ...v }))
                   .filter((m: Msg) => m.ts > Date.now() - DAY_MS)
          .sort((a: Msg, b: Msg) => a.ts - b.ts),
      );
    });
       setOpenChatUid(friend.uid);
    return () => {
      setOpenChatUid(null);
      unsub();
    };
  }, [chatId]);

  function send() {
    const t = text.trim();
    if (!t) return;
       setText("");
    sendPush(
      friend.uid,
      myName || "New message",
      t.length > 100 ? t.slice(0, 100) + "…" : t,
      { fromUid: userId, fromName: myName || "" },
    );
    set(push(ref(database, `chats/${chatId}/messages`)), {
      from: userId,
      text: t,
    ts: serverTimestamp(),
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

          <View style={s.notice}>
        <Text style={s.noticeText}>
          🕒 Messages in this chat disappear after 24 hours.
        </Text>
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
  notice: { backgroundColor: "#f0f7f3", paddingVertical: 8, paddingHorizontal: 16 },
  noticeText: { fontSize: 12, color: "#4a8c63", textAlign: "center", fontWeight: "600" },
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