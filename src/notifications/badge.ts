import { apiV1 } from "../api/client";
import type { ConversationListResponse } from "../api/messages";
import type { NotificationsPayload } from "../api/types";
import { Notifications, notificationsAvailable } from "./notifications-safe";

/**
 * The app-icon badge, set from the SERVER's unread counts.
 *
 * Nothing set it before (7 Nov 2026): Android simply counted the notifications
 * sitting in the tray, so clearing the tray zeroed the badge while unread
 * activity and chats were still waiting in the app. Now the number is the
 * bell's unread count plus unread chat messages, re-read whenever the app
 * comes to the foreground, a push arrives, or something is marked read.
 *
 * Best effort by design: a launcher that ignores explicit counts keeps its own
 * behaviour, and a failed read leaves the badge as it was rather than zeroing
 * it. Expo Go has no native module, so this does nothing there.
 */
export async function syncAppBadge(): Promise<void> {
  if (!notificationsAvailable) return;
  try {
    const [bell, chats] = await Promise.all([
      apiV1<NotificationsPayload>("/api/v1/notifications?limit=1"),
      apiV1<ConversationListResponse>("/api/v1/messages/conversations"),
    ]);
    const unreadChats = chats.data.conversations.reduce((n, c) => n + (c.unreadCount ?? 0), 0);
    const total = Math.max(0, (bell.data.unreadCount ?? 0) + unreadChats);
    await Notifications.setBadgeCountAsync(total);
    // Nothing unread: clear Baylo's notifications from the tray too. Some
    // launchers (Samsung's among them) count tray items for the icon whatever
    // the app sets, so stale ones kept the number up after everything was read.
    if (total === 0) await Notifications.dismissAllNotificationsAsync();
  } catch {
    // Keep whatever the badge shows now.
  }
}

let pending: ReturnType<typeof setTimeout> | null = null;
/**
 * Re-sync soon, once: called whenever the chat or notification lists change
 * (a chat opened marks it read on the server, a notification is read). Several
 * changes in a row cost one sync, not one each.
 */
export function syncAppBadgeSoon(delayMs = 800): void {
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    void syncAppBadge();
  }, delayMs);
}

/**
 * Opening the app: clear Baylo's notifications from the tray (they're all
 * shown inside the app now), then set the icon to the real unread total.
 */
export async function onAppOpened(): Promise<void> {
  if (!notificationsAvailable) return;
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // Tray left as it was.
  }
  await syncAppBadge();
}
