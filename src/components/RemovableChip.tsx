import { StyleSheet, Text } from "react-native";

import { CloseIcon } from "./icons";
import { Tappable } from "./Tappable";
import { border, color, icon, radius, textStyle, type } from "../theme/tokens";

/**
 * A filter that is on, drawn so that turning it off is the obvious thing to do
 * with it: its label, then a cross, and the whole chip is the tap target.
 *
 * Used where a filter is on but has no control of its own on screen -- the
 * search helper's "understood as" row, and Marketplace's perishable filter,
 * which only arrives from outside (there is no perishable chip on the rail).
 * A filter that is on and cannot be seen is a grid that is wrong for no
 * visible reason, so each of those surfaces shows one of these.
 */
export function RemovableChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <Tappable
      onPress={onRemove}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Remove this filter`}
      hitSlop={4}
      style={s.chip}
      pressedStyle={s.pressed}
    >
      <Text style={[textStyle(type.chip), s.label]} numberOfLines={1}>
        {label}
      </Text>
      <CloseIcon size={icon.clear.size - 4} stroke={icon.clear.stroke} color={color.forest} />
    </Tappable>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: radius.sheetOption,
    borderWidth: border.chip,
    borderColor: color.greenLine,
    backgroundColor: color.greenWash,
    maxWidth: 240,
  },
  pressed: { opacity: 0.75 },
  label: { color: color.forest, flexShrink: 1 },
});
