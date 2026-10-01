import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ApiError } from "../src/api/client";
import {
  meetupState,
  useActiveTrades,
  useTradeDecision,
  useTradeHistory,
} from "../src/api/trades";
import type { ActiveTrade, LiveOffer } from "../src/api/types";
import { useKeyboardState } from "../src/components/auth-sheet";
import { Splash } from "../src/components/Splash";
import { Tappable } from "../src/components/Tappable";
import {
  ChevronRightIcon,
  CloseIcon,
  KebabIcon,
  MessageIcon,
  PencilIcon,
  PersonIcon,
  SwapIcon,
  WarningIcon,
} from "../src/components/icons";
import { Hairline, NavDone, OfferScreenHost } from "../src/components/offer/chrome";
import { SheetRow, SheetRows, SheetShell } from "../src/components/sheet-ui";
import { HandoffPanel } from "../src/components/trades/HandoffPanel";
import { CardLink, ProgressTrack, SwapSplit } from "../src/components/trades/TradeCard";
import {
  DonePanel,
  FeeNote,
  HubStepPanel,
  OfferPanel,
  RequestPanel,
  WaitingPanel,
} from "../src/components/trades/TradePanels";
import { Gutter, TradesBackTitle } from "../src/components/trades/chrome";
import { useCodeEntry } from "../src/components/trades/code";
import * as copy from "../src/components/trades/copy";
import * as present from "../src/components/trades/present";
import { TradesErrorPanel, TradesSkeleton } from "../src/components/trades/states";
import { TradeButton } from "../src/components/trades/trade-ui";
import { useOfferDecisionFlow } from "../src/components/trades/useOfferDecisionFlow";
import { useWithdraw } from "../src/components/trades/useWithdraw";
import { meetupWhen } from "../src/lib/gap";
import { openPremium, premiumGateReason } from "../src/lib/premium";
import { useTradeLiveness } from "../src/lib/trade-liveness";
import { color, icon, size, space, textStyle, type } from "../src/theme/tokens";

/**
 * ONE SCREEN PER TRADE (Round 2, 1 Oct 2026).
 *
 *   /trade?id=<tradeId>        a trade row, in any state, live or finished
 *   /trade?offer=<offerId>     an offer that is not a trade yet
 *   …&handoff=1                open straight on the codes (see below)
 *
 * Header, then the "You give ┆⇄┆ You get" split and the card's progress track,
 * then ONE panel for the step the trade is on, then the bridging fee. Every
 * secondary act lives in the ⋯ menu.
 *
 * ══ WHAT IT REPLACED ════════════════════════════════════════════════════════
 *
 *   app/offer-review.tsx      → redirects here (?offer=); OfferPanel
 *   app/trade-code.tsx        → redirects here (?id=&handoff=1); HandoffPanel
 *   app/trade-summary.tsx     → redirects here (?id=); DonePanel
 *   trades-waiting ?answer=   → redirects here (?id=); RequestPanel
 *   app/trade-meetup.tsx      stays: it is the hub picker this screen opens
 *   app/trades-waiting.tsx    stays: the full "Waiting on them" list
 *
 * ══ THE CODES ARE STILL ISSUED BY ARRIVING AT THEM ══════════════════════════
 *
 * Nothing here changes when codes are minted. The handoff panel calls
 * `confirm/start` on mount, as the code screen did on arrival, and it mounts
 * in exactly the cases that used to land on the code screen:
 *
 *   - CONFIRMING, or ACCEPTED with a hub that was already agreed when the
 *     screen opened (the card's "Show code"); an agreement made while it is
 *     open shows a "Show code" button rather than minting codes on the spot;
 *   - `handoff=1` — the old /trade-code deep link (a trade notification);
 *   - "Meet now and get codes" in the menu — the old Waiting card's tap, which
 *     opened the codes on an accepted trade with no hub agreed.
 *
 * An ACCEPTED trade without an agreed hub otherwise shows the hub step, and
 * opening it issues nothing.
 */
export default function TradeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; offer?: string; handoff?: string }>();
  const tradeId = params.id;
  const offerId = params.offer;

  const active = useActiveTrades();
  const history = useTradeHistory(!!tradeId);
  const { keyboardUp, imeHeight } = useKeyboardState();
  const entry = useCodeEntry();

  useTradeLiveness(active.refetch);

  const [menuOpen, setMenuOpen] = useState(false);
  const [forceHandoff, setForceHandoff] = useState(params.handoff === "1");
  const arrivedAgreed = useRef<boolean | null>(null);

  /* ── Resolve the row. The live list first, then history; and the last row
        seen is held across the instant a decision or a completion drops it
        from the list it was found in (offer-review and trade-code both did
        this, for the same reason). ── */
  const liveTrade =
    (tradeId
      ? (active.data?.trades.find((t) => t.id === tradeId) ??
        history.data?.trades.find((t) => t.id === tradeId))
      : null) ?? null;
  const liveOffer = (offerId ? active.data?.offers.find((o) => o.id === offerId) : null) ?? null;
  const [heldTrade, setHeldTrade] = useState<ActiveTrade | null>(null);
  const [heldOffer, setHeldOffer] = useState<LiveOffer | null>(null);
  useEffect(() => {
    if (liveTrade) setHeldTrade(liveTrade);
  }, [liveTrade]);
  useEffect(() => {
    if (liveOffer) setHeldOffer(liveOffer);
  }, [liveOffer]);

  const offerFlow = useOfferDecisionFlow(liveOffer ?? heldOffer);
  const decideTrade = useTradeDecision();
  const [requestFailure, setRequestFailure] = useState<string | null>(null);
  const withdraw = useWithdraw(() => router.back());

  const refreshing = active.isFetching || history.isFetching;
  const trade = liveTrade ?? (refreshing ? heldTrade : null);
  // An offer this screen decided stays on screen with its outcome.
  const offer = liveOffer ?? (offerFlow.decided || refreshing ? heldOffer : null);

  const apiError = active.error instanceof ApiError ? active.error : null;
  if (apiError?.code === "UNAUTHENTICATED") return <Splash waitingOn="Signing you back in" />;

  const goBack = () => router.back();

  if (!trade && !offer) {
    const loading = active.isPending || (!!tradeId && history.isPending);
    return (
      <OfferScreenHost imeInset={0}>
        <TradesBackTitle title="" onBack={goBack} />
        {loading ? (
          <TradesSkeleton />
        ) : active.isError ? (
          <TradesErrorPanel onRetry={() => void active.refetch()} />
        ) : (
          <Gutter style={{ paddingTop: 18 }}>
            <Text style={[textStyle(type.detailBody), { color: color.inkSecondary }]}>
              {offerId ? copy.tradeScreen.offerGone : copy.tradeScreen.tradeGone}
            </Text>
          </Gutter>
        )}
      </OfferScreenHost>
    );
  }

  const counterparty = (trade ?? offer)!.counterparty;
  const partner = present.firstName(counterparty.name);
  const sides = trade ? present.tradeSides(trade) : present.offerSides(offer!);
  const progress = trade ? present.tradeProgress(trade) : present.OFFER_PROGRESS;

  /*
   * An agreed plan opens on the codes only if it was ALREADY agreed when this
   * screen first saw the trade — the old card's "Show code" arrival. Agreeing
   * here, or the other person agreeing while this is open, shows a "Show code"
   * button instead, so agreeing to Saturday's meeting does not mint Saturday's
   * codes on Wednesday.
   */
  if (trade && arrivedAgreed.current === null) {
    arrivedAgreed.current = trade.status === "ACCEPTED" && meetupState(trade) === "agreed";
  }
  const agreedNow = !!trade && trade.status === "ACCEPTED" && meetupState(trade) === "agreed";
  const handoff =
    !!trade &&
    (trade.status === "CONFIRMING" ||
      (trade.status === "ACCEPTED" && ((agreedNow && arrivedAgreed.current) || forceHandoff)));

  const onTradeError = (e: unknown) => {
    const gated = premiumGateReason(e);
    if (gated) {
      openPremium(router, gated);
      return;
    }
    setRequestFailure(e instanceof ApiError ? e.message : "That did not go through. Nothing has changed.");
  };
  const decide = (status: "ACCEPTED" | "REJECTED") => {
    if (!trade) return;
    setRequestFailure(null);
    decideTrade.mutate({ tradeId: trade.id, status }, { onError: onTradeError });
  };

  /* ── The one panel. ── */
  let panel: React.ReactNode;
  if (offer && !trade) {
    panel =
      offer.direction === "received" ? (
        <OfferPanel
          offer={offer}
          flow={offerFlow}
          onOpenTrade={(id) => router.replace(present.tradeHref(id) as never)}
        />
      ) : (
        <WaitingPanel
          line={copy.tradeScreen.waitingOnOffer(partner)}
          detail={present.sentOfferWords(offer).title}
          links={
            <CardLink
              label={copy.tradeCard.withdrawOffer}
              tone="secondary"
              onPress={() => withdraw.offer(offer)}
              accessibilityLabel={`Withdraw your offer to ${partner}`}
            />
          }
        />
      );
  } else if (trade!.status === "PENDING") {
    panel =
      trade!.direction === "received" ? (
        <RequestPanel
          trade={trade!}
          failure={requestFailure}
          onAccept={() => decide("ACCEPTED")}
          onDecline={() => decide("REJECTED")}
        />
      ) : (
        <WaitingPanel
          line={copy.tradeScreen.waitingOnRequest(partner)}
          detail={present.swapLine(trade!)}
          links={
            <CardLink
              label={copy.tradeCard.withdraw}
              tone="secondary"
              onPress={() => withdraw.request(trade!)}
              accessibilityLabel={`Withdraw your swap request to ${partner}`}
            />
          }
        />
      );
  } else if (handoff) {
    panel = <HandoffPanel trade={trade!} partner={partner} entry={entry} keyboardUp={keyboardUp} />;
  } else if (agreedNow && trade!.meetup) {
    panel = (
      <WaitingPanel
        line={`${copy.meetup.agreed} · ${copy.meetup.where(trade!.meetup.hub.name, meetupWhen(new Date(trade!.meetup.at)))}`}
        detail={copy.tradeCard.showCodeAt(partner, trade!.meetup.hub.name)}
        links={
          <TradeButton
            label={copy.tradeCard.action.showCode}
            onPress={() => setForceHandoff(true)}
            style={{ flex: 1 }}
          />
        }
      />
    );
  } else if (trade!.status === "ACCEPTED") {
    panel = <HubStepPanel trade={trade!} />;
  } else {
    panel = <DonePanel trade={trade!} />;
  }

  /* ── The ⋯ menu: what is still the viewer's to do, and nothing else. ── */
  const live = !!trade && (trade.status === "ACCEPTED" || trade.status === "CONFIRMING");
  const rowIcon = (glyph: typeof SwapIcon, tint: string = color.inkSecondary) => {
    const Glyph = glyph;
    return <Glyph size={icon.menuRow.size} stroke={icon.menuRow.stroke} color={tint} />;
  };
  const close = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };
  const menuRows: React.ReactNode[] = [];
  if (trade?.status === "ACCEPTED" && !handoff) {
    menuRows.push(
      <SheetRow
        key="codes"
        glyph={rowIcon(SwapIcon)}
        label={copy.tradeScreen.getCodesNow}
        onPress={close(() => setForceHandoff(true))}
      />,
    );
  }
  if (trade?.status === "ACCEPTED" && trade.meetup) {
    menuRows.push(
      <SheetRow
        key="change"
        glyph={rowIcon(PencilIcon)}
        label={copy.tradeScreen.changePlace}
        onPress={close(() => router.push(`/trade-meetup?id=${encodeURIComponent(trade.id)}`))}
      />,
    );
  }
  if (live) {
    menuRows.push(
      <SheetRow
        key="wrong"
        glyph={rowIcon(WarningIcon)}
        label={copy.code.somethingWrong}
        onPress={close(() =>
          router.push(`/(app)/messages?partner=${encodeURIComponent(counterparty.id)}`),
        )}
      />,
    );
  }
  menuRows.push(
    <SheetRow
      key="message"
      glyph={rowIcon(MessageIcon)}
      label={copy.tradeScreen.message(partner)}
      onPress={close(() => router.push(`/(app)/messages?partner=${encodeURIComponent(counterparty.id)}`))}
    />,
    <SheetRow
      key="profile"
      glyph={rowIcon(PersonIcon)}
      label={copy.tradeScreen.viewProfile(partner)}
      onPress={close(() => router.push(`/user?id=${encodeURIComponent(counterparty.id)}`))}
    />,
  );
  if (offer && !trade && offer.direction === "sent") {
    menuRows.push(
      <SheetRow
        key="withdraw"
        glyph={rowIcon(CloseIcon, color.urgent)}
        label={copy.tradeCard.withdrawOffer}
        destructive
        onPress={close(() => withdraw.offer(offer))}
      />,
    );
  }
  if (trade?.status === "PENDING" && trade.direction === "sent") {
    menuRows.push(
      <SheetRow
        key="withdraw"
        glyph={rowIcon(CloseIcon, color.urgent)}
        label={copy.tradeCard.withdraw}
        destructive
        onPress={close(() => withdraw.request(trade))}
      />,
    );
  }

  const busy = offerFlow.busy || decideTrade.isPending || withdraw.busy;

  return (
    <OfferScreenHost imeInset={keyboardUp ? imeHeight : 0} dimmed={busy}>
      <TradesBackTitle
        title={copy.tradeScreen.title(partner)}
        onBack={goBack}
        trailing={
          keyboardUp ? (
            <NavDone onPress={() => entry.inputRef.current?.blur()} />
          ) : (
            <Tappable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={copy.tradeScreen.moreLabel}
              style={s.kebab}
              pressedStyle={{ opacity: 0.6 }}
            >
              <KebabIcon size={20} color={color.ink} />
            </Tappable>
          )
        }
      />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* The swap and the track. Under the keyboard both drop out as null in
            slots that stay, so the code field never changes index. */}
        {keyboardUp ? null : (
          <View style={s.head}>
            <SwapSplit give={sides.give} get={sides.get} style={s.split} />
            {progress ? <ProgressTrack {...progress} style={s.track} /> : null}
          </View>
        )}
        {keyboardUp ? null : <Hairline />}

        <Gutter style={{ paddingTop: keyboardUp ? space.home.tileBody : space.home.sectionTop - 4 }}>
          {panel}
        </Gutter>

        {/* The agreed plan, right under the code panel, so nobody reads a code
            out at the wrong car park. */}
        {handoff && trade?.meetup?.agreedAt && !keyboardUp ? (
          <Gutter style={{ paddingTop: space.home.tileBody }}>
            <Text style={[textStyle(type.metadata), { color: color.inkSecondary }]}>
              {copy.meetup.where(trade.meetup.hub.name, meetupWhen(new Date(trade.meetup.at)))}
            </Text>
          </Gutter>
        ) : null}
        {keyboardUp || !trade ? null : (
          <Gutter style={{ paddingTop: space.home.sectionTop }}>
            <FeeNote trade={trade} />
          </Gutter>
        )}

        {withdraw.failure ? (
          <Gutter style={{ paddingTop: space.home.tileBody }}>
            <Text style={[textStyle(type.detailBody), { color: color.urgent }]}>{withdraw.failure}</Text>
          </Gutter>
        ) : null}

        {/* A finished trade's way back to the person, as on the old summary. */}
        {trade && !live && trade.status !== "PENDING" && !keyboardUp ? (
          <Tappable
            onPress={() => router.push(`/user?id=${encodeURIComponent(counterparty.id)}`)}
            accessibilityRole="button"
            accessibilityLabel={copy.tradeScreen.viewProfile(partner)}
            style={s.profileRow}
            pressedStyle={{ backgroundColor: color.inset }}
          >
            <Text style={[textStyle(type.username), { color: color.ink, flex: 1 }]}>
              {copy.tradeScreen.viewProfile(partner)}
            </Text>
            <ChevronRightIcon size={icon.chevron.size} stroke={icon.chevron.stroke} color={color.inkMuted} />
          </Tappable>
        ) : null}

      </ScrollView>

      {menuOpen ? (
        <SheetShell title={copy.tradeScreen.title(partner)} onClose={() => setMenuOpen(false)}>
          <SheetRows>{menuRows}</SheetRows>
        </SheetShell>
      ) : null}

      {offerFlow.sheet}
    </OfferScreenHost>
  );
}

const s = StyleSheet.create({
  kebab: {
    width: size.control.kebab,
    height: size.control.kebab,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -size.control.kebabInset + 4,
  },
  head: { paddingHorizontal: space.screenX, paddingTop: 4, paddingBottom: space.home.sectionTop - 4 },
  split: {},
  track: { paddingHorizontal: 0 },
  profileRow: {
    marginTop: space.home.sectionTop,
    minHeight: size.control.social,
    paddingHorizontal: space.screenX,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: color.divider,
  },
});
