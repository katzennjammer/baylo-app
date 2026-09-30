import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Keyboard,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { ApiError } from "../../src/api/client";
import { CATEGORIES } from "../../src/api/post";
import { Splash } from "../../src/components/Splash";
import {
  activeFilterCount,
  isFiltered,
  MAX_CATEGORIES,
  useBrowse,
  usePerishablesInScope,
  type BrowseFilters,
} from "../../src/api/browse";
import {
  BusinessCategoryRail,
  CategoryRail,
  FilterButton,
  SearchField,
  SortToggle,
  ViewToggle,
  type BrowseSort,
  type BrowseView,
} from "../../src/components/marketplace/BrowseControls";
import { useHubs } from "../../src/api/hubs";
import { HubMap } from "../../src/components/map/HubMap";
import { MapErrorBoundary } from "../../src/components/map/MapErrorBoundary";
import { HubSheet } from "../../src/components/map/HubSheet";
import { HubTypeGlyph, MapLegend } from "../../src/components/map/MapLegend";
import { Tappable } from "../../src/components/Tappable";
import { FilterSheet } from "../../src/components/marketplace/FilterSheet";
import { RemovableChip } from "../../src/components/RemovableChip";
import { SEARCH_HELPER_CLEARANCE, SearchHelper } from "../../src/components/search-helper/SearchHelper";
import { MARKETPLACE_FILTERS_PARAM, parseMarketplaceFilters } from "../../src/lib/marketplace-link";
import {
  BrowseEmpty,
  BrowseError,
  BrowseNoMatches,
  BrowseSkeleton,
} from "../../src/components/marketplace/BrowseStates";
import { GridTile } from "../../src/components/marketplace/GridTile";
import { OrgMatches } from "../../src/components/marketplace/OrgMatches";
import { useReach, tileOutOfReach } from "../../src/api/offer";
import { useSession } from "../../src/auth/session";
import { HowTradingWorksSheet } from "../../src/components/offer/OfferSheet";
import { hasSeenReachExplainer, markReachExplainerSeen } from "../../src/lib/reach-flag";
import { usePullToRefresh } from "../../src/lib/pull-to-refresh";
import { useRefetchOnFocus } from "../../src/lib/refetch-on-focus";
import { withTimeout } from "../../src/lib/with-timeout";
import { border, color, icon, radius, size, space, textStyle, type } from "../../src/theme/tokens";
import { ArrowUpRightIcon, ChevronRightIcon } from "../../src/components/icons";
import { openDirections } from "../../src/components/map/directions";
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
/**
 * Hidden tabs a search result leads into. Focus moving to one of these keeps
 * the search; see "The search does not outlive the visit" below. `messages`
 * because an item's "Message" goes there and back comes through the item.
 */
const SEARCH_DRILL_DOWNS = new Set(["item", "user", "hub", "hubs", "connections", "messages"]);

export default function MarketplaceScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  /** The text in the box, which is not yet the text being searched for. */
  const [draftQuery, setDraftQuery] = useState("");
  const [filters, setFilters] = useState<BrowseFilters>({});
  const [sheetOpen, setSheetOpen] = useState(false);

  /** Grid or map. See the note in the header on why this is a mode, not a skin. */
  const [view, setView] = useState<BrowseView>("grid");

  // ── Arriving from Home ────────────────────────────────────────────────────
  //
  // Home's "Barter now" sends `category`; its "See all" sends none. Both send
  // `applyAt`, a nonce, and the effect is keyed on THAT rather than on the
  // category. This screen is a tab and stays mounted, so the params are not an
  // initial state: they are an instruction that can arrive any number of
  // times, including twice with the same category after the user cleared the
  // chip in between. A tab-bar tap leaves the params where they were, so it
  // re-applies nothing.
  //
  // It REPLACES the filters rather than adding to them: "Explore Food" landing
  // on Food-and-whatever-you-searched-last-week is not what was tapped. After
  // that it is an ordinary chip — the rail's toggle deselects it like any
  // other, which is how the user gets back to everything.
  //
  // Home's search box sends `q` the same way, so what was typed there is what
  // gets searched here -- including the shop-name matches above the grid.
  //
  // The search helper sends `filters`: a WHOLE filter set as one JSON param
  // (several categories, bracket range, condition, shops, perishable). It wins
  // over category/q when present, and is parsed like any input from outside --
  // see src/lib/marketplace-link.ts. Same nonce, same replace-not-merge rule.
  const {
    category: arrivingCategory,
    q: arrivingQuery,
    [MARKETPLACE_FILTERS_PARAM]: arrivingFilters,
    applyAt,
  } = useLocalSearchParams<{
    category?: string;
    q?: string;
    filters?: string;
    applyAt?: string;
  }>();
  useEffect(() => {
    if (!applyAt) return;
    const whole = parseMarketplaceFilters(arrivingFilters);
    if (whole) {
      setFilters(whole);
      setDraftQuery(whole.q ?? "");
      setView("grid");
      return;
    }
    const known = (CATEGORIES as readonly string[]).includes(arrivingCategory ?? "");
    const q = arrivingQuery?.trim().slice(0, 100) || undefined;
    setFilters({ ...(known ? { categories: [arrivingCategory!] } : {}), ...(q ? { q } : {}) });
    setDraftQuery(q ?? "");
    setView("grid");
    // The arriving params are read with the nonce they came with, never on their own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyAt]);
  /** Which pin's card is up. Owned here so the map and the sheet cannot disagree. */
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null);
  /**
   * Selecting a hub. A hub in the nearby strip is shown selected IN the strip
   * -- outlined card, ringed pin, and its own Directions / View listings --
   * so the full hub card (HubSheet) opens only for a hub outside the strip.
   */
  const selectHub = useCallback((id: string | null) => setSelectedHubId(id), []);
  /** Null shows every Safe Zone; otherwise the map is narrowed to one type. */
  const [hubTypeFilter, setHubTypeFilter] = useState<string | null>(null);
  /**
   * Map mode's search: a name filter over the hubs ALREADY LOADED, on the
   * phone. /api/v1/hubs returns the whole curated table (22 rows), so a
   * server search would be a round trip to filter what is in memory.
   */
  const [hubSearch, setHubSearch] = useState("");
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
    // Whether this run reached a final state. See the cleanup below.
    let settled = false;
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
      } finally {
        settled = true;
      }
    })();
    return () => {
      cancelled = true;
      // THE SECOND "FINDING NEARBY SAFE ZONES…" HANG (fixed 1 Oct 2026).
      //
      // The deps fix above stopped the effect cancelling ITSELF. It did not
      // cover the effect being cancelled by the screen: switching to Grid (a
      // `view` change) while the lookup was in flight ran this cleanup, which
      // discarded the run's result -- and left `locationState` at "loading".
      // Back on the map, the effect re-ran, hit the `!== "idle"` guard, and
      // returned: "loading" forever, with nothing in flight to end it. The
      // same happens when the permission dialog is up and the person taps
      // Grid, or when the lookup is simply slow and they look away.
      //
      // So a run that is torn down BEFORE it settled hands the state back to
      // "idle", and the next visit to the map starts a fresh lookup. A run that
      // DID settle leaves its result alone: "ready" and "unavailable" are
      // answers, and re-asking on every toggle would re-prompt and re-fetch.
      if (!settled) setLocationState("idle");
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

  const visibleHubs = useMemo(() => {
    const needle = hubSearch.trim().toLowerCase();
    return orderedHubs.filter(
      (hub) =>
        (!hubTypeFilter || hub.type === hubTypeFilter) &&
        (!needle || hub.name.toLowerCase().includes(needle)),
    );
  }, [hubTypeFilter, hubSearch, orderedHubs]);

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
    businessFacets,
    orgMatches,
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

  /** The "All" chip. Undefined, not [], for the same cache-key reason as below. */
  const clearCategories = useCallback(() => {
    setFilters((f) => (f.categories?.length ? { ...f, categories: undefined } : f));
  }, []);

  /**
   * "Shops only" (the old Organizations pill; same `orgsOnly` filter).
   *
   * Cleared to `undefined` rather than set to `false`, so the filter object
   * and its query key are identical to what they were before the pill was ever
   * tapped. Leaving a `false` behind would give the same query two cache keys
   * and refetch the whole first page every time the pill was turned off.
   */
  //
  // Turning it off also clears the shop-type chips under it: they only exist
  // while it is on, and the server refuses a shop type without it.
  const toggleOrgsOnly = useCallback(() => {
    setFilters((f) =>
      f.orgsOnly
        ? { ...f, orgsOnly: undefined, businessCategories: undefined }
        : { ...f, orgsOnly: true },
    );
  }, []);

  /** A shop-type chip under "Shops only". Multi-select, no cap. */
  const toggleBusinessCategory = useCallback((businessCategory: string) => {
    setFilters((f) => {
      const current = f.businessCategories ?? [];
      const next = current.includes(businessCategory)
        ? current.filter((c) => c !== businessCategory)
        : [...current, businessCategory];
      return { ...f, businessCategories: next.length > 0 ? next : undefined };
    });
  }, []);

  // ── The search does not outlive the visit ─────────────────────────────────
  //
  // This screen is a tab and stays mounted, so its useState outlives leaving
  // it: search "Baylo", go Home, come back through "See all" (a plain push
  // with no `applyAt`), and the box still said Baylo. Nothing persisted it on
  // purpose; it just never died (25 Sep 2026).
  //
  // Focus/blur cannot tell the two journeys apart: the listing and profile a
  // result opens are hidden TABS too (see app/(app)/_layout.tsx), so opening
  // an item blurs this screen exactly as going Home does. What differs is
  // WHERE focus went. The tab navigator's state is watched while this screen
  // is in the background: focus moving to a drill-down keeps the search, so
  // back from an item still shows the results it came from; focus moving
  // anywhere else clears it, so the next visit starts on an empty box. Only
  // the search -- the chips are a separate, visible decision.
  //
  // Screens on the ROOT stack above the tabs (offer, notifications, settings)
  // do not change this navigator's state, so they keep the search as well.
  const navigation = useNavigation();
  useEffect(
    () =>
      navigation.addListener("state", (e) => {
        const state = (e.data as { state?: { index: number; routes: { name: string }[] } }).state;
        const focused = state?.routes[state.index]?.name;
        if (!focused || focused === "marketplace" || SEARCH_DRILL_DOWNS.has(focused)) return;
        setDraftQuery("");
        setFilters((f) => (f.q === undefined ? f : { ...f, q: undefined }));
      }),
    [navigation],
  );

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

  /**
   * The sort control's state, read off the filters rather than held beside
   * them, so the two cannot disagree. "Ending soon" is the API's `expiring`,
   * which the server allows only with perishable=true: choosing it turns the
   * perishables filter on (its removable chip shows that), and removing that
   * chip drops the sort with it. "Newest" clears only the sort.
   */
  const sort: BrowseSort = filters.sort === "expiring" && filters.perishable === true ? "endingSoon" : "newest";
  const setSort = useCallback((next: BrowseSort) => {
    setFilters((f) =>
      next === "endingSoon" ? { ...f, perishable: true, sort: "expiring" } : { ...f, sort: undefined },
    );
  }, []);

  /**
   * Whether the sort control is offered at all: only when the rail's scope
   * (categories, Shops only) has a perishable listed right now -- one
   * `limit=1` probe per scope, see usePerishablesInScope. While a new scope's
   * answer loads, the previous one stands, so the control does not flicker.
   */
  const perishableProbe = usePerishablesInScope(filters, view === "grid");
  const sortAvailable = perishableProbe.data === true;

  // "Ending soon" on a scope with nothing perishable is an empty grid with no
  // way to see why. Back to Newest -- and the perishables filter goes with it,
  // because Ending soon is what turned that filter on (see setSort), and
  // leaving it would keep the grid empty. Only on a SETTLED answer for this
  // scope, never on the previous scope's placeholder.
  const probeEmpty =
    perishableProbe.data === false && !perishableProbe.isPlaceholderData && !perishableProbe.isFetching;
  useEffect(() => {
    if (probeEmpty && sort === "endingSoon") {
      setFilters((f) => ({ ...f, sort: undefined, perishable: null }));
    }
  }, [probeEmpty, sort]);

  /**
   * "20+ items": /browse returns pages and a cursor, never a total, so the
   * count is what has loaded plus a "+" while more pages exist. Not
   * monospace: it is a phrase, not a column of figures.
   */
  const countLabel = `${items.length}${hasNextPage ? "+" : ""} ${items.length === 1 && !hasNextPage ? "item" : "items"}`;

  /** The controls stay mounted in every state — they are how you leave one. */
  const header = (
    <View>
      {/* One row: search (flexible), Grid/Map, filters. */}
      <View style={s.searchRow}>
        <SearchField value={draftQuery} onChange={setDraftQuery} onSubmit={submitSearch} />
        <ViewToggle view={view} onChange={setView} />
        <FilterButton count={filterCount} onPress={() => setSheetOpen(true)} />
      </View>

      <View style={s.rail}>
        <CategoryRail
          facets={facets}
          selected={filters.categories ?? []}
          onToggle={toggleCategory}
          onClearCategories={clearCategories}
          max={MAX_CATEGORIES}
          orgsOnly={filters.orgsOnly ?? false}
          onToggleOrgs={toggleOrgsOnly}
        />
        {filters.orgsOnly ? (
          <View style={s.subRail}>
            <BusinessCategoryRail
              facets={businessFacets}
              selected={filters.businessCategories ?? []}
              onToggle={toggleBusinessCategory}
            />
          </View>
        ) : null}
      </View>

      {/* Perishable has no control on the rail -- it only arrives from outside
          (the search helper). Shown so it is never on invisibly. */}
      {filters.perishable != null ? (
        <View style={s.activeRow}>
          <RemovableChip
            label={filters.perishable ? "Perishables only" : "No perishables"}
            // The sort goes with it: "Ending soon" is only valid on perishables.
            onRemove={() => setFilters((f) => ({ ...f, perishable: null, sort: undefined }))}
          />
        </View>
      ) : null}

      <OrgMatches
        orgs={orgMatches}
        onOpen={(org) => router.push({ pathname: "/user", params: { id: org.orgUserId } })}
      />

      {/* The sort shows even on an empty page: "Ending soon" on a moment with
          no perishables is how you get back to "Newest". */}
      {items.length > 0 || sort !== "newest" ? (
        <View style={s.countRow}>
          <Text
            style={[textStyle(type.metadata), s.countText]}
            numberOfLines={1}
            // Shares the row with the sort control; see headingMaxFontScale.
            maxFontSizeMultiplier={size.home.headingMaxFontScale}
            accessibilityLiveRegion="polite"
          >
            {items.length > 0 ? countLabel : ""}
          </Text>
          {sortAvailable ? <SortToggle sort={sort} onChange={setSort} /> : null}
        </View>
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
    const stripReady = locationState === "ready" && userLocation !== null && visibleNearbyHubs.length > 0;
    const selectedInStrip = selected !== null && stripReady && visibleNearbyHubs.some((h) => h.id === selected.id);
    const showCard = selected !== null && !selectedInStrip;
    const nearest =
      userLocation && visibleNearbyHubs.length > 0
        ? distanceKm(userLocation.latitude, userLocation.longitude, visibleNearbyHubs[0])
        : null;

    return (
      <View style={s.screen}>
        {/* The same toolbar as the grid: search, then the toggle on the
            right. The field searches HUBS here, by name, on the phone; the
            filter button stays out (it narrows listings, and the map shows
            hubs -- see ViewToggle). */}
        <View style={s.searchRow}>
          <SearchField
            value={hubSearch}
            onChange={(next) => {
              setHubSearch(next);
              selectHub(null);
            }}
            onSubmit={() => Keyboard.dismiss()}
            placeholder="Search safe hubs"
            accessibilityLabel="Search safe hubs by name"
          />
          <ViewToggle view={view} onChange={setView} />
        </View>

        <View style={s.legend}>
          <MapLegend
            selectedType={hubTypeFilter}
            onSelectType={(next) => {
              setHubTypeFilter(next);
              selectHub(null);
            }}
          />
        </View>

        <View style={s.locationRow}>
          {/* ABOUT THE HUBS, NOT THE GPS. Nothing until the hubs load, then
              "23 safe hubs", plus " · nearest 4.7 km" once a position is
              known. Location denied, off or too slow just leaves the count
              (the Allow / Try again button beside it says which). A lookup
              still in progress changes nothing; if it lands, the nearby strip
              and the distance appear. */}
          <Text
            style={[textStyle(type.metadata), s.locationStatus]}
            accessibilityLiveRegion="polite"
            numberOfLines={1}
          >
            {!hubsQuery.isSuccess
              ? ""
              : `${visibleHubs.length} ${visibleHubs.length === 1 ? "safe hub" : "safe hubs"}` +
                (nearest !== null ? ` · nearest ${formatDistanceKm(nearest)}` : "")}
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
              <Text style={[textStyle(type.chip), { color: color.forest }]}>
                {locationDenied ? "Allow location" : "Try again"}
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
                  onSelectHub={selectHub}
                  // The nearby strip and the hub card sit over the bottom edge.
                  attributionAt="top"
                  emptyMessage={
                    hubSearch.trim()
                      ? `No safe hubs match "${hubSearch.trim()}".`
                      : hubTypeFilter
                        ? "No safe hubs of this type are available yet."
                        : "No safe hubs have been set up yet. They are added city by city."
                  }
                  style={s.map}
                />
              </MapErrorBoundary>

              {stripReady && userLocation && !showCard ? (
                <View style={s.nearbyOverlay} pointerEvents="box-none">
                  <NearestHubsStrip
                    hubs={visibleNearbyHubs}
                    origin={userLocation}
                    selectedHubId={selectedHubId}
                    onSelect={selectHub}
                    onOpenItems={(hubId) => router.push({ pathname: "/hub", params: { id: hubId } })}
                  />
                </View>
              ) : null}

              {showCard && selected ? (
                <HubSheet
                  hub={selected}
                  onClose={() => selectHub(null)}
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
              shopsMatched={orgMatches.length > 0}
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

      {/* The free search helper. "See all" sets this grid's filters in place
          rather than navigating to the screen that is already open. */}
      <SearchHelper
        onSeeAll={(next) => {
          setFilters(next);
          setDraftQuery(next.q ?? "");
        }}
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

/**
 * The nearest active hubs, as white cards over the map's bottom edge: the
 * name, then "type icon · Type · 4.7 km". Tapping a card selects it: it is
 * outlined in forest (its pin is ringed to match) and shows two actions,
 * Directions and View listings (the same /hub screen the full hub card links
 * to). The actions sit side by side and wrap onto two lines when they do not
 * fit, which is what 2x text does on a 320 dp phone.
 */
function NearestHubsStrip({
  hubs,
  origin,
  selectedHubId,
  onSelect,
  onOpenItems,
}: {
  hubs: SafeZoneHub[];
  origin: { latitude: number; longitude: number };
  selectedHubId: string | null;
  onSelect: (hubId: string) => void;
  onOpenItems: (hubId: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.nearbyRow}
      accessibilityRole="summary"
      accessibilityLabel="Nearest safe hubs, listed first"
    >
      {hubs.map((hub) => {
        const selected = hub.id === selectedHubId;
        const distance = formatDistanceKm(distanceKm(origin.latitude, origin.longitude, hub));
        return (
          <Tappable
            key={hub.id}
            onPress={() => onSelect(hub.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${hub.name}, ${hub.typeLabel}, ${distance}`}
            style={[s.nearbyCard, selected && s.nearbyCardSelected]}
            pressedStyle={s.nearbyCardPressed}
          >
            <Text style={[textStyle(type.hubName), s.nearbyName]} numberOfLines={1}>
              {hub.name}
            </Text>
            <View style={s.nearbyMetaRow}>
              <HubTypeGlyph hubType={hub.type} size={12} />
              <Text style={[textStyle(type.gridMeta), s.nearbyMeta]} numberOfLines={1}>
                {`${hub.typeLabel} · ${distance}`}
              </Text>
            </View>
            {selected ? (
              <View style={s.nearbyActions}>
                <Tappable
                  onPress={() =>
                    void openDirections({ latitude: hub.latitude, longitude: hub.longitude, name: hub.name })
                  }
                  accessibilityRole="link"
                  accessibilityLabel={`Directions to ${hub.name}`}
                  style={s.nearbyAction}
                  pressedStyle={s.nearbyCardPressed}
                  hitSlop={4}
                >
                  <Text style={[textStyle(type.chip), s.nearbyActionLabel]}>Directions</Text>
                  <ArrowUpRightIcon size={icon.check.size} stroke={icon.check.stroke} color={color.forest} />
                </Tappable>
                <Tappable
                  onPress={() => onOpenItems(hub.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`View listings at ${hub.name}`}
                  style={s.nearbyAction}
                  pressedStyle={s.nearbyCardPressed}
                  hitSlop={4}
                >
                  <Text style={[textStyle(type.chip), s.nearbyActionLabel]}>View listings</Text>
                  <ChevronRightIcon size={icon.check.size} stroke={icon.check.stroke} color={color.forest} />
                </Tappable>
              </View>
            ) : null}
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
  subRail: { paddingTop: space.browse.chipsY },
  legend: { paddingVertical: space.browse.chipsY },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.browse.searchGap,
    paddingHorizontal: space.screenX,
    minHeight: 18,
  },
  locationStatus: { flex: 1, color: color.inkSecondary },
  locationRetry: {
    paddingHorizontal: 10,
    paddingVertical: 4,
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
  // White cards with a hairline, not tinted chips. The selected one takes a
  // 1.5 px forest border, matching the ringed pin on the map.
  // 208, not narrower: the selected card's two actions sit side by side at
  // 1x (about 170 of the 186 inside), and wrap at larger text.
  nearbyCard: {
    width: 208,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: radius.hubRow,
    borderWidth: border.hairline,
    borderColor: color.controlLine,
    backgroundColor: color.surface,
  },
  nearbyCardSelected: { borderWidth: 1.5, borderColor: color.forest },
  nearbyCardPressed: { opacity: 0.8 },
  nearbyName: { color: color.ink },
  nearbyMetaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  nearbyMeta: { flexShrink: 1, color: color.inkSecondary },
  nearbyActions: { flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 4, marginTop: 6 },
  nearbyAction: { flexDirection: "row", alignItems: "center", gap: 3, minHeight: 28, maxWidth: "100%" },
  nearbyActionLabel: { flexShrink: 1, color: color.forest },
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
  activeRow: {
    flexDirection: "row",
    paddingHorizontal: space.browse.gridX,
    paddingBottom: space.browse.countY,
  },
  mapCentre: { flex: 1, alignItems: "center", justifyContent: "center" },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.browse.searchGap,
    paddingHorizontal: space.browse.gridX,
    paddingBottom: space.browse.countY,
  },
  countText: { flexShrink: 1, color: color.inkSecondary },
  // The extra room keeps the last row clear of the search helper button.
  content: { paddingBottom: space.trending.y + SEARCH_HELPER_CLEARANCE },
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
