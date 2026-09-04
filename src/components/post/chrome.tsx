import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChevronLeftIcon, CloseIcon } from "../icons";
import { Tappable } from "../Tappable";
import {
  board,
  chrome,
  keyboardRule,
  postColor,
  postMotion,
  postType,
  textStyle,
  tick,
  type Board,
} from "../../theme/post-tokens";

/**
 * The chrome every step wears, and the geometry that makes the tick rail mean
 * something.
 *
 * ── THE HEADER AND FOOTER ARE IDENTICAL ON ALL SEVEN STEPS ──────────────────
 *
 * 114 above, 90 below, 640 of scroll between them on the 844 canvas. That is
 * not a coincidence in the spec, it is the mechanism: the rail can only read as
 * progress if nothing around it moves, and the moment one step's header is 8 px
 * taller than another's the rail is decoration. The single exception the spec
 * grants is step 6, whose footer carries a counter row above the button, and it
 * is passed in rather than special-cased here.
 */

/* ──────────────────────────── the board ─────────────────────────────── */

/**
 * Which of the two width columns this device is on.
 *
 * HORIZONTAL ONLY. Every height, every vertical gap and both keyboard budgets
 * are identical at 360 — which is why this returns a table of widths and two
 * type sizes rather than a second layout.
 */
export function useBoard(): Board {
  const { width } = useWindowDimensions();
  return width <= board.breakpoint ? board.tight : board.wide;
}

/* ─────────────────────────── the tick rail ──────────────────────────── */

/**
 * Seven ticks: six at 13 plus one at 26 = 104, plus 30 of gaps = 134 total,
 * left-aligned with 4 of inset.
 *
 * No labels, no counter, no percentage. The entire indicator is 134 × 3 and it
 * says only "some behind, one here, some ahead" — which is the whole of what a
 * person needs from a seven-step form and is considerably less than "4 of 7"
 * implies, because step 4 is not four sevenths of the work.
 *
 * ── WHY EACH TICK ANIMATES ITSELF ───────────────────────────────────────────
 *
 * The transition is two ticks moving at once in opposite directions: the
 * leaving one 26 → 13 and green → forest, the arriving one 13 → 26 and line →
 * green, simultaneously over 200 ms. Driving that from the rail would need the
 * rail to know which step it came from. Each tick instead animates toward its
 * own phase — 0 upcoming, 1 current, 2 done — and the two that change do so at
 * the same time because they are told at the same time.
 *
 * `useNativeDriver: false` is not optional: width and backgroundColor are laid
 * out on the JS side. Seven values on a 200 ms curve, twice per wizard session.
 */
function Tick({ phase }: { phase: 0 | 1 | 2 }) {
  const value = useRef(new Animated.Value(phase)).current;

  useEffect(() => {
    Animated.timing(value, {
      toValue: phase,
      duration: postMotion.tickMs,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [phase, value]);

  return (
    <Animated.View
      style={{
        width: value.interpolate({
          inputRange: [0, 1, 2],
          outputRange: [tick.upcoming.w, tick.current.w, tick.done.w],
        }),
        height: value.interpolate({
          inputRange: [0, 1, 2],
          outputRange: [tick.upcoming.h, tick.current.h, tick.done.h],
        }),
        backgroundColor: value.interpolate({
          inputRange: [0, 1, 2],
          outputRange: [tick.upcoming.color, tick.current.color, tick.done.color],
        }),
        // Resolved from the target rather than animated. At 1 px tall the
        // difference between a 0 and a 2 radius is not visible, and animating it
        // would put a third interpolation on the layout pass for nothing.
        borderRadius: phase === 0 ? tick.upcoming.r : tick.current.r,
      }}
    />
  );
}

export function TickRail({ step }: { step: number }) {
  const phases = useMemo(
    () =>
      Array.from({ length: tick.steps }, (_, i): 0 | 1 | 2 =>
        i < step ? 2 : i === step ? 1 : 0,
      ),
    [step],
  );

  return (
    <View
      // The row's height IS the current tick's 3, and every tick is centred in
      // it — a 1 px upcoming tick sits on the same optical line as a 3 px
      // current one rather than on the row's top edge.
      style={{
        height: tick.rowH,
        width: tick.totalW,
        flexDirection: "row",
        alignItems: "center",
        gap: tick.gap,
      }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: tick.steps, now: step + 1 }}
      accessibilityLabel={`Step ${step + 1} of ${tick.steps}`}
    >
      {phases.map((phase, i) => (
        <Tick key={i} phase={phase} />
      ))}
    </View>
  );
}

/* ───────────────────────────── the header ───────────────────────────── */

export interface HeaderProps {
  /** "Post an item", or "Edit listing" when reached from an existing listing. */
  title: string;
  /** A back chevron on every step but the first, where it is a close cross. */
  leading: "back" | "close";
  onLeading: () => void;
  /** "Save draft". Disabled while a detection or an upload is in flight. */
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  /** Step 1 puts its photo counter on the tick rail's line, right-aligned. */
  railTrailing?: React.ReactNode;
  step: number;
  board: Board;
}

export function PostHeader({
  title,
  leading,
  onLeading,
  actionLabel,
  onAction,
  actionDisabled = false,
  railTrailing,
  step,
  board: b,
}: HeaderProps) {
  const Leading = leading === "back" ? ChevronLeftIcon : CloseIcon;

  return (
    <View>
      <View
        style={{
          height: chrome.headerRow,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: b.headerX,
        }}
      >
        <Tappable
          onPress={onLeading}
          accessibilityRole="button"
          accessibilityLabel={leading === "back" ? "Go back a step" : "Close"}
          // 44 × 44, pulled left by the header padding so the glyph lands on the
          // gutter rather than the box's edge.
          style={{
            width: chrome.headerRow,
            height: chrome.headerRow,
            alignItems: "center",
            justifyContent: "center",
            marginLeft: -b.headerX + 4,
          }}
        >
          <Leading size={22} stroke={1.9} color={postColor.ink} />
        </Tappable>

        <Text
          style={[
            textStyle(postType.headerTitle),
            { color: postColor.ink, flex: 1, marginLeft: 4 },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>

        {actionLabel ? (
          <Tappable
            onPress={actionDisabled ? undefined : onAction}
            disabled={actionDisabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: actionDisabled }}
            style={{
              height: chrome.headerRow,
              justifyContent: "center",
              paddingLeft: 12,
              paddingRight: chrome.headerActionInset,
              marginRight: -chrome.headerActionInset + 4,
            }}
          >
            <Text
              style={[
                textStyle(postType.smallTextLabel),
                { color: actionDisabled ? postColor.inkDisabled : postColor.forest },
              ]}
            >
              {actionLabel}
            </Text>
          </Tappable>
        ) : null}
      </View>

      <View
        style={{
          marginTop: chrome.railAbove,
          marginBottom: chrome.railBelow,
          paddingLeft: chrome.railInset,
          paddingRight: b.headerX,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TickRail step={step} />
        {railTrailing}
      </View>
    </View>
  );
}

/* ───────────────────────────── the footer ──────────────────────────── */

/**
 * The footer: a hairline, 12, the 52 button, 26.
 *
 * `children` is for step 6's counter row, which sits ABOVE the button inside
 * the same block and takes the footer to 122. It is passed in rather than
 * flagged because it is one step's extra row, not a mode.
 */
export function PostFooter({
  children,
  board: b,
  safeBottom,
}: {
  children: React.ReactNode;
  board: Board;
  safeBottom: number;
}) {
  return (
    <View
      style={{
        borderTopWidth: chrome.footerRule,
        borderTopColor: postColor.divider,
        paddingTop: chrome.footerTop,
        paddingHorizontal: chrome.footerX,
        // The spec's 26 is a floor. A phone with a gesture bar reserves more and
        // one with hardware keys reserves none; taking the larger keeps the
        // button off the system affordance without opening a gap above it.
        paddingBottom: Math.max(chrome.footerBottom, safeBottom),
        backgroundColor: postColor.surface,
      }}
    >
      {children}
    </View>
  );
}

/* ─────────────────────── the keyboard-aware host ────────────────────── */

/**
 * The screen shell: status area, header, scroll, footer — and the IME.
 *
 * ── WHY NOT `KeyboardAvoidingView` ──────────────────────────────────────────
 *
 * `android/gradle.properties` sets `edgeToEdgeEnabled=true`, and from API 35
 * `SOFT_INPUT_ADJUST_RESIZE` is a NO-OP for an edge-to-edge window. The window
 * stays the full screen and the IME arrives as an inset the app applies itself.
 * KeyboardAvoidingView computes its offset from `getWindowVisibleDisplayFrame()`
 * — the frame that no longer shrinks — so it pads by nothing. The auth screens
 * hit this first and the full derivation is in `auth-sheet.tsx`; this shell
 * reuses `useKeyboardState()` from there rather than owning a second copy of a
 * subtle piece of platform arithmetic.
 *
 * `marginBottom: imeInset` on the root is the whole correction. On the 844
 * canvas with a 358 IME the host becomes 486, which is exactly section 6's
 * budget — the numbers in the spec are the numbers this produces.
 */
export function PostScreenHost({
  imeInset,
  children,
}: {
  imeInset: number;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: postColor.surface,
        // The spec's 44 is the canvas's status bar. A real inset wins where it
        // is larger (a notch) and the 44 holds where the device reports none.
        paddingTop: Math.max(insets.top, chrome.statusBar),
        marginBottom: imeInset,
      }}
    >
      {children}
    </View>
  );
}

/**
 * Section 6's escape hatch, as a boolean the steps can read.
 *
 * Past a 380 px IME the host keeps its (canvas − IME) height, the field block
 * becomes the scrolling region and the primary pins to the bottom. A FIELD
 * NEVER SHRINKS: not below 56, and not the text area below 132. That is the
 * spec's own instruction and it is what keeps the rhythm identical in every
 * state rather than merely similar.
 */
export const isTallIme = (imeHeight: number): boolean =>
  imeHeight > keyboardRule.tallImeThreshold;
