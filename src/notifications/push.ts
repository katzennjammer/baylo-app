import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useGlobalSearchParams, usePathname, useRootNavigationState, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import { apiV1 } from "../api/client";
import { NOTIFICATIONS_KEY, useMarkNotificationRead } from "../api/notifications";
import { getActiveConversationPartnerId } from "./active-conversation";
import { pushMessagePartnerId, pushNotificationId, pushTarget, shouldSuppressMessageNotification } from "./push-target";

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
    const suppressed = shouldSuppressMessageNotification(
      notification.request.content.data,
      getActiveConversationPartnerId(),
      AppState.currentState === "active",
    );
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
  if (!Device.isDevice || Constants.executionEnvironment === "storeClient") return null;
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
  const params = useGlobalSearchParams<{ partner?: string }>();
  const navigationState = useRootNavigationState();
  const qc = useQueryClient();
  const markRead = useMarkNotificationRead();
  const [pendingMessagePartner, setPendingMessagePartner] = useState<string | null>(null);
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
    const sub = Notifications.addNotificationReceivedListener(() => {
      void qc.invalidateQueries({ queryKey: ["home"] });
      void qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    });
    return () => sub.remove();
  }, [qc]);

  useEffect(() => {
    if (!userId || !last || !navigationState.key) return;
    const key = last.notification.request.identifier;
    if (handledResponseIds.has(key)) return;
    handledResponseIds.add(key);
    if (handledResponseIds.size > 100) {
      const oldest = handledResponseIds.values().next().value;
      if (oldest) handledResponseIds.delete(oldest);
    }

    const data = last.notification.request.content.data;
    const id = pushNotificationId(data);
    if (id) markRead.mutate(id);
    const partnerId = pushMessagePartnerId(data);
    if (partnerId) {
      if (pathname === "/messages/thread" && params.partner === partnerId) return;
      replacingWithMessages.current = false;
      setPendingMessagePartner(partnerId);
      return;
    }
    router.push(pushTarget(data) as never);
  }, [last, userId, navigationState.key, pathname, params.partner, router, markRead]);

  useEffect(() => {
    if (!pendingMessagePartner || !userId || !navigationState.key) return;
    if (pathname === "/messages/thread" && params.partner === pendingMessagePartner) {
      setPendingMessagePartner(null);
      replacingWithMessages.current = false;
      return;
    }
    if (pathname === "/messages") {
      router.push({
        pathname: "/messages/thread",
        params: { partner: pendingMessagePartner },
      });
      setPendingMessagePartner(null);
      replacingWithMessages.current = false;
      return;
    }
    if (!replacingWithMessages.current) {
      replacingWithMessages.current = true;
      router.replace("/messages");
    }
  }, [navigationState.key, params.partner, pathname, pendingMessagePartner, router, userId]);
}
