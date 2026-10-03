import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { useBrowse } from "../../src/api/browse";
import { useShopSpotlight, type SpotlightShop } from "../../src/api/spotlight";
import { useRecommended } from "../../src/api/recommended";
import type { Item } from "../../src/api/types";
import { useSession } from "../../src/auth/session";
import { Tappable } from "../../src/components/Tappable";
import { FilterButton, SearchField } from "../../src/components/marketplace/BrowseControls";
import { marketplaceWithFilters } from "../../src/lib/marketplace-link";
import { CategoryCircles } from "../../src/components/home-redesign/CategoryCircles";
import { ExclusiveCard } from "../../src/components/home-redesign/ExclusiveCard";
import { SectionHeader } from "../../src/components/home-redesign/SectionHeader";
import { HeroBanner } from "../../src/components/home-redesign/HeroBanner";
import { ShopSpotlightCard } from "../../src/components/home-redesign/ShopSpotlightCard";
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
 *   Hero         → the newest listing with a photo; opens its category.
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
 * THE LEAVES BALANCE IS NOT ON THIS SCREEN. It is in AppHeader, once, as it is
 * on every other tab. It was briefly in the search row as well, which put the
 * same number twice on one screen about 60px apart — two figures that are read
 * as two facts, and the moment one of them lagged a refetch they would have
 * been.
 *
 * THE SEARCH ROW IS THE SECOND ROW, NOT THE FIRST. `AppHeader` — wordmark,
 * Leaves, bell, messages — renders above this screen exactly as it does on
 * every other tab, and the search row sits under it. The reference this screen
 * follows has no wordmark to place, which is the only reason it starts with a
 * search field; dropping ours would have cost Home the app's chrome and the two
 * unread counts that live in it.
 *
 * So no safe-area padding is taken here: AppHeader paints behind the status bar
 * and insets its own contents. `space.home.top` is the gap under it.
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

  const [draftQuery, setDraftQuery] = useState("");

  // Unfiltered: the category circles (facets) and the hero come from it.
  //
  // TODO(home-redesign): the hero is still the first listing with a photo. It
  // is deliberately NOT drawn from the Featured boosts: that would be a second,
  // uncapped paid placement above the section whose cap is the guardrail.
  const browse = useBrowse({ categories: [] });
  const { items, facets, isPending, isError, isRefetching } = browse;
  const hero = useMemo(() => items.find((i) => i.images.length > 0) ?? null, [items]);

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
  const refetch = useCallback(() => {
    void refetchBrowse();
    void refetchExclusive();
    void refetchSpotlight();
    void refetchRecommended();
  }, [refetchBrowse, refetchExclusive, refetchSpotlight, refetchRecommended]);

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
  // A shop's storefront is its backing account's profile.
  const openShop = useCallback(
    (shop: SpotlightShop) => router.push({ pathname: "/user", params: { id: shop.orgUserId } }),
    [router],
  );

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
      <ScrollView
        style={s.screen}
        // The extra bottom room keeps the last row of tiles clear of the search
        // helper button, which floats over this corner.
        contentContainerStyle={{ paddingTop: space.home.top, paddingBottom: space.home.bottom + SEARCH_HELPER_CLEARANCE }}
        refreshControl={
          <RefreshControl
            refreshing={
              isRefetching ||
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
        {/* 1. Search + filter, BELOW AppHeader's wordmark row. */}
        <View style={s.searchRow}>
          <SearchField
            value={draftQuery}
            onChange={setDraftQuery}
            // Carried over as `q`, with the same nonce the category links use,
            // so Marketplace searches it (shop names included) rather than
            // opening blank. An empty box just opens Marketplace.
            onSubmit={() =>
              draftQuery.trim()
                ? router.push({
                    pathname: "/(app)/marketplace",
                    params: { q: draftQuery.trim(), applyAt: String(Date.now()) },
                  })
                : openMarketplace()
            }
          />
          <FilterButton count={0} onPress={openMarketplace} />
        </View>

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
            {/* 2. Hero */}
            {hero ? (
              <View style={{ marginTop: space.home.headerToHero }}>
                <HeroBanner item={hero} onPress={() => browseInMarketplace(hero.category)} />
              </View>
            ) : null}

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
              <Text style={[textStyle(type.emptyBody), s.empty]}>No perishable listings right now.</Text>
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
      </ScrollView>

      {/* The free search helper. Over the scroll view, not in it, so it stays put. */}
      <SearchHelper />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.home.searchGap,
    paddingHorizontal: space.screenX,
  },
  loading: { marginTop: space.home.sectionTop * 2 },
  sectionLoading: { marginTop: space.home.sectionTop },
  stateBox: { alignItems: "center", marginTop: space.home.sectionTop * 2, gap: 12 },
  retry: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  rail: {
    paddingHorizontal: space.screenX,
    gap: space.browse.gridGap,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.browse.gridGap,
    paddingHorizontal: space.screenX,
  },
  empty: { color: color.inkMuted, paddingHorizontal: space.screenX },
});
