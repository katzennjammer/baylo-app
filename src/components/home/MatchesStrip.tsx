import { Image } from "expo-image";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Divider } from "../Divider";
import { color, lines, radius, size, space, textStyle, type } from "../../theme/tokens";
import type { MatchCandidate } from "../../api/types";

/**
 * "Matches for you" — the inset interstitial, the one tinted surface in the feed.
 *
 * WHAT THE ARTBOARD ASKS FOR AND WHAT EXISTS. The spec draws this rail as
 * ITEMS: a 132 px thumbnail, a two-line item title, and a Leaves value under
 * it. /api/v1/home's `matches` block is not items — it is people. Each entry is
 * a userId, a name, an avatar, a trade count, the categories they share with
 * the viewer, and a server-written `reason` string. There is no per-match item,
 * no thumbnail of a listing and no Leaves figure anywhere in it, and the task
 * says not to change the endpoint.
 *
 * So the geometry is the spec's exactly — 132 thumbs, 10 apart, 8 to the title,
 * 5 to the line under it, all on the inset ground — and what fills it is the
 * data that is actually there: the person's avatar, their name, and the
 * server's own reason for suggesting them. Nothing is invented to fill the
 * Leaves slot; the third line is the reason, in the muted ink rather than the
 * green, because a green number in that position would read as a value.
 *
 * NOT TAPPABLE, for the same reason as the stories row: /api/v1/profile/[id]
 * has no screen yet, and routing to /profile would open the viewer's own.
 */
export function MatchesStrip({ matches }: { matches: MatchCandidate[] }) {
  if (matches.length === 0) return null;

  return (
    <View style={s.section}>
      <View style={s.header}>
        <Text style={[textStyle(type.sectionHeading), { color: color.forest }]}>
          Matches for you
        </Text>
        <Text style={[textStyle(type.sectionSubcopy), s.subcopy]}>
          People listing in the categories you already trade.
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
        {matches.map((m) => (
          <View
            key={m.userId}
            accessible
            accessibilityLabel={`${m.name}. ${m.reason}.`}
            style={s.card}
          >
            {m.avatar ? (
              <Image source={{ uri: m.avatar }} contentFit="cover" style={s.thumb} />
            ) : (
              <View style={[s.thumb, s.thumbFallback]}>
                <Text style={[textStyle(type.avatarInitials62), { color: color.forest }]}>
                  {m.name.trim().charAt(0).toUpperCase() || "?"}
                </Text>
              </View>
            )}

            <Text style={[textStyle(type.matchesTitle), s.title]} numberOfLines={lines.matchesTitle}>
              {m.name}
            </Text>

            <Text style={[textStyle(type.matchesMeta), s.reason]} numberOfLines={1}>
              {m.reason}
            </Text>
          </View>
        ))}
      </ScrollView>

      <Divider />
    </View>
  );
}

const s = StyleSheet.create({
  section: { backgroundColor: color.inset, paddingTop: space.matches.y },
  header: { paddingHorizontal: space.screenX },
  subcopy: { marginTop: space.matches.headingToSub, color: color.inkMuted },
  rail: {
    paddingHorizontal: space.screenX,
    paddingTop: space.matches.headerToRail,
    paddingBottom: space.matches.y,
    gap: space.matches.cardGap,
  },
  card: { width: size.photo.matchesThumb },
  thumb: {
    width: size.photo.matchesThumb,
    height: size.photo.matchesThumb,
    borderRadius: radius.matchesThumb,
    backgroundColor: color.greenWash,
  },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  title: { marginTop: space.matches.thumbToTitle, color: color.ink },
  reason: { marginTop: space.matches.titleToMeta, color: color.inkMuted },
});
