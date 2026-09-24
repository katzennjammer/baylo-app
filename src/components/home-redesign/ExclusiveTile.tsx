import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BoltIcon, ImageIcon, LeafIcon, StarIcon, VerifiedOrgIcon } from "../icons";
import { Tappable } from "../Tappable";
import {
  border,
  color,
  dark,
  icon,
  radius,
  size,
  space,
  textStyle,
  type,
} from "../../theme/tokens";
import { bracketLabel, bracketOf } from "../../lib/brackets";
import type { Item } from "../../api/types";
import { ORG_BADGE_LABEL } from "../../lib/org";
import { businessCategoryLabel } from "../../lib/business-category";
import { OrgChips } from "../OrgChips";

/**
 * A listing in the Home screen's Exclusive grid — the dark variant.
 *
 * A NEW COMPONENT, NOT A GridTile PROP. GridTile documents why it carries no
 * badges and no owner, and it is the tile the Marketplace and hub grids use;
 * this preview must not change either. So the badges live here, as optional
 * props, and GridTile is untouched.
 *
 * Photo fills the tile; title, poster and value sit on a scrim at the bottom.
 * Colours come from `tokens.dark` only. The photo loads through expo-image
 * with GridTile's own 120 ms transition and the same failed-photo fallback.
 *
 * Badges: bolt = perishable, star = a live Featured boost, rosette = verified
 * MSME. An org poster's business category rides on the scrim under the poster
 * line as a chip (OrgChips, rosette suppressed -- the icon column already
 * draws it). Bolt and star never meet on one tile — the server refuses to boost a
 * perishable and /featured filters them out — but each is decided on its own.
 *
 * Value follows GridTile's rule: the exact figure on your own listing, the
 * bracket on everyone else's.
 */
export const ExclusiveTile = memo(function ExclusiveTile({
  item,
  width,
  onPress,
  viewerId = null,
  showPerishableBadge,
  showOrgBadge,
  showFeaturedBadge,
  expiryLabel,
}: {
  item: Item;
  width: number;
  onPress: (item: Item) => void;
  viewerId?: string | null;
  /** Defaults to `item.perishable != null`. */
  showPerishableBadge?: boolean;
  /** Defaults to a VERIFIED org owner only — see ownerBadge() in lib/org. */
  showOrgBadge?: boolean;
  /** Defaults to a live boost (`item.featuredUntil` set). */
  showFeaturedBadge?: boolean;
  /** This listing's own window, e.g. "~4h left". Shown on the meta line. */
  expiryLabel?: string;
}) {
  const [failed, setFailed] = useState(false);
  const cover = item.images[0];
  const own = viewerId !== null && item.owner.id === viewerId;
  const bracket = item.valueLeaves === null ? null : bracketOf(item.valueLeaves);
  const perishable = showPerishableBadge ?? item.perishable != null;
  // `!= null`: a server without boosts omits the key.
  const featured = showFeaturedBadge ?? item.featuredUntil != null;
  const org = showOrgBadge ?? item.owner.org?.verified === true;
  const poster = item.owner.org?.name ?? item.owner.name;

  return (
    <Tappable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={
        `${item.title}, from ${poster}.` +
        (perishable ? " Perishable." : "") +
        (featured ? " Featured." : "") +
        (expiryLabel ? ` ${expiryLabel}.` : "") +
        (org ? ` ${ORG_BADGE_LABEL.full}.` : "") +
        (item.owner.org ? ` ${businessCategoryLabel(item.owner.org.businessCategory)}.` : "") +
        (item.valueLeaves === null
          ? ""
          : own
            ? ` Your listing, ${item.valueLeaves} Leaves.`
            : ` ${bracketLabel(bracket as number)}.`)
      }
      style={[s.tile, { width, height: width / size.home.exclusiveTileAspect }]}
      pressedStyle={s.tilePressed}
    >
      {cover && !failed ? (
        <Image
          source={{ uri: cover }}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
          transition={120}
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, s.photoFailed]}>
          <ImageIcon size={icon.failedPhoto.size} stroke={icon.failedPhoto.stroke} color={dark.muted} />
        </View>
      )}

      {perishable || featured || org ? (
        <View style={s.badges} pointerEvents="none">
          {perishable ? (
            <View style={[s.badge, { backgroundColor: color.urgentWash }]}>
              <BoltIcon size={icon.tileBadge.size} stroke={icon.tileBadge.stroke} color={color.urgent} />
            </View>
          ) : null}
          {featured ? (
            <View style={[s.badge, { backgroundColor: color.control }]}>
              <StarIcon size={icon.tileBadge.size} stroke={icon.tileBadge.stroke} color={color.ink} />
            </View>
          ) : null}
          {org ? (
            <View style={[s.badge, { backgroundColor: color.greenWash }]}>
              <VerifiedOrgIcon size={icon.tileBadge.size} stroke={icon.tileBadge.stroke} color={color.forest} />
            </View>
          ) : null}
        </View>
      ) : null}

      <LinearGradient colors={[dark.scrimClear, dark.scrim]} style={s.scrim} pointerEvents="none">
        <Text style={[textStyle(type.exclusiveTitle), { color: dark.ink }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text
          style={[textStyle(type.exclusiveMeta), { color: dark.secondary, marginTop: space.home.tileTitleToMeta }]}
          numberOfLines={1}
        >
          {poster}
          {expiryLabel ? <Text style={{ color: color.urgent }}>{` · ${expiryLabel}`}</Text> : null}
        </Text>
        {item.owner.org ? (
          <View style={{ marginTop: space.home.tileTitleToMeta }}>
            <OrgChips org={item.owner.org} showBadge={false} tone="dark" />
          </View>
        ) : null}
        {item.valueLeaves === null ? null : (
          <View style={s.leaves}>
            <LeafIcon size={icon.cardLeaf.size} stroke={icon.cardLeaf.stroke} color={dark.green} />
            <Text style={[textStyle(type.gridLeaves), { color: dark.green }]}>
              {own ? item.valueLeaves : bracketLabel(bracket as number)}
            </Text>
          </View>
        )}
      </LinearGradient>
    </Tappable>
  );
});

const s = StyleSheet.create({
  tile: {
    backgroundColor: dark.surface,
    borderRadius: radius.exclusiveTile,
    borderWidth: border.hairline,
    borderColor: dark.border,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  tilePressed: { opacity: 0.85 },
  photoFailed: { alignItems: "center", justifyContent: "center", backgroundColor: dark.control },
  badges: {
    position: "absolute",
    top: space.home.tileBadgeInset,
    right: space.home.tileBadgeInset,
    gap: space.home.tileBadgeGap,
  },
  badge: {
    width: size.home.tileBadge,
    height: size.home.tileBadge,
    borderRadius: radius.tileBadge,
    alignItems: "center",
    justifyContent: "center",
  },
  scrim: {
    padding: space.home.tileBody,
    paddingTop: space.home.tileBody * 3,
  },
  leaves: {
    marginTop: space.home.tileMetaToLeaves,
    flexDirection: "row",
    alignItems: "center",
    gap: size.leaves.gap,
  },
});
