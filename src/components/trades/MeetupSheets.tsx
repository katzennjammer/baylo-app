import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { getActingOrgId } from "../../api/org-context";
import { useTaskReward } from "../../api/profile";
import type { SafeZoneHub } from "../../api/types";
import { formatDistanceKm } from "../../lib/hub-distance";
import { groupHubs } from "../../lib/meetup-when";
import { Tappable } from "../Tappable";
import { LeafIcon } from "../icons";
import { SearchField } from "../marketplace/BrowseControls";
import { OfferSheet } from "../offer/OfferSheet";
import { InfoIcon } from "../post/post-icons";
import { CardLink } from "./TradeCard";
import { TradesSectionLabel } from "./chrome";
import * as copy from "./copy";
import { NoticeRow, TradeButton } from "./trade-ui";
import { color, radius, size, space, textStyle, type } from "../../theme/tokens";
import { offerBorder, offerColor, offerSpace, offerType } from "../../theme/offer-tokens";

/**
 * The meetup picker's two sheets and the pieces they share (Oct 2026).
 *
 * Both sit on `OfferSheet`, the shell `How trading works` and the Premium
 * paywall use, so they read as the same object. Nothing here calls the API
 * except the reward sheet's read of /api/v1/profile/me, which the app has
 * almost always cached already.
 */

/** The server's task key. The amount is read from profile/me, never written here. */
const SAFE_HUB_TASK = "SAFEZONE_MEETUP";

/* ───────────────────────────── reward chip ──────────────────────────── */

/**
 * "Safe hub reward (i)". The same green-wash chip the hub rows always wore,
 * now tappable: it opens the reward sheet. The visible chip is small; the hit
 * area is padded out to 44.
 */
export function RewardChip({ onPress }: { onPress: () => void }) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={copy.picker.rewardInfoLabel}
      hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }}
      style={[s.smallChip, { backgroundColor: color.greenWash }]}
      pressedStyle={{ opacity: 0.75 }}
    >
      <LeafIcon size={12} stroke={1.8} color={color.forest} />
      <Text
        style={[textStyle(type.chip), { color: color.forest }]}
        maxFontSizeMultiplier={size.home.headingMaxFontScale}
      >
        {copy.picker.rewardChip}
      </Text>
      <InfoIcon size={13} stroke={1.7} color={color.forest} />
    </Tappable>
  );
}

/* ───────────────────────────── reward sheet ─────────────────────────── */

/**
 * What the safe hub reward is. The amount comes from the viewer's task list on
 * /api/v1/profile/me; while that loads, or if it failed, the sentence simply
 * has no number. Acting as a shop, the sheet still opens — the person on the
 * other side can earn it — and says plainly that the shop does not.
 */
export function SafeHubRewardSheet({ onClose }: { onClose: () => void }) {
  const amount = useTaskReward(SAFE_HUB_TASK);
  const actingAsShop = !!getActingOrgId();
  const p = offerSpace.prompt;

  return (
    <OfferSheet dismissible onDismiss={onClose} swipeToDismiss>
      <View style={{ paddingHorizontal: p.x, paddingTop: p.handleToHeading, gap: p.headingToBody }}>
        <Text style={[textStyle(offerType.sheetHeading), { color: offerColor.ink }]} accessibilityRole="header">
          {copy.picker.rewardTitle}
        </Text>
        <Text style={[textStyle(offerType.bodyDense), { color: offerColor.ink }]}>
          {copy.picker.rewardBody(amount)}
        </Text>
        {actingAsShop ? (
          <Text style={[textStyle(offerType.bodyDense), { color: offerColor.ink }]}>{copy.picker.rewardShop}</Text>
        ) : null}
        <Text style={[textStyle(offerType.helper), { color: offerColor.inkTertiary }]}>
          {copy.picker.rewardSmallPrint}
        </Text>
        <TradeButton label={copy.picker.gotIt} onPress={onClose} style={{ marginTop: p.listToButton - p.headingToBody }} />
      </View>
    </OfferSheet>
  );
}

/* ─────────────────────────────── hub row ────────────────────────────── */

/**
 * One hub: name, then "Type · Area · 1.2 km", then its chips. Selected is a
 * 1.5 forest rule and a filled radio — nothing else moves.
 */
export function HubRow({
  hub,
  selected,
  reward,
  suggestedBy,
  km,
  onPress,
  onReward,
}: {
  hub: SafeZoneHub;
  selected: boolean;
  reward: boolean;
  suggestedBy: string | null;
  km: number | null;
  onPress: () => void;
  onReward: () => void;
}) {
  const meta = hubMeta(hub, km);

  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={[
        hub.name,
        meta,
        reward ? copy.picker.rewardChip : null,
        suggestedBy ? copy.picker.suggestedChip(suggestedBy) : null,
      ]
        .filter(Boolean)
        .join(", ")}
      style={[
        s.row,
        selected
          ? { borderWidth: offerBorder.selected, borderColor: color.forest }
          : { borderWidth: offerBorder.rule, borderColor: color.controlLine },
      ]}
      pressedStyle={{ backgroundColor: color.inset }}
    >
      <View style={[s.radio, selected ? s.radioOn : null]}>
        {selected ? <View style={s.radioDot} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[textStyle(type.username), { color: color.ink }]} numberOfLines={2}>
          {hub.name}
        </Text>
        <Text style={[textStyle(type.metadata), { color: color.inkSecondary }]} numberOfLines={2}>
          {meta}
        </Text>
        {reward || suggestedBy ? (
          <View style={s.rowChips}>
            {reward ? <RewardChip onPress={onReward} /> : null}
            {suggestedBy ? <SuggestedChip partner={suggestedBy} /> : null}
          </View>
        ) : null}
      </View>
    </Tappable>
  );
}

export function SuggestedChip({ partner }: { partner: string }) {
  return (
    <View style={[s.smallChip, { backgroundColor: color.control }]}>
      <Text
        style={[textStyle(type.chip), { color: color.inkSecondary }]}
        maxFontSizeMultiplier={size.home.headingMaxFontScale}
      >
        {copy.picker.suggestedChip(partner)}
      </Text>
    </View>
  );
}

/** "Mall · Cebu City · 1.2 km" — the line under a hub's name everywhere. */
export function hubMeta(hub: SafeZoneHub, km: number | null): string {
  return [hub.typeLabel, hub.city, km !== null ? formatDistanceKm(km) : null].filter(Boolean).join(" · ");
}

/* ────────────────────────────── hub sheet ───────────────────────────── */

/**
 * Every proposable hub, searchable: the partner's suggestion and the shared
 * hubs pinned first, then the rest by city. Picking one closes the sheet. The
 * "no hub in common" notice and its route to /edit-hubs live here, above the
 * list, as they did above the old inline list.
 */
export function HubPickerSheet({
  hubs,
  shared,
  suggestedId,
  partner,
  selectedId,
  kmTo,
  showNoShared,
  onAddHub,
  onPick,
  onReward,
  onClose,
}: {
  hubs: readonly SafeZoneHub[];
  shared: ReadonlySet<string>;
  suggestedId: string | null;
  partner: string;
  selectedId: string | null;
  /** Null when the phone does not already know where it is. */
  kmTo: ((hub: SafeZoneHub) => number) | null;
  showNoShared: boolean;
  onAddHub: () => void;
  onPick: (hubId: string) => void;
  onReward: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const { height: windowHeight } = useWindowDimensions();
  const p = offerSpace.prompt;
  const height = Math.min(p.height, Math.round(windowHeight * 0.88));

  const groups = useMemo(
    () => groupHubs({ hubs, shared, suggestedId, km: kmTo, query }),
    [hubs, shared, suggestedId, kmTo, query],
  );

  return (
    <OfferSheet dismissible onDismiss={onClose} height={height} swipeToDismiss>
      <View style={{ flex: 1, paddingTop: p.handleToHeading }}>
        <View style={{ paddingHorizontal: p.x, gap: p.bodyToExamples }}>
          <Text style={[textStyle(offerType.sheetHeading), { color: offerColor.ink }]} accessibilityRole="header">
            {copy.picker.sheetTitle}
          </Text>
          <View style={{ flexDirection: "row" }}>
            <SearchField
              value={query}
              onChange={setQuery}
              onSubmit={() => {}}
              placeholder={copy.picker.searchPlaceholder}
              accessibilityLabel={copy.picker.searchLabel}
            />
          </View>
        </View>

        <ScrollView
          style={{ flex: 1, marginTop: p.bodyToExamples }}
          contentContainerStyle={{ paddingHorizontal: p.x, paddingBottom: p.listToButton, gap: space.browse.searchGap }}
          keyboardShouldPersistTaps="handled"
        >
          {showNoShared && !query ? (
            <NoticeRow
              icon={<InfoIcon size={16} stroke={1.7} color={color.inkSecondary} />}
              link={<CardLink label={copy.picker.addHub} onPress={onAddHub} />}
            >
              {copy.picker.noShared}
            </NoticeRow>
          ) : null}

          {groups.length === 0 ? (
            <Text style={[textStyle(type.detailBody), { color: color.inkSecondary, paddingTop: 4 }]}>
              {copy.picker.noMatch(query.trim())}
            </Text>
          ) : null}

          {groups.map((g) => (
            <View key={g.kind === "city" ? `city:${g.city}` : g.kind} style={{ gap: space.browse.searchGap }}>
              <View style={{ paddingTop: 6 }}>
                <TradesSectionLabel>
                  {g.kind === "suggested"
                    ? copy.picker.groupSuggested(partner)
                    : g.kind === "shared"
                      ? copy.picker.groupShared
                      : g.city}
                </TradesSectionLabel>
              </View>
              {g.hubs.map((hub) => (
                <HubRow
                  key={hub.id}
                  hub={hub}
                  selected={hub.id === selectedId}
                  reward={shared.has(hub.id)}
                  suggestedBy={hub.id === suggestedId ? partner : null}
                  km={kmTo ? kmTo(hub) : null}
                  onPress={() => onPick(hub.id)}
                  onReward={onReward}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </OfferSheet>
  );
}

const RADIO = 20;

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.home.tileBody,
    padding: space.home.tileBody,
    borderRadius: radius.hubRow,
    backgroundColor: color.surface,
  },
  radio: {
    width: RADIO,
    height: RADIO,
    borderRadius: RADIO / 2,
    borderWidth: 1.5,
    borderColor: color.controlLineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: color.forest },
  radioDot: { width: RADIO / 2, height: RADIO / 2, borderRadius: RADIO / 4, backgroundColor: color.forest },
  rowChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  smallChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: space.chip.x,
    paddingVertical: space.chip.y - 3,
    borderRadius: radius.chip,
  },
});
