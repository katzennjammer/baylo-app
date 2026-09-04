import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../api/client";
import { detectionFailed, identifyPhoto } from "../api/post";
import { leadPhoto } from "./photos";
import { usePost } from "./state";

/**
 * Detection, and the two clocks that run beside it.
 *
 * ── THE ENDPOINT CANNOT FAIL, SO THE TIMER IS THE FAILURE DETECTOR ──────────
 *
 * /api/ai/identify answers HTTP 200 with empty fields when the vision call
 * throws — a deliberate server-side choice, because a listing flow that
 * dead-ends on an Anthropic outage is worse than one that asks the user to
 * type. The consequence for this client is that "did it work" is not a status
 * code: it is `name === ""`, and it is also "we have been waiting fifteen
 * seconds and nothing has come back at all".
 *
 * Both land on the SAME layout, because to the person filling in the form they
 * are the same event. Nothing on that layout says sorry, error or failed, it
 * carries no icon and no warm colour. It is an ordinary form that happens not
 * to be prefilled — which is what it is.
 *
 * ── THE TWO CLOCKS ──────────────────────────────────────────────────────────
 *
 *   8 s   the framing line becomes "Still looking. Your connection may be
 *         slow." Nothing else changes and nothing is cancelled. This is the
 *         difference between a screen that is thinking and a screen that is
 *         stuck, and eight seconds is where a person starts to wonder.
 *
 *   15 s  treated as failed and moved to the failed layout — WITHOUT an error.
 *         The request is not aborted: if it lands afterwards it is ignored,
 *         because by then the user is typing into the field it would overwrite.
 */

const SLOW_AFTER_MS = 8_000;
const GIVE_UP_AFTER_MS = 15_000;

export function useDetection() {
  const { state, dispatch } = usePost();

  const lead = leadPhoto(state.photos);
  const url = lead?.url ?? null;

  /**
   * The url detection has already been run for.
   *
   * Without it, every render that produces a new `state` object would re-fire
   * the effect's body against the same photo — and each call is a billed vision
   * request against a 20/hour budget. Held in a ref rather than in state
   * because changing it must not itself cause a render.
   */
  const ranFor = useRef<string | null>(null);

  /**
   * Bumped to ask about the SAME photo a second time.
   *
   * It has to be state rather than a ref: the effect below is keyed on its
   * dependencies, and clearing a ref changes nothing the effect can see. This
   * is the one input that legitimately re-fires a billed request, and the only
   * thing that bumps it is the retry behind a rate limit's countdown.
   */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!url || ranFor.current === url) return;
    // A user who has already answered the question is not asked it again by a
    // second photo finishing its upload.
    if (state.detection.phase === "corrected" || state.detection.phase === "detected") return;

    ranFor.current = url;
    dispatch({ type: "detect/start" });

    let settled = false;
    const slow = setTimeout(() => {
      if (!settled) dispatch({ type: "detect/slow" });
    }, SLOW_AFTER_MS);
    const giveUp = setTimeout(() => {
      if (!settled) {
        settled = true;
        dispatch({ type: "detect/fail" });
      }
    }, GIVE_UP_AFTER_MS);

    identifyPhoto(url)
      .then((result) => {
        if (settled) return; // The 15 s clock already moved on. Do not overwrite.
        settled = true;
        if (detectionFailed(result)) dispatch({ type: "detect/fail" });
        else dispatch({ type: "detect/done", result });
      })
      .catch((e) => {
        if (settled) return;
        settled = true;
        if (e instanceof ApiError && e.status === 429) {
          // A rate limit is not "we could not read your photo". The step shows
          // the countdown and the failed layout underneath it, so the form is
          // still fillable while the budget refills.
          dispatch({ type: "rate-limit", action: "detect", seconds: e.retryAfter ?? 60 });
        }
        dispatch({ type: "detect/fail" });
      })
      .finally(() => {
        clearTimeout(slow);
        clearTimeout(giveUp);
      });

    return () => {
      settled = true;
      clearTimeout(slow);
      clearTimeout(giveUp);
    };
    // `state.detection.phase` is read but deliberately NOT a dependency: it
    // changes on every step of the detection this effect starts, and depending
    // on it would tear the effect down mid-flight and restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, attempt, dispatch]);

  /**
   * Runs detection again, by hand.
   *
   * The only caller is the retry behind a rate limit's countdown. It clears the
   * memo so the same url may be asked about twice — which is precisely what the
   * budget is protecting against, hence the countdown gating the button rather
   * than this function refusing.
   */
  const retryDetection = useCallback(() => {
    ranFor.current = null;
    dispatch({ type: "rate-limit/clear" });
    setAttempt((n) => n + 1);
  }, [dispatch]);

  return { retryDetection, hasPhoto: url !== null };
}
