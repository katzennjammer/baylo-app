import { Image } from "expo-image";
import { useMemo, type ReactElement } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { UserSearchResult } from "../../api/types";
import { sizedImage } from "../../media/image-url";
import { border, color, icon, radius, space, textStyle, type } from "../../theme/tokens";
import { MascotEmptyState } from "../MascotEmptyState";
import { ChevronRightIcon, PinIcon, StoreIcon, SwapIcon, VerifiedOrgIcon } from "../icons";
import { Tappable } from "../Tappable";
import { StarText } from "../StarText";
import { PremiumTag } from "../PremiumTag";

export function PeopleResults({
  header,
  query,
  users,
  isLoading,
  isError,
  errorMessage,
  canRetry,
  onRetry,
  hasNextPage,
  isFetchingNextPage,
  onEndReached,
  onOpen,
}: {
  header: ReactElement;
  query: string;
  users: UserSearchResult[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  canRetry: boolean;
  onRetry: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onEndReached: () => void;
  onOpen: (userId: string) => void;
}) {
  const emptyState = useMemo(() => {
    if (isLoading) {
      return <ActivityIndicator color={color.green} style={s.loading} />;
    }
    if (isError) {
      return (
        <MascotEmptyState
          pose="worry"
          size={80}
          title="Could not search people"
          message={errorMessage}
          action={canRetry ? { label: "Try again", onPress: onRetry } : undefined}
        />
      );
    }
    if (query.length < 2) {
      return (
        <Text style={[textStyle(type.emptyBody), s.prompt]}>
          Type at least 2 letters to search.
        </Text>
      );
    }
    return (
      <MascotEmptyState
        pose="search"
        size={80}
        title="No people found"
        message="Try a different name or spelling."
      />
    );
  }, [canRetry, errorMessage, isError, isLoading, onRetry, query.length]);

  const listHeader = (
    <View>
      {header}
      {query.length >= 2 && !isLoading && !isError ? (
        <Text style={[textStyle(type.metadata), s.count]}>
          {users.length}{hasNextPage ? "+" : ""} {users.length === 1 && !hasNextPage ? "trader" : "traders"} found
        </Text>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={users}
      keyExtractor={(user) => user.id}
      renderItem={({ item }) => <PersonRow user={item} query={query} onPress={() => onOpen(item.id)} />}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={emptyState}
      ListFooterComponent={
        isFetchingNextPage ? (
          <ActivityIndicator color={color.green} style={s.loading} />
        ) : hasNextPage ? (
          <View style={s.footerSpace} />
        ) : null
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.listContent}
    />
  );
}

/** The part of the name that matched the search, marked. */
function highlight(name: string, query: string): React.ReactNode {
  const q = query.trim().replace(/^@/, "");
  const at = q ? name.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) return name;
  return (
    <>
      {name.slice(0, at)}
      <Text style={{ backgroundColor: "#FFF1B8" }}>{name.slice(at, at + q.length)}</Text>
      {name.slice(at + q.length)}
    </>
  );
}

function PersonRow({ user, onPress, query = "" }: { user: UserSearchResult; onPress: () => void; query?: string }) {
  const image = user.org?.logoUrl ?? user.avatar;
  const displayName = user.org?.name ?? user.name;
  const accessibilityLabel = [
    displayName,
    user.org?.verified ? "Verified organization" : null,
    user.reviewCount > 0 && user.rating > 0
      ? `${user.rating.toFixed(1)} out of 5, ${user.reviewCount} reviews`
      : "No ratings yet",
    `${user.totalTrades} completed ${user.totalTrades === 1 ? "trade" : "trades"}`,
    user.location,
    "Open profile",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={s.card}
      pressedStyle={s.cardPressed}
    >
      {image ? (
        <Image
          source={{ uri: sizedImage(image, "thumb") }}
          contentFit="cover"
          style={[s.avatar, user.org && s.orgAvatar]}
        />
      ) : (
        <View style={[s.avatar, s.avatarFallback, user.org && s.orgAvatar]}>
          {user.org ? (
            <StoreIcon size={icon.orgLogo.size} stroke={1.6} color={color.forest} />
          ) : (
            <Text style={[textStyle(type.avatarInitials40), s.initial]}>
              {user.name.trim().charAt(0).toUpperCase() || "?"}
            </Text>
          )}
        </View>
      )}

      <View style={s.identity}>
        <View style={s.nameRow}>
          <Text style={[textStyle(type.username), s.name]} numberOfLines={1}>
            {highlight(displayName, query)}
          </Text>
          {/* Search shows ONE tag (13 Nov 2026): PREMIUM for a premium
              account, nothing otherwise. The green tier and shop-category
              chips stay on the profile. */}
          {user.premium ? <PremiumTag /> : null}
          {user.org?.verified ? (
            <VerifiedOrgIcon
              size={icon.orgBadge.size}
              stroke={icon.orgBadge.stroke}
              color={color.forest}
            />
          ) : null}
        </View>

        {/* One quiet line (4 Nov 2026): rating, trades, place. */}
        <StarText style={[textStyle(type.metadata), s.secondary]} numberOfLines={1}>
          {[
            user.reviewCount > 0 && user.rating > 0 ? `★ ${user.rating.toFixed(1)} (${user.reviewCount})` : "No ratings yet",
            `${user.totalTrades} ${user.totalTrades === 1 ? "trade" : "trades"}`,
            user.location,
          ]
            .filter(Boolean)
            .join(" · ")}
        </StarText>
      </View>

      <ChevronRightIcon size={18} stroke={1.6} color={color.inkMuted} />
    </Tappable>
  );
}

const AVATAR_SIZE = 64;
const RATING_GOLD = "#F5B82E";

const s = StyleSheet.create({
  listContent: { flexGrow: 1, paddingBottom: space.trending.y },
  count: {
    color: color.inkSecondary,
    paddingHorizontal: space.screenX,
    paddingTop: 8,
    paddingBottom: 10,
  },
  loading: { marginTop: space.empty.bodyToButton, marginBottom: space.empty.bodyToButton },
  prompt: {
    paddingHorizontal: space.screenX,
    paddingVertical: space.empty.bodyToButton,
    color: color.inkSecondary,
    textAlign: "center",
  },
  card: {
    minHeight: 112,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: space.screenX,
    marginBottom: 10,
    padding: 14,
    borderWidth: border.hairline,
    borderColor: "#E2E5E0",
    borderRadius: 18,
    backgroundColor: color.surface,
    shadowColor: "#18251B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  cardPressed: { backgroundColor: color.control },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: color.greenWash,
  },
  orgAvatar: { borderRadius: radius.dPhoto },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  initial: { color: color.forest },
  identity: { flex: 1, minWidth: 0, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, color: color.ink },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  stars: { flexDirection: "row", alignItems: "center", gap: 1 },
  rating: { color: color.ink },
  secondary: { color: color.inkSecondary },
  unrated: { color: color.inkSecondary, fontStyle: "italic" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 },
  footerSpace: { height: space.trending.y },
});
