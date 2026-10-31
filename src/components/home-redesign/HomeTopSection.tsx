import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError } from "../../api/client";
import { useHome } from "../../api/home";
import { useQuests } from "../../api/quests";
import { getActingOrgId } from "../../api/org-context";
import { subscribeToUserChannel } from "../../api/pusher";
import { useSession } from "../../auth/session";
import { BellIcon, MessageIcon, QuestIcon } from "../icons";
import { LeavesPill } from "../AppHeader";
import { OfflineBar } from "../home/OfflineBar";
import { FilterButton, SearchField } from "../marketplace/BrowseControls";
import { formatBadge, formatLeaves } from "../../lib/format";
import { MASCOT } from "../../media/mascots";
import { breakpoint, color, font, icon, size, space, textStyle, type } from "../../theme/tokens";

type HomeTopSectionProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onFilterPress: () => void;
  pendingTradeCount: number | null;
  leavesBalance: number | null;
  firstName: string | null | undefined;
  onViewTrades: () => void;
  onExploreFood: () => void;
};

export function HomePinnedHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const home = useHome();
  const quests = useQuests();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const questCount = quests.data?.quests.filter((quest) => !quest.completed).length ?? 0;
  const refetchQuests = quests.refetch;
  useEffect(() => {
    if (home.dataUpdatedAt) void refetchQuests({ cancelRefetch: false });
  }, [home.dataUpdatedAt, refetchQuests]);

  const inboxChannelId = home.acting?.orgUserId ?? session?.user.id;
  useEffect(() => {
    if (!inboxChannelId) return;
    return subscribeToUserChannel(
      inboxChannelId,
      () => undefined,
      undefined,
      undefined,
      () => {
        void queryClient.invalidateQueries({ queryKey: ["home"] });
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      },
    ) ?? undefined;
  }, [inboxChannelId, queryClient]);

  const answeredFor = home.acting?.organizationId ?? null;
  const pillStale = answeredFor !== getActingOrgId() && home.isFetching;
  const leavesValue =
    (home.isPending && home.viewer === undefined) || pillStale
      ? null
      : home.acting
        ? home.acting.leaves
        : (home.viewer?.leaves ?? 0);
  const offline =
    home.isError && !(home.error instanceof ApiError && home.error.code === "UNAUTHENTICATED");
  const tight = width <= breakpoint.tight;

  return (
    <View style={[s.pinnedHeader, { paddingTop: insets.top }]}>
      <View style={[s.headerRow, { paddingHorizontal: tight ? space.screenXTight : space.screenX }]}>
        <Text style={s.wordmark} accessibilityLabel="Baylo">
          baylo<Text style={s.wordmarkDot}>.</Text>
        </Text>
        <View style={s.headerActions}>
          <LeavesPill
            value={leavesValue}
            owner={home.acting && !pillStale ? home.acting.name : undefined}
            stale={offline}
            tight={tight}
            style={s.leavesPill}
          />
          <HomeHeaderButton label="Quests" count={questCount} onPress={() => router.push("/quests")}>
            <QuestIcon size={icon.headerAction.size} stroke={icon.headerAction.stroke} color={color.homeOnGreen} />
          </HomeHeaderButton>
          <HomeHeaderButton
            label="Notifications"
            count={home.unread?.notifications ?? 0}
            onPress={() => router.push("/notifications")}
          >
            <BellIcon size={icon.headerAction.size} stroke={icon.headerAction.stroke} color={color.homeOnGreen} />
          </HomeHeaderButton>
          <HomeHeaderButton
            label="Messages"
            count={home.unread?.messageConversations ?? 0}
            onPress={() => router.push("/messages")}
          >
            <MessageIcon size={icon.headerAction.size} stroke={icon.headerAction.stroke} color={color.homeOnGreen} />
          </HomeHeaderButton>
        </View>
      </View>
      {offline ? <OfflineBar lastSyncedAt={home.dataUpdatedAt || null} /> : null}
    </View>
  );
}

function HomeHeaderButton({
  label,
  count,
  onPress,
  children,
}: {
  label: string;
  count: number;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const badge = count > 0 ? formatBadge(count) : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        count > 0 ? `${label}, ${count} ${label === "Quests" ? "remaining" : "unread"}` : label
      }
      style={s.headerIconButton}
    >
      {children}
      {badge ? (
        <View style={s.headerBadge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={s.headerBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function HomeTopSection({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  onFilterPress,
  pendingTradeCount,
  leavesBalance,
  firstName,
  onViewTrades,
  onExploreFood,
}: HomeTopSectionProps) {
  const { width } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const float = useRef(new Animated.Value(0)).current;
  const resolvedName = firstName?.trim().split(/\s+/)[0] || "there";
  const now = new Date();
  const weekday = now.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const monthDay = now.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  const duckSize = width <= breakpoint.tight ? 132 : 148;

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (enabled) => {
        if (active) setReduceMotion(enabled);
      },
      () => {
        if (active) setReduceMotion(true);
      },
    );
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    float.stopAnimation();
    float.setValue(0);
    if (reduceMotion !== false) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2100, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2100, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [float, reduceMotion]);

  const pending = pendingTradeCount !== null && pendingTradeCount > 0;

  return (
    <LinearGradient
      colors={[color.homeTop, color.homeMiddle, color.homeBottom]}
      locations={[0, 0.58, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.topBackground}
    >
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Pattern id="homeDots" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
            <Circle cx="2" cy="2" r="1" fill={color.homePattern} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#homeDots)" />
      </Svg>

      <View style={{ paddingTop: space.home.top }}>
        <View style={s.searchRow}>
          <SearchField
            value={searchValue}
            onChange={onSearchChange}
            onSubmit={onSearchSubmit}
            placeholder={'Search items, e.g. "bike"'}
            variant="home"
          />
          <FilterButton count={0} onPress={onFilterPress} variant="home" />
        </View>

        <View style={[s.greetingRow, { minHeight: duckSize + 16 }]}>
          <View style={s.greetingCopy}>
            <Text style={s.dateLine} numberOfLines={1}>
              {weekday} · {monthDay}
            </Text>
            <Text
              style={s.greetingTitle}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {greeting}, {resolvedName}
            </Text>
            <Text style={s.subtitle}>
              {pending ? (
                <>
                  You&apos;ve got <Text style={s.subtitleEmphasis}>{pendingTradeCount}</Text> {pendingTradeCount === 1 ? "trade" : "trades"} waiting for a reply.
                </>
              ) : (
                <>
                  You&apos;ve got <Text style={s.subtitleEmphasis}>{leavesBalance === null ? "—" : formatLeaves(leavesBalance)}</Text> Leaves ready for your next trade.
                </>
              )}
            </Text>
          </View>
          <Animated.View
            style={[
              s.duckFrame,
              {
                width: duckSize,
                height: duckSize + 16,
                transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
              },
            ]}
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Image source={MASCOT.celebrate} contentFit="contain" style={{ width: duckSize, height: duckSize + 16 }} />
          </Animated.View>
        </View>

        <View style={s.actionRow}>
          <HomeActionButton label="View trades" onPress={onViewTrades} count={pendingTradeCount ?? 0} primary />
          <HomeActionButton label="Explore food" onPress={onExploreFood} />
        </View>
      </View>
      <View pointerEvents="none" style={s.curvedCreamEdge} />
    </LinearGradient>
  );
}

function HomeActionButton({
  label,
  onPress,
  count = 0,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  count?: number;
  primary?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <View style={[s.actionSlot, primary ? s.primaryActionSlot : s.secondaryActionSlot]}>
      <View pointerEvents="none" style={[s.actionShadow, pressed && s.actionShadowPressed]} />
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        style={[
          s.actionButton,
          primary ? s.primaryAction : s.secondaryAction,
          pressed && s.actionButtonPressed,
        ]}
      >
        <Text style={[textStyle(type.primaryButton), s.actionText]} numberOfLines={1}>
          {label}
        </Text>
        {primary && count > 0 ? (
          <View style={s.tradeCountBadge}>
            <Text style={s.tradeCountText}>{formatBadge(count)}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  pinnedHeader: { backgroundColor: color.homeTop },
  headerRow: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: color.homeTop,
  },
  wordmark: {
    color: color.homeOnGreen,
    fontFamily: font.displayBold,
    fontSize: 27,
    letterSpacing: 0,
    flexShrink: 1,
  },
  wordmarkDot: { color: color.homeYellow },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  leavesPill: {
    backgroundColor: color.homeYellow,
    borderColor: color.homeYellow,
    borderWidth: 0,
  },
  headerIconButton: {
    width: size.control.headerIcon,
    height: size.control.headerIcon,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: size.control.headerIcon / 2,
    backgroundColor: color.homeIconSurface,
  },
  headerBadge: {
    position: "absolute",
    top: -3,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: color.homeTop,
    backgroundColor: color.homeBadge,
  },
  headerBadgeText: {
    color: color.homeOnGreen,
    fontFamily: font.sansBold,
    fontSize: 10,
    includeFontPadding: false,
  },
  topBackground: { position: "relative", overflow: "visible", paddingBottom: 68 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.home.searchGap,
    paddingHorizontal: space.screenX,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 24,
    marginHorizontal: space.screenX,
  },
  greetingCopy: { flex: 1, minWidth: 0, justifyContent: "center" },
  dateLine: {
    color: color.homeOnGreenMuted,
    fontFamily: font.sansSemi,
    fontSize: 12,
    includeFontPadding: false,
  },
  greetingTitle: {
    marginTop: 8,
    color: color.homeOnGreen,
    fontFamily: font.displayBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: 0,
    includeFontPadding: false,
  },
  subtitle: {
    marginTop: 12,
    color: color.homeOnGreenMuted,
    fontFamily: font.sans,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  subtitleEmphasis: { color: color.homeYellow, fontFamily: font.sansBold },
  duckFrame: { flexShrink: 0, alignItems: "center", justifyContent: "center" },
  actionRow: {
    height: 51,
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
    marginHorizontal: space.screenX,
  },
  actionSlot: { height: 48, position: "relative" },
  primaryActionSlot: { flex: 1.16 },
  secondaryActionSlot: { flex: 0.84 },
  actionShadow: {
    position: "absolute",
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: 28,
    backgroundColor: color.homeOutline,
  },
  actionShadowPressed: { opacity: 0 },
  actionButton: {
    flex: 1,
    height: 48,
    borderWidth: 2.5,
    borderColor: color.homeOutline,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  primaryAction: { backgroundColor: color.homeYellow },
  secondaryAction: { backgroundColor: color.homeCream },
  actionButtonPressed: { transform: [{ translateX: 3 }, { translateY: 3 }] },
  actionText: { color: color.homeOutline, textAlign: "center" },
  tradeCountBadge: {
    position: "absolute",
    top: -9,
    right: 7,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: color.homeOutline,
    backgroundColor: color.homeBadge,
  },
  tradeCountText: { color: color.homeOnGreen, fontFamily: font.sansBold, fontSize: 10, includeFontPadding: false },
  curvedCreamEdge: {
    position: "absolute",
    left: -20,
    right: -20,
    bottom: -36,
    height: 68,
    borderRadius: 40,
    backgroundColor: color.homeCream,
  },
});