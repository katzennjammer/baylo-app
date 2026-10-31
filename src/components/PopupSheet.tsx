import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MASCOT, type MascotPose } from "../media/mascots";
import { border, color, popup, radius, space, textStyle, type } from "../theme/tokens";
import { Tappable } from "./Tappable";

type PopupSheetProps = {
  visible: boolean;
  title: string;
  message?: string;
  icon?: ReactNode;
  pose?: MascotPose;
  liveSticker?: boolean;
  onDismiss?: () => void;
  dismissLabel?: string;
  children?: ReactNode;
};

export function PopupSheet({
  visible,
  title,
  message,
  icon,
  pose,
  liveSticker = false,
  onDismiss,
  dismissLabel,
  children,
}: PopupSheetProps) {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetY = useRef(new Animated.Value(height)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const mascotScale = useRef(new Animated.Value(1)).current;

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
    if (!visible) {
      sheetY.setValue(height);
      scrimOpacity.setValue(0);
      return;
    }

    if (reduceMotion === null) return;
    if (reduceMotion) {
      sheetY.setValue(0);
      scrimOpacity.setValue(1);
      return;
    }

    sheetY.setValue(height);
    scrimOpacity.setValue(0);
    const animation = Animated.parallel([
      Animated.timing(sheetY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scrimOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [height, reduceMotion, scrimOpacity, sheetY, visible]);

  useEffect(() => {
    if (!visible || !pose || reduceMotion !== false) {
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
  const errorPose = pose === "worry";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={s.scrim}
        onPress={onDismiss}
        accessibilityRole={onDismiss ? "button" : undefined}
        accessibilityLabel={onDismiss ? dismissLabel : undefined}
      >
        <Animated.View pointerEvents="none" style={[s.scrimFill, { opacity: scrimOpacity }]} />
        <Animated.View style={[s.sheetFrame, { transform: [{ translateY: sheetY }] }]}>
          <View pointerEvents="none" style={s.sheetShadow} />
          <Pressable
            onPress={() => {}}
            style={s.sheet}
            accessible={false}
            accessibilityViewIsModal
          >
            {pose ? (
              <Animated.View
                pointerEvents="none"
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[s.mascot, { transform: [{ scale: mascotScale }] }]}
              >
                <View style={s.mascotStage}>
                  <View
                    style={[
                      s.mascotWash,
                      { backgroundColor: errorPose ? color.urgentWash : color.homeYellow },
                    ]}
                  />
                  <Image source={MASCOT[pose]} contentFit="contain" style={s.mascotImage} />
                  {liveSticker ? (
                    <View style={s.liveSticker} accessibilityElementsHidden importantForAccessibility="no">
                      <Text style={[textStyle(type.primaryButton), s.liveStickerText]}>LIVE!</Text>
                    </View>
                  ) : null}
                </View>
              </Animated.View>
            ) : null}

            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              style={[s.scroll, { maxHeight: height - insets.top }]}
              contentContainerStyle={[
                s.content,
                {
                  paddingTop: posed ? popup.contentTop : space.sheet.top,
                  paddingBottom: insets.bottom + space.sheet.bottom,
                },
              ]}
            >
              {icon && !pose ? <View style={s.iconBadge}>{icon}</View> : null}
              <Text style={[textStyle(type.errorHeadline), s.title]} accessibilityRole="header">
                {title}
              </Text>
              {message ? <Text style={[textStyle(type.emptyBody), s.message]}>{message}</Text> : null}
              {children}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export function PopupActions({
  children,
  layout = "stacked",
}: {
  children: ReactNode;
  layout?: "single" | "row" | "stacked";
}) {
  return <View style={[s.actions, layout === "row" ? s.actionsRow : s.actionsStacked]}>{children}</View>;
}

export function PopupButton({
  label,
  tone,
  onPress,
  accessibilityLabel,
  containerStyle,
}: {
  label: string;
  tone: "primary" | "secondary" | "destructive";
  onPress: () => void;
  accessibilityLabel?: string;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.actionSlot, containerStyle]}>
      <View pointerEvents="none" style={s.buttonShadow} />
      <Tappable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        style={[s.button, tone === "secondary" ? s.secondaryButton : tone === "destructive" ? s.destructiveButton : s.primaryButton]}
        pressedStyle={s.buttonPressed}
      >
        <Text
          style={[
            textStyle(type.primaryButton),
            tone === "secondary" ? s.secondaryText : s.primaryText,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Tappable>
    </View>
  );
}

const s = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: "flex-end",
  },
  scrimFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.captionFill,
  },
  sheetFrame: {
    width: "100%",
    maxWidth: popup.sheetMaxWidth,
    alignSelf: "center",
    position: "relative",
    marginBottom: popup.shadowOffset,
    overflow: "visible",
  },
  sheetShadow: {
    position: "absolute",
    left: popup.shadowOffset,
    right: -popup.shadowOffset,
    top: popup.shadowOffset,
    bottom: -popup.shadowOffset,
    backgroundColor: color.homeOutline,
    borderTopLeftRadius: popup.sheetRadius,
    borderTopRightRadius: popup.sheetRadius,
  },
  sheet: {
    width: "100%",
    backgroundColor: color.homeCream,
    borderWidth: popup.outlineWidth,
    borderColor: color.homeOutline,
    borderTopLeftRadius: popup.sheetRadius,
    borderTopRightRadius: popup.sheetRadius,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: "visible",
  },
  scroll: { flexGrow: 0 },
  content: {
    paddingHorizontal: space.sheet.x,
    alignItems: "stretch",
  },
  mascot: {
    position: "absolute",
    top: popup.mascotTop,
    left: 0,
    right: 0,
    height: popup.mascotDiameter,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  mascotStage: {
    width: popup.mascotDiameter,
    height: popup.mascotDiameter,
    alignItems: "center",
    justifyContent: "center",
  },
  mascotWash: {
    position: "absolute",
    width: popup.mascotDiameter,
    height: popup.mascotOvalHeight,
    borderRadius: popup.mascotDiameter / 2,
  },
  mascotImage: {
    width: popup.mascotImageSize,
    height: popup.mascotImageSize,
  },
  liveSticker: {
    position: "absolute",
    top: popup.stickerY,
    right: -popup.stickerX,
    paddingHorizontal: popup.stickerX,
    paddingVertical: popup.stickerY,
    backgroundColor: color.homeBadge,
    borderWidth: border.d,
    borderColor: color.homeOutline,
    borderRadius: radius.trendingChip,
    transform: [{ rotate: "10deg" }],
  },
  liveStickerText: {
    color: color.homeOnGreen,
    fontSize: 12,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.dCategoryCircle,
    backgroundColor: color.urgentWash,
    borderWidth: border.d,
    borderColor: color.homeOutline,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: space.sheet.menuTop,
  },
  title: { color: color.homeOutline, textAlign: "center" },
  message: {
    color: color.inkSecondary,
    textAlign: "center",
    marginTop: space.sheet.titleToBody,
  },
  actions: { marginTop: space.sheet.actionsTop, gap: popup.buttonGap },
  actionsRow: { flexDirection: "row" },
  actionsStacked: { flexDirection: "column", alignItems: "stretch" },
  actionSlot: {
    position: "relative",
    height: popup.buttonHeight,
    overflow: "visible",
  },
  buttonShadow: {
    position: "absolute",
    left: popup.shadowOffset,
    right: -popup.shadowOffset,
    top: popup.shadowOffset,
    bottom: -popup.shadowOffset,
    borderRadius: popup.buttonRadius,
    backgroundColor: color.homeOutline,
  },
  button: {
    width: "100%",
    height: popup.buttonHeight,
    borderRadius: popup.buttonRadius,
    borderWidth: popup.outlineWidth,
    borderColor: color.homeOutline,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.chip.x,
  },
  primaryButton: { backgroundColor: color.homeTop },
  secondaryButton: { backgroundColor: color.homeCream },
  destructiveButton: { backgroundColor: color.urgent },
  primaryText: { color: color.homeOnGreen },
  secondaryText: { color: color.homeOutline },
  buttonPressed: {
    transform: [{ translateY: popup.shadowOffset / 2 }],
    opacity: 0.92,
  },
});
