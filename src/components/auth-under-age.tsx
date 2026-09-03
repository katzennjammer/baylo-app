import { View } from "react-native";

import {
  AuthScreen,
  BandBackButton,
  BandRow,
  Body,
  Headline,
  PrimaryButton,
  RejectionMark,
  RejectionPanel,
  TextButton,
  Wordmark,
  bandHeight,
  gap,
} from "./auth-sheet";
import { MIN_AGE, currentAge, formatLongDate, todayParts, type DateParts } from "../lib/dob";

/**
 * Under 18.
 *
 * ── ONE COMPONENT, TWO CALLERS, AND THAT IS DELIBERATE ──────────────────────
 *
 * Both the create-account form and the Google date-of-birth step can land here,
 * and they must land on the SAME screen. Two copies of a refusal drift: one
 * gets the panel and the other a toast, one says 18 and the other says "adult",
 * and the second one to be edited is the one nobody remembers exists. The two
 * callers differ only in where their secondary action goes.
 *
 * ── IT SHOWS ITS WORKING ────────────────────────────────────────────────────
 *
 * The panel is not decoration. A refusal with no arithmetic in it is one the
 * user cannot check, and the overwhelmingly likely cause of arriving here is a
 * mis-picked year rather than a person who is actually sixteen. Printing the
 * date that was read, the date it was compared against and the number that came
 * out turns "no" into "you told me 2009" — which is the difference between a
 * dead end and a correction.
 *
 * NOTHING HAS BEEN CREATED OR INSTALLED by the time this renders. The register
 * path checks before it posts; the Google path holds an uninstalled pair and
 * refuses before adopting it. Backing out leaves no half-made account behind.
 */
export function UnderAgeSheet({
  dob,
  onCorrect,
  secondary,
  onBack,
}: {
  /** The date that was refused. Null only if this is reached without one. */
  dob: DateParts | null;
  /** Straight back to the field they need to change. */
  onCorrect: () => void;
  /** The way out — a different account, or back to sign in. */
  secondary: { label: string; onPress: () => void };
  onBack: () => void;
}) {
  const today = todayParts();
  const rows = dob
    ? [
        { label: "Date of birth", value: formatLongDate(dob) },
        { label: "Today", value: formatLongDate(today) },
        { label: "Age", value: String(currentAge(dob)) },
      ]
    : [{ label: "Minimum age", value: String(MIN_AGE) }];

  return (
    <AuthScreen
      scrim="rejected"
      band={bandHeight.rejected}
      bandContent={
        <BandRow leading={<BandBackButton onPress={onBack} label="Back" />}>
          <Wordmark />
        </BandRow>
      }
    >
      <RejectionMark />

      <View style={{ height: gap.rejectionIconToHeadline }} />
      <Headline variant="rejected">You need to be {MIN_AGE}</Headline>

      <View style={{ height: gap.headlineToBody }} />
      <Body>
        Baylo is an {MIN_AGE}+ marketplace, so we cannot open an account on this date of birth. If
        you picked the wrong year, go back and change it.
      </Body>

      {/* The spec's gap table stops at the screens with a field stack; body →
          panel is read off the artboard and matches the Google step's 24. */}
      <View style={{ height: gap.bodyToControl.googleDob }} />
      <RejectionPanel rows={rows} />

      <View style={{ height: gap.declarationToPrimaryGoogleDob }} />
      <PrimaryButton label="Correct my date of birth" onPress={onCorrect} />

      <View style={{ height: gap.primaryToTextButton }} />
      <TextButton
        label={secondary.label}
        size="footer"
        onPress={secondary.onPress}
        align="center"
      />
    </AuthScreen>
  );
}
