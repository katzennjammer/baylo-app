import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PlusIcon } from "../icons";
import { Divider } from "../Divider";
import {
  border,
  color,
  icon,
  lines,
  radius,
  size,
  space,
  textStyle,
  type,
} from "../../theme/tokens";
import { useStories, type StoryAuthor } from "../../api/stories";

/**
 * The stories row across the top of Community (2 Oct 2026).
 *
 * It used to be the `matches` block (suggested traders) drawn as stories, with
 * every ring permanently "unviewed" and nothing tappable. It is real stories
 * now: GET /api/v1/stories, one circle per author, in the server's order --
 * you first, then anyone with something unseen, then the fully seen.
 *
 *   "Your story"   always first while acting as yourself. No stories yet: the
 *                  circle opens "Share a listing". With stories: it opens the
 *                  viewer, and the small + badge opens "Share a listing".
 *                  Hidden while acting as a shop -- stories are personal (v1).
 *   an author      green ring = something unseen, grey = all seen. Opens the
 *                  viewer at that author.
 *
 * The ring is drawn as a bordered box holding a `surface`-coloured gap that
 * holds the image: 2 px ring, 2 px gap, 54 image, 62 outer. Two nested borders
 * rather than one border plus padding keep the gap the canvas colour, which is
 * the difference between a ring and a halo.
 */
export function StoriesRow({
  viewer,
  actingAsShop,
}: {
  viewer: { id: string; name: string; avatar: string | null } | undefined;
  actingAsShop: boolean;
}) {
  const router = useRouter();
  const { data: authors = [] } = useStories();

  const own = authors.find((a) => a.isOwn) ?? null;
  const others = authors.filter((a) => !a.isOwn);
  const openViewer = (authorId: string) => router.push({ pathname: "/story", params: { authorId } });
  const openShare = () => router.push("/share-story");

  // Nothing to show a shop, and no stories from anyone: no empty band.
  if (actingAsShop && others.length === 0) return null;

  return (
    <View style={{ backgroundColor: color.surface }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
        {!actingAsShop && viewer ? (
          <YourStory
            viewer={viewer}
            own={own}
            onOpen={own ? () => openViewer(own.user.id) : openShare}
            onAdd={openShare}
          />
        ) : null}
        {others.map((a) => (
          <AuthorBubble key={a.user.id} author={a} onPress={() => openViewer(a.user.id)} />
        ))}
      </ScrollView>
      <Divider />
    </View>
  );
}

function YourStory({
  viewer,
  own,
  onOpen,
  onAdd,
}: {
  viewer: { name: string; avatar: string | null };
  own: StoryAuthor | null;
  onOpen: () => void;
  onAdd: () => void;
}) {
  const count = own?.stories.length ?? 0;
  return (
    <View>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={count > 0 ? `Your story, ${count} shared. Open` : "Your story. Share a listing"}
      >
        <View style={[s.ring, { borderColor: count > 0 ? color.controlLine : "transparent" }]}>
          <View style={s.ringGap}>
            <Avatar uri={viewer.avatar} name={viewer.name} />
          </View>
        </View>
      </Pressable>
      {/* Its own target: with stories already up, the circle opens them. */}
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel="Share a listing to your story"
        hitSlop={8}
        style={s.addBadge}
      >
        <PlusIcon size={icon.storyPlus.size - 6} stroke={2.2} color={color.onGreen} />
      </Pressable>
      <Text style={[textStyle(type.storyPostLabel), s.label]} numberOfLines={lines.storyHandle}>
        Your story
      </Text>
    </View>
  );
}

function AuthorBubble({ author, onPress }: { author: StoryAuthor; onPress: () => void }) {
  // A first name, not the full one: the label is capped at the circle's 62 px,
  // and "Maria" fits whole where "Maria Josefina" truncates mid-surname.
  const handle = author.user.name.trim().split(/\s+/)[0] || author.user.name;
  const seen = author.allSeen;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${author.user.name}'s story${seen ? "" : ", new"}. Open`}
    >
      <View style={[s.ring, { borderColor: seen ? color.controlLine : color.green }]}>
        <View style={s.ringGap}>
          <Avatar uri={author.user.avatar} name={author.user.name} />
        </View>
      </View>
      <Text
        style={[textStyle(type.storyHandle), s.label, { color: seen ? color.inkMuted : color.ink }]}
        numberOfLines={lines.storyHandle}
      >
        {handle}
      </Text>
    </Pressable>
  );
}

function Avatar({ uri, name }: { uri: string | null; name: string }) {
  if (uri) return <Image source={{ uri }} contentFit="cover" style={s.avatarImage} />;
  return (
    <View style={[s.avatarImage, s.avatarFallback]}>
      <Text style={[textStyle(type.avatarInitials62), { color: color.forest }]}>
        {name.trim().charAt(0).toUpperCase() || "?"}
      </Text>
    </View>
  );
}

const ADD_BADGE = 22;

const s = StyleSheet.create({
  rail: {
    paddingTop: space.stories.top,
    paddingBottom: space.stories.bottom,
    paddingHorizontal: space.stories.x,
    gap: space.stories.gap,
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

  addBadge: {
    position: "absolute",
    right: -2,
    top: size.avatar.story - ADD_BADGE + 2,
    width: ADD_BADGE,
    height: ADD_BADGE,
    borderRadius: ADD_BADGE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.green,
    borderWidth: 2,
    borderColor: color.surface,
  },

  label: {
    marginTop: space.stories.avatarToLabel,
    maxWidth: size.avatar.story,
    textAlign: "center",
    color: color.ink,
  },
});
