import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "../../src/api/client";
import { useSession } from "../../src/auth/session";
import { Splash } from "../../src/components/Splash";
import { useHubItems } from "../../src/api/hubs";
import type { Item, SafeZoneHub } from "../../src/api/types";
import { ArrowUpRightIcon, ChevronLeftIcon, ExpandIcon, WarningIcon } from "../../src/components/icons";
import { openDirections } from "../../src/components/map/directions";
import { HubMap } from "../../src/components/map/HubMap";
import { MapErrorBoundary } from "../../src/components/map/MapErrorBoundary";
import { HubTypeGlyph } from "../../src/components/map/MapLegend";
import {
  BrowseError,
  BrowseSkeleton,
} from "../../src/components/marketplace/BrowseStates";
import { GridTile } from "../../src/components/marketplace/GridTile";
import { Tappable } from "../../src/components/Tappable";
import {
  border,
  color,
  icon,
  radius,
  size,
  space,
  textStyle,
  type,
} from "../../src/theme/tokens";

/**
 * One safe hub, and everything offered there.
 *
 * GET /api/v1/hubs/[id]/items in a grid, reached from a pin's card on the map
 * or "View listings" in the nearby strip.
 *
 * ── LAYOUT (Oct 2026) ───────────────────────────────────────────────────────
 *
 * A map strip across the top with this hub's pin ringed -- tapping it, or
 * the expand button in its top-right corner, opens the in-app safe hubs map
 * focused here -- the "© OpenStreetMap contributors" credit on it, and a round
 * back button below the status bar. Then "Barangay hall · Safe hub" with the
 * type glyph, the name, the area ("Basak, Lapu-Lapu City"), the meeting point,
 * one outlined pill (Directions, to the phone's maps app), a hairline, and
 * "Meets here" over the grid. No tinted boxes, no glyph-in-a-circle. The app header is off
 * for this route (see (app)/_layout), so the strip can run to the top edge.
 *
 * ── IT RENDERS INSTANTLY, COMING FROM THE MAP ───────────────────────────────
 *
 * The map's card and strip load page 1 of this exact query, and `useHubItems`
 * keys on the hub id alone — so arriving here is a cache hit and the grid is
 * populated on the first frame.
 *
 * ── A DEACTIVATED HUB IS SERVED, NOT 404'd ──────────────────────────────────
 *
 * GET /api/v1/hubs drops inactive hubs so nothing new can be pinned to a closed
 * place, but this endpoint keeps serving one, because the listings already
 * pointing at it still exist. So the notice below is not an error state: the
 * listings are real and still tradeable; what has changed is that this is no
 * longer somewhere we are willing to tell two strangers to meet.
 */
export default function HubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  /** Own tiles show the exact value, everyone else's a bracket — see GridTile. */
  const viewerId = useSession().session?.user.id ?? null;
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const {
    hub,
    items,
    isPending,
    isError,
    error,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useHubItems(id);

  /** Same arithmetic as the marketplace grid — see the note there. */
  const tileWidth = useMemo(
    () => Math.floor((width - space.browse.gridX * 2 - space.browse.gridGap) / 2),
    [width],
  );

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const apiError = error instanceof ApiError ? error : null;
  if (isError && apiError?.code === "UNAUTHENTICATED") {
    return <Splash waitingOn="Signing you back in" />;
  }

  if (!id) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <BackButton onPress={() => router.back()} style={s.backPlain} />
        <BrowseError
          headline="Could not open this safe hub"
          message="No safe hub was named in that link."
          onRetry={() => router.back()}
        />
      </View>
    );
  }

  const openMap = (h: SafeZoneHub) => router.push({ pathname: "/hubs", params: { focus: h.id } });

  const header = hub ? (
    <View>
      {/* ── the map strip ── Full bleed (the list pads its sides by gridX),
          under the status bar, with the back button below the inset. */}
      <View style={[s.strip, { height: insets.top + STRIP_HEIGHT }]}>
        <Tappable
          onPress={() => openMap(hub)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${hub.name} on the map`}
          style={StyleSheet.absoluteFill}
        >
          <MapErrorBoundary hubs={[hub]} listHubs={false}>
            <HubMap
              hubs={[hub]}
              interactive={false}
              highlightHubId={hub.id}
              zoomOut={1}
              style={s.stripMap}
            />
          </MapErrorBoundary>
        </Tappable>
        <BackButton
          onPress={() => router.back()}
          style={[s.backOverMap, { top: insets.top + 8 }]}
        />
        {/* Says the strip is tappable; does the same as tapping it. */}
        <Tappable
          onPress={() => openMap(hub)}
          accessibilityRole="button"
          accessibilityLabel="See nearby hubs on the map"
          style={[s.roundButton, s.expandOverMap, { top: insets.top + 8 }]}
          pressedStyle={s.pressed}
        >
          <ExpandIcon size={icon.check.size + 2} stroke={icon.back.stroke} color={color.ink} />
        </Tappable>
      </View>

      <View style={s.head}>
        <View style={s.eyebrow}>
          <HubTypeGlyph
            hubType={hub.type}
            size={icon.hubPin.size}
            tint={hub.isActive ? color.forest : color.inkStale}
          />
          <Text style={[textStyle(type.gridMeta), s.eyebrowText]}>{`${hub.typeLabel} · Safe hub`}</Text>
        </View>

        <Text style={[textStyle(type.detailTitle), s.name]}>{displayName(hub)}</Text>
        <Text style={[textStyle(type.hubLandmark), s.area]}>{areaLine(hub)}</Text>

        {!hub.isActive ? (
          <View style={s.notice} accessibilityRole="text">
            <WarningIcon
              size={icon.offlineWarning.size}
              stroke={icon.offlineWarning.stroke}
              color={color.urgent}
            />
            <Text style={[textStyle(type.offlineText), s.noticeText]}>
              This is no longer a safe hub. These listings are still active — agree
              somewhere else to meet.
            </Text>
          </View>
        ) : null}

        {/* The landmark, in full and never truncated. It is the sentence that
            gets two people to the same spot inside a building with six doors. */}
        <Text style={[textStyle(type.gridMeta), s.label]}>Meeting point</Text>
        <Text style={[textStyle(type.detailBody), s.landmark]}>{hub.landmark}</Text>

        {/* The one action: the phone's own maps app. The in-app map is the
            strip above. */}
        <View style={s.pills}>
          <Tappable
            onPress={() => {
              void openDirections({ latitude: hub.latitude, longitude: hub.longitude, name: hub.name });
            }}
            accessibilityRole="link"
            accessibilityLabel={`Directions to ${hub.name}`}
            style={[s.pill, s.pillForest]}
            pressedStyle={s.pressed}
          >
            <Text style={[textStyle(type.chip), s.pillLabel, { color: color.forest }]}>Directions</Text>
            <ArrowUpRightIcon size={icon.check.size} stroke={icon.check.stroke} color={color.forest} />
          </Tappable>
        </View>

        <View style={s.sectionHead}>
          <Text style={[textStyle(type.detailSection), s.sectionTitle]} accessibilityRole="header">
            Meets here
          </Text>
          {items.length > 0 ? (
            <Text style={[textStyle(type.metadata), s.count]}>
              {`${items.length}${hasNextPage ? "+" : ""} ${items.length === 1 && !hasNextPage ? "listing" : "listings"}`}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  ) : (
    // Loading or failed before the hub itself arrived: no strip to hold the
    // back button, so it sits on its own below the status bar.
    <View style={{ paddingTop: insets.top }}>
      <BackButton onPress={() => router.back()} style={s.backPlain} />
    </View>
  );

  return (
    <View style={s.screen}>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={({ item }: { item: Item }) => (
          <GridTile
            item={item}
            width={tileWidth}
            onPress={(it) => router.push({ pathname: "/item", params: { id: it.id } })}
            viewerId={viewerId}
            // Every listing here meets at this hub; the place would repeat.
            showPlace={false}
          />
        )}
        numColumns={2}
        columnWrapperStyle={s.column}
        contentContainerStyle={s.content}
        ListHeaderComponent={header}
        ListEmptyComponent={
          isPending ? (
            <BrowseSkeleton tileWidth={tileWidth} />
          ) : isError ? (
            <BrowseError
              headline={
                apiError?.code === "NOT_FOUND"
                  ? "Safe hub unavailable"
                  : "Could not load this safe hub"
              }
              message={
                apiError?.code === "NOT_FOUND"
                  ? "That safe hub no longer exists."
                  : (apiError?.message ??
                    "Check your mobile data or Wi-Fi and try again.")
              }
              onRetry={refetch}
            />
          ) : (
            <View style={s.empty}>
              <Text style={[textStyle(type.emptyBody), s.emptyText]}>
                Nothing is being offered here yet. Listings appear when their
                owners choose this safe hub.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={s.footer}>
              <ActivityIndicator color={color.green} />
            </View>
          ) : (
            <View style={s.footerSpacer} />
          )
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
      />
    </View>
  );
}

/** The map strip's height below the status bar. */
const STRIP_HEIGHT = 120;

/**
 * The hub's name for THIS page's title. "Barangay Basak Hall (Lapu-Lapu)"
 * carries its city in brackets so a list can tell it from Mandaue's Basak;
 * here the area line right under it already names the city, so a trailing
 * "(City)" that matches the hub's own city is dropped. Display only — the
 * name is unchanged everywhere else, and a bracket naming anything else stays.
 */
function displayName(hub: SafeZoneHub): string {
  const m = hub.name.match(/^(.*\S)\s*\(([^()]+)\)\s*$/);
  if (!m) return hub.name;
  return shortCity(m[2]) === shortCity(hub.city) ? m[1] : hub.name;
}

/**
 * "Basak, Lapu-Lapu City": the address segment just before the city, then
 * the city. Addresses are "…, <barangay>, <City>, Cebu", so that segment is
 * the barangay for most hubs (a street for a few). No city in the address:
 * the city alone.
 */
function areaLine(hub: SafeZoneHub): string {
  const parts = hub.address.split(",").map((p) => p.trim()).filter(Boolean);
  const at = parts.findIndex((p) => shortCity(p) === shortCity(hub.city));
  return at > 0 ? `${parts[at - 1]}, ${hub.city}` : hub.city;
}

/** "Lapu-Lapu City" and "Lapu-Lapu" compare equal. */
function shortCity(raw: string): string {
  return raw.trim().replace(/\s+city$/i, "").trim().toLowerCase();
}

function BackButton({ onPress, style }: { onPress: () => void; style?: object }) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={[s.back, style]}
      pressedStyle={s.pressed}
    >
      <ChevronLeftIcon size={icon.back.size} stroke={icon.back.stroke} color={color.ink} />
    </Tappable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  pressed: { opacity: 0.7 },

  /* The list pads its sides by gridX; the strip cancels that to run edge to edge. */
  strip: {
    marginHorizontal: -space.browse.gridX,
    backgroundColor: color.skeleton,
    borderBottomWidth: border.hairline,
    borderBottomColor: color.divider,
  },
  stripMap: { flex: 1, borderRadius: 0 },

  roundButton: {
    width: size.detail.overlayButton,
    height: size.detail.overlayButton,
    borderRadius: size.detail.overlayButton / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surface,
    borderWidth: border.hairline,
    borderColor: color.controlLine,
  },
  expandOverMap: { position: "absolute", right: space.screenXTight },
  back: {
    width: size.detail.overlayButton,
    height: size.detail.overlayButton,
    borderRadius: size.detail.overlayButton / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surface,
    borderWidth: border.hairline,
    borderColor: color.controlLine,
  },
  backOverMap: { position: "absolute", left: space.screenXTight },
  backPlain: { marginLeft: space.screenXTight, marginTop: 8 },

  // The list's gridX plus this makes the detail screen's 16 gutter.
  head: {
    paddingHorizontal: space.detail.x - space.browse.gridX,
    paddingTop: space.detail.photoToBody,
  },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 6 },
  eyebrowText: { flexShrink: 1, color: color.inkSecondary },
  name: { marginTop: space.detail.hubNameToLandmark + 2, color: color.ink },
  area: { marginTop: space.detail.hubNameToLandmark, color: color.inkSecondary },

  // No tinted box: the glyph and the words carry the warning.
  notice: {
    marginTop: space.detail.headingToBody + 4,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.offline.gap,
  },
  noticeText: { flex: 1, color: color.urgent },

  label: { marginTop: space.detail.sectionY - 2, color: color.inkSecondary },
  landmark: { marginTop: space.detail.hubNameToLandmark, color: color.ink },

  pills: {
    marginTop: space.detail.sectionY - 4,
    flexDirection: "row",
    flexWrap: "wrap",
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
  pillLabel: { flexShrink: 1 },

  sectionHead: {
    marginTop: space.detail.sectionY,
    paddingTop: space.detail.sectionY - 4,
    paddingBottom: space.browse.countY,
    borderTopWidth: border.hairline,
    borderTopColor: color.divider,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.browse.searchGap,
  },
  sectionTitle: { flexShrink: 1, color: color.ink },
  count: { color: color.inkSecondary },

  content: { paddingHorizontal: space.browse.gridX },
  column: { gap: space.browse.gridGap, marginBottom: space.browse.gridGap },

  empty: { paddingHorizontal: space.empty.x, paddingTop: space.browse.countY },
  emptyText: { color: color.inkSecondary, textAlign: "center" },

  footer: { paddingVertical: space.card.top },
  footerSpacer: { height: space.detail.actionBarClearance / 2 },
});
