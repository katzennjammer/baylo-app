/**
 * Give / get, from the viewer's side: THE one place that decides it.
 *
 * Every deal has a sender (who proposed it) and a receiver. The sender put up
 * the OFFERED side (`offeredItem` / `offeredItems` / `offeredLeaves`); the
 * receiver owns the REQUESTED side (`requestedItem`, which an offer calls
 * `post`). So:
 *
 *   viewer is the sender     give = offered,    get = requested
 *   viewer is the receiver   give = requested,  get = offered
 *
 * That holds for every row on the wire, schema v2's merged Offer + TradeRequest
 * rows included: the merge paired them only where sender, receiver and listing
 * all agreed, and `direction` is computed once, from `senderId`, by the API.
 *
 * Generic over the side so callers keep their own shape: a `CardSide`, an item
 * row, a label. What each side LOOKS like is theirs; which side is whose is
 * decided here and nowhere else.
 */
export interface DealSides<T> {
  /** What the sender put up. */
  offered: T;
  /** What the sender asked for: the receiver's listing. */
  requested: T;
}

export function giveGet<T>(viewerIsSender: boolean, sides: DealSides<T>): { give: T; get: T } {
  return viewerIsSender
    ? { give: sides.offered, get: sides.requested }
    : { give: sides.requested, get: sides.offered };
}

/** The wire's `direction`, as the one question `giveGet()` asks. */
export const viewerIsSender = (direction: "sent" | "received"): boolean => direction === "sent";
