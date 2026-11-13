import { useCallback } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { followButtonLabel, followButtonStatus, useFollow, useProfileConnections, useRemoveFollower, useUnfollow } from "../../src/api/profile";
import { MascotEmptyState } from "../../src/components/MascotEmptyState";
import { showDialog } from "../../src/components/dialog";
import type { ProfileConnectionUser } from "../../src/api/types";
import { ChevronLeftIcon } from "../../src/components/icons";
import { Tappable } from "../../src/components/Tappable";
import { useSession } from "../../src/auth/session";
import { color, font, icon, space } from "../../src/theme/tokens";
import { sizedImage } from "../../src/media/image-url";
import { PremiumName } from "../../src/components/PremiumName";

type ConnectionKind = "followers" | "following";

export default function ConnectionsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { userId, kind: rawKind } = useLocalSearchParams<{ userId?: string; kind?: string }>();
  const kind: ConnectionKind = rawKind === "following" ? "following" : "followers";
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === "dark";
  const palette = dark ? darkColors : lightColors;
  const query = useProfileConnections(userId, kind);
  const onRefresh = useCallback(() => { void query.refetch(); }, [query]);
  const viewerId = session?.user.id;
  // Your own followers list is where "Remove" lives.
  const ownFollowers = kind === "followers" && !!viewerId && userId === viewerId;
  const switchTo = (next: ConnectionKind) => { if (next !== kind) router.setParams({ kind: next }); };

  return <View style={[s.screen, { backgroundColor: palette.surface }]}>
    <View style={[s.header, { paddingTop: insets.top, height: insets.top + 56 }]}>
      <Tappable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={s.back} pressedStyle={s.pressed}><ChevronLeftIcon size={icon.back.size} stroke={icon.back.stroke} color={palette.ink} /></Tappable>
      <Text style={[s.title, { color: palette.ink }]}>{kind === "following" ? "Following" : "Followers"}</Text>
      <View style={s.headerSpacer} />
    </View>
    {/* The two lists side by side, so you can switch without going back. */}
    <View style={[s.tabs, { borderBottomColor: palette.divider }]}>
      {(["followers", "following"] as const).map((k) => (
        <Pressable key={k} onPress={() => switchTo(k)} style={s.tab} accessibilityRole="tab" accessibilityState={{ selected: kind === k }}>
          <Text style={[s.tabText, { color: kind === k ? palette.ink : palette.muted }]}>{k === "followers" ? "Followers" : "Following"}</Text>
          {kind === k ? <View style={[s.tabLine, { backgroundColor: palette.ink }]} /> : null}
        </Pressable>
      ))}
    </View>
    {query.isPending ? <View style={s.centered}><ActivityIndicator color={palette.green} /></View> : query.isError ? <View style={s.centered}><Text style={[s.emptyTitle, { color: palette.ink }]}>Could not load this list.</Text><Pressable onPress={() => void query.refetch()} style={[s.retry, { backgroundColor: palette.control }]}><Text style={[s.retryText, { color: palette.ink }]}>Try again</Text></Pressable></View> : <FlatList
      data={query.users}
      keyExtractor={(item) => item.id}
      contentContainerStyle={query.users.length === 0 ? s.emptyContent : s.content}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={onRefresh} tintColor={palette.green} />}
      renderItem={({ item }) => <ConnectionRow user={item} viewerId={viewerId} ownFollowers={ownFollowers} showFollowsYou={kind === "following"} dark={dark} onPress={() => router.push({ pathname: "/user", params: { id: item.id } })} />}
      onEndReached={() => { if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage(); }}
      onEndReachedThreshold={0.6}
      ListEmptyComponent={<MascotEmptyState pose="search" size={110} title={kind === "following" ? "Not following anyone yet" : "No followers yet"} message={kind === "following" ? "Follow traders to see their new listings first." : "When someone follows you, they show up here."} />}
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={palette.green} style={s.footer} /> : null}
    />}
  </View>;
}

function tierWords(tier: string | null): string | null {
  if (!tier) return null;
  return tier.toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

function ConnectionRow({ user, viewerId, ownFollowers, showFollowsYou, dark, onPress }: { user: ProfileConnectionUser; viewerId?: string; ownFollowers: boolean; showFollowsYou: boolean; dark: boolean; onPress: () => void }) {
  const palette = dark ? darkColors : lightColors;
  const follow = useFollow();
  const unfollow = useUnfollow();
  const remove = useRemoveFollower(viewerId);
  const label = followButtonStatus(user.follow.status);
  const buttonLabel = followButtonLabel(user.follow.status, user.followsYou);
  const busy = follow.isPending || unfollow.isPending || remove.isPending;
  const toggle = () => {
    if (busy) return;
    if (label === "Following") unfollow.mutate({ userId: user.id });
    else if (label === "Follow") follow.mutate({ userId: user.id });
  };
  const confirmRemove = () => {
    if (busy) return;
    showDialog("Remove follower?", `${user.name} will stop following you. They won't be told, and they can follow you again.`, [
      { text: "Keep", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => remove.mutate({ userId: user.id }) },
    ]);
  };
  const self = viewerId === user.id;
  const sub = [tierWords(user.trustTier), showFollowsYou && user.followsYou ? "Follows you" : null].filter(Boolean).join(" · ");
  const filled = label === "Follow";

  return <View style={s.row}>
    <Pressable onPress={onPress} style={s.identity} accessibilityRole="button" accessibilityLabel={`View ${user.name}'s profile`}>
      <Avatar user={user} dark={dark} />
      <View style={s.identityText}>
        <PremiumName premium={user.premium} style={[s.name, { color: palette.ink }]}>{user.name}</PremiumName>
        {sub ? <Text style={[s.tier, { color: palette.muted }]} numberOfLines={1}>{sub}</Text> : null}
        {/* On your own followers list the button is Remove, so following
            back is a small link under the name instead. */}
        {ownFollowers && filled ? (
          <Pressable onPress={toggle} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Follow ${user.name} back`}>
            <Text style={[s.inlineFollow, { color: palette.green }]}>Follow back</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
    {self ? null : ownFollowers ? (
      <Pressable onPress={confirmRemove} disabled={busy} style={[s.pill, { borderColor: palette.border, backgroundColor: palette.surface }, busy && s.disabled]} accessibilityRole="button" accessibilityLabel={`Remove ${user.name} as a follower`}>
        <Text style={[s.pillText, { color: palette.ink }]}>{remove.isPending ? "Removing…" : "Remove"}</Text>
      </Pressable>
    ) : (
      <Pressable onPress={toggle} disabled={busy || label === "Requested"} style={[s.pill, filled ? { backgroundColor: palette.green, borderColor: palette.green } : { borderColor: palette.border, backgroundColor: palette.surface }, busy && s.disabled]} accessibilityRole="button" accessibilityLabel={buttonLabel}>
        <Text style={[s.pillText, { color: filled ? color.onGreen : palette.ink }]}>{busy ? "…" : buttonLabel === "Follow Back" ? "Follow back" : buttonLabel}</Text>
      </Pressable>
    )}
  </View>;
}

function Avatar({ user, dark }: { user: ProfileConnectionUser; dark: boolean }) {
  const palette = dark ? darkColors : lightColors;
  return user.avatar ? <Image source={{ uri: sizedImage(user.avatar, "thumb") }} style={s.avatar} /> : <View style={[s.avatar, s.fallback, { backgroundColor: palette.control }]}><Text style={[s.initial, { color: palette.green }]}>{user.name.trim().charAt(0).toUpperCase() || "?"}</Text></View>;
}

const s = StyleSheet.create({
  screen: { flex: 1 }, header: { height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: space.screenXTight }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, pressed: { opacity: 0.6 }, title: { flex: 1, textAlign: "center", fontFamily: font.displaySemi, fontSize: 18 }, headerSpacer: { width: 44 }, content: { paddingHorizontal: 16, paddingTop: 6 }, row: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 10 }, identity: { flex: 1, minHeight: 60, flexDirection: "row", alignItems: "center" }, avatar: { width: 48, height: 48, borderRadius: 24 }, fallback: { alignItems: "center", justifyContent: "center" }, initial: { fontFamily: font.sansBold, fontSize: 17 }, identityText: { flex: 1, minWidth: 0, marginLeft: 12 }, name: { fontFamily: font.sansSemi, fontSize: 15 }, tier: { fontFamily: font.sans, fontSize: 12, marginTop: 2 }, inlineFollow: { fontFamily: font.sansSemi, fontSize: 13, marginTop: 3 }, pill: { minWidth: 96, height: 36, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", borderRadius: 18, borderWidth: 1 }, pillText: { fontFamily: font.sansSemi, fontSize: 13 }, tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth }, tab: { flex: 1, height: 44, alignItems: "center", justifyContent: "center" }, tabText: { fontFamily: font.sansSemi, fontSize: 14 }, tabLine: { position: "absolute", bottom: 0, height: 2, width: 64, borderRadius: 1 }, disabled: { opacity: 0.55 }, centered: { flex: 1, alignItems: "center", justifyContent: "center" }, emptyContent: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 }, emptyTitle: { fontFamily: font.displaySemi, fontSize: 20 }, emptyBody: { fontFamily: font.sans, fontSize: 14, textAlign: "center" }, retry: { minHeight: 44, marginTop: 14, borderRadius: 8, paddingHorizontal: 18, justifyContent: "center" }, retryText: { fontFamily: font.sansSemi, fontSize: 14 }, footer: { paddingVertical: 18 },
});
const lightColors = { surface: color.surface, control: color.control, ink: color.ink, muted: color.inkMuted, divider: color.divider, border: color.controlLine, green: color.green };
const darkColors = { surface: "#171A17", control: "#252A25", ink: "#F4F5F0", muted: "#929B91", divider: "#343A34", border: "#596159", green: "#72D681" };