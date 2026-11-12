import { useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback, useSyncExternalStore } from "react";
import type { View } from "react-native";

import type { Rect } from "./layout";
import { TOUR_STEPS, type TourTargetId } from "./steps";

/**
 * The first-time tour's state: whether it is running, which step it is on,
 * where its targets are, and whether this account has already seen it.
 *
 * Module state drawn by one host (`<TutorialOverlay />` in the (app) layout),
 * the same shape as `components/dialog` and `search-helper/store` — the things
 * that start it (Home, Settings) and the things it points at (the tab bar, the
 * header) are nowhere near each other in the tree.
 */

// ── Running state ───────────────────────────────────────────────────────────

export interface TourState {
  active: boolean;
  index: number;
}

const IDLE: TourState = { active: false, index: 0 };

let state: TourState = IDLE;
const listeners = new Set<() => void>();

function set(next: TourState) {
  state = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const read = () => state;

export function useTourState(): TourState {
  return useSyncExternalStore(subscribe, read, read);
}

/** From the top. A no-op while it is already running. */
export function startTour() {
  if (!state.active) set({ active: true, index: 0 });
}

/** The next step; on the last one this does nothing — that step ends the tour itself. */
export function nextTourStep() {
  if (state.active && state.index < TOUR_STEPS.length - 1) set({ active: true, index: state.index + 1 });
}

/**
 * Skip or finish — the same thing as far as "seen" goes: someone who skipped
 * has answered the question, and asking again on the next launch is the
 * behaviour that makes people resent a tutorial.
 */
export function endTour(userId: string | null) {
  if (userId) void markTutorialSeen(userId);
  if (state.active) set(IDLE);
}

/** Drops a running tour WITHOUT marking it seen — the host unmounting on sign-out. */
export function resetTour() {
  if (state.active) set(IDLE);
}

// ── Seen, per account, on this phone ────────────────────────────────────────

/**
 * SecureStore, keyed by user id — the same arrangement as `baylo.signupKind.*`.
 * It is not a secret; SecureStore is simply the only persistent store the app
 * already ships. A reinstall or a second phone forgets it and shows the tour
 * once more, which is the cheap direction to be wrong in.
 */
const PREFIX = "baylo.tutorialSeen.";

/** SecureStore keys allow only [A-Za-z0-9._-]. */
const keyFor = (userId: string) => PREFIX + userId.replace(/[^A-Za-z0-9._-]/g, "_");

/** Accounts known seen in this process, so a failed write cannot replay it. */
const seenThisProcess = new Set<string>();

export async function tutorialSeen(userId: string): Promise<boolean> {
  if (seenThisProcess.has(userId)) return true;
  try {
    return (await SecureStore.getItemAsync(keyFor(userId))) === "1";
  } catch {
    // An unreadable store would otherwise mean the tour on every launch. Not
    // showing it is the better failure: it stays one tap away in Settings.
    return true;
  }
}

export async function markTutorialSeen(userId: string): Promise<void> {
  seenThisProcess.add(userId);
  try {
    await SecureStore.setItemAsync(keyFor(userId), "1");
  } catch {
    // Costs one more showing after a restart.
  }
}

/** How long Home is left alone before the mascot arrives. */
const START_DELAY_MS = 600;

/**
 * Home's side of it: start the tour the first time this account sees Home.
 *
 * `ready` is "Home has drawn its content" — starting over a spinner would
 * spotlight a screen that is about to change under the hole. Leaving Home
 * before the delay is up cancels it; it is asked again on the next focus.
 */
export function useTutorialAutoStart(userId: string | null, ready: boolean) {
  useFocusEffect(
    useCallback(() => {
      if (!userId || !ready) return;
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      void tutorialSeen(userId).then((seen) => {
        if (seen || cancelled) return;
        timer = setTimeout(() => {
          if (!cancelled) startTour();
        }, START_DELAY_MS);
      });
      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }, [userId, ready]),
  );
}

// ── Targets ─────────────────────────────────────────────────────────────────

/**
 * A SET per id, not one node. The header is drawn once per tab screen, so
 * "leaves" is registered by every tab that has been opened; the one on screen
 * is whichever measures to a real, visible rect (see `isUsable`).
 */
const targets = new Map<TourTargetId, Set<View>>();
const refs = new Map<TourTargetId, (node: View | null) => (() => void) | undefined>();

/**
 * The ref to put on a view the tour can point at:
 *
 *   <View ref={tourTarget("search")} collapsable={false}>
 *
 * `collapsable={false}` matters on Android, where a view that only lays out
 * its children is flattened away and has nothing to measure. The callback is
 * the same function every render, so attaching it costs nothing; it returns a
 * cleanup (React 19) so each node removes exactly itself.
 */
export function tourTarget(id: TourTargetId) {
  let ref = refs.get(id);
  if (!ref) {
    ref = (node) => {
      if (!node) return undefined;
      let set = targets.get(id);
      if (!set) targets.set(id, (set = new Set()));
      set.add(node);
      const owner = set;
      return () => {
        owner.delete(node);
      };
    };
    refs.set(id, ref);
  }
  return ref;
}

/** A measure that never answers (a detached screen) must not hang the step. */
const MEASURE_TIMEOUT_MS = 250;

function measure(node: View): Promise<Rect | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), MEASURE_TIMEOUT_MS);
    try {
      node.measureInWindow((x, y, width, height) => {
        clearTimeout(timer);
        resolve({ x, y, width, height });
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/** Every registered node for `id`, measured in window coordinates, right now. */
export async function measureTarget(id: TourTargetId): Promise<Rect[]> {
  const nodes = [...(targets.get(id) ?? [])];
  const rects = await Promise.all(nodes.map(measure));
  return rects.filter((r): r is Rect => r !== null);
}
