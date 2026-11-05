import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiV1 } from "../src/api/client";
import type { Item } from "../src/api/types";
import { BackHeader } from "../src/components/BackHeader";
import { MascotEmptyState } from "../src/components/MascotEmptyState";
import { goBack } from "../src/lib/go-back";
import { color, font } from "../src/theme/tokens";
import { ProfileTile } from "./(app)/profile";

/**
 * Your activity -- the listings you have liked (the heart), newest first.
 * Opened from the profile menu. Likes are on listings only, so this one list
 * is every "post" you have liked. GET /api/v1/profile/me/liked.
 */
export default function ActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const query = useInfiniteQuery({
    queryKey: ["liked"],
    queryFn: async ({ pageParam }) => {
      const qs = new URLSearchParams({ limit: "20", ...(pageParam ? { cursor: pageParam } : {}) });
      const { data, meta } = await apiV1<{ items: Item[] }>(`/api/v1/profile/me/liked?${qs.toString()}`);
      return { items: data.items, nextCursor: typeof meta.nextCursor === "string" ? meta.nextCursor : null };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  // Two per row, like your profile's shelf.
  const rows: Item[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <BackHeader title="Your activity" onBack={() => goBack(router)} />
      {query.isPending ? (
        <ActivityIndicator color={color.green} style={{ marginTop: 40 }} />
      ) : query.isError ? (
        <MascotEmptyState pose="worry" size={90} title="Could not load this" message="Check your connection and try again." action={{ label: "Try again", onPress: () => void query.refetch() }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.map((i) => i.id).join(":")}
          ListHeaderComponent={
            <View style={s.head}>
              <Text style={s.section}>Liked</Text>
              <Text style={s.count}>{items.length}{query.hasNextPage ? "+" : ""}</Text>
            </View>
          }
          renderItem={({ item: row }) => (
            <View style={s.gridRow}>
              {row.map((item) => (
                <ProfileTile key={item.id} dark={false} item={item} onPress={() => router.push({ pathname: "/item", params: { id: item.id } })} />
              ))}
            </View>
          )}
          ListEmptyComponent={
            <MascotEmptyState pose="search" size={100} title="Nothing liked yet" message="Tap the heart on a listing to keep it here." />
          }
          onEndReached={() => { if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage(); }}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={color.green} />}
          ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={color.green} style={{ marginVertical: 18 }} /> : <View style={{ height: insets.bottom + 24 }} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  head: { flexDirection: "row", alignItems: "baseline", gap: 8, paddingHorizontal: 20, paddingTop: 8 },
  section: { fontFamily: font.displaySemi, fontSize: 18, color: color.ink },
  count: { fontFamily: font.sans, fontSize: 14, color: color.inkMuted },
  gridRow: { width: "100%", flexDirection: "row", gap: 12, paddingHorizontal: 20, marginTop: 12 },
});
