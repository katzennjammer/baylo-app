import { useInfiniteQuery } from "@tanstack/react-query";
import { apiV1 } from "./client";
import type { HomePayload } from "./types";

/**
 * GET /api/v1/home.
 *
 * The endpoint is a composite: one request returns the viewer, the three unread
 * counts, the feed page, trending categories and match candidates. The header
 * and the feed therefore read from the SAME query rather than issuing one each
 * — calling this hook in both places is free, because TanStack dedupes by key.
 *
 * Paginated as an infinite query because the route is keyset-paginated and says
 * so: `meta.nextCursor` is the cursor for the next page, and its absence means
 * the end. Note that page 2 carries a full payload — viewer, unread, trending
 * and all — of which only `feed` is wanted. Everything outside the feed is read
 * off page 0, which is the freshest copy of it the app has.
 */

const HOME_KEY = ["home"] as const;

interface HomePage {
  payload: HomePayload;
  nextCursor: string | null;
}

async function fetchHomePage(cursor: string | null): Promise<HomePage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const { data, meta } = await apiV1<HomePayload>(`/api/v1/home${query}`);
  return {
    payload: data,
    nextCursor: typeof meta.nextCursor === "string" ? meta.nextCursor : null,
  };
}

export function useHome() {
  const query = useInfiniteQuery({
    queryKey: HOME_KEY,
    queryFn: ({ pageParam }) => fetchHomePage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const pages = query.data?.pages ?? [];
  const first = pages[0]?.payload;

  return {
    ...query,
    /** Everything that is not the feed comes from page 0. */
    viewer: first?.viewer,
    unread: first?.unread,
    trending: first?.trending ?? [],
    matches: first?.matches ?? [],
    /** Every page's feed, flattened, in order. */
    feed: pages.flatMap((p) => p.payload.feed),
  };
}
