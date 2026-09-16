import { useLocalSearchParams, useRouter } from "expo-router";
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

  if (isPending) return <View style={s.screen}><BackRow onPress={() => router.back()} /><ActivityIndicator color={color.green} style={{ marginTop: 40 }} /></View>;
  if (isError || !data) return <View style={s.screen}><BackRow onPress={() => router.back()} /><Text style={[textStyle(type.emptyBody), s.body]}>This trader profile is unavailable.</Text></View>;
  const isFollowing = data.follow.status === "ACCEPTED";
  const canFollow = data.follow.status === "NONE";

  return (
    <FlatList
      style={s.screen}
      data={data.items}
      numColumns={3}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={<><BackRow onPress={() => router.back()} /><View style={s.header}><Avatar uri={data.user.avatar} name={data.user.name} /><View style={s.stats}><Stat label="Posts" value={data.counts.listed} /><Stat label="Followers" value={data.counts.followers} /><Stat label="Following" value={data.counts.following} /></View></View><Text style={s.name}>{data.user.name}</Text>{data.user.bio ? <Text style={s.bio}>{data.user.bio}</Text> : null}{data.follow.followsYou ? <Text style={s.followsYou}>Follows you</Text> : null}{canFollow ? <Pressable style={s.follow} onPress={() => follow.mutate({ userId: data.user.id })}><Text style={s.followText}>{follow.isPending ? "Following..." : "Follow"}</Text></Pressable> : <View style={s.following}><Text style={s.followingText}>{isFollowing ? "Following" : "Requested"}</Text></View>}<View style={s.rule} /></>}
      renderItem={({ item }) => <Pressable style={s.tile} onPress={() => router.push({ pathname: "/item", params: { id: item.id } })}><Image source={item.images[0] ? { uri: item.images[0] } : undefined} contentFit="cover" style={StyleSheet.absoluteFill} /><Text style={s.tileLabel}>{item.title}</Text></Pressable>}
      ListEmptyComponent={<Text style={s.body}>No active listings yet.</Text>}
    />
  );
}

function BackRow({ onPress }: { onPress: () => void }) { return <View style={s.backRow}><Tappable onPress={onPress} accessibilityRole="button" accessibilityLabel="Go back" style={s.back} pressedStyle={s.backPressed}><ChevronLeftIcon size={icon.back.size} stroke={icon.back.stroke} color={color.ink} /></Tappable></View>; }
function Avatar({ uri, name }: { uri: string | null; name: string }) { return uri ? <Image source={{ uri }} contentFit="cover" style={s.avatar} /> : <View style={s.avatarFallback}><Text style={s.initial}>{name.charAt(0).toUpperCase()}</Text></View>; }
function Stat({ label, value }: { label: string; value: number }) { return <View style={s.stat}><Text style={s.statValue}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>; }

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
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8 },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  avatarFallback: { width: 84, height: 84, borderRadius: 42, backgroundColor: color.green, alignItems: "center", justifyContent: "center" },
  initial: { color: color.onGreen, fontSize: 30, fontWeight: "700" },
  stats: { flex: 1, flexDirection: "row", justifyContent: "space-around", marginLeft: 14 },
  stat: { alignItems: "center" }, statValue: { color: color.ink, fontSize: 16, fontWeight: "700" }, statLabel: { color: color.inkMuted, fontSize: 11, marginTop: 3 },
  name: { color: color.ink, fontSize: 18, fontWeight: "700", marginHorizontal: 16, marginTop: 14 },
  bio: { color: color.inkSecondary, fontSize: 13, lineHeight: 19, marginHorizontal: 16, marginTop: 4 },
  followsYou: { color: color.inkMuted, fontSize: 12, marginHorizontal: 16, marginTop: 8 },
  follow: { height: 38, borderRadius: 8, backgroundColor: color.green, alignItems: "center", justifyContent: "center", marginHorizontal: 16, marginTop: 14 },
  followText: { color: color.onGreen, fontWeight: "700" },
  following: { height: 38, borderRadius: 8, borderWidth: 1, borderColor: color.controlLine, alignItems: "center", justifyContent: "center", marginHorizontal: 16, marginTop: 14 },
  followingText: { color: color.ink, fontWeight: "600" },
  rule: { height: 1, backgroundColor: color.divider, marginTop: 18 },
  tile: { width: "33.333%", aspectRatio: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: color.surface, backgroundColor: color.control, overflow: "hidden" },
  tileLabel: { position: "absolute", left: 5, right: 5, bottom: 5, color: color.surface, fontSize: 10, fontWeight: "700", textShadowColor: "rgba(0,0,0,.65)", textShadowRadius: 3 },
  body: { color: color.inkSecondary, textAlign: "center", marginTop: 36 },
});
