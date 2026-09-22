import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useFollow, usePublicProfile, useUnfollow } from "../../src/api/profile";
import { useSession } from "../../src/auth/session";
import { useProfileReviews, type ProfileReview } from "../../src/api/reviews";
import { Avatar, Badges, OrgLogo, ProfileTabs, ProfileTile, ReviewRow, ReviewSummary, VerifiedOrgBadge, shelfLabel } from "./profile";
import { ChevronLeftIcon } from "../../src/components/icons";
import { Tappable } from "../../src/components/Tappable";
import { bracketLabel } from "../../src/lib/brackets";
import { TIER_LABEL } from "../../src/lib/trust";
import type { Item } from "../../src/api/types";
import { color, font, icon, space, textStyle, type } from "../../src/theme/tokens";

type ProfileRow = { kind: "posts"; items: Item[] } | { kind: "review"; review: ProfileReview };

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const isOwnProfile = !!id && id === session?.user.id;
  const { data, isPending, isError, refetch, isRefetching } = usePublicProfile(isOwnProfile ? undefined : id);
  const follow = useFollow();
  const unfollow = useUnfollow();
  const dark = useColorScheme() === "dark";
  const palette = dark ? darkColors : lightColors;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"posts" | "reviews">("posts");
  const reviewQuery = useProfileReviews(id, tab === "reviews");

  useEffect(() => {
    if (isOwnProfile) router.replace("/(app)/profile");
  }, [isOwnProfile, router]);

  const onRefresh = useCallback(() => {
    if (tab === "reviews") void reviewQuery.refetch();
    else void refetch();
  }, [refetch, reviewQuery, tab]);

  if (isOwnProfile) return null;

  if (isPending) return <View style={[s.screen, { backgroundColor: palette.surface }]}><BackRow title="Profile" insetsTop={insets.top} dark={dark} onPress={() => router.back()} /><ActivityIndicator color={palette.green} style={s.spinner} /></View>;
  if (isError || !data) return <View style={[s.screen, { backgroundColor: palette.surface }]}><BackRow title="Profile" insetsTop={insets.top} dark={dark} onPress={() => router.back()} /><Text style={[textStyle(type.emptyBody), s.empty, { color: palette.secondary }]}>This trader profile is unavailable.</Text></View>;

  const status = data.follow.status;
  /** Non-null exactly when this profile is an organisation. See the header block. */
  const org = data.user.org;
  const busy = follow.isPending || unfollow.isPending;
  const rows: ProfileRow[] = tab === "posts"
    ? chunkItems(data.items).map((items) => ({ kind: "posts", items }))
    : reviewQuery.reviews.map((review) => ({ kind: "review", review }));

  function toggleFollow() {
    if (!data || busy || status === "PENDING") return;
    if (status === "ACCEPTED") unfollow.mutate({ userId: data.user.id });
    else follow.mutate({ userId: data.user.id });
  }

  return <FlatList<ProfileRow>
    style={[s.screen, { backgroundColor: palette.surface }]}
    data={rows}
    keyExtractor={(row) => row.kind === "posts" ? row.items.map((item) => item.id).join(":") : row.review.id}
    ListHeaderComponent={<>
      <BackRow title={data.user.name} insetsTop={insets.top} dark={dark} onPress={() => router.back()} />
      <View style={s.header}>
        {/*
          THE IDENTITY BLOCK IS THE ONLY THING THAT CHANGES FOR AN ORGANISATION.
          Square logo instead of a round avatar, and ONE "Staff" stat where a
          person gets Followers and Following -- which the spec asks for, and
          which also means an org header has no tappable stat, because there is
          no staff-list screen a stranger is entitled to open. The org's own
          members reach the roster from settings, not from here.
          Everything below -- bio, Follow, Message, tabs, the posts grid --
          is identical for both, deliberately.
        */}
        <View style={s.identityRow}>
          {org ? <OrgLogo uri={org.logoUrl} name={data.user.name} /> : <Avatar uri={data.user.avatar} name={data.user.name} />}
          <View style={s.stats}>
            <Stat dark={dark} label="Posts" value={data.counts.listed} />
            {org ? (
              <Stat dark={dark} label="Staff" value={data.counts.staff ?? org.staffCount} />
            ) : (
              <>
                <Stat dark={dark} label="Followers" value={data.counts.followers} onPress={() => router.push({ pathname: "/connections", params: { userId: data.user.id, kind: "followers" } })} />
                <Stat dark={dark} label="Following" value={data.counts.following} onPress={() => router.push({ pathname: "/connections", params: { userId: data.user.id, kind: "following" } })} />
              </>
            )}
          </View>
        </View>
        {/*
          One badge, never two. An organisation gets the checkmark and never a
          trust tier -- the server sends trustTier: null for one, so this is an
          either/or in the data as well as in the layout. An UNVERIFIED org
          gets neither, which is the honest rendering of a real account that
          has not been reviewed yet.
        */}
        {org?.verified ? (
          <VerifiedOrgBadge dark={dark} />
        ) : data.user.trustTier ? (
          <View style={[s.tier, { backgroundColor: dark ? "#244A31" : color.greenWash }]}><Text style={[s.tierText, { color: dark ? "#BFE8C7" : color.forest }]}>{TIER_LABEL[data.user.trustTier as keyof typeof TIER_LABEL] ?? data.user.trustTier}</Text></View>
        ) : null}
        {data.user.bio ? <Text style={[s.bio, { color: palette.secondary }]} numberOfLines={3}>{data.user.bio}</Text> : null}
        <View style={s.actions}><Pressable onPress={toggleFollow} disabled={busy || status === "PENDING"} style={[s.actionButton, status === "NONE" ? s.followButton : { backgroundColor: palette.control, borderColor: palette.border }, (busy || status === "PENDING") && s.disabled]} accessibilityRole="button"><Text style={[s.actionText, status === "NONE" ? s.followText : { color: palette.ink }]}>{busy ? "Updating..." : status === "PENDING" ? "Requested" : status === "ACCEPTED" ? "Following" : "Follow"}</Text></Pressable><Pressable onPress={() => router.push({ pathname: "/messages/thread", params: { partner: data.user.id, partnerName: data.user.name, partnerAvatar: data.user.avatar ?? "" } })} style={[s.actionButton, { backgroundColor: palette.control }]} accessibilityRole="button"><Text style={[s.actionText, { color: palette.ink }]}>Message</Text></Pressable></View>
        {data.displayedAchievements.length > 0 ? <Badges dark={dark} achievements={data.displayedAchievements} showMore={false} onMore={() => undefined} /> : null}
      </View>
      <ProfileTabs dark={dark} active={tab} onChange={setTab} />
      {tab === "reviews" ? <ReviewSummary dark={dark} summary={reviewQuery.summary} /> : null}
    </>}
    renderItem={({ item: row }) => row.kind === "posts" ? <View style={s.gridRow}>{row.items.map((item) => <ProfileTile key={item.id} dark={dark} item={item} onPress={() => router.push({ pathname: shelfLabel(item) ? "/listing-review" : "/item", params: { id: item.id } })} />)}</View> : <ReviewRow dark={dark} review={row.review} onReviewer={() => router.push({ pathname: "/user", params: { id: row.review.reviewer.id } })} onItem={() => { if (row.review.item) router.push({ pathname: "/item", params: { id: row.review.item.id } }); }} />}
    onEndReached={() => { if (tab === "reviews" && reviewQuery.hasNextPage && !reviewQuery.isFetchingNextPage) void reviewQuery.fetchNextPage(); }}
    onEndReachedThreshold={0.6}
    refreshControl={<RefreshControl refreshing={tab === "reviews" ? reviewQuery.isRefetching : isRefetching} onRefresh={onRefresh} tintColor={palette.green} />}
    ListFooterComponent={tab === "reviews" && reviewQuery.isFetchingNextPage ? <ActivityIndicator color={palette.green} style={s.footer} /> : null}
    ListEmptyComponent={<Text style={[s.empty, { color: palette.muted }]}>{tab === "reviews" ? "No reviews yet." : "No posts yet."}</Text>}
  />;
}

function chunkItems(items: Item[]): Item[][] { const rows: Item[][] = []; for (let index = 0; index < items.length; index += 3) rows.push(items.slice(index, index + 3)); return rows; }
function BackRow({ title, insetsTop, dark, onPress }: { title: string; insetsTop: number; dark: boolean; onPress: () => void }) { const palette = dark ? darkColors : lightColors; return <View style={[s.top, { borderBottomColor: palette.divider, paddingTop: insetsTop, height: insetsTop + 64 }]}><Tappable onPress={onPress} accessibilityRole="button" accessibilityLabel="Go back" style={s.back} pressedStyle={s.backPressed}><ChevronLeftIcon size={icon.back.size} stroke={icon.back.stroke} color={palette.ink} /></Tappable><Text style={[s.headerTitle, { color: palette.ink }]} numberOfLines={1}>{title}</Text><View style={s.headerSpacer} /></View>; }
function Stat({ dark, label, value, onPress }: { dark: boolean; label: string; value: number; onPress?: () => void }) { const palette = dark ? darkColors : lightColors; const content = <><Text style={[s.statValue, { color: palette.ink }]}>{value}</Text><Text style={[s.statLabel, { color: palette.muted }]}>{label}</Text></>; return onPress ? <Pressable onPress={onPress} style={s.stat} accessibilityRole="button">{content}</Pressable> : <View style={s.stat}>{content}</View>; }

const s = StyleSheet.create({
  screen: { flex: 1 }, top: { flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.screenXTight }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, backPressed: { opacity: 0.6 }, headerTitle: { flex: 1, textAlign: "center", fontFamily: font.displaySemi, fontSize: 18 }, headerSpacer: { width: 44 }, spinner: { marginTop: 40 }, empty: { textAlign: "center", paddingVertical: 48 }, header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }, identityRow: { flexDirection: "row", alignItems: "center" }, stats: { flex: 1, flexDirection: "row", justifyContent: "space-evenly", marginLeft: 20 }, stat: { alignItems: "center", minWidth: 58, minHeight: 44, justifyContent: "center" }, statValue: { fontFamily: font.sansSemi, fontSize: 18 }, statLabel: { fontFamily: font.sans, fontSize: 12, marginTop: 4 }, tier: { alignSelf: "flex-start", borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6, marginTop: 6 }, tierText: { fontFamily: font.sansSemi, fontSize: 11 }, bio: { fontFamily: font.sans, fontSize: 14, lineHeight: 20, marginTop: 6 }, actions: { flexDirection: "row", gap: 8, marginTop: 8 }, actionButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: "transparent" }, followButton: { backgroundColor: color.green }, actionText: { fontFamily: font.sansSemi, fontSize: 14 }, followText: { color: color.onGreen }, disabled: { opacity: 0.55 }, gridRow: { width: "100%", flexDirection: "row", gap: 2, marginBottom: 2 }, footer: { paddingVertical: 18 },
});
const lightColors = { surface: color.surface, control: color.control, ink: color.ink, secondary: color.inkSecondary, muted: color.inkMuted, divider: color.divider, border: color.controlLine, green: color.green };
const darkColors = { surface: "#171A17", control: "#252A25", ink: "#F4F5F0", secondary: "#B6BDB3", muted: "#929B91", divider: "#343A34", border: "#596159", green: "#72D681" };