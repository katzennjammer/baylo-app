import * as SecureStore from "expo-secure-store";

/**
 * Where the token pair lives.
 *
 * expo-secure-store, and deliberately not AsyncStorage. AsyncStorage is a plain
 * unencrypted file inside the app sandbox — readable from any rooted or
 * jailbroken device, and readable straight out of an `adb backup` on a device
 * that is neither. SecureStore puts the value in the Android Keystore /
 * iOS Keychain, so the bytes on disk are encrypted with a key the app cannot
 * export.
 *
 * That matters more here than it would elsewhere because of what these two
 * strings are. The access token is a bearer credential: whoever holds it IS the
 * user for the next 15 minutes, with no second factor and no way to revoke it
 * (the server verifies the signature and never consults a list — see
 * `auth-tokens.ts`). The refresh token is worse: 30 days, and it mints new
 * access tokens on demand.
 *
 * WHY EVERYTHING IS AWAITED THROUGH ONE OBJECT. The Keychain round-trip is
 * genuinely slow — single-digit milliseconds, but on every request that adds
 * up and it is async, so it cannot happen inside a synchronous header builder.
 * `src/api/client.ts` therefore holds an in-memory mirror and treats this
 * module as the place the mirror is loaded from at boot and written back to on
 * change, not as a per-request lookup.
 */

const ACCESS_KEY = "baylo.accessToken";
const REFRESH_KEY = "baylo.refreshToken";
const USER_KEY = "baylo.user";

/** The user block every token endpoint returns alongside the pair. */
export interface StoredUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface StoredSession extends TokenPair {
  user: StoredUser;
}

export async function loadSession(): Promise<StoredSession | null> {
  const [accessToken, refreshToken, rawUser] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
    SecureStore.getItemAsync(USER_KEY),
  ]);

  // A half-written session is treated as no session. The three values are
  // written together but not atomically, and a client that boots holding an
  // access token with no refresh token would work for fifteen minutes and then
  // wedge on a refresh it cannot perform.
  if (!accessToken || !refreshToken || !rawUser) return null;

  try {
    return { accessToken, refreshToken, user: JSON.parse(rawUser) as StoredUser };
  } catch {
    // Corrupt user JSON. Same call: no session.
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, session.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, session.refreshToken),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(session.user)),
  ]);
}

/**
 * Writes only the pair, leaving the stored user alone.
 *
 * This is the rotation path. /api/auth/refresh returns a user block too, but
 * the refresh happens mid-flight underneath an arbitrary screen, and rewriting
 * the user there would let a stale field from a token endpoint overwrite fresher
 * data the app already has.
 */
export async function saveTokens(pair: TokenPair): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, pair.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, pair.refreshToken),
  ]);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}
