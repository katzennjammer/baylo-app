import "../global.css";

import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { createQueryClient } from "../src/api/queryClient";
import { Splash } from "../src/components/Splash";
import { SessionProvider, useSession } from "../src/auth/session";
import { color } from "../src/theme/tokens";

/**
 * Created once, at module scope, NOT inside the component.
 *
 * A client constructed in the render body is a new client on every render, and
 * every cached query dies with the old one. The symptom is a feed that refetches
 * on any state change anywhere above it.
 */
const queryClient = createQueryClient();

/**
 * Every face the type scale names, keyed by the string `tokens.font` asks for.
 *
 * THE KEY IS THE CONTRACT. React Native resolves `fontFamily` by matching this
 * name, and a miss is not an error — it silently paints the system face, which
 * is the one failure mode in the whole type system that looks like a design
 * decision rather than a bug. So the keys here are the PostScript names, which
 * are also the file basenames, which are also what `tokens.font` holds: three
 * places that have to agree, kept trivially checkable by all three being the
 * same string.
 *
 * WHY THIS EXISTS AT ALL when `app.json` already embeds the same twelve files
 * through the expo-font config plugin. The plugin copies them into the native
 * project, so they resolve in a build that includes that step and in nothing
 * else — not in Expo Go, not on web, and not in an installed shell that predates
 * the fonts being added while Metro happily serves it new JS. That last case is
 * silent and survives a reload, because the JS is fresh and only the assets are
 * stale. Loading them from the bundle as well costs one await at boot and makes
 * the type independent of when the native side was last built.
 *
 * Archivo is loaded and unreferenced by the current scale. It is the auth
 * screens' display face, kept embedded so those screens are not the thing that
 * breaks the next time the scale is retuned.
 */
const FONTS = {
  "BricolageGrotesque-Bold": require("../assets/fonts/BricolageGrotesque-Bold.ttf"),
  "BricolageGrotesque-SemiBold": require("../assets/fonts/BricolageGrotesque-SemiBold.ttf"),
  "PublicSans-Regular": require("../assets/fonts/PublicSans-Regular.ttf"),
  "PublicSans-Medium": require("../assets/fonts/PublicSans-Medium.ttf"),
  "PublicSans-SemiBold": require("../assets/fonts/PublicSans-SemiBold.ttf"),
  "PublicSans-Bold": require("../assets/fonts/PublicSans-Bold.ttf"),
  "JetBrainsMono-Regular": require("../assets/fonts/JetBrainsMono-Regular.ttf"),
  "Archivo-Regular": require("../assets/fonts/Archivo-Regular.ttf"),
  "Archivo-Medium": require("../assets/fonts/Archivo-Medium.ttf"),
  "Archivo-SemiBold": require("../assets/fonts/Archivo-SemiBold.ttf"),
  "Archivo-Bold": require("../assets/fonts/Archivo-Bold.ttf"),
  "Archivo-ExtraBold": require("../assets/fonts/Archivo-ExtraBold.ttf"),
};

/**
 * Provider order is load-bearing:
 *
 *   QueryClientProvider  — SessionProvider calls useQueryClient() to clear the
 *                          cache on sign-in and sign-out, so it must be inside.
 *   SessionProvider      — both route groups read from it.
 *   SafeAreaProvider     — the tab bar and header measure insets.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);

  // Held on the splash until the faces are in, because the alternative is a
  // visible reflow: the wordmark and every item title would paint in the system
  // face and then jump when Bricolage lands, on the first screen of the app.
  //
  // A LOAD FAILURE RENDERS ANYWAY. Falling back to the system face is a degraded
  // app; a permanent spinner is no app. `fontError` is the only thing standing
  // between a corrupt asset and a boot that never finishes, so it releases the
  // gate rather than being swallowed.
  if (!fontsLoaded && !fontError) return <Splash waitingOn="Loading the app’s fonts" />;

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <SafeAreaProvider>
          <ThemedStatusBar />
          <Stack
            screenOptions={{
              headerShown: false,
              // Without this the navigator's own background flashes in the
              // platform default between screens, which is very visible against
              // a canvas that is not the platform default.
              contentStyle: { backgroundColor: color.surface },
            }}
          />
        </SafeAreaProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

/**
 * The status bar belongs to whichever half of the app is on screen.
 *
 * The two halves are opposite grounds: (app) is a light surface set and needs
 * dark status-bar content, (auth) is a green field under a white card and needs
 * light. Rather than each group setting it — which would mean touching the auth
 * tree to fix a change made behind the gate, and would leave the bar in
 * whichever style unmounted last — it is derived here from the one fact that
 * decides which tree is mounted at all.
 *
 * `isLoading` counts as signed-in for this purpose: what is on screen during
 * the SecureStore read is <Splash>, which paints the app canvas.
 */
function ThemedStatusBar() {
  const { session, isLoading } = useSession();
  return <StatusBar style={isLoading || session ? "dark" : "light"} />;
}
