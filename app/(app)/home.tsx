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
import type { Item } from "../../src/api/types";
import { useSession } from "../../src/auth/session";
import { Tappable } from "../../src/components/Tappable";
import { FilterButton, SearchField } from "../../src/components/marketplace/BrowseControls";
import { useCountdown } from "../../src/components/post/ui";
import { expiryTierLabel } from "../../src/lib/perishable";
import { CategoryCircles } from "../../src/components/home-redesign/CategoryCircles";
import { ExclusiveTile } from "../../src/components/home-redesign/ExclusiveTile";
import { HeroBanner } from "../../src/components/home-redesign/HeroBanner";
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
 * Search row → hero → category circles → one section in one of two modes:
 *
 *   Exclusive (default; the bolt circle at the head of the row is lit)
 *     Perishables across EVERY category, soonest to expire first, read from
 *     GET /api/v1/browse through useBrowse(). No circle narrows it.
 *   <Category> (a category circle is lit; the heading is the category's name)
 *     ONE merged grid: that category's perishables first, soonest to expire
 *     first, then its paid boosts from GET /api/v1/featured. The boosts keep
 *     the server's cap (eight) and hourly rotation; the perishables are NOT
 *     counted against it — see `sectionItems` below. Not headed "Featured":
 *     the section no longer means "boosted", and the star badge on a tile is
 *     what says which ones are.
 *
 * One mode at a time: `category === null` IS Exclusive mode.
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
  const [category, setCategory] = useState<string | null>(null);

  // Unfiltered, always: Exclusive is every category's perishables whatever
  // circle is lit, and the facets (the circles) come from the same page.
  // A lit circle no longer narrows this query -- it switches the section to
  // Featured, which is its own request below.
  const browse = useBrowse({ categories: [] });
  const { items, facets, isPending, isError, isRefetching } = browse;

  // Disabled while category is null, so it costs nothing in Exclusive mode.
  const featuredQuery = useFeatured(category);
  const featuredItems = featuredQuery.data ?? [];
  const featuredMode = category !== null;
  const categoryLabel = facets.find((f) => f.category === category)?.label ?? null;

  // The hero follows the lit circle: its headline is "Explore <category>" and
  // tapping a circle has to change it. It used to, for free, when the one
  // browse query above was narrowed by `category`; when that query was
  // unfiltered for Exclusive mode, the hero silently stopped following the
  // circles. So it has its own query, narrowed the way the old one was.
  //
  // With no circle lit its key IS the query above's, so React Query serves
  // both from one request; a lit circle costs one page-0 fetch, and
  // placeholderData keeps the previous hero up while it lands.
  //
  // TODO(home-redesign): still the first listing with a photo. It is
  // deliberately NOT drawn from the Featured boosts: that would be a second,
  // uncapped paid placement above the section whose cap is the guardrail.
  const heroBrowse = useBrowse({ categories: category ? [category] : [] });
  const hero = useMemo(
    () => heroBrowse.items.find((i) => i.images.length > 0) ?? null,
    [heroBrowse.items],
  );

  const { refetch: refetchBrowse } = browse;
  const { refetch: refetchHero } = heroBrowse;
  const { refetch: refetchFeatured } = featuredQuery;
  const refetch = useCallback(() => {
    void refetchBrowse();
    if (featuredMode) {
      void refetchFeatured();
      void refetchHero();
    }
  }, [refetchBrowse, refetchFeatured, refetchHero, featuredMode]);

  // Soonest to expire first. Shared by both modes.
  const perishablesOf = useCallback(
    (from: Item[]) =>
      from
        .filter((i): i is PerishableItem => i.perishable != null && !i.perishable.expired)
        .sort((a, b) => Date.parse(a.perishable.expiresAt) - Date.parse(b.perishable.expiresAt)),
    [],
  );

  // Client-side filter: /browse has no perishable parameter and rejects
  // unknown ones (z.strictObject), so this reads what page 0 returned.
  //
  // `!= null`, not `!== null`: a server without the perishables work (main,
  // before orgs-and-perishables merges) omits the key entirely, so it arrives
  // as undefined, and a strict check let every item through to `.expired`.
  const exclusive = useMemo(() => perishablesOf(items), [items, perishablesOf]);

  // The lit category's perishables, from the hero's query — it is already
  // narrowed to that category, so this sees the category's page 0 rather than
  // whatever of it made the unfiltered page 0. The category check is not
  // redundant: placeholderData keeps the PREVIOUS circle's page up while the
  // new one loads, and without it Food's grid would briefly show Books'.
  const categoryPerishables = useMemo(
    () =>
      category === null
        ? []
        : perishablesOf(heroBrowse.items.filter((i) => i.category === category)),
    [category, heroBrowse.items, perishablesOf],
  );

  // THE CAP COVERS BOOSTS ONLY. Perishables are shown in addition, uncapped:
  // they are free, they expire on their own, and there are few of them, while
  // the cap exists to ration the PAID slots — counting perishables against it
  // would let a busy food morning push every paid boost out of a section the
  // owners paid to be in. The server has already cut the boosts to eight.
  //
  // No overlap to handle: a perishable can't be boosted (the boost route
  // refuses it, /featured filters isPerishable, and isPerishable is fixed at
  // creation), so the two lists are disjoint.
  const sectionItems = useMemo<Item[]>(
    () => (featuredMode ? [...categoryPerishables, ...featuredItems] : exclusive),
    [featuredMode, categoryPerishables, featuredItems, exclusive],
  );


  // The existing countdown hook, pointed at the soonest window. When it hits
  // zero that item has expired, so refetch and the next one takes over. Its
  // tick is also what moves the pill and the tiles across a tier boundary; the
  // seconds themselves are not shown. See expiryTierLabel().
  //
  // The pill names ONE listing — the soonest — so it says "Next:", not a bare
  // "Ends today", which read as if it applied to the whole grid. Each tile
  // carries its own tier (below), from the same function.
  //
  // Follows the section on screen: in category mode it is that category's
  // soonest, and hitting zero refetches the query those tiles came from.
  const soonest = (featuredMode ? categoryPerishables : exclusive)[0]?.perishable.expiresAt;
  useCountdown(soonest ? Date.parse(soonest) : null, () =>
    void (featuredMode ? refetchHero() : refetchBrowse()),
  );
  const soonestTier = soonest ? expiryTierLabel(soonest) : null;

  const tileWidth = useMemo(
    () => Math.floor((width - space.screenX * 2 - space.browse.gridGap) / 2),
    [width],
  );

  const openItem = useCallback(
    (item: Item) => router.push({ pathname: "/item", params: { id: item.id } }),
    [router],
  );
  const openMarketplace = useCallback(() => router.push("/(app)/marketplace"), [router]);

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
    <ScrollView
      style={s.screen}
      contentContainerStyle={{ paddingTop: space.home.top, paddingBottom: space.home.bottom }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching || (featuredMode && featuredQuery.isRefetching)}
          onRefresh={refetch}
          tintColor={color.green}
        />
      }
      keyboardShouldPersistTaps="handled"
    >
      {/* 1. Search + filter + Leaves, BELOW AppHeader's wordmark row. */}
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
              {/* The category the hero's own headline names ("Explore Food").
                  That is the lit circle's whenever it has a photo listing;
                  the headline is what was read, so it is what is opened. */}
              <HeroBanner item={hero} onPress={() => browseInMarketplace(hero.category)} />
            </View>
          ) : null}

          {/* 3. Categories */}
          <SectionHeading
            title="Categories"
            action="See all"
            onAction={() => browseInMarketplace(null)}
          />
          <CategoryCircles facets={facets} selected={category} onSelect={setCategory} />

          {/* 4. Exclusive, or the lit circle's category */}
          <SectionHeading
            title={featuredMode ? (categoryLabel ?? "Listings") : "Exclusive"}
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
          />

          {sectionItems.length > 0 ? (
            <View style={s.grid}>
              {sectionItems.map((item) => (
                <ExclusiveTile
                  key={item.id}
                  item={item}
                  width={tileWidth}
                  onPress={openItem}
                  viewerId={viewerId}
                  // A string, not the date: the tile is memo'd, so it re-renders
                  // when this crosses a tier, not on every tick of the clock.
                  expiryLabel={
                    item.perishable != null ? expiryTierLabel(item.perishable.expiresAt) : undefined
                  }
                />
              ))}
            </View>
          ) : featuredMode && (featuredQuery.isPending || heroBrowse.isPending) ? (
            <ActivityIndicator color={color.green} style={s.sectionLoading} />
          ) : featuredMode && featuredQuery.isError ? (
            <Text style={[textStyle(type.emptyBody), s.empty]}>
              Could not load listings. Pull down to try again.
            </Text>
          ) : (
            <Text style={[textStyle(type.emptyBody), s.empty]}>
              {featuredMode
                ? `No listings in ${categoryLabel ?? "this category"} right now.`
                : "No perishable listings right now."}
            </Text>
          )}
        </>
      )}
    </ScrollView>
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.browse.gridGap,
    paddingHorizontal: space.screenX,
  },
  empty: { color: color.inkMuted, paddingHorizontal: space.screenX },
});
