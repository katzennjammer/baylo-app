import { useCallback, useEffect, useReducer } from "react";

/**
 * Load state for one remote photo: one automatic retry, then a manual one.
 *
 * Before this, GridTile, PhotoCarousel and the home cards set `failed` on the
 * first onError and never cleared it, so a single timeout on mobile data showed
 * the broken-photo icon until the screen was rebuilt -- and PhotoCarousel kept
 * its flags by slide INDEX, so they could land on another listing's photos.
 *
 * `attempt` is meant to be the Image's `key`: expo-image has no "load that URL
 * again", and re-rendering with an identical source is a no-op, so a retry is a
 * remount. The same reason FeedCard keys its photo on `attempt`.
 */

/** Long enough for a dropped connection to come back, short enough to go unnoticed. */
export const AUTO_RETRY_MS = 1500;

export interface PhotoState {
  uri: string | undefined;
  attempt: number;
  failed: boolean;
}

export type PhotoAction = { type: "error" } | { type: "retry" } | { type: "reset"; uri: string | undefined };

export function photoReducer(state: PhotoState, action: PhotoAction): PhotoState {
  switch (action.type) {
    case "reset":
      return { uri: action.uri, attempt: 0, failed: false };
    case "error":
      return state.failed ? state : { ...state, failed: true };
    case "retry":
      return { ...state, attempt: state.attempt + 1, failed: false };
  }
}

/** Only the first failure of a URL retries by itself; after that it waits for a tap. */
export function shouldAutoRetry(state: PhotoState): boolean {
  return state.failed && state.attempt === 0;
}

export function usePhotoRetry(uri: string | undefined) {
  const [state, dispatch] = useReducer(photoReducer, { uri, attempt: 0, failed: false });

  // A different photo starts clean. Done during render, not in an effect, so the
  // old URL's failure is never drawn over the new one for a frame.
  if (state.uri !== uri) dispatch({ type: "reset", uri });

  const auto = shouldAutoRetry(state);
  useEffect(() => {
    if (!auto) return;
    const timer = setTimeout(() => dispatch({ type: "retry" }), AUTO_RETRY_MS);
    return () => clearTimeout(timer);
  }, [auto]);

  const onError = useCallback(() => dispatch({ type: "error" }), []);
  const retry = useCallback(() => dispatch({ type: "retry" }), []);

  return { key: state.attempt, failed: state.failed, onError, retry };
}
