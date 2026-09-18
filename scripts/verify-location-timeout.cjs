/**
 * Acceptance harness for the location timeout helper.
 *
 * Run:  npx tsx scripts/verify-location-timeout.cjs
 *
 * ── WHY THIS FILE EXISTS ────────────────────
 *
 * `withTimeout` was written to fix a bug with no error message. The marketplace
 * map awaited `Location.getCurrentPositionAsync` directly, that call does not
 * reliably reject when there is no fix, and the result was a screen permanently
 * reading "Finding nearby Safe Zones…" — a claim that had quietly stopped being
 * true. Nothing threw, nothing logged, `tsc` was happy, and the map document
 * harness passed, because none of that was ever wrong. The only way to see it
 * was to hold a phone with no fix and wait.
 *
 * That is precisely the class of bug that needs a test, so the helper it lives
 * in is pure — a promise and a number — and the four cases that matter are
 * checked here instead of on a device in a basement:
 *
 *   §1  resolves in time         the normal path still returns the value
 *   §2  times out                returns null, does NOT throw
 *   §3  rejects                  a real OS failure still propagates
 *   §4  resolves too late        the late value is discarded, not resolved
 *
 * CommonJS + `npx tsx`, matching verify-map-document.cjs. No react-native stub
 * is needed here: this module imports nothing at all.
 */

const assert = require("assert");

const { withTimeout } = require("../src/lib/with-timeout.ts");

// ── harness ──────────────────

let failures = 0;
async function check(label, fn) {
  try {
    await fn();
    console.log(`  ok    ${label}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL  ${label}`);
    console.log(`        ${String(err.message).split("\n")[0]}`);
  }
}

const never = () => new Promise(() => {});
const after = (ms, value) => new Promise((r) => setTimeout(() => r(value), ms));

/**
 * All checks live in one async main() rather than at module top level.
 *
 * The top-level `await` this replaced made Node classify the .cjs file as ESM
 * to execute it, which then collided with tsx's own require hook —
 * ERR_REQUIRE_CYCLE_MODULE, from a file that only wanted to await a promise.
 * An async entry point keeps the file unambiguously CommonJS.
 */
async function main() {

/* ── §1 ─────────────────── */

console.log("\n§1  a fix that arrives in time\n");

await check("resolves with the value when it beats the timeout", async () => {
  const got = await withTimeout(after(10, "coords"), 200);
  assert.equal(got, "coords");
});

await check("an already-resolved promise passes straight through", async () => {
  const got = await withTimeout(Promise.resolve(42), 200);
  assert.equal(got, 42);
});

await check("a resolved `undefined` is returned, not turned into null", async () => {
  // The distinction matters at the call site: `null` means "no answer in time",
  // which is a decision the screen acts on. Conflating the two would make a
  // legitimate falsy result indistinguishable from a timeout.
  const got = await withTimeout(Promise.resolve(undefined), 200);
  assert.strictEqual(got, undefined);
  assert.notStrictEqual(got, null);
});

/* ── §2 ─────────────────── */

console.log("\n§2  no fix in time — the case that hung the map\n");

await check("resolves to null rather than throwing", async () => {
  const got = await withTimeout(never(), 30);
  assert.strictEqual(got, null);
});

await check("actually waits about the timeout before giving up", async () => {
  const started = Date.now();
  await withTimeout(never(), 60);
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 50, `gave up after only ${elapsed}ms`);
});

await check("does not reject, so it cannot land in a caller's catch", async () => {
  // The whole point: a timeout must not look like a permission denial.
  let threw = false;
  try {
    await withTimeout(never(), 20);
  } catch {
    threw = true;
  }
  assert.equal(threw, false, "a timeout threw — it must resolve to null");
});

/* ── §3 ─────────────────── */

console.log("\n§3  a real failure\n");

await check("a rejection still rejects", async () => {
  let caught = null;
  try {
    await withTimeout(Promise.reject(new Error("permission denied")), 200);
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, "the rejection was swallowed");
  assert.equal(caught.message, "permission denied");
});

await check("a rejection AFTER the timeout is swallowed, not rethrown", async () => {
  // By then the caller has already moved on and drawn the fallback. An
  // unhandled rejection here would surface as a crash on a screen that is
  // working correctly.
  const late = new Promise((_, reject) => setTimeout(() => reject(new Error("too late")), 40));
  const got = await withTimeout(late, 15);
  assert.strictEqual(got, null);
  // Give the late rejection time to fire and be ignored.
  await after(60);
});

/* ── §4 ─────────────────── */

console.log("\n§4  a fix that arrives too late\n");

await check("the late value is discarded, not resolved", async () => {
  // `Promise.race` with a rejecting timer does NOT do this: the losing promise
  // still resolves, so the caller can receive a stale position after it has
  // already fallen back to showing every hub. That stale write is how a map
  // moves under someone who has stopped interacting with it.
  let deliveredAfterTimeout = null;
  const slow = after(80, "stale-coords");

  const got = await withTimeout(slow, 20);
  assert.strictEqual(got, null, "timed out, as expected");

  // Whatever the slow promise does now, the helper has already decided.
  slow.then((v) => {
    deliveredAfterTimeout = v;
  });
  await after(120);
  assert.equal(deliveredAfterTimeout, "stale-coords", "the slow promise itself still settled");
  assert.strictEqual(got, null, "the helper's answer must not change");
});

  console.log(
    failures === 0 ? "\n  all checks passed\n" : `\n  ${failures} check(s) FAILED\n`,
  );

  process.exit(failures === 0 ? 0 : 1);
}

main();
