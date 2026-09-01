import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { hubItemCountLabel, useHubItems } from "../../api/hubs";
import type { SafeZoneHub } from "../../api/types";
import { ChevronRightIcon, CloseIcon, PinIcon } from "../icons";
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
        <View style={[s.iconWell, !hub.isActive && s.iconWellOff]}>
          <PinIcon
            size={icon.hubPin.size}
            stroke={icon.hubPin.stroke}
            color={hub.isActive ? color.forest : color.inkStale}
          />
        </View>

        <View style={s.headText}>
          <Text style={[textStyle(type.sheetTitle), s.name]} numberOfLines={2}>
            {hub.name}
          </Text>
          <Text style={[textStyle(type.hubLandmark), s.meta]} numberOfLines={1}>
            {`${hub.typeLabel} · ${hub.city}`}
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
        {hub.isActive ? hub.landmark : "No longer a Safe Zone — agree somewhere else"}
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
          accessibilityRole="button"
          accessibilityLabel={`Get directions to ${hub.name}`}
          style={s.directions}
          pressedStyle={s.directionsPressed}
        >
          <Text style={[textStyle(type.secondaryButton), { color: color.onGreen }]}>
            Get directions
          </Text>
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
            style={s.items}
            pressedStyle={s.itemsPressed}
          >
            {countLabel === null ? (
              <ActivityIndicator size="small" color={color.inkMuted} />
            ) : (
              <Text style={[textStyle(type.secondaryButton), s.itemsLabel]} numberOfLines={1}>
                {countLabel}
              </Text>
            )}
            <ChevronRightIcon
              size={icon.chevron.size}
              stroke={icon.chevron.stroke}
              color={color.inkSecondary}
            />
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
  iconWell: {
    width: size.detail.hubIcon,
    height: size.detail.hubIcon,
    borderRadius: size.detail.hubIcon / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.greenWash,
  },
  iconWellOff: { backgroundColor: color.control },
  headText: { flex: 1 },
  name: { color: color.ink },
  meta: { marginTop: space.detail.hubNameToLandmark, color: color.inkMuted },

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
    alignItems: "center",
    gap: space.sheet.actionGap,
  },
  directions: {
    flex: 1,
    height: size.sheet.action,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.primaryButton,
    backgroundColor: color.green,
  },
  directionsPressed: { backgroundColor: color.forest },

  items: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.card.socialGap,
    height: size.sheet.action,
    paddingHorizontal: space.browse.tileBody,
    borderRadius: radius.primaryButton,
    borderWidth: border.hairline,
    borderColor: color.controlLine,
    backgroundColor: color.control,
  },
  itemsPressed: { backgroundColor: color.controlLine },
  itemsLabel: { color: color.ink, flexShrink: 1 },
});
