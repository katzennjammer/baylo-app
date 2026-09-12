import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiV1, legacyFailure, request } from "./client";
import type { NotificationItem, NotificationsPayload } from "./types";

/**
 * The bell's list, and where each row goes when it is tapped.
 *
 * ══ WHY THIS FILE ARRIVED LATE ═════════════════════════════════════════════
 *
 * Notification rows have been written since long before this client existed and
 * the header bell has been rendering an accurate unread count the whole time —
 * it just had `onPress={() => {}}` behind it. A badge that reports an obligation
 * and then refuses to say what it is, is worse than no badge: it trains people
 * to ignore the one signal the app has.
 */

export const NOTIFICATIONS_KEY = ["notifications"] as const;

/** Matches the trades lists: a minute-old copy is fine while a fresh one loads. */
const NOTIFICATIONS_STALE_MS = 30_000;

/** GET /api/v1/notifications — newest first, one page of 50. */
export function useNotifications() {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () => apiV1<NotificationsPayload>("/api/v1/notifications?limit=50"),
    select: (r) => r.data,
    staleTime: NOTIFICATIONS_STALE_MS,
  });
}

/**
 * Where a notification opens.
 *
 * ══ ROUTED FROM `entityType`/`entityId`, NEVER FROM `type` ═════════════════
 *
 * The schema is explicit that the two are different questions, and this is the
 * function that keeps them apart. It returns an expo-router path or NULL — and
 * null is a real answer, not a failure. A row this client cannot open renders
 * without a chevron and does not pretend to be tappable.
 *
 * ══ WHAT EACH TARGET RESOLVES TO, AND THE TWO COMPROMISES ══════════════════
 *
 *   conversation   → /messages?partner=<userId>
 *
 *     COMPROMISE 1. `app/(app)/messages.tsx` is still a Placeholder — there is
 *     no thread screen to land on. The partner id is passed anyway so the deep
 *     link is already correct on the day Messages is built, and the screen
 *     ignores a param it does not read. The alternative — routing a message
 *     notification at the sender's PROFILE — is the exact conflation the schema
 *     note warns against: a message opens a thread WITH someone, not a page
 *     ABOUT them.
 *
 *   trade          → /trade-code?id=<tradeId>, or /trades with no id
 *
 *     THE ID IS NO LONGER DROPPED. What stood here said `/trade-code` "is valid
 *     only for a CONFIRMING trade", and that was not true of the screen even
 *     when it was written: `trade-code.tsx` starts the confirmation on
 *     `ACCEPTED || CONFIRMING`, and so does POST …/confirm/start. The claim was
 *     the same wrong belief that left `MeetingRow` in `trades-waiting.tsx`
 *     without a tap — and between them they made the confirmation screen
 *     unreachable, since arriving at it is the only thing that issues the codes.
 *
 *     So a trade notification now lands on the trade it is about. The screen's
 *     own not-open branch still covers the states that really are finished — a
 *     completed or cancelled trade says so there, which is the honest answer to
 *     tapping a notification about it. An id-less row still falls back to the
 *     list, which is what a pre-v1 row without an entityId can support.
 *
 *   meetup         → /trade-meetup?id=<tradeId>
 *
 *     ITS OWN TOKEN, NOT "trade", and the distinction is the reason it exists.
 *     A meetup notification is "can you do Saturday?" — routing it to the code
 *     screen would put a pair of 15-minute codes on screen days before the
 *     meeting, and arriving there is what ISSUES them. The entityId is the same
 *     tradeId either way; what differs is which question the tap is answering.
 *
 *   user           → /user?id=<userId>          the pre-v1 vocabulary, and the
 *                                               one target it always got right.
 *   follow_request → /user?id=<actorId>         entityId is null by design; the
 *                                               person is the actor.
 *   review         → /profile                   entityId is a REVIEW id, which
 *                                               no screen takes. A review about
 *                                               you lives on your own profile,
 *                                               so that is where this lands.
 *   report         → null                       moderation is web-admin only.
 *
 * A pre-v1 TRADE_ACCEPTED row carries ('user', <userId>) rather than
 * ('trade', <tradeId>) — the backfill could only recover what the old `link`
 * encoded. It therefore lands on a profile here, which is what that row actually
 * points at. That is handled by reading the pair rather than the type, with no
 * special case needed.
 */
export function notificationTarget(n: NotificationItem): string | null {
  const id = n.entityId;

  switch (n.entityType) {
    case "conversation":
      return id ? `/messages?partner=${encodeURIComponent(id)}` : "/messages";
    case "trade":
      return id ? `/trade-code?id=${encodeURIComponent(id)}` : "/(app)/trades";
    case "meetup":
      return id ? `/trade-meetup?id=${encodeURIComponent(id)}` : "/(app)/trades";
    case "user":
      return id ? `/user?id=${encodeURIComponent(id)}` : null;
    case "follow_request":
      return n.actor ? `/user?id=${encodeURIComponent(n.actor.id)}` : null;
    case "review":
      return "/(app)/profile";
    /*
     * NOT IN THE SCHEMA'S DOCUMENTED LIST, and in the data anyway — three rows,
     * written by the ID review flow after that note was last edited. Found by
     * reading `SELECT entityType, COUNT(*) FROM Notification GROUP BY 1` rather
     * than by trusting the comment, which is the only way this kind of drift
     * ever turns up.
     *
     * The id is the IdVerification row's, which no screen takes; `verify-id`
     * shows the submission's current state, which is what an approval or a
     * rejection is about.
     */
    case "id_verification":
      return "/verify-id";
    default:
      return null;
  }
}

/**
 * PATCH /api/notifications — everything unread, at once.
 *
 * ══ ON OPEN, NOT ON TAP ════════════════════════════════════════════════════
 *
 * The bell's badge counts unread rows, so "I opened the list" is the same
 * statement as "I have seen these". Clearing per-row instead would leave the
 * badge showing a number for rows the person has already scrolled past and
 * decided about, which is the failure mode that makes people stop trusting a
 * count.
 *
 * The honest cost, named rather than hidden: a row scrolled past without being
 * read is marked read all the same. That is the accepted trade in exchange for a
 * badge whose number means something, and it is why the rows keep their unread
 * DOT for the life of the screen — see the note in `app/notifications.tsx`.
 *
 * A LEGACY ROUTE, like the offer decision: it predates /api/v1, answers a bare
 * `{ ok: true }`, and already goes through `resolveSession()` so a Bearer token
 * authenticates it. There is nothing to gain from a v1 twin of a route that
 * takes no arguments.
 */
export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await request("/api/notifications", { method: "PATCH" });
      if (!res.ok) return legacyFailure(res, "We could not mark those as read.");
      return (await res.json()) as unknown;
    },
    /*
     * `home` as well as the list. The bell's count comes from /api/v1/home's
     * `unread.notifications`, so a list that cleared itself without invalidating
     * home would leave a 24 sitting on an icon whose screen is demonstrably
     * empty — the same disagreement between a badge and its contents that this
     * whole screen exists to end.
     */
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      void qc.invalidateQueries({ queryKey: ["home"] });
    },
  });
}

/**
 * PATCH /api/notifications/[id] — one row.
 *
 * Not used by the list, which clears everything on open. It exists for the
 * arrival this client cannot make yet: a push notification opened straight into
 * its target, where exactly one row has been seen and marking the other
 * twenty-three read would be a lie. Kept small and unused rather than written
 * later under time pressure.
 */
export function useMarkNotificationRead() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await request(`/api/notifications/${encodeURIComponent(id)}`, {
        method: "PATCH",
      });
      if (!res.ok) return legacyFailure(res, "We could not mark that as read.");
      return (await res.json()) as unknown;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      void qc.invalidateQueries({ queryKey: ["home"] });
    },
  });
}
