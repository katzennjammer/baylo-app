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

import { ApiError } from "../../src/api/client";
import { Splash } from "../../src/components/Splash";
import { useHubItems } from "../../src/api/hubs";
import type { Item } from "../../src/api/types";
import { ChevronLeftIcon, WarningIcon } from "../../src/components/icons";
import { openDirections } from "../../src/components/map/directions";
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
 * One Safe-Zone hub, and everything offered there.
 *
 * GET /api/v1/hubs/[id]/items in a grid, reached from a pin's sheet on the map.
 *
 * ── IT RENDERS INSTANTLY, COMING FROM THE MAP ───────────────────────────────
 *
 * The sheet on the map loaded page 1 of this exact query to get its count, and
 * `useHubItems` keys on the hub id alone — so arriving here is a cache hit and
 * the grid is populated on the first frame. That is the reason the count is not
 * a separate lighter-weight request: the "wasted" page turns out to be the one
 * this screen needed.
 *
 * ── A DEACTIVATED HUB IS SERVED, NOT 404'd ──────────────────────────────────
 *
 * The server is explicit about this: GET /api/v1/hubs drops inactive hubs so
 * nothing new can be pinned to a closed place, but this endpoint keeps serving
 * one, because the listings already pointing at it still exist and their owners
 * still expect to see them. A shared link to a hub must not die the moment we
 * close the hub and take the listings with it.
 *
 * So the banner below is not an error state. The listings under it are real and
 * still tradeable; what has changed is that this is no longer somewhere we are
 * willing to tell two strangers to meet.
 */
export default function HubScreen() {
  const router = useRouter();
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
      <View style={s.screen}>
        <BackRow onPress={() => router.back()} />
        <BrowseError message="No Safe Zone was named in that link." onRetry={() => router.back()} />
      </View>
    );
  }

  const header = hub ? (
    <View style={s.head}>
      <View style={s.headTop}>
        <View style={[s.glyphWell, !hub.isActive && s.glyphWellOff]}>
          <HubTypeGlyph
            hubType={hub.type}
            size={17}
            tint={hub.isActive ? color.forest : color.inkStale}
          />
        </View>

        <View style={s.headText}>
          <Text style={[textStyle(type.detailTitle), s.name]}>{hub.name}</Text>
          <Text style={[textStyle(type.hubLandmark), s.meta]}>
            {`${hub.typeLabel} · ${hub.city}`}
          </Text>
        </View>
      </View>

      {/* The landmark, in full and never truncated. It is the sentence that
          gets two people to the same spot inside a building with six doors. */}
      <Text style={[textStyle(type.detailBody), s.landmark]}>{hub.landmark}</Text>
      <Text style={[textStyle(type.hubLandmark), s.address]}>{hub.address}</Text>

      {!hub.isActive ? (
        <View style={s.banner}>
          <WarningIcon
            size={icon.offlineWarning.size}
            stroke={icon.offlineWarning.stroke}
            color={color.urgent}
          />
          <Text style={[textStyle(type.offlineText), s.bannerText]}>
            This is no longer a Safe Zone. These listings are still active — agree
            somewhere else to meet.
          </Text>
        </View>
      ) : null}

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

        <Tappable
          onPress={() => router.push({ pathname: "/hubs", params: { focus: hub.id } })}
          accessibilityRole="button"
          accessibilityLabel={`Show ${hub.name} on the map`}
          style={s.onMap}
          pressedStyle={s.onMapPressed}
        >
          <Text style={[textStyle(type.secondaryButton), { color: color.ink }]}>
            Show on map
          </Text>
        </Tappable>
      </View>

      {items.length > 0 ? (
        <Text style={[textStyle(type.resultCount), s.count]}>
          {items.length}
          {hasNextPage ? "+" : ""} {items.length === 1 ? "listing" : "listings"}
        </Text>
      ) : null}
    </View>
  ) : null;

  return (
    <View style={s.screen}>
      <BackRow onPress={() => router.back()} />

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={({ item }: { item: Item }) => (
          <GridTile
            item={item}
            width={tileWidth}
            onPress={(it) => router.push({ pathname: "/item", params: { id: it.id } })}
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
              message={
                apiError?.code === "NOT_FOUND"
                  ? "That Safe Zone no longer exists."
                  : (apiError?.message ??
                    "Check your mobile data or Wi-Fi and try again.")
              }
              onRetry={refetch}
            />
          ) : (
            <View style={s.empty}>
              <Text style={[textStyle(type.emptyBody), s.emptyText]}>
                Nothing is being offered here yet. Listings appear when their
                owners choose this Safe Zone.
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

function BackRow({ onPress }: { onPress: () => void }) {
  return (
    <View style={s.backRow}>
      <Tappable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={s.back}
        pressedStyle={s.backPressed}
      >
        <ChevronLeftIcon size={icon.back.size} stroke={icon.back.stroke} color={color.ink} />
      </Tappable>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },

  backRow: { paddingLeft: space.screenXTight, paddingVertical: 4 },
  back: {
    width: size.detail.backButton,
    height: size.detail.backButton,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: size.detail.backButton / 2,
  },
  backPressed: { backgroundColor: color.control },

  head: { paddingHorizontal: space.detail.x, paddingBottom: space.detail.sectionY },
  headTop: { flexDirection: "row", alignItems: "flex-start", gap: space.detail.hubIconToText },
  glyphWell: {
    width: size.detail.hubIcon,
    height: size.detail.hubIcon,
    borderRadius: size.detail.hubIcon / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.greenWash,
  },
  glyphWellOff: { backgroundColor: color.control },
  headText: { flex: 1 },
  name: { color: color.ink },
  meta: { marginTop: space.detail.hubNameToLandmark, color: color.inkMuted },

  landmark: { marginTop: space.detail.headingToBody + 4, color: color.ink },
  address: { marginTop: space.detail.hubNameToLandmark, color: color.inkMuted },

  banner: {
    marginTop: space.detail.sectionY - 6,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.offline.gap,
    padding: space.browse.tileBody,
    borderRadius: radius.hubRow,
    backgroundColor: color.urgentWash,
    borderWidth: border.hairline,
    borderColor: color.urgentLine,
  },
  bannerText: { flex: 1, color: color.urgent },

  actions: {
    marginTop: space.detail.sectionY,
    flexDirection: "row",
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
  onMap: {
    flex: 1,
    height: size.sheet.action,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.primaryButton,
    borderWidth: border.hairline,
    borderColor: color.controlLine,
    backgroundColor: color.control,
  },
  onMapPressed: { backgroundColor: color.controlLine },

  count: { marginTop: space.detail.sectionY, color: color.inkMuted },

  content: { paddingHorizontal: space.browse.gridX, paddingTop: space.browse.chipsY },
  column: { gap: space.browse.gridGap, marginBottom: space.browse.gridGap },

  empty: { paddingHorizontal: space.empty.x, paddingTop: space.browse.countY },
  emptyText: { color: color.inkSecondary, textAlign: "center" },

  footer: { paddingVertical: space.card.top },
  footerSpacer: { height: space.detail.actionBarClearance / 2 },
});
