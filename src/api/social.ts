import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { apiV1 } from "./client";
import type { ItemComment, ItemStats } from "./types";

/**
 * Liking and commenting: the two writes behind the card's social row.
 *
 * ── THE ROW USED TO BE DISPLAY-ONLY, AND WHY ────────────────────────────────
 *
 * `stats.likes`, `stats.liked` and `stats.comments` have always arrived on the
 * item, so the counts and the filled heart were real from the first render. The
 * only endpoint that could CHANGE them was /api/posts/[id]/like, and the note
 * on FeedCard said a Bearer client could not call it. That was half right and
 * worth correcting: `resolveSession()` accepts a Bearer token on every route in
 * the app, legacy ones included, so the call would in fact have succeeded. What
 * it would have returned is a bare `{ liked, count }` outside the v1 envelope —
 * which `apiV1()` rejects, since it reads `body.data` and finds nothing — and
 * it applies no `visibleItemWhere`, so a listing hidden from you by a block is
 * one you can still like. The two v1 routes fix both, and the legacy route is
 * left where it is for the web.
 *
 * ── THE CACHE IS PATCHED, NOT INVALIDATED ───────────────────────────────────
 *
 * A tapped heart must move NOW. Invalidating `["home"]` would refetch every
 * loaded page of a keyset-paginated feed in sequence and repaint the whole list
 * a second or two later, which is the opposite of instant — and on a slow
 * connection it is a visible stall on the one interaction that should feel
 * free. So the mutation writes the new stats straight into every cache that
 * holds the item, and the server's answer overwrites that guess when it lands.
 */

/* ────────────────────────────── cache ───────────────────────────────── */

/**
 * Writes `stats` onto every copy of one item anywhere in the cache.
 *
 * ── WHY THIS WALKS THE CACHE INSTEAD OF KNOWING ITS SHAPE ───────────────────
 *
 * The same listing is cached in three different shapes: `["home"]` holds it at
 * `pages[].payload.feed[]`, `["browse", filters]` at `pages[].payload.items[]`,
 * and `["item", id]` at `data.item`. Three hand-written updaters is three places
 * to forget when a fourth screen caches an item — and the failure is silent and
 * specific: the heart animates on the feed and is grey again on the grid.
 *
 * So the rule is stated once, structurally: ANY object carrying this `id` and a
 * `stats` block is a copy of this item, and gets the new stats. It is the only
 * shape in this API that has both.
 *
 * REFERENTIALLY CONSERVATIVE. Every branch that did not change is returned by
 * identity, so React re-renders the cards that moved and nothing else. A walk
 * that rebuilt the tree would repaint every row in the feed on every tap, which
 * would cost far more than the invalidate this exists to avoid.
 */
function writeStats<T>(node: T, itemId: string, stats: ItemStats): T {
  if (Array.isArray(node)) {
    let changed = false;
    const next = node.map((child) => {
      const patched = writeStats(child, itemId, stats);
      if (patched !== child) changed = true;
      return patched;
    });
    return (changed ? next : node) as T;
  }

  if (!node || typeof node !== "object") return node;

  const obj = node as Record<string, unknown>;

  if (obj.id === itemId && obj.stats && typeof obj.stats === "object") {
    return { ...obj, stats } as T;
  }

  let changed = false;
  const next: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const patched = writeStats(obj[key], itemId, stats);
    if (patched !== obj[key]) changed = true;
    next[key] = patched;
  }
  return (changed ? next : node) as T;
}

/** Applies `stats` to the item wherever it is cached. */
function patchStats(qc: QueryClient, itemId: string, stats: ItemStats) {
  const rewrite = (cached: unknown) => writeStats(cached, itemId, stats);
  qc.setQueriesData({ queryKey: ["home"] }, rewrite);
  qc.setQueriesData({ queryKey: ["browse"] }, rewrite);
  qc.setQueriesData({ queryKey: ["item", itemId] }, rewrite);
}

/**
 * The item's stats as the cache currently has them, for the rollback snapshot.
 *
 * `["home"]` first because that is the screen these mutations fire from; the
 * detail cache is the fallback for a like tapped from a screen the feed has
 * never loaded.
 */
function readStats(qc: QueryClient, itemId: string): ItemStats | null {
  for (const key of [["home"], ["browse"], ["item", itemId]]) {
    const found = findStats(qc.getQueriesData<unknown>({ queryKey: key }), itemId);
    if (found) return found;
  }
  return null;
}

function findStats(entries: [unknown, unknown][], itemId: string): ItemStats | null {
  for (const [, data] of entries) {
    const hit = searchStats(data, itemId);
    if (hit) return hit;
  }
  return null;
}

function searchStats(node: unknown, itemId: string): ItemStats | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = searchStats(child, itemId);
      if (hit) return hit;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;

  const obj = node as Record<string, unknown>;
  if (obj.id === itemId && obj.stats && typeof obj.stats === "object") {
    return obj.stats as ItemStats;
  }

  for (const key of Object.keys(obj)) {
    const hit = searchStats(obj[key], itemId);
    if (hit) return hit;
  }
  return null;
}

/* ─────────────────────────────── like ───────────────────────────────── */

/**
 * POST (like) and DELETE (unlike) /api/v1/items/[id]/like.
 *
 * ONE HOOK, TWO METHODS. The caller passes the state it wants — `next: true`
 * to like — rather than "toggle", so a retry can never invert the result. The
 * endpoints are idempotent for the same reason; see the route.
 *
 * ── ON cancelQueries ────────────────────────────────────────────────────────
 *
 * Outgoing `["home"]` and `["browse"]` fetches are cancelled before the
 * optimistic write. Without it a refetch that left the server BEFORE the like
 * was written can land AFTER it, and the heart silently reverts and stays
 * reverted until the next fetch — a bug that looks exactly like "the like did
 * not save". The cost is that a pull-to-refresh in flight at the instant a
 * heart is tapped is abandoned, and its spinner retracts early. That is a rare
 * simultaneity with a harmless outcome, traded against a common one with a
 * misleading outcome.
 */
export function useLike() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, next }: { itemId: string; next: boolean }) =>
      apiV1<{ stats: ItemStats }>(
        `/api/v1/items/${encodeURIComponent(itemId)}/like`,
        { method: next ? "POST" : "DELETE" },
      ),

    onMutate: async ({ itemId, next }) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: ["home"] }),
        qc.cancelQueries({ queryKey: ["browse"] }),
        qc.cancelQueries({ queryKey: ["item", itemId] }),
      ]);

      const before = readStats(qc, itemId);
      if (!before) return { before: null };

      // Guarded rather than ±1 unconditionally. Two taps that both resolve to
      // "like" — a double tap, or a tap on a card whose cached copy was already
      // liked — must not add two, and the count must never go below zero.
      const likes = next
        ? before.liked
          ? before.likes
          : before.likes + 1
        : before.liked
          ? Math.max(0, before.likes - 1)
          : before.likes;

      patchStats(qc, itemId, { ...before, liked: next, likes });
      return { before };
    },

    // The server counted; the client guessed. The count can differ from the
    // guess by more than one — other people have been tapping too — so this
    // replaces the block rather than reconciling it.
    onSuccess: ({ data }, { itemId }) => patchStats(qc, itemId, data.stats),

    onError: (_err, { itemId }, ctx) => {
      if (ctx?.before) patchStats(qc, itemId, ctx.before);
    },
  });
}

/* ───────────────────────────── comments ─────────────────────────────── */

export const commentsKey = (itemId: string) => ["comments", itemId] as const;

interface CommentsPage {
  comments: ItemComment[];
  nextCursor: string | null;
}

async function fetchCommentsPage(
  itemId: string,
  cursor: string | null,
): Promise<CommentsPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const { data, meta } = await apiV1<{ comments: ItemComment[] }>(
    `/api/v1/items/${encodeURIComponent(itemId)}/comments${query}`,
  );
  return {
    comments: data.comments,
    nextCursor: typeof meta.nextCursor === "string" ? meta.nextCursor : null,
  };
}

/**
 * GET /api/v1/items/[id]/comments — newest first, keyset paginated.
 *
 * `enabled` is the sheet's visibility, not merely a non-empty id: the feed
 * renders one sheet for the whole list, so without it every card's comments
 * would be fetched the moment the sheet's item changed, whether or not anybody
 * opened it.
 */
export function useComments(itemId: string | null, enabled: boolean) {
  const query = useInfiniteQuery({
    queryKey: commentsKey(itemId ?? ""),
    queryFn: ({ pageParam }) => fetchCommentsPage(itemId!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: enabled && !!itemId,
  });

  return {
    ...query,
    comments: (query.data?.pages ?? []).flatMap((p) => p.comments),
  };
}

/**
 * POST /api/v1/items/[id]/comments.
 *
 * The new comment is PREPENDED to page 0 rather than the list being
 * invalidated, and the list is newest-first, so it lands where the server would
 * have put it. Invalidating instead would refetch every loaded page and scroll
 * the reader's own comment into view a second later, from the bottom.
 *
 * NOT OPTIMISTIC, unlike the heart, and the difference is what failure costs.
 * A like that fails and rolls back is a heart that blinks. A comment that fails
 * and rolls back is a paragraph somebody wrote and watched vanish — so this one
 * waits for the server, keeps the draft in the composer until it succeeds, and
 * the composer says it is sending.
 */
export function useAddComment(itemId: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (content: string) =>
      apiV1<{ comment: ItemComment; stats: ItemStats }>(
        `/api/v1/items/${encodeURIComponent(itemId!)}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      ),

    onSuccess: ({ data }) => {
      if (!itemId) return;

      qc.setQueryData<{ pages: CommentsPage[]; pageParams: unknown[] }>(
        commentsKey(itemId),
        (cached) => {
          if (!cached?.pages.length) return cached;
          const [first, ...rest] = cached.pages;
          return {
            ...cached,
            pages: [{ ...first, comments: [data.comment, ...first.comments] }, ...rest],
          };
        },
      );

      // The card behind the sheet carries the comment count. Same block, same
      // path as a like — see patchStats.
      patchStats(qc, itemId, data.stats);
    },
  });
}
