import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { ApiError, apiV1 } from "./client";
import type { UserSearchResult } from "./types";

const USER_SEARCH_PAGE_SIZE = 20;

/**
 * The server refuses a query longer than this with a 400 (z.max(50) on
 * /api/v1/users/search). The search box has no limit of its own, so the query
 * is cut here rather than shown as "something went wrong" past 50 characters.
 * A name search on the first 50 characters finds the same people anyway.
 */
const USER_SEARCH_MAX = 50;
const toQuery = (raw: string) => raw.trim().slice(0, USER_SEARCH_MAX).trim();

export interface UserSearchErrorPresentation {
  message: string;
  canRetry: boolean;
}

export function userSearchErrorPresentation(error: unknown): UserSearchErrorPresentation {
  if (error instanceof ApiError) {
    if (error.status === 404 || error.status === 405) {
      return { message: "People search isn't available yet.", canRetry: false };
    }
    if (error.status === 400) {
      return { message: "Try a shorter name, 2 to 50 characters.", canRetry: false };
    }
    if (error.status === 429) {
      return { message: "Too many searches. Wait a moment.", canRetry: true };
    }
    if (error.status === 401 || error.code === "UNAUTHENTICATED") {
      return { message: "Please sign in again.", canRetry: true };
    }
    if (error.status >= 500 && error.status < 600) {
      return { message: "Something went wrong on our side. Try again.", canRetry: true };
    }
    if (error.status === 0 && error.code === "NETWORK_ERROR") {
      return { message: "Check your connection and try again.", canRetry: true };
    }
  }

  const detail = error instanceof Error ? error.message : String(error ?? "");
  if (/network|timeout|timed out/i.test(detail)) {
    return { message: "Check your connection and try again.", canRetry: true };
  }
  return { message: "Something went wrong on our side. Try again.", canRetry: true };
}

interface UserSearchPage {
  users: UserSearchResult[];
  nextCursor: string | null;
}

async function fetchUserSearchPage(query: string, cursor: string | null): Promise<UserSearchPage> {
  const params = new URLSearchParams({
    q: query,
    limit: String(USER_SEARCH_PAGE_SIZE),
  });
  if (cursor) params.set("cursor", cursor);

  const { data, meta } = await apiV1<{ users: UserSearchResult[] }>(
    `/api/v1/users/search?${params.toString()}`,
  );
  return {
    users: data.users,
    nextCursor: typeof meta.nextCursor === "string" ? meta.nextCursor : null,
  };
}

export function useUserSearch(query: string, enabled = true) {
  const normalizedQuery = toQuery(query);
  return useInfiniteQuery({
    queryKey: ["user-search", normalizedQuery],
    queryFn: ({ pageParam }) => fetchUserSearchPage(normalizedQuery, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: enabled && normalizedQuery.length >= 2,
    staleTime: 30_000,
  });
}

/** A short, debounced-friendly first page for Home's trader suggestions. */
export function useUserSearchSuggestions(query: string, enabled = true) {
  const normalizedQuery = toQuery(query);
  return useQuery({
    queryKey: ["user-search-suggestions", normalizedQuery],
    queryFn: async () => {
      const params = new URLSearchParams({ q: normalizedQuery, limit: "4" });
      const { data } = await apiV1<{ users: UserSearchResult[] }>(
        `/api/v1/users/search?${params.toString()}`,
      );
      return data.users;
    },
    enabled: enabled && normalizedQuery.length >= 2,
    staleTime: 30_000,
  });
}
