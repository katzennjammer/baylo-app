import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./client";

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
