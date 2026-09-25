import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Share, StyleSheet, Text, View } from "react-native";
import { useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { followButtonLabel, useFollow, usePublicProfile, useUnfollow } from "../../src/api/profile";
import { useSession } from "../../src/auth/session";
import { useProfileReviews, type ProfileReview } from "../../src/api/reviews";
import { Avatar, Badges, ProfileTabs, ProfileTile, ReviewRow, ReviewSummary, shelfLabel } from "./profile";
import { ChevronLeftIcon } from "../../src/components/icons";
import { OrgStorefrontHeader, StorefrontEmpty, useStorefrontKeyboard } from "../../src/components/OrgStorefrontHeader";
import { getApiBase } from "../../src/api/config";
import { getActingOrgId } from "../../src/api/org-context";
import { Tappable } from "../../src/components/Tappable";
import { bracketLabel } from "../../src/lib/brackets";
import { TIER_LABEL } from "../../src/lib/trust";
import type { Item } from "../../src/api/types";
import { color, dark as darkTokens, font, icon, space, textStyle, type } from "../../src/theme/tokens";

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
  // The storefront's invite field needs both: see useStorefrontKeyboard.
  const list = useRef<FlatList<ProfileRow>>(null);
  const { keyboardUp, imeInset } = useStorefrontKeyboard();

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

  const openMessage = () => router.push({ pathname: "/messages/thread", params: { partner: data.user.id, partnerName: data.user.name, partnerAvatar: data.user.avatar ?? "" } });

  /*
    AN ORGANISATION GETS THE STOREFRONT HEADER, a different layout rather than
    this one with a square avatar: banner + anchored logo, business identity,
    Staff / Active listings / Trades completed, and the members-only roster.
    See OrgStorefrontHeader. Everything from the tabs down -- the posts grid
    and the reviews list -- is the same code path as a person's.
  */
  const header = org ? (
    <OrgStorefrontHeader
      dark={dark}
      org={org}
      counts={data.counts}
      viewerId={session?.user.id ?? null}
      follow={{ label: followButtonLabel(status, data.follow.followsYou), busy, disabled: busy || status === "PENDING", primary: status === "NONE", onPress: toggleFollow }}
      onMessage={openMessage}
      onEdit={() => router.push({ pathname: "/edit-org", params: { id: org.id, userId: data.user.id } })}
      onShare={() => void Share.share({ message: `${org.name} on Baylo
${getApiBase().replace(/\/+$/, "")}/profile/${encodeURIComponent(data.user.id)}`, title: "Share shop" })}
      // Only while acting AS this shop -- otherwise Post lists on the viewer's
      // personal shelf. getActingOrgId() is read per render, as elsewhere.
      onPost={getActingOrgId() === org.id ? () => router.push("/post-item") : undefined}
      scrollerRef={list}
      keyboardUp={keyboardUp}
    />
  ) : null;
  const emptyList = org ? (
    tab === "reviews"
      ? <StorefrontEmpty dark={dark} title="No reviews yet" body="Reviews appear here after a completed trade." />
      : <StorefrontEmpty dark={dark} title="No listings yet" body={org.viewerRole ? "Listings posted as this shop appear here." : "This shop hasn't listed anything yet."} />
  ) : <Text style={[s.empty, { color: palette.muted }]}>{tab === "reviews" ? "No reviews yet." : "No posts yet."}</Text>;

  return <FlatList<ProfileRow>
    ref={list}
    style={[s.screen, { backgroundColor: palette.surface, marginBottom: imeInset }]}
    keyboardShouldPersistTaps="handled"
    data={rows}
    keyExtractor={(row) => row.kind === "posts" ? row.items.map((item) => item.id).join(":") : row.review.id}
    ListHeaderComponent={<>
      <BackRow title={data.user.name} insetsTop={insets.top} dark={dark} onPress={() => router.back()} />
      {header ?? (
      <View style={s.header}>
        {/* A PERSON. Organisations never reach this block -- see `header` above. */}
        <View style={s.identityRow}>
          <Avatar uri={data.user.avatar} name={data.user.name} />
          <View style={s.stats}>
            <Stat dark={dark} label="Posts" value={data.counts.listed} />
            <Stat dark={dark} label="Followers" value={data.counts.followers} onPress={() => router.push({ pathname: "/connections", params: { userId: data.user.id, kind: "followers" } })} />
            <Stat dark={dark} label="Following" value={data.counts.following} onPress={() => router.push({ pathname: "/connections", params: { userId: data.user.id, kind: "following" } })} />
          </View>
        </View>
        {data.user.trustTier ? (
          <View style={[s.tier, { backgroundColor: dark ? "#244A31" : color.greenWash }]}><Text style={[s.tierText, { color: dark ? "#BFE8C7" : color.forest }]}>{TIER_LABEL[data.user.trustTier as keyof typeof TIER_LABEL] ?? data.user.trustTier}</Text></View>
        ) : null}
        {data.user.bio ? <Text style={[s.bio, { color: palette.secondary }]} numberOfLines={3}>{data.user.bio}</Text> : null}
        <View style={s.actions}><Pressable onPress={toggleFollow} disabled={busy || status === "PENDING"} style={[s.actionButton, status === "NONE" ? s.followButton : { backgroundColor: palette.control, borderColor: palette.border }, (busy || status === "PENDING") && s.disabled]} accessibilityRole="button"><Text style={[s.actionText, status === "NONE" ? s.followText : { color: palette.ink }]}>{busy ? "Updating..." : followButtonLabel(status, data.follow.followsYou)}</Text></Pressable><Pressable onPress={openMessage} style={[s.actionButton, { backgroundColor: palette.control }]} accessibilityRole="button"><Text style={[s.actionText, { color: palette.ink }]}>Message</Text></Pressable></View>
        {data.displayedAchievements.length > 0 ? <Badges dark={dark} achievements={data.displayedAchievements} showMore={false} showEarnedDate={false} onMore={() => undefined} /> : null}
      </View>
      )}
      <ProfileTabs dark={dark} active={tab} onChange={setTab} />
      {tab === "reviews" ? <ReviewSummary dark={dark} summary={reviewQuery.summary} hideTier={!!org} /> : null}
    </>}
    renderItem={({ item: row }) => row.kind === "posts" ? <View style={s.gridRow}>{row.items.map((item) => <ProfileTile key={item.id} dark={dark} item={item} onPress={() => router.push({ pathname: shelfLabel(item) ? "/listing-review" : "/item", params: { id: item.id } })} />)}</View> : <ReviewRow dark={dark} review={row.review} onReviewer={() => router.push({ pathname: "/user", params: { id: row.review.reviewer.id } })} onItem={() => { if (row.review.item) router.push({ pathname: "/item", params: { id: row.review.item.id } }); }} />}
    onEndReached={() => { if (tab === "reviews" && reviewQuery.hasNextPage && !reviewQuery.isFetchingNextPage) void reviewQuery.fetchNextPage(); }}
    onEndReachedThreshold={0.6}
    refreshControl={<RefreshControl refreshing={tab === "reviews" ? reviewQuery.isRefetching : isRefetching} onRefresh={onRefresh} tintColor={palette.green} />}
    ListFooterComponent={tab === "reviews" && reviewQuery.isFetchingNextPage ? <ActivityIndicator color={palette.green} style={s.footer} /> : null}
    ListEmptyComponent={emptyList}
  />;
}

function chunkItems(items: Item[]): Item[][] { const rows: Item[][] = []; for (let index = 0; index < items.length; index += 3) rows.push(items.slice(index, index + 3)); return rows; }
function BackRow({ title, insetsTop, dark, onPress }: { title: string; insetsTop: number; dark: boolean; onPress: () => void }) { const palette = dark ? darkColors : lightColors; return <View style={[s.top, { borderBottomColor: palette.divider, paddingTop: insetsTop, height: insetsTop + 64 }]}><Tappable onPress={onPress} accessibilityRole="button" accessibilityLabel="Go back" style={s.back} pressedStyle={s.backPressed}><ChevronLeftIcon size={icon.back.size} stroke={icon.back.stroke} color={palette.ink} /></Tappable><Text style={[s.headerTitle, { color: palette.ink }]} numberOfLines={1}>{title}</Text><View style={s.headerSpacer} /></View>; }
function Stat({ dark, label, value, onPress }: { dark: boolean; label: string; value: number; onPress?: () => void }) { const palette = dark ? darkColors : lightColors; const content = <><Text style={[s.statValue, { color: palette.ink }]}>{value}</Text><Text style={[s.statLabel, { color: palette.muted }]}>{label}</Text></>; return onPress ? <Pressable onPress={onPress} style={s.stat} accessibilityRole="button">{content}</Pressable> : <View style={s.stat}>{content}</View>; }

const s = StyleSheet.create({
  screen: { flex: 1 }, top: { flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.screenXTight }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, backPressed: { opacity: 0.6 }, headerTitle: { flex: 1, textAlign: "center", fontFamily: font.displaySemi, fontSize: 18 }, headerSpacer: { width: 44 }, spinner: { marginTop: 40 }, empty: { textAlign: "center", paddingVertical: 48 }, header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }, identityRow: { flexDirection: "row", alignItems: "center" }, stats: { flex: 1, flexDirection: "row", justifyContent: "space-evenly", marginLeft: 20 }, stat: { alignItems: "center", minWidth: 58, minHeight: 44, justifyContent: "center" }, statValue: { fontFamily: font.sansSemi, fontSize: 18 }, statLabel: { fontFamily: font.sans, fontSize: 12, marginTop: 4 }, tier: { alignSelf: "flex-start", borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6, marginTop: 6 }, tierText: { fontFamily: font.sansSemi, fontSize: 11 }, bio: { fontFamily: font.sans, fontSize: 14, lineHeight: 20, marginTop: 6 }, actions: { flexDirection: "row", gap: 8, marginTop: 8 }, actionButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: "transparent" }, followButton: { backgroundColor: color.green }, actionText: { fontFamily: font.sansSemi, fontSize: 14 }, followText: { color: color.onGreen }, disabled: { opacity: 0.55 }, gridRow: { width: "100%", flexDirection: "row", gap: 2, marginBottom: 2 }, footer: { paddingVertical: 18 },
});
const lightColors = { surface: color.surface, control: color.control, ink: color.ink, secondary: color.inkSecondary, muted: color.inkMuted, divider: color.divider, border: color.controlLine, green: color.green };
const darkColors = { surface: darkTokens.surface, control: darkTokens.control, ink: darkTokens.ink, secondary: darkTokens.secondary, muted: darkTokens.muted, divider: darkTokens.divider, border: darkTokens.border, green: darkTokens.green };