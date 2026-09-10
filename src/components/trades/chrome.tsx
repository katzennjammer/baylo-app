import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Tappable } from "../Tappable";
import { ChevronLeftIcon } from "../icons";
import {
  offerColor,
  offerIcon,
  offerSize,
  offerSpace,
  offerType,
  textStyle,
} from "../../theme/offer-tokens";
import { font } from "../../theme/tokens";

/**
 * The Trades tab's own chrome — the large title, the block label, the host.
 *
 * ── ALMOST NOTHING NEW ──────────────────────────────────────────────────────
 *
 * `Hairline`, `Section`, `SectionLabel`, `OfferNav`, `OfferBottomBar`,
 * `PrimaryButton`, `SecondaryButton`, `TertiaryButton`, `OfferScreenHost` and
 * `useOfferBoard` all come from `src/components/offer/chrome.tsx` unchanged, and
 * every screen in this feature imports them from there. §1 through §4 are one
 * system across the offer flow, Trades and out-of-reach — the spec says so in
 * its own opening line — so a second set of buttons here would be a second
 * system pretending to be the same one.
 *
 * What genuinely is this screen's own is below: a 22px large title where the
 * offer flow has a 15px nav title, and the `label + 21` block header §4 gives
 * the sections.
 *
 * ── THE TAB'S APP HEADER IS TURNED OFF FOR THIS SCREEN ──────────────────────
 *
 * `(app)/_layout.tsx` puts `AppHeader` on every tab. §3.5's running y starts at
 * 0 with a 44 status bar and puts the `Trades` title in the 44 that follows, so
 * the wordmark row would push every measured value in the table down by its own
 * height. `headerShown: false` on the Trades screen is the whole change, and it
 * is why `TradesTitle` below draws a bar rather than configuring one.
 */

/* ───────────────────────────── the host ─────────────────────────────── */

/**
 * §3.5's canvas: the status area, and the IME correction on the screens that
 * need one.
 *
 * The same shape as `OfferScreenHost` — and NOT a re-export of it, because a tab
 * screen sits above the tab bar and a pushed screen does not. The difference is
 * one prop, `insetBottom`, which the list leaves false (the tab bar is drawn by
 * the navigator under it) and the pushed screens leave alone.
 *
 * `marginBottom: imeInset` rather than a `KeyboardAvoidingView`, for the reason
 * written out in `offer/chrome.tsx`: `edgeToEdgeEnabled=true` makes
 * `SOFT_INPUT_ADJUST_RESIZE` a no-op from API 35, the window no longer shrinks,
 * and KeyboardAvoidingView's `getWindowVisibleDisplayFrame()` arithmetic
 * therefore computes ~0 and pads by nothing. The inset comes from
 * `useKeyboardState()` in `auth-sheet.tsx`, which derives it from
 * `endCoordinates.height` — the number React Native still fills from
 * `WindowInsetsCompat.Type.ime()`. Auth hit it first, the post wizard and the
 * offer flow reuse it, and this is the fourth caller rather than a fourth copy.
 */
export function TradesHost({
  imeInset = 0,
  children,
}: {
  imeInset?: number;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: offerColor.paper,
        // §3.1's 44 is the canvas's status bar. A real inset wins where it is
        // larger (a notch); the 44 holds where the device reports none.
        paddingTop: Math.max(insets.top, offerSpace.statusBar),
        marginBottom: imeInset,
      }}
    >
      {children}
    </View>
  );
}

/* ────────────────────────── the large title ─────────────────────────── */

/**
 * §3.5's nav bar: `Trades`, 22px Bricolage, 16 of side padding.
 *
 * NOT `offerType.screenHeading` (25px) and not `navTitle` (15px). §3.5 names 22
 * specifically, which is `tokens.type.wordmarkTight`'s size and the same figure
 * the frames draw — a title that is a destination's name rather than a
 * screen-full heading. The role is composed here rather than added to
 * `offer-tokens` because it appears on exactly one screen.
 *
 * `trailing` carries frame 9d's `14 trades` mono, which rides the same bar when
 * the History list is pushed.
 */
export function TradesTitle({ title, trailing }: { title: string; trailing?: React.ReactNode }) {
  return (
    <View
      style={{
        height: offerSpace.navBar,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: offerSpace.screenX,
      }}
    >
      <Text
        accessibilityRole="header"
        style={[
          textStyle({ fontFamily: font.displayBold, fontSize: 22, letterSpacing: -0.44 }),
          { color: offerColor.ink, flex: 1 },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {trailing}
    </View>
  );
}

/**
 * The back control the pushed screens wear, at §3.1's 12 of nav padding.
 *
 * `OfferNav` from the offer flow does exactly this and is what every pushed
 * screen in this feature uses. This exists for the one arrangement it cannot
 * make: frame 9d's bar carries a trailing mono count AND a 15px title, and
 * `OfferNav`'s `trailing` sits after a `flex: 1` title, which is the same thing.
 * So this is `OfferNav` with the title role swapped — kept separate rather than
 * given `OfferNav` a `titleRole` prop, which would be a knob on a component that
 * currently has exactly one look.
 */
export function TradesBackTitle({
  title,
  onBack,
  trailing,
}: {
  title: string;
  onBack: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <View
      style={{
        height: offerSpace.navBar,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: offerSpace.navX,
      }}
    >
      <Tappable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={{
          width: offerSize.tapTarget,
          height: offerSize.tapTarget,
          alignItems: "center",
          justifyContent: "center",
          marginLeft: -offerSpace.navX + 4,
        }}
        pressedStyle={{ opacity: 0.6 }}
      >
        <ChevronLeftIcon
          size={offerIcon.nav.size}
          stroke={offerIcon.nav.stroke}
          color={offerColor.ink}
        />
      </Tappable>

      <Text
        style={[textStyle(offerType.navTitle), { color: offerColor.ink, flex: 1, marginLeft: 4 }]}
        numberOfLines={1}
      >
        {title}
      </Text>

      {trailing}
    </View>
  );
}

/** Frame 9d's and 9i's trailing mono on a nav bar. 12 of right padding. */
export function NavMono({ children }: { children: string }) {
  return (
    <Text
      style={[
        textStyle(offerType.deadline),
        { color: offerColor.inkTertiary, paddingRight: offerSpace.navX },
      ]}
    >
      {children}
    </Text>
  );
}

/* ────────────────────────── the block header ────────────────────────── */

/**
 * §4's section header: "mono 11 label, 21px below label to first item".
 *
 * `offerSize.sectionHeader.labelToFirst` is that 21, and §3.5's table agrees —
 * label at 102, first card at 123. `SectionLabel` from the offer flow draws the
 * label itself, including the accessible-name correction that stops a screen
 * reader spelling out an uppercased string letter by letter.
 *
 * `top` differs per block and comes from §3.5 rather than from §3.1's default:
 * `Needs you today` opens at 14 below the bar and `Waiting` at 18.
 */
export function BlockHeader({
  label,
  top,
  trailing,
}: {
  label: string;
  top: number;
  trailing?: React.ReactNode;
}) {
  return (
    <View
      style={{
        paddingTop: top,
        paddingHorizontal: offerSpace.screenX,
        paddingBottom: offerSize.sectionHeader.labelToFirst - 11,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View style={{ flex: 1 }}>
        <TradesSectionLabel>{label}</TradesSectionLabel>
      </View>
      {trailing}
    </View>
  );
}

/**
 * §2's section label, drawn here rather than imported, for one reason: the
 * offer flow's `SectionLabel` is a bare `Text` and this one is sometimes inside
 * a row with a trailing element. Same type role, same ink, same accessible-name
 * correction — the label is already uppercase through `textTransform`, and a
 * screen reader handed an uppercased string spells it out on some engines.
 */
export function TradesSectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={[textStyle(offerType.sectionLabel), { color: offerColor.inkTertiary }]}
      accessibilityLabel={children}
    >
      {children}
    </Text>
  );
}

/** A block of rows with the screen's 16 gutter and nothing else. */
export function Gutter({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ paddingHorizontal: offerSpace.screenX }, style]}>{children}</View>;
}
