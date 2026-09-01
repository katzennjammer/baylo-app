import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { ApiError } from "../../src/api/client";
import { Splash } from "../../src/components/Splash";
import { useHubs } from "../../src/api/hubs";
import { useItem } from "../../src/api/item";
import type { SafeZoneHub } from "../../src/api/types";
import { ChevronLeftIcon } from "../../src/components/icons";
import { HubMap } from "../../src/components/map/HubMap";
import { MapErrorBoundary } from "../../src/components/map/MapErrorBoundary";
import { HubSheet } from "../../src/components/map/HubSheet";
import { MapLegend } from "../../src/components/map/MapLegend";
import { BrowseError } from "../../src/components/marketplace/BrowseStates";
import { Tappable } from "../../src/components/Tappable";
import {
  color,
  icon,
  size,
  space,
  textStyle,
  type,
} from "../../src/theme/tokens";

/**
 * The full-screen Safe-Zone map.
 *
 * TWO WAYS IN, and they differ only in which hubs get pinned:
 *
 *   /hubs                every ACTIVE hub, from GET /api/v1/hubs. The
 *                        marketplace's map view.
 *   /hubs?itemId=…       the hubs on ONE listing, read out of the item detail
 *                        cache. Reached by tapping the preview map on item
 *                        detail.
 *
 * `?focus=<hubId>` opens centred on one pin with its sheet up, in either mode.
 *
 * ── THE ITEM MODE ISSUES NO REQUEST ─────────────────────────────────────────
 *
 * `useItem` here is a cache read, not a fetch. The only route that reaches this
 * screen with an `itemId` is item detail, which has already loaded that exact
 * query — so the hubs are in hand the moment this mounts and the map draws on
 * the first frame. Passing the hub list through navigation params instead would
 * mean serialising it into a URL, and it would go stale the moment the item was
 * refetched behind this screen.
 *
 * If somebody deep-links straight here with an itemId, the query runs for real
 * and the pending state below covers it. That path is not the design, but it
 * costs one `if` to be correct rather than broken.
 */
export default function HubsMapScreen() {
  const router = useRouter();
  const { itemId, focus } = useLocalSearchParams<{ itemId?: string; focus?: string }>();

  const all = useHubs();
  const item = useItem(itemId);

  /** Selection is owned here: both the map and the sheet read it. */
  const [selectedId, setSelectedId] = useState<string | null>(focus ?? null);

  const scoped = !!itemId;

  const hubs: SafeZoneHub[] = useMemo(() => {
    if (scoped) return item.data?.item.safeZones ?? [];
    return all.data?.hubs ?? [];
  }, [scoped, item.data, all.data]);

  const isPending = scoped ? item.isPending : all.isPending;
  const isError = scoped ? item.isError : all.isError;
  const error = scoped ? item.error : all.error;
  const refetch = scoped ? item.refetch : all.refetch;

  const selected = hubs.find((h) => h.id === selectedId) ?? null;

  const apiError = error instanceof ApiError ? error : null;
  // Same rule as every other screen: a 401 means the interceptor has already
  // cleared the session and the group guard is about to swap in login.
  if (isError && apiError?.code === "UNAUTHENTICATED") {
    return <Splash waitingOn="Signing you back in" />;
  }

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Tappable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={s.back}
          pressedStyle={s.backPressed}
        >
          <ChevronLeftIcon size={icon.back.size} stroke={icon.back.stroke} color={color.ink} />
        </Tappable>

        <View style={s.headerText}>
          <Text style={[textStyle(type.sheetTitle), s.title]} numberOfLines={1}>
            Safe Zones
          </Text>
          <Text style={[textStyle(type.hubLandmark), s.subtitle]} numberOfLines={1}>
            {scoped
              ? "Where this listing can be handed over"
              : "Public places to meet in Metro Cebu"}
          </Text>
        </View>
      </View>

      <View style={s.legend}>
        <MapLegend />
      </View>

      <View style={s.mapWrap}>
        {isPending ? (
          <View style={s.centre}>
            <ActivityIndicator color={color.forest} />
          </View>
        ) : isError ? (
          <BrowseError
            message={
              apiError?.message ??
              "Check your mobile data or Wi-Fi and try again."
            }
            onRetry={refetch}
          />
        ) : (
          <>
            {/* The map is one presentation of the hubs, not the hubs. If the
                WebView fails, this degrades to the same data as a list rather
                than taking the screen down — see MapErrorBoundary. */}
            <MapErrorBoundary
              hubs={hubs}
              onOpenHub={(hubId) => router.push({ pathname: "/hub", params: { id: hubId } })}
            >
              <HubMap
                hubs={hubs}
                interactive
                focusHubId={focus}
                selectedHubId={selectedId}
                onSelectHub={setSelectedId}
                emptyMessage={
                  scoped
                    ? "This listing has no Safe Zone set. Agree on a public place in your messages."
                    : "No Safe Zones have been set up yet. They are added city by city."
                }
                style={s.map}
              />
            </MapErrorBoundary>

            {selected ? (
              <HubSheet
                hub={selected}
                onClose={() => setSelectedId(null)}
                // A deactivated hub has no listings page worth opening: the
                // endpoint still serves it, but "browse what is offered at a
                // place we have closed" is a dead end dressed as a destination.
                onOpenItems={
                  selected.isActive
                    ? (hubId) => router.push({ pathname: "/hub", params: { id: hubId } })
                    : undefined
                }
              />
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.header.gap,
    paddingLeft: space.screenXTight,
    paddingRight: space.screenX,
    height: size.control.headerIcon,
  },
  back: {
    width: size.detail.backButton,
    height: size.detail.backButton,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: size.detail.backButton / 2,
  },
  backPressed: { backgroundColor: color.control },
  headerText: { flex: 1 },
  title: { color: color.ink },
  subtitle: { color: color.inkMuted, marginTop: 1 },

  legend: { paddingVertical: space.browse.chipsY },

  mapWrap: {
    flex: 1,
    paddingHorizontal: space.screenXTight,
    paddingBottom: space.screenXTight,
  },
  map: { flex: 1 },

  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
});
