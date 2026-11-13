import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";

import { color, textStyle, type } from "../theme/tokens";

/**
 * The PREMIUM tag: a small gold pill beside the name of anyone with a live
 * Premium or VIP term (13 Nov 2026).
 *
 * WHERE IT GOES: beside the name on a post, on the listing's seller row, on a
 * person's profile, and on a shop's storefront. It follows the LIVE term, not
 * the Premium Member achievement -- that badge stays on a profile for good
 * (see the Premium screen's perks), and this tag goes when the term does.
 *
 * `premium` comes from the server on every owner and public profile
 * (`owner.premium`, `user.premium`), and from `hasPremiumAccess()` for your own
 * profile. Absent reads as no tag, so an older server just shows none.
 *
 * ── THE SHINE ───────────────────────────────────────────────────────────────
 *
 * A light streak sweeps across, then rests -- 45% of the cycle moving, the rest
 * still -- so a feed of tags does not read as a page of flashing things.
 *
 * ONE ANIMATION FOR EVERY TAG ON SCREEN. They all read the same value, so a
 * feed with twenty tags runs one native timer, and the tags shine together
 * rather than as twenty out-of-step loops. The timer runs only while at least
 * one tag is mounted.
 *
 * REDUCE MOTION turns the streak off entirely, leaving the static gold pill;
 * the tag carries no meaning in the motion.
 */

const SWEEP_MS = 3400;
/** Where in the cycle the streak starts moving; before it, the tag rests. */
const REST_UNTIL = 0.55;
/** The streak's width as a share of the tag's. */
const STREAK_SHARE = 0.45;

const sweep = new Animated.Value(0);
let watching = 0;
let loop: Animated.CompositeAnimation | null = null;

function startSweep() {
  watching += 1;
  if (watching !== 1) return;
  loop = Animated.loop(
    Animated.timing(sweep, {
      toValue: 1,
      duration: SWEEP_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }),
  );
  loop.start();
}

function stopSweep() {
  watching = Math.max(0, watching - 1);
  if (watching !== 0) return;
  loop?.stop();
  loop = null;
  sweep.setValue(0);
}

/** True until the OS says otherwise, so nothing moves for a frame it should not. */
function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (alive) setReduced(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

export function PremiumTag({ size = "small" }: { size?: "small" | "large" }) {
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const large = size === "large";

  useEffect(() => {
    if (reduceMotion) return;
    startSweep();
    return stopSweep;
  }, [reduceMotion]);

  const streak = Math.round(width * STREAK_SHARE);
  const translateX = sweep.interpolate({
    inputRange: [0, REST_UNTIL, 1],
    outputRange: [-streak, -streak, width],
  });

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel="Premium member"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[s.pill, large ? s.pillLarge : s.pillSmall]}
    >
      <LinearGradient
        colors={[color.premiumStart, color.premiumMid, color.premiumEnd]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {!reduceMotion && width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[s.streak, { width: streak, transform: [{ translateX }] }]}
        >
          <LinearGradient
            colors={[color.premiumShineClear, color.premiumShine, color.premiumShineClear]}
            start={{ x: 0, y: 0.4 }}
            end={{ x: 1, y: 0.6 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
      <Text style={[textStyle(large ? type.premiumTagLarge : type.premiumTag), s.text]} allowFontScaling={false}>
        PREMIUM
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    flexShrink: 0,
    alignSelf: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: color.premiumEdge,
  },
  pillSmall: { height: 18, paddingHorizontal: 7, borderRadius: 9 },
  pillLarge: { height: 22, paddingHorizontal: 9, borderRadius: 11 },
  streak: { position: "absolute", top: 0, bottom: 0, left: 0 },
  text: { color: color.premiumInk },
});
