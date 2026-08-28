/**
 * A deadline for work that has no cancel.
 *
 * WHY THIS EXISTS. The boot path reads SecureStore three times through
 * `Promise.all`, and a native call that never calls back does not reject — it
 * simply never settles. `.finally()` is no defence against that: it runs on
 * rejection, not on silence. The symptom is the whole app parked on the splash
 * screen with no error and no request, which is indistinguishable from a slow
 * network and impossible to diagnose from the device.
 *
 * NOTHING IS ABORTED. `work` keeps running after the race is lost, because the
 * things this wraps are native module calls with no AbortSignal to give them.
 * That is deliberate and it is fine: a late-settling SecureStore read still
 * reaches the session module and still publishes, so a session that arrives
 * after the deadline moves the app off the login screen instead of being lost.
 * The timeout decides when to STOP WAITING, not when to give up on the answer.
 */

export class TimeoutError extends Error {
  constructor(
    readonly label: string,
    readonly ms: number,
  ) {
    super(`${label} did not finish within ${ms}ms.`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });

  // clearTimeout in a finally, not in the then: a timer left pending keeps the
  // JS runtime's queue alive and, on a fast path, fires long after anyone cares.
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}
