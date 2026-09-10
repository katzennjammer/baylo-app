import { useQuery } from "@tanstack/react-query";

import { apiV1 } from "./client";
import type { ProfileMePayload } from "./types";

/**
 * GET /api/v1/profile/me — the viewer's own shelf, standing and ID gate.
 *
 * ── WHY THE OFFER FLOW NEEDS THIS AT ALL ────────────────────────────────────
 *
 * /api/v1/items/[id] already carries most of an offer sheet: the listing, the
 * viewer's Leaf balance, whether they have a pending offer, and the ids of
 * their tradeable items. What it does NOT carry is what those items are WORTH —
 * `viewer.tradeableItems` is `{ id, title, image }` — and the gap between two
 * values is the entire subject of the offer screen. This route returns the same
 * items as full `Item` rows, `valueLeaves` included, so the two are joined by
 * id in `useOfferContext()`.
 *
 * It is also the only route that serves `reputation` and `idVerification`, both
 * of which the screen has to express before somebody fills in a proposal.
 *
 * ── `limit=50` IS THE MAXIMUM, AND IT IS STILL A PAGE ───────────────────────
 *
 * The route is keyset-paginated: default 20, `MAX_LIMIT` 50, and it returns
 * AVAILABLE and OWNED rows together. So 50 is asked for rather than the default
 * — a shelf of 30 listings would otherwise come back with ten of them missing
 * their value — and the join in `useOfferContext()` still treats a miss as
 * "unknown value" rather than as "worth nothing". A user with more than 50
 * shelf rows will have their oldest listings come back unvalued; that is a real
 * limit and it is stated at the join rather than hidden here.
 *
 * ── STALENESS ──────────────────────────────────────────────────────────────
 *
 * A minute. The balance, the tier and the debt headroom all move as a result of
 * things happening elsewhere — an offer accepted, a contract swept into default
 * — and this is the payload that decides whether a promise route is offered at
 * all. Long enough that opening three listings in a row is one request; short
 * enough that a tier change is not carried around for a session.
 */

export const PROFILE_ME_KEY = ["profile", "me"] as const;

/** The route's own MAX_LIMIT. Asking for more is a 400, not a clamp. */
const SHELF_PAGE = 50;

export function useProfileMe(enabled = true) {
  return useQuery({
    queryKey: PROFILE_ME_KEY,
    queryFn: () => apiV1<ProfileMePayload>(`/api/v1/profile/me?limit=${SHELF_PAGE}`),
    enabled,
    select: (r) => r.data,
    staleTime: 60_000,
  });
}
