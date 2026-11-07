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
  } catch {
    // Keep whatever the badge shows now.
  }
}
