import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { meetupStateOf, useAcceptMeetup, useMeetupOptions, type OfferDecided } from "../../api/trades";
import type { ActiveTrade, LiveOffer } from "../../api/types";
import { clockTime } from "../../lib/format";
import { grouped, meetupWhen, shortDate } from "../../lib/gap";
import { bracketLabel } from "../../lib/brackets";
import { ApiError } from "../../api/client";
import { CardLink } from "./TradeCard";
import * as copy from "./copy";
import * as present from "./present";
import { PromiseStrip } from "./rows";
import { TradeButton } from "./trade-ui";
import { consent as consentCopy, replyBy } from "../offer/copy";
import { color, radius, space, textStyle, type } from "../../theme/tokens";
import { offerBorder } from "../../theme/offer-tokens";

/**
 * The trade screen's step panels (Round 2, 1 Oct 2026). Each one is the
 * behaviour of a screen that used to stand on its own:
 *
 *   OfferPanel     app/offer-review.tsx    (an incoming offer)
 *   RequestPanel   trades-waiting ?answer= (an incoming swap request)
 *   HubStepPanel   app/trade-meetup.tsx's "Agree" half
 *   WaitingPanel   app/trades-waiting.tsx's card links
 *   DonePanel      app/trade-summary.tsx
 *
 * The code panel is `HandoffPanel.tsx`. Display only: every write here is a
 * hook those screens already called, with the same arguments.
 */

/* ─────────────────────────────── shared ─────────────────────────────── */

function Title({ children }: { children: string }) {
  return (
    <Text style={[textStyle(type.exclusiveTitle), { color: color.ink }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

function Body({ children, tone = "secondary" }: { children: ReactNode; tone?: "ink" | "secondary" | "muted" }) {
  return (
    <Text
      style={[
        textStyle(type.detailBody),
        { color: tone === "ink" ? color.ink : tone === "muted" ? color.inkMuted : color.inkSecondary },
      ]}
    >
      {children}
    </Text>
  );
}

export function Failure({ children }: { children: string | null }) {
  if (!children) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={[textStyle(type.detailBody), { color: color.urgent }]}>
      {children}
    </Text>
  );
}

/** Decline (outlined) · Accept (solid forest), equal widths. */
function DecisionPair({
  onDecline,
  onAccept,
  acceptLabel = copy.waiting.accept,
}: {
  onDecline: () => void;
  onAccept: () => void;
  acceptLabel?: string;
}) {
  return (
    <View style={s.pair}>
      <TradeButton label={copy.waiting.decline} tone="quiet" onPress={onDecline} style={{ flex: 1 }} />
      <TradeButton label={acceptLabel} onPress={onAccept} style={{ flex: 1 }} />
    </View>
  );
}

/* ─────────────────────────── the offer step ─────────────────────────── */

/** An offer sent TO the viewer, with the decision. `flow` is `useOfferDecisionFlow()`. */
export function OfferPanel({
  offer,
  flow,
  onOpenTrade,
}: {
  offer: LiveOffer;
  flow: {
    accept: () => void;
    decline: () => void;
    decided: { action: "accept" | "decline"; result: OfferDecided } | null;
    failure: string | null;
    receiverPays: boolean;
    fee: number;
    balance: number | null;
  };
  onOpenTrade: (tradeId: string) => void;
}) {
  const partner = present.firstName(offer.counterparty.name);
  const proposerPaid = flow.fee > 0 && offer.bridgeFeePayer === "proposer";

  return (
    <View style={s.panel}>
      <Title>{copy.tradeScreen.offerFrom(partner)}</Title>
      {offer.offeredBracket !== null && offer.targetBracket !== null ? (
        <Body>{`${bracketLabel(offer.offeredBracket)} for your ${bracketLabel(offer.targetBracket)}`}</Body>
      ) : null}
      {flow.decided ? null : <Body tone="muted">{copy.tradeScreen.replyBy(replyBy(offer.createdAt))}</Body>}

      {flow.receiverPays ? <PromiseStrip>{copy.waiting.youWouldPay(flow.fee)}</PromiseStrip> : null}
      {proposerPaid ? <Body tone="muted">{copy.waiting.theyPaid(partner, flow.fee)}</Body> : null}

      {offer.message ? (
        <View style={s.quote}>
          <Text style={[textStyle(type.sectionHeading), { color: color.inkSecondary }]}>
            {`${partner}'s message`}
          </Text>
          <Body tone="ink">{offer.message}</Body>
        </View>
      ) : null}

      <Failure>{flow.failure}</Failure>

      {flow.decided ? (
        <View style={{ gap: space.browse.searchGap }}>
          <Body tone="ink">
            {flow.decided.action === "accept"
              ? flow.decided.result.chargedLeaves
                ? copy.tradeScreen.acceptedHeld(flow.decided.result.chargedLeaves)
                : copy.tradeScreen.accepted
              : copy.tradeScreen.declined}
          </Body>
          {flow.decided.action === "accept" && flow.decided.result.tradeId ? (
            <TradeButton
              label={copy.chatOffer.openTrade}
              onPress={() => onOpenTrade(flow.decided!.result.tradeId!)}
            />
          ) : null}
        </View>
      ) : (
        <>
          <DecisionPair
            onDecline={flow.decline}
            onAccept={flow.accept}
            acceptLabel={
              flow.receiverPays ? `${copy.waiting.accept} · ${grouped(flow.fee)} fee` : copy.waiting.accept
            }
          />
          {flow.receiverPays ? (
            <Body tone="muted">
              {flow.balance !== null && flow.balance < flow.fee
                ? consentCopy.shortBody(flow.fee, flow.balance)
                : "Accepting opens the fee and your balance before anything is charged."}
            </Body>
          ) : null}
        </>
      )}
    </View>
  );
}

/** A swap request sent TO the viewer. Same pair; PATCH /api/trades underneath. */
export function RequestPanel({
  trade,
  onAccept,
  onDecline,
  failure,
}: {
  trade: ActiveTrade;
  onAccept: () => void;
  onDecline: () => void;
  failure: string | null;
}) {
  const partner = present.firstName(trade.counterparty.name);
  return (
    <View style={s.panel}>
      <Title>{copy.tradeScreen.requestFrom(partner)}</Title>
      <Body>{present.swapLine(trade)}</Body>
      <Failure>{failure}</Failure>
      <DecisionPair onDecline={onDecline} onAccept={onAccept} />
    </View>
  );
}

/* ──────────────────────────── the hub step ──────────────────────────── */

/**
 * An ACCEPTED trade with no agreed hub. The plan is read from GET …/meetup,
 * fresh on mount, exactly as the old picker read it: the list row can be 30 s
 * old, and this is where a "Renz suggested a place" tap lands.
 */
export function HubStepPanel({ trade }: { trade: ActiveTrade }) {
  const router = useRouter();
  const options = useMeetupOptions(trade.id);
  const accept = useAcceptMeetup(trade.id);
  const [failure, setFailure] = useState<string | null>(null);

  const partner = present.firstName(trade.counterparty.name);
  const plan = options.data ? options.data.plan : trade.meetup;
  const you = options.data?.you ?? (trade.direction === "sent" ? "sender" : "receiver");
  const state = meetupStateOf(plan, you);
  const openPicker = () => router.push(`/trade-meetup?id=${encodeURIComponent(trade.id)}`);

  if (state === "waiting-on-them" && plan) {
    return (
      <WaitingPanel
        line={copy.tradeScreen.waitingOnSuggestion(partner)}
        detail={copy.meetup.where(plan.hub.name, meetupWhen(new Date(plan.at)))}
        links={<CardLink label={copy.tradeScreen.changeSuggestion} onPress={openPicker} />}
      />
    );
  }

  if (state === "yours-to-answer" && plan) {
    const agree = () => {
      setFailure(null);
      accept.mutate(
        { confirmHubId: plan.hub.id, confirmAt: plan.at },
        {
          onError: (e) =>
            setFailure(e instanceof ApiError ? e.message : "That did not go through. Nothing has changed."),
        },
      );
    };
    return (
      <View style={s.panel}>
        <Text style={[textStyle(type.sectionHeading), { color: color.inkSecondary }]}>
          {copy.tradeScreen.theySuggested(partner)}
        </Text>
        <View style={s.suggestion}>
          <Text style={[textStyle(type.username), { color: color.ink }]}>{plan.hub.name}</Text>
          <Text style={[textStyle(type.metadata), { color: color.inkSecondary }]}>
            {[plan.hub.typeLabel, plan.hub.city].filter(Boolean).join(" · ")}
          </Text>
          <Text style={[textStyle(type.detailBody), { color: color.ink, marginTop: 4 }]}>
            {meetupWhen(new Date(plan.at))}
          </Text>
          {plan.note ? <Body>{plan.note}</Body> : null}
        </View>
        <Failure>{failure}</Failure>
        <View style={s.pair}>
          <TradeButton
            label={copy.tradeScreen.suggestAnother}
            tone="outline"
            onPress={openPicker}
            style={{ flex: 1 }}
          />
          <TradeButton
            label={copy.tradeScreen.agree}
            onPress={agree}
            disabled={accept.isPending}
            accessibilityLabel={`Agree to meet at ${plan.hub.name}`}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={s.panel}>
      <Title>{copy.tradeScreen.hubStepTitle(partner)}</Title>
      <Body>{copy.tradeScreen.hubStepBody}</Body>
      <TradeButton label={copy.tradeScreen.chooseHub} onPress={openPicker} />
    </View>
  );
}

/* ─────────────────────────────── waiting ────────────────────────────── */

/** What the viewer is waiting on, and the quiet links that are still theirs. */
export function WaitingPanel({
  line,
  detail,
  links,
}: {
  line: string;
  detail?: string | null;
  links?: ReactNode;
}) {
  return (
    <View style={s.panel}>
      <Body tone="ink">{line}</Body>
      {detail ? <Body>{detail}</Body> : null}
      {links ? <View style={s.links}>{links}</View> : null}
    </View>
  );
}

/* ──────────────────────────── finished trades ───────────────────────── */

/** `app/trade-summary.tsx`'s rows, for a trade that has ended. */
export function DonePanel({ trade }: { trade: ActiveTrade }) {
  const router = useRouter();
  const partner = present.firstName(trade.counterparty.name);
  const when = new Date(trade.updatedAt);
  const matched = trade.codesMatchedAt ? Date.parse(trade.codesMatchedAt) : null;

  const headline =
    trade.status === "COMPLETED"
      ? copy.tradeScreen.completedOn(shortDate(when), clockTime(matched ?? when.getTime()))
      : trade.status === "REJECTED"
        ? copy.tradeScreen.declinedBy(partner)
        : copy.tradeScreen.calledOff;

  return (
    <View style={s.panel}>
      <Body tone="ink">{headline}</Body>
      {trade.status === "COMPLETED" ? (
        <View style={s.details}>
          <Detail label="Meetup hub" value={trade.safeZoneHub?.name ?? "No hub recorded"} />
          <Detail
            label="Leaves reward earned"
            value={trade.rewardLeaves === null ? "None" : `+${trade.rewardLeaves} Leaves`}
          />
          <Detail label="Rating I gave" value={trade.myReview ? `${trade.myReview.rating}/5` : "Not rated yet"} />
          <Detail
            label="Rating I received"
            value={trade.receivedReview ? `${trade.receivedReview.rating}/5` : "Not rated yet"}
          />
        </View>
      ) : null}
      {trade.status === "COMPLETED" && !trade.myReview ? (
        <TradeButton
          label={copy.history.rate(partner)}
          onPress={() => router.push(`/rate-trade?id=${encodeURIComponent(trade.id)}`)}
        />
      ) : null}
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.detail}>
      <Text style={[textStyle(type.metadata), { color: color.inkMuted, flexShrink: 0 }]}>{label}</Text>
      <Text style={[textStyle(type.detailBody), { color: color.ink, textAlign: "right", flexShrink: 1 }]}>
        {value}
      </Text>
    </View>
  );
}

/* ──────────────────────────── the bridging fee ──────────────────────── */

/**
 * The fee on a trade, from the viewer's side. Display only: the hold and the
 * payout happen on the server, on accept and on completion.
 */
export function FeeNote({ trade }: { trade: ActiveTrade }) {
  const fee = trade.bridgeFeeLeaves ?? 0;
  if (fee <= 0 || trade.bridgeFeePaidBySender == null) return null;
  const partner = present.firstName(trade.counterparty.name);
  const viewerPaid = trade.bridgeFeePaidBySender === (trade.direction === "sent");
  const line =
    trade.status === "COMPLETED"
      ? viewerPaid
        ? copy.code.feePaidOut(fee, partner)
        : copy.code.feeReceived(fee, partner)
      : trade.status === "REJECTED" || trade.status === "CANCELLED"
        ? null
        : present.tradeFeeLine(trade);
  if (!line) return null;
  return (
    <View style={s.fee}>
      <Text style={[textStyle(type.sectionHeading), { color: color.inkSecondary }]}>
        {copy.tradeScreen.feeLabel}
      </Text>
      <Body>{line}</Body>
    </View>
  );
}

const s = StyleSheet.create({
  panel: { gap: space.home.tileBody },
  pair: { flexDirection: "row", gap: space.browse.searchGap },
  links: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: space.home.tileBody * 2,
    rowGap: space.browse.searchGap,
  },
  quote: { gap: 4 },
  suggestion: {
    gap: 2,
    padding: space.home.tileBody,
    borderRadius: radius.hubRow,
    borderWidth: offerBorder.selected,
    borderColor: color.forest,
  },
  details: { gap: space.browse.searchGap },
  detail: { flexDirection: "row", justifyContent: "space-between", gap: space.home.tileBody },
  fee: {
    gap: 4,
    paddingTop: space.home.tileBody,
    borderTopWidth: offerBorder.rule,
    borderTopColor: color.divider,
  },
});
