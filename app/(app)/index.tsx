import { useCallback, useMemo } from "react";
import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native";

import { ApiError } from "../../src/api/client";
import { Divider } from "../../src/components/Divider";
import { EmptyFeed } from "../../src/components/home/EmptyFeed";
import { FeedCard } from "../../src/components/home/FeedCard";
import { FeedError } from "../../src/components/home/FeedError";
import { FeedSkeleton } from "../../src/components/home/FeedSkeleton";
import { StoriesRow } from "../../src/components/home/StoriesRow";
import { TrendingStrip } from "../../src/components/home/TrendingStrip";
import { color, space } from "../../src/theme/tokens";
import { useHome } from "../../src/api/home";
import type { Item } from "../../src/api/types";

/**
 * Home — GET /api/v1/home, rendered as Direction 1.
 *
 * One request behind this whole screen. The stories row, the trending rail and
 * the feed all come out of the same payload; the header does too, from the same
 * cache entry.
 *
 * EVERYTHING IS IN THE LIST, not stacked around it. Putting the rails in a
 * parent View gives a feed that scrolls in its own little window between two
 * pinned blocks; as list rows the whole screen is one scroll, which is what a
 * feed is supposed to feel like. It is also the only way an interstitial can sit
 * BETWEEN cards, which is where the artboard puts it — trending appears after
 * the first listing, not above the feed.
 *
 * NO GAP BETWEEN CARDS. The spec is explicit: cards are the same fill as the
 * canvas and are separated by a 1 px rule, never by space or elevation. So
 * there is no ItemSeparatorComponent and no margin — every row draws its own
 * trailing divider, and the rail draws its own, which keeps exactly one rule
 * between any two things no matter what order they end up in.
 *
 * FOUR STATES, and which one wins matters:
 *
 *   pending, nothing cached   -> skeleton
 *   error,   nothing cached   -> full-screen retry
 *   error,   something cached -> the cached cards, under the header's bar
 *   loaded,  zero rows        -> empty
 *
 * The third is the one that is easy to get wrong. `isError` is checked AFTER
 * the cache, so a dropped connection during a background refetch leaves the
 * feed exactly where it was instead of replacing forty rows someone was reading
 * with a full-screen apology. The terracotta bar in AppHeader is what tells
 * them, and it is enough.
 */

/**
 * Where the trending interstitial lands: after the first card, which is the
 * artboard's rhythm — it interrupts early, while someone is still deciding
 * whether to keep scrolling. It is skipped when the feed is too short to reach
 * it, so a one-item feed does not end in a rail.
 */
const TRENDING_AFTER = 1;

/**
 * THE MATCHES INTERSTITIAL IS BUILT AND NOT MOUNTED, and that is a content
 * decision rather than an unfinished one.
 *
 * `MatchesStrip` implements the spec's inset section exactly — see the file for
 * how its geometry survives the endpoint having people where the artboard drew
 * items. What it cannot survive is that /api/v1/home returns exactly ONE list
 * of people, `matches`, and this screen has two slots drawn for people: the
 * ringed row at the top and this rail further down. Rendering both from one
 * five-element list puts the same five faces on the screen twice, a few hundred
 * pixels apart, which reads as a bug in a way that a missing section does not.
 *
 * The row wins the list because it is the more prominent of the two and it is
 * what the top of every artboard shows. Mounting the rail is a `{ kind:
 * "matches" }` row away the day there is a second source to fill it — matched
 * ITEMS, which is what the artboard is actually drawing.
 */

type Row = { kind: "item"; item: Item } | { kind: "trending" };

export default function HomeScreen() {
  const {
    viewer,
    trending,
    matches,
    feed,
    isPending,
    isError,
    error,
    isRefetching,
    dataUpdatedAt,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useHome();

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    feed.forEach((item, i) => {
      out.push({ kind: "item", item });
      if (i === TRENDING_AFTER - 1 && trending.length > 0) out.push({ kind: "trending" });
    });
    return out;
  }, [feed, trending.length]);

  const onEndReached = useCallback(() => {
    // hasNextPage is derived from meta.nextCursor. The isFetchingNextPage guard
    // matters more than it looks: FlatList fires onEndReached again on every
    // layout pass near the bottom, and without it a slow page would be
    // requested several times over — each with the SAME cursor, which is how a
    // keyset feed ends up rendering a page twice.
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  /**
   * The rails are rendered here rather than by a component defined in the
   * render body — a nested component declaration is a NEW component type on
   * every render, which unmounts and remounts the rail (and resets its
   * horizontal scroll position) every time anything on this screen changes.
   */
  const renderItem = useCallback(
    ({ item: row }: { item: Row }) => {
      if (row.kind === "trending") return <TrendingStrip trending={trending} />;
      return (
        <View>
          <FeedCard item={row.item} />
          <Divider />
        </View>
      );
    },
    [trending],
  );

  const hasCache = viewer !== undefined;

  if (isPending && !hasCache) {
    return (
      <View style={{ flex: 1, backgroundColor: color.surface }}>
        <FeedSkeleton />
      </View>
    );
  }

  if (isError && !hasCache) {
    // A 401 gets a blank frame, not an error state. By the time a query fails
    // with UNAUTHENTICATED the interceptor has already tried to refresh and
    // given up, which means it has already cleared the session — so the guard
    // in (app)/_layout.tsx is about to replace this whole tree with the login
    // screen. Rendering a Retry button would flash for one frame and vanish.
    const apiError = error instanceof ApiError ? error : null;
    if (apiError?.code === "UNAUTHENTICATED") {
      return <View style={{ flex: 1, backgroundColor: color.surface }} />;
    }

    return (
      <FeedError
        message="Check your mobile data or Wi-Fi and try again. Nothing you posted was lost."
        lastSyncedAt={dataUpdatedAt || null}
        onRetry={refetch}
      />
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: color.surface }}
      data={rows}
      keyExtractor={keyOf}
      renderItem={renderItem}
      ListHeaderComponent={<StoriesRow matches={matches} />}
      ListEmptyComponent={
        <View>
          <EmptyFeed location={viewer?.location ?? null} />
          <Divider />
          <TrendingStrip trending={trending} />
        </View>
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={{ paddingVertical: space.trending.y }}>
            <ActivityIndicator color={color.green} />
          </View>
        ) : (
          <View style={{ height: space.trending.y }} />
        )
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      refreshControl={
        <RefreshControl
          // Not while paginating. Both are refetches as far as TanStack is
          // concerned, and without the guard reaching the bottom of the feed
          // spins the pull-to-refresh indicator at the top of it.
          refreshing={isRefetching && !isFetchingNextPage}
          onRefresh={refetch}
          tintColor={color.green}
          colors={[color.green]}
          progressBackgroundColor={color.surface}
        />
      }
    />
  );
}

/** Stable keys across a refetch — the rail is a singleton, the cards are ids. */
function keyOf(row: Row): string {
  return row.kind === "item" ? `item:${row.item.id}` : row.kind;
}
