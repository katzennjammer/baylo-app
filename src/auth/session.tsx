import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  adoptSession as apiAdoptSession,
  currentSession,
  exchangeGoogleIdToken,
  hydrateSession,
  onSessionChange,
  signIn as apiSignIn,
  signInWithGoogle as apiSignInWithGoogle,
  signOut as apiSignOut,
  type GoogleExchange,
} from "../api/client";
import { hydrateApiBase } from "../api/config";
import { TimeoutError, withTimeout } from "../api/timeout";
import { registerClearSessionDevItem } from "../dev/dev-menu";
import type { StoredSession } from "./storage";

/**
 * Session state, as React sees it.
 *
 * The session itself does NOT live here. It lives in `src/api/client.ts`,
 * because the refresh interceptor has to be able to read and replace it from
 * outside React entirely — a token rotation happens inside a fetch, under
 * whatever screen happened to trigger it, with no component in scope. This
 * provider subscribes to that module and mirrors it into state so the router
 * can re-render on a change.
 *
 * That direction matters. If React owned the session, a refresh would have to
 * call a setter it cannot reach, and the two copies would drift the moment a
 * rotation happened during a screen transition.
 */

interface SessionState {
  session: StoredSession | null;
  /** True until SecureStore has been read. Nothing may route on the session yet. */
  isLoading: boolean;
  /**
   * Why boot gave up on the stored session, or null if it did not.
   *
   * Set rather than thrown. A boot that cannot read SecureStore is not a fatal
   * app state — it is a signed-out one — so this rides along to the login
   * screen and is shown there as a banner. See the note on the effect below.
   */
  hydrationError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** Exchanges a verified Google ID token for a session. See `./google.ts`. */
  signInWithGoogle: (idToken: string) => Promise<void>;
  /**
   * The same exchange, WITHOUT installing what comes back.
   *
   * The Google date-of-birth step needs it: an account the server says still
   * owes a date of birth has a perfectly valid token pair, and installing it
   * would trip the (auth) guard and route the user into the app before they
   * had been asked. The screen holds the pair, asks, and calls adoptSession()
   * when the answer is in — the same arrangement registration already uses for
   * the "check your email" step, and for the same reason.
   */
  exchangeGoogle: (idToken: string) => Promise<GoogleExchange>;
  /**
   * Installs an already-obtained session.
   *
   * The register screen's Continue button. It authenticates during signup and
   * then sits on the resulting pair while the "check your email" step is on
   * screen, because installing it there would trip the (auth) guard and route
   * the user away mid-sentence.
   */
  adoptSession: (session: StoredSession) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

/**
 * How long boot waits on SecureStore before routing without it.
 *
 * Generous on purpose. A cold Keychain/Keystore round-trip on a slow device is
 * tens of milliseconds, so five seconds is not a performance budget — it is the
 * line past which the read is not slow but stuck, and the user is better served
 * by a login screen they can act on than by a splash they cannot.
 */
const HYDRATION_TIMEOUT_MS = 5_000;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => currentSession());
  const [isLoading, setIsLoading] = useState(true);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe BEFORE hydrating, so a change that lands during the read is not
    // missed — the alternative ordering has a window in which a rotation would
    // be applied to the module and never reach this component.
    const unsubscribe = onSessionChange(setSession);

    // Guards the setters against a chain that outlives the mount. The race
    // below cannot cancel the SecureStore read it lost to, so that read can
    // still settle after this component is gone — under Fast Refresh, on every
    // save.
    let mounted = true;

    // The base URL is read BEFORE the session, and awaited rather than fired
    // alongside it. Both live in SecureStore, but the URL is an input to every
    // request the session hydration might trigger afterwards — resolving them
    // in parallel leaves a window in which a request goes to the compiled-in
    // default while the override is still in flight, which is exactly the bug
    // the override exists to fix.
    //
    // WHY THERE IS A DEADLINE ON IT. Both halves are native SecureStore calls,
    // and a native call that never calls back does not reject — it goes quiet.
    // The `.finally()` that used to be the only thing here runs on a rejection
    // but not on silence, so a single wedged Keystore read left `isLoading`
    // true forever and parked the whole app on the splash screen: no error, no
    // request, nothing on screen to act on and nothing in the logs to read.
    // That is the bug this deadline exists to make impossible.
    //
    // Losing the race is NOT the same as having no session. The read carries
    // on, and `hydrateSession()` publishes through onSessionChange when it
    // lands, so a session that arrives late still moves the app off the login
    // screen on its own. Timing out only decides what the user looks at while
    // they wait.
    withTimeout(
      hydrateApiBase().then(() => hydrateSession()),
      HYDRATION_TIMEOUT_MS,
      "Reading the saved session",
    )
      .then(() => {
        if (mounted) setHydrationError(null);
      })
      .catch((cause: unknown) => {
        if (!mounted) return;
        setHydrationError(
          cause instanceof TimeoutError
            ? "Could not read the saved session — secure storage did not respond. " +
                "You have been signed out; sign in again to continue."
            : `Could not read the saved session. You have been signed out. ` +
                `(${cause instanceof Error ? cause.message : String(cause)})`,
        );
      })
      // Stays in a finally, and now it means something: every path through the
      // above reaches here, so there is no longer an outcome in which the
      // splash screen is permanent.
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await apiSignIn(email, password);
      // Anything cached belonged to whoever was signed in before. Clearing is
      // not an optimisation: /api/v1/home is keyed on the caller, so a stale
      // page would render the previous account's feed, leaves and unread counts
      // under the new user's name until the refetch landed.
      queryClient.clear();
    },
    [queryClient],
  );

  const signInWithGoogle = useCallback(
    async (idToken: string) => {
      await apiSignInWithGoogle(idToken);
      queryClient.clear();
    },
    [queryClient],
  );

  // No queryClient.clear() here, deliberately: nothing has been installed, so
  // there is no cache belonging to the wrong user yet. adoptSession() is what
  // does the clearing, on whichever of the two paths ends up calling it.
  const exchangeGoogle = useCallback(
    (idToken: string) => exchangeGoogleIdToken(idToken),
    [],
  );

  const adoptSession = useCallback(
    async (next: StoredSession) => {
      await apiAdoptSession(next);
      queryClient.clear();
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    try {
      await apiSignOut();
    } finally {
      // In the finally rather than after the await. apiSignOut() drops the
      // session before anything that can throw, so a failure past that point
      // would otherwise leave a signed-out app still holding the previous
      // account's cached feed, leaves and unread counts — which the next
      // sign-in would render for a frame under the new user's name.
      queryClient.clear();
    }
  }, [queryClient]);

  // The shake-to-clear dev shortcut. Registered here, and with THIS signOut,
  // so the menu item and the button on the Profile tab are one action: revoke
  // the family, drop the tokens, clear the cache, let the guard route out.
  // A no-op in release builds — see the note in src/dev/dev-menu.ts.
  useEffect(() => {
    registerClearSessionDevItem(signOut);
  }, [signOut]);

  const value = useMemo<SessionState>(
    () => ({
      session,
      isLoading,
      hydrationError,
      signIn,
      signInWithGoogle,
      exchangeGoogle,
      adoptSession,
      signOut,
    }),
    [
      session,
      isLoading,
      hydrationError,
      signIn,
      signInWithGoogle,
      exchangeGoogle,
      adoptSession,
      signOut,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
