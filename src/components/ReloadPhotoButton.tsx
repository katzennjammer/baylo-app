import { StyleSheet, Text } from "react-native";

import { RefreshIcon } from "./icons";
import { Tappable } from "./Tappable";
import { border, color, icon, radius, size, space, textStyle, type } from "../theme/tokens";

/**
 * The retry button inside a failed photo box. FeedCard's "Tap to reload",
 * shortened to "Reload" so it fits a two-up grid tile. It sits on top of the
 * tile's own press target, so tapping elsewhere on the tile still opens it.
 */
export function ReloadPhotoButton({ onPress }: { onPress: () => void }) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Reload photo"
      style={s.button}
      pressedStyle={s.pressed}
    >
      <RefreshIcon size={icon.retryPhoto.size} stroke={icon.retryPhoto.stroke} color={color.ink} />
      <Text style={[textStyle(type.secondaryButton), { color: color.ink }]}>Reload</Text>
    </Tappable>
  );
}

const s = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.card.socialGap,
    height: size.control.reloadButton,
    paddingHorizontal: size.control.reloadButtonX,
    borderRadius: radius.reloadButton,
    borderWidth: border.chip,
    borderColor: color.controlLineStrong,
    backgroundColor: color.surface,
  },
  pressed: { backgroundColor: color.control },
});
