import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiV1, legacyFailure, request } from "./client";
import { LIVE_OFFERS_KEY, withdrawOffer } from "./offer";
import { daysUntil, grouped } from "../lib/gap";
import type {
  ActiveTrade,
  ConfirmStatus,
  ContractsPayload,
  LiveOffer,
  MeetupPlan,
  SafeZoneHub,
  TradesPayload,
  V1Contract,
} from "./types";

/**
 * Everything the Trades screen reads, everything it writes, and the ordering
 * rule §6 states in one sentence and this file makes true.
 *
 * ══ THE FOUR REQUESTS ═══════════════════════════════════════════════════════
 *
 *   GET  /api/v1/trades?tab=active     offers in both directions, live trades,
 *                                      and `viewer.availableLeaves`.
 *   GET  /api/v1/trades?tab=history    finished trades, for the History count.
 *   GET  /api/v1/contracts             the promise ledger, both roles.
 *   GET  /api/trades/[id]/confirm/status   whose turn it is, one trade at a time.
 *
 * The first three are the list. The fourth belongs to the code screen and is
 * polled there and nowhere else.
 *
 * ══ THREE THINGS THE SERVER GAINED FOR THIS SCREEN ══════════════════════════
 *
 * All three were gaps that made the design undrawable, and all three are closed
 * on the server rather than worked around here:
 *
 *   THE VIEWER'S OWN CONFIRMATION CODE.  `confirm/start` now stores an
 *      AES-256-GCM copy beside the bcrypt hash, keyed from SWAP_CODE_KEY in the
 *      server's environment, and `confirm/status` hands each participant THEIR
 *      OWN code back. Never the partner's — that asymmetry is what stops a
 *      stolen token completing a trade by itself, since completion consumes both
 *      codes and the other one only comes from the other person. `ownCode()`
 *      below reads it, and still copes with null: no key, a rotated key, an
 *      expired code and a burned one all answer null, and §6.1's block falls
 *      back to naming the email.
 *
 *   A DELIBERATE SETTLEMENT.  POST /api/v1/contracts/[id]/settle, debtor only,
 *      partial or full. The passive rule is unchanged — earned Leaves still go
 *      to the oldest debt first without being asked — but a debtor with a
 *      balance and an intention can now act on it, which is what the frames'
 *      `Settle` button always meant. Both paths go through one `payContract()`
 *      on the server, so there is still exactly one place Leaves move for a debt.
 *
 *   ITEM VALUES.  `ITEM_BRIEF` carries `valueLeaves`, so §10.6's "Vans 440 for
 *      Air Max 480" is drawable. On an OFFER the values are looked up from the
 *      Item table rather than read out of the client-written `offeredItems`
 *      blob, so the figure is one the server stands behind.
 *
 * ══ WHAT THE DESIGN STILL ASKS FOR AND NO ENDPOINT ANSWERS ══════════════════
 *
 * Four, each accepted as designed rather than patched. None is worked around by
 * inventing a field; each is rendered honestly by the screen that meets it.
 *
 *   1. THE CODE IS SIX DIGITS, NOT FOUR.
 *      `randomDigits(6)` in `confirm/start`, `^\\d{6}$` in `confirmSubmitSchema`.
 *      A four-cell entry cannot ever submit successfully, so `CODE_LENGTH` is 6
 *      and the cells flex to fit — see the note on it below.
 *
 *   2. TERMINAL OFFERS.
 *      `offers` on /api/v1/trades filters `status: "PENDING"`, and the history
 *      tab pages `TradeRequest`, not `Offer`. So an offer that was DECLINED,
 *      WITHDRAWN or EXPIRED is on no endpoint — which is precisely the
 *      distinction frame 9d exists to draw, three sentences for three parties.
 *      History renders the finished TRADES it can see and does not pretend the
 *      three offer endings are among them.
 *
 *   3. A MEETUP HUB ON AN ACCEPTED TRADE.
 *      Frame 9c's `Set it` implies a write that would put a hub on a trade
 *      before the meeting. The hub is claimed at confirmation instead, as
 *      `safeZoneHubId` on the submit body, and validated against both listings'
 *      declared hubs. So the row states what is true — the hub is named when the
 *      codes are — and carries no control.
 *
 *   4. A COUNTERPARTY'S TRUST TIER.
 *      `USER_BRIEF` is `{ id, name, avatar }`, so frame 9c's `Renz P. · Rising`
 *      is not on this payload. The tier is not guessed from `totalTrades`;
 *      `src/lib/trust.ts` says at length why its fallback must not be used where
 *      it decides anything, and a row that labels a stranger's trustworthiness
 *      is exactly that place.
 */

/* ────────────────────────────── reading ─────────────────────────────── */

/**
 * The active tab. THE SAME ROUTE `useLiveOffers()` CALLS, and a different key.
 *
 * `useLiveOffers()` asks for `limit=1` because the offer flow wants two fields
 * and no trades; this asks for a real page. Two keys rather than one because a
 * shared key would make whichever screen mounted second inherit the other's page
 * size — the offer flow would start paying for fifty trades, or this screen would
 * render one. They are the same request to the server and different questions.
 */
export const TRADES_ACTIVE_KEY = ["trades", "active", "list"] as const;
export const TRADES_HISTORY_KEY = ["trades", "history"] as const;
export const CONTRACTS_KEY = ["contracts", "mine"] as const;

/**
 * Thirty seconds, matching `useLiveOffers()`.
 *
 * This list is a to-do list with a clock in it — an offer expires, a deadline
 * moves inside seven days, a partner types a code in — and none of those is a
 * thing to serve from a minute-old cache while somebody stands at the hub.
 */
const LIST_STALE_MS = 30_000;

export function useActiveTrades() {
  return useQuery({
    queryKey: TRADES_ACTIVE_KEY,
    queryFn: () => apiV1<TradesPayload>("/api/v1/trades?tab=active&limit=50"),
    select: (r) => r.data,
    staleTime: LIST_STALE_MS,
  });
}

/**
 * The history tab, read for a COUNT and a page.
 *
 * §6 collapses History to a single row carrying `14 trades`, and the count has
 * to come from somewhere. The route is keyset-paginated with no total, so the
 * row shows what the first page holds and says `50+` at the cap rather than
 * claiming a number it cannot see. Frame 9d expands the same page.
 */
export function useTradeHistory(enabled = true) {
  return useQuery({
    queryKey: TRADES_HISTORY_KEY,
    queryFn: () => apiV1<TradesPayload>("/api/v1/trades?tab=history&limit=50"),
    select: (r) => r.data,
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** The promise ledger, both roles. `role=any` is the route's own default. */
export function useContracts() {
  return useQuery({
    queryKey: CONTRACTS_KEY,
    queryFn: () => apiV1<ContractsPayload>("/api/v1/contracts?limit=50"),
    select: (r) => r.data,
    staleTime: LIST_STALE_MS,
  });
}

/* ─────────────────────────── the confirmation ───────────────────────── */

/**
 * How many digits a confirmation code has.
 *
 * SIX, BECAUSE THE SERVER SAYS SIX. §6.1 and every frame draw four; `randomDigits(6)`
 * generates six and `confirmSubmitSchema` refuses anything else, so a four-cell
 * entry would be a control that cannot succeed. The constant is here, once, so
 * that the day the server's window changes this is a one-line edit and every
 * cell, label and validity check moves with it.
 *
 * The COPY still says "four digits" nowhere: §10.7's strings that name the count
 * are re-written in `src/components/trades/copy.ts` with the count interpolated
 * from here, and that is the one place this screen departs from verbatim §10.
 */
export const CODE_LENGTH = 6;

/**
 * §6.1's "Wrong code" counter, and its ceiling.
 *
 * `MAX_CODE_ATTEMPTS` on the server is 5; §6.1 writes "2 tries left" and "After
 * 3". The screen never hard-codes either — the submit route returns `remaining`
 * on a wrong guess and `locked: true` when the budget is spent, and the counter
 * renders what came back. This constant exists only so the first render, before
 * any guess, has a number to reason about.
 */
export const MAX_CODE_ATTEMPTS = 5;

/**
 * The plaintext of the viewer's OWN code, as `confirm/status` returns it.
 *
 * A PLAIN FUNCTION, NOT A HOOK. It was `useOwnCode()` while it was a stub that
 * took nothing and returned null; now that the value comes off a query the
 * caller already holds, a `use` prefix would be claiming a subscription this has
 * no part in — and would put it under the rules of hooks for no reason.
 *
 * ── NEVER THE PARTNER'S, AND THAT IS THE WHOLE SECURITY PROPERTY ────────────
 *
 * Your own code is the one your PARTNER types in. It is not the one your account
 * submits, so an attacker holding a stolen token learns a secret they cannot
 * spend: completing a trade consumes both codes, and the other one is only
 * obtainable from the other person. The server never returns it and this client
 * never asks for it.
 *
 * ── NULL IS STILL A FIRST-CLASS ANSWER ─────────────────────────────────────
 *
 * Five ways to get one, and the screen renders all five the same: a deployment
 * with no SWAP_CODE_KEY, a row issued before sealing existed, a rotated key, an
 * expired code, a code burned by MAX_CODE_ATTEMPTS. `CodeDisplay` takes
 * `string | null` and names the email when it is null, exactly as it did when
 * this function was a stub — which is why turning the field on needed no change
 * to any of §6.1's four states.
 *
 * NOT LOGGED, ANYWHERE. A confirmation code in a Metro log or a crash report is
 * a secret in a place nobody is auditing.
 */
export function ownCode(status: ConfirmStatus | undefined): string | null {
  return status?.code ?? null;
}

export const confirmStatusKey = (tradeId: string) => ["trade", tradeId, "confirm"] as const;

/**
 * Polls whose turn it is.
 *
 * TWO SECONDS, and only while the screen is open. The other person is standing
 * in front of the viewer and typing; a stale "waiting for them" while they have
 * already finished is the one wrong answer that makes two people stare at two
 * phones. There is no socket on this route, so the poll is the mechanism.
 *
 * `refetchIntervalInBackground` is left at its default of false: the app off
 * screen has nobody reading it, and a two-second poll from the background is a
 * battery cost with no reader.
 */
export function useConfirmStatus(tradeId: string | undefined, polling = true) {
  return useQuery({
    queryKey: confirmStatusKey(tradeId ?? ""),
    queryFn: async (): Promise<ConfirmStatus> => {
      const res = await request(`/api/trades/${encodeURIComponent(tradeId!)}/confirm/status`);
      if (!res.ok) return legacyFailure(res, "Could not check the codes just now.");
      return (await res.json()) as ConfirmStatus;
    },
    enabled: !!tradeId,
    refetchInterval: polling ? 2_000 : false,
    staleTime: 0,
  });
}

/**
 * Untangles §6.1's four states out of two badly-named booleans.
 *
 * `ConfirmStatus`'s own note has the derivation. In one line: a code row is
 * marked used by the person who TYPED it, so the row that says whether the
 * viewer has done their part is the PARTNER's, and the row that says whether the
 * partner has done theirs is the VIEWER's.
 */
export function confirmSides(
  status: ConfirmStatus | undefined,
  direction: "sent" | "received",
): { iSubmitted: boolean; theySubmitted: boolean; started: boolean; completed: boolean } {
  if (!status) return { iSubmitted: false, theySubmitted: false, started: false, completed: false };
  const isSender = direction === "sent";
  return {
    // The partner's code row. I consumed it by typing it correctly.
    iSubmitted: isSender ? status.receiverSubmitted : status.senderSubmitted,
    // My own code row. They consumed it.
    theySubmitted: isSender ? status.senderSubmitted : status.receiverSubmitted,
    started: status.started,
    completed: status.completed,
  };
}

/** §6.1's four states, as one value the screen switches on. */
export type CodeState = "waiting-for-them" | "they-wait-for-you" | "you-are-done" | "matched";

export function codeState(sides: ReturnType<typeof confirmSides>): CodeState {
  if (sides.completed || (sides.iSubmitted && sides.theySubmitted)) return "matched";
  if (sides.iSubmitted) return "you-are-done";
  if (sides.theySubmitted) return "they-wait-for-you";
  return "waiting-for-them";
}

/**
 * POST …/confirm/start — issues both codes and moves the trade to CONFIRMING.
 *
 * IDEMPOTENT WHILE BOTH CODES ARE LIVE AND UNBURNED, which is what makes it safe
 * to call on entering the screen: two live rows answer `alreadyStarted` and
 * re-email nobody. A pair burned by five wrong guesses falls through to
 * regeneration, which is also what §6.1's "Ask Marco to read it again" needs —
 * that control is this call, not a retry of the submit.
 */
export function useConfirmStart(tradeId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<{ started: boolean; alreadyStarted?: boolean }> => {
      const res = await request(`/api/trades/${encodeURIComponent(tradeId!)}/confirm/start`, {
        method: "POST",
      });
      if (!res.ok) return legacyFailure(res, "Could not start the confirmation just now.");
      return (await res.json()) as { started: boolean; alreadyStarted?: boolean };
    },
    onSuccess: () => {
      if (tradeId) void qc.invalidateQueries({ queryKey: confirmStatusKey(tradeId) });
      void qc.invalidateQueries({ queryKey: TRADES_ACTIVE_KEY });
    },
  });
}

/** What a wrong guess tells the screen. `remaining` is the server's count. */
export interface CodeRejection {
  message: string;
  remaining: number | null;
  locked: boolean;
}

export interface ConfirmSubmitResult {
  correct: true;
  completed: boolean;
}

/**
 * POST …/confirm/submit — the viewer types the PARTNER's code.
 *
 * ── WHY THE REJECTION IS A RETURN VALUE AND NOT A THROWN ApiError ───────────
 *
 * A wrong code is not an error condition, it is a state of the screen. §6.1 is
 * explicit about the treatment — the digits STAY in the cells, the rule and the
 * counter go terracotta, no shake and no toast — and that needs `remaining`,
 * which `legacyFailure()` would flatten into a message string. So a 400 carrying
 * a counter is unwrapped into `CodeRejection` and thrown as itself; anything
 * else (401, 403, a dead network) goes through `legacyFailure()` and reaches the
 * screen as the ApiError every other call produces.
 *
 * `safeZoneHubId` rides along when the trade named a hub. The server validates
 * the claim BEFORE the bcrypt compare, so a bad hub id cannot burn one of the
 * partner's five guesses — its own comment explains why that ordering matters.
 */
export function useConfirmSubmit(tradeId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      code: string;
      safeZoneHubId?: string | null;
    }): Promise<ConfirmSubmitResult> => {
      const res = await request(`/api/trades/${encodeURIComponent(tradeId!)}/confirm/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: input.code,
          ...(input.safeZoneHubId ? { safeZoneHubId: input.safeZoneHubId } : {}),
        }),
      });

      if (res.ok) return (await res.json()) as ConfirmSubmitResult;

      // 400 with a counter, or 429 with `locked`. Both are §6.1's wrong-code
      // state and neither is an exception the app should render as a failure.
      if (res.status === 400 || res.status === 429) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          remaining?: number;
          locked?: boolean;
        };
        if (typeof body.remaining === "number" || body.locked) {
          const rejection: CodeRejection = {
            message: body.error ?? "That is not a match.",
            remaining: typeof body.remaining === "number" ? body.remaining : null,
            locked: body.locked === true,
          };
          throw rejection;
        }
      }

      return legacyFailure(res, "Could not check that code just now.");
    },

    onSuccess: () => {
      if (tradeId) void qc.invalidateQueries({ queryKey: confirmStatusKey(tradeId) });
      void qc.invalidateQueries({ queryKey: TRADES_ACTIVE_KEY });
      void qc.invalidateQueries({ queryKey: TRADES_HISTORY_KEY });
      void qc.invalidateQueries({ queryKey: CONTRACTS_KEY });
      void qc.invalidateQueries({ queryKey: LIVE_OFFERS_KEY });
      void qc.invalidateQueries({ queryKey: ["profile", "me"] });
      void qc.invalidateQueries({ queryKey: ["home"] });
    },
  });
}

/** True when a thrown value is §6.1's wrong-code state rather than a failure. */
export function isCodeRejection(e: unknown): e is CodeRejection {
  return (
    typeof e === "object" &&
    e !== null &&
    "locked" in e &&
    "remaining" in e &&
    typeof (e as CodeRejection).message === "string"
  );
}

/* ─────────────────────────── deciding an offer ──────────────────────── */

/**
 * PATCH /api/offers/[id] — the receiver accepts or declines.
 *
 * A LEGACY ROUTE, like POST /api/offers, and for the same reason: there is no
 * v1 equivalent. It answers a bare object, so it goes through `request()` +
 * `legacyFailure()`, the path `useSendOffer()` already takes.
 *
 * ── ACCEPTING THE OFFER ACCEPTS THE PROMISE, IN THE SAME TAP ────────────────
 *
 * A DPA proposed alongside an offer is a real PENDING_ACCEPT row from the moment
 * it is proposed, and this route runs every check /contracts/[id]/accept would
 * have run before flipping both. That is why /contracts/[id]/accept answers 409
 * with `meta.rule: "DPA_ACCEPTED_WITH_OFFER"` for one of these — there is no
 * second step to perform and no way to accept the swap while the promise waits.
 *
 * WHICH IS THE WHOLE REASON THE RECORD SCREEN EXISTS BEFORE THIS CALL. Once the
 * tap lands, nothing downstream can compel payment. `app/offer-review.tsx` is
 * the only route into `accept` for an offer carrying a promise, and it draws the
 * debtor's record above the buttons rather than behind a disclosure.
 */
export function useOfferDecision() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { offerId: string; action: "accept" | "decline" }) => {
      const res = await request(`/api/offers/${encodeURIComponent(input.offerId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: input.action }),
      });
      if (!res.ok) {
        return legacyFailure(
          res,
          input.action === "accept"
            ? "We could not accept that offer just now."
            : "We could not decline that offer just now.",
        );
      }
      return (await res.json()) as unknown;
    },
    onSuccess: () => invalidateTrades(qc),
  });
}

/**
 * PATCH /api/trades — the RECEIVER answers a direct trade request.
 *
 * ── WHY THIS EXISTS ALONGSIDE THE OFFER ROUTE ───────────────────────────────
 *
 * A `TradeRequest` can be born PENDING as well as ACCEPTED. This app only ever
 * creates offers, so every trade it starts arrives already ACCEPTED — but the
 * web client posts to /api/trades directly, and `ACTIVE_STATES` on
 * /api/v1/trades includes PENDING. A row created on the web and answered nowhere
 * on the phone is an obligation the person cannot see, which is the exact
 * failure this screen was built to end.
 *
 * Legacy shape, like the offer decision: `{ tradeId, status }` in the body
 * rather than an id in the path, and a bare object back. Receiver only; the
 * route answers 403 to the sender.
 *
 * `REJECTED`, not `DECLINED`. The trade enum and the offer enum use different
 * words for the same act and neither is renamed here — the wire is the wire.
 */
export function useTradeDecision() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { tradeId: string; status: "ACCEPTED" | "REJECTED" }) => {
      const res = await request("/api/trades", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        return legacyFailure(
          res,
          input.status === "ACCEPTED"
            ? "We could not accept that trade just now."
            : "We could not decline that trade just now.",
        );
      }
      return (await res.json()) as unknown;
    },
    onSuccess: () => invalidateTrades(qc),
  });
}

/**
 * PATCH /api/trades/[id] with `{ action: "cancel" }` — either party calls it off.
 *
 * NOT THE SAME ACT AS WITHDRAWING AN OFFER, and the two are kept apart on
 * purpose. Withdrawing retracts a proposal nobody has agreed to; cancelling ends
 * a trade row, releases both items from IN_TRADE back to AVAILABLE, and is
 * available to the receiver as well as the sender. The server refuses it outside
 * the states where it makes sense.
 */
export function useCancelTrade() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (tradeId: string) => {
      const res = await request(`/api/trades/${encodeURIComponent(tradeId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!res.ok) return legacyFailure(res, "We could not call that trade off just now.");
      return (await res.json()) as unknown;
    },
    onSuccess: () => invalidateTrades(qc),
  });
}

/**
 * POST /api/v1/offers/[id]/withdraw — the SENDER retracts. PENDING only.
 *
 * `withdrawOffer()` itself lives in `src/api/offer.ts`, because `useSendOffer()`
 * calls it as a rollback and cannot call a hook from inside a mutation. This is
 * the Trades screen's hook over the same function, with this screen's
 * invalidations — the offer flow's version invalidates a listing this screen
 * does not have an id for.
 */
export function useWithdrawFromTrades() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (offerId: string) => withdrawOffer(offerId),
    onSuccess: () => invalidateTrades(qc),
  });
}

/**
 * POST /api/v1/contracts/[id]/settle — the debtor pays, on purpose.
 *
 * ── WHAT THE FRAMES' `Settle` BUTTON NOW DOES ──────────────────────────────
 *
 * Omitting `amountLeaves` pays the whole remaining balance, and the SERVER
 * computes that remainder rather than this client sending one. That is not
 * laziness: the remainder can move between the read that drew the screen and the
 * write — a task award landing, a concurrent settlement — and a client-computed
 * figure would then be either short or refused. "Pay it off" is a well-defined
 * instruction; "pay exactly 180" is a bet on a number.
 *
 * ── WHAT IT DOES NOT REPLACE ───────────────────────────────────────────────
 *
 * The passive rule stands: Leaves the debtor EARNS still go to the oldest debt
 * first, without being asked, and there is no opting out of it. This is an
 * additional way to act, not a change to the arrangement.
 *
 * ── THE TWO REFUSALS A SCREEN HAS TO RENDER ────────────────────────────────
 *
 *   400 INSUFFICIENT_LEAVES  meta carries `balance` and `requested`, so the row
 *                            can say "you have 130 and this needs 180" without
 *                            parsing the sentence.
 *   409 CONTRACT_CHANGED     a concurrent payment won the conditional write.
 *                            Nothing was taken. Refetch and try again.
 *
 * A defaulted agreement CAN be settled, and that is the way out of the trading
 * restriction — paying it off reaches FULFILLED and lifts the block. The default
 * itself stays on the record permanently, which is what §10.4's `1, settled
 * late` describes.
 */
export interface SettleResult {
  contract: V1Contract | null;
  payment: { amountLeaves: number; fulfilled: boolean; remainingLeaves: number };
  viewer: { leaves: number };
}

export function useSettleContract() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: { contractId: string; amountLeaves?: number }) =>
      apiV1<SettleResult>(
        `/api/v1/contracts/${encodeURIComponent(input.contractId)}/settle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // The key is omitted rather than sent as undefined: the body schema is
          // `strictObject`, and an explicit `undefined` survives JSON.stringify
          // as an absent key anyway — but being deliberate here is what keeps
          // "pay it all" and "pay this much" two visibly different requests.
          body: JSON.stringify(
            input.amountLeaves === undefined ? {} : { amountLeaves: input.amountLeaves },
          ),
        },
      ),
    onSuccess: () => invalidateTrades(qc),
  });
}

/**
 * The window an extension request has to land in, relative to the CURRENT
 * deadline. A HAND-KEPT MIRROR of `DPA.minExtensionDays` / `maxExtensionDays`,
 * like `TIER_LADDER` in `src/lib/gap.ts` and the thresholds in
 * `src/lib/trust.ts`. It goes stale silently if the server's table is tuned; the
 * server re-checks the bound either way, so the cost of drift is a 400 rather
 * than a wrong deadline.
 */
export const EXTENSION_DAYS = { min: 1, max: 14, suggested: 7 } as const;

/**
 * POST /api/v1/contracts/[id]/extension/request — the debtor asks for more time.
 *
 * THE ONLY ACTION A DEBTOR ROW CAN ACTUALLY CARRY. See gap 5: settling by hand
 * has no route, because settlement happens out of earnings, oldest contract
 * first. One extension per contract; the server refuses a second.
 *
 * ASKING DOES NOT MOVE THE DEADLINE, and the row must not imply that it does.
 * It records that the debtor asked and what they asked for; only the creditor's
 * grant moves anything, and `extensionUsed` is set by the grant rather than by
 * the request — so a debtor cannot burn their own extension by asking.
 */
export function useRequestExtension() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: { contractId: string; deadline: Date }) =>
      apiV1<{ contract: unknown }>(
        `/api/v1/contracts/${encodeURIComponent(input.contractId)}/extension/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deadline: input.deadline.toISOString() }),
        },
      ),
    onSuccess: () => invalidateTrades(qc),
  });
}

/* ═══════════════════════ THE MEETUP PLAN (gap 6) ══════════════════════ */

/**
 * Arranging where and when, after accepting and before meeting.
 *
 * ── THE PLAN IS NOT THE CLAIM ───────────────────────────────────────────────
 *
 * `ActiveTrade.meetup` is what the two of them ARRANGED. `ActiveTrade.safeZoneHub`
 * is what they CLAIMED afterwards, and it is the one the Safe-Zone award reads.
 * Nothing in this section writes the claim, and no screen may present a plan as
 * evidence that a meeting took place — a proposal is one person typing a place
 * name into their phone.
 *
 * ── AGREEING DOES NOT ISSUE CODES ───────────────────────────────────────────
 *
 * These hooks never touch `confirm/start`. Codes live 15 minutes, so a pair
 * minted when a meeting is agreed for Saturday would be dead days before anybody
 * could read one out. Codes come from opening the code screen, which is the only
 * thing that has ever issued them.
 */

export const meetupKey = (tradeId: string) => ["trade", tradeId, "meetup"] as const;

/** What the picker needs, and the standing plan with it. */
export interface MeetupOptions {
  /**
   * EVERY active hub, not the intersection. The plan is deliberately wider than
   * the claim: two listings that share no hub can still arrange to meet at any
   * public place, and the other side agrees or counters. Only a hub in
   * `sharedHubIds` earns the Safe-Zone reward at confirmation — the claim rule
   * on the server is unchanged, and a plan it would reject simply pays nothing.
   */
  hubs: SafeZoneHub[];
  /** Both listings named these. The picker sorts them first and badges them. */
  sharedHubIds: string[];
  /** The viewer's own listing names these. */
  yourHubIds: string[];
  /** The other listing names these — proposing one is not new to them. */
  theirHubIds: string[];
  plan: MeetupPlan | null;
  /** Which side the viewer is — read `plan.proposedBy` against this. */
  you: "sender" | "receiver";
  /** The viewer's own listing in this trade, for the add-a-hub route out. */
  yourItemId: string;
}

export function useMeetupOptions(tradeId: string | undefined) {
  return useQuery({
    queryKey: meetupKey(tradeId ?? ""),
    queryFn: async () => {
      const { data } = await apiV1<MeetupOptions>(
        `/api/v1/trades/${encodeURIComponent(tradeId!)}/meetup`,
      );
      return data;
    },
    enabled: !!tradeId,
  });
}

/**
 * POST …/meetup — propose a place and time, or counter one.
 *
 * A COUNTER IS THE SAME CALL. There is no decline: sending a different hub or
 * time overwrites the plan and clears the agreement, which leaves the other side
 * something to answer instead of an empty table. The server is what enforces
 * that; this hook just posts.
 *
 * `at` goes over the wire as an ISO instant with an offset, never as typed text.
 */
export function useProposeMeetup(tradeId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { hubId: string; at: Date; note?: string }) => {
      const { data } = await apiV1<{ plan: MeetupPlan }>(
        `/api/v1/trades/${encodeURIComponent(tradeId!)}/meetup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hubId: input.hubId,
            at: input.at.toISOString(),
            ...(input.note && input.note.trim().length > 0 ? { note: input.note.trim() } : {}),
          }),
        },
      );
      return data.plan;
    },
    onSuccess: () => {
      if (tradeId) void qc.invalidateQueries({ queryKey: meetupKey(tradeId) });
      invalidateTrades(qc);
    },
  });
}

/**
 * POST …/meetup/accept — the other side agrees.
 *
 * THE PLAN IS ECHOED BACK. `confirmHubId`/`confirmAt` are what this viewer
 * believes they are agreeing to, and the server answers 409 if a counter landed
 * between the screen rendering and the tap. Agreeing to a plan that changed
 * underneath is the one failure in this flow that ends with somebody standing in
 * the wrong car park, so the echo is sent always rather than being optional here.
 */
export function useAcceptMeetup(tradeId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { confirmHubId: string; confirmAt: string }) => {
      const { data } = await apiV1<{ plan: MeetupPlan; alreadyAgreed?: boolean }>(
        `/api/v1/trades/${encodeURIComponent(tradeId!)}/meetup/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      return data;
    },
    onSuccess: () => {
      if (tradeId) void qc.invalidateQueries({ queryKey: meetupKey(tradeId) });
      invalidateTrades(qc);
    },
  });
}

/**
 * Whose turn it is on an accepted trade — the one place that reasoning lives.
 *
 * Four states, and every screen that draws a meetup row switches on this rather
 * than re-deriving it from `proposedBy` and `direction`, which is the comparison
 * that is easy to get backwards.
 */
export type MeetupState = "none" | "yours-to-answer" | "waiting-on-them" | "agreed";

export function meetupState(trade: ActiveTrade): MeetupState {
  const plan = trade.meetup;
  if (!plan) return "none";
  if (plan.agreedAt) return "agreed";
  // `proposedBy` is a side and `direction` says which side the viewer is, so
  // "sender proposed it" is the viewer's own proposal exactly when they sent.
  const mine = plan.proposedBy === (trade.direction === "sent" ? "sender" : "receiver");
  return mine ? "waiting-on-them" : "yours-to-answer";
}

/** Everything this screen shows, after anything on it changes. */
function invalidateTrades(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: TRADES_ACTIVE_KEY });
  void qc.invalidateQueries({ queryKey: TRADES_HISTORY_KEY });
  void qc.invalidateQueries({ queryKey: CONTRACTS_KEY });
  void qc.invalidateQueries({ queryKey: LIVE_OFFERS_KEY });
  void qc.invalidateQueries({ queryKey: ["profile", "me"] });
  void qc.invalidateQueries({ queryKey: ["home"] });
}

/* ══════════════════════════ §6 THE ORDERING ═══════════════════════════ */

/**
 * ONE PRIORITISED LIST, NOT TABS — and this function is where that is decided.
 *
 * The reasoning, written down so it is not quietly undone: tabs put the
 * car-park case behind a tap. Somebody standing next to a stranger about to hand
 * over a jacket should not have to navigate to find their code. So the thing
 * that needs doing right now is at the top of the only list there is, and
 * everything else sorts under it.
 *
 * `Needs you today` admits three kinds, IN THIS ORDER (§6):
 *
 *   1. a confirmation code is live
 *   2. a promise inside seven days of its deadline, or past it
 *   3. an incoming offer awaiting a reply
 *
 * The order is the order, not a sort key — a code beats a deadline beats an
 * offer, because that is the order of how immediately the person in front of you
 * is affected. Within each kind, the most urgent first.
 *
 * A CREDITOR'S PROMISE IS NEVER ADMITTED. §6's block is "needs you", and there
 * is nothing a creditor can do about a debt: you cannot make someone pay. Frame
 * 9j says it plainly — creditor rows carry no action — so a creditor's row waits
 * in `Waiting` however close the deadline is, and only the debtor is called up.
 *
 * PURE, AND EXPORTED, so the ordering is testable without a screen.
 */
export interface TradesModel {
  needsToday: NeedsItem[];
  waiting: WaitingItem[];
  /** Null while the history page is still loading. */
  historyCount: number | null;
  /** True at the page cap — the row says `50+` rather than claiming a total. */
  historyCapped: boolean;
}

export type NeedsItem =
  | { kind: "code"; key: string; trade: ActiveTrade }
  | { kind: "promise"; key: string; contract: V1Contract }
  | { kind: "offer"; key: string; offer: LiveOffer }
  /** A PENDING TradeRequest addressed to the viewer. See `useTradeDecision()`. */
  | { kind: "trade-request"; key: string; trade: ActiveTrade };

export type WaitingItem =
  | { kind: "sent-offer"; key: string; offer: LiveOffer }
  | { kind: "trade"; key: string; trade: ActiveTrade }
  | { kind: "promise"; key: string; contract: V1Contract };

/** §5.3 / §6: a promise is "near" inside seven days, and stays near past zero. */
export function promiseIsNear(contract: V1Contract, now: Date = new Date()): boolean {
  return daysUntil(new Date(contract.deadline), now) <= 7;
}

/** Live and owing. PENDING_ACCEPT is not yet a debt; DECLINED never was one. */
function isOwing(c: V1Contract): boolean {
  return c.status === "ACTIVE" || c.status === "DEFAULTED";
}

export function buildTradesModel(input: {
  active: TradesPayload | undefined;
  contracts: ContractsPayload | undefined;
  history: TradesPayload | undefined;
  now?: Date;
}): TradesModel {
  const now = input.now ?? new Date();
  const trades = input.active?.trades ?? [];
  const offers = input.active?.offers ?? [];
  const contracts = input.contracts?.contracts ?? [];

  /* ── 1 ── a live code. The server already answered "is there one" per trade:
     `canConfirm` is computed from the code rows themselves, not from `status`,
     so this is a read rather than a guess. CONFIRMING and not ACCEPTED, because
     an accepted trade with no codes yet is a meeting to arrange, not a code to
     read out — frame 9c files that under "Accepted, meeting to set". */
  const codeTrades = trades
    .filter((t) => t.status === "CONFIRMING" && t.canConfirm)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  /* ── 2 ── a promise inside seven days, or overdue. Debtor only. Most urgent
     first, which past the deadline means most overdue first — `daysUntil` goes
     negative and the ascending sort puts it at the top on its own. */
  const nearPromises = contracts
    .filter((c) => c.role === "debtor" && isOwing(c) && promiseIsNear(c, now))
    .sort((a, b) => daysUntil(new Date(a.deadline), now) - daysUntil(new Date(b.deadline), now));

  /* ── 3 ── an incoming offer. Oldest first: it is the one closest to expiring,
     and an offer that expires unanswered is the outcome §10.6 calls "nobody did
     anything" — the one this block exists to prevent. */
  const incoming = offers
    .filter((o) => o.direction === "received")
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  /* A PENDING TradeRequest addressed to the viewer. Same category as an incoming
     offer — somebody is waiting on an answer — and it sits beside them rather
     than in a block of its own, because from the reader's side "Renz wants to
     swap" is one kind of thing however the row was created. */
  const incomingTrades = trades
    .filter((t) => t.status === "PENDING" && t.direction === "received")
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  const needsToday: NeedsItem[] = [
    ...codeTrades.map((trade) => ({ kind: "code" as const, key: `code:${trade.id}`, trade })),
    ...nearPromises.map((contract) => ({
      kind: "promise" as const,
      key: `promise:${contract.id}`,
      contract,
    })),
    ...incoming.map((offer) => ({ kind: "offer" as const, key: `offer:${offer.id}`, offer })),
    ...incomingTrades.map((trade) => ({
      kind: "trade-request" as const,
      key: `req:${trade.id}`,
      trade,
    })),
  ];

  /* ── Waiting ── everything with a clock on it that is not yours to move.
     Ordered by how soon it changes: sent offers (a three-day fuse), then trades
     mid-flight, then promises further out than seven days. */
  const sentOffers = offers
    .filter((o) => o.direction === "sent")
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  // Everything mid-flight that is not in `Needs you today`: an ACCEPTED trade
  // with no meeting, a CONFIRMING one the viewer has already done their half of,
  // and a PENDING request the viewer SENT and cannot answer themselves.
  const waitingTrades = trades
    .filter(
      (t) =>
        t.status === "ACCEPTED" ||
        (t.status === "CONFIRMING" && !t.canConfirm) ||
        (t.status === "PENDING" && t.direction === "sent"),
    )
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  const nearKeys = new Set(nearPromises.map((c) => c.id));
  const restingPromises = contracts
    .filter(
      (c) =>
        !nearKeys.has(c.id) &&
        (c.status === "PENDING_ACCEPT" || isOwing(c)),
    )
    .sort((a, b) => daysUntil(new Date(a.deadline), now) - daysUntil(new Date(b.deadline), now));

  const waiting: WaitingItem[] = [
    ...sentOffers.map((offer) => ({ kind: "sent-offer" as const, key: `sent:${offer.id}`, offer })),
    ...waitingTrades.map((trade) => ({ kind: "trade" as const, key: `trade:${trade.id}`, trade })),
    ...restingPromises.map((contract) => ({
      kind: "promise" as const,
      key: `open:${contract.id}`,
      contract,
    })),
  ];

  const historyRows = input.history?.trades;

  return {
    needsToday,
    waiting,
    historyCount: historyRows ? historyRows.length : null,
    historyCapped: (historyRows?.length ?? 0) >= 50,
  };
}

/**
 * How many things need this person today — the number on the Trades tab.
 *
 * ══ THE SAME SET THE SCREEN DRAWS, NOT A SECOND DEFINITION ═════════════════
 *
 * `buildTradesModel()` already decides what "needs you" means: a live
 * confirmation code, a debtor's promise inside seven days, an incoming offer, a
 * PENDING trade request addressed to you. The badge is `needsToday.length` and
 * nothing else. A separate count — "unanswered offers", say — would be a second
 * definition of urgency that drifts from the first, and the failure mode is the
 * one a badge must never have: a number that does not match what is behind it.
 *
 * ══ HOW IT STAYS CURRENT ══════════════════════════════════════════════════
 *
 * It rides the query cache, and therefore costs nothing extra.
 *
 * `TRADES_ACTIVE_KEY` and `CONTRACTS_KEY` are the keys the Trades screen itself
 * uses, so when that screen is open TanStack dedupes to ONE pair of requests and
 * the badge is reading the same bytes the list is. When it is not open, this is
 * the only reader and it is two cached calls.
 *
 * It goes stale-and-refetches on the events that already exist:
 *
 *   - every mutation in this file ends in `invalidateTrades()`, so answering an
 *     offer, confirming a code or settling a promise moves the number in the
 *     same tick the list moves. THAT is what makes it clear as things are
 *     handled rather than on tap — nothing here is tied to focusing the tab.
 *   - `LIST_STALE_MS` plus refetch-on-app-foreground picks up what someone else
 *     did while the app was backgrounded.
 *
 * What it does NOT do is poll, and the note in `TabBar` says what would replace
 * the remaining gap — an offer that arrives while the app is open and idle waits
 * for the next refetch. See the Pusher note there.
 *
 * `history` is not fetched: it feeds `historyCount` only, and no history row is
 * ever in `needsToday`. Asking for it here would be a third request for a
 * number this function discards.
 */
export function useNeedsTodayCount(): number {
  const active = useActiveTrades();
  const contracts = useContracts();

  return useMemo(
    () =>
      buildTradesModel({
        active: active.data,
        contracts: contracts.data,
        history: undefined,
      }).needsToday.length,
    [active.data, contracts.data],
  );
}

/* ────────────────────────── row-level helpers ───────────────────────── */

/**
 * `Your Vans 440 for his Air Max 480` — §10.6's line, values and all.
 *
 * ── A NULL VALUE DROPS THE FIGURE, NEVER RENDERS AS ZERO ───────────────────
 *
 * `valueLeaves` is nullable and null means "never valued" — a listing older than
 * the valuation model, or an item deleted out from under a trade. `0` is a
 * different claim and a false one. So `titled()` below appends a number when
 * there is one and says the title alone when there is not, which is the same
 * call `src/api/offer.ts` makes for an unvalued item in the picker.
 *
 * ── §10's OWN RULE ABOUT THE WORD `Leaves` ─────────────────────────────────
 *
 * "Numbers are bare (`480`), the word `Leaves` appears once per context and not
 * on every figure." This line carries two figures and no unit; the context is
 * the Trades screen, where the unit is established by the section around it.
 */
export function swapLine(trade: ActiveTrade): string {
  const theirs = titled(trade.requestedItem);
  const mine = trade.offeredItem ? titled(trade.offeredItem) : null;

  if (trade.kind === "leaves") {
    // The listing sits in BOTH item columns on a Leaves-only trade, as a
    // placeholder, so there is no second item to name — the route sends
    // `offeredItem: null` for exactly this reason.
    const leaves = trade.offeredLeaves ?? 0;
    const side = leaves > 0 ? `${grouped(leaves)} Leaves` : "Leaves";
    return trade.direction === "sent" ? `Your ${side} for ${theirs}` : `Their ${side} for ${theirs}`;
  }

  if (!mine) return theirs;
  return trade.direction === "sent" ? `Your ${mine} for ${theirs}` : `Their ${mine} for ${theirs}`;
}

/**
 * The same line for an offer, which names a listing and a set of items.
 *
 * With more than one item offered, the FIGURE IS THE SUM and the title is the
 * first plus a count: `Your chair 760 +2 for his guitar 1,450`. Summing is the
 * honest reduction — §10.2's very-large-gap copy does the same thing with "Your
 * four items together come to 1,620" — and it is only shown when EVERY item has
 * a value, because a sum with a null in it is a smaller number presented as a
 * total.
 */
export function offerSwapLine(offer: LiveOffer): string {
  const listing = titled(offer.post);
  const items = offer.offeredItems;
  const first = items[0];
  const extra = items.length - 1;

  let mine: string | null = null;
  if (first) {
    const allValued = items.every((i) => i.valueLeaves !== null);
    const sum = allValued ? items.reduce((t, i) => t + (i.valueLeaves ?? 0), 0) : null;
    const name = extra > 0 ? `${first.title} +${extra}` : first.title;
    mine = sum !== null ? `${name} ${grouped(sum)}` : name;
  }

  if (offer.direction === "sent") {
    return mine ? `Your ${mine} for ${listing}` : `Your Leaves for ${listing}`;
  }
  return mine ? `Their ${mine} for your ${listing}` : `Their Leaves for your ${listing}`;
}

/** `Air Max 480`, or `Air Max` when the item was never valued. */
function titled(item: { title: string; valueLeaves: number | null }): string {
  return item.valueLeaves === null ? item.title : `${item.title} ${grouped(item.valueLeaves)}`;
}

/**
 * What a debtor row's controls are.
 *
 * `settle` IS THE PRIMARY ONE and it is what the frames always drew. Available
 * on anything still owing — including a DEFAULTED agreement, because paying that
 * off is the way out of the trading restriction.
 *
 * `extend` is secondary and is not a substitute: asking for more time does not
 * move the deadline, only the creditor's grant does, and one is allowed per
 * contract. A row offers it only while there is still time to extend — an
 * agreement that has already lapsed cannot be un-defaulted by an extension, and
 * the server says so in those words.
 *
 * NEITHER, FOR EVERY CREDITOR ROW, per frame 9j — you cannot make someone pay,
 * and a control that only expresses impatience is one this app does not draw.
 */
export function promiseActions(c: V1Contract): { settle: boolean; extend: boolean } {
  if (c.role !== "debtor") return { settle: false, extend: false };

  const owing =
    (c.status === "ACTIVE" || c.status === "DEFAULTED") && c.remainingLeaves > 0;

  return {
    settle: owing,
    extend:
      c.status === "ACTIVE" && !c.extension.used && !c.extension.pending && c.remainingLeaves > 0,
  };
}
