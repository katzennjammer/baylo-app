import { useEffect, useRef } from "react";

import { fetchValuation, isRevaluationSpent } from "../api/post";
import { usePost } from "./state";

/**
 * The suggested value, and the band the server will accept around it.
 *
 * ── WHY THIS RUNS ON (category, condition) AND NOT ON "REACHED STEP 4" ──────
 *
 * The suggestion is a pure function of those two labels — the endpoint says so
 * in its own header, and the create handler recomputes it from the same two
 * before deciding whether to accept the number the client sends. So the moment
 * either changes, the band on screen is wrong and the slider is offering values
 * the server will refuse. Fetching on the pair rather than on arrival is what
 * makes "edit the condition from the review step" work: going back changes the
 * condition, which invalidates the valuation, which refetches, which reseats
 * the value inside the new band. None of that needs a step number.
 *
 * ── THE INITIAL VALUATION IS FREE; A RE-VALUATION IS NOT ────────────────────
 *
 * `fetchValuation` takes an optional `itemId` that SPENDS one of a listing's
 * re-valuations, irreversibly and before the model runs. This hook never passes
 * it: the wizard only creates listings, so there is nothing to spend it against.
 * (It used to, whenever the route was opened with `?itemId=` — an "edit mode"
 * that prefilled nothing and ended in POST, so reaching this step burned the
 * listing's one re-valuation on the way to creating a duplicate of it. The
 * param is gone; see post-item.tsx.)
 */
export function useValuation() {
  const { state, dispatch } = usePost();
  const { category, condition, valuation } = state;

  /**
   * The (category, condition) pair already asked about.
   *
   * A ref, because re-asking is the failure mode here: each ask costs a request
   * per render. `valuation === null` is the invalidation signal — the reducer
   * clears it on any category or condition change — and this makes sure the
   * clear results in exactly one refetch.
   */
  const asked = useRef<string | null>(null);

  useEffect(() => {
    if (!category) return;
    const key = `${category}:${condition}`;
    if (valuation && asked.current === key) return;
    if (asked.current === key) return;

    asked.current = key;
    dispatch({ type: "valuation/pending" });

    fetchValuation(category, condition)
      .then((payload) => dispatch({ type: "valuation/done", payload }))
      .catch((e) => {
        if (isRevaluationSpent(e)) {
          // 409. The listing's one re-valuation is gone; the slider goes flat
          // and the panel explains it. The VALUE ITSELF is unchanged and stays
          // at full weight — it is still the real number.
          dispatch({ type: "valuation/spent" });
          return;
        }
        // Anything else leaves `valuation` null, which is the step's skeleton,
        // and re-arms so a return to this step tries again rather than sitting
        // on a permanent shimmer. Deliberately NOT `valuation/spent`: a timeout
        // is not a spent re-valuation, and saying so would be a false statement
        // about the user's listing.
        asked.current = null;
        dispatch({ type: "valuation/failed" });
      });
  }, [category, condition, valuation, dispatch]);
}
