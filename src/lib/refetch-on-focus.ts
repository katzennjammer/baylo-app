import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

/**
 * Refetch a list when its screen comes BACK into view.
 *
 * ── WHAT `refetchOnWindowFocus` DOES NOT COVER ──────────────────────────────
 *
 * queryClient.ts wires TanStack's focus manager to AppState, so a query
 * refetches when the APP returns to the foreground. Nothing refetches when a
 * SCREEN does: the tabs stay mounted while another tab or a pushed route is
 * on top, so there is no remount to fetch on, and `staleTime` is a minute.
 * Somebody who posts on their phone and looks at yours will not appear in your
 * marketplace until you pull, background the app, or wait out the minute —
 * unless the grid asks again when you come back to it. This is that ask.
 *
 * ── NOT ON FIRST FOCUS ──────────────────────────────────────────────────────
 *
 * The screen's own query fetches on mount, and `useFocusEffect` fires on the
 * same tick. Refetching there would be a second request for the first page,
 * so the first focus is skipped and only a REGAINED focus refetches.
 *
 * `cancelRefetch: false`, so a fetch already in flight — the one the post
 * mutation's invalidation started, for instance — is joined rather than
 * cancelled and restarted.
 */
export function useRefetchOnFocus(refetch: (opts: { cancelRefetch: boolean }) => unknown) {
  // The latest refetch is read from a ref so the focus effect is registered
  // once per mount rather than once per render of the screen.
  const ref = useRef(refetch);
  ref.current = refetch;
  const first = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void ref.current({ cancelRefetch: false });
    }, []),
  );
}
