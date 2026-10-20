import { useMutation, useQueryClient } from "@tanstack/react-query";

import { legacyFailure, request } from "./client";
import type { NotificationItem } from "./types";

/**
 * Where a tapped push notification opens, and marking it read.
 *
 * NO IN-APP LIST (20 Oct 2026). Notifications are the phone's own, outside the
 * app (src/notifications/push.ts); the bell and its screen were removed at the
 * team's request. The server still writes a row per notification -- that row
 * is what triggers the push -- and a tap marks just that row read.
 */

export const NOTIFICATIONS_KEY = ["notifications"] as const;

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
 *   trade          → /trade?id=<tradeId>&handoff=1 (the code panel; this was
 *                    /trade-code before Round 2), or /trades with no id
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
 *   meetup         → /trade?id=<tradeId> (the hub step, with Agree; this was
 *                    /trade-meetup before Round 2)
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
 *   listing_review → /listing-review?id=<itemId> a value review decided, a
 *                                               takedown, or an appeal outcome
 *                                               on your OWN listing. Its own
 *                                               token rather than "item": the
 *                                               screen that explains what
 *                                               happened is not the item page,
 *                                               and before it existed these rows
 *                                               were written as ("item", id),
 *                                               which nothing here could open.
 *
 * A pre-v1 TRADE_ACCEPTED row carries ('user', <userId>) rather than
 * ('trade', <tradeId>) — the backfill could only recover what the old `link`
 * encoded. It therefore lands on a profile here, which is what that row actually
 * points at. That is handled by reading the pair rather than the type, with no
 * special case needed.
 */
export function notificationTarget(n: NotificationItem): string | null {
  const id = n.entityId;

  if (!n.entityType) {
    if ((n.type === "NEW_MESSAGE" || n.type === "FOLLOW_REQUEST" || n.type === "FOLLOW_ACCEPTED") && n.actor) {
      return n.type === "NEW_MESSAGE"
        ? `/messages?partner=${encodeURIComponent(n.actor.id)}`
        : `/user?id=${encodeURIComponent(n.actor.id)}`;
    }
    if (n.type === "NEW_REVIEW") return "/(app)/profile";
    if (n.type === "TRADE_REQUEST") return "/trades";
  }

  switch (n.entityType) {
    case "conversation":
      return id ? `/messages?partner=${encodeURIComponent(id)}` : "/messages";
    case "trade":
      if (n.type === "TRADE_COMPLETED") {
        return id ? `/rate-trade?id=${encodeURIComponent(id)}` : "/trades-history";
      }
      // `handoff=1` opens the trade screen on its code panel, which is what
      // the old /trade-code landing did — issuing the codes included.
      return id ? `/trade?id=${encodeURIComponent(id)}&handoff=1` : "/(app)/trades";
    case "meetup":
      // The trade screen's hub step, where "Agree" lives since Round 2.
      return id ? `/trade?id=${encodeURIComponent(id)}` : "/(app)/trades";
    case "user":
      return id ? `/user?id=${encodeURIComponent(id)}` : null;
    /*
     * TWO NOTIFICATION TYPES SHARE THIS TOKEN, AND THEY WANT DIFFERENT SCREENS.
     *
     * A comment notification is about a conversation on a listing, so it opens
     * the listing WITH the comments sheet up -- that is what `&comments=1` is
     * for. A CATEGORY_MATCH is about the listing itself: somebody posted
     * something in a category the recipient said they wanted, and there is no
     * conversation to open. Sending them to a comments sheet on a stranger's
     * new listing would be the wrong screen every single time.
     *
     * Branching on `type` rather than minting a second entityType, because the
     * destination IS the same object -- the token says what to open, `type`
     * says what happened, and the schema's own note draws exactly that line.
     */
    case "item":
      if (!id) return null;
      return n.type === "CATEGORY_MATCH"
        ? `/item?id=${encodeURIComponent(id)}`
        : `/item?id=${encodeURIComponent(id)}&comments=1`;
    /*
     * A business-document decision. The id is the Organization's, and there is
     * no org screen in the app yet -- so this lands on the person's own profile
     * and settings, where the organisation they now own or were refused is
     * reachable. Better than null, which renders an untappable row.
     */
    case "organization":
      return "/settings";
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
    case "listing_review":
      return id ? `/listing-review?id=${encodeURIComponent(id)}` : null;
    // The "Welcome back" notice. The id is the Suspension's; the screen shows
    // the full record -- reason, dates, how it ended -- behind the sentence.
    case "suspension":
      return id ? `/suspension?id=${encodeURIComponent(id)}` : null;
    default:
      return null;
  }
}

/**
 * PATCH /api/notifications/[id] — one row.
 *
 * Called when a push is tapped (src/notifications/push.ts): exactly that one
 * row has been seen.
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
