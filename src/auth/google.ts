import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { ApiError, type GoogleExchange } from "../api/client";
import { useSession } from "./session";
import { suspensionFrom, type SuspensionNotice } from "../lib/suspension";

// Required, not imported: the package throws while loading when the installed
// binary was built without it (an older dev build, Expo Go), and an import that
// throws takes the whole login screen with it. Password sign-in must survive
// that, so a missing module only disables the Google button.
type NativeGoogle = typeof import("@react-native-google-signin/google-signin");
let native: NativeGoogle | null = null;
try {
  native = require("@react-native-google-signin/google-signin");
} catch (err) {
  // Say why: "missing from this build" and "threw while loading" look the same otherwise.
  if (__DEV__) console.warn("[google] native sign-in module failed to load:", err);
  native = null;
}
// Only reached when `native` is set: SUPPORTED below gates every use.
const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = native ?? ({} as NativeGoogle);

/**
 * Continue with Google, on the device — NATIVE sign-in (30 Sep 2026).
 *
 * The shape of this flow, and why it is this shape:
 *
 *   1. `@react-native-google-signin/google-signin` shows Google's own account
 *      picker from Google Play services. No browser tab, no redirect URI, no
 *      custom URI scheme.
 *   2. Google identifies the app by its PACKAGE NAME AND SIGNING CERTIFICATE
 *      (SHA-1). That pair must be registered as an Android OAuth client in the
 *      SAME Google Cloud project as the Web client id below, or sign-in fails
 *      with DEVELOPER_ERROR. Every signing key needs its own entry: the debug
 *      keystore, EAS's key, and — after a Play Store release — Play App
 *      Signing's key (Play Console → Test and release → App integrity).
 *   3. The ID token comes back with `aud` = the WEB client id passed to
 *      `configure()`, whichever Android client matched. That is the point of
 *      this design: the backend trusts ONE audience (or that client's project,
 *      see GOOGLE_TRUSTED_PROJECTS in baylo/src/lib/google-audience.ts), and a
 *      new signing key never needs a server change.
 *   4. The token goes to POST /api/auth/google/token, which verifies signature,
 *      issuer, audience and expiry against Google's JWKS before it counts as
 *      evidence of anything.
 *
 * WHY IT REPLACED THE BROWSER FLOW. The previous version used expo-auth-session
 * with a `com.baylo.app:/oauthredirect` redirect. Google discourages custom URI
 * schemes for Android clients — any app can register the same scheme, and a
 * browser redirect cannot prove which app receives the code — and they are off
 * by default on newly created Android clients. For a Play Store launch where
 * Google is the main way in, that was a risk this removes.
 *
 * NOTHING IS TRUSTED ON THIS SIDE. The email, name and picture are read only by
 * the server, after verification. This module never parses the token.
 *
 * NOT AVAILABLE IN EXPO GO: it is a native module. A development build is
 * required — see README. Android only for now; iOS is configured by the plugin
 * (iosUrlScheme in app.config.js) but UNTESTED, and web shows the button
 * disabled.
 */

/**
 * The OAuth "Web application" client id. NOT a secret — client ids are public —
 * but it must live in the same Google Cloud project as the Android client(s).
 */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";

const SUPPORTED = native !== null && (Platform.OS === "android" || Platform.OS === "ios");

let configured = false;
function ensureConfigured(): void {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    ...(Platform.OS === "ios" && IOS_CLIENT_ID ? { iosClientId: IOS_CLIENT_ID } : {}),
    // Only what the backend reads off the token.
    scopes: ["openid", "profile", "email"],
  });
  configured = true;
}

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
  /**
   * Called INSTEAD of setting `error`, when the server refuses the sign-in
   * because the account is suspended. The screen shows the full notice; a
   * caller that does not pass it gets the server's sentence as `error`.
   */
  onSuspended?: (notice: SuspensionNotice) => void;
}

export interface GoogleSignIn {
  /** Starts the flow. Safe to call repeatedly; ignored while one is running. */
  start: () => void;
  /** True from the moment the picker opens until the exchange has settled. */
  busy: boolean;
  /** Null unless the flow failed in a way worth showing. Cancelling is not. */
  error: string | null;
  /** False when this platform or build cannot run Google sign-in. */
  configured: boolean;
  /** Why it is unavailable, for the disabled state's caption. */
  unavailableReason: string | null;
  /** Clears `error` — the screen calls this when the user edits a field. */
  reset: () => void;
}

export function useGoogleSignIn(options: GoogleSignInOptions = {}): GoogleSignIn {
  const { exchangeGoogle, adoptSession } = useSession();

  // Held in a ref: a screen passes a fresh closure on every render.
  const onNeedsDob = useRef(options.onNeedsDateOfBirth);
  onNeedsDob.current = options.onNeedsDateOfBirth;
  const onSuspended = useRef(options.onSuspended);
  onSuspended.current = options.onSuspended;

  const isConfigured = SUPPORTED && WEB_CLIENT_ID.length > 0;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A result that lands after the screen unmounted must not set state.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const start = useCallback(() => {
    if (busy) return;
    if (!isConfigured) {
      setError(unavailableReason());
      return;
    }
    setError(null);
    setBusy(true);

    (async () => {
      try {
        ensureConfigured();
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

        const result = await GoogleSignin.signIn();
        // The user backed out of the picker. Not an error, and showing one for
        // it is the single most common way this flow annoys people.
        if (!isSuccessResponse(result)) return;

        const idToken = result.data.idToken;

        // Forget the Google account on this device's Google Sign-In cache so the
        // NEXT tap shows the picker again instead of silently reusing it — the
        // same "select account" behaviour the browser flow had. This does not
        // touch the Baylo session.
        await GoogleSignin.signOut().catch(() => undefined);

        if (!idToken) {
          if (mounted.current) {
            setError(
              "Google returned no ID token. EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID must be a " +
                "Web application client in the same Google Cloud project as the Android client.",
            );
          }
          return;
        }

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
        if (!mounted.current) return;
        const notice = suspensionFrom(err);
        if (notice && onSuspended.current) onSuspended.current(notice);
        else setError(googleErrorMessage(err));
      } finally {
        if (mounted.current) setBusy(false);
      }
    })();
  }, [busy, isConfigured, exchangeGoogle, adoptSession]);

  return {
    start,
    busy,
    error,
    configured: isConfigured,
    unavailableReason: isConfigured ? null : unavailableReason(),
    reset: useCallback(() => setError(null), []),
  };
}

function unavailableReason(): string {
  if (!native && Platform.OS !== "web") {
    return "This build of the app does not include Google sign-in. Install the latest build, or continue with email.";
  }
  if (!SUPPORTED) return "Google sign-in is available in the Android app.";
  return "Google sign-in is not configured — set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env and restart Metro with --clear.";
}

/**
 * Turns a failure into something actionable. The native module reports setup
 * mistakes with bare codes, and the two that will actually be hit during setup
 * — DEVELOPER_ERROR (package/SHA-1 not registered) and a 401 from the backend
 * (audience not trusted) — are indistinguishable from "Google said no" unless
 * the cause is spelled out here.
 */
function googleErrorMessage(err: unknown): string {
  if (isErrorWithCode(err)) {
    switch (err.code) {
      case statusCodes.SIGN_IN_CANCELLED:
        return "Google sign-in was cancelled.";
      case statusCodes.IN_PROGRESS:
        return "Google sign-in is already open.";
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return "Google Play services is missing or out of date on this phone. Update it from the Play Store, or continue with email.";
      default:
        // DEVELOPER_ERROR arrives as code "10" on Android.
        if (String(err.code) === "10" || /DEVELOPER_ERROR/i.test(err.message)) {
          return (
            "Google sign-in is not set up for this build (DEVELOPER_ERROR).\n\n" +
            "In Google Cloud Console, the project that owns the Web client id must also " +
            "have an Android OAuth client for package com.baylo.app with THIS build's " +
            "SHA-1 signing fingerprint."
          );
        }
        return err.message || "Google sign-in failed. Please try again.";
    }
  }

  if (err instanceof ApiError) {
    if (err.status === 401) {
      return (
        `${err.message}\n\nThe server does not trust this Google client. Its id (the Web ` +
        `client id) must be listed in GOOGLE_NATIVE_CLIENT_IDS, or its project number in ` +
        `GOOGLE_TRUSTED_PROJECTS, in the API's .env — then restart the server.`
      );
    }
    if (err.status === 500) {
      return (
        `${err.message}\n\nThe server has no accepted Google audiences configured — set ` +
        `GOOGLE_TRUSTED_PROJECTS or GOOGLE_NATIVE_CLIENT_IDS in the API's .env.`
      );
    }
    return err.message;
  }

  return "Something went wrong finishing Google sign-in. Please try again.";
}
