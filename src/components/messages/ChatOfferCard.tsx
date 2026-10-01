import { Text, View, StyleSheet } from "react-native";

import type { LiveOffer } from "../../api/types";
import { Tappable } from "../Tappable";
import { SwapSplit, CardLink } from "../trades/TradeCard";
import * as copy from "../trades/copy";
import * as present from "../trades/present";
import type { CardSide } from "../trades/present";
import { StatusChip, TradeButton } from "../trades/trade-ui";
import { useOfferDecisionFlow } from "../trades/useOfferDecisionFlow";
import { grouped } from "../../lib/gap";
import { color, radius, space, textStyle, type } from "../../theme/tokens";
import { offerBorder } from "../../theme/offer-tokens";

/**
 * A trade offer in a chat thread, in the Trades tab's design (Round 2).
 *
 *   Trade offer from Aj                         [Your move]
 *   You give  [photo] Vans    ┆⇄┆  You get  [photo] Air Max
 *   [ Decline ]  [ Accept ]                     (receiver, pending)
 *
 * THE DECISION IS `useOfferDecisionFlow()` — the hook the trade screen's
 * offer panel uses. Same PATCH, same consent sheet for a receiver-pays bridge,
 * same Premium gate, same server sentence on a refusal. The buttons only show
 * while the offer is still in the viewer's live list (`live`): that list is
 * what says it is pending and addressed to whoever the viewer is acting as.
 *
 * Once answered, the card says how and links to the trade.
 */
export function ChatOfferCard({
  mine,
  partnerName,
  status,
  live,
  fallback,
  message,
  tradeId,
  onOpen,
  onOpenTrade,
}: {
  mine: boolean;
  /** The other person in the thread. */
  partnerName: string;
  /** PENDING / ACCEPTED / DECLINED / …, from the newest offer_update. */
  status: string;
  /** The offer as the Trades list has it; present only while it is pending. */
  live: LiveOffer | undefined;
  /** Sides drawn from the message payload, when the offer is not live. */
  fallback: { give: CardSide; get: CardSide };
  message: string | null;
  /** The trade an accepted offer became, when the thread knows it. */
  tradeId: string | null;
  onOpen: () => void;
  onOpenTrade: (tradeId: string) => void;
}) {
  const partner = present.firstName(partnerName);
  const canDecide = !mine && status === "PENDING" && !!live && live.direction === "received";
  const flow = useOfferDecisionFlow(canDecide ? live! : null);

  const effective = flow.decided
    ? flow.decided.action === "accept"
      ? "ACCEPTED"
      : "DECLINED"
    : status.toUpperCase();
  const toTrade = flow.decided?.result.tradeId ?? tradeId;
  const sides = live ? present.offerSides(live) : fallback;

  const chip: { label: string; tone: "amber" | "green" | "grey" } =
    effective === "PENDING"
      ? mine
        ? { label: copy.chatOffer.waitingFor(partner), tone: "grey" }
        : canDecide
          ? { label: copy.chatOffer.yourMove, tone: "amber" }
          : // Pending on the message but gone from the live list: it expired or
            // was withdrawn without an update row. Not "your move".
            { label: sentenceCase(effective), tone: "grey" }
      : effective === "ACCEPTED"
        ? { label: copy.chatOffer.accepted, tone: "green" }
        : effective === "DECLINED"
          ? { label: copy.chatOffer.declined, tone: "grey" }
          : { label: sentenceCase(effective), tone: "grey" };

  const pendingDecision = canDecide && !flow.decided;

  return (
    <View style={s.card}>
      <Tappable
        onPress={toTrade ? () => onOpenTrade(toTrade) : onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${mine ? copy.chatOffer.fromYou : copy.chatOffer.from(partner)}. ${chip.label}. Open`}
        pressedStyle={{ backgroundColor: color.inset }}
        style={s.body}
      >
        <View style={s.top}>
          <Text style={[textStyle(type.username), { color: color.ink, flex: 1 }]} numberOfLines={2}>
            {mine ? copy.chatOffer.fromYou : copy.chatOffer.from(partner)}
          </Text>
          <StatusChip label={chip.label} tone={chip.tone} />
        </View>
        <SwapSplit give={sides.give} get={sides.get} style={{ marginTop: space.home.tileBody }} />
        {message ? (
          <Text
            style={[textStyle(type.metadata), { color: color.inkSecondary, marginTop: space.browse.searchGap }]}
            numberOfLines={3}
          >
            {message}
          </Text>
        ) : null}
      </Tappable>

      {pendingDecision ? (
        <View style={s.footer}>
          {flow.receiverPays ? (
            <Text style={[textStyle(type.metadata), { color: color.inkSecondary }]}>
              {copy.waiting.youWouldPay(flow.fee)}
            </Text>
          ) : null}
          {flow.failure ? (
            <Text accessibilityLiveRegion="polite" style={[textStyle(type.metadata), { color: color.urgent }]}>
              {flow.failure}
            </Text>
          ) : null}
          <View style={s.pair}>
            <TradeButton
              label={copy.waiting.decline}
              tone="quiet"
              onPress={flow.decline}
              disabled={flow.busy}
              style={{ flex: 1 }}
            />
            <TradeButton
              label={flow.receiverPays ? `${copy.waiting.accept} · ${grouped(flow.fee)}` : copy.waiting.accept}
              onPress={flow.accept}
              disabled={flow.busy}
              accessibilityLabel={
                flow.receiverPays
                  ? `Accept, with a ${grouped(flow.fee)}-Leaf bridging fee`
                  : `Accept ${partner}'s offer`
              }
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : effective !== "PENDING" && toTrade ? (
        <View style={[s.footer, { alignItems: "flex-start" }]}>
          <CardLink label={copy.chatOffer.openTrade} onPress={() => onOpenTrade(toTrade)} />
        </View>
      ) : null}

      {flow.sheet}
    </View>
  );
}

function sentenceCase(raw: string): string {
  const lower = raw.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const s = StyleSheet.create({
  card: {
    borderRadius: radius.hubRow,
    borderWidth: offerBorder.rule,
    borderColor: color.controlLine,
    backgroundColor: color.surface,
    overflow: "hidden",
  },
  body: { padding: space.home.tileBody },
  top: { flexDirection: "row", alignItems: "flex-start", gap: space.browse.searchGap },
  footer: {
    gap: space.browse.searchGap,
    paddingHorizontal: space.home.tileBody,
    paddingVertical: space.home.tileBody - 2,
    borderTopWidth: offerBorder.rule,
    borderTopColor: color.divider,
  },
  pair: { flexDirection: "row", gap: space.browse.searchGap },
});
