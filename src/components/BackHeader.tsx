import { StyleSheet, Text, View } from "react-native";

import { ChevronLeftIcon } from "./icons";
import { Tappable } from "./Tappable";
import { border, color, icon, size, space, textStyle, type } from "../theme/tokens";

/**
 * The back row of a screen pushed over the tabs: Settings and the screens it
 * opens.
 *
 * hubs.tsx's row, value for value — the app's own chevron in a 44 px round
 * Tappable, the title in `sheetTitle`, an optional one-line subtitle — with a
 * hairline under it, because these screens scroll rows up beneath it.
 *
 * It exists so Settings, Blocked users and Achievements cannot drift apart
 * again: they were three copies of an Ionicons chevron beside a 13 px title,
 * and Settings alone was redrawn.
 *
 * The caller adds the status-bar inset; this is only the row.
 */
export function BackHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  return (
    <View style={s.header}>
      <Tappable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={s.back}
        pressedStyle={s.pressed}
      >
        <ChevronLeftIcon size={icon.back.size} stroke={icon.back.stroke} color={color.ink} />
      </Tappable>
      <View style={s.text}>
        <Text style={[textStyle(type.sheetTitle), s.title]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text style={[textStyle(type.hubLandmark), s.subtitle]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.header.gap,
    paddingLeft: space.screenXTight,
    paddingRight: space.screenX,
    // A floor, not a height: a subtitle makes the row taller.
    minHeight: size.control.headerIcon,
    paddingBottom: space.header.bottom / 2,
    borderBottomWidth: border.hairline,
    borderBottomColor: color.divider,
  },
  back: {
    width: size.detail.backButton,
    height: size.detail.backButton,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: size.detail.backButton / 2,
  },
  pressed: { backgroundColor: color.control },
  text: { flex: 1, minWidth: 0 },
  title: { color: color.ink },
  subtitle: { color: color.inkMuted, marginTop: 1 },
});
