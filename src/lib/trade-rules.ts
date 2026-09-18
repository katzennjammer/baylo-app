/**
 * The bracket trading rules, mirrored from `baylo/src/lib/trade-rules.ts`.
 *
 * ── WHAT THE RULES ARE, IN FOUR LINES ───────────────────────────────────────
 *
 *   An offer may be the SAME bracket, ONE BELOW or ONE ABOVE the listing.
 *   Two or more apart is refused, in either direction.
 *   A bridge costs 10 Leaves × the bracket of the LOWER item.
 *   The side handing over that lower item pays it — whoever proposed.
 *
 * The last line is the one worth reading twice, because it is not intuitive
 * and it is the whole of the fairness argument: the fee is not a charge for
 * proposing, it is what the person who ends up with the MORE valuable item
 * puts in to make the swap even. Offer something smaller than the listing and
 * you pay on send; offer something bigger and THEY pay on accept.
 *
 * ── A HAND-KEPT MIRROR, AND WHAT THAT COSTS ─────────────────────────────────
 *
 * Same arrangement as `brackets.ts`: the server is the source and this is the
 * copy that lets a picker grey a row without a round trip. THE SERVER ENFORCES
 * ITS OWN, on propose and again on accept, so a drift here shows as a row
 * greyed that should not have been, or an offer refused with the server's own
 * sentence — never as a fee charged that this file invented.
 *
 * `TRADING_POLICY_VERSION` is the one value where a drift is not cosmetic: the
 * consent this client records is checked against the server's string, and a
 * stale one is answered 409 `POLICY_VERSION_STALE` with "reopen the offer".
 * That is the designed behaviour of a client that has not been updated, not a
 * bug — but it means shipping a policy change means shipping this file.
 *
 * ── NOT A PEG ───────────────────────────────────────────────────────────────
 *
 * Every number here is in Leaves. No pesos, no exchange rate, no currency
 * symbol anywhere in this file or in any string built from it.
 */

import { BRACKET_COUNT, bracketOf, bracketRange, type Bracket } from "./brackets";

/**
 * The policy wording the consent checkbox agrees to. Sent with every consent
 * and compared for equality on the server.
 */
export const TRADING_POLICY_VERSION = "2026-09-16";

/** Where the policy lives, on the web. The consent sheet links here. */
export const TRADING_POLICY_PATH = "/policy/trading";

/* ────────────────────────────── legality ─────────────────────────────── */

export type OfferLegality =
  /** Same bracket. No fee, no consent, no sheet. */
  | "same"
  /** Offered item one bracket BELOW the listing. The proposer moves up, and pays. */
  | "bridgeUp"
  /** Offered item one bracket ABOVE the listing. The receiver moves up, and pays. */
  | "bridgeDown"
  /** Two or more below. Refused. */
  | "tooLow"
  /** Two or more above. Refused. */
  | "tooHigh";

/** How far apart the two brackets may be, in either direction. */
export const MAX_BRACKET_GAP = 1;

/**
 * `offerLegality(2, 3)` → `bridgeUp`; `(4, 3)` → `bridgeDown`; `(3, 3)` →
 * `same`; `(1, 3)` → `tooLow`; `(5, 3)` → `tooHigh`.
 *
 * NAMED FROM THE PROPOSER'S POINT OF VIEW, because every screen that calls it
 * belongs to one of the two people and the proposer is the one choosing. "Up"
 * is the direction the proposer's own holdings move.
 */
export function offerLegality(offered: Bracket, target: Bracket): OfferLegality {
  const gap = target - offered;
  if (gap === 0) return "same";
  if (gap > MAX_BRACKET_GAP) return "tooLow";
  if (gap < -MAX_BRACKET_GAP) return "tooHigh";
  return gap > 0 ? "bridgeUp" : "bridgeDown";
}

/** True for the three legalities that may actually be sent. */
export function offerAllowed(legality: OfferLegality): boolean {
  return legality === "same" || legality === "bridgeUp" || legality === "bridgeDown";
}

/* ──────────────────────────── the bridging fee ───────────────────────── */

/** Leaves per bracket of the LOWER item. A 1↔2 bridge costs 10, a 6↔7 costs 60. */
export const BRIDGE_FEE_PER_BRACKET = 10;

/**
 * The fee for a bridge whose lower item sits in `lowerBracket` — which is
 * always the PAYER's own item, in both directions.
 *
 * `null` for the top bracket: a bracket-10 item cannot be the lower half of a
 * bridge, because there is no bracket 11 for the other half to be in. Two
 * bracket-10 items are `same`, not a bridge, and cost nothing.
 */
export function bridgingFee(lowerBracket: Bracket): number | null {
  if (lowerBracket < 1 || lowerBracket >= BRACKET_COUNT) return null;
  return BRIDGE_FEE_PER_BRACKET * lowerBracket;
}

/** Which side of an offer pays the bridging fee. */
export type FeePayer = "proposer" | "receiver";

export interface OfferTerms {
  legality: OfferLegality;
  allowed: boolean;
  /** 0 when there is nothing to pay, or when the pair is not allowed at all. */
  fee: number;
  /** `null` when `fee` is 0. */
  payer: FeePayer | null;
  /** The bracket the fee was derived from: the lower of the two. */
  feeBracket: Bracket | null;
}

/**
 * Everything about the money on one offer, in one call, so "is it legal",
 * "what does it cost" and "who pays" can never disagree on a screen.
 *
 * THE PAYER IS THE SIDE HANDING OVER THE LOWER ITEM — equivalently, the side
 * receiving the higher one. `bridgeUp` is the proposer (they offered the
 * smaller item); `bridgeDown` is the receiver (their listing is the smaller
 * item, and they are being offered something bigger).
 */
export function offerTerms(offered: Bracket, target: Bracket): OfferTerms {
  const legality = offerLegality(offered, target);
  const allowed = offerAllowed(legality);
  if (!allowed || legality === "same") {
    return { legality, allowed, fee: 0, payer: null, feeBracket: null };
  }
  const feeBracket = Math.min(offered, target);
  const fee = bridgingFee(feeBracket) ?? 0;
  return {
    legality,
    allowed,
    fee,
    payer: legality === "bridgeUp" ? "proposer" : "receiver",
    feeBracket,
  };
}

/* ─────────────────────────── the completion reward ───────────────────── */

/** Leaves per bracket of the item the user GAVE. */
export const TRADE_REWARD_PER_BRACKET = 2;

/**
 * What one party earns when a trade completes: 2 × the bracket of the item
 * THEY handed over.
 *
 * NEVER SHOWN AS A PROMISE BEFORE A TRADE COMPLETES. The server applies
 * anti-farming gates this client does not model — a repeat partner inside a
 * week, the same item inside a month, a daily cap — and any of them can zero
 * it. The completion response carries the number that was actually issued,
 * and that is the only one this app displays.
 */
export function tradeReward(givenBracket: Bracket): number {
  const b = Math.min(Math.max(1, Math.trunc(givenBracket)), BRACKET_COUNT);
  return TRADE_REWARD_PER_BRACKET * b;
}

/* ───────────────────────── setting your own value ────────────────────── */

/** How many brackets above the SUGGESTION's bracket an owner may go unreviewed. */
export const VALUE_RAISE_BRACKETS = 1;

export type ValueDecision =
  /** No number given, or the suggestion typed back in. Not user-set. */
  | "suggested"
  /** Below the suggestion. Always allowed, however far below. */
  | "lowered"
  /** Above it, but no more than VALUE_RAISE_BRACKETS above its bracket. */
  | "raisedWithinCap"
  /** Above that. Saved as asked, but the listing waits in review. */
  | "needsReview";

/**
 * The ceiling an owner may raise a suggestion to without review, as a bracket
 * and as a value. `maxValueWithoutReview` is null when that bracket is the
 * open-ended top one.
 */
export function valueCap(suggestedLeaves: number): {
  suggestedBracket: Bracket;
  maxBracketWithoutReview: Bracket;
  maxValueWithoutReview: number | null;
} {
  const suggestedBracket = bracketOf(suggestedLeaves);
  const maxBracketWithoutReview = Math.min(
    BRACKET_COUNT,
    suggestedBracket + VALUE_RAISE_BRACKETS,
  );
  return {
    suggestedBracket,
    maxBracketWithoutReview,
    maxValueWithoutReview: bracketRange(maxBracketWithoutReview).max,
  };
}

/**
 * Which of the four cases a typed value falls in. Pure, so the post wizard and
 * the server's `decideItemValue()` draw the line in the same place — and so
 * the wizard can tell somebody they are heading for review BEFORE they submit
 * rather than after.
 */
export function classifyValue(
  requested: number | null | undefined,
  suggestedLeaves: number,
): ValueDecision {
  if (requested == null || requested <= 0 || requested === suggestedLeaves) return "suggested";
  if (requested < suggestedLeaves) return "lowered";
  const { maxBracketWithoutReview } = valueCap(suggestedLeaves);
  return bracketOf(requested) <= maxBracketWithoutReview ? "raisedWithinCap" : "needsReview";
}
