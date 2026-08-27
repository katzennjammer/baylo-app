import * as SecureStore from "expo-secure-store";

/**
 * Where the app points, and how that survives a reload.
 *
 * `EXPO_PUBLIC_API_URL` is read at BUILD time — Metro substitutes the literal
 * into the bundle — so it is a default, not a setting. That is fine until the
 * thing it names stops answering, which on this project is routine rather than
 * exceptional: `adb reverse tcp:3000 tcp:3000` drops on every replug, reboot
 * and adb restart, and the recovery is to point the app at a LAN IP instead.
 * Doing that through `.env` costs a Metro restart with `--clear`, on a machine
 * that may not be the one in reach.
 *
 * So the override lives here: written from the gear on the login screen, read
 * back at boot, and layered over the compiled-in default. SecureStore rather
 * than AsyncStorage only because it is already a dependency and already the
 * place this app keeps things it must not lose — the URL is not a secret, and
 * nothing here pretends otherwise.
 *
 * ONE MIRROR, LIKE THE SESSION. `src/api/client.ts` builds a URL on every
 * request from a synchronous function, and SecureStore is async. The in-memory
 * value is the read path; the store is the durable one; `hydrateApiBase()` at
 * boot is what connects them. A request that fires before hydration sees the
 * compiled-in default, which is why hydration is awaited alongside the session
 * rather than fired off beside it.
 */

const API_BASE_KEY = "baylo.apiBaseUrl";

/** Trailing slashes off, once, so `${base}/api/v1/home` cannot become `//api`. */
function normalise(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** The value compiled into the bundle. The floor the override sits on. */
export const defaultApiBase = normalise(process.env.EXPO_PUBLIC_API_URL ?? "");

let override: string | null = null;
let hydrated = false;

type BaseListener = (base: string) => void;
const listeners = new Set<BaseListener>();

/** Subscribes to base-URL changes. Returns its own unsubscribe. */
export function onApiBaseChange(listener: BaseListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish() {
  for (const listener of listeners) listener(getApiBase());
}

/** The URL every request is built on. Synchronous by requirement. */
export function getApiBase(): string {
  return override ?? defaultApiBase;
}

/** True when the app is pointed somewhere other than the compiled-in default. */
export function isApiBaseOverridden(): boolean {
  return override !== null && override !== defaultApiBase;
}

/** Whether SecureStore has been read yet. The gear shows a spinner until it has. */
export function isApiBaseHydrated(): boolean {
  return hydrated;
}

/** Reads the stored override into the mirror. Called once, at boot. */
export async function hydrateApiBase(): Promise<string> {
  try {
    const stored = await SecureStore.getItemAsync(API_BASE_KEY);
    override = stored ? normalise(stored) : null;
  } catch {
    // A store that cannot be read is not a reason to fail to start. The
    // compiled-in default is a working URL on at least one setup, which is
    // strictly better than no URL at all.
    override = null;
  }
  hydrated = true;
  publish();
  return getApiBase();
}

/**
 * Validation, and the shape of it is deliberate.
 *
 * Rejected: anything that is not http(s), and `localhost` is NOT among them.
 * `http://localhost:3000` is the correct value on this project's primary setup
 * — USB with `adb reverse` — so a validator that "helpfully" refused it would
 * block the normal case to catch a mistake the README already covers.
 */
export function validateApiBase(raw: string): string | null {
  const value = normalise(raw);
  if (!value) return "Enter a URL, or reset to the built-in one.";

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "That is not a URL. It needs the scheme too — http://192.168.1.10:3000";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Only http:// and https:// URLs work here.";
  }
  if (!parsed.hostname) return "That URL has no host.";
  return null;
}

/** Persists an override and swaps the mirror. Rejects an invalid URL. */
export async function setApiBase(raw: string): Promise<void> {
  const problem = validateApiBase(raw);
  if (problem) throw new Error(problem);

  const value = normalise(raw);
  override = value;
  publish();
  await SecureStore.setItemAsync(API_BASE_KEY, value);
}

/** Drops the override and goes back to the compiled-in default. */
export async function resetApiBase(): Promise<void> {
  override = null;
  publish();
  await SecureStore.deleteItemAsync(API_BASE_KEY);
}

/**
 * Asks the server whether it is there. Used by the gear's "Test" button.
 *
 * Hits `/api/auth/token` with a deliberately empty body: it needs no session,
 * it exists on every deployment of this backend, and a 400 back from it is
 * proof of exactly what is being tested — something on the other end parsed
 * the request. A 200 would be alarming. Only a transport failure is a failure.
 */
export async function pingApiBase(base: string): Promise<{ ok: boolean; detail: string }> {
  const problem = validateApiBase(base);
  if (problem) return { ok: false, detail: problem };

  try {
    const res = await fetch(`${normalise(base)}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({}),
      credentials: "omit",
    });
    return { ok: true, detail: `Reachable — answered ${res.status}.` };
  } catch (cause) {
    return {
      ok: false,
      detail: `No answer. ${cause instanceof Error ? cause.message : String(cause)}`,
    };
  }
}
