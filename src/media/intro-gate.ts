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
 * flag really defends against is the SECOND kind of return: the user backing
 * out of the auth stack to "/", or a session change re-running the fork. Both
 * re-enter index.tsx with the process still alive, and both should land on the
 * auth screen rather than replaying a seven-second film.
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

/** True until the intro screen has been mounted once in this process. */
export function introPending(): boolean {
  return !played;
}

/** Called by the intro screen on mount. Idempotent. */
export function markIntroPlayed(): void {
  played = true;
}
