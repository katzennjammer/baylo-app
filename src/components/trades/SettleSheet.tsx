import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as copy from "./copy";
import { PrimaryButton, SecondaryButton, TertiaryButton } from "../offer/chrome";
import { grouped } from "../../lib/gap";
import {
  offerColor,
  offerRadius,
  offerSize,
  offerSpace,
  offerType,
  textStyle,
} from "../../theme/offer-tokens";

/**
 * How much of a promise to settle. §3.6's sheet geometry, three choices.
 *
 * ══ WHY A SHEET AND NOT A NUMBER FIELD ══════════════════════════════════════
 *
 * §3.4 has a 40px mono amount field with a caret, and it belongs to the DPA
 * proposal — a screen where the amount is the subject and the person is deciding
 * it. This is not that. Somebody settling a debt has one number in mind almost
 * every time, and it is "all of it"; the interesting question is whether they
 * can afford that today, not what arbitrary figure to type.
 *
 * So: the whole remainder, half of it, or nothing. Half is there because a
 * partial payment is a real thing the model supports — §1.7 has a state for it
 * and §5.3 writes `40 of 100 settled` — and because a debtor who can pay
 * something but not everything should not have to choose between all and none.
 *
 * ══ THE AMOUNT IS NOT SENT WHEN IT IS "ALL" ═════════════════════════════════
 *
 * `Settle all` calls the endpoint with NO `amountLeaves`, and the server
 * computes the remainder itself. That is deliberate: the remainder can move
 * between the read that drew this sheet and the write — a task award landing, a
 * concurrent payment — and a figure computed here would then be either short or
 * refused outright. "Pay it off" survives the race; "pay exactly 180" does not.
 *
 * The half button does send a figure, because half of a number that moved is a
 * different intention rather than the same one.
 *
 * ══ WHAT IS NOT OFFERED, AND WHY ════════════════════════════════════════════
 *
 * NO CONTROL THAT SPENDS MORE THAN THE BALANCE. Both amounts are clamped to what
 * the viewer holds before they are drawn, and when the balance covers nothing at
 * all the sheet says so and offers only the way out. The server refuses either
 * way — it re-reads the balance inside the transaction — but a button that is
 * known to fail is a button that should not be there.
 */
export function SettleSheet({
  visible,
  creditorName,
  owed,
  balance,
  busy,
  error,
  onSettle,
  onClose,
}: {
  visible: boolean;
  creditorName: string;
  /** `remainingLeaves` on the contract — never `amountLeaves`. */
  owed: number;
  /** The viewer's raw Leaf balance. Contract debt outranks pledged Leaves. */
  balance: number;
  busy: boolean;
  /** The server's own sentence. Carries the numbers; never replaced. */
  error: string | null;
  /** `undefined` means "all of it" and sends no amount. See the header. */
  onSettle: (amountLeaves?: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  // What can actually be paid today. `owed` bounds it from one side and the
  // balance from the other, and the smaller of the two is the real ceiling.
  const payable = Math.min(owed, Math.max(0, balance));
  const half = Math.min(payable, Math.max(1, Math.floor(owed / 2)));
  const canPayAll = balance >= owed;
  const canPayHalf = payable >= half && half > 0 && half < owed;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      // Android's back gesture closes it. A sheet about money that can only be
      // dismissed by a button is a sheet somebody gets stuck in.
      statusBarTranslucent
    >
      {/* §1.1's scrim: #14140F at 42%. Tapping it closes — this sheet asks a
          question rather than demanding an answer, unlike §7.4's one-time
          explainer, which is explicitly not scrim-dismissible. */}
      <Pressable
        style={{ flex: 1, backgroundColor: offerColor.scrim }}
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={busy ? undefined : onClose}
      />

      <View
        style={{
          backgroundColor: offerColor.paper,
          borderTopLeftRadius: offerRadius.sheet,
          borderTopRightRadius: offerRadius.sheet,
          paddingHorizontal: offerSpace.prompt.x,
          paddingTop: offerSpace.prompt.top,
          paddingBottom: Math.max(offerSpace.prompt.bottom, insets.bottom),
          opacity: busy ? 0.6 : 1,
        }}
      >
        {/* §4's drag handle, on §1.1's `surface/quiet` track. */}
        <View
          style={{
            width: offerSize.handle.w,
            height: offerSize.handle.h,
            borderRadius: offerSize.handle.h / 2,
            backgroundColor: offerColor.quiet,
            alignSelf: "center",
            marginBottom: offerSpace.prompt.handleToHeading,
          }}
        />

        <Text
          accessibilityRole="header"
          style={[textStyle(offerType.sheetHeading), { color: offerColor.ink }]}
        >
          {copy.promise.settleHeading(creditorName)}
        </Text>

        <Text
          style={[
            textStyle(offerType.body),
            { color: offerColor.inkSecondary, marginTop: offerSpace.prompt.headingToBody },
          ]}
        >
          {copy.promise.settleBody(owed, balance)}
        </Text>

        {error ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[
              textStyle(offerType.errorText),
              { color: offerColor.warm, marginTop: offerSpace.prompt.headingToBody },
            ]}
          >
            {error}
          </Text>
        ) : null}

        <View style={{ marginTop: offerSpace.prompt.bodyToExamples, gap: offerSpace.rowGap }}>
          {canPayAll ? (
            <PrimaryButton
              label={copy.promise.settleAll(owed)}
              onPress={() => onSettle(undefined)}
              accessibilityLabel={`Settle all ${grouped(owed)} Leaves owed to ${creditorName}`}
            />
          ) : payable > 0 ? (
            // The balance does not cover the whole debt, so the emphasised
            // control is the largest payment that WILL go through. Offering
            // "settle all" here would be offering a refusal.
            <PrimaryButton
              label={copy.promise.settlePart(payable)}
              onPress={() => onSettle(payable)}
              accessibilityLabel={`Settle ${grouped(payable)} Leaves towards ${grouped(
                owed,
              )} owed to ${creditorName}`}
            />
          ) : null}

          {canPayAll && canPayHalf ? (
            <SecondaryButton label={copy.promise.settlePart(half)} onPress={() => onSettle(half)} />
          ) : null}
        </View>

        <View style={{ marginTop: payable > 0 ? 4 : offerSpace.prompt.bodyToExamples }}>
          <TertiaryButton label={copy.promise.settleCancel} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
