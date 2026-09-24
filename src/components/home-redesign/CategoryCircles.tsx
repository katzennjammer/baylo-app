import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  AppleIcon,
  BagIcon,
  BallIcon,
  BikeIcon,
  BoltIcon,
  BlocksIcon,
  BookIcon,
  GamepadIcon,
  GridIcon,
  MonitorIcon,
  ShirtIcon,
  SofaIcon,
  SproutIcon,
  type IconProps,
} from "../icons";
import { Tappable } from "../Tappable";
import { border, color, icon, radius, size, space, textStyle, type } from "../../theme/tokens";

/**
 * The Home category row: circular icon buttons over a label.
 *
 * SAME DATA SOURCE AS CategoryRail — `useBrowse().facets`, which the server
 * computes unfiltered — so a category with nothing in it never shows, and the
 * row does not reflow as it is used. Labels are the server's.
 *
 * SINGLE-SELECT here, unlike the rail's multi-select, and a MODE SWITCH for
 * the section below rather than a filter on it:
 *
 *   Exclusive lit        → the section is Exclusive: perishables, every
 *                          category. The default, and `selected === null`.
 *   a circle lit         → the section is Featured: paid boosts in that
 *                          category only.
 *
 * Exactly one of the two is lit at any moment. Lighting a circle unlights
 * Exclusive; tapping Exclusive, or the lit circle again, returns to it.
 *
 * ── EXCLUSIVE IS A CIRCLE TOO ─────────────────────────────────────────────
 *
 * First in the row, and drawn exactly as a category is — same circle, same
 * lit treatment, a label under it — with the bolt the perishable badge wears
 * on Exclusive tiles as its glyph. It was a chip once, like Marketplace's
 * Organizations pill; beside a row of circles that read as a separate control
 * rather than the first of the options, which is what it is. It is drawn
 * even when there are no facets: Exclusive is the default mode and must stay
 * reachable. Unlike a category, tapping it while lit does nothing — there is
 * no mode "under" Exclusive to return to.
 *
 * ── THE LIT CIRCLE IS A WHOLE STYLE, NOT A STYLE PLUS AN OVERRIDE ────────
 *
 * `s.circle` and `s.circleOn` are each COMPLETE: same box, different fill and
 * border, built from one shared `box` constant so the two can never drift.
 * The array form — `[s.circle, on && s.circleOn]` — expresses the lit state
 * as a patch that has to survive being merged over the base, and on this app
 * that merge is not React Native's. NativeWind's interop owns the `style` prop
 * of every element (see the note at the top of Tappable.tsx) and folds arrays
 * itself. It does merge correctly today; what it does not do is make the merge
 * obvious, and a fill that only exists as the second half of an array is a fill
 * that fails silently and invisibly. One name, one object, one truth.
 *
 * Three things move together, per the reference: the fill goes solid forest,
 * the glyph flips to the on-forest ink, and the label takes the fill's colour.
 * A lit circle whose icon stayed dark would be the least legible of the three.
 *
 * Categories with no glyph yet fall back to GridIcon rather than being hidden.
 */
type Glyph = (props: IconProps) => React.JSX.Element;

const GLYPHS: Record<string, Glyph> = {
  ELECTRONICS: MonitorIcon,
  CLOTHING: ShirtIcon,
  BAGS: BagIcon,
  FURNITURE: SofaIcon,
  BOOKS: BookIcon,
  GAMING: GamepadIcon,
  SPORTS: BallIcon,
  BIKES: BikeIcon,
  TOYS: BlocksIcon,
  PLANTS: SproutIcon,
  FOOD: AppleIcon,
};

export function CategoryCircles({
  facets,
  selected,
  onSelect,
}: {
  facets: { category: string; label: string; count: number }[];
  /** The lit circle, or null for Exclusive mode. */
  selected: string | null;
  /** A category enters Featured mode; null returns to Exclusive. */
  onSelect: (category: string | null) => void;
}) {
  const exclusiveOn = selected === null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      style={s.outer}
    >
      <Tappable
        onPress={() => onSelect(null)}
        accessibilityRole="button"
        accessibilityState={{ selected: exclusiveOn }}
        accessibilityLabel="Exclusive: perishable listings in every category"
        style={s.item}
        pressedStyle={s.itemPressed}
      >
        <View style={exclusiveOn ? s.circleOn : s.circle}>
          <BoltIcon
            size={icon.category.size}
            stroke={icon.category.stroke}
            color={exclusiveOn ? color.onGreen : color.inkSecondary}
          />
        </View>
        <Text
          style={[
            textStyle(type.categoryLabel),
            {
              color: exclusiveOn ? color.forest : color.inkSecondary,
              marginTop: space.home.circleToLabel,
            },
          ]}
          numberOfLines={1}
        >
          Exclusive
        </Text>
      </Tappable>

      {facets.map((f) => {
        const on = selected === f.category;
        const G = GLYPHS[f.category] ?? GridIcon;
        return (
          <Tappable
            key={f.category}
            onPress={() => onSelect(on ? null : f.category)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${f.label}, ${f.count} items`}
            style={s.item}
            pressedStyle={s.itemPressed}
          >
            <View style={on ? s.circleOn : s.circle}>
              <G
                size={icon.category.size}
                stroke={icon.category.stroke}
                color={on ? color.onGreen : color.inkSecondary}
              />
            </View>
            <Text
              style={[
                textStyle(type.categoryLabel),
                {
                  color: on ? color.forest : color.inkSecondary,
                  marginTop: space.home.circleToLabel,
                },
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

/** The box both states share, so only the colours are ever written twice. */
const box = {
  width: size.home.categoryCircle,
  height: size.home.categoryCircle,
  borderRadius: radius.categoryCircle,
  borderWidth: border.chip,
  alignItems: "center",
  justifyContent: "center",
} as const;

const s = StyleSheet.create({
  outer: { flexGrow: 0 },
  row: { paddingHorizontal: space.screenX, gap: space.home.categoryGap },
  item: { width: size.home.categoryItem, alignItems: "center" },
  itemPressed: { opacity: 0.75 },
  circle: {
    ...box,
    borderColor: color.controlLine,
    backgroundColor: color.control,
  },
  // Forest, not green: the lit circle carries a light glyph, and the reference
  // lights it dark. Green stays the CTA colour. The border matches the fill so
  // the circle reads as one solid disc rather than a filled outline.
  circleOn: {
    ...box,
    borderColor: color.forest,
    backgroundColor: color.forest,
  },
});
