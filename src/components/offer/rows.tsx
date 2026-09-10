import { Image } from "expo-image";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";

import { CheckIcon, ChevronRightIcon, ImageIcon, PinIcon } from "../icons";
import { LockIcon } from "./icons";
import { Tappable } from "../Tappable";
import { useOfferBoard } from "./chrome";
import {
  offerBorder,
  offerColor,
  offerIcon,
  offerRadius,
  offerSize,
  offerSpace,
  offerType,
  textStyle,
} from "../../theme/offer-tokens";

/**
 * Every row the offer flow draws.
 *
 * ── ONE RULE RUNS THROUGH ALL OF THEM ───────────────────────────────────────
 *
 * §1.6's line about tiers — "typographic, not coloured" — generalises: nothing
 * in this flow signals state with a fill. A selected row is a 1.5px `#1B4D2B`
 * border over a `#F2F8F3` tint; a disabled one is a `#F5F4EE` fill with a
 * dashed edge; a promise is a 1.5px `#C56A4B` OUTLINE and never a terracotta
 * block. §1.4's rule for the whole system is "outline warns, fill fails", and a
 * filled warm panel is reserved for hard failures, which do not occur here.
 */

/* ─────────────────────────── the radio ──────────────────────────────── */

/**
 * §4's 20px radio (22 in the picker sheet), as a ring and a check.
 *
 * A CHECK RATHER THAN A DOT. §4 gives the mark its own line in the icon table —
 * "radio check, 12–13px, stroke 2.6–2.8" — which a filled dot would not need,
 * and the heavy stroke is what makes a 13px mark legible inside a 20px ring at
 * the flow's low contrast.
 */
export function Radio({ selected, size = offerSize.settleRow.radio }: { selected: boolean; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: selected ? 0 : offerBorder.strong,
        borderColor: offerColor.strong,
        backgroundColor: selected ? offerColor.deep : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {selected ? (
        <CheckIcon
          size={offerIcon.radioCheck.size}
          stroke={offerIcon.radioCheck.stroke}
          color={offerColor.paper}
        />
      ) : null}
    </View>
  );
}

/* ────────────────────── §4 the settlement row ───────────────────────── */

export interface SettlementRowProps {
  title: string;
  subtitle?: string | null;
  selected: boolean;
  onPress: () => void;
  /**
   * §5.2's "Not ID-verified": fill `#F5F4EE`, 1px DASHED `#D8D6CC`, a lock in
   * `#A8A69A`, and both lines at `#8C8A7E`. It is not a `disabled` Pressable —
   * the row still announces itself and still says why, it simply does not
   * select.
   */
  locked?: boolean;
  /** §1.7's pending-acceptance marker: a 1.5px `#C56A4B` outline on the row. */
  promise?: boolean;
}

/**
 * One choice in `Settle the 40`, `The difference` or a DPA route list.
 *
 * min-height 60, 14 of side padding, a 20px radio and a 12 gap. MIN-height, not
 * height: §10.2's subtitles run to "Deferred Points Agreement for the rest."
 * and a fixed 60 would clip the second line on the 360 board.
 */
export function SettlementRow({
  title,
  subtitle,
  selected,
  onPress,
  locked = false,
  promise = false,
}: SettlementRowProps) {
  const border = locked
    ? { borderWidth: offerBorder.strong, borderColor: offerColor.strong, borderStyle: "dashed" as const }
    : selected
      ? { borderWidth: offerBorder.selected, borderColor: offerColor.selected }
      : promise
        ? { borderWidth: offerBorder.promise, borderColor: offerColor.promise }
        : { borderWidth: offerBorder.rule, borderColor: offerColor.rule };

  const fill = locked
    ? offerColor.sunk
    : selected
      ? offerColor.tintGreen
      : offerColor.paper;

  const ink = locked ? offerColor.inkTertiary : offerColor.ink;
  const subInk = locked ? offerColor.inkTertiary : offerColor.inkSecondary;

  return (
    <Tappable
      onPress={locked ? undefined : onPress}
      disabled={locked}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: locked }}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={{
        minHeight: offerSize.settleRow.minHeight,
        borderRadius: offerRadius.row,
        paddingHorizontal: offerSize.settleRow.padX,
        // The 60 is a MIN and the padding is what keeps a one-line row on it:
        // 60 − 2×14 leaves 32 for a 19px line, which centres it.
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: offerSize.settleRow.gap,
        backgroundColor: fill,
        ...border,
      }}
      pressedStyle={locked ? undefined : { backgroundColor: offerColor.quiet }}
    >
      {locked ? (
        <View style={{ width: offerSize.settleRow.radio, alignItems: "center" }}>
          <LockIcon
            size={offerIcon.lock.size}
            stroke={offerIcon.lock.stroke}
            color={offerColor.inkDisabled}
          />
        </View>
      ) : (
        <Radio selected={selected} />
      )}

      <View style={{ flex: 1 }}>
        <Text style={[textStyle(offerType.itemTitleRow), { color: ink }]}>{title}</Text>
        {subtitle ? (
          <Text style={[textStyle(offerType.rowSubtitle), { color: subInk, marginTop: 2 }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Tappable>
  );
}

/* ────────────────────────── §4 the route row ────────────────────────── */

/**
 * A row in `What works instead` (§10.2) or `Where you stand` (§10.8).
 *
 * ── ROUTES ARE ROWS, NOT BUTTONS ────────────────────────────────────────────
 *
 * §7.3 says so outright, and it is the point of the treatment: a route is
 * information about what would work, not a control that does it. The primary
 * button in the bar stays green and live either way.
 *
 * ── THE CHEVRON IS CONDITIONAL, AND §4 IS NOT ───────────────────────────────
 *
 * §4 gives the route row an 18px chevron unconditionally. Three of the five
 * routes in this spec have nowhere to go — `Watch this listing` has no endpoint
 * (there is no saved/watched model on the server at all), and both out-of-reach
 * routes are explanations — so a chevron on those would promise a destination
 * that does not exist. `onPress` decides: a row with a handler gets the
 * chevron and reads as a button to a screen reader; a row without gets neither
 * and reads as text. This is the one place the component departs from §4, and
 * it departs toward the spec's own "no dead affordance" instinct.
 */
export function RouteRow({
  icon,
  title,
  subtitle,
  onPress,
  minHeight = offerSize.routeRow.minHeight,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress?: () => void;
  /** 60 in the offer flow, 64 in the out-of-reach insert. §4 gives both. */
  minHeight?: number;
}) {
  const body = (
    <>
      <View style={{ width: offerSize.routeRow.icon, alignItems: "center" }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[textStyle(offerType.itemTitleRow), { color: offerColor.ink }]}>{title}</Text>
        <Text
          style={[textStyle(offerType.rowSubtitle), { color: offerColor.inkSecondary, marginTop: 3 }]}
        >
          {subtitle}
        </Text>
      </View>
      {onPress ? (
        <ChevronRightIcon
          size={offerSize.routeRow.chevron}
          stroke={offerIcon.chevron.stroke}
          color={offerColor.inkDisabled}
        />
      ) : null}
    </>
  );

  const style: StyleProp<ViewStyle> = {
    minHeight,
    borderRadius: offerRadius.row,
    borderWidth: offerBorder.rule,
    borderColor: offerColor.rule,
    paddingHorizontal: offerSize.settleRow.padX,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: offerSize.routeRow.gap,
    backgroundColor: offerColor.paper,
  };

  if (!onPress) {
    return (
      <View style={style} accessibilityLabel={`${title}. ${subtitle}`}>
        {body}
      </View>
    );
  }

  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      style={style}
      pressedStyle={{ backgroundColor: offerColor.quiet }}
    >
      {body}
    </Tappable>
  );
}

/* ───────────────────────── §4 the item row ─────────────────────────── */

/**
 * A 52–56px thumbnail with a title/mono stack beside it.
 *
 * Used three times with different trailing content: the listing header (no
 * trailing), `You're offering` (a `Change` link), and §10.5's `What you sent`
 * summary (a mono figure). The photo is `#E6E4DA` when there is none — §1.1's
 * `surface/photo-placeholder`, which is heavier than the feed's `control`
 * because it stands in for a photograph rather than dressing a chip.
 */
export function ItemRow({
  image,
  title,
  meta,
  trailing,
  photoSize,
}: {
  image: string | null;
  title: string;
  /** The mono line under the title — a value, a condition, a tier. */
  meta: string;
  trailing?: React.ReactNode;
  photoSize?: number;
}) {
  const board = useOfferBoard();
  const side = photoSize ?? board.itemPhoto;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: offerSize.itemRow.gap }}>
      <View
        style={{
          width: side,
          height: side,
          borderRadius: offerRadius.thumbnail,
          backgroundColor: offerColor.photoPlaceholder,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {image ? (
          <Image source={{ uri: image }} contentFit="cover" style={{ width: "100%", height: "100%" }} transition={120} />
        ) : (
          <ImageIcon size={20} stroke={1.5} color={offerColor.inkDisabled} />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[textStyle(offerType.itemTitleRow), { color: offerColor.ink }]} numberOfLines={2}>
          {title}
        </Text>
        <Text
          style={[textStyle(offerType.leavesRow), { color: offerColor.inkSecondary, marginTop: 4 }]}
        >
          {meta}
        </Text>
      </View>

      {trailing}
    </View>
  );
}

/** §10.1's `Change` on the offering row. 14 of left and vertical padding. */
export function ChangeLink({ onPress }: { onPress: () => void }) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Change the item you are offering"
      style={{
        paddingLeft: offerSize.itemRow.changeX,
        paddingVertical: offerSize.itemRow.changeY,
        // The 44 target is met by the padding plus the label's own line, and
        // the row it sits in is 56 tall, so there is no risk of a short target.
        justifyContent: "center",
      }}
      pressedStyle={{ opacity: 0.6 }}
    >
      <Text style={[textStyle(offerType.buttonTertiary), { color: offerColor.deep }]}>Change</Text>
    </Tappable>
  );
}

/* ──────────────────────────── §4 the hub row ────────────────────────── */

/**
 * `Where you'll meet` — one Safe Zone, selectable.
 *
 * Same selected treatment as a settlement row: 1.5px `#1B4D2B` over `#F2F8F3`.
 * §10.1 fixes the subtitle at `Safe-Zone Hub` rather than the hub's own type
 * label, and that is followed — the point of the line is that it is a Safe
 * Zone, not that it is a mall.
 *
 * An INACTIVE hub is struck through rather than filtered out, which is the rule
 * `src/api/types.ts` states for `isActive`: the association survives
 * deactivation so a listing does not silently lose the only answer it had to
 * "where would we meet?".
 */
export function HubRow({
  name,
  active,
  selected,
  onPress,
}: {
  name: string;
  active: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={active ? `${name}, Safe-Zone Hub` : `${name}, no longer a Safe Zone`}
      style={{
        minHeight: offerSize.settleRow.minHeight,
        borderRadius: offerRadius.row,
        borderWidth: selected ? offerBorder.selected : offerBorder.rule,
        borderColor: selected ? offerColor.selected : offerColor.rule,
        backgroundColor: selected ? offerColor.tintGreen : offerColor.paper,
        paddingHorizontal: offerSize.settleRow.padX,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: offerSize.settleRow.gap,
      }}
      pressedStyle={{ backgroundColor: offerColor.quiet }}
    >
      <PinIcon
        size={offerIcon.inlineRowSmall.size}
        stroke={offerIcon.inlineRowSmall.stroke}
        color={selected ? offerColor.deep : offerColor.inkTertiary}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={[
            textStyle(offerType.itemTitleRow),
            {
              color: offerColor.ink,
              textDecorationLine: active ? "none" : "line-through",
            },
          ]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          style={[textStyle(offerType.rowSubtitle), { color: offerColor.inkSecondary, marginTop: 2 }]}
        >
          Safe-Zone Hub
        </Text>
      </View>
      <Radio selected={selected} />
    </Tappable>
  );
}

/* ──────────────────────── §4 the record table ───────────────────────── */

/**
 * §3.4's and §10.4's record rows: a 15px label, a mono figure, a hairline
 * between, 10–11 of vertical padding.
 *
 * `tone` exists for §1.4's fourth warm job — "mono values that are a debt or a
 * default". `Past defaults` reading `1, settled late` is the case it was
 * written for; a `Trades completed` of 14 is not, and passing `warm` there
 * would be the misuse the single hex is most prone to.
 */
export function RecordRow({
  label,
  value,
  tone = "neutral",
  first = false,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warm";
  /** No hairline above the first row — the section label is already there. */
  first?: boolean;
}) {
  return (
    <View
      style={{
        borderTopWidth: first ? 0 : offerBorder.hairline,
        borderTopColor: offerColor.hairline,
        paddingVertical: offerSpace.dpa.recordRowY,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary, flexShrink: 1 }]}>
        {label}
      </Text>
      <Text
        style={[
          textStyle(offerType.tableFigure),
          { color: tone === "warm" ? offerColor.warm : offerColor.ink },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/* ───────────────────── §5.2 / §10.5 the numbered steps ──────────────── */

/**
 * `01` / `02` / `03` — the mono ordinal beside a sentence.
 *
 * Zero-padded because §10.5 and §10.8 both write them that way, and the padding
 * is what keeps the sentences left-aligned with each other without a fixed
 * column width doing it.
 */
export function NumberedStep({ n, children }: { n: number; children: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}>
        {String(n).padStart(2, "0")}
      </Text>
      <Text style={[textStyle(offerType.bodyDense), { color: offerColor.inkSecondary, flex: 1 }]}>
        {children}
      </Text>
    </View>
  );
}
