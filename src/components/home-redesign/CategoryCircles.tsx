import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  AppleIcon,
  BagIcon,
  BallIcon,
  BikeIcon,
  BlocksIcon,
  BookIcon,
  BriefcaseIcon,
  GamepadIcon,
  GemIcon,
  GridIcon,
  HammerIcon,
  LipstickIcon,
  MonitorIcon,
  MoreIcon,
  MusicIcon,
  PaletteIcon,
  PawIcon,
  ShirtIcon,
  SofaIcon,
  SproutIcon,
  WatchIcon,
  type CategoryIconProps,
} from "../icons";
import { Tappable } from "../Tappable";
import {
  categoryTone,
  icon,
  radius,
  size,
  space,
  textStyle,
  type,
  color,
  type CategoryToneName,
} from "../../theme/tokens";

/**
 * The Home category row: circular icon buttons over a label.
 *
 * SAME DATA SOURCE AS CategoryRail — `useBrowse().facets`, which the server
 * computes unfiltered — so a category with nothing in it never shows, and the
 * row does not reflow as it is used. Labels are the server's.
 *
 * ── A SHORTCUT, NOT A MODE (30 Sep 2026) ─────────────────────────────────
 *
 * Tapping a circle opens Marketplace filtered to that category, the way a
 * food-delivery app's category row does. It used to switch Home's one section
 * between Exclusive and that category's boosts, which is why this row had a
 * lit state and an Exclusive circle at its head. Exclusive and Featured are
 * each their own section now, always on screen, so there is nothing for the
 * row to switch and neither the lit state nor the Exclusive circle is drawn.
 *
 * ── TWO-TONE ─────────────────────────────────────────────────────────────
 *
 * Each circle is its tone's pale disc, with the glyph outlined in the tone's
 * ink and one shape filled with its tint. See categoryTone in tokens.js for
 * the families and why the tint is opt-in on the glyph.
 *
 * Categories with no glyph yet fall back to GridIcon in the neutral tone
 * rather than being hidden.
 */
type Glyph = (props: CategoryIconProps) => React.JSX.Element;

const GLYPHS: Record<string, { glyph: Glyph; tone: CategoryToneName }> = {
  ELECTRONICS: { glyph: MonitorIcon, tone: "sky" },
  CLOTHING: { glyph: ShirtIcon, tone: "clay" },
  BAGS: { glyph: BagIcon, tone: "sand" },
  BEAUTY: { glyph: LipstickIcon, tone: "clay" },
  ACCESSORIES: { glyph: WatchIcon, tone: "lilac" },
  FURNITURE: { glyph: SofaIcon, tone: "sand" },
  BOOKS: { glyph: BookIcon, tone: "sky" },
  GAMING: { glyph: GamepadIcon, tone: "lilac" },
  SPORTS: { glyph: BallIcon, tone: "teal" },
  BIKES: { glyph: BikeIcon, tone: "teal" },
  TOYS: { glyph: BlocksIcon, tone: "clay" },
  TOOLS: { glyph: HammerIcon, tone: "sand" },
  MUSIC: { glyph: MusicIcon, tone: "sky" },
  ART: { glyph: PaletteIcon, tone: "lilac" },
  COLLECTIBLES: { glyph: GemIcon, tone: "lilac" },
  PETS: { glyph: PawIcon, tone: "teal" },
  PLANTS: { glyph: SproutIcon, tone: "green" },
  FOOD: { glyph: AppleIcon, tone: "green" },
  SERVICES: { glyph: BriefcaseIcon, tone: "sky" },
  OTHER: { glyph: MoreIcon, tone: "sand" },
};

export function CategoryCircles({
  facets,
  onSelect,
}: {
  facets: { category: string; label: string; count: number }[];
  /** Opens Marketplace filtered to `category`. */
  onSelect: (category: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      style={s.outer}
    >
      {facets.map((f) => {
        const entry = GLYPHS[f.category];
        const G = entry?.glyph ?? GridIcon;
        const tone = entry ? categoryTone[entry.tone] : null;
        return (
          <Tappable
            key={f.category}
            onPress={() => onSelect(f.category)}
            accessibilityRole="button"
            accessibilityLabel={`${f.label}, ${f.count} items. Opens Marketplace.`}
            style={s.item}
            pressedStyle={s.itemPressed}
          >
            {/* ONE object, not [s.circle, {backgroundColor}]: NativeWind's
                interop folds style arrays itself, and a fill that only exists
                as the second half of an array fails silently if that ever
                breaks. The old lit circle had the same rule. */}
            <View style={{ ...circleBox, backgroundColor: tone?.bg ?? color.control }}>
              <G
                size={icon.category.size}
                stroke={icon.category.stroke}
                color={tone?.ink ?? color.inkSecondary}
                tint={tone?.tint}
              />
            </View>
            <Text
              style={[
                textStyle(type.categoryLabel),
                { color: color.inkSecondary, marginTop: space.home.circleToLabel },
              ]}
              numberOfLines={1}
            >
              {f.label}
            </Text>
          </Tappable>
        );
      })}
    </ScrollView>
  );
}

/**
 * The disc, minus its fill. No border: the tone's disc is the whole shape. The
 * old outlined circle was a neutral control on the canvas; a tinted disc needs
 * no edge to read.
 */
const circleBox = {
  width: size.home.categoryCircle,
  height: size.home.categoryCircle,
  borderRadius: radius.categoryCircle,
  alignItems: "center",
  justifyContent: "center",
} as const;

const s = StyleSheet.create({
  outer: { flexGrow: 0 },
  row: { paddingHorizontal: space.screenX, gap: space.home.categoryGap },
  item: { width: size.home.categoryItem, alignItems: "center" },
  itemPressed: { opacity: 0.75 },
});
