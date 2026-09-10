import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { ApiError } from "../src/api/client";
import { useContractPreview } from "../src/api/offer";
import { useActiveTrades, useOfferDecision } from "../src/api/trades";
import type { LiveOffer } from "../src/api/types";
import { Splash } from "../src/components/Splash";
import {
  Hairline,
  OfferBottomBar,
  OfferScreenHost,
  SecondaryButton,
  Section,
} from "../src/components/offer/chrome";
import { ArrowsIcon } from "../src/components/offer/icons";
import * as offerCopy from "../src/components/offer/copy";
import { RecordRow } from "../src/components/offer/rows";
import { LoadFailedPanel } from "../src/components/offer/states";
import {
  Gutter,
  NavMono,
  TradesBackTitle,
  TradesSectionLabel,
} from "../src/components/trades/chrome";
import * as copy from "../src/components/trades/copy";
import * as present from "../src/components/trades/present";
import { PromiseStrip, Thumb } from "../src/components/trades/rows";
import { grouped, shortDate } from "../src/lib/gap";
import { Tappable } from "../src/components/Tappable";
import {
  offerBorder,
  offerColor,
  offerIcon,
  offerRadius,
  offerSize,
  offerSpace,
  offerType,
  textStyle,
} from "../src/theme/offer-tokens";

/**
 * §10.4 / frame 9i — an incoming offer, and the record that has to come first.
 *
 * ══ THE RECORD COMES BEFORE THE TAP. THAT IS THE WHOLE FEATURE. ═════════════
 *
 * A deferred agreement can ride on an offer, and ACCEPTING THE OFFER ACCEPTS THE
 * CONTRACT IN THE SAME TAP. PATCH /api/offers/[id] runs every check
 * /contracts/[id]/accept would have run and flips both; the contract's own accept
 * route answers 409 with `meta.rule: "DPA_ACCEPTED_WITH_OFFER"` for one of these,
 * because there is no second step to perform.
 *
 * Once that tap lands nothing downstream can compel payment. No repossession, no
 * reversal, no way to take the item back. The debtor's incentive is reputational
 * and against somebody who does not intend to keep trading the platform has
 * nothing at all. So the entire protection is BEFORE the yes, and it consists of
 * showing the creditor who they are underwriting.
 *
 * Which is why:
 *
 *   - `trades-waiting.tsx` gives an offer carrying a promise `Read the agreement
 *     first` and NO accept control. This screen is the only route to `accept`
 *     for one of them.
 *   - The record is drawn ABOVE the buttons, as four plain numbers, not behind a
 *     disclosure and not summarised into a badge.
 *   - Every figure /contracts/[id]/preview returns is rendered. None is rounded
 *     away, and `onTimeFulfillmentRate: null` renders as `no history` rather than
 *     as 0% — the server insists on that distinction and it is the difference
 *     between "unproven" and "proven bad".
 *
 * ══ AN OFFER WITHOUT A PROMISE STILL COMES HERE ═════════════════════════════
 *
 * It just has no record block, because there is nothing being underwritten. The
 * screen is then the frame 9c row at full size — the swap, the clock and the
 * decision pair — which is worth having as its own screen so a tap on an
 * incoming offer always lands somewhere that shows the whole thing.
 *
 * ══ WHAT §10.4 ASKS FOR AND THE ENDPOINT CANNOT ANSWER ══════════════════════
 *
 * `Her open agreements` — the debtor's OTHER live contracts, each with its own
 * creditor, deadline and paid figure. The preview returns
 * `debtorStats.outstandingDebt` (a total) and no per-contract breakdown, and GET
 * /api/v1/contracts lists the VIEWER's contracts, not a third party's. So the
 * section is not drawn and the total appears as §10.4's `Owed right now` row,
 * where it is honest: `220` is a fact and `220 across 2` needs a count nothing
 * sends. `app/contract.tsx` reached the same conclusion for the same reason.
 */
export default function OfferReviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const active = useActiveTrades();
  const decide = useOfferDecision();
  const [failure, setFailure] = useState<string | null>(null);

  /*
   * ── THE ROW IS HELD ACROSS ITS OWN DECISION ─────────────────────────────
   *
   * This screen resolves its offer out of the Trades list, and that list is
   * PENDING-ONLY (`status: "PENDING"` on /api/v1/trades). So the moment an
   * accept succeeds, `useOfferDecision` invalidates the list, the refetch drops
   * the row, `find()` returns undefined — and the `!offer` branch below told the
   * person who had just accepted that the offer "may have been withdrawn, or it
   * may have expired on its own".
   *
   * That is how a successful accept reported itself as a failure, and it is why
   * the `decided` state at the bottom of this file had never once rendered: the
   * early return fires before it. The trade was real every time.
   *
   * So the row the decision was made against is kept. `settled` is written in
   * `run`'s onSuccess from the offer as it stood at the tap, which is the
   * truthful thing to keep drawing — it is what the person read and agreed to.
   * The fallback is deliberately narrow: it applies only after THIS screen
   * decided. An offer that disappears for any other reason (the sender withdrew
   * it while it was open in front of us, or it expired) still falls through to
   * the not-open message, because in that case the message is true.
   */
  const [settled, setSettled] = useState<LiveOffer | null>(null);
  const offer = (active.data?.offers ?? []).find((o) => o.id === id) ?? settled;

  // The record. Fetched only when there is a promise to underwrite; `enabled` is
  // threaded through `useContractPreview`, so an ordinary offer costs no request.
  const preview = useContractPreview(offer?.contract?.id);

  const apiError = active.error instanceof ApiError ? active.error : null;
  if (apiError?.code === "UNAUTHENTICATED") {
    return <Splash waitingOn="Signing you back in" />;
  }

  if (!offer) {
    return (
      <OfferScreenHost imeInset={0}>
        <TradesBackTitle title={copy.nav.trades} onBack={() => router.back()} />
        {active.isError ? (
          <LoadFailedPanel
            heading="Can't load this offer"
            body="The connection dropped. Nothing has changed — the offer is still waiting for you."
            onRetry={() => void active.refetch()}
          />
        ) : active.isPending ? null : (
          <Gutter style={{ paddingTop: 18 }}>
            <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
              That offer is not open any more. It may have been withdrawn, or it may have
              expired on its own.
            </Text>
          </Gutter>
        )}
      </OfferScreenHost>
    );
  }

  const sender = present.firstName(offer.counterparty.name);
  const days = present.offerDaysLeft(offer.createdAt);
  const contract = offer.contract;
  const record = preview.data;
  const decided = decide.isSuccess;

  const run = (action: "accept" | "decline") => {
    setFailure(null);
    decide.mutate(
      { offerId: offer.id, action },
      {
        // Hold the row THIS decision was made against, before the invalidation
        // below drops it out of the PENDING-only list. See the note on
        // `settled`: without this the success state is unreachable and the
        // screen reports a completed accept as a withdrawal.
        onSuccess: () => setSettled(offer),
        onError: (e) =>
          setFailure(
            e instanceof ApiError
              ? e.message
              : "That did not go through. Nothing has changed on your side.",
          ),
        // NO AUTOMATIC DISMISS. §1.10: "The screen changes to the next state and
        // a mono line states what happened." Popping the screen out from under
        // somebody the instant they accept an agreement is the opposite of that
        // — they never see what the tap did, on the one screen where knowing
        // what the tap did is the entire point. The bar becomes the line and the
        // back control is theirs to press.
      },
    );
  };

  return (
    <OfferScreenHost imeInset={0} dimmed={decide.isPending}>
      <TradesBackTitle
        title={copy.nav.offerFrom(offer.counterparty.name)}
        onBack={() => router.back()}
        // A decided offer has no clock left to run. Keeping `3 days left` in the
        // corner of a screen whose bottom bar reads `Accepted` is the same class
        // of untruth this file was fixed for, one line further up.
        trailing={decided ? undefined : <NavMono>{copy.review.expiresIn(days)}</NavMono>}
      />

      <ScrollView>
        {/* ── The swap itself. A creditor deciding on an agreement is first
              deciding on a trade, so the trade is what opens the screen. ── */}
        <Gutter style={{ paddingTop: 8, paddingBottom: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Thumb
              image={offer.offeredItems[0]?.image ?? null}
              size={offerSize.tradeCard.thumb}
            />
            <ArrowsIcon
              size={offerIcon.inlineRowSmall.size}
              stroke={offerIcon.inlineRow.stroke}
              color={offerColor.inkTertiary}
            />
            <Thumb image={offer.post.image} size={offerSize.tradeCard.thumb} />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              {/* VALUES ABSENT. §10.4 writes `Her jacket 300 for your Air Max
                  480`; `ITEM_BRIEF` on this route carries no `valueLeaves`, so
                  the titles go on the line alone rather than beside a zero. See
                  gap 3 in `src/api/trades.ts`. */}
              <Text
                style={[textStyle(offerType.itemTitleTile), { color: offerColor.ink }]}
                numberOfLines={2}
              >
                {present.offerSwapLine(offer)}
              </Text>
              <Text
                style={[textStyle(offerType.deadline), { color: offerColor.inkSecondary }]}
              >
                {contract
                  ? copy.review.splitLine(offer.offeredLeaves ?? 0, contract.amountLeaves)
                  : (offer.offeredLeaves ?? 0) > 0
                    ? copy.review.addedNow(offer.offeredLeaves ?? 0)
                    : copy.review.noLeaves}
              </Text>
            </View>
          </View>

          {/* §1.7's "Pending acceptance": a 1.5px terracotta OUTLINE, never a
              fill. The offer has not failed; it has more in it than a swap. */}
          {contract ? (
            <PromiseStrip>
              {offerCopy.creditor.notice(
                contract.amountLeaves,
                shortDate(new Date(contract.deadline)),
              )}
            </PromiseStrip>
          ) : null}

          {contract ? (
            <Text style={[textStyle(offerType.helper), { color: offerColor.inkTertiary }]}>
              {copy.review.sameTap}
            </Text>
          ) : null}
        </Gutter>

        <Hairline />

        {/* ── §10.4's record. Four numbers, as a plain table. ── */}
        {contract ? (
          preview.isPending ? (
            <RecordLoading />
          ) : preview.isError || !record ? (
            <LoadFailedPanel
              heading="Can't load their record"
              body={
                "The connection dropped. Nothing has changed — and the record is the " +
                "reason this screen exists, so the decision waits until it loads."
              }
              onRetry={() => void preview.refetch()}
            />
          ) : (
            <Section pad={offerSpace.section.settle}>
              <TradesSectionLabel>{copy.label.record(sender)}</TradesSectionLabel>
              <View style={{ marginTop: offerSpace.labelToContent }}>
                <RecordRow
                  first
                  label={offerCopy.creditor.recordTrades}
                  value={String(record.debtorStats.completedTrades)}
                />
                <RecordRow
                  label={offerCopy.creditor.recordOnTime}
                  value={
                    // NULL means no history, NEVER 0%. A first-time debtor is
                    // unproven, not proven bad, and the server's own comment
                    // insists the two get different answers.
                    record.debtorStats.onTimeFulfillmentRate === null
                      ? offerCopy.creditor.onTimeNone
                      : offerCopy.creditor.onTimeOf(
                          Math.round(
                            record.debtorStats.onTimeFulfillmentRate *
                              record.debtor.finishedContracts,
                          ),
                          record.debtor.finishedContracts,
                        )
                  }
                />
                <RecordRow
                  label={offerCopy.creditor.recordDefaults}
                  value={
                    record.debtorStats.pastDefaults === 0
                      ? offerCopy.creditor.defaultsNone
                      : record.debtor.hasUnsettledDefault
                        ? offerCopy.creditor.defaultsStanding(record.debtorStats.pastDefaults)
                        : offerCopy.creditor.defaultsSettled(record.debtorStats.pastDefaults)
                  }
                  // §1.4's fourth job: a mono value that is a debt or a default.
                  tone={record.debtorStats.pastDefaults > 0 ? "warm" : "neutral"}
                />
                <RecordRow
                  label={offerCopy.creditor.recordOwed}
                  value={
                    record.debtorStats.outstandingDebt > 0
                      ? grouped(record.debtorStats.outstandingDebt)
                      : offerCopy.creditor.owedNone
                  }
                  tone={record.debtorStats.outstandingDebt > 0 ? "warm" : "neutral"}
                />
              </View>

              <Text
                style={[
                  textStyle(offerType.helper),
                  { color: offerColor.inkTertiary, marginTop: offerSpace.paragraphToControl },
                ]}
              >
                {offerCopy.creditor.footnote(
                  contract.amountLeaves,
                  sender,
                  record.debtorStats.outstandingDebt + contract.amountLeaves,
                )}
              </Text>

              {/* The true statement of what the platform will do if it goes
                  wrong, in the server's own words. Above the buttons, never
                  behind a disclosure. */}
              <View
                style={{
                  marginTop: offerSpace.paragraphToControl,
                  borderWidth: offerBorder.promise,
                  borderColor: offerColor.promise,
                  borderRadius: offerRadius.row,
                  padding: 14,
                }}
              >
                <Text style={[textStyle(offerType.errorText), { color: offerColor.ink }]}>
                  {record.terms.noItemReturn}
                </Text>
              </View>
            </Section>
          )
        ) : null}

        {offer.message ? (
          <>
            <Hairline />
            <Section pad={offerSpace.section.offering}>
              <TradesSectionLabel>{`${sender}'s message`}</TradesSectionLabel>
              <Text
                style={[
                  textStyle(offerType.body),
                  { color: offerColor.inkSecondary, marginTop: offerSpace.labelToContent },
                ]}
              >
                {offer.message}
              </Text>
            </Section>
          </>
        ) : null}
      </ScrollView>

      {/*
        §10.4's controls, at frame 9i's weights.

        `Decline` and `Accept` are §4's split pair at 52 with an 8 gap, and BOTH
        are outlines: accept carries §1.5's 1.5px `#1B4D2B` selected rule rather
        than the green fill, because frame 9c's rule holds here too — accept is
        not the emphasised choice when someone else's item is at stake.

        `Accept without the 100` IS NOT DRAWN, and its absence is deliberate.
        §10.4 offers it, and it means accepting the TRADE while forgiving the
        promise. POST /api/v1/contracts/[id]/decline declines the agreement and
        leaves the trade untouched, which is close but not the same act — and
        nothing on the wire says the two are equivalent. `app/contract.tsx`
        reached the same conclusion; drawing a third button that did something
        subtly different from its label is the one outcome worth avoiding on the
        screen whose whole job is informed consent.
      */}
      <OfferBottomBar
        above={
          failure ? (
            <View style={{ marginBottom: offerSpace.bottomBar.consequenceToButton }}>
              <Text
                accessibilityLiveRegion="polite"
                style={[textStyle(offerType.errorText), { color: offerColor.warm }]}
              >
                {failure}
              </Text>
            </View>
          ) : undefined
        }
      >
        {decided ? (
          // §1.10: no colour event on a decision. A mono line states what
          // happened and the controls are gone. Nothing congratulates.
          <Text
            style={[
              textStyle(offerType.footnoteMono),
              { color: offerColor.inkSecondary, textAlign: "center" },
            ]}
          >
            {decide.variables?.action === "accept" ? "Accepted" : "Declined"}
          </Text>
        ) : (
          <View style={{ flexDirection: "row", gap: offerSize.button.splitGap }}>
            <View style={{ flex: 1 }}>
              <SecondaryButton
                label={offerCopy.creditor.decline}
                onPress={() => run("decline")}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AcceptButton
                label={offerCopy.creditor.accept}
                onPress={() => run("accept")}
                // The record has to be on screen before the tap. While it is
                // still loading there is nothing to have read, so accept waits.
                disabled={!!contract && !record}
              />
            </View>
          </View>
        )}
      </OfferBottomBar>
    </OfferScreenHost>
  );
}

/**
 * §4's 52px control at §1.5's selected weight: a 1.5px `#1B4D2B` rule, no fill.
 *
 * NOT `PrimaryButton`. That one is green, and §5.1's closing line — "There is no
 * disabled send in any situation" — is a rule about the OFFER flow, where every
 * gap has a sendable arrangement. This is a different act: a creditor accepting
 * an agreement they have not been shown yet is the one press this system should
 * refuse, so this control does have a disabled state and says so to the
 * accessibility layer rather than only by going pale.
 */
function AcceptButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Tappable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      accessibilityHint={
        disabled ? "Their record is still loading. It has to be on screen first." : undefined
      }
      style={{
        height: offerSize.button.primary,
        borderRadius: offerRadius.button,
        borderWidth: offerBorder.selected,
        borderColor: disabled ? offerColor.strong : offerColor.selected,
        backgroundColor: offerColor.paper,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
      }}
      pressedStyle={disabled ? undefined : { backgroundColor: offerColor.tintGreen }}
    >
      <Text
        style={[
          textStyle(offerType.buttonSecondary),
          { color: disabled ? offerColor.inkTertiary : offerColor.deep },
        ]}
      >
        {label}
      </Text>
    </Tappable>
  );
}

/** §6's loading rule applied to the record: the label stays, the rows are blocks. */
function RecordLoading() {
  return (
    <Section pad={offerSpace.section.settle}>
      {/* Not `record(name)` — that reads "Their's record". The possessive form
          needs a name and the name is on screen two rows up; while the figures
          are loading the neutral label is the honest one. */}
      <TradesSectionLabel>Their record</TradesSectionLabel>
      <View style={{ marginTop: offerSpace.labelToContent, gap: 1 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ height: 42, backgroundColor: offerColor.sunk }} />
        ))}
      </View>
    </Section>
  );
}
