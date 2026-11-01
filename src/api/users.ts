import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { apiV1 } from "./client";
import type { UserSearchResult } from "./types";

const USER_SEARCH_PAGE_SIZE = 20;

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
  const normalizedQuery = query.trim();
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
  const normalizedQuery = query.trim();
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
