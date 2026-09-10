import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { ApiError } from "../src/api/client";
import { useContractDecision, useContractPreview } from "../src/api/offer";
import { Splash } from "../src/components/Splash";
import {
  Hairline,
  OfferBottomBar,
  OfferNav,
  OfferScreenHost,
  PrimaryButton,
  SecondaryButton,
  Section,
  SectionLabel,
} from "../src/components/offer/chrome";
import * as copy from "../src/components/offer/copy";
import { ItemRow, RecordRow } from "../src/components/offer/rows";
import { LoadFailedPanel } from "../src/components/offer/states";
import { WarningTriangleIcon } from "../src/components/offer/icons";
import { daysUntil, deadlineLabel, grouped, shortDate } from "../src/lib/gap";
import {
  deadlineInk,
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
 * §6j / §10.4 — the owner accepting. The creditor's view of a proposed DPA.
 *
 * ══ THIS SCREEN IS THE FEATURE'S ONLY REAL DEFENCE ═══════════════════════════
 *
 * The server's own header on GET /api/v1/contracts/[id]/preview says it, and it
 * is worth repeating where the client draws it: nothing downstream of acceptance
 * can compel payment. There is no repossession, no reversal, no way to take the
 * item back. Once the creditor says yes, the debtor's incentive to pay is
 * reputational, and against a debtor who does not intend to keep trading the
 * platform has nothing.
 *
 * So the whole of the protection is BEFORE the yes, and it consists entirely of
 * showing the creditor what they are agreeing to. Every figure the endpoint
 * returns is rendered here; none is summarised away, and `terms.noItemReturn` —
 * the true statement of what happens if it goes wrong — is shown verbatim above
 * the buttons rather than tucked under a disclosure.
 *
 * ══ WHERE IT IS REACHED FROM ════════════════════════════════════════════════
 *
 * `/contract?id=…`, from the Trades screen (not built in this task) and from a
 * notification deep link. A root route rather than a tab screen, for the same
 * reason `app/offer.tsx` is: it pins its own decision bar and the tab bar would
 * sit under it.
 *
 * ══ WHAT §10.4 ASKS FOR AND THE ENDPOINT CANNOT ANSWER ══════════════════════
 *
 * `Her open agreements` — a list of the debtor's OTHER live contracts, each with
 * its own creditor, deadline and paid figure. The preview returns
 * `debtorStats.outstandingDebt` (the total) and no per-contract breakdown, and
 * GET /api/v1/contracts lists the VIEWER's own contracts, not a third party's.
 * So the section is not drawn, and the total appears as §10.4's `Owed right now`
 * row instead — where it is honest, because "220" is a fact and "220 across 2"
 * would need a count nothing sends.
 */
export default function ContractScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const { data, isPending, isError, error, refetch } = useContractPreview(id);
  const decide = useContractDecision(id);
  const [failed, setFailed] = useState<string | null>(null);

  const apiError = error instanceof ApiError ? error : null;
  if (isError && apiError?.code === "UNAUTHENTICATED") {
    return <Splash waitingOn="Signing you back in" />;
  }

  if (isPending || !data) {
    return (
      <OfferScreenHost imeInset={0}>
        <OfferNav title="Offer" onBack={() => router.back()} />
        {isError ? (
          <LoadFailedPanel
            heading="Can't load this agreement"
            body={
              apiError?.message ??
              "The connection dropped. Nothing has changed — the agreement is still waiting for you."
            }
            onRetry={refetch}
          />
        ) : null}
      </OfferScreenHost>
    );
  }

  const { contract, debtorStats, debtor, terms } = data;
  const name = copy.firstName(debtor.name ?? "This trader");
  const deadline = new Date(terms.byDeadline);
  const days = daysUntil(deadline);

  /**
   * §10.4's summary line needs both items and both values. `debtorGives` is what
   * the creditor RECEIVES and `debtorReceives` is what they give — the endpoint
   * names them from the debtor's side, and getting that backwards would show the
   * creditor somebody else's trade.
   */
  const youReceive = terms.youReceiveNow;
  const youGive = terms.youGiveNow;

  const decided = decide.isSuccess;

  return (
    <OfferScreenHost imeInset={0}>
      <OfferNav title={copy.creditor.nav(name)} onBack={() => router.back()} />

      <ScrollView>
        {/* The trade itself, before anything about the promise. A creditor
            deciding on an agreement is first deciding on a swap. */}
        <Section pad={offerSpace.section.listingHeader}>
          <Text style={[textStyle(offerType.body), { color: offerColor.ink }]}>
            {youReceive && youGive
              ? copy.creditor.summary(
                  name,
                  youReceive.title,
                  youReceive.valueLeaves ?? 0,
                  youGive.title,
                  youGive.valueLeaves ?? 0,
                )
              : `An offer from ${name}.`}
          </Text>
          <Text
            style={[
              textStyle(offerType.leavesRow),
              { color: offerColor.inkSecondary, marginTop: 6 },
            ]}
          >
            {copy.creditor.summarySplit(
              data.trade.offeredLeaves ?? 0,
              contract.amountLeaves,
            )}
          </Text>
        </Section>

        <Hairline />

        {/*
          §1.7's "Pending acceptance" marker: a 1.5px `#C56A4B` OUTLINE block,
          never a fill. §1.4's rule for the whole system is "outline warns, fill
          fails", and a proposal awaiting an answer has not failed.
        */}
        <Section pad={offerSpace.section.offering}>
          <View
            style={{
              borderWidth: offerBorder.promise,
              borderColor: offerColor.promise,
              borderRadius: offerRadius.row,
              backgroundColor: offerColor.paper,
              padding: 14,
            }}
          >
            <Text style={[textStyle(offerType.body), { color: offerColor.ink }]}>
              {copy.creditor.notice(contract.amountLeaves, shortDate(deadline))}
            </Text>
            {/* §1.8: days remaining drive the mono colour and nothing else. */}
            <Text
              style={[
                textStyle(offerType.deadline),
                { color: deadlineInk(days), marginTop: 8 },
              ]}
            >
              {deadlineLabel(deadline)}
            </Text>
          </View>
        </Section>

        <Hairline />

        {/* §10.4's record — the four statistics the decision rests on. */}
        <Section pad={offerSpace.section.settle}>
          <SectionLabel>{copy.label.record(name)}</SectionLabel>
          <View style={{ marginTop: offerSpace.labelToContent }}>
            <RecordRow
              first
              label={copy.creditor.recordTrades}
              value={String(debtorStats.completedTrades)}
            />
            <RecordRow
              label={copy.creditor.recordOnTime}
              value={
                // NULL means no history, NEVER 0%. The server insists on this in
                // its own comment: a first-time debtor is unproven, not proven
                // bad, and the two deserve different answers.
                debtorStats.onTimeFulfillmentRate === null
                  ? copy.creditor.onTimeNone
                  : copy.creditor.onTimeOf(
                      Math.round(debtorStats.onTimeFulfillmentRate * debtor.finishedContracts),
                      debtor.finishedContracts,
                    )
              }
            />
            <RecordRow
              label={copy.creditor.recordDefaults}
              value={
                debtorStats.pastDefaults === 0
                  ? copy.creditor.defaultsNone
                  : debtor.hasUnsettledDefault
                    ? copy.creditor.defaultsStanding(debtorStats.pastDefaults)
                    : copy.creditor.defaultsSettled(debtorStats.pastDefaults)
              }
              // §1.4's fourth job: a mono value that is a debt or a default.
              tone={debtorStats.pastDefaults > 0 ? "warm" : "neutral"}
            />
            <RecordRow
              label={copy.creditor.recordOwed}
              value={
                debtorStats.outstandingDebt > 0
                  ? grouped(debtorStats.outstandingDebt)
                  : copy.creditor.owedNone
              }
              tone={debtorStats.outstandingDebt > 0 ? "warm" : "neutral"}
            />
          </View>

          <Text
            style={[
              textStyle(offerType.helper),
              { color: offerColor.inkTertiary, marginTop: offerSpace.paragraphToControl },
            ]}
          >
            {copy.creditor.footnote(
              contract.amountLeaves,
              name,
              debtorStats.outstandingDebt + contract.amountLeaves,
            )}
          </Text>
        </Section>

        <Hairline />

        {/* What the creditor is agreeing to, spelled out rather than inferred.
            The server writes these strings; they are shown verbatim because they
            are the true statement of what the platform will and will not do. */}
        <Section pad={offerSpace.section.settle}>
          <SectionLabel>What accepting means</SectionLabel>
          <View style={{ marginTop: offerSpace.labelToContent, gap: 10 }}>
            {terms.onDefault.map((line) => (
              <Text
                key={line}
                style={[textStyle(offerType.bodyDense), { color: offerColor.inkSecondary }]}
              >
                {line}
              </Text>
            ))}
          </View>

          <View
            style={{
              marginTop: offerSpace.paragraphToControl,
              borderWidth: offerBorder.promise,
              borderColor: offerColor.promise,
              borderRadius: offerRadius.row,
              padding: 14,
              flexDirection: "row",
              gap: 12,
            }}
          >
            <WarningTriangleIcon
              size={offerIcon.warning.size}
              stroke={offerIcon.warning.stroke}
              color={offerColor.warm}
            />
            <Text
              style={[textStyle(offerType.errorText), { color: offerColor.ink, flex: 1 }]}
            >
              {terms.noItemReturn}
            </Text>
          </View>
        </Section>

        {youReceive ? (
          <>
            <Hairline />
            <Section pad={offerSpace.section.settle}>
              <SectionLabel>{copy.label.whatYouSent}</SectionLabel>
              <View style={{ marginTop: offerSpace.labelToContent }}>
                <ItemRow
                  image={null}
                  title={youReceive.title}
                  meta={
                    youReceive.valueLeaves !== null
                      ? `${grouped(youReceive.valueLeaves)} Leaves · you receive`
                      : "you receive"
                  }
                />
              </View>
            </Section>
          </>
        ) : null}
      </ScrollView>

      {/*
        §10.4's three controls. `Decline` and `Accept` are §4's split pair — two
        flex:1 at 52 with an 8px gap — and `Accept without the 100` is the
        tertiary under them.

        THE WAIVE CONTROL IS NOT WIRED, AND IT SAYS SO BY BEING ABSENT. §10.4
        offers `Accept without the 100`, which means accepting the TRADE while
        forgiving the promise. POST /api/v1/contracts/[id]/decline declines the
        agreement and leaves the trade untouched, which is close — but "decline"
        and "accept the trade and waive the difference" differ in what happens to
        the trade next, and nothing on the wire says the two are the same. Rather
        than guess, the two controls that have exact endpoints are drawn.
      */}
      <OfferBottomBar
        above={
          failed ? (
            <View style={{ marginBottom: offerSpace.bottomBar.consequenceToButton }}>
              <Text style={[textStyle(offerType.errorText), { color: offerColor.warm }]}>
                {failed}
              </Text>
            </View>
          ) : undefined
        }
      >
        {decided ? (
          // §1.10: no colour event on success. The screen states what happened
          // in a mono line and the controls are gone. Nothing congratulates.
          <Text
            style={[
              textStyle(offerType.footnoteMono),
              { color: offerColor.inkSecondary, textAlign: "center" },
            ]}
          >
            {decide.variables === "accept"
              ? `Accepted · ${grouped(contract.amountLeaves)} due ${shortDate(deadline)}`
              : "Declined"}
          </Text>
        ) : (
          <View style={{ flexDirection: "row", gap: offerSize.button.splitGap }}>
            <View style={{ flex: 1 }}>
              <SecondaryButton
                label={copy.creditor.decline}
                onPress={() => run("decline")}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label={copy.creditor.accept} onPress={() => run("accept")} />
            </View>
          </View>
        )}
      </OfferBottomBar>
    </OfferScreenHost>
  );

  function run(action: "accept" | "decline") {
    setFailed(null);
    decide.mutate(action, {
      onError: (e) =>
        setFailed(
          e instanceof ApiError
            ? e.message
            : "That did not go through. Nothing has changed on your side.",
        ),
    });
  }
}
