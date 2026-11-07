import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { useGlobalSearchParams, usePathname, useRootNavigationState, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import { apiV1 } from "../api/client";
import { NOTIFICATIONS_KEY, useMarkNotificationRead } from "../api/notifications";
import { TRADES_ACTIVE_KEY, meetupKey } from "../api/trades";
import { syncAppBadge } from "./badge";
import { getActiveConversationPartnerId } from "./active-conversation";
import { Notifications, notificationsAvailable } from "./notifications-safe";
import { pushMessageId, pushMessagePartnerId, pushNotificationId, pushTarget, shouldSuppressMessageNotification } from "./push-target";

/**
 * Phone notifications for everything the bell shows (20 Oct 2026).
 *
 * The server pushes whenever it writes a notification row (baylo-api
 * @/lib/push); this side only has to say which phone is listening and open
 * the right screen on a tap.
 *
 * - Registered once there is a session: channel, permission, Expo token,
 *   POST /api/v1/push-token. One phone per account -- the server keeps the
 *   last one to register.
 * - Cleared by signOut() (session.tsx) BEFORE the session is dropped, since
 *   the DELETE needs it.
 * - A tap opens notificationTarget()'s screen, the same as the bell's row,
 *   and marks that row read. useLastNotificationResponse covers both a tap
 *   while running and the tap that cold-started the app.
 *
 * Best effort everywhere: no permission, an emulator, Expo Go or a failed
 * request just means no pushes. Nothing here can block sign-in or sign-out.
 */

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    let suppressed = true;
    try {
      const data = notification.request.content.data;
      if (pushTarget(data)) {
        suppressed = shouldSuppressMessageNotification(
          data,
          getActiveConversationPartnerId(),
          AppState.currentState === "active",
        );
      }
    } catch (error) {
      console.warn("[push] Ignoring malformed foreground notification", error);
    }
    return {
      shouldShowBanner: !suppressed,
      shouldShowList: !suppressed,
      shouldPlaySound: !suppressed,
      shouldSetBadge: false,
    };
  },
});

/**
 * The Android channel every push lands in; the server names it in each
 * message's channelId (baylo-api @/lib/push), so the two must match.
 *
 * MAX + sound + vibration is what makes Android drop a heads-up banner over
 * whatever app is open. A channel's importance, sound and vibration are fixed
 * by Android the first time it is created on a phone -- calling
 * setNotificationChannelAsync again only updates its name -- so raising them
 * meant a NEW id. "default" (HIGH, no vibration; 20 Oct 2026) is deleted
 * below so Settings shows one channel; a push still naming it lands in Expo's
 * fallback channel, never nowhere.
 */
const CHANNEL = "alerts";
const OLD_CHANNELS = ["default"];
const handledResponseIds = new Set<string>();

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/** Null when this build cannot receive pushes at all, or the user said no. */
async function currentToken(askPermission: boolean): Promise<string | null> {
  // Expo Go cannot receive remote pushes on Android, and emulators have no token.
  if (!notificationsAvailable || !Device.isDevice || Constants.executionEnvironment === "storeClient") return null;
  const id = projectId();
  if (!id) return null;

  // The channel must exist BEFORE asking on Android 13+, or no prompt appears.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Messages and updates",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      enableVibrate: true,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#3DBE5A",
    });
    for (const old of OLD_CHANNELS) await Notifications.deleteNotificationChannelAsync(old);
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted" && askPermission) {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== "granted") return null;

  return (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
}

async function sendToken(method: "POST" | "DELETE", token: string): Promise<void> {
  await apiV1("/api/v1/push-token", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

/** Sign-out: stop this phone, if it is still the one on file. Gives up after 3 s. */
export async function unregisterPush(): Promise<void> {
  const work = (async () => {
    const token = await currentToken(false);
    if (token) await sendToken("DELETE", token);
  })();
  await Promise.race([work.catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
}

/** Mounted in the signed-in layout. `userId` undefined = signed out, do nothing. */
export function usePushNotifications(userId: string | undefined) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ partner?: string; messageId?: string }>();
  const navigationState = useRootNavigationState();
  const qc = useQueryClient();
  const markRead = useMarkNotificationRead();
  const [pendingMessage, setPendingMessage] = useState<{ partnerId: string; messageId: string | null } | null>(null);
  const replacingWithMessages = useRef(false);
  const last = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      try {
        const token = await currentToken(true);
        if (token) await sendToken("POST", token);
      } catch {
        // No pushes this session; the bell still works.
      }
    })();
  }, [userId]);

  // A push that arrives while the app is open: refresh what counts unread.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      try {
        const target = pushTarget(notification.request.content.data);
        if (!target) return;
        void Promise.all([
          qc.invalidateQueries({ queryKey: ["home"] }),
          qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
          // A trade or meetup push means the trade lists moved too.
          qc.invalidateQueries({ queryKey: TRADES_ACTIVE_KEY }),
          syncAppBadge(),
        ]).catch((error: unknown) => {
          console.warn("[push] Could not refresh notification counts", error);
        });
      } catch (error) {
        console.warn("[push] Ignoring malformed received notification", error);
      }
    });
    return () => sub.remove();
  }, [qc]);

  useEffect(() => {
    try {
      if (!userId || !last || !navigationState.key) return;
      const data = last.notification.request.content.data;
      const target = pushTarget(data);
      if (!target) return;

      const key = last.notification.request.identifier;
      if (handledResponseIds.has(key)) return;
      handledResponseIds.add(key);
      if (handledResponseIds.size > 100) {
        const oldest = handledResponseIds.values().next().value;
        if (oldest) handledResponseIds.delete(oldest);
      }

      const id = pushNotificationId(data);
      if (id) markRead.mutate(id, { onSettled: () => void syncAppBadge() });
      // The screen the tap opens reads the trade lists and the meetup plan.
      // Their caches can predate the event the push is about (the app was in
      // the background, the socket missed it), which is how "That trade is not
      // open any more" and a second "Choose a hub" appeared for live, agreed
      // trades. Refetch them before routing.
      const entityType = typeof data?.entityType === "string" ? data.entityType : null;
      const entityId = typeof data?.entityId === "string" ? data.entityId : null;
      if (entityType === "trade" || entityType === "meetup") {
        void qc.invalidateQueries({ queryKey: TRADES_ACTIVE_KEY });
        if (entityId) void qc.invalidateQueries({ queryKey: meetupKey(entityId) });
      }
      const partnerId = pushMessagePartnerId(data);
      if (partnerId) {
        const messageId = pushMessageId(data);
        if (pathname === "/messages/thread" && params.partner === partnerId) {
          if (messageId) router.setParams({ messageId });
          return;
        }
        replacingWithMessages.current = false;
        setPendingMessage({ partnerId, messageId });
        return;
      }
      router.push(target as never);
    } catch (error) {
      console.warn("[push] Ignoring malformed notification response", error);
    }
  }, [last, userId, navigationState.key, pathname, params.partner, router, markRead, qc]);

  // The app-icon badge follows the server's unread counts: on sign-in and
  // every time the app comes back to the foreground. See ./badge.
  useEffect(() => {
    if (!userId) return;
    void syncAppBadge();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncAppBadge();
    });
    return () => sub.remove();
  }, [userId]);

  useEffect(() => {
    try {
      if (!pendingMessage || !userId || !navigationState.key) return;
      if (pathname === "/messages/thread" && params.partner === pendingMessage.partnerId) {
        setPendingMessage(null);
        replacingWithMessages.current = false;
        return;
      }
      if (pathname === "/messages") {
        router.push({
          pathname: "/messages/thread",
          params: {
            partner: pendingMessage.partnerId,
            ...(pendingMessage.messageId ? { messageId: pendingMessage.messageId } : {}),
          },
        });
        setPendingMessage(null);
        replacingWithMessages.current = false;
        return;
      }
      if (!replacingWithMessages.current) {
        replacingWithMessages.current = true;
        router.replace("/messages");
      }
    } catch (error) {
      console.warn("[push] Could not route tapped message notification", error);
    }
  }, [navigationState.key, params.partner, pathname, pendingMessage, router, userId]);
}
