import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useProfileMe } from "../src/api/profile";
import { useListingOffers } from "../src/api/trades";
import type { LiveOffer } from "../src/api/types";
import { BackHeader } from "../src/components/BackHeader";
import { MascotEmptyState } from "../src/components/MascotEmptyState";
import { Tappable } from "../src/components/Tappable";
import { Face, RelationPill, TierPill, offerRelation } from "../src/components/trades/listing-ui";
import { TradesErrorPanel, TradesSkeleton } from "../src/components/trades/states";
import { bracketOf } from "../src/lib/brackets";
import { usePullToRefresh } from "../src/lib/pull-to-refresh";
import { useTradeLiveness } from "../src/lib/trade-liveness";
import { TIER_ORDER } from "../src/lib/trust";
import { sizedImage } from "../src/media/image-url";
import { color, font, space } from "../src/theme/tokens";
import { offerColor } from "../src/theme/offer-tokens";

/**
 * One listing's offer inbox (Nov 2026). Opened from a listing card on the
 * Trades tab; every PENDING offer received on this item, to compare at a
 * glance. Tapping one opens the trade screen's offer view, which decides it.
 *
 * Reads its own `offersFor` query rather than filtering the Trades feed, so a
 * busy listing is never cut short by the 50-row cap that feed shares across
 * every listing.
 */

type Filter = "all" | "same" | "bridge";
type SortId = "best" | "newest" | "trust" | "value";

const SORTS: { id: SortId; label: string }[] = [
  { id: "best", label: "Best match" },
  { id: "newest", label: "Newest" },
  { id: "trust", label: "Most trusted" },
  { id: "value", label: "Highest value" },
];

const tierRank = (o: LiveOffer) =>
  o.counterparty.trustTier ? TIER_ORDER.indexOf(o.counterparty.trustTier) : -1;
const valueOf = (o: LiveOffer) => o.offeredItems[0]?.valueLeaves ?? 0;
const time = (o: LiveOffer) => Date.parse(o.createdAt);

const SORT_FNS: Record<SortId, (a: LiveOffer, b: LiveOffer) => number> = {
  // Same bracket first (free, no fee either way), then ones where THEY pay,
  // then ones where you would pay; inside each, the more trusted trader first.
  best: (a, b) => {
    const order = { same: 0, below: 1, above: 2 } as const;
    return (
      order[offerRelation(a).kind] - order[offerRelation(b).kind] ||
      tierRank(b) - tierRank(a) ||
      time(b) - time(a)
    );
  },
  newest: (a, b) => time(b) - time(a),
  trust: (a, b) => tierRank(b) - tierRank(a) || (b.counterparty.rating ?? 0) - (a.counterparty.rating ?? 0),
  value: (a, b) => valueOf(b) - valueOf(a),
};

function sortOffers(offers: LiveOffer[], sort: SortId, filter: Filter): LiveOffer[] {
  return offers
    .filter((o) =>
      filter === "all" ? true : filter === "same" ? offerRelation(o).kind === "same" : offerRelation(o).kind !== "same",
    )
    .sort(SORT_FNS[sort]);
}

function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}

export default function ListingOffersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const offers = useListingOffers(id);
  const profile = useProfileMe();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortId>("best");

  const { refreshing, onRefresh } = usePullToRefresh(() => offers.refetch());
  useTradeLiveness(offers.refetch);

  const all = offers.data ?? [];
  const sameCount = all.filter((o) => offerRelation(o).kind === "same").length;
  const shown = useMemo(() => sortOffers(all, sort, filter), [all, sort, filter]);

  // The listing's own row if the profile has it; else what any offer says
  // about it. Either is enough for the header.
  const item = profile.data?.items.find((i) => i.id === id);
  const post = all[0]?.post;
  const title = item?.title ?? post?.title ?? "Offers";
  const value = item?.valueLeaves ?? post?.valueLeaves ?? null;
  const subtitle = value != null ? `${value.toLocaleString("en-US")} L · Bracket ${bracketOf(value)}` : undefined;

  const cycleSort = () => {
    const i = SORTS.findIndex((x) => x.id === sort);
    setSort(SORTS[(i + 1) % SORTS.length].id);
  };
  // Order the trade screen's "Next offer" walks: the list as shown now.
  const order = shown.map((o) => o.id).join(",");

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <BackHeader title={title} subtitle={subtitle} onBack={() => router.back()} />

      <View style={s.controls}>
        <View style={s.segments} accessibilityRole="tablist" accessibilityLabel="Filter offers">
          {(
            [
              ["all", "All", all.length],
              ["same", "Same bracket", sameCount],
              ["bridge", "Bridge", all.length - sameCount],
            ] as const
          ).map(([fid, label, count]) => {
            const on = filter === fid;
            return (
              <Tappable
                key={fid}
                onPress={() => setFilter(fid)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${label}, ${count}`}
                style={[s.segment, on ? s.segmentOn : null]}
              >
                <Text style={{ fontFamily: on ? font.sansSemi : font.sansMedium, fontSize: 13, color: on ? color.ink : color.inkSecondary }}>
                  {label}
                </Text>
                <View style={[s.segCount, { backgroundColor: on ? color.ink : color.controlLine }]}>
                  <Text style={{ fontFamily: font.sansBold, fontSize: 11, color: on ? color.surface : color.inkSecondary }}>
                    {count}
                  </Text>
                </View>
              </Tappable>
            );
          })}
        </View>
        <View style={s.sortRow}>
          <Text style={s.meta}>
            {all.length} offer{all.length === 1 ? "" : "s"} waiting for you
          </Text>
          <Tappable
            onPress={cycleSort}
            accessibilityRole="button"
            accessibilityLabel={`Sorted by ${SORTS.find((x) => x.id === sort)!.label}. Change sort`}
            style={s.sortBtn}
          >
            <Text style={{ fontFamily: font.sansSemi, fontSize: 13, color: color.ink }}>
              ⇅ {SORTS.find((x) => x.id === sort)!.label}
            </Text>
          </Tappable>
        </View>
      </View>

      {offers.isPending && !offers.data ? (
        <TradesSkeleton />
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={offerColor.inkTertiary}
              colors={[offerColor.deep]}
            />
          }
        >
          {offers.isError ? <TradesErrorPanel onRetry={() => void offers.refetch()} /> : null}

          {shown.map((o) => (
            <OfferCard
              key={o.id}
              offer={o}
              onPress={() =>
                router.push(
                  `/trade?offer=${encodeURIComponent(o.id)}&listing=${encodeURIComponent(id ?? "")}&order=${encodeURIComponent(order)}`,
                )
              }
            />
          ))}

          {offers.data && shown.length === 0 ? (
            all.length === 0 ? (
              <MascotEmptyState
                pose="search"
                title="No offers yet"
                message="When someone offers an item for this, it shows up here."
                size={110}
              />
            ) : (
              <MascotEmptyState
                pose="search"
                title="Nothing in this group"
                message="Switch to All to see every offer on this item."
                size={110}
              />
            )
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function OfferCard({ offer, onPress }: { offer: LiveOffer; onPress: () => void }) {
  const item = offer.offeredItems[0];
  const v = item?.valueLeaves ?? null;
  const meta = v != null ? `${v.toLocaleString("en-US")} L · Bracket ${bracketOf(v)}` : "No value";
  const who = offer.counterparty;
  const rating = who.rating ? `★ ${who.rating.toFixed(1)}` : null;

  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item?.title ?? "An item"}, ${meta}, from ${who.name}. Open to compare.`}
      style={s.card}
      pressedStyle={{ backgroundColor: color.inset }}
    >
      <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        <View style={s.photo}>
          {item?.image ? (
            <Image source={{ uri: sizedImage(item.image, "thumb") }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : null}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={s.title} numberOfLines={2}>
            {item?.title ?? "An item"}
          </Text>
          <Text style={s.meta}>{meta}</Text>
          <RelationPill offer={offer} />
        </View>
      </View>
      <View style={s.footer}>
        <Face name={who.name} avatar={who.avatar} size={24} />
        <Text style={{ fontFamily: font.sansSemi, fontSize: 13, color: color.ink, flexShrink: 1 }} numberOfLines={1}>
          {who.name}
        </Text>
        <TierPill tier={who.trustTier} />
        {rating ? <Text style={s.small}>{rating}</Text> : null}
        <View style={{ flex: 1 }} />
        <Text style={s.small}>{ago(offer.createdAt)}</Text>
      </View>
    </Tappable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  controls: { paddingHorizontal: space.screenX, paddingTop: 14, gap: 12 },
  segments: { flexDirection: "row", gap: 2, padding: 3, borderRadius: 12, backgroundColor: color.control },
  segment: {
    flex: 1,
    height: 38,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  segmentOn: { backgroundColor: "#FFFFFF" },
  segCount: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
  },
  sortBtn: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  list: { padding: space.screenX, gap: 12, paddingBottom: 40 },
  card: {
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: color.controlLine,
    backgroundColor: "#FFFFFF",
  },
  photo: { width: 72, height: 72, borderRadius: 14, overflow: "hidden", backgroundColor: offerColor.photoPlaceholder },
  title: { fontFamily: font.sansSemi, fontSize: 16, lineHeight: 21, color: color.ink },
  meta: { fontFamily: font.sans, fontSize: 13, color: color.inkSecondary },
  small: { fontFamily: font.sans, fontSize: 12, color: color.inkSecondary },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: color.divider,
  },
});
