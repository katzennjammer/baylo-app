import type { ViewerReputation } from "../api/types";

/**
 * "Does this person have at least Premium access" -- the phone's reading of the
 * server's `isPremium(premiumUntil) || isVip(vipUntil)`, VIP being a superset.
 *
 * The one place the phone answers this, so no screen checks `premium` alone
 * and quietly locks a VIP out. Advisory, like the rest of the reputation block:
 * every Premium gate is enforced server-side. A missing reputation (still
 * loading, or an older server without the fields) reads as no access.
 */
export function hasPremiumAccess(
  rep: Pick<ViewerReputation, "premium" | "vip"> | null | undefined,
): boolean {
  return rep?.premium === true || rep?.vip === true;
}
