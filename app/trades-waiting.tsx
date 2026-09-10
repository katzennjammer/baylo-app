import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { ApiError } from "../src/api/client";
import {
  useActiveTrades,
  useCancelTrade,
  useContracts,
  useOfferDecision,
  useTradeDecision,
  useWithdrawFromTrades,
} from "../src/api/trades";
import type { ActiveTrade, LiveOffer } from "../src/api/types";
import { Hairline, OfferScreenHost } from "../src/components/offer/chrome";
import {
  BlockHeader,
  Gutter,
  TradesBackTitle,
} from "../src/components/trades/chrome";
import * as copy from "../src/components/trades/copy";
import * as present from "../src/components/trades/present";
import {
  PromiseStrip,
  PromiseWell,
  RowAction,
  SplitActions,
  Thumb,
  WaitingRow,
} from "../src/components/trades/rows";
import { TradesErrorPanel } from "../src/components/trades/states";
import {
  offerColor,
  offerSize,
  offerType,
  textStyle,
} from "../src/theme/offer-tokens";

/**
 * Frame 9c — `Waiting`, in full. Every row that has a control, with its control.
 *
 * ══ WHY THIS IS A SEPARATE SCREEN ═══════════════════════════════════════════
 *
 * The tab's Waiting rows are STATUSES. This is where they become actions. Six
 * small buttons on a list somebody is scanning for a code is how an offer gets
 * declined by a thumb that was looking for something else — so the scanning list
 * shows what is true and this one shows what can be done about it.
 *
 * ══ THREE BLOCKS, THREE KINDS OF WAITING ════════════════════════════════════
 *
 *   Offers to you            somebody is waiting on YOU. Accept and Decline.
 *   Offers you sent          you are waiting on THEM. Withdraw, sender only.
 *   Accepted, meeting to set the trade exists and the meeting does not.
 *
 * ══ ACCEPT AND DECLINE SIT AT EQUAL WEIGHT ══════════════════════════════════
 *
 * Frame 9c's own note, and it is a real decision rather than a style: accept is
 * not the emphasised choice when someone else's item is at stake. `Decline` is a
 * plain outline and `Accept` carries §1.5's 1.5px `#1B4D2B` selected rule — a
 * chosen thing, not a promoted one. Neither is the green fill, which on this
 * screen belongs to nothing.
 *
 * ══ AN OFFER CARRYING A PROMISE HAS NO ACCEPT BUTTON HERE ═══════════════════
 *
 * THIS IS THE WHOLE DEFENCE OF THE FEATURE AND IT IS ENFORCED BY A MISSING
 * CONTROL. Accepting an offer accepts the deferred agreement riding on it, in
 * the same tap — PATCH /api/offers/[id] runs every check the contract's own
 * accept route would have run and flips both, and /contracts/[id]/accept answers
 * 409 for one of these because there is no second step to perform.
 *
 * Once that tap lands nothing downstream can compel payment. There is no
 * repossession and no reversal; the debtor's incentive is reputational, and
 * against somebody who does not intend to keep trading the platform has nothing.
 * So the moment of protection is BEFORE the yes, and it consists entirely of
 * showing the creditor the debtor's record.
 *
 * Which is why an offer with a `contract` gets `Read the agreement first` and no
 * accept control at all. `app/offer-review.tsx` is the only route to `accept`
 * for one of these, and it draws the record above the buttons.
 */
export default function TradesWaitingScreen() {
  const router = useRouter();
  const active = useActiveTrades();
  const contracts = useContracts();

  const decide = useOfferDecision();
  const decideTrade = useTradeDecision();
  const cancelTrade = useCancelTrade();
  const withdraw = useWithdrawFromTrades();
  const [failure, setFailure] = useState<string | null>(null);

  const offers = active.data?.offers ?? [];
  const incoming = offers.filter((o) => o.direction === "received");
  const sent = offers.filter((o) => o.direction === "sent");
  const toMeet = (active.data?.trades ?? []).filter((t) => t.status === "ACCEPTED");
  const incomingRequests = (active.data?.trades ?? []).filter(
    (t) => t.status === "PENDING" && t.direction === "received",
  );
  const sentRequests = (active.data?.trades ?? []).filter(
    (t) => t.status === "PENDING" && t.direction === "sent",
  );
  const openPromises = (contracts.data?.contracts ?? []).filter(
    (c) => c.status === "PENDING_ACCEPT",
  );

  const busy =
    decide.isPending || withdraw.isPending || decideTrade.isPending || cancelTrade.isPending;

  const run = (fn: () => void) => {
    setFailure(null);
    fn();
  };

  const onError = (e: unknown) =>
    setFailure(
      e instanceof ApiError ? e.message : "That did not go through. Nothing has changed.",
    );

  return (
    <OfferScreenHost imeInset={0} dimmed={busy}>
      <TradesBackTitle title={copy.nav.waiting} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {active.isError ? <TradesErrorPanel onRetry={() => void active.refetch()} /> : null}

        {failure ? <FailureLine>{failure}</FailureLine> : null}

        {/* ── Offers to you ─────────────────────────────────────────────── */}
        {incoming.length > 0 ? (
          <>
            <BlockHeader label={copy.label.offersToYou} top={12} />
            <Hairline />
            {incoming.map((offer) => (
              <View key={offer.id}>
                <IncomingOfferBlock
                  offer={offer}
                  onRead={() =>
                    router.push(`/offer-review?id=${encodeURIComponent(offer.id)}`)
                  }
                  onAccept={() =>
                    run(() =>
                      decide.mutate({ offerId: offer.id, action: "accept" }, { onError }),
                    )
                  }
                  onDecline={() =>
                    run(() =>
                      decide.mutate({ offerId: offer.id, action: "decline" }, { onError }),
                    )
                  }
                />
                <Hairline />
              </View>
            ))}
          </>
        ) : null}

        {/* ── Swap requests to you ──────────────────────────────────────
              A PENDING TradeRequest rather than an Offer. This app only ever
              creates offers, so these arrive from the web — and `ACTIVE_STATES`
              on /api/v1/trades includes PENDING, which means a row created there
              and answerable nowhere here would be an obligation the person
              cannot see. Same equal-weight decision pair, a different endpoint
              behind it. ── */}
        {incomingRequests.length > 0 ? (
          <>
            <BlockHeader label={copy.label.requestsToYou} top={18} />
            <Hairline />
            {incomingRequests.map((trade) => (
              <View key={trade.id}>
                <IncomingRequestBlock
                  trade={trade}
                  onAccept={() =>
                    run(() =>
                      decideTrade.mutate({ tradeId: trade.id, status: "ACCEPTED" }, { onError }),
                    )
                  }
                  onDecline={() =>
                    run(() =>
                      decideTrade.mutate({ tradeId: trade.id, status: "REJECTED" }, { onError }),
                    )
                  }
                />
                <Hairline />
              </View>
            ))}
          </>
        ) : null}

        {/* ── Swap requests you sent ────────────────────────────────────
              NO THREE-DAY CLOCK ON THESE. `expireStaleOffers()` sweeps `Offer`
              rows and nothing sweeps `TradeRequest`, so the row shows the age
              rather than a countdown — saying "2 days left" about something that
              never expires would be inventing a deadline. The one act the sender
              has is calling it off, which releases both items from IN_TRADE. ── */}
        {sentRequests.length > 0 ? (
          <>
            <BlockHeader label={copy.label.requestsYouSent} top={18} />
            <Hairline />
            {sentRequests.map((trade) => (
              <View key={trade.id}>
                <SentRequestRow
                  trade={trade}
                  onCancel={() => run(() => cancelTrade.mutate(trade.id, { onError }))}
                />
                <Hairline />
              </View>
            ))}
          </>
        ) : null}

        {/* ── Offers you sent ───────────────────────────────────────────── */}
        {sent.length > 0 ? (
          <>
            <BlockHeader label={copy.label.offersYouSent} top={18} />
            <Hairline />
            {sent.map((offer) => (
              <View key={offer.id}>
                <SentOfferBlock
                  offer={offer}
                  onWithdraw={() => run(() => withdraw.mutate(offer.id, { onError }))}
                />
                <Hairline />
              </View>
            ))}
          </>
        ) : null}

        {/* ── Promises still waiting on the other side's yes ─────────────
              Frame 9c does not draw these and frame 9j does, under `You
              promised`. They are here as well because a proposal nobody has
              answered is a thing the viewer is WAITING on — the same category as
              a sent offer — and burying it one screen further in is how somebody
              forgets they have their one contract slot spent. ── */}
        {openPromises.length > 0 ? (
          <>
            <BlockHeader label={copy.label.youPromised} top={18} />
            <Hairline />
            {openPromises.map((contract) => {
              const words = present.promiseWords(contract);
              return (
                <View key={contract.id}>
                  <WaitingRow
                    thumb={<PromiseWell size={offerSize.tradeRow.thumb} />}
                    title={words.title}
                    subtitle={words.subtitle}
                    onPress={() => router.push("/promises")}
                  />
                  <Hairline />
                </View>
              );
            })}
          </>
        ) : null}

        {/* ── Accepted, meeting to set ──────────────────────────────────── */}
        {toMeet.length > 0 ? (
          <>
            <BlockHeader label={copy.label.meetingToSet} top={18} />
            <Hairline />
            {toMeet.map((trade) => (
              <View key={trade.id}>
                <MeetingRow trade={trade} />
                <Hairline />
              </View>
            ))}
          </>
        ) : null}

        {incoming.length === 0 &&
        sent.length === 0 &&
        incomingRequests.length === 0 &&
        sentRequests.length === 0 &&
        openPromises.length === 0 &&
        toMeet.length === 0 &&
        !active.isError ? (
          <Gutter style={{ paddingTop: 18 }}>
            <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
              {copy.nothingPending}
            </Text>
          </Gutter>
        ) : null}
      </ScrollView>
    </OfferScreenHost>
  );
}

/* ──────────────────────────── the three blocks ──────────────────────── */

/**
 * One incoming offer. 14/16 of padding, 12 between the row and its controls.
 *
 * The branch on `offer.contract` is the rule this screen exists to enforce — see
 * the header. An offer with a promise gets one quiet control that opens the
 * record; an ordinary offer gets the equal-weight pair.
 */
function IncomingOfferBlock({
  offer,
  onRead,
  onAccept,
  onDecline,
}: {
  offer: LiveOffer;
  onRead: () => void;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const words = present.incomingOfferWords(offer);

  return (
    <Gutter style={{ paddingVertical: 14, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: offerSize.tradeRow.gap }}>
        <Thumb image={offer.post.image} size={offerSize.tradeRow.thumb} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          {/*
            THE COUNTERPARTY'S NAME, WITHOUT A TRUST TIER.

            Frame 9c writes `Renz P. · Rising`. `USER_BRIEF` on this route is
            `{ id, name, avatar }` and carries no tier, and the fallback in
            `src/lib/trust.ts` must not be used here: it works from
            `totalTrades`, a denormalised counter that reads high, and it cannot
            see DPA defaults at all. A row that labels a stranger's
            trustworthiness from an optimistic guess is the exact place that
            file's warning is about.
          */}
          <Text
            style={[textStyle(offerType.itemTitleRow), { color: offerColor.ink }]}
            numberOfLines={1}
          >
            {offer.counterparty.name}
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
            style={[textStyle(offerType.deadline), { color: offerColor.inkTertiary, flexShrink: 0 }]}
          >
            {words.trailing}
          </Text>
        ) : null}
      </View>

      {offer.contract ? (
        <>
          <PromiseStrip minHeight={44}>
            {copy.waiting.includesPromise(
              offer.contract.amountLeaves,
              new Date(offer.contract.deadline),
            )}
          </PromiseStrip>

          {/* The only way in to `accept` for an offer carrying a promise. A
              1px `#E2E0D6` rule and `#1B4D2B` text — quieter than either half of
              the decision pair, because it is not a decision. */}
          <ReadFirstRow onPress={onRead} />
        </>
      ) : (
        <SplitActions
          onDecline={onDecline}
          onAccept={onAccept}
          declineLabel={copy.waiting.decline}
          acceptLabel={copy.waiting.accept}
        />
      )}
    </Gutter>
  );
}

/**
 * Frame 9c's `Read the agreement first`: 44, radius 8, 1px `#E2E0D6`, deep ink.
 *
 * `RowAction`'s `quiet` tone IS that object, so the control draws its own rule
 * rather than sitting inside a second one — a wrapper with a border round a
 * button with a border is two hairlines pretending to be one.
 */
function ReadFirstRow({ onPress }: { onPress: () => void }) {
  // The one-child row `fill` requires. See the prop's note in `rows.tsx`.
  return (
    <View style={{ flexDirection: "row" }}>
      <RowAction label={copy.waiting.readFirst} onPress={onPress} tone="quiet" fill />
    </View>
  );
}

/**
 * One offer the viewer sent. Frame 9c's two-row block.
 *
 * WITHDRAW IS SENDER-ONLY AND PENDING-ONLY, and both halves are already true
 * here: this block only renders rows out of `offers.filter(direction === "sent")`
 * and the route only returns PENDING ones. The server enforces both again — an
 * ACCEPTED offer is a trade, and there is no unilateral exit from a deal the
 * other person already agreed to, so it answers 409.
 *
 * The line beside the control names what the Leaves do, because that is the
 * question somebody withdrawing actually has. An offer with `offeredLeaves` had
 * them HELD, not spent; withdrawing releases them. An offer with none held
 * nothing, and saying so stops the control looking like it costs something.
 */
function SentOfferBlock({ offer, onWithdraw }: { offer: LiveOffer; onWithdraw: () => void }) {
  const words = present.sentOfferWords(offer);
  const partner = present.firstName(offer.counterparty.name);
  const held = offer.offeredLeaves ?? 0;

  return (
    <Gutter style={{ paddingVertical: 14, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: offerSize.tradeRow.gap }}>
        <Thumb image={offer.post.image} size={offerSize.tradeRow.thumb} />
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
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: offerSize.tradeRow.gap }}>
        <Text
          style={[textStyle(offerType.helper), { color: offerColor.inkTertiary, flex: 1 }]}
        >
          {held > 0
            ? copy.waiting.leavesHeld(partner, held)
            : copy.waiting.nothingHeld(partner)}
        </Text>
        <RowAction
          label={copy.waiting.withdraw}
          onPress={onWithdraw}
          accessibilityLabel={`Withdraw your offer to ${partner}`}
        />
      </View>
    </Gutter>
  );
}

/**
 * An ACCEPTED trade with no meeting. Frame 9c draws a `Set it` control on this
 * row and it is NOT drawn here.
 *
 * There is no endpoint behind it. A meet-up hub is not a field on a trade that
 * can be set in advance: it is claimed at confirmation, as `safeZoneHubId` on
 * POST /api/trades/[id]/confirm/submit, and validated against BOTH traded
 * listings' declared hubs before it is accepted. So the row says what is true —
 * the hub is named when the codes are — and carries no control rather than a
 * control that would have to invent a route.
 */
function MeetingRow({ trade }: { trade: ActiveTrade }) {
  const words = present.acceptedTradeWords(trade);
  return (
    <WaitingRow
      thumb={<Thumb image={trade.requestedItem.image} size={offerSize.tradeRow.thumb} />}
      title={words.title}
      subtitle={copy.waiting.codesWhenAgreed}
      trailing={words.trailing}
    />
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
              textStyle(offerType.deadline),
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
 * One swap request the viewer sent.
 *
 * `Call it off` RATHER THAN `Withdraw`, and the two words are kept apart on
 * purpose. Withdrawing retracts a proposal nobody has agreed to and releases
 * held Leaves; calling off ends a trade row and puts both items back to
 * AVAILABLE from IN_TRADE. They are different acts on different rows, and one
 * label for both is how somebody presses the wrong one.
 */
function SentRequestRow({ trade, onCancel }: { trade: ActiveTrade; onCancel: () => void }) {
  const words = present.tradeRequestWords(trade);

  return (
    <WaitingRow
      thumb={<Thumb image={trade.requestedItem.image} size={offerSize.tradeRow.thumb} />}
      title={words.title}
      subtitle={words.subtitle}
      trailing={words.trailing}
    >
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <RowAction
          label={copy.waiting.cancel}
          onPress={onCancel}
          accessibilityLabel={`Call off your swap request to ${present.firstName(
            trade.counterparty.name,
          )}`}
        />
      </View>
    </WaitingRow>
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
