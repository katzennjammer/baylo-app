import { Image } from "expo-image";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";

import { PromiseCaseIcon } from "./icons";
import { ChevronRightIcon, ImageIcon } from "../icons";
import { WarningTriangleIcon } from "../offer/icons";
import { Tappable } from "../Tappable";
import {
  deadlineInk,
  offerBorder,
  offerColor,
  offerIcon,
  offerRadius,
  offerSize,
  offerSpace,
  offerType,
  textStyle,
} from "../../theme/offer-tokens";
import { font } from "../../theme/tokens";

/**
 * Every row shape §6 and the frames use, and nothing that decides what goes in
 * one.
 *
 * The ordering lives in `buildTradesModel()`; the data lives in the screens.
 * What is here is geometry — a card, a row, a meter, a small button — so that
 * the four screens that draw these are four arrangements of one vocabulary
 * rather than four sets of numbers.
 *
 * ── THE HEIGHTS ARE MINIMA, NOT HEIGHTS ─────────────────────────────────────
 *
 * §3.5's table reads as absolute y positions and §4's component table gives 88,
 * 76, 72 and 60. Every one of them is a `minHeight` here. A fixed height clips
 * the second line of a long item title at a large system font scale, and the
 * spec's own §9 closing line — "row heights and all 44px targets are unchanged"
 * — is about the design's rhythm, not about refusing to grow for somebody who
 * needs 200% text. The rows land on the spec's numbers at the spec's font scale,
 * which is what the table is measuring.
 */

/* ─────────────────────────── the photo well ─────────────────────────── */

/**
 * A square thumbnail: 48 on a card, 44 on a row, radius 8.
 *
 * `#E6E4DA` when there is no photo — §1.1's `surface/photo-placeholder`, which
 * is heavier than the feed's chip fill because it stands in for a photograph.
 * `ItemRow` in the offer flow makes the same call with the same token.
 */
export function Thumb({
  image,
  size,
  icon,
}: {
  image: string | null;
  size: number;
  /** A promise has no photo and is not a missing one. See `PromiseWell`. */
  icon?: React.ReactNode;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: offerRadius.thumbnail,
        backgroundColor: icon ? offerColor.quiet : offerColor.photoPlaceholder,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {image ? (
        <Image
          source={{ uri: image }}
          contentFit="cover"
          style={{ width: "100%", height: "100%" }}
          transition={120}
        />
      ) : (
        (icon ?? (
          <ImageIcon size={20} stroke={1.5} color={offerColor.inkDisabled} />
        ))
      )}
    </View>
  );
}

/**
 * The well a promise sits in, where a trade would show a photo.
 *
 * `#EDEBE3` rather than `#E6E4DA`: §1.1 calls the first "inert fills" and the
 * second "value blocks with no photo". A promise is not a photo that failed to
 * load, so the heavier placeholder would be a claim about a missing image. The
 * mark is terracotta — §1.4's job 2, a promise, at 1.5px of nothing — and the
 * well itself is never terracotta, because §1.4 says the accent is never a large
 * fill.
 */
export function PromiseWell({ size }: { size: number }) {
  return (
    <Thumb
      image={null}
      size={size}
      icon={
        <PromiseCaseIcon
          size={size === offerSize.tradeCard.thumb ? 20 : 19}
          stroke={offerIcon.inlineRow.stroke}
          color={offerColor.warm}
        />
      }
    />
  );
}

/* ──────────────────────── §4 the small controls ─────────────────────── */

/**
 * The 44px control that rides a card or a row. Radius 8, 14 of side padding.
 *
 * Four tones, and the rule between them is §6's own: the filled one is for the
 * card with somebody standing in front of you, and there is at most one of those
 * on screen. `Open code` is filled; `Withdraw`, `Ask for more time` and `Decline`
 * are outlined; `Accept` carries the 1.5px `#1B4D2B` selected rule that §1.5
 * reserves for a chosen thing, because frame 9c is explicit that accept and
 * decline sit at equal weight — accept is not the emphasised choice when someone
 * else's item is at stake.
 *
 * `quiet` is the fourth: a 1px `#E2E0D6` rule with `#1B4D2B` text. It is frame
 * 9c's `Read the agreement first`, and it sits below the decision pair on
 * purpose — opening a record is not a decision, and drawing it at a decision's
 * weight would put three equal-looking choices on a block that has two.
 *
 * 44 is §4's tap-target minimum and this control is exactly it. Not 40: the
 * offer pill in the feed is 40 because it rides a 44 row that supplies the slop,
 * and a card has no such row.
 */
export function RowAction({
  label,
  onPress,
  tone = "outline",
  fill,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  tone?: "filled" | "outline" | "affirm" | "quiet";
  /**
   * Stretch across the row rather than hugging the label.
   *
   * ONLY VALID INSIDE A `flexDirection: "row"` PARENT, and it has to be, because
   * it is `flex: 1` — which is `flexBasis: 0` on the parent's MAIN axis. In a row
   * that is the width, the explicit `height: 44` stays a real cross-axis size,
   * and two of these divide the row evenly. In a COLUMN the main axis is the
   * height: `flexBasis: 0` then overrides the 44, and inside an auto-height
   * parent there is no free space to grow into, so the control renders zero
   * pixels tall with its label clipped to nothing.
   *
   * Both single-button call sites therefore wrap it in a one-child row. That is
   * the fix rather than swapping in `alignSelf: "stretch"`, because the split
   * pair genuinely needs the even division `flex: 1` gives it.
   */
  fill?: boolean;
  accessibilityLabel?: string;
}) {
  const filled = tone === "filled";
  const affirm = tone === "affirm";
  const quiet = tone === "quiet";

  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={{
        height: offerSize.tapTarget,
        borderRadius: offerRadius.chip,
        paddingHorizontal: fill ? 0 : 14,
        alignItems: "center",
        justifyContent: "center",
        ...(fill ? { flex: 1 } : { flexShrink: 0 }),
        backgroundColor: filled ? offerColor.green : offerColor.paper,
        borderWidth: filled ? 0 : affirm ? offerBorder.selected : offerBorder.rule,
        borderColor: affirm
          ? offerColor.selected
          : quiet
            ? offerColor.rule
            : offerColor.strong,
      }}
      pressedStyle={filled ? { opacity: 0.85 } : { backgroundColor: offerColor.quiet }}
    >
      {/* §2's tertiary button role at 14. The filled one takes the PRIMARY
          button's family — 700 rather than 600 — which is the same step §4 makes
          between its own primary and secondary labels, at the smaller size a row
          control uses. Naming the face rather than setting `fontWeight` is the
          app's rule everywhere: asking Android for SemiBold at 700 synthesises a
          face instead of reaching for the Bold file. */}
      <Text
        style={[
          textStyle(offerType.buttonTertiary),
          {
            fontFamily: filled
              ? offerType.buttonPrimary.fontFamily
              : offerType.buttonTertiary.fontFamily,
            color: filled
              ? offerColor.onGreen
              : affirm || quiet
                ? offerColor.deep
                : offerColor.ink,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Tappable>
  );
}

/**
 * Frame 9c's decision pair: two flex:1 at 44, 8 apart, EQUAL WEIGHT.
 *
 * `Decline` first. Not a style choice — putting accept on the right keeps the
 * affirming control under the thumb that is already there, and putting decline
 * first means the eye reads the reversible option before the irreversible one.
 * §4's `Split buttons (accept/decline)` names the geometry and this is it at row
 * scale rather than the 52 the bottom bar uses.
 */
export function SplitActions({
  onDecline,
  onAccept,
  declineLabel,
  acceptLabel,
}: {
  onDecline: () => void;
  onAccept: () => void;
  declineLabel: string;
  acceptLabel: string;
}) {
  return (
    <View style={{ flexDirection: "row", gap: offerSize.button.splitGap }}>
      <RowAction label={declineLabel} onPress={onDecline} tone="outline" fill />
      <RowAction label={acceptLabel} onPress={onAccept} tone="affirm" fill />
    </View>
  );
}

/* ───────────────────── §3.5 the "Needs you today" card ──────────────── */

/**
 * §4's trade card: 88 minimum, 48 thumb, 12 gap, three text lines, radius 10,
 * 1px `#E2E0D6`.
 *
 * NO CONTAINER AROUND THE BLOCK. §4 says so: "label + n cards, 8px card gap, no
 * container fill or border". The cards carry the only rule, so the block reads
 * as a short list rather than as a panel — which matters because a panel would
 * make the empty case (§6: the whole block is absent) look like a panel that
 * failed to load.
 */
export function NeedsCard({
  thumb,
  title,
  subtitle,
  monoLines,
  action,
  onPress,
  compact,
}: {
  thumb: React.ReactNode;
  title: string;
  /** The 12px Public Sans line. A place, a swap, a sentence. */
  subtitle?: string | null;
  /**
   * The mono lines under it — one on a code card, two on a promise card.
   *
   * An ARRAY rather than `meta` and `meta2`, because the promise card's two are
   * a deadline and a settled figure and both are mono 11: naming them
   * separately would make the second look like a different kind of thing. §1.8
   * drives the first one's ink and nothing else — never a fill, never an icon.
   */
  monoLines?: readonly { text: string; ink?: string }[];
  /** A control, or a chevron when the whole card is the target. */
  action?: React.ReactNode;
  onPress?: () => void;
  /** §3.5's third card is 76, not 88 — two text lines instead of three. */
  compact?: boolean;
}) {
  const body = (
    <View
      style={{
        minHeight: compact ? CARD_COMPACT : offerSize.tradeCard.height,
        borderRadius: offerRadius.tile,
        borderWidth: offerBorder.rule,
        borderColor: offerColor.rule,
        backgroundColor: offerColor.paper,
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: offerSize.tradeCard.gap,
      }}
    >
      {thumb}

      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={[textStyle(offerType.itemTitleRow), { color: offerColor.ink }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[textStyle(offerType.rowSubtitle), { color: offerColor.inkSecondary }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
        {monoLines?.map((line) => (
          <Text
            key={line.text}
            style={[textStyle(offerType.deadline), { color: line.ink ?? offerColor.inkTertiary }]}
            numberOfLines={1}
          >
            {line.text}
          </Text>
        ))}
      </View>

      {action}
    </View>
  );

  // The card is the target only when it has no control of its own. A card with
  // both is two overlapping hit areas, and on Android the outer one wins often
  // enough to make the button feel broken.
  if (!onPress) return body;

  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, ...(monoLines ?? []).map((l) => l.text)]
        .filter(Boolean)
        .join(". ")}
      pressedStyle={{ opacity: 0.7 }}
    >
      {body}
    </Tappable>
  );
}

/** §3.5's third card. Two lines rather than three, so 12 shorter. */
const CARD_COMPACT = 76;

/** The chevron a whole-card target wears instead of a control. */
export function RowChevron() {
  return (
    <ChevronRightIcon
      size={offerSize.routeRow.chevron}
      stroke={offerIcon.chevron.stroke}
      color={offerColor.inkDisabled}
    />
  );
}

/* ──────────────────────── §3.5 the "Waiting" row ────────────────────── */

/**
 * §4's waiting row: 72 minimum, 44 thumb, 12 gap, two lines, right-aligned mono.
 *
 * FULL-BLEED HAIRLINES BETWEEN ROWS, drawn by the caller. §3.5's own note says
 * the rule is full bleed despite the text being inset — a divider that stops at
 * the text's left edge reads as a list nested inside something, and this list is
 * not nested inside anything.
 */
export function WaitingRow({
  thumb,
  title,
  subtitle,
  trailing,
  trailingInk,
  onPress,
  dim,
  children,
}: {
  thumb?: React.ReactNode;
  title: string;
  subtitle?: string | null;
  /** The right-hand mono: `2 days left`, `since 4 Sep`. */
  trailing?: string | null;
  trailingInk?: string;
  onPress?: () => void;
  /** Frame 9m's cached rows, which are shown as being possibly out of date. */
  dim?: boolean;
  /** Controls under the row — frame 9c's Withdraw line and decision pair. */
  children?: React.ReactNode;
}) {
  const body = (
    <View
      style={{
        minHeight: children ? undefined : offerSize.tradeRow.height,
        paddingHorizontal: offerSpace.screenX,
        paddingVertical: children ? 14 : 0,
        justifyContent: "center",
        gap: children ? 12 : 0,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: offerSize.tradeRow.gap }}>
        {thumb}
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text
            style={[
              textStyle(offerType.itemTitleRow),
              { color: dim ? offerColor.inkSecondary : offerColor.ink },
            ]}
            numberOfLines={2}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                textStyle(offerType.rowSubtitle),
                { color: dim ? offerColor.inkTertiary : offerColor.inkSecondary },
              ]}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing ? (
          <Text
            style={[
              textStyle(offerType.deadline),
              { color: trailingInk ?? offerColor.inkTertiary, flexShrink: 0 },
            ]}
          >
            {trailing}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );

  if (!onPress) return body;

  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, trailing].filter(Boolean).join(". ")}
      pressedStyle={{ backgroundColor: offerColor.quiet }}
    >
      {body}
    </Tappable>
  );
}

/* ─────────────────────── §6 the collapsed History ───────────────────── */

/**
 * §4's history row: 60, `#F5F4EE`, mono count right, 18 chevron.
 *
 * `#F5F4EE` is §1.1's `surface/sunk`, NOT the feed's `#F5F3EC` inset. They are
 * two ticks apart and the spec names both; `offer-tokens.ts` says at length why
 * it does not alias one to the other. The frame draws the feed's value and §1.1
 * is what is followed here, per the instruction that where the two disagree the
 * spec wins.
 */
export function HistoryCollapsedRow({
  title,
  count,
  onPress,
}: {
  title: string;
  count: string;
  onPress: () => void;
}) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${count}`}
      style={{
        minHeight: offerSize.historyRow.height,
        backgroundColor: offerColor.sunk,
        paddingHorizontal: offerSpace.screenX,
        flexDirection: "row",
        alignItems: "center",
        gap: offerSize.tradeRow.gap,
      }}
      pressedStyle={{ backgroundColor: offerColor.quiet }}
    >
      <Text style={[textStyle(offerType.itemTitleRow), { color: offerColor.ink, flex: 1 }]}>
        {title}
      </Text>
      <Text style={[textStyle(offerType.leavesRow), { color: offerColor.inkSecondary }]}>
        {count}
      </Text>
      <ChevronRightIcon
        size={offerSize.historyRow.chevron}
        stroke={offerIcon.chevron.stroke}
        color={offerColor.inkDisabled}
      />
    </Tappable>
  );
}

/**
 * One finished row inside the expanded History. 60 minimum, 11/16 padding.
 *
 * DELIBERATELY DULL, and the ink carries the whole of it: a completed trade is
 * `#14140F`, everything that ended some other way is `#5C5B52` with a `#8C8A7E`
 * mono under it. §1.7's last line — "Fulfilled agreements lose all accent
 * colour. Nothing congratulates." — is the rule this list is built on, and the
 * single exception is a default, which keeps its terracotta because it is a
 * permanent fact about the record.
 */
export function HistoryRow({
  title,
  meta,
  tone = "neutral",
}: {
  title: string;
  meta: string;
  tone?: "neutral" | "quiet" | "default";
}) {
  const defaulted = tone === "default";

  return (
    <View
      style={{
        minHeight: offerSize.historyRow.height,
        paddingHorizontal: offerSpace.screenX,
        paddingVertical: 11,
        justifyContent: "center",
        gap: 3,
        ...(defaulted
          ? {
              backgroundColor: offerColor.sunk,
              borderLeftWidth: offerBorder.dpaActiveRule,
              borderLeftColor: offerColor.warm,
              paddingLeft: offerSpace.screenX - offerBorder.dpaActiveRule,
            }
          : {}),
      }}
    >
      {/* Public Sans MEDIUM at 15, not SemiBold. §2 has no role for a settled
          row and the frames draw the lighter weight — a finished thing is read
          rather than scanned, and the whole list is meant to be quiet. The face
          is named (`font.sansMedium`) rather than reached for with a weight, per
          the rule in `tokens.js`. */}
      <Text
        style={[
          textStyle({ ...offerType.itemTitleRow, fontFamily: font.sansMedium }),
          { color: tone === "quiet" ? offerColor.inkSecondary : offerColor.ink },
        ]}
        numberOfLines={2}
      >
        {title}
      </Text>
      <Text
        style={[
          textStyle(offerType.deadline),
          {
            color: defaulted
              ? offerColor.warm
              : tone === "quiet"
                ? offerColor.inkTertiary
                : offerColor.inkSecondary,
          },
        ]}
      >
        {meta}
      </Text>
    </View>
  );
}

/* ───────────────────────── §1.7 the promise row ─────────────────────── */

/**
 * §1.7's six states in one row, and the six differ in three properties only.
 *
 *   Pending acceptance   a 1.5px `#C56A4B` outline round the row
 *   Active               the deadline's mono, coloured by §1.8 and nothing else
 *   Partially paid       a meter under the row, track `#F6EBE6`, fill `#C56A4B`
 *   Deadline near        §1.8's scale again — this is not a separate treatment
 *   Defaulted            row fill `#F5F4EE`, a 3px `#C56A4B` left rule
 *   Fulfilled            a hairline row, mono `settled 4 Oct`, NO accent at all
 *
 * NO FILL ANYWHERE EXCEPT THE DEFAULTED ROW'S `#F5F4EE`, and that one is a sunk
 * grey rather than a warm one. §1.4's rule for the whole system is "outline
 * warns, fill fails", and §1.4 reserves a filled terracotta for hard failures,
 * "which do not occur in these three areas".
 */
export function PromiseRow({
  title,
  meta,
  state,
  deadline,
  paid,
  total,
  action,
  onPress,
}: {
  title: string;
  meta: string;
  state: "pending" | "active" | "defaulted" | "fulfilled";
  /** Drives §1.8's mono ink. Omitted on a fulfilled row, which has no urgency. */
  deadline?: Date | null;
  paid?: number;
  total?: number;
  action?: React.ReactNode;
  onPress?: () => void;
}) {
  const fulfilled = state === "fulfilled";
  const defaulted = state === "defaulted";
  const pending = state === "pending";
  const showMeter = !fulfilled && typeof paid === "number" && typeof total === "number" && paid > 0;

  // §1.8: days remaining drive the MONO COLOUR ONLY. A fulfilled row has no
  // deadline left to be near, and a defaulted one is terracotta on its own
  // account rather than on the scale's.
  const metaInk = fulfilled
    ? offerColor.inkTertiary
    : defaulted
      ? offerColor.warm
      : deadline
        ? deadlineInk(daysLeft(deadline))
        : offerColor.inkTertiary;

  // A pending row is drawn as an outlined BLOCK inset by the gutter rather than
  // as a full-bleed band, so §1.4's "never as a large fill" holds at row scale.
  // Inside the block the side padding is the block's own 14, not the screen's 16.
  const padX = pending ? 14 : offerSpace.screenX;

  const body = (
    <View
      style={{
        minHeight: fulfilled ? offerSize.historyRow.height : offerSize.tradeRow.height,
        paddingHorizontal: padX,
        paddingVertical: fulfilled ? 11 : 13,
        justifyContent: "center",
        gap: showMeter ? 9 : 0,
        // §1.7's "Defaulted": a `#F5F4EE` fill and a solid 3px terracotta left
        // rule. The rule eats into the gutter rather than sitting outside it, so
        // the text stays on the 16 every other row's text is on.
        ...(defaulted
          ? {
              backgroundColor: offerColor.sunk,
              borderLeftWidth: offerBorder.dpaActiveRule,
              borderLeftColor: offerColor.warm,
              paddingLeft: padX - offerBorder.dpaActiveRule,
            }
          : {}),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: offerSize.tradeRow.gap }}>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text
            style={[
              // A fulfilled promise drops to Medium, like a History row and for
              // the same reason: §1.7's "Fulfilled agreements lose all accent
              // colour. Nothing congratulates."
              textStyle(
                fulfilled
                  ? { ...offerType.itemTitleRow, fontFamily: font.sansMedium }
                  : offerType.itemTitleRow,
              ),
              { color: fulfilled ? offerColor.inkSecondary : offerColor.ink },
            ]}
            numberOfLines={2}
          >
            {title}
          </Text>
          <Text style={[textStyle(offerType.deadline), { color: metaInk }]} numberOfLines={2}>
            {meta}
          </Text>
        </View>
        {action}
      </View>

      {showMeter ? <Meter paid={paid!} total={total!} /> : null}
    </View>
  );

  const wrapped = pending ? (
    // §1.7's "Pending acceptance": a 1.5px `#C56A4B` outline block, no fill.
    <View
      style={{
        marginHorizontal: offerSpace.screenX,
        marginVertical: 8,
        borderWidth: offerBorder.promise,
        borderColor: offerColor.promise,
        borderRadius: offerRadius.row,
      }}
    >
      {body}
    </View>
  ) : (
    body
  );

  if (!onPress) return wrapped;

  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${meta}`}
      pressedStyle={{ backgroundColor: offerColor.quiet }}
    >
      {wrapped}
    </Tappable>
  );
}

/** Local copy of §1.8's day count, so this file does not import the gap module. */
function daysLeft(deadline: Date, now: Date = new Date()): number {
  const a = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/**
 * §1.7's "Partially paid" meter. Track `#F6EBE6`, fill `#C56A4B`, radius 3.
 *
 * 6px tall — the frames' figure. §4 sizes the gap track at 14 and the Leaves
 * meter with it; a progress strip under a row is not that element and reads as a
 * second gap track at 14. The radius is `offerRadius.track`, which is the 3 §3.7
 * gives every meter.
 *
 * The fill never rounds up past what has actually been paid: a meter that shows
 * a full bar at 99% tells a debtor they are square when they are not.
 */
export function Meter({ paid, total }: { paid: number; total: number }) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, paid / total)) : 0;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: paid }}
      style={{
        height: 6,
        borderRadius: offerRadius.track,
        backgroundColor: offerColor.trackWarm,
        overflow: "hidden",
      }}
    >
      <View
        style={{ width: `${ratio * 100}%`, height: "100%", backgroundColor: offerColor.warm }}
      />
    </View>
  );
}

/* ──────────────────────── the promise notice strip ──────────────────── */

/**
 * Frame 9c's and 9i's warning strip: a 1.5px `#C56A4B` outline and a triangle.
 *
 * OUTLINE, NEVER FILL. §1.4's job 3 spells the rule out — outline warns, fill
 * fails — and an offer carrying a promise has not failed; it is an offer with
 * more in it than a swap, and the strip is what stops the creditor tapping
 * accept without knowing that.
 */
export function PromiseStrip({
  children,
  minHeight = 52,
  style,
}: {
  children: string;
  minHeight?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          minHeight,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: offerRadius.row,
          borderWidth: offerBorder.promise,
          borderColor: offerColor.promise,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        },
        style,
      ]}
    >
      <WarningTriangleIcon
        size={offerIcon.inlineRowSmall.size}
        stroke={offerIcon.warning.stroke}
        color={offerColor.warm}
      />
      <Text
        style={[
          textStyle({ ...offerType.itemTitleTile, lineHeight: 19 }),
          { color: offerColor.ink, flex: 1 },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}
