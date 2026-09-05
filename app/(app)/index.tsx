import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native";

import { ApiError } from "../../src/api/client";
import { Splash } from "../../src/components/Splash";
import { Divider } from "../../src/components/Divider";
import { CommentsSheet } from "../../src/components/home/CommentsSheet";
import { EditListingSheet } from "../../src/components/home/EditListingSheet";
import { EmptyFeed } from "../../src/components/home/EmptyFeed";
import { FeedCard } from "../../src/components/home/FeedCard";
import { FeedError } from "../../src/components/home/FeedError";
import { FeedSkeleton } from "../../src/components/home/FeedSkeleton";
import { ListingMenu } from "../../src/components/home/ListingMenu";
import { StoriesRow } from "../../src/components/home/StoriesRow";
import { TrendingStrip } from "../../src/components/home/TrendingStrip";
import { color, space } from "../../src/theme/tokens";
import { useHome } from "../../src/api/home";
import { useLike } from "../../src/api/social";
import { shareListing } from "../../src/lib/share";
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

/**
 * THE THREE SHEETS ARE MOUNTED HERE, ONE EACH, NOT ONE PER CARD.
 *
 * Each is a React Native `Modal`, and a Modal is a native modal host — a
 * separate window on Android, a presented view controller on iOS. Rendering one
 * inside FeedCard would mean forty of them alive in a scrolled feed, each with
 * its own mount cost and animation driver, to support a thing that can only be
 * open once. So the card raises an event with the item, this screen records
 * which item that was, and the sheet renders from that.
 *
 * Which also means the sheets survive the card scrolling out of the viewport
 * and being unmounted by FlatList — the item is held in this screen's state,
 * not in the row's.
 *
 * The menu and the editor are two states rather than one nested sheet: tapping
 * "Edit listing" closes the menu and opens the editor, because two Modals
 * stacked is a scrim over a scrim, and on Android the second one's back button
 * dismisses both.
 */
export default function HomeScreen() {
  const router = useRouter();
  /**
   * WHAT IS HELD IS AN ID, AND THE ITEM IS LOOKED UP FROM THE FEED.
   *
   * Holding the `Item` object instead would freeze it at the moment of the tap,
   * and every one of these sheets renders something that then MOVES: the
   * comment sheet's header counts comments and one is about to be added, the
   * editor seeds from the title and description, the menu draws the owner's
   * name. Post a comment against a captured object and the header still says
   * what it said before you typed.
   *
   * Resolving through `feed` on each render means the sheets read the same
   * cache the cards do, so an optimistic write updates the sheet and the card
   * behind it together. It also closes them correctly for free: an item that
   * leaves the feed — removed, or its owner blocked — resolves to undefined,
   * and the sheet unmounts because the thing it was about is gone.
   */
  const [menuId, setMenuId] = useState<string | null>(null);
  const [commentsId, setCommentsId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // `mutate`, not the whole mutation object. useMutation() returns a NEW object
  // on every render — it carries isPending and friends — so depending on it
  // would rebuild `onLike`, and therefore `renderItem`, on every render, and
  // FlatList would repaint every visible card each time anything on this screen
  // changed. `mutate` itself is a stable reference.
  const { mutate: like } = useLike();
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

  /** The card's Offer Trade button and a tap on the card both land here. */
  const openItem = useCallback(
    (item: Item) => router.push({ pathname: "/item", params: { id: item.id } }),
    [router],
  );

  /**
   * The heart.
   *
   * `next` comes from the card, which read it off the item it is rendering —
   * so the request always states the state being asked for rather than "flip
   * whatever you have", and a retry after a timeout cannot invert the result.
   *
   * NO onError HERE. The mutation rolls the cache back itself, so the heart
   * returns to where it was; an alert on top of that would interrupt a scroll
   * to report something the user can already see, and the recovery is to tap
   * again. The comment composer, where a failure would lose written text, does
   * raise one.
   */
  const onLike = useCallback(
    (item: Item, next: boolean) => like({ itemId: item.id, next }),
    [like],
  );

  /** The OS share sheet, with a link to the listing's public web page. */
  const onShare = useCallback((item: Item) => {
    void shareListing(item);
  }, []);

  const openMenu = useCallback((item: Item) => setMenuId(item.id), []);
  const openComments = useCallback((item: Item) => setCommentsId(item.id), []);

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
          {/*
            The card's Offer Trade button had nowhere to go until item detail
            existed — `onOffer` was optional and nothing passed it, so the
            control was inert. It opens the listing now; the offer sheet itself
            is one more hop and is still a placeholder.

            The other four handlers are the row that used to be display-only,
            plus the three dots. Passing them is what turns those glyphs into
            buttons — FeedCard renders each one as inert text when its handler
            is absent, so this list is the whole difference.
          */}
          <FeedCard
            item={row.item}
            onOffer={openItem}
            onLike={onLike}
            onComment={openComments}
            onShare={onShare}
            onMenu={openMenu}
          />
          <Divider />
        </View>
      );
    },
    [trending, openItem, onLike, onShare, openComments, openMenu],
  );

  // Resolved fresh on every render. `?? null` because the sheets take null for
  // "closed" and `find` answers undefined for "gone".
  const byId = (id: string | null) => (id ? (feed.find((i) => i.id === id) ?? null) : null);
  const menuItem = byId(menuId);
  const commentsItem = byId(commentsId);
  const editingItem = byId(editingId);

  const hasCache = viewer !== undefined;

  if (isPending && !hasCache) {
    return (
      <View style={{ flex: 1, backgroundColor: color.surface }}>
        <FeedSkeleton />
      </View>
    );
  }

  if (isError && !hasCache) {
    // A 401 gets the Splash, not an error state. By the time a query fails with
    // UNAUTHENTICATED the interceptor has already tried to refresh and given up,
    // which means it has already cleared the session — so the guard in
    // (app)/_layout.tsx is about to replace this whole tree with the login
    // screen. Rendering a Retry button would flash for one frame and vanish.
    //
    // Splash rather than a blank frame, because "about to" is doing a lot of
    // work in that sentence. When the redirect lands promptly this shows the
    // same spinner a blank frame would have, and nobody sees a difference. When
    // it does NOT land — the guard is wedged, the refresh never resolved, the
    // API is unreachable — the blank frame was a white screen with no way to
    // tell which. Splash reveals the bundle and API origins after a few seconds
    // and says what it is waiting on, which is the whole difference between a
    // failure you can read and one you have to guess at.
    const apiError = error instanceof ApiError ? error : null;
    if (apiError?.code === "UNAUTHENTICATED") {
      return <Splash waitingOn="Signing you back in" />;
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
    <>
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

      <ListingMenu
        item={menuItem}
        viewerId={viewer?.id ?? null}
        onClose={() => setMenuId(null)}
        onEdit={(item) => {
          // Closed first, then opened. See the note above the component.
          setMenuId(null);
          setEditingId(item.id);
        }}
      />

      <EditListingSheet item={editingItem} onClose={() => setEditingId(null)} />

      <CommentsSheet item={commentsItem} onClose={() => setCommentsId(null)} />
    </>
  );
}

/** Stable keys across a refetch — the rail is a singleton, the cards are ids. */
function keyOf(row: Row): string {
  return row.kind === "item" ? `item:${row.item.id}` : row.kind;
}
