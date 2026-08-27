import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../theme/palette";
import { useHome } from "../api/home";

/**
 * The header on every tab: wordmark, Leaves balance, notification bell.
 *
 * Both numbers come from useHome(), the SAME query the feed renders from. That
 * is the point of /api/v1/home being a composite endpoint — the viewer block
 * and the three unread counts ride along with the feed page, so the header
 * costs nothing. Calling the hook here does not issue a second request;
 * TanStack dedupes on the query key, and this component and the Home screen
 * share one.
 *
 * The consequence, and it is a real one: on tabs that are not Home, the numbers
 * are whatever the last /home fetch returned. They go stale until something
 * refetches it. That is the correct trade at this stage — the alternative is a
 * second polling endpoint for two integers — but it is why the balance is not
 * treated as authoritative anywhere a decision depends on it.
 */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const { viewer, unread, isPending } = useHome();

  const notifications = unread?.notifications ?? 0;

  return (
    <View
      className="bg-bg-2 border-b border-line"
      // paddingTop rather than SafeAreaView: the header must PAINT behind the
      // status bar and merely inset its contents. A SafeAreaView here would
      // leave an unpainted strip above it in the canvas colour.
      style={{ paddingTop: insets.top }}
    >
      <View className="h-14 flex-row items-center justify-between px-5">
        <Text className="text-text text-2xl font-bold tracking-tight">Baylo</Text>

        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5">
            <Ionicons name="leaf" size={14} color={colors.accent} />
            <Text className="text-text text-sm font-bold tabular-nums">
              {isPending && viewer === undefined ? "—" : (viewer?.leaves ?? 0).toLocaleString()}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              notifications > 0 ? `Notifications, ${notifications} unread` : "Notifications"
            }
            className="h-10 w-10 items-center justify-center rounded-full border border-line bg-card active:bg-bg"
          >
            <Ionicons name="notifications-outline" size={19} color={colors.text} />
            {notifications > 0 ? (
              <View className="absolute -right-0.5 -top-0.5 min-w-[18px] h-[18px] items-center justify-center rounded-full bg-accent px-1">
                <Text className="text-on-accent text-[10px] font-bold">
                  {/* Past 99 the badge stops being a number and becomes a shape;
                      capping keeps the circle from stretching across the icon. */}
                  {notifications > 99 ? "99+" : notifications}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
