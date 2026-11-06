import { Image } from "expo-image";
import { Text, View, StyleSheet } from "react-native";

import { sizedImage } from "../../media/image-url";

import type { ActiveTrade, LiveOffer } from "../../api/types";
import { Tappable } from "../Tappable";
import { ChevronRightIcon } from "../icons";
import { SwapSplit } from "../trades/TradeCard";
import * as copy from "../trades/copy";
import * as present from "../trades/present";
import type { CardSide } from "../trades/present";
import { StatusChip, TradeButton } from "../trades/trade-ui";
import { useOfferDecisionFlow } from "../trades/useOfferDecisionFlow";
import { grouped } from "../../lib/gap";
import { color, radius, size, space, textStyle, type } from "../../theme/tokens";
import { offerBorder } from "../../theme/offer-tokens";
import { FailurePopup } from "../FailurePopup";

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
 *
 * ── THE CHIP IS THE TRADE'S STATE NOW, NOT THE MESSAGE'S ────────────────────
 *
 * Since Oct 2026 the chip reads the trade itself when the thread holds it
 * (`trade`, from the active list and recent history the thread already
 * fetches — see `chatTradeFor()`): Accepted, Hub set, Handoff, Done, Declined,
 * Cancelled. Without it — a trade older than history's 50 — it falls back to
 * the status saved in the thread's `offer_update` rows, as before.
 *
 * Layout: chip on top, then who it is from, the "You give / You get" split,
 * and "Open trade" as its own full-width footer row.
 */
export function ChatOfferCard({
  mine,
  partnerName,
  status,
  live,
  fallback,
  message,
  tradeId,
  trade,
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
  /** That trade's current row, when the thread holds it. */
  trade?: ActiveTrade | null;
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
  const toTrade = flow.decided?.result.tradeId ?? tradeId ?? trade?.id ?? null;
  const sides = live ? present.offerSides(live) : fallback;
  // The trade's current state wins over the saved one, except right after a
  // decision on this card, which is newer than the cached trade list.
  const tradeChip = !flow.decided && trade ? present.chatTradeChip(trade) : null;

  const chip: { label: string; tone: "amber" | "green" | "grey" } = tradeChip
    ? tradeChip
    : effective === "PENDING"
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
  const settled = !!tradeChip || effective !== "PENDING";

  return (
    <View style={s.card}>
      <Tappable
        onPress={toTrade ? () => onOpenTrade(toTrade) : onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${mine ? copy.chatOffer.fromYou : copy.chatOffer.from(partner)}. ${chip.label}. Open`}
        pressedStyle={{ backgroundColor: color.inset }}
        style={s.body}
      >
        {/* A compact row (4 Nov 2026): who sent it, where it stands, and
            the note -- the full trade is one tap away. */}
        <View style={s.row}>
          <View style={s.stack}>
            <View style={[s.thumb, { left: 0 }]}>
              {sides.give.image ? <Image source={{ uri: sizedImage(sides.give.image, "thumb") }} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
            </View>
            <View style={[s.thumb, s.thumbFront]}>
              {sides.get.image ? <Image source={{ uri: sizedImage(sides.get.image, "thumb") }} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.title} numberOfLines={1}>
              {mine ? "You sent an offer" : `${partner} sent you an offer`}
            </Text>
            <Text style={s.sub} numberOfLines={2}>
              {message ? `“${message}”` : `${sides.give.title} for ${sides.get.title}`}
            </Text>
            <Text style={[s.state, chip.tone === "green" ? { color: color.forest } : chip.tone === "amber" ? { color: color.accentGold } : null]} numberOfLines={1}>
              {chip.label}
            </Text>
          </View>
        </View>
      </Tappable>

      {pendingDecision ? (
        <View style={s.footer}>
          {flow.receiverPays ? (
            <Text style={[textStyle(type.metadata), { color: color.inkSecondary }]}>
              {copy.waiting.youWouldPay(flow.fee)}
            </Text>
          ) : null}
          <FailurePopup message={flow.failure} title="Could not finish that" />
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
      ) : settled && toTrade ? (
        <Tappable
          onPress={() => onOpenTrade(toTrade)}
          accessibilityRole="button"
          accessibilityLabel={copy.chatOffer.openTrade}
          pressedStyle={{ backgroundColor: color.inset }}
          style={s.openRow}
        >
          <Text
            style={[textStyle(type.homeSeeAll), { color: color.forest, flex: 1 }]}
            maxFontSizeMultiplier={size.home.headingMaxFontScale}
          >
            {copy.chatOffer.openTrade}
          </Text>
          <ChevronRightIcon size={16} stroke={1.8} color={color.forest} />
        </Tappable>
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
    width: 280,
    maxWidth: "100%",
    borderRadius: 16,
    borderWidth: offerBorder.rule,
    borderColor: color.controlLine,
    backgroundColor: color.searchSurface,
    overflow: "hidden",
  },
  body: { padding: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  stack: { width: 52, height: 34 },
  thumb: { position: "absolute", width: 34, height: 34, borderRadius: 8, overflow: "hidden", backgroundColor: color.control },
  thumbFront: { left: 18, borderWidth: 2, borderColor: color.searchSurface },
  title: { fontSize: 13, fontWeight: "700", color: color.ink },
  sub: { fontSize: 12, color: color.inkSecondary },
  state: { marginTop: 2, fontSize: 11, fontWeight: "700", color: color.inkSecondary },
  footer: {
    gap: space.browse.searchGap,
    paddingHorizontal: space.home.tileBody,
    paddingVertical: space.home.tileBody - 2,
    borderTopWidth: offerBorder.rule,
    borderTopColor: color.divider,
  },
  pair: { flexDirection: "row", gap: space.browse.searchGap },
  openRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.browse.searchGap,
    minHeight: 44,
    paddingHorizontal: space.home.tileBody,
    borderTopWidth: offerBorder.rule,
    borderTopColor: color.divider,
  },
});
