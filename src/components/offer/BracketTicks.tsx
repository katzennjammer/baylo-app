import { View } from "react-native";

import { BRACKET_COUNT, bracketLabel, bracketsWord, type Bracket } from "../../lib/brackets";
import { offerColor, offerSize } from "../../theme/offer-tokens";

/* ───────────────────── §7.3 / §1.9 the bracket ticks ────────────────── */


/**
 * Out-of-reach's own bar: one tick per value bracket.
 *
 * `#3DBE5A` the brackets your highest item covers / `#B7D9BE` the margin up to
 * your reach / `#C56A4B` the brackets beyond it, up to the listing's / the
 * `#EAF6EC` wash for everything above. §1.3 is explicit that `green/soft`
 * appears here and nowhere else in the app.
 *
 * ── EQUAL CELLS, NOT PROPORTIONAL SEGMENTS ──────────────────────────────────
 *
 * The threshold bar this replaces drew its segments as flex ratios on the true
 * Leaves values, which was right when the legend under it printed those values
 * and wrong the moment it stopped: a bar whose widths follow the numbers still
 * leaks the ratio the bracket exists to withhold — a listing four times your
 * item's value is visibly four times as long. Ten equal cells say what the
 * copy says, "two brackets above", and nothing more.
 *
 * THE TERRACOTTA HERE IS NOT AN ERROR COLOUR. §1.4's closing line — "Never used
 * for out-of-reach. Out-of-reach is not an error" — refers to the four warm
 * jobs it lists (promise blocks, failure panels, debts, defaults). §1.9's own
 * table then assigns the distance segment `#C56A4B` explicitly. The two agree:
 * the hex marks a distance, and nothing around it is styled as a failure.
 *
 * No animation. This bar is drawn once from a reach that only moves when the
 * shelf does, and §11 gives it no transition.
 */
export function BracketTicks({
  yourBracket,
  reach,
  listing,
}: {
  /**
   * Your highest item's bracket, or null for a viewer with nothing posted.
   * NULL DRAWS NO GREEN: the ticks then start at the floor and read as "the
   * margin, then the distance", which is the honest shape — a green cell with
   * a label under it would claim an item that does not exist.
   */
  yourBracket: Bracket | null;
  /** The reach bracket — one above your best, floored at bracket 2. */
  reach: Bracket;
  /** This listing's bracket, above `reach` or the bar would not be drawn. */
  listing: Bracket;
}) {
  const cells = Array.from({ length: BRACKET_COUNT }, (_, i) => i + 1);
  const tone = (b: Bracket): string =>
    yourBracket !== null && b <= yourBracket
      ? offerColor.green
      : b <= reach
        ? offerColor.soft
        : b <= listing
          ? offerColor.warm
          : offerColor.trackGreen;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={
        yourBracket === null
          ? `You have nothing posted, so your reach starts at ${bracketLabel(reach)}. ` +
            `This listing is in ${bracketLabel(listing)}, ${bracketsWord(listing - reach)} above that.`
          : `Your highest item is in ${bracketLabel(yourBracket)} and reaches into ` +
            `${bracketLabel(reach)}. This listing is in ${bracketLabel(listing)}, ` +
            `${bracketsWord(listing - reach)} above your reach.`
      }
      style={{
        height: offerSize.bracketTicks.height,
        flexDirection: "row",
        gap: offerSize.bracketTicks.gap,
      }}
    >
      {cells.map((b) => (
        <View
          key={b}
          style={{
            flex: 1,
            borderRadius: offerSize.bracketTicks.radius,
            backgroundColor: tone(b),
          }}
        />
      ))}
    </View>
  );
}
