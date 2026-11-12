import * as SecureStore from "expo-secure-store";

import { withTimeout } from "../api/timeout";
import { readOpeningTier } from "./opening-tier-store";

/**
 * "Has the intro already played in this process?"
 *
 * ── A MODULE VARIABLE IS THE CORRECT STORE HERE, NOT SecureStore ────────────
 *
 * The requirement is COLD START ONLY: play once when the app is launched, and
 * never on a resume from the background. A module-scope boolean expresses
 * exactly that and nothing else, because its lifetime IS the JS runtime's
 * lifetime. It resets when the process is created and at no other time.
 *
 * Every persistent alternative gets the requirement wrong in one direction or
 * the other. A stored flag ("has seen the intro") would show it once ever, on
 * first install — which is a different feature. A stored timestamp would need a
 * cutoff nobody has specified. And neither would help with the case that
 * actually matters, because:
 *
 * A RESUME FROM BACKGROUND DOES NOT RE-RUN THIS ANYWAY. The React tree survives
 * backgrounding, so `app/index.tsx` is not remounted and never asks. What this
 * flag really defends against is the SECOND kind of return: the intro's own
 * exit (which navigates to "/"), the user backing out of the auth stack to "/",
 * or a session change re-running the fork. All of them re-enter index.tsx with
 * the process still alive, and none may replay the film.
 *
 * When Android kills the process under memory pressure and restores the task,
 * the runtime is new, the flag is false, and the intro plays. That is correct:
 * it is a cold start by every definition that matters to the person holding the
 * phone — the app was not running, and now it is.
 *
 * ── IT IS CONSUMED IN AN EFFECT, NEVER DURING RENDER ────────────────────────
 *
 * `markIntroPlayed()` is called from the intro screen's mount effect. The
 * tempting shape — a `consumeIntro()` that flips the flag as it reads it,
 * called from index.tsx's render — breaks under React 19's double-invoked
 * render in development: the first invocation eats the flag, the second sees
 * false, and the intro never plays in a dev build. Reading is pure; writing
 * happens once, in an effect, on the screen that is actually showing it.
 */

let played = false;

/* ── ONCE PER TIER, NOT EVERY COLD START (7 Nov 2026) ────────────────────────
 * The film used to play on every cold start. Now it plays on the first launch
 * after install, and once more whenever the opening tier changes (normal ->
 * Premium, a shop approved): those films are the only place a person sees
 * their upgrade celebrated. Every other launch goes straight in.
 *
 * The phone remembers the tier whose film it last played (SEEN_KEY). The
 * decision is "seen tier != the tier cached for this launch". Both reads are
 * one SecureStore call with a deadline. A read that fails answers "skip": a
 * broken Keystore must never be the reason the film plays on every launch
 * again, or the reason somebody cannot get in.
 */
const SEEN_KEY = "baylo.introSeenTier";
const SEEN_READ_TIMEOUT_MS = 800;
let decision: Promise<boolean> | null = null;
let decided: boolean | null = null;

/** Does this launch's tier still need its film? Memoised; never rejects. */
export function introNeeded(): Promise<boolean> {
  decision ??= Promise.all([
    readOpeningTier(),
    withTimeout(SecureStore.getItemAsync(SEEN_KEY), SEEN_READ_TIMEOUT_MS, "Reading the intro record"),
  ])
    .then(([tier, seen]) => seen !== tier)
    .catch(() => false)
    .then((needed) => {
      decided = needed;
      return needed;
    });
  return decision;
}

/** The answer once known, synchronously; null while the reads are in flight. */
export function introNeededNow(): boolean | null {
  return decided;
}

/** Remember that this launch's tier has had its film. */
function rememberSeen(): void {
  void readOpeningTier()
    .then((tier) => SecureStore.setItemAsync(SEEN_KEY, tier))
    .catch(() => undefined);
}

/** True until the intro screen has been mounted once in this process. */
export function introPending(): boolean {
  return !played;
}

/**
 * Called by the intro screen on mount, and again by every exit BEFORE it
 * navigates to "/". Idempotent. The second call is the loop guard: "/" is the
 * fork that routes here, so the flag must already be down by the time it runs.
 */
export function markIntroPlayed(): void {
  if (!played) rememberSeen();
  played = true;
}

export type BootRoute = "/intro" | "splash" | "/(app)/home" | "/(auth)/login";

/**
 * The "/" fork, as a pure function of what it reads, so the loop guard can be
 * checked off the device (scripts/verify-opening-tier.ts).
 *
 * THE INTRO IS FIRST, AHEAD OF THE SESSION READ. Since the tiered opening film
 * (Oct 2026) it plays on every cold start, signed in or not, from a tier cached
 * on the phone -- so it has nothing to wait for. Its exit comes back here, and
 * by then `introPending` is false, so this can only answer "/intro" once per
 * process.
 */
export function bootRoute(state: {
  introPending: boolean;
  videoAvailable: boolean;
  isLoading: boolean;
  signedIn: boolean;
  /**
   * Whether this tier's film is still unseen (see introNeeded). `null` while
   * the reads are in flight: the splash holds for that instant. Omitted, it
   * counts as needed -- the old every-cold-start behaviour, kept for callers
   * and tests that predate it.
   */
  introNeeded?: boolean | null;
}): BootRoute {
  if (state.introPending && state.videoAvailable) {
    if (state.introNeeded === null) return "splash";
    if (state.introNeeded !== false) return "/intro";
  }
  if (state.isLoading) return "splash";
  if (state.signedIn) return "/(app)/home";
  return "/(auth)/login";
}
