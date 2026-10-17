import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { apiV1 } from "./client";
import type { Item } from "./types";

/**
 * 24-hour listing stories (v1, 2 Oct 2026).
 *
 *   GET    /api/v1/stories              the row, grouped by author
 *   POST   /api/v1/stories              share one of your AVAILABLE listings
 *   DELETE /api/v1/stories/[id]         take your own story down
 *   POST   /api/v1/stories/[id]/seen    this viewer has seen it
 *
 * The server owns every rule (24 h, the listing still AVAILABLE, blocks both
 * ways, suspensions, the 10-a-day cap). The row arrives already ordered: your
 * own stories first, then authors with anything unseen, then the fully seen.
 *
 * PERSONAL ACCOUNTS ONLY. A POST sent while acting as a shop is refused
 * (FORBIDDEN, meta.code PERSONAL_ONLY); the row hides "Your story" in that
 * context so the refusal is never the first thing someone sees.
 */

export interface Story {
  id: string;
  type: "LISTING";
  caption: string | null;
  createdAt: string;
  expiresAt: string;
  seen: boolean;
  /** The shared listing, in the same shape the feed sends. */
  item: Item;
}

export interface StoryAuthor {
  user: { id: string; name: string; avatar: string | null };
  isOwn: boolean;
  /** Every story seen (always true for your own). The grey ring. */
  allSeen: boolean;
  /** Oldest first: the order the viewer plays them in. */
  stories: Story[];
}

export const STORIES_KEY = ["stories"] as const;
export const STORY_CAPTION_MAX = 200;

export function useStories() {
  return useQuery({
    queryKey: STORIES_KEY,
    queryFn: () => apiV1<{ authors: StoryAuthor[] }>("/api/v1/stories"),
    select: (r) => r.data.authors,
    // Stories move on a scale of minutes, and the row refetches on focus and
    // on the feed's pull-to-refresh anyway.
    staleTime: 30_000,
  });
}

type StoriesCache = { data: { authors: StoryAuthor[] }; meta: Record<string, unknown> };

/**
 * Marks one story seen in the cache, so the ring greys the moment the story
 * has played rather than on the next fetch. Referentially conservative: an
 * author whose stories did not change keeps its identity.
 */
function patchSeen(qc: QueryClient, storyId: string) {
  qc.setQueryData<StoriesCache>(STORIES_KEY, (old) => {
    if (!old) return old;
    let changed = false;
    const authors = old.data.authors.map((a) => {
      if (!a.stories.some((s) => s.id === storyId && !s.seen)) return a;
      changed = true;
      const stories = a.stories.map((s) => (s.id === storyId ? { ...s, seen: true } : s));
      return { ...a, stories, allSeen: stories.every((s) => s.seen) };
    });
    return changed ? { ...old, data: { authors } } : old;
  });
}

/**
 * Fire-and-forget. The cache is patched first; a failed request is not worth
 * interrupting a story for (the ring is green again on the next fetch).
 * The viewer patches the cache only AFTER it leaves the screen, so a group
 * does not reorder underneath someone who is watching it.
 */
export function useMarkStorySeen() {
  return useMutation({
    mutationFn: (storyId: string) =>
      apiV1<{ id: string; seen: true }>(`/api/v1/stories/${encodeURIComponent(storyId)}/seen`, {
        method: "POST",
      }),
  });
}

export function patchStoriesSeen(qc: QueryClient, storyIds: readonly string[]) {
  for (const id of storyIds) patchSeen(qc, id);
}

export function useCreateStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { itemId: string; caption?: string }) =>
      apiV1<{ id: string; expiresAt: string }>("/api/v1/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: input.itemId,
          ...(input.caption?.trim() ? { caption: input.caption.trim() } : {}),
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: STORIES_KEY }),
  });
}

export function useDeleteStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (storyId: string) =>
      apiV1<{ id: string; deleted: true }>(`/api/v1/stories/${encodeURIComponent(storyId)}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: STORIES_KEY }),
  });
}
