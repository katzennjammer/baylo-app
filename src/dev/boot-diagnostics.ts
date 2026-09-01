import { NativeModules } from "react-native";

import { getApiBase, isApiBaseHydrated, isApiBaseOverridden } from "../api/config";

/**
 * What the app is waiting on, in words, for the seconds before it has a screen.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * This app had no visible state between "the bundle loaded" and "a screen is
 * working". A hanging API call, an unreachable Metro and a crashed WebView all
 * produced the same artefact: a blank rectangle in the app's own canvas colour,
 * indistinguishable from each other and from a slow phone. `<Splash>` is that
 * rectangle — a spinner on `color.surface`, which reads as white on a phone —
 * and it is rendered from three different places for three different reasons,
 * none of which it named.
 *
 * The diagnostic is deliberately UGLY and deliberately LATE. Ugly because it is
 * a developer-facing readout and dressing it up would make it look like a
 * designed empty state, which is the one thing it must not be mistaken for.
 * Late because a fast boot must not flash it — under `REVEAL_AFTER_MS` nothing
 * is wrong and nobody needs to read anything.
 *
 * ── WHAT IT CAN AND CANNOT TELL YOU ─────────────────────────────────────────
 *
 * It answers "where is the JS talking to?" — the Metro origin the bundle
 * actually came from and the API base every request is built on. Those are the
 * two URLs that are wrong when this app is stuck, and neither was previously
 * visible from the device.
 *
 * It CANNOT tell you about a bundle that never loaded. If Metro is unreachable
 * at launch, none of this code runs and the RN red screen is what you get
 * instead — which is fine, because that screen already names the URL it tried.
 */

export interface BootDiagnostics {
  /** The Metro origin the bundle was served from, with trailing slash. */
  bundleUrl: string;
  /**
   * False when the JS came from a baked-in bundle rather than a dev server —
   * a release build, or a debug APK launched with no Metro to reach. In that
   * case `bundleUrl` is a guess and says so.
   */
  fromDevServer: boolean;
  /** The base every API request is built on. See `src/api/config.ts`. */
  apiBase: string;
  /** False while the stored override is still being read out of SecureStore. */
  apiBaseHydrated: boolean;
  /**
   * True when `apiBase` came from the gear's SecureStore override rather than
   * from `EXPO_PUBLIC_API_URL`.
   *
   * WORTH A LINE ON SCREEN because a stale override is invisible and outranks
   * everything: editing `.env` and restarting Metro with `--clear` changes the
   * compiled-in default and has NO EFFECT while an override is set. That
   * combination — a developer certain they have repointed the app, and an app
   * still calling an address from three networks ago — is precisely the kind of
   * silent wrong state this panel exists to end.
   */
  apiBaseOverridden: boolean;
}

/**
 * The bundle's own URL, read from the SourceCode native module.
 *
 * `getDevServer()` in RN's own tree does exactly this and is the module every
 * RN dev tool uses, but it lives at a deep internal path
 * (`react-native/Libraries/Core/Devtools/getDevServer`) that is not part of the
 * public export surface and has moved between versions. `NativeModules
 * .SourceCode` is reached through the package's public entry point and has
 * carried `scriptURL` since long before this project existed, so it is the one
 * with the better chance of surviving an upgrade.
 *
 * Everything here is wrapped: this is diagnostic code, and a diagnostic that
 * can itself throw during a failed boot would replace the blank screen it
 * exists to explain with a crash.
 */
function readScriptUrl(): string | null {
  try {
    const constants = NativeModules?.SourceCode?.getConstants?.();
    const url = constants?.scriptURL;
    return typeof url === "string" && url.length > 0 ? url : null;
  } catch {
    return null;
  }
}

export function readBootDiagnostics(): BootDiagnostics {
  const scriptUrl = readScriptUrl();

  // A dev bundle's scriptURL is "http://host:8081/index.bundle?platform=…".
  // A packaged one is a file:// or asset:// path, which is the signal that
  // there is no dev server in the picture at all.
  const origin = scriptUrl?.match(/^https?:\/\/[^/]+\//)?.[0] ?? null;

  return {
    bundleUrl: origin ?? scriptUrl ?? "unknown",
    fromDevServer: origin !== null,
    apiBase: getApiBase() || "(none compiled in)",
    apiBaseHydrated: isApiBaseHydrated(),
    apiBaseOverridden: isApiBaseOverridden(),
  };
}

/** How long a boot may take before it has to explain itself. */
export const REVEAL_AFTER_MS = 4_000;
