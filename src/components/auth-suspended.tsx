import { Linking, View } from "react-native";

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
import { formatLongDate } from "../lib/dob";
import { SUPPORT_EMAIL, type SuspensionNotice } from "../lib/suspension";

const longDate = (d: Date) =>
  formatLongDate({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });

/**
 * Suspended.
 *
 * The same sheet as <UnderAgeSheet>, for the same reason: a refusal at the door
 * is one screen in this app, not a toast on one path and a banner on another.
 * Email sign-in and Google sign-in both land here.
 *
 * ── IT SAYS WHY, IN THE ADMIN'S OWN WORDS ───────────────────────────────────
 *
 * The reason is the text the admin had to type to suspend the account, shown
 * verbatim. A suspension with no stated reason is one the person cannot learn
 * from and cannot contest, and "contact support" is not an explanation. The
 * dates sit beside it so the notice is checkable, and the last paragraph says
 * what happens next and how to disagree — fair warning, and a way to answer it.
 *
 * NOTHING IS SIGNED IN when this renders. The server refused before issuing a
 * token pair, so backing out leaves no half-installed session behind.
 */
export function SuspendedSheet({ notice, onBack }: { notice: SuspensionNotice; onBack: () => void }) {
  const { reason, since, until, level } = notice;

  const rows = [
    // Stacked: a reason is a sentence, not a value that fits beside its label.
    ...(reason ? [{ label: "Reason", value: reason, stacked: true }] : []),
    ...(since ? [{ label: "Started", value: longDate(since) }] : []),
    { label: "Ends", value: until ? longDate(until) : "When our team lifts it" },
  ];

  const repeat = level !== null && level > 1;

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
      <Headline variant="rejected">Your account is suspended</Headline>

      <View style={{ height: gap.headlineToBody }} />
      <Body>
        {until
          ? `We're sorry — you can't sign in to Baylo until ${longDate(until)}.`
          : "We're sorry — you can't sign in to Baylo for now."}{" "}
        {reason
          ? "Here is what our team recorded, so you know exactly why."
          : "Our team placed this hold on your account."}
      </Body>

      <View style={{ height: gap.bodyToControl.googleDob }} />
      <RejectionPanel rows={rows} />

      <View style={{ height: gap.bodyToControl.googleDob }} />
      <Body>
        {repeat
          ? `This is suspension number ${level} on this account. Further breaches of the community rules can lead to a longer or permanent one.`
          : "Further breaches of the community rules can lead to a longer suspension."}{" "}
        Nothing has been deleted — your listings and Leaves are kept.{"\n\n"}
        If you think we got this wrong, write to {SUPPORT_EMAIL} from the email on this account and
        a person will review it.
      </Body>

      <View style={{ height: gap.declarationToPrimaryGoogleDob }} />
      <PrimaryButton label="Back to sign in" onPress={onBack} />

      <View style={{ height: gap.primaryToTextButton }} />
      <TextButton
        label="Email support"
        size="footer"
        onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => undefined)}
        align="center"
      />
    </AuthScreen>
  );
}
