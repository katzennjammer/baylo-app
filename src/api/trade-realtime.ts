import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { LIVE_OFFERS_KEY } from "./offer";
import { subscribeToTradeEvents, type TradeEvent } from "./pusher";
import { TRADES_ACTIVE_KEY, TRADES_HISTORY_KEY, confirmStatusKey, meetupKey } from "./trades";

/**
 * The other phone.
 *
 * Every trade mutation in trades.ts invalidates the caches ON THE PHONE THAT
 * TAPPED. That was the whole story until 17 Sep 2026, and it is why a meetup
 * plan showed up for the proposer and not the partner: the partner's list was
 * fresh for 30 seconds, no event reached it, and no trade screen refetched on
 * its own. This hook is the half that was missing — it holds the user's
 * private channel for the whole signed-in session and turns the two trade
 * events into invalidations, so the partner's row updates the way a message
 * thread does.
 *
 * ── MOUNTED ONCE, AT THE (app) GATE ─────────────────────────────────────────
 *
 * Not on a screen. The Trades tab is not always mounted and the meetup screen
 * is rarely mounted, but a plan can change while either is off screen and the
 * cache should be stale by the time it is opened. The (app) layout is mounted
 * exactly while there is a session, which is exactly the lifetime the
 * subscription should have. The Messages screens keep their own subscription
 * for their own events; the channel underneath is ref-counted, so the two
 * coexist without either tearing the other down.
 *
 * ── INVALIDATE, DO NOT PATCH ────────────────────────────────────────────────
 *
 * The event says which trade and what kind of change; it does not carry the
 * plan. Writing a partial payload into the cache would have this hook
 * re-deriving `meetupState` from a second source of truth, and the list route
 * is one round trip. `invalidateQueries` refetches whatever is currently
 * observed and marks the rest stale for when it is.
 */
export function useTradeRealtime(userId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    // Signed out: nothing to hold. The socket itself is dropped by pusher.ts,
    // which follows the session stream so it also covers the sign-outs that
    // never pass through a React tree (the refresh interceptor giving up).
    if (!userId) return;

    const onEvent = (event: TradeEvent) => {
      void qc.invalidateQueries({ queryKey: TRADES_ACTIVE_KEY });
      void qc.invalidateQueries({ queryKey: meetupKey(event.tradeId) });
      if (event.name === "trade-status-changed") {
        // A status move can put the row in history, close an offer, or make
        // the codes live — the screens that draw those read these.
        void qc.invalidateQueries({ queryKey: TRADES_HISTORY_KEY });
        void qc.invalidateQueries({ queryKey: LIVE_OFFERS_KEY });
        void qc.invalidateQueries({ queryKey: confirmStatusKey(event.tradeId) });
      }
    };

    return subscribeToTradeEvents(userId, onEvent) ?? undefined;
  }, [qc, userId]);
}
