import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { colors } from "../theme/palette";

/**
 * The stand-in for a tab that has not been built.
 *
 * It says what it is and that it is not finished, rather than rendering an
 * empty state that looks like a working screen with no data — the two are
 * indistinguishable to anyone reviewing the app, and only one of them is true.
 */
export function Placeholder({
  title,
  icon,
  blurb,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  blurb: string;
}) {
  return (
    <View className="flex-1 items-center justify-center bg-bg px-10">
      <View className="h-16 w-16 items-center justify-center rounded-full border border-line bg-card">
        <Ionicons name={icon} size={26} color={colors.accent} />
      </View>
      <Text className="text-text text-2xl font-bold mt-5 tracking-tight">{title}</Text>
      <Text className="text-muted text-sm text-center mt-2 leading-5">{blurb}</Text>
      <Text className="text-muted/60 text-[11px] uppercase tracking-[2px] mt-6">
        Not built yet
      </Text>
    </View>
  );
}
