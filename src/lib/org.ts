import type { ItemOwner, OrgBadge } from "../api/types";
import { resolveTier, type TrustTier } from "./trust";

/**
 * Which badge an owner gets — and the bug this function exists to prevent.
 *
 * ── THE FALLBACK WOULD HAVE GIVEN ORGANISATIONS A TRUST TIER ────────────────
 *
 * The server sends `trustTier: null` for an organisation, deliberately: orgs do
 * not climb the trade-count ladder, and their badge is `verificationStatus`.
 * But `resolveTier()` treats null as "this endpoint did not resolve it" and
 * falls back to `getTrustTier(totalTrades, rating)` — which for an org happily
 * computes "Trusted Trader" out of the shop's trade count.
 *
 * So the server nulling the field is NOT enough on its own. Every screen that
 * draws a badge calls `resolveTier()`, and every one of them would have drawn
 * a trust rung on a business. This is the one place that reads `org` first, and
 * it is what every card and profile must call instead.
 *
 * ── ONE BADGE, AS A UNION ───────────────────────────────────────────────────
 *
 * A discriminated union rather than two nullable fields, so "which badge" is a
 * switch rather than a precedence rule each caller re-derives. The spec asks
 * for the verified-org badge to REPLACE the trust badge; a shape that can carry
 * both is one where a card eventually renders both.
 *
 * ── AN UNVERIFIED ORGANISATION GETS NO BADGE AT ALL ─────────────────────────
 *
 * Not a trust tier, and not a greyed-out checkmark. A PENDING org is a real
 * account that posts and trades and has simply not been reviewed yet, so the
 * honest rendering is the absence of a claim. Drawing a pale "unverified" chip
 * would be a negative badge on a business whose only offence is being new,
 * which is worse than the silence.
 */
export type OwnerBadge =
  | { kind: "org"; org: OrgBadge }
  | { kind: "tier"; tier: TrustTier }
  | { kind: "none" };

export function ownerBadge(
  owner: Pick<ItemOwner, "org" | "trustTier" | "totalTrades" | "rating">,
): OwnerBadge {
  if (owner.org) {
    return owner.org.verified ? { kind: "org", org: owner.org } : { kind: "none" };
  }
  return { kind: "tier", tier: resolveTier(owner) };
}

/** True when this owner is an organisation, verified or not. */
export function isOrgOwner(owner: Pick<ItemOwner, "org">): boolean {
  return owner.org != null;
}

/**
 * The label beside the checkmark.
 *
 * "Verified MSME" everywhere -- MSME being the Philippine DTI's own term,
 * Micro, Small and Medium Enterprises. Card and profile used to carry two
 * lengths ("Verified org" / "Verified organization"); the new term is short
 * enough for the card's sixty-odd points, so both keys now say the same thing.
 * The two keys are kept so a future longer profile wording is a one-line change
 * and cannot drift from the card's.
 */
export const ORG_BADGE_LABEL = { compact: "Verified MSME", full: "Verified MSME" } as const;
