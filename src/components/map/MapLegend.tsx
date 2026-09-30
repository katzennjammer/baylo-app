import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Tappable } from "../Tappable";

import {
  border,
  color,
  radius,
  space,
  textStyle,
  type,
} from "../../theme/tokens";
import { FALLBACK_GLYPH, GLYPH_BOX, GLYPHS } from "./map-html";

/**
 * What the pin glyphs mean.
 *
 * The map varies pins by hub TYPE and holds every one of them to the same
 * green, for the reasons in map-html.ts — one palette, and a map that still
 * works for someone who cannot separate the hues. The cost of that choice is
 * that a glyph has to be learned, and a shield is only obviously a police
 * station once somebody has told you. This is where they are told.
 *
 * THE MARKS ARE THE MAP'S OWN, imported rather than redrawn. `GLYPHS` is the
 * single definition; this renders it through react-native-svg and the map
 * renders it as inline SVG in the document. A legend that had its own copy
 * would drift the first time a glyph was tuned, and a legend that disagrees
 * with the map is worse than no legend.
 */

/**
 * Wire type → label, mirrored from the server's SAFE_ZONE_TYPE_LABELS.
 *
 * A HAND-KEPT COPY, like `CONDITIONS` in api/browse.ts, and for the same
 * reason: hubs carry a resolved `typeLabel`, which is enough to describe ONE
 * hub but not to enumerate the five types before any hub has loaded. The legend
 * has to be drawable on an empty map.
 */
const TYPE_LABELS: readonly { type: string; label: string }[] = [
  { type: "mall", label: "Mall" },
  { type: "barangay_hall", label: "Barangay hall" },
  { type: "police_station", label: "Police station" },
  { type: "public_plaza", label: "Public plaza" },
  { type: "transport_hub", label: "Transport hub" },
];

/** One glyph, at legend size, in the same green the active pins use. */
export function HubTypeGlyph({
  hubType,
  size: px,
  tint = color.forest,
}: {
  hubType: string;
  size: number;
  tint?: string;
}) {
  return (
    <Svg
      width={px}
      height={px}
      viewBox={`0 0 ${GLYPH_BOX} ${GLYPH_BOX}`}
      fill="none"
      stroke={tint}
      // Authored at 1.6 in a 16-unit box; scaled so the painted stroke stays
      // 1.6 real pixels at whatever `px` is. Same correction as icons.tsx.
      strokeWidth={(1.6 * GLYPH_BOX) / px}
      strokeLinecap="round"
      strokeLinejoin="round"
      pointerEvents="none"
    >
      <Path d={GLYPHS[hubType] ?? FALLBACK_GLYPH} />
    </Svg>
  );
}

export function MapLegend({
  selectedType = null,
  onSelectType,
}: {
  selectedType?: string | null;
  onSelectType?: (type: string | null) => void;
}) {
  const interactive = !!onSelectType;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      accessibilityRole={interactive ? "tablist" : "summary"}
      accessibilityLabel={interactive ? "Filter safe hubs by type" : "Map key: pin shapes by safe hub type"}
    >
      {interactive ? (
        <Tappable
          onPress={() => onSelectType?.(null)}
          accessibilityRole="tab"
          accessibilityState={{ selected: selectedType === null }}
          accessibilityLabel="All safe hubs"
          style={[s.entry, selectedType === null && s.entryOn]}
          pressedStyle={s.entryPressed}
        >
          <Text style={[textStyle(type.gridMeta), s.label, selectedType === null && s.labelOn]}>
            All
          </Text>
        </Tappable>
      ) : null}
      {TYPE_LABELS.map(({ type: hubType, label }) => (
        <Tappable
          key={hubType}
          onPress={interactive ? () => onSelectType?.(hubType) : undefined}
          disabled={!interactive}
          accessibilityRole={interactive ? "tab" : undefined}
          accessibilityState={interactive ? { selected: selectedType === hubType } : undefined}
          accessibilityLabel={interactive ? `Show ${label} safe hubs` : label}
          style={[s.entry, selectedType === hubType && s.entryOn]}
          pressedStyle={interactive ? s.entryPressed : undefined}
        >
          <HubTypeGlyph
            hubType={hubType}
            size={13}
            tint={selectedType === hubType ? color.onScrim : color.forest}
          />
          <Text style={[textStyle(type.gridMeta), s.label, selectedType === hubType && s.labelOn]}>
            {label}
          </Text>
        </Tappable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: {
    paddingHorizontal: space.screenX,
    gap: space.browse.chipGap,
    alignItems: "center",
  },
  // The grid chips' neutral outline (BrowseControls `chip`): control fill,
  // controlLine border, secondary ink. No mint fill and no glyph well.
  entry: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.card.nameToBadge,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.trendingChip,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    backgroundColor: color.control,
  },
  // Only the selected chip is solid: forest with white ink and glyph (about
  // 9.4:1). The old brand-green fill read as one more tinted box.
  entryOn: {
    borderColor: color.forest,
    backgroundColor: color.forest,
  },
  entryPressed: { opacity: 0.72 },
  label: { color: color.inkSecondary },
  labelOn: { color: color.onScrim },
});
