import { StyleSheet, View } from "react-native";
import Svg, { Line } from "react-native-svg";

import { SwapIcon } from "./icons";
import { color, icon, size } from "../theme/tokens";

/**
 * The seam of a swap ticket: a dashed forest tear line, full height, with the
 * swap mark in a small forest disc on it. Drawn between the two halves of a
 * row; it takes a fixed width and stretches to the row's height.
 *
 * Shared by the listing screen's "You'd get / They want" ticket and the
 * Trades cards' "You give / You get" split, so the two read as one object.
 */
export function SwapSeam() {
  return (
    <View style={s.seam} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Line
          x1="50%"
          y1="0"
          x2="50%"
          y2="100%"
          stroke={color.forest}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      </Svg>
      <View style={s.disc}>
        <SwapIcon size={icon.tileBadge.size} stroke={icon.tileBadge.stroke} color={color.onScrim} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  seam: {
    width: size.home.countdownPill,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  disc: {
    width: size.home.countdownPill,
    height: size.home.countdownPill,
    borderRadius: size.home.countdownPill / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.forest,
  },
});
