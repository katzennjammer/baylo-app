import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { apiV1 } from "./client";
import type { Item, SafeZoneHub } from "./types";

/**
 * The two Safe-Zone hub endpoints.
 *
 * GET /api/v1/hubs            every ACTIVE hub. Not paginated — the server
 *                             says so explicitly: it is a curated table that
 *                             grows by an INSERT somebody ran on purpose, and
 *                             a map has to have all of it before it can draw
 *                             anything. A cursor here would be pagination over
 *                             a list that fits on one screen.
 *
 * GET /api/v1/hubs/[id]/items the listings offered at one hub. Keyset
 *                             paginated like /browse, and a DEACTIVATED hub is
 *                             served rather than 404'd — the listings pointing
 *                             at it still exist and their owners still expect
 *                             to see them.
 *
 * ── THE TWO ENDPOINTS DISAGREE ABOUT WHICH HUBS EXIST, ON PURPOSE ───────────
 *
 * /hubs drops inactive ones so nothing new can be pinned to a closed place;
 * /hubs/[id]/items keeps serving them so a shared link does not die the moment
 * a hub is taken down. Neither client here tries to reconcile that. It is why
 * the marketplace map never has a grey pin on it and item detail can.
 */

/* ──────────────────────────── every hub ─────────────────────────────── */

export interface HubsPayload {
  hubs: SafeZoneHub[];
  /** Distinct cities present in `hubs`, sorted. The filter chips' source. */
  cities: string[];
}

export const hubsKey = ["hubs"] as const;

/**
 * Every active hub, for the marketplace map.
 *
 * `staleTime` is long because this table is curated rather than live: it
 * changes when somebody seeds a city or an admin deactivates a place, neither
 * of which happens while a user is looking at the map. Refetching it on every
 * focus would spend a request to be told the same 22 rows.
 */
export function useHubs(enabled = true) {
  return useQuery({
    queryKey: hubsKey,
    queryFn: () => apiV1<HubsPayload>("/api/v1/hubs"),
    select: (r) => r.data,
    staleTime: 30 * 60 * 1000,
    // The marketplace passes false until its map is opened. The key does not
    // change with it, so a grid session that later opens the map hits the same
    // cache entry the full-screen map already filled — one fetch per app run,
    // whichever surface asks first.
    enabled,
  });
}

/* ─────────────────────────── one hub's items ────────────────────────── */

export interface HubItemsPayload {
  /** Served even when deactivated — check `isActive` before trusting it. */
  hub: SafeZoneHub;
  items: Item[];
}

interface HubItemsPage {
  payload: HubItemsPayload;
  nextCursor: string | null;
}

export const hubItemsKey = (hubId: string) => ["hub-items", hubId] as const;

async function fetchHubItemsPage(
  hubId: string,
  cursor: string | null,
): Promise<HubItemsPage> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const { data, meta } = await apiV1<HubItemsPayload>(
    `/api/v1/hubs/${encodeURIComponent(hubId)}/items${qs}`,
  );
  return {
    payload: data,
    nextCursor: typeof meta.nextCursor === "string" ? meta.nextCursor : null,
  };
}

/**
 * The listings offered at one hub.
 *
 * SHARED BY THE MAP SHEET AND THE HUB SCREEN, deliberately, under one key. The
 * sheet needs a count and the screen needs the list, and they are the same
 * first page — so tapping through from a sheet that has already loaded renders
 * instantly and issues nothing. Splitting them into a "count" query and a
 * "list" query would fetch the same rows twice and let the two disagree.
 */
export function useHubItems(hubId: string | undefined, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: hubItemsKey(hubId ?? ""),
    queryFn: ({ pageParam }) => fetchHubItemsPage(hubId!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!hubId && enabled,
  });

  const pages = query.data?.pages ?? [];

  return {
    ...query,
    hub: pages[0]?.payload.hub ?? null,
    items: dedupeById(pages.flatMap((p) => p.payload.items)),
  };
}

/**
 * How many listings to CLAIM this hub has, from the pages actually loaded.
 *
 * ── WHY THIS IS NOT A NUMBER FROM THE SERVER ────────────────────────────────
 *
 * The tidy version is a `_count` on GET /api/v1/hubs, one field, no extra
 * request. It would also be WRONG in a way nobody would notice for months: the
 * join table counts every association, including listings that have been
 * traded, taken down by a moderator, or posted by somebody this viewer has
 * blocked. /hubs/[id]/items filters all three — that is most of what its query
 * does — so the sheet would advertise "14 listings" and open a screen showing
 * nine, with no way for the user to tell which number was lying.
 *
 * Counting the loaded rows cannot drift from the screen it links to, because it
 * IS that screen's data.
 *
 * ── AND WHY IT SAYS "20+" ───────────────────────────────────────────────────
 *
 * A page is a page. When `hasNextPage` is true the honest statement is "at
 * least this many", and rendering "20" there would be a precise-looking number
 * that is simply false. The cap is not worth a second endpoint: the sheet's job
 * is to answer "is it worth tapping into this hub", and "20+" answers it.
 */
export function hubItemCountLabel(count: number, hasMore: boolean): string {
  if (count === 0) return "No listings yet";
  const n = hasMore ? `${count}+` : `${count}`;
  return `${n} ${count === 1 && !hasMore ? "listing" : "listings"}`;
}

/** First occurrence wins. Same reasoning as useBrowse's copy. */
function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}
