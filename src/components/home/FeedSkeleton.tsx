import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, type ViewStyle } from "react-native";

import { Divider } from "../Divider";
import { color, motion, radius, size, space } from "../../theme/tokens";

/**
 * The chrome is real; only the content is skeletal.
 *
 * The header above this is NOT part of the skeleton. It renders the cached
 * Leaves balance and the real unread counts from the moment the screen mounts,
 * because TanStack hands back the previous payload while the refetch is in
 * flight. Skeletonising a number the app already knows is how a screen manages
 * to feel slower than the data it is showing.
 *
 * ONE DRIVER FOR EVERY BLOCK. The spec is explicit that the blocks pulse in
 * phase off a single driver rather than staggered, and the reason is legible
 * on the screen: a grid of independently-phased placeholders reads as a loading
 * ANIMATION — something with content of its own — where one synchronised breath
 * reads as one surface waiting. It is also cheaper, being one native animation
 * rather than twenty.
 *
 * EVERY BOX IS THE REAL BOX. The blocks below are sized and spaced from the
 * same tokens the real components use — the 62 px story circles, the 40 px
 * avatar, the square photo an unmeasured image opens at, the 48 px button. The
 * row heights are therefore identical before and after the data lands, which is
 * the difference between the feed settling and the feed jumping.
 */
export function FeedSkeleton() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const half = motion.skeletonPulseMs / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: half,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: half,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    // Stopped on unmount, which is the frame the real feed replaces this. An
    // Animated.loop left running holds a native animation open against a tree
    // that no longer exists.
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [motion.skeletonFrom, motion.skeletonTo],
  });

  return (
    // Inert to a screen reader. The pieces below carry no information, and a
    // reader that walks them announces two dozen unlabelled views instead of
    // the one fact that matters, which the list itself reports as "busy".
    <View
      style={{ backgroundColor: color.surface }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={s.storiesRail}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i}>
            <Block opacity={opacity} style={s.storyCircle} />
            <Block opacity={opacity} style={s.storyLabel} soft />
          </View>
        ))}
      </View>
      <Divider />

      <CardSkeleton opacity={opacity} />
      <Divider />
      <CardSkeleton opacity={opacity} />
    </View>
  );
}

function CardSkeleton({ opacity }: { opacity: Animated.AnimatedInterpolation<number> }) {
  return (
    <View style={s.card}>
      <View style={s.ownerRow}>
        <Block opacity={opacity} style={s.avatar} />
        <View>
          <Block opacity={opacity} style={s.nameLine} />
          <Block opacity={opacity} style={s.metaLine} soft />
        </View>
      </View>

      {/* Square — the same ratio an unmeasured photo box opens at, so this is
          the real card's first frame rather than a stand-in for it. */}
      <Block opacity={opacity} style={s.photo} />

      <View style={s.titleRow}>
        <Block opacity={opacity} style={s.titleLine} />
        <Block opacity={opacity} style={s.leavesChip} soft />
      </View>

      <View style={s.chipRow}>
        <Block opacity={opacity} style={s.chip} soft />
        <Block opacity={opacity} style={s.chipWide} soft />
      </View>

      <View style={s.socialRow}>
        <Block opacity={opacity} style={s.socialItem} soft />
        <Block opacity={opacity} style={s.socialItem} soft />
      </View>

      <View style={s.buttonWrap}>
        <Block opacity={opacity} style={s.button} />
      </View>
    </View>
  );
}

/**
 * One block. `soft` is the spec's second skeleton value, and which blocks get
 * it is not arbitrary: the primary tone goes to the shapes that will hold
 * something substantial (avatar, photo, title, button), the softer one to the
 * metadata line and the chips. It is the finished card's own hierarchy, drawn
 * before the card arrives.
 */
function Block({
  opacity,
  style,
  soft = false,
}: {
  opacity: Animated.AnimatedInterpolation<number>;
  style: ViewStyle;
  soft?: boolean;
}) {
  return (
    <Animated.View
      style={[
        { backgroundColor: soft ? color.skeletonSoft : color.skeleton },
        style,
        { opacity },
      ]}
    />
  );
}

/** Text-line blocks are pills: radius is half the height, per the spec. */
function line(width: ViewStyle["width"], height: number): ViewStyle {
  return { width, height, borderRadius: height / 2 };
}

const b = size.skeletonBlock;

const s = StyleSheet.create({
  storiesRail: {
    flexDirection: "row",
    paddingTop: space.stories.top,
    paddingBottom: space.stories.bottom,
    paddingHorizontal: space.stories.x,
    gap: space.stories.gap,
  },
  storyCircle: {
    width: size.avatar.story,
    height: size.avatar.story,
    borderRadius: radius.storyAvatar,
  },
  storyLabel: {
    ...line(b.storyLabel.w, b.storyLabel.h),
    marginTop: space.stories.avatarToLabel,
    alignSelf: "center",
  },

  card: { paddingTop: space.card.top, paddingBottom: space.card.bottom },

  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.card.ownerGap,
    paddingHorizontal: space.screenX,
    marginBottom: space.card.ownerToPhoto,
  },
  avatar: {
    width: size.avatar.owner,
    height: size.avatar.owner,
    borderRadius: radius.ownerAvatar,
  },
  nameLine: line(b.name.w, b.name.h),
  metaLine: { ...line(b.meta.w, b.meta.h), marginTop: space.card.nameToMeta },

  photo: { width: "100%", aspectRatio: size.photo.aspectDefault },

  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.card.titleToLeaves,
    paddingHorizontal: space.screenX,
    marginTop: space.card.photoToTitle,
  },
  titleLine: line(b.title.w, b.title.h),
  leavesChip: {
    width: b.leavesChip,
    height: size.leaves.cardChip,
    borderRadius: radius.leavesChipCard,
  },

  chipRow: {
    flexDirection: "row",
    gap: space.card.chipGap,
    paddingHorizontal: space.screenX,
    marginTop: space.card.titleToChips,
  },
  chip: { width: b.chip, height: b.chipHeight, borderRadius: radius.chip },
  chipWide: { width: b.chipWide, height: b.chipHeight, borderRadius: radius.chip },

  // The real social row is 44 tall around a 21 px glyph; the stand-in is a
  // short line, so the gap above it absorbs the difference and the button
  // below still lands where the real one does.
  socialRow: {
    flexDirection: "row",
    gap: space.card.socialGap * 2,
    paddingHorizontal: space.screenX,
    marginTop: space.card.chipsToSocial + (size.control.social - b.social.h) / 2,
  },
  socialItem: line(b.social.w, b.social.h),

  buttonWrap: {
    paddingHorizontal: space.screenX,
    marginTop: space.card.socialToButton + (size.control.social - b.social.h) / 2,
  },
  button: {
    width: "100%",
    height: size.control.primaryButton,
    borderRadius: radius.primaryButton,
  },
});
