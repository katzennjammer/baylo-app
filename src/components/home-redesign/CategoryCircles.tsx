import { ScrollView, StyleSheet, Text, View } from "react-native";

import { FALLBACK_CATEGORY_ICON, HOME_CATEGORY_ICONS } from "./category-icon-map";
import { Tappable } from "../Tappable";
import { dColor, homeCategoryTile, space, textStyle, type } from "../../theme/tokens";

/**
 * The Home category row: compact, horizontally scrollable category tiles.
 *
 * SAME DATA SOURCE AS CategoryRail — `useBrowse().facets`, which the server
 * computes unfiltered — so a category with nothing in it never shows, and the
 * row does not reflow as it is used. Labels are the server's.
 *
 * ── A SHORTCUT, NOT A MODE (30 Sep 2026) ─────────────────────────────────
 *
 * Tapping a circle opens Marketplace filtered to that category, the way a
 * food-delivery app's category row does. It used to switch Home's one section
 * between Exclusive and that category's boosts, which is why this row had a
 * lit state and an Exclusive circle at its head. Exclusive and Featured are
 * each their own section now, always on screen, so there is nothing for the
 * row to switch and neither the lit state nor the Exclusive circle is drawn.
 *
 * Categories without a mapped icon use the shared generic Phosphor fallback.
 */

export function CategoryCircles({
  facets,
  onSelect,
}: {
  facets: { category: string; label: string; count: number }[];
  /** Opens Marketplace filtered to `category`. */
  onSelect: (category: string) => void;
}) {
  const twoRows = facets.length > 8;
  const columns = twoRows
    ? Array.from({ length: Math.ceil(facets.length / 2) }, (_, index) => facets.slice(index * 2, index * 2 + 2))
    : facets.map((facet) => [facet]);

  const renderTile = (facet: (typeof facets)[number]) => {
    const CategoryIcon = isKnownCategory(facet.category)
      ? HOME_CATEGORY_ICONS[facet.category]
      : FALLBACK_CATEGORY_ICON;
    const label = facet.category === "OTHER" ? "Other" : facet.label;
    return (
      <Tappable
        key={facet.category}
        onPress={() => onSelect(facet.category)}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${facet.count} items. Opens Marketplace.`}
        style={s.item}
        pressedStyle={s.itemPressed}
      >
        <View style={s.tile}>
          <CategoryIcon
            size={homeCategoryTile.size.icon}
            weight="duotone"
            color={dColor.primary}
            duotoneColor={dColor.primary}
          />
        </View>
        <Text
          style={[textStyle(type.homeCategoryTileLabel), s.label]}
          numberOfLines={2}
        >
          {label}
        </Text>
      </Tappable>
    );
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[s.row, twoRows && s.twoRows]}
      style={s.outer}
    >
      {columns.map((column) =>
        twoRows ? (
          <View key={column[0].category} style={s.column}>
            {column.map(renderTile)}
          </View>
        ) : (
          renderTile(column[0])
        ),
      )}
    </ScrollView>
  );
}

function isKnownCategory(category: string): category is keyof typeof HOME_CATEGORY_ICONS {
  return Object.prototype.hasOwnProperty.call(HOME_CATEGORY_ICONS, category);
}

const s = StyleSheet.create({
  outer: { flexGrow: 0 },
  row: {
    paddingHorizontal: space.screenX,
    gap: homeCategoryTile.space.itemGap,
    alignItems: "flex-start",
  },
  twoRows: { paddingVertical: homeCategoryTile.space.rowGap },
  column: {
    gap: homeCategoryTile.space.rowGap,
    alignItems: "center",
  },
  item: {
    width: homeCategoryTile.size.itemWidth,
    minHeight:
      homeCategoryTile.size.tile +
      homeCategoryTile.space.labelGap +
      32,
    alignItems: "center",
  },
  tile: {
    width: homeCategoryTile.size.tile,
    height: homeCategoryTile.size.tile,
    borderRadius: homeCategoryTile.radius.tile,
    backgroundColor: dColor.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    width: "100%",
    height: 32,
    marginTop: homeCategoryTile.space.labelGap,
    color: dColor.text,
    textAlign: "center",
  },
  itemPressed: { opacity: 0.75 },
});
