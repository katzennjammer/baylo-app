import { Redirect } from "expo-router";

import { Splash } from "../src/components/Splash";
import { useSession } from "../src/auth/session";
import { introPending } from "../src/media/intro-gate";
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
 * ── THE INTRO IS DECIDED HERE, AND THE ORDER OF THE CHECKS IS THE FEATURE ───
 *
 * The film is only ever shown to somebody who is about to be asked to sign in,
 * and every branch above it takes priority:
 *
 *   isLoading   the session is still being read. Not a decision yet — deciding
 *               now is the flash this screen exists to prevent.
 *   session     a signed-in user goes straight to the feed. They opened the app
 *               to do something, and a title card in front of the thing they
 *               came for is not an introduction, it is a delay.
 *   introPending  false once the intro has run in this process, so backing out
 *               of the auth stack to "/" lands on the auth screen rather than
 *               replaying the film.
 *   videoAvailable  false when expo-video did not load. Routing to /intro then
 *               would mean a black screen for as long as its own timers take to
 *               give up — a fallback worse than the thing it falls back from.
 *
 * Only when all four agree does anybody see it. Everything else about the intro
 * — the timeouts, the tap, the ways out — lives in `app/intro.tsx`; this file
 * decides only whether it is reached at all.
 */
export default function Index() {
  const { session, isLoading } = useSession();

  if (isLoading) return <Splash waitingOn="Reading your saved session from secure storage" />;
  if (session) return <Redirect href="/(app)" />;
  if (introPending() && videoAvailable) return <Redirect href="/intro" />;
  return <Redirect href="/(auth)/login" />;
}
