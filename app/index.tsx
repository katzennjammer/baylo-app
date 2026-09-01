import { Redirect } from "expo-router";

import { Splash } from "../src/components/Splash";
import { useSession } from "../src/auth/session";

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
 */
export default function Index() {
  const { session, isLoading } = useSession();

  if (isLoading) return <Splash waitingOn="Reading your saved session from secure storage" />;
  return <Redirect href={session ? "/(app)" : "/(auth)/login"} />;
}
