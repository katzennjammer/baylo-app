import { StyleSheet, Text, View } from "react-native";

import { border, color, size, space, textStyle, type } from "../theme/tokens";

/**
 * The stand-in for a tab that has not been built.
 *
 * It says what it is and that it is not finished, rather than rendering an
 * empty state that looks like a working screen with no data — the two are
 * indistinguishable to anyone reviewing the app, and only one of them is true.
 *
 * Dressed from the Direction 1 tokens because these screens sit behind the new
 * bar and under the new header, and a placeholder in the previous palette reads
 * as a rendering bug rather than as unbuilt work. The mark is a caller-supplied
 * glyph from `icons.tsx`, so the stroke weights match the rest of the chrome.
 */
export function Placeholder({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  /** The screen's glyph, already sized and coloured by the caller. */
  children?: React.ReactNode;
}) {
  return (
    <View style={s.wrap}>
      {children ? <View style={s.circle}>{children}</View> : null}
      <Text style={[textStyle(type.emptyHeadline), s.title]}>{title}</Text>
      <Text style={[textStyle(type.emptyBody), s.blurb]}>{blurb}</Text>
      <Text style={[textStyle(type.sectionEyebrow), s.note]}>NOT BUILT YET</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surface,
    paddingHorizontal: space.empty.x,
  },
  circle: {
    width: size.errorIconCircle,
    height: size.errorIconCircle,
    borderRadius: size.errorIconCircle / 2,
    borderWidth: border.chip,
    borderColor: color.greenLine,
    backgroundColor: color.greenWash,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { marginTop: space.empty.iconToHeadline, textAlign: "center", color: color.ink },
  blurb: { marginTop: space.empty.headlineToBody, textAlign: "center", color: color.inkSecondary },
  note: { marginTop: space.empty.bodyToButton, color: color.inkMuted },
});
