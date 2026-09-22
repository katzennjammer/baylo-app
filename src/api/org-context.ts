import * as SecureStore from "expo-secure-store";

/**
 * Which organisation this client is acting as, if any.
 *
 * ── A HEADER, NOT A TOKEN CLAIM ─────────────────────────────────────────────
 *
 * The server does not bake the acting organisation into the access token, and
 * this module is the client half of that decision. Its header explains the
 * whole reason: access tokens live 15 minutes and are stateless, so an
 * organisation baked into one would keep working for the rest of that token's
 * life after an owner removed the staff member — and switching organisations
 * would cost a re-mint. Instead the client NAMES the org it wants on every
 * request, and the server re-reads the ACTIVE membership row before honouring
 * it.
 *
 * So this value is a REQUEST, never a grant. Nothing here decides anything: a
 * stale id, a revoked membership or a made-up string all come back as a 403
 * from whichever endpoint was called, and `clearActingOrg()` is what a caller
 * does about it.
 *
 * ── MODULE STATE, READ SYNCHRONOUSLY ────────────────────────────────────────
 *
 * `toHeaderRecord()` in ./client builds headers synchronously and is on every
 * request in the app, so this cannot be an async read. The id is held in a
 * module variable, hydrated once at startup by `restoreActingOrg()`, and
 * written through to SecureStore on every change. Exactly the arrangement
 * `getApiBase()` uses next door, and for the same reason.
 *
 * ── WHY SecureStore AND NOT AsyncStorage ────────────────────────────────────
 *
 * Not because an organisation id is a secret — it is not. Because it lives
 * beside the session it qualifies: a token pair in the Keystore and an acting
 * context in plain storage can be cleared independently, and the state that
 * leaves behind is a client that keeps asking to act as an organisation for an
 * account that has been signed out. One store, one lifecycle, cleared by the
 * same sign-out.
 */

const ORG_KEY = "baylo.acting_org";

/** The header the server reads. Must match ORG_CONTEXT_HEADER on the API. */
export const ORG_CONTEXT_HEADER = "X-Baylo-Org";

let actingOrgId: string | null = null;

/** The organisation this client is acting as, or null for "as myself". */
export function getActingOrgId(): string | null {
  return actingOrgId;
}

/**
 * Switch context. Null means "act as myself", which is the default and the
 * state every new session starts in.
 *
 * The write to SecureStore is deliberately NOT awaited by callers that only
 * need the switch to take effect — the module variable is updated first, so
 * the very next request already carries the new header. Persistence is about
 * surviving a restart, not about the switch.
 */
export async function setActingOrgId(id: string | null): Promise<void> {
  actingOrgId = id;
  try {
    if (id) await SecureStore.setItemAsync(ORG_KEY, id);
    else await SecureStore.deleteItemAsync(ORG_KEY);
  } catch {
    // A failed write costs the choice on next launch and nothing else. The
    // in-memory value is already correct, so the current session is unaffected
    // and there is nothing useful to tell the user.
  }
}

/** Hydrate from storage. Call once at startup, before the first request. */
export async function restoreActingOrg(): Promise<void> {
  try {
    actingOrgId = await SecureStore.getItemAsync(ORG_KEY);
  } catch {
    actingOrgId = null;
  }
}

/**
 * Drop the context. Called on sign-out and whenever the server refuses it.
 *
 * SYNCHRONOUS IN EFFECT: the module variable is cleared before the await, so a
 * request issued in the same tick as a 403 no longer carries the dead header.
 * A retry that still sent it would fail identically and look like a loop.
 */
export function clearActingOrg(): void {
  actingOrgId = null;
  void SecureStore.deleteItemAsync(ORG_KEY).catch(() => {});
}
