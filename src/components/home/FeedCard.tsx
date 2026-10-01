import { Image, type ImageLoadEventData } from "expo-image";
import { memo, useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { HeartIcon, CommentIcon, ImageIcon, KebabIcon, LeafIcon, RefreshIcon, ShareIcon, SwapIcon } from "../icons";
import { Tappable } from "../Tappable";
import { CountdownPill } from "../CountdownPill";
import { clampAspect, relativeShort } from "../../lib/format";
import { listingArea } from "../../lib/listing-area";
import { ORG_BADGE_LABEL, ownerBadge } from "../../lib/org";
import {
  border,
  color,
  font,
  icon,
  lines,
  motion,
  radius,
  size,
  space,
  textStyle,
  type,
} from "../../theme/tokens";
import { bracketLabel, bracketOf } from "../../lib/brackets";
import type { Item } from "../../api/types";

/**
 * One listing in the feed, full-bleed and divider-separated.
 *
 * Everything rendered here already arrived on the item — categoryLabel,
 * conditionLabel and the owner's rank are resolved server-side. No enum is
 * translated to a human string on this side, which is what stops the app and
 * the web disagreeing about whether CLOTHING reads "Clothing" or "Fashion".
 * (They already disagree in three places on the web. See v1/taxonomy.ts.)
 *
 * THE CARD AS RESTYLED (1 Oct 2026):
 *
 *   header   avatar, name, then "Rising trader · Lapu-Lapu · 20h ago". The
 *            standing is the TRUST TIER — New / Rising / Trusted / Top trader —
 *            which /home resolves server-side as `owner.trustTier`, with DPA
 *            defaults already charged against it. It is NOT `owner.rank`, the
 *            Leaf ladder, which says how much someone has EARNED rather than
 *            whether their counterparties came away satisfied. A verified shop
 *            reads "Verified MSME" in the same slot; an unverified one, nothing.
 *            It was a pill beside the name ("NEW") and is plain text now.
 *
 *            The place is listingArea(), the marketplace cards' function: the
 *            hub city, else the seller's city. /home sends `safeZones: null`
 *            today, so in practice it is the seller's city.
 *
 *            NO DISTANCE, DEFERRED. See README, "Distance, and why it is not
 *            built yet": it has to be computed CLIENT-SIDE from the coarsened
 *            `pickup` and rendered in buckets, because a server-side distance
 *            against the precise point is trilaterable.
 *
 *   photo    clamped to the aspect band; a perishable carries the live
 *            CountdownPill bottom-left, exactly as GridTile does.
 *
 *   body     title + bracket on one row, "Condition · Category", then
 *            "Wants: …" with a swap glyph when the owner said what they want.
 *
 *   actions  like, comment, share as icons with a count only above zero, and
 *            an outlined "Offer trade" pill, absent on your own listing.
 *
 * THE SOCIAL ROW IS LIVE. It was a row of facts — three glyphs with no press
 * handler — because the only like endpoint was /api/posts/[id]/like, outside
 * /api/v1 and answering in a shape `apiV1()` cannot read. There are now
 * POST/DELETE /api/v1/items/[id]/like and GET/POST /api/v1/items/[id]/comments,
 * so all three are real controls: like is optimistic and moves on the tap,
 * comment opens the sheet the feed screen owns, and share opens the OS sheet
 * with a link to the listing's public web page. See `src/api/social.ts` and
 * `src/lib/share.ts`.
 *
 * EVERY HANDLER IS OPTIONAL AND THE GLYPH FOLLOWS IT. A card rendered without
 * `onLike` draws the heart exactly as it used to — as text, with no press
 * target — rather than as a button that swallows the tap. That is what keeps
 * this component usable on a screen that has not wired the actions yet, which
 * is the state it was in until this pass.
 */

/**
 * WHERE OFFER TRADE SITS. Two layouts, and the card is built for both.
 *
 * It was a 48 px full-width green bar on its own row under the social actions.
 * That is the treatment a form's submit button gets, and a feed of them reads
 * as a stack of forms rather than a stack of listings — the button, not the
 * photo, becomes the loudest thing on every card, and the eye stops at each one
 * instead of scrolling past.
 *
 *   "inline"  the pill rides the social row, hard right. The card ends on ONE
 *             line: likes, comments, share, then the action. Saves the whole
 *             row — 48 of button plus 6 of gap — off every card in the feed,
 *             which is roughly a fifth of a card's non-photo height.
 *
 *   "pill"    its own row still, but an intrinsic-width capsule on the left
 *             gutter instead of a full-width bar. Keeps the action on a line of
 *             its own — more separation, less compression — at the cost of the
 *             row.
 *
 * OUTLINED, NOT SOLID (1 Oct 2026). A forest outline and forest label on the
 * card's own fill: the photo is the loudest thing on a card again, and the
 * pill still reads as the action because it is the only forest-outlined
 * capsule in the card and the only control with a word in it. Both layouts
 * keep the full 15 px bold label and the app's SwapIcon on the leading edge.
 *
 * The inline row WRAPS rather than overflowing: at 2x text on a 320 dp screen
 * the pill drops under the social icons instead of pushing past the gutter.
 *
 * The two differ by a constant so they can be compared on a device in one
 * reload. Flip this line.
 */
export type OfferLayout = "inline" | "pill";

export const OFFER_LAYOUT: OfferLayout = "inline";

export const FeedCard = memo(function FeedCard({
  item,
  onOffer,
  onLike,
  onComment,
  onShare,
  onMenu,
  onOwnerPress,
  offerLayout = OFFER_LAYOUT,
  viewerId = null,
}: {
  item: Item;
  onOffer?: (item: Item) => void;
  /** `next` is the state being asked for, never "toggle" — see useLike(). */
  onLike?: (item: Item, next: boolean) => void;
  onComment?: (item: Item) => void;
  onShare?: (item: Item) => void;
  /** The three dots. The sheet itself belongs to the screen, not to the card. */
  onMenu?: (item: Item) => void;
  onOwnerPress?: (item: Item) => void;
  /** Per-card override of the constant above. The feed does not pass one. */
  offerLayout?: OfferLayout;
  /** Own listings suppress the offer action even when the item is still listed. */
  viewerId?: string | null;
}) {
  // "Rising trader · Lapu-Lapu · 20h ago". The tier moved here from the badge
  // beside the name (1 Oct 2026); the place is the marketplace cards' own
  // listingArea(), so a listing reads the same city on both screens.
  const standing = ownerStanding(item.owner);
  const area = listingArea(item);
  const when = relativeShort(item.createdAt);
  // Any part can be absent — an unverified shop has no standing, the area is
  // nullable, clock skew can leave `when` empty — so the separators are joined
  // in rather than typed between them, which would strand a " · " on its own.
  const meta = [standing, area, when].filter(Boolean).join(" · ");
  const wanted = item.wanted?.trim();
  const perishable = item.perishable ?? null;
  const isOwnListing = viewerId !== null && item.owner.id === viewerId;
  const offerAction = isOwnListing ? undefined : () => onOffer?.(item);

  return (
    <View style={s.card}>
      {/* ── owner row ── */}
      <View style={s.ownerRow}>
        <Tappable onPress={onOwnerPress ? () => onOwnerPress(item) : undefined} disabled={!onOwnerPress} style={s.ownerIdentity} pressedStyle={s.ownerPressed} accessibilityRole={onOwnerPress ? "button" : undefined} accessibilityLabel={onOwnerPress ? `View ${item.owner.name}'s profile` : undefined}>
          <Avatar uri={item.owner.avatar} name={item.owner.name} />
          <View style={s.ownerText}>
          <View style={s.nameRow}>
            {/* The name yields and the achievement mark does not. */}
            <Text
              style={[textStyle(type.username), s.name]}
              numberOfLines={lines.username}
            >
              {item.owner.name}
            </Text>
            {item.owner.featuredAchievement ? (
              <View style={s.featureBadge} accessibilityLabel={`Featured achievement: ${item.owner.featuredAchievement.name}`}>
                {item.owner.featuredAchievement.imageUrl ? (
                  <Image
                    source={{ uri: item.owner.featuredAchievement.imageUrl }}
                    style={s.featureBadgeImage}
                    contentFit="cover"
                  />
                ) : (
                  <Text style={s.featureBadgeText}>{item.owner.featuredAchievement.icon}</Text>
                )}
              </View>
            ) : null}
          </View>

          {meta ? (
            <Text
              style={[textStyle(type.metadata), s.meta]}
              numberOfLines={lines.metadata}
            >
              {meta}
            </Text>
          ) : null}
          </View>
        </Tappable>

        <KebabButton owner={item.owner.name} onPress={onMenu && (() => onMenu(item))} />
      </View>

      {/* ── photo ── */}
      <Photo images={item.images} title={item.title} perishable={perishable} />

      {/* ── title + value ── */}
      <View style={s.titleRow}>
        <Text style={[textStyle(type.itemTitle), s.title]} numberOfLines={lines.itemTitle}>
          {item.title}
        </Text>

        {/*
          Null for listings made before the valuation model. The chip is omitted
          rather than shown as "0" or "—": an unvalued item is not an item worth
          nothing, and the artboard has no state for the difference.
        */}
        {item.valueLeaves !== null ? (
          <LeavesChip value={item.valueLeaves} own={isOwnListing} />
        ) : null}
      </View>

      {/* ── condition · category ── */}
      <Text style={[textStyle(type.metadata), s.facts]} numberOfLines={1}>
        {`${item.conditionLabel} · ${item.categoryLabel}`}
      </Text>

      {/* ── what the owner will take; absent when they did not say ── */}
      {wanted ? (
        <View style={s.wantsRow} accessible accessibilityLabel={`Wants: ${wanted}`}>
          <SwapIcon size={icon.cardLeaf.size} stroke={icon.cardLeaf.stroke} color={color.forest} />
          <Text style={[textStyle(type.metadata), s.wantsText]} numberOfLines={2}>
            <Text style={s.wantsLabel}>Wants: </Text>
            {wanted}
          </Text>
        </View>
      ) : null}

      {/* ── social + action ── */}
      <CardActions
        likes={item.stats.likes}
        liked={item.stats.liked}
        comments={item.stats.comments}
        layout={offerLayout}
        title={item.title}
        onOffer={offerAction}
        onLike={onLike && (() => onLike(item, !item.stats.liked))}
        onComment={onComment && (() => onComment(item))}
        onShare={onShare && (() => onShare(item))}
      />
    </View>
  );
});

/* ───────────────────────────── photo ────────────────────────────────── */

/**
 * The photo box, and the three things it can be.
 *
 * The aspect ratio is not known until the image reports its own dimensions, so
 * the box opens square — the spec's default — and settles into the clamped
 * ratio on load. That is one reflow per never-before-seen image and none
 * thereafter: expo-image serves the second appearance from its disk cache and
 * `onLoad` fires with the dimensions immediately.
 *
 * The failure state KEEPS THE BOX. It holds whatever ratio the photo would have
 * held (square, if it never got far enough to report one), so a 404 in the
 * middle of the feed does not shorten the card and jerk the scroll position of
 * everything below it. That is the spec's stated reason for the state existing.
 */
function Photo({
  images,
  title,
  perishable,
}: {
  images: string[];
  title: string;
  perishable: Item["perishable"];
}) {
  const [aspect, setAspect] = useState(size.photo.aspectDefault);
  const [failed, setFailed] = useState(false);
  // Bumped to retry. It is the Image's key, so incrementing it remounts the
  // component — expo-image has no "try that URL again" call, and re-rendering
  // with an identical source is a no-op it correctly ignores.
  const [attempt, setAttempt] = useState(0);

  const cover = images[0];

  const onLoad = useCallback((e: ImageLoadEventData) => {
    setAspect(clampAspect(e.source.width, e.source.height));
  }, []);

  // Rides the photo, or the failed box in its place, so a perishable whose
  // photo 404s still says how long it has left. Same corner as GridTile.
  const countdown = perishable ? (
    <View style={s.countdown} pointerEvents="none">
      <CountdownPill expiresAt={perishable.expiresAt} expired={perishable.expired} />
    </View>
  ) : null;

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((n) => n + 1);
  }, []);

  if (!cover || failed) {
    return (
      <View style={[s.photoFailed, { aspectRatio: aspect }]}>
        <ImageIcon
          size={icon.failedPhoto.size}
          stroke={icon.failedPhoto.stroke}
          color={color.failedIcon}
        />
        {cover ? (
          <Tappable
            onPress={retry}
            accessibilityRole="button"
            accessibilityLabel="Reload photo"
            style={s.reload}
            pressedStyle={s.reloadPressed}
          >
            <RefreshIcon
              size={icon.retryPhoto.size}
              stroke={icon.retryPhoto.stroke}
              color={color.ink}
            />
            <Text style={[textStyle(type.secondaryButton), { color: color.ink }]}>
              Tap to reload
            </Text>
          </Tappable>
        ) : (
          <Text style={[textStyle(type.metadata), s.noPhoto]}>No photo</Text>
        )}
        {countdown}
      </View>
    );
  }

  return (
    <View style={{ aspectRatio: aspect, backgroundColor: color.control }}>
      <Image
        key={attempt}
        source={{ uri: cover }}
        contentFit="cover"
        transition={motion.photoFadeMs}
        onLoad={onLoad}
        onError={() => setFailed(true)}
        accessibilityLabel={title}
        style={s.photo}
      />
      {/*
        No "Cropped" label (removed 1 Oct 2026). It marked photos the aspect
        clamp had cut, which is a fact about the layout, not about the listing;
        the full frame is one tap away on the listing screen.
      */}
      {countdown}
    </View>
  );
}

/* ───────────────────────────── parts ────────────────────────────────── */

/**
 * The owner's standing, as the first part of the header's meta line.
 *
 * ownerBadge() decides it, which matters: the server sends `trustTier: null`
 * for an organisation, and resolveTier() would read that as "not resolved" and
 * compute a rung from the shop's trade count — "Trusted trader" on a sari-sari
 * store. A verified shop reads "Verified MSME"; an unverified one, nothing.
 *
 * Sentence case from the tier name ("Rising Trader" -> "Rising trader") rather
 * than TIER_LABEL, which is the all-caps badge copy other screens still use.
 */
function ownerStanding(owner: Item["owner"]): string | null {
  const badge = ownerBadge(owner);
  if (badge.kind === "none") return null;
  if (badge.kind === "org") return ORG_BADGE_LABEL.compact;
  return badge.tier.charAt(0) + badge.tier.slice(1).toLowerCase();
}

/**
 * The item's worth. Never shrinks — the title is the flexible half of that row.
 *
 * THE EXACT NUMBER ONLY ON YOUR OWN LISTING. Everyone else's shows its bracket
 * — see `src/lib/brackets.ts` for the reasoning — and `own` is the same
 * `isOwnListing` that already decides whether the card gets an offer button,
 * so the two cannot disagree about whose listing this is. The accessibility
 * label follows the same rule: a reader announcing the exact figure would
 * defeat the bracket.
 */
function LeavesChip({ value, own }: { value: number; own: boolean }) {
  const shown = own ? String(value) : bracketLabel(bracketOf(value));
  return (
    <View
      style={s.leavesChip}
      accessibilityRole="text"
      accessibilityLabel={own ? `Your listing, valued at ${value} Leaves` : shown}
    >
      <LeafIcon size={icon.cardLeaf.size} stroke={icon.cardLeaf.stroke} color={color.forest} />
      <Text style={[textStyle(type.leavesCard), { color: color.forest }]}>{shown}</Text>
    </View>
  );
}

/**
 * How a card ends: the social actions, and the action the card exists for.
 *
 * ONE COMPONENT FOR BOTH LAYOUTS rather than two cards, because the difference
 * is where the Offer control is parented and nothing else — same pill, same
 * fill, same label, same handler. Two components would drift the moment one of
 * them was tuned.
 *
 * In "inline" the social group and the pill are the two ends of one row, so the
 * social group is pulled left by its own side padding (the glyph lands on the
 * 16 px gutter, not 10 px inside it) while the pill sits flush on the right
 * gutter with no pull of its own — its fill IS its edge, so a negative margin
 * would push green past the gutter every other row respects.
 *
 * The social group shrinks and the pill does not. Four digits of likes is the
 * realistic squeeze, and losing a count's last digit is a smaller failure than
 * a clipped "Offer Trade".
 */
function CardActions({
  likes,
  liked,
  comments,
  layout,
  title,
  onOffer,
  onLike,
  onComment,
  onShare,
}: {
  likes: number;
  liked: boolean;
  comments: number;
  layout: OfferLayout;
  title: string;
  onOffer?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
}) {
  const inline = layout === "inline";

  return (
    <>
      <View style={[s.socialWrap, inline && s.socialWrapInline]}>
        <SocialRow
          likes={likes}
          liked={liked}
          comments={comments}
          onLike={onLike}
          onComment={onComment}
          onShare={onShare}
        />
        {inline && onOffer ? <OfferButton layout={layout} title={title} onPress={onOffer} /> : null}
      </View>

      {inline ? null : onOffer ? (
        <View style={s.offerWrap}>
          <OfferButton layout={layout} title={title} onPress={onOffer} />
        </View>
      ) : null}
    </>
  );
}

/**
 * Likes, comments, share.
 *
 * The row is pulled left by exactly the side padding each action carries, so
 * the first glyph's own edge lands on the 16 px gutter rather than 10 px inside
 * it. Without that the social row reads as indented from every other row in the
 * card, which at this contrast is the most visible misalignment on the screen.
 *
 * EACH ACTION IS A BUTTON ONLY IF IT WAS GIVEN A HANDLER. `SocialAction`
 * renders a plain View with `accessibilityRole="text"` when `onPress` is
 * absent — the state this row shipped in — and a Pressable with a button role
 * when it is present. One component, so the two states cannot drift in
 * geometry: the 44 px height and the 10 px side padding that set the row's
 * alignment are written once and are the same either way.
 *
 * A COUNT ONLY ABOVE ZERO. A bare heart reads as "like this"; "0" beside it
 * reads as a verdict. The screen reader still hears the number either way.
 *
 * THE HEART DOES NOT WAIT. `onLike` writes the new count into the cache before
 * the request leaves, so this component re-renders from a prop that has already
 * moved. There is no pending state here and deliberately no spinner: a heart
 * that showed a loader would be slower to read than the state it is reporting.
 * If the write fails the cache is rolled back and the heart returns — see
 * useLike().
 */
export function SocialRow({
  likes,
  liked,
  comments,
  onLike,
  onComment,
  onShare,
}: {
  likes: number;
  liked: boolean;
  comments: number;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
}) {
  return (
    <View style={s.socialRow}>
      <SocialAction
        onPress={onLike}
        label={liked ? `${likes} likes, you liked this. Unlike` : `${likes} likes. Like`}
        readOnlyLabel={liked ? `${likes} likes, you liked this` : `${likes} likes`}
      >
        <HeartIcon
          size={icon.social.size}
          stroke={icon.social.stroke}
          color={liked ? color.like : color.inkSecondary}
          liked={liked}
        />
        {likes > 0 ? (
          <Text
            style={[
              textStyle(type.socialCount),
              { color: liked ? color.like : color.inkSecondary },
            ]}
          >
            {likes}
          </Text>
        ) : null}
      </SocialAction>

      <SocialAction
        onPress={onComment}
        label={comments === 1 ? "1 comment. Open comments" : `${comments} comments. Open comments`}
        readOnlyLabel={`${comments} comments`}
      >
        <CommentIcon
          size={icon.social.size}
          stroke={icon.social.stroke}
          color={color.inkSecondary}
        />
        {comments > 0 ? (
          <Text style={[textStyle(type.socialCount), { color: color.inkSecondary }]}>
            {comments}
          </Text>
        ) : null}
      </SocialAction>

      <SocialAction onPress={onShare} label="Share this listing" readOnlyLabel={null}>
        <ShareIcon
          size={icon.social.size}
          stroke={icon.social.stroke}
          color={color.inkSecondary}
        />
      </SocialAction>
    </View>
  );
}

/**
 * One social action, in whichever of its two forms the caller earned.
 *
 * `readOnlyLabel` being null is how the share glyph stays out of the screen
 * reader's way while it is inert — there is no count to announce and "share"
 * with nothing behind it is worse than silence. With a handler it announces
 * normally, like the other two.
 */
function SocialAction({
  onPress,
  label,
  readOnlyLabel,
  children,
}: {
  onPress?: () => void;
  label: string;
  readOnlyLabel: string | null;
  children: React.ReactNode;
}) {
  if (!onPress) {
    return readOnlyLabel ? (
      <View style={s.socialItem} accessibilityRole="text" accessibilityLabel={readOnlyLabel}>
        {children}
      </View>
    ) : (
      <View style={s.socialItem} importantForAccessibility="no-hide-descendants">
        {children}
      </View>
    );
  }

  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={s.socialItem}
      pressedStyle={s.socialPressed}
    >
      {children}
    </Tappable>
  );
}

/**
 * The point of the app, in a capsule.
 *
 * Outlined in forest on the card's own fill. The swap glyph on the leading
 * edge is what keeps an intrinsic-width capsule from reading as a tag.
 *
 * The label is NOT shortened per layout ("Offer" would fit either). "Offer
 * trade" is the verb the whole product is built around.
 */
function OfferButton({
  layout,
  title,
  onPress,
}: {
  layout: OfferLayout;
  title: string;
  onPress: () => void;
}) {
  const inline = layout === "inline";

  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Offer a trade for ${title}`}
      style={inline ? s.offerInline : s.offerPill}
      pressedStyle={s.offerPressed}
    >
      <SwapIcon size={icon.offer.size} stroke={icon.offer.stroke} color={color.forest} />
      <Text style={[textStyle(type.primaryButton), { color: color.forest }]} numberOfLines={1}>
        Offer trade
      </Text>
    </Tappable>
  );
}

/**
 * The overflow affordance, wired.
 *
 * It was drawn and inert — a real 44 px target with a real label and no handler
 * — so that wiring it would be a handler rather than a re-layout. This is that
 * handler. The sheet it opens is mounted by the SCREEN, not here: see
 * ListingMenu for why one Modal for the whole feed is not the same thing as one
 * Modal per card.
 *
 * The −12 pull is what puts the dots on the 16 px gutter while the 44 px box
 * they need extends past it.
 *
 * Still renders without an `onPress`, and is still inert when it does. A screen
 * that has not wired the menu gets the geometry and the label and nothing that
 * responds to a tap, which is a truthful control; a Pressable with an empty
 * handler is not.
 */
function KebabButton({ owner, onPress }: { owner: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`More options for ${owner}'s listing`}
      style={s.kebab}
    >
      <KebabIcon size={icon.kebab.size} color={color.inkMuted} />
    </Pressable>
  );
}

function Avatar({ uri, name }: { uri: string | null; name: string }) {
  if (uri) {
    return <Image source={{ uri }} contentFit="cover" style={s.avatar} />;
  }
  return (
    <View style={[s.avatar, s.avatarFallback]}>
      <Text style={[textStyle(type.avatarInitials40), { color: color.forest }]}>
        {name.trim().charAt(0).toUpperCase() || "?"}
      </Text>
    </View>
  );
}

/* ───────────────────────────── styles ───────────────────────────────── */

const s = StyleSheet.create({
  // No horizontal padding and no radius: the photo is edge-to-edge and every
  // text row carries the 16 gutter itself.
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    paddingTop: space.card.top,
    paddingBottom: space.card.bottom,
  },

  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.card.ownerGap,
    paddingHorizontal: space.screenX,
    marginBottom: space.card.ownerToPhoto,
  },
  ownerIdentity: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.card.ownerGap },
  ownerPressed: { opacity: 0.7 },
  ownerText: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: space.card.nameToBadge },
  featureBadge: {
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.greenWash,
    borderWidth: border.chip,
    borderColor: color.greenLine,
    // Clip an uploaded badge image to the circle; without this a square image
    // would spill past the rounded border.
    overflow: "hidden",
  },
  featureBadgeText: { fontSize: 10, lineHeight: 12 },
  featureBadgeImage: { width: "100%", height: "100%", borderRadius: 4 },
  name: { flexShrink: 1, color: color.ink },
  meta: { marginTop: space.card.nameToMeta, color: color.inkMuted },

  avatar: {
    width: size.avatar.owner,
    height: size.avatar.owner,
    borderRadius: radius.ownerAvatar,
    backgroundColor: color.greenWash,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },

  kebab: {
    width: size.control.kebab,
    height: size.control.kebab,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -size.control.kebabInset,
  },

  photo: { width: "100%", height: "100%" },
  photoFailed: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: space.card.failedGap,
    backgroundColor: color.control,
    borderTopWidth: border.hairline,
    borderBottomWidth: border.hairline,
    borderColor: color.divider,
  },
  noPhoto: { color: color.inkMuted },
  reload: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.card.socialGap,
    height: size.control.reloadButton,
    paddingHorizontal: size.control.reloadButtonX,
    borderRadius: radius.reloadButton,
    borderWidth: border.chip,
    borderColor: color.controlLineStrong,
    backgroundColor: color.surface,
  },
  reloadPressed: { backgroundColor: color.control },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.card.titleToLeaves,
    paddingHorizontal: space.screenX,
    marginTop: space.card.photoToTitle,
  },
  title: { flex: 1, color: color.ink },

  leavesChip: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: size.leaves.gap,
    height: size.leaves.cardChip,
    paddingLeft: size.leaves.cardChipLeft,
    paddingRight: size.leaves.cardChipRight,
    borderRadius: radius.leavesChipCard,
    borderWidth: border.chip,
    borderColor: color.greenLine,
    backgroundColor: color.greenWash,
  },

  facts: {
    paddingHorizontal: space.screenX,
    marginTop: space.card.titleToChips,
    color: color.inkSecondary,
  },
  wantsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: size.leaves.gap,
    paddingHorizontal: space.screenX,
    marginTop: space.card.nameToMeta + 2,
  },
  wantsText: { flex: 1, color: color.inkSecondary },
  wantsLabel: { fontFamily: font.sansSemi, color: color.forest },

  countdown: {
    position: "absolute",
    left: space.home.tileBadgeInset,
    bottom: space.home.tileBadgeInset,
  },

  socialWrap: { paddingHorizontal: space.screenX, marginTop: space.card.chipsToSocial },
  // Only in the inline layout. In the pill layout the wrap holds one child and
  // a flex direction on it would do nothing but invite someone to wonder why.
  socialWrapInline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    // Wraps at 2x text on a narrow screen: the pill drops under the icons
    // rather than pushing past the right gutter.
    flexWrap: "wrap",
    columnGap: space.card.socialToOffer,
  },
  socialRow: { flexShrink: 1, flexDirection: "row", marginHorizontal: -space.card.socialInset },
  socialItem: {
    height: size.control.social,
    flexDirection: "row",
    alignItems: "center",
    gap: space.card.socialGap,
    paddingHorizontal: size.control.socialX,
  },
  // Opacity rather than a fill. These sit on the card's own background with no
  // border of their own, so a pressed FILL would draw a rectangle that exists
  // for no other reason and is visible for 80 ms.
  socialPressed: { opacity: 0.55 },

  offerInline: {
    // Never gives ground to the counts beside it. See CardActions.
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: space.card.offerGap,
    minHeight: size.control.offerInline,
    paddingHorizontal: size.control.offerInlineX,
    borderRadius: radius.offerInline,
    borderWidth: border.chip,
    borderColor: color.forest,
  },

  offerWrap: { paddingHorizontal: space.screenX, marginTop: space.card.socialToButton },
  offerPill: {
    // Intrinsic width, on the gutter. Without this the pill stretches to the
    // wrap's full width and the change undoes itself.
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: space.card.offerGap,
    minHeight: size.control.offerPill,
    paddingHorizontal: size.control.offerPillX,
    borderRadius: radius.offerPill,
    borderWidth: border.chip,
    borderColor: color.forest,
  },

  // The outline fills with the green wash while held, the same pressed state
  // the app's other outlined chips use.
  offerPressed: { backgroundColor: color.greenWash },
});
