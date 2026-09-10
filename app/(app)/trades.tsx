import { router, useRouter } from "expo-router";
import { useMemo } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { ApiError } from "../../src/api/client";
import {
  buildTradesModel,
  useActiveTrades,
  useContracts,
  useTradeHistory,
  type NeedsItem,
  type WaitingItem,
} from "../../src/api/trades";
import { Splash } from "../../src/components/Splash";
import { Hairline } from "../../src/components/offer/chrome";
import { BlockHeader, Gutter, TradesHost, TradesTitle } from "../../src/components/trades/chrome";
import * as copy from "../../src/components/trades/copy";
import {
  HistoryCollapsedRow,
  NeedsCard,
  PromiseWell,
  RowAction,
  RowChevron,
  Thumb,
  WaitingRow,
} from "../../src/components/trades/rows";
import {
  CachedLabel,
  NothingPending,
  TradesEmpty,
  TradesErrorPanel,
  TradesSkeleton,
} from "../../src/components/trades/states";
import * as present from "../../src/components/trades/present";
import { clockTime } from "../../src/lib/format";
import { offerColor, offerSize } from "../../src/theme/offer-tokens";

/**
 * §6 — the Trades tab. The last screen in the core loop.
 *
 * ══ ONE PRIORITISED LIST, NO TABS ═══════════════════════════════════════════
 *
 * Decided, and the reasoning is written here so it is not quietly undone: TABS
 * WOULD PUT THE CAR-PARK CASE BEHIND A TAP. Somebody standing next to a stranger
 * about to hand over a jacket should not have to navigate to find their code. So
 * there is one list, `Needs you today` is pinned to the top of it, and everything
 * else sorts underneath.
 *
 * §6's order, and what each block admits:
 *
 *   Needs you today   a live confirmation code, then a promise inside seven days
 *                     of its deadline or past it, then an incoming offer. In
 *                     that order — see `buildTradesModel()`, which owns it.
 *   Waiting           everything with a clock on it that is not yours to move.
 *   History           one row. Nothing about a finished trade is urgent.
 *
 * WHEN `Needs you today` IS EMPTY THE WHOLE BLOCK GOES, LABEL INCLUDED. §6 says
 * so and frame 9b explains why in a line: an empty container labelled "Needs you
 * today" reads as a failure to load. One 15px sentence takes its place and
 * `Waiting` moves up to y 88.
 *
 * ══ THIS SCREEN TURNS THE TAB HEADER OFF ════════════════════════════════════
 *
 * `(app)/_layout.tsx` gives every tab `AppHeader` — the wordmark, the Leaves
 * pill, the message and bell icons. §3.5's running y starts at 0 with a 44 status
 * bar and puts a 22px `Trades` in the 44 that follows, so the header would push
 * every measured value in that table down by its own height. `headerShown: false`
 * on this one Tabs.Screen is the whole change.
 *
 * ══ THE ROWS HERE DO NOT CARRY CONTROLS; THE PUSHED SCREENS DO ══════════════
 *
 * Except on a `Needs you today` card, which is the point of the block. A Waiting
 * row on this screen is a status — it opens the full list, where frame 9c gives
 * every row its Withdraw, its Accept and its Decline at full width. Putting six
 * small controls on a scanning list is how somebody declines an offer with their
 * thumb while looking for a code.
 */
export default function TradesScreen() {
  const router = useRouter();

  const active = useActiveTrades();
  const contracts = useContracts();
  const history = useTradeHistory();

  const model = useMemo(
    () =>
      buildTradesModel({
        active: active.data,
        contracts: contracts.data,
        history: history.data,
      }),
    [active.data, contracts.data, history.data],
  );

  // A 401 anywhere means the refresh interceptor gave up and the session is
  // being torn down by the (app) layout. An error panel over that would blame
  // the network for a sign-out.
  const apiError =
    active.error instanceof ApiError
      ? active.error
      : contracts.error instanceof ApiError
        ? contracts.error
        : null;
  if (apiError?.code === "UNAUTHENTICATED") {
    return <Splash waitingOn="Signing you back in" />;
  }

  const refreshing = active.isRefetching || contracts.isRefetching;
  const refetchAll = () => {
    void active.refetch();
    void contracts.refetch();
    void history.refetch();
  };

  /* ── §6's loading row. Labels render immediately; only bodies are blocks. ── */
  if (active.isPending && !active.data) {
    return (
      <TradesHost>
        <TradesTitle title={copy.nav.trades} />
        <TradesSkeleton />
      </TradesHost>
    );
  }

  /* ── §6's network error. The panel goes in the list position, and CACHED ROWS
        STILL RENDER UNDER IT — frame 9m's own reasoning: the code somebody needs
        at the hub was already on the device, and hiding it because a refresh
        failed takes away the only thing they opened the app for. ── */
  const failed = active.isError;
  const hasCache = !!active.data;
  const lastLoaded = active.dataUpdatedAt ? clockTime(active.dataUpdatedAt) : null;

  /* ── §6's two empty states, which are not the same state. `No trades yet` is
        for somebody who has never traded; `Nothing needs you right now.` is for
        somebody with fourteen finished trades and nothing live, and showing them
        the onboarding copy would be the app forgetting who it is talking to. ── */
  const nothingEverHappened =
    !failed &&
    hasCache &&
    model.needsToday.length === 0 &&
    model.waiting.length === 0 &&
    (model.historyCount ?? 0) === 0;

  if (nothingEverHappened) {
    return (
      <TradesHost>
        <TradesTitle title={copy.nav.trades} />
        <TradesEmpty onBrowse={() => router.push("/(app)/marketplace")} />
      </TradesHost>
    );
  }

  return (
    <TradesHost>
      <TradesTitle title={copy.nav.trades} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refetchAll}
            tintColor={offerColor.inkTertiary}
            colors={[offerColor.deep]}
          />
        }
      >
        {failed ? (
          <>
            <TradesErrorPanel onRetry={refetchAll} />
            {hasCache && lastLoaded ? (
              <>
                <Hairline />
                <CachedLabel clock={lastLoaded} />
              </>
            ) : null}
          </>
        ) : null}

        {/* ── §6's top block. Absent entirely when empty, label and all. Under a
              failed refresh its own label is dropped too: `Last loaded 14:20`
              above the rows is already saying what these are. ── */}
        {model.needsToday.length > 0 ? (
          <>
            {failed ? null : <BlockHeader label={copy.label.needsToday} top={14} />}
            <Gutter style={{ gap: 8 }}>
              {model.needsToday.map((item) => (
                <NeedsRow key={item.key} item={item} stale={failed} />
              ))}
            </Gutter>
            <View style={{ height: 18 }} />
          </>
        ) : failed ? null : (
          <NothingPending />
        )}

        <Hairline />

        {/* ── §6's middle block. Rows divided by hairlines with no gap. ── */}
        {model.waiting.length > 0 ? (
          <>
            <BlockHeader label={copy.label.waiting} top={18} />
            <View>
              {model.waiting.map((item, i) => (
                <View key={item.key}>
                  {i > 0 ? <Hairline /> : null}
                  <WaitingItemRow item={item} stale={failed} />
                </View>
              ))}
            </View>
            <View style={{ height: 16 }} />
            <Hairline />
          </>
        ) : null}

        {/* ── §6's History. One row, whatever is behind it. ── */}
        <HistoryCollapsedRow
          title={copy.history.rowTitle}
          count={copy.history.count(model.historyCount ?? 0, model.historyCapped)}
          onPress={() => router.push("/trades-history")}
        />
        <Hairline />
      </ScrollView>
    </TradesHost>
  );
}

/* ─────────────────────────── the three cards ────────────────────────── */

/**
 * One `Needs you today` card.
 *
 * THE LIVE-CODE CARD IS THE ONLY ONE WITH A FILLED CONTROL, and frame 9a's note
 * is the reason: it is the only one with somebody waiting in front of you. A
 * screen with three green buttons on it has no priority at all.
 *
 * MODULE SCOPE, NOT A CLOSURE INSIDE THE SCREEN. A component declared inside a
 * render body is a new function identity on every render, so React unmounts and
 * remounts the whole subtree each time — which on a list of cards means every
 * photo reloads and the scroll position jumps.
 *
 * Navigation therefore goes through expo-router's `router` singleton rather than
 * a `useRouter()` value threaded down as a prop. It is the same object the hook
 * returns and it is the documented way to navigate from outside a component's
 * own render — the hook exists for re-rendering on route changes, which a row
 * does not need to do.
 */
function NeedsRow({ item, stale }: { item: NeedsItem; stale: boolean }) {
  if (item.kind === "code") {
    const words = present.codeTradeWords(item.trade);
    return (
      <NeedsCard
        thumb={<Thumb image={item.trade.requestedItem.image} size={offerSize.tradeCard.thumb} />}
        title={words.title}
        subtitle={words.subtitle}
        monoLines={[
          { text: stale ? copy.card.savedOnPhone : present.swapLine(item.trade) },
        ]}
        action={
          <RowAction
            label={copy.card.codeAction}
            tone="filled"
            onPress={() => router.push(`/trade-code?id=${encodeURIComponent(item.trade.id)}`)}
            accessibilityLabel={`Open the confirmation code for ${item.trade.counterparty.name}`}
          />
        }
      />
    );
  }

  if (item.kind === "promise") {
    const lines = present.promiseCardLines(item.contract);
    return (
      <NeedsCard
        thumb={<PromiseWell size={offerSize.tradeCard.thumb} />}
        title={lines.title}
        monoLines={[{ text: lines.deadline, ink: lines.ink }, { text: lines.settled }]}
        action={
          // Frame 9a's `Settle`, and it now leads somewhere that settles. The
          // amount question lives on the Promises screen with the rest of the
          // agreement, so the control opens that screen WITH THIS CONTRACT
          // PRESELECTED — the sheet is up by the time the push lands. A button
          // labelled Settle that only navigated would be a small lie.
          //
          // Outlined, not filled: §6 reserves the one filled control on this
          // screen for the live code, which is the only card with somebody
          // standing in front of you.
          <RowAction
            label={copy.promise.settle}
            onPress={() =>
              router.push(`/promises?settle=${encodeURIComponent(item.contract.id)}`)
            }
            accessibilityLabel={`Settle the ${lines.title}`}
          />
        }
      />
    );
  }

  if (item.kind === "trade-request") {
    // A PENDING TradeRequest addressed to the viewer — a swap proposed directly
    // rather than through an offer. It cannot open `/offer-review`, which reads
    // an offer id, so the card carries the decision itself and opens the full
    // Waiting list for anything more.
    const words = present.tradeRequestWords(item.trade);
    return (
      <NeedsCard
        compact
        thumb={<Thumb image={item.trade.requestedItem.image} size={offerSize.tradeCard.thumb} />}
        title={words.title}
        subtitle={words.subtitle}
        onPress={() => router.push("/trades-waiting")}
        action={<RowChevron />}
      />
    );
  }

  const words = present.incomingOfferWords(item.offer);
  return (
    <NeedsCard
      compact
      thumb={<Thumb image={item.offer.post.image} size={offerSize.tradeCard.thumb} />}
      title={words.title}
      subtitle={words.subtitle}
      onPress={() => router.push(`/offer-review?id=${encodeURIComponent(item.offer.id)}`)}
      action={<RowChevron />}
    />
  );
}

/** One `Waiting` row. Status only — the controls live in the pushed list. */
function WaitingItemRow({ item, stale }: { item: WaitingItem; stale: boolean }) {
  const openList = () => router.push("/trades-waiting");

  if (item.kind === "sent-offer") {
    const words = present.sentOfferWords(item.offer);
    return (
      <WaitingRow
        thumb={<Thumb image={item.offer.post.image} size={offerSize.tradeRow.thumb} />}
        title={words.title}
        subtitle={stale ? copy.card.mayBeStale : words.subtitle}
        trailing={words.trailing}
        dim={stale}
        onPress={openList}
      />
    );
  }

  if (item.kind === "trade") {
    const words =
      item.trade.status === "PENDING"
        ? present.tradeRequestWords(item.trade)
        : item.trade.status === "ACCEPTED"
          ? present.acceptedTradeWords(item.trade)
          : present.confirmingTradeWords(item.trade);
    return (
      <WaitingRow
        thumb={<Thumb image={item.trade.requestedItem.image} size={offerSize.tradeRow.thumb} />}
        title={words.title}
        subtitle={stale ? copy.card.mayBeStale : words.subtitle}
        trailing={words.trailing}
        dim={stale}
        onPress={openList}
      />
    );
  }

  const words = present.promiseWords(item.contract);
  return (
    <WaitingRow
      thumb={<PromiseWell size={offerSize.tradeRow.thumb} />}
      title={words.title}
      subtitle={stale ? copy.card.mayBeStale : words.subtitle}
      trailing={words.trailing}
      trailingInk={words.trailingInk}
      dim={stale}
      onPress={() => router.push("/promises")}
    />
  );
}
