import type * as ExpoVideo from "expo-video";

/**
 * `expo-video`, behind a load that cannot take the app down with it.
 *
 * ── WHY A GUARDED REQUIRE AND NOT AN IMPORT ─────────────────────────────────
 *
 * expo-video is a NATIVE module. `import { useVideoPlayer } from "expo-video"`
 * resolves at module-evaluation time, and if the native side is not there —
 * a JS bundle newer than the installed shell, which is the normal state of
 * affairs on this project between rebuilds; Expo Go; a prebuild that did not
 * pick the module up — the throw happens while the importing module is being
 * evaluated. That is BEFORE any component exists, so no error boundary is
 * mounted to catch it, and the failure presents as a blank app rather than as a
 * missing video. Requiring it inside a try/catch turns the same failure into a
 * `null` that the callers below can check.
 *
 * ── TWO LAYERS, BECAUSE THEY CATCH DIFFERENT THINGS ─────────────────────────
 *
 *   THIS FILE catches the module never arriving. It is checked before anything
 *   calls a hook, so a missing kit means the video component simply is not
 *   rendered and no hook order is ever in question.
 *
 *   `VideoFallback` catches a kit that loaded but fails in use — `useVideoPlayer`
 *   throwing on a malformed source, a view that cannot allocate a surface, a
 *   codec the device refuses. That one is an ordinary render error and wants an
 *   ordinary error boundary.
 *
 * Both degrade to the same thing: the paint that is already underneath the
 * video. The band keeps its ground and stripes, the intro is skipped, and the
 * app is fully usable — video is the one thing on these screens that nothing
 * else depends on. Same posture as `MapErrorBoundary`, for the same reason.
 */

let kit: typeof ExpoVideo | null = null;
let failure: string | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const loaded = require("expo-video") as typeof ExpoVideo;

  // A resolved module is not a working one. Metro will happily hand back a
  // partially-initialised object when the native module is missing, and the
  // symptom is `useVideoPlayer is not a function` thrown from inside a render
  // rather than from here — so the shape is checked at load time, where the
  // answer can still be "do not render the video at all".
  if (typeof loaded?.useVideoPlayer !== "function" || !loaded?.VideoView) {
    failure = "expo-video resolved without useVideoPlayer/VideoView — native module missing";
  } else {
    kit = loaded;
  }
} catch (err) {
  failure = err instanceof Error ? err.message : String(err);
}

if (failure) {
  // Logged once, at load, rather than per render. Without it a build that
  // silently lost the native module looks identical to a build where the
  // footage simply has not downloaded yet, and those want different fixes:
  // one needs a rebuild, the other needs a network.
  console.warn(`[video] expo-video unavailable, falling back to the still paint: ${failure}`);
}

/** The module, or null when the native side is not present. */
export const videoKit = kit;

/** Why it is null. Null when the kit loaded fine. */
export const videoKitFailure = failure;

/** True when it is safe to render a component that calls `useVideoPlayer`. */
export const videoAvailable = kit !== null;
