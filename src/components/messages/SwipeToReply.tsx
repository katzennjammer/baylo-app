import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRef, type ReactNode } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";

import { color } from "../../theme/tokens";
import { Tappable } from "../Tappable";

/** How far a bubble must travel to count as "reply". */
const TRIGGER = 64;
/** The most it moves, however far the finger goes. */
const MAX = 84;

/**
 * Swipe a message right to reply (4 Nov 2026), Messenger-style: the bubble
 * slides with the finger, a reply arrow fades in behind it, and letting go
 * past the line starts a reply to that message.
 *
 * PanResponder rather than react-native-gesture-handler: the app has no
 * GestureHandlerRootView, and a plain responder needs no native setup. It
 * only claims a drag that is clearly sideways and rightwards, so the chat
 * still scrolls normally.
 */
export function SwipeToReply({
  onReply,
  enabled = true,
  children,
}: {
  onReply: () => void;
  enabled?: boolean;
  children: ReactNode;
}) {
  const dx = useRef(new Animated.Value(0)).current;
  const passed = useRef(false);
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => enabled && g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onMoveShouldSetPanResponderCapture: (_e, g) => enabled && g.dx > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 2.5,
      onPanResponderMove: (_e, g) => {
        const x = Math.max(0, Math.min(MAX, g.dx));
        dx.setValue(x);
        if (x >= TRIGGER && !passed.current) {
          passed.current = true;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        } else if (x < TRIGGER) {
          passed.current = false;
        }
      },
      onPanResponderRelease: () => {
        if (passed.current) onReplyRef.current();
        passed.current = false;
        Animated.spring(dx, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      },
      onPanResponderTerminate: () => {
        passed.current = false;
        Animated.spring(dx, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminationRequest: () => true,
    }),
  ).current;
  // The responder is created once; the callback it calls must stay current.
  const onReplyRef = useRef(onReply);
  onReplyRef.current = onReply;

  return (
    <View>
      <Animated.View
        pointerEvents="none"
        style={[
          s.arrow,
          { opacity: dx.interpolate({ inputRange: [0, TRIGGER], outputRange: [0, 1], extrapolate: "clamp" }) },
        ]}
      >
        <Ionicons name="arrow-undo" size={18} color={color.forest} />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: dx }] }} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

/**
 * What a reply answers, shown above it: who said it and the first line.
 * Tapping jumps to the original.
 */
export function QuotedReply({
  label,
  text,
  mine,
  onPress,
}: {
  /** "You replied to John" / "John replied to you". */
  label: string;
  text: string;
  mine: boolean;
  onPress?: () => void;
}) {
  return (
    <Tappable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${text}. Jump to it`}
      style={[s.quoteWrap, mine ? s.quoteMine : s.quoteTheirs]}
    >
      <View style={s.quoteLabelRow}>
        <Ionicons name="arrow-undo" size={11} color={color.inkSecondary} />
        <Text style={s.quoteLabel} numberOfLines={1}>{label}</Text>
      </View>
      {/* The quote sits behind the reply bubble, peeking out above it. */}
      <View style={s.quote}>
        <Text style={s.quoteText} numberOfLines={2}>{text}</Text>
      </View>
    </Tappable>
  );
}

const s = StyleSheet.create({
  arrow: {
    position: "absolute",
    left: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  quoteWrap: { maxWidth: "72%", gap: 2, marginBottom: -10 },
  quoteMine: { alignSelf: "flex-end", alignItems: "flex-end", marginRight: 12 },
  quoteTheirs: { alignSelf: "flex-start", alignItems: "flex-start", marginLeft: 46 },
  quoteLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  quoteLabel: { fontSize: 11, color: color.inkSecondary },
  quote: { paddingHorizontal: 12, paddingTop: 7, paddingBottom: 14, borderRadius: 14, backgroundColor: "#ECEAE2" },
  quoteText: { fontSize: 13, color: color.inkSecondary },
});
