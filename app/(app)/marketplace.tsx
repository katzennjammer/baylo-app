import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { ApiError } from "../../src/api/client";
import { Splash } from "../../src/components/Splash";
import {
  activeFilterCount,
  isFiltered,
  MAX_CATEGORIES,
  useBrowse,
  type BrowseFilters,
} from "../../src/api/browse";
import {
  CategoryRail,
  FilterButton,
  SearchField,
  ViewToggle,
  type BrowseView,
} from "../../src/components/marketplace/BrowseControls";
import { useHubs } from "../../src/api/hubs";
import { HubMap } from "../../src/components/map/HubMap";
import { MapErrorBoundary } from "../../src/components/map/MapErrorBoundary";
import { HubSheet } from "../../src/components/map/HubSheet";
import { MapLegend } from "../../src/components/map/MapLegend";
import { FilterSheet } from "../../src/components/marketplace/FilterSheet";
import {
  BrowseEmpty,
  BrowseError,
  BrowseNoMatches,
  BrowseSkeleton,
} from "../../src/components/marketplace/BrowseStates";
import { GridTile } from "../../src/components/marketplace/GridTile";
import { color, space, textStyle, type } from "../../src/theme/tokens";
import type { Item } from "../../src/api/types";

/**
 * The Marketplace tab — category browsing and search.
 *
 * A DIFFERENT MODE FROM THE FEED, and the two-column grid is the visible half
 * of that. Home answers "what did people post"; this answers "what is out
 * there", which is a comparison task — equal boxes, scannable, no social row
 * and no owner. See the note on GridTile for what is deliberately absent.
 *
 * ── WHAT /api/v1/browse ACTUALLY TAKES ──────────────────────────────────────
 *
 *   q          1–100 chars, matched against title OR DESCRIPTION
 *   category   one value or up to five, comma-separated
 *   condition  one value
 *   minLeaves / maxLeaves
 *   cursor, limit, lat, lng, radiusKm, sort
 *
 * The route parses with `z.strictObject`, so an unknown parameter is a 400
 * rather than something ignored. An earlier version of this file claimed the
 * route already took `condition` — it did not, and that comment is why the
 * filter was designed against an endpoint that would have rejected it.
 * `condition`, `minLeaves` and `maxLeaves` were added to the route for this
 * screen; the response shape was left alone.
 *
 * ── THE MAP VIEW IS A DIFFERENT QUESTION, NOT A DIFFERENT LAYOUT ────────────
 *
 * The toggle swaps the grid for a map of Safe-Zone HUBS — and hubs are not
 * items. GET /api/v1/hubs takes `city` and `type` and nothing this screen's
 * filters produce, so none of the search box, the category rail or the filter
 * sheet narrows what is pinned.
 *
 * The controls are therefore REMOVED in map mode rather than disabled. A search
 * box above a map that ignores it is a bug report waiting to be filed; an
 * absent one is a mode. See the note on `ViewToggle`.
 *
 * `sort=nearest` and `radiusKm` exist on the browse route and are still unused.
 * Distance-sorting needs the user's location, and this app does not ask for it
 * — see the note on `HubMap`. It is also a different feature from a map and can
 * land on its own.
 *
 * ── SEARCH IS SUBMITTED, NOT LIVE ───────────────────────────────────────────
 *
 * The field holds its own text and only becomes a query on submit or on clear.
 * A keystroke-per-request search would fire five queries for "chair", four of
 * which are for prefixes nobody wants, and each one is a keyset-paginated page
 * from a table scan. The category chips ARE live, because a chip is one
 * complete decision and a half-typed word is not.
 */
export default function MarketplaceScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  /** The text in the box, which is not yet the text being searched for. */
  const [draftQuery, setDraftQuery] = useState("");
  const [filters, setFilters] = useState<BrowseFilters>({});
  const [sheetOpen, setSheetOpen] = useState(false);

  /** Grid or map. See the note in the header on why this is a mode, not a skin. */
  const [view, setView] = useState<BrowseView>("grid");
  /** Which pin's card is up. Owned here so the map and the sheet cannot disagree. */
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null);

  /**
   * The hub query runs only once the map has been asked for.
   *
   * `enabled` rather than an unconditional fetch: most sessions never open the
   * map, and firing a request for 22 hubs on every visit to the grid would be
   * paying for a screen nobody looked at. Once fetched it is held for half an
   * hour — the table is curated, not live.
   */
  const hubsQuery = useHubs(view === "map");

  const {
    items,
    facets,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useBrowse(filters);

  /**
   * Tile width, from the real viewport rather than a percentage.
   *
   * `width: "48%"` looks equivalent and is not: with a `gap` between the
   * columns the two 48% tiles plus the gap can exceed the row, and RN wraps the
   * second one to a line of its own on narrow devices. Computing the pixel
   * width means the arithmetic is stated once and cannot disagree with the gap.
   */
  const tileWidth = useMemo(
    () => Math.floor((width - space.browse.gridX * 2 - space.browse.gridGap) / 2),
    [width],
  );

  const submitSearch = useCallback(() => {
    setFilters((f) => ({ ...f, q: draftQuery.trim() || undefined }));
  }, [draftQuery]);

  const toggleCategory = useCallback((category: string) => {
    setFilters((f) => {
      const current = f.categories ?? [];
      if (current.includes(category)) {
        return { ...f, categories: current.filter((c) => c !== category) };
      }
      // Silently ignoring the tap at the cap would read as a dead control; the
      // rail dims the blocked chips so this branch is only ever a safety net.
      if (current.length >= MAX_CATEGORIES) return f;
      return { ...f, categories: [...current, category] };
    });
  }, []);

  const clearEverything = useCallback(() => {
    setDraftQuery("");
    setFilters({});
  }, []);

  const openItem = useCallback(
    (item: Item) => router.push({ pathname: "/item", params: { id: item.id } }),
    [router],
  );

  const onEndReached = useCallback(() => {
    // The isFetchingNextPage guard is not optional: FlatList re-fires
    // onEndReached on every layout pass near the bottom, and without it a slow
    // page is requested repeatedly with the SAME cursor — which is how a keyset
    // list renders one page twice.
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: Item }) => (
      <GridTile item={item} width={tileWidth} onPress={openItem} />
    ),
    [tileWidth, openItem],
  );

  const filtering = isFiltered(filters);
  const filterCount = activeFilterCount(filters);

  /** The controls stay mounted in every state — they are how you leave one. */
  const header = (
    <View>
      <View style={s.searchRow}>
        <SearchField value={draftQuery} onChange={setDraftQuery} onSubmit={submitSearch} />
        <FilterButton count={filterCount} onPress={() => setSheetOpen(true)} />
      </View>

      <View style={s.toggleRow}>
        <ViewToggle view={view} onChange={setView} />
      </View>

      <View style={s.rail}>
        <CategoryRail
          facets={facets}
          selected={filters.categories ?? []}
          onToggle={toggleCategory}
          max={MAX_CATEGORIES}
        />
      </View>

      {items.length > 0 ? (
        <Text style={[textStyle(type.resultCount), s.count]}>
          {items.length}
          {hasNextPage ? "+" : ""} {items.length === 1 ? "result" : "results"}
        </Text>
      ) : null}
    </View>
  );

  // A 401 gets the Splash rather than an error state: by the time a query fails
  // with UNAUTHENTICATED the interceptor has already tried to refresh and
  // cleared the session, so the guard in (app)/_layout is about to replace this
  // whole tree with the login screen. An error card would flash for one frame.
  //
  // Splash rather than a blank frame — see the longer note at the matching
  // branch in (app)/index.tsx. Short version: when the redirect lands this is
  // indistinguishable from blank, and when it does not, blank was a white
  // screen that named neither what it was waiting on nor which origin it could
  // not reach.
  const apiError = error instanceof ApiError ? error : null;
  if (isError && apiError?.code === "UNAUTHENTICATED") {
    return <Splash waitingOn="Signing you back in" />;
  }

  /* ── map mode ──────────────────────────────────────────────────────────
     A separate return rather than a conditional ListHeaderComponent: the two
     modes share the toggle and nothing else, and threading a map through a
     FlatList's header would keep the item query's states (skeleton, no
     matches, end-of-list spinner) mounted around a list that is not there. */
  if (view === "map") {
    const hubs = hubsQuery.data?.hubs ?? [];
    const selected = hubs.find((h) => h.id === selectedHubId) ?? null;
    const hubsError = hubsQuery.error instanceof ApiError ? hubsQuery.error : null;

    return (
      <View style={s.screen}>
        <View style={s.toggleRowTop}>
          <ViewToggle view={view} onChange={setView} />
        </View>

        <View style={s.legend}>
          <MapLegend />
        </View>

        <View style={s.mapWrap}>
          {hubsQuery.isPending ? (
            <View style={s.mapCentre}>
              <ActivityIndicator color={color.forest} />
            </View>
          ) : hubsQuery.isError ? (
            <BrowseError
              message={
                hubsError?.message ?? "Check your mobile data or Wi-Fi and try again."
              }
              onRetry={hubsQuery.refetch}
            />
          ) : (
            <>
              {/* Degrades to the hub list rather than a blank map view.
                  See MapErrorBoundary. */}
              <MapErrorBoundary
                hubs={hubs}
                onOpenHub={(hubId) => router.push({ pathname: "/hub", params: { id: hubId } })}
              >
                <HubMap
                  hubs={hubs}
                  interactive
                  selectedHubId={selectedHubId}
                  onSelectHub={setSelectedHubId}
                  emptyMessage="No Safe Zones have been set up yet. They are added city by city."
                  style={s.map}
                />
              </MapErrorBoundary>

              {selected ? (
                <HubSheet
                  hub={selected}
                  onClose={() => setSelectedHubId(null)}
                  onOpenItems={(hubId) =>
                    router.push({ pathname: "/hub", params: { id: hubId } })
                  }
                />
              ) : null}
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <FlatList
        data={items}
        keyExtractor={keyOf}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={s.column}
        contentContainerStyle={s.content}
        ListHeaderComponent={header}
        ListEmptyComponent={
          isPending ? (
            <BrowseSkeleton tileWidth={tileWidth} />
          ) : isError ? (
            <BrowseError
              message={
                apiError?.message ??
                "Check your mobile data or Wi-Fi and try again. Nothing you posted was lost."
              }
              onRetry={refetch}
            />
          ) : filtering ? (
            <BrowseNoMatches
              query={filters.q ?? ""}
              filterCount={filterCount}
              onClear={clearEverything}
            />
          ) : (
            <BrowseEmpty onPost={() => router.push("/post")} />
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={s.footer}>
              <ActivityIndicator color={color.green} />
            </View>
          ) : (
            <View style={s.footerSpacer} />
          )
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        refreshControl={
          <RefreshControl
            // Not while paginating: both are refetches to TanStack, and without
            // the guard reaching the bottom spins the indicator at the top.
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={refetch}
            tintColor={color.green}
            colors={[color.green]}
            progressBackgroundColor={color.surface}
          />
        }
        keyboardShouldPersistTaps="handled"
      />

      <FilterSheet
        visible={sheetOpen}
        filters={filters}
        facets={facets}
        onApply={(next) => {
          setFilters(next);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

const keyOf = (item: Item) => item.id;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.browse.searchGap,
    paddingHorizontal: space.screenX,
    paddingTop: space.browse.searchY,
  },
  rail: { paddingVertical: space.browse.chipsY },

  /* The toggle sits under the search row in grid mode and at the top of the
     screen in map mode, where there is no search row above it to sit under. */
  toggleRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: space.screenX,
    paddingTop: space.browse.chipsY,
  },
  toggleRowTop: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: space.screenX,
    paddingTop: space.browse.searchY,
  },
  legend: { paddingVertical: space.browse.chipsY },
  mapWrap: {
    flex: 1,
    paddingHorizontal: space.screenXTight,
    paddingBottom: space.screenXTight,
  },
  map: { flex: 1 },
  mapCentre: { flex: 1, alignItems: "center", justifyContent: "center" },
  count: {
    paddingHorizontal: space.browse.gridX,
    paddingBottom: space.browse.countY,
    color: color.inkMuted,
  },
  content: { paddingBottom: space.trending.y },
  // `gap` on the wrapper spaces the columns; the row spacing is the same value
  // so the grid reads as a grid rather than as rows of pairs.
  column: {
    gap: space.browse.gridGap,
    paddingHorizontal: space.browse.gridX,
    marginBottom: space.browse.gridGap,
  },
  footer: { paddingVertical: space.trending.y },
  footerSpacer: { height: space.trending.y },
});
