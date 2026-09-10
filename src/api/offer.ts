import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiV1, legacyFailure, request } from "./client";
import { useItem } from "./item";
import { useProfileMe } from "./profile";
import {
  classifyGap,
  effectivePromiseCeiling,
  isOutOfReach,
  promiseBlock,
  reachThreshold,
  type GapResult,
  type PromiseBlock,
  type StandingInput,
} from "../lib/gap";
import type {
  ContractPreviewPayload,
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
 *   /api/v1/profile/me   what those items are WORTH, plus the tier, the debt
 *                        headroom and the ID gate.
 *   /api/v1/trades       the AVAILABLE balance and, when one exists, the
 *                        contents of the offer already standing on this listing.
 *
 * The third looks out of place in a flow that skips the Trades screen, and it
 * is not: `viewer.availableLeaves` and the `offers` array appear on no other
 * endpoint, and both are load-bearing here. It is called with `limit=1` so the
 * trades page it also returns costs as little as the route allows — `offers` is
 * capped rather than paginated, so it arrives whole regardless.
 *
 * ══ WHAT NO ENDPOINT ANSWERS ════════════════════════════════════════════════
 *
 * Two genuine gaps. Neither is worked around by inventing a field or changing a
 * route; each is named here, rendered honestly by the screen, and reported.
 *
 *   1. ITEM VALUES ON `viewer.tradeableItems`.
 *      /api/v1/items/[id] sends { id, title, image } with no `valueLeaves`, and
 *      the gap between two values is the whole subject of this screen. Closed
 *      by joining against /api/v1/profile/me at the cost of the 50-row page
 *      limit noted in `profile.ts`. An item that is tradeable but off that page
 *      comes through with `valueLeaves: null`, and the picker says so rather
 *      than guessing.
 *
 * A DPA at offer time and a sender-side withdrawal were both gaps here and are
 * both closed on the server now:
 *
 *   POST /api/v1/contracts        takes `{ offerId }` as well as `{ tradeId }`,
 *                                 so a promise is a recorded PENDING_ACCEPT row
 *                                 from the moment it is proposed rather than a
 *                                 sentence in a message. Accepting the OFFER
 *                                 accepts it — there is no second step, and
 *                                 /contracts/[id]/accept 409s an offer-borne
 *                                 contract with `rule: DPA_ACCEPTED_WITH_OFFER`.
 *   POST /api/v1/offers/[id]/withdraw
 *                                 retracts a PENDING offer, releases the Leaves
 *                                 it pledged and declines any promise on it.
 *
 * The one channel still missing is a MEETUP POINT: POST /api/offers takes no
 * hub. `composeOffer()` carries the chosen Safe Zone as one plain sentence in
 * the message, which is free text the recipient reads — not an encoded payload,
 * and nothing parses it on the far side.
 */

/* ────────────────────────── reading the context ─────────────────────── */

/** One of the viewer's own items, as the picker and the gap arithmetic need it. */
export interface OfferableItem {
  id: string;
  title: string;
  image: string | null;
  /**
   * NULL means "this item's value did not come back", not "worth nothing".
   * See gap 1 in the header — it happens for a shelf longer than one page, and
   * for listings that predate the valuation model. The picker renders the
   * difference; the gap arithmetic refuses to run on one.
   */
  valueLeaves: number | null;
}

export interface OfferContext {
  item: ItemDetailPayload["item"];
  viewer: ItemDetailPayload["viewer"];
  hubs: SafeZoneHub[];
  /** The viewer's AVAILABLE listings, values joined in. Newest first. */
  myItems: OfferableItem[];
  /** The raw Leaf balance — what the header pill and §10.2's "You hold" say. */
  balance: number;
  /**
   * The balance MINUS Leaves already pledged to other PENDING offers, which is
   * the figure POST /api/offers actually checks `offeredLeaves` against.
   *
   * THIS, NOT `balance`, IS THE CEILING every settlement row is capped at. The
   * two are equal for most users and differ for exactly the person the rule
   * exists to catch — somebody with three live offers out — so a screen that
   * used `balance` would offer a slider that reaches a number the server
   * refuses. `null` while /api/v1/trades is still in flight; a caller must fall
   * back to `balance` rather than to 0, or a first paint offers nothing.
   */
  availableBalance: number | null;
  /** The PENDING offer already standing on this listing, contents and all. */
  existingOffer: LiveOffer | null;
  reputation: ViewerReputation;
  idVerification: ViewerIdVerification;
  /** The gates on proposing a DPA, resolved from the two blocks above. */
  standing: StandingInput;
  promiseBlocked: PromiseBlock;
  /** What may actually be promised: the headroom, or 0 when anything refuses. */
  promiseCeiling: number;
  /** §7.1 — highest AVAILABLE item value, and the reach it produces. */
  highestItemValue: number;
  reach: number;
  /**
   * The tier's item-value ceiling applied to the LISTING, which is what
   * `enforceItemValueCeiling()` caps on POST /api/offers. Null when the tier is
   * unlimited. This is a gate the spec does not draw and the server does
   * enforce; see `tierItemCapExceeded`.
   */
  maxItemValueLeaves: number | null;
  /** True when this listing is above the viewer's tier cap and the offer would 403. */
  tierItemCapExceeded: boolean;
}

/**
 * Turns a `ViewerReputation` and a `ViewerIdVerification` into the flat input
 * `promiseBlock()` takes.
 *
 * A function rather than an inline object literal because the ID gate and the
 * reputation gate arrive in two different blocks of the same payload, and the
 * one mistake worth guarding against is reading `user.isVerified` — the EMAIL
 * check — where `idVerification.verified` is meant. They are different fields
 * with different meanings and the server says so at length in
 * `@/lib/id-verification`.
 */
export function toStanding(
  reputation: ViewerReputation,
  idVerification: ViewerIdVerification,
): StandingInput {
  return {
    idVerified: idVerification.verified,
    tier: reputation.tier,
    mayProposeDpa: reputation.limits.mayProposeDpa,
    completedTrades: reputation.completedTrades,
    openContracts: reputation.contracts.openContracts,
    remainingDebtHeadroom: reputation.contracts.remainingDebtHeadroom,
    hasUnsettledDefault: reputation.contracts.hasUnsettledDefault,
  };
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
    const myItems: OfferableItem[] = detail.viewer.tradeableItems.map((row) => ({
      id: row.id,
      title: row.title,
      image: row.image,
      valueLeaves: valueById.get(row.id) ?? null,
    }));

    // §7.1's "highest available item". AVAILABLE is the status the server
    // filters `tradeableItems` on, so the reach is computed over the same set
    // the offer screen can actually draw on — an OWNED item on the shelf is not
    // something you can trade away and must not raise your reach.
    const highestItemValue = myItems.reduce((max, row) => Math.max(max, row.valueLeaves ?? 0), 0);

    const standing = toStanding(me.reputation, me.idVerification);
    const cap = me.reputation.limits.maxItemValueLeaves;

    context = {
      item: detail.item,
      viewer: detail.viewer,
      hubs: detail.item.safeZones ?? [],
      myItems,
      // From /items/[id] rather than /profile/me: same column, but the detail
      // route is the one this screen is about and its copy is the fresher of
      // the two on any screen reached by tapping a listing.
      balance: detail.viewer.leaves,
      availableBalance: live ? live.viewer.availableLeaves : null,
      // Matched on the LISTING rather than on `viewer.existingOfferId`, so the
      // two cannot disagree about which offer is meant, and `direction` so a
      // received offer on somebody else's listing can never be mistaken for
      // one this viewer sent.
      existingOffer:
        live?.offers.find((o) => o.direction === "sent" && o.post.id === detail.item.id) ?? null,
      reputation: me.reputation,
      idVerification: me.idVerification,
      standing,
      promiseBlocked: promiseBlock(standing),
      promiseCeiling: effectivePromiseCeiling(standing),
      highestItemValue,
      reach: reachThreshold(highestItemValue),
      maxItemValueLeaves: cap,
      tierItemCapExceeded:
        cap !== null && detail.item.valueLeaves !== null && detail.item.valueLeaves > cap,
    };
  }

  return {
    context,
    // /api/v1/trades is deliberately NOT part of `isPending`. It contributes a
    // ceiling and a summary, both of which have a correct rendering while they
    // are in flight (`availableBalance: null` → fall back to the balance), and
    // holding the whole screen on it would put a third request in front of the
    // listing header that §5.2 says renders immediately from cache.
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
 * GET /api/v1/trades, read for two fields. See the header and `TradesPayload`.
 *
 * `limit=1` because the trades page is not wanted and 1 is the schema's floor;
 * `offers` is capped rather than paginated and arrives whole either way. Thirty
 * seconds of staleness: the available balance moves when an offer elsewhere is
 * accepted or declined, and this number is a spend ceiling.
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
 * threshold and must not fetch an item detail to get it. `enabled` is threaded
 * so the grid does not issue the request before it has a session.
 */
export function useReach() {
  const me = useProfileMe();

  // Only AVAILABLE rows. `me.items` carries OWNED ones too — things already
  // acquired — and an item you cannot trade away does not extend your reach.
  const highest = (me.data?.items ?? []).reduce(
    (max, row) => (row.status === "AVAILABLE" ? Math.max(max, row.valueLeaves ?? 0) : max),
    0,
  );

  return {
    /** Null until the shelf has loaded. A grid must not grey tiles on a guess. */
    reach: me.data ? reachThreshold(highest) : null,
    highestItemValue: highest,
    isPending: me.isPending,
  };
}

/** `isOutOfReach`, curried against a possibly-not-yet-known reach. */
export function tileOutOfReach(item: Item, reach: number | null): boolean {
  return reach !== null && isOutOfReach(item.valueLeaves, reach);
}

/* ─────────────────────────── writing the offer ──────────────────────── */

/**
 * What the composer holds when the primary button is pressed.
 *
 * `promised` and `hubName` are carried even though POST /api/offers has no
 * field for either — see `composeOffer()` immediately below for what happens to
 * them and why that is not the same as inventing an endpoint.
 */
export interface OfferDraft {
  postId: string;
  offeredItem: OfferableItem;
  /** Leaves committed now. Zero for a straight swap or a send-as-is. */
  nowLeaves: number;
  /**
   * TRUE WHEN THE USER CHOSE A PROMISE ROUTE, independently of whether the
   * numbers came out usable.
   *
   * This exists because intent and payload were the same field, and that is how
   * a promise could vanish. `useSendOffer` decided whether to create the
   * contract by testing `promised > 0` — so an intended promise whose amount was
   * zero was indistinguishable from a straight swap, and the send took the
   * straight-swap path in silence.
   *
   * With intent stated separately, "you asked for a promise and it did not
   * happen" becomes a case the send can DETECT, and therefore one it can refuse
   * loudly instead of quietly dropping. See the guard in `useSendOffer`.
   */
  promiseIntended: boolean;
  /** The promise half of a split. Zero unless a promise route was chosen. */
  promised: number;
  /** The deadline the promise names, when there is one. */
  promiseDeadline: Date | null;
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
 * THE PROMISE IS NO LONGER IN HERE. It used to be, when a DPA could not exist
 * before an accepted trade; it is now a real PENDING_ACCEPT contract created by
 * `useSendOffer` immediately after the offer, and a sentence about it in the
 * message would be a second, un-authoritative copy of a fact the database now
 * holds.
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
  offeredItems: { id: string; title: string }[];
  offeredLeaves: number | null;
  message: string | null;
} {
  const parts: string[] = [];
  const own = draft.message.trim();
  if (own) parts.push(own);

  if (draft.hubName) parts.push(`I can meet at ${draft.hubName}.`);

  const message = parts.join("\n\n").slice(0, MAX_OFFER_MESSAGE);

  return {
    postId: draft.postId,
    // `title` is sent and `imageUrl` is not. The schema takes both optionally
    // and the server stores the array verbatim for the chat card; the title is
    // what makes that card readable, and the image URL it already has from the
    // item row.
    offeredItems: [{ id: draft.offeredItem.id, title: draft.offeredItem.title }],
    // `null`, not 0. `leafAmountSchema` is nullish and positive — a literal 0
    // is refused by the schema, and `null` is how "no Leaves" is spelled.
    offeredLeaves: draft.nowLeaves > 0 ? draft.nowLeaves : null,
    message: message || null,
  };
}

export interface OfferCreated {
  offerId: string;
  messageId: string;
  partnerId: string;
  partnerName: string;
}

/**
 * POST /api/offers.
 *
 * A LEGACY ROUTE, ON PURPOSE. There is no POST /api/v1/offers; this endpoint
 * answers a bare object on success and `{ error }` on failure rather than the
 * v1 envelope, so it goes through `request()` + `legacyFailure()` — the same
 * path `createItem()` already takes to POST /api/items, and the same one the
 * previous placeholder screen's note described. `legacyFailure()` unwraps the
 * bare shape into the ApiError the rest of the app throws, so a caller branches
 * on `status` and displays `message` exactly as it does everywhere else.
 *
 * WHAT THE SERVER CAN STILL REFUSE, after every gate this client draws:
 *
 *   403  a standing DPA default            (`enforceCanInitiateTrade`)
 *   403  the listing is above the tier cap (`enforceItemValueCeiling`)
 *   403  a block in either direction       (`enforceNotBlocked`)
 *   400  offeredLeaves above the AVAILABLE balance — gap 2 in the header, the
 *        one refusal this client genuinely cannot predict.
 *
 * The first two are drawn in advance by `useOfferContext`. All four arrive here
 * as an ApiError whose `message` is the server's own sentence, and §5.2's
 * send-failed panel shows it rather than a generic line — the server's version
 * carries the numbers.
 *
 * ON SUCCESS the item detail cache is invalidated, because `viewer
 * .existingOfferId` has just become non-null and §5.2's "pending offer" state
 * is keyed on it. The Leaf balance moved too, so the home payload goes with it.
 */
export function useSendOffer() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (draft: OfferDraft): Promise<OfferCreated> => {
      /*
       * ── A PROMISE THAT CANNOT BE SENT STOPS THE SEND ──────────────────────
       *
       * BEFORE the offer is created, so there is nothing to roll back and no
       * window in which a bare offer exists. The composer already refuses to
       * reach this state — `needsDpaFirst()` sends a zero amount back to §6g and
       * §6g's own button will not leave on one — so this is the backstop, not
       * the mechanism.
       *
       * It is here anyway because the failure it guards against was invisible
       * for the entire life of the feature: not one DeferredContract row was
       * ever written, and nothing anywhere said so. The send simply took the
       * no-promise path. A caller that gets this wrong now gets a sentence.
       *
       * `Error`, not `ApiError`: nothing was asked of the server, so there is no
       * status to carry and it would be a lie to dress it as a refusal. §5.2's
       * panel prints the message either way.
       */
      if (draft.promiseIntended && (draft.promised <= 0 || !draft.promiseDeadline)) {
        throw new Error(
          "This offer includes a deferred agreement, but no amount was set for it. " +
            "Open the agreement and enter the Leaves you are promising — the offer " +
            "has not been sent.",
        );
      }

      // The promise, as two values that are known to be good rather than two
      // fields that have to be re-checked at the point of use. Binding them here
      // is what lets the POST below read as the single act it is — and it keeps
      // the nullability question answered in exactly one place, next to the
      // guard that answers it.
      const promise =
        draft.promiseIntended && draft.promiseDeadline
          ? { amountLeaves: draft.promised, deadline: draft.promiseDeadline.toISOString() }
          : null;

      const res = await request("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(composeOffer(draft)),
      });
      if (!res.ok) return legacyFailure(res, "We could not send that offer just now.");
      const created = (await res.json()) as OfferCreated;

      /*
       * ── THE PROMISE, AS A SECOND REQUEST ──────────────────────────────────
       *
       * POST /api/v1/contracts needs an `offerId`, so the offer has to exist
       * first. That makes this two writes where the user performed one act, and
       * the interesting question is what happens if the second fails.
       *
       * IT WITHDRAWS THE OFFER. Leaving a bare offer standing would be the worst
       * of the available outcomes: the recipient sees a swap proposed at a value
       * the sender never agreed to make up, the sender's Leaves are pledged to
       * it, and the sender is told the send failed — three parties' worth of
       * disagreement about what just happened. Withdrawing puts everything back
       * where §5.2's send-failed panel says it is: "the offer is still here
       * exactly as you built it."
       *
       * That rollback is only possible because POST /api/v1/offers/[id]/withdraw
       * exists; before it, this whole arrangement had no safe failure mode.
       *
       * The withdrawal is best-effort and its own failure is swallowed. If BOTH
       * requests fail the sender has an offer without its promise, which is
       * recoverable by hand from the pending-offer screen — and re-throwing the
       * withdrawal's error instead would replace an accurate message about the
       * promise with a confusing one about the retraction.
       */
      // `promiseIntended`, not `promised > 0`. The old test conflated "no
      // promise was asked for" with "a promise was asked for and came out
      // empty", and silently did nothing in both cases. The guard at the top of
      // this function has already rejected the second, so reaching here with the
      // intent set means the numbers are good.
      if (promise) {
        try {
          await apiV1("/api/v1/contracts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ offerId: created.offerId, ...promise }),
          });
        } catch (contractError) {
          await withdrawOffer(created.offerId).catch(() => {});
          throw contractError;
        }
      }

      return created;
    },

    onSuccess: (_created, draft) => {
      void qc.invalidateQueries({ queryKey: ["item", draft.postId] });
      void qc.invalidateQueries({ queryKey: ["home"] });
      void qc.invalidateQueries({ queryKey: ["profile", "me"] });
      // The available balance has just dropped by whatever was pledged, and the
      // new offer belongs in `offers`. Both live behind this key.
      void qc.invalidateQueries({ queryKey: LIVE_OFFERS_KEY });
    },
  });
}

/**
 * POST /api/v1/offers/[id]/withdraw — §5.2's `Withdraw and offer again`.
 *
 * The sender retracts. This releases the Leaves the offer had pledged — they
 * were held, not spent, and `availableLeaves()` counts only PENDING rows — and
 * declines any deferred agreement proposed alongside it, so the debtor's one
 * contract slot comes free rather than staying locked by an offer nobody
 * answered.
 *
 * Only PENDING. An ACCEPTED offer is a trade, and there is no unilateral exit
 * from a deal the other person already agreed to; the route answers 409 and the
 * screen shows the server's own sentence.
 *
 * A bare function as well as a hook, because `useSendOffer` calls it as a
 * rollback and cannot call a hook from inside a mutation.
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
      // The listing's `existingOfferId` has just become null and the available
      // balance has gone up. Both have to move or the screen stays on §5.2's
      // pending state with a withdrawn offer behind it.
      void qc.invalidateQueries({ queryKey: ["item", input.postId] });
      void qc.invalidateQueries({ queryKey: LIVE_OFFERS_KEY });
      void qc.invalidateQueries({ queryKey: ["home"] });
      void qc.invalidateQueries({ queryKey: ["profile", "me"] });
    },
  });
}

/* ───────────────────────── the creditor's preview ───────────────────── */

/**
 * GET /api/v1/contracts/[id]/preview — §6j, the owner's acceptance view.
 *
 * The server's own header calls this the feature's only real defence, and the
 * reason is worth repeating where the client reads it: nothing downstream of
 * acceptance can compel payment, so the whole of the protection is showing the
 * creditor the debtor's record BEFORE the yes. Every figure this returns is
 * rendered; none is summarised away.
 *
 * `staleTime: 0`. A record that decides whether to underwrite a stranger is not
 * a thing to serve from cache — and the route runs the lazy default sweep on
 * the way in, so a stale copy can be showing ACTIVE for a contract that lapsed.
 */
export const contractPreviewKey = (id: string) => ["contract", id, "preview"] as const;

export function useContractPreview(contractId: string | undefined) {
  return useQuery({
    queryKey: contractPreviewKey(contractId ?? ""),
    queryFn: () =>
      apiV1<ContractPreviewPayload>(
        `/api/v1/contracts/${encodeURIComponent(contractId!)}/preview`,
      ),
    enabled: !!contractId,
    select: (r) => r.data,
    staleTime: 0,
  });
}

/**
 * POST /api/v1/contracts/[id]/accept and .../decline.
 *
 * One hook, one `action`, because they are the two halves of one decision and a
 * screen that could accept but had forgotten to wire decline would be worse
 * than either. NOT gated by ID verification on the server, deliberately — the
 * asymmetry is in `@/lib/contracts`: block the act that creates exposure, never
 * the act that discharges it.
 */
export function useContractDecision(contractId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (action: "accept" | "decline") =>
      apiV1<{ contract: unknown }>(
        `/api/v1/contracts/${encodeURIComponent(contractId!)}/${action}`,
        { method: "POST" },
      ),
    onSuccess: () => {
      if (contractId) {
        void qc.invalidateQueries({ queryKey: contractPreviewKey(contractId) });
      }
      void qc.invalidateQueries({ queryKey: ["profile", "me"] });
    },
  });
}

/** Re-exported so a screen imports its data and its arithmetic from one place. */
export { classifyGap };
export type { GapResult };
