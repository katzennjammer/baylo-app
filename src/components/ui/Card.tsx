import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";

import { border, dColor, radius, shadow, space } from "../../theme/tokens";

export interface CardProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Card({ children, style, contentStyle, ...viewProps }: CardProps) {
  return (
    <View {...viewProps} style={[styles.card, style]}>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: dColor.searchSurface,
    borderColor: dColor.divider,
    borderWidth: border.d,
    borderRadius: radius.dCard,
    ...shadow.card,
  },
  content: { padding: space.design.scale.sm },
});
