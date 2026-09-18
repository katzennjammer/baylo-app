import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { colors } from "../../src/theme/palette";
import { useProfileMe } from "../../src/api/profile";
import { useSession } from "../../src/auth/session";
import type { Item } from "../../src/api/types";

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
  const { session, signOut } = useSession();
  const { data: profile } = useProfileMe();
  const [busy, setBusy] = useState(false);
  // A ref as well as the state flag: Alert's onPress can fire twice on a fast
  // double-tap, before the re-render that disables the button has landed. A
  // second signOut() would post a second revoke with a token already spent.
  const inFlight = useRef(false);

  const user = session?.user;

  const performSignOut = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);

    try {
      await signOut();
    } catch {
      // Nothing to show, and nowhere to show it. signOut() drops the in-memory
      // session and publishes that before anything which can fail is awaited,
      // so by the time an error reaches here the guard in (app)/_layout.tsx has
      // already replaced this entire tree with the login screen.
      //
      // Note there is no router.replace() on the success path either, for the
      // same reason: the redirect is declarative and belongs to the guard.
      // Navigating imperatively from here would race it, and the guard is the
      // path a mid-session logout already takes when the refresh interceptor
      // gives up — one mechanism, not two.
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [signOut]);

  const confirmSignOut = useCallback(() => {
    Alert.alert(
      "Sign out?",
      "This device will forget your tokens, and the session is revoked on the server so it cannot be resumed.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => void performSignOut() },
      ],
    );
  }, [performSignOut]);

  const items = profile?.items ?? [];
  return (
    <FlatList
      className="flex-1 bg-bg"
      data={items}
      numColumns={3}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={<ProfileHeader name={profile?.user.name ?? user?.name ?? "Signed in"} avatar={profile?.user.avatar ?? user?.image ?? null} bio={profile?.user.bio} followers={profile?.counts.followers ?? 0} following={profile?.counts.following ?? 0} posts={profile?.counts.listed ?? items.length} />}
      renderItem={({ item }) => <ProfileTile item={item} onPress={() => router.push({ pathname: shelfLabel(item) ? "/listing-review" : "/item", params: { id: item.id } })} />}
      ListEmptyComponent={<Text className="text-muted text-center py-12">Your listings will appear here.</Text>}
      ListFooterComponent={<View className="px-4 pt-8 pb-10"><SignOutButton onPress={confirmSignOut} busy={busy} /></View>}
      contentContainerStyle={{ paddingTop: 12 }}
    />
  );
}

function ProfileHeader({ name, avatar, bio, posts, followers, following }: { name: string; avatar: string | null; bio: string | null | undefined; posts: number; followers: number; following: number }) {
  return <View className="px-4 pb-5"><View className="flex-row items-center"><Avatar uri={avatar} name={name} /><View className="flex-1 flex-row justify-around ml-5"><Stat label="Posts" value={posts} /><Stat label="Followers" value={followers} /><Stat label="Following" value={following} /></View></View><Text className="text-text text-lg font-bold mt-4">{name}</Text>{bio ? <Text className="text-muted text-sm mt-1 leading-5">{bio}</Text> : null}<View className="border-b border-line mt-5" /></View>;
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

/**
 * The destructive action, on the app's dark canvas.
 *
 * Not one of the buttons in `src/components/auth-ui.tsx`: those are built for
 * the white card the auth screens use and hardcode `bg-white` with ink type,
 * which here would be a bright slab in the middle of a very dark screen.
 *
 * Outlined rather than filled. A filled red button is the loudest thing on any
 * screen it is on, and this is not the screen's primary action — it is only its
 * ONLY action, which is an accident of the tab being unbuilt rather than a
 * claim about its importance. h-[52px] matches the auth buttons and clears the
 * 44px tap floor with room for the border.
 */
function SignOutButton({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Sign out"
      accessibilityState={{ disabled: busy, busy }}
      className={`h-[52px] flex-row items-center justify-center gap-2.5 rounded-full border border-danger/50 ${
        busy ? "opacity-50" : "bg-danger/10 active:bg-danger/20"
      }`}
    >
      {busy ? (
        <ActivityIndicator color={colors.danger} />
      ) : (
        <>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text className="text-danger text-[15px] font-bold uppercase tracking-wider">
            Sign out
          </Text>
        </>
      )}
    </Pressable>
  );
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
