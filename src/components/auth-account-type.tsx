import { Text, View } from "react-native";

import { Tappable } from "./Tappable";
import { PersonIcon, StoreIcon } from "./icons";
import {
  AuthScreen,
  BandRow,
  Body,
  FooterPrompt,
  Headline,
  PrimaryButton,
  Wordmark,
  bandHeight,
  gap,
  keyboardRule,
} from "./auth-sheet";
import { ApiUrlGear } from "./ApiUrlGear";
import { authText, authType, sheetColor } from "../theme/auth-sheet-tokens";

/**
 * The account-type step: individual trader, or organisation.
 *
 * ── WHERE IT SITS, AND WHY NOT WHERE THE SPEC SAID ──────────────────────────
 *
 * The brief put this "right after email/password, before the existing
 * ID-verification step". There is no ID-verification step in signup: the
 * register form is five fields, then "check your email", then the app, and
 * /verify-id is a separate gate reached from Post. So the choice goes where the
 * spec's intent lands — immediately after the account exists and before the
 * person is handed to the app — which is between the form and "check your
 * email".
 *
 * That placement also happens to be the only one that works, for a reason the
 * register screen documents at length: its five fields live in a single
 * reconciled tree, and swapping the children array by branch unmounts every
 * TextInput, drops focus, and flips the keyboard state back and forth forever.
 * A step BEFORE the form would have to be that swap. A step after it is a
 * different screen entirely.
 *
 * ── INDIVIDUAL IS NOT THE DEFAULT, AND NEITHER IS ORGANISATION ──────────────
 *
 * Nothing is preselected and Continue stays disabled until one is tapped. A
 * preselected Individual would be chosen by everyone who taps past this screen
 * without reading it, including the shop owners this feature exists for — and
 * they would find out months later, from a profile that shows a round avatar
 * and a trust tier. It is two taps for everybody instead of one tap for most
 * and a wrong account for some.
 *
 * ── THE CARDS SAY WHAT IS DIFFERENT, NOT WHAT IS BETTER ─────────────────────
 *
 * An organisation is not an upgrade. It trades on exactly the same terms, holds
 * Leaves the same way and pays the same bridging fees; what it gets is a shop
 * identity that staff can post under and, after a document check, a badge. The
 * copy says that, because a card that reads as a premium tier gets picked by
 * individuals who then cannot verify a business they do not have.
 */

export type AccountType = "individual" | "organization";

export function AccountTypeStep({
  value,
  onChange,
  onContinue,
  onSkip,
  busy,
}: {
  value: AccountType | null;
  onChange: (next: AccountType) => void;
  onContinue: () => void;
  /** "I'll decide later" — lands on the individual path without choosing it. */
  onSkip: () => void;
  busy?: boolean;
}) {
  return (
    <AuthScreen
      scrim="createAccount"
      band={bandHeight.signIn}
      padTop={keyboardRule.sheetPadTopSignIn}
      bandContent={
        <BandRow trailing={<ApiUrlGear variant="band" />}>
          <Wordmark />
        </BandRow>
      }
    >
      <Headline variant="logIn">What kind of account?</Headline>

      <View style={{ height: gap.headlineToBody }} />
      <Body>
        Your account is already created — this just decides how it appears to
        other traders. You can change it later.
      </Body>

      <View style={{ height: gap.bodyToControl.signIn }} />

      <AccountCard
        selected={value === "individual"}
        onPress={() => onChange("individual")}
        title="Individual trader"
        body="Trade things you own, under your own name. A round photo, and a trust badge that grows with your completed trades."
        icon={<PersonIcon size={26} stroke={1.6} color={sheetColor.ink} />}
      />

      <View style={{ height: gap.betweenInputs }} />

      <AccountCard
        selected={value === "organization"}
        onPress={() => onChange("organization")}
        title="Organization / MSME"
        body="Trade as a shop, co-op or non-profit. Staff can post on its behalf, and a verified badge appears once we have checked your business document."
        icon={<StoreIcon size={26} stroke={1.6} color={sheetColor.ink} />}
      />

      <View style={{ flexGrow: 1 }} />
      <View style={{ height: gap.declarationToPrimary }} />

      <PrimaryButton
        label="Continue"
        onPress={onContinue}
        busy={busy}
        // Disabled until something is chosen. See the note above on why
        // neither option is preselected.
        disabled={value === null || busy}
      />

      <FooterPrompt
        prompt="Not sure yet?"
        label="Decide later"
        onPress={onSkip}
        disabled={busy}
      />
    </AuthScreen>
  );
}

/**
 * One choice.
 *
 * A TAPPABLE CARD, not a radio row. The difference between these two is a
 * paragraph each, and a radio list with two paragraphs beside it reads as a
 * settings screen — something to be adjusted rather than decided. The whole
 * card is the target, which is also the only way the body text is tappable.
 */
function AccountCard({
  selected,
  onPress,
  title,
  body,
  icon,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${body}`}
      style={{
        flexDirection: "row",
        gap: 14,
        padding: 16,
        borderRadius: 14,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? sheetColor.frame : sheetColor.label,
        // The selected card is marked by its BORDER rather than by a fill.
        // A filled card at this size competes with the primary button for
        // "the thing to press next", and the button is the thing to press next.
        backgroundColor: sheetColor.inputFill,
      }}
      pressedStyle={{ opacity: 0.85 }}
    >
      <View style={{ paddingTop: 2 }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[authText(authType.inputValue), { color: sheetColor.ink }]}>{title}</Text>
        <View style={{ height: 4 }} />
        <Text style={[authText(authType.legal), { color: sheetColor.label }]}>{body}</Text>
      </View>
    </Tappable>
  );
}
