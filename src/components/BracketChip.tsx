import { StyleSheet, Text, View } from "react-native";

import { color, font } from "../theme/tokens";
import { LeafIcon } from "./icons";

/**
 * A bracket as the dark leaf chip -- "Bracket 4" -- never the exact Leaf
 * value. The one look for a bracket on a trade surface: the offer screen's
 * two items, the offers list on a listing. `null` (an unvalued item) reads
 * "No bracket yet".
 */
export function BracketChip({ bracket, small = false }: { bracket: number | null; small?: boolean }) {
  return (
    <View style={[s.chip, small && s.chipSmall]}>
      <LeafIcon size={small ? 12 : 14} stroke={2.2} color={color.surface} />
      <Text style={[s.text, small && s.textSmall]}>{bracket != null ? `Bracket ${bracket}` : "No bracket yet"}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: color.ink,
  },
  chipSmall: { paddingHorizontal: 8, paddingVertical: 3, gap: 4 },
  text: { fontFamily: font.sansBold, fontSize: 13, color: color.surface },
  textSmall: { fontSize: 12 },
});
