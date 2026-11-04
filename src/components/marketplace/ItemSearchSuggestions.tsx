import { Image } from "expo-image";
import { ActivityIndicator, Text, View } from "react-native";

import type { Item } from "../../api/types";
import { sizedImage } from "../../media/image-url";
import { border, color, dColor, icon, radius, space, textStyle, type } from "../../theme/tokens";
import { ChevronRightIcon, ImageIcon, SearchIcon } from "../icons";
import { Tappable } from "../Tappable";

export function ItemSearchSuggestions({
  query,
  items,
  loading,
  error,
  onSearch,
  onOpen,
  onRetry,
  compact = false,
}: {
  query: string;
  items: Item[];
  loading: boolean;
  error: string | null;
  onSearch: () => void;
  onOpen: (item: Item) => void;
  onRetry: () => void;
  compact?: boolean;
}) {
  return (
    <View style={s.panel}>
      <Tappable
        onPress={onSearch}
        accessibilityRole="button"
        accessibilityLabel={`Search items for ${query}`}
        style={s.searchRow}
        pressedStyle={s.rowPressed}
      >
        <View style={s.searchIcon}>
          <SearchIcon size={icon.search.size} stroke={icon.search.stroke} color={dColor.primary} />
        </View>
        <Text style={[textStyle(type.username), s.searchText]} numberOfLines={1}>
          Search items for “{query}”
        </Text>
        <ChevronRightIcon size={18} stroke={1.6} color={color.inkMuted} />
      </Tappable>

      {loading ? (
        <View style={s.status}>
          <ActivityIndicator size="small" color={color.green} />
          <Text style={[textStyle(type.metadata), s.statusText]}>Finding matching items</Text>
        </View>
      ) : error ? (
        <View style={s.status}>
          <Text style={[textStyle(type.metadata), s.statusText]}>{error}</Text>
          <Tappable
            onPress={onRetry}
            accessibilityRole="button"
            style={s.retry}
            pressedStyle={s.rowPressed}
          >
            <Text style={[textStyle(type.chip), { color: dColor.primary }]}>Retry</Text>
          </Tappable>
        </View>
      ) : (
        items.map((item) => (
          <ItemSuggestionRow
            key={item.id}
            item={item}
            compact={compact}
            onPress={() => onOpen(item)}
          />
        ))
      )}
    </View>
  );
}

function ItemSuggestionRow({
  item,
  compact,
  onPress,
}: {
  item: Item;
  compact: boolean;
  onPress: () => void;
}) {
  const image = item.images[0];
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.categoryLabel}, ${item.conditionLabel}. View item`}
      style={[s.itemRow, compact && s.itemRowCompact]}
      pressedStyle={s.rowPressed}
    >
      {image ? (
        <Image
          source={{ uri: sizedImage(image, "thumb") }}
          contentFit="cover"
          style={[s.thumbnail, compact && s.thumbnailCompact]}
        />
      ) : (
        <View style={[s.thumbnail, compact && s.thumbnailCompact, s.thumbnailFallback]}>
          <ImageIcon size={20} stroke={1.6} color={color.inkMuted} />
        </View>
      )}
      <View style={s.itemCopy}>
        <Text style={[textStyle(type.username), s.itemTitle]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[textStyle(type.metadata), s.itemDetails]} numberOfLines={1}>
          {item.categoryLabel} · {item.conditionLabel}
        </Text>
      </View>
      <ChevronRightIcon size={18} stroke={1.6} color={color.inkMuted} />
    </Tappable>
  );
}

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
  itemRow: {
    minHeight: 68,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: border.hairline,
    borderBottomColor: dColor.border,
  },
  itemRowCompact: { minHeight: 58, gap: 10, paddingVertical: 6 },
  rowPressed: { backgroundColor: color.control },
  thumbnail: { width: 48, height: 48, borderRadius: radius.dPhoto, backgroundColor: color.greenWash },
  thumbnailCompact: { width: 40, height: 40 },
  thumbnailFallback: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  itemCopy: { flex: 1, minWidth: 0, gap: 3 },
  itemTitle: { color: color.ink },
  itemDetails: { color: color.inkSecondary },
  status: {
    minHeight: 48,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statusText: { flex: 1, color: color.inkSecondary },
  retry: { minHeight: 40, justifyContent: "center" as const, paddingHorizontal: 10 },
};
