import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

import { ApiError, type GoogleExchange } from "../api/client";
import { useSession } from "./session";

/**
 * Continue with Google, on the device.
 *
 * The shape of this flow, and why it is this shape:
 *
 *   1. expo-auth-session opens Google's consent page in the system browser
 *      (a Custom Tab on Android, SFAuthenticationSession on iOS) — NOT a
 *      WebView. Google refuses to authenticate inside an embedded WebView, and
 *      is right to: the host app can read every keystroke in one.
 *   2. Google redirects back to `com.baylo.app:/oauthredirect` with an
 *      authorization code.
 *   3. The library exchanges that code for tokens using PKCE and NO client
 *      secret. Installed-app clients are public clients — there is nowhere in
 *      an APK to keep a secret — so PKCE is what binds the code to this
 *      request instead.
 *   4. The `id_token` out of that exchange goes to POST /api/auth/google/token,
 *      which verifies its signature, issuer, audience and expiry against
 *      Google's JWKS before it counts as evidence of anything.
 *
 * NOTHING IS TRUSTED ON THIS SIDE. The email, name and picture in the ID token
 * are read only by the server, after verification. This module never parses the
 * token, and must not start: anything decided here is decided by whoever is
 * holding the phone.
 *
 * `aud` on the token from step 3 is the ANDROID (or iOS) client id, not the web
 * one, because that is the client that performed the exchange. The server has
 * to accept it explicitly — see GOOGLE_NATIVE_CLIENT_IDS in the route — and
 * the whole flow 401s at step 4 until that is set. That is the correct failure:
 * a backend that accepted an unlisted audience would accept ID tokens minted
 * for unrelated apps.
 *
 * NOT AVAILABLE IN EXPO GO. The redirect URI is derived from this app's own
 * package name, and in Expo Go the package is Expo's. A development build is
 * required — see README.
 */

// Dismisses the auth browser tab if it is somehow still open when the app comes
// back to the foreground. Cheap insurance against a stranded Custom Tab; a
// no-op when there is nothing to close.
WebBrowser.maybeCompleteAuthSession();

const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

/** The client id this platform will actually use, or "" if it is not set. */
function clientIdForPlatform(): string {
  if (Platform.OS === "android") return ANDROID_CLIENT_ID;
  if (Platform.OS === "ios") return IOS_CLIENT_ID;
  return WEB_CLIENT_ID;
}

/**
 * Why an unconfigured build gets a disabled button and not a crash.
 *
 * `Google.useAuthRequest` throws an invariant when the id for the running
 * platform is missing, and a hook that throws during render takes the whole
 * login screen with it. Password sign-in must keep working on a build where
 * nobody has filled in the Google ids yet, so the hook is fed a harmless
 * placeholder and the button is disabled with a message that says which
 * variable is missing.
 */
const PLACEHOLDER_CLIENT_ID = "unconfigured.apps.googleusercontent.com";

export interface GoogleSignInOptions {
  /**
   * Called INSTEAD of installing the session, when the server says the account
   * still owes a date of birth.
   *
   * The screen that passes this takes over: it holds the pair, shows the
   * date-of-birth step, and adopts the session once the date is accepted. A
   * caller that does not pass it gets the old behaviour — the session is
   * installed and the guard routes into the app — which is right for any
   * surface that has no step to show.
   */
  onNeedsDateOfBirth?: (pending: GoogleExchange) => void;
}

export interface GoogleSignIn {
  /** Starts the flow. Safe to call repeatedly; ignored while one is running. */
  start: () => void;
  /** True from the moment the browser opens until the exchange has settled. */
  busy: boolean;
  /** Null unless the flow failed in a way worth showing. Cancelling is not. */
  error: string | null;
  /** False when the client id for this platform is missing. */
  configured: boolean;
  /** Why it is unavailable, for the disabled state's caption. */
  unavailableReason: string | null;
  /** Clears `error` — the screen calls this when the user edits a field. */
  reset: () => void;
}

export function useGoogleSignIn(options: GoogleSignInOptions = {}): GoogleSignIn {
  const { exchangeGoogle, adoptSession } = useSession();

  // Held in a ref rather than named in the effect's deps. A screen passes a
  // fresh closure on every render, and depending on it would re-run the effect
  // continuously while a response sat in state — `handled` below stops that
  // becoming a repeated POST, but the churn is avoidable and this avoids it.
  const onNeedsDob = useRef(options.onNeedsDateOfBirth);
  onNeedsDob.current = options.onNeedsDateOfBirth;

  const configured = clientIdForPlatform().length > 0;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: ANDROID_CLIENT_ID || PLACEHOLDER_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID || PLACEHOLDER_CLIENT_ID,
    webClientId: WEB_CLIENT_ID || PLACEHOLDER_CLIENT_ID,
    // Only what the backend reads off the token. Asking for more would put
    // scopes on the consent screen that nothing in this app uses, which is both
    // a worse first impression and a larger blast radius on the access token
    // that comes back beside the id token.
    scopes: ["openid", "profile", "email"],
  });

  /**
   * Guards against handling one response twice.
   *
   * `response` is a piece of state that survives re-renders, so the effect
   * below runs again on every unrelated render while a successful response is
   * still sitting there. Without this the ID token would be posted to the
   * backend repeatedly — harmless in effect, since the endpoint is idempotent,
   * but it would issue a fresh token pair each time and make the logs a lie.
   */
  const handled = useRef<unknown>(null);

  useEffect(() => {
    if (!response || handled.current === response) return;
    handled.current = response;

    // The user backed out, or the browser tab was dismissed. Not an error, and
    // showing one for it is the single most common way this flow annoys people.
    if (response.type === "cancel" || response.type === "dismiss") {
      setBusy(false);
      return;
    }

    if (response.type === "error") {
      setBusy(false);
      setError(
        response.error?.message ??
          "Google sign-in was refused. Check that this app's package name and " +
            "SHA-1 match the Android OAuth client in the Google console.",
      );
      return;
    }

    if (response.type !== "success") {
      setBusy(false);
      return;
    }

    const idToken = response.params?.id_token ?? response.authentication?.idToken ?? null;
    if (!idToken) {
      setBusy(false);
      // Reached when the code-for-token exchange came back without an id_token,
      // which in practice means the client id used for the exchange is not an
      // installed-app client (a Web client id here produces exactly this).
      setError(
        "Google returned no ID token. The client id in use must be an Android " +
          "(or iOS) OAuth client, not a Web one.",
      );
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const pending = await exchangeGoogle(idToken);

        if (pending.needsDateOfBirth && onNeedsDob.current) {
          // Deliberately NOT adopted. The screen owns the pair from here; see
          // the note on `exchangeGoogle` in session.tsx for why installing it
          // first would tear the step down before it rendered.
          onNeedsDob.current(pending);
          return;
        }

        await adoptSession(pending.session);
        // No navigation. adoptSession installs the session, the module
        // publishes, and the (auth) guard redirects — same contract as
        // password sign-in, and for the same reason.
      } catch (err) {
        if (cancelled) return;
        setError(googleBackendMessage(err));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [response, exchangeGoogle, adoptSession]);

  const start = useCallback(() => {
    if (busy) return;
    if (!configured) {
      setError(unavailableReason());
      return;
    }
    if (!request) {
      // The request builds asynchronously (PKCE needs a random verifier). A tap
      // this early is rare and does nothing; the button is disabled until it is
      // ready, so this is belt as well as braces.
      return;
    }
    setError(null);
    setBusy(true);
    promptAsync().catch((err: unknown) => {
      setBusy(false);
      setError(
        err instanceof Error
          ? err.message
          : "Could not open Google sign-in. Is a browser installed on this device?",
      );
    });
  }, [busy, configured, promptAsync, request]);

  return {
    start,
    busy,
    error,
    configured,
    unavailableReason: configured ? null : unavailableReason(),
    reset: useCallback(() => setError(null), []),
  };
}

function unavailableReason(): string {
  const variable = Platform.select({
    android: "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID",
    ios: "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
    default: "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
  });
  return `Google sign-in is not configured — set ${variable} in .env and restart Metro with --clear.`;
}

/**
 * Turns a failure from POST /api/auth/google/token into something actionable.
 *
 * The backend's messages are correct but terse, and the two that will actually
 * be hit during setup — a 500 because GOOGLE_NATIVE_CLIENT_IDS is unset, and a
 * 401 because the Android client id is not in it — are indistinguishable from
 * "Google said no" unless the cause is spelled out here.
 */
function googleBackendMessage(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "Something went wrong finishing Google sign-in. Please try again.";
  }

  if (err.status === 401) {
    return (
      `${err.message}\n\nIf this is a fresh setup: the ID token's audience is ` +
      `this app's Android OAuth client id, and the server only accepts ids ` +
      `listed in GOOGLE_NATIVE_CLIENT_IDS. Add it there and restart the server.`
    );
  }

  if (err.status === 500) {
    return (
      `${err.message}\n\nThe server has no accepted Google audiences ` +
      `configured — set GOOGLE_CLIENT_ID and GOOGLE_NATIVE_CLIENT_IDS in the ` +
      `Next.js .env.`
    );
  }

  return err.message;
}
