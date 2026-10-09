import * as SecureStore from "expo-secure-store";

import { currentSession, onSessionChange } from "../api/client";
import { getActingOrgId, onActingOrgChange } from "../api/org-context";
import { withTimeout } from "../api/timeout";
import type { ViewerReputation } from "../api/types";
import { parseOpeningTier, resolveOpeningTier, type OpeningTier } from "./opening-tier";

/**
 * The opening tier, cached on the phone for the NEXT cold start.
 *
 * ── READ ONCE AT BOOT, NEVER WAITED ON BY A REQUEST ─────────────────────────
 *
 * The film is chosen from what the previous launch last wrote, so it can start
 * before the session, the API base or profile/me have been touched. Nothing
 * here ever delays it on a network: `readOpeningTier()` is one SecureStore
 * read with a deadline, and every failure -- a throw, a wedged Keystore, a
 * value from some other build -- is "normal".
 *
 * Updates land during the session (./useOpeningTierSync and the two direct
 * writers below) and only ever change the cache. The film already playing is
 * not swapped.
 *
 * ── SecureStore, SAME PATTERN AS baylo.acting_org ───────────────────────────
 *
 * No new native module: AsyncStorage is not in this app. The value is not a
 * secret; it lives beside the acting-org id because both are cleared by the
 * same sign-out. See ../api/org-context for the longer argument.
 *
 * ── WRITES ARE SERIALISED ───────────────────────────────────────────────────
 *
 * Sign-out issues two in the same tick: clearing the acting org re-resolves the
 * tier (see `onActingOrgChange` below), and then the reset writes "normal". Two
 * unordered native writes could land the other way round and leave a shop's
 * film cached on a signed-out phone, so every write joins one chain.
 */

const TIER_KEY = "baylo.openingTier";

/**
 * Well under the intro's 3s ready budget, which this read is spent out of. A
 * healthy read is tens of milliseconds; past this it is stuck, and the normal
 * film is a better answer than a later one.
 */
const READ_TIMEOUT_MS = 800;

let boot: Promise<OpeningTier> | null = null;

/**
 * The tier the previous launch left behind. Memoised: the first caller starts
 * the read (app/_layout, at module scope, so it overlaps the font load) and
 * every later caller gets the same answer. Never rejects.
 */
export function readOpeningTier(): Promise<OpeningTier> {
  boot ??= withTimeout(SecureStore.getItemAsync(TIER_KEY), READ_TIMEOUT_MS, "Reading the opening tier")
    .then(parseOpeningTier)
    .catch(() => "normal" as const);
  return boot;
}

let writes: Promise<void> = Promise.resolve();

function writeTier(tier: OpeningTier): void {
  writes = writes
    .then(() => SecureStore.setItemAsync(TIER_KEY, tier))
    .catch(() => {
      // A failed write costs the right film on the next launch and nothing
      // else; the next launch then reads whatever is there, or "normal".
    });
}

/**
 * The person's Premium standing as last served this process, or undefined
 * while it is unknown. Unknown is not "no Premium": re-resolving on unknown
 * would cache "normal" for a Premium user every time they switched back to
 * themselves before profile/me had answered.
 */
let reputation: Pick<ViewerReputation, "premium" | "vip"> | undefined;
let reputationFor: string | null = null;

function persist(): void {
  const session = currentSession();
  const actingOrgId = getActingOrgId();
  // Signed in as yourself with standing unknown: there is nothing to write yet.
  // Acting as a shop needs no standing -- the shop's film wins either way.
  if (session && !actingOrgId && reputation === undefined) return;
  writeTier(resolveOpeningTier({ signedIn: !!session, actingOrgId, reputation }));
}

/**
 * profile/me answered (a login, a refresh, the paywall's own read). The
 * standing is held against the user it came from so a different account
 * signing in on this phone starts unknown again.
 */
export function noteOpeningReputation(next: Pick<ViewerReputation, "premium" | "vip">): void {
  reputation = { premium: next.premium, vip: next.vip };
  reputationFor = currentSession()?.user.id ?? null;
  persist();
}

/** Sign-out. Called beside `clearActingOrg()` in src/auth/session. */
export function resetOpeningTier(): void {
  reputation = undefined;
  reputationFor = null;
  writeTier("normal");
}

// Switching personal <-> shop, and the 403 handler dropping a revoked context:
// the cache follows the identity immediately, not on the next profile/me read.
onActingOrgChange(persist);

// Any way the session ends -- the Sign out button, or the refresh interceptor
// giving up on a revoked token, which never goes through signOut() -- resets
// the cache. A rotation (same user, new tokens) keeps the standing; a different
// user does not inherit it.
onSessionChange((session) => {
  if (!session) {
    resetOpeningTier();
  } else if (reputationFor && session.user.id !== reputationFor) {
    reputation = undefined;
    reputationFor = null;
  }
});
