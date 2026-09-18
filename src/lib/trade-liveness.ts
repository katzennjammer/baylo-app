import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { AppState } from "react-native";

import { isRealtimeConnected } from "../api/pusher";
import { useRefetchOnFocus } from "./refetch-on-focus";

/**
 * Keeps a trade screen current when the push channel cannot.
 *
 * ── THE PUSH IS THE MECHANISM; THIS IS THE NET UNDER IT ─────────────────────
 *
 * `useTradeRealtime()` invalidates the trade caches the moment the partner
 * does something, and on a phone with a live socket that is the whole story.
 * The socket is not always live: a build without Pusher keys, a network that
 * blocks WebSockets, the seconds after a reconnect, a rejected authorisation.
 * On such a phone the only refetch triggers were a pull and an app
 * foregrounding — which is the bug this file exists because of.
 *
 * Two things, then, for every screen that draws a plan or a code:
 *
 *   1  REFETCH WHEN THE SCREEN COMES BACK — `useRefetchOnFocus`, the same
 *      thing the marketplace does. Unconditional: cheap, and a screen regained
 *      is the moment somebody is looking.
 *   2  POLL EVERY 20 SECONDS while the screen is focused and the app is in
 *      the foreground, BUT ONLY WHILE THE SOCKET IS DOWN. Each tick asks
 *      `isRealtimeConnected()` and does nothing on a phone that is being
 *      pushed to. So a healthy phone makes no extra requests and an unhealthy
 *      one is never more than 20 seconds behind.
 *
 * ── SILENT ──────────────────────────────────────────────────────────────────
 *
 * The refetch is the observer's own, so the list updates in place. Nothing
 * here touches `isRefetching` on purpose, and the Trades tab's pull indicator
 * is driven by the gesture (`usePullToRefresh`) rather than by that flag, so
 * a background tick does not flick a spinner nobody pulled.
 */

const POLL_MS = 20_000;

export function useTradeLiveness(refetch: (opts: { cancelRefetch: boolean }) => unknown) {
  const ref = useRef(refetch);
  ref.current = refetch;

  useRefetchOnFocus(refetch);

  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => {
        if (AppState.currentState !== "active") return;
        if (isRealtimeConnected()) return;
        void ref.current({ cancelRefetch: false });
      }, POLL_MS);
      return () => clearInterval(timer);
    }, []),
  );
}
