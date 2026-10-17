import { useIsFocused } from "expo-router";
import { useSyncExternalStore } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { countdownA11yLabel, secondsLeft } from "./perishable";
import { serverNow } from "./server-time";

/**
 * The app's one ticking clock, corrected to the SERVER's time.
 *
 * ── WHY ONE ─────────────────────────────────────────────────────────────────
 *
 * Every perishable on screen shows a live countdown (1 Oct 2026). A 1 s
 * interval per card is forty timers on a scrolled grid, all drifting apart.
 * This is one self-rescheduling timeout, aligned to the second boundary, that
 * every countdown subscribes to. Each subscriber re-renders itself once a
 * second; the tile around it does not.
 *
 * IT RUNS ONLY WHILE SOMEONE IS WATCHING. No subscribers → no timer. The app
 * in the background → no timer, and one immediate tick on return. A screen
 * that loses focus unsubscribes its countdowns (see useLiveNow), so a grid
 * left under a pushed listing stops ticking until it is shown again.
 *
 * It counts in SERVER time (lib/server-time), so a phone whose clock is off
 * still ends a window when the server does.
 */

const listeners = new Set<() => void>();
let nowSec = Math.floor(serverNow() / 1000);
let timer: ReturnType<typeof setTimeout> | null = null;
let appActive = AppState.currentState !== "background" && AppState.currentState !== "inactive";
let appStateHooked = false;

function tick() {
  nowSec = Math.floor(serverNow() / 1000);
  listeners.forEach((l) => l());
}

function schedule() {
  // To the next whole second, so every pill turns over together and a
  // displayed second is never skipped or shown twice by drift.
  const wait = 1000 - (serverNow() % 1000) + 5;
  timer = setTimeout(() => {
    timer = null;
    tick();
    if (listeners.size > 0 && appActive) schedule();
  }, wait);
}

function start() {
  if (timer || listeners.size === 0 || !appActive) return;
  tick();
  schedule();
}

function stop() {
  if (timer) clearTimeout(timer);
  timer = null;
}

function onAppState(next: AppStateStatus) {
  appActive = next === "active";
  if (appActive) start();
  else stop();
}

function subscribeLive(listener: () => void) {
  if (!appStateHooked) {
    // Once for the app's life: the module is a singleton and so is this.
    AppState.addEventListener("change", onAppState);
    appStateHooked = true;
  }
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

const subscribeNone = () => () => {};
const getNowSec = () => nowSec;

/**
 * Server-corrected epoch SECONDS, re-rendering the caller once a second while
 * its screen is focused and the app is in the foreground. Paused, it holds the
 * last value.
 */
export function useLiveNow(): number {
  const focused = useIsFocused();
  return useSyncExternalStore(focused ? subscribeLive : subscribeNone, getNowSec);
}

/**
 * Whatever `derive` makes of the clock, re-rendering the caller only when
 * THAT changes. A tile's screen-reader label uses it to update once a minute
 * while its pill ticks every second.
 */
export function useLiveDerived<T extends string | number | boolean>(
  derive: (nowSec: number) => T,
  /** False subscribes to nothing — a tile with no countdown pays no tick. */
  active = true,
): T {
  const focused = useIsFocused();
  return useSyncExternalStore(focused && active ? subscribeLive : subscribeNone, () => derive(nowSec));
}

/**
 * A card's spoken countdown, "Ends in 5 hours 12 minutes", or null for a
 * listing with no window. Re-renders its card once a minute, not per tick.
 */
export function useCountdownA11y(
  perishable: { expiresAt: string; expired: boolean } | null,
): string | null {
  const label = useLiveDerived(
    (now) =>
      perishable
        ? countdownA11yLabel(perishable.expired ? 0 : secondsLeft(perishable.expiresAt, now))
        : "",
    perishable !== null,
  );
  return label || null;
}
