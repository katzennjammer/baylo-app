import { notificationTarget } from "../api/notifications";
import type { NotificationItem } from "../api/types";

/**
 * Where a tapped push opens: the same screen a tap on the bell's row opens.
 * The server puts the notification's own routing fields in the push's data
 * (baylo-api @/lib/push), so this rebuilds just enough of a row for
 * notificationTarget() and asks it. Anything it cannot place opens the list.
 */
export interface PushData {
  notificationId?: unknown;
  type?: unknown;
  entityType?: unknown;
  entityId?: unknown;
  actorId?: unknown;
  partnerId?: unknown;
  messageId?: unknown;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

export function pushMessagePartnerId(data: PushData | null | undefined): string | null {
  const type = str(data?.type)?.trim();
  const entityType = str(data?.entityType)?.trim();
  if (type !== "NEW_MESSAGE" && entityType !== "conversation") return null;
  // A comment on a listing is also typed NEW_MESSAGE, but it points at the
  // ITEM. Read as a chat it opened a thread with the listing's id as the
  // "person": an empty conversation called "Conversation". Only a row about
  // a conversation (or about nothing, the plain chat message) is a chat.
  if (entityType && entityType !== "conversation") return null;
  return str(data?.partnerId) ?? str(data?.entityId) ?? (type === "NEW_MESSAGE" ? str(data?.actorId) : null);
}

export function pushMessageId(data: PushData | null | undefined): string | null {
  return str(data?.messageId);
}

export function shouldSuppressMessageNotification(
  data: PushData | null | undefined,
  activePartnerId: string | null,
  appIsActive: boolean,
): boolean {
  if (!appIsActive || !activePartnerId || str(data?.type) !== "NEW_MESSAGE") return false;
  return pushMessagePartnerId(data) === activePartnerId;
}

export function pushTarget(data: PushData | null | undefined): string | null {
  const type = str(data?.type)?.trim();
  if (!type) return null;

  const partnerId = pushMessagePartnerId(data);
  if (partnerId) {
    const messageId = pushMessageId(data);
    return `/messages/thread?partner=${encodeURIComponent(partnerId)}` +
      (messageId ? `&messageId=${encodeURIComponent(messageId)}` : "");
  }

  const actorId = str(data?.actorId);
  const row = {
    type,
    entityType: str(data?.entityType),
    entityId: str(data?.entityId),
    actor: actorId ? { id: actorId } : null,
  } as unknown as NotificationItem;
  return notificationTarget(row);
}

export function pushNotificationId(data: PushData | null | undefined): string | null {
  return str(data?.notificationId);
}
