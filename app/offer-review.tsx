import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { ApiError } from "../src/api/client";
import { currentConsent } from "../src/api/offer";
import { useProfileMe } from "../src/api/profile";
import { useActiveTrades, useOfferDecision } from "../src/api/trades";
import type { LiveOffer } from "../src/api/types";
import { Splash } from "../src/components/Splash";
import { BridgeConsentSheet } from "../src/components/offer/BridgeConsentSheet";
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
import { bracketLabel } from "../src/lib/brackets";
import { grouped } from "../src/lib/gap";
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
 * An incoming offer, at full size, with the decision — and, when the receiver
 * is the one paying the bridging fee, the consent sheet between them and it.
 *
 * ══ THE BRACKETS COME BEFORE THE TAP ════════════════════════════════════════
 *
 * An offer is one item for one item, and the two brackets decide what
 * accepting means. Three cases, three different screens' worth of information
 * under the same swap row:
 *
 *   same bracket        a straight swap. Accept and Decline at equal weight.
 *   one BELOW yours     the proposer already paid a bridging fee; it comes to
 *                       you when the swap completes. Equal-weight pair, and a
 *                       line saying so.
 *   one ABOVE yours     YOU pay the fee, held from your balance in the accept.
 *                       Accept opens the consent sheet — both brackets, the
 *                       fee, your balance now and after, a checkbox — and the
 *                       server refuses the accept without that consent. If
 *                       your balance is short, the sheet says need against
 *                       have and offers no way to accept.
 *
 * `trades-waiting.tsx` gives the third case `Review the fee and accept` and NO
 * accept control; this screen is the only route to `accept` for one of those.
 *
 * ══ NO EXACT VALUE FOR THEIR ITEM ═══════════════════════════════════════════
 *
 * The swap line names their item by bracket and yours by value, the terms
 * row names both brackets, and nothing on this screen prints what somebody
 * else's item is worth.
 */
export default function OfferReviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const active = useActiveTrades();
  const me = useProfileMe();
  const decide = useOfferDecision();
  const [failure, setFailure] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);

  /*
   * ── THE ROW IS HELD ACROSS ITS OWN DECISION ─────────────────────────────
   *
   * This screen resolves its offer out of the Trades list, and that list is
   * PENDING-ONLY. The moment an accept succeeds the invalidation drops the
   * row, and the `!offer` branch below would tell the person who had just
   * accepted that the offer "may have been withdrawn". So the row the decision
   * was made against is kept, narrowly: it applies only after THIS screen
   * decided. An offer that disappears for any other reason still falls
   * through to the not-open message, because in that case the message is true.
   */
  const [settled, setSettled] = useState<LiveOffer | null>(null);
  const offer = (active.data?.offers ?? []).find((o) => o.id === id) ?? settled;

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
  const decided = decide.isSuccess;

  const fee = offer.bridgeFeeLeaves ?? 0;
  const receiverPays = fee > 0 && offer.bridgeFeePayer === "receiver";
  const proposerPaid = fee > 0 && offer.bridgeFeePayer === "proposer";
  // The receiver's balance, for the sheet. /profile/me is cached from the
  // tab bar's own read; on a cold deep link it is one request.
  const balance = me.data?.user.leaves ?? null;

  const run = (action: "accept" | "decline") => {
    setFailure(null);
    decide.mutate(
      {
        offerId: offer.id,
        action,
        // Consent rides only on the receiver-pays accept, and only from the
        // sheet: `run("accept")` is reached from the sheet's own button in
        // that case, and from the bar otherwise.
        consent: action === "accept" && receiverPays ? currentConsent() : null,
      },
      {
        onSuccess: () => {
          setConsentOpen(false);
          setSettled(offer);
        },
        onError: (e) => {
          setConsentOpen(false);
          setFailure(
            e instanceof ApiError
              ? e.message
              : "That did not go through. Nothing has changed on your side.",
          );
        },
        // NO AUTOMATIC DISMISS. §1.10: "The screen changes to the next state and
        // a mono line states what happened." The bar becomes the line and the
        // back control is theirs to press.
      },
    );
  };

  const onAcceptPress = () => {
    if (receiverPays) {
      setConsentOpen(true);
      return;
    }
    run("accept");
  };

  return (
    <OfferScreenHost imeInset={0} dimmed={decide.isPending}>
      <TradesBackTitle
        title={copy.nav.offerFrom(offer.counterparty.name)}
        onBack={() => router.back()}
        // A decided offer has no clock left to run.
        trailing={decided ? undefined : <NavMono>{copy.review.expiresIn(days)}</NavMono>}
      />

      <ScrollView>
        {/* ── The swap itself. ── */}
        <Gutter style={{ paddingTop: 8, paddingBottom: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Thumb image={offer.offeredItems[0]?.image ?? null} size={offerSize.tradeCard.thumb} />
            <ArrowsIcon
              size={offerIcon.inlineRowSmall.size}
              stroke={offerIcon.inlineRow.stroke}
              color={offerColor.inkTertiary}
            />
            <Thumb image={offer.post.image} size={offerSize.tradeCard.thumb} />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text
                style={[textStyle(offerType.itemTitleTile), { color: offerColor.ink }]}
                numberOfLines={2}
              >
                {present.offerSwapLine(offer)}
              </Text>
              <Text style={[textStyle(offerType.deadline), { color: offerColor.inkSecondary }]}>
                {offer.offeredBracket !== null && offer.targetBracket !== null
                  ? `${bracketLabel(offer.offeredBracket)} for your ${bracketLabel(offer.targetBracket)}`
                  : copy.review.noLeaves}
              </Text>
            </View>
          </View>

          {/* §1.7's outline strip, never a fill: the offer has not failed, it
              has more in it than a swap. */}
          {receiverPays ? (
            <PromiseStrip>{copy.waiting.youWouldPay(fee)}</PromiseStrip>
          ) : null}

          {proposerPaid ? (
            <Text style={[textStyle(offerType.helper), { color: offerColor.inkTertiary }]}>
              {copy.waiting.theyPaid(sender, fee)}
            </Text>
          ) : null}
        </Gutter>

        <Hairline />

        {/* ── The terms, as a plain table. ── */}
        <Section pad={offerSpace.section.settle}>
          <TradesSectionLabel>{offerCopy.label.brackets}</TradesSectionLabel>
          <View style={{ marginTop: offerSpace.labelToContent }}>
            <RecordRow
              first
              label={`${sender}'s item`}
              value={offer.offeredBracket !== null ? bracketLabel(offer.offeredBracket) : "—"}
            />
            <RecordRow
              label="Your item"
              value={offer.targetBracket !== null ? bracketLabel(offer.targetBracket) : "—"}
            />
            <RecordRow
              label="Bridging fee"
              value={
                fee > 0
                  ? receiverPays
                    ? `${grouped(fee)} · you pay on accepting`
                    : `${grouped(fee)} · ${sender} paid`
                  : "none"
              }
              tone={receiverPays ? "warm" : "neutral"}
            />
            {receiverPays && balance !== null ? (
              <RecordRow label="Your balance" value={grouped(balance)} tone={balance < fee ? "warm" : "neutral"} />
            ) : null}
          </View>
        </Section>

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
        The controls. `Decline` and `Accept` are the split pair at 52 with an 8
        gap, and BOTH are outlines: accept carries §1.5's 1.5px `#1B4D2B`
        selected rule rather than the green fill, because accept is not the
        emphasised choice when someone else's item is at stake.
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
        footnote={
          decided
            ? null
            : receiverPays
              ? balance !== null && balance < fee
                ? offerCopy.consent.shortBody(fee, balance)
                : `Accepting opens the fee and your balance before anything is charged.`
              : null
        }
      >
        {decided ? (
          <Text
            style={[
              textStyle(offerType.footnoteMono),
              { color: offerColor.inkSecondary, textAlign: "center" },
            ]}
          >
            {decide.variables?.action === "accept"
              ? decide.data?.chargedLeaves
                ? `Accepted · ${grouped(decide.data.chargedLeaves)} Leaves held`
                : "Accepted"
              : "Declined"}
          </Text>
        ) : (
          <View style={{ flexDirection: "row", gap: offerSize.button.splitGap }}>
            <View style={{ flex: 1 }}>
              <SecondaryButton label={copy.waiting.decline} onPress={() => run("decline")} />
            </View>
            <View style={{ flex: 1 }}>
              <AcceptButton
                label={
                  receiverPays ? `${copy.waiting.accept} · ${grouped(fee)} fee` : copy.waiting.accept
                }
                onPress={onAcceptPress}
                // A receiver who cannot cover the fee gets the sheet's need-vs-have
                // rather than a disabled control; the server would refuse anyway.
                disabled={false}
              />
            </View>
          </View>
        )}
      </OfferBottomBar>

      {consentOpen && offer.offeredBracket !== null && offer.targetBracket !== null ? (
        <BridgeConsentSheet
          side="accept"
          otherName={sender}
          yourBracket={offer.targetBracket}
          theirBracket={offer.offeredBracket}
          fee={fee}
          balance={balance ?? 0}
          busy={decide.isPending}
          onConfirm={() => run("accept")}
          onDismiss={() => setConsentOpen(false)}
        />
      ) : null}
    </OfferScreenHost>
  );
}

/**
 * §4's 52px control at §1.5's selected weight: a 1.5px `#1B4D2B` rule, no fill.
 *
 * NOT `PrimaryButton`. That one is green, and this is a different act: somebody
 * else's item is at stake, and the outline is what says the two halves of the
 * decision are equals.
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
