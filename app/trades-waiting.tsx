import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ApiError } from "../src/api/client";
import { openPremium, premiumGateReason } from "../src/lib/premium";
import {
  buildTradesModel,
  meetupState,
  useActiveTrades,
  useCancelTrade,
  useTradeDecision,
  useWithdrawFromTrades,
  type WaitingItem,
} from "../src/api/trades";
import type { ActiveTrade } from "../src/api/types";
import { showDialog } from "../src/components/dialog";
import { SectionHeader } from "../src/components/home-redesign/SectionHeader";
import { OfferScreenHost } from "../src/components/offer/chrome";
import { Gutter, TradesBackTitle } from "../src/components/trades/chrome";
import * as copy from "../src/components/trades/copy";
import * as present from "../src/components/trades/present";
import { SplitActions, Thumb } from "../src/components/trades/rows";
import { TradesErrorPanel } from "../src/components/trades/states";
import { CardLink, TradeCard } from "../src/components/trades/TradeCard";
import { useTradeLiveness } from "../src/lib/trade-liveness";
import { color, space, textStyle as baseTextStyle, type } from "../src/theme/tokens";
import { offerColor, offerSize, offerType, textStyle } from "../src/theme/offer-tokens";

/**
 * "Waiting on them", in full (1 Oct 2026 redesign).
 *
 * ══ THE SAME GROUPING AS THE TAB, OR THE TWO DISAGREE ═══════════════════════
 *
 * This screen used to draw its own blocks — offers to you, offers you sent,
 * every ACCEPTED trade — so the tab could say "Waiting on them · 1" over a
 * screen listing four. It now reads `buildTradesModel().waiting`, the exact
 * list the tab counts, and the two cannot drift: whatever is the viewer's move
 * is on the tab under "Your move", and only what is the other person's is here.
 *
 * ══ QUIET LINKS, NO GREEN BUTTONS ═══════════════════════════════════════════
 *
 * Nothing here is the viewer's to do, so nothing is a filled control. A card
 * says what the viewer did and whose move it is; under it, text links only:
 * "Change suggestion" where a suggestion is theirs to change, "Withdraw" where
 * they can still take back what they sent — behind a confirmation.
 *
 * THE CARD ITSELF STILL OPENS THE CODES on an accepted or confirming trade.
 * Plans fall through and people meet anyway; removing "Get codes" must not
 * remove the way to the code screen, which is how this screen once closed the
 * only loop to a completed trade.
 *
 * ══ `?answer=` ══════════════════════════════════════════════════════════════
 *
 * A PENDING swap request addressed to the viewer is on the tab under "Your
 * move", and its Review lands here with `?answer=<tradeId>`: that one request
 * is drawn above the list with the equal-weight Decline / Accept pair. It is
 * not part of the waiting list and is not counted in it.
 */
export default function TradesWaitingScreen() {
  const router = useRouter();
  const { answer } = useLocalSearchParams<{ answer?: string }>();
  const active = useActiveTrades();

  // Every card here is a plan or an offer the OTHER person can move. The push
  // channel invalidates the list on their move; this is the net under it.
  useTradeLiveness(active.refetch);

  const decideTrade = useTradeDecision();
  const cancelTrade = useCancelTrade();
  const withdraw = useWithdrawFromTrades();
  const [failure, setFailure] = useState<string | null>(null);

  const model = useMemo(
    () => buildTradesModel({ active: active.data, history: undefined }),
    [active.data],
  );
  const waiting = model.waiting;
  const needYou = model.needsToday.length;

  const toAnswer = answer
    ? ((active.data?.trades ?? []).find(
        (t) => t.id === answer && t.status === "PENDING" && t.direction === "received",
      ) ?? null)
    : null;

  const busy = withdraw.isPending || decideTrade.isPending || cancelTrade.isPending;

  const onError = (e: unknown) => {
    // An accept the bracket gate refused goes to the Premium screen — the one
    // paywall — rather than a failure line. Nothing changed.
    const gated = premiumGateReason(e);
    if (gated) {
      openPremium(router, gated);
      return;
    }
    setFailure(
      e instanceof ApiError ? e.message : "That did not go through. Nothing has changed.",
    );
  };

  const run = (fn: () => void) => {
    setFailure(null);
    fn();
  };

  const confirmWithdraw = (item: WaitingItem) => {
    if (item.kind === "sent-offer") {
      const offer = item.offer;
      const partner = present.firstName(offer.counterparty.name);
      const held = offer.bridgeFeePayer === "proposer" ? (offer.bridgeFeeLeaves ?? 0) : 0;
      showDialog(
        copy.tradeCard.withdrawOfferTitle(partner),
        held > 0
          ? copy.tradeCard.withdrawOfferHeld(held)
          : copy.tradeCard.withdrawOfferNothingHeld,
        [
          { text: copy.tradeCard.keep, style: "cancel" },
          {
            text: copy.tradeCard.withdraw,
            style: "destructive",
            onPress: () => run(() => withdraw.mutate(offer.id, { onError })),
          },
        ],
      );
      return;
    }
    const trade = item.trade;
    showDialog(
      copy.tradeCard.withdrawRequestTitle(present.firstName(trade.counterparty.name)),
      copy.tradeCard.withdrawRequestBody,
      [
        { text: copy.tradeCard.keep, style: "cancel" },
        {
          text: copy.tradeCard.withdraw,
          style: "destructive",
          onPress: () => run(() => cancelTrade.mutate(trade.id, { onError })),
        },
      ],
    );
  };

  return (
    <OfferScreenHost imeInset={0} dimmed={busy}>
      <TradesBackTitle title="" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <SectionHeader
          accent={copy.tradeCard.waitingOnThem}
          count={active.data ? waiting.length : undefined}
          subtitle={copy.tradeCard.waitingSubtitle}
          top={0}
        />

        {active.isError ? <TradesErrorPanel onRetry={() => void active.refetch()} /> : null}

        {failure ? <FailureLine>{failure}</FailureLine> : null}

        {toAnswer ? (
          <View style={s.answer}>
            <Gutter>
              <Text style={[baseTextStyle(type.sectionHeading), { color: color.inkSecondary }]}>
                {copy.tradeCard.requestFrom(present.firstName(toAnswer.counterparty.name))}
              </Text>
            </Gutter>
            <IncomingRequestBlock
              trade={toAnswer}
              onAccept={() =>
                run(() =>
                  decideTrade.mutate({ tradeId: toAnswer.id, status: "ACCEPTED" }, { onError }),
                )
              }
              onDecline={() =>
                run(() =>
                  decideTrade.mutate({ tradeId: toAnswer.id, status: "REJECTED" }, { onError }),
                )
              }
            />
          </View>
        ) : null}

        <View style={s.cards}>
          {waiting.map((item) => (
            <WaitingCard key={item.key} item={item} onWithdraw={() => confirmWithdraw(item)} />
          ))}
        </View>

        {waiting.length === 0 && active.data && !active.isError ? (
          <Gutter>
            <Text style={[baseTextStyle(type.emptyBody), { color: color.inkSecondary }]}>
              {copy.tradeCard.waitingEmpty}
            </Text>
          </Gutter>
        ) : null}

        {needYou > 0 ? (
          <Gutter style={s.needYou}>
            <Text style={[baseTextStyle(type.heroSubhead), { color: color.inkSecondary }]}>
              {copy.tradeCard.needYou(needYou)}{" "}
            </Text>
            <CardLink
              label={copy.tradeCard.goToYourMove}
              onPress={() => router.navigate("/(app)/trades")}
            />
          </Gutter>
        ) : null}
      </ScrollView>
    </OfferScreenHost>
  );
}

/**
 * One waiting trade as a card. The links under it are the only controls on
 * this screen, and each one is there only when its act is open today:
 *
 *   Change suggestion   an ACCEPTED trade whose standing hub suggestion is the
 *                       viewer's own and still unanswered.
 *   Withdraw offer      a PENDING offer the viewer sent. Sender only.
 *   Withdraw            a PENDING swap request the viewer sent (calls it off).
 *
 * A CONFIRMING trade has neither: the viewer's half is done and there is
 * nothing left to take back.
 */
function WaitingCard({ item, onWithdraw }: { item: WaitingItem; onWithdraw: () => void }) {
  const router = useRouter();
  const words = present.waitingScreenCard(item);
  const trade: ActiveTrade | null = item.kind === "trade" ? item.trade : null;

  const opensCodes = !!trade && (trade.status === "ACCEPTED" || trade.status === "CONFIRMING");
  const canChange = !!trade && trade.status === "ACCEPTED" && meetupState(trade) === "waiting-on-them";
  const canWithdraw = item.kind === "sent-offer" || trade?.status === "PENDING";

  return (
    <TradeCard
      words={words}
      onPress={
        trade && opensCodes
          ? () => router.push(`/trade-code?id=${encodeURIComponent(trade.id)}`)
          : undefined
      }
    >
      {trade && canChange ? (
        <CardLink
          label={copy.tradeCard.changeSuggestion}
          onPress={() => router.push(`/trade-meetup?id=${encodeURIComponent(trade.id)}`)}
          accessibilityLabel={`Change your suggestion to ${words.partner}`}
        />
      ) : null}
      {canWithdraw ? (
        <CardLink
          label={
            item.kind === "sent-offer" ? copy.tradeCard.withdrawOffer : copy.tradeCard.withdraw
          }
          tone="secondary"
          onPress={onWithdraw}
          accessibilityLabel={
            item.kind === "sent-offer"
              ? `Withdraw your offer to ${words.partner}`
              : `Withdraw your swap request to ${words.partner}`
          }
        />
      ) : null}
    </TradeCard>
  );
}

/**
 * One swap request addressed to the viewer.
 *
 * Structurally the same block as an incoming offer, and deliberately so: from
 * the reader's side "Renz wants to swap" is one kind of thing however the row
 * was created. What differs is underneath — PATCH /api/trades takes
 * `{ tradeId, status }` where the offer route takes `{ action }`, and its enum
 * says REJECTED where the offer's says DECLINED. Neither is renamed on the way
 * through; the wire is the wire.
 *
 * A trade request never carries a deferred agreement — POST /api/v1/contracts
 * attaches one to an ACCEPTED trade or to a PENDING offer, and a PENDING trade
 * is neither — so there is no record to read first and the decision pair is the
 * whole control.
 */
function IncomingRequestBlock({
  trade,
  onAccept,
  onDecline,
}: {
  trade: ActiveTrade;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const words = present.tradeRequestWords(trade);

  return (
    <Gutter style={{ paddingVertical: 14, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: offerSize.tradeRow.gap }}>
        <Thumb
          image={trade.offeredItem?.image ?? trade.requestedItem.image}
          size={offerSize.tradeRow.thumb}
        />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text
            style={[textStyle(offerType.itemTitleRow), { color: offerColor.ink }]}
            numberOfLines={2}
          >
            {words.title}
          </Text>
          <Text
            style={[textStyle(offerType.rowSubtitle), { color: offerColor.inkSecondary }]}
            numberOfLines={2}
          >
            {words.subtitle}
          </Text>
        </View>
        {words.trailing ? (
          <Text
            style={[
              textStyle(offerType.helper),
              { color: offerColor.inkTertiary, flexShrink: 0 },
            ]}
          >
            {words.trailing}
          </Text>
        ) : null}
      </View>

      <SplitActions
        onDecline={onDecline}
        onAccept={onAccept}
        declineLabel={copy.waiting.decline}
        acceptLabel={copy.waiting.accept}
      />
    </Gutter>
  );
}

/**
 * A failed accept, decline or withdrawal.
 *
 * The SERVER'S OWN SENTENCE, not a generic one. Every refusal on these routes
 * carries the numbers — "the sender now has only 260 Leaves available but this
 * offer requires 310" — and replacing that with "something went wrong" throws
 * away the only part the reader can act on.
 */
function FailureLine({ children }: { children: string }) {
  return (
    <Gutter style={{ paddingTop: 12 }}>
      <Text
        accessibilityLiveRegion="polite"
        style={[textStyle(offerType.errorText), { color: offerColor.warm }]}
      >
        {children}
      </Text>
    </Gutter>
  );
}

const s = StyleSheet.create({
  cards: { gap: 10 },
  answer: { gap: 4, marginBottom: space.home.headingToContent },
  needYou: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    paddingTop: space.home.sectionTop,
  },
});
