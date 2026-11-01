import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";

import { ApiError } from "../../src/api/client";
import { useBrowse, useBrowseSuggestions } from "../../src/api/browse";
import { useHome } from "../../src/api/home";
import { useShopSpotlight, type SpotlightShop } from "../../src/api/spotlight";
import { useRecommended } from "../../src/api/recommended";
import { useActiveTrades } from "../../src/api/trades";
import { useUserSearchSuggestions } from "../../src/api/users";
import type { Item } from "../../src/api/types";
import { useSession } from "../../src/auth/session";
import { Tappable } from "../../src/components/Tappable";
import { MascotEmptyState } from "../../src/components/MascotEmptyState";
import { marketplaceWithFilters } from "../../src/lib/marketplace-link";
import { useTabReselect } from "../../src/lib/tab-reselect";
import { CategoryCircles } from "../../src/components/home-redesign/CategoryCircles";
import { ExclusiveCard } from "../../src/components/home-redesign/ExclusiveCard";
import { SectionHeader } from "../../src/components/home-redesign/SectionHeader";
import { HomePinnedHeader, HomeTopSection } from "../../src/components/home-redesign/HomeTopSection";
import { ShopSpotlightCard } from "../../src/components/home-redesign/ShopSpotlightCard";
import { TraderSearchSuggestions } from "../../src/components/home-redesign/TraderSearchSuggestions";
import { ItemSearchSuggestions } from "../../src/components/marketplace/ItemSearchSuggestions";
import { SEARCH_HELPER_CLEARANCE, SearchHelper } from "../../src/components/search-helper/SearchHelper";
import {
  categoryTone,
  color,
  size,
  space,
  textStyle,
  type,
} from "../../src/theme/tokens";

/**
 * HOME REDESIGN — PREVIEW BRANCH (home-redesign-preview).
 *
 * Browse-first, top to bottom (30 Sep 2026):
 *
 *   Search row   → Marketplace, carrying what was typed.
 *   Hero         → a contextual mascot greeting with shortcuts to Trades and Food.
 *   Categories   → SHORTCUTS: a circle opens Marketplace on that category.
 *                  They no longer switch a section on this screen.
 *   Exclusive    → perishables, every category, soonest to expire first, as a
 *                  single row of large ExclusiveCards (photo over a light
 *                  info panel). GET /api/v1/browse with
 *                  perishable=true&sort=expiring -- the server orders by
 *                  window, so the row's first card really is the soonest,
 *                  not the soonest of whatever landed on page 0.
 *   Spotlights   → verified SHOPS, not listings: tall promo cards from GET
 *                  /api/v1/organizations/spotlight, an hourly rotation the
 *                  server owns. Not a ranking -- "Verified shops", ranked by
 *                  trade volume, is deliberately deferred until there are
 *                  enough shops for it to differ from this.
 *   Recommended  → GET /api/v1/recommended: the viewer's category interest
 *                  (trades, offers, likes, own listings) + 14-day popularity
 *                  + a little recency. Titled "Picked for you"; the subtitle
 *                  says "Popular on Baylo right now" when the viewer has no
 *                  history, because then that is all the shelf is.
 *
 * Every section header is SectionHeader (sentence case, one accent word). See
 * that file for the layout and accessibility rules.
 *
 * FEATURED WAS REMOVED (schema v2): paid boosts no longer exist, so the paid
 * grid that closed this screen is gone with them.
 *
 * WHY THIS ORDER (30 Sep 2026). It follows the Food Panda mapping the
 * redesign started from -- "order again" (Exclusive), "featured highlights"
 * (Spotlights), "recommended for you" (Recommended). Spotlights sits BETWEEN
 * the two listing rows, so Exclusive's big cards and Recommended's narrower
 * ones never stack back to back and read as one repeated section.
 *
 * NO LISTING IS ON SCREEN TWICE: Recommended excludes perishables on the
 * server, and Exclusive is perishables only.
 *
 * Home owns its pinned header and scrollable top section. AppHeader remains
 * unchanged on every other route.
 */
type PerishableItem = Item & { perishable: NonNullable<Item["perishable"]> };

/** Cards on the Recommended shelf. */
const RECOMMENDED_SHOWN = 10;

/**
 * Each section's accent: the accent word AND its squiggle. Contrast is against
 * `color.surface` (#FAFAF7); titles are 20 px SemiBold, so the floor is WCAG's
 * 3:1 for large text. Measured 30 Sep 2026.
 *
 *   limited      color.urgent            #B0553A  4.77:1  coral, as the expiry pills
 *   spotlights   categoryTone.sand.ink   #6E5114  7.05:1  the amber of the cards'
 *                                                          "Sari-sari store" label; not
 *                                                          clay (terracotta), whose hue
 *                                                          is within 2 deg of the coral
 *                                                          directly above it
 *   picked       color.accentGreen       #2A833E  4.55:1  brand green's hue, darkened;
 *                                                          `green` itself is 2.31:1 and
 *                                                          `forest` too dark to read as
 *                                                          an accent
 */
const ACCENT = {
  limited: color.urgent,
  spotlights: categoryTone.sand.ink,
  picked: color.accentGreen,
} as const;


export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { session } = useSession();
  const viewerId = session?.user.id ?? null;
  const homeData = useHome();
  const activeTrades = useActiveTrades();

  const [draftQuery, setDraftQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const trimmedSearchQuery = draftQuery.trim();
  const isTraderSearch = trimmedSearchQuery.startsWith("@");
  const traderSearchQuery = isTraderSearch ? trimmedSearchQuery.replace(/^@+/, "").trim() : "";
  const suggestionQuery = isTraderSearch ? traderSearchQuery : trimmedSearchQuery;
  const showSearchSuggestions = suggestionQuery.length >= 2;

  useEffect(() => {
    if (!showSearchSuggestions) {
      setDebouncedSearchQuery("");
      return;
    }

    const timer = setTimeout(() => setDebouncedSearchQuery(suggestionQuery), 350);
    return () => clearTimeout(timer);
  }, [showSearchSuggestions, suggestionQuery]);

  const isSearchDebouncing =
    showSearchSuggestions && suggestionQuery !== debouncedSearchQuery;
  const itemSuggestions = useBrowseSuggestions(
    { q: debouncedSearchQuery },
    showSearchSuggestions && !isTraderSearch && !isSearchDebouncing,
  );
  const traderSuggestions = useUserSearchSuggestions(
    debouncedSearchQuery,
    showSearchSuggestions && isTraderSearch && !isSearchDebouncing,
  );

  // Unfiltered: the category circles (facets) come from it.
  const browse = useBrowse({ categories: [] });
  const { items, facets, isPending, isError, isRefetching } = browse;
  const pendingTradeCount = activeTrades.data
    ? activeTrades.data.offers.filter((offer) => offer.direction === "received").length +
      activeTrades.data.trades.filter((trade) => trade.status === "PENDING" && trade.direction === "received").length
    : null;

  // Server-ordered by expiry. The client-side filter stays as a guard: an
  // item can lapse between the server's sweep and this render, and a server
  // without the perishables work omits `perishable` entirely -- `!= null`,
  // not `!== null`, so undefined never reaches `.expired`.
  const exclusiveQuery = useBrowse({ perishable: true, sort: "expiring" });
  const exclusive = useMemo(
    () =>
      exclusiveQuery.items.filter(
        (i): i is PerishableItem => i.perishable != null && !i.perishable.expired,
      ),
    [exclusiveQuery.items],
  );

  const spotlightQuery = useShopSpotlight();
  const spotlights = spotlightQuery.data ?? [];

  const recommendedQuery = useRecommended();
  const personalized = recommendedQuery.data?.personalized ?? false;
  const recommended = useMemo(
    () => (recommendedQuery.data?.items ?? []).slice(0, RECOMMENDED_SHOWN),
    [recommendedQuery.data],
  );

  const { refetch: refetchBrowse } = browse;
  const { refetch: refetchExclusive } = exclusiveQuery;
  const { refetch: refetchSpotlight } = spotlightQuery;
  const { refetch: refetchRecommended } = recommendedQuery;
  const { refetch: refetchHome } = homeData;
  const { refetch: refetchTrades } = activeTrades;
  const refetch = useCallback(() => {
    void refetchBrowse();
    void refetchExclusive();
    void refetchSpotlight();
    void refetchRecommended();
    void refetchHome();
    void refetchTrades();
  }, [refetchBrowse, refetchExclusive, refetchHome, refetchRecommended, refetchSpotlight, refetchTrades]);

  // Tapping Home while on it: back to the top, or refresh when already there.
  const scroller = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = useTabReselect(() => scroller.current?.scrollTo({ y: 0, animated: true }), refetch);
  const handleScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: onScroll,
      }),
    [onScroll, scrollY],
  );

  // NO REFETCH WHEN A WINDOW RUNS OUT (1 Oct 2026). Each card's live pill turns
  // to "Ended" at zero and the card stays put; refetching here would pull it
  // out of the row under the person's thumb. Pull-to-refresh and the next
  // focus fetch drop it.

  // The single row's wide cards (Exclusive).
  const exclusiveCardWidth = useMemo(
    () =>
      Math.floor(
        (width - space.screenX - space.browse.gridGap * Math.floor(size.home.exclusiveCardPerScreen)) /
          size.home.exclusiveCardPerScreen,
      ),
    [width],
  );
  const spotlightWidth = useMemo(
    () =>
      Math.floor(
        (width - space.screenX - space.browse.gridGap * Math.floor(size.home.spotlightPerScreen)) /
          size.home.spotlightPerScreen,
      ),
    [width],
  );
  const recommendedWidth = useMemo(
    () =>
      Math.floor(
        (width - space.screenX - space.browse.gridGap * Math.floor(size.home.recommendedPerScreen)) /
          size.home.recommendedPerScreen,
      ),
    [width],
  );

  const openItem = useCallback(
    (item: Item) => router.push({ pathname: "/item", params: { id: item.id } }),
    [router],
  );
  const openMarketplace = useCallback(() => router.push("/(app)/marketplace"), [router]);
  const openTrades = useCallback(() => router.navigate("/(app)/trades"), [router]);
  // A shop's storefront is its backing account's profile.
  const openShop = useCallback(
    (shop: SpotlightShop) => router.push({ pathname: "/user", params: { id: shop.orgUserId } }),
    [router],
  );
  const submitSearch = useCallback(
    (query = draftQuery) => {
      const value = query.trim();
      setDraftQuery("");
      Keyboard.dismiss();
      if (value) {
        router.push({
          pathname: "/(app)/marketplace",
          params: { q: value, applyAt: String(Date.now()) },
        });
      } else {
        openMarketplace();
      }
    },
    [draftQuery, openMarketplace, router],
  );

  const searchSuggestions = showSearchSuggestions ? (
    isTraderSearch ? (
      <TraderSearchSuggestions
        query={traderSearchQuery}
        users={isSearchDebouncing ? [] : traderSuggestions.data ?? []}
        loading={isSearchDebouncing || traderSuggestions.isPending}
        compact
        error={
          !isSearchDebouncing && traderSuggestions.isError
            ? traderSuggestions.error instanceof ApiError
              ? traderSuggestions.error.message
              : "Could not load trader suggestions."
            : null
        }
        onSearch={() => submitSearch(`@${traderSearchQuery}`)}
        onOpen={(user) => {
          setDraftQuery("");
          Keyboard.dismiss();
          router.push({ pathname: "/user", params: { id: user.id } });
        }}
        onRetry={() => void traderSuggestions.refetch()}
      />
    ) : (
      <ItemSearchSuggestions
        query={trimmedSearchQuery}
        items={isSearchDebouncing ? [] : (itemSuggestions.data ?? []).slice(0, 3)}
        loading={isSearchDebouncing || itemSuggestions.isPending}
        compact
        error={
          !isSearchDebouncing && itemSuggestions.isError
            ? itemSuggestions.error instanceof ApiError
              ? itemSuggestions.error.message
              : "Could not load item suggestions."
            : null
        }
        onSearch={() => submitSearch()}
        onOpen={(item) => {
          setDraftQuery("");
          Keyboard.dismiss();
          openItem(item);
        }}
        onRetry={() => void itemSuggestions.refetch()}
      />
    )
  ) : null;

  /**
   * Marketplace, with its category chips set to `forCategory` — or cleared,
   * for null. `applyAt` is what makes Marketplace act on it: the tab is
   * already mounted, so it applies params when the nonce changes rather than
   * reading them once. See the note there.
   */
  const browseInMarketplace = useCallback(
    (forCategory: string | null) =>
      router.push({
        pathname: "/(app)/marketplace",
        params: { ...(forCategory ? { category: forCategory } : {}), applyAt: String(Date.now()) },
      }),
    [router],
  );

  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[color.homeTop, color.homeMiddle, color.homeBottom]}
        locations={[0, 0.58, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.homeGradient}
        pointerEvents="none"
      />
      <HomePinnedHeader scrollY={scrollY} />
      <Animated.ScrollView
        ref={scroller}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={s.scrollView}
        // The extra bottom room keeps the last row of tiles clear of the search
        // helper button, which floats over this corner.
        contentContainerStyle={{ paddingBottom: space.home.bottom + SEARCH_HELPER_CLEARANCE }}
        refreshControl={
          <RefreshControl
            refreshing={
              isRefetching ||
              homeData.isRefetching ||
              activeTrades.isRefetching ||
              exclusiveQuery.isRefetching ||
              spotlightQuery.isRefetching ||
              recommendedQuery.isRefetching
            }
            onRefresh={refetch}
            tintColor={color.green}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <HomeTopSection
          searchValue={draftQuery}
          onSearchChange={setDraftQuery}
          onSearchSubmit={() => submitSearch()}
          searchSuggestions={searchSuggestions}
          onFilterPress={openMarketplace}
          pendingTradeCount={pendingTradeCount}
          leavesBalance={typeof homeData.viewer?.leaves === "number" ? homeData.viewer.leaves : null}
          firstName={homeData.viewer?.name ?? session?.user.name}
          onViewTrades={openTrades}
          onExploreFood={() => browseInMarketplace("FOOD")}
        />

        <View style={s.contentSurface}>
          {isPending && items.length === 0 ? (
            <ActivityIndicator color={color.green} style={s.loading} />
          ) : isError && items.length === 0 ? (
            <View style={s.stateBox}>
              <Text style={[textStyle(type.emptyBody), { color: color.inkSecondary }]}>
                Could not load listings.
              </Text>
              <Tappable onPress={refetch} accessibilityRole="button" style={s.retry}>
                <Text style={[textStyle(type.homeSeeAll), { color: color.forest }]}>Try again</Text>
              </Tappable>
            </View>
          ) : (
            <>
            {/* 3. Categories: shortcuts into Marketplace. A navigation row, not
                a content section, so its header is plain: no accent, no
                squiggle, no subtitle. */}
            <SectionHeader accent="Categories" onSeeAll={() => browseInMarketplace(null)} />
            <CategoryCircles facets={facets} onSelect={browseInMarketplace} />

            {/* 4. Limited time (perishables): one row of large cards, soonest
                to expire first. No "Next:" chip -- each card carries its own
                window, and the chip only repeated the first card's. */}
            <SectionHeader
              leading="Limited "
              accent="time"
              accentColor={ACCENT.limited}
              squiggle
              subtitle="Grab these before they expire"
              onSeeAll={
                exclusive.length > 0
                  ? () => router.push(marketplaceWithFilters({ perishable: true }))
                  : undefined
              }
            />
            {exclusive.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.rail}
              >
                {exclusive.map((item) => (
                  <ExclusiveCard
                    key={item.id}
                    item={item}
                    width={exclusiveCardWidth}
                    onPress={openItem}
                    viewerId={viewerId}
                  />
                ))}
              </ScrollView>
            ) : exclusiveQuery.isPending ? (
              <ActivityIndicator color={color.green} style={s.sectionLoading} />
            ) : exclusiveQuery.isError ? (
              <Text style={[textStyle(type.emptyBody), s.empty]}>
                Could not load perishables. Pull down to try again.
              </Text>
            ) : (
              <MascotEmptyState
                pose="search"
                title="No perishable listings right now."
                message="Check back soon for fresh finds."
                size={150}
              />
            )}

            {/* 5. Shop Spotlights. Left out when there are none; an error
                is left out too -- a promo row that failed is not something
                the viewer can act on, and pull-to-refresh retries it. */}
            {spotlights.length > 0 ? (
              <>
                {/* No "See all": there is no shops list screen to open. */}
                <SectionHeader
                  accent="Shop"
                  trailing=" spotlights"
                  accentColor={ACCENT.spotlights}
                  squiggle
                  subtitle="Verified local businesses"
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.rail}
                >
                  {spotlights.map((shop) => (
                    <ShopSpotlightCard key={shop.id} shop={shop} width={spotlightWidth} onPress={openShop} />
                  ))}
                </ScrollView>
              </>
            ) : null}

            {/* 6. Recommended. Hidden when empty or failed, like Spotlights:
                pull-to-refresh retries it, and an apology row here would sit
                between two sections that did load. */}
            {recommended.length > 0 ? (
              <>
                {/* One title either way; the subtitle says which shelf it is,
                    from the server's `personalized` flag. */}
                <SectionHeader
                  leading="Picked "
                  accent="for you"
                  accentColor={ACCENT.picked}
                  squiggle
                  subtitle={personalized ? "Based on your trades and offers" : "Popular on Baylo right now"}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.rail}
                >
                  {recommended.map((item) => (
                    <ExclusiveCard
                      key={item.id}
                      item={item}
                      width={recommendedWidth}
                      onPress={openItem}
                      viewerId={viewerId}
                      note={item.recommendation.reasonLabel}
                    />
                  ))}
                </ScrollView>
              </>
            ) : null}

            </>
          )}
        </View>
      </Animated.ScrollView>

      {/* The free search helper. Over the scroll view, not in it, so it stays put. */}
      <SearchHelper />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  homeGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: space.home.gradientHeight,
  },
  scrollView: { flex: 1, backgroundColor: "transparent" },
  contentSurface: { backgroundColor: color.surface },
  loading: { marginTop: space.home.sectionTop * 2 },
  sectionLoading: { marginTop: space.home.sectionTop },
  stateBox: { alignItems: "center", marginTop: space.home.sectionTop * 2, gap: 12 },
  retry: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  rail: {
    paddingHorizontal: space.screenX,
    gap: space.browse.gridGap,
  },
  empty: { color: color.inkMuted, paddingHorizontal: space.screenX },
});
