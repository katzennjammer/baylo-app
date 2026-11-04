import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { dColor, font, radius, size, space, textStyle, type } from "../../theme/tokens";

export type BadgeVariant = "leaves" | "bracket" | "count";

export type BadgeProps =
  | {
      variant: Exclude<BadgeVariant, "count">;
      label: string;
      style?: StyleProp<ViewStyle>;
    }
  | {
      variant: "count";
      count: number | string;
      style?: StyleProp<ViewStyle>;
    };

export function Badge(props: BadgeProps) {
  if (props.variant === "count") {
    const value = String(props.count);
    return (
      <View
        accessibilityRole="text"
        accessibilityLabel={`${value} ${value === "1" ? "notification" : "notifications"}`}
        style={[styles.count, props.style]}
      >
        <Text style={styles.countText} numberOfLines={1}>
          {value}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, props.style]}>
      <Text style={styles.label} numberOfLines={1}>
        {props.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: space.design.scale.xs,
    paddingVertical: space.design.scale.xxs,
    borderRadius: radius.dBadge,
    backgroundColor: dColor.greenWash,
  },
  label: {
    ...textStyle(type.dSmall),
    fontFamily: font.figtreeSemi,
    color: dColor.accentText,
  },
  count: {
    width: size.design.notification,
    height: size.design.notification,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: size.design.notification,
    backgroundColor: dColor.danger,
  },
  countText: {
    ...textStyle(type.dCount),
    color: dColor.onGreen,
    textAlign: "center",
  },
});
