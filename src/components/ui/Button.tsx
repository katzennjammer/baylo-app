import { StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { Tappable } from "../Tappable";
import { border, dColor, radius, size, space, textStyle, type } from "../../theme/tokens";

export type ButtonVariant = "primary" | "secondary" | "secondary-on-dark" | "text";

export interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  variant = "primary",
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const isPrimary = variant === "primary";
  const isText = variant === "text";
  const isOnDark = variant === "secondary-on-dark";
  const foreground = isPrimary || isOnDark ? dColor.onGreen : dColor.forest;

  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        isPrimary && styles.primary,
        variant === "secondary" && styles.secondary,
        isOnDark && styles.secondaryOnDark,
        isText && styles.textButton,
        disabled && styles.disabled,
        style,
      ]}
      pressedStyle={isPrimary ? styles.pressed : undefined}
    >
      <Text style={[textStyle(type.dButton), { color: foreground }]}>{label}</Text>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: size.design.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.design.scale.md,
    borderRadius: radius.dButton,
  },
  primary: {
    backgroundColor: dColor.forest,
    borderWidth: border.d,
    borderColor: dColor.forest,
  },
  secondary: {
    minHeight: size.design.secondaryButton,
    backgroundColor: dColor.searchSurface,
    borderWidth: border.d,
    borderColor: dColor.controlLine,
  },
  secondaryOnDark: {
    minHeight: size.design.secondaryButton,
    backgroundColor: "transparent",
    borderWidth: border.d,
    borderColor: dColor.onGreen,
  },
  textButton: { backgroundColor: "transparent", paddingHorizontal: 0 },
  pressed: { opacity: 0.86 },
  disabled: { opacity: 0.5 },
});
