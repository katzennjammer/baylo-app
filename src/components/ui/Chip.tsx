import type { ComponentType } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { Tappable } from "../Tappable";
import { dColor, font, radius, size, space, textStyle, type } from "../../theme/tokens";

export interface CategoryChipIconProps {
  size: number;
  color: string;
}

export interface ChipProps {
  label: string;
  icon: ComponentType<CategoryChipIconProps>;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, icon: Icon, onPress, accessibilityLabel, style }: ChipProps) {
  const content = (
    <>
      <View style={styles.circle}>
        <Icon size={size.design.categoryIcon} color={dColor.forest} />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </>
  );

  if (!onPress) return <View style={[styles.container, style]}>{content}</View>;

  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={[styles.container, style]}
      pressedStyle={styles.pressed}
    >
      {content}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: size.design.categoryItem,
    alignItems: "center",
    gap: space.design.scale.xxs,
  },
  circle: {
    width: size.design.categoryCircle,
    height: size.design.categoryCircle,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.dCategoryCircle,
    backgroundColor: dColor.control,
  },
  label: {
    ...textStyle(type.dCaption),
    color: dColor.inkSecondary,
    textAlign: "center",
  },
  pressed: { opacity: 0.75 },
});
