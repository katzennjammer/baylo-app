import { useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";

import { useOfferBoard, useReducedMotion } from "./chrome";
import { grouped, type GapResult } from "../../lib/gap";
import {
  offerColor,
  offerRadius,
  offerSize,
  offerSpace,
  offerType,
  textStyle,
} from "../../theme/offer-tokens";

/**
 * The gap, as one horizontal track. Direction A's whole argument.
 *
 * ── WHY A TRACK AND NOT TWO COLUMNS ─────────────────────────────────────────
 *
 * §12 records the road not taken and the two reasons A won, and both show up in
 * this file. First, a horizontal bar holds any magnitude from 40 to 1,900
 * without the drawing breaking down — the segments are flex ratios, so a 1,900
 * gap is the same component as a 40 one and needs no special case. Second, one
 * track leaves the vertical space the settlement rows, the record tables and
 * the ceiling table need. Nothing in this file is a column, and Direction B is
 * not built.
 *
 * ── THE TRACK NEVER LIES ABOUT RATIO ────────────────────────────────────────
 *
 * §5.1's closing line: "The track never lies about ratio, and the treatment
 * never changes with magnitude — only how much terracotta is visible." So the
 * segments are `flex` on the true values with ONE correction, §4's `min visible
 * segment 4px`, applied through `minWidth` rather than by inflating the flex
 * value. A 4px floor on a 358px bar is a 1.1% distortion at the extreme and it
 * is the difference between "almost nothing" and "nothing at all", which are
 * different claims. Inflating the ratio instead would distort every segment.
 */

/* ──────────────────────────── the track ─────────────────────────────── */

interface Segment {
  /** Proportional weight. The true value, never rounded for looks. */
  weight: number;
  color: string;
  /** §5.1's "offering more" puts a 2px gap before the overflow segment. */
  gapBefore?: boolean;
  label: string;
}

/**
 * One segment, animating its own flex.
 *
 * §11: "track segments animate width 220ms cubic-bezier(.2,.6,.2,1)". Driven
 * per-segment rather than from the track, for the same reason the post flow's
 * tick rail is: the transition is several segments moving at once in different
 * directions, and a parent driving it would have to know which arrangement it
 * came from. Each animates toward its own weight and they move together because
 * they are told together.
 *
 * `useNativeDriver: false` is not optional — `flexGrow` is a layout property
 * and is resolved on the JS side. Three values on a 220ms curve, once per
 * settlement change.
 */
function TrackSegment({ segment, reduced }: { segment: Segment; reduced: boolean }) {
  const grow = useRef(new Animated.Value(segment.weight)).current;

  useEffect(() => {
    if (reduced) {
      grow.setValue(segment.weight);
      return;
    }
    const anim = Animated.timing(grow, {
      toValue: segment.weight,
      duration: 220,
      easing: Easing.bezier(0.2, 0.6, 0.2, 1),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [segment.weight, reduced, grow]);

  return (
    <Animated.View
      style={{
        flexGrow: grow,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: offerSize.track.minSegment,
        marginLeft: segment.gapBefore ? offerSize.track.segmentGap : 0,
        backgroundColor: segment.color,
      }}
    />
  );
}

/**
 * §5.1's five tracks, from one `GapResult`.
 *
 * Even            one `#3DBE5A` fill at the yours/theirs ratio.
 * Offering more   `#3DBE5A` to theirs, `#1B4D2B` beyond, with a 2px gap.
 * Small / large   `#3DBE5A` for what you cover, `#C56A4B` for the shortfall.
 * Very large      the true ratio, with the green held at its 4px floor.
 *
 * The last two are the SAME component: §5.1 says the treatment never changes
 * with magnitude, only how much terracotta is visible, and that falls out of
 * the flex values without a branch.
 *
 * The unfilled remainder is the track's own `#EAF6EC` ground, which is why
 * `Even` needs no second segment: at a 40-apart ratio the green fills its share
 * and the wash shows the rest.
 */
export function GapTrack({ gap, yours, theirs }: { gap: GapResult; yours: number; theirs: number }) {
  const reduced = useReducedMotion();

  const segments: Segment[] = (() => {
    switch (gap.situation) {
      case "over":
        return [
          { weight: theirs, color: offerColor.green, label: "matched" },
          { weight: gap.over, color: offerColor.deep, gapBefore: true, label: "over" },
        ];
      case "even":
        // One fill at the yours/theirs ratio, against the wash. Capped at 1 so a
        // value 9% above theirs — still Even — does not overflow the bar.
        return [{ weight: Math.min(yours, theirs), color: offerColor.green, label: "yours" }];
      default:
        return [
          { weight: yours, color: offerColor.green, label: "yours" },
          { weight: gap.short, color: offerColor.warm, label: "short" },
        ];
    }
  })();

  // The wash behind everything. `Even` and `over` leave part of it showing;
  // a shortfall track covers it entirely, which is correct — there is no
  // "unaccounted for" portion once the terracotta names the whole difference.
  const filled = segments.reduce((n, s) => n + s.weight, 0);
  const remainder = gap.situation === "even" ? Math.max(0, theirs - filled) : 0;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={trackDescription(gap, yours, theirs)}
      style={{
        height: offerSize.track.height,
        borderRadius: offerSize.track.radius,
        backgroundColor: offerColor.trackGreen,
        flexDirection: "row",
        overflow: "hidden",
      }}
    >
      {segments.map((segment) => (
        <TrackSegment key={segment.label} segment={segment} reduced={reduced} />
      ))}
      {remainder > 0 ? <View style={{ flexGrow: remainder, flexBasis: 0 }} /> : null}
    </View>
  );
}

/**
 * What a screen reader is told instead of the bar.
 *
 * A bar is a picture of a ratio and a screen reader cannot see it, so this says
 * the ratio in words. It deliberately does NOT read the figure above it — that
 * `Text` is already in the accessibility tree, and announcing "40 Leaves short"
 * twice is how a screen becomes unusable with a reader on.
 */
function trackDescription(gap: GapResult, yours: number, theirs: number): string {
  switch (gap.situation) {
    case "even":
      return `Your side ${grouped(yours)}, theirs ${grouped(theirs)}. Close to level.`;
    case "over":
      return `Your side ${grouped(yours)}, theirs ${grouped(theirs)}. You are over by ${grouped(gap.over)}.`;
    default:
      return `Your side ${grouped(yours)}, theirs ${grouped(theirs)}. ${grouped(gap.short)} short.`;
  }
}

/* ──────────────────────────── the figure ────────────────────────────── */

/**
 * §2's gap figure: 44px Bricolage on a 40px line, with a 14px mono suffix
 * baseline-aligned −5.
 *
 * THE NEGATIVE LEADING IS DRAWN AS A BOX, NOT AS A `lineHeight`. `lineHeight:
 * 40` on a 44px cap shears the glyph in React Native, which clips to the line
 * box rather than letting it overflow the way CSS does. So the row is 40 tall,
 * the Text carries no `lineHeight` at all, and the overhang lands outside the
 * box exactly as the artboard shows it.
 *
 * §11 cross-fades the figure over 120ms while the track's segments move under
 * it. The fade is keyed on the rendered STRING rather than on the situation: a
 * settlement change that moves 40 to 180 within the same situation is the same
 * kind of change to a reader, and keying on the situation would leave that one
 * hard-cutting while the track animated beneath it.
 */
export function GapFigure({
  value,
  suffix,
  word = false,
  tone = "ink",
}: {
  value: string;
  suffix: string | null;
  /**
   * §2 gives `Even` its own role — "Gap word", 40px on a 36 line — separate from
   * the 44px "Gap figure". They are the same slot and two different type roles,
   * because a word and a numeral of the same nominal size do not read as the
   * same size, and the spec resolves both rather than one.
   */
  word?: boolean;
  /** §5.1 puts the "offering more" figure in `#1B4D2B`, not in ink. */
  tone?: "ink" | "deep";
}) {
  const board = useOfferBoard();
  const reduced = useReducedMotion();
  const fade = useRef(new Animated.Value(1)).current;
  const shown = useRef(value);

  useEffect(() => {
    if (shown.current === value) return;
    shown.current = value;
    if (reduced) {
      fade.setValue(1);
      return;
    }
    // Out and back rather than a cross-dissolve between two copies: there is
    // one figure and it is 44px of Bricolage, so two of them overlapping mid-
    // transition reads as a rendering fault rather than as a change.
    const anim = Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 60, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 60, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [value, reduced, fade]);

  return (
    <Animated.View
      style={{
        height: offerSize.gapFigureBlock,
        flexDirection: "row",
        alignItems: "flex-end",
        opacity: fade,
      }}
    >
      <Text
        style={[
          textStyle(word ? offerType.gapWord : offerType.gapFigure),
          {
            color: tone === "deep" ? offerColor.deep : offerColor.ink,
            // §9 moves the FIGURE from 44 to 40 at the tight board. The word is
            // already 40 and §9 does not shrink it, so it keeps its own size.
            ...(word
              ? {}
              : { fontSize: board.gapFigure, letterSpacing: board.gapFigureTracking }),
          },
        ]}
      >
        {value}
      </Text>
      {suffix ? (
        <Text
          style={[
            textStyle(offerType.leavesRow),
            {
              color: offerColor.inkSecondary,
              fontSize: offerSize.gapSuffix.size,
              marginLeft: 8,
              // §4's "baseline-aligned −5". The row is bottom-aligned, so the
              // suffix rides 5 above the figure's own baseline.
              marginBottom: -offerSize.gapSuffix.baselineShift,
            },
          ]}
        >
          {suffix}
        </Text>
      ) : null}
    </Animated.View>
  );
}

/**
 * §4's track legend: two 11px mono labels, space-between.
 *
 * `#8C8A7E` per §1.2 — the legend is a footnote about the bar, not a fact in
 * its own right, and the figure above it is where the number that matters is.
 */
export function TrackLegend({ left, right }: { left: string; right: string }) {
  return (
    <View
      style={{
        marginTop: offerSpace.gapBlock.trackToLegend,
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}>
        {left}
      </Text>
      <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}>
        {right}
      </Text>
    </View>
  );
}

/* ───────────────────── §7.3 / §1.9 the threshold bar ────────────────── */

/**
 * Out-of-reach's own bar: your item, the margin, the distance.
 *
 * `#3DBE5A` your item / `#B7D9BE` the margin between it and the threshold /
 * `#C56A4B` the distance beyond. §1.3 is explicit that `green/soft` appears
 * here and nowhere else in the app.
 *
 * THE TERRACOTTA HERE IS NOT AN ERROR COLOUR. §1.4's closing line — "Never used
 * for out-of-reach. Out-of-reach is not an error" — refers to the four warm
 * jobs it lists (promise blocks, failure panels, debts, defaults). §1.9's own
 * table then assigns the distance segment `#C56A4B` explicitly. The two agree:
 * the hex marks a distance, and nothing around it is styled as a failure.
 *
 * No animation. This bar is drawn once from a threshold that only moves when
 * the shelf does, and §11 gives it no transition.
 */
export function ThresholdBar({
  yourItem,
  reach,
  listing,
}: {
  /**
   * Your highest item's value, or null for a viewer with nothing posted. NULL
   * DRAWS NO SEGMENT, rather than a zero-width one: the bar then starts at the
   * floor and reads as "the margin, then the distance", which is the honest
   * shape — a sliver of green with a label under it would claim an item that
   * does not exist.
   */
  yourItem: number | null;
  /** The computed reach — `max(highest × 1.5, 150)`. */
  reach: number;
  /** This listing's value, which is above `reach` or the bar would not be drawn. */
  listing: number;
}) {
  const margin = Math.max(0, reach - (yourItem ?? 0));
  const distance = Math.max(0, listing - reach);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={
        yourItem === null
          ? `You have nothing posted, so your reach starts at ${grouped(reach)}. ` +
            `This listing is ${grouped(listing)} — ${grouped(distance)} above that.`
          : `Your highest item is ${grouped(yourItem)}. A swap here is straightforward from about ` +
            `${grouped(reach)}, and this listing is ${grouped(listing)} — ` +
            `${grouped(listing - yourItem)} further than your item on its own.`
      }
      style={{
        height: offerSize.thresholdBar.height,
        borderRadius: offerSize.thresholdBar.radius,
        backgroundColor: offerColor.trackGreen,
        flexDirection: "row",
        overflow: "hidden",
      }}
    >
      {yourItem !== null ? (
        <View
          style={{
            flexGrow: yourItem,
            flexBasis: 0,
            minWidth: offerSize.track.minSegment,
            backgroundColor: offerColor.green,
          }}
        />
      ) : null}
      <View
        style={{
          flexGrow: margin,
          flexBasis: 0,
          minWidth: margin > 0 ? offerSize.track.minSegment : 0,
          backgroundColor: offerColor.soft,
        }}
      />
      <View
        style={{
          flexGrow: distance,
          flexBasis: 0,
          minWidth: offerSize.track.minSegment,
          backgroundColor: offerColor.warm,
        }}
      />
    </View>
  );
}

/**
 * §5.2's loading track: the bar at `#EAF6EC` full width, the figure a 44 × 40
 * `#EDEBE3` block.
 *
 * NO SHIMMER. §5.2 says "No skeleton shimmer on text" and the same restraint is
 * applied here — a pulsing bar over a number that is about to be a fact reads
 * as the number changing.
 */
export function GapSkeleton() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View
        style={{
          width: offerSize.figureSkeleton.w,
          height: offerSize.figureSkeleton.h,
          backgroundColor: offerColor.quiet,
          borderRadius: offerRadius.track,
        }}
      />
      <View
        style={{
          marginTop: offerSpace.gapBlock.figureToTrack,
          height: offerSize.track.height,
          borderRadius: offerSize.track.radius,
          backgroundColor: offerColor.trackGreen,
        }}
      />
    </View>
  );
}
