import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiV1, legacyFailure, request } from "./client";
import { useItem } from "./item";
import { useProfileMe } from "./profile";
import { isOutOfReach, reachBracket } from "../lib/gap";
import { bracketOf, type Bracket } from "../lib/brackets";
import { offerTerms, TRADING_POLICY_VERSION, type OfferTerms } from "../lib/trade-rules";
import type {
  Item,
  ItemDetailPayload,
  LiveOffer,
  SafeZoneHub,
  TradesPayload,
  ViewerIdVerification,
  ViewerReputation,
} from "./types";

/**
 * Everything the offer flow reads and the one thing it writes.
 *
 * ══ THREE REQUESTS, AND WHY EACH ONE IS NEEDED ══════════════════════════════
 *
 *   /api/v1/items/[id]   the listing, the hubs, whether an offer already
 *                        exists, and WHICH of the viewer's items may be offered.
 *   /api/v1/profile/me   what those items are WORTH (and so which bracket each
 *                        is in), plus the tier and its item cap.
 *   /api/v1/trades       the balance, and, when one exists, the contents of the
 *                        offer already standing on this listing.
 *
 * ══ WHAT AN OFFER IS NOW ════════════════════════════════════════════════════
 *
 * One item for one item. No Leaves ride on it. The two items' BRACKETS decide
 * everything else: same bracket is a straight swap, one apart is a bridge with
 * a flat fee the lower side pays, two or more apart is refused. `offerTerms()`
 * in `src/lib/trade-rules.ts` is the whole of that arithmetic and is mirrored
 * from the server, which re-derives it on propose AND on accept.
 *
 * ══ WHAT THE SERVER STILL DECIDES ═══════════════════════════════════════════
 *
 * Everything. This module's job is to let a person find out BEFORE they send:
 *
 *   403  OFFER_BRACKET_TOO_LOW / TOO_HIGH      two or more apart
 *   403  TIER_ITEM_VALUE_CAP                    the listing is above their tier
 *   403  PREMIUM_REQUIRED                       bracket 7+ without a subscription
 *   400  CONSENT_REQUIRED                       a proposer-pays bridge with no tick
 *   409  POLICY_VERSION_STALE                   this client's policy string is old
 *   400  INSUFFICIENT_LEAVES                    the proposer cannot cover the fee
 *   409  OFFER_ALREADY_PENDING                  one live offer per listing
 *
 * The first three are drawn in advance by `useOfferContext`. All of them arrive
 * as an ApiError whose `message` is the server's own sentence, and the
 * send-failed panel shows it rather than a generic line — the server's version
 * carries the numbers.
 *
 * The one channel still missing is a MEETUP POINT: POST /api/offers takes no
 * hub. `composeOffer()` carries the chosen Safe Zone as one plain sentence in
 * the message, which is free text the recipient reads — not an encoded payload,
 * and nothing parses it on the far side.
 */

/* ────────────────────────── reading the context ─────────────────────── */

/** One of the viewer's own items, as the picker and the bracket test need it. */
export interface OfferableItem {
  id: string;
  title: string;
  image: string | null;
  /**
   * NULL means "this item's value did not come back", not "worth nothing".
   * It happens for a shelf longer than one page, and for listings that predate
   * the valuation model. The picker renders the difference; an unvalued item
   * has no bracket and cannot be offered from here.
   */
  valueLeaves: number | null;
  /** `bracketOf(valueLeaves)`, or null when the value is null. */
  bracket: Bracket | null;
}

export interface OfferContext {
  item: ItemDetailPayload["item"];
  viewer: ItemDetailPayload["viewer"];
  hubs: SafeZoneHub[];
  /** The viewer's AVAILABLE listings, values and brackets joined in. Newest first. */
  myItems: OfferableItem[];
  /** The listing's bracket, or null for an unvalued listing. */
  targetBracket: Bracket | null;
  /** The raw Leaf balance. What a proposer-pays fee is checked against. */
  balance: number;
  /** The PENDING offer already standing on this listing, contents and all. */
  existingOffer: LiveOffer | null;
  reputation: ViewerReputation;
  idVerification: ViewerIdVerification;
  /** §7.1 — highest AVAILABLE item value, and the reach BRACKET it produces. */
  highestItemValue: number;
  reach: Bracket;
  /**
   * `viewer.offerLock === "premium"`: the listing sits in PREMIUM_MIN_BRACKET
   * or above and this viewer has no live subscription. The server's own
   * verdict, mirrored by `enforcePremiumForListing()` on POST /api/offers.
   */
  premiumLocked: boolean;
  /**
   * The tier's item cap, as a BRACKET, applied to the listing. Null when the
   * tier is unlimited. The server enforces it on POST /api/offers; this is
   * what lets the composer refuse in a sentence rather than a 403.
   */
  maxItemBracket: Bracket | null;
  /** True when this listing is above the viewer's tier cap and the offer would 403. */
  tierItemCapExceeded: boolean;
}

/**
 * The whole offer screen's data.
 *
 * Three `useQuery`s rather than one composite call, because two of them are
 * already cached elsewhere: the item detail screen fetched `useItem(id)` on the
 * way in, and the marketplace grid needs `useProfileMe()` for its own reach
 * threshold. Reaching this screen therefore usually costs one request, not
 * three — TanStack dedupes each by key.
 */
export function useOfferContext(itemId: string | undefined) {
  const itemQuery = useItem(itemId);
  const meQuery = useProfileMe();
  const liveQuery = useLiveOffers();

  const detail = itemQuery.data;
  const me = meQuery.data;
  const live = liveQuery.data;

  let context: OfferContext | null = null;

  if (detail && me) {
    // The join. `tradeableItems` is authoritative about WHICH items may be
    // offered — it is the set the server built with the same filters it will
    // apply — and `me.items` is consulted only for the value. An id in the
    // first and not the second is kept with a null value rather than dropped:
    // dropping it would silently shorten the picker, which reads as "that item
    // is gone" rather than as "its value did not load".
    const valueById = new Map(me.items.map((row) => [row.id, row.valueLeaves]));
    const myItems: OfferableItem[] = detail.viewer.tradeableItems.map((row) => {
      const valueLeaves = valueById.get(row.id) ?? null;
      return {
        id: row.id,
        title: row.title,
        image: row.image,
        valueLeaves,
        bracket: valueLeaves === null ? null : bracketOf(valueLeaves),
      };
    });

    // §7.1's "highest available item". AVAILABLE is the status the server
    // filters `tradeableItems` on, so the reach is computed over the same set
    // the offer screen can actually draw on.
    const highestItemValue = myItems.reduce((max, row) => Math.max(max, row.valueLeaves ?? 0), 0);

    const targetBracket = detail.item.valueLeaves === null ? null : bracketOf(detail.item.valueLeaves);
    // `maxItemBracket` is what the server sends since 17 Sep 2026. An older
    // server sent `maxItemValueLeaves`; a client this new never talks to one,
    // but the fallback is one line and it keeps the field optional-safe.
    const limits = me.reputation.limits as { maxItemBracket?: number | null; maxItemValueLeaves?: number | null };
    const cap: Bracket | null =
      limits.maxItemBracket !== undefined
        ? limits.maxItemBracket
        : limits.maxItemValueLeaves == null
          ? null
          : bracketOf(limits.maxItemValueLeaves);

    context = {
      item: detail.item,
      viewer: detail.viewer,
      hubs: detail.item.safeZones ?? [],
      myItems,
      targetBracket,
      // From /items/[id] rather than /profile/me: same column, but the detail
      // route is the one this screen is about and its copy is the fresher of
      // the two on any screen reached by tapping a listing.
      balance: detail.viewer.leaves,
      // Matched on the LISTING rather than on `viewer.existingOfferId`, so the
      // two cannot disagree about which offer is meant, and `direction` so a
      // received offer on somebody else's listing can never be mistaken for
      // one this viewer sent.
      existingOffer:
        live?.offers.find((o) => o.direction === "sent" && o.post.id === detail.item.id) ?? null,
      reputation: me.reputation,
      idVerification: me.idVerification,
      highestItemValue,
      reach: reachBracket(highestItemValue),
      premiumLocked: detail.viewer.offerLock === "premium",
      maxItemBracket: cap,
      tierItemCapExceeded: cap !== null && targetBracket !== null && targetBracket > cap,
    };
  }

  return {
    context,
    // /api/v1/trades is deliberately NOT part of `isPending`. It contributes
    // the pending-offer summary, which has a correct rendering while it is in
    // flight, and holding the whole screen on it would put a third request in
    // front of the listing header.
    isPending: itemQuery.isPending || meQuery.isPending,
    isError: itemQuery.isError || meQuery.isError,
    error: itemQuery.error ?? meQuery.error,
    refetch: () => {
      void itemQuery.refetch();
      void meQuery.refetch();
      void liveQuery.refetch();
    },
  };
}

/**
 * The terms of offering `item` on the context's listing, or null when either
 * side has no bracket. One call, so the picker row, the bracket section, the
 * button label and the consent sheet all read the same verdict.
 */
export function termsFor(context: OfferContext, item: OfferableItem): OfferTerms | null {
  if (item.bracket === null || context.targetBracket === null) return null;
  return offerTerms(item.bracket, context.targetBracket);
}

/**
 * GET /api/v1/trades, read for the pending-offer summary. See `TradesPayload`.
 *
 * `limit=1` because the trades page is not wanted and 1 is the schema's floor;
 * `offers` is capped rather than paginated and arrives whole either way.
 */
export const LIVE_OFFERS_KEY = ["trades", "active", "offer-context"] as const;

export function useLiveOffers() {
  return useQuery({
    queryKey: LIVE_OFFERS_KEY,
    queryFn: () => apiV1<TradesPayload>("/api/v1/trades?tab=active&limit=1"),
    select: (r) => r.data,
    staleTime: 30_000,
  });
}

/**
 * The grid's half of §7: the reach threshold, and a predicate over one tile.
 *
 * Separate from `useOfferContext` because the marketplace needs only the
 * threshold and must not fetch an item detail to get it.
 */
export function useReach() {
  const me = useProfileMe();

  // Only AVAILABLE rows. `me.items` carries OWNED ones too — things already
  // acquired — and an item you cannot trade away does not extend your reach.
  const highest = (me.data?.items ?? []).reduce(
    (max, row) => (row.status === "AVAILABLE" && !row.hiddenByModerator ? Math.max(max, row.valueLeaves ?? 0) : max),
    0,
  );

  return {
    /**
     * The reach BRACKET, or null until the shelf has loaded. A grid must not
     * grey tiles on a guess.
     */
    reach: me.data ? reachBracket(highest) : null,
    isPending: me.isPending,
  };
}

/** `isOutOfReach`, curried against a possibly-not-yet-known reach. */
export function tileOutOfReach(item: Item, reach: Bracket | null): boolean {
  return reach !== null && isOutOfReach(item.valueLeaves, reach);
}

/* ─────────────────────────── writing the offer ──────────────────────── */

/** The consent the paying side ticks. Sent verbatim; the server compares the version. */
export interface Consent {
  accepted: true;
  policyVersion: string;
}

export function currentConsent(): Consent {
  return { accepted: true, policyVersion: TRADING_POLICY_VERSION };
}

/** What the composer holds when the primary button is pressed. */
export interface OfferDraft {
  postId: string;
  offeredItem: OfferableItem;
  /**
   * Present exactly when the PROPOSER is paying a bridge and has ticked the
   * box. A same-bracket offer and a receiver-pays offer send none; the server
   * ignores a consent it did not ask for and refuses one it did.
   */
  consent: Consent | null;
  /** The Safe Zone the sender proposes meeting at, when the screen offered one. */
  hubName: string | null;
  /** The user's own words. §10.1's `Add a message (optional)`. */
  message: string;
}

/** The server's `MAX_MESSAGE`, mirrored so the composer stops rather than 400s. */
export const MAX_OFFER_MESSAGE = 400;

/**
 * The body POST /api/offers takes, built from a draft.
 *
 * ── THE MESSAGE FIELD CARRIES ONE SENTENCE IT DID NOT WRITE ─────────────────
 *
 * The meetup point. POST /api/offers takes no hub, and a Safe Zone the sender
 * chose that never reaches the other person is worse than not asking. So it is
 * appended as one plain sentence in the words a person would use — not an
 * encoded payload, not JSON, and nothing parses it on the far side.
 *
 * The user's own words come FIRST. Their message is the message; the hub line is
 * a postscript, and putting it above would read as the app talking over the
 * person using it.
 *
 * Truncated at MAX_OFFER_MESSAGE from the END, so the user's own text survives
 * a body that would have been refused.
 */
export function composeOffer(draft: OfferDraft): {
  postId: string;
  offeredItemId: string;
  message: string | null;
  consent?: Consent;
} {
  const parts: string[] = [];
  const own = draft.message.trim();
  if (own) parts.push(own);

  if (draft.hubName) parts.push(`I can meet at ${draft.hubName}.`);

  const message = parts.join("\n\n").slice(0, MAX_OFFER_MESSAGE);

  return {
    postId: draft.postId,
    offeredItemId: draft.offeredItem.id,
    message: message || null,
    ...(draft.consent ? { consent: draft.consent } : {}),
  };
}

export interface OfferCreated {
  offerId: string;
  messageId: string;
  partnerId: string;
  partnerName: string;
  offeredBracket: number;
  targetBracket: number;
  /** The fee quoted, 0 on a same-bracket offer. */
  bridgeFeeLeaves: number;
  bridgeFeePayer: "proposer" | "receiver" | null;
  /** What the proposer actually paid just now. 0 on an up-bridge. */
  chargedLeaves: number;
  /** The server's own sentence for an up-bridge, or null. */
  receiverWillPay: string | null;
  leaves: number;
}

/**
 * POST /api/offers.
 *
 * A LEGACY ROUTE, ON PURPOSE. There is no POST /api/v1/offers; this endpoint
 * answers a bare object on success and `{ error }` on failure rather than the
 * v1 envelope, so it goes through `request()` + `legacyFailure()`. The server's
 * refusals arrive as an ApiError whose `message` is its own sentence.
 *
 * ON SUCCESS the item detail cache is invalidated, because `viewer
 * .existingOfferId` has just become non-null and the pending-offer state is
 * keyed on it. The Leaf balance may have moved too, so the home payload goes
 * with it.
 */
export function useSendOffer() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (draft: OfferDraft): Promise<OfferCreated> => {
      const res = await request("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(composeOffer(draft)),
      });
      if (!res.ok) return legacyFailure(res, "We could not send that offer just now.");
      return (await res.json()) as OfferCreated;
    },

    onSuccess: (_created, draft) => {
      void qc.invalidateQueries({ queryKey: ["item", draft.postId] });
      void qc.invalidateQueries({ queryKey: ["home"] });
      void qc.invalidateQueries({ queryKey: ["profile", "me"] });
      // The balance may have dropped by the fee, and the new offer belongs in
      // `offers`. Both live behind this key.
      void qc.invalidateQueries({ queryKey: LIVE_OFFERS_KEY });
    },
  });
}

/**
 * POST /api/v1/offers/[id]/withdraw — §5.2's `Withdraw and offer again`.
 *
 * The sender retracts. A proposer-paid bridging fee comes back — it was held,
 * not spent. An up-bridge held nothing from the proposer, so nothing returns.
 *
 * Only PENDING. An ACCEPTED offer is a trade, and there is no unilateral exit
 * from a deal the other person already agreed to; the route answers 409 and the
 * screen shows the server's own sentence.
 */
export async function withdrawOffer(offerId: string) {
  return apiV1<{
    offer: { id: string; status: string };
    viewer: { leaves: number; availableLeaves: number };
  }>(`/api/v1/offers/${encodeURIComponent(offerId)}/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export function useWithdrawOffer() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: { offerId: string; postId: string }) => withdrawOffer(input.offerId),
    onSuccess: (_r, input) => {
      // The listing's `existingOfferId` has just become null and the balance
      // may have gone up. Both have to move or the screen stays on the pending
      // state with a withdrawn offer behind it.
      void qc.invalidateQueries({ queryKey: ["item", input.postId] });
      void qc.invalidateQueries({ queryKey: LIVE_OFFERS_KEY });
      void qc.invalidateQueries({ queryKey: ["home"] });
      void qc.invalidateQueries({ queryKey: ["profile", "me"] });
    },
  });
}
