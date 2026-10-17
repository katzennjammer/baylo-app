import { Image } from "expo-image";
import { memo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ImageIcon, LeafIcon, LockIcon } from "../icons";
import { Tappable } from "../Tappable";
import { CountdownPill } from "../CountdownPill";
import { useCountdownA11y } from "../../lib/live-clock";
import { listingArea } from "../../lib/listing-area";
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
import { offerType } from "../../theme/offer-tokens";
import { bracketLabel, bracketOf, bracketsWord, type Bracket } from "../../lib/brackets";
import { bracketsBeyondReach } from "../../lib/gap";
import type { Item } from "../../api/types";
import { OrgChips } from "../OrgChips";
import { businessCategoryLabel } from "../../lib/business-category";
import { ORG_BADGE_LABEL } from "../../lib/org";

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
 *   EXCEPT for an organisation. The verified-MSME checkmark is not a trust
 *   tier: /browse sends it resolved (`owner.org.verified`, straight from the
 *   review decision) and it cannot read high, so none of the reasoning above
 *   applies. An org's tile carries its business-category chip, plus the
 *   checkmark once verified -- see OrgChips. A person's tile is unchanged.
 *
 *   The social row and Offer Trade. Both need the item's full context, and both
 *   are one tap away.
 *
 * The photo is SQUARE here rather than clamped to its own aspect the way the
 * feed's is. A grid whose rows are different heights is not a grid, and the
 * tile's job is comparison — equal boxes are what make two things comparable.
 *
 * ── OUT OF REACH: A BADGE, NOT A GREY PHOTO (30 Sep 2026) ───────────────────
 *
 * The photo stays in FULL COLOUR. A small lock badge in its top-right corner
 * names the bracket ("Bracket 5"), and the value line becomes the distance in
 * secondary ink ("1 bracket above you"). This replaced the offer spec's
 * §1.9 treatment (photo greyscale at 62%, title and value inks dimmed): a
 * washed-out photo made a listing look sold or broken, when all it means is
 * "not a straightforward trade for you yet".
 *
 * Still UNTOUCHED: the border, the radius, the size, the tile's position in
 * the sort, and the tap behaviour. §7.2's reasoning for the sort stands:
 * "sorting out-of-reach items last is a soft form of hiding".
 *
 * THE TILE STAYS TAPPABLE and opens the same detail screen.
 *
 * The value line changes SHAPE as well as ink when a tile is out of reach: a
 * sentence rather than a figure, so the leaf glyph comes off. A leaf beside a
 * sentence about distance reads as a price tag.
 *
 * ── PERISHABLES ─────────────────────────────────────────────────────────────
 *
 * Every perishable carries the live CountdownPill over the photo's bottom-left
 * corner ("05:12:44"), and "Ended" once it runs out -- the tile stays where it
 * is until the next fetch. The pill ticks by itself; this tile re-renders only
 * when its screen-reader label changes, once a minute (useCountdownA11y).
 *
 * ── A BRACKET FOR OTHER PEOPLE'S TILES, THE NUMBER FOR YOUR OWN ─────────────
 *
 * The browse grid includes the viewer's own listings, and those keep their
 * exact value — a person needs to see what their item is worth. Everyone
 * else's shows `Bracket 3`. See `src/lib/brackets.ts` for why, and note that
 * the accessibility label follows the same rule: a screen reader announcing
 * the exact number would defeat the point of the bracket.
 */
export const GridTile = memo(function GridTile({
  item,
  width,
  onPress,
  reach,
  viewerId = null,
  showPlace = true,
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
  /**
   * The place in the meta line ("New · Lapu-Lapu"). Off on a hub's own page,
   * where every listing meets at that hub and the place would repeat on every
   * tile; the line is then the condition alone.
   */
  showPlace?: boolean;
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

  // Hub city, else the seller's city, else nothing. See lib/listing-area.
  const area = showPlace ? listingArea(item) : null;

  // `!= null`: a server without the perishables work omits the key.
  const perishable = item.perishable ?? null;
  const expiry = useCountdownA11y(perishable);

  return (
    <Tappable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      // The label reads as one sentence because a screen reader announces the
      // tile as a unit; the visual hierarchy inside it is not audible.
      accessibilityLabel={
        `${item.title}. ${item.conditionLabel}, ${item.categoryLabel}.` +
        (area ? ` In ${area}.` : "") +
        (item.owner.org
          ? ` From ${item.owner.org.name}, ${businessCategoryLabel(item.owner.org.businessCategory)}` +
            (item.owner.org.verified ? `, ${ORG_BADGE_LABEL.full}.` : ".")
          : "") +
        (item.valueLeaves === null
          ? " Unvalued."
          : own
            ? ` Your listing, ${item.valueLeaves} Leaves.`
            : ` ${bracketLabel(bracket as number)}.`) +
        // Said as a distance, not as a refusal, per §10.8's closing list of
        // words this area never uses.
        (beyond !== null ? ` ${bracketsWord(beyond)} above your reach.` : "") +
        (expiry ? ` ${expiry}.` : "")
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

        {/* Out of reach: the bracket, on a scrim so it reads on any photo. The
            screen reader already hears it in the tile's label above. */}
        {beyond !== null ? (
          <View style={s.lockBadge} pointerEvents="none" importantForAccessibility="no-hide-descendants">
            <LockIcon size={icon.tileBadge.size} stroke={icon.tileBadge.stroke} color={color.onScrim} />
            <Text
              style={[textStyle(type.storefrontOverlay), { color: color.onScrim }]}
              numberOfLines={1}
              maxFontSizeMultiplier={size.home.overlayMaxFontScale}
            >
              {bracketLabel(bracket as number)}
            </Text>
          </View>
        ) : null}

        {perishable ? (
          <View
            style={s.countdown}
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <CountdownPill expiresAt={perishable.expiresAt} expired={perishable.expired} />
          </View>
        ) : null}
      </View>

      <View style={s.body}>
        <Text style={[textStyle(type.gridTitle), s.title]} numberOfLines={2}>
          {item.title}
        </Text>

        <Text style={[textStyle(type.gridMeta), s.meta]} numberOfLines={1}>
          {area ? `${item.conditionLabel} · ${area}` : item.conditionLabel}
        </Text>

        {item.owner.org ? (
          <View style={s.org}>
            <OrgChips org={item.owner.org} />
          </View>
        ) : null}

        {/*
          Omitted rather than shown as "0" or "—" for a listing made before the
          valuation model, exactly as FeedCard does it: an unvalued item is not
          an item worth nothing, and there is no treatment for the difference.
        */}
        {item.valueLeaves === null ? null : beyond !== null ? (
          // The distance, in secondary ink. The bracket itself moved to the
          // lock badge on the photo, so this line no longer repeats it, and
          // "1 bracket above you" fits one line on a 320 dp tile where the old
          // "Bracket 6 · 2 brackets above your reach" needed two.
          <Text
            style={[
              textStyle(offerType.tileValueLine),
              { color: color.inkSecondary, marginTop: space.browse.tileMetaToLeaves },
            ]}
            numberOfLines={2}
          >
            {`${bracketsWord(beyond)} above you`}
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
});

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
  // Both overlays share the Home tiles' badge inset and pill height, so a
  // badge on a Marketplace tile and one on a Home card are the same object.
  lockBadge: {
    position: "absolute",
    top: space.home.tileBadgeInset,
    right: space.home.tileBadgeInset,
    height: size.home.countdownPill,
    paddingHorizontal: size.home.countdownPillX - 2,
    flexDirection: "row",
    alignItems: "center",
    gap: size.leaves.gap,
    borderRadius: radius.countdownPill,
    backgroundColor: color.captionFill,
  },
  countdown: {
    position: "absolute",
    left: space.home.tileBadgeInset,
    bottom: space.home.tileBadgeInset,
    right: space.home.tileBadgeInset,
  },

  body: { padding: space.browse.tileBody },
  title: { color: color.ink },
  meta: { marginTop: space.browse.tileTitleToMeta, color: color.inkMuted },
  org: { marginTop: space.browse.tileTitleToMeta },
  leaves: {
    marginTop: space.browse.tileMetaToLeaves,
    flexDirection: "row",
    alignItems: "center",
    gap: size.leaves.gap,
  },
});
