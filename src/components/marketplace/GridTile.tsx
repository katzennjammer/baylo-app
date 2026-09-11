import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ImageIcon, LeafIcon } from "../icons";
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
import { offerType, outOfReach } from "../../theme/offer-tokens";
import { bracketLabel, bracketOf, bracketsWord, type Bracket } from "../../lib/brackets";
import { bracketsBeyondReach } from "../../lib/gap";
import { reach as reachCopy } from "../offer/copy";
import type { Item } from "../../api/types";

/**
 * One listing in the browse grid.
 *
 * A DIFFERENT OBJECT FROM `FeedCard`, not a narrow one. The feed card is a
 * full-bleed post you read: owner first, photo at whatever aspect it came in
 * at, social row, primary action. This is a tile you SCAN — two per row, a
 * square photo so the grid is a grid, and the owner left off entirely. Browsing
 * is "what is out there"; the feed is "what did people post". Trying to make
 * one component serve both is what produces a card that is bad at each.
 *
 * WHAT IS DELIBERATELY ABSENT:
 *
 *   The owner and the trust badge. /browse sends `trustTier: null` — resolving
 *   it costs three aggregates per owner and the route does not pay them — so
 *   the only badge this tile could draw is `resolveTier()`'s approximation,
 *   which is documented as reading high. A trust signal that is wrong in the
 *   optimistic direction is worse on a grid than absent, because a grid is
 *   scanned rather than read. The detail screen shows the real one.
 *
 *   The social row and Offer Trade. Both need the item's full context, and both
 *   are one tap away.
 *
 * The photo is SQUARE here rather than clamped to its own aspect the way the
 * feed's is. A grid whose rows are different heights is not a grid, and the
 * tile's job is comparison — equal boxes are what make two things comparable.
 *
 * ── OUT OF REACH: THREE PROPERTIES CHANGE, AND ONLY THREE ───────────────────
 *
 * §1.9 and §7.2 of the offer spec are unusually strict about this, so it is
 * worth listing what is UNTOUCHED: the border, the radius, the size, the tile's
 * position in the sort, and the tap behaviour. Only the photo (grayscale then
 * 62% opacity), the title's ink (#5C5B52) and the value line's ink (#8C8A7E)
 * move. §7.2's own reasoning for the sort: "sorting out-of-reach items last is
 * a soft form of hiding".
 *
 * THE TILE STAYS TAPPABLE. Grey means "not straightforward", never "locked" —
 * and the detail screen it opens shows the photo in FULL COLOUR, because the
 * grey is a grid-level signal about reach rather than a claim about the item.
 *
 * The value line changes SHAPE as well as colour when a tile is out of reach:
 * §10.8 fixes it as a sentence rather than a figure, so the leaf glyph comes
 * off. A leaf beside a sentence about distance reads as a price tag, and the
 * number after the interpunct is not a price.
 *
 * ── A BRACKET FOR OTHER PEOPLE'S TILES, THE NUMBER FOR YOUR OWN ─────────────
 *
 * The browse grid includes the viewer's own listings, and those keep their
 * exact value — a person needs to see what their item is worth. Everyone
 * else's shows `Bracket 3`. See `src/lib/brackets.ts` for why, and note that
 * the accessibility label follows the same rule: a screen reader announcing
 * the exact number would defeat the point of the bracket.
 */
export function GridTile({
  item,
  width,
  onPress,
  reach,
  viewerId = null,
}: {
  item: Item;
  /** Computed by the screen from the real viewport — see the note there. */
  width: number;
  onPress: (item: Item) => void;
  /**
   * The viewer's reach BRACKET, or null while the shelf is still loading.
   *
   * NULL IS NOT ZERO. A grid must not grey tiles on a guess, so an unknown reach
   * draws every tile in colour and the treatment appears when the answer does.
   */
  reach?: Bracket | null;
  /** Own listings show the exact value; everyone else's show a bracket. */
  viewerId?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const cover = item.images[0];
  const own = viewerId !== null && item.owner.id === viewerId;
  const bracket = item.valueLeaves === null ? null : bracketOf(item.valueLeaves);

  // Strictly greater — a listing IN the reach bracket is in reach. An unvalued
  // listing is never out of reach: there is no distance to state. Own listings
  // are never greyed either: reach is about what you can trade FOR.
  const beyond =
    reach != null && item.valueLeaves !== null && !own
      ? bracketsBeyondReach(item.valueLeaves, reach) || null
      : null;

  return (
    <Tappable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      // The label reads as one sentence because a screen reader announces the
      // tile as a unit; the visual hierarchy inside it is not audible.
      accessibilityLabel={
        `${item.title}. ${item.conditionLabel}, ${item.categoryLabel}.` +
        (item.valueLeaves === null
          ? " Unvalued."
          : own
            ? ` Your listing, ${item.valueLeaves} Leaves.`
            : ` ${bracketLabel(bracket as number)}.`) +
        // The grey is invisible to a screen reader, so the distance is said. It
        // is said as a distance and not as a refusal, per §10.8's closing list
        // of words this area never uses.
        (beyond !== null ? ` ${bracketsWord(beyond)} above your reach.` : "")
      }
      style={[s.tile, { width }]}
      pressedStyle={s.tilePressed}
    >
      {/* §11: "Grey tile: no transition. It renders grey from first paint." So
          the filter is a style on the box rather than something animated on. */}
      <View style={[s.photoBox, beyond !== null && { filter: outOfReach.photoFilter }]}>
        {cover && !failed ? (
          <Image
            source={{ uri: cover }}
            contentFit="cover"
            style={s.photo}
            transition={120}
            onError={() => setFailed(true)}
          />
        ) : (
          <View style={s.photoFailed}>
            <ImageIcon
              size={icon.failedPhoto.size}
              stroke={icon.failedPhoto.stroke}
              color={color.failedIcon}
            />
          </View>
        )}
      </View>

      <View style={s.body}>
        <Text
          style={[
            textStyle(type.gridTitle),
            s.title,
            beyond !== null && { color: outOfReach.titleInk },
          ]}
          numberOfLines={2}
        >
          {item.title}
        </Text>

        <Text style={[textStyle(type.gridMeta), s.meta]} numberOfLines={1}>
          {item.conditionLabel}
        </Text>

        {/*
          Omitted rather than shown as "0" or "—" for a listing made before the
          valuation model, exactly as FeedCard does it: an unvalued item is not
          an item worth nothing, and there is no treatment for the difference.
        */}
        {item.valueLeaves === null ? null : beyond !== null ? (
          // §10.8's sentence, in §1.9's ink. Public Sans 600 12 rather than the
          // in-reach line's Bold 12 — §1.9 names the weight explicitly, and at
          // this length Bold reads as emphasis on a fact that is not the point.
          //
          // TWO LINES, NOT ONE. `Bracket 6 · 2 brackets above your reach` is
          // over 200px at this size and a tile on a 390-wide phone is ~173, so
          // one line clipped it — the design canvas only fit it because its
          // artboard tiles are wider. §1.9 fixes the line's colour, weight and
          // size and says nothing about its height; the sentence is the spec's,
          // and a clipped sentence is worse than a taller tile.
          <Text
            style={[
              textStyle(offerType.tileValueLine),
              { color: outOfReach.valueInk, marginTop: space.browse.tileMetaToLeaves },
            ]}
            numberOfLines={2}
          >
            {reachCopy.tileValue(bracket as number, beyond)}
          </Text>
        ) : (
          <View style={s.leaves}>
            <LeafIcon
              size={icon.cardLeaf.size}
              stroke={icon.cardLeaf.stroke}
              color={color.forest}
            />
            <Text style={[textStyle(type.gridLeaves), { color: color.forest }]}>
              {own ? item.valueLeaves : bracketLabel(bracket as number)}
            </Text>
          </View>
        )}
      </View>
    </Tappable>
  );
}

const s = StyleSheet.create({
  tile: {
    backgroundColor: color.surface,
    borderRadius: radius.gridTile,
    borderWidth: border.hairline,
    borderColor: color.divider,
    overflow: "hidden",
  },
  tilePressed: { backgroundColor: color.control },

  photoBox: {
    width: "100%",
    aspectRatio: size.browse.tilePhotoAspect,
    backgroundColor: color.control,
  },
  photo: { width: "100%", height: "100%" },
  photoFailed: { flex: 1, alignItems: "center", justifyContent: "center" },

  body: { padding: space.browse.tileBody },
  title: { color: color.ink },
  meta: { marginTop: space.browse.tileTitleToMeta, color: color.inkMuted },
  leaves: {
    marginTop: space.browse.tileMetaToLeaves,
    flexDirection: "row",
    alignItems: "center",
    gap: size.leaves.gap,
  },
});
