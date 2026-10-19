import type { TradesPayload } from "../api/types";

/**
 * What "Remove listing" may do with this listing, and what to say first.
 *
 * DELETE /api/items/[id] is a soft delete (status REMOVED) and checks
 * neither offers nor trades, so the app does:
 *
 *   BLOCKED  the listing is in a trade -- its status is IN_TRADE, or a trade on
 *            the Active tab names it. Pulling it would leave the other person
 *            walking to a hub for something that is no longer listed.
 *   CONFIRM  otherwise, always. When pending offers name it (as the listing
 *            offered on, or as the item offered), the dialog says how many:
 *            accepting an offer requires both items to be AVAILABLE, so those
 *            offers can no longer be accepted.
 *
 * `active` is the owner's own /api/v1/trades?tab=active page. Undefined while it
 * loads or if it failed; the status still catches an accepted trade, and the
 * dialog falls back to a sentence that is true either way.
 */

export type RemovalCheck = { kind: "blocked" | "confirm"; title: string; body: string };

const LEAVES = "It leaves the feed and the marketplace straight away.";

export function listingRemovalCheck(
  item: { id: string; status: string },
  active: Pick<TradesPayload, "trades" | "offers"> | undefined,
): RemovalCheck {
  const inTrade =
    item.status === "IN_TRADE" ||
    !!active?.trades.some((t) => t.requestedItem.id === item.id || t.offeredItem?.id === item.id);
  if (inTrade) {
    return {
      kind: "blocked",
      title: "This listing is in a trade",
      body: "Finish or cancel the trade first, from the Trades tab. Then you can remove the listing.",
    };
  }

  if (!active) {
    return {
      kind: "confirm",
      title: "Remove this listing?",
      body: `${LEAVES} If someone has offered on it, that offer can no longer be accepted.`,
    };
  }

  const pending = active.offers.filter(
    (o) => o.post.id === item.id || o.offeredItems.some((i) => i.id === item.id),
  ).length;
  return {
    kind: "confirm",
    title: "Remove this listing?",
    body:
      pending === 0
        ? LEAVES
        : `${pending === 1 ? "There is 1 pending offer" : `There are ${pending} pending offers`} on it. ` +
          `Removed, ${pending === 1 ? "that offer" : "those offers"} can no longer be accepted. ${LEAVES}`,
  };
}
