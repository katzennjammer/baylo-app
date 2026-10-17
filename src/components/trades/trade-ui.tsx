import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { Tappable } from "../Tappable";
import { CheckIcon } from "../icons";
import { border, color, radius, size, space, textStyle, type } from "../../theme/tokens";
import { offerBorder } from "../../theme/offer-tokens";

/**
 * The small controls the trade screen, the hub picker and the chat offer card
 * share (Round 2, 1 Oct 2026). Existing tokens only; body family throughout.
 */

/**
 * The trade flow's button. `solid` is the one forest-filled control on a
 * screen; `outline` is the forest-ruled secondary; `quiet` is the grey-ruled
 * equal-weight half of a pair (Decline). Disabled is a grey fill with muted
 * ink, never a faded forest — a faded forest reads as "pressed".
 */
export function TradeButton({
  label,
  onPress,
  tone = "solid",
  disabled = false,
  disabledInk = "muted",
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: "solid" | "outline" | "quiet";
  disabled?: boolean;
  /**
   * `readable` when the disabled label IS the instruction ("Choose a hub
   * first"): same grey fill, secondary ink instead of muted, so the sentence
   * can actually be read. Every other caller keeps the muted default.
   */
  disabledInk?: "muted" | "readable";
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const look = disabled
    ? {
        backgroundColor: color.control,
        borderColor: color.control,
        ink: disabledInk === "readable" ? color.inkSecondary : color.inkMuted,
      }
    : tone === "solid"
      ? { backgroundColor: color.forest, borderColor: color.forest, ink: color.onScrim }
      : tone === "outline"
        ? { backgroundColor: color.surface, borderColor: color.forest, ink: color.forest }
        : { backgroundColor: color.surface, borderColor: color.controlLineStrong, ink: color.ink };

  return (
    <Tappable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={[
        s.button,
        {
          backgroundColor: look.backgroundColor,
          borderColor: look.borderColor,
          borderWidth: tone === "outline" && !disabled ? offerBorder.selected : offerBorder.rule,
        },
        style,
      ]}
      pressedStyle={disabled ? undefined : tone === "solid" ? { opacity: 0.85 } : { backgroundColor: color.inset }}
    >
      <Text style={[textStyle(type.primaryButton), { color: look.ink, textAlign: "center" }]}>
        {label}
      </Text>
    </Tappable>
  );
}

/** A status chip: "Your move" amber, "Accepted" green, the rest grey. */
export function StatusChip({ label, tone }: { label: string; tone: "amber" | "green" | "grey" }) {
  const look =
    tone === "amber"
      ? { backgroundColor: color.surface, borderColor: color.accentGold, ink: color.accentGold }
      : tone === "green"
        ? { backgroundColor: color.greenWash, borderColor: color.greenWash, ink: color.forest }
        : { backgroundColor: color.control, borderColor: color.control, ink: color.inkSecondary };
  return (
    <View
      style={[s.chip, { backgroundColor: look.backgroundColor, borderColor: look.borderColor }]}
    >
      <Text
        style={[textStyle(type.urgencyChip), { color: look.ink }]}
        numberOfLines={1}
        maxFontSizeMultiplier={size.home.headingMaxFontScale}
      >
        {label}
      </Text>
    </View>
  );
}

/** One short notice line with a leading icon, and an optional link under it. */
export function NoticeRow({
  icon,
  children,
  link,
  style,
}: {
  icon: ReactNode;
  children: string;
  link?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.notice, style]}>
      <View style={s.noticeIcon}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <Text style={[textStyle(type.detailBody), { color: color.inkSecondary }]}>{children}</Text>
        {link ?? null}
      </View>
    </View>
  );
}

/**
 * A small step heading: "1  Read your code to Aj".
 *
 * `done` swaps the number for a check in the same forest dot (the meetup
 * picker's three steps). Omitted — the handoff panel — it draws exactly what
 * it always has.
 */
export function StepHeading({ n, done, children }: { n: number; done?: boolean; children: string }) {
  return (
    <View style={s.step}>
      <View style={s.stepDot}>
        {done ? (
          <CheckIcon size={STEP_DOT - 8} stroke={2} color={color.onScrim} />
        ) : (
          <Text
            style={[textStyle(type.urgencyChip), { color: color.onScrim }]}
            maxFontSizeMultiplier={size.home.headingMaxFontScale}
          >
            {n}
          </Text>
        )}
      </View>
      <Text
        style={[textStyle(type.username), { color: color.ink, flex: 1 }]}
        accessibilityRole="header"
        accessibilityLabel={done === undefined ? undefined : `Step ${n}, ${children}${done ? ", done" : ""}`}
      >
        {children}
      </Text>
    </View>
  );
}

const STEP_DOT = size.home.countdownPill;

const s = StyleSheet.create({
  button: {
    minHeight: size.control.primaryButton,
    paddingHorizontal: size.home.heroCtaX,
    paddingVertical: space.chip.y,
    borderRadius: radius.primaryButton,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    flexShrink: 0,
    paddingHorizontal: space.chip.x,
    paddingVertical: space.chip.y - 2,
    borderRadius: radius.chip,
    borderWidth: border.chip,
  },
  notice: {
    flexDirection: "row",
    gap: space.browse.searchGap,
    padding: space.home.tileBody,
    borderRadius: radius.hubRow,
    backgroundColor: color.inset,
  },
  noticeIcon: { paddingTop: 2 },
  step: { flexDirection: "row", alignItems: "center", gap: space.browse.searchGap },
  stepDot: {
    width: STEP_DOT,
    height: STEP_DOT,
    borderRadius: STEP_DOT / 2,
    backgroundColor: color.forest,
    alignItems: "center",
    justifyContent: "center",
  },
});
