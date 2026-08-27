import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Text, View } from "react-native";

import { colors } from "../theme/palette";
import type { Item } from "../api/types";

/**
 * One listing in the feed.
 *
 * Everything rendered here already arrived on the item — categoryLabel and
 * conditionLabel are resolved server-side, and so is the owner's rank. No enum
 * is translated to a human string on this side, which is what stops the app and
 * the web disagreeing about whether CLOTHING reads "Clothing" or "Fashion".
 * (They already disagree in three places on the web. See v1/taxonomy.ts.)
 */
export function FeedCard({ item }: { item: Item }) {
  const cover = item.images[0];

  return (
    <View className="mb-4 overflow-hidden rounded-2xl border border-line bg-card">
      <View className="aspect-[4/3] w-full bg-bg-2">
        {cover ? (
          <Image
            source={{ uri: cover }}
            contentFit="cover"
            transition={160}
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="image-outline" size={28} color={colors.muted} />
          </View>
        )}

        <View className="absolute left-3 top-3 rounded-full bg-scrim-1 px-2.5 py-1">
          <Text className="text-text text-[11px] font-semibold uppercase tracking-wider">
            {item.categoryLabel}
          </Text>
        </View>

        {item.valueLeaves !== null ? (
          <View className="absolute right-3 top-3 flex-row items-center gap-1 rounded-full bg-accent px-2.5 py-1">
            <Ionicons name="leaf" size={12} color={colors["on-accent"]} />
            <Text className="text-on-accent text-[11px] font-bold">{item.valueLeaves}</Text>
          </View>
        ) : null}
      </View>

      <View className="p-4">
        <Text className="text-text text-lg font-bold leading-6" numberOfLines={2}>
          {item.title}
        </Text>

        {item.description ? (
          <Text className="text-muted text-sm leading-5 mt-1" numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        <View className="mt-3 flex-row items-center gap-2">
          <Avatar uri={item.owner.avatar} name={item.owner.name} />
          <View className="flex-1">
            <Text className="text-text text-sm font-semibold" numberOfLines={1}>
              {item.owner.name}
            </Text>
            <Text className="text-muted text-xs" numberOfLines={1}>
              {item.owner.rank}
              {/* pickup is null when the listing has no location at all. When
                  it is present but not `precise`, the coordinates are a ~1 km
                  rounding — so the address is the only part safe to print, and
                  the server has already withheld it if it was not. */}
              {item.pickup?.address ? ` · ${item.pickup.address}` : ""}
            </Text>
          </View>

          <View className="flex-row items-center gap-3">
            <Stat
              icon={item.stats.liked ? "heart" : "heart-outline"}
              color={item.stats.liked ? colors.accent : colors.muted}
              value={item.stats.likes}
            />
            <Stat icon="chatbubble-outline" color={colors.muted} value={item.stats.comments} />
          </View>
        </View>

        <View className="mt-3 flex-row items-center gap-2 border-t border-line pt-3">
          <Text className="text-muted text-xs uppercase tracking-wider">
            {item.conditionLabel}
          </Text>
          {item.wanted ? (
            <Text className="text-muted text-xs flex-1" numberOfLines={1}>
              · Wants {item.wanted}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function Stat({
  icon,
  color,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  value: number;
}) {
  return (
    <View className="flex-row items-center gap-1">
      <Ionicons name={icon} size={14} color={color} />
      <Text className="text-muted text-xs">{value}</Text>
    </View>
  );
}

function Avatar({ uri, name }: { uri: string | null; name: string }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        contentFit="cover"
        style={{ width: 32, height: 32, borderRadius: 16 }}
      />
    );
  }
  return (
    <View className="h-8 w-8 items-center justify-center rounded-full bg-accent">
      <Text className="text-on-accent text-xs font-bold">
        {name.trim().charAt(0).toUpperCase() || "?"}
      </Text>
    </View>
  );
}
