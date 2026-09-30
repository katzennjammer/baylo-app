import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Tappable } from "../Tappable";
import { color, size, space, textStyle, type } from "../../theme/tokens";

/**
 * Home's one section-header system (30 Sep 2026): a title of up to three
 * parts, one of them in an accent colour, an optional hand-drawn squiggle
 * under the accent, an optional icon after the title, a subtitle, and "See
 * all" on the title row.
 *
 *   <SectionHeader leading="Limited " accent="time" accentColor={color.urgent} squiggle ... />
 *   <SectionHeader accent="Shop" trailing=" spotlights" accentColor={color.forest} ... />
 *
 * Spaces between parts belong to the strings ("Limited ", " spotlights"), so
 * the header never guesses where a space goes. Titles are sentence case.
 *
 * ── ONE BASELINE ───────────────────────────────────────────────────────────
 *
 * Each part is its own Text in a row, all with the same style and no padding,
 * and the squiggle is absolutely positioned and takes no space, so every text
 * box is the same height and the words share a baseline. `alignItems:
 * "center"` then centres only the icon, which is shorter. This avoids
 * `alignItems: "baseline"` through the View that wraps the accent, which
 * Android and iOS resolve differently.
 *
 * ── THE SQUIGGLE ───────────────────────────────────────────────────────────
 *
 * An Svg beside the accent Text, never inside it. `preserveAspectRatio="none"`
 * stretches the 60-unit path to the accent's rendered width, and
 * `vectorEffect="non-scaling-stroke"` keeps the stroke at its real px through
 * that stretch.
 *
 * It starts at the BOTTOM of the text's line box (`top: "100%"`), not inside
 * it. Measured against Bricolage SemiBold (30 Sep 2026): the line box runs
 * 5.4 px below the baseline at 20 px, deeper than any glyph in these titles
 * (the "y" of "for you" reaches 3.6 px), so a squiggle below the box clears
 * every descender at any font scale. Hanging it 4 px INTO the box, as the
 * first version did, cut through the "p" of "Shop" and the "y" of "you".
 * The subtitle's top margin (`titleToSubtitle`) clears the squiggle's box.
 *
 * ── ACCESSIBILITY ──────────────────────────────────────────────────────────
 *
 * The title row is ONE element, role header, labelled with the three parts
 * joined ("Limited time", "Shop spotlights"), so a screen reader does not
 * announce the parts separately. The icon is decoration and is not read. The
 * subtitle and "See all" are separate: one is prose, the other a button.
 *
 * ── SMALL SCREENS, LARGE TEXT ──────────────────────────────────────────────
 *
 * Title parts and "See all" follow the system font size up to
 * `size.home.headingMaxFontScale`, no further, so a title stays on one line
 * and "See all" stays on screen at 320 dp (measured against the bundled
 * fonts, 30 Sep 2026). The subtitle scales freely and may wrap; it is prose.
 */
export function SectionHeader({
  leading,
  accent,
  trailing,
  accentColor = color.ink,
  squiggle = false,
  trailingIcon,
  subtitle,
  onSeeAll,
}: {
  leading?: string;
  accent: string;
  trailing?: string;
  /** Defaults to the heading ink: a plain title ("Categories"). */
  accentColor?: string;
  /** Hand-drawn underline under the accent word, in the accent colour. */
  squiggle?: boolean;
  /** Drawn after the title, e.g. a SparkleIcon. Decorative; not read aloud. */
  trailingIcon?: React.ReactNode;
  subtitle?: string;
  /** "See all" appears only when this is set. */
  onSeeAll?: () => void;
}) {
  const titleStyle = textStyle(type.homeSection);
  const label = `${leading ?? ""}${accent}${trailing ?? ""}`.trim();
  const part = (text: string, ink: string) => (
    <Text
      style={[titleStyle, { color: ink }]}
      numberOfLines={1}
      maxFontSizeMultiplier={size.home.headingMaxFontScale}
    >
      {text}
    </Text>
  );

  return (
    <View style={s.block}>
      <View style={s.row}>
        <View style={s.title} accessible accessibilityRole="header" accessibilityLabel={label}>
          {leading ? part(leading, color.ink) : null}
          <View>
            {part(accent, accentColor)}
            {squiggle ? (
              <View style={s.squiggle} pointerEvents="none">
                <Svg width="100%" height="100%" viewBox="0 0 60 8" preserveAspectRatio="none">
                  <Path
                    d="M2 5 Q15 1 30 4 T58 3"
                    fill="none"
                    stroke={accentColor}
                    strokeWidth={size.home.squiggleStroke}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </Svg>
              </View>
            ) : null}
          </View>
          {trailing ? part(trailing, color.ink) : null}
          {trailingIcon ? (
            <View style={s.icon} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              {trailingIcon}
            </View>
          ) : null}
        </View>

        {onSeeAll ? (
          <Tappable onPress={onSeeAll} accessibilityRole="button" hitSlop={12} style={s.seeAll}>
            <Text
              style={[textStyle(type.homeSeeAll), { color: color.forest }]}
              maxFontSizeMultiplier={size.home.headingMaxFontScale}
            >
              See all
            </Text>
          </Tappable>
        ) : null}
      </View>

      {subtitle ? <Text style={[textStyle(type.heroSubhead), s.subtitle]}>{subtitle}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  // Same outer spacing as Home's plain SectionHeading ("Categories"), so the
  // section rhythm holds down the whole screen.
  block: {
    paddingHorizontal: space.screenX,
    marginTop: space.home.sectionTop,
    marginBottom: space.home.headingToContent,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.home.searchGap,
  },
  title: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  squiggle: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "100%",
    height: size.home.squiggleHeight,
  },
  icon: { marginLeft: space.home.titleToIcon },
  seeAll: { flexShrink: 0 },
  subtitle: { color: color.inkSecondary, marginTop: space.home.titleToSubtitle },
});
