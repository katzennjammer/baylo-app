/**
 * Value brackets: the coarse, PRESENTATION-ONLY tiering of `valueLeaves`.
 *
 * ── WHY A BRACKET AND NOT THE NUMBER ────────────────────────────────────────
 *
 * An exact figure on somebody else's listing invites loss aversion: "425
 * Leaves against your 150" reads as a bad deal, "Bracket 3, one above yours"
 * reads as a fair one-tier gap. Same trade, different emotional read. So the
 * DISCOVERY surfaces — feed cards, grid tiles, item detail, the out-of-reach
 * line, share text, accessibility labels — show the bracket of another
 * person's listing. The exact number stays wherever a person is looking at
 * their OWN worth (their listings, the post wizard) or COMMITTING to a figure
 * (the offer composer, a DPA, the header balance). Brackets are discovery
 * framing, not agreement framing: "one bracket" is not a debt.
 *
 * ── THE LIMITS COME FROM THE SERVER (since 28 Nov 2026) ────────────────────
 *
 * The server works the limits out from Baylo's own listing values and can
 * change them (a monthly recalculation). This module keeps the ACTIVE table in
 * memory so every caller stays synchronous:
 *   - it starts as DEFAULT_BRACKET_CEILINGS, the hand-set table, and is
 *     replaced at boot by the copy the last launch saved
 *     (../api/brackets: readCachedBrackets), before any listing renders;
 *   - while signed in, ../api/brackets fetches GET /api/v1/brackets and, when
 *     the table changed, installs it, saves it and refreshes the screens.
 * The server enforces the premium gate and the fees from ITS table, so a stale
 * copy here can only show a padlock or a bracket on the wrong tile for a
 * moment, never let through an offer the server should refuse. The NUMBER of
 * brackets (10) never changes.
 *
 * ── NOT A PEG ───────────────────────────────────────────────────────────────
 *
 * The table is in Leaves. `valueLeaves` is unpegged and stays that way, which
 * is what keeps the non-monetary claim true. No pesos anywhere in this file.
 */

/** The hand-set table used until 28 Nov 2026: the starting point and the fallback. */
export const DEFAULT_BRACKET_CEILINGS: readonly number[] = Object.freeze([
  100, // 1
  250, // 2
  500, // 3
  900, // 4
  1500, // 5
  2500, // 6
  4000, // 7
  9000, // 8
  12000, // 9
  // 10: everything above
]);

/** Always 10: nine ceilings, and the last bracket is open-ended. */
export const BRACKET_COUNT = DEFAULT_BRACKET_CEILINGS.length + 1;

let active: readonly number[] = DEFAULT_BRACKET_CEILINGS;

/** True when `c` is a usable table: BRACKET_COUNT - 1 strictly increasing positive integers. */
export function validCeilings(c: unknown): c is number[] {
  return (
    Array.isArray(c) &&
    c.length === BRACKET_COUNT - 1 &&
    c.every((x, i) => Number.isInteger(x) && x > 0 && (i === 0 || x > (c[i - 1] as number)))
  );
}

/** Upper bound of each bracket, inclusive, in Leaves: the server's ACTIVE table. */
export function bracketCeilings(): readonly number[] {
  return active;
}

/**
 * Installs a new table. Returns true only when it was valid AND different, so
 * the caller knows whether screens need refreshing.
 */
export function setBracketCeilings(c: readonly number[]): boolean {
  if (!validCeilings([...c])) return false;
  if (c.length === active.length && c.every((x, i) => x === active[i])) return false;
  active = Object.freeze([...c]);
  return true;
}

/** 1..BRACKET_COUNT. */
export type Bracket = number;

/** `bracketOf(425)` → 3. Non-positive values land in bracket 1. */
export function bracketOf(valueLeaves: number): Bracket {
  const i = active.findIndex((ceiling) => valueLeaves <= ceiling);
  return i === -1 ? BRACKET_COUNT : i + 1;
}

/** Inclusive Leaves range of a bracket; `max` is null for the open top. */
export function bracketRange(bracket: Bracket): { min: number; max: number | null } {
  const b = Math.min(Math.max(1, Math.trunc(bracket)), BRACKET_COUNT);
  const min = b === 1 ? 1 : active[b - 2] + 1;
  const max = b === BRACKET_COUNT ? null : active[b - 1];
  return { min, max };
}

/** `Bracket 3`. The one spelling every surface uses. */
export function bracketLabel(bracket: Bracket): string {
  return `Bracket ${bracket}`;
}

/**
 * `1 bracket` / `3 brackets`. The distance word, so "2 above your reach" is
 * never left ambiguous about what unit "2" is in.
 */
export function bracketsWord(n: number): string {
  return `${n} ${n === 1 ? "bracket" : "brackets"}`;
}

/**
 * The first bracket that needs a premium subscription to PROPOSE on. Mirrors
 * the server's PREMIUM_MIN_BRACKET; the server's is the one enforced.
 *
 * Listings in these brackets are visible to everyone and open like any other.
 * Only the offer control changes — see `PremiumLockedBar` on item detail.
 */
export const PREMIUM_MIN_BRACKET: Bracket = 7;

export function bracketNeedsPremium(bracket: Bracket): boolean {
  return bracket >= PREMIUM_MIN_BRACKET;
}

/** False for an unvalued listing: it has no bracket to be in. */
export function valueNeedsPremium(valueLeaves: number | null): boolean {
  return valueLeaves !== null && bracketNeedsPremium(bracketOf(valueLeaves));
}

/**
 * LEGACY: the server dropped its VIP-only bracket on 22 Oct 2026 (Premium now
 * opens every bracket from PREMIUM_MIN_BRACKET up) and no longer sends
 * `offerLock: "vip"` or VIP_REQUIRED. Kept only for the copy that answers an
 * older server that still does.
 */
export const VIP_MIN_BRACKET: Bracket = 9;
