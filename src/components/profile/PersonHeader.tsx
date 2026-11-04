import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { TIER_LABEL } from "../../lib/trust";
import { color, font } from "../../theme/tokens";
import { Tappable } from "../Tappable";

/**
 * A person's profile header (4 Nov 2026): avatar beside the trust signals,
 * the bio, then every count as ONE quiet line -- not a stats row of big
 * numbers. Used for your own profile and for someone else's, so the two
 * always look like the same kind of page.
 *
 *   [avatar]  NEW TRADER  ★ 4.5 · 2 reviews
 *             Lapu-Lapu City · Joined Oct 2026
 *   Gadgets and bags. Usually free on weekends.
 *   5 listings · 2 trades · 4 followers · 5 following
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
  };
  counts: { listed: number; completedTrades: number; reviews: number; followers: number; following: number };
  palette: { ink: string; secondary: string; control: string };
  /** Replaces the place line when there is no location -- e.g. "+ Add your location". */
  locationSlot?: ReactNode;
  onFollowers: () => void;
  onFollowing: () => void;
  /** The action buttons under the counts. */
  children?: ReactNode;
}) {
  const joined = joinedLabel(user.createdAt);
  const rating = counts.reviews > 0
    ? `★ ${user.rating.toFixed(1)} · ${counts.reviews} ${counts.reviews === 1 ? "review" : "reviews"}`
    : "No reviews yet";
  const tier = user.trustTier ? TIER_LABEL[user.trustTier as keyof typeof TIER_LABEL] ?? user.trustTier : null;

  return (
    <View style={s.wrap}>
      <View style={s.identity}>
        {avatar}
        <View style={s.signals}>
          <View style={s.tierRow}>
            {tier ? (
              <View style={[s.tier, { backgroundColor: palette.control }]}>
                <Text style={[s.tierText, { color: palette.ink }]}>{tier.toUpperCase()}</Text>
              </View>
            ) : null}
            <Text style={[s.rating, { color: palette.ink }]}>{rating}</Text>
          </View>
          {user.location ? (
            <Text style={[s.place, { color: palette.secondary }]} numberOfLines={1}>
              {`${user.location}${joined ? ` · Joined ${joined}` : ""}`}
            </Text>
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

      <Text style={[s.counts, { color: palette.secondary }]}>
        <Text style={[s.num, { color: palette.ink }]}>{counts.listed}</Text> {counts.listed === 1 ? "listing" : "listings"} ·{" "}
        <Text style={[s.num, { color: palette.ink }]}>{counts.completedTrades}</Text> {counts.completedTrades === 1 ? "trade" : "trades"} ·{" "}
        <Text onPress={onFollowers} accessibilityRole="link">
          <Text style={[s.num, { color: palette.ink }]}>{counts.followers}</Text> {counts.followers === 1 ? "follower" : "followers"}
        </Text>{" "}
        ·{" "}
        <Text onPress={onFollowing} accessibilityRole="link">
          <Text style={[s.num, { color: palette.ink }]}>{counts.following}</Text> following
        </Text>
      </Text>

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
  signals: { flex: 1, minWidth: 0, gap: 4 },
  tierRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  tier: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  tierText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  rating: { fontSize: 13, fontWeight: "600" },
  place: { fontSize: 13 },
  bio: { fontSize: 14, lineHeight: 20 },
  counts: { fontSize: 14 },
  num: { fontFamily: font.sansBold },
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
