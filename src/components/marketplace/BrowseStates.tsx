import { StyleSheet, Text, View } from "react-native";

import { GridIcon, SearchIcon, WarningIcon, RefreshIcon } from "../icons";
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
    <View style={s.wrap}>
      <View style={s.circle}>
        <GridIcon size={icon.emptyGrid.size} stroke={icon.emptyGrid.stroke} color={color.forest} />
      </View>

      <Text style={[textStyle(type.emptyHeadline), s.headline]}>
        Nothing listed yet
      </Text>
      <Text style={[textStyle(type.emptyBody), s.body]}>
        The marketplace fills up as people post things they no longer use. Yours can be the first.
      </Text>

      <Tappable
        onPress={onPost}
        accessibilityRole="button"
        accessibilityLabel="Post an item"
        style={s.primary}
        pressedStyle={s.primaryPressed}
      >
        <Text style={[textStyle(type.emptyPrimaryButton), { color: color.onGreen }]}>
          Post an item
        </Text>
      </Tappable>
    </View>
  );
}

/* ─────────────────────────── nothing matched ────────────────────────── */

export function BrowseNoMatches({
  query,
  filterCount,
  onClear,
}: {
  query: string;
  filterCount: number;
  onClear: () => void;
}) {
  const q = query.trim();

  return (
    <View style={s.wrap}>
      <View style={s.circleQuiet}>
        <SearchIcon size={icon.emptyGrid.size} stroke={icon.emptyGrid.stroke} color={color.inkMuted} />
      </View>

      <Text style={[textStyle(type.emptyHeadline), s.headline]}>No matches</Text>

      {/*
        The search term is quoted back. Somebody who mistyped a word is looking
        for the typo, and a generic "try something else" hides the one piece of
        information that would let them spot it.
      */}
      <Text style={[textStyle(type.emptyBody), s.body]}>
        {q ? `Nothing matched “${q}”` : "Nothing matched these filters"}
        {filterCount > 0 && q ? ` with the filters you have on.` : "."}
        {filterCount > 0 || q ? " Try widening the search." : ""}
      </Text>

      <Tappable
        onPress={onClear}
        accessibilityRole="button"
        accessibilityLabel="Clear search and filters"
        style={s.primary}
        pressedStyle={s.primaryPressed}
      >
        <Text style={[textStyle(type.emptyPrimaryButton), { color: color.onGreen }]}>
          Clear filters
        </Text>
      </Tappable>
    </View>
  );
}

/* ─────────────────────────────── error ──────────────────────────────── */

/**
 * A read failure. The copy says nothing was lost for the same reason FeedError
 * does — the fear a failed load produces is about the person's OWN listings,
 * which is the one thing a failed browse says nothing about.
 */
export function BrowseError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={s.wrap}>
      <View style={s.circleError}>
        <WarningIcon size={icon.errorMark.size} stroke={icon.errorMark.stroke} color={color.urgent} />
      </View>

      <Text style={[textStyle(type.errorHeadline), s.headline]}>Could not load the marketplace</Text>
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
  circle: {
    width: size.emptyIconCircle,
    height: size.emptyIconCircle,
    borderRadius: size.emptyIconCircle / 2,
    borderWidth: border.chip,
    borderColor: color.greenLine,
    backgroundColor: color.greenWash,
    alignItems: "center",
    justifyContent: "center",
  },
  circleQuiet: {
    width: size.emptyIconCircle,
    height: size.emptyIconCircle,
    borderRadius: size.emptyIconCircle / 2,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    backgroundColor: color.control,
    alignItems: "center",
    justifyContent: "center",
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
  primary: {
    marginTop: space.empty.bodyToButton,
    width: "100%",
    height: size.control.emptyPrimaryButton,
    borderRadius: radius.emptyPrimaryButton,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryPressed: { opacity: 0.85 },
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
