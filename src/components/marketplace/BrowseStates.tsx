import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { MASCOT } from "../../media/mascots";

import { RefreshIcon } from "../icons";
import { Tappable } from "../Tappable";
import {
  border,
  color,
  icon,
  radius,
  size,
  space,
  textStyle,
  type,
} from "../../theme/tokens";
import { MascotEmptyState } from "../MascotEmptyState";

/**
 * The four things the grid can be when it is not a grid.
 *
 * THE TWO EMPTIES ARE DIFFERENT SCREENS, and conflating them is the mistake
 * this file exists to avoid:
 *
 *   NOTHING TO BROWSE   the marketplace itself is empty. Nothing the person
 *                       did caused it and there is nothing for them to undo —
 *                       the useful action is to post something.
 *   NOTHING MATCHED     there are listings; these filters excluded all of them.
 *                       The person made this and can unmake it, so the action
 *                       is to clear the filters, and the copy names what was
 *                       searched for so it is obvious which word to change.
 *
 * A single "No items found" would be wrong in both directions: it blames the
 * user for an empty marketplace, and it offers no way out of an over-narrow
 * filter.
 */

/* ─────────────────────────────── skeleton ───────────────────────────── */

/**
 * Six tiles' worth of grey. Laid out by the same two-column arithmetic as the
 * real grid so the switch to content does not shift anything.
 */
export function BrowseSkeleton({ tileWidth }: { tileWidth: number }) {
  return (
    <View style={s.skeletonGrid} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={[s.skeletonTile, { width: tileWidth }]}>
          <View style={[s.skeletonPhoto, { width: tileWidth }]} />
          <View style={s.skeletonBody}>
            <View style={[s.skeletonLine, { width: "85%" }]} />
            <View style={[s.skeletonLine, { width: "55%", marginTop: 7 }]} />
            <View style={[s.skeletonLine, { width: 46, marginTop: 10 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ──────────────────────────── nothing at all ────────────────────────── */

export function BrowseEmpty({ onPost }: { onPost: () => void }) {
  return (
    <MascotEmptyState
      pose="box"
      title="Nothing listed yet"
      message="The marketplace fills up as people post things they no longer use. Yours can be the first."
      action={{ label: "Post an item", onPress: onPost }}
    />
  );
}

/* ─────────────────────────── nothing matched ────────────────────────── */

export function BrowseNoMatches({
  query,
  filterCount,
  orgsOnly = false,
  shopsMatched = false,
  onClear,
}: {
  query: string;
  filterCount: number;
  /**
   * The Organizations pill, passed separately because it is deliberately NOT
   * in `filterCount` -- that badge counts the filter SHEET's controls and this
   * one lives on the rail. Without it this screen would say "Nothing matched
   * these filters" while counting zero of them, and would drop "Try widening
   * the search" -- its only actionable sentence -- in the one case where the
   * fix is a single obvious tap.
   */
  orgsOnly?: boolean;
  /**
   * The search matched a SHOP by name, drawn above this. "No matches" under a
   * card that plainly is one would contradict it, so the copy narrows to
   * listings.
   */
  shopsMatched?: boolean;
  onClear?: () => void;
}) {
  const q = query.trim();
  const narrowed = filterCount > 0 || orgsOnly;

  return (
    <MascotEmptyState
      pose="search"
      size={100}
      title={shopsMatched ? "No listings match" : "No matches"}
      message={`${q
        ? `${shopsMatched ? "No listings" : "Nothing"} matched “${q}”`
        : orgsOnly && filterCount === 0
          ? "No shops have anything listed right now"
          : "Nothing matched these filters"}${narrowed && q ? ` with the filters you have on.` : "."}${narrowed || q ? " Try widening the search." : ""}`}
      action={{
        label: "Clear filters",
        accessibilityLabel: "Clear search and filters",
        onPress: () => onClear?.(),
      }}
    />
  );
}

/* ─────────────────────────────── error ──────────────────────────────── */

/**
 * A read failure. The copy says nothing was lost for the same reason FeedError
 * does — the fear a failed load produces is about the person's OWN listings,
 * which is the one thing a failed browse says nothing about.
 *
 * `headline` names WHAT failed to load. The default is the marketplace grid,
 * which is where this card started; the item, hub and map screens reuse the
 * card and must say so, because "Could not load the marketplace" on a listing
 * that will not open tells the person the wrong thing is broken.
 */
export function BrowseError({
  message,
  onRetry,
  headline = "Could not load the marketplace",
}: {
  message: string;
  onRetry: () => void;
  headline?: string;
}) {
  return (
    <View style={s.wrap}>
      {/* The worried duck, as on every other error and empty state. */}
      <Image source={MASCOT.worry} contentFit="contain" style={{ width: 110, height: 110, marginBottom: 8 }} accessible={false} />

      <Text style={[textStyle(type.errorHeadline), s.headline]}>{headline}</Text>
      <Text style={[textStyle(type.emptyBody), s.body]}>{message}</Text>

      <Tappable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
        style={s.retry}
        pressedStyle={s.retryPressed}
      >
        <RefreshIcon size={icon.retryError.size} stroke={icon.retryError.stroke} color={color.forest} />
        <Text style={[textStyle(type.secondaryButton), { color: color.forest }]}>Try again</Text>
      </Tappable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingHorizontal: space.empty.x,
    paddingVertical: space.empty.bodyToButton,
  },
  circleError: {
    width: size.errorIconCircle,
    height: size.errorIconCircle,
    borderRadius: size.errorIconCircle / 2,
    borderWidth: border.chip,
    borderColor: color.urgentLine,
    backgroundColor: color.urgentWash,
    alignItems: "center",
    justifyContent: "center",
  },
  headline: { marginTop: space.empty.iconToHeadline, textAlign: "center", color: color.ink },
  body: { marginTop: space.empty.headlineToBody, textAlign: "center", color: color.inkSecondary },
  retry: {
    marginTop: space.error.bodyToButton,
    flexDirection: "row",
    alignItems: "center",
    gap: space.card.socialGap,
    height: size.control.errorRetry,
    paddingHorizontal: size.control.errorRetryX,
    borderRadius: radius.reloadButton,
    borderWidth: border.chip,
    borderColor: color.greenLine,
    backgroundColor: color.greenWash,
  },
  retryPressed: { opacity: 0.85 },

  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.browse.gridGap,
    paddingHorizontal: space.browse.gridX,
  },
  skeletonTile: {
    borderRadius: radius.gridTile,
    borderWidth: border.hairline,
    borderColor: color.divider,
    overflow: "hidden",
  },
  skeletonPhoto: { aspectRatio: size.browse.tilePhotoAspect, backgroundColor: color.skeleton },
  skeletonBody: { padding: space.browse.tileBody },
  skeletonLine: { height: 10, borderRadius: 3, backgroundColor: color.skeletonSoft },
});
