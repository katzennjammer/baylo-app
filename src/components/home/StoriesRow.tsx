import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PlusIcon } from "../icons";
import { Divider } from "../Divider";
import {
  border,
  color,
  icon,
  radius,
  size,
  space,
  textStyle,
  type,
  lines,
} from "../../theme/tokens";
import type { MatchCandidate } from "../../api/types";

/**
 * The row of ringed circles across the top of the feed.
 *
 * The artboard draws it as stories. There are no stories on this backend and
 * nothing on /api/v1/home that could become one, so what fills the row is the
 * `matches` block — the suggested traders the endpoint already returns. Same
 * geometry, same rings, real data. The alternative was to leave a specified
 * row out of the screen, or to fill it with placeholder people.
 *
 * THE RING HAS TWO STATES IN THE SPEC AND ONE HERE. Unviewed is 2 px of
 * `green`, viewed is 2 px of `controlLine`, and nothing in the payload records
 * whether a viewer has looked at a given trader — there is no seen-state on
 * this endpoint or any other. Every circle therefore renders unviewed. The
 * viewed treatment is kept as a prop rather than deleted, so the day a
 * seen-state exists this is a value passed in and not a style to re-derive.
 *
 * NOT TAPPABLE, deliberately not tappable-to-somewhere-wrong. Another person's
 * profile is /api/v1/profile/[id], which has no screen in the app yet, and
 * routing this to /profile would open the viewer's OWN profile — the kind of
 * near-miss that reads as a bug rather than as an unbuilt feature. Each circle
 * stays a labelled, readable element until the screen behind it exists. The
 * "+ Post" circle is the one control in the row, and it goes somewhere real.
 */
export function StoriesRow({ matches }: { matches: MatchCandidate[] }) {
  const router = useRouter();

  return (
    <View style={{ backgroundColor: color.surface }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.rail}
      >
        <PostCircle onPress={() => router.push("/post")} />
        {matches.map((m) => (
          <StoryBubble key={m.userId} match={m} />
        ))}
      </ScrollView>
      <Divider />
    </View>
  );
}

/** The dashed-ring circle. Sized and labelled like a bubble so the row reads level. */
function PostCircle({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Post an item">
      <View style={s.postRing}>
        <PlusIcon
          size={icon.storyPlus.size}
          stroke={icon.storyPlus.stroke}
          color={color.inkSecondary}
        />
      </View>
      <Text style={[textStyle(type.storyPostLabel), s.postLabel]} numberOfLines={1}>
        Post
      </Text>
    </Pressable>
  );
}

/**
 * One suggested trader.
 *
 * The ring is drawn as a bordered box holding a `surface`-coloured gap that
 * holds the image: 2 px ring, 2 px gap, 54 image, 62 outer. Doing it with two
 * nested borders rather than one border plus padding is what keeps the gap the
 * canvas colour instead of a lighter ring, which is the difference between a
 * ring and a halo.
 */
function StoryBubble({ match, viewed = false }: { match: MatchCandidate; viewed?: boolean }) {
  // A first name, not the full one. The label is capped at the 62 px the circle
  // is wide, and "Maria Josefina" truncates to "Maria Jos…" where "Maria" fits
  // whole — the handle is there to identify a face, and half a surname does not.
  const handle = match.name.trim().split(/\s+/)[0] || match.name;

  return (
    <View
      accessible
      // The reason string is the server's ("Both trading Clothing"), and this is
      // the only place it appears — the artboard has no room for it under a
      // 62 px circle, but a screen reader has all the room in the world.
      accessibilityLabel={`${match.name}. ${match.reason}`}
    >
      <View
        style={[s.ring, { borderColor: viewed ? color.controlLine : color.green }]}
      >
        <View style={s.ringGap}>
          {match.avatar ? (
            <Image source={{ uri: match.avatar }} contentFit="cover" style={s.avatarImage} />
          ) : (
            <View style={[s.avatarImage, s.avatarFallback]}>
              <Text style={[textStyle(type.avatarInitials62), { color: color.forest }]}>
                {handle.charAt(0).toUpperCase() || "?"}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Text
        style={[textStyle(type.storyHandle), viewed ? s.handleViewed : s.handle]}
        numberOfLines={lines.storyHandle}
      >
        {handle}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  rail: {
    paddingTop: space.stories.top,
    paddingBottom: space.stories.bottom,
    paddingHorizontal: space.stories.x,
    gap: space.stories.gap,
  },

  postRing: {
    width: size.avatar.story,
    height: size.avatar.story,
    borderRadius: radius.storyAvatar,
    borderWidth: border.dashed,
    borderStyle: "dashed",
    borderColor: color.dashed,
    backgroundColor: color.storyPost,
    alignItems: "center",
    justifyContent: "center",
  },
  postLabel: {
    marginTop: space.stories.avatarToLabel,
    maxWidth: size.avatar.story,
    textAlign: "center",
    color: color.ink,
  },

  ring: {
    width: size.avatar.story,
    height: size.avatar.story,
    borderRadius: radius.storyAvatar,
    borderWidth: border.storyRing,
    alignItems: "center",
    justifyContent: "center",
  },
  ringGap: {
    width: size.avatar.story - border.storyRing * 2,
    height: size.avatar.story - border.storyRing * 2,
    borderRadius: (size.avatar.story - border.storyRing * 2) / 2,
    borderWidth: size.avatar.storyGap,
    borderColor: color.surface,
    overflow: "hidden",
  },
  avatarImage: {
    width: size.avatar.storyImage,
    height: size.avatar.storyImage,
    borderRadius: size.avatar.storyImage / 2,
    backgroundColor: color.greenWash,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },

  handle: {
    marginTop: space.stories.avatarToLabel,
    maxWidth: size.avatar.story,
    textAlign: "center",
    color: color.ink,
  },
  // The one place the viewed state still shows through: a ring the eye has
  // stopped registering is paired with a label that has receded too.
  handleViewed: {
    marginTop: space.stories.avatarToLabel,
    maxWidth: size.avatar.story,
    textAlign: "center",
    color: color.inkMuted,
  },
});
