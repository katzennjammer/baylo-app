import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { border, color, radius, size, textStyle, type } from "../theme/tokens";

/**
 * The perishable window as a pill: "Ends tomorrow", "A few hours left".
 *
 * The label is a PHRASE from expiryTierLabel(), never ticking digits, so it is
 * set in the body font (`type.urgencyChip`), not monospace. Monospace is for
 * digits that change in place, like the item page's live clock.
 *
 * Its own fill and border, so it reads the same on a photo as on a panel. The
 * urgent pair is about 4.4:1, a hair under AA for 12 px text; that is
 * `color.urgent`'s to fix, app-wide, not this component's.
 *
 * Marketplace's grid tile draws it over the photo's bottom-left corner. Home's
 * Limited-time card draws the same pill inline; it predates this component
 * and can adopt it in its own change.
 */
export function CountdownPill({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.pill, style]} accessibilityLabel={label}>
      <Text
        style={[textStyle(type.urgencyChip), { color: color.urgent }]}
        numberOfLines={1}
        maxFontSizeMultiplier={size.home.overlayMaxFontScale}
      >
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    height: size.home.countdownPill,
    paddingHorizontal: size.home.countdownPillX,
    borderRadius: radius.countdownPill,
    backgroundColor: color.urgentWash,
    borderWidth: border.chip,
    borderColor: color.urgentLine,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
});
