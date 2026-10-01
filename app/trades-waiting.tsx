import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  buildTradesModel,
  meetupState,
  useActiveTrades,
  type WaitingItem,
} from "../src/api/trades";
import type { ActiveTrade } from "../src/api/types";
import { SectionHeader } from "../src/components/home-redesign/SectionHeader";
import { OfferScreenHost } from "../src/components/offer/chrome";
import { Gutter, TradesBackTitle } from "../src/components/trades/chrome";
import * as copy from "../src/components/trades/copy";
import * as present from "../src/components/trades/present";
import { TradesErrorPanel } from "../src/components/trades/states";
import { CardLink, TradeCard } from "../src/components/trades/TradeCard";
import { useWithdraw } from "../src/components/trades/useWithdraw";
import { useTradeLiveness } from "../src/lib/trade-liveness";
import { color, space, textStyle as baseTextStyle, type } from "../src/theme/tokens";
import { offerColor, offerType, textStyle } from "../src/theme/offer-tokens";

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
 * EVERY CARD OPENS THE TRADE SCREEN (`app/trade.tsx`, Round 2). The codes
 * are reached from there — on an accepted trade with no hub agreed, through
 * "Meet now and get codes" in its menu — so the loop to a completed trade is
 * still one screen away.
 *
 * ══ `?answer=` ══════════════════════════════════════════════════════════════
 *
 * The old link for a swap request addressed to the viewer. It redirects to
 * that request's trade screen, where the Decline / Accept pair now lives.
 */
export default function TradesWaitingScreen() {
  const router = useRouter();
  const { answer } = useLocalSearchParams<{ answer?: string }>();
  const active = useActiveTrades();

  // Every card here is a plan or an offer the OTHER person can move. The push
  // channel invalidates the list on their move; this is the net under it.
  useTradeLiveness(active.refetch);

  const withdraw = useWithdraw();

  const model = useMemo(
    () => buildTradesModel({ active: active.data, history: undefined }),
    [active.data],
  );
  const waiting = model.waiting;
  const needYou = model.needsToday.length;

  // The old `?answer=<tradeId>` link: the request is answered on its own
  // trade screen now.
  if (answer) return <Redirect href={`/trade?id=${encodeURIComponent(answer)}`} />;

  return (
    <OfferScreenHost imeInset={0} dimmed={withdraw.busy}>
      <TradesBackTitle title="" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <SectionHeader
          accent={copy.tradeCard.waitingOnThem}
          count={active.data ? waiting.length : undefined}
          subtitle={copy.tradeCard.waitingSubtitle}
          top={0}
        />

        {active.isError ? <TradesErrorPanel onRetry={() => void active.refetch()} /> : null}

        {withdraw.failure ? <FailureLine>{withdraw.failure}</FailureLine> : null}

        <View style={s.cards}>
          {waiting.map((item) => (
            <WaitingCard
              key={item.key}
              item={item}
              onWithdraw={() =>
                item.kind === "sent-offer" ? withdraw.offer(item.offer) : withdraw.request(item.trade)
              }
            />
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
 * One waiting trade as a card. The card opens the trade screen; the links
 * under it are the acts still open today:
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

  const canChange = !!trade && trade.status === "ACCEPTED" && meetupState(trade) === "waiting-on-them";
  const canWithdraw = item.kind === "sent-offer" || trade?.status === "PENDING";

  return (
    <TradeCard words={words}>
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
  needYou: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    paddingTop: space.home.sectionTop,
  },
});
