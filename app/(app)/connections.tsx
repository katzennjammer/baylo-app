import { useCallback } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { followButtonStatus, useFollow, useProfileConnections, useUnfollow } from "../../src/api/profile";
import type { ProfileConnectionUser } from "../../src/api/types";
import { ChevronLeftIcon } from "../../src/components/icons";
import { Tappable } from "../../src/components/Tappable";
import { TIER_LABEL } from "../../src/lib/trust";
import { useSession } from "../../src/auth/session";
import { color, font, icon, space } from "../../src/theme/tokens";

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

  return <View style={[s.screen, { backgroundColor: palette.surface }]}>
    <View style={[s.header, { borderBottomColor: palette.divider, paddingTop: insets.top, height: insets.top + 64 }]}><Tappable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={s.back} pressedStyle={s.pressed}><ChevronLeftIcon size={icon.back.size} stroke={icon.back.stroke} color={palette.ink} /></Tappable><Text style={[s.title, { color: palette.ink }]}>{kind === "following" ? "Following" : "Followers"}</Text><View style={s.headerSpacer} /></View>
    {query.isPending ? <View style={s.centered}><ActivityIndicator color={palette.green} /></View> : query.isError ? <View style={s.centered}><Text style={[s.emptyTitle, { color: palette.ink }]}>Could not load this list.</Text><Pressable onPress={() => void query.refetch()} style={[s.retry, { backgroundColor: palette.control }]}><Text style={[s.retryText, { color: palette.ink }]}>Try again</Text></Pressable></View> : <FlatList
      data={query.users}
      keyExtractor={(item) => item.id}
      contentContainerStyle={query.users.length === 0 ? s.emptyContent : s.content}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={onRefresh} tintColor={palette.green} />}
      renderItem={({ item }) => <ConnectionRow user={item} viewerId={session?.user.id} dark={dark} onPress={() => router.push({ pathname: "/user", params: { id: item.id } })} />}
      onEndReached={() => { if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage(); }}
      onEndReachedThreshold={0.6}
      ListEmptyComponent={<Text style={[s.emptyBody, { color: palette.muted }]}>No {kind} yet.</Text>}
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={palette.green} style={s.footer} /> : null}
    />}
  </View>;
}

function ConnectionRow({ user, viewerId, dark, onPress }: { user: ProfileConnectionUser; viewerId?: string; dark: boolean; onPress: () => void }) {
  const palette = dark ? darkColors : lightColors;
  const follow = useFollow();
  const unfollow = useUnfollow();
  const label = followButtonStatus(user.follow.status);
  const buttonLabel = label === "Follow" && user.followsYou ? "Follow back" : label;
  const busy = follow.isPending || unfollow.isPending;
  const disabled = busy || label === "Requested";
  function toggle() {
    if (disabled) return;
    if (label === "Following") unfollow.mutate({ userId: user.id });
    else follow.mutate({ userId: user.id });
  }
  return <View style={[s.row, { borderBottomColor: palette.divider }]}><Pressable onPress={onPress} style={s.identity} accessibilityRole="button" accessibilityLabel={`View ${user.name}'s profile`}><Avatar user={user} dark={dark} /><View style={s.identityText}><Text style={[s.name, { color: palette.ink }]} numberOfLines={1}>{user.name}</Text>{user.trustTier ? <Text style={[s.tier, { color: palette.muted }]}>{TIER_LABEL[user.trustTier as keyof typeof TIER_LABEL] ?? user.trustTier}</Text> : null}</View></Pressable>{viewerId !== user.id ? <Pressable onPress={toggle} disabled={disabled} style={[s.followButton, label === "Follow" ? { backgroundColor: palette.green } : { backgroundColor: palette.control, borderColor: palette.border }, disabled && s.disabled]} accessibilityRole="button" accessibilityLabel={buttonLabel}><Text style={[s.followText, { color: label === "Follow" ? color.onGreen : palette.ink }]}>{busy ? "Updating..." : buttonLabel}</Text></Pressable> : null}</View>;
}

function Avatar({ user, dark }: { user: ProfileConnectionUser; dark: boolean }) {
  const palette = dark ? darkColors : lightColors;
  return user.avatar ? <Image source={{ uri: user.avatar }} style={s.avatar} /> : <View style={[s.avatar, s.fallback, { backgroundColor: palette.control }]}><Text style={[s.initial, { color: palette.green }]}>{user.name.trim().charAt(0).toUpperCase() || "?"}</Text></View>;
}

const s = StyleSheet.create({
  screen: { flex: 1 }, header: { height: 64, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.screenXTight }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, pressed: { opacity: 0.6 }, title: { flex: 1, textAlign: "center", fontFamily: font.displaySemi, fontSize: 18 }, headerSpacer: { width: 44 }, content: { paddingHorizontal: 16 }, row: { minHeight: 72, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth }, identity: { flex: 1, minHeight: 64, flexDirection: "row", alignItems: "center" }, avatar: { width: 44, height: 44, borderRadius: 22 }, fallback: { alignItems: "center", justifyContent: "center" }, initial: { fontFamily: font.sansBold, fontSize: 17 }, identityText: { flex: 1, minWidth: 0, marginLeft: 12 }, name: { fontFamily: font.sansSemi, fontSize: 14 }, tier: { fontFamily: font.sans, fontSize: 11, marginTop: 4 }, followButton: { minWidth: 104, minHeight: 44, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1 }, followText: { fontFamily: font.sansSemi, fontSize: 13 }, disabled: { opacity: 0.55 }, centered: { flex: 1, alignItems: "center", justifyContent: "center" }, emptyContent: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 }, emptyTitle: { fontFamily: font.displaySemi, fontSize: 20 }, emptyBody: { fontFamily: font.sans, fontSize: 14, textAlign: "center" }, retry: { minHeight: 44, marginTop: 14, borderRadius: 8, paddingHorizontal: 18, justifyContent: "center" }, retryText: { fontFamily: font.sansSemi, fontSize: 14 }, footer: { paddingVertical: 18 },
});
const lightColors = { surface: color.surface, control: color.control, ink: color.ink, muted: color.inkMuted, divider: color.divider, border: color.controlLine, green: color.green };
const darkColors = { surface: "#171A17", control: "#252A25", ink: "#F4F5F0", muted: "#929B91", divider: "#343A34", border: "#596159", green: "#72D681" };