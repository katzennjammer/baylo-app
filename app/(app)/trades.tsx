import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { ApiError } from "../../src/api/client";
import { buildTradesModel, useActiveTrades, useTradeHistory } from "../../src/api/trades";
import { Splash } from "../../src/components/Splash";
import { Tappable } from "../../src/components/Tappable";
import { ChevronRightIcon } from "../../src/components/icons";
import { SectionHeader } from "../../src/components/home-redesign/SectionHeader";
import { TradesHost } from "../../src/components/trades/chrome";
import * as copy from "../../src/components/trades/copy";
import * as present from "../../src/components/trades/present";
import { TradeCard } from "../../src/components/trades/TradeCard";
import {
  CachedLabel,
  NothingPending,
  TRADES_FIRST_HEADER_TOP,
  TradesEmpty,
  TradesErrorPanel,
  TradesSkeleton,
} from "../../src/components/trades/states";
import { clockTime } from "../../src/lib/format";
import { useLiveDerived } from "../../src/lib/live-clock";
import { usePullToRefresh } from "../../src/lib/pull-to-refresh";
import { useTradeLiveness } from "../../src/lib/trade-liveness";
import { color, icon, space, textStyle, type } from "../../src/theme/tokens";
import { offerBorder, offerColor, offerSize } from "../../src/theme/offer-tokens";

/**
 * §6 — the Trades tab. The last screen in the core loop.
 *
 * ══ ONE PRIORITISED LIST, NO TABS ═══════════════════════════════════════════
 *
 * Decided, and the reasoning is written here so it is not quietly undone: TABS
 * WOULD PUT THE CAR-PARK CASE BEHIND A TAP. Somebody standing next to a stranger
 * about to hand over a jacket should not have to navigate to find their code. So
 * there is one list, `Your move` is pinned to the top of it, and everything else
 * sorts underneath.
 *
 *   Your move         what is the viewer's to do, most urgent first — see
 *                     `buildTradesModel()`, which owns the order.
 *   Waiting on them   everything mid-flight that is the other person's move.
 *   Finished trades   one row. Nothing about a finished trade is urgent.
 *
 * ══ THE 1 OCT 2026 REDESIGN ═════════════════════════════════════════════════
 *
 * Each trade is a card (`TradeCard`): who and since when, a "You give ┆⇄┆ You
 * get" split in the listing screen's swap-ticket style, a four-step track on
 * "Your move" cards only, and a footer with one specific sentence and the
 * action. ONLY THE TOP "Your move" CARD gets the solid button and the 1.5
 * forest border — a screen with three solid buttons on it has no priority.
 *
 * Display only. No status logic changed; the bridging fee lives on the trade
 * screen (`app/trade.tsx`), which every card opens, not here.
 * No monospace on this screen.
 *
 * WHEN `Your move` IS EMPTY ITS HEADER GOES. An empty container labelled "Your
 * move" reads as a failure to load; "Waiting on them" moves up and carries
 * "Nothing needs you right now." under it.
 *
 * ══ THIS SCREEN TURNS THE TAB HEADER OFF ════════════════════════════════════
 *
 * `(app)/_layout.tsx` sets `headerShown: false` on this Tabs.Screen, and there
 * is no in-screen title either: the tab bar already says where you are, so the
 * first section header opens the screen, `TRADES_FIRST_HEADER_TOP` under the
 * status-bar padding `TradesHost` applies.
 */
export default function TradesScreen() {
  const router = useRouter();

  const active = useActiveTrades();
  const history = useTradeHistory();

  const model = useMemo(
    () => buildTradesModel({ active: active.data, history: history.data }),
    [active.data, history.data],
  );

  // Codes live 15 minutes, so a "Show code" card can go stale while this screen
  // sits open. The shared clock re-renders only when some card's phase changes,
  // and subscribes only while the screen is focused and a code card exists.
  const codeTrades = useMemo(
    () => model.needsToday.flatMap((item) => (item.kind === "code" ? [item.trade] : [])),
    [model],
  );
  const phaseKey = useLiveDerived(
    (now) => codeTrades.map((t) => present.codePhase(t, now)).join(","),
    codeTrades.length > 0,
  );
  const codePhases = useMemo(() => {
    const parts = phaseKey.split(",") as present.CodePhase[];
    return new Map(codeTrades.map((t, i) => [t.id, parts[i]]));
  }, [phaseKey, codeTrades]);

  // The spinner follows the GESTURE, not `isRefetching`: the liveness hook
  // below and the push channel both refetch this list silently, and each of
  // those used to flick the pull indicator at the top of a list nobody pulled.
  const refetchAll = useCallback(
    () => Promise.all([active.refetch(), history.refetch()]),
    [active.refetch, history.refetch],
  );
  const { refreshing, onRefresh } = usePullToRefresh(refetchAll);

  // Regained-focus refetch, and a 20s poll while the socket is down. Only the
  // active list: history moves on status changes, which the push covers.
  useTradeLiveness(active.refetch);

  // A 401 anywhere means the refresh interceptor gave up and the session is
  // being torn down by the (app) layout. An error panel over that would blame
  // the network for a sign-out.
  const apiError = active.error instanceof ApiError ? active.error : null;
  if (apiError?.code === "UNAUTHENTICATED") {
    return <Splash waitingOn="Signing you back in" />;
  }

  /* ── §6's loading row. Headers render immediately; only bodies are blocks. ── */
  if (active.isPending && !active.data) {
    return (
      <TradesHost>
        <TradesSkeleton />
      </TradesHost>
    );
  }

  /* ── §6's network error. The panel goes in the list position, and CACHED ROWS
        STILL RENDER UNDER IT: the code somebody needs at the hub was already on
        the device, and hiding it because a refresh failed takes away the only
        thing they opened the app for. ── */
  const failed = active.isError;
  const hasCache = !!active.data;
  const lastLoaded = active.dataUpdatedAt ? clockTime(active.dataUpdatedAt) : null;

  /* ── §6's two empty states, which are not the same state. `No trades yet` is
        for somebody who has never traded; `Nothing needs you right now.` is for
        somebody with fourteen finished trades and nothing live. ── */
  const yourMove = model.needsToday;
  const waiting = model.waiting;
  const nothingEverHappened =
    !failed &&
    hasCache &&
    yourMove.length === 0 &&
    waiting.length === 0 &&
    (model.historyCount ?? 0) === 0;

  if (nothingEverHappened) {
    return (
      <TradesHost>
        <TradesEmpty onBrowse={() => router.push("/(app)/marketplace")} />
      </TradesHost>
    );
  }

  // The first header sits close under the status bar, unless the error panel
  // is above it, in which case it keeps a normal section gap.
  const firstTop = failed ? undefined : TRADES_FIRST_HEADER_TOP;
  const openWaitingList = () => router.push("/trades-waiting");

  const waitingSection =
    waiting.length > 0 ? (
      <>
        <SectionHeader
          accent={copy.tradeCard.waitingOnThem}
          count={waiting.length}
          top={yourMove.length > 0 ? undefined : firstTop}
          subtitle={yourMove.length > 0 || failed ? undefined : copy.nothingPending}
          onSeeAll={openWaitingList}
        />
        <View style={s.cards}>
          {waiting.map((item) => (
            <TradeCard key={item.key} words={present.waitingCard(item)} dim={failed} />
          ))}
        </View>
      </>
    ) : null;

  return (
    <TradesHost>
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

        {yourMove.length > 0 ? (
          <>
            <SectionHeader
              leading={copy.tradeCard.yourMoveLead}
              accent={copy.tradeCard.yourMoveAccent}
              accentColor={color.forest}
              squiggle
              count={yourMove.length}
              top={firstTop}
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

        {waitingSection}

        {/* Nothing live at all, but a history: the one line, then the row. */}
        {yourMove.length === 0 && waiting.length === 0 && !failed ? (
          <View style={{ paddingTop: TRADES_FIRST_HEADER_TOP }}>
            <NothingPending />
          </View>
        ) : null}

        <FinishedRow
          count={copy.history.count(model.historyCount ?? 0, model.historyCapped)}
          onPress={() => router.push("/trades-history")}
        />
      </ScrollView>
    </TradesHost>
  );
}

/**
 * "Finished trades": one row between hairlines, the count and a chevron. Body
 * family throughout — this screen carries no monospace.
 */
function FinishedRow({ count, onPress }: { count: string; onPress: () => void }) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${copy.history.rowTitle}, ${count}`}
      style={s.finished}
      pressedStyle={{ backgroundColor: color.inset }}
    >
      <Text style={[textStyle(type.username), s.finishedTitle]} numberOfLines={1}>
        {copy.history.rowTitle}
      </Text>
      <Text style={[textStyle(type.metadata), s.finishedCount]} numberOfLines={1}>
        {count}
      </Text>
      <ChevronRightIcon size={icon.chevron.size} stroke={icon.chevron.stroke} color={color.inkMuted} />
    </Tappable>
  );
}

const s = StyleSheet.create({
  cards: { gap: 10 },
  finished: {
    marginTop: space.home.sectionTop,
    minHeight: offerSize.historyRow.height,
    paddingHorizontal: space.screenX,
    flexDirection: "row",
    alignItems: "center",
    gap: space.browse.searchGap,
    borderTopWidth: offerBorder.rule,
    borderBottomWidth: offerBorder.rule,
    borderColor: color.divider,
  },
  finishedTitle: { flex: 1, minWidth: 0, color: color.ink },
  finishedCount: { flexShrink: 0, color: color.inkSecondary },
});
