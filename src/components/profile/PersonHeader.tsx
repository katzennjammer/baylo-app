import type { ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { useProfileConnections } from "../../api/profile";
import { sizedImage } from "../../media/image-url";

import { color, font } from "../../theme/tokens";
import { Tappable } from "../Tappable";

/**
 * A person's profile header (4 Nov 2026): avatar beside the trust signals,
 * the bio, then every count as ONE quiet line -- not a stats row of big
 * numbers. Used for your own profile and for someone else's, so the two
 * always look like the same kind of page.
 *
 *   [avatar]  ★ 4.5  2 reviews
 *             (shield) New trader
 *             Lapu-Lapu City · Joined Oct 2026
 *   Gadgets and bags. Usually free on weekends.
 *   5 listings · 2 completed trades
 *   (faces) 4 followers · 5 following
 *   [actions]
 *
 * Followers and following open their lists; the other counts are facts.
 */
export function PersonHeader({
  avatar,
  user,
  counts,
  palette,
  locationSlot,
  onFollowers,
  onFollowing,
  userId,
  children,
}: {
  /** The screen's own avatar component, so both screens keep their fallbacks. */
  avatar: ReactNode;
  user: {
    bio: string | null;
    location: string | null;
    createdAt: string;
    rating: number;
    trustTier: string | null;
    /**
     * Government ID approved. Only then does the tier pill carry its
     * checkmark; an unverified person gets the tier name on its own.
     * Absent (an older server) reads as not verified.
     */
    idVerified?: boolean;
  };
  counts: { listed: number; completedTrades: number; reviews: number; followers: number; following: number };
  palette: { ink: string; secondary: string; control: string };
  /** Replaces the place line when there is no location -- e.g. "+ Add your location". */
  locationSlot?: ReactNode;
  onFollowers: () => void;
  onFollowing: () => void;
  /** Whose followers to show as faces. Omitted: no faces, just the counts. */
  userId?: string;
  /** The action buttons under the counts. */
  children?: ReactNode;
}) {
  const joined = joinedLabel(user.createdAt);
  // The three latest followers, from the same list the Followers screen
  // shows (and caches), so opening it after is instant.
  const followersList = useProfileConnections(userId, "followers", !!userId && counts.followers > 0);
  const faces = followersList.users.slice(0, 3);
  const place = [user.location, joined ? `Joined ${joined}` : null].filter(Boolean).join(" · ");

  return (
    <View style={s.wrap}>
      <View style={s.identity}>
        {avatar}
        <View style={s.signals}>
          <RatingLine rating={user.rating} reviews={counts.reviews} palette={palette} />
          <TierChip tier={user.trustTier} idVerified={user.idVerified} palette={palette} />
          {user.location ? (
            <Text style={[s.place, { color: palette.secondary }]} numberOfLines={1}>{place}</Text>
          ) : (
            locationSlot ?? (joined ? <Text style={[s.place, { color: palette.secondary }]}>Joined {joined}</Text> : null)
          )}
        </View>
      </View>

      {user.bio ? (
        <Text style={[s.bio, { color: palette.ink }]} numberOfLines={4}>
          {user.bio}
        </Text>
      ) : null}

      {/*
        The facts as one quiet line; the social part as its own row, led by
        the faces of the latest followers (Threads-style). The faces and the
        two counts are what you tap, which the old single line never showed.
      */}
      <Text style={[s.line, { color: palette.secondary }]}>
        {`${counts.listed} ${counts.listed === 1 ? "listing" : "listings"} · ${counts.completedTrades} completed ${counts.completedTrades === 1 ? "trade" : "trades"}`}
      </Text>
      <View style={s.socialRow}>
        {faces.length > 0 ? (
          <Tappable onPress={onFollowers} accessibilityLabel="Open followers" style={s.faces}>
            {faces.map((f, i) => (
              <View key={f.id} style={[s.face, { marginLeft: i ? -8 : 0, zIndex: faces.length - i, backgroundColor: palette.control }]}>
                {f.avatar ? (
                  <Image source={{ uri: sizedImage(f.avatar, "thumb") }} contentFit="cover" style={s.faceImage} />
                ) : (
                  <Text style={s.faceInitial}>{f.name.trim().charAt(0).toUpperCase() || "?"}</Text>
                )}
              </View>
            ))}
          </Tappable>
        ) : null}
        <Text style={[s.line, { color: palette.secondary }]}>
          <Text onPress={onFollowers} accessibilityRole="link" style={[s.strong, { color: palette.ink }]}>
            {`${counts.followers} ${counts.followers === 1 ? "follower" : "followers"}`}
          </Text>
          {"  ·  "}
          <Text onPress={onFollowing} accessibilityRole="link" style={[s.strong, { color: palette.ink }]}>
            {`${counts.following} following`}
          </Text>
        </Text>
      </View>

      {children}
    </View>
  );
}

/** Two equal buttons under the counts: a filled primary and a plain secondary. */
export function HeaderButtons({
  primary,
  secondary,
  palette,
}: {
  primary: { label: string; onPress: () => void; filled?: boolean; disabled?: boolean };
  secondary: { label: string; onPress: () => void };
  palette: { ink: string; control: string; border: string };
}) {
  const filled = primary.filled ?? true;
  return (
    <View style={s.buttons}>
      <Tappable
        onPress={primary.onPress}
        disabled={primary.disabled}
        accessibilityRole="button"
        style={[s.button, filled ? s.buttonFilled : { backgroundColor: palette.control, borderColor: palette.border }, primary.disabled && { opacity: 0.6 }]}
      >
        <Text style={[s.buttonText, { color: filled ? color.onGreen : palette.ink }, filled && { fontWeight: "700" }]}>{primary.label}</Text>
      </Tappable>
      <Tappable
        onPress={secondary.onPress}
        accessibilityRole="button"
        style={[s.button, { backgroundColor: palette.control, borderColor: palette.border }]}
      >
        <Text style={[s.buttonText, { color: palette.ink }]}>{secondary.label}</Text>
      </Tappable>
    </View>
  );
}

function joinedLabel(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 14, gap: 12 },
  identity: { flexDirection: "row", alignItems: "center", gap: 14 },
  signals: { flex: 1, minWidth: 0, gap: 5, alignItems: "flex-start" },
  tier: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tierText: { fontSize: 12, fontWeight: "600" },
  rating: { fontSize: 17, fontFamily: font.sansBold },
  star: { color: "#E0A526" },
  ratingCount: { fontSize: 13, fontFamily: font.sans },
  place: { fontSize: 13 },
  bio: { fontSize: 14, lineHeight: 20 },
  line: { fontSize: 14, lineHeight: 20 },
  strong: { fontFamily: font.sansSemi },
  socialRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: -4 },
  faces: { flexDirection: "row" },
  face: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: color.surface, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  faceImage: { width: "100%", height: "100%" },
  faceInitial: { fontFamily: font.sansBold, fontSize: 11, color: color.forest },
  buttons: { flexDirection: "row", gap: 8 },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonFilled: { backgroundColor: color.green },
  buttonText: { fontSize: 15, fontWeight: "600" },
});

/**
 * "★ 4.5  4 reviews" -- or "No reviews yet". The profile header's rating line,
 * exported so the offer screen's trader card says it the same way (it used to
 * draw a grey star and no count).
 */
export function RatingLine({
  rating,
  reviews,
  palette,
  size = 17,
}: {
  rating: number;
  /** `null` when unknown (an older server): the stars show without a count. */
  reviews: number | null;
  palette: { ink: string; secondary: string };
  size?: number;
}) {
  if (reviews === null) {
    if (rating <= 0) return null;
    return (
      <Text style={[s.rating, { fontSize: size, color: palette.ink }]}>
        <Text style={s.star}>★</Text> {rating.toFixed(1)}
      </Text>
    );
  }
  if (reviews <= 0) {
    return <Text style={[s.ratingCount, { color: palette.secondary }]}>No reviews yet</Text>;
  }
  return (
    <Text style={[s.rating, { fontSize: size, color: palette.ink }]}>
      <Text style={s.star}>★</Text> {rating.toFixed(1)}
      <Text style={[s.ratingCount, { color: palette.secondary }]}>
        {"  "}
        {reviews} {reviews === 1 ? "review" : "reviews"}
      </Text>
    </Text>
  );
}

/**
 * The trust tier as words -- "Rising trader", not a bare "RISING" -- with the
 * shield checkmark ONLY when the person's government ID is approved.
 */
export function TierChip({
  tier,
  idVerified,
  palette,
}: {
  tier: string | null | undefined;
  idVerified?: boolean;
  palette: { ink: string; control: string };
}) {
  if (!tier) return null;
  const name = tier.toLowerCase().replace(/^./, (c) => c.toUpperCase());
  return (
    <View style={[s.tier, { backgroundColor: palette.control }]}>
      {idVerified ? (
        <Ionicons name="shield-checkmark" size={12} color={color.green} accessibilityLabel="ID verified" />
      ) : null}
      <Text style={[s.tierText, { color: palette.ink }]}>{name}</Text>
    </View>
  );
}
