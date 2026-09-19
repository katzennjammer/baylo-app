import { useCallback } from "react";
import { FlatList, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { useProfileMe } from "../../src/api/profile";
import { useRefetchOnFocus } from "../../src/lib/refetch-on-focus";
import { useSession } from "../../src/auth/session";
import type { Item, ProfileMePayload } from "../../src/api/types";
import { color, font } from "../../src/theme/tokens";
import { useColorScheme } from "react-native";
import { TIER_LABEL } from "../../src/lib/trust";
import { getApiBase } from "../../src/api/config";

/**
 * Profile — the account block and the owner's shelf.
 *
 * Sign-out is no longer here. It lives in the AppHeader account menu, next to
 * Settings and Achievements, which is the one place it is reachable from every
 * tab. The gear tile at the end of the grid opens /settings.
 *
 * THE IDENTITY BLOCK READS THE STORED SESSION, not useHome(). It costs no
 * request — name, email and avatar were written to SecureStore by the token
 * endpoint at sign-in — and, more to the point, it is still correct on a phone
 * with no signal. Which is exactly the state someone is in when they most want
 * to check whose account this is.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { data: profile, refetch } = useProfileMe();
  const dark = useColorScheme() === "dark";

  // Badge art, the shelf and the counts are written by other screens and by the
  // admin panel, and this tab stays mounted behind them. Without this the shelf
  // serves its cached payload for the whole `staleTime` after a badge image is
  // added — the achievements screen would show the new art while this one still
  // showed the icon fallback. Same ask the Home and Marketplace grids make.
  useRefetchOnFocus(refetch);

  const user = session?.user;

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
      ListHeaderComponent={<ProfileHeader dark={dark} name={profile?.user.name ?? user?.name ?? "Signed in"} avatar={profile?.user.avatar ?? user?.image ?? null} bio={profile?.user.bio} tier={profile?.reputation.tier} followers={profile?.counts.followers ?? 0} following={profile?.counts.following ?? 0} posts={profile?.counts.listed ?? items.length} achievements={profile?.displayedAchievements ?? []} onEdit={() => router.push("/edit-profile")} onShare={() => void shareProfile()} onMoreAchievements={() => router.push("/achievements")} />}
      renderItem={({ item }) => <ProfileTile dark={dark} item={item} onPress={() => router.push({ pathname: shelfLabel(item) ? "/listing-review" : "/item", params: { id: item.id } })} />}
      ListEmptyComponent={<Text style={[s.empty, { color: dark ? darkColors.muted : color.inkMuted }]}>Your listings will appear here.</Text>}
      ListFooterComponent={<SettingsTile dark={dark} onPress={() => router.push("/settings")} />}
    />
  );
}

type DisplayedAchievements = ProfileMePayload["displayedAchievements"];

function ProfileHeader({ dark, name, avatar, bio, tier, posts, followers, following, achievements, onEdit, onShare, onMoreAchievements }: { dark: boolean; name: string; avatar: string | null; bio: string | null | undefined; tier?: string; posts: number; followers: number; following: number; achievements: DisplayedAchievements; onEdit: () => void; onShare: () => void; onMoreAchievements: () => void }) {
  const palette = dark ? darkColors : lightColors;
  return <View style={[s.header, { borderBottomColor: palette.divider }]}><View style={s.identityRow}><Avatar uri={avatar} name={name} /><View style={s.stats}><Stat dark={dark} label="Posts" value={posts} /><Stat dark={dark} label="Followers" value={followers} /><Stat dark={dark} label="Following" value={following} /></View></View><View style={s.nameRow}><Text style={[s.name, { color: palette.ink }]} numberOfLines={1}>{name}</Text>{tier ? <View style={[s.tier, { backgroundColor: dark ? "#244A31" : color.greenWash }]}><Text style={[s.tierText, { color: dark ? "#BFE8C7" : color.forest }]}>{TIER_LABEL[tier as keyof typeof TIER_LABEL] ?? tier}</Text></View> : null}</View>{bio ? <Text style={[s.bio, { color: palette.secondary }]} numberOfLines={3}>{bio}</Text> : null}<View style={s.actions}><Pressable onPress={onEdit} style={[s.actionButton, { backgroundColor: palette.control }]} accessibilityRole="button"><Text style={[s.actionText, { color: palette.ink }]}>Edit profile</Text></Pressable><Pressable onPress={onShare} style={[s.actionButton, { backgroundColor: palette.control }]} accessibilityRole="button"><Text style={[s.actionText, { color: palette.ink }]}>Share profile</Text></Pressable></View><Badges dark={dark} achievements={achievements} onMore={onMoreAchievements} /><View style={[s.rule, { backgroundColor: palette.divider }]} /></View>;
}

function Stat({ dark, label, value }: { dark: boolean; label: string; value: number }) { const palette = dark ? darkColors : lightColors; return <View style={s.stat}><Text style={[s.statValue, { color: palette.ink }]}>{value}</Text><Text style={[s.statLabel, { color: palette.muted }]}>{label}</Text></View>; }

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

function ProfileTile({ dark, item, onPress }: { dark: boolean; item: Item; onPress: () => void }) {
  const palette = dark ? darkColors : lightColors;
  const label = shelfLabel(item);
  return <Pressable onPress={onPress} style={[s.tile, { backgroundColor: palette.control }, label !== null && s.dimmed]} accessibilityRole="button" accessibilityLabel={label ? `${item.title} — ${label}` : `Open ${item.title}`}>
    {item.images[0] ? <Image source={{ uri: item.images[0] }} contentFit="cover" style={s.tileImage} /> : <View style={s.noImage}><Ionicons name="image-outline" size={24} color={palette.muted} /></View>}
    {label ? <View style={s.statusPill}><Text style={s.statusText} numberOfLines={1}>{label}</Text></View> : null}
  </Pressable>;
}

function SettingsTile({ dark, onPress }: { dark: boolean; onPress: () => void }) {
  return <View style={s.settingsRow}><Pressable onPress={onPress} style={[s.settingsTile, { backgroundColor: dark ? darkColors.control : color.control }]} accessibilityRole="button" accessibilityLabel="Settings"><Ionicons name="settings-outline" size={24} color={dark ? darkColors.muted : color.inkMuted} /></Pressable></View>;
}

/** The server's achievement `icon` keys, drawn with Ionicons. Unknown keys get a trophy. */
const badgeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  check: "shield-checkmark-outline",
  id: "id-card-outline",
  list: "list-outline",
  swap: "swap-horizontal-outline",
};

/**
 * The highlights row.
 *
 * ── ONLY THE PICKED BADGES APPEAR ────────────────────────────────
 *
 * The user picks up to four badges on the achievements screen, and the row
 * renders exactly those -- one pick shows one badge, four show four. There are
 * no empty placeholder slots. `displayedAchievements` is already only the
 * selected rows, in order (see profile/me), so there is nothing to filter here;
 * the slice(0, 4) is a belt-and-braces cap matching the server's.
 *
 * A badge with `imageUrl` shows its art inside the circle; without one it falls
 * back to the Ionicon for its `icon` key. The dashed "More" is a NAVIGATION
 * button that opens the achievements screen, shown only while the user still
 * has room on the shelf, so a full shelf is not cluttered with an invitation to
 * add more.
 */
const SHELF_CAP = 4;

function Badges({ dark, achievements, onMore }: { dark: boolean; achievements: DisplayedAchievements; onMore: () => void }) {
  const palette = dark ? darkColors : lightColors;
  const shown = achievements.slice(0, SHELF_CAP);
  const hasRoom = shown.length < SHELF_CAP;
  const data: { key: string; icon: keyof typeof Ionicons.glyphMap; imageUrl: string | null; label: string; more?: boolean }[] = [
    ...shown.map((a) => ({ key: a.id, icon: badgeIcons[a.icon] ?? "trophy-outline", imageUrl: a.imageUrl, label: a.name })),
    ...(hasRoom ? [{ key: "more", icon: "add-outline" as const, imageUrl: null, label: "More", more: true }] : []),
  ];
  return <View style={s.badges}><FlatList horizontal showsHorizontalScrollIndicator={false} data={data} keyExtractor={(item) => item.key} contentContainerStyle={s.badgesContent} renderItem={({ item }) => <Pressable onPress={item.more ? onMore : undefined} disabled={!item.more} accessibilityRole={item.more ? "button" : undefined} accessibilityLabel={item.more ? "More achievements" : item.label} style={s.badgeItem}><View style={[s.badgeCircle, { backgroundColor: palette.surface, borderColor: item.more ? palette.muted : (dark ? darkColors.border : color.controlLine) }, item.more && s.moreBadge]}>{item.imageUrl ? <Image source={{ uri: item.imageUrl }} contentFit="cover" style={s.badgeArt} /> : <Ionicons name={item.icon} size={24} color={item.more ? palette.muted : palette.green} />}</View><Text style={[s.badgeLabel, { color: palette.muted }]} numberOfLines={1} ellipsizeMode="tail">{item.label}</Text></Pressable>} /></View>;
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
  badgeCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  badgeArt: { width: "100%", height: "100%" },
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
});

const lightColors = { surface: color.surface, control: color.control, ink: color.ink, secondary: color.inkSecondary, muted: color.inkMuted, divider: color.divider, border: color.controlLine, green: color.green };
const darkColors = { surface: "#171A17", control: "#252A25", ink: "#F4F5F0", secondary: "#B6BDB3", muted: "#929B91", divider: "#343A34", border: "#596159", green: "#72D681" };
