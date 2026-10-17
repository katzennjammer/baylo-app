import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ImageIcon } from "../icons";
import { Tappable } from "../Tappable";
import { color, dark, icon, radius, size, space, textStyle, type } from "../../theme/tokens";
import type { Item } from "../../api/types";

/**
 * The Home hero: forest-based gradient card, copy on the left, a real listing
 * photo bleeding off the right edge.
 *
 * ── THE PHOTO IS A LAID-OUT COLUMN, NOT AN ABSOLUTE BOX ─────────────────
 *
 * It was `position: absolute` with `top/bottom: 0`, a PERCENTAGE width and a
 * negative `right`, which is three separate ways for the box to come out empty
 * and no way to tell that it had: a photo that measured zero looked exactly
 * like a card with no photo. It is a flex child now — the card is a row, the
 * copy takes `1 - heroPhotoFraction` of it and this takes the rest, both from
 * a flex-basis of 0 so the split is arithmetic rather than a percentage string.
 * The bleed is a negative margin on that child, clipped by the card's own
 * `overflow: hidden`, so the photo still runs past the right edge.
 *
 * AND IT FAILS VISIBLY. A missing or broken photo draws the same ImageIcon
 * panel GridTile and ExclusiveTile draw, in the dark palette this card is on,
 * instead of rendering nothing and leaving a bare gradient that reads as a
 * design choice.
 *
 * TODO(home-redesign): /api/v1/browse has no "featured" concept. Until the
 * server sends one, the screen passes the first browse item that has a photo
 * and this builds its copy from that item's category. Replace `item` with the
 * server's featured block when it exists; do NOT add a fake endpoint for it.
 */
export function HeroBanner({
  item,
  onPress,
}: {
  item: Item;
  onPress: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const cover = item.images[0];

  // TODO(home-redesign): mocked copy. Headline follows the featured item's
  // category so it is at least true to the photo beside it.
  const headline = `Explore ${item.categoryLabel}`;
  const subhead = "Exchange for what you want";
  const cta = "Barter now";

  return (
    <LinearGradient
      colors={[color.forest, dark.surface]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.card}
    >
      <View style={s.copy}>
        <Text style={[textStyle(type.heroTitle), { color: dark.ink }]} numberOfLines={2}>
          {headline}
        </Text>
        <Text style={[textStyle(type.heroSubhead), { color: dark.secondary, marginTop: 4 }]} numberOfLines={2}>
          {subhead}
        </Text>
        <Tappable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${cta}. ${headline}`}
          style={s.cta}
          pressedStyle={s.ctaPressed}
        >
          <Text style={[textStyle(type.heroCta), { color: color.onGreen }]}>{cta}</Text>
        </Tappable>
      </View>

      <View style={s.photoBox}>
        {cover && !failed ? (
          <Image
            source={{ uri: cover }}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
            transition={120}
            onError={() => setFailed(true)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, s.photoFailed]}>
            <ImageIcon
              size={icon.failedPhoto.size}
              stroke={icon.failedPhoto.stroke}
              color={dark.muted}
            />
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: space.screenX,
    height: size.home.heroHeight,
    borderRadius: radius.hero,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "stretch",
  },
  // flexBasis 0 on both, so the two grow numbers ARE the split — 56/44 of the
  // card, whatever the card turns out to be. No percentage strings, and no
  // dependence on the parent having resolved its width first.
  copy: {
    flexGrow: 1 - size.home.heroPhotoFraction,
    flexBasis: 0,
    justifyContent: "center",
    paddingHorizontal: space.home.heroX,
    paddingVertical: space.home.heroY,
  },
  photoBox: {
    flexGrow: size.home.heroPhotoFraction,
    flexBasis: 0,
    // The bleed. The card clips it, so the photo reaches the right edge with no
    // rounded corner cutting into it.
    marginRight: -size.home.heroPhotoBleed,
    backgroundColor: dark.control,
    overflow: "hidden",
  },
  photoFailed: { alignItems: "center", justifyContent: "center" },
  cta: {
    alignSelf: "flex-start",
    marginTop: space.home.heroSubToCta,
    height: size.home.heroCta,
    paddingHorizontal: size.home.heroCtaX,
    borderRadius: radius.heroCta,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPressed: { opacity: 0.85 },
});
