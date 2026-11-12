import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

import { buildTradesModel, useActiveTrades } from "../src/api/trades";
import { SectionHeader } from "../src/components/home-redesign/SectionHeader";
import { OfferScreenHost } from "../src/components/offer/chrome";
import { Gutter, TradesBackTitle } from "../src/components/trades/chrome";
import * as copy from "../src/components/trades/copy";
import { TradesErrorPanel } from "../src/components/trades/states";
import { CardLink } from "../src/components/trades/TradeCard";
import { WaitingList } from "../src/components/trades/WaitingContent";
import { useWithdraw } from "../src/components/trades/useWithdraw";
import { useTradeLiveness } from "../src/lib/trade-liveness";
import { color, space, textStyle as baseTextStyle, type } from "../src/theme/tokens";

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

        <WaitingList
          waiting={waiting}
          withdraw={withdraw}
          loaded={!!active.data && !active.isError}
        />

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

const s = StyleSheet.create({
  needYou: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    paddingTop: space.home.sectionTop,
  },
});
