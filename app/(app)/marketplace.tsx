import { useFocusEffect, useRouter } from "expo-router";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Linking,
  RefreshControl,
  ScrollView,
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
import { HubTypeGlyph, MapLegend } from "../../src/components/map/MapLegend";
import { Tappable } from "../../src/components/Tappable";
import { FilterSheet } from "../../src/components/marketplace/FilterSheet";
import {
  BrowseEmpty,
  BrowseError,
  BrowseNoMatches,
  BrowseSkeleton,
} from "../../src/components/marketplace/BrowseStates";
import { GridTile } from "../../src/components/marketplace/GridTile";
import { useReach, tileOutOfReach } from "../../src/api/offer";
import { useSession } from "../../src/auth/session";
import { HowTradingWorksSheet } from "../../src/components/offer/OfferSheet";
import { hasSeenReachExplainer, markReachExplainerSeen } from "../../src/lib/reach-flag";
import { usePullToRefresh } from "../../src/lib/pull-to-refresh";
import { useRefetchOnFocus } from "../../src/lib/refetch-on-focus";
import { withTimeout } from "../../src/lib/with-timeout";
import { border, color, radius, space, textStyle, type } from "../../src/theme/tokens";
import type { Item, SafeZoneHub } from "../../src/api/types";
import type { MapHub } from "../../src/components/map/map-html";

/** How many nearest active hubs get the map glow and the strip under the status. */
const NEARBY_HUB_LIMIT = 3;

/**
 * How long to wait for a live GPS fix before falling back to showing all hubs.
 *
 * Ten seconds is chosen against the alternative, which is not "wait longer" but
 * "wait forever": indoor, in a basement, or on a phone whose GPS has not warmed
 * up, `getCurrentPositionAsync` can simply never settle, and the screen that
 * waits on it is a screen permanently announcing that it is finding nearby Safe
 * Zones. A slightly stale answer is worth more here than a perfect one, because
 * the cost of being wrong is the nearby strip listing a hub 200 m from where it
 * should be — and the cost of waiting is the feature appearing not to exist.
 */
const LOCATION_FIX_TIMEOUT_MS = 10_000;

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
 * `sort=nearest` and `radiusKm` exist on the browse route and are still unused
 * for LISTINGS. Hub distance is computed on-device once the map has a position,
 * so listing search never receives coordinates.
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
  /** Null shows every Safe Zone; otherwise the map is narrowed to one type. */
  const [hubTypeFilter, setHubTypeFilter] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [locationState, setLocationState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [locationDenied, setLocationDenied] = useState(false);

  /**
   * The hub query runs only once the map has been asked for.
   *
   * `enabled` rather than an unconditional fetch: most sessions never open the
   * map, and firing a request for 22 hubs on every visit to the grid would be
   * paying for a screen nobody looked at. Once fetched it is held for half an
   * hour — the table is curated, not live.
   */
  const hubsQuery = useHubs(view === "map");

  /**
   * Bumped to ask for another detection attempt.
   *
   * ── WHY THIS COUNTER EXISTS, AND WHY `locationState` COULD NOT DO THE JOB ────
   *
   * The detection effect below must not depend on `locationState`: it WRITES
   * that state (to "loading"), so having it in the dep array made the effect
   * cancel its own in-flight run and then bail on its own guard — the permanent
   * "Finding nearby Safe Zones…" hang. Depending on `[view]` alone fixed the
   * hang, but it took away the only trigger a SECOND attempt had: setting the
   * state back to "idle" no longer re-ran anything, so both the Try again button
   * and the return-from-Settings path would have silently stopped working.
   *
   * A counter restores that trigger without reintroducing the feedback loop: it
   * is incremented only from OUTSIDE the effect, the effect never writes it, so
   * a bump is always a deliberate "try again" and never a reaction to the
   * effect's own work. `view` stays in the deps beside it: opening the map is an
   * attempt, and so is every explicit retry afterwards.
   */
  const [locationAttempt, setLocationAttempt] = useState(0);

  const retryLocation = useCallback(() => {
    setUserLocation(null);
    setLocationDenied(false);
    setLocationState("idle");
    setLocationAttempt((n) => n + 1);
  }, []);

  /**
   * Detect position when the map opens. Location OFF / denied is not a gate:
   * hubs still load; this effect only fills the marker and the nearby sort.
   */
  useEffect(() => {
    if (view !== "map") return;
    //
    // THE DEPS ARE `[view, locationAttempt]` AND MUST NEVER INCLUDE
    // `locationState`, which is the whole "Finding nearby Safe Zones…" hang.
    //
    // This effect WRITES the state it used to depend on: it calls
    // setLocationState("loading") a line down. With `locationState` in the dep
    // array, that write re-ran the effect, whose cleanup set `cancelled = true`
    // for the run already in flight — so when the position finally arrived, the
    // `if (!cancelled)` guard discarded it. The re-run then hit the
    // `!== "idle"` guard and returned immediately. The net effect was a screen
    // that announced it was finding nearby Safe Zones and then waited forever,
    // doing nothing, with no error to show for it: every path that could have
    // set a final state had been cancelled by the state it was about to set.
    //
    // Re-entry is driven by `locationAttempt` instead — bumped only from outside
    // this effect, by retryLocation() and by the AppState listener below — while
    // the `!== "idle"` guard stays, so a re-render that is not an attempt (the
    // hub query resolving, the viewport measuring) cannot restart a request
    // that is already running.
    if (locationState !== "idle") return;
    let cancelled = false;
    setLocationState("loading");
    void (async () => {
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== Location.PermissionStatus.GRANTED) {
          permission = await Location.requestForegroundPermissionsAsync();
        }
        if (!permission.granted) {
          if (!cancelled) {
            setLocationDenied(true);
            setLocationState("unavailable");
          }
          return;
        }
        if (!cancelled) setLocationDenied(false);
        if (!(await Location.hasServicesEnabledAsync())) {
          // GPS is off. `enableNetworkProviderAsync` raises the system sheet that
          // offers to turn it on, and it settles when the user dismisses that
          // sheet — which they may never do. This is the one place a timeout is
          // NOT treated as a failure of its own: "they ignored the sheet" and
          // "they said yes" are then told apart by re-reading the setting below,
          // which is the only authority on whether services are on. A throw from
          // the OS call itself IS a real error and still takes the catch.
          try {
            await withTimeout(Location.enableNetworkProviderAsync(), 8_000);
          } catch {
            if (!cancelled) setLocationState("unavailable");
            return;
          }
          if (!(await Location.hasServicesEnabledAsync())) {
            if (!cancelled) setLocationState("unavailable");
            return;
          }
        }

        const lastKnown = await Location.getLastKnownPositionAsync({
          maxAge: 15 * 60 * 1000,
          requiredAccuracy: 2000,
        });
        if (lastKnown && !cancelled) {
          setUserLocation(lastKnown.coords);
          setLocationState("ready");
          return;
        }

        // `getCurrentPositionAsync` does not reliably reject when there is no
        // fix — indoors, or with GPS on but nothing in view — so it cannot be
        // awaited on its own. It also cannot simply be raced against a timer:
        // the losing timer keeps running, and worse, a race makes "no fix yet"
        // and "the phone refused" arrive as the same rejection, which the catch
        // below turns into the same message. Both are handled by the helper.
        const position = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          LOCATION_FIX_TIMEOUT_MS,
        );
        // A late fix arriving after the timeout is not an error to report: the
        // timeout already put up the honest "showing all Safe Zones" state, and
        // silently swapping it now would move the map under someone reading it.
        if (position && !cancelled) {
          setUserLocation(position.coords);
          setLocationState("ready");
        } else if (!cancelled) {
          setLocationState("unavailable");
        }
      } catch {
        if (!cancelled) setLocationState("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, locationAttempt]);

  /**
   * Turning Location ON in system settings should take on the next return.
   *
   * ── WHY THIS RE-TESTS THE PERMISSION RATHER THAN TRUSTING `locationDenied` ──
   *
   * The obvious guard is "only re-run if we did NOT fail on permission", and it
   * is wrong in the one case this effect exists for. A denial is a decision the
   * user is allowed to reverse, and the whole point of returning to the app is
   * that they just did. Gating on the remembered denial meant somebody who went
   * to Settings, granted location, and came back was told "Location unavailable"
   * by a screen that refused to look again — they had to find the "Try again"
   * button to undo a decision the OS had already forgotten.
   *
   * So the check on return is the OS's, not ours: ask whether anything has
   * changed since the last look. `getForegroundPermissionsAsync` is a cheap,
   * non-prompting read, so this cannot re-raise a dialog a user already
   * dismissed — the effect below understands a denied result and returns to
   * `unavailable`, which is the same screen they left.
   *
   * Re-entering `idle` when permission HAS changed is what makes the detection
   * effect re-run; leaving the state alone is what stops an app the user never
   * left from restarting a healthy location request on every foreground.
   */
  useEffect(() => {
    if (view !== "map") return;
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active" || locationState !== "unavailable") return;
      void (async () => {
        try {
          const permission = await Location.getForegroundPermissionsAsync();
          // Anything other than an outright denial is worth another attempt:
          // granted is the case this exists for, and undetermined means the
          // user has not answered yet and is entitled to be asked.
          if (permission.status !== Location.PermissionStatus.DENIED) {
            setLocationDenied(false);
            setLocationState("idle");
            // The bump is what actually re-runs detection — setting the state
            // back to "idle" no longer does it on its own, now that the effect
            // does not depend on `locationState`. Without this line, granting
            // location in Settings would clear the message and then sit there.
            setLocationAttempt((n) => n + 1);
          }
        } catch {
          // A permission read that throws is not a reason to change anything;
          // the screen is already showing its honest "unavailable" state.
        }
      })();
    });
    return () => sub.remove();
  }, [view, locationState]);

  const orderedHubs = useMemo(() => {
    const hubs = hubsQuery.data?.hubs ?? [];
    if (!userLocation) return hubs;
    return [...hubs].sort(
      (a, b) =>
        distanceKm(userLocation.latitude, userLocation.longitude, a) -
        distanceKm(userLocation.latitude, userLocation.longitude, b),
    );
  }, [hubsQuery.data?.hubs, userLocation]);

  const nearbyHubs = useMemo(() => {
    if (!userLocation) return [];
    return orderedHubs.filter((hub) => hub.isActive).slice(0, NEARBY_HUB_LIMIT);
  }, [orderedHubs, userLocation]);

  const visibleHubs = useMemo(
    () => hubTypeFilter ? orderedHubs.filter((hub) => hub.type === hubTypeFilter) : orderedHubs,
    [hubTypeFilter, orderedHubs],
  );

  const visibleNearbyHubs = useMemo(
    () => visibleHubs.filter((hub) => hub.isActive).slice(0, NEARBY_HUB_LIMIT),
    [visibleHubs],
  );

  const mapHubs: MapHub[] = useMemo(() => {
    const nearbyIds = new Set(visibleNearbyHubs.map((hub) => hub.id));
    return visibleHubs.map((hub) => ({
      id: hub.id,
      name: hub.name,
      type: hub.type,
      latitude: hub.latitude,
      longitude: hub.longitude,
      isActive: hub.isActive,
      nearby: nearbyIds.has(hub.id),
    }));
  }, [visibleHubs, visibleNearbyHubs]);

  /**
   * The grid's reach bracket: one above the viewer's best item, capped by
   * their tier. Null until the shelf has loaded.
   */
  const { gridReach: reach } = useReach();
  /**
   * Whose grid this is. The browse route includes the viewer's own listings,
   * and those tiles show the exact value where everyone else's show a bracket
   * — the same owner test `FeedCard` makes. The session is guaranteed by the
   * (app) layout gate, so this is never null here.
   */
  const viewerId = useSession().session?.user.id ?? null;

  const {
    items,
    facets,
    isPending,
    isError,
    error,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useBrowse(filters);

  // Another device's post shows up here when this tab is returned to. Ours is
  // already here — the post mutation invalidated this query before it closed.
  useRefetchOnFocus(refetch);
  const { refreshing, onRefresh } = usePullToRefresh(refetch);

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

  /**
   * The Organizations pill.
   *
   * Cleared to `undefined` rather than set to `false`, so the filter object
   * and its query key are identical to what they were before the pill was ever
   * tapped. Leaving a `false` behind would give the same query two cache keys
   * and refetch the whole first page every time the pill was turned off.
   */
  const toggleOrgsOnly = useCallback(() => {
    setFilters((f) => (f.orgsOnly ? { ...f, orgsOnly: undefined } : { ...f, orgsOnly: true }));
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
      <GridTile
        item={item}
        width={tileWidth}
        onPress={openItem}
        reach={reach}
        viewerId={viewerId}
      />
    ),
    [tileWidth, openItem, reach, viewerId],
  );

  /*
   * The one-time `How trading works` sheet.
   *
   * Two conditions: the grid must actually contain an out-of-reach tile, and
   * this account must not have dismissed it before.
   *
   * The flag file is read on mount and again each time the tab regains focus —
   * not on every render, which would put a synchronous file read in the render
   * path of a scrolling grid. The focus re-read exists for one reason: the
   * dev-only reset in Settings clears the flag while this tab stays mounted
   * behind it, and the demo has to show the sheet on the way back.
   *
   * "Never shown again, including after the threshold moves" is what
   * `dismissed` protects: once it is true nothing re-opens the sheet, even if
   * the shelf changes and a different set of tiles goes grey.
   */
  const [dismissed, setDismissed] = useState(() => hasSeenReachExplainer());
  useFocusEffect(
    useCallback(() => {
      setDismissed(hasSeenReachExplainer());
    }, []),
  );
  // The tile's own predicate, so the prompt and the grey cannot disagree.
  const anyOutOfReach =
    reach !== null && items.some((i) => i.owner.id !== viewerId && tileOutOfReach(i, reach));
  const showPrompt = !dismissed && anyOutOfReach && view === "grid";

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
          orgsOnly={filters.orgsOnly ?? false}
          onToggleOrgs={toggleOrgsOnly}
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
    const selected = visibleHubs.find((h) => h.id === selectedHubId) ?? null;
    const hubsError = hubsQuery.error instanceof ApiError ? hubsQuery.error : null;

    return (
      <View style={s.screen}>
        <View style={s.toggleRowTop}>
          <ViewToggle view={view} onChange={setView} />
        </View>

        <View style={s.legend}>
          <MapLegend
            selectedType={hubTypeFilter}
            onSelectType={(next) => {
              setHubTypeFilter(next);
              setSelectedHubId(null);
            }}
          />
        </View>

        <View style={s.locationRow}>
          <Text style={s.locationStatus} accessibilityLiveRegion="polite">
            {locationState === "loading"
              ? "Finding nearby Safe Zones…"
              : locationState === "ready"
                ? "Nearby Safe Zones are highlighted first"
                : locationState === "unavailable"
                  ? locationDenied
                    ? // Naming the actual cause, because "Location unavailable" is
                      // what you see whether the permission was refused, the
                      // phone's GPS is off, or the fix simply timed out -- three
                      // different fixes behind one sentence. Denied is the one
                      // that needs Settings, so it is the one that says so.
                      "Location is off for Baylo. All Safe Zones are shown."
                    : "Location unavailable. Showing all Safe Zones."
                  : ""}
          </Text>
          {locationState === "unavailable" ? (
            <Tappable
              onPress={() => {
                if (locationDenied) {
                  // Settings, and then STOP. The retry that used to follow this
                  // line reset the state to `idle` while the app was still on
                  // its way out to Settings, so the detection effect re-ran
                  // against a permission the user had not changed yet, failed,
                  // and put back the same card -- a button that visibly did
                  // nothing. Coming back is handled instead by the AppState
                  // listener, which re-reads the permission at the moment the
                  // user actually returns.
                  void Linking.openSettings().catch(() => {});
                  return;
                }
                retryLocation();
              }}
              accessibilityRole="button"
              accessibilityLabel={
                locationDenied
                  ? "Open settings to allow location"
                  : "Try locating again"
              }
              style={s.locationRetry}
              pressedStyle={s.locationRetryPressed}
            >
              <Text style={[textStyle(type.photoCaption), { color: color.forest }]}>
                {locationDenied ? "Allow" : "Try again"}
              </Text>
            </Tappable>
          ) : null}
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
                hubs={visibleHubs}
                onOpenHub={(hubId) => router.push({ pathname: "/hub", params: { id: hubId } })}
              >
                <HubMap
                  hubs={mapHubs}
                  userLocation={userLocation}
                  interactive
                  selectedHubId={selectedHubId}
                  onSelectHub={setSelectedHubId}
                  emptyMessage={
                    hubTypeFilter
                      ? "No Safe Zones of this type are available yet."
                      : "No Safe Zones have been set up yet. They are added city by city."
                  }
                  style={s.map}
                />
              </MapErrorBoundary>

              {locationState === "ready" && userLocation && visibleNearbyHubs.length > 0 && !selected ? (
                <View style={s.nearbyOverlay} pointerEvents="box-none">
                  <NearestHubsStrip
                    hubs={visibleNearbyHubs}
                    origin={userLocation}
                    selectedHubId={selectedHubId}
                    onSelect={setSelectedHubId}
                  />
                </View>
              ) : null}

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
              orgsOnly={filters.orgsOnly ?? false}
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
            // The pull, and only the pull. Background refetches (focus, foreground,
            // invalidation) update the list without spinning this.
            refreshing={refreshing}
            onRefresh={onRefresh}
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

      {/* Mounted last so it sits over the grid and the filter button. It renders
          nothing until both conditions above hold; the Modal inside it is
          created and destroyed with the prompt rather than kept alive behind the
          screen — the same arrangement `ReportSheet` uses on item detail. */}
      {showPrompt ? (
        <HowTradingWorksSheet
          onGotIt={() => {
            // The write happens here and nowhere else — `Got it` is the one
            // way out, and a prompt torn down by a process death was not read.
            markReachExplainerSeen();
            setDismissed(true);
          }}
        />
      ) : null}
    </View>
  );
}

const keyOf = (item: Item) => item.id;

function distanceKm(latitude: number, longitude: number, hub: SafeZoneHub): number {
  const earthRadiusKm = 6371;
  const latDelta = ((hub.latitude - latitude) * Math.PI) / 180;
  const lngDelta = ((hub.longitude - longitude) * Math.PI) / 180;
  const originLatitude = (latitude * Math.PI) / 180;
  const hubLatitude = (hub.latitude * Math.PI) / 180;
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.sin(lngDelta / 2) ** 2 * Math.cos(originLatitude) * Math.cos(hubLatitude);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistanceKm(km: number): string {
  if (km < 0.1) return "Nearby";
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function NearestHubsStrip({
  hubs,
  origin,
  selectedHubId,
  onSelect,
}: {
  hubs: SafeZoneHub[];
  origin: { latitude: number; longitude: number };
  selectedHubId: string | null;
  onSelect: (hubId: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.nearbyRow}
      accessibilityRole="summary"
      accessibilityLabel="Nearest Safe Zones, listed first"
    >
      {hubs.map((hub) => {
        const selected = hub.id === selectedHubId;
        return (
          <Tappable
            key={hub.id}
            onPress={() => onSelect(hub.id)}
            accessibilityRole="button"
            accessibilityLabel={`${hub.name}, ${formatDistanceKm(distanceKm(origin.latitude, origin.longitude, hub))}`}
            style={[s.nearbyChip, selected && s.nearbyChipSelected]}
            pressedStyle={s.nearbyChipPressed}
          >
            <View style={s.nearbyWell}>
              <HubTypeGlyph hubType={hub.type} size={13} />
            </View>
            <View style={s.nearbyCopy}>
              <Text style={[textStyle(type.gridMeta), s.nearbyName]} numberOfLines={1}>
                {hub.name}
              </Text>
              <Text style={[textStyle(type.photoCaption), s.nearbyMeta]} numberOfLines={1}>
                {formatDistanceKm(distanceKm(origin.latitude, origin.longitude, hub))}
              </Text>
            </View>
          </Tappable>
        );
      })}
    </ScrollView>
  );
}

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
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.browse.searchGap,
    paddingHorizontal: space.screenX,
    minHeight: 18,
  },
  locationStatus: {
    flex: 1,
    color: color.inkMuted,
    ...textStyle(type.photoCaption),
  },
  locationRetry: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.photoCaption,
    borderWidth: border.hairline,
    borderColor: color.greenLine,
    backgroundColor: color.greenWash,
  },
  locationRetryPressed: { backgroundColor: color.greenLine },
  nearbyRow: {
    paddingHorizontal: space.screenX,
    paddingTop: 8,
    paddingBottom: 6,
    gap: space.browse.chipGap,
    alignItems: "center",
  },
  nearbyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 200,
    paddingLeft: 6,
    paddingRight: 10,
    paddingVertical: 6,
    borderRadius: radius.hubRow,
    borderWidth: border.hairline,
    borderColor: color.greenLine,
    backgroundColor: color.greenWash,
  },
  nearbyChipSelected: { borderColor: color.forest, backgroundColor: color.greenLine },
  nearbyChipPressed: { backgroundColor: color.greenLine },
  nearbyWell: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surface,
  },
  nearbyCopy: { flexShrink: 1 },
  nearbyName: { color: color.ink },
  nearbyMeta: { color: color.inkMuted },
  mapWrap: {
    position: "relative",
    flex: 1,
    paddingHorizontal: space.screenXTight,
    paddingBottom: space.screenXTight,
  },
  nearbyOverlay: {
    position: "absolute",
    left: space.screenXTight,
    right: space.screenXTight,
    bottom: space.screenXTight + 8,
    zIndex: 2,
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
