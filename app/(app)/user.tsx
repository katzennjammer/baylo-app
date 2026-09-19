import { useLocalSearchParams, useRouter } from "expo-router";
import { useColorScheme } from "react-native";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

import { useFollow, usePublicProfile } from "../../src/api/profile";
import { ChevronLeftIcon, PersonIcon } from "../../src/components/icons";
import { Tappable } from "../../src/components/Tappable";
import {
  border,
  color,
  icon,
  radius,
  size,
  space,
  textStyle,
  type,
} from "../../src/theme/tokens";

/**
 * Another trader's profile — a placeholder, and labelled as one.
 *
 * Item detail's owner row has to go somewhere: a name that looks tappable and
 * is not is a worse control than a plain label. This is where it goes until the
 * real screen exists.
 *
 * Same rule as app/(app)/offer.tsx — it says it is unbuilt rather than
 * pretending. During testing, a screen that silently does nothing and a screen
 * that crashed look identical.
 *
 * WHAT IT WOULD BE BUILT FROM: /api/v1/profile/[id] already exists and returns
 * the user with their listings. Note it sends `trustTier: null` — the same gap
 * item detail had until /items/[id] was changed to resolve it — so whoever
 * builds this decides then whether a profile is a screen where the badge is
 * worth three aggregates. It is the same judgement, and the answer is probably
 * yes for the same reason: a profile is read before deciding to trade.
 */
export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isPending, isError } = usePublicProfile(id);
  const follow = useFollow();
  const dark = useColorScheme() === "dark";
  const palette = dark ? darkColors : lightColors;

  if (isPending) return <View style={s.screen}><BackRow onPress={() => router.back()} /><ActivityIndicator color={color.green} style={{ marginTop: 40 }} /></View>;
  if (isError || !data) return <View style={s.screen}><BackRow onPress={() => router.back()} /><Text style={[textStyle(type.emptyBody), s.body]}>This trader profile is unavailable.</Text></View>;
  const isFollowing = data.follow.status === "ACCEPTED";
  const canFollow = data.follow.status === "NONE";

  return (
    <FlatList
      style={[s.screen, { backgroundColor: palette.surface }]}
      data={data.items}
      numColumns={3}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={<><BackRow onPress={() => router.back()} /><View style={s.header}><Avatar uri={data.user.avatar} name={data.user.name} /><View style={s.stats}><Stat dark={dark} label="Posts" value={data.counts.listed} /><Stat dark={dark} label="Followers" value={data.counts.followers} /><Stat dark={dark} label="Following" value={data.counts.following} /></View></View><Text style={[s.name, { color: palette.ink }]}>{data.user.name}</Text>{data.user.bio ? <Text style={[s.bio, { color: palette.secondary }]}>{data.user.bio}</Text> : null}{data.follow.followsYou ? <Text style={[s.followsYou, { color: palette.muted }]}>Follows you</Text> : null}<View style={s.actions}>{canFollow ? <Pressable style={s.follow} onPress={() => follow.mutate({ userId: data.user.id })}><Text style={s.followText}>{follow.isPending ? "Following..." : "Follow"}</Text></Pressable> : <Pressable style={s.following}><Text style={s.followingText}>{isFollowing ? "Following" : "Requested"}</Text></Pressable>}<Pressable style={[s.message, { backgroundColor: palette.control }]} onPress={() => router.push("/messages")}><Text style={[s.messageText, { color: palette.ink }]}>Message</Text></Pressable></View><View style={[s.rule, { backgroundColor: palette.divider }]} /></>}
      renderItem={({ item }) => <Pressable style={[s.tile, { backgroundColor: palette.control }]} onPress={() => router.push({ pathname: "/item", params: { id: item.id } })}><Image source={item.images[0] ? { uri: item.images[0] } : undefined} contentFit="cover" style={StyleSheet.absoluteFill} /></Pressable>}
      ListEmptyComponent={<Text style={s.body}>No active listings yet.</Text>}
    />
  );
}

function BackRow({ onPress }: { onPress: () => void }) { return <View style={s.backRow}><Tappable onPress={onPress} accessibilityRole="button" accessibilityLabel="Go back" style={s.back} pressedStyle={s.backPressed}><ChevronLeftIcon size={icon.back.size} stroke={icon.back.stroke} color={color.ink} /></Tappable></View>; }
function Avatar({ uri, name }: { uri: string | null; name: string }) { return uri ? <Image source={{ uri }} contentFit="cover" style={s.avatar} /> : <View style={s.avatarFallback}><Text style={s.initial}>{name.charAt(0).toUpperCase()}</Text></View>; }
function Stat({ dark, label, value }: { dark: boolean; label: string; value: number }) { const palette = dark ? darkColors : lightColors; return <View style={s.stat}><Text style={[s.statValue, { color: palette.ink }]}>{value}</Text><Text style={[s.statLabel, { color: palette.muted }]}>{label}</Text></View>; }

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  backRow: { paddingHorizontal: space.screenXTight, paddingTop: 4 },
  back: {
    width: size.detail.backButton,
    height: size.detail.backButton,
    alignItems: "center",
    justifyContent: "center",
  },
  backPressed: { opacity: 0.6 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12 },
  avatar: { width: 86, height: 86, borderRadius: 43 },
  avatarFallback: { width: 86, height: 86, borderRadius: 43, backgroundColor: color.green, alignItems: "center", justifyContent: "center" },
  initial: { color: color.onGreen, fontSize: 30, fontWeight: "700" },
  stats: { flex: 1, flexDirection: "row", justifyContent: "space-evenly", marginLeft: 20 },
  stat: { alignItems: "center" }, statValue: { fontSize: 18, fontFamily: "PublicSans-SemiBold" }, statLabel: { fontSize: 12, marginTop: 4 },
  name: { fontSize: 15, fontFamily: "PublicSans-SemiBold", marginHorizontal: 16, marginTop: 12 },
  bio: { fontSize: 14, lineHeight: 20, marginHorizontal: 16, marginTop: 12 },
  followsYou: { fontSize: 12, marginHorizontal: 16, marginTop: 8 },
  actions: { flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 12 },
  follow: { minHeight: 44, flex: 1, borderRadius: 8, backgroundColor: color.green, alignItems: "center", justifyContent: "center" },
  followText: { color: color.onGreen, fontWeight: "700" },
  following: { minHeight: 44, flex: 1, borderRadius: 8, borderWidth: 1, borderColor: color.controlLine, alignItems: "center", justifyContent: "center" },
  followingText: { color: color.ink, fontWeight: "600" },
  message: { minHeight: 44, flex: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  messageText: { fontFamily: "PublicSans-SemiBold", fontSize: 14 },
  rule: { height: 1, marginTop: 12 },
  tile: { width: "33.333%", aspectRatio: 1, marginRight: 2, marginBottom: 2, overflow: "hidden" },
  body: { color: color.inkSecondary, textAlign: "center", marginTop: 36 },
});

const lightColors = { surface: color.surface, control: color.control, ink: color.ink, secondary: color.inkSecondary, muted: color.inkMuted, divider: color.divider };
const darkColors = { surface: "#171A17", control: "#252A25", ink: "#F4F5F0", secondary: "#B6BDB3", muted: "#929B91", divider: "#343A34" };
