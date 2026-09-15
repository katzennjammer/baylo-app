/**
 * A promise timeout that reports the timeout as a VALUE, not as an exception.
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────
 *
 * `Location.getCurrentPositionAsync` does not reliably reject when there is no
 * fix. Indoors, in a basement, on a cold GPS — it simply never settles. The
 * marketplace map awaited it directly, so the screen sat on "Finding nearby Safe
 * Zones…" permanently: no error, no marker, no recovery, nothing to show for it
 * but a sentence that had stopped being true.
 *
 * The first attempt at a guard was `Promise.race([call, rejectingTimer])`, which
 * is the shape most people reach for and which is wrong in three ways that all
 * bit here.
 *
 * ── WHY NOT `Promise.race` WITH A REJECTING TIMER ───────────────────────────
 *
 *   1. THE TIMEOUT BECOMES AN EXCEPTION. "The phone did not have a fix in ten
 *      seconds" then arrives at the caller's `catch` looking exactly like "the
 *      user refused permission" and like "the OS threw". The screen has to
 *      distinguish those — a denied permission needs a Settings deep-link, a
 *      missing fix needs nothing but patience — and a race has thrown the
 *      distinction away before the caller sees it.
 *
 *   2. THE LOSING TIMER KEEPS RUNNING. A fast fix leaves a ten-second timer
 *      alive, holding a closure over the whole screen, firing into a promise
 *      that has already settled. On a screen that can be opened repeatedly this
 *      accumulates.
 *
 *   3. A LATE RESULT STILL RESOLVES. The call that timed out does not stop; it
 *      answers eventually, and with a bare race that answer resolves a promise
 *      that has already been decided. The caller sees a stale position arrive
 *      after it has already fallen back, and overwrites its state with it.
 *
 * This helper returns `null` on timeout instead, clears its timer on every path,
 * and swallows a result that arrives too late. A genuine rejection from the OS
 * still rejects, so real errors are not converted into silence.
 *
 * ── IT IS PURE, AND THAT IS THE POINT ───────────────────────
 *
 * No React, no `expo-location`, no WebView: a promise and a number. That is what
 * makes the interesting cases — times out, resolves in time, rejects, resolves
 * late — checkable in scripts/verify-location-timeout.cjs rather than by
 * driving a phone into a basement. A bug whose only symptom is "it waits
 * forever, silently" is exactly the kind that needs a test, because nothing in
 * the app ever reports it.
 */

/**
 * Resolves with the promise's value, or `null` if `ms` elapses first.
 *
 * Rejects only if the underlying promise rejects.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve, reject) => {
    // Guards BOTH settle paths, so whichever arrives first wins and the other
    // is a no-op. Without it, a late resolution would call `resolve` a second
    // time — harmless to the promise, but the work around it is not.
    let settled = false;

    const timer = setTimeout(() => {
      settled = true;
      resolve(null);
    }, ms);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
