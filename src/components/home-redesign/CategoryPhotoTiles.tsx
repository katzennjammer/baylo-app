import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { sizedImage } from "../../media/image-url";
import { color, space } from "../../theme/tokens";
import { Tappable } from "../Tappable";

/**
 * Home's categories as photo tiles: a 3 x 2 grid of the six biggest
 * categories, each a photo with its name and count in white over a soft fade.
 * Chosen by the owner, 4 Nov 2026, over chips and circles.
 *
 * ── WHERE THE PHOTOS COME FROM ──────────────────────────────────────────────
 *
 * `coverImage` is the newest visible listing's first photo, which the browse
 * API sends for the top six categories. Before it answers, or for a category
 * whose listings have no photo, a bundled stock photo stands in (the same
 * photos the web landing page uses). A category with neither gets a plain
 * tinted tile -- never a broken image.
 *
 * ── EMPTY CATEGORIES NEVER SHOW ─────────────────────────────────────────────
 *
 * The facets only carry categories that have AVAILABLE listings, already
 * ordered biggest first, so the six here are the six with the most to see.
 * Fewer than six with listings means fewer tiles, not empty ones.
 */
const FALLBACK: Partial<Record<string, number>> = {
  ELECTRONICS: require("../../../assets/categories/electronics.jpg"),
  CLOTHING: require("../../../assets/categories/fashion.jpg"),
  BIKES: require("../../../assets/categories/bikes.jpg"),
  BOOKS: require("../../../assets/categories/books.jpg"),
  SPORTS: require("../../../assets/categories/sports.jpg"),
  FURNITURE: require("../../../assets/categories/home.jpg"),
  TOYS: require("../../../assets/categories/kids.jpg"),
  ACCESSORIES: require("../../../assets/categories/accessories.jpg"),
  FOOD: require("../../../assets/categories/food.jpg"),
};

const SHOWN = 6;

export function CategoryPhotoTiles({
  facets,
  onSelect,
}: {
  facets: { category: string; label: string; count: number; coverImage?: string | null }[];
  /** Opens Marketplace filtered to `category`. */
  onSelect: (category: string) => void;
}) {
  const { width } = useWindowDimensions();
  // Three across at any width; a short last row keeps the same tile size.
  const tileWidth = Math.floor((width - space.screenX * 2 - GAP * 2) / 3);
  const tiles = facets.slice(0, SHOWN);
  if (tiles.length === 0) return null;
  return (
    <View style={s.grid}>
      {tiles.map((facet) => {
        const label = facet.category === "OTHER" ? "Other" : facet.label;
        const fallback = FALLBACK[facet.category];
        const source = facet.coverImage ? { uri: sizedImage(facet.coverImage, "thumb") } : fallback;
        return (
          <Tappable
            key={facet.category}
            onPress={() => onSelect(facet.category)}
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${facet.count} ${facet.count === 1 ? "item" : "items"}. Opens Marketplace.`}
            style={[s.tile, { width: tileWidth }]}
            pressedStyle={s.pressed}
          >
            {source ? (
              <Image
                source={source}
                placeholder={fallback}
                contentFit="cover"
                transition={150}
                style={StyleSheet.absoluteFill}
                accessible={false}
              />
            ) : null}
            <LinearGradient
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.66)"]}
              locations={[0.38, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={s.copy}>
              <Text style={s.label} numberOfLines={2}>
                {label}
              </Text>
              <Text style={s.count}>
                {facet.count} {facet.count === 1 ? "item" : "items"}
              </Text>
            </View>
          </Tappable>
        );
      })}
    </View>
  );
}

const GAP = 8;

const s = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
    paddingHorizontal: space.screenX,
  },
  tile: {
    height: 112,
    borderRadius: 16,
    overflow: "hidden",
    justifyContent: "flex-end",
    backgroundColor: color.skeleton,
  },
  pressed: { opacity: 0.85 },
  copy: { paddingHorizontal: 10, paddingVertical: 8 },
  label: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", lineHeight: 17 },
  count: { color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "600" },
});
