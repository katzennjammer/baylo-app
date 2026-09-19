import { FlatList, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";


import { colors } from "../../src/theme/palette";
import { useProfileMe } from "../../src/api/profile";
import { useRefetchOnFocus } from "../../src/lib/refetch-on-focus";
import { useSession } from "../../src/auth/session";
import type { Item } from "../../src/api/types";
import type { ProfileMePayload } from "../../src/api/types";

/**
 * Profile — the account block, and the way out.
 *
 * Everything else this tab will eventually carry (listings, Leaves, rank, trade
 * history) is unbuilt, and the card below says so rather than rendering empty
 * rows that are indistinguishable from a working screen with no data.
 *
 * Sign-out is here now because it is the one control that has nowhere else to
 * live. There is no settings screen yet, and until there is, "I am signed in as
 * an account I did not mean to be" has no remedy inside the app at all.
 *
 * THE IDENTITY BLOCK READS THE STORED SESSION, not useHome(). It costs no
 * request — name, email and avatar were written to SecureStore by the token
 * endpoint at sign-in — and, more to the point, it is still correct on a phone
 * with no signal. Which is exactly the state someone is in when they most want
 * to check whose account this is before signing out of it.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { data: profile, refetch } = useProfileMe();

  // Badge art, the shelf and the counts are written by other screens and by the
  // admin panel, and this tab stays mounted behind them. Without this the shelf
  // serves its cached payload for the whole `staleTime` after a badge image is
  // added — the achievements screen would show the new art while this one still
  // showed the icon fallback. Same ask the Home and Marketplace grids make.
  useRefetchOnFocus(refetch);

  const user = session?.user;

  const items = profile?.items ?? [];
  return (
    <FlatList
      className="flex-1 bg-bg"
      data={items}
      numColumns={3}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <ProfileHeader
          name={profile?.user.name ?? user?.name ?? "Signed in"}
          avatar={profile?.user.avatar ?? user?.image ?? null}
          bio={profile?.user.bio}
          followers={profile?.counts.followers ?? 0}
          following={profile?.counts.following ?? 0}
          posts={profile?.counts.listed ?? items.length}
          displayedAchievements={profile?.displayedAchievements ?? []}
          achievementCount={profile?.achievementCount ?? 0}
          onMoreAchievements={() => router.push("/achievements")}
        />
      }
      renderItem={({ item }) => (
        <ProfileTile
          item={item}
          onPress={() =>
            router.push({
              pathname: shelfLabel(item) ? "/listing-review" : "/item",
              params: { id: item.id },
            })
          }
        />
      )}
      ListEmptyComponent={<Text className="text-muted text-center py-12">Your listings will appear here.</Text>}
      contentContainerStyle={{ paddingTop: 12 }}
    />
  );
}

function ProfileHeader({
  name,
  avatar,
  bio,
  posts,
  followers,
  following,
  displayedAchievements,
  achievementCount,
  onMoreAchievements,
}: {
  name: string;
  avatar: string | null;
  bio: string | null | undefined;
  posts: number;
  followers: number;
  following: number;
  displayedAchievements: ProfileMePayload["displayedAchievements"];
  achievementCount: number;
  onMoreAchievements: () => void;
}) {
  return (
    <View className="px-4 pb-5">
      <View className="flex-row items-center">
        <Avatar uri={avatar} name={name} />
        <View className="flex-1 flex-row justify-around ml-5">
          <Stat label="Posts" value={posts} />
          <Stat label="Followers" value={followers} />
          <Stat label="Following" value={following} />
        </View>
      </View>
      <Text className="text-text text-lg font-bold mt-4">{name}</Text>
      {bio ? <Text className="text-muted text-sm mt-1 leading-5">{bio}</Text> : null}
      {displayedAchievements.length > 0 ? <BadgeShelf badges={displayedAchievements} onMore={onMoreAchievements} /> : null}
      <View className="border-b border-line mt-5" />
    </View>
  );
}

const badgeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  check: "shield-checkmark-outline",
  id: "id-card-outline",
  list: "list-outline",
  swap: "swap-horizontal-outline",
};

/**
 * The profile badge shelf.
 *
 * ── ONLY THE PICKED BADGES APPEAR ────────────────────────────────
 *
 * The user picks up to four badges on the achievements screen, and the shelf
 * renders exactly those -- one pick shows one badge, four show four. There are
 * no empty placeholder slots: an unselected position is simply absent, not a
 * dashed circle. `displayedAchievements` is already only the selected rows, in
 * order (see profile/me), so there is nothing to filter here; the slice(0, 4)
 * is a belt-and-braces cap matching the server's.
 *
 * The "More" affordance is a NAVIGATION button, not a slot -- it opens the
 * achievements screen. It is shown only while the user still has shelf room, so
 * a full shelf is not cluttered with an invitation to add more.
 */
function BadgeShelf({ badges, onMore }: { badges: ProfileMePayload["displayedAchievements"]; onMore: () => void }) {
  const shown = badges.slice(0, 4);
  const hasRoom = shown.length < 4;
  return (
    <View className="mt-5">
      <Text className="text-blue text-xs font-bold tracking-widest">BADGES - SECTION</Text>
      <View className="flex-row items-start mt-3 gap-3 flex-wrap">
        {shown.map((badge) => (
          <View key={badge.id} className="items-center w-14">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-accent/15 overflow-hidden">
              {badge.imageUrl ? (
                <Image source={{ uri: badge.imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <Ionicons name={badgeIcons[badge.icon] ?? "trophy-outline"} size={25} color={colors.accent} />
              )}
            </View>
            <Text className="text-muted text-[11px] text-center mt-1" numberOfLines={2}>{badge.name}</Text>
          </View>
        ))}
        {hasRoom ? (
          <Pressable className="items-center w-14" onPress={onMore} accessibilityLabel="More achievements">
            <View className="h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-muted/60">
              <Ionicons name="add" size={24} color={colors.muted} />
            </View>
            <Text className="text-muted text-[11px] text-center mt-1">More</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) { return <View className="items-center"><Text className="text-text text-base font-bold">{value}</Text><Text className="text-muted text-xs mt-1">{label}</Text></View>; }

/**
 * A tile the owner has a decision on says so. Until 18 Sep 2026 a listing
 * hidden by a moderator looked like every other tile here and answered
 * "Item not found" when tapped; one parked for a value review was not on the
 * shelf at all. The label is the whole difference, and tapping a labelled tile
 * opens the review screen (what happened, what to do) rather than the item.
 */
export function shelfLabel(item: Item): string | null {
  if (item.hiddenByModerator) return "Hidden by a moderator";
  if (item.status === "PENDING_REVIEW") return "Waiting for review";
  if (item.status === "VALUE_REJECTED") return "Value not approved";
  return null;
}

function ProfileTile({ item, onPress }: { item: Item; onPress: () => void }) {
  const label = shelfLabel(item);
  return <Pressable onPress={onPress} className="w-1/3 aspect-square border-r border-b border-bg bg-card" accessibilityRole="button" accessibilityLabel={label ? `${item.title} — ${label}` : `Open ${item.title}`}>
    {item.images[0] ? <Image source={{ uri: item.images[0] }} contentFit="cover" style={{ width: "100%", height: "100%", opacity: label ? 0.55 : 1 }} /> : <View className="flex-1 items-center justify-center bg-card"><Ionicons name="image-outline" size={24} color={colors.muted} /></View>}
    {label ? <View className="absolute inset-x-0 bottom-0 bg-black/70 px-1.5 py-1"><Text className="text-white text-[10px] font-semibold" numberOfLines={1}>{label}</Text></View> : null}
  </Pressable>;
}


/** The same fallback-to-initial avatar FeedCard uses, at the size this screen wants. */
function Avatar({ uri, name }: { uri: string | null; name: string }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        contentFit="cover"
        style={{ width: 56, height: 56, borderRadius: 28 }}
      />
    );
  }
  return (
    <View className="h-14 w-14 items-center justify-center rounded-full bg-accent">
      <Text className="text-on-accent text-xl font-bold">
        {name.trim().charAt(0).toUpperCase() || "?"}
      </Text>
    </View>
  );
}
