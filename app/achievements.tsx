import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { goBack } from "../src/lib/go-back";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "../src/api/client";
import { DEFAULT_MAX_PROFILE_BADGES, fetchAchievements, updateDisplayedAchievements } from "../src/api/achievements";
import { BackHeader } from "../src/components/BackHeader";
import { SectionHeader } from "../src/components/home-redesign/SectionHeader";
import { CheckIcon, StarIcon } from "../src/components/icons";
import { Tappable } from "../src/components/Tappable";
import { border, color, icon as iconToken, radius, size, space, textStyle, type } from "../src/theme/tokens";

/**
 * Achievements: every badge, which of the earned ones show on the profile, and
 * the one that rides beside the name on the home feed. Reached from Settings
 * and from the profile's badge shelf.
 *
 * ── DRAWN LIKE SETTINGS (3 Oct 2026) ────────────────────────────────────────
 *
 * This was tinted, bordered cards with hand-written colours, a green Save
 * beside a heading, and a second card repeating that heading. Direction 1 has
 * no tinted card: badges are rows on the canvas with a hairline under each,
 * sections open with the shared SectionHeader, and every colour is a token.
 * What each control DOES is unchanged — tap an earned badge to put it on the
 * profile, tap a chip to feature it on Home, Save to send both.
 *
 * Save moved to a bar at the foot, the app's primary button. It was at the
 * top, off screen by the time anyone had scrolled to a badge and tapped it.
 */

/**
 * A badge's art, or its emoji fallback.
 *
 * Every badge defined before uploaded art existed has only an `icon`, so the
 * fallback is not a nicety -- it is what keeps those badges rendering. A badge
 * WITH an imageUrl shows the image; one without shows the emoji.
 */
function BadgeIcon({
  icon,
  imageUrl,
  size: box,
  dimmed,
}: {
  icon: string;
  imageUrl: string | null;
  size: number;
  dimmed?: boolean;
}) {
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: box, height: box, borderRadius: box / 4, opacity: dimmed ? 0.4 : 1 }}
        resizeMode="cover"
      />
    );
  }
  return <Text style={[{ fontSize: box }, dimmed && styles.dimmed]}>{icon}</Text>;
}

export default function AchievementsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const query = useQuery({ queryKey: ["achievements"], queryFn: fetchAchievements, staleTime: 30_000 });
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: updateDisplayedAchievements,
    onSuccess: () => {
      setSaveMessage({ ok: true, text: "Saved to your profile." });
      void queryClient.invalidateQueries({ queryKey: ["achievements"] });
      void queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
    },
    onError: () => {
      setSaveMessage({ ok: false, text: "Could not save your changes." });
    },
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [featured, setFeatured] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // The server decides the shelf size; the app just honours it.
  const maxSlots = query.data?.maxProfileBadges ?? DEFAULT_MAX_PROFILE_BADGES;

  useEffect(() => {
    if (query.data) {
      setSelected(
        query.data.achievements
          .filter((item) => item.displayOrder !== null)
          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
          .map((item) => item.id),
      );

      const featuredBadge = query.data.achievements.find((item) => item.homeDisplayOrder !== null);
      setFeatured(featuredBadge?.id ?? null);
    }
  }, [query.data]);

  function toggleSelected(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < maxSlots
          ? [...current, id]
          : current,
    );
  }

  const achievements = query.data?.achievements ?? [];
  const earned = achievements.filter((achievement) => achievement.unlocked);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <BackHeader
        title="Achievements"
        subtitle="Milestones earned through real activity"
        onBack={() => goBack(router)}
      />
      {query.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={color.green} />
        </View>
      ) : query.isError ? (
        <View style={styles.center}>
          <Text style={[textStyle(type.errorHeadline), styles.errorTitle]}>Could not load achievements</Text>
          <Text style={[textStyle(type.emptyBody), styles.errorBody]}>
            {query.error instanceof ApiError ? query.error.message : "Try again in a moment."}
          </Text>
          <Tappable
            onPress={() => void query.refetch()}
            accessibilityRole="button"
            style={styles.retry}
            pressedStyle={styles.buttonHeld}
          >
            <Text style={[textStyle(type.primaryButton), styles.onGreen]}>Try again</Text>
          </Tappable>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: space.home.sectionTop }}>
            <SectionHeader
              accent="Home badge"
              subtitle="Pick one earned badge to show beside your name on the home feed."
              top={space.home.headingToContent}
            />
            {earned.length === 0 ? (
              <Text style={[textStyle(type.detailBody), styles.gutter, styles.secondary]}>
                Earn a badge and you can feature it here.
              </Text>
            ) : (
              <View style={[styles.gutter, styles.chips]}>
                {earned.map((achievement) => {
                  const isFeatured = featured === achievement.id;
                  return (
                    <Tappable
                      key={achievement.id}
                      onPress={() => setFeatured((current) => (current === achievement.id ? null : achievement.id))}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isFeatured }}
                      accessibilityLabel={achievement.name}
                      style={[styles.chip, isFeatured && styles.chipOn]}
                      pressedStyle={styles.held}
                    >
                      <BadgeIcon icon={achievement.icon} imageUrl={achievement.imageUrl} size={22} />
                      <Text style={[textStyle(type.trendingChip), isFeatured ? styles.forest : styles.ink]}>
                        {achievement.name}
                      </Text>
                    </Tappable>
                  );
                })}
              </View>
            )}

            <SectionHeader
              accent="Profile badges"
              subtitle={`Tap an earned badge to show it on your profile. Up to ${maxSlots}; an empty slot is not shown.`}
              count={selected.length}
            />
            <View style={styles.list}>
              {achievements.map((achievement) => {
                const progress = Math.min(achievement.progress, achievement.threshold);
                const isSelected = selected.includes(achievement.id);
                const isFeatured = featured === achievement.id;
                const locked = !achievement.unlocked;
                return (
                  <Tappable
                    key={achievement.id}
                    disabled={locked}
                    onPress={() => toggleSelected(achievement.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected, disabled: locked }}
                    accessibilityLabel={`${achievement.name}. ${achievement.description}`}
                    style={[styles.row, isSelected && styles.rowOn]}
                    pressedStyle={styles.held}
                  >
                    <View style={styles.badge}>
                      <BadgeIcon
                        icon={achievement.icon}
                        imageUrl={achievement.imageUrl}
                        size={30}
                        dimmed={locked}
                      />
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={[textStyle(type.username), locked ? styles.stale : styles.ink]}>
                        {achievement.name}
                      </Text>
                      <Text style={[textStyle(type.sectionSubcopy), locked ? styles.stale : styles.secondary]}>
                        {achievement.description}
                      </Text>
                      {achievement.unlocked ? (
                        <Text style={[textStyle(type.metadata), styles.earned]}>
                          Earned {new Date(achievement.unlockedAt!).toLocaleDateString()}
                        </Text>
                      ) : (
                        <Text style={[textStyle(type.metadata), styles.muted]}>
                          {progress} of {achievement.threshold} completed
                        </Text>
                      )}
                    </View>
                    {isFeatured ? (
                      <StarIcon
                        size={iconToken.sectionTitle.size}
                        stroke={iconToken.sectionTitle.stroke}
                        color={color.accentGold}
                      />
                    ) : null}
                    {isSelected ? (
                      <CheckIcon size={iconToken.check.size} stroke={iconToken.check.stroke} color={color.forest} />
                    ) : null}
                  </Tappable>
                );
              })}
            </View>
            {achievements.length === 0 ? (
              <Text style={[textStyle(type.emptyBody), styles.empty]}>No achievements are available yet.</Text>
            ) : null}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.home.tileBody) }]}>
            {saveMessage ? (
              <Text
                style={[textStyle(type.metadata), saveMessage.ok ? styles.earned : styles.urgent]}
                accessibilityLiveRegion="polite"
              >
                {saveMessage.text}
              </Text>
            ) : null}
            <Tappable
              disabled={save.isPending}
              onPress={() => save.mutate({ achievementIds: selected, featuredAchievementId: featured })}
              accessibilityRole="button"
              style={[styles.save, save.isPending && styles.buttonHeld]}
              pressedStyle={styles.buttonHeld}
            >
              <Text style={[textStyle(type.primaryButton), styles.onGreen]}>
                {save.isPending ? "Saving..." : "Save"}
              </Text>
            </Tappable>
          </View>
        </>
      )}
    </View>
  );
}

const BADGE = 48;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  gutter: { paddingHorizontal: space.screenX },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.home.searchGap },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: size.control.trendingChip,
    paddingHorizontal: size.control.trendingChipX,
    borderRadius: radius.trendingChip,
    borderWidth: border.chip,
    borderColor: color.controlLine,
  },
  chipOn: { borderColor: color.forest, backgroundColor: color.greenWash },

  // Settings' row, with a hairline over the first so the list is closed at
  // both ends under a section subtitle.
  list: { borderTopWidth: border.hairline, borderTopColor: color.divider },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.home.tileBody,
    paddingHorizontal: space.screenX,
    paddingVertical: space.home.tileBody,
    borderBottomWidth: border.hairline,
    borderBottomColor: color.divider,
  },
  rowOn: { backgroundColor: color.greenWash },
  held: { backgroundColor: color.control },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: radius.spotlightLogo,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.control,
  },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },

  footer: {
    gap: space.home.searchGap,
    paddingHorizontal: space.screenX,
    paddingTop: space.home.tileBody,
    borderTopWidth: border.hairline,
    borderTopColor: color.divider,
    backgroundColor: color.surface,
  },
  save: {
    height: size.control.primaryButton,
    borderRadius: radius.primaryButton,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.green,
  },
  buttonHeld: { opacity: 0.7 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  errorTitle: { color: color.ink, textAlign: "center" },
  errorBody: { color: color.inkSecondary, textAlign: "center", marginTop: 8 },
  retry: {
    marginTop: 18,
    height: size.control.primaryButton,
    paddingHorizontal: size.control.errorRetryX,
    borderRadius: radius.primaryButton,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.green,
  },
  empty: { color: color.inkSecondary, textAlign: "center", paddingVertical: 40 },

  ink: { color: color.ink },
  secondary: { color: color.inkSecondary },
  muted: { color: color.inkMuted },
  stale: { color: color.inkStale },
  dimmed: { opacity: 0.4 },
  forest: { color: color.forest },
  earned: { color: color.accentGreen },
  urgent: { color: color.urgent },
  onGreen: { color: color.onGreen },
});
