import Constants from "expo-constants";
import { get, ref, set } from "firebase/database";
import { Platform } from "react-native";
import { database } from "./firebase";

// Remote push doesn't work in Expo Go, so everything below is skipped there
const isExpoGo = Constants.appOwnership === "expo";

let openChatUid: string | null = null;
export function setOpenChatUid(uid: string | null) {
  openChatUid = uid;
}

async function registerForPush(uid: string) {
  try {
    const Notifications = require("expo-notifications");
    const Device = require("expo-device");
    if (!Device.isDevice) return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("messages", {
        name: "Messages",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted")
      status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await set(ref(database, `users/${uid}/pushToken`), token);
  } catch (e) {
    if (__DEV__) console.log("[push] register failed", e);
  }
}

export function initPush(
  uid: string,
  onOpenChat: (fromUid: string, fromName: string) => void,
) {
  if (isExpoGo) return () => {};
  let sub: any;
  try {
    const Notifications = require("expo-notifications");

    // Don't pop a banner if you're already inside that chat
    Notifications.setNotificationHandler({
      handleNotification: async (n: any) => {
        const show = n?.request?.content?.data?.fromUid !== openChatUid;
        return {
          shouldShowAlert: show,
          shouldShowBanner: show,
          shouldShowList: show,
          shouldPlaySound: show,
          shouldSetBadge: false,
        };
      },
    });

    const open = (resp: any) => {
      const d = resp?.notification?.request?.content?.data;
      if (d?.fromUid) onOpenChat(d.fromUid, d.fromName || "Chat");
    };
    sub = Notifications.addNotificationResponseReceivedListener(open);
    Notifications.getLastNotificationResponseAsync?.().then((r: any) => r && open(r));
  } catch {}
  registerForPush(uid);
  return () => sub?.remove?.();
}

export async function sendPush(
  toUid: string,
  title: string,
  body: string,
  data: Record<string, any> = {},
) {
  try {
    const token = (await get(ref(database, `users/${toUid}/pushToken`))).val();
    if (!token) return;
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        to: token,
        title,
        body,
        sound: "default",
        channelId: "messages",
        data,
      }),
    });
  } catch {}
}