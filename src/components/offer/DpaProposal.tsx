import { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { CalendarIcon } from "./icons";
import { ChevronRightIcon } from "../icons";
import { Tappable } from "../Tappable";
import { OfferSheet } from "./OfferSheet";
import { RecordRow } from "./rows";
import {
  Hairline,
  OfferBottomBar,
  PrimaryButton,
  Section,
  SectionLabel,
  useTightBoard,
} from "./chrome";
import * as copy from "./copy";
import {
  DPA_TERM,
  TERM_PRESETS,
  daysUntil,
  deadlineFromDays,
  grouped,
  legalDeadlines,
  shortDate,
} from "../../lib/gap";
import {
  deadlineInk,
  offerBorder,
  offerColor,
  offerIcon,
  offerKeyboard,
  offerRadius,
  offerSize,
  offerSpace,
  offerType,
  textStyle,
} from "../../theme/offer-tokens";

/**
 * §6g / §8.1 — the Deferred Points Agreement proposal.
 *
 * ── WHAT THIS SCREEN CAN AND CANNOT DO, SAID ONCE AND PLAINLY ───────────────
 *
 * It collects an amount and a deadline and shows the proposer their own record
 * exactly as the creditor will see it. It does NOT create a contract, because
 * POST /api/v1/contracts takes a `tradeId` and refuses anything whose trade is
 * not already ACCEPTED or CONFIRMING — and at offer time there is no trade. The
 * full reasoning is in the header of `src/api/offer.ts`.
 *
 * So the copy on this screen never claims the agreement exists. §10.3's own
 * intro is careful about this already — "A recorded promise to Marco. The trade
 * goes ahead now" — and the bottom bar's consequence copy is §10.3's verbatim,
 * describing what happens if the deadline is missed once the agreement is live.
 * What is added is one mono line saying when it becomes live, because a screen
 * that collected a deadline and said nothing about when the clock starts would
 * be implying it starts now.
 *
 * ── EVERY GATE THE SERVER APPLIES IS APPLIED BEFORE THIS SCREEN OPENS ───────
 *
 * ID verification, the three-completed-trades floor, tier eligibility, the
 * one-open-contract rule and the debt headroom are all resolved by
 * `promiseBlock()` in `useOfferContext`, and a blocked promise route never
 * reaches here — §5.2 draws the refusal instead. This screen therefore has no
 * "you are not allowed" state of its own, which is deliberate: two places
 * deciding the same thing is how they come to disagree.
 */

export interface DpaProposalProps {
  /** The owner's first name — every sentence in §10.3 and §10.4 names them. */
  owner: string;
  /** The shortfall this agreement is part of settling. */
  shortfall: number;
  /** Leaves being added now, so the constraint row can state the split. */
  nowLeaves: number;
  /** The proposer's ceiling: `remainingDebtHeadroom`. §10.3's `max 400`. */
  maxPromise: number;
  /**
   * §10.3's record rows, from /api/v1/profile/me's `reputation`.
   *
   * NO `finishedContracts`. §10.4's creditor view writes the on-time figure as
   * `5 of 6`, and it can: the contract preview endpoint sends
   * `debtor.finishedContracts` as the denominator. /api/v1/profile/me sends
   * `onTimeRate` and no count, so THIS screen shows the rate as a percentage
   * instead of inventing a denominator. §10.3 does not fix the format for this
   * row, so the two readings do not conflict.
   */
  record: {
    completedTrades: number;
    onTimeRate: number | null;
    outstandingDebt: number;
    lifetimeDefaults: number;
  };
  /** The amount, owned by the screen above so it survives a back-and-forth. */
  amount: number;
  onAmount: (n: number) => void;
  deadline: Date;
  onDeadline: (d: Date) => void;
  /** True while the IME is up — §8.1's reflow. */
  keyboardUp: boolean;
  onFocusAmount: () => void;
  onBlurAmount: () => void;
  primaryLabel: string;
  onPrimary: () => void;
}

export function DpaProposal(props: DpaProposalProps) {
  const {
    owner,
    nowLeaves,
    maxPromise,
    record,
    amount,
    onAmount,
    deadline,
    onDeadline,
    keyboardUp,
    onFocusAmount,
    onBlurAmount,
    primaryLabel,
    onPrimary,
  } = props;

  const tight = useTightBoard();
  const [dateSheet, setDateSheet] = useState(false);

  const days = daysUntil(deadline);
  const deadlineText = `${shortDate(deadline)} · ${days} ${days === 1 ? "day" : "days"}`;

  /* ── §8.1: the keyboard-up arrangement ─────────────────────────────────
     Keeps the label, the field and the constraint row (98px together), adds one
     40px summary line, and drops the deadline presets, the record table, the
     consequence copy and the footer button. The nav's `Done` is what closes it,
     and it is supplied by the screen above because it belongs to the nav bar. */
  if (keyboardUp) {
    return (
      <View style={{ flex: 1 }}>
        <Section pad={offerSpace.section.dpaBand}>
          <SectionLabel>{copy.dpa.amountLabel}</SectionLabel>
          <AmountField
            amount={amount}
            onAmount={onAmount}
            max={maxPromise}
            autoFocus
            onFocus={onFocusAmount}
            onBlur={onBlurAmount}
            tight={tight}
          />
          <ConstraintRow now={nowLeaves} promised={amount} max={maxPromise} />
        </Section>

        <Hairline />

        {/* §8.1's one summary line, replacing the whole record table. It is the
            three figures a person actually needs while typing an amount: when
            they have said they will settle, and what their record says. */}
        <View
          style={{
            height: offerKeyboard.summaryLine,
            justifyContent: "center",
            paddingHorizontal: offerSpace.screenX,
          }}
        >
          <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.inkSecondary }]}>
            {copy.dpa.keyboardSummary(
              shortDate(deadline),
              record.completedTrades,
              record.lifetimeDefaults,
            )}
          </Text>
        </View>
      </View>
    );
  }

  /* ── §3.4: the resting arrangement ──────────────────────────────────── */
  return (
    <View style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Section pad={offerSpace.section.dpaIntro}>
          <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
            {copy.dpa.intro(owner)}
          </Text>
        </Section>

        <Hairline />

        {/* Amount: label 11, field 50 (10 padding + the 1.5 underline), a 12px
            constraint row. §3.4's own breakdown. */}
        <Section pad={offerSpace.section.dpaBand}>
          <SectionLabel>{copy.dpa.amountLabel}</SectionLabel>
          <AmountField
            amount={amount}
            onAmount={onAmount}
            max={maxPromise}
            onFocus={onFocusAmount}
            onBlur={onBlurAmount}
            tight={tight}
          />
          <ConstraintRow now={nowLeaves} promised={amount} max={maxPromise} />
        </Section>

        <Hairline />

        <Section pad={offerSpace.section.dpaBand}>
          <SectionLabel>{copy.dpa.deadlineLabel}</SectionLabel>

          {/*
            §10.3 names three presets and only two are legal — see the note on
            `TERM_PRESETS`. `flex: 1` each with an 8px gap, which is §4's rule
            and produces two 175s at 390 instead of three 110s.
          */}
          <View
            style={{
              marginTop: offerSpace.labelToContent,
              flexDirection: "row",
              gap: offerSpace.dpa.presetGap,
            }}
          >
            {TERM_PRESETS.map((preset) => {
              const presetDate = deadlineFromDays(preset.days);
              const selected = shortDate(presetDate) === shortDate(deadline);
              return (
                <Tappable
                  key={preset.days}
                  onPress={() => onDeadline(presetDate)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${preset.label}, ${shortDate(presetDate)}`}
                  style={{
                    flex: 1,
                    minHeight: offerSize.datePreset.minHeight,
                    borderRadius: offerRadius.row,
                    borderWidth: selected ? offerBorder.selected : offerBorder.rule,
                    borderColor: selected ? offerColor.selected : offerColor.rule,
                    backgroundColor: selected ? offerColor.tintGreen : offerColor.paper,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                  }}
                  pressedStyle={{ backgroundColor: offerColor.quiet }}
                >
                  <Text style={[textStyle(offerType.chip), { color: offerColor.ink }]}>
                    {tight ? preset.labelTight : preset.label}
                  </Text>
                  <Text
                    style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}
                  >
                    {shortDate(presetDate)}
                  </Text>
                </Tappable>
              );
            })}
          </View>

          {/* §3.4: a 52px date row, 12 below the presets. §8.3: it opens a
              SHEET, not a keyboard, so nothing about this screen reflows. */}
          <Tappable
            onPress={() => setDateSheet(true)}
            accessibilityRole="button"
            accessibilityLabel={`${copy.dpa.datePickAnother}. Currently ${deadlineText}.`}
            style={{
              marginTop: offerSpace.dpa.presetsToDateRow,
              minHeight: offerSize.dateRow.minHeight,
              borderRadius: offerRadius.row,
              borderWidth: offerBorder.rule,
              borderColor: offerColor.rule,
              paddingHorizontal: offerSize.settleRow.padX,
              flexDirection: "row",
              alignItems: "center",
              gap: offerSize.settleRow.gap,
            }}
            pressedStyle={{ backgroundColor: offerColor.quiet }}
          >
            <CalendarIcon
              size={offerSize.dateRow.icon}
              stroke={offerIcon.inlineRowSmall.stroke}
              color={offerColor.inkTertiary}
            />
            <Text style={[textStyle(offerType.itemTitleRow), { color: offerColor.ink, flex: 1 }]}>
              {copy.dpa.datePickAnother}
            </Text>
            {/* §1.8 colours this mono line by days remaining and nothing else. */}
            <Text style={[textStyle(offerType.deadline), { color: deadlineInk(days) }]}>
              {deadlineText}
            </Text>
            <ChevronRightIcon
              size={offerSize.dateRow.chevron}
              stroke={offerIcon.chevron.stroke}
              color={offerColor.inkDisabled}
            />
          </Tappable>
        </Section>

        <Hairline />

        {/* §10.3's record. The same three figures the creditor's preview will
            show them, so the proposer is not surprised by their own record. */}
        <Section pad={offerSpace.section.dpaBand}>
          <SectionLabel>{copy.label.yourRecord}</SectionLabel>
          <View style={{ marginTop: offerSpace.labelToContent }}>
            <RecordRow
              first
              label={copy.dpa.recordTrades}
              value={String(record.completedTrades)}
            />
            <RecordRow
              label={copy.dpa.recordOnTime}
              value={
                record.onTimeRate === null
                  ? copy.creditor.onTimeNone
                  : `${Math.round(record.onTimeRate * 100)}%`
              }
            />
            <RecordRow
              label={copy.dpa.recordOwed}
              value={
                record.outstandingDebt > 0
                  ? grouped(record.outstandingDebt)
                  : copy.creditor.owedNone
              }
              // §1.4's fourth job: a mono value that IS a debt.
              tone={record.outstandingDebt > 0 ? "warm" : "neutral"}
            />
          </View>
        </Section>
      </ScrollView>

      {/* §3.4's bar: consequence copy 12/18, a 9px gap, the 52 button. */}
      <OfferBottomBar
        above={
          <View style={{ marginBottom: offerSpace.bottomBar.consequenceToButton }}>
            <Text style={[textStyle(offerType.helper), { color: offerColor.inkSecondary }]}>
              {copy.dpa.consequence(shortDate(deadline), amount)}
            </Text>
          </View>
        }
      >
        {/*
          AN EMPTY AMOUNT CANNOT LEAVE THIS SCREEN.

          The field reports an empty box as `onAmount(0)`, and a zero-Leaf
          promise is not a promise — it is the absence of one. Letting it out of
          here is what put a bare offer on the wire under a button that said
          `Send with the agreement`, with nothing anywhere saying the promise had
          been dropped. So the control states the gap and does not act.

          The AMOUNT is the only thing that can be missing: `deadline` is seeded
          from `TERM_PRESETS[0]` and is a Date from the first render, so there is
          no empty-deadline state to guard.
        */}
        <PrimaryButton
          label={amount > 0 ? primaryLabel : copy.dpa.amountMissing}
          onPress={onPrimary}
          disabled={amount <= 0}
          disabledHint="Enter how many Leaves you are promising."
        />
      </OfferBottomBar>

      {dateSheet ? (
        <DateSheet
          selected={deadline}
          onPick={(d) => {
            onDeadline(d);
            setDateSheet(false);
          }}
          onClose={() => setDateSheet(false)}
        />
      ) : null}
    </View>
  );
}

/* ────────────────────────── the amount field ────────────────────────── */

/**
 * §4's amount field: full width, 40px mono, 10px bottom padding, a 1.5px
 * underline, and a 2 × 34 `#3DBE5A` caret.
 *
 * ── THE CARET IS THE PLATFORM'S, RECOLOURED ─────────────────────────────────
 *
 * `cursorColor` on Android and `selectionColor` on iOS both take the green, so
 * the caret §4 sizes is the real one rather than a drawn rectangle sitting
 * beside a hidden input. A drawn caret has to be blinked, positioned and
 * hidden on blur by hand, and it desynchronises from the text on every
 * platform-specific edit — a long-press paste, a swipe-typed word.
 *
 * ── THE VALUE IS AN INTEGER AND IS CLAMPED ON THE WAY IN ────────────────────
 *
 * Leaves are whole units and the server's `amountLeaves` is `z.number().int()`
 * with a minimum of 1. The field therefore strips everything but digits and
 * caps at `max` — the tier's remaining headroom — so the constraint row can
 * never disagree with what the server would accept. §10.3's `max 400` is that
 * cap stated out loud, which is what makes the clamp legible rather than
 * mysterious.
 */
function AmountField({
  amount,
  onAmount,
  max,
  autoFocus = false,
  onFocus,
  onBlur,
  tight,
}: {
  amount: number;
  onAmount: (n: number) => void;
  max: number;
  autoFocus?: boolean;
  onFocus: () => void;
  onBlur: () => void;
  tight: boolean;
}) {
  const [focused, setFocused] = useState(autoFocus);

  return (
    <View
      style={{
        marginTop: offerSpace.labelToContent,
        paddingBottom: offerSize.amountField.padBottom,
        borderBottomWidth: offerBorder.field,
        // §1.5: `#14140F` at rest, `#1B4D2B` focused.
        borderBottomColor: focused ? offerColor.fieldActive : offerColor.field,
      }}
    >
      <TextInput
        value={amount > 0 ? String(amount) : ""}
        onChangeText={(text) => {
          const digits = text.replace(/[^0-9]/g, "");
          const n = digits === "" ? 0 : Number(digits);
          onAmount(Math.min(Number.isFinite(n) ? n : 0, max));
        }}
        onFocus={() => {
          setFocused(true);
          onFocus();
        }}
        onBlur={() => {
          setFocused(false);
          onBlur();
        }}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        // §8.1's screen is a number pad, so there is nothing to autocorrect and
        // no reason for the OS to offer a suggestion strip over it.
        autoCorrect={false}
        // §9: 40 on the wide board, 36 on the tight one.
        style={[
          textStyle(offerType.amountField),
          {
            color: offerColor.ink,
            fontSize: tight ? 36 : 40,
            // A TextInput's own line box would clip a 40px mono descender the
            // same way a Text's does; the explicit height is the field's 40 plus
            // the room the glyph needs under the baseline.
            height: 48,
            padding: 0,
          },
        ]}
        cursorColor={offerColor.green}
        selectionColor={offerColor.green}
        accessibilityLabel={copy.dpa.amountLabel}
        placeholder="0"
        placeholderTextColor={offerColor.inkTertiary}
      />
    </View>
  );
}

/** §3.4's 12px constraint row: the split on the left, the ceiling on the right. */
function ConstraintRow({
  now,
  promised,
  max,
}: {
  now: number;
  promised: number;
  max: number;
}) {
  return (
    <View
      style={{
        marginTop: offerSpace.labelToContent,
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.inkSecondary }]}>
        {copy.dpa.constraint(now, promised)}
      </Text>
      <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}>
        {copy.dpa.constraintMax(max)}
      </Text>
    </View>
  );
}

/* ───────────────────────── §8.3 the date sheet ──────────────────────── */

/**
 * `Pick another date`, as a sheet of the dates the server will accept.
 *
 * ── WHY A LIST AND NOT A CALENDAR ───────────────────────────────────────────
 *
 * The legal range is `DPA_TERM.minDays` to `maxDays` — one to thirty days from
 * now — which is thirty rows. A calendar grid for a thirty-day window spends
 * most of its area on dates that are refused, and every one of those is a tap
 * that produces a 400 from POST /api/v1/contracts. A list of exactly the legal
 * dates cannot produce an illegal one, and thirty rows is a short scroll.
 *
 * It is also why the platform picker is not used here. `native-date-dialog.tsx`
 * exists and is deliberately not reached for: its `dateBounds()` are a date of
 * BIRTH's bounds (a century back, today as the ceiling) and its Android path
 * opens a dialog, which §8.3 explicitly does not want — "Date picker is a
 * sheet, not a keyboard — no reflow."
 *
 * Each row carries §1.8's own urgency colour on its day count, so the cost of
 * choosing a near date is visible while choosing it rather than afterwards.
 */
function DateSheet({
  selected,
  onPick,
  onClose,
}: {
  selected: Date;
  onPick: (d: Date) => void;
  onClose: () => void;
}) {
  const dates = useMemo(() => legalDeadlines(), []);
  const selectedKey = shortDate(selected);

  return (
    <OfferSheet dismissible onDismiss={onClose}>
      <View style={{ paddingTop: offerSpace.prompt.handleToHeading }}>
        <View style={{ paddingHorizontal: offerSpace.prompt.x }}>
          <Text style={[textStyle(offerType.sheetHeading), { color: offerColor.ink }]}>
            {copy.dpa.deadlineLabel}
          </Text>
          <Text
            style={[
              textStyle(offerType.helper),
              { color: offerColor.inkSecondary, marginTop: offerSpace.prompt.headingToBody },
            ]}
          >
            {`Between ${DPA_TERM.minDays} and ${DPA_TERM.maxDays} days from today.`}
          </Text>
        </View>

        <ScrollView
          style={{ maxHeight: 380, marginTop: offerSpace.prompt.bodyToExamples }}
          contentContainerStyle={{ paddingHorizontal: offerSpace.prompt.x, gap: 6 }}
        >
          {dates.map((d) => {
            const days = daysUntil(d);
            const isSelected = shortDate(d) === selectedKey;
            return (
              <Tappable
                key={d.toISOString()}
                onPress={() => onPick(d)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${shortDate(d)}, ${days} ${days === 1 ? "day" : "days"} from now`}
                style={{
                  minHeight: offerSize.dateRow.minHeight,
                  borderRadius: offerRadius.row,
                  borderWidth: isSelected ? offerBorder.selected : offerBorder.rule,
                  borderColor: isSelected ? offerColor.selected : offerColor.rule,
                  backgroundColor: isSelected ? offerColor.tintGreen : offerColor.paper,
                  paddingHorizontal: offerSize.settleRow.padX,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
                pressedStyle={{ backgroundColor: offerColor.quiet }}
              >
                <Text style={[textStyle(offerType.itemTitleRow), { color: offerColor.ink }]}>
                  {shortDate(d)}
                </Text>
                <Text style={[textStyle(offerType.deadline), { color: deadlineInk(days) }]}>
                  {`${days} ${days === 1 ? "day" : "days"}`}
                </Text>
              </Tappable>
            );
          })}
        </ScrollView>
      </View>
    </OfferSheet>
  );
}
