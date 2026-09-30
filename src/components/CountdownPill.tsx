import { useEffect, useRef } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { FlameIcon } from "./icons";
import { useLiveNow } from "../lib/live-clock";
import { countdownA11yLabel, formatCountdown, secondsLeft } from "../lib/perishable";
import { border, color, icon, radius, size, textStyle, type } from "../theme/tokens";

/**
 * A perishable's window as a LIVE countdown: "05:12:44", "1d 14:22:05".
 *
 * ── ONE PILL, EVERY SURFACE (1 Oct 2026) ────────────────────────────────────
 *
 * Home's Limited-time cards, every GridTile (Marketplace, a hub's grid, the
 * search helper) and, at `size="large"`, the listing screen under the photo.
 * It replaced the relative phrases ("Ends tomorrow", "A few hours left") and
 * the listing screen's coral "14:15:42 left" clock.
 *
 * THE PILL SUBSCRIBES, NOT THE CARD. `useLiveNow()` is the app's one shared
 * ticker (lib/live-clock), so each second re-renders this pill and nothing
 * around it; the memo'd tiles stay put. It pauses with its screen's focus and
 * with the app in the background.
 *
 * ── LOOK ────────────────────────────────────────────────────────────────────
 *
 * Solid `color.urgent` (#B0553A) with white bold figures and a flame: 4.99:1,
 * clear of AA for 12 px text. (The old urgent-on-urgentWash pair was 4.4:1.)
 * Tabular figures, two-digit fields, so the pill keeps its width while it
 * ticks. At zero it turns into a neutral grey "Ended" pill with no flame
 * (inkSecondary on control, 5.94:1). A card that ends mid-scroll stays where
 * it is and says so; nothing removes it until the next fetch.
 *
 * ── SCREEN READERS ──────────────────────────────────────────────────────────
 *
 * The label is "Ends in 5 hours 12 minutes" at minute resolution, so it only
 * changes once a minute. No live region and no `timer` role: a countdown must
 * never be read out as it ticks. Where the pill sits inside a tile whose own
 * label already says it, the tile hides it (`no-hide-descendants`).
 */
export function CountdownPill({
  expiresAt,
  expired = false,
  size: variant = "card",
  onEnd,
  style,
}: {
  expiresAt: string;
  /** The server's own flag. Wins over the clock: past the sweep is past. */
  expired?: boolean;
  /** "card" on tiles and cards; "large" under the photo on the listing screen. */
  size?: "card" | "large";
  /** Called once when the window reaches zero while this pill is on screen. */
  onEnd?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const now = useLiveNow();
  const left = expired ? 0 : secondsLeft(expiresAt, now);
  const ended = left <= 0;

  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  useEffect(() => {
    if (ended) onEndRef.current?.();
  }, [ended]);

  const large = variant === "large";
  const glyph = large ? icon.countdownLarge : icon.countdown;

  return (
    <View
      style={[s.pill, large ? s.large : s.card, ended ? s.ended : s.live, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={countdownA11yLabel(left)}
    >
      {ended ? null : <FlameIcon size={glyph.size} stroke={glyph.stroke} color={color.onScrim} />}
      <Text
        style={[
          textStyle(large ? type.countdownLiveLarge : type.countdownLive),
          { color: ended ? color.inkSecondary : color.onScrim },
        ]}
        numberOfLines={1}
        // A card's pill rides a photo or a tight panel; past 1.15x it covers
        // the photo on a 320 dp tile. The listing screen has the room to scale.
        maxFontSizeMultiplier={large ? undefined : size.home.overlayMaxFontScale}
      >
        {ended ? "Ended" : formatCountdown(left)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: border.chip,
  },
  card: {
    minHeight: size.home.countdownPill,
    paddingHorizontal: size.home.countdownPillX,
    borderRadius: radius.countdownPill,
    gap: 4,
  },
  large: {
    minHeight: size.detail.countdownPill,
    paddingHorizontal: size.detail.countdownPillX,
    paddingVertical: 4,
    borderRadius: radius.countdownPillLarge,
    gap: 6,
  },
  live: { backgroundColor: color.urgent, borderColor: color.urgent },
  ended: { backgroundColor: color.control, borderColor: color.controlLine },
});
