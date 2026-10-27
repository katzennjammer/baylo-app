import { Image } from "expo-image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";

import { preloadMascotImages, MASCOT, type MascotPose } from "../media/mascots";
import { color, dark, radius, size as tokensSize, space, textStyle, type } from "../theme/tokens";
import { Tappable } from "./Tappable";

void preloadMascotImages();

type MascotEmptyAction = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

export function MascotEmptyState({
  pose,
  title,
  message,
  action,
  size = 130,
  children,
}: {
  pose: MascotPose;
  title: string;
  message: string;
  action?: MascotEmptyAction;
  size?: number;
  children?: ReactNode;
}) {
  const [reduceMotion, setReduceMotion] = useState(true);
  const mascotScale = useRef(new Animated.Value(1)).current;
  const isDark = useColorScheme() === "dark";
  const { width } = useWindowDimensions();
  const imageSize = Math.min(size, width < 380 ? 110 : size);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (alive) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      mascotScale.setValue(1);
      return;
    }

    mascotScale.setValue(0.8);
    const animation = Animated.sequence([
      Animated.timing(mascotScale, {
        toValue: 1.05,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(mascotScale, {
        toValue: 1,
        speed: 20,
        bounciness: 5,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [mascotScale, pose, reduceMotion]);

  return (
    <View style={s.wrap}>
      <Animated.View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          s.mascot,
          { width: imageSize, height: imageSize, transform: [{ scale: mascotScale }] },
        ]}
      >
        <View
          style={[
            s.wash,
            {
              width: imageSize * 0.88,
              height: imageSize * 0.88,
              borderRadius: imageSize * 0.44,
              backgroundColor: isDark ? dark.greenWash : color.greenWash,
            },
          ]}
        />
        <Image source={MASCOT[pose]} contentFit="contain" style={{ width: imageSize, height: imageSize }} />
      </Animated.View>

      <Text style={[textStyle(type.emptyHeadline), s.title, { color: isDark ? dark.ink : color.ink }]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[textStyle(type.emptyBody), s.message, { color: isDark ? dark.secondary : color.inkSecondary }]}>
        {message}
      </Text>

      {action ? (
        <Tappable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          style={s.action}
          pressedStyle={s.actionPressed}
        >
          <Text style={[textStyle(type.emptyPrimaryButton), { color: color.onGreen }]}>
            {action.label}
          </Text>
        </Tappable>
      ) : null}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingHorizontal: space.empty.x,
    paddingVertical: space.empty.bodyToButton,
  },
  mascot: {
    alignItems: "center",
    justifyContent: "center",
  },
  wash: {
    position: "absolute",
  },
  title: {
    marginTop: space.empty.iconToHeadline,
    textAlign: "center",
  },
  message: {
    marginTop: space.empty.headlineToBody,
    textAlign: "center",
  },
  action: {
    alignSelf: "stretch",
    height: tokensSize.control.emptyPrimaryButton,
    borderRadius: radius.emptyPrimaryButton,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.empty.bodyToButton,
  },
  actionPressed: { opacity: 0.85 },
});
