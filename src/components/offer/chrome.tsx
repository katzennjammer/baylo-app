import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChevronLeftIcon } from "../icons";
import { Tappable } from "../Tappable";
import {
  offerBoard,
  offerBorder,
  offerColor,
  offerIcon,
  offerMotion,
  offerRadius,
  offerSize,
  offerSpace,
  offerType,
  textStyle,
  type OfferBoard,
} from "../../theme/offer-tokens";

/**
 * The chrome the offer flow wears, and the geometry §3.2's running y produces.
 *
 * ── THE SCREEN IS ONE SCROLL BETWEEN TWO FIXED BARS ─────────────────────────
 *
 * 44 of status and 44 of nav above, a bottom bar below, and everything in
 * between scrolls. §3.2's table is absolute and React Native lays out in flow,
 * so each section's padding is derived rather than positioned — see the
 * arithmetic beside each entry in `offerSpace.section`.
 *
 * ── WHY THIS FLOW IS A ROOT ROUTE AND NOT A TAB SCREEN ──────────────────────
 *
 * It used to live at `app/(app)/offer.tsx`, inside the `Tabs` navigator, which
 * puts the 83px tab bar underneath whatever a screen pins to its own bottom.
 * §3.2 ends at 818 with a 26px safe area and no tab bar; the send button IS the
 * bottom of the screen. So the flow moved to `app/offer.tsx` and is pushed OVER
 * the tabs, exactly as `post-item` already is and for the same reason.
 */

/* ──────────────────────────── §9 the board ──────────────────────────── */

/**
 * Which width column this device is on.
 *
 * HORIZONTAL AND TYPE ONLY. §9's closing line fixes every row height and every
 * 44px target across both, which is why this returns a table rather than a
 * second layout — the same shape `useBoard()` has in the post flow.
 */
export function useOfferBoard(): OfferBoard {
  const { width } = useWindowDimensions();
  return width <= offerBoard.breakpoint ? offerBoard.tight : offerBoard.wide;
}

/** True on the 360 column. Two strings in §9 shorten on it. */
export function useTightBoard(): boolean {
  const { width } = useWindowDimensions();
  return width <= offerBoard.breakpoint;
}

/* ──────────────────────────── the host ──────────────────────────────── */

/**
 * The screen shell: the status area, the IME correction, and nothing else.
 *
 * ── WHY NOT `KeyboardAvoidingView` ──────────────────────────────────────────
 *
 * `android/gradle.properties` sets `edgeToEdgeEnabled=true`, and from API 35
 * `SOFT_INPUT_ADJUST_RESIZE` is a NO-OP for an edge-to-edge window: the window
 * stays the full screen and the IME arrives as an inset the app applies itself.
 * KeyboardAvoidingView takes its offset from `getWindowVisibleDisplayFrame()` —
 * the frame that no longer shrinks — so it computes ~0 and pads by nothing.
 *
 * `marginBottom: imeInset` on the root is the whole correction, and the inset
 * comes from `useKeyboardState()` in `auth-sheet.tsx`, which derives it from
 * `endCoordinates.height` — the number React Native still fills from
 * `WindowInsetsCompat.Type.ime()`. The auth screens hit this first and the full
 * derivation is written out there; the post wizard already reuses it, and this
 * is the third caller rather than a third copy of a subtle piece of platform
 * arithmetic.
 *
 * On the 844 canvas with a 358 IME the host becomes 486, which is exactly §8's
 * budget — the numbers in the spec are the numbers this produces.
 */
export function OfferScreenHost({
  imeInset,
  dimmed = false,
  children,
}: {
  imeInset: number;
  /** §5.2's "Sending": content and nav at 45%. */
  dimmed?: boolean;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: offerColor.paper,
        // §3.1's 44 is the canvas's status bar. A real inset wins where it is
        // larger (a notch) and the 44 holds where the device reports none.
        paddingTop: Math.max(insets.top, offerSpace.statusBar),
        marginBottom: imeInset,
        opacity: dimmed ? offerMotion.sendingDim : 1,
      }}
    >
      {children}
    </View>
  );
}

/* ───────────────────────────── the nav bar ──────────────────────────── */

/**
 * 44 tall, 12 of side padding, a back chevron and a title.
 *
 * §5.2's "Sending" state REMOVES the back control rather than disabling it —
 * `onBack: null` is how that is spelled, and it leaves the title where it is
 * instead of sliding it left, because the bar's geometry is fixed and a title
 * that moves when a request starts reads as a layout bug.
 *
 * `trailing` carries §8.1's and §8.2's `Done`, which appears only while an IME
 * is up.
 */
export function OfferNav({
  title,
  onBack,
  trailing,
}: {
  title: string;
  onBack: (() => void) | null;
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
      {onBack ? (
        <Tappable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          // 44 × 44, pulled left by the bar's own padding so the glyph lands on
          // the 16 gutter rather than on the box's edge.
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
      ) : (
        // The bar keeps its shape with the control gone, so the title does not
        // move between the composing state and the sending one.
        <View style={{ width: offerSize.tapTarget - offerSpace.navX + 4 }} />
      )}

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

/** §8's `Done`, at 15/600 `#1B4D2B` with 12 of right padding. */
export function NavDone({ onPress }: { onPress: () => void }) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Done editing"
      style={{
        height: offerSpace.navBar,
        justifyContent: "center",
        paddingLeft: 12,
        paddingRight: offerSpace.navX,
        marginRight: -offerSpace.navX + 4,
      }}
      pressedStyle={{ opacity: 0.6 }}
    >
      <Text style={[textStyle(offerType.buttonSecondary), { color: offerColor.deep }]}>Done</Text>
    </Tappable>
  );
}

/* ──────────────────────── sections and dividers ─────────────────────── */

/**
 * A full-bleed 1px hairline.
 *
 * §3.1: "full-bleed 1px #EDEBE3, NO SIDE INSET". It is a separate component
 * rather than a `borderBottomWidth` on the section above it because the section
 * carries 16 of side padding and a border on a padded box is inset by nothing —
 * but a border on the CONTENT inside it would be, and that is the mistake this
 * removes the opportunity for.
 */
export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[{ height: offerBorder.hairline, backgroundColor: offerColor.hairline }, style]}
    />
  );
}

/**
 * One band of the screen: 16 of side padding and the top/bottom §3.2 gives it.
 *
 * `pad` takes an entry from `offerSpace.section` rather than two numbers, so a
 * call site names the section it is drawing and cannot pair one section's top
 * with another's bottom.
 */
export function Section({
  pad,
  children,
  style,
}: {
  pad: { top: number; bottom: number };
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          paddingTop: pad.top,
          paddingBottom: pad.bottom,
          paddingHorizontal: offerSpace.screenX,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** §2's section label: mono 500, 11px, +1.32 tracking, uppercase, `#8C8A7E`. */
export function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={[textStyle(offerType.sectionLabel), { color: offerColor.inkTertiary }]}
      // The label is already uppercase through `textTransform`; the accessible
      // name is the readable form, because a screen reader spelling out
      // "Y-O-U-'-R-E O-F-F-E-R-I-N-G" is what uppercase does to some engines.
      accessibilityLabel={children}
    >
      {children}
    </Text>
  );
}

/* ──────────────────────────── the bottom bar ────────────────────────── */

/**
 * The fixed bar: a hairline, 12, the 52 button, 8, a footnote, 26.
 *
 * `above` is §3.4's consequence copy and §5.2's send-failed panel, both of
 * which sit INSIDE the bar above the button rather than at the end of the
 * scroll — a failure notice that scrolls away from the button that retries it
 * is a notice nobody reads twice.
 *
 * The 26 is a floor. A phone with a gesture bar reserves more and one with
 * hardware keys reserves none; taking the larger keeps the button off the
 * system affordance without opening a gap above it. Same rule as `PostFooter`.
 */
export function OfferBottomBar({
  above,
  footnote,
  children,
}: {
  above?: React.ReactNode;
  footnote?: string | null;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ backgroundColor: offerColor.paper }}>
      <Hairline />
      <View
        style={{
          paddingTop: offerSpace.bottomBar.top,
          paddingHorizontal: offerSpace.screenX,
          paddingBottom: Math.max(offerSpace.bottomBar.bottom, insets.bottom),
        }}
      >
        {above}
        {children}
        {footnote ? (
          <Text
            style={[
              textStyle(offerType.helper),
              {
                color: offerColor.inkTertiary,
                marginTop: offerSpace.bottomBar.buttonToFootnote,
              },
            ]}
          >
            {footnote}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/* ────────────────────────────── buttons ─────────────────────────────── */

/**
 * §4's primary: 52 tall, radius 10, `#3DBE5A`, label `#0B2A15`.
 *
 * THE LABEL IS NEVER `#FAFAF7`. §1.2 says so twice and it is worth honouring
 * loudly: cream on this green is 2.1:1 and the dark ink is 8.2:1. There is no
 * `tone` prop that could produce the cream version by accident.
 *
 * NO DISABLED STATE. §5.1's closing line — "There is no disabled send in any
 * situation" — and the flow means it: every gap has a sendable arrangement, so
 * a `disabled` prop here would be an affordance for a state that does not
 * exist. The one control that legitimately cannot fire while a request is in
 * flight is replaced outright by `SendingButton` below.
 */
export function PrimaryButton({
  label,
  onPress,
  accessibilityLabel,
  disabled,
  disabledHint,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  /**
   * Off, with the label still stating what is missing.
   *
   * §5.1 forbids a disabled SEND — an offer must always be sendable as it
   * stands — and this does not weaken that: it is for a control that is not a
   * send, like §6g's `Send with the agreement`, which cannot proceed on an
   * empty amount. The alternative that was there before was worse than a
   * disabled button: a live one that quietly dropped the promise.
   */
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <Tappable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      accessibilityHint={disabled ? disabledHint : undefined}
      style={{
        height: offerSize.button.primary,
        borderRadius: offerRadius.button,
        backgroundColor: offerColor.green,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
      }}
      pressedStyle={disabled ? undefined : { opacity: 0.85 }}
    >
      <Text style={[textStyle(offerType.buttonPrimary), { color: offerColor.onGreen }]}>
        {label}
      </Text>
    </Tappable>
  );
}

/** §4's secondary: 52 tall, radius 10, 1px `#D8D6CC`, paper fill. */
export function SecondaryButton({
  label,
  onPress,
  height = offerSize.button.secondary,
}: {
  label: string;
  onPress: () => void;
  /** §5.2's verify control is 48, not 52. Everything else takes the default. */
  height?: number;
}) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        height,
        borderRadius: offerRadius.button,
        borderWidth: offerBorder.strong,
        borderColor: offerColor.strong,
        backgroundColor: offerColor.paper,
        alignItems: "center",
        justifyContent: "center",
      }}
      pressedStyle={{ backgroundColor: offerColor.quiet }}
    >
      <Text style={[textStyle(offerType.buttonSecondary), { color: offerColor.ink }]}>
        {label}
      </Text>
    </Tappable>
  );
}

/** §4's tertiary: a 44 tap height, no border, label at 14/600 `#1B4D2B`. */
export function TertiaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        height: offerSize.button.tertiary,
        alignItems: "center",
        justifyContent: "center",
      }}
      pressedStyle={{ opacity: 0.6 }}
    >
      <Text style={[textStyle(offerType.buttonTertiary), { color: offerColor.deep }]}>
        {label}
      </Text>
    </Tappable>
  );
}

/* ─────────────────────── §5.2 / §11 the sending bar ─────────────────── */

/**
 * True while the OS asks for reduced motion, kept live.
 *
 * §11's last line turns every transition in this flow into an instant state
 * change and holds the sending fill static, so the components branch on this
 * rather than on a zeroed duration — a zeroed duration still runs a loop.
 *
 * The initial read is async and resolves to `false` first, which is the right
 * default for one frame: an animation that starts and is then cancelled is a
 * smaller error than a static screen for somebody who did not ask for one.
 * `BandVideo` reads the same API the same way.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setReduced(on);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return reduced;
}

/**
 * §5.2's sending state: the button becomes a track.
 *
 * A 52px `#EAF6EC` bar with a `#3DBE5A` fill at 62% and the label `Sending`.
 * THE 62% IS NOT PROGRESS. Nothing on the wire reports how far a POST has got,
 * and a bar that crept forward would be inventing one — §5.2 pins the fill and
 * §11 gives it a breath instead, `opacity .55 → 1` over 1.4s ease-in-out. No
 * spinner, no indeterminate sweep.
 *
 * `useNativeDriver: true` — opacity is one of the two properties the native
 * driver can carry, and this loop runs for the whole life of a request.
 *
 * Not a `Tappable`. It is not a control while it is running: the press would
 * have nowhere to go, and a button that looks pressable during a request is how
 * a double-send happens.
 */
export function SendingButton({ label }: { label: string }) {
  const reduced = useReducedMotion();
  const breath = useRef(new Animated.Value(offerMotion.sendingTo)).current;

  useEffect(() => {
    if (reduced) {
      breath.setValue(offerMotion.sendingTo);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: offerMotion.sendingFrom,
          duration: offerMotion.sendingBreatheMs / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: offerMotion.sendingTo,
          duration: offerMotion.sendingBreatheMs / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, breath]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      // `busy` rather than a percentage: there is no percentage to report.
      accessibilityState={{ busy: true }}
      style={{
        height: offerSize.button.primary,
        borderRadius: offerRadius.button,
        backgroundColor: offerColor.trackGreen,
        overflow: "hidden",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${offerMotion.sendingFill * 100}%`,
          backgroundColor: offerColor.green,
          opacity: breath,
        }}
      />
      <Text
        style={[
          textStyle(offerType.buttonPrimary),
          { color: offerColor.onGreen, textAlign: "center" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}
