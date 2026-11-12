import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useIsFocused } from "expo-router";
import type * as ExpoBattery from "expo-battery";

import { MASCOT } from "../../media/mascots";
import { videoKit } from "../../media/video-kit";
import { VideoFallback } from "../../media/VideoFallback";
import { Tappable } from "../Tappable";
import { color, radius, space, textStyle, type } from "../../theme/tokens";

let batteryKit: typeof ExpoBattery | null = null;
try {
  // Keep the screen usable in an installed shell that predates this native module.
  batteryKit = require("expo-battery") as typeof ExpoBattery;
} catch (error) {
  console.warn("[home mascot] expo-battery is unavailable:", error);
}

export function HeroBanner({
  pendingTradeCount,
  leavesBalance,
  firstName,
  onViewTrades,
  onExploreFood,
}: {
  pendingTradeCount: number | null;
  leavesBalance: number | null;
  firstName: string | null | undefined;
  onViewTrades: () => void;
  onExploreFood: () => void;
}) {
  const focused = useIsFocused();
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [powerSaver, setPowerSaver] = useState<boolean | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [videoFailed, setVideoFailed] = useState(false);
  const textOpacity = useRef(new Animated.Value(0)).current;
  const hasRevealedMessage = useRef(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (enabled) => {
        if (alive) setReduceMotion(enabled);
      },
      (error: unknown) => {
        console.warn("[home mascot] reduced-motion status could not be read:", error);
        if (alive) setReduceMotion(false);
      },
    );
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!batteryKit) {
      setPowerSaver(false);
      return;
    }

    let alive = true;
    let subscription: ReturnType<typeof batteryKit.addLowPowerModeListener> | null = null;
    try {
      subscription = batteryKit.addLowPowerModeListener(({ lowPowerMode }) => {
        setPowerSaver(lowPowerMode);
      });
      void batteryKit.isLowPowerModeEnabledAsync().then(
        (enabled) => {
          if (alive) setPowerSaver(enabled);
        },
        (error: unknown) => {
          console.warn("[home mascot] power-saver status could not be read:", error);
          if (alive) setPowerSaver(false);
        },
      );
    } catch (error) {
      console.warn("[home mascot] power-saver monitoring could not start:", error);
      setPowerSaver(false);
    }
    return () => {
      alive = false;
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
    });
    return () => subscription.remove();
  }, []);

  const message =
    pendingTradeCount !== null && pendingTradeCount > 0
      ? `You've got ${pendingTradeCount} ${pendingTradeCount === 1 ? "trade" : "trades"} waiting for a reply. Check them before they expire.`
      : leavesBalance !== null
        ? `You've got ${leavesBalance} Leaves ready to put toward your next trade.`
        : "A good barter starts with something you no longer need.";

  useEffect(() => {
    if (hasRevealedMessage.current) return;
    if (reduceMotion === true) {
      textOpacity.setValue(1);
      hasRevealedMessage.current = true;
      return;
    }
    if (reduceMotion === false && message) {
      const animation = Animated.timing(textOpacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      });
      animation.start(({ finished }) => {
        if (finished) hasRevealedMessage.current = true;
      });
      return () => animation.stop();
    }
  }, [message, reduceMotion, textOpacity]);

  const resolvedName = firstName?.trim().split(/\s+/)[0] || "there";
  const now = new Date();
  const date = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const videoEnabled = reduceMotion === false && powerSaver === false;
  const failVideo = useCallback(() => setVideoFailed(true), []);

  return (
    <View style={s.card}>
      <View style={s.greeting}>
        <Text style={[textStyle(type.metadata), s.date]} numberOfLines={1}>
          {date}
        </Text>
        <Text style={[textStyle(type.heroTitle), s.greetingText]} numberOfLines={1}>
          {greeting}, {resolvedName}!
        </Text>
      </View>

      <View style={s.contentRow}>
        <View style={s.duckFrame}>
          {videoEnabled && !videoFailed && videoKit ? (
            <VideoFallback what="Home mascot video" fallback={<MascotFallback />}>
              <WaveVideo
                focused={focused && foreground}
                onFailure={failVideo}
              />
            </VideoFallback>
          ) : videoFailed || reduceMotion === true || powerSaver === true || !videoKit ? (
            <MascotFallback />
          ) : null}
        </View>

        <View style={s.bubbleRow}>
          <View style={s.bubbleTail} />
          <View style={s.bubble}>
            <Animated.Text
              style={[textStyle(type.metadata), s.message, { opacity: textOpacity }]}
              numberOfLines={3}
              ellipsizeMode="tail"
            >
              {message}
            </Animated.Text>
          </View>
        </View>
      </View>

      <View style={s.actions}>
        <Tappable
          onPress={onViewTrades}
          accessibilityRole="button"
          style={s.primaryAction}
          pressedStyle={s.primaryPressed}
        >
          <Text style={[textStyle(type.metadata), s.primaryText]}>View trades</Text>
        </Tappable>
        <Tappable
          onPress={onExploreFood}
          accessibilityRole="button"
          style={s.secondaryAction}
          pressedStyle={s.secondaryPressed}
        >
          <Text style={[textStyle(type.metadata), s.secondaryText]}>Explore food</Text>
        </Tappable>
      </View>
    </View>
  );
}

function MascotFallback() {
  return (
    <Image
      source={MASCOT.celebrate}
      contentFit="contain"
      style={s.fallbackDuck}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

function WaveVideo({ focused, onFailure }: { focused: boolean; onFailure: () => void }) {
  if (!videoKit) return null;
  return <WaveVideoInner focused={focused} onFailure={onFailure} />;
}

function WaveVideoInner({ focused, onFailure }: { focused: boolean; onFailure: () => void }) {
  const { VideoView, useVideoPlayer } = videoKit!;
  const player = useVideoPlayer(MASCOT.wave, (createdPlayer) => {
    createdPlayer.loop = true;
    createdPlayer.muted = true;
    createdPlayer.keepScreenOnWhilePlaying = false;
  });

  useEffect(() => {
    const subscription = player.addListener("statusChange", ({ status, error }) => {
      if (status !== "error") return;
      console.warn("[home mascot] video playback failed:", error?.message ?? "unknown video error");
      onFailure();
    });
    if (player.status === "error") {
      console.warn("[home mascot] video player entered error state");
      onFailure();
    }
    return () => subscription.remove();
  }, [onFailure, player]);

  useEffect(() => {
    try {
      if (focused) player.play();
      else player.pause();
    } catch (error) {
      console.warn("[home mascot] video playback command failed:", error);
      onFailure();
    }
  }, [focused, onFailure, player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      surfaceType="surfaceView"
      useExoShutter={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    />
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: space.screenX,
    borderRadius: 20,
    overflow: "hidden",
    padding: 14,
    backgroundColor: color.mascotGreen,
  },
  greeting: {
    marginBottom: 10,
  },
  date: { color: color.onScrim, opacity: 0.82 },
  greetingText: { color: color.onScrim, marginTop: 2 },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  duckFrame: {
    position: "relative",
    width: 110,
    height: 110,
    flexShrink: 0,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackDuck: {
    width: 110,
    height: 110,
  },
  bubbleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  bubbleTail: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 9,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: color.searchSurface,
  },
  bubble: {
    flex: 1,
    minWidth: 0,
    minHeight: 76,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: color.searchSurface,
  },
  message: { color: color.ink, flexShrink: 1 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  primaryAction: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: radius.heroCta,
    backgroundColor: color.searchSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: color.mascotGreen },
  primaryPressed: { opacity: 0.82 },
  secondaryAction: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: radius.heroCta,
    borderWidth: 1,
    borderColor: color.onScrim,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: color.onScrim },
  secondaryPressed: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
});
