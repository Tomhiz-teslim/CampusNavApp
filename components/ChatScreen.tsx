import {
  endAt,
  get,
  increment,
  limitToLast,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  set,
  serverTimestamp,
  update,
} from "firebase/database";
import { sendPush, setOpenChatUid } from "../lib/notifications";
import { ArrowLeft, Pencil, Reply, Send, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { database } from "../lib/firebase";

type Msg = {
  id: string;
  from: string;
  text: string;
  ts: number;
  seenAt?: number;
  deletedFor?: Record<string, boolean>;
  edited?: boolean;
  replyTo?: { id: string; from: string; text: string };
};

export const DAY_MS = 24 * 60 * 60 * 1000;
export const chatIdFor = (a: string, b: string) => [a, b].sort().join("_");

// Deletes messages older than 24h from the database
export async function purgeExpiredChat(chatId: string) {
  try {
    const snap = await get(ref(database, `chats/${chatId}/messages`));
    const updates: Record<string, null> = {};
    snap.forEach((child) => {
      const seenAt = child.val()?.seenAt;
      if (typeof seenAt === "number" && seenAt < Date.now() - DAY_MS) {
        updates[child.key as string] = null;
      }
    });
    if (Object.keys(updates).length)
      await update(ref(database, `chats/${chatId}/messages`), updates);
  } catch {}
}

async function purgeExpiredChatOld(chatId: string) {
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

function SwipeToReply({
  children,
  onReply,
}: {
  children: React.ReactNode;
  onReply: () => void;
}) {
  const x = useRef(new Animated.Value(0)).current;
  const onReplyRef = useRef(onReply);
  onReplyRef.current = onReply;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) =>
        g.dx < -8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) x.setValue(Math.max(g.dx, -80));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50) onReplyRef.current();
        Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const opacity = x.interpolate({
    inputRange: [-60, -20, 0],
    outputRange: [1, 0.3, 0],
    extrapolate: "clamp",
  });

  return (
    <View>
      <Animated.View pointerEvents="none" style={[s.swipeIcon, { opacity }]}>
        <Reply size={18} color="#1a5c38" strokeWidth={2.4} />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: x }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
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
  const [kb, setKb] = useState(0);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [menuMsg, setMenuMsg] = useState<Msg | null>(null);
  const inputRef = useRef<TextInput>(null);
  const [mutual, setMutual] = useState(true);

  // Chat unlocks only once your own friend record is "accepted"
  useEffect(() => {
    const unsub = onValue(
      ref(database, `friends/${userId}/${friend.uid}`),
      (snap) => setMutual(snap.val()?.status === "accepted"),
    );
    return () => unsub();
  }, [friend.uid, userId]);

  // Android: the keyboard doesn't resize the window on many devices
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      setKb(e.endCoordinates?.height ?? 0);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Messages vanish while the chat is open once 24h after "seen" passes
  useEffect(() => {
    const t = setInterval(
      () =>
        setMessages((prev) =>
          prev.filter((m) => !m.seenAt || m.seenAt > Date.now() - DAY_MS),
        ),
      60000,
    );
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    purgeExpiredChat(chatId);
    const q = query(ref(database, `chats/${chatId}/messages`), limitToLast(100));
    const unsub = onValue(q, (snap) => {
      const data = snap.val() || {};
      setMessages(
        Object.entries(data)
          .map(([id, v]: any) => ({ id, ...v }))
                   .filter(
  (m: Msg) =>
    (!m.seenAt || m.seenAt > Date.now() - DAY_MS) && !m.deletedFor?.[userId],
)
          .sort((a: Msg, b: Msg) => a.ts - b.ts),
      );
    });
       setOpenChatUid(friend.uid);
    return () => {
      setOpenChatUid(null);
      unsub();
    };
  }, [chatId]);

  useEffect(() => {
    const unseen = messages.filter((m) => m.from !== userId && !m.seenAt);
    if (!unseen.length) return;
    const updates: Record<string, any> = {};
    unseen.forEach((m) => {
      updates[`${m.id}/seenAt`] = serverTimestamp();
    });
    update(ref(database, `chats/${chatId}/messages`), updates).catch(() => {});
  }, [messages]);



  function openMenu(m: Msg) {
    setMenuMsg(m);
  }

  function startReply(m: Msg) {
    setEditing(null);
    setReplyTo(m);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function startEdit(m: Msg) {
    setReplyTo(null);
    setEditing(m);
    setText(m.text);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function cancelCompose() {
    if (editing) setText("");
    setEditing(null);
    setReplyTo(null);
  }

  function menuOptions(m: Msg) {
    const mine = m.from === userId;
    return [
      { label: "Reply", run: () => startReply(m) },
      { label: "Copy", run: () => Clipboard.setStringAsync(m.text) },
      ...(mine ? [{ label: "Edit", run: () => startEdit(m) }] : []),
      {
        label: "Delete for me",
        run: () =>
          update(ref(database, `chats/${chatId}/messages/${m.id}/deletedFor`), {
            [userId]: true,
          }).catch(() => {}),
      },
      ...(mine
        ? [
            {
              label: "Delete for everyone",
              danger: true,
              run: () =>
                remove(ref(database, `chats/${chatId}/messages/${m.id}`)).catch(
                  () => {},
                ),
            },
          ]
        : []),
    ] as { label: string; danger?: boolean; run: () => void }[];
  }

  function send() {
    const t = text.trim();
    if (!t || !mutual) return;
    if (editing) {
      if (t !== editing.text)
        update(ref(database, `chats/${chatId}/messages/${editing.id}`), {
          text: t,
          edited: true,
        }).catch(() => {});
      setEditing(null);
      setText("");
      return;
    }
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
      ...(replyTo
        ? {
            replyTo: {
              id: replyTo.id,
              from: replyTo.from,
              text: replyTo.text.slice(0, 120),
            },
          }
        : {}),
    });
    setReplyTo(null);
    update(ref(database), {
      [`unread/${friend.uid}/${userId}`]: increment(1),
    }).catch(() => {});
  }

  return (
    <KeyboardAvoidingView
      style={[s.wrap, Platform.OS === "android" && { paddingBottom: kb }]}
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
          🕒 Messages disappear 24 hours after they're seen.
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
            <>
              <SwipeToReply onReply={() => startReply(item)}>
              <TouchableOpacity
                activeOpacity={0.85}
                onLongPress={() => openMenu(item)}
                style={[s.bubble, mine ? s.mine : s.theirs]}
              >
                {item.replyTo ? (
                  <View style={[s.quote, mine && s.quoteMine]}>
                    <Text
                      style={[s.quoteName, mine && { color: "#fff" }]}
                      numberOfLines={1}
                    >
                      {item.replyTo.from === userId
                        ? "You"
                        : friend.name.split(" ")[0]}
                    </Text>
                    <Text
                      style={[s.quoteText, mine && { color: "rgba(255,255,255,0.85)" }]}
                      numberOfLines={2}
                    >
                      {item.replyTo.text}
                    </Text>
                  </View>
                ) : null}
                <Text style={[s.msgText, mine && { color: "#fff" }]}>{item.text}</Text>
                <Text style={[s.time, mine && { color: "rgba(255,255,255,0.7)" }]}>
                  {item.edited ? "edited · " : ""}
                  {new Date(item.ts).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </TouchableOpacity>
              </SwipeToReply>
              {mine && item.seenAt ? <Text style={s.seenLabel}>Seen</Text> : null}
            </>
          );
        }}
      />

      {(replyTo || editing) && (
        <View style={s.composeBar}>
          {editing ? (
            <Pencil size={16} color="#1a5c38" strokeWidth={2.4} />
          ) : (
            <Reply size={16} color="#1a5c38" strokeWidth={2.4} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.quoteName}>
              {editing
                ? "Editing message"
                : `Replying to ${replyTo!.from === userId ? "yourself" : friend.name.split(" ")[0]}`}
            </Text>
            <Text style={s.quoteText} numberOfLines={1}>
              {(editing || replyTo)!.text}
            </Text>
          </View>
          <TouchableOpacity
            onPress={cancelCompose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={18} color="#888" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
      )}
      <View style={s.inputRow}>
        <TextInput
          ref={inputRef}
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder={mutual ? "Message…" : "Waiting for them to add you back"}
          editable={mutual}
          placeholderTextColor="#999"
          multiline
        />
        <TouchableOpacity style={s.sendBtn} onPress={send}>
          <Send size={18} color="#fff" strokeWidth={2.4} />
        </TouchableOpacity>
      </View>
      <Modal
        visible={!!menuMsg}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuMsg(null)}
      >
        <TouchableOpacity
          style={s.menuBackdrop}
          activeOpacity={1}
          onPress={() => setMenuMsg(null)}
        >
          {menuMsg && (
            <View style={s.menuCard}>
              <Text style={s.menuPreview} numberOfLines={2}>
                {menuMsg.text}
              </Text>
              {menuOptions(menuMsg).map((o) => (
                <TouchableOpacity
                  key={o.label}
                  style={s.menuRow}
                  onPress={() => {
                    setMenuMsg(null);
                    o.run();
                  }}
                >
                  <Text style={[s.menuText, o.danger && { color: "#e74c3c" }]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </TouchableOpacity>
      </Modal>
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
  time: { fontSize: 10, color: "#999", marginTop: 3, alignSelf: "flex-end" },
  swipeIcon: {
    position: "absolute",
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: "#1a5c38",
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
  },
  quoteMine: {
    borderLeftColor: "#fff",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  quoteName: { fontSize: 11, fontWeight: "700", color: "#1a5c38" },
  quoteText: { fontSize: 12, color: "#555", marginTop: 1 },
  composeBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f0f7f3",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#e0ede8",
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 32,
  },
  menuCard: { backgroundColor: "#fff", borderRadius: 16, overflow: "hidden" },
  menuPreview: {
    padding: 14,
    fontSize: 13,
    color: "#888",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  menuRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  menuText: { fontSize: 15, fontWeight: "600", color: "#222" },
  seenLabel: { alignSelf: "flex-end", fontSize: 10, color: "#999", marginTop: -2, marginBottom: 8, marginRight: 4 },
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