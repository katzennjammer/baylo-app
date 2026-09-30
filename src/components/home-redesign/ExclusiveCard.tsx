import { Image } from "expo-image";
import { memo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ImageIcon, LeafIcon, VerifiedOrgIcon } from "../icons";
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
import { bracketLabel, bracketOf } from "../../lib/brackets";
import type { Item } from "../../api/types";
import { ORG_BADGE_LABEL } from "../../lib/org";

/**
 * A listing in Home's Exclusive row: one large card, photo on top and a light
 * info panel under it, so everything that decides a tap is readable without
 * one.
 *
 * GridTile's LIGHT PATTERN, WIDER. Same surface, hairline divider border,
 * grid radius, gridLeaves-in-forest value line and bracket rule (the exact
 * figure on your own listing, the bracket on everyone else's). It is its own
 * component rather than a GridTile prop for the reason ExclusiveTile gives:
 * GridTile serves the Marketplace and hub grids and must not change under
 * them. ExclusiveTile (the dark, text-over-photo tile) still draws Featured.
 *
 * ── TEXT INKS: THE APP'S DARK TOKENS, NOTHING NEW ────────────────────────
 *
 * The panel is `color.surface` (#FAFAF7), so the text is the light theme's
 * ink, not the dark tile's pale type. Title in `color.ink` (#14140F, about
 * 18:1 on the panel); the poster line in `color.inkSecondary` (#5C5B52, about
 * 6.5:1). NOT `color.inkMuted`: GridTile uses it for the condition line, but
 * at about 3.3:1 it is the washed-out grey this card is meant to avoid for
 * information someone needs. The expiry pill is the existing urgent pill,
 * unchanged: #B0553A on #FBEEE9 is about 4.4:1, a hair under WCAG AA's 4.5
 * for 12 px text -- see the note where it is drawn.
 *
 * ── THE EXPIRY LIVES IN THE PANEL, NOT ON THE PHOTO ──────────────────────
 *
 * On the value row, right-aligned, in the same urgent pill the section
 * heading's "Next:" uses. Two reasons. Every card in this row is perishable,
 * so a corner badge on each photo says nothing the section title does not;
 * what differs per card is HOW LONG, and that is a fact to read beside the
 * value, the way a delivery app puts its time in the panel. And a pill on a
 * photo has whatever contrast the photo gives it, where on the panel it is
 * the pill's own urgent-on-urgentWash every time.
 *
 * No bolt badge for the same reason: the section already says perishable.
 */
export const ExclusiveCard = memo(function ExclusiveCard({
  item,
  width,
  onPress,
  viewerId = null,
  expiryLabel,
}: {
  item: Item;
  width: number;
  onPress: (item: Item) => void;
  viewerId?: string | null;
  /** This listing's own window, e.g. "~4h left". A string so the memo holds. */
  expiryLabel?: string;
}) {
  const [failed, setFailed] = useState(false);
  const cover = item.images[0];
  const own = viewerId !== null && item.owner.id === viewerId;
  const bracket = item.valueLeaves === null ? null : bracketOf(item.valueLeaves);
  const org = item.owner.org ?? null;
  const verified = org?.verified === true;
  const poster = org?.name ?? item.owner.name;

  return (
    <Tappable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={
        `${item.title}, from ${poster}.` +
        (verified ? ` ${ORG_BADGE_LABEL.full}.` : "") +
        (expiryLabel ? ` ${expiryLabel}.` : "") +
        (item.valueLeaves === null
          ? ""
          : own
            ? ` Your listing, ${item.valueLeaves} Leaves.`
            : ` ${bracketLabel(bracket as number)}.`)
      }
      style={[s.card, { width }]}
      pressedStyle={s.cardPressed}
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
            <ImageIcon size={icon.failedPhoto.size} stroke={icon.failedPhoto.stroke} color={color.failedIcon} />
          </View>
        )}
      </View>

      <View style={s.panel}>
        <Text style={[textStyle(type.exclusiveTitle), { color: color.ink }]} numberOfLines={1}>
          {item.title}
        </Text>

        <View style={s.posterRow}>
          {verified ? (
            <VerifiedOrgIcon size={icon.tileBadge.size} stroke={icon.tileBadge.stroke} color={color.forest} />
          ) : null}
          <Text
            style={[textStyle(type.gridMeta), { color: color.inkSecondary, flexShrink: 1 }]}
            numberOfLines={1}
          >
            {poster}
          </Text>
        </View>

        <View style={s.valueRow}>
          {item.valueLeaves === null ? (
            // Omitted rather than "0", as in GridTile: unvalued is not worthless.
            <View />
          ) : (
            <View style={s.leaves}>
              <LeafIcon size={icon.cardLeaf.size} stroke={icon.cardLeaf.stroke} color={color.forest} />
              <Text style={[textStyle(type.gridLeaves), { color: color.forest }]}>
                {own ? item.valueLeaves : bracketLabel(bracket as number)}
              </Text>
            </View>
          )}
          {/* The existing urgent pill, as the section heading draws it: 4.4:1,
              just under AA for 12 px. Left as the token pair it is so the two
              pills on screen match; darkening it is a change to color.urgent,
              app-wide, and not this card's to make. */}
          {expiryLabel ? (
            <View style={s.expiry}>
              <Text style={[textStyle(type.countdownPill), { color: color.urgent }]} numberOfLines={1}>
                {expiryLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Tappable>
  );
});

const s = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.gridTile,
    borderWidth: border.hairline,
    borderColor: color.divider,
    overflow: "hidden",
  },
  cardPressed: { backgroundColor: color.control },

  photoBox: {
    width: "100%",
    aspectRatio: size.home.exclusiveCardPhotoAspect,
    backgroundColor: color.control,
  },
  photo: { width: "100%", height: "100%" },
  photoFailed: { flex: 1, alignItems: "center", justifyContent: "center" },

  panel: { padding: space.home.tileBody },
  posterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: size.leaves.gap,
    marginTop: space.home.tileTitleToMeta,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.home.tileBadgeGap,
    marginTop: space.home.tileMetaToLeaves,
  },
  leaves: { flexDirection: "row", alignItems: "center", gap: size.leaves.gap },
  expiry: {
    height: size.home.countdownPill,
    paddingHorizontal: size.home.countdownPillX,
    borderRadius: radius.countdownPill,
    backgroundColor: color.urgentWash,
    borderWidth: border.chip,
    borderColor: color.urgentLine,
    justifyContent: "center",
  },
});
