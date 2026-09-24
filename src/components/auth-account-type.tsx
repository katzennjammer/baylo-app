import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { Tappable } from "./Tappable";
import { CheckIcon, PersonIcon, StoreIcon } from "./icons";
import {
  AuthScreen,
  BandBackButton,
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
import { color, dark } from "../theme/tokens";

/**
 * The account-type step: individual trader, or organisation.
 *
 * ── IT COMES FIRST, BEFORE ANY PERSONAL DETAILS ─────────────────────────────
 *
 * Until 24 Sep 2026 this sat AFTER the register form, once the account already
 * existed. It now opens signup, because the answer changes the form that
 * follows: an MSME is asked for the OWNER's name and date of birth, then
 * carries on into the business details. Asking afterwards meant a shop owner
 * filled in a generic "Full name" without knowing whose name was wanted.
 *
 * Nothing is created by this screen. It is a choice held in the register
 * screen's state, so Back from the form returns here with the choice intact,
 * and nothing needs undoing if the person leaves.
 *
 * It is a separate top-level screen, not a branch inside RegisterForm, for the
 * reason register.tsx documents under "ONE TREE, NOT TWO": the form's five
 * TextInputs are reconciled by position, and swapping its children array
 * unmounts them all. A different screen returned from the parent is safe.
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
 * individuals who then cannot verify a business they do not have. The same
 * goes for the badges: the two tints tell the options apart, and neither is
 * the "better" colour.
 */

export type AccountType = "individual" | "organization";

export function AccountTypeStep({
  value,
  onChange,
  onContinue,
  onSkip,
  onBack,
}: {
  value: AccountType | null;
  onChange: (next: AccountType) => void;
  onContinue: () => void;
  /** "Decide later" — goes on to the individual form without claiming to be one. */
  onSkip: () => void;
  /** Back to sign in. This is the first screen of signup. */
  onBack: () => void;
}) {
  return (
    <AuthScreen
      scrim="createAccount"
      band={bandHeight.signIn}
      padTop={keyboardRule.sheetPadTopSignIn}
      bandContent={
        <BandRow
          leading={<BandBackButton onPress={onBack} label="Back to sign in" />}
          trailing={<ApiUrlGear variant="band" />}
        >
          <Wordmark />
        </BandRow>
      }
    >
      <Headline variant="logIn">What kind of account?</Headline>

      <View style={{ height: gap.headlineToBody }} />
      <Body>This decides how you appear to other traders. You can change it later.</Body>

      <View style={{ height: gap.bodyToControl.signIn }} />

      <View accessibilityRole="radiogroup">
        <AccountCard
          selected={value === "individual"}
          onPress={() => onChange("individual")}
          title="Individual trader"
          body="Trade things you own, under your own name. A round photo, and a trust badge that grows with your completed trades."
          tone="individual"
        />

        <View style={{ height: gap.betweenInputs }} />

        <AccountCard
          selected={value === "organization"}
          onPress={() => onChange("organization")}
          title="Organization / MSME"
          body="Trade as a shop, co-op or non-profit. Staff can post on its behalf, and a verified badge appears once we have checked your business document."
          tone="organization"
        />
      </View>

      <View style={{ flexGrow: 1 }} />
      <View style={{ height: gap.declarationToPrimary }} />

      <PrimaryButton
        label="Continue"
        onPress={onContinue}
        // Disabled until something is chosen. See the note above on why
        // neither option is preselected.
        disabled={value === null}
      />

      <FooterPrompt prompt="Not sure yet?" label="Decide later" onPress={onSkip} />
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
 *
 * THE LOOK IS BORROWED, NOT INVENTED. The icon sits in a filled circle the way
 * the storefront header and the org switcher draw a missing logo, and the two
 * tints already exist: the pale green wash for a person, and the dark
 * Exclusive-tile surface with its light green for a business. The selected
 * card takes the Boost button's treatment — forest border on a green-wash fill
 * — which is pale enough not to compete with the solid green Continue below.
 *
 * The radio on the right is what animates: its forest dot springs in with a
 * check, and the badge swells slightly with it. Both run on the native driver.
 * Border and fill switch instantly, because the native driver cannot animate
 * colour.
 */
function AccountCard({
  selected,
  onPress,
  title,
  body,
  tone,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  body: string;
  tone: AccountType;
}) {
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: selected ? 1 : 0,
      useNativeDriver: true,
      speed: 22,
      bounciness: selected ? 8 : 0,
    }).start();
  }, [selected, progress]);

  const badge = BADGE[tone];
  const Icon = tone === "organization" ? StoreIcon : PersonIcon;

  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={`${title}. ${body}`}
      style={[s.card, selected ? s.cardSelected : null]}
      pressedStyle={selected ? s.cardSelectedPressed : s.cardPressed}
    >
      <Animated.View
        style={[
          s.badge,
          {
            backgroundColor: badge.fill,
            transform: [
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
            ],
          },
        ]}
      >
        <Icon size={24} stroke={1.7} color={badge.ink} />
      </Animated.View>

      <View style={{ flex: 1 }}>
        <Text style={[authText(authType.inputValue), { color: sheetColor.ink }]}>{title}</Text>
        <View style={{ height: 4 }} />
        <Text style={[authText(authType.legal), { color: sheetColor.body }]}>{body}</Text>
      </View>

      <View style={[s.radio, selected ? s.radioSelected : null]}>
        <Animated.View
          style={[
            s.radioDot,
            {
              opacity: progress,
              transform: [
                { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
              ],
            },
          ]}
        >
          <CheckIcon size={14} stroke={2.4} color={color.surface} />
        </Animated.View>
      </View>
    </Tappable>
  );
}

/** Badge tint per option. Both pairs already exist elsewhere — see AccountCard. */
const BADGE: Record<AccountType, { fill: string; ink: string }> = {
  individual: { fill: color.greenWash, ink: color.forest },
  organization: { fill: dark.surface, ink: dark.green },
};

const RADIO = 22;

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    // Always 2px, so selecting a card never shifts its contents by a pixel.
    borderWidth: 2,
    borderColor: color.controlLine,
    backgroundColor: sheetColor.surface,
  },
  cardSelected: {
    borderColor: color.forest,
    backgroundColor: color.greenWash,
  },
  cardPressed: { backgroundColor: sheetColor.pressedSurface },
  cardSelectedPressed: { backgroundColor: color.greenLine },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  radio: {
    width: RADIO,
    height: RADIO,
    marginTop: 1,
    borderRadius: RADIO / 2,
    borderWidth: 1.5,
    borderColor: color.controlLineStrong,
    backgroundColor: sheetColor.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: color.forest },
  // Covers the ring exactly (hence the -1.5 offsets), so a selected radio is a
  // solid forest disc rather than a dot inside a ring.
  radioDot: {
    position: "absolute",
    top: -1.5,
    left: -1.5,
    width: RADIO,
    height: RADIO,
    borderRadius: RADIO / 2,
    backgroundColor: color.forest,
    alignItems: "center",
    justifyContent: "center",
  },
});
