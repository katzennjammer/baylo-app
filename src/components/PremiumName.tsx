import type { ReactNode } from "react";
import { View, Text, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { PremiumTag } from "./PremiumTag";

/**
 * A name with the gold PREMIUM tag beside it (13 Nov 2026), for every place a
 * person's name stands on its own: a card title, a list row, a header. The
 * name shrinks and truncates first; the tag never does.
 *
 * Not for a name inside a sentence ("Waiting for John…"): a badge mid-line
 * reads badly, so those stay plain text.
 */
export function PremiumName({
  premium,
  style,
  rowStyle,
  numberOfLines = 1,
  children,
}: {
  premium?: boolean;
  style?: StyleProp<TextStyle>;
  rowStyle?: StyleProp<ViewStyle>;
  numberOfLines?: number;
  children: ReactNode;
}) {
  if (!premium) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {children}
      </Text>
    );
  }
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 }, rowStyle]}>
      <Text style={[style, { flexShrink: 1 }]} numberOfLines={numberOfLines}>
        {children}
      </Text>
      <PremiumTag />
    </View>
  );
}
