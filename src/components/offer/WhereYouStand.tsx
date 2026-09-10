import { Text, View } from "react-native";

import { ArrowsIcon, PromiseIcon } from "./icons";
import { RouteRow } from "./rows";
import { Section, SectionLabel } from "./chrome";
import { ThresholdBar } from "./GapTrack";
import * as copy from "./copy";
import { grouped } from "../../lib/gap";
import type { TrustTier } from "../../lib/trust";
import {
  offerColor,
  offerIcon,
  offerSize,
  offerSpace,
  offerType,
  textStyle,
} from "../../theme/offer-tokens";

/**
 * §7.3 — the `Where you stand` insert on item detail.
 *
 * ── WHERE IT GOES AND WHAT IT DOES NOT TOUCH ────────────────────────────────
 *
 * "Inserted between the value row and *Description*." The PHOTO ABOVE IT STAYS
 * IN FULL COLOUR — §7.3 says so in bold and §1.9 repeats it: the grey belongs to
 * the grid, not to the item. Nothing on the detail screen is greyed, dimmed or
 * disabled by this insert, and the `Offer a trade` button in the bottom bar
 * stays green and live.
 *
 * ── THE ORDER IS FIXED BY §7.3 ──────────────────────────────────────────────
 *
 *   label → one paragraph → threshold bar → legend → two route rows → footnote
 *
 * and §3.6 fixes every gap between them. Both routes are ROWS, not buttons —
 * §7.3 again — because a route here is an explanation of what would work, not a
 * control that does it.
 *
 * ── NOT AN ERROR, AND THE COPY IS POLICED FOR IT ────────────────────────────
 *
 * §1.4's closing line keeps the warm accent out of this area as a failure
 * signal; the one place it appears is the bar's distance segment, where it marks
 * a distance. §10.8's closing list bans `locked`, `unavailable`, `you can't`,
 * `too expensive`, `upgrade`, `unlock` and any figure describing the user's
 * total worth — the last of which is why this insert names the viewer's HIGHEST
 * ITEM and never a sum of everything they own.
 */
export function WhereYouStand({
  listingValue,
  highestItem,
  reach,
  owner,
  tier,
  promiseCeiling,
}: {
  /** This listing's value. Above `reach`, or the insert would not be drawn. */
  listingValue: number;
  /** The viewer's highest AVAILABLE item — the one §10.8's paragraph names. */
  highestItem: { title: string; valueLeaves: number };
  reach: number;
  owner: string;
  tier: TrustTier;
  /**
   * What this viewer may actually promise, after every server gate. Zero for a
   * New Trader, which is why §10.8's route copy has a zero-ceiling variant: "A
   * Deferred Points Agreement covers up to 200" is a sentence that cannot be
   * written when the ceiling is nothing.
   */
  promiseCeiling: number;
}) {
  const distance = listingValue - reach;

  return (
    <Section pad={offerSpace.section.reachInsert}>
      <SectionLabel>{copy.reach.label}</SectionLabel>

      <Text
        style={[
          textStyle(offerType.body),
          { color: offerColor.inkSecondary, marginTop: offerSpace.reach.labelToCopy },
        ]}
      >
        {copy.reach.body(highestItem.title, highestItem.valueLeaves, reach, distance)}
      </Text>

      <View style={{ marginTop: offerSpace.reach.copyToBar }}>
        <ThresholdBar
          yourItem={highestItem.valueLeaves}
          reach={reach}
          listing={listingValue}
        />
      </View>

      {/* §7.3's legend: your item on the left, the listing's value on the right.
          Same two-mono-labels-space-between shape as the gap track's, which is
          why it reads as the same kind of bar. */}
      <View
        style={{
          marginTop: offerSpace.reach.barToLegend,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}>
          {copy.reach.legendYours(highestItem.title, highestItem.valueLeaves)}
        </Text>
        <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}>
          {copy.reach.legendTheirs(listingValue)}
        </Text>
      </View>

      {/* Two rows at 64 with 10 between them — §3.6's own figures, and §4's
          `min-height 60 / 64` where the 64 is this insert's. Neither takes an
          `onPress`: both are explanations, so neither gets a chevron. */}
      <View
        style={{
          marginTop: offerSpace.reach.legendToRoutes,
          gap: offerSpace.reach.routeGap,
        }}
      >
        <RouteRow
          minHeight={offerSize.routeRow.minHeightReach}
          icon={
            <PromiseIcon
              size={offerSize.routeRow.icon}
              stroke={offerIcon.inlineRow.stroke}
              color={offerColor.inkSecondary}
            />
          }
          title={copy.reach.routePromise}
          subtitle={copy.reach.routePromiseSub(tier, promiseCeiling, owner)}
        />
        <RouteRow
          minHeight={offerSize.routeRow.minHeightReach}
          icon={
            <ArrowsIcon
              size={offerSize.routeRow.icon}
              stroke={offerIcon.inlineRow.stroke}
              color={offerColor.inkSecondary}
            />
          }
          title={copy.reach.routeTradeUp}
          subtitle={copy.reach.routeTradeUpSub}
        />
      </View>

      <Text
        style={[
          textStyle(offerType.helper),
          { color: offerColor.inkTertiary, marginTop: offerSpace.reach.routesToFootnote },
        ]}
      >
        {copy.reach.footnote(owner)}
      </Text>
    </Section>
  );
}

/**
 * The insert's own precondition, in one place.
 *
 * A component that decided this internally and returned null would still cost a
 * hook order and a render on every item detail; a predicate lets the screen skip
 * it. It also states the two things that make the insert MEANINGLESS even when
 * the listing is out of reach: a viewer with no valued items has no "highest" to
 * name, and an unvalued listing has no distance.
 */
export function shouldShowWhereYouStand(
  listingValue: number | null,
  highestItemValue: number,
  reach: number | null,
): boolean {
  return (
    listingValue !== null && reach !== null && highestItemValue > 0 && listingValue > reach
  );
}

/** The mono distance line the tile shows, reused where the screen wants it. */
export function reachDistance(listingValue: number, reach: number): string {
  return grouped(listingValue - reach);
}
