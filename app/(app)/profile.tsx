import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { useProfileMe } from "../../src/api/profile";
import { useSession } from "../../src/auth/session";
import type { Item } from "../../src/api/types";
import { color, font } from "../../src/theme/tokens";
import { useColorScheme } from "react-native";
import { TIER_LABEL } from "../../src/lib/trust";
import { getApiBase } from "../../src/api/config";

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
  const dark = useColorScheme() === "dark";
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

  const shareProfile = useCallback(async () => {
    const profileUrl = `${getApiBase().replace(/\/+$/, "")}/profile/${encodeURIComponent(user?.id ?? "")}`;
    await Share.share({
      message: `${profile?.user.name ?? user?.name ?? "A Baylo trader"} on Baylo\n${profileUrl}`,
      title: "Share profile",
    });
  }, [profile?.user.name, user?.id, user?.name]);

  const items = profile?.items ?? [];
  return (
    <FlatList
      style={s.screen}
      data={items}
      numColumns={3}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={<ProfileHeader dark={dark} name={profile?.user.name ?? user?.name ?? "Signed in"} avatar={profile?.user.avatar ?? user?.image ?? null} bio={profile?.user.bio} tier={profile?.reputation.tier} verified={profile?.user.isVerified ?? false} followers={profile?.counts.followers ?? 0} following={profile?.counts.following ?? 0} posts={profile?.counts.listed ?? items.length} trades={profile?.counts.completedTrades ?? 0} onEdit={() => router.push("/edit-profile")} onShare={() => void shareProfile()} />}
      renderItem={({ item }) => <ProfileTile dark={dark} item={item} onPress={() => router.push({ pathname: "/item", params: { id: item.id } })} />}
      ListEmptyComponent={<Text style={[s.empty, { color: dark ? darkColors.muted : color.inkMuted }]}>Your listings will appear here.</Text>}
      ListFooterComponent={<SettingsTile dark={dark} onPress={confirmSignOut} />}
    />
  );
}

function ProfileHeader({ dark, name, avatar, bio, tier, verified, posts, followers, following, trades, onEdit, onShare }: { dark: boolean; name: string; avatar: string | null; bio: string | null | undefined; tier?: string; verified: boolean; posts: number; followers: number; following: number; trades: number; onEdit: () => void; onShare: () => void }) {
  const palette = dark ? darkColors : lightColors;
  return <View style={[s.header, { borderBottomColor: palette.divider }]}><View style={s.identityRow}><Avatar uri={avatar} name={name} /><View style={s.stats}><Stat dark={dark} label="Posts" value={posts} /><Stat dark={dark} label="Followers" value={followers} /><Stat dark={dark} label="Following" value={following} /></View></View><View style={s.nameRow}><Text style={[s.name, { color: palette.ink }]} numberOfLines={1}>{name}</Text>{tier ? <View style={[s.tier, { backgroundColor: dark ? "#244A31" : color.greenWash }]}><Text style={[s.tierText, { color: dark ? "#BFE8C7" : color.forest }]}>{TIER_LABEL[tier as keyof typeof TIER_LABEL] ?? tier}</Text></View> : null}</View>{bio ? <Text style={[s.bio, { color: palette.secondary }]} numberOfLines={3}>{bio}</Text> : null}<View style={s.actions}><Pressable onPress={onEdit} style={[s.actionButton, { backgroundColor: palette.control }]} accessibilityRole="button"><Text style={[s.actionText, { color: palette.ink }]}>Edit profile</Text></Pressable><Pressable onPress={onShare} style={[s.actionButton, { backgroundColor: palette.control }]} accessibilityRole="button"><Text style={[s.actionText, { color: palette.ink }]}>Share profile</Text></Pressable></View><Badges dark={dark} verified={verified} trades={trades} /><View style={[s.rule, { backgroundColor: palette.divider }]} /></View>;
}

function Stat({ dark, label, value }: { dark: boolean; label: string; value: number }) { const palette = dark ? darkColors : lightColors; return <View style={s.stat}><Text style={[s.statValue, { color: palette.ink }]}>{value}</Text><Text style={[s.statLabel, { color: palette.muted }]}>{label}</Text></View>; }

function ProfileTile({ dark, item, onPress }: { dark: boolean; item: Item; onPress: () => void }) {
  const palette = dark ? darkColors : lightColors;
  const statusLabel = item.status === "AVAILABLE" ? null : item.status === "HIDDEN" ? "Hidden" : "Waiting for review";
  return <Pressable onPress={onPress} style={[s.tile, { backgroundColor: palette.control }, item.status !== "AVAILABLE" && s.dimmed]} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`}>
    {item.images[0] ? <Image source={{ uri: item.images[0] }} contentFit="cover" style={s.tileImage} /> : <View style={s.noImage}><Ionicons name="image-outline" size={24} color={palette.muted} /></View>}
    {statusLabel ? <View style={s.statusPill}><Text style={s.statusText}>{statusLabel}</Text></View> : null}
  </Pressable>;
}

function SettingsTile({ dark, onPress }: { dark: boolean; onPress: () => void }) {
  return <View style={s.settingsRow}><Pressable onPress={onPress} style={[s.settingsTile, { backgroundColor: dark ? darkColors.control : color.control }]} accessibilityRole="button" accessibilityLabel="Profile settings"><Ionicons name="settings-outline" size={24} color={dark ? darkColors.muted : color.inkMuted} /></Pressable></View>;
}

function Badges({ dark, verified, trades }: { dark: boolean; verified: boolean; trades: number }) {
  const palette = dark ? darkColors : lightColors;
  const badges: { icon: "leaf-outline" | "shield-checkmark-outline" | "swap-horizontal-outline" | "add-outline"; label: string; more?: boolean }[] = [{ icon: "leaf-outline", label: "Trader" }, ...(verified ? [{ icon: "shield-checkmark-outline" as const, label: "Verified" }] : []), ...(trades > 0 ? [{ icon: "swap-horizontal-outline" as const, label: "Trade history" }] : [])];
  return <View style={s.badges}><FlatList horizontal showsHorizontalScrollIndicator={false} data={[...badges, { icon: "add-outline" as const, label: "+ More", more: true }]} keyExtractor={(item) => item.label} contentContainerStyle={s.badgesContent} renderItem={({ item }) => <View style={s.badgeItem}><View style={[s.badgeCircle, { backgroundColor: palette.surface, borderColor: item.more ? palette.muted : (dark ? darkColors.border : color.controlLine) }, item.more && s.moreBadge]}><Ionicons name={item.icon} size={24} color={item.more ? palette.muted : palette.green} /></View><Text style={[s.badgeLabel, { color: palette.muted }]} numberOfLines={1} ellipsizeMode="tail">{item.label}</Text></View>} /></View>;
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
      style={[s.signOut, busy && s.disabled]}
    >
      {busy ? (
        <ActivityIndicator color={color.urgent} />
      ) : (
        <>
          <Ionicons name="log-out-outline" size={18} color={color.urgent} />
          <Text style={s.signOutText}>
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
        style={s.avatar}
      />
    );
  }
  return (
    <View style={s.avatarFallback}>
      <Text style={s.avatarText}>
        {name.trim().charAt(0).toUpperCase() || "?"}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1 },
  identityRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 86, height: 86, borderRadius: 43 },
  avatarFallback: { width: 86, height: 86, borderRadius: 43, alignItems: "center", justifyContent: "center", backgroundColor: color.green },
  avatarText: { color: color.onGreen, fontFamily: font.sansBold, fontSize: 30 },
  stats: { flex: 1, flexDirection: "row", justifyContent: "space-evenly", marginLeft: 20 },
  stat: { alignItems: "center", minWidth: 58 },
  statValue: { fontFamily: font.sansSemi, fontSize: 18 },
  statLabel: { fontFamily: font.sans, fontSize: 12, marginTop: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 12 },
  name: { fontFamily: font.sansSemi, fontSize: 15, maxWidth: "75%" },
  tier: { borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6 },
  tierText: { fontFamily: font.sansSemi, fontSize: 11 },
  bio: { fontFamily: font.sans, fontSize: 14, lineHeight: 20, marginTop: 12 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  actionText: { fontFamily: font.sansSemi, fontSize: 14 },
  badges: { marginTop: 12, marginHorizontal: -16 },
  badgesContent: { paddingHorizontal: 16, gap: 18 },
  badgeItem: { width: 64, alignItems: "center" },
  badgeCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  moreBadge: { borderStyle: "dashed" },
  badgeLabel: { width: 64, fontFamily: font.sans, fontSize: 11, marginTop: 4, textAlign: "center" },
  rule: { height: 1, marginTop: 12 },
  tile: { width: "33.3333%", aspectRatio: 1, marginRight: 2, marginBottom: 2 },
  tileImage: { width: "100%", height: "100%" },
  noImage: { flex: 1, alignItems: "center", justifyContent: "center" },
  dimmed: { opacity: 0.6 },
  statusPill: { position: "absolute", top: 6, left: 6, maxWidth: "88%", backgroundColor: "rgba(0,0,0,0.62)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  statusText: { color: "#FFFFFF", fontFamily: font.sansSemi, fontSize: 11 },
  settingsRow: { width: "33.3333%", aspectRatio: 1 },
  settingsTile: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.control },
  empty: { color: color.inkMuted, fontFamily: font.sans, fontSize: 14, textAlign: "center", paddingVertical: 48 },
  signOut: { height: 52, margin: 16, borderWidth: 1, borderColor: color.urgent, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  signOutText: { color: color.urgent, fontFamily: font.sansBold, fontSize: 15 },
  disabled: { opacity: 0.5 },
});

const lightColors = { surface: color.surface, control: color.control, ink: color.ink, secondary: color.inkSecondary, muted: color.inkMuted, divider: color.divider, border: color.controlLine, green: color.green };
const darkColors = { surface: "#171A17", control: "#252A25", ink: "#F4F5F0", secondary: "#B6BDB3", muted: "#929B91", divider: "#343A34", border: "#596159", green: "#72D681" };
