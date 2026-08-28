import { Image, type ImageLoadEventData } from "expo-image";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { HeartIcon, CommentIcon, ImageIcon, KebabIcon, LeafIcon, RefreshIcon, ShareIcon } from "../icons";
import { Tappable } from "../Tappable";
import { clampAspect, relativeShort, wasCropped } from "../../lib/format";
import { resolveTier, TIER_LABEL, type TrustTier } from "../../lib/trust";
import {
  border,
  color,
  icon,
  lines,
  motion,
  radius,
  size,
  space,
  textStyle,
  type,
} from "../../theme/tokens";
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
 * THREE SLOTS IN THE ARTBOARD ARE FILLED WITH SOMETHING ELSE, deliberately:
 *
 *   - The pill beside the name is the TRUST TIER — New / Rising / Trusted / Top
 *     Trader — which /home resolves server-side as `owner.trustTier`, with DPA
 *     defaults already charged against it. It is NOT `owner.rank`, which is the
 *     Leaf ladder and answers a different question: how much someone has
 *     EARNED, not whether their counterparties came away satisfied. The
 *     artboard's four visual treatments map onto the four tiers in order. See
 *     `src/lib/trust.ts` for the fallback that covers endpoints sending null.
 *
 *   - The line under the name is drawn as "2.4 km away". Nothing can produce a
 *     distance yet: `Item.pickupLat/Lng` are the only coordinates in the schema
 *     and there is no viewer coordinate at all, so the line renders
 *     `owner.location` as what it is — a place name, and in practice nothing,
 *     since that column is null for every user so far.
 *
 *     DEFERRED, NOT MISSING. The design is written up in README under
 *     "Distance, and why it is not built yet". The one thing to carry in your
 *     head before touching this: it has to be computed CLIENT-SIDE from the
 *     already-coarsened `pickup`, and rendered in buckets. A server-side
 *     distance measured against the precise stored point is trilaterable — three
 *     readings from three positions recover the seller's front door, which is
 *     exactly what the coarsening exists to stop.
 *
 *   - The urgency chip ("Moving out Sunday") has no field behind it. `wanted`
 *     is what the owner will take in return, which is a different thing said in
 *     the same shape, and rendering it in the urgency treatment would turn a
 *     wish list into a deadline. The chip is built and takes a prop; nothing on
 *     this screen passes one yet.
 *
 * THE SOCIAL ROW IS DISPLAY-ONLY. `stats.likes`, `stats.liked` and
 * `stats.comments` all arrive on the item, so the counts and the liked heart
 * are real. Acting on them is not: the only like endpoint on this backend is
 * /api/posts/[id]/like, a cookie-session route outside /api/v1 that a Bearer
 * client cannot call, and this task is not the place to add one. So the row is
 * a row of facts rather than three buttons that do nothing when pressed — it
 * reports as text to a screen reader and has no press handler to swallow a tap.
 */
export function FeedCard({
  item,
  urgency = null,
  onOffer,
}: {
  item: Item;
  /** The urgency chip's copy. See the note above — nothing supplies it today. */
  urgency?: string | null;
  onOffer?: (item: Item) => void;
}) {
  const place = item.owner.location?.trim();
  const when = relativeShort(item.createdAt);
  // Either half can be absent — location is nullable, and clock skew can leave
  // `when` empty — so the separator is joined in rather than typed between
  // them, which would strand a " · " on its own.
  const meta = [place, when].filter(Boolean).join(" · ");

  return (
    <View style={s.card}>
      {/* ── owner row ── */}
      <View style={s.ownerRow}>
        <Avatar uri={item.owner.avatar} name={item.owner.name} />

        <View style={s.ownerText}>
          <View style={s.nameRow}>
            {/*
              The name yields and the tier badge does not. A long handle beside
              a short rank should cost the handle its tail, not push the rank
              off the row — the badge is a fixed, meaningful token, and half of
              one is worse than an elided name.
            */}
            <Text
              style={[textStyle(type.username), s.name]}
              numberOfLines={lines.username}
            >
              {item.owner.name}
            </Text>
            <TierBadge tier={resolveTier(item.owner)} />
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

        <KebabButton owner={item.owner.name} />
      </View>

      {/* ── photo ── */}
      <Photo images={item.images} title={item.title} />

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
        {item.valueLeaves !== null ? <LeavesChip value={item.valueLeaves} /> : null}
      </View>

      {/* ── chips ── */}
      <View style={s.chipRow}>
        <Chip label={item.conditionLabel} />
        <Chip label={item.categoryLabel} />
        {urgency ? <Chip label={urgency} urgent /> : null}
      </View>

      {/* ── social ── */}
      <SocialRow
        likes={item.stats.likes}
        liked={item.stats.liked}
        comments={item.stats.comments}
      />

      {/* ── action ── */}
      <View style={s.buttonWrap}>
        <Tappable
          onPress={() => onOffer?.(item)}
          accessibilityRole="button"
          accessibilityLabel={`Offer a trade for ${item.title}`}
          style={s.button}
          pressedStyle={s.buttonPressed}
        >
          <Text style={[textStyle(type.primaryButton), { color: color.onGreen }]}>
            Offer Trade
          </Text>
        </Tappable>
      </View>
    </View>
  );
}

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
function Photo({ images, title }: { images: string[]; title: string }) {
  const [aspect, setAspect] = useState(size.photo.aspectDefault);
  const [cropped, setCropped] = useState(false);
  const [failed, setFailed] = useState(false);
  // Bumped to retry. It is the Image's key, so incrementing it remounts the
  // component — expo-image has no "try that URL again" call, and re-rendering
  // with an identical source is a no-op it correctly ignores.
  const [attempt, setAttempt] = useState(0);

  const cover = images[0];

  const onLoad = useCallback((e: ImageLoadEventData) => {
    setAspect(clampAspect(e.source.width, e.source.height));
    setCropped(wasCropped(e.source.width, e.source.height));
  }, []);

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
        Only on a photo the clamp actually cropped. It is an admission that what
        is on screen is not the whole frame, so it appears when that is true and
        not merely when the ratio is off square — a 5:4 upload sits inside the
        band untouched and gets no label.

        THE SPEC CALLS THIS AN "EXPAND AFFORDANCE" AND THE WORD IS "CROPPED".
        There is no item detail screen yet — /api/v1/items/[id] has no route in
        the app — so a label reading "tap to expand" would promise a gesture
        that does nothing, on the one element whose whole job is to be honest
        about what is being withheld. It states the fact instead, in the
        specified position, type and scrim. The word changes to the invitation
        on the day the screen behind it exists.
      */}
      {cropped ? (
        <View style={s.caption} pointerEvents="none">
          <Text style={[textStyle(type.photoCaption), { color: color.surface }]}>CROPPED</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ───────────────────────────── parts ────────────────────────────────── */

/**
 * The four trust tiers, in the artboard's four treatments.
 *
 * KEYED BY TIER, NOT BY POSITION, so the mapping is readable as a table and a
 * tier that later earns its own treatment is one line rather than an index
 * shift. The escalation is the design's: quiet grey while someone is unproven,
 * the green wash once their counterparties have vouched for them, solid green
 * at the top. New and Rising deliberately share the grey — the spec draws four
 * rungs but only three treatments, and inventing a fourth fill would mean
 * reaching for the terracotta, which this palette reserves for likes and
 * urgency.
 */
const TIER_TREATMENT: Record<TrustTier, { backgroundColor: string; borderColor: string; color: string }> = {
  "New Trader":     { backgroundColor: color.control,   borderColor: color.controlLine, color: color.inkMuted },
  "Rising Trader":  { backgroundColor: color.control,   borderColor: color.controlLine, color: color.inkMuted },
  "Trusted Trader": { backgroundColor: color.greenWash, borderColor: color.greenLine,   color: color.forest },
  "Top Trader":     { backgroundColor: color.green,     borderColor: "transparent",     color: color.onGreen },
};

/**
 * The badge shows the SHORT label and says the whole tier out loud.
 *
 * "TOP TRADER" is the widest thing this row can carry beside a name, so the
 * other three are cut to one word rather than every one of them keeping a
 * "TRADER" that adds nothing at a glance. A screen reader gets the full name,
 * where there is no width to run out of and "TOP" on its own is meaningless.
 */
function TierBadge({ tier }: { tier: TrustTier }) {
  const treatment = TIER_TREATMENT[tier];

  return (
    <View
      style={[
        s.tierBadge,
        { backgroundColor: treatment.backgroundColor, borderColor: treatment.borderColor },
      ]}
      accessibilityRole="text"
      accessibilityLabel={tier}
    >
      <Text style={[textStyle(type.tierBadge), { color: treatment.color }]}>
        {TIER_LABEL[tier]}
      </Text>
    </View>
  );
}

/** The item's worth. Never shrinks — the title is the flexible half of that row. */
function LeavesChip({ value }: { value: number }) {
  return (
    <View
      style={s.leavesChip}
      accessibilityRole="text"
      accessibilityLabel={`Valued at ${value} Leaves`}
    >
      <LeafIcon size={icon.cardLeaf.size} stroke={icon.cardLeaf.stroke} color={color.forest} />
      <Text style={[textStyle(type.leavesCard), { color: color.forest }]}>{value}</Text>
    </View>
  );
}

/** Condition, category — and, in the warm treatment, urgency. */
function Chip({ label, urgent = false }: { label: string; urgent?: boolean }) {
  return (
    <View style={[s.chip, urgent && s.chipUrgent]}>
      <Text
        style={[
          textStyle(urgent ? type.urgencyChip : type.chip),
          { color: urgent ? color.urgent : color.inkSecondary },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Likes, comments, share. See the file note on why none of them is a button.
 *
 * The row is pulled left by exactly the side padding each action carries, so
 * the first glyph's own edge lands on the 16 px gutter rather than 10 px inside
 * it. Without that the social row reads as indented from every other row in the
 * card, which at this contrast is the most visible misalignment on the screen.
 */
function SocialRow({
  likes,
  liked,
  comments,
}: {
  likes: number;
  liked: boolean;
  comments: number;
}) {
  return (
    <View style={s.socialWrap}>
      <View style={s.socialRow}>
        <View
          style={s.socialItem}
          accessibilityRole="text"
          accessibilityLabel={liked ? `${likes} likes, you liked this` : `${likes} likes`}
        >
          <HeartIcon
            size={icon.social.size}
            stroke={icon.social.stroke}
            color={liked ? color.like : color.inkSecondary}
            liked={liked}
          />
          <Text
            style={[
              textStyle(type.socialCount),
              { color: liked ? color.like : color.inkSecondary },
            ]}
          >
            {likes}
          </Text>
        </View>

        <View style={s.socialItem} accessibilityRole="text" accessibilityLabel={`${comments} comments`}>
          <CommentIcon
            size={icon.social.size}
            stroke={icon.social.stroke}
            color={color.inkSecondary}
          />
          <Text style={[textStyle(type.socialCount), { color: color.inkSecondary }]}>
            {comments}
          </Text>
        </View>

        <View style={s.socialItem} importantForAccessibility="no-hide-descendants">
          <ShareIcon
            size={icon.social.size}
            stroke={icon.social.stroke}
            color={color.inkSecondary}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * The overflow affordance.
 *
 * Drawn in the artboard and NOT wired in this task: report and block are their
 * own screens against /api/v1/reports and /api/v1/blocks. It renders as a real
 * 44 px target with a real label so the row's geometry and its screen-reader
 * output are the shipping ones, and so wiring it later is a handler rather than
 * a re-layout. The −12 pull is what puts the dots on the 16 px gutter while the
 * 44 px box it needs extends past it.
 */
function KebabButton({ owner }: { owner: string }) {
  return (
    <Pressable
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
  ownerText: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: space.card.nameToBadge },
  name: { flexShrink: 1, color: color.ink },
  meta: { marginTop: space.card.nameToMeta, color: color.inkMuted },

  avatar: {
    width: size.avatar.owner,
    height: size.avatar.owner,
    borderRadius: radius.ownerAvatar,
    backgroundColor: color.greenWash,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },

  tierBadge: {
    flexShrink: 0,
    borderRadius: radius.tierBadge,
    borderWidth: border.chip,
    paddingHorizontal: space.tierBadge.x,
    paddingVertical: space.tierBadge.y,
  },

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
  caption: {
    position: "absolute",
    right: space.photoCaption.inset,
    bottom: space.photoCaption.inset,
    paddingHorizontal: space.photoCaption.x,
    paddingVertical: space.photoCaption.y,
    borderRadius: radius.photoCaption,
    backgroundColor: color.captionFill,
  },

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

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.card.chipGap,
    paddingHorizontal: space.screenX,
    marginTop: space.card.titleToChips,
  },
  chip: {
    borderRadius: radius.chip,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    paddingHorizontal: space.chip.x,
    paddingVertical: space.chip.y,
  },
  chipUrgent: { borderColor: color.urgentLine, backgroundColor: color.urgentWash },

  socialWrap: { paddingHorizontal: space.screenX, marginTop: space.card.chipsToSocial },
  socialRow: { flexDirection: "row", marginHorizontal: -space.card.socialInset },
  socialItem: {
    height: size.control.social,
    flexDirection: "row",
    alignItems: "center",
    gap: space.card.socialGap,
    paddingHorizontal: size.control.socialX,
  },

  buttonWrap: { paddingHorizontal: space.screenX, marginTop: space.card.socialToButton },
  button: {
    height: size.control.primaryButton,
    borderRadius: radius.primaryButton,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
  },
  // No second green in the palette, so pressed is the same fill at reduced
  // opacity rather than a shade that is not in the spec.
  buttonPressed: { opacity: 0.85 },
});
