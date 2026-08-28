/**
 * The trust tier — "safe to trade with", derived from trade history.
 *
 * NOT the Leaf rank. Those are two different ladders answering two different
 * questions and the card had been showing the wrong one:
 *
 *   owner.rank   Seedling / Sprout / Grower / Guardian, from lifetimeLeaves.
 *                How much someone has EARNED on the platform. A prolific poster
 *                who has never completed a trade can be a Guardian.
 *   trust tier   New / Rising / Trusted / Top Trader, from completed trades and
 *                rating. Whether their counterparties came away satisfied.
 *
 * THE SERVER RESOLVES THIS NOW. /api/v1/home sends `owner.trustTier`, computed
 * with getEffectiveTier() — the same function the contract gates enforce with,
 * so the badge and the gate cannot contradict each other. `resolveTier()` below
 * is what every screen should call; prefer the server's answer always.
 *
 * WHAT IS LEFT HERE IS A FALLBACK, for the endpoints that send null because
 * resolving the tier costs three aggregates they do not otherwise need
 * (/browse, /items/[id], both profile routes). It is `getTrustTier()` out of
 * the web's `src/lib/reputation.ts` with the thresholds out of
 * `reputation-config.ts`, copied EXACTLY — including the part that looks like a
 * bug — so that if the two ever drift it shows up as a diff rather than as a
 * subtly different ladder.
 *
 * THE FALLBACK IS KNOWN TO BE OPTIMISTIC and must not be used where the answer
 * gates anything. It works from `owner.totalTrades`, a denormalised counter
 * that sits above the real completed count on live rows, and it cannot see DPA
 * defaults at all — neither `lifetimeDefaults` nor `hasUnsettledDefault` is on
 * the wire. So it can read a rung or two high for exactly the people it matters
 * most for. That is the whole reason the server started sending the real one.
 */

export type TrustTier = "New Trader" | "Rising Trader" | "Trusted Trader" | "Top Trader";

/** Worst to best. Order is load-bearing — `TIER_TREATMENTS` indexes by it. */
export const TIER_ORDER: readonly TrustTier[] = [
  "New Trader",
  "Rising Trader",
  "Trusted Trader",
  "Top Trader",
] as const;

/** Mirror of the server's TIER_THRESHOLDS. Keep in step by hand. */
const T = {
  risingMinTrades: 3,
  trustedMinTrades: 10,
  topMinTrades: 25,
  trustedMinRating: 4.0,
  topMinRating: 4.5,
} as const;

/**
 * The base tier — what someone's trade history alone says about them.
 *
 * THE LADDER IS NOT MONOTONE IN RATING and that is deliberate on the server:
 * 25 trades at 3.5 reads Trusted while 15 trades at 3.5 reads Rising. The
 * branch structure is kept verbatim rather than tidied into a threshold scan,
 * because a tidier scan would quietly move people between rungs.
 *
 * `rating === 0` means UNRATED, not badly rated, and never blocks a promotion.
 */
export function getTrustTier(totalTrades: number, rating: number): TrustTier {
  if (totalTrades < T.risingMinTrades) return "New Trader";
  if (totalTrades < T.trustedMinTrades) return "Rising Trader";
  if (totalTrades < T.topMinTrades) {
    if (rating > 0 && rating < T.trustedMinRating) return "Rising Trader";
    return "Trusted Trader";
  }
  if (rating > 0 && rating < T.topMinRating) return "Trusted Trader";
  return "Top Trader";
}

/**
 * What the badge says. Short, because it sits beside a name that has to yield
 * to it — "TOP TRADER" is already the longest thing that row can carry, and
 * "TRUSTED TRADER" beside a two-word handle leaves nothing of the handle.
 * The full tier name goes to the screen reader instead. See `TierBadge`.
 */
export const TIER_LABEL: Record<TrustTier, string> = {
  "New Trader": "NEW",
  "Rising Trader": "RISING",
  "Trusted Trader": "TRUSTED",
  "Top Trader": "TOP TRADER",
};

/**
 * The one call a screen should make: the server's tier when it sent one, the
 * local approximation when it did not.
 *
 * Written as a function taking the whole owner rather than as `?? getTrustTier(...)`
 * at each call site, so that the day the remaining routes start sending a tier
 * the fallback is deleted in one place and nothing else changes.
 */
export function resolveTier(owner: {
  trustTier: TrustTier | null;
  totalTrades: number;
  rating: number;
}): TrustTier {
  return owner.trustTier ?? getTrustTier(owner.totalTrades, owner.rating);
}
