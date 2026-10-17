import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { hubItemCountLabel, useHubItems } from "../../api/hubs";
import type { SafeZoneHub } from "../../api/types";
import { ArrowUpRightIcon, ChevronRightIcon, CloseIcon } from "../icons";
import { HubTypeGlyph } from "./MapLegend";
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
import { openDirections } from "./directions";

/**
 * The card that slides up when a pin is tapped.
 *
 * ── NOT A `Modal`, UNLIKE FilterSheet ───────────────────────────────────────
 *
 * The filter sheet is modal because it is a task: you are editing a draft and
 * nothing behind it matters until you Apply. This one is the opposite. It is a
 * READOUT of something on the map behind it, and the map behind it is still the
 * subject — tapping another pin should move the card, not require dismissing it
 * first. A `Modal` puts a scrim over the map and swallows exactly those taps.
 *
 * So it is an absolutely-positioned sibling of the map, the map stays live
 * underneath, and dismissal is either the × or a tap on open map (which the
 * document reports as a `background` message).
 *
 * ── THE COUNT IS FETCHED HERE, WHEN THE SHEET OPENS ─────────────────────────
 *
 * Not with the hub list. GET /api/v1/hubs returns no count, and the reason not
 * to add one is in api/hubs.ts: a `_count` over the join table includes traded,
 * taken-down and blocked listings, so it would disagree with the screen this
 * card links into. Loading the first page of the real query gives a number that
 * cannot drift from the destination — and warms the cache for it, so tapping
 * "listings" lands on a screen that is already populated.
 *
 * ── LOOK (Oct 2026) ─────────────────────────────────────────────────────────
 *
 * No glyph in a mint circle and no filled buttons: a small type label with
 * the type glyph ("Mall · Lapu-Lapu City") over the name, the meeting note,
 * then two outlined pills -- "Directions ↗" (forest) and "7 listings ›"
 * (neutral) -- the same pills the listing and hub screens use.
 */

export interface HubSheetProps {
  hub: SafeZoneHub;
  onClose: () => void;
  /** Opens the hub's own screen. Omitted where there is nowhere to go. */
  onOpenItems?: (hubId: string) => void;
}

export function HubSheet({ hub, onClose, onOpenItems }: HubSheetProps) {
  const { items, hasNextPage, isPending, isError } = useHubItems(hub.id);

  const countLabel = isPending
    ? null
    : isError
      ? "Listings unavailable"
      : hubItemCountLabel(items.length, !!hasNextPage);

  return (
    <View style={s.sheet}>
      <View style={s.head}>
        <View style={s.headText}>
          <View style={s.eyebrow}>
            <HubTypeGlyph
              hubType={hub.type}
              size={icon.check.size}
              tint={hub.isActive ? color.forest : color.inkStale}
            />
            <Text style={[textStyle(type.gridMeta), s.eyebrowText]} numberOfLines={1}>
              {`${hub.typeLabel} · ${hub.city}`}
            </Text>
          </View>
          <Text
            style={[textStyle(type.sheetTitle), s.name, !hub.isActive && s.nameOff]}
            numberOfLines={2}
          >
            {hub.name}
          </Text>
        </View>

        <Tappable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={s.close}
          pressedStyle={s.closePressed}
        >
          <CloseIcon size={icon.clear.size} stroke={icon.clear.stroke} color={color.inkSecondary} />
        </Tappable>
      </View>

      {/* THE LANDMARK IS THE POINT OF THE WHOLE CARD. A pin gets two people to
          the same building; this sentence gets them to the same spot inside it,
          and a mall has six entrances. It is never truncated. */}
      <Text style={[textStyle(type.hubLandmark), s.landmark]}>
        {hub.isActive ? hub.landmark : "No longer a safe hub — agree somewhere else"}
      </Text>

      <View style={s.actions}>
        <Tappable
          onPress={() => {
            void openDirections({
              latitude: hub.latitude,
              longitude: hub.longitude,
              name: hub.name,
            });
          }}
          accessibilityRole="link"
          accessibilityLabel={`Directions to ${hub.name}`}
          style={[s.pill, s.pillForest]}
          pressedStyle={s.pillPressed}
        >
          <Text style={[textStyle(type.chip), s.pillLabel, { color: color.forest }]}>Directions</Text>
          <ArrowUpRightIcon size={icon.check.size} stroke={icon.check.stroke} color={color.forest} />
        </Tappable>

        {onOpenItems ? (
          <Tappable
            onPress={() => onOpenItems(hub.id)}
            // Disabled while the count is unknown rather than hidden: a control
            // that appears once its label resolves makes the card jump under a
            // finger already on its way down.
            disabled={isPending}
            accessibilityRole="button"
            accessibilityState={{ disabled: isPending }}
            accessibilityLabel={
              countLabel ? `${countLabel} at ${hub.name}` : `Listings at ${hub.name}`
            }
            style={[s.pill, s.pillNeutral]}
            pressedStyle={s.pillPressed}
          >
            {countLabel === null ? (
              <ActivityIndicator size="small" color={color.inkMuted} />
            ) : (
              <Text style={[textStyle(type.chip), s.pillLabel, { color: color.ink }]} numberOfLines={1}>
                {countLabel}
              </Text>
            )}
            <ChevronRightIcon size={icon.check.size} stroke={icon.check.stroke} color={color.inkSecondary} />
          </Tappable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: space.screenXTight,
    right: space.screenXTight,
    bottom: space.screenXTight,
    paddingHorizontal: space.browse.tileBody + 4,
    paddingTop: space.card.top,
    paddingBottom: space.browse.tileBody + 4,
    borderRadius: radius.sheet,
    backgroundColor: color.surface,
    borderWidth: border.hairline,
    borderColor: color.controlLine,
    // The one raised thing on this screen, and it has to be: it sits over a map
    // whose colours we do not control, so a hairline alone would not always
    // separate it from what is underneath.
    shadowColor: "#14140F",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  head: { flexDirection: "row", alignItems: "flex-start", gap: space.detail.hubIconToText },
  headText: { flex: 1 },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 5 },
  eyebrowText: { flexShrink: 1, color: color.inkSecondary },
  name: { marginTop: space.detail.hubNameToLandmark, color: color.ink },
  nameOff: { color: color.inkStale, textDecorationLine: "line-through" },

  close: {
    width: size.control.headerIconTight,
    height: size.control.headerIconTight,
    alignItems: "center",
    justifyContent: "center",
    // Pulled into the card's padding so the glyph sits on the optical edge
    // while the target keeps its full size.
    marginTop: -space.card.top + 4,
    marginRight: -(space.browse.tileBody + 4) + 4,
    borderRadius: size.control.headerIconTight / 2,
  },
  closePressed: { backgroundColor: color.control },

  landmark: {
    marginTop: space.detail.headingToBody,
    color: color.inkSecondary,
  },

  actions: {
    marginTop: space.detail.sectionY - 4,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.browse.chipGap,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
    minHeight: size.browse.chip,
    paddingHorizontal: size.browse.chipX,
    borderRadius: radius.trendingChip,
    borderWidth: border.chip,
  },
  pillForest: { borderColor: color.forest },
  pillNeutral: { borderColor: color.controlLineStrong },
  pillPressed: { opacity: 0.7 },
  pillLabel: { flexShrink: 1 },
});
