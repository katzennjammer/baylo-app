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
import { useFeatured } from "../../src/api/featured";
import { useShopSpotlight, type SpotlightShop } from "../../src/api/spotlight";
import type { Item } from "../../src/api/types";
import { useSession } from "../../src/auth/session";
import { Tappable } from "../../src/components/Tappable";
import { FilterButton, SearchField } from "../../src/components/marketplace/BrowseControls";
import { useCountdown } from "../../src/components/post/ui";
import { expiryTierLabel } from "../../src/lib/perishable";
import { marketplaceWithFilters } from "../../src/lib/marketplace-link";
import { CategoryCircles } from "../../src/components/home-redesign/CategoryCircles";
import { ExclusiveCard } from "../../src/components/home-redesign/ExclusiveCard";
import { ExclusiveTile } from "../../src/components/home-redesign/ExclusiveTile";
import { HeroBanner } from "../../src/components/home-redesign/HeroBanner";
import { ShopSpotlightCard } from "../../src/components/home-redesign/ShopSpotlightCard";
import { SEARCH_HELPER_CLEARANCE, SearchHelper } from "../../src/components/search-helper/SearchHelper";
import {
  border,
  color,
  radius,
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
 *   Featured    → paid boosts across EVERY category: GET /api/v1/featured
 *                  with no category. The server's cap (eight) and hourly
 *                  rotation, unchanged; this renders what it is given.
 *
 * Exclusive and Featured are disjoint by construction: a perishable can't be
 * boosted (the boost route refuses it, /featured filters isPerishable, and
 * isPerishable is fixed at creation), so no listing appears in both.
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

  const featuredQuery = useFeatured(null);
  const featured = featuredQuery.data ?? [];

  const spotlightQuery = useShopSpotlight();
  const spotlights = spotlightQuery.data ?? [];

  const { refetch: refetchBrowse } = browse;
  const { refetch: refetchExclusive } = exclusiveQuery;
  const { refetch: refetchFeatured } = featuredQuery;
  const { refetch: refetchSpotlight } = spotlightQuery;
  const refetch = useCallback(() => {
    void refetchBrowse();
    void refetchExclusive();
    void refetchFeatured();
    void refetchSpotlight();
  }, [refetchBrowse, refetchExclusive, refetchFeatured, refetchSpotlight]);

  // The existing countdown hook, pointed at the soonest window. When it hits
  // zero that item has expired, so refetch and the next one takes over. Its
  // tick is also what moves the pill and the tiles across a tier boundary; the
  // seconds themselves are not shown. See expiryTierLabel().
  //
  // The pill names ONE listing — the soonest — so it says "Next:", not a bare
  // "Ends today", which read as if it applied to the whole row. Each card
  // carries its own tier, from the same function.
  const soonest = exclusive[0]?.perishable.expiresAt;
  useCountdown(soonest ? Date.parse(soonest) : null, () => void refetchExclusive());
  const soonestTier = soonest ? expiryTierLabel(soonest) : null;

  // Two-column grid (Featured), and the single row's wide cards (Exclusive).
  const gridTileWidth = useMemo(
    () => Math.floor((width - space.screenX * 2 - space.browse.gridGap) / 2),
    [width],
  );
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

  const expiryLabelOf = (item: Item) =>
    item.perishable != null ? expiryTierLabel(item.perishable.expiresAt) : undefined;

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
              featuredQuery.isRefetching ||
              spotlightQuery.isRefetching
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

            {/* 3. Categories: shortcuts into Marketplace. */}
            <SectionHeading
              title="Categories"
              action="See all"
              onAction={() => browseInMarketplace(null)}
            />
            <CategoryCircles facets={facets} onSelect={browseInMarketplace} />

            {/* 4. Exclusive: one row of large cards, soonest to expire first. */}
            <SectionHeading
              title="Exclusive"
              accessory={
                soonestTier ? (
                  <View
                    style={s.countdown}
                    accessibilityLabel={`Next listing to expire: ${soonestTier}`}
                  >
                    <Text style={[textStyle(type.countdownPill), { color: color.urgent }]}>
                      {`Next: ${soonestTier}`}
                    </Text>
                  </View>
                ) : null
              }
              action={exclusive.length > 0 ? "See all" : undefined}
              onAction={() => router.push(marketplaceWithFilters({ perishable: true }))}
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
                    // A string, not the date: the card is memo'd, so it
                    // re-renders when this crosses a tier, not every tick.
                    expiryLabel={expiryLabelOf(item)}
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
                <SectionHeading title="Shop Spotlights" />
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

            {/* 6. Featured: every category's boosts, the server's eight.
                Left out entirely when there are none -- an empty paid section
                is noise, not information. An error still says so. */}
            {featured.length > 0 ? (
              <>
                <SectionHeading title="Featured" />
                <View style={s.grid}>
                  {featured.map((item) => (
                    <ExclusiveTile
                      key={item.id}
                      item={item}
                      width={gridTileWidth}
                      onPress={openItem}
                      viewerId={viewerId}
                    />
                  ))}
                </View>
              </>
            ) : featuredQuery.isError ? (
              <>
                <SectionHeading title="Featured" />
                <Text style={[textStyle(type.emptyBody), s.empty]}>
                  Could not load featured listings. Pull down to try again.
                </Text>
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

function SectionHeading({
  title,
  action,
  onAction,
  accessory,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  accessory?: React.ReactNode;
}) {
  return (
    <View style={s.heading}>
      <View style={s.headingLeft}>
        <Text style={[textStyle(type.homeSection), { color: color.ink }]} accessibilityRole="header">
          {title}
        </Text>
        {accessory}
      </View>
      {action && onAction ? (
        <Tappable onPress={onAction} accessibilityRole="button" hitSlop={12}>
          <Text style={[textStyle(type.homeSeeAll), { color: color.forest }]}>{action}</Text>
        </Tappable>
      ) : null}
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
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.screenX,
    marginTop: space.home.sectionTop,
    marginBottom: space.home.headingToContent,
  },
  headingLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  countdown: {
    height: size.home.countdownPill,
    paddingHorizontal: size.home.countdownPillX,
    borderRadius: radius.countdownPill,
    backgroundColor: color.urgentWash,
    borderWidth: border.chip,
    borderColor: color.urgentLine,
    justifyContent: "center",
  },
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
