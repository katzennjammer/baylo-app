import { memo, useEffect, useState, type ReactNode } from "react";
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
import { Image } from "expo-image";
import Svg, { Circle, Defs, Path, Pattern, Rect } from "react-native-svg";
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
  searchSuggestions: ReactNode;
  onFilterPress: () => void;
  pendingTradeCount: number | null;
  leavesBalance: number | null;
  firstName: string | null | undefined;
  onViewTrades: () => void;
  onExploreFood: () => void;
};

const DUCK_WAVE_CANVAS_SIZE = 400;
const DUCK_WAVE_CONTENT_BOUNDS = { left: 92, top: 48, right: 318, bottom: 374 };
const DUCK_TEXT_GAP = 8;

export function HomePinnedHeader({ scrollY }: { scrollY: Animated.Value }) {
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
  const backgroundOpacity = scrollY.interpolate({
    inputRange: [0, space.home.headerFadeDistance],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={[s.pinnedHeader, { paddingTop: insets.top }]}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, s.pinnedHeaderFill, { opacity: backgroundOpacity }]}
      />
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
  searchSuggestions,
  onFilterPress,
  pendingTradeCount,
  leavesBalance,
  firstName,
  onViewTrades,
  onExploreFood,
}: HomeTopSectionProps) {
  const { width } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const resolvedName = firstName?.trim().split(/\s+/)[0] || "there";
  const now = new Date();
  const weekday = now.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const monthDay = now.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  const duckHeight = space.home.mascotVisibleHeight;
  const duckWidth = (duckHeight * 262) / 319;
  const duckBoxSize =
    duckHeight /
    ((DUCK_WAVE_CONTENT_BOUNDS.bottom - DUCK_WAVE_CONTENT_BOUNDS.top) / DUCK_WAVE_CANVAS_SIZE);
  const showWave = reduceMotion === false;
  const duckVisibleWidth = showWave
    ? duckBoxSize *
      ((DUCK_WAVE_CONTENT_BOUNDS.right - DUCK_WAVE_CONTENT_BOUNDS.left) / DUCK_WAVE_CANVAS_SIZE)
    : duckWidth;
  const duckFrameStyle = showWave
    ? {
        width: duckBoxSize,
        height: duckBoxSize,
        right: -duckBoxSize * (1 - DUCK_WAVE_CONTENT_BOUNDS.right / DUCK_WAVE_CANVAS_SIZE),
        bottom: -duckBoxSize * (1 - DUCK_WAVE_CONTENT_BOUNDS.bottom / DUCK_WAVE_CANVAS_SIZE),
      }
    : { width: duckWidth, height: duckHeight, right: 0, bottom: 0 };

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

  const pending = pendingTradeCount !== null && pendingTradeCount > 0;

  return (
    <View style={s.topBackground}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Pattern id="homeDots" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
            <Circle cx="2" cy="2" r="1" fill={color.homePattern} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#homeDots)" />
      </Svg>

      <View style={{ paddingTop: space.home.top }}>
        <View style={s.searchContainer}>
          <View style={s.searchRow}>
            <SearchField
              value={searchValue}
              onChange={onSearchChange}
              onSubmit={onSearchSubmit}
              placeholder="Search items or traders"
              accessibilityLabel="Search items or traders"
              variant="home"
            />
            <FilterButton count={0} onPress={onFilterPress} variant="home" />
          </View>
          {searchSuggestions ? (
            <View pointerEvents="box-none" style={s.searchSuggestions}>
              {searchSuggestions}
            </View>
          ) : null}
        </View>

        <View style={[s.greetingRow, { minHeight: duckHeight }]}>
          <View style={[s.greetingCopy, { paddingRight: duckVisibleWidth + DUCK_TEXT_GAP }]}>
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
          <View
            style={[s.duckFrame, duckFrameStyle]}
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <HomeMascot
              showWave={showWave}
              duckBoxSize={duckBoxSize}
              duckWidth={duckWidth}
              duckHeight={duckHeight}
            />
          </View>
        </View>

        <View style={s.actionArea}>
          <Svg
            width={width}
            height={space.home.archHeight}
            style={s.arch}
            pointerEvents="none"
          >
            <Path
              d={`M 0 ${space.home.archRise} Q ${width / 2} ${-space.home.archRise} ${width} ${space.home.archRise} L ${width} ${space.home.archHeight} L 0 ${space.home.archHeight} Z`}
              fill={color.surface}
            />
          </Svg>
          <View style={s.actionRow}>
            <HomeActionButton label="View trades" onPress={onViewTrades} count={pendingTradeCount ?? 0} primary />
            <HomeActionButton label="Explore food" onPress={onExploreFood} />
          </View>
        </View>
      </View>
    </View>
  );
}

const HomeMascot = memo(function HomeMascot({
  showWave,
  duckBoxSize,
  duckWidth,
  duckHeight,
}: {
  showWave: boolean;
  duckBoxSize: number;
  duckWidth: number;
  duckHeight: number;
}) {
  const [waveFailed, setWaveFailed] = useState(false);
  const animate = showWave && !waveFailed;
  return (
    <Image
      source={animate ? MASCOT.waveWebp : MASCOT.celebrateTrimmed}
      contentFit="contain"
      autoplay={animate}
      onError={
        animate
          ? (event) => {
              console.warn(
                "[home] animated duck failed to load; falling back to static mascot:",
                event.error,
              );
              setWaveFailed(true);
            }
          : undefined
      }
      style={{
        width: animate ? duckBoxSize : duckWidth,
        height: animate ? duckBoxSize : duckHeight,
      }}
    />
  );
});

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
  pinnedHeader: { backgroundColor: "transparent" },
  pinnedHeaderFill: { backgroundColor: color.homeTop },
  headerRow: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
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
  topBackground: { position: "relative", overflow: "visible" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.home.searchGap,
    paddingHorizontal: space.screenX,
  },
  searchContainer: { zIndex: 10, elevation: 10 },
  searchSuggestions: {
    position: "absolute",
    top: size.home.searchControl + 6,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    marginTop: 24,
    marginHorizontal: space.screenX,
  },
  greetingCopy: { flex: 1, minWidth: 0, justifyContent: "flex-end" },
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
  duckFrame: { position: "absolute", alignItems: "center", justifyContent: "flex-end" },
  actionArea: { position: "relative", marginTop: space.home.actionTop },
  arch: { position: "absolute", top: -space.home.archButtonOffset, left: 0, zIndex: 0 },
  actionRow: {
    height: 51,
    flexDirection: "row",
    gap: 8,
    marginHorizontal: space.screenX,
    zIndex: 1,
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
});