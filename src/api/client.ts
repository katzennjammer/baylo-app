import { getApiBase } from "./config";
import {
  clearSession,
  loadSession,
  saveSession,
  saveTokens,
  type StoredSession,
  type StoredUser,
} from "../auth/storage";

/**
 * The one place a request leaves this app.
 *
 * Three jobs: put the base URL on the front, put the Bearer token on the
 * header, and deal with the 401 that comes back when that token has aged out.
 * The third is the only interesting one, and the note above refreshOnce() is
 * the note worth reading.
 *
 * NO COOKIES, EVER. Every fetch below passes `credentials: "omit"`. React
 * Native's fetch sits on a native HTTP stack with a real cookie jar (OkHttp's
 * CookieManager on Android, NSHTTPCookieStorage on iOS), so a Set-Cookie the
 * server sends for any reason would be stored and replayed on subsequent
 * requests to the same host. That must not happen: the server's
 * resolveSession() accepts either a Bearer token or a NextAuth cookie, and if a
 * cookie ever got into the jar this client would start authenticating as
 * whoever that cookie belongs to whenever the Bearer path failed — silently,
 * and only on device. The Bearer header is the only credential this app has.
 */

// ── Configuration ────────────────────────────────────────────────────────────

/**
 * The base URL is NOT a constant here any more. See `./config.ts`.
 *
 * It used to be `process.env.EXPO_PUBLIC_API_URL` read once at module scope,
 * which made it a build-time value: changing it meant editing `.env` and
 * restarting Metro with `--clear`. That is the wrong shape for the thing it
 * actually is on this project — the address of a dev server behind an
 * `adb reverse` tunnel that drops on every replug. `getApiBase()` returns the
 * stored override if there is one and the compiled-in default otherwise, so
 * the gear on the login screen can repoint the app without a rebuild.
 *
 * Still synchronous, and still called per request rather than captured: a URL
 * captured in a closure at import time is the old bug wearing a function.
 */

// ── Errors ───────────────────────────────────────────────────────────────────

/**
 * One error type for every failure mode, carrying the server's stable `code`.
 *
 * The /api/v1 envelope's contract is that `code` is branchable and `message` is
 * not — the message may be reworded at any time. Screens branch on `code`;
 * `message` is only ever displayed.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /**
     * Per-field validation messages, when the server sent any.
     *
     * `parseBody()` on the server answers a failed schema with
     * `{ error, issues: [{ field, message }] }`, and the register screen puts
     * those against the inputs they name rather than in a banner — a password
     * that is too short belongs under the password box. Empty for every error
     * that is not a validation failure, which is most of them.
     */
    readonly issues: readonly FieldIssue[] = [],
    /** Seconds to wait, parsed from a 429's Retry-After. */
    readonly retryAfter: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** The message for one field, if the server complained about it. */
  issueFor(field: string): string | undefined {
    return this.issues.find((i) => i.field === field)?.message;
  }
}

export interface FieldIssue {
  field: string;
  message: string;
}

function requireBase(): string {
  const base = getApiBase();
  if (!base) {
    throw new ApiError(
      0,
      "CONFIG_ERROR",
      "No API URL is set. Tap the gear on the sign-in screen and enter one " +
        "(not localhost unless `adb reverse tcp:3000 tcp:3000` is running — " +
        "otherwise the phone resolves it to itself), or set " +
        "EXPO_PUBLIC_API_URL in .env and restart Metro with --clear.",
    );
  }
  return base;
}

/** The /api/v1 envelope. Success and failure share one shape. */
interface Envelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
  meta: Record<string, unknown>;
}

// ── In-memory session mirror ─────────────────────────────────────────────────

/**
 * The live copy of the session.
 *
 * SecureStore is async and slow enough to notice; reading it on every request
 * would put a Keychain round-trip in front of every screen. This mirror is the
 * read path, SecureStore is the durable one, and the two are written together.
 */
let memory: StoredSession | null = null;

type SessionListener = (session: StoredSession | null) => void;
const listeners = new Set<SessionListener>();

function publish() {
  for (const listener of listeners) listener(memory);
}

/** Subscribes to session changes. Returns its own unsubscribe. */
export function onSessionChange(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function currentSession(): StoredSession | null {
  return memory;
}

/** Rehydrates the mirror from SecureStore. Called once, at boot. */
export async function hydrateSession(): Promise<StoredSession | null> {
  memory = await loadSession();
  publish();
  return memory;
}

// ── Sign in / sign out ───────────────────────────────────────────────────────

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user: StoredUser;
}

function networkFailure(cause: unknown): never {
  throw new ApiError(
    0,
    "NETWORK_ERROR",
    `Could not reach ${getApiBase() || "the API"}. Check the URL behind the ` +
      `gear: over USB it needs \`adb reverse tcp:3000 tcp:3000\`, over Wi-Fi it ` +
      `must be this machine's LAN IP with the dev server bound to 0.0.0.0. ` +
      `(${cause instanceof Error ? cause.message : String(cause)})`,
  );
}

/**
 * The shape every legacy (non-v1) auth endpoint answers an error with.
 *
 * `{ error: string }`, sometimes with a `code` and sometimes with `issues`.
 * Nothing under /api/auth uses the v1 envelope — see the note on authenticate().
 */
type LegacyErrorBody = { error?: string; code?: string; issues?: FieldIssue[] };

/** Turns a non-2xx from an /api/auth endpoint into the one error type. */
async function legacyFailure(res: Response, fallback: string): Promise<never> {
  const body = (await res.json().catch(() => ({}))) as LegacyErrorBody;
  const header = res.headers.get("Retry-After");
  const retryAfter = header ? Number(header) : null;

  throw new ApiError(
    res.status,
    body.code ?? (res.status === 429 ? "RATE_LIMITED" : "REQUEST_FAILED"),
    body.error ?? fallback,
    Array.isArray(body.issues) ? body.issues : [],
    retryAfter !== null && Number.isFinite(retryAfter) ? retryAfter : null,
  );
}

/** A POST to an /api/auth endpoint: no Bearer header, no envelope. */
async function postAuth<T>(path: string, body: unknown, fallback: string): Promise<T> {
  // Resolved OUTSIDE the try. requireBase() throws a CONFIG_ERROR when no URL
  // is set at all, and inside the try that would be caught and reported as a
  // network failure — "could not reach ", with nothing after it, instead of
  // "no API URL is set, here is the gear".
  const url = `${requireBase()}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      credentials: "omit",
    });
  } catch (cause) {
    networkFailure(cause);
  }

  if (!res.ok) await legacyFailure(res, fallback);
  return (await res.json().catch(() => ({}))) as T;
}

function toSession(body: Partial<TokenResponse>, what: string): StoredSession {
  if (!body.accessToken || !body.refreshToken || !body.user) {
    throw new ApiError(200, "MALFORMED_RESPONSE", `${what} returned an unexpected response`);
  }
  return { accessToken: body.accessToken, refreshToken: body.refreshToken, user: body.user };
}

/**
 * Installs a session: memory, SecureStore, and everyone subscribed.
 *
 * Split out from signIn() because registration needs the two halves apart. The
 * register screen holds a real, valid session for the length of the "check your
 * email" step — it needs one, because /api/auth/resend-verification is
 * authenticated — but must NOT install it, since the guard in (auth)/_layout
 * redirects the instant a session exists and would tear that screen down before
 * the user has read a word of it. It calls this when they tap Continue.
 */
export async function adoptSession(session: StoredSession): Promise<StoredSession> {
  memory = session;
  await saveSession(session);
  publish();
  return session;
}

/**
 * POST /api/auth/token — email and password for a token pair. NOT installed.
 *
 * NOTE THE PATH. It is /api/auth/token, NOT /api/v1/auth/token: the token
 * endpoints predate the v1 tree and were never moved into it, so they also
 * return a bare object rather than the { data, error, meta } envelope that
 * everything under /api/v1 returns. That is why this function reads the body
 * directly and apiV1() below does not.
 *
 * The server's message is passed through untouched, and that is load-bearing:
 * 401 is always the deliberately vague "Invalid email or password" (telling the
 * two apart would make this endpoint an account-enumeration oracle), while 403
 * carries the real account state — suspended, deleted — and is the only place a
 * user is ever told which.
 */
export async function authenticate(email: string, password: string): Promise<StoredSession> {
  const body = await postAuth<Partial<TokenResponse>>(
    "/api/auth/token",
    { email, password },
    "Sign in failed",
  );
  return toSession(body, "Sign in");
}

/** authenticate() + adoptSession(). What the login screen calls. */
export async function signIn(email: string, password: string): Promise<StoredSession> {
  return adoptSession(await authenticate(email, password));
}

/**
 * POST /api/auth/google/token — a Google ID token for the same pair.
 *
 * The client runs the Google half itself (see `src/auth/google.ts`) and arrives
 * here holding an ID token. The server verifies its signature against Google's
 * JWKS, plus issuer, audience and expiry, before it means anything. This end
 * sends it and checks nothing, deliberately: any check performed here is one an
 * attacker skips by calling the endpoint directly.
 *
 * Installed immediately, unlike registration. Google sign-in verifies the
 * account server-side — markVerified() runs inside that route — so there is no
 * "check your email" step to hold open.
 */
export async function signInWithGoogle(idToken: string): Promise<StoredSession> {
  const body = await postAuth<Partial<TokenResponse>>(
    "/api/auth/google/token",
    { idToken },
    "Google sign-in failed",
  );
  return adoptSession(toSession(body, "Google sign-in"));
}

export interface RegisterResult {
  id: string;
  name: string;
  email: string;
  isVerified: boolean;
  /** False when SMTP failed. The account exists either way — offer a resend. */
  verificationEmailSent: boolean;
}

/**
 * POST /api/auth/register — creates the account and mails the link.
 *
 * Returns no tokens: registration and authentication are separate on this
 * backend, so the register screen calls authenticate() afterwards with the
 * credentials it already has. A 409 means the address is taken, a 400 carries
 * `issues` naming the offending field, and a 429 is the three-per-hour-per-IP
 * limit on account creation.
 */
export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
}): Promise<RegisterResult> {
  return postAuth<RegisterResult>("/api/auth/register", input, "Could not create the account");
}

export interface ResendResult {
  ok: boolean;
  alreadyVerified: boolean;
  sent: boolean;
}

/**
 * POST /api/auth/resend-verification, with an EXPLICIT token.
 *
 * The one authenticated call in this module that does not go through request(),
 * and it has to be: the caller is the register screen holding a session it has
 * deliberately not installed, so there is nothing in `memory` for the normal
 * path to attach. Taking the token as an argument is the honest way to say so.
 *
 * No refresh-on-401 either, and none is needed — the access token is minutes
 * old. A 401 here means the account is gone, not that the token aged out.
 *
 * Limited to three per hour per USER, not per IP, so a 429 is a real answer to
 * show rather than something to retry through.
 */
export async function resendVerification(accessToken: string): Promise<ResendResult> {
  const url = `${requireBase()}/api/auth/resend-verification`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
      credentials: "omit",
    });
  } catch (cause) {
    networkFailure(cause);
  }

  if (!res.ok) await legacyFailure(res, "Could not send the verification email");
  return (await res.json().catch(() => ({}))) as ResendResult;
}

export interface VerifyEmailResult {
  ok: boolean;
  verified: boolean;
  /** True when the account was already verified — nothing was credited. */
  alreadyVerified: boolean;
  /** Leaves credited by THIS redemption. 0 on a repeat. */
  leavesAwarded: number;
}

/**
 * POST /api/auth/verify-email — redeems a token the app captured from a link.
 *
 * The same token the emailed link carries, sent as JSON instead of followed as
 * a URL. Unauthenticated by design: the token IS the credential, and the app is
 * quite likely signed out when the link is opened.
 */
export async function verifyEmailToken(token: string): Promise<VerifyEmailResult> {
  return postAuth<VerifyEmailResult>(
    "/api/auth/verify-email",
    { token },
    "That verification link did not work",
  );
}

/** How long the revoke request gets before the logout stops waiting for it. */
const REVOKE_TIMEOUT_MS = 6000;

/**
 * POST /api/auth/revoke — kills the whole token family, not just this token.
 *
 * Never throws and never reports. The endpoint answers 200 for a token that
 * does not exist and 200 for one already revoked — logout is idempotent, and
 * saying otherwise would make it a free validity oracle for anyone holding a
 * stolen string — so the only failure it can have is "the request did not
 * arrive", which is precisely the case the caller has already decided to sign
 * out through.
 *
 * The AbortController is not decoration. React Native's fetch has no default
 * timeout, and the interesting offline case is not a phone in flight mode —
 * that fails in milliseconds — but one associated to a captive-portal Wi-Fi:
 * fully connected, routing nowhere, the request hanging until the OS socket
 * timeout. On Android that is measured in minutes.
 */
async function revokeFamily(base: string, refreshToken: string): Promise<void> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REVOKE_TIMEOUT_MS);

  try {
    await fetch(`${base}/api/auth/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
      credentials: "omit",
      signal: abort.signal,
    });
  } catch {
    // Offline, wrong base URL, or the timeout above. None of it is fixable from
    // here, and the note on signOut() says why none of it is fatal.
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sign out: revoke the family server-side, and forget everything locally.
 *
 * THE ORDERING IS THE WHOLE FUNCTION. The revoke is *started* first, because it
 * needs the refresh token and the local clear is about to destroy it — but it
 * is not awaited until the end. Everything in between is therefore
 * unconditional: a server that is down, slow or misaddressed cannot skip the
 * clear, and neither can an exception thrown out of the fetch.
 *
 * That is the rule this function exists to hold. A logout that leaves the pair
 * on the device because the phone was in a lift is not a logout — the refresh
 * token is good for thirty days, and the next person to open the app is
 * whoever was signed in. Losing the *server-side* half is the lesser failure:
 * the family stays alive until it expires, which is a real cost, but not one
 * that hands the device to a stranger.
 *
 * publish() runs before the revoke is awaited, so by the time anything is
 * waiting on the network the guard in app/(app)/_layout.tsx has already swapped
 * in the login screen. Nothing is watching this promise when it settles.
 *
 * This is also the path a dead refresh token takes — performRefresh() calls it
 * on a terminal 401. Revoking an already-revoked family is a 200 and a no-op,
 * which is why that costs nothing and needs no special case.
 */
export async function signOut(): Promise<void> {
  const refreshToken = memory?.refreshToken;
  const base = getApiBase();

  const revoking = refreshToken && base ? revokeFamily(base, refreshToken) : null;

  memory = null;
  try {
    await clearSession();
  } finally {
    // In a finally, so a SecureStore that refuses to delete still gets the user
    // off the signed-in screens. The in-memory mirror is what the guard reads;
    // a keystore that will not clear is a problem for the next launch, not a
    // reason to strand someone inside the app now.
    publish();
  }

  await revoking;
}

// ── The refresh interceptor ──────────────────────────────────────────────────

/**
 * The in-flight refresh, if there is one. null the rest of the time.
 *
 * Assigned and read only from synchronous stretches of code, with no `await`
 * between the test and the assignment in refreshOnce(). On JavaScript's single
 * thread that makes the check-and-set atomic, which is the entire locking
 * mechanism here — no mutex library required, but also no room to insert an
 * `await` into that sequence later.
 */
let refreshInFlight: Promise<string | null> | null = null;

/**
 * Produces a fresh access token, and guarantees AT MOST ONE refresh request is
 * outstanding at a time.
 *
 * WHY THIS HAS TO BE A LOCK AND NOT JUST A FUNCTION. The server's refresh
 * tokens are single-use and rotate: presenting one spends it and mints a
 * replacement in the same family, and presenting an already-spent one is read
 * as a replay — at which point the server revokes the whole family and both
 * holders are logged out (see the note in /api/auth/refresh). It cannot tell a
 * thief from a buggy client, and it is right not to try.
 *
 * So the naive interceptor is not merely wasteful, it is a logout bug. The home
 * screen fires several requests at once; let the access token be fifteen
 * minutes old and they all come back 401 within a few milliseconds of each
 * other. Refresh per 401 and the first request spends the token, the second
 * presents the same now-spent string, the server sees a replay, and the user is
 * thrown back to the login screen by nothing worse than opening a tab. It
 * reproduces exactly once every fifteen minutes, which is the worst possible
 * frequency for finding it.
 *
 * Two distinct races, and they need different answers:
 *
 *   SIMULTANEOUS — several requests 401 while no refresh has started. The first
 *   to arrive installs its promise in refreshInFlight; the rest find it there
 *   and await the same one. One network call, one rotation, everyone gets the
 *   same new token.
 *
 *   LATE — a request that was already on the wire when someone else's refresh
 *   completed. It 401s afterwards, so refreshInFlight is back to null and the
 *   simultaneous case does not cover it. Starting a refresh here would be legal
 *   (the token in hand is the fresh one) but pointless: it would rotate a
 *   perfectly good token for nothing, and two such requests landing together
 *   would put us right back in the replay window. The spentAccessToken
 *   comparison catches it — the token this request actually used is no longer
 *   the current one, so a refresh has already happened and the caller should
 *   just retry with what is now in memory.
 *
 * Returns null when the session is gone for good, which is the signal to stop
 * retrying and show the login screen.
 */
async function refreshOnce(spentAccessToken: string): Promise<string | null> {
  // LATE case first: somebody already rotated past the token we used.
  if (memory && memory.accessToken !== spentAccessToken) return memory.accessToken;

  // SIMULTANEOUS case: join the refresh that is already running.
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = performRefresh();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function performRefresh(): Promise<string | null> {
  const refreshToken = memory?.refreshToken;
  if (!refreshToken) return null;

  let res: Response;
  try {
    // A bare fetch, deliberately: routing this through request() would send an
    // expired Bearer token to the refresh endpoint and, on the 401 it does not
    // need to care about, try to refresh in order to refresh.
    res = await fetch(`${requireBase()}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
      credentials: "omit",
    });
  } catch {
    // The network is down, not the session. Leaving the tokens in place means
    // the next attempt works once there is signal again; signing out here would
    // make every tunnel and lift a logout.
    return null;
  }

  if (!res.ok) {
    // 401 here is terminal: expired, revoked, or a family killed by a replay.
    // There is no token left that will ever work, so drop the session and let
    // the guard in app/(app)/_layout.tsx route to login.
    await signOut();
    return null;
  }

  const body = (await res.json().catch(() => ({}))) as Partial<TokenResponse>;
  if (!body.accessToken || !body.refreshToken || !memory) {
    await signOut();
    return null;
  }

  memory = { ...memory, accessToken: body.accessToken, refreshToken: body.refreshToken };
  await saveTokens({ accessToken: body.accessToken, refreshToken: body.refreshToken });
  publish();
  return body.accessToken;
}

// ── The request path ─────────────────────────────────────────────────────────

/**
 * One request, with the Bearer header attached and at most one retry after a
 * refresh.
 *
 * "At most one" is a hard rule, not a tuning knob. Retrying a second time can
 * only mean the freshly-minted token was also rejected, and the one explanation
 * for that is that the account itself is refused — deleted or suspended, both
 * of which resolveSession() answers with a 401 that looks exactly like an
 * expiry. Looping on it would spin forever against a user who cannot be let in.
 */
async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${requireBase()}${path}`;

  const send = async (accessToken: string | null) => {
    try {
      return await fetch(url, {
        ...init,
        credentials: "omit",
        headers: {
          Accept: "application/json",
          ...(init.headers as Record<string, string> | undefined),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
    } catch (cause) {
      networkFailure(cause);
    }
  };

  const attempted = memory?.accessToken ?? null;
  const res = await send(attempted);

  if (res.status !== 401 || !attempted) return res;

  const fresh = await refreshOnce(attempted);
  if (!fresh) return res; // Session is gone; hand the 401 back unchanged.

  return send(fresh);
}

/**
 * A request against /api/v1, unwrapped from its envelope.
 *
 * The envelope is uniform — { data, error, meta } on success and failure alike
 * — so unwrapping it here is what lets every screen deal in the payload type
 * and a thrown ApiError rather than in response shapes.
 */
export async function apiV1<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; meta: Record<string, unknown> }> {
  const res = await request(path, init);

  let body: Envelope<T>;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError(res.status, "MALFORMED_RESPONSE", `${path} did not return JSON`);
  }

  if (!res.ok || body.error || body.data === null) {
    throw new ApiError(
      res.status,
      body.error?.code ?? "INTERNAL_ERROR",
      body.error?.message ?? `Request to ${path} failed`,
    );
  }

  return { data: body.data, meta: body.meta ?? {} };
}
