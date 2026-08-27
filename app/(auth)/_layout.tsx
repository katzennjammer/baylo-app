import { Redirect, Stack } from "expo-router";

import { Splash } from "../../src/components/Splash";
import { useSession } from "../../src/auth/session";

/**
 * The (auth) group: reachable only WITHOUT a session.
 *
 * The mirror of the guard in (app)/_layout.tsx, and it exists for the same
 * reason that one does — so that the refresh interceptor signing a user out
 * mid-session, or a sign-in completing, moves the app without any screen having
 * to call router.replace(). Both guards read the same state; whichever one is
 * mounted redirects.
 */
export default function AuthLayout() {
  const { session, isLoading } = useSession();

  if (isLoading) return <Splash />;
  if (session) return <Redirect href="/(app)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
