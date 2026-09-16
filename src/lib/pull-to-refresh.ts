import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A `RefreshControl` that spins ONLY for a pull.
 *
 * `refreshing={isRefetching}` is the obvious wiring and it is wrong for a
 * feed: every background refetch — a tab regained, the app foregrounded, a
 * mutation elsewhere invalidating the list — also raises `isRefetching`, and
 * each one flicked the pull indicator at the top of a list nobody had pulled.
 * The spinner is the user's own gesture being acknowledged, so it is driven
 * by the gesture and by nothing else. Background refetches stay silent; the
 * list simply updates.
 */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);

  // Guards the setState after the await against an unmounted screen.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [refetch]);

  return { refreshing, onRefresh };
}
