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
 * Passing `itemId` SPENDS one of the listing's re-valuations, irreversibly and
 * before the model runs. It is therefore passed only when this flow was entered
 * from an existing listing — a new listing has nothing to spend it against, and
 * `MAX_REVALUATIONS` is 1, so a wizard that sent an itemId on every keystroke of
 * a condition change would burn a user's one re-valuation on a typo.
 */
export function useValuation() {
  const { state, dispatch } = usePost();
  const { category, condition, valuation, editingItemId } = state;

  /**
   * The (category, condition) pair already asked about.
   *
   * A ref, because re-asking is the failure mode here: for an existing listing
   * each ask costs the one re-valuation, and for a new one it costs a request
   * per render. `valuation === null` is the invalidation signal — the reducer
   * clears it on any category or condition change — and this makes sure the
   * clear results in exactly one refetch.
   */
  const asked = useRef<string | null>(null);

  useEffect(() => {
    if (!category) return;
    const key = `${category}:${condition}:${editingItemId ?? ""}`;
    if (valuation && asked.current === key) return;
    if (asked.current === key) return;

    asked.current = key;
    dispatch({ type: "valuation/pending" });

    fetchValuation(category, condition, editingItemId ?? undefined)
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
  }, [category, condition, editingItemId, valuation, dispatch]);
}
