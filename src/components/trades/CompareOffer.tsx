import { useEffect } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { OfferDecided } from "../../api/trades";
import type { LiveOffer } from "../../api/types";
import { bracketOf } from "../../lib/brackets";
import { color, font, space } from "../../theme/tokens";
import { showDialog } from "../dialog";
import { ChevronLeftIcon, ChevronRightIcon, LeafIcon, MessageIcon, SwapIcon } from "../icons";
import { MascotEmptyState } from "../MascotEmptyState";
import { Tappable } from "../Tappable";
import { Face, firstName, offerRelation } from "./listing-ui";
import { RatingLine, TierChip } from "../profile/PersonHeader";
import { BracketChip } from "../BracketChip";
import { Thumb } from "./rows";
import { FailurePopup } from "../FailurePopup";
import { PremiumName } from "../PremiumName";

/**
 * The received-offer view of /trade (Nov 2026): one offer, compared side by
 * side with the listing it is for, and decided.
 *
 *   You give | You get        two equal photos, the trade icon between
 *   the bracket ladder        1 to 10, yours and theirs marked, then one
 *                             sentence on the bridging fee: who, how much, when
 *   the trader                name, tier, rating, message, chat
 *   Decline | Accept          Accept names the fee when you would pay it
 *
 * The decision itself is `useOfferDecisionFlow()`, unchanged: the consent sheet
 * when the viewer pays a bridging fee, the Premium gate, the error sentence.
 * What this adds is a confirmation for the free case too, because accepting
 * declines every other offer on the item, and that is worth one tap to agree to.
 */

export interface DecisionFlow {
  accept: () => void;
  decline: () => void;
  busy: boolean;
  decided: { action: "accept" | "decline"; result: OfferDecided } | null;
  failure: string | null;
  /** The item in the offer has gone; only Decline is left. */
  unavailable?: boolean;
  receiverPays: boolean;
  fee: number;
}

const BRACKETS = 10;

export function CompareOffer({
  offer,
  flow,
  position,
  others,
  onBack,
  onNext,
  onChat,
  onOpenTrade,
}: {
  offer: LiveOffer;
  flow: DecisionFlow;
  /** "Offer 4 of 7" when opened from the inbox; null when opened on its own. */
  position: { index: number; total: number } | null;
  /** Other pending offers on the same item, which accepting declines. */
  others: number;
  onBack: () => void;
  onNext: (() => void) | null;
  onChat: () => void;
  onOpenTrade: (tradeId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const partner = firstName(offer.counterparty.name);
  const theirs = offer.offeredItems[0];
  const mine = offer.post;
  const myValue = mine.valueLeaves ?? null;
  const theirValue = theirs?.valueLeaves ?? null;
  const myBracket = offer.targetBracket ?? (myValue != null ? bracketOf(myValue) : null);
  const theirBracket = offer.offeredBracket ?? (theirValue != null ? bracketOf(theirValue) : null);
  const rel = offerRelation(offer);

  // A decline goes straight back to the list: there is nothing left to look at.
  useEffect(() => {
    if (flow.decided?.action === "decline") onBack();
  }, [flow.decided, onBack]);

  const confirmAccept = () => {
    if (flow.receiverPays) {
      // The bridging-fee consent sheet is the confirmation in this case.
      flow.accept();
      return;
    }
    const lines = [
      "Both items are held for this trade until you meet.",
      rel.kind === "below" && rel.fee
        ? `${partner}'s ${rel.fee}-Leaf bridging fee comes to you when the trade is done.`
        : "No bridging fee: both items are in the same bracket.",
      others > 0
        ? `The other ${others} offer${others === 1 ? " is" : "s are"} declined, and those traders are told.`
        : null,
    ].filter(Boolean);
    showDialog(
      `Trade your ${mine.title} for ${partner}'s ${theirs?.title ?? "item"}?`,
      lines.join("\n\n"),
      [
        { text: "Not yet", style: "cancel" },
        { text: "Accept trade", onPress: flow.accept },
      ],
      { pose: "box" },
    );
  };

  if (flow.decided?.action === "accept") {
    const tradeId = flow.decided.result.tradeId;
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <Header title="Trade accepted" subtitle={mine.title} onBack={onBack} />
        <ScrollView contentContainerStyle={{ padding: space.screenX, paddingTop: 32 }}>
          <MascotEmptyState
            pose="celebrate"
            title={`You're trading with ${partner}`}
            message={`Your ${mine.title} for their ${theirs?.title ?? "item"}. Next: pick a Safe-Zone Hub and a time, meet and check the item, then enter each other's codes.`}
            action={tradeId ? { label: "Pick a hub and time", onPress: () => onOpenTrade(tradeId) } : undefined}
          />
        </ScrollView>
      </View>
    );
  }

  const title = `${partner}'s offer`;
  const subtitle = position ? `Offer ${position.index + 1} of ${position.total} · ${mine.title}` : mine.title;

  const feeLine =
    rel.kind === "same"
      ? `Both items are in Bracket ${myBracket ?? "?"}, so neither of you pays anything.`
      : rel.kind === "below"
        ? `${partner} moves up a bracket, so ${partner} pays the ${rel.fee ?? ""}-Leaf bridging fee. It's already held, and it comes to you when the trade is done.`
        : `You move up a bracket, so you pay a ${rel.fee ?? ""}-Leaf bridging fee when you accept. It goes to ${partner} when the trade is done.`;
  const headline =
    rel.kind === "same" ? "Same bracket" : rel.kind === "below" ? "One bracket below yours" : "One bracket above yours";

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <Header
        title={title}
        subtitle={subtitle}
        onBack={onBack}
        trailing={
          onNext ? (
            <Tappable
              onPress={onNext}
              accessibilityRole="button"
              accessibilityLabel={position ? `Next offer, ${((position.index + 1) % position.total) + 1} of ${position.total}` : "Next offer"}
              style={s.next}
            >
              <Text style={{ fontFamily: font.sansSemi, fontSize: 13, color: color.ink }}>Next offer</Text>
              <ChevronRightIcon size={18} stroke={2} color={color.ink} />
            </Tappable>
          ) : null
        }
      />

      <ScrollView contentContainerStyle={s.body}>
        {/* The trade, as two equal tickets. */}
        <View style={s.tickets}>
          <Ticket label="YOU GIVE" title={mine.title} image={mine.image ?? null} bracket={myBracket} />
          <Ticket label="YOU GET" title={theirs?.title ?? "An item"} image={theirs?.image ?? null} bracket={theirBracket} highlight />
          <View style={s.disc} pointerEvents="none" importantForAccessibility="no-hide-descendants">
            <SwapIcon size={16} stroke={2.2} color={color.surface} />
          </View>
        </View>

        {/* The bracket rule, drawn. */}
        <View style={s.box}>
          <Text style={s.boxTitle}>{headline}</Text>
          <View
            style={s.ladder}
            accessible
            accessibilityLabel={
              myBracket && theirBracket
                ? myBracket === theirBracket
                  ? `Both items in Bracket ${myBracket}`
                  : `Your item Bracket ${myBracket}, theirs Bracket ${theirBracket}`
                : "Brackets not known"
            }
          >
            {Array.from({ length: BRACKETS }, (_, i) => {
              const n = i + 1;
              const isMine = n === myBracket;
              const isTheirs = n === theirBracket;
              return (
                <View key={n} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                  <View
                    style={[
                      s.rung,
                      isMine || isTheirs ? { height: 26 } : null,
                      { backgroundColor: isMine ? color.ink : isTheirs ? color.green : "#ECEAE2" },
                    ]}
                  >
                    {isMine && isTheirs ? <View style={s.rungHalf} /> : null}
                  </View>
                  <Text style={[s.rungNum, isMine || isTheirs ? { fontFamily: font.sansBold, color: color.ink } : null]}>{n}</Text>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: "row", gap: 14 }}>
            <Legend swatch={color.ink} label={`Yours · Bracket ${myBracket ?? "?"}`} />
            <Legend swatch={color.green} label={`Theirs · Bracket ${theirBracket ?? "?"}`} />
          </View>
          <View style={[s.fee, rel.kind === "above" ? s.feeWarm : null]}>
            <LeafIcon size={18} stroke={2} color={rel.kind === "above" ? "#7A3F0E" : color.inkSecondary} />
            <Text style={[s.feeText, rel.kind === "above" ? { color: "#7A3F0E" } : null]}>{feeLine}</Text>
          </View>
        </View>

        {/* Who you would be meeting. */}
        <View style={s.box}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Face name={offer.counterparty.name} avatar={offer.counterparty.avatar} size={48} />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <PremiumName premium={offer.counterparty.premium} style={{ fontFamily: font.sansBold, fontSize: 16, color: color.ink }}>
                {offer.counterparty.name}
              </PremiumName>
              {/* The same rating line and tier chip as their profile header. */}
              <RatingLine
                rating={offer.counterparty.rating ?? 0}
                // An older server sends no count: show the stars alone.
                reviews={offer.counterparty.reviewCount ?? null}
                palette={{ ink: color.ink, secondary: color.inkSecondary }}
                size={15}
              />
              <TierChip
                tier={offer.counterparty.trustTier}
                idVerified={offer.counterparty.idVerified}
                palette={{ ink: color.ink, control: color.control }}
              />
            </View>
            <Tappable
              onPress={onChat}
              accessibilityRole="button"
              accessibilityLabel={`Message ${offer.counterparty.name}`}
              style={s.chat}
            >
              <MessageIcon size={20} stroke={1.9} color={color.ink} />
            </Tappable>
          </View>
          {offer.message ? (
            <View style={s.bubble}>
              <Text style={{ fontFamily: font.sans, fontSize: 14, lineHeight: 20, color: color.ink }}>{offer.message}</Text>
            </View>
          ) : null}
        </View>

        {others > 0 ? (
          <Text style={[s.meta, { textAlign: "center" }]}>
            {`Accepting this declines the other ${others} offer${others === 1 ? "" : "s"} on your ${mine.title}.`}
          </Text>
        ) : null}

        <FailurePopup message={flow.failure} title="Could not finish that" />
      </ScrollView>

      <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Tappable
          onPress={flow.decline}
          disabled={flow.busy}
          accessibilityRole="button"
          accessibilityLabel={`Decline ${partner}'s offer`}
          style={s.decline}
        >
          <Text style={{ fontFamily: font.sansSemi, fontSize: 15, color: color.ink }}>Decline</Text>
        </Tappable>
        {/* The item went away: Decline is the only thing left to do. */}
        {flow.unavailable ? null : (
        <Tappable
          onPress={confirmAccept}
          disabled={flow.busy}
          accessibilityRole="button"
          style={s.accept}
        >
          {flow.busy ? (
            <ActivityIndicator color={color.onGreen} />
          ) : (
            <Text style={{ fontFamily: font.sansBold, fontSize: 16, color: color.onGreen }}>
              {flow.receiverPays ? `Accept · pay ${flow.fee} Leaves` : "Accept trade"}
            </Text>
          )}
        </Tappable>
        )}
      </View>
    </View>
  );
}

function Header({
  title,
  subtitle,
  onBack,
  trailing,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={s.header}>
      <Tappable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={s.back}
        pressedStyle={{ backgroundColor: color.control }}
      >
        <ChevronLeftIcon size={22} stroke={1.8} color={color.ink} />
      </Tappable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.headerTitle} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        <Text style={s.headerSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {trailing}
    </View>
  );
}

function Ticket({
  label,
  title,
  image,
  bracket,
  highlight = false,
}: {
  label: string;
  title: string;
  image: string | null;
  /** The item's BRACKET. The exact Leaf value is not shown on a trade card. */
  bracket: number | null;
  highlight?: boolean;
}) {
  return (
    <View style={[s.ticket, highlight ? { borderColor: color.green, borderWidth: 1.5 } : null]}>
      <Thumb image={image} size={104} fill />
      <View style={{ gap: 3, paddingHorizontal: 4 }}>
        <Text style={[s.ticketLabel, highlight ? { color: color.forest } : null]}>{label}</Text>
        <Text style={s.ticketTitle} numberOfLines={2}>
          {title}
        </Text>
        {/* The bracket, with the leaf -- not "574 L". Same chip as item detail. */}
        <View style={{ marginTop: 6 }}>
          <BracketChip bracket={bracket} />
        </View>
      </View>
    </View>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: swatch }} />
      <Text style={{ fontFamily: font.sans, fontSize: 12, color: color.inkSecondary }}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 52,
    paddingLeft: space.screenXTight,
    paddingRight: space.screenXTight,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
  },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: font.displaySemi, fontSize: 18, color: color.ink },
  headerSub: { fontFamily: font.sans, fontSize: 12, color: color.inkSecondary, marginTop: 1 },
  next: {
    height: 40,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: color.controlLine,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  body: { padding: space.screenX, paddingTop: 16, gap: 14, paddingBottom: 24 },
  tickets: { flexDirection: "row", gap: 10 },
  ticket: {
    flex: 1,
    minWidth: 0,
    gap: 10,
    padding: 10,
    paddingBottom: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: color.controlLine,
    backgroundColor: "#FFFFFF",
  },
  ticketLabel: { fontFamily: font.sansBold, fontSize: 11, letterSpacing: 0.6, color: color.inkSecondary },
  ticketTitle: { fontFamily: font.sansSemi, fontSize: 14, lineHeight: 18, color: color.ink, minHeight: 36 },
  disc: {
    position: "absolute",
    left: "50%",
    top: 62,
    width: 36,
    height: 36,
    marginLeft: -18,
    marginTop: -18,
    borderRadius: 18,
    backgroundColor: color.ink,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: color.surface,
  },
  box: {
    gap: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: color.controlLine,
    backgroundColor: "#FFFFFF",
  },
  boxTitle: { fontFamily: font.sansBold, fontSize: 15, color: color.ink },
  ladder: { flexDirection: "row", gap: 3, alignItems: "flex-end" },
  rung: { width: "100%", height: 10, borderRadius: 5, overflow: "hidden", flexDirection: "row" },
  rungHalf: { position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", backgroundColor: color.green },
  rungNum: { fontFamily: font.sans, fontSize: 11, color: color.inkMuted },
  fee: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 12, backgroundColor: "#F4F3EE" },
  feeWarm: { backgroundColor: "#FDF0E3" },
  feeText: { flex: 1, fontFamily: font.sansMedium, fontSize: 13, lineHeight: 18, color: color.inkSecondary },
  meta: { fontFamily: font.sans, fontSize: 13, color: color.inkSecondary },
  chat: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: color.controlLine,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: { padding: 12, borderRadius: 16, borderTopLeftRadius: 4, backgroundColor: "#F4F3EE" },
  bar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: space.screenX,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: color.divider,
    backgroundColor: color.surface,
  },
  decline: {
    width: 112,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: color.controlLineStrong,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  accept: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
  },
});
