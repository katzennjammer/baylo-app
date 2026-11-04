import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import type { ActiveTrade, LiveOffer } from "../../api/types";
import { sizedImage } from "../../media/image-url";
import { color } from "../../theme/tokens";
import { offerHref, tradeHref } from "../trades/present";
import { Tappable } from "../Tappable";

/**
 * PINNED under the chat header: the live trade with this person, so it stays
 * in reach however long the chat gets (4 Nov 2026). The newest open thing
 * wins -- a trade in progress before a pending offer. Nothing open, nothing
 * drawn.
 */
export function PinnedTrade({
  partnerId,
  partnerName,
  trades,
  offers,
}: {
  partnerId: string;
  partnerName: string;
  trades: ActiveTrade[];
  offers: LiveOffer[];
}) {
  const router = useRouter();
  const first = partnerName.split(/\s+/)[0] || partnerName;
  const trade = trades.find((t) => t.counterparty.id === partnerId);
  const offer = trade ? undefined : offers.find((o) => o.counterparty.id === partnerId && o.status === "PENDING");
  if (!trade && !offer) return null;

  const give = trade ? (trade.direction === "sent" ? trade.offeredItem : trade.requestedItem) : offer!.direction === "sent" ? offer!.offeredItems[0] : offer!.post;
  const get = trade ? (trade.direction === "sent" ? trade.requestedItem : trade.offeredItem) : offer!.direction === "sent" ? offer!.post : offer!.offeredItems[0];
  const status = trade
    ? trade.status === "PENDING"
      ? trade.direction === "sent"
        ? `Your request · waiting for ${first}`
        : `${first} asked to trade`
      : "Trade on · arrange the meetup"
    : offer!.direction === "sent"
      ? `Your offer · waiting for ${first}`
      : `Offer from ${first} · your call`;
  const title = give && get ? `${give.title} for ${get.title}` : (get ?? give)?.title ?? "";
  const href = trade ? tradeHref(trade.id) : offerHref(offer!.id);

  return (
    <View style={s.bar}>
      <View style={s.thumb}>
        {get?.image ? <Image source={{ uri: sizedImage(get.image, "thumb") }} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.status} numberOfLines={1}>{status}</Text>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
      </View>
      <Tappable onPress={() => router.push(href as never)} accessibilityRole="button" accessibilityLabel={`View: ${status}`} style={s.view}>
        <Text style={s.viewText}>View</Text>
      </Tappable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: color.greenWash,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.greenLine,
  },
  thumb: { width: 40, height: 40, borderRadius: 10, overflow: "hidden", backgroundColor: color.control },
  status: { fontSize: 12, fontWeight: "700", color: color.forest },
  title: { fontSize: 14, fontWeight: "600", color: color.ink },
  view: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: color.searchSurface,
    borderWidth: 1,
    borderColor: color.greenLine,
    justifyContent: "center",
  },
  viewText: { fontSize: 13, fontWeight: "700", color: color.forest },
});
