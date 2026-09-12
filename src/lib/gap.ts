/**
 * The arithmetic behind the offer flow and the out-of-reach grid.
 *
 * PURE, AND DELIBERATELY SO. Nothing here touches React, the network or a
 * token — it takes numbers and returns a decision, which is what makes the five
 * gap situations checkable by reading them rather than by driving the app into
 * each one. Every component downstream renders `classifyGap()`'s answer; none
 * of them re-derives a threshold.
 *
 * ── THESE ARE NOT THE ENFORCEMENT ───────────────────────────────────────────
 *
 * The server re-derives every one of these rules from the database on every
 * request — `enforceInitiateTrade()`, `loadStanding()`, `availableLeaves()` —
 * and answers 403 or 400 regardless of what this file concluded. What this file
 * buys is that a person finds out BEFORE they fill in a proposal, which is the
 * whole of the difference between a gate and a rejection. Where the two can
 * disagree it is said so at the call site.
 */

import { BRACKET_COUNT, bracketOf, type Bracket } from "./brackets";
import type { TrustTier } from "./trust";

/* ───────────────────────── §7.1 the reach, in brackets ──────────────── */

/**
 * `reach = bracketOf(highest AVAILABLE item) + 1`, floored at bracket 2.
 *
 * ── WHY A BRACKET AND NOT `max(highest × 1.5, 150)` ─────────────────────────
 *
 * The threshold used to be a Leaves figure. Once other people's listings are
 * shown as brackets (see `src/lib/brackets.ts`), a Leaves threshold contradicts
 * the sentence beside it: a 700-Leaf listing greyed against a 638 reach sits in
 * the SAME bracket as the reach, so the tile says "further off" while the copy
 * says "Bracket 4, same as yours". That is the §7 disagreement between the grid
 * and the insert in a new form, and the fix is the same — one test, in one
 * unit, that both halves read.
 *
 * "One bracket above your best item" is also a rule a person can hold. The 1.5×
 * multiplier was a number; this is a sentence. Checked against the old rule it
 * is never NARROWER below 9,000: at the top of a bracket the two agree, and at
 * the bottom (a best item at 101, 251 or 600) this one reaches one bracket
 * further, because 1.5× of a bottom-of-bracket value does not clear the next
 * ceiling. Above 9,000 the old rule reached bracket 10 and this one stops at 9.
 *
 * THE FLOOR IS BRACKET 2 (up to 250). The old floor was 150 Leaves, which is in
 * bracket 2, so a new account looks at the same marketplace it did before: a
 * user with one 40-Leaf item would otherwise reach only bracket 2 anyway, and a
 * user with nothing posted needs a reach or the whole grid goes grey.
 *
 * AVAILABLE MEANS POSTED, NOT PROMISED TO ANOTHER TRADE (§7.1). See the note in
 * `src/api/offer.ts` on what the endpoints can and cannot tell us about the
 * second half of that sentence.
 */
export const REACH_BRACKETS_ABOVE_BEST = 1;
export const REACH_FLOOR_BRACKET: Bracket = 2;

export function reachBracket(highestAvailableItemValue: number): Bracket {
  const fromBest =
    highestAvailableItemValue > 0
      ? bracketOf(highestAvailableItemValue) + REACH_BRACKETS_ABOVE_BEST
      : REACH_FLOOR_BRACKET;
  return Math.min(BRACKET_COUNT, Math.max(REACH_FLOOR_BRACKET, fromBest));
}

/**
 * §7.1. Strictly greater — a listing IN the reach bracket is in reach, and the
 * tile stays in colour.
 *
 * An unvalued listing (`valueLeaves === null`) is never out of reach. There is
 * no bracket to compare, and greying a tile whose value nobody knows would be a
 * claim the data does not support.
 */
export function isOutOfReach(listingValue: number | null, reach: Bracket): boolean {
  return listingValue !== null && bracketOf(listingValue) > reach;
}

/** How many brackets past the reach a listing sits. 0 when it is in reach. */
export function bracketsBeyondReach(listingValue: number, reach: Bracket): number {
  return Math.max(0, bracketOf(listingValue) - reach);
}

/* ───────────────────────── §5.1 the five situations ─────────────────── */

export type GapSituation = "even" | "over" | "small" | "large" | "veryLarge";

export interface GapInput {
  /** The total value you are putting up: your item, before any settlement. */
  yours: number;
  /** The listing's value. */
  theirs: number;
  /** Leaves you can actually commit right now. See `availableLeaves` in offer.ts. */
  balance: number;
  /**
   * The most you may promise, after every server rule has been applied — ID
   * verification, tier eligibility, the three-completed-trades floor, the
   * one-open-contract rule and the remaining debt headroom. Zero when any of
   * them refuses, which is what collapses "large gap" into "very large gap" for
   * a New Trader without the screen needing to know why.
   */
  promiseCeiling: number;
}

export interface GapResult {
  situation: GapSituation;
  /** theirs − yours, floored at 0. The number every string in §10.2 names. */
  short: number;
  /** yours − theirs when you are offering more, else 0. */
  over: number;
  /** |yours − theirs|, which the Even case reports as "40 apart". */
  apart: number;
  /** What the settlement rows may draw on. */
  balance: number;
  promiseCeiling: number;
  /** balance + promiseCeiling — the line between a large and a very large gap. */
  covered: number;
}

/** §5.1's Even band, and the same 10% that defines "offering more". */
export const EVEN_BAND = 0.1;
/** §5.1's small-gap ceiling: the shortfall may not exceed a quarter of theirs. */
export const SMALL_GAP_SHARE = 0.25;

/**
 * The five situations, in the order §5.1 lists them.
 *
 * ORDER IS LOAD-BEARING. `even` is tested before `over` because a value 5%
 * above theirs is Even and not "offering more"; `small` is tested before
 * `large` because a shortfall that fits both definitions is the smaller
 * treatment. Rewriting this as a threshold scan would silently move cases.
 *
 * A ZERO-VALUE LISTING falls out as Even: `theirs === 0` makes the band zero
 * wide, `short` zero and `over` whatever you offered — but `apart` is then the
 * whole of your item's value, which is honest. Nothing here divides by
 * `theirs`, so an unvalued listing handled upstream never reaches a NaN.
 */
export function classifyGap({ yours, theirs, balance, promiseCeiling }: GapInput): GapResult {
  const short = Math.max(0, theirs - yours);
  const over = Math.max(0, yours - theirs);
  const apart = Math.abs(theirs - yours);
  const covered = balance + promiseCeiling;

  const base = { short, over, apart, balance, promiseCeiling, covered };

  if (apart <= theirs * EVEN_BAND) return { ...base, situation: "even" };
  if (over > 0) return { ...base, situation: "over" };
  if (short <= balance && short <= theirs * SMALL_GAP_SHARE) {
    return { ...base, situation: "small" };
  }
  if (short <= covered) return { ...base, situation: "large" };
  return { ...base, situation: "veryLarge" };
}

/* ──────────────────── the settlement routes, per situation ──────────── */

/**
 * Which settlement row is which.
 *
 * A closed union rather than an index, because §5.1 preselects a DIFFERENT row
 * in the small and large cases ("Leaves preselected" / "split preselected") and
 * a numeric default would silently follow a reordering of the rows.
 */
export type SettlementChoice =
  /** Add the whole shortfall from your balance. */
  | "leaves"
  /** Add what you can now, promise the rest. §10.2's "Add 80 now, promise 100". */
  | "split"
  /** Promise the whole shortfall. Nothing leaves your balance now. */
  | "promise"
  /** Send short and let them decide. Always available — §5.1's closing line. */
  | "asIs"
  /** Offering more: ask them to add the difference in Leaves. */
  | "askLeaves";

/** §5.1 — what is preselected when the screen first draws. */
export function defaultChoice(situation: GapSituation): SettlementChoice {
  switch (situation) {
    case "small":
      return "leaves";
    case "large":
      return "split";
    case "over":
      return "askLeaves";
    default:
      // Even has no settlement section; very large has routes, not choices.
      return "asIs";
  }
}

/**
 * How a chosen route splits the shortfall.
 *
 * `nowLeaves` is what POST /api/offers can actually carry today; `promised` is
 * the half that has no home on the wire yet. Both are returned so the summary
 * line and the button label can state the whole arrangement even where only one
 * half is transmitted — see the note on `composeOffer` in `src/api/offer.ts`.
 */
export function splitFor(
  choice: SettlementChoice,
  gap: GapResult,
): { nowLeaves: number; promised: number } {
  switch (choice) {
    case "leaves":
      return { nowLeaves: Math.min(gap.short, gap.balance), promised: 0 };
    case "promise":
      return { nowLeaves: 0, promised: Math.min(gap.short, gap.promiseCeiling) };
    case "split": {
      // Promise as much as the ceiling allows and cover the remainder now, so
      // the balance is drawn on last. That is §10.2's own arrangement — "Add 80
      // now, promise 100" on a 180 gap with a 100 ceiling — and it is the one
      // that leaves the user holding the most Leaves.
      const promised = Math.min(gap.short, gap.promiseCeiling);
      return { nowLeaves: Math.min(gap.short - promised, gap.balance), promised };
    }
    case "asIs":
    case "askLeaves":
      return { nowLeaves: 0, promised: 0 };
  }
}

/* ───────────────────── the server's gates, as data ──────────────────── */

/**
 * Everything the server will check before it lets a DPA be proposed, resolved
 * into one answer plus the reason.
 *
 * ── WHY THE REASON IS CARRIED AND NOT JUST THE BOOLEAN ──────────────────────
 *
 * §5.2 draws a DIFFERENT screen for each refusal: "not ID-verified" greys one
 * row and offers a verify button, "tier too low" replaces the whole proposal
 * with the ceiling table. A boolean would collapse those into one, and the
 * screen would have to re-derive the reason from the same four fields to tell
 * them apart.
 *
 * `openContract` and `minTrades` have no drawn state in the spec — it does not
 * contemplate them — so they fall through to the ceiling-table screen with the
 * ceiling reported as 0. That is the honest rendering: the promise routes are
 * genuinely unavailable, and the table shows what would change it.
 */
export type PromiseBlock =
  | "none"
  | "idUnverified"
  | "tierMayNotPropose"
  | "minTrades"
  | "openContract"
  | "noHeadroom"
  | "unsettledDefault";

export interface StandingInput {
  idVerified: boolean;
  tier: TrustTier;
  mayProposeDpa: boolean;
  completedTrades: number;
  openContracts: number;
  /** maxOutstandingDebtLeaves − committedDebt, floored at 0, from the server. */
  remainingDebtHeadroom: number;
  hasUnsettledDefault: boolean;
}

/** Mirrors the server's `DPA.minCompletedTradesToOwe`. Keep the two in step. */
export const MIN_COMPLETED_TRADES_TO_OWE = 3;
/** Mirrors the server's `DPA.maxConcurrentAsDebtor`. */
export const MAX_CONCURRENT_AS_DEBTOR = 1;

/**
 * The gates in the order POST /api/v1/contracts applies them, so the reason
 * this screen shows is the reason that route would have given.
 *
 * `unsettledDefault` is checked first even though the contracts route checks it
 * later, because it blocks the OFFER as well — `enforceCanInitiateTrade()` runs
 * on POST /api/offers — and a screen that offered promise routes to someone who
 * cannot send an offer at all would be answering the wrong question.
 */
export function promiseBlock(s: StandingInput): PromiseBlock {
  if (s.hasUnsettledDefault) return "unsettledDefault";
  if (!s.idVerified) return "idUnverified";
  if (s.completedTrades < MIN_COMPLETED_TRADES_TO_OWE) return "minTrades";
  if (!s.mayProposeDpa) return "tierMayNotPropose";
  if (s.openContracts >= MAX_CONCURRENT_AS_DEBTOR) return "openContract";
  if (s.remainingDebtHeadroom <= 0) return "noHeadroom";
  return "none";
}

/**
 * What may actually be promised right now: the headroom, or nothing.
 *
 * This is the number `classifyGap()` takes as `promiseCeiling`, and it is why a
 * New Trader sees "very large gap" on a 180-Leaf shortfall while a Trusted
 * Trader sees "large gap" on the same one. The situation is not a property of
 * the listing.
 */
export function effectivePromiseCeiling(s: StandingInput): number {
  return promiseBlock(s) === "none" ? Math.max(0, s.remainingDebtHeadroom) : 0;
}

/* ─────────────────────── §1.8 deadlines and dates ───────────────────── */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * `22 Sep`. Hand-formatted, NOT `toLocaleDateString()` — the same argument
 * `src/lib/format.ts` makes at length: the artboards are not locale-flexible,
 * and a phone set to en-US would render this as "Sep 22".
 */
export function shortDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * `Sat 13 Sep, 14:00` — an arranged meeting time, in the device's own timezone.
 *
 * ── THE WEEKDAY IS NOT DECORATION ───────────────────────────────────────────
 *
 * "13 Sep, 14:00" makes somebody count forwards from today to work out whether
 * they can be there; "Sat 13 Sep" is the way people actually hold an arrangement
 * in their heads, and it is the half most likely to catch a mistake — agreeing
 * to a Tuesday you thought was a Saturday is the error this format exists to
 * make visible before the tap rather than on the day.
 *
 * TODAY AND TOMORROW ARE NAMED. Inside two days the date is noise and the
 * relation is the whole content.
 *
 * 24-HOUR, HAND-FORMATTED, like everything else in here — same argument
 * `shortDate` and `clockTime` make: the artboards are not locale-flexible.
 */
export function meetupWhen(at: Date, now: Date = new Date()): string {
  const time = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  const days = daysUntil(at, now);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  return `${WEEKDAYS[at.getDay()]} ${at.getDate()} ${MONTHS[at.getMonth()]}, ${time}`;
}

/**
 * Whole days from now to a deadline, counted in LOCAL CALENDAR DAYS.
 *
 * Not `(deadline − now) / 86400000`. A deadline at 09:00 tomorrow is one day
 * away at 23:00 tonight and zero days away by that division, which would paint
 * it `due today` in terracotta while it is still tomorrow. Both instants are
 * flattened to local midnight first, so "days" means what a person reading a
 * calendar means.
 */
export function daysUntil(deadline: Date, now: Date = new Date()): number {
  const a = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/** §1.8's strings, exactly. `due 22 Sep · 16 days` / `due today` / `overdue by 3 days`. */
export function deadlineLabel(deadline: Date, now: Date = new Date()): string {
  const days = daysUntil(deadline, now);
  if (days < 0) return `overdue by ${-days} ${-days === 1 ? "day" : "days"}`;
  if (days === 0) return "due today";
  return `due ${shortDate(deadline)} · ${days} ${days === 1 ? "day" : "days"}`;
}

/* ──────────────────────────── number strings ────────────────────────── */

/**
 * `1900` → `"1,900"`.
 *
 * §10's own rule is that numbers are bare — no leaf glyph, no unit on every
 * figure — and §10.2 writes `1,900` and `1,590` with the comma. This is
 * `groupThousands` from `src/lib/format.ts`, which is not exported from there;
 * `formatLeaves()` IS exported but compacts above 99,999 into "120.0k", and a
 * gap figure must never be compacted. So the grouping is done here.
 */
export function grouped(n: number): string {
  const s = Math.trunc(Math.abs(n)).toString();
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ",";
    out += s[i];
  }
  return n < 0 ? `-${out}` : out;
}

/* ─────────────── the tier ladder, for the ceiling table (§10.5) ─────── */

/**
 * The debt ceiling at each tier, and the completed trades that reach it.
 *
 * A HAND-KEPT MIRROR of the server's `TIER_LIMITS` and `TIER_THRESHOLDS` in
 * `src/lib/reputation-config.ts`, and the honest word for it — the same
 * arrangement `src/lib/trust.ts` uses for the thresholds and `CONDITIONS` in
 * `browse.ts` uses for the condition ladder. It goes stale silently if the
 * server's table is tuned.
 *
 * ── WHY IT HAS TO BE MIRRORED AT ALL ────────────────────────────────────────
 *
 * /api/v1/profile/me sends `limits.maxOutstandingDebtLeaves` for the VIEWER'S
 * OWN tier and nothing about the other three. §10.5's ceiling table is a
 * four-row ladder — it exists to show somebody what the rung above them is
 * worth — so three of its four numbers are not on the wire. Serving the whole
 * table would be an endpoint change, and is out of scope.
 *
 * ── THE VIEWER'S OWN ROW IS TAKEN FROM THE SERVER, NOT FROM HERE ────────────
 *
 * `ceilingTable()` overwrites the viewer's row with the number the server
 * actually sent, so the one row that governs what happens next is never this
 * file's guess. A drift then shows as the viewer's row disagreeing with its
 * neighbours, which is visible, rather than as a silently wrong promise.
 *
 * ── THESE ARE NOT THE SPEC'S NUMBERS, AND THAT IS DELIBERATE ────────────────
 *
 * §10.5 writes the ladder as 200 / 900 / 2,500 / no limit. The server's is
 * 0 / 300 / 1,000 / 3,000, with `mayProposeDpa: false` at the bottom rung, and
 * the server's win: the spec's figures would promise ceilings POST
 * /api/v1/contracts refuses. Two differences are load-bearing rather than
 * cosmetic — a New Trader cannot promise AT ALL, and the top tier is capped
 * rather than unlimited, because an unbounded promise on a platform with no
 * repossession is an unbounded loss. See `tierTooLow` in the copy module.
 *
 * ── THE SERVER DERIVES THESE; THIS FILE DOES NOT ────────────────────────────
 *
 * `maxOutstandingDebtLeaves` is computed there as one third of the tier's
 * `maxItemValueLeaves`, so raising what a tier may acquire raises what it may
 * promise and the two cannot drift. That relationship is NOT reproduced here —
 * mirroring a formula invites this copy to be "fixed" independently. What is
 * mirrored is the answer, and `ceilingTable()` overwrites the viewer's own row
 * with the number the server actually sent.
 */
export const TIER_LADDER: readonly {
  tier: TrustTier;
  /** Completed trades to reach this rung. 0 for the floor tier. */
  minTrades: number;
  /** `maxOutstandingDebtLeaves`. `null` is unlimited — §10.5's `no limit`. */
  ceiling: number | null;
}[] = [
  { tier: "New Trader", minTrades: 0, ceiling: 0 },
  { tier: "Rising Trader", minTrades: 3, ceiling: 300 },
  { tier: "Trusted Trader", minTrades: 10, ceiling: 1000 },
  // NOT `null`. The server caps the top tier explicitly at 3,000 even though its
  // item value is unlimited, so §10.5's `no limit` is never rendered — the
  // `ceiling === null` branch in the table survives only because a future tier
  // could be uncapped and a silently-wrong number is worse than a dead branch.
  { tier: "Top Trader", minTrades: 25, ceiling: 3000 },
];

export interface CeilingRow {
  tier: TrustTier;
  minTrades: number;
  ceiling: number | null;
  /** The one row that gets `you are here` in `#1B4D2B` mono. */
  here: boolean;
}

/**
 * §10.5's four rows, with the viewer's own ceiling taken from the server.
 *
 * `serverCeiling` is `reputation.limits.maxOutstandingDebtLeaves`. It replaces
 * the mirrored value on the viewer's row only — the rows above keep the
 * mirror's, and are hedged nowhere, because a ladder with one honest rung and
 * three qualified ones is unreadable. The drift risk is stated on
 * `TIER_LADDER` instead, where a maintainer will see it.
 */
export function ceilingTable(tier: TrustTier, serverCeiling: number): CeilingRow[] {
  return TIER_LADDER.map((row) => ({
    ...row,
    ceiling: row.tier === tier ? serverCeiling : row.ceiling,
    here: row.tier === tier,
  }));
}

/** The rung above this one, or null at the top. §10.2 and §10.5 both name it. */
export function nextRung(
  tier: TrustTier,
): { tier: TrustTier; minTrades: number; ceiling: number | null } | null {
  const i = TIER_LADDER.findIndex((r) => r.tier === tier);
  return i >= 0 && i < TIER_LADDER.length - 1 ? TIER_LADDER[i + 1] : null;
}

/**
 * §10.5's short tier name. `Rising Trader` → `Rising`.
 *
 * The ceiling table reads `New Trader` / `Rising` / `Trusted` / `Top Trader` —
 * the middle two lose the noun and the outer two keep it, which is not an
 * inconsistency: "New" and "Top" are not names on their own.
 */
export function shortTier(tier: TrustTier): string {
  return tier === "Rising Trader" || tier === "Trusted Trader"
    ? tier.replace(" Trader", "")
    : tier;
}

/* ────────────────── the term the server will accept (§10.3) ─────────── */

/**
 * `DPA.minTermDays` and `DPA.maxTermDays`, mirrored from the server's
 * `src/lib/reputation-config.ts`. Same hand-kept arrangement as `TIER_LADDER`.
 *
 * ── THE SPEC'S THIRD PRESET IS OUTSIDE THIS RANGE ───────────────────────────
 *
 * §10.3 offers `2 weeks` · `1 month` · `2 months`. Thirty days is the server's
 * ceiling, so the first two are legal (14 and 30) and the third is not — POST
 * /api/v1/contracts answers "The deadline must be between 1 and 30 days from
 * now." for a 60-day term. A preset that is always refused is exactly the
 * discover-it-by-403 shape §5.2 exists to remove, so only the legal presets are
 * drawn. See the note on `DatePresets`.
 */
export const DPA_TERM = { minDays: 1, maxDays: 30 } as const;

/** The presets §10.3 names, with the days each means, filtered to what is legal. */
export const TERM_PRESETS: readonly { days: number; label: string; labelTight: string }[] = [
  { days: 14, label: "2 weeks", labelTight: "2 wks" },
  { days: 30, label: "1 month", labelTight: "1 mo" },
  // `2 months` (60 days) is omitted: it exceeds DPA_TERM.maxDays and would be
  // refused every time. §9's tight label for it, `2 mos`, is omitted with it.
];

/** Local midnight `days` from today. A deadline is a day, not an instant. */
export function deadlineFromDays(days: number, now: Date = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  // 23:59:59 local, so a deadline "of the 22nd" includes the whole of the 22nd.
  // The server compares against `new Date()` and stores an instant, so the end
  // of the day is what makes the displayed date and the stored one agree.
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Every date the server would accept, for §8.3's date sheet. */
export function legalDeadlines(now: Date = new Date()): Date[] {
  const out: Date[] = [];
  for (let d = DPA_TERM.minDays; d <= DPA_TERM.maxDays; d++) out.push(deadlineFromDays(d, now));
  return out;
}
