import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Divider } from "../Divider";
import { border, color, radius, size, space, textStyle, type } from "../../theme/tokens";
import type { TrendingCategory } from "../../api/types";
import { Tappable } from "../Tappable";

/**
 * The 7-day category counts, as an interstitial rail of pill chips.
 *
 * A NOTE ON THE HEADING. The artboard reads "Trending in Lapu-Lapu". The
 * `trending` block is a groupBy over every visible listing created in the last
 * seven days with NO geographic filter of any kind — the route's own comment
 * describes it as the 7-day category groupBy that four web pages inline.
 * Naming a city over a nationwide count would make the heading a claim the
 * query does not support, and it would be least true for exactly the people it
 * is aimed at: someone in a town with two listings would read a number driven
 * by Manila. The heading drops the place and keeps the timeframe, which is the
 * part that IS in the data. It is the same rule that keeps "2.4 km away" off
 * the cards.
 *
 * THE CHIPS CARRY THE LABEL AND NOT THE COUNT, as drawn. The count is real and
 * is not thrown away — it goes into the accessibility label, where it costs no
 * width. A chip rail is scanned rather than read, and a number on each pill is
 * the thing that turns scanning into reading.
 */
export function TrendingStrip({ trending }: { trending: TrendingCategory[] }) {
  const router = useRouter();

  if (trending.length === 0) return null;

  return (
    <View style={s.section}>
      <View style={s.header}>
        <Text style={[textStyle(type.sectionHeading), { color: color.forest }]}>Trending</Text>
        <Text style={[textStyle(type.sectionEyebrow), { color: color.inkMuted }]}>
          this week
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
        {trending.map((t) => (
          <Tappable
            key={t.category}
            onPress={() => router.push("/marketplace")}
            accessibilityRole="button"
            accessibilityLabel={`${t.label}, ${t.count} listed this week`}
            style={s.chip}
            pressedStyle={s.chipPressed}
          >
            <Text style={[textStyle(type.trendingChip), { color: color.ink }]}>{t.label}</Text>
          </Tappable>
        ))}
      </ScrollView>

      <Divider />
    </View>
  );
}

const s = StyleSheet.create({
  // The bottom rule belongs to the section, so the padding sits above it and
  // the rail can still run to the screen edge.
  section: { backgroundColor: color.surface, paddingTop: space.trending.y },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: space.screenX,
  },
  rail: {
    paddingHorizontal: space.screenX,
    paddingTop: space.trending.headerToRail,
    paddingBottom: space.trending.y,
    gap: space.trending.chipGap,
  },
  chip: {
    height: size.control.trendingChip,
    justifyContent: "center",
    paddingHorizontal: size.control.trendingChipX,
    borderRadius: radius.trendingChip,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    backgroundColor: color.control,
  },
  chipPressed: { backgroundColor: color.greenWash, borderColor: color.greenLine },
});
