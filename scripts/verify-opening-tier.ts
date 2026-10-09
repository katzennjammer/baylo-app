/**
 * The opening film's tier rule, the cached value's parse, the "/" fork's
 * replay guard, and the cache's writes. No device, router, player or server:
 * SecureStore is an in-memory Map (scripts/securestore-fake.cjs).
 *
 *   npm run verify:opening
 *   (node --require ./scripts/rn-stub.cjs --require ./scripts/securestore-fake.cjs
 *         --import tsx scripts/verify-opening-tier.ts)
 */
import { adoptSession, signOut } from "../src/api/client";
import { clearActingOrg, setActingOrgId } from "../src/api/org-context";
import { bootRoute, introPending, markIntroPlayed } from "../src/media/intro-gate";
import { parseOpeningTier, resolveOpeningTier, type OpeningTier } from "../src/media/opening-tier";
import { noteOpeningReputation, readOpeningTier, resetOpeningTier } from "../src/media/opening-tier-store";

let failed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : ` — got ${String(actual)}, expected ${String(expected)}`}`);
}

console.log("resolveOpeningTier");
const tier = (input: Parameters<typeof resolveOpeningTier>[0]): OpeningTier => resolveOpeningTier(input);
check("logged out -> normal", tier({ signedIn: false, actingOrgId: null }), "normal");
check(
  "logged out with a stale acting org and Premium -> normal",
  tier({ signedIn: false, actingOrgId: "org_1", reputation: { premium: true, vip: true } }),
  "normal",
);
check("normal (no reputation yet) -> normal", tier({ signedIn: true, actingOrgId: null }), "normal");
check(
  "normal (premium false, vip false) -> normal",
  tier({ signedIn: true, actingOrgId: null, reputation: { premium: false, vip: false } }),
  "normal",
);
check(
  "normal (older server: fields missing) -> normal",
  tier({ signedIn: true, actingOrgId: null, reputation: {} }),
  "normal",
);
check("premium -> premium", tier({ signedIn: true, actingOrgId: null, reputation: { premium: true } }), "premium");
check(
  "vip without a premium row -> premium",
  tier({ signedIn: true, actingOrgId: null, reputation: { premium: false, vip: true } }),
  "premium",
);
check("acting org -> msme", tier({ signedIn: true, actingOrgId: "org_1" }), "msme");
check(
  "premium + acting org -> msme",
  tier({ signedIn: true, actingOrgId: "org_1", reputation: { premium: true } }),
  "msme",
);
check(
  "vip + acting org -> msme",
  tier({ signedIn: true, actingOrgId: "org_1", reputation: { vip: true } }),
  "msme",
);

console.log("parseOpeningTier (the cached value)");
check("'normal'", parseOpeningTier("normal"), "normal");
check("'premium'", parseOpeningTier("premium"), "premium");
check("'msme'", parseOpeningTier("msme"), "msme");
check("missing (null) -> normal", parseOpeningTier(null), "normal");
check("missing (undefined) -> normal", parseOpeningTier(undefined), "normal");
check("empty string -> normal", parseOpeningTier(""), "normal");
check("wrong case 'PREMIUM' -> normal", parseOpeningTier("PREMIUM"), "normal");
check("padded ' msme' -> normal", parseOpeningTier(" msme"), "normal");
check("unknown 'vip' -> normal", parseOpeningTier("vip"), "normal");
check("JSON-ish '\"premium\"' -> normal", parseOpeningTier('"premium"'), "normal");
check("a number -> normal", parseOpeningTier(1), "normal");

console.log("bootRoute (the '/' fork) and the replay guard");
// Every combination of the other three inputs, before and after the intro has
// been marked. Before: /intro whenever video is available. After: NEVER /intro.
check("fresh process: intro pending", introPending(), true);
const combos: { videoAvailable: boolean; isLoading: boolean; signedIn: boolean }[] = [];
for (const videoAvailable of [true, false])
  for (const isLoading of [true, false])
    for (const signedIn of [true, false]) combos.push({ videoAvailable, isLoading, signedIn });

for (const c of combos) {
  const r = bootRoute({ introPending: introPending(), ...c });
  const expected = c.videoAvailable
    ? "/intro"
    : c.isLoading
      ? "splash"
      : c.signedIn
        ? "/(app)/home"
        : "/(auth)/login";
  check(`before: video=${c.videoAvailable} loading=${c.isLoading} signedIn=${c.signedIn}`, r, expected);
}

// What intro.tsx's leave() does, in its order: lower the flag, THEN navigate
// to "/". The fork that navigation lands on must not answer "/intro".
markIntroPlayed();
check("after the intro's exit: intro no longer pending", introPending(), false);
for (const c of combos) {
  const r = bootRoute({ introPending: introPending(), ...c });
  check(`after: video=${c.videoAvailable} loading=${c.isLoading} signedIn=${c.signedIn} is not /intro`, r !== "/intro", true);
}
// Idempotent: a second exit (two timers in one frame) changes nothing.
markIntroPlayed();
check("marking twice keeps it played", introPending(), false);
check(
  "after, signed in and loaded -> home",
  bootRoute({ introPending: introPending(), videoAvailable: true, isLoading: false, signedIn: true }),
  "/(app)/home",
);
check(
  "after, signed out and loaded -> login",
  bootRoute({ introPending: introPending(), videoAvailable: true, isLoading: false, signedIn: false }),
  "/(auth)/login",
);
check(
  "after, still loading -> splash",
  bootRoute({ introPending: introPending(), videoAvailable: true, isLoading: true, signedIn: false }),
  "splash",
);

// ── The cache itself, against an in-memory SecureStore ──────────────────────
//
// scripts/securestore-fake.cjs swaps the Keystore for a Map, so what the app
// WROTE can be read back. Sessions are installed with the client's own
// adoptSession() and dropped with signOut({ revoke: false }): no request is
// made, and nothing leaves this process.
const KEY = "baylo.openingTier";
const fakeStore = (globalThis as unknown as { __secureStore: Map<string, string> }).__secureStore;
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 10));
const cached = () => fakeStore.get(KEY);

const userA = { id: "user_a", name: "A", email: "a@example.test", image: null };
const userB = { id: "user_b", name: "B", email: "b@example.test", image: null };
const sessionOf = (user: typeof userA) => ({ accessToken: "at", refreshToken: "rt", user });

async function storeChecks() {
  console.log("opening-tier-store (in-memory SecureStore)");

  // The boot read: a value some other build left behind is "normal".
  fakeStore.set(KEY, "garbage");
  check("boot read of an invalid cached value -> normal", await readOpeningTier(), "normal");
  check("boot read is memoised (same answer, no second read)", await readOpeningTier(), "normal");

  await adoptSession(sessionOf(userA));
  await settle();
  check("signed in, standing unknown: nothing written yet", cached(), "garbage");

  // As myself, standing unknown: a switch back to myself must NOT guess.
  await setActingOrgId(null);
  await settle();
  check("switch to myself with standing unknown writes nothing", cached(), "garbage");

  noteOpeningReputation({ premium: true, vip: false });
  await settle();
  check("profile/me says premium -> premium", cached(), "premium");

  await setActingOrgId("org_1");
  await settle();
  check("switch to a shop writes msme immediately", cached(), "msme");

  await setActingOrgId(null);
  await settle();
  check("switch back to myself -> premium (standing remembered)", cached(), "premium");

  noteOpeningReputation({ premium: false, vip: true });
  await settle();
  check("vip only -> premium", cached(), "premium");

  noteOpeningReputation({ premium: false, vip: false });
  await settle();
  check("standing lapses -> normal", cached(), "normal");

  noteOpeningReputation({ premium: true });
  await setActingOrgId("org_1");
  await settle();
  check("premium + acting org -> msme", cached(), "msme");

  // Sign-out, in session.tsx's order: the client drops the session, then the
  // acting org is cleared (which re-resolves), then the explicit reset.
  await signOut({ revoke: false });
  clearActingOrg();
  resetOpeningTier();
  await settle();
  check("sign-out from a shop -> normal (the last of the serialised writes)", cached(), "normal");

  // A different account on the same phone does not inherit A's standing.
  await adoptSession(sessionOf(userA));
  noteOpeningReputation({ premium: true });
  await settle();
  check("user A premium -> premium", cached(), "premium");
  await setActingOrgId("org_1");
  await settle();
  check("user A acting as a shop -> msme", cached(), "msme");
  // If B inherited A's standing, this switch would write "premium". Unknown
  // standing writes nothing, so the cache stays where A left it.
  await adoptSession(sessionOf(userB));
  await setActingOrgId(null);
  await settle();
  check("user B (standing unknown) switching to myself does not inherit A's premium", cached(), "msme");
  noteOpeningReputation({ premium: false });
  await settle();
  check("user B's own standing -> normal", cached(), "normal");

  // The session ending WITHOUT signOut() in session.tsx (the refresh
  // interceptor giving up): the client's publish(null) alone resets it.
  noteOpeningReputation({ premium: true });
  await settle();
  check("user B premium -> premium", cached(), "premium");
  await signOut({ revoke: false });
  await settle();
  check("session ends without the provider's signOut -> normal", cached(), "normal");
}

void storeChecks()
  .catch((err) => {
    failed++;
    console.log(`  FAIL store checks threw: ${err instanceof Error ? err.stack : String(err)}`);
  })
  .then(() => {
    console.log(failed ? `\n${failed} FAILED` : "\nall checks passed");
    // The app's tsconfig has no Node types; see verify-trade-sides.ts.
    (globalThis as unknown as { process: { exit(code: number): never } }).process.exit(failed ? 1 : 0);
  });
