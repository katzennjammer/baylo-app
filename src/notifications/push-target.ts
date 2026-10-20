import { notificationTarget } from "../api/notifications";
import type { NotificationItem } from "../api/types";

/**
 * Where a tapped push opens: the screen notificationTarget() names for it.
 * The server puts the notification's own routing fields in the push's data
 * (baylo-api @/lib/push), so this rebuilds just enough of a row for
 * notificationTarget() and asks it. Anything it cannot place opens Home: the
 * in-app notification list was removed on 20 Oct 2026, pushes are the only list.
 */
export interface PushData {
  notificationId?: unknown;
  type?: unknown;
  entityType?: unknown;
  entityId?: unknown;
  actorId?: unknown;
}

const HOME = "/(app)/home";

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

export function pushTarget(data: PushData | null | undefined): string {
  const type = str(data?.type);
  if (!type) return HOME;
  const actorId = str(data?.actorId);
  const row = {
    type,
    entityType: str(data?.entityType),
    entityId: str(data?.entityId),
    actor: actorId ? { id: actorId } : null,
  } as unknown as NotificationItem;
  return notificationTarget(row) ?? HOME;
}

export function pushNotificationId(data: PushData | null | undefined): string | null {
  return str(data?.notificationId);
}
