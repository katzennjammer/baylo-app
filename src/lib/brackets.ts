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
 * ── A HAND-KEPT MIRROR OF THE SERVER'S TABLE ────────────────────────────────
 *
 * `baylo/src/lib/brackets.ts` is the source; this is the copy that lets a tile
 * bracket itself without a round trip, the same arrangement as `TIER_LADDER`
 * in gap.ts. The server enforces the premium gate from ITS table, so a drift
 * here would show as a padlock on the wrong tile, never as an offer sent that
 * the server should have refused.
 *
 * ── NOT A PEG ───────────────────────────────────────────────────────────────
 *
 * The table is in Leaves. `valueLeaves` is unpegged and stays that way, which
 * is what keeps the non-monetary claim true. No pesos anywhere in this file.
 */

/** Upper bound of each bracket, inclusive. The last bracket is open-ended. */
export const BRACKET_CEILINGS: readonly number[] = [
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
];

export const BRACKET_COUNT = BRACKET_CEILINGS.length + 1;

/** 1..BRACKET_COUNT. */
export type Bracket = number;

/** `bracketOf(425)` → 3. Non-positive values land in bracket 1. */
export function bracketOf(valueLeaves: number): Bracket {
  const i = BRACKET_CEILINGS.findIndex((ceiling) => valueLeaves <= ceiling);
  return i === -1 ? BRACKET_COUNT : i + 1;
}

/** Inclusive Leaves range of a bracket; `max` is null for the open top. */
export function bracketRange(bracket: Bracket): { min: number; max: number | null } {
  const b = Math.min(Math.max(1, Math.trunc(bracket)), BRACKET_COUNT);
  const min = b === 1 ? 1 : BRACKET_CEILINGS[b - 2] + 1;
  const max = b === BRACKET_COUNT ? null : BRACKET_CEILINGS[b - 1];
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
