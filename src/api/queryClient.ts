import { AppState, Platform } from "react-native";
import { QueryClient, focusManager } from "@tanstack/react-query";
import { ApiError } from "./client";

/**
 * `refetchOnWindowFocus` MEANS NOTHING IN REACT NATIVE UNTIL THIS RUNS.
 *
 * The option below is set, and was dead. TanStack's default focus source is the
 * DOM's `visibilitychange` — there is no window here, the event never fires, and
 * so a query never refetched on returning to the app no matter what the flag
 * said. The setting looked like the behaviour and was not it.
 *
 * `focusManager` is the documented replacement: hand it AppState and "focused"
 * becomes "the app is in the foreground". That is what makes a stale list — the
 * Trades badge's `needsToday` count among them — pick up whatever happened while
 * the phone was in somebody's pocket.
 *
 * Module scope, so it is installed exactly once by the import that creates the
 * client, rather than re-registered by every mount of a component.
 */
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener("change", (state) => {
    // Guarded because the manager's web path is correct on web and this would
    // fight it. Expo builds for web from the same source.
    if (Platform.OS !== "web") handleFocus(state === "active");
  });
  return () => sub.remove();
});

/**
 * The app's single QueryClient.
 *
 * The one setting here that is a decision rather than a preference is `retry`.
 * TanStack Query's default retries any failed query three times, which is right
 * for a flaky network and wrong for everything else: a 400 is a bug in the
 * request and will fail identically three more times, a 404 is an answer, and a
 * 401 that reached this layer has ALREADY been through the refresh interceptor
 * in client.ts and failed there — retrying it just fires three more requests at
 * a server that has already said no, and delays the login screen by however
 * long the backoff takes.
 *
 * So: retry transport failures, and only transport failures.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            // status 0 is our own marker for "the request never got an answer"
            // — DNS, refused connection, timeout. Those are worth another go.
            if (error.status === 0 && error.code === "NETWORK_ERROR") return failureCount < 2;
            return false;
          }
          return failureCount < 2;
        },
        // The feed is not a document; a minute-old copy is fine to show while
        // the fresh one loads, and this stops a tab switch re-fetching it.
        staleTime: 60_000,
        // Mobile apps get backgrounded constantly. Refetching on every return
        // to the foreground is the behaviour people expect from a feed.
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
