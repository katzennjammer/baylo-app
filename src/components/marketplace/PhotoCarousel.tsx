import { Image } from "expo-image";
import { useCallback, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ImageIcon } from "../icons";
import { ReloadPhotoButton } from "../ReloadPhotoButton";
import { sizedImage } from "../../media/image-url";
import { usePhotoRetry } from "../../media/usePhotoRetry";
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
export function PhotoCarousel({
  images,
  title,
  counter = true,
  aspectRatio = size.detail.photoAspect,
  hairline = true,
  onPressPhoto,
  onCoverLoad,
  window,
  children,
}: {
  images: string[];
  title: string;
  /**
   * The "2 / 5" chip, top-right. Off on the listing screen, whose share and
   * more buttons sit in that corner; the dots alone carry the position.
   */
  counter?: boolean;
  /** The box's ratio. The feed passes its cover's clamped ratio; detail keeps 4:5. */
  aspectRatio?: number;
  /** The bottom hairline the detail screen draws under the photo. */
  hairline?: boolean;
  /**
   * A tap on any photo. A swipe never fires it: the ScrollView takes the touch
   * over as soon as it moves sideways, which cancels the press.
   */
  onPressPhoto?: () => void;
  /** The FIRST photo's own size, once it loads — the feed sizes its box from it. */
  onCoverLoad?: (width: number, height: number) => void;
  /**
   * Only photos within this many pages of the visible one are mounted. Unset
   * mounts them all (the listing screen); the feed passes 1, so a scrolled feed
   * is not holding five decoded photos per card.
   */
  window?: number;
  /** Overlays on the photo box, e.g. the feed's perishable countdown. */
  children?: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [boxWidth, setBoxWidth] = useState(0);
  const box = [s.box, { aspectRatio }, !hairline && s.noHairline];

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
      <View style={box}>
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
    <View style={box} onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        pagingEnabled
        // A carousel inside a vertical list or screen: keep Android's nested
        // scrolling on, so a sideways drag stays with the photos.
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        // 16ms would fire on every frame for a value that only changes once per
        // page; 64 is often enough that the dot never visibly lags the swipe.
        scrollEventThrottle={64}
      >
        {images.map((uri, i) => {
          const mounted = window === undefined || Math.abs(i - index) <= window;
          const photo = mounted ? (
            <Slide
              uri={uri}
              label={`${title}, photo ${i + 1} of ${images.length}`}
              onLoad={i === 0 ? onCoverLoad : undefined}
            />
          ) : null;
          const page = { width: boxWidth || undefined, height: "100%" as const };
          return onPressPhoto ? (
            <Pressable
              key={`${uri}:${i}`}
              style={page}
              onPress={onPressPhoto}
              accessibilityRole="button"
              accessibilityLabel={`Open ${title}, photo ${i + 1} of ${images.length}`}
            >
              {photo}
            </Pressable>
          ) : (
            <View key={`${uri}:${i}`} style={page}>
              {photo}
            </View>
          );
        })}
      </ScrollView>

      {children}

      {images.length > 1 ? (
        <>
          {counter ? (
            <View style={s.counter}>
              <Text style={[textStyle(type.metadata), { color: color.surface }]}>
                {index + 1} / {images.length}
              </Text>
            </View>
          ) : null}

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

/** One page. Its load state lives here, keyed by its own URL, not by slide index. */
function Slide({
  uri,
  label,
  onLoad,
}: {
  uri: string;
  label: string;
  onLoad?: (width: number, height: number) => void;
}) {
  const photo = usePhotoRetry(uri);
  if (photo.failed) {
    return (
      <View style={s.failed}>
        <ImageIcon size={icon.failedPhoto.size} stroke={icon.failedPhoto.stroke} color={color.failedIcon} />
        <ReloadPhotoButton onPress={photo.retry} />
      </View>
    );
  }
  return (
    <Image
      key={photo.key}
      source={{ uri: sizedImage(uri, "full") }}
      contentFit="cover"
      style={s.photo}
      transition={140}
      accessibilityLabel={label}
      // The transform keeps the aspect ratio (c_limit), so the feed's box is
      // still sized correctly from the smaller image.
      onLoad={onLoad ? (e) => onLoad(e.source.width, e.source.height) : undefined}
      onError={photo.onError}
    />
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
  noHairline: { borderBottomWidth: 0 },
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
