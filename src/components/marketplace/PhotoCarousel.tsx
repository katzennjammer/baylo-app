import { Image } from "expo-image";
import { useCallback, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ImageIcon } from "../icons";
import { border, color, icon, radius, size, space, textStyle, type } from "../../theme/tokens";

/**
 * The item's photos, swiped.
 *
 * A PAGING ScrollView RATHER THAN A FlatList. The set is capped at ten by the
 * server's create schema, they are all wanted the moment the screen opens, and
 * a horizontal FlatList inside a vertical one has to have its gestures untangled
 * on Android. Ten eagerly-mounted images is the cheaper problem.
 *
 * THE DOTS ARE OMITTED FOR A SINGLE PHOTO, and the counter with them: a page
 * indicator that always reads "1 / 1" is furniture that teaches nothing. Both
 * appear from the second image.
 *
 * The box holds its aspect ratio whatever happens to the image — a 404 keeps
 * the frame rather than collapsing it, so the content below does not jump while
 * someone is reading it. Same rule as the feed card's photo.
 */
export function PhotoCarousel({ images, title }: { images: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [boxWidth, setBoxWidth] = useState(0);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (boxWidth <= 0) return;
      const next = Math.round(e.nativeEvent.contentOffset.x / boxWidth);
      setIndex((prev) => (prev === next ? prev : next));
    },
    [boxWidth],
  );

  if (images.length === 0) {
    return (
      <View style={s.box}>
        <View style={s.failed}>
          <ImageIcon
            size={icon.failedPhoto.size}
            stroke={icon.failedPhoto.stroke}
            color={color.failedIcon}
          />
          <Text style={[textStyle(type.gridMeta), { color: color.inkMuted }]}>No photo</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.box} onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        // 16ms would fire on every frame for a value that only changes once per
        // page; 64 is often enough that the dot never visibly lags the swipe.
        scrollEventThrottle={64}
      >
        {images.map((uri, i) => (
          <View key={`${uri}:${i}`} style={{ width: boxWidth || undefined, height: "100%" }}>
            {failed[i] ? (
              <View style={s.failed}>
                <ImageIcon
                  size={icon.failedPhoto.size}
                  stroke={icon.failedPhoto.stroke}
                  color={color.failedIcon}
                />
              </View>
            ) : (
              <Image
                source={{ uri }}
                contentFit="cover"
                style={s.photo}
                transition={140}
                accessibilityLabel={`${title}, photo ${i + 1} of ${images.length}`}
                onError={() => setFailed((prev) => ({ ...prev, [i]: true }))}
              />
            )}
          </View>
        ))}
      </ScrollView>

      {images.length > 1 ? (
        <>
          <View style={s.counter}>
            <Text style={[textStyle(type.carouselCount), { color: color.surface }]}>
              {index + 1} / {images.length}
            </Text>
          </View>

          <View style={s.dots} pointerEvents="none">
            {images.map((_, i) => (
              <View key={i} style={[s.dot, i === index && s.dotOn]} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    width: "100%",
    aspectRatio: size.detail.photoAspect,
    backgroundColor: color.control,
    borderBottomWidth: border.hairline,
    borderBottomColor: color.divider,
  },
  photo: { width: "100%", height: "100%" },
  failed: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.card.failedGap },

  counter: {
    position: "absolute",
    top: space.photoCaption.inset,
    right: space.photoCaption.inset,
    paddingHorizontal: space.photoCaption.x,
    paddingVertical: space.photoCaption.y,
    borderRadius: radius.carouselCount,
    backgroundColor: color.captionFill,
  },
  dots: {
    position: "absolute",
    bottom: space.photoCaption.inset,
    alignSelf: "center",
    flexDirection: "row",
    gap: size.detail.dotGap,
  },
  dot: {
    width: size.detail.dot,
    height: size.detail.dot,
    borderRadius: radius.carouselDot,
    backgroundColor: color.captionFill,
  },
  dotOn: { backgroundColor: color.surface },
});
