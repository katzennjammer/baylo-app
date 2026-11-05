import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { ApiError } from "../../src/api/client";
import { useProfileMe } from "../../src/api/profile";
import { buildTradesModel, useActiveTrades, useTradeHistory } from "../../src/api/trades";
import type { Item, LiveOffer } from "../../src/api/types";
import { MascotEmptyState } from "../../src/components/MascotEmptyState";
import { Splash } from "../../src/components/Splash";
import { Tappable } from "../../src/components/Tappable";
import { SectionHeader } from "../../src/components/home-redesign/SectionHeader";
import { TradesHost } from "../../src/components/trades/chrome";
import * as copy from "../../src/components/trades/copy";
import { HistoryContent } from "../../src/components/trades/HistoryContent";
import { Chip, Face, UnderlineTabs, offerRelation } from "../../src/components/trades/listing-ui";
import { ChevronRightIcon, LeafIcon } from "../../src/components/icons";
import * as present from "../../src/components/trades/present";
import { TradeCard } from "../../src/components/trades/TradeCard";
import { CachedLabel, TradesErrorPanel, TradesSkeleton } from "../../src/components/trades/states";
import { WaitingList } from "../../src/components/trades/WaitingContent";
import { useWithdraw } from "../../src/components/trades/useWithdraw";
import { bracketOf } from "../../src/lib/brackets";
import { clockTime } from "../../src/lib/format";
import { useLiveDerived } from "../../src/lib/live-clock";
import { sizedImage } from "../../src/media/image-url";
import { usePullToRefresh } from "../../src/lib/pull-to-refresh";
import { useTradeLiveness } from "../../src/lib/trade-liveness";
import { color, font, space } from "../../src/theme/tokens";
import { offerColor } from "../../src/theme/offer-tokens";

/**
 * §6 — the Trades tab, redesigned for volume (Nov 2026).
 *
 * ══ WHY TABS NOW ════════════════════════════════════════════════════════════
 *
 * The 1 Oct design was one prioritised list, and it said why: tabs would put
 * the car-park case behind a tap. That still holds, so the FIRST tab, the one
 * the screen opens on, keeps "Your move" pinned at the top — the live code, the
 * meetup today, the hub to answer. What changed is incoming offers. They used
 * to be cards in "Your move", one per offer, so a person with six listings and
 * forty offers had forty cards to scroll. They now live under the listing they
 * are for: one card per listing, a count on it, and an inbox behind it
 * (/listing-offers) where offers on that item are compared and decided.
 *
 *   My listings   Your move (everything but offers) · your listings, each
 *                 with its offer count
 *   Sent          offers you made, and trades waiting on the other person
 *                 (the /trades-waiting list)
 *   Done          finished and called-off trades (the /trades-history list)
 *
 * The tab badge is still `useNeedsTodayCount()`, which counts incoming offers
 * too: an offer is still something waiting on you.
 */

type TabId = "listings" | "sent" | "done";
type SortId = "offers" | "recent" | "value";

const SORTS: { id: SortId; label: string }[] = [
  { id: "offers", label: "Most offers" },
  { id: "recent", label: "Newest offers" },
  { id: "value", label: "Highest value" },
];

/** A listing as the Trades tab draws it: the item and the offers on it. */
interface ListingRow {
  item: Item;
  offers: LiveOffer[];
  sameBracket: number;
  latest: number;
}

export default function TradesScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("listings");
  const [sort, setSort] = useState<SortId>("offers");

  const active = useActiveTrades();
  const history = useTradeHistory();
  const profile = useProfileMe();
  const withdraw = useWithdraw();

  const model = useMemo(
    () => buildTradesModel({ active: active.data, history: history.data }),
    [active.data, history.data],
  );

  // Your move, minus incoming offers: those are counted on their listing.
  const yourMove = useMemo(() => model.needsToday.filter((i) => i.kind !== "offer"), [model]);
  const received = useMemo(
    () => (active.data?.offers ?? []).filter((o) => o.direction === "received"),
    [active.data],
  );

  const rows = useMemo<ListingRow[]>(() => {
    const listed = (profile.data?.items ?? []).filter((i) => i.status === "AVAILABLE");
    const byItem = new Map<string, LiveOffer[]>();
    for (const o of received) byItem.set(o.post.id, [...(byItem.get(o.post.id) ?? []), o]);
    const out = listed.map((item) => {
      const offers = byItem.get(item.id) ?? [];
      return {
        item,
        offers,
        sameBracket: offers.filter((o) => offerRelation(o).kind === "same").length,
        latest: offers.reduce((m, o) => Math.max(m, Date.parse(o.createdAt)), 0),
      };
    });
    const by: Record<SortId, (a: ListingRow, b: ListingRow) => number> = {
      offers: (a, b) => b.offers.length - a.offers.length || b.latest - a.latest,
      recent: (a, b) => b.latest - a.latest,
      value: (a, b) => (b.item.valueLeaves ?? 0) - (a.item.valueLeaves ?? 0),
    };
    return out.sort(by[sort]);
  }, [profile.data, received, sort]);

  // Codes live 15 minutes, so a "Show code" card can go stale while this screen
  // sits open. The shared clock re-renders only when some card's phase changes,
  // and subscribes only while the screen is focused and a code card exists.
  const codeTrades = useMemo(
    () => yourMove.flatMap((item) => (item.kind === "code" ? [item.trade] : [])),
    [yourMove],
  );
  const phaseKey = useLiveDerived(
    (now) => codeTrades.map((t) => present.codePhase(t, now)).join(","),
    codeTrades.length > 0,
  );
  const codePhases = useMemo(() => {
    const parts = phaseKey.split(",") as present.CodePhase[];
    return new Map(codeTrades.map((t, i) => [t.id, parts[i]]));
  }, [phaseKey, codeTrades]);

  // The spinner follows the GESTURE, not `isRefetching`: liveness and the push
  // channel refetch silently, and must not flick a pull indicator nobody pulled.
  const refetchAll = useCallback(
    () => Promise.all([active.refetch(), history.refetch(), profile.refetch()]),
    [active.refetch, history.refetch, profile.refetch],
  );
  const { refreshing, onRefresh } = usePullToRefresh(refetchAll);
  useTradeLiveness(active.refetch);

  // A 401 means the session is being torn down by the (app) layout. An error
  // panel over that would blame the network for a sign-out.
  const apiError = active.error instanceof ApiError ? active.error : null;
  if (apiError?.code === "UNAUTHENTICATED") {
    return <Splash waitingOn="Signing you back in" />;
  }

  if (active.isPending && !active.data) {
    return (
      <TradesHost>
        <TradesSkeleton />
      </TradesHost>
    );
  }

  const failed = active.isError;
  const hasCache = !!active.data;
  const lastLoaded = active.dataUpdatedAt ? clockTime(active.dataUpdatedAt) : null;

  const goPost = () => router.push("/post-item");
  const goBrowse = () => router.push("/(app)/marketplace");

  return (
    <TradesHost>
      <View style={s.tabsWrap}>
        <UnderlineTabs<TabId>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "listings", label: "My listings", count: received.length, countTone: "green" },
            { id: "sent", label: "Sent", count: model.waiting.length, countTone: "quiet" },
            { id: "done", label: "Done" },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={offerColor.inkTertiary}
            colors={[offerColor.deep]}
          />
        }
      >
        {failed ? (
          <>
            <TradesErrorPanel onRetry={() => void refetchAll()} />
            {hasCache && lastLoaded ? <CachedLabel clock={lastLoaded} /> : null}
          </>
        ) : null}

        {tab === "listings" ? (
          <>
            {yourMove.length > 0 ? (
              <>
                <SectionHeader
                  leading={copy.tradeCard.yourMoveLead}
                  accent={copy.tradeCard.yourMoveAccent}
                  accentColor={color.forest}
                  squiggle
                  count={yourMove.length}
                  top={20}
                />
                <View style={s.cards}>
                  {yourMove.map((item, i) => (
                    <TradeCard
                      key={item.key}
                      words={present.yourMoveCard(
                        item,
                        item.kind === "code" ? codePhases.get(item.trade.id) : undefined,
                      )}
                      urgent={i === 0}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {rows.length === 0 && profile.data ? (
              yourMove.length === 0 ? (
                <View style={s.empty}>
                  <MascotEmptyState
                    pose="box"
                    title="Nothing listed yet"
                    message="Post something you don't use any more. Offers on it collect here, one inbox per item."
                    action={{ label: "Post an item", onPress: goPost }}
                  >
                    <TextLink label="Browse the marketplace" onPress={goBrowse} />
                  </MascotEmptyState>
                  <HowItWorks />
                </View>
              ) : null
            ) : (
              <>
                {/* No "Your listings" heading: the tab above already says so. */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.chips}
                  accessibilityRole="radiogroup"
                  accessibilityLabel="Sort listings"
                >
                  {SORTS.map((o) => (
                    <Chip key={o.id} label={o.label} on={sort === o.id} onPress={() => setSort(o.id)} />
                  ))}
                </ScrollView>
                <ListingSplit
                  rows={rows}
                  onOpen={(id) => router.push(`/listing-offers?id=${encodeURIComponent(id)}`)}
                />
              </>
            )}
          </>
        ) : null}

        {tab === "sent" ? (
          model.waiting.length === 0 && hasCache && !failed ? (
            <View style={s.empty}>
              <MascotEmptyState
                pose="search"
                title="No offers sent"
                message="Find something you'd like and offer one of your items for it. You'll see the reply here."
                action={{ label: "Browse the marketplace", onPress: goBrowse }}
              />
            </View>
          ) : (
            <View style={{ paddingTop: 16 }}>
              <WaitingList waiting={model.waiting} withdraw={withdraw} loaded={hasCache && !failed} />
            </View>
          )
        ) : null}

        {tab === "done" ? (
          history.data && history.data.trades.length === 0 && !history.isError ? (
            <View style={s.empty}>
              <MascotEmptyState
                pose="leaf"
                title="No finished trades yet"
                message="When you and your trader both enter your codes, the trade is done and it's kept here."
              />
            </View>
          ) : history.isPending && !history.data ? (
            <TradesSkeleton />
          ) : (
            <HistoryContent history={history} />
          )
        ) : null}
      </ScrollView>
    </TradesHost>
  );
}

/* ─────────────────────────────── a listing ─────────────────────────────── */

/* ─────────────── listings: offers first, the rest in a grid ─────────────── */

const GRID_GAP = 12;

function offersLabel(n: number): string {
  return `${n} offer${n === 1 ? "" : "s"}`;
}

/** Big photo, offers pinned on it, title and value under it. */
function ListingTile({ row, width, onPress }: { row: ListingRow; width: number; onPress: () => void }) {
  const { item, offers } = row;
  const value = item.valueLeaves;
  const live = offers.length > 0;
  const faces = [...offers].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 3);
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${live ? offersLabel(offers.length) : "No offers yet"}.`}
      style={{ width, gap: 8 }}
      pressedStyle={{ opacity: 0.85 }}
    >
      <View style={[s.tilePhoto, { width, height: width }, live && s.tilePhotoLive]}>
        {item.images[0] ? (
          <Image source={{ uri: sizedImage(item.images[0], "card") }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : null}
        <View style={[s.tilePill, live ? s.tilePillLive : s.tilePillQuiet]}>
          {live ? (
            <View style={{ flexDirection: "row" }}>
              {faces.map((o, i) => (
                <Face key={o.id} name={o.counterparty.name} avatar={o.counterparty.avatar} size={18} ring={color.green} style={i ? { marginLeft: -5 } : undefined} />
              ))}
            </View>
          ) : null}
          <Text style={live ? s.tilePillTextLive : s.tilePillTextQuiet}>
            {live ? offersLabel(offers.length) : "No offers yet"}
          </Text>
        </View>
      </View>
      <View style={{ gap: 3, paddingHorizontal: 2 }}>
        <Text style={s.tileTitle} numberOfLines={1}>{item.title}</Text>
        {value != null ? (
          <View style={s.valueRow}>
            <LeafIcon size={13} stroke={2.2} color={color.forest} />
            <Text style={s.valueText}>
              {value.toLocaleString("en-US")}
              <Text style={s.meta}>{`  ·  Bracket ${bracketOf(value)}`}</Text>
            </Text>
          </View>
        ) : (
          <Text style={s.meta}>No value yet</Text>
        )}
      </View>
    </Tappable>
  );
}

function ListingGrid({ rows, onOpen }: { rows: ListingRow[]; onOpen: (id: string) => void }) {
  const { width } = useWindowDimensions();
  const tile = Math.floor((Math.min(width, 520) - space.screenX * 2 - GRID_GAP) / 2);
  return (
    <View style={s.grid}>
      {rows.map((row) => (
        <ListingTile key={row.item.id} row={row} width={tile} onPress={() => onOpen(row.item.id)} />
      ))}
    </View>
  );
}

/** A listing with offers: a big photo, who offered, and a button to see them. */
function OffersCard({ row, onPress }: { row: ListingRow; onPress: () => void }) {
  const { item, offers } = row;
  const value = item.valueLeaves;
  const faces = [...offers].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 3);
  const names = faces.map((o) => o.counterparty.name.split(" ")[0]);
  const who =
    offers.length === 1
      ? `${names[0]} offered`
      : `${names[0]} and ${offers.length - 1} other${offers.length === 2 ? "" : "s"}`;
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${who}.`}
      style={s.offersCard}
      pressedStyle={{ backgroundColor: color.inset }}
    >
      <View style={{ flexDirection: "row", gap: 14 }}>
        <View style={s.offersPhoto}>
          {item.images[0] ? (
            <Image source={{ uri: sizedImage(item.images[0], "thumb") }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : null}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 5, justifyContent: "center" }}>
          <Text style={[s.listingTitle, { flex: 0 }]} numberOfLines={2}>{item.title}</Text>
          {value != null ? (
            <View style={s.valueRow}>
              <LeafIcon size={13} stroke={2.2} color={color.forest} />
              <Text style={s.valueText}>
                {value.toLocaleString("en-US")}
                <Text style={s.meta}>{`  ·  Bracket ${bracketOf(value)}`}</Text>
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={s.offersFoot}>
        <View style={{ flexDirection: "row" }}>
          {faces.map((o, i) => (
            <Face key={o.id} name={o.counterparty.name} avatar={o.counterparty.avatar} size={26} ring="#FFFFFF" style={i ? { marginLeft: -8 } : undefined} />
          ))}
        </View>
        <Text style={s.offersWho} numberOfLines={1}>{who}</Text>
        <View style={s.offersButton}>
          <Text style={s.offersButtonText}>{`See ${offers.length}`}</Text>
          <ChevronRightIcon size={14} stroke={2.2} color={color.onGreen} />
        </View>
      </View>
    </Tappable>
  );
}

function ListingSplit({ rows, onOpen }: { rows: ListingRow[]; onOpen: (id: string) => void }) {
  const live = rows.filter((r) => r.offers.length > 0);
  const quiet = rows.filter((r) => r.offers.length === 0);
  return (
    <View style={{ gap: 10 }}>
      {live.length ? <Text style={s.groupHead}>{`Offers waiting · ${live.length}`}</Text> : null}
      {live.map((row) => (
        <OffersCard key={row.item.id} row={row} onPress={() => onOpen(row.item.id)} />
      ))}
      {quiet.length ? (
        <>
          <Text style={[s.groupHead, live.length ? { marginTop: 14 } : null]}>{`No offers yet · ${quiet.length}`}</Text>
          <ListingGrid rows={quiet} onOpen={onOpen} />
        </>
      ) : null}
    </View>
  );
}



/* ─────────────────────────── a new account ─────────────────────────── */

const HOW = [
  { title: "Post an item", body: "Baylo suggests its value in Leaves and its bracket." },
  { title: "Get offers", body: "People offer one item each, in the same bracket or one away." },
  { title: "Meet and trade", body: "Pick a Safe-Zone Hub, check the item, enter each other's codes." },
];

/** Three lines of how trading works, under the first-run empty state. */
function HowItWorks() {
  return (
    <View style={s.how} accessibilityLabel="How trading works">
      {HOW.map((h, i) => (
        <View key={h.title} style={s.howRow}>
          <View style={s.howNum}>
            <Text style={{ fontFamily: font.sansBold, fontSize: 12, color: color.inkSecondary }}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: font.sansSemi, fontSize: 14, color: color.ink }}>{h.title}</Text>
            <Text style={s.meta}>{h.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Tappable onPress={onPress} accessibilityRole="button" style={s.textLink}>
      <Text style={{ fontFamily: font.sansSemi, fontSize: 14, color: color.forest }}>{label}</Text>
    </Tappable>
  );
}

const s = StyleSheet.create({
  tabsWrap: { paddingHorizontal: space.screenX, paddingTop: 8 },
  cards: { gap: 10 },
  empty: { paddingTop: 24, paddingHorizontal: space.screenX },
  h2: { fontFamily: font.displaySemi, fontSize: 20, color: color.ink },
  chips: { gap: 8, paddingHorizontal: space.screenX, paddingTop: 16, paddingBottom: 12 },
  valueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  valueText: { fontFamily: font.sansSemi, fontSize: 13, color: color.ink },
  listingTitle: { flex: 1, minWidth: 0, fontFamily: font.sansSemi, fontSize: 15, lineHeight: 20, color: color.ink },
  meta: { fontFamily: font.sans, fontSize: 13, color: color.inkSecondary },
  how: { marginTop: 20, borderTopWidth: 1, borderTopColor: color.divider },
  howRow: {
    flexDirection: "row",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
  },
  howNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: color.control,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP, paddingHorizontal: space.screenX },
  tilePhoto: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: offerColor.photoPlaceholder,
    borderWidth: 1,
    borderColor: color.controlLine,
  },
  tilePhotoLive: { borderColor: color.green, borderWidth: 2 },
  tilePill: {
    position: "absolute",
    left: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 26,
    paddingLeft: 4,
    paddingRight: 10,
    borderRadius: 13,
  },
  tilePillLive: { backgroundColor: color.green },
  tilePillQuiet: { backgroundColor: "rgba(250, 250, 247, 0.92)", paddingLeft: 10 },
  tilePillTextLive: { fontFamily: font.sansBold, fontSize: 12, color: color.onGreen },
  tilePillTextQuiet: { fontFamily: font.sansSemi, fontSize: 12, color: color.inkSecondary },
  tileTitle: { fontFamily: font.sansSemi, fontSize: 15, lineHeight: 20, color: color.ink },
  groupHead: {
    paddingHorizontal: space.screenX,
    fontFamily: font.sansSemi,
    fontSize: 13,
    color: color.inkSecondary,
  },
  offersCard: {
    marginHorizontal: space.screenX,
    padding: 12,
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: color.greenLine,
    backgroundColor: "#FFFFFF",
  },
  offersPhoto: {
    width: 96,
    height: 96,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: offerColor.photoPlaceholder,
  },
  offersFoot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: color.divider,
  },
  offersWho: { flex: 1, minWidth: 0, fontFamily: font.sansSemi, fontSize: 13, color: color.forest },
  offersButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 32,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 16,
    backgroundColor: color.green,
  },
  offersButtonText: { fontFamily: font.sansBold, fontSize: 13, color: color.onGreen },
  textLink: { minHeight: 44, justifyContent: "center", alignSelf: "center", paddingHorizontal: 12 },
});
