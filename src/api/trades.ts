import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiV1, legacyFailure, request } from "./client";
import { LIVE_OFFERS_KEY, withdrawOffer } from "./offer";
import { grouped } from "../lib/gap";
import { bracketLabel, bracketOf } from "../lib/brackets";
import type { Consent } from "./offer";
import type {
  ActiveTrade,
  ConfirmStatus,
  LiveOffer,
  MeetupPlan,
  SafeZoneHub,
  TradesPayload,
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
 *   GET  /api/trades/[id]/confirm/status   whose turn it is, one trade at a time.
 *
 * The first two are the list. The third belongs to the code screen and is
 * polled there and nowhere else. GET /api/v1/contracts, the promise ledger,
 * went with deferred agreements on 17 Sep 2026 — see `src/lib/trade-rules.ts`
 * for what replaced the promise.
 *
 * ══ TWO THINGS THE SERVER GAINED FOR THIS SCREEN ══════════════════════════
 *
 * Both were gaps that made the design undrawable, and both are closed
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
  /**
   * THIS caller's completion reward, in Leaves, issued in the same transaction
   * that completed the trade. 0 when the server's anti-farming gates zeroed it
   * — a repeat partner inside a week, the same item inside a month, the daily
   * cap — and `rewardNote` then says which, in the server's words. Absent on
   * the `completed: false` half-way response and on an older server.
   */
  reward?: number;
  rewardNote?: string | null;
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
 * ── ACCEPTING AN UP-BRIDGE IS THE RECEIVER'S PAYMENT ────────────────────────
 *
 * When the offered item is one bracket ABOVE the listing, the receiver is the
 * one ending up with the more valuable item, and the bridging fee is theirs.
 * It is held from their balance IN THE ACCEPT, with their consent in the same
 * request: `consent` must be present and its `policyVersion` current, or the
 * server answers 400 CONSENT_REQUIRED / 409 POLICY_VERSION_STALE and flips
 * nothing. A balance short of the fee is 400 INSUFFICIENT_LEAVES with `need`
 * and `have`, and the offer stays PENDING. The consent sheet on the review
 * screen exists so none of those are the first the receiver hears of it.
 *
 * A same-bracket offer and a proposer-pays bridge send no consent: the server
 * asks for none and ignores one.
 */
export interface OfferDecided {
  status: "ACCEPTED" | "DECLINED";
  bridgeFeeLeaves: number | null;
  bridgeFeePaidBySender: boolean | null;
  /** What the ACCEPTER was just charged. 0 unless they were the payer. */
  chargedLeaves: number;
  /** What came back to the proposer on a decline. 0 unless they had paid. */
  releasedLeaves: number;
  tradeId?: string;
}

export function useOfferDecision() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      offerId: string;
      action: "accept" | "decline";
      consent?: Consent | null;
    }): Promise<OfferDecided> => {
      const res = await request(`/api/offers/${encodeURIComponent(input.offerId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: input.action,
          ...(input.consent ? { consent: input.consent } : {}),
        }),
      });
      if (!res.ok) {
        return legacyFailure(
          res,
          input.action === "accept"
            ? "We could not accept that offer just now."
            : "We could not decline that offer just now.",
        );
      }
      return (await res.json()) as OfferDecided;
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
 * PROMISES ARE GONE FROM BOTH LISTS. A deferred agreement used to be a row in
 * "needs you" inside seven days of its deadline and a row in "waiting"
 * otherwise; deferred agreements were retired on 17 Sep 2026 and the bridging
 * fee, which is settled the moment the trade completes, has no deadline to
 * wait on.
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
  | { kind: "offer"; key: string; offer: LiveOffer }
  /** A PENDING TradeRequest addressed to the viewer. See `useTradeDecision()`. */
  | { kind: "trade-request"; key: string; trade: ActiveTrade };

export type WaitingItem =
  | { kind: "sent-offer"; key: string; offer: LiveOffer }
  | { kind: "trade"; key: string; trade: ActiveTrade };

export function buildTradesModel(input: {
  active: TradesPayload | undefined;
  history: TradesPayload | undefined;
}): TradesModel {
  const trades = input.active?.trades ?? [];
  const offers = input.active?.offers ?? [];

  /* ── 1 ── a live code. The server already answered "is there one" per trade:
     `canConfirm` is computed from the code rows themselves, not from `status`,
     so this is a read rather than a guess. CONFIRMING and not ACCEPTED, because
     an accepted trade with no codes yet is a meeting to arrange, not a code to
     read out — frame 9c files that under "Accepted, meeting to set". */
  const codeTrades = trades
    .filter((t) => t.status === "CONFIRMING" && t.canConfirm)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

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
    ...incoming.map((offer) => ({ kind: "offer" as const, key: `offer:${offer.id}`, offer })),
    ...incomingTrades.map((trade) => ({
      kind: "trade-request" as const,
      key: `req:${trade.id}`,
      trade,
    })),
  ];

  /* ── Waiting ── everything with a clock on it that is not yours to move.
     Ordered by how soon it changes: sent offers (a three-day fuse), then trades
     mid-flight. */
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

  const waiting: WaitingItem[] = [
    ...sentOffers.map((offer) => ({ kind: "sent-offer" as const, key: `sent:${offer.id}`, offer })),
    ...waitingTrades.map((trade) => ({ kind: "trade" as const, key: `trade:${trade.id}`, trade })),
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
 * confirmation code, an incoming offer, a PENDING trade request addressed to
 * you. The badge is `needsToday.length` and
 * nothing else. A separate count — "unanswered offers", say — would be a second
 * definition of urgency that drifts from the first, and the failure mode is the
 * one a badge must never have: a number that does not match what is behind it.
 *
 * ══ HOW IT STAYS CURRENT ══════════════════════════════════════════════════
 *
 * It rides the query cache, and therefore costs nothing extra.
 *
 * `TRADES_ACTIVE_KEY` is the key the Trades screen itself uses, so when that
 * screen is open TanStack dedupes to ONE request and the badge is reading the
 * same bytes the list is. When it is not open, this is the only reader and it
 * is one cached call.
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

  return useMemo(
    () => buildTradesModel({ active: active.data, history: undefined }).needsToday.length,
    [active.data],
  );
}

/* ────────────────────────── row-level helpers ───────────────────────── */

/**
 * `Your Vans · Bracket 3 for their Air Max · Bracket 4` — the one line every
 * trade row carries.
 *
 * ── BOTH ITEMS BY BRACKET, NEITHER BY VALUE ────────────────────────────────
 *
 * Since bracket trading, an exact figure appears on NO offer or trade surface
 * — not the other person's item and not the viewer's own. The bracket is what
 * the trade was judged on, and putting a number beside one side of a swap
 * invites the reader to work out the other. Exact values live on the owner's
 * own listing page and in the post wizard, and nowhere else.
 *
 * ── A NULL VALUE DROPS THE FIGURE, NEVER RENDERS AS ZERO ───────────────────
 *
 * `valueLeaves` is nullable and null means "never valued" — a listing older
 * than the valuation model, or an item deleted out from under a trade. `0` is
 * a different claim and a false one. So an unvalued item is named by title
 * alone, on either side.
 *
 * ── §10's OWN RULE ABOUT THE WORD `Leaves` ─────────────────────────────────
 *
 * "Numbers are bare (`480`), the word `Leaves` appears once per context and not
 * on every figure." The context is the Trades screen, where the unit is
 * established by the section around it.
 */
export function swapLine(trade: ActiveTrade): string {
  const sent = trade.direction === "sent";
  // On a `sent` trade the viewer offered `offeredItem` and receives
  // `requestedItem`; on a `received` one it is the reverse.
  const mineItem = sent ? trade.offeredItem : trade.requestedItem;
  const theirsItem = sent ? trade.requestedItem : trade.offeredItem;

  if (trade.kind === "leaves") {
    // A legacy Leaves-only trade: the listing sits in BOTH item columns as a
    // placeholder, so there is one item to name, and it is the receiver's.
    const leaves = trade.offeredLeaves ?? 0;
    const side = leaves > 0 ? `${grouped(leaves)} Leaves` : "Leaves";
    return sent
      ? `Your ${side} for ${bracketed(trade.requestedItem)}`
      : `Their ${side} for your ${bracketed(trade.requestedItem)}`;
  }

  const mine = mineItem ? bracketed(mineItem) : null;
  const theirs = theirsItem ? bracketed(theirsItem) : null;
  if (mine && theirs) return sent ? `Your ${mine} for ${theirs}` : `Their ${theirs} for your ${mine}`;
  return mine ? `Your ${mine}` : theirs ? `Their ${theirs}` : "";
}

/**
 * The same line for an offer. Sent: `Your Vans · Bracket 2 for their Air
 * Max · Bracket 3`. Received: the reverse. One item each way, both by bracket.
 */
export function offerSwapLine(offer: LiveOffer): string {
  const offered = offer.offeredItems[0] ?? null;
  if (offer.direction === "sent") {
    const mine = offered ? bracketed(offered) : "your item";
    return `Your ${mine} for ${bracketed(offer.post)}`;
  }
  const theirs = offered ? bracketed(offered) : "their item";
  return `Their ${theirs} for your ${bracketed(offer.post)}`;
}

/**
 * The bridge on an offer, as one short line for a row: `20-Leaf fee held` /
 * `You pay 30 on accepting` / `They pay 30 on accepting` / null when the pair
 * is the same bracket. Written from the VIEWER's side.
 */
export function offerFeeLine(offer: LiveOffer): string | null {
  const fee = offer.bridgeFeeLeaves ?? 0;
  if (fee <= 0 || !offer.bridgeFeePayer) return null;
  const proposerPays = offer.bridgeFeePayer === "proposer";
  if (offer.direction === "sent") {
    return proposerPays ? `${grouped(fee)}-Leaf fee held` : `They pay ${grouped(fee)} on accepting`;
  }
  return proposerPays ? `They paid a ${grouped(fee)}-Leaf fee` : `You pay ${grouped(fee)} on accepting`;
}

/**
 * The bridge on a live TRADE, from the viewer's side, or null on a
 * same-bracket swap: `Your 20-Leaf fee comes back if this is cancelled` /
 * `Their 20-Leaf fee comes to you when this completes`.
 */
export function tradeFeeLine(trade: ActiveTrade): string | null {
  const fee = trade.bridgeFeeLeaves ?? 0;
  if (fee <= 0 || trade.bridgeFeePaidBySender == null) return null;
  const viewerPaid = trade.bridgeFeePaidBySender === (trade.direction === "sent");
  return viewerPaid
    ? `Your ${grouped(fee)}-Leaf bridging fee goes to them when this completes, or comes back if it is cancelled`
    : `Their ${grouped(fee)}-Leaf bridging fee comes to you when this completes`;
}

/** `Air Max · Bracket 4`, or `Air Max` when never valued. Either side. */
function bracketed(item: { title: string; valueLeaves: number | null }): string {
  return item.valueLeaves === null
    ? item.title
    : `${item.title} · ${bracketLabel(bracketOf(item.valueLeaves))}`;
}
