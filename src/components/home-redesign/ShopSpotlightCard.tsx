import { Image } from "expo-image";
import { memo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { SpotlightShop } from "../../api/spotlight";
import { StoreIcon, VerifiedOrgIcon } from "../icons";
import { Tappable } from "../Tappable";
import {
  categoryTone,
  color,
  icon,
  radius,
  size,
  space,
  textStyle,
  type,
  type CategoryToneName,
} from "../../theme/tokens";

/**
 * A Shop Spotlight: a tall promo card for one verified shop, on Home.
 *
 * It promotes the SHOP, not a listing, which is what separates it from
 * Featured (paid boosts of items). Tapping opens the storefront.
 *
 * ── THE HERO, IN ORDER OF PREFERENCE ─────────────────────────────────────
 *
 *   1. The shop's banner, when it set one: its own picture of itself.
 *   2. Its newest listing's photo, captioned "Newest: <title>" so the photo
 *      is not read as the shop's own picture.
 *   3. The tone's tint with the shop-front mark, when neither exists or the
 *      photo fails to load.
 *
 * Most shops have no banner or logo yet (1 of 12 verified shops on 30 Sep
 * 2026), so (2) is the common case, not an edge one.
 *
 * ── THE COLOUR ───────────────────────────────────────────────────────────
 *
 * The business type picks one of the category tones (tokens.categoryTone),
 * the same six families as the category circles, so the card's body and its
 * logo placeholder are coloured by what KIND of shop it is. The body is
 * always toned, banner or not, so the cards read as one set.
 */
const TONES: Record<string, CategoryToneName> = {
  SARI_SARI: "sand",
  FOOD_AND_BEVERAGE: "clay",
  AGRICULTURE: "green",
  HANDICRAFT: "lilac",
  APPAREL: "clay",
  ELECTRONICS_REPAIR: "sky",
  SERVICES: "sky",
  RETAIL: "sand",
  COOPERATIVE: "teal",
  NONPROFIT: "teal",
  OTHER: "sand",
};

export const ShopSpotlightCard = memo(function ShopSpotlightCard({
  shop,
  width,
  onPress,
}: {
  shop: SpotlightShop;
  width: number;
  onPress: (shop: SpotlightShop) => void;
}) {
  const tone = categoryTone[TONES[shop.businessCategory] ?? "sand"];
  const [heroFailed, setHeroFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const height = Math.round(width / size.home.spotlightAspect);
  const heroHeight = Math.round(height * size.home.spotlightHeroFraction);

  const fromListing = !shop.bannerUrl && shop.newestListing?.imageUrl != null;
  const heroUri = shop.bannerUrl ?? shop.newestListing?.imageUrl ?? null;
  const showHero = heroUri !== null && !heroFailed;

  const count = shop.availableCount === 1 ? "1 listing" : `${shop.availableCount} listings`;

  return (
    <Tappable
      onPress={() => onPress(shop)}
      accessibilityRole="button"
      accessibilityLabel={
        `${shop.name}, verified ${shop.businessCategoryLabel}. ${count}.` +
        (shop.description ? ` ${shop.description}` : "") +
        " Opens the shop."
      }
      // ONE object: the tone's fill is the card's own, not a patch over a base
      // style. See the same note in CategoryCircles.
      style={{ ...cardBox, width, height, backgroundColor: tone.bg }}
      pressedStyle={s.pressed}
    >
      <View style={{ height: heroHeight, backgroundColor: tone.tint }}>
        {showHero ? (
          <Image
            source={{ uri: heroUri }}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
            transition={120}
            onError={() => setHeroFailed(true)}
          />
        ) : (
          <View style={s.heroEmpty}>
            <StoreIcon size={icon.spotlightHero.size} stroke={icon.spotlightHero.stroke} color={tone.ink} />
          </View>
        )}
        {showHero && fromListing && shop.newestListing ? (
          <View style={s.caption} pointerEvents="none">
            <Text style={[textStyle(type.exclusiveMeta), { color: color.onScrim }]} numberOfLines={1}>
              {`Newest: ${shop.newestListing.title}`}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={s.body}>
        <View
          style={{
            ...logoBox,
            backgroundColor: shop.logoUrl && !logoFailed ? color.surface : tone.tint,
            borderColor: tone.bg,
          }}
        >
          {shop.logoUrl && !logoFailed ? (
            <Image
              source={{ uri: shop.logoUrl }}
              contentFit="cover"
              style={s.logoImage}
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <StoreIcon size={icon.spotlightLogo.size} stroke={icon.spotlightLogo.stroke} color={tone.ink} />
          )}
        </View>

        <Text style={[textStyle(type.exclusiveTitle), { color: color.ink }]} numberOfLines={1}>
          {shop.name}
        </Text>
        <View style={s.typeRow}>
          <VerifiedOrgIcon
            size={icon.spotlightBadge.size}
            stroke={icon.spotlightBadge.stroke}
            color={tone.ink}
          />
          <Text style={[textStyle(type.exclusiveMeta), { color: tone.ink, flexShrink: 1 }]} numberOfLines={1}>
            {shop.businessCategoryLabel}
          </Text>
        </View>
        {shop.description ? (
          <Text
            style={[textStyle(type.gridMeta), { color: color.inkSecondary, marginTop: space.home.tileTitleToMeta }]}
            numberOfLines={2}
          >
            {shop.description}
          </Text>
        ) : null}
        <Text style={[textStyle(type.gridMeta), s.count, { color: tone.ink }]} numberOfLines={1}>
          {count}
        </Text>
      </View>
    </Tappable>
  );
});

const cardBox = {
  borderRadius: radius.exclusiveTile,
  overflow: "hidden",
} as const;

const logoBox = {
  width: size.home.spotlightLogo,
  height: size.home.spotlightLogo,
  borderRadius: radius.spotlightLogo,
  borderWidth: 2,
  marginTop: -space.home.spotlightLogoOverlap - space.home.spotlightBody,
  marginBottom: space.home.tileTitleToMeta * 2,
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
} as const;

const s = StyleSheet.create({
  pressed: { opacity: 0.85 },
  heroEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.home.spotlightBody,
    paddingTop: space.home.tileBadgeGap,
    // Clears the logo, which overlaps the hero's bottom-left corner.
    paddingLeft: space.home.spotlightBody * 2 + size.home.spotlightLogo,
    paddingBottom: space.home.tileBadgeGap,
    backgroundColor: color.captionFill,
  },
  body: { flex: 1, padding: space.home.spotlightBody },
  logoImage: { width: "100%", height: "100%" },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.home.tileBadgeGap,
    marginTop: space.home.tileTitleToMeta,
  },
  count: { marginTop: "auto" },
});
