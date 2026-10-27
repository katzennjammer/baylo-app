import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { Image } from "expo-image";

import { preloadMascotImages, MASCOT, type MascotPose } from "../media/mascots";
import { color, dark, radius, size, textStyle, type } from "../theme/tokens";
import { Tappable } from "./Tappable";

void preloadMascotImages();

export function NoticeDialog({
  visible,
  title,
  body,
  icon,
  onDismiss,
  pose,
  buttonLabel = "OK",
}: {
  visible: boolean;
  title: string;
  body: string;
  icon: React.ReactNode;
  onDismiss: () => void;
  pose?: MascotPose;
  buttonLabel?: string;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const mascotScale = useRef(new Animated.Value(1)).current;
  const isDark = useColorScheme() === "dark";

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
    if (!visible || !pose || reduceMotion) {
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
  }, [mascotScale, pose, reduceMotion, visible]);

  const posed = pose !== undefined;
  const surfaceColor = isDark ? dark.surface : color.surface;
  const titleColor = isDark ? dark.ink : color.ink;
  const bodyColor = isDark ? dark.secondary : color.inkSecondary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={s.scrim}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Pressable
          onPress={() => {}}
          style={[s.card, posed && s.posedCard, posed && { backgroundColor: surfaceColor }]}
          accessible={false}
        >
          {pose ? (
            <Animated.View
              pointerEvents="none"
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[s.mascot, { transform: [{ scale: mascotScale }] }]}
            >
              <View style={[s.mascotWash, { backgroundColor: isDark ? dark.greenWash : color.greenWash }]} />
              <Image source={MASCOT[pose]} contentFit="contain" style={s.mascotImage} />
            </Animated.View>
          ) : (
            <View style={s.badge}>{icon}</View>
          )}

          <Text
            style={[textStyle(type.errorHeadline), s.title, posed && { color: titleColor }]}
            accessibilityRole="header"
          >
            {title}
          </Text>
          <Text style={[textStyle(type.emptyBody), s.body, posed && { color: bodyColor }]}>{body}</Text>

          <Tappable
            onPress={onDismiss}
            accessibilityRole="button"
            style={s.ok}
            pressedStyle={s.okPressed}
          >
            <Text style={[textStyle(type.primaryButton), { color: color.onGreen }]}>{buttonLabel}</Text>
          </Tappable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: color.captionFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: color.surface,
    borderRadius: radius.sheet,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: "center",
  },
  posedCard: {
    paddingTop: 88,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: color.greenWash,
    borderWidth: 1,
    borderColor: color.greenLine,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  mascot: {
    position: "absolute",
    top: -50,
    left: 0,
    right: 0,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  mascotWash: {
    position: "absolute",
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  mascotImage: {
    width: 120,
    height: 120,
  },
  title: { color: color.ink, textAlign: "center" },
  body: { color: color.inkSecondary, textAlign: "center", marginTop: 8 },
  ok: {
    alignSelf: "stretch",
    height: size.control.primaryButton,
    borderRadius: radius.primaryButton,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  okPressed: { opacity: 0.85 },
});
