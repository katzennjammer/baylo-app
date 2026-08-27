import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { createQueryClient } from "../src/api/queryClient";
import { SessionProvider } from "../src/auth/session";
import { colors } from "../src/theme/palette";

/**
 * Created once, at module scope, NOT inside the component.
 *
 * A client constructed in the render body is a new client on every render, and
 * every cached query dies with the old one. The symptom is a feed that refetches
 * on any state change anywhere above it.
 */
const queryClient = createQueryClient();

/**
 * Provider order is load-bearing:
 *
 *   QueryClientProvider  — SessionProvider calls useQueryClient() to clear the
 *                          cache on sign-in and sign-out, so it must be inside.
 *   SessionProvider      — both route groups read from it.
 *   SafeAreaProvider     — the tab bar and header measure insets.
 */
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              // Without this the navigator's own background flashes white
              // between screens, which on a canvas this dark is very visible.
              contentStyle: { backgroundColor: colors.bg },
            }}
          />
        </SafeAreaProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
