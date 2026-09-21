import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { useTradeHistory } from "../src/api/trades";
import { Splash } from "../src/components/Splash";
import { Hairline, OfferScreenHost } from "../src/components/offer/chrome";
import { RowAction, Thumb } from "../src/components/trades/rows";
import { TradesBackTitle } from "../src/components/trades/chrome";
import { TradesErrorPanel, TradesSkeleton } from "../src/components/trades/states";
import { clockTime } from "../src/lib/format";
import { bracketLabel, bracketOf } from "../src/lib/brackets";
import { shortDate } from "../src/lib/gap";
import { offerColor, offerSize, offerSpace, offerType, textStyle } from "../src/theme/offer-tokens";
import { Tappable } from "../src/components/Tappable";
import type { ActiveTrade, TradeItemBrief } from "../src/api/types";

export default function TradeSummaryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const history = useTradeHistory();
  const trade = history.data?.trades.find((row) => row.id === id) ?? null;

  if (history.isPending) return <OfferScreenHost imeInset={0}><TradesSkeleton /></OfferScreenHost>;
  if (history.isError) return <OfferScreenHost imeInset={0}><TradesBackTitle title="Trade summary" onBack={() => router.back()} /><TradesErrorPanel onRetry={() => void history.refetch()} /></OfferScreenHost>;
  if (!trade) return <OfferScreenHost imeInset={0}><TradesBackTitle title="Trade summary" onBack={() => router.back()} /><Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary, padding: offerSpace.screenX }]}>This trade is no longer available.</Text></OfferScreenHost>;

  return <OfferScreenHost imeInset={0}>
    <TradesBackTitle title="Trade summary" onBack={() => router.back()} />
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <TradePhotos trade={trade} />
      <View style={{ paddingHorizontal: offerSpace.screenX, gap: 16 }}>
        <Tappable onPress={() => router.push(`/user?id=${encodeURIComponent(trade.counterparty.id)}`)} accessibilityRole="button" accessibilityLabel={`View ${trade.counterparty.name}'s profile`} style={{ paddingVertical: 8 }} pressedStyle={{ opacity: 0.65 }}>
          <Text style={[textStyle(offerType.itemTitleRow), { color: offerColor.ink }]}>{trade.counterparty.name}</Text>
          <Text style={[textStyle(offerType.helper), { color: offerColor.inkSecondary, marginTop: 3 }]}>View profile</Text>
        </Tappable>
        <Hairline />
        <Detail label="Date" value={shortDate(new Date(trade.updatedAt))} />
        <Detail label="Meetup hub" value={trade.safeZoneHub?.name ?? "No hub recorded"} />
        <Detail label="Time codes matched" value={trade.codesMatchedAt ? clockTime(Date.parse(trade.codesMatchedAt)) : "Not recorded"} />
        <Detail label="Bridging fee paid" value={feeText(trade)} />
        <Detail label="Leaves reward earned" value={trade.rewardLeaves === null ? "None" : `+${trade.rewardLeaves} Leaves`} />
        <Detail label="Rating I gave" value={trade.myReview ? `${trade.myReview.rating}/5` : "Not rated yet"} />
        <Detail label="Rating I received" value={trade.receivedReview ? `${trade.receivedReview.rating}/5` : "Not rated yet"} />
        {trade.status === "COMPLETED" && !trade.myReview ? <RowAction label={`Rate ${trade.counterparty.name}`} onPress={() => router.push(`/rate-trade?id=${encodeURIComponent(trade.id)}`)} tone="affirm" /> : null}
        <RowAction label="Message" onPress={() => router.push(`/messages?partner=${encodeURIComponent(trade.counterparty.id)}`)} tone="quiet" />
      </View>
    </ScrollView>
  </OfferScreenHost>;
}

function TradePhotos({ trade }: { trade: ActiveTrade }) {
  return <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: offerSpace.screenX, paddingVertical: 20 }}>
    <Photo item={trade.offeredItem} fallback="Leaves" />
    <Text style={[textStyle(offerType.screenHeading), { color: offerColor.green }]}>↔</Text>
    <Photo item={trade.requestedItem} fallback="Item" />
  </View>;
}

function Photo({ item, fallback }: { item: TradeItemBrief | null; fallback: string }) {
  const bracket = item?.valueLeaves === null || item?.valueLeaves === undefined ? null : bracketLabel(bracketOf(item.valueLeaves));
  return <View style={{ alignItems: "center", width: offerSize.tradeRow.thumb + 26, gap: 6 }}>
    <Thumb image={item?.image ?? null} size={offerSize.tradeRow.thumb} />
    <Text style={[textStyle(offerType.helper), { color: offerColor.inkSecondary, textAlign: "center" }]} numberOfLines={2}>{item?.title ?? fallback}</Text>
    <Text style={[textStyle(offerType.deadline), { color: offerColor.inkTertiary }]}>{bracket ?? ""}</Text>
  </View>;
}

function feeText(trade: ActiveTrade): string {
  const fee = trade.bridgeFeeLeaves ?? 0;
  if (fee <= 0 || trade.bridgeFeePaidBySender === null || trade.bridgeFeePaidBySender === undefined) return "None";
  const viewerPaid = trade.bridgeFeePaidBySender === (trade.direction === "sent");
  return viewerPaid ? `${fee} Leaves paid` : `${fee} Leaves received`;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 16 }}><Text style={[textStyle(offerType.helper), { color: offerColor.inkTertiary }]}>{label}</Text><Text style={[textStyle(offerType.rowSubtitle), { color: offerColor.ink, textAlign: "right", flexShrink: 1 }]}>{value}</Text></View>;
}
