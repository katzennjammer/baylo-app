import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { passwordStrength, type StrengthLevel } from "../lib/password-strength";
import { color, textStyle, type } from "../theme/tokens";

const TONE: Record<StrengthLevel, string> = {
  weak: color.urgent,
  fair: color.accentGold,
  strong: color.accentGreen,
};

/**
 * Three bars and one line under a new-password field. Hidden while the field
 * is empty, so it never reads as an error before anything is typed. Advice
 * only -- see lib/password-strength for why it never blocks.
 */
export function PasswordStrengthMeter({ password, style }: { password: string; style?: StyleProp<ViewStyle> }) {
  if (!password) return null;
  const { level, bars, message } = passwordStrength(password);
  const tone = TONE[level];

  return (
    <View
      style={[s.wrap, style]}
      accessible
      accessibilityLabel={`Password strength. ${message}`}
      // Announced as it changes, without stealing focus from the field.
      accessibilityLiveRegion="polite"
    >
      <View style={s.bars}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={[s.bar, { backgroundColor: n <= bars ? tone : color.controlLine }]} />
        ))}
      </View>
      <Text style={[textStyle(type.metadata), { color: tone }]}>{message}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 8, gap: 6 },
  bars: { flexDirection: "row", gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
});
