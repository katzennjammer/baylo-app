import type { NativeIntent } from "expo-router";

/**
 * The gate every incoming deep link passes through before expo-router sees it.
 *
 * `+native-intent.ts` is not a route — expo-router explicitly excludes it from
 * the route tree (`getRoutesCore.ts`) and instead wires `redirectSystemPath`
 * into its linking config, on BOTH legs:
 *
 *   - `subscribe()`  — links that arrive while the app is already running.
 *     The listener is only called `if (href)`, so returning null means the
 *     router performs no navigation at all.
 *   - `getInitialURL()` — the link the app cold-started from. Returning null
 *     there leaves React Navigation with no initial URL, so the app opens on
 *     its normal first screen instead of the deep link.
 *
 * WHY THIS FILE EXISTS: THE OAUTH RETURN LEG.
 *
 * `expo-auth-session` finishes Google sign-in by listening for the redirect on
 * `Linking` itself (`expo-web-browser`'s `_waitForRedirectAsync`, which is what
 * the Android Custom Tab flow races against the browser closing). That listener
 * is separate from expo-router's and is unaffected by anything here.
 *
 * expo-router's listener, however, ALSO sees `…oauthredirect?code=…`, finds no
 * route by that name, and pushes `+not-found` — the "Unmatched Route" screen —
 * on top of the login screen.
 *
 * That does not break the sign-in, and it is worth being precise about why: the
 * screen underneath stays mounted, so the hook, its `response` state and its
 * effect all survive, the code is exchanged, and the date-of-birth step renders
 * exactly as it should. Behind a full-screen error. The flow works and looks
 * broken, which is the worse of the two failure modes to debug.
 *
 * So the redirect is swallowed here. It was never a navigation: it is the
 * return half of a request this app made, addressed to the auth session, and
 * the router has no business routing it.
 *
 * DO NOT "FIX" THIS WITH AN `app/oauthredirect.tsx` ROUTE. That would put a
 * screen of this app's own in front of the login screen at the same moment, for
 * the same non-reason — a prettier cover over the same step.
 */

/**
 * The single path segment the OAuth redirect lands on. Kept in sync with
 * `NATIVE_REDIRECT_URI` in `src/auth/google.ts`; if that path ever changes,
 * this must change with it or the Unmatched Route screen comes back.
 */
const OAUTH_REDIRECT_SEGMENT = "oauthredirect";

/**
 * True when `url` is the OAuth return leg, in either of the two shapes this app
 * can produce.
 *
 * Both have to be recognised, because they parse differently and either can
 * reach a device:
 *
 *   com.baylo.app:/oauthredirect?code=…   single slash, no authority — the
 *                                         segment is the path
 *   baylo://oauthredirect?code=…          double slash — the segment is the
 *                                         HOST, and the path is empty
 *
 * `new URL()` would need two different accessors for those, and React Native's
 * URL polyfill is unreliable on non-`//` schemes anyway. Stripping the scheme
 * and any leading slashes and reading the first segment handles both without
 * caring which is which — so this keeps working if `NATIVE_REDIRECT_URI` is
 * ever moved to the `com.baylo.app:/oauthredirect` form Google documents.
 */
function isOAuthRedirect(url: string): boolean {
  const withoutScheme = url.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:/, "");
  const firstSegment = withoutScheme.replace(/^\/+/, "").split(/[/?#]/)[0];
  return firstSegment === OAUTH_REDIRECT_SEGMENT;
}

export const redirectSystemPath: NonNullable<NativeIntent["redirectSystemPath"]> = ({
  path,
}) => {
  // Deliberately total: any throw in here can take the app down on launch,
  // since this runs on the cold-start path too. There is nothing to catch —
  // `isOAuthRedirect` is pure string work — but the shape stays defensive so a
  // future addition to this function cannot become a launch crash.
  try {
    return isOAuthRedirect(path) ? null : path;
  } catch {
    return path;
  }
};
