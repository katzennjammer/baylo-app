import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { ApiError } from "../src/api/client";
import {
  useOfferContext,
  useSendOffer,
  useWithdrawOffer,
  MAX_OFFER_MESSAGE,
  type OfferDraft,
  type OfferableItem,
} from "../src/api/offer";
import { useKeyboardState } from "../src/components/auth-sheet";
import { Splash } from "../src/components/Splash";
import {
  Hairline,
  NavDone,
  OfferBottomBar,
  OfferNav,
  OfferScreenHost,
  PrimaryButton,
  SecondaryButton,
  SendingButton,
  Section,
  SectionLabel,
  useOfferBoard,
  useTightBoard,
} from "../src/components/offer/chrome";
import * as copy from "../src/components/offer/copy";
import { DpaProposal } from "../src/components/offer/DpaProposal";
import { GapFigure, GapSkeleton, GapTrack, TrackLegend } from "../src/components/offer/GapTrack";
import { ArrowsIcon, PromiseIcon } from "../src/components/offer/icons";
import { OfferSheet, PickerBody } from "../src/components/offer/OfferSheet";
import { PickerRow } from "../src/components/offer/PickerRow";
import {
  ChangeLink,
  HubRow,
  ItemRow,
  RouteRow,
  SettlementRow,
} from "../src/components/offer/rows";
import {
  LoadFailedPanel,
  NoItemsState,
  PendingOfferState,
  SendFailedPanel,
  SettlementSkeleton,
  TierTooLowState,
  VerifyPromiseBlock,
} from "../src/components/offer/states";
import {
  classifyGap,
  defaultChoice,
  deadlineFromDays,
  grouped,
  nextRung,
  shortTier,
  splitFor,
  TERM_PRESETS,
  type GapResult,
  type PromiseBlock,
  type SettlementChoice,
} from "../src/lib/gap";
import type { TrustTier } from "../src/lib/trust";
import {
  offerColor,
  offerIcon,
  offerKeyboard,
  offerSize,
  offerSpace,
  offerType,
  textStyle,
} from "../src/theme/offer-tokens";

/**
 * The offer flow. Direction A — one scrolling screen, the gap as a single
 * horizontal track.
 *
 * ══ A ROOT ROUTE, NOT A TAB SCREEN ═══════════════════════════════════════════
 *
 * This file used to be `app/(app)/offer.tsx` — a `Tabs.Screen` with
 * `href: null` — and the placeholder it replaces lived there. It has moved out
 * of the group for the same reason the post wizard did: a tab screen has the
 * 83px `TabBar` under whatever it pins to its own bottom, and §3.2's bottom bar
 * IS the bottom of the screen (732 hairline, 745 button, 818 safe area, no tab
 * bar anywhere in the table). Pushed over the tabs, closing it returns to
 * whichever tab was underneath.
 *
 * The path is unchanged, so `router.push({ pathname: "/offer", … })` on the item
 * detail screen still resolves and needed no edit.
 *
 * ══ WHAT THIS SCREEN IS RESPONSIBLE FOR ══════════════════════════════════════
 *
 * Choosing which of §5.1's five situations and §5.2's seven states is on screen,
 * and holding the draft. Every piece of geometry, every string and all the
 * arithmetic live elsewhere — `offer-tokens.ts`, `copy.ts`, `lib/gap.ts` — so
 * this file reads as a state machine rather than as a layout.
 *
 * ══ THE ONE PHASE THAT IS NOT A SEPARATE ROUTE ═══════════════════════════════
 *
 * §6g's DPA proposal is a phase of THIS screen rather than its own route, and
 * that is deliberate: a route change loses the draft, and the draft is the
 * chosen item, the settlement route and the message — everything the person has
 * done so far. The nav title changes to §10.3's `Deferred Points Agreement` and
 * the back chevron returns to the gap screen with the draft intact.
 */

type Phase = "gap" | "dpa" | "tierTooLow";

export default function OfferScreen() {
  const router = useRouter();
  const { itemId } = useLocalSearchParams<{ itemId?: string; title?: string }>();

  const { context, isPending, isError, error, refetch } = useOfferContext(itemId);
  const send = useSendOffer();
  const withdraw = useWithdrawOffer();

  /* ── the IME. See the note on `OfferScreenHost`. ────────────────────── */
  const { keyboardUp, imeHeight } = useKeyboardState();
  /** Which field has the keyboard, so §8.1 and §8.2 pick different layouts. */
  const [focusedField, setFocusedField] = useState<"amount" | "message" | null>(null);

  const tight = useTightBoard();
  const board = useOfferBoard();

  /* ── the draft ──────────────────────────────────────────────────────── */
  const [chosenIds, setChosenIds] = useState<string[] | null>(null);
  const [choice, setChoice] = useState<SettlementChoice | null>(null);
  const [promiseAmount, setPromiseAmount] = useState<number | null>(null);
  const [deadline, setDeadline] = useState<Date>(() =>
    deadlineFromDays(TERM_PRESETS[0].days),
  );
  const [message, setMessage] = useState("");
  const [hubId, setHubId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("gap");
  const [picker, setPicker] = useState<null | { multi: boolean }>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const owner = context ? copy.firstName(context.item.owner.name) : "";

  /* ── which item(s) are being offered ────────────────────────────────── */
  const chosen: OfferableItem[] = useMemo(() => {
    if (!context) return [];
    // Default: the item closest in value to the listing, which is the choice a
    // person is overwhelmingly likely to make and saves a sheet on the way in.
    // Nulls are excluded — an item with no value cannot be reasoned about.
    // An EMPTY array is treated as "no choice made", not as "nothing chosen".
    // Deselecting the last row in the multi-select picker would otherwise leave
    // `chosen` empty and drop the screen into the no-items state, which tells
    // somebody with a full shelf that they have nothing to offer.
    if (chosenIds === null || chosenIds.length === 0) {
      const valued = context.myItems.filter((i) => i.valueLeaves !== null);
      if (valued.length === 0) return [];
      const target = context.item.valueLeaves ?? 0;
      const best = valued.reduce((a, b) =>
        Math.abs((a.valueLeaves ?? 0) - target) <= Math.abs((b.valueLeaves ?? 0) - target) ? a : b,
      );
      return [best];
    }
    return context.myItems.filter((i) => chosenIds.includes(i.id));
  }, [context, chosenIds]);

  const yours = chosen.reduce((n, i) => n + (i.valueLeaves ?? 0), 0);
  const theirs = context?.item.valueLeaves ?? 0;

  /**
   * The ceiling every settlement row is capped at.
   *
   * `availableBalance` — the balance minus Leaves pledged to other PENDING
   * offers — falls back to the raw balance while /api/v1/trades is in flight,
   * NOT to 0: a first paint that offered nothing would show the wrong situation
   * for a moment and then change it, and the raw balance is right for everybody
   * with no other offers out, which is most people.
   */
  const spendable = context ? (context.availableBalance ?? context.balance) : 0;

  const gap: GapResult | null = context
    ? classifyGap({
        yours,
        theirs,
        balance: spendable,
        promiseCeiling: context.promiseCeiling,
      })
    : null;

  /**
   * §5.1's preselection, with one correction the spec does not contemplate.
   *
   * A large gap preselects the split — but a split promises nothing when the
   * promise routes are shut (an unverified ID, too few completed trades, an open
   * contract), and a preselected row the person cannot use is worse than no
   * preselection. So a blocked promise falls back to Leaves, which is the other
   * route that actually settles the gap.
   */
  const promisesOpen = (context?.promiseCeiling ?? 0) > 0;
  const fallback: SettlementChoice = gap
    ? promisesOpen
      ? defaultChoice(gap.situation)
      : gap.situation === "large" || gap.situation === "small"
        ? "leaves"
        : defaultChoice(gap.situation)
    : "asIs";
  const effectiveChoice = choice ?? fallback;
  const split = gap ? splitFor(effectiveChoice, gap) : { nowLeaves: 0, promised: 0 };
  // The DPA screen owns its own amount once it has been opened; before that it
  // starts from whatever the chosen route implies.
  const promised = promiseAmount ?? split.promised;

  const hub = context?.hubs.find((h) => h.id === hubId) ?? null;

  /* ── sending ────────────────────────────────────────────────────────── */
  const draft: OfferDraft | null =
    context && chosen.length > 0
      ? {
          postId: context.item.id,
          offeredItem: chosen[0],
          nowLeaves: split.nowLeaves,
          // The route the user chose, stated once and read three times below.
          // It is what `promiseIntended` carries to the send — see the note on
          // that field for why intent and amount are no longer the same fact.
          promiseIntended: effectiveChoice === "promise" || effectiveChoice === "split",
          promised: effectiveChoice === "promise" || effectiveChoice === "split" ? promised : 0,
          promiseDeadline:
            effectiveChoice === "promise" || effectiveChoice === "split" ? deadline : null,
          hubName: hub?.name ?? null,
          message,
        }
      : null;

  const onSend = useCallback(() => {
    if (!draft) return;
    setFailed(null);
    send.mutate(draft, {
      // §5.2: the screen changes to the next state and a mono line states what
      // happened. There is no success colour event and no confetti — §1.10.
      onSuccess: () => router.back(),
      onError: (e) => {
        // The server's own sentence when it refused, because it carries the
        // numbers this client cannot predict — see `SendFailedPanel`.
        if (e instanceof ApiError) {
          setFailed(e.status >= 400 && e.status < 500 ? e.message : null);
          return;
        }
        /*
         * A REFUSAL THIS CLIENT RAISED ITSELF still gets its sentence shown.
         *
         * `useSendOffer` throws a plain Error when a draft carries a promise it
         * cannot send. That message names the missing amount and says the offer
         * was not sent, which is strictly more useful than the panel's generic
         * transport line — and falling through to `null` here would have thrown
         * it away, which is how the silent skip stayed silent one layer up.
         */
        setFailed(e instanceof Error && e.message ? e.message : null);
      },
    });
  }, [draft, send, router]);

  /* ── 401 → the session guard is about to take over ──────────────────── */
  const apiError = error instanceof ApiError ? error : null;
  if (isError && apiError?.code === "UNAUTHENTICATED") {
    return <Splash waitingOn="Signing you back in" />;
  }

  /* ── loading: §5.2's own arrangement, not a blank screen ────────────── */
  if (isPending || !context || !gap) {
    return (
      <OfferScreenHost imeInset={0}>
        <OfferNav title={copy.chrome.navTitle} onBack={() => router.back()} />
        {isError ? (
          <LoadFailedPanel
            heading="Can't open this offer"
            body={
              apiError?.message ??
              "The connection dropped. Nothing has changed on your side — the listing is still there."
            }
            onRetry={refetch}
          />
        ) : (
          <View>
            <Hairline />
            <Section pad={offerSpace.section.gap}>
              <SectionLabel>{copy.label.gap}</SectionLabel>
              <View style={{ marginTop: offerSpace.gapBlock.labelToFigure }}>
                <GapSkeleton />
              </View>
            </Section>
            <Hairline />
            <Section pad={offerSpace.section.settle}>
              <SettlementSkeleton />
            </Section>
          </View>
        )}
      </OfferScreenHost>
    );
  }

  /* ═══ §5.2's blocking states, in the order they take precedence ═══════ */

  /**
   * A PENDING offer already stands. §5.2: "Status, not error."
   *
   * First, because everything below it would be composing a second offer on the
   * same listing — which POST /api/offers would accept, leaving two live offers
   * and two Leaf holds. Checked on `existingOffer` when /api/v1/trades has
   * answered and on `viewer.existingOfferId` when it has not, so the state is
   * never skipped just because the summary is not loaded yet.
   */
  const pendingId = context.existingOffer?.id ?? context.viewer.existingOfferId;
  if (pendingId) {
    return (
      <OfferScreenHost imeInset={0}>
        <OfferNav title={copy.chrome.navTitle} onBack={() => router.back()} />
        <ScrollView>
          <ListingHeader context={context} />
          <Hairline />
          {/*
            A withdrawal that the server refused — an offer accepted a second
            before the tap, most often. `failed` is set by the mutation and is
            rendered HERE as well as in the composer's bottom bar, because this
            branch has no bottom bar and a message set into a state nothing draws
            is the same as no message at all.
          */}
          {failed ? (
            <Section pad={offerSpace.section.offering}>
              <Text style={[textStyle(offerType.errorText), { color: offerColor.warm }]}>
                {failed}
              </Text>
            </Section>
          ) : null}

          {context.existingOffer ? (
            <PendingOfferState
              owner={owner}
              sentIso={context.existingOffer.createdAt}
              offeredItems={context.existingOffer.offeredItems}
              offeredLeaves={context.existingOffer.offeredLeaves}
              message={context.existingOffer.message}
              hubName={context.hubs[0]?.name ?? null}
              // §9's two shortened strings: `Withdraw and offer again` becomes
              // `Withdraw and re-offer` on the 360 board.
              withdrawLabel={board.withdraw}
              withdrawing={withdraw.isPending}
              onWithdraw={() =>
                withdraw.mutate(
                  { offerId: pendingId, postId: context.item.id },
                  // No navigation on success. The invalidation clears
                  // `existingOffer`, this branch stops matching, and the screen
                  // re-renders as the composer — which is what "and offer again"
                  // means. Sending the user back to the listing would make them
                  // tap in a second time.
                  {
                    onError: (e) =>
                      setFailed(e instanceof ApiError ? e.message : null),
                  },
                )
              }
              onLeaveIt={() => router.back()}
            />
          ) : (
            // The id is known and the contents are not yet. The heading and the
            // one working control are still true, so they are shown rather than
            // held behind a spinner for a summary.
            <Section pad={offerSpace.section.gap}>
              <Text style={[textStyle(offerType.screenHeading), { color: offerColor.ink }]}>
                {copy.pending.heading}
              </Text>
              <View style={{ marginTop: offerSpace.paragraphToControl }}>
                <SecondaryButton label={copy.pending.leaveIt} onPress={() => router.back()} />
              </View>
            </Section>
          )}
        </ScrollView>
      </OfferScreenHost>
    );
  }

  /**
   * §5.2: no items to offer. The listing header is RETAINED above it.
   *
   * Keyed on the SHELF, not on `chosen` — an empty selection falls back to the
   * default pick above, so the only way to reach this is genuinely owning
   * nothing tradeable. A shelf whose every item is unvalued lands here too,
   * which is the honest answer: the gap cannot be computed against any of them.
   */
  if (chosen.length === 0) {
    return (
      <OfferScreenHost imeInset={0}>
        <OfferNav title={copy.chrome.navTitle} onBack={() => router.back()} />
        <ScrollView>
          <ListingHeader context={context} />
          <Hairline />
          <NoItemsState
            owner={owner}
            theirItem={context.item.title}
            onPost={() => router.push("/post-item")}
          />
        </ScrollView>
      </OfferScreenHost>
    );
  }

  /**
   * The tier's ITEM-VALUE ceiling, which §5.2 does not draw and the server does
   * enforce: `enforceItemValueCeiling()` runs on POST /api/offers against the
   * listing this viewer would RECEIVE, and answers 403 above the cap. Without
   * this branch the whole screen composes and the send fails, which is exactly
   * the discover-it-by-403 shape §5.2 exists to remove.
   *
   * The panel is `LoadFailedPanel`'s shape with the server's own wording
   * reconstructed from the numbers, because §10 writes no copy for it.
   */
  if (context.tierItemCapExceeded && context.maxItemValueLeaves !== null) {
    return (
      <OfferScreenHost imeInset={0}>
        <OfferNav title={copy.chrome.navTitle} onBack={() => router.back()} />
        <ScrollView>
          <ListingHeader context={context} />
          <Hairline />
          <LoadFailedPanel
            heading={`A ${context.reputation.tier} can trade for up to ${grouped(context.maxItemValueLeaves)}`}
            body={
              `This listing is ${grouped(theirs)}. The limit rises with completed trades — ` +
              `it isn't about this item.`
            }
            onRetry={() => router.back()}
          />
        </ScrollView>
      </OfferScreenHost>
    );
  }

  /** §5.2: a standing default blocks every initiating path, offers included. */
  if (!context.reputation.restrictions.canInitiateTrades) {
    return (
      <OfferScreenHost imeInset={0}>
        <OfferNav title={copy.chrome.navTitle} onBack={() => router.back()} />
        <ScrollView>
          <ListingHeader context={context} />
          <Hairline />
          <LoadFailedPanel
            heading="An agreement of yours went past its date"
            body={
              `New offers open again once it is settled. You can still list items and accept ` +
              `offers, and Leaves you earn go straight to the ` +
              `${grouped(context.reputation.contracts.outstandingDebt)} still owed.`
            }
            onRetry={() => router.back()}
          />
        </ScrollView>
      </OfferScreenHost>
    );
  }

  /* ═══ §5.2's tier-too-low screen, replacing the DPA proposal ══════════ */

  if (phase === "tierTooLow") {
    const highest = context.myItems.reduce<OfferableItem | null>(
      (best, i) =>
        i.valueLeaves !== null && (best === null || i.valueLeaves > (best.valueLeaves ?? 0))
          ? i
          : best,
      null,
    );

    return (
      <OfferScreenHost imeInset={0}>
        <OfferNav title={copy.dpa.nav} onBack={() => setPhase("gap")} />
        <ScrollView>
          <TierTooLowState
            tier={context.reputation.tier}
            serverCeiling={context.reputation.limits.maxOutstandingDebtLeaves}
            completedTrades={context.reputation.completedTrades}
            gapNeeded={gap.short}
            balance={spendable}
            owner={owner}
            alternativeItem={
              highest && highest.id !== chosen[0].id && highest.valueLeaves !== null
                ? { title: highest.title, valueLeaves: highest.valueLeaves }
                : null
            }
            onSendLargestLegal={() => {
              setChoice("split");
              setPhase("gap");
            }}
            onChangeItem={() => {
              setPhase("gap");
              setPicker({ multi: false });
            }}
          />
        </ScrollView>
      </OfferScreenHost>
    );
  }

  /* ═══ §6g the DPA proposal ═══════════════════════════════════════════ */

  if (phase === "dpa") {
    const amountUp = keyboardUp && focusedField === "amount";
    return (
      <OfferScreenHost imeInset={amountUp ? imeHeight : 0}>
        <OfferNav
          title={copy.dpa.nav}
          onBack={amountUp ? null : () => setPhase("gap")}
          trailing={amountUp ? <NavDone onPress={() => setFocusedField(null)} /> : undefined}
        />
        <Hairline />
        <DpaProposal
          owner={owner}
          shortfall={gap.short}
          nowLeaves={split.nowLeaves}
          maxPromise={context.promiseCeiling}
          record={{
            completedTrades: context.reputation.completedTrades,
            onTimeRate: context.reputation.contracts.onTimeRate,
            outstandingDebt: context.reputation.contracts.outstandingDebt,
            lifetimeDefaults: context.reputation.contracts.lifetimeDefaults,
          }}
          amount={promised}
          onAmount={setPromiseAmount}
          deadline={deadline}
          onDeadline={setDeadline}
          keyboardUp={amountUp}
          onFocusAmount={() => setFocusedField("amount")}
          onBlurAmount={() => setFocusedField(null)}
          primaryLabel={copy.button.sendWithAgreement}
          /*
           * COMMIT THE AMOUNT THAT IS ON SCREEN, rather than only the one that
           * was typed.
           *
           * `promised` is `promiseAmount ?? split.promised` — so before anyone
           * touches the field this screen displays the route's implied amount,
           * puts it in the consequence line ("you owe 100 by 22 Sep"), and left
           * `promiseAmount` at null. Leaving here without typing therefore
           * returned to a gap screen that still said `Set up the agreement`,
           * whose button opened this screen again: a loop with no way out, and
           * the reason a promise could not be sent at all unless the user
           * happened to edit the amount field.
           *
           * Committing what is displayed makes the shown number the agreed one,
           * which is what the person reading it already believes.
           */
          onPrimary={() => {
            setPromiseAmount(promised);
            setPhase("gap");
          }}
        />
      </OfferScreenHost>
    );
  }

  /* ═══ §8.2 the message field, keyboard up ════════════════════════════ */

  if (keyboardUp && focusedField === "message") {
    return (
      <OfferScreenHost imeInset={imeHeight}>
        <OfferNav
          title={copy.chrome.navTitle}
          onBack={null}
          trailing={<NavDone onPress={() => setFocusedField(null)} />}
        />

        {/*
          §8.2's pinned mono line. It holds the offer state so it stays TRUE
          while the listing header, the offering section, the gap section and
          the hub section are all off screen — `Vans 440 → Air Max 480 · 40
          added`. 12px mono, 6/4/12 padding, a hairline below.
        */}
        <View
          style={{
            minHeight: offerKeyboard.pinnedLine.height,
            paddingTop: offerKeyboard.pinnedLine.top,
            paddingBottom: offerKeyboard.pinnedLine.bottom,
            paddingHorizontal: offerKeyboard.pinnedLine.x,
            justifyContent: "center",
          }}
        >
          <Text
            style={[textStyle(offerType.leavesRow), { color: offerColor.inkSecondary }]}
            numberOfLines={1}
          >
            {`${chosen[0].title} ${grouped(yours)} → ${context.item.title} ${grouped(theirs)}` +
              (split.nowLeaves > 0 ? ` · ${grouped(split.nowLeaves)} added` : "") +
              (promised > 0 && effectiveChoice !== "leaves" ? ` · ${grouped(promised)} promised` : "")}
          </Text>
        </View>
        <Hairline />

        <MessageField
          value={message}
          onChange={setMessage}
          autoFocus
          onFocus={() => setFocusedField("message")}
          onBlur={() => setFocusedField(null)}
          expand
        />
      </OfferScreenHost>
    );
  }

  /* ═══ §3.2 the offer screen at rest ══════════════════════════════════ */

  const sending = send.isPending;

  return (
    <OfferScreenHost imeInset={0} dimmed={sending}>
      <OfferNav
        title={copy.chrome.navTitle}
        // §5.2's "Sending": the back control is REMOVED, not disabled.
        onBack={sending ? null : () => router.back()}
      />

      <ScrollView scrollEnabled={!sending} keyboardShouldPersistTaps="handled">
        <ListingHeader context={context} />
        <Hairline />

        {/* §3.2 y 165 — `You're offering` */}
        <Section pad={offerSpace.section.offering}>
          <SectionLabel>{copy.label.offering}</SectionLabel>
          <View style={{ marginTop: offerSpace.labelToContent }}>
            <ItemRow
              image={chosen[0].image}
              title={
                chosen.length === 1
                  ? chosen[0].title
                  : `${chosen[0].title} and ${copy.spellCount(chosen.length - 1)} more`
              }
              meta={`${grouped(yours)} Leaves`}
              trailing={
                sending ? undefined : <ChangeLink onPress={() => setPicker({ multi: chosen.length > 1 })} />
              }
            />
          </View>
        </Section>
        <Hairline />

        {/* §3.2 y 275 — `The gap` */}
        <Section pad={offerSpace.section.gap}>
          <SectionLabel>{copy.label.gap}</SectionLabel>

          <View style={{ marginTop: offerSpace.gapBlock.labelToFigure }}>
            <GapFigure
              value={gapFigureValue(gap)}
              suffix={gapFigureSuffix(gap)}
              // §2 gives `Even` its own role — the "Gap word" at 40/36 — and
              // §5.1 puts `280 over` in `#1B4D2B` rather than in ink.
              word={gap.situation === "even"}
              tone={gap.situation === "over" ? "deep" : "ink"}
            />
          </View>

          <View style={{ marginTop: offerSpace.gapBlock.figureToTrack }}>
            <GapTrack gap={gap} yours={yours} theirs={theirs} />
          </View>

          <TrackLegend
            left={`${chosen[0].title} ${grouped(yours)}`}
            right={grouped(theirs)}
          />

          <Text
            style={[
              textStyle(offerType.body),
              { color: offerColor.inkSecondary, marginTop: offerSpace.gapBlock.legendToCopy },
            ]}
          >
            {gapBody(gap, {
              owner,
              yourItem: chosen[0].title,
              theirItem: context.item.title,
              balance: spendable,
              tier: context.reputation.tier,
            })}
          </Text>
        </Section>
        <Hairline />

        {/* §3.2 y 471 — the settlement section, which differs per §3.3 */}
        <SettlementSection
          gap={gap}
          choice={effectiveChoice}
          onChoice={setChoice}
          promiseBlocked={context.promiseBlocked}
          promiseUnavailableNote={copy.promiseUnavailable(context.promiseBlocked, {
            completedTrades: context.reputation.completedTrades,
            openContracts: context.reputation.contracts.openContracts,
            outstandingDebt: context.reputation.contracts.outstandingDebt,
          })}
          onVerify={() => router.push("/verify-id")}
          owner={owner}
          balance={spendable}
          myItemCount={context.myItems.length}
          myItemTotal={context.myItems.reduce((n, i) => n + (i.valueLeaves ?? 0), 0)}
          tier={context.reputation.tier}
          completedTrades={context.reputation.completedTrades}
          onOpenPicker={(multi) => setPicker({ multi })}
          onOpenDpa={() =>
            setPhase(context.promiseCeiling > 0 ? "dpa" : "tierTooLow")
          }
        />

        {/* §3.3 — the meet-up section takes the settlement section's place in
            the Even case, which is the one situation with nothing to settle. */}
        {gap.situation === "even" && context.hubs.length > 0 ? (
          <>
            <Hairline />
            <Section pad={offerSpace.section.settle}>
              <SectionLabel>{copy.label.meet}</SectionLabel>
              <View style={{ marginTop: offerSpace.labelToContent, gap: offerSpace.rowGap }}>
                {context.hubs.map((h) => (
                  <HubRow
                    key={h.id}
                    name={h.name}
                    active={h.isActive}
                    selected={hubId === h.id}
                    onPress={() => setHubId(hubId === h.id ? null : h.id)}
                  />
                ))}
              </View>
            </Section>
          </>
        ) : null}

        <Hairline />

        {/* §10.1's `Your message`. §8.2 is its keyboard-up arrangement. */}
        <Section pad={offerSpace.section.settle}>
          <SectionLabel>{copy.label.message}</SectionLabel>
          <MessageField
            value={message}
            onChange={setMessage}
            onFocus={() => setFocusedField("message")}
            onBlur={() => setFocusedField(null)}
          />
        </Section>
      </ScrollView>

      <OfferBottomBar
        above={
          failed !== null || send.isError ? (
            <SendFailedPanel
              owner={owner}
              heldLeaves={split.nowLeaves}
              serverMessage={failed}
              onRetry={onSend}
              onKeep={() => {
                setFailed(null);
                send.reset();
              }}
            />
          ) : undefined
        }
        footnote={
          sending
            ? copy.sending.footnote(split.nowLeaves)
            : bottomFootnote(gap, effectiveChoice, split.nowLeaves, spendable, owner, chosen[0].title)
        }
      >
        {sending ? (
          <SendingButton label={copy.sending.label} />
        ) : primaryIsSecondary(gap, effectiveChoice) ? (
          // §5.1: the very-large-gap primary is `Send as-is anyway` in SECONDARY
          // style. It is still the send — §5.1 forbids a disabled one — and the
          // style is what says the two routes above it are the better answer.
          <SecondaryButton
            label={primaryLabel(gap, effectiveChoice, promised, split.nowLeaves, tight)}
            onPress={onSend}
          />
        ) : (
          <PrimaryButton
            label={primaryLabel(gap, effectiveChoice, promised, split.nowLeaves, tight)}
            onPress={
              // §5.1: the large-gap default is a split, and its button is `Set up
              // the agreement` — which opens §6g rather than sending.
              needsDpaFirst(gap, effectiveChoice, promiseAmount) ? () => setPhase("dpa") : onSend
            }
          />
        )}
      </OfferBottomBar>

      {picker ? (
        <OfferSheet dismissible onDismiss={() => setPicker(null)}>
          <PickerBody
            heading={copy.chrome.sheetHeading}
            subtitle={copy.sheetSubtitle(owner, context.item.title, theirs)}
            footnote={copy.chrome.sheetFootnote}
            buttonLabel={copy.chrome.sheetButton}
            canUse={chosen.length > 0}
            onUse={() => setPicker(null)}
          >
            {context.myItems.map((item) => (
              <PickerRow
                key={item.id}
                title={item.title}
                image={item.image}
                valueLeaves={item.valueLeaves}
                selected={chosen.some((c) => c.id === item.id)}
                multi={picker.multi}
                unvaluedNote="Value not loaded"
                onPress={() => {
                  setChosenIds((current) => {
                    const base = current ?? chosen.map((c) => c.id);
                    if (!picker.multi) return [item.id];
                    return base.includes(item.id)
                      ? base.filter((id) => id !== item.id)
                      : [...base, item.id];
                  });
                  // A new item changes the gap, so a settlement route chosen
                  // against the old one is no longer the user's decision — it
                  // falls back to §5.1's default for whatever situation results.
                  setChoice(null);
                  setPromiseAmount(null);
                }}
              />
            ))}
          </PickerBody>
        </OfferSheet>
      ) : null}
    </OfferScreenHost>
  );
}

/* ─────────────────────── §3.2's listing header ──────────────────────── */

/**
 * y 88 — a 56px photo with a title and a mono line, then a hairline.
 *
 * §5.2: this block "renders from cached feed data immediately", which it does
 * for free — `useItem()` and the feed share nothing, but the item detail screen
 * this is reached from has already populated `["item", id]`, so the query
 * resolves from cache on mount.
 */
function ListingHeader({
  context,
}: {
  context: NonNullable<ReturnType<typeof useOfferContext>["context"]>;
}) {
  const { item } = context;
  return (
    <Section pad={offerSpace.section.listingHeader}>
      <ItemRow
        image={item.images[0] ?? null}
        title={item.title}
        meta={
          item.valueLeaves !== null
            ? `${grouped(item.valueLeaves)} Leaves · ${copy.firstName(item.owner.name)}`
            : `${copy.firstName(item.owner.name)}`
        }
      />
    </Section>
  );
}

/* ───────────────────── §3.3's five settlement sections ──────────────── */

/**
 * The section at y 471, which is a different section in each situation.
 *
 * §3.3, exactly: Even has NO settlement section (it is absent, not disabled, and
 * the meet-up section takes its place); "offering more" gets `The difference`
 * with two 56px rows; small gets three 60s; large gets four; very large gets
 * `What works instead` with two routes.
 */
function SettlementSection({
  gap,
  choice,
  onChoice,
  promiseBlocked,
  promiseUnavailableNote,
  onVerify,
  owner,
  balance,
  myItemCount,
  myItemTotal,
  tier,
  completedTrades,
  onOpenPicker,
  onOpenDpa,
}: {
  gap: GapResult;
  choice: SettlementChoice;
  onChoice: (c: SettlementChoice) => void;
  promiseBlocked: PromiseBlock;
  promiseUnavailableNote: string | null;
  onVerify: () => void;
  owner: string;
  balance: number;
  myItemCount: number;
  myItemTotal: number;
  tier: TrustTier;
  /** For §10.2's `Two more trades makes you Rising` — how many are still needed. */
  completedTrades: number;
  onOpenPicker: (multi: boolean) => void;
  onOpenDpa: () => void;
}) {
  // §3.3: absent, not disabled.
  if (gap.situation === "even") return null;

  if (gap.situation === "over") {
    return (
      <>
        <Hairline />
        <Section pad={offerSpace.section.settle}>
          <SectionLabel>{copy.label.difference}</SectionLabel>
          <View style={{ marginTop: offerSpace.labelToContent, gap: offerSpace.rowGap }}>
            <SettlementRow
              title={copy.over.askLeaves(owner, gap.over)}
              selected={choice === "askLeaves"}
              onPress={() => onChoice("askLeaves")}
            />
            <SettlementRow
              title={copy.over.asIs}
              selected={choice === "asIs"}
              onPress={() => onChoice("asIs")}
            />
          </View>
        </Section>
      </>
    );
  }

  if (gap.situation === "veryLarge") {
    const next = nextRung(tier);
    return (
      <>
        <Hairline />
        <Section pad={offerSpace.section.settle}>
          <SectionLabel>{copy.label.whatWorks}</SectionLabel>
          <View style={{ marginTop: offerSpace.labelToContent, gap: offerSpace.rowGap }}>
            {/*
              `Offer more than one item` has somewhere to go — POST /api/offers
              takes an `offeredItems` array — so it gets the chevron and opens
              the picker in multi-select. See the note on `RouteRow`.
            */}
            <RouteRow
              icon={
                <ArrowsIcon
                  size={offerSize.routeRow.icon}
                  stroke={offerIcon.inlineRow.stroke}
                  color={offerColor.inkSecondary}
                />
              }
              title={copy.veryLarge.multiItem}
              subtitle={copy.veryLarge.multiItemSub(myItemCount, myItemTotal)}
              onPress={() => onOpenPicker(true)}
            />
            {/*
              `Watch this listing` has NOWHERE to go: the schema has no saved,
              watched or bookmarked model, only `PostLike`. So no chevron and no
              handler — it is information about what time will do, which is
              exactly what its subtitle says.
            */}
            {next ? (
              <RouteRow
                icon={
                  <PromiseIcon
                    size={offerSize.routeRow.icon}
                    stroke={offerIcon.inlineRow.stroke}
                    color={offerColor.inkSecondary}
                  />
                }
                title={copy.veryLarge.watch}
                subtitle={copy.veryLarge.watchSub(
                  Math.max(1, next.minTrades - completedTrades),
                  shortTier(next.tier),
                  next.ceiling ?? 0,
                )}
              />
            ) : null}
          </View>
        </Section>
      </>
    );
  }

  /* small and large — a radio list, with the promise rows gated. */
  const locked = promiseBlocked !== "none";
  const after = Math.max(0, balance - gap.short);

  return (
    <>
      <Hairline />
      <Section pad={offerSpace.section.settle}>
        <SectionLabel>{copy.label.settle(gap.short)}</SectionLabel>
        <View style={{ marginTop: offerSpace.labelToContent, gap: offerSpace.rowGap }}>
          {gap.situation === "small" ? (
            <>
              <SettlementRow
                title={copy.small.addLeaves(gap.short)}
                subtitle={copy.small.balanceAfter(balance, after)}
                selected={choice === "leaves"}
                onPress={() => onChoice("leaves")}
              />
              <SettlementRow
                title={copy.small.asIs}
                subtitle={copy.small.asIsSub(owner, gap.short)}
                selected={choice === "asIs"}
                onPress={() => onChoice("asIs")}
              />
              <SettlementRow
                title={locked ? copy.notVerified.rowTitle : copy.small.promise}
                subtitle={locked ? promiseUnavailableNote : copy.small.promiseSub}
                selected={choice === "promise"}
                locked={locked}
                onPress={() => {
                  onChoice("promise");
                  onOpenDpa();
                }}
              />
            </>
          ) : (
            <>
              <SettlementRow
                title={copy.large.addAll(gap.short)}
                subtitle={copy.small.balanceAfter(balance, after)}
                selected={choice === "leaves"}
                onPress={() => onChoice("leaves")}
              />

              {/*
                §5.2's "Not ID-verified" says ONLY THE DPA ROW CHANGES, singular.
                A large gap has two promise rows, and locking both would print
                the same refusal twice — so when promises are shut they collapse
                into the one locked row the spec describes, and the four-row
                arrangement returns the moment the gate opens.
              */}
              {locked ? (
                <SettlementRow
                  title={copy.notVerified.rowTitle}
                  subtitle={promiseUnavailableNote}
                  selected={false}
                  locked
                  onPress={() => undefined}
                />
              ) : (
                <>
                  <SettlementRow
                    title={copy.large.split(
                      Math.max(0, gap.short - gap.promiseCeiling),
                      Math.min(gap.short, gap.promiseCeiling),
                    )}
                    subtitle={copy.large.splitSub}
                    selected={choice === "split"}
                    onPress={() => {
                      onChoice("split");
                      onOpenDpa();
                    }}
                  />
                  <SettlementRow
                    title={copy.large.promiseWhole(gap.short)}
                    subtitle={copy.large.promiseWholeSub}
                    selected={choice === "promise"}
                    onPress={() => {
                      onChoice("promise");
                      onOpenDpa();
                    }}
                  />
                </>
              )}

              <SettlementRow
                title={copy.large.asIs}
                subtitle={copy.large.asIsSub}
                selected={choice === "asIs"}
                onPress={() => onChoice("asIs")}
              />
            </>
          )}
        </View>

        {/* §5.2's "Not ID-verified": a 48px verify button below the rows and a
            12px footnote. Only for the ID gate — the other four refusals have no
            control that would fix them, so they stop at the row's subtitle. */}
        {promiseBlocked === "idUnverified" ? <VerifyPromiseBlock onVerify={onVerify} /> : null}
      </Section>
    </>
  );
}

/* ────────────────────── §10.1's message field ───────────────────────── */

/**
 * `Add a message (optional)` with §10.1's counter row.
 *
 * §8.2's keyboard-up version is the same component with `expand`, which lets the
 * text area fill the free space and pins the counter to the bottom of it —
 * "Counter row `Optional` / `124 / 400` at the bottom of the free space".
 */
function MessageField({
  value,
  onChange,
  autoFocus = false,
  onFocus,
  onBlur,
  expand = false,
}: {
  value: string;
  onChange: (s: string) => void;
  autoFocus?: boolean;
  onFocus: () => void;
  onBlur: () => void;
  expand?: boolean;
}) {
  return (
    <View
      style={
        expand
          ? { flex: 1, paddingHorizontal: offerSpace.screenX, paddingTop: offerSpace.section.settle.top }
          : { marginTop: offerSpace.labelToContent }
      }
    >
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        autoFocus={autoFocus}
        multiline
        // The server's own MAX_MESSAGE, so the composer stops rather than being
        // refused. Mirrored in `src/api/offer.ts`.
        maxLength={MAX_OFFER_MESSAGE}
        placeholder={copy.chrome.messagePlaceholder}
        placeholderTextColor={offerColor.inkTertiary}
        textAlignVertical="top"
        style={[
          textStyle(offerType.body),
          {
            color: offerColor.ink,
            // §8.2 lets it fill; at rest it is a fixed three-line box, which is
            // enough to read a whole message without the field dominating the
            // section above it.
            ...(expand ? { flex: 1 } : { minHeight: 72 }),
            padding: 0,
          },
        ]}
        cursorColor={offerColor.green}
        selectionColor={offerColor.green}
        accessibilityLabel={copy.label.message}
      />

      <View
        style={{
          marginTop: offerSpace.labelToContent,
          paddingBottom: expand ? offerSpace.section.settle.bottom : 0,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}>
          {copy.chrome.messageOptional}
        </Text>
        <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}>
          {copy.messageCounter(value.length, MAX_OFFER_MESSAGE)}
        </Text>
      </View>
    </View>
  );
}

/* ─────────────────── §5.1's figures, labels and footnotes ───────────── */

/** §5.1's figure column. `Even` is a WORD; every other situation is a number. */
function gapFigureValue(gap: GapResult): string {
  if (gap.situation === "even") return copy.even.figure;
  if (gap.situation === "over") return `${grouped(gap.over)} over`;
  return grouped(gap.short);
}

/** The mono suffix beside it. `40 apart` for Even, `Leaves short` otherwise. */
function gapFigureSuffix(gap: GapResult): string | null {
  if (gap.situation === "even") return copy.even.suffix(gap.apart);
  // §5.1 gives "offering more" no suffix — the figure already reads "280 over"
  // and `Leaves` is spelled once per context, which the legend below does.
  if (gap.situation === "over") return null;
  return "Leaves short";
}

/** §10.2's five bodies. */
function gapBody(
  gap: GapResult,
  ctx: {
    owner: string;
    yourItem: string;
    theirItem: string;
    balance: number;
    tier: TrustTier;
  },
): string {
  switch (gap.situation) {
    case "even":
      return copy.even.body;
    case "over":
      return copy.over.body(ctx.yourItem, gap.over, ctx.owner, ctx.theirItem);
    case "small":
      return copy.small.body(ctx.balance);
    case "large":
      return copy.large.body(ctx.balance, Math.max(0, ctx.balance - gap.short));
    case "veryLarge":
      return copy.veryLarge.body(
        Math.min(ctx.balance, gap.short),
        Math.max(0, gap.short - ctx.balance),
        ctx.tier,
      );
  }
}

/** §5.1's primary button column, and §9's two shortened strings. */
function primaryLabel(
  gap: GapResult,
  choice: SettlementChoice,
  promised: number,
  nowLeaves: number,
  tight: boolean,
): string {
  if (gap.situation === "veryLarge") return copy.button.sendAsIsAnyway;
  if (gap.situation === "even" || gap.situation === "over") return copy.button.send;

  if (choice === "asIs") return copy.button.send;
  if (choice === "leaves") return copy.button.sendWithLeaves(nowLeaves);
  // A promise route that has not been through §6g yet says what happens next;
  // one that has says what will be sent. §10.1 gives both strings.
  if (promised <= 0) return copy.button.setUpAgreement;
  if (choice === "promise") return copy.button.sendWithAgreement;
  return copy.button.sendWithBoth(nowLeaves, promised, tight);
}

/** §5.1: the very-large-gap send is secondary STYLE, not a secondary action. */
function primaryIsSecondary(gap: GapResult, _choice: SettlementChoice): boolean {
  return gap.situation === "veryLarge";
}

/**
 * True when the button should open §6g instead of sending.
 *
 * A promise route whose amount has not been set yet has nothing to promise, so
 * `Set up the agreement` opens the proposal; once §6g has been visited and an
 * amount stands, the same row's button sends.
 *
 * ── `<= 0`, NOT `=== null`, AND THAT IS THE WHOLE BUG ───────────────────────
 *
 * `null` means "never visited §6g". Zero means "visited it and left the amount
 * empty" — which the amount field produces on its own, because clearing the
 * input calls `onAmount(0)`. Testing only for null let a zero through, and a
 * zero is not a promise:
 *
 *   - `primaryLabel()` reads `promised <= 0` and prints `Set up the agreement`,
 *   - this returned false, so that button's onPress was `onSend`,
 *   - and `useSendOffer` skipped the contract POST because `promised > 0` was
 *     false.
 *
 * A button labelled `Set up the agreement` sent a bare offer, and the promise
 * was discarded without a word. Both halves now agree on the same test, so the
 * label and the action cannot disagree again.
 */
function needsDpaFirst(
  gap: GapResult,
  choice: SettlementChoice,
  promiseAmount: number | null,
): boolean {
  if (gap.situation !== "small" && gap.situation !== "large") return false;
  if (choice !== "promise" && choice !== "split") return false;
  return promiseAmount === null || promiseAmount <= 0;
}

/** §10.1's four footnotes, chosen by what the bar is about to do. */
function bottomFootnote(
  gap: GapResult,
  choice: SettlementChoice,
  nowLeaves: number,
  balance: number,
  owner: string,
  yourItem: string,
): string {
  if (gap.situation === "veryLarge") return copy.veryLarge.footnote(yourItem, owner);
  if (nowLeaves > 0) return copy.footnote.heldFrom(nowLeaves, balance, owner);
  if (choice === "promise" || choice === "split") return copy.footnote.amountNext;
  return copy.footnote.threeDays(owner);
}
