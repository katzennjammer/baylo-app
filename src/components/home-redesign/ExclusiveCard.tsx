import { Image } from "expo-image";
import { memo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ImageIcon, LeafIcon, VerifiedOrgIcon } from "../icons";
import { Tappable } from "../Tappable";
import { CountdownPill } from "../CountdownPill";
import { useCountdownA11y } from "../../lib/live-clock";
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
 * information someone needs. The expiry is the live CountdownPill: white on
 * solid urgent red, 4.99:1.
 *
 * ── THE EXPIRY LIVES IN THE PANEL, NOT ON THE PHOTO ──────────────────────
 *
 * On the value row, right-aligned, in the urgent pill (the section heading's
 * "Next:" chip that shared it was removed on 30 Sep 2026). Two reasons. Every card in this row is perishable,
 * so a corner badge on each photo says nothing the section title does not;
 * what differs per card is HOW LONG, and that is a fact to read beside the
 * value, the way a delivery app puts its time in the panel. And a pill on a
 * photo has whatever contrast the photo gives it, where on the panel it sits
 * on the same light surface every time.
 *
 * No bolt badge for the same reason: the section already says perishable.
 *
 * THE CARD DRAWS IT ITSELF from `item.perishable` (1 Oct 2026), so any
 * perishable that lands in either row ticks, and "Ended" at zero -- the card
 * stays in the row until the next fetch.
 *
 * ── ALSO RECOMMENDED'S CARD ──────────────────────────────────────────────
 *
 * "Recommended for you" draws this too, narrower, with a
 * `note`: the server's one line on why the listing is there ("For your
 * interest in Books"). Forest, like the value line -- it is Baylo speaking,
 * not the poster -- and on its own line, under the poster.
 */
export const ExclusiveCard = memo(function ExclusiveCard({
  item,
  width,
  onPress,
  viewerId = null,
  note,
}: {
  item: Item;
  width: number;
  onPress: (item: Item) => void;
  viewerId?: string | null;
  /** Why this card is here -- Recommended's reason line. */
  note?: string;
}) {
  const [failed, setFailed] = useState(false);
  const cover = item.images[0];
  const own = viewerId !== null && item.owner.id === viewerId;
  const bracket = item.valueLeaves === null ? null : bracketOf(item.valueLeaves);
  const org = item.owner.org ?? null;
  const verified = org?.verified === true;
  const poster = org?.name ?? item.owner.name;
  const perishable = item.perishable ?? null;
  // Minute resolution, so the card re-renders once a minute; the pill ticks alone.
  const expiryLabel = useCountdownA11y(perishable);

  return (
    <Tappable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={
        `${item.title}, from ${poster}.` +
        (verified ? ` ${ORG_BADGE_LABEL.full}.` : "") +
        (expiryLabel ? ` ${expiryLabel}.` : "") +
        (note ? ` ${note}.` : "") +
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

        {note ? (
          <Text
            style={[textStyle(type.gridMeta), { color: color.forest, marginTop: space.home.tileTitleToMeta }]}
            numberOfLines={1}
          >
            {note}
          </Text>
        ) : null}

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
          {/* The live pill. Hidden from the screen reader: the card's own
              label already says "Ends in ...". */}
          {perishable ? (
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <CountdownPill expiresAt={perishable.expiresAt} expired={perishable.expired} />
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
});
