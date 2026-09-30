import type { useRouter } from "expo-router";

import { ApiError } from "../api/client";
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

/**
 * The advertised price, as one string so the screen and any caller that
 * mentions it cannot disagree. A PRICE, not a peg: it is what Premium will
 * cost in pesos once Play Billing exists, and has nothing to do with Leaves.
 */
export const PREMIUM_PRICE_LABEL = "₱199/year";

/**
 * Mirrors `PREMIUM_BRIDGE_FEE_PER_BRACKET` in baylo/src/lib/trade-rules.ts
 * (24 Sep 2026): a Premium PAYER's bridge costs 8 Leaves per bracket instead
 * of `BRIDGE_FEE_PER_BRACKET`'s 10. Kept here rather than in the trade-rules
 * mirror because this screen is its only reader on the phone -- the offer
 * flow still prices bridges at the standard rate client-side and the server's
 * figure is what is actually held. The server's is the one enforced.
 */
export const PREMIUM_BRIDGE_FEE_PER_BRACKET = 8;

/** Why the Premium screen was opened: a plain visit, or a gate that refused. */
export type PremiumReason = "premium" | "vip";

/**
 * Recognises the bracket gate's refusal: `enforcePremiumForListing()` answers
 * 403 with `code` PREMIUM_REQUIRED or VIP_REQUIRED on POST /api/offers,
 * PATCH /api/offers/[id] and PATCH /api/trades. Those are legacy routes, so
 * the code is in `code`; `meta.rule` is checked too so a v1 route adopting
 * the gate later is recognised without touching every caller.
 *
 * NOT the accept path's SENDER_GATE_FAILED (a 409): that one is the OTHER
 * person's lapsed subscription, and sending the accepter to a paywall for it
 * would tell them they need something they do not.
 */
export function premiumGateReason(e: unknown): PremiumReason | null {
  if (!(e instanceof ApiError) || e.status !== 403) return null;
  const code = e.meta?.rule ?? e.code;
  if (code === "PREMIUM_REQUIRED") return "premium";
  if (code === "VIP_REQUIRED") return "vip";
  return null;
}

/**
 * The one way to the Premium screen, so every gate opens the SAME paywall.
 * `reason` only adds a line at the top saying what was just blocked.
 */
export function openPremium(router: Pick<ReturnType<typeof useRouter>, "push">, reason?: PremiumReason, bracket?: number) {
  router.push({
    pathname: "/premium",
    params: {
      ...(reason ? { reason } : {}),
      ...(bracket !== undefined ? { bracket: String(bracket) } : {}),
    },
  });
}

/**
 * The bridging fee to SHOW a payer, given whether that payer has Premium.
 *
 * DISPLAY ONLY. `offerTerms()` in the trade-rules mirror is untouched and
 * still prices at the standard rate; this re-states its `feeBracket` at the
 * Premium rate so the figure on screen matches what the server's
 * `bridgingFee(lowerBracket, premiumPayer)` actually holds. Nothing sent to
 * the server carries an amount — consent is `{ accepted, policyVersion }` —
 * so this cannot change what is charged, only what is quoted beforehand.
 *
 * Only callable where the phone KNOWS the payer's status, which today is the
 * proposer paying their own up-bridge (their `reputation` is on profile/me).
 * A receiver-pays quote on the composer is the listing owner's subscription,
 * which the phone is never told.
 */
export function displayedBridgeFee(
  terms: { fee: number; feeBracket: number | null },
  payerHasPremium: boolean,
): number {
  if (!payerHasPremium || terms.fee <= 0 || terms.feeBracket === null) return terms.fee;
  return terms.feeBracket * PREMIUM_BRIDGE_FEE_PER_BRACKET;
}
