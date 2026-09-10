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
import { grouped } from "../../lib/gap";
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
 * §10.8 fixes it as `2,000 Leaves · 860 above your reach`, which is a sentence
 * rather than a figure, so the leaf glyph comes off. A leaf beside a sentence
 * about distance reads as a price tag, and the number after the interpunct is
 * not a price.
 */
export function GridTile({
  item,
  width,
  onPress,
  reach,
}: {
  item: Item;
  /** Computed by the screen from the real viewport — see the note there. */
  width: number;
  onPress: (item: Item) => void;
  /**
   * The viewer's reach threshold, or null while the shelf is still loading.
   *
   * NULL IS NOT ZERO. A grid must not grey tiles on a guess, so an unknown reach
   * draws every tile in colour and the treatment appears when the answer does.
   */
  reach?: number | null;
}) {
  const [failed, setFailed] = useState(false);
  const cover = item.images[0];

  // Strictly greater — a listing exactly AT the threshold is in reach. An
  // unvalued listing is never out of reach: there is no distance to state.
  const beyond =
    reach != null && item.valueLeaves !== null && item.valueLeaves > reach
      ? item.valueLeaves - reach
      : null;

  return (
    <Tappable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      // The label reads as one sentence because a screen reader announces the
      // tile as a unit; the visual hierarchy inside it is not audible.
      accessibilityLabel={
        `${item.title}. ${item.conditionLabel}, ${item.categoryLabel}.` +
        (item.valueLeaves !== null ? ` ${item.valueLeaves} Leaves.` : " Unvalued.") +
        // The grey is invisible to a screen reader, so the distance is said. It
        // is said as a distance and not as a refusal, per §10.8's closing list
        // of words this area never uses.
        (beyond !== null ? ` ${grouped(beyond)} above your reach.` : "")
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
          <Text
            style={[
              textStyle(offerType.tileValueLine),
              { color: outOfReach.valueInk, marginTop: space.browse.tileMetaToLeaves },
            ]}
            numberOfLines={1}
          >
            {reachCopy.tileValue(item.valueLeaves, beyond)}
          </Text>
        ) : (
          <View style={s.leaves}>
            <LeafIcon
              size={icon.cardLeaf.size}
              stroke={icon.cardLeaf.stroke}
              color={color.forest}
            />
            <Text style={[textStyle(type.gridLeaves), { color: color.forest }]}>
              {item.valueLeaves}
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
