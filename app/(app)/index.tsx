import { useCallback } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";

import { ApiError } from "../../src/api/client";
import { FeedCard } from "../../src/components/FeedCard";
import { colors } from "../../src/theme/palette";
import { useHome } from "../../src/api/home";
import type { Item, TrendingCategory } from "../../src/api/types";

/**
 * Home — GET /api/v1/home, rendered.
 *
 * One request behind this whole screen. The greeting, the trending strip and
 * the feed all come out of the same payload; the header does too, from the same
 * cache entry.
 *
 * The trending strip and greeting are the list HEADER rather than siblings
 * above the list. Stacking a View above a FlatList inside a parent View gives a
 * feed that scrolls in its own little window under a pinned block; putting them
 * in ListHeaderComponent makes the whole screen one scroll, which is what a
 * feed is supposed to feel like.
 */
export default function HomeScreen() {
  const {
    viewer,
    trending,
    feed,
    isPending,
    isRefetching,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useHome();

  const onEndReached = useCallback(() => {
    // hasNextPage is derived from meta.nextCursor. The isFetchingNextPage guard
    // matters more than it looks: FlatList fires onEndReached again on every
    // layout pass near the bottom, and without it a slow page would be
    // requested several times over.
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <FlatList
      className="flex-1 bg-bg"
      contentContainerClassName="px-4 pb-6"
      data={feed}
      keyExtractor={(item: Item) => item.id}
      renderItem={({ item }) => <FeedCard item={item} />}
      ListHeaderComponent={
        <View className="pb-1 pt-5">
          <Text className="text-muted text-sm">
            {viewer ? `Hi, ${viewer.name.split(" ")[0]}` : "Hi"}
          </Text>
          <Text className="text-text text-3xl font-bold tracking-tight mt-0.5">
            What are you trading?
          </Text>
          {trending.length > 0 ? <TrendingStrip trending={trending} /> : null}
        </View>
      }
      ListEmptyComponent={
        <View className="items-center py-24">
          <Text className="text-text text-base font-semibold">Nothing here yet</Text>
          <Text className="text-muted text-sm mt-1 text-center px-8">
            When people near you list something, it shows up here.
          </Text>
        </View>
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <View className="py-6">
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : null
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching && !isFetchingNextPage}
          onRefresh={refetch}
          tintColor={colors.accent}
          colors={[colors.accent]}
          progressBackgroundColor={colors.card}
        />
      }
    />
  );
}

function TrendingStrip({ trending }: { trending: TrendingCategory[] }) {
  return (
    <View className="mt-4 flex-row flex-wrap gap-2">
      {trending.map((t) => (
        <View
          key={t.category}
          className="flex-row items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5"
        >
          <Text className="text-accent text-xs font-semibold">{t.hashtag}</Text>
          <Text className="text-muted text-xs">{t.count}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * A 401 does not get an error state here.
 *
 * By the time a query fails with UNAUTHENTICATED, the interceptor has already
 * tried to refresh and given up, which means it has already cleared the
 * session — so the guard in (app)/_layout.tsx is about to replace this whole
 * tree with the login screen. Rendering "Sign in to continue" with a Retry
 * button would flash for one frame and then vanish.
 */
function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const apiError = error instanceof ApiError ? error : null;
  if (apiError?.code === "UNAUTHENTICATED") {
    return <View className="flex-1 bg-bg" />;
  }

  return (
    <View className="flex-1 items-center justify-center bg-bg px-8">
      <Text className="text-text text-base font-semibold text-center">
        Could not load your feed
      </Text>
      <Text className="text-muted text-sm text-center mt-2 leading-5">
        {apiError?.message ?? "Something went wrong."}
      </Text>
      <Text
        onPress={onRetry}
        className="text-accent text-sm font-bold uppercase tracking-wider mt-6"
      >
        Try again
      </Text>
    </View>
  );
}
