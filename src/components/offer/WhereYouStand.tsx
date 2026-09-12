import { Text, View } from "react-native";

import { PlusIcon } from "../icons";
import { ArrowsIcon, PromiseIcon } from "./icons";
import { RouteRow } from "./rows";
import { Section, SectionLabel } from "./chrome";
import { BracketTicks } from "./GapTrack";
import * as copy from "./copy";
import { bracketOf, type Bracket } from "../../lib/brackets";
import { bracketsBeyondReach, isOutOfReach } from "../../lib/gap";
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
 *   label → one paragraph → bracket ticks → legend → two route rows → footnote
 *
 * and §3.6 fixes every gap between them. Both routes are ROWS, not buttons —
 * §7.3 again — because a route here is an explanation of what would work, not a
 * control that does it.
 *
 * ── NOT AN ERROR, AND THE COPY IS POLICED FOR IT ────────────────────────────
 *
 * §1.4's closing line keeps the warm accent out of this area as a failure
 * signal; the one place it appears is the bar's distance cells, where it marks
 * a distance. §10.8's closing list bans `locked`, `unavailable`, `you can't`,
 * `too expensive`, `upgrade`, `unlock` and any figure describing the user's
 * total worth — the last of which is why this insert names the viewer's HIGHEST
 * ITEM and never a sum of everything they own.
 *
 * ── THE LISTING IS A BRACKET; YOUR OWN ITEM IS A NUMBER ─────────────────────
 *
 * The paragraph names your highest item at its exact value — it is yours to
 * know — and the listing only by bracket. The distance is stated in brackets,
 * the ticks are drawn in brackets, and the reach itself is a bracket (see
 * `reachBracket()` in gap.ts), so no line of this insert can put an exact
 * figure on somebody else's listing or contradict the grey on the grid.
 *
 * NOT DRAWN UNDER A PREMIUM LOCK. This insert ends "you can send an offer
 * regardless", and above a locked control that sentence is false. Item detail
 * decides — see `PremiumLockedBar` — and the lock wins.
 *
 * ── THE EMPTY SHELF — A VARIANT THE SPEC DID NOT WRITE ──────────────────────
 *
 * §7.1's floor means a viewer with NOTHING posted still has a reach (bracket 2), so
 * the grid greys for them exactly as it does for anyone else — but §10.8's
 * paragraph names "your highest item", the bar has a "your item" segment, and
 * the legend reads `Your chair 760`; none of that can be drawn from nothing.
 * The insert used to gate itself on `highestItemValue > 0` for that reason,
 * which produced the bug this variant fixes: a greyed tile whose detail
 * screen said nothing at all about why.
 *
 * `highestItem: null` is that viewer. Three things change and nothing else:
 *
 *   - a heading line goes in between the label and the paragraph, and the
 *     paragraph is rewritten around the floor rather than around an item;
 *   - the ticks draw NO green "your item" cells — they start at the floor. Not
 *     one cell: a green cell with a label under it would claim an item that
 *     does not exist. The left legend label becomes `Starting reach`;
 *   - the first route is `Post an item` — the real fix, and the thing the
 *     standard set is missing — and `Trade up to it` is dropped, because "two
 *     trades near your own value" is advice about a shelf this viewer has not
 *     got. The promise route stays, second.
 */
export function WhereYouStand({
  listingValue,
  highestItem,
  reach,
  owner,
  tier,
  promiseCeiling,
}: {
  /** This listing's value. Its bracket is above `reach`, or the insert would not be drawn. */
  listingValue: number;
  /**
   * The viewer's highest AVAILABLE item — the one §10.8's paragraph names — or
   * null for a viewer with nothing posted. See the header note on the variant.
   */
  highestItem: { title: string; valueLeaves: number } | null;
  /** The reach BRACKET. */
  reach: Bracket;
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
  const listingBracket = bracketOf(listingValue);

  return (
    <Section pad={offerSpace.section.reachInsert}>
      <SectionLabel>{copy.reach.label}</SectionLabel>

      {highestItem === null ? (
        <Text
          style={[
            textStyle(offerType.reachHeading),
            { color: offerColor.ink, marginTop: offerSpace.reach.labelToHeading },
          ]}
        >
          {copy.reach.emptyHeading}
        </Text>
      ) : null}

      <Text
        style={[
          textStyle(offerType.body),
          {
            color: offerColor.inkSecondary,
            marginTop:
              highestItem === null
                ? offerSpace.reach.headingToCopy
                : offerSpace.reach.labelToCopy,
          },
        ]}
      >
        {highestItem === null
          ? copy.reach.emptyBody(reach, listingBracket)
          : copy.reach.body(highestItem.title, highestItem.valueLeaves, reach, listingBracket)}
      </Text>

      <View style={{ marginTop: offerSpace.reach.copyToBar }}>
        <BracketTicks
          yourBracket={highestItem === null ? null : bracketOf(highestItem.valueLeaves)}
          reach={reach}
          listing={listingBracket}
        />
      </View>

      {/* §7.3's legend: your item on the left, the listing's BRACKET on the
          right. Same two-mono-labels-space-between shape as the gap track's,
          which is why it reads as the same kind of bar. */}
      <View
        style={{
          marginTop: offerSpace.reach.barToLegend,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}>
          {highestItem === null
            ? copy.reach.legendStarting
            : copy.reach.legendYours(highestItem.title, highestItem.valueLeaves)}
        </Text>
        <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}>
          {copy.reach.legendTheirs(listingBracket)}
        </Text>
      </View>

      {/* Two rows at 64 with 10 between them — §3.6's own figures, and §4's
          `min-height 60 / 64` where the 64 is this insert's. None takes an
          `onPress`: all are explanations, so none gets a chevron — the Post tab
          is in the bar under this screen, so `Post an item` does not need to be
          a second way there. The empty shelf leads with posting and drops
          `Trade up to it`; see the header note. */}
      <View
        style={{
          marginTop: offerSpace.reach.legendToRoutes,
          gap: offerSpace.reach.routeGap,
        }}
      >
        {highestItem === null ? (
          <RouteRow
            minHeight={offerSize.routeRow.minHeightReach}
            icon={
              <PlusIcon
                size={offerSize.routeRow.icon}
                stroke={offerIcon.inlineRow.stroke}
                color={offerColor.inkSecondary}
              />
            }
            title={copy.reach.routePost}
            subtitle={copy.reach.routePostSub}
          />
        ) : null}
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
        {highestItem !== null ? (
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
        ) : null}
      </View>

      <Text
        style={[
          textStyle(offerType.helper),
          { color: offerColor.inkTertiary, marginTop: offerSpace.reach.routesToFootnote },
        ]}
      >
        {copy.reach.footnote}
      </Text>
    </Section>
  );
}

/**
 * The insert's own precondition, in one place.
 *
 * A component that decided this internally and returned null would still cost a
 * hook order and a render on every item detail; a predicate lets the screen skip
 * it. It also states the one thing that makes the insert MEANINGLESS even when
 * the listing is out of reach: an unvalued listing has no distance.
 *
 * THIS IS THE GRID'S OWN TEST, `isOutOfReach`, and must stay that way. It used
 * to also require `highestItemValue > 0`, on the reasoning that a viewer with
 * no valued item has no "highest" to name — true, but the grid never had that
 * condition, so a viewer with an empty shelf saw greyed tiles whose detail
 * screens explained nothing. The insert now has an empty-shelf variant; the
 * two halves of §7 agree on WHEN, and the component decides HOW.
 */
export function shouldShowWhereYouStand(
  listingValue: number | null,
  reach: Bracket | null,
): boolean {
  return listingValue !== null && reach !== null && isOutOfReach(listingValue, reach);
}

/** The bracket distance the tile states, reused where a screen wants it. */
export function reachDistance(listingValue: number, reach: Bracket): number {
  return bracketsBeyondReach(listingValue, reach);
}
