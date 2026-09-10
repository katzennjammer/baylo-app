import { useRouter } from "expo-router";
import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";

import { useContracts, useTradeHistory } from "../src/api/trades";
import type { V1Contract } from "../src/api/types";
import { Hairline, OfferScreenHost } from "../src/components/offer/chrome";
import {
  BlockHeader,
  Gutter,
  NavMono,
  TradesBackTitle,
} from "../src/components/trades/chrome";
import * as copy from "../src/components/trades/copy";
import * as present from "../src/components/trades/present";
import { HistoryRow } from "../src/components/trades/rows";
import { TradesErrorPanel, TradesSkeleton } from "../src/components/trades/states";
import { clockTime } from "../src/lib/format";
import { shortDate } from "../src/lib/gap";
import { offerColor, offerType, textStyle } from "../src/theme/offer-tokens";

/**
 * Frame 9d — History, expanded. Deliberately dull, and grouped by month.
 *
 * ══ THREE ENDINGS, THREE SENTENCES, NEVER COLLAPSED ═════════════════════════
 *
 * A trade can end three ways and each was performed by a different party:
 *
 *   COMPLETED   the codes matched. `Traded with Ivy R.`
 *   REJECTED    they said no.      `Marco declined the trade`
 *   CANCELLED   it was called off. `The trade was called off`
 *
 * The same distinction exists one level up, on OFFERS — DECLINED is the receiver
 * refusing, WITHDRAWN is the sender changing their mind, EXPIRED is nobody doing
 * anything — and they are three different facts about three different people.
 * Frame 9d draws all three.
 *
 * ══ AND THOSE THREE ARE NOT ON THE WIRE ═════════════════════════════════════
 *
 * `offers` on /api/v1/trades filters `status: "PENDING"`, and `tab=history` pages
 * `TradeRequest` rows rather than `Offer` rows. So a declined, withdrawn or
 * expired offer appears on no endpoint this client can call.
 *
 * Rather than fold them into something they are not — "declined" is not
 * "expired", and saying so would be the exact error §6's own framing warns
 * against — this screen renders the finished TRADES it can see and states, in
 * one line under them, what is not in the list. See gap 4 in `src/api/trades.ts`.
 *
 * ══ NO ACCENT COLOUR SURVIVES HERE EXCEPT A DEFAULT ═════════════════════════
 *
 * §1.7's closing line: "Fulfilled agreements lose all accent colour. Nothing
 * congratulates." A completed trade is `#14140F` on paper with a `#5C5B52` mono
 * under it and nothing else. The single exception is a defaulted promise, which
 * keeps its `#F5F4EE` fill and 3px terracotta rule because a default is a
 * permanent part of a record rather than a passing state.
 */
export default function TradesHistoryScreen() {
  const router = useRouter();
  const history = useTradeHistory();
  const contracts = useContracts();

  const trades = history.data?.trades ?? [];
  const months = useMemo(() => present.groupByMonth(trades), [trades]);

  // Settled and defaulted promises belong in a record of finished things. They
  // are keyed by their own end date rather than by a trade's, so they are shown
  // as their own block rather than interleaved into the months — interleaving
  // would need a merge on two different timestamps and would put a promise
  // settled in October above a trade completed in September.
  const finishedPromises = (contracts.data?.contracts ?? []).filter(
    (c) => c.status === "FULFILLED" || c.status === "DEFAULTED",
  );

  const count = copy.history.count(trades.length, trades.length >= 50);

  if (history.isPending && !history.data) {
    return (
      <OfferScreenHost imeInset={0}>
        <TradesBackTitle title={copy.nav.history} onBack={() => router.back()} />
        <TradesSkeleton />
      </OfferScreenHost>
    );
  }

  return (
    <OfferScreenHost imeInset={0}>
      <TradesBackTitle
        title={copy.nav.history}
        onBack={() => router.back()}
        trailing={history.data ? <NavMono>{count}</NavMono> : undefined}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {history.isError ? (
          <TradesErrorPanel
            heading="Can't load your finished trades"
            onRetry={() => void history.refetch()}
          />
        ) : null}

        {months.map((month) => (
          <View key={month.label}>
            <BlockHeader label={month.label} top={12} />
            <Hairline />
            {month.rows.map((trade) => {
              const words = present.historyWords(trade, clockTime);
              return (
                <View key={trade.id}>
                  <HistoryRow title={words.title} meta={words.meta} tone={words.tone} />
                  <Hairline />
                </View>
              );
            })}
          </View>
        ))}

        {finishedPromises.length > 0 ? (
          <View>
            <BlockHeader label={copy.label.youPromised} top={18} />
            <Hairline />
            {finishedPromises.map((contract) => (
              <View key={contract.id}>
                <FinishedPromiseRow contract={contract} />
                <Hairline />
              </View>
            ))}
          </View>
        ) : null}

        {trades.length === 0 && finishedPromises.length === 0 && !history.isError ? (
          <Gutter style={{ paddingTop: 18 }}>
            <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
              {copy.empty.body}
            </Text>
          </Gutter>
        ) : null}

        {/*
          What this list does NOT contain, said plainly.

          Not an apology and not an error. Somebody looking for the offer they
          withdrew last Tuesday will not find it here, and a screen that lets them
          keep scrolling for it is worse than one that tells them.
        */}
        <Gutter style={{ paddingTop: 14, paddingBottom: 30 }}>
          <Text style={[textStyle(offerType.helper), { color: offerColor.inkTertiary }]}>
            {copy.history.offersNote}
          </Text>
        </Gutter>
      </ScrollView>
    </OfferScreenHost>
  );
}

/**
 * A promise that has ended. §1.7's `Fulfilled` and `Defaulted` rows.
 *
 * A FULFILLED contract that defaulted along the way still reads as defaulted
 * here, and that is the point of `defaulted` being reported separately from
 * `status`: the debt is settled, the trading restriction is lifted, and the fact
 * that it lapsed is permanent. §10.4's `1, settled late` is the same pair of
 * facts one screen over.
 */
function FinishedPromiseRow({ contract }: { contract: V1Contract }) {
  const words = present.promiseWords(contract);
  const lateButPaid = contract.status === "FULFILLED" && contract.defaulted;

  return (
    <HistoryRow
      title={words.title}
      meta={
        lateButPaid && contract.fulfilledAt
          ? `${copy.promise.settled(new Date(contract.fulfilledAt))} · ${shortDate(
              new Date(contract.deadline),
            )} deadline missed`
          : (words.subtitle ?? "")
      }
      tone={contract.status === "DEFAULTED" || lateButPaid ? "default" : "quiet"}
    />
  );
}
