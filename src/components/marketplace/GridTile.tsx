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
 */
export function GridTile({
  item,
  width,
  onPress,
}: {
  item: Item;
  /** Computed by the screen from the real viewport — see the note there. */
  width: number;
  onPress: (item: Item) => void;
}) {
  const [failed, setFailed] = useState(false);
  const cover = item.images[0];

  return (
    <Tappable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      // The label reads as one sentence because a screen reader announces the
      // tile as a unit; the visual hierarchy inside it is not audible.
      accessibilityLabel={
        `${item.title}. ${item.conditionLabel}, ${item.categoryLabel}.` +
        (item.valueLeaves !== null ? ` ${item.valueLeaves} Leaves.` : " Unvalued.")
      }
      style={[s.tile, { width }]}
      pressedStyle={s.tilePressed}
    >
      <View style={s.photoBox}>
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
        <Text style={[textStyle(type.gridTitle), s.title]} numberOfLines={2}>
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
        {item.valueLeaves !== null ? (
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
        ) : null}
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
