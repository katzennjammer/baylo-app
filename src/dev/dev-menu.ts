import { DevSettings } from "react-native";

/**
 * The shake-menu shortcut back to the login screen.
 *
 * WHY THIS EXISTS. Signing out through the UI is a two-tap trip through a
 * confirm dialog, and half the time the reason for wanting it during
 * development is that the UI is the thing that is broken — a screen mid-edit, a
 * guard misfiring, a session pinned to the wrong account after repointing the
 * app at a different dev server. The alternative is clearing the app's storage
 * from Android's settings, which also throws away the API base URL override and
 * means retyping a LAN IP on a phone keyboard.
 *
 * `DevSettings.addMenuItem` rather than expo-dev-client's
 * `registerDevMenuItems`. Both work, and the Expo one is the documented route —
 * but this project has no expo-dev-client, and adding one for a single menu
 * entry buys a new native dependency and a full `expo run:android` rebuild.
 * DevSettings is core React Native, is already in the debug binary, and its
 * items land in the same shake menu. If expo-dev-client ever arrives here for
 * other reasons, this is the one call that moves.
 *
 * SAFE IN RELEASE, TWICE OVER. The `__DEV__` guard is dead-code-eliminated by
 * the release minifier, and addMenuItem is itself a no-op stub in a production
 * build — react-native only assigns the real implementation inside its own
 * `if (__DEV__)`. Neither is relied on alone.
 */

const CLEAR_SESSION_ITEM = "Baylo: clear session";

export function registerClearSessionDevItem(clearSession: () => Promise<void>): void {
  if (!__DEV__) return;

  // addMenuItem keys on the title: registering the same one again swaps the
  // handler rather than stacking a second entry, which is what makes this safe
  // to call from an effect that re-runs on Fast Refresh.
  DevSettings.addMenuItem(CLEAR_SESSION_ITEM, () => {
    // Deliberately not awaited. The dev menu's handler is fire-and-forget, and
    // the session is out of memory — and the app routed to login — long before
    // the revoke request this kicks off has settled.
    void clearSession().catch(() => undefined);
  });
}
