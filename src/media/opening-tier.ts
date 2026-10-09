import { hasPremiumAccess } from "../lib/premium";
import type { ViewerReputation } from "../api/types";

/**
 * Which opening film a launch plays: the person's tier, as last seen.
 *
 * ── PRESENTATION ONLY, AND CACHED ON THE PHONE ───────────────────────────────
 *
 * Nothing on the server knows about this value and nothing it gates. It is the
 * phone's own reading of facts the server already serves -- `reputation` on
 * /api/v1/profile/me and the acting organisation in ../api/org-context --
 * cached so the NEXT cold start can pick its film before any request has been
 * made. A stale tier costs one launch with the wrong film, never an access
 * decision. See ./opening-tier-store for the cache.
 *
 * ── THE ORDER OF THE CHECKS IS THE RULE ──────────────────────────────────────
 *
 *   signed out     normal. A stale acting-org id left on a signed-out phone is
 *                  not a shop; sign-out clears it anyway.
 *   acting org     msme, whatever the person's own Premium. Acting as a shop,
 *                  the app IS the shop -- verified or not (an unverified shop
 *                  is still the identity on screen; only its posting is gated).
 *   premium / vip  premium, through `hasPremiumAccess()` so VIP (a superset)
 *                  is never shown the normal film.
 *   otherwise      normal.
 *
 * Organisation BACKING accounts (`isOrgAccount`) never reach this: the token
 * route refuses them, so on a phone "an org account" is always a person acting
 * as one, which is the second check.
 */

export type OpeningTier = "normal" | "premium" | "msme";

export const OPENING_TIERS: readonly OpeningTier[] = ["normal", "premium", "msme"];

/**
 * The ground behind the opening film, and behind every frame either side of it
 * (the boot <Splash>, the "/" fork, the intro route). ONE constant so the
 * handoff cannot drift: change it here when the films' first frame changes.
 */
export const OPENING_BACKGROUND = "#14140F";

export interface OpeningTierInput {
  signedIn: boolean;
  /** `getActingOrgId()`: the shop this device acts as, or null for "myself". */
  actingOrgId: string | null;
  /** From profile/me. Missing (not loaded, older server) reads as no Premium. */
  reputation?: Pick<ViewerReputation, "premium" | "vip"> | null;
}

export function resolveOpeningTier({ signedIn, actingOrgId, reputation }: OpeningTierInput): OpeningTier {
  if (!signedIn) return "normal";
  if (actingOrgId) return "msme";
  if (hasPremiumAccess(reputation)) return "premium";
  return "normal";
}

/** A stored value, read back. Anything that is not exactly a tier is "normal". */
export function parseOpeningTier(raw: unknown): OpeningTier {
  return OPENING_TIERS.includes(raw as OpeningTier) ? (raw as OpeningTier) : "normal";
}
