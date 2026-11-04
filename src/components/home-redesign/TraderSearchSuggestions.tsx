import { Image } from "expo-image";
import { ActivityIndicator, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { UserSearchResult } from "../../api/types";
import { sizedImage } from "../../media/image-url";
import { businessCategoryLabel } from "../../lib/business-category";
import { TIER_LABEL } from "../../lib/trust";
import { border, color, dColor, icon, radius, space, textStyle, type } from "../../theme/tokens";
import { ChevronRightIcon, PinIcon, StoreIcon, SwapIcon, VerifiedOrgIcon } from "../icons";
import { Tappable } from "../Tappable";

export function TraderSearchSuggestions({
  query,
  users,
  loading,
  error,
  canRetry = true,
  onSearch,
  onOpen,
  onRetry,
  compact = false,
}: {
  query: string;
  users: UserSearchResult[];
  loading: boolean;
  error: string | null;
  canRetry?: boolean;
  onSearch: () => void;
  onOpen: (user: UserSearchResult) => void;
  onRetry: () => void;
  compact?: boolean;
}) {
  return (
    <View style={s.panel}>
      <Tappable
        onPress={onSearch}
        accessibilityRole="button"
        accessibilityLabel={`Search traders for ${query}`}
        style={s.searchRow}
        pressedStyle={s.rowPressed}
      >
        <View style={s.searchIcon}>
          <Ionicons name="people-outline" size={18} color={dColor.primary} />
        </View>
        <Text style={[textStyle(type.username), s.searchText]} numberOfLines={1}>
          Search traders for “{query}”
        </Text>
        <ChevronRightIcon size={18} stroke={1.6} color={color.inkMuted} />
      </Tappable>

      {loading ? (
        <View style={s.status}>
          <ActivityIndicator size="small" color={color.green} />
          <Text style={[textStyle(type.metadata), s.secondary]}>Finding traders</Text>
        </View>
      ) : error ? (
        <View style={s.status}>
          <Text style={[textStyle(type.metadata), s.secondary]} numberOfLines={2}>{error}</Text>
          {canRetry ? (
            <Tappable
              onPress={onRetry}
              accessibilityRole="button"
              style={s.retry}
              pressedStyle={s.rowPressed}
            >
              <Text style={[textStyle(type.chip), { color: dColor.primary }]}>Try again</Text>
            </Tappable>
          ) : null}
        </View>
      ) : users.length > 0 ? (
        users.slice(0, compact ? 3 : users.length).map((user) => (
          <TraderRow key={user.id} user={user} compact={compact} onPress={() => onOpen(user)} />
        ))
      ) : (
        <View style={s.status}>
          <Text style={[textStyle(type.metadata), s.secondary]}>No matching traders yet.</Text>
        </View>
      )}
    </View>
  );
}

function TraderRow({
  user,
  compact,
  onPress,
}: {
  user: UserSearchResult;
  compact: boolean;
  onPress: () => void;
}) {
  const image = user.org?.logoUrl ?? user.avatar;
  const name = user.org?.name ?? user.name;
  const badge = user.org
    ? businessCategoryLabel(user.org.businessCategory)
    : user.trustTier
      ? TIER_LABEL[user.trustTier]
      : null;
  const ratingText =
    user.reviewCount > 0 && user.rating > 0
      ? `${user.rating.toFixed(1)} (${user.reviewCount})`
      : "No ratings yet";
  const label = [
    name,
    ratingText,
    `${user.totalTrades} ${user.totalTrades === 1 ? "trade" : "trades"}`,
    user.location,
    "Open profile",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[s.traderRow, compact && s.traderRowCompact]}
      pressedStyle={s.rowPressed}
    >
      {image ? (
        <Image
          source={{ uri: sizedImage(image, "thumb") }}
          contentFit="cover"
          style={[s.avatar, compact && s.avatarCompact]}
        />
      ) : (
        <View style={[s.avatar, compact && s.avatarCompact, s.avatarFallback]}>
          {user.org ? (
            <StoreIcon size={icon.orgLogo.size} stroke={1.6} color={color.forest} />
          ) : (
            <Text style={[textStyle(type.avatarInitials40), s.initial]}>
              {name.trim().charAt(0).toUpperCase() || "?"}
            </Text>
          )}
        </View>
      )}

      <View style={s.copy}>
        <View style={s.nameRow}>
          <Text style={[textStyle(type.username), s.name]} numberOfLines={1}>{name}</Text>
          {badge ? (
            <Text style={[textStyle(type.metadata), s.badge]} numberOfLines={1}>{badge}</Text>
          ) : null}
          {user.org?.verified ? (
            <VerifiedOrgIcon size={icon.orgBadge.size} stroke={icon.orgBadge.stroke} color={color.forest} />
          ) : null}
        </View>
        <View style={s.metaRow}>
          {user.reviewCount > 0 && user.rating > 0 ? (
            <>
              <View style={s.stars} accessible={false}>
                {Array.from({ length: 5 }, (_, index) => {
                  const rating = user.rating - index;
                  return (
                    <Ionicons
                      key={index}
                      name={rating >= 1 ? "star" : rating >= 0.5 ? "star-half" : "star-outline"}
                      size={11}
                      color={rating >= 0.5 ? RATING_GOLD : color.inkMuted}
                    />
                  );
                })}
              </View>
              <Text style={[textStyle(type.metadata), s.secondary]}>{ratingText}</Text>
            </>
          ) : (
            <Text style={[textStyle(type.metadata), s.secondary]}>No ratings yet</Text>
          )}
          <View style={s.stat}>
            <SwapIcon size={13} stroke={1.6} color={color.inkSecondary} />
            <Text style={[textStyle(type.metadata), s.secondary]}>
              {user.totalTrades} {user.totalTrades === 1 ? "trade" : "trades"}
            </Text>
          </View>
          {user.location ? (
            <View style={s.location}>
              <PinIcon size={13} stroke={1.6} color={color.inkSecondary} />
              <Text style={[textStyle(type.metadata), s.secondary]} numberOfLines={1}>{user.location}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <ChevronRightIcon size={18} stroke={1.6} color={color.inkMuted} />
    </Tappable>
  );
}

const RATING_GOLD = "#F5B82E";

const s = {
  panel: {
    marginHorizontal: space.screenX,
    marginTop: 6,
    marginBottom: 8,
    overflow: "hidden" as const,
    borderWidth: border.hairline,
    borderColor: dColor.border,
    borderRadius: radius.dCard,
    backgroundColor: dColor.surface,
  },
  searchRow: {
    minHeight: 48,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    paddingHorizontal: 12,
    borderBottomWidth: border.hairline,
    borderBottomColor: dColor.border,
  },
  searchIcon: {
    width: 32,
    height: 32,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 16,
    backgroundColor: color.greenWash,
  },
  searchText: { flex: 1, minWidth: 0, color: color.ink },
  traderRow: {
    minHeight: 66,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: border.hairline,
    borderBottomColor: dColor.border,
  },
  traderRowCompact: { minHeight: 56, gap: 8, paddingVertical: 6 },
  rowPressed: { backgroundColor: color.control },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: color.greenWash },
  avatarCompact: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { alignItems: "center" as const, justifyContent: "center" as const },
  initial: { color: color.forest },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  nameRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 5 },
  name: { flexShrink: 1, color: color.ink },
  badge: { flexShrink: 1, color: color.forest, fontSize: 10, lineHeight: 13 },
  metaRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 7 },
  stars: { flexDirection: "row" as const, alignItems: "center" as const, gap: 0 },
  stat: { flexDirection: "row" as const, alignItems: "center" as const, gap: 2 },
  location: { flex: 1, minWidth: 0, flexDirection: "row" as const, alignItems: "center" as const, gap: 2 },
  secondary: { flexShrink: 1, color: color.inkSecondary, fontSize: 11 },
  status: {
    minHeight: 48,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retry: { minHeight: 40, justifyContent: "center" as const, paddingHorizontal: 10 },
};
