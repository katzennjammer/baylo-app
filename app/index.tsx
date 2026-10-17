import { Redirect } from "expo-router";

import { Splash } from "../src/components/Splash";
import { useSession } from "../src/auth/session";
import { bootRoute, introPending } from "../src/media/intro-gate";
import { videoAvailable } from "../src/media/video-kit";

/**
 * The fork in the road, and the reason it is its own route.
 *
 * expo-router has to render SOMETHING at "/", and neither group can be it: a
 * route group is a folder, not a screen. Redirecting from here keeps the two
 * groups symmetrical — each guards only itself — instead of making one of them
 * double as the default landing place.
 *
 * The isLoading branch is what stops the login screen flashing on every cold
 * start. Reading SecureStore is a real async round-trip, so for the first few
 * frames a signed-in user looks exactly like a signed-out one; routing on that
 * would send them to /login and then yank them away again.
 *
 * ── THE INTRO IS DECIDED HERE, FIRST, FOR EVERYBODY ────────────────────────
 *
 * Since the tiered opening film (Oct 2026) the intro plays on every cold start,
 * signed in or not — normal, Premium or shop footage, picked from a tier the
 * previous launch cached (src/media/opening-tier-store). So it no longer waits
 * on the session read, and it is checked before it:
 *
 *   introPending  false once the intro has run in this process. The intro's
 *               every exit lowers it BEFORE navigating back here, so this route
 *               can answer "/intro" exactly once per process.
 *   videoAvailable  false when expo-video did not load. Routing to /intro then
 *               would mean a dark screen for as long as its own timers take to
 *               give up — a fallback worse than the thing it falls back from.
 *
 * After it, the original fork: wait for the session read (deciding early is the
 * login flash this route exists to prevent), then Home or the auth screen. The
 * decision is `bootRoute()` so it can be checked off the device; everything
 * else about the intro — the timeouts, the tap, the ways out — lives in
 * `app/intro.tsx`.
 */
export default function Index() {
  const { session, isLoading } = useSession();

  const route = bootRoute({
    introPending: introPending(),
    videoAvailable,
    isLoading,
    signedIn: !!session,
  });

  if (route === "splash") return <Splash tone="boot" waitingOn="Reading your saved session from secure storage" />;
  // HOME REDESIGN (preview): land on the new Home rather than the old feed.
  return <Redirect href={route} />;
}
