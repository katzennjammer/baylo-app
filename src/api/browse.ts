import { useInfiniteQuery } from "@tanstack/react-query";

import { apiV1 } from "./client";
import type { BrowsePayload } from "./types";

/**
 * GET /api/v1/browse — the Marketplace tab.
 *
 * Paginated as an infinite query for the same reason /home is: the route is
 * keyset-paginated and `meta.nextCursor` is the cursor, its absence the end.
 *
 * THE FILTERS ARE PART OF THE QUERY KEY. That is what makes changing one a new
 * query rather than a mutation of the current one — TanStack keeps the old
 * result cached under its own key, so clearing a filter comes back instantly
 * and the paginated pages of one filter set can never be appended to another's.
 *
 * ── What the server accepts, exactly ────────────────────────────────────────
 *
 *   q          1–100 chars. Matches title OR DESCRIPTION, not title alone.
 *   category   one value, or several comma-separated (max 5).
 *   condition  one value.
 *   minLeaves  / maxLeaves — inclusive bounds; min may not exceed max.
 *   cursor, limit, lat, lng, radiusKm, sort
 *
 * ANYTHING ELSE IS A 400, not an ignored parameter: the route parses with
 * `z.strictObject`, so an unknown key is rejected outright. Do not add a filter
 * here before it exists there.
 *
 * WHY MULTIPLE CATEGORIES ARE COMMA-SEPARATED and not a repeated parameter:
 * the server's parseQuery() refuses `?category=A&category=B` before zod sees
 * it, because resolving a repeat by a first-or-last rule is a guess about what
 * the caller meant. The list has to arrive inside one value.
 */

export interface BrowseFilters {
  /** Free text. Matches title or description — see the note above. */
  q?: string;
  /** Zero or more category enum values. Empty means unfiltered. */
  categories?: readonly string[];
  condition?: string | null;
  minLeaves?: number | null;
  maxLeaves?: number | null;
}

/** Mirrors MAX_CATEGORIES in the server's browse route. */
export const MAX_CATEGORIES = 5;

/**
 * The condition ladder, mirrored from the server's CONDITION_VALUES.
 *
 * A HAND-KEPT COPY, and the honest word for it. No endpoint enumerates the
 * conditions — items carry a resolved `conditionLabel`, which is enough to
 * RENDER one but not to OFFER all five as a filter before any item has loaded.
 * Same arrangement as SIGNUP_GRANT_LEAVES in EmptyFeed: written down in one
 * place so it is findable, and it goes stale silently if the server's enum
 * changes. The labels match `CONDITION_LABELS` in the server's v1/taxonomy.ts.
 */
export const CONDITIONS: readonly { value: string; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "LIKE_NEW", label: "Like new" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "POOR", label: "Poor" },
];

/** True when anything is narrowing the list beyond the plain feed. */
export function isFiltered(f: BrowseFilters): boolean {
  return (
    !!f.q?.trim() ||
    (f.categories?.length ?? 0) > 0 ||
    !!f.condition ||
    f.minLeaves != null ||
    f.maxLeaves != null
  );
}

/** How many of the sheet's controls are set — the badge on the filter button. */
export function activeFilterCount(f: BrowseFilters): number {
  let n = 0;
  if ((f.categories?.length ?? 0) > 0) n += 1;
  if (f.condition) n += 1;
  if (f.minLeaves != null || f.maxLeaves != null) n += 1;
  return n;
}

function toQueryString(filters: BrowseFilters, cursor: string | null): string {
  const p = new URLSearchParams();

  const q = filters.q?.trim();
  if (q) p.set("q", q);

  // One value or a comma-separated list. Never a repeated parameter.
  if (filters.categories && filters.categories.length > 0) {
    p.set("category", filters.categories.join(","));
  }
  if (filters.condition) p.set("condition", filters.condition);

  // `!= null` rather than truthiness: 0 is a legitimate lower bound and `if
  // (min)` would silently drop it, which reads as "the filter did nothing".
  if (filters.minLeaves != null) p.set("minLeaves", String(filters.minLeaves));
  if (filters.maxLeaves != null) p.set("maxLeaves", String(filters.maxLeaves));

  if (cursor) p.set("cursor", cursor);

  const s = p.toString();
  return s ? `?${s}` : "";
}

interface BrowsePage {
  payload: BrowsePayload;
  nextCursor: string | null;
}

async function fetchBrowsePage(
  filters: BrowseFilters,
  cursor: string | null,
): Promise<BrowsePage> {
  const { data, meta } = await apiV1<BrowsePayload>(
    `/api/v1/browse${toQueryString(filters, cursor)}`,
  );
  return {
    payload: data,
    nextCursor: typeof meta.nextCursor === "string" ? meta.nextCursor : null,
  };
}

/**
 * The key. Normalised so that two filter objects meaning the same thing produce
 * the same key — categories sorted, blank strings folded to undefined — or the
 * cache would miss on a set the user has already fetched.
 */
function browseKey(f: BrowseFilters) {
  return [
    "browse",
    {
      q: f.q?.trim() || undefined,
      categories: f.categories?.length ? [...f.categories].sort() : undefined,
      condition: f.condition || undefined,
      minLeaves: f.minLeaves ?? undefined,
      maxLeaves: f.maxLeaves ?? undefined,
    },
  ] as const;
}

export function useBrowse(filters: BrowseFilters) {
  const query = useInfiniteQuery({
    queryKey: browseKey(filters),
    queryFn: ({ pageParam }) => fetchBrowsePage(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    // A filter change should not blank the grid while the new page loads —
    // the previous result stays on screen until the new one lands, which is
    // what makes chip-tapping feel like filtering rather than reloading.
    placeholderData: (previous) => previous,
  });

  const pages = query.data?.pages ?? [];

  return {
    ...query,
    items: dedupeById(pages.flatMap((p) => p.payload.items)),
    /**
     * The category rail's source of truth.
     *
     * From page 0's facets rather than a hardcoded enum, so the rail lists
     * exactly the categories that have something visible in them — a chip that
     * leads to an empty grid is a worse control than a missing chip. The server
     * computes facets UNFILTERED on purpose, so they do not vanish as you use
     * them.
     */
    facets: pages[0]?.payload.facets.categories ?? [],
  };
}

/**
 * First occurrence wins, order preserved. Same reasoning as useHome's copy: the
 * keyset cursor cannot produce an overlap, but a refetch re-runs every page
 * against a table that has moved on, so page 0 can return a row page 1 already
 * had. The stale copy is the one dropped.
 */
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
