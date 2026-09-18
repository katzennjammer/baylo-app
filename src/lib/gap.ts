/**
 * The reach arithmetic behind the out-of-reach grid, and the date and number
 * helpers the trade screens share.
 *
 * PURE, AND DELIBERATELY SO. Nothing here touches React, the network or a
 * token — it takes numbers and returns a decision, which is what makes the
 * rules checkable by reading them rather than by driving the app into each
 * state.
 *
 * ── WHAT LEFT THIS FILE ON 17 SEP 2026 ──────────────────────────────────────
 *
 * The five gap situations, the settlement routes, the DPA gates, the tier
 * ladder and the deadline presets. Trading is bracket-based now: an offer is
 * the same bracket, one below or one above, and the difference is a flat fee
 * from `src/lib/trade-rules.ts` rather than a shortfall in Leaves to be added,
 * split or promised. There is no gap to classify and no promise to gate, so
 * the arithmetic for both is gone rather than left as a dead branch that the
 * next reader has to prove is dead.
 *
 * What stayed is what is still true: the REACH (one bracket above your best
 * item, which under the new rule is exactly the highest listing your best
 * item may be offered on), and the formatting helpers.
 *
 * ── THESE ARE NOT THE ENFORCEMENT ───────────────────────────────────────────
 *
 * The server re-derives every rule from the database on every request and
 * answers 403 or 400 regardless of what this file concluded. What this file
 * buys is that a person finds out BEFORE they open a composer, which is the
 * whole of the difference between a gate and a rejection.
 */

import { BRACKET_COUNT, bracketOf, type Bracket } from "./brackets";
import { offerAllowed, offerLegality } from "./trade-rules";

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

/* ──────────────── what a shelf can be offered on, in brackets ────────── */

/**
 * Whether ANY valued item on a shelf may be offered on a listing in
 * `listingBracket` — the item-detail screen's test for showing the offer
 * button versus the "outside your reach" notice.
 *
 * Both directions, because the rule has both: a shelf whose lowest item is
 * bracket 6 cannot offer on a bracket-2 listing any more than a bracket-1
 * shelf can offer on a bracket-5 one. `reachBracket()` above only knows the
 * upper edge; this is the whole test, and it is what the composer's picker
 * will grey against row by row.
 */
export function shelfCanOffer(shelfValues: readonly (number | null)[], listingBracket: Bracket): boolean {
  return shelfValues.some(
    (v) => v !== null && offerAllowed(offerLegality(bracketOf(v), listingBracket)),
  );
}

/**
 * Which way the shelf misses, for the notice's one sentence. `above` means
 * the listing is above everything on the shelf; `below` means it is below
 * everything; `null` means something on the shelf qualifies (or the shelf
 * is empty, which the caller words separately).
 */
export function shelfMisses(
  shelfValues: readonly (number | null)[],
  listingBracket: Bracket,
): "above" | "below" | null {
  const brackets = shelfValues.filter((v): v is number => v !== null).map(bracketOf);
  if (brackets.length === 0) return null;
  if (shelfCanOffer(shelfValues, listingBracket)) return null;
  const highest = Math.max(...brackets);
  return listingBracket > highest ? "above" : "below";
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
