import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image as ExpoImage } from "expo-image";
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
import { border, color, font, icon as iconToken, radius, size, space, textStyle, type } from "../src/theme/tokens";
import { sizedImage } from "../src/media/image-url";
import { MASCOT } from "../src/media/mascots";

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
        source={{ uri: sizedImage(imageUrl, "thumb") }}
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
    onMutate: () => setSaveMessage(null),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["achievements"] }),
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);
    },
    onError: (error) => {
      setSaveMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Could not save your changes.",
      });
    },
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [featured, setFeatured] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // The server decides the shelf size; the app just honours it.
  const maxSlots = query.data?.maxProfileBadges ?? DEFAULT_MAX_PROFILE_BADGES;

  const savedSelected = (query.data?.achievements ?? [])
    .filter((item) => item.displayOrder !== null)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    .map((item) => item.id);
  const savedFeatured =
    query.data?.achievements.find((item) => item.homeDisplayOrder !== null)?.id ?? null;
  const hasChanges =
    selected.length !== savedSelected.length ||
    selected.some((id, index) => id !== savedSelected[index]) ||
    featured !== savedFeatured;

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

  useEffect(() => {
    if (!saveMessage?.ok) return;
    const timeout = setTimeout(() => setSaveMessage(null), 4_000);
    return () => clearTimeout(timeout);
  }, [saveMessage]);

  // CHANGES SAVE AS YOU TAP (4 Nov 2026): no Save button. Each tap sends the
  // new choice; the toast says what changed and offers Undo.
  const [undo, setUndo] = useState<{ ids: string[]; featured: string | null } | null>(null);
  const commit = (ids: string[], nextFeatured: string | null, text: string) => {
    setUndo({ ids: selected, featured });
    setSelected(ids);
    setFeatured(nextFeatured);
    save.mutate(
      { achievementIds: ids, featuredAchievementId: nextFeatured },
      { onSuccess: () => setSaveMessage({ ok: true, text }) },
    );
  };
  const nameOf = (id: string) => query.data?.achievements.find((a) => a.id === id)?.name ?? "That badge";

  function toggleSelected(id: string) {
    if (selected.includes(id)) {
      commit(selected.filter((value) => value !== id), featured === id ? null : featured, `${nameOf(id)} is off your profile.`);
    } else if (selected.length < maxSlots) {
      commit([...selected, id], featured, `${nameOf(id)} now shows on your profile.`);
    } else {
      setSaveMessage({ ok: false, text: `Your profile shows up to ${maxSlots}. Take one off first.` });
    }
  }

  const achievements = query.data?.achievements ?? [];
  const earned = achievements.filter((achievement) => achievement.unlocked);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <BackHeader
        title="Achievements"
        subtitle={query.data ? `${earned.length} of ${achievements.length} earned · changes save as you tap` : "Milestones earned through real activity"}
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
                      onPress={() =>
                        commit(
                          selected,
                          featured === achievement.id ? null : achievement.id,
                          featured === achievement.id ? "Home shows no badge now." : `${achievement.name} now shows on Home.`,
                        )
                      }
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
                      {isFeatured ? (
                        <CheckIcon size={iconToken.check.size} stroke={iconToken.check.stroke} color={color.forest} />
                      ) : null}
                    </Tappable>
                  );
                })}
              </View>
            )}

            <SectionHeader
              accent="Profile badges"
              subtitle={`Tap an earned badge to show it on your profile. Up to ${maxSlots}; an empty slot is not shown.`}
            />
            <Text
              style={[textStyle(type.metadata), styles.selectionCount]}
              accessibilityLiveRegion="polite"
            >
              {`${selected.length} of ${maxSlots} selected`}
            </Text>
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
                    <View style={[styles.badge, isSelected && styles.badgeSelected]}>
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

          {/* Saved: a small toast with the duck, and Undo. */}
          {saveMessage ? (
            <View style={[styles.toast, { bottom: Math.max(insets.bottom, 12) + 8 }]} accessibilityLiveRegion="polite">
              {saveMessage.ok ? <ExpoImage source={MASCOT.celebrateTrimmed} contentFit="contain" style={styles.toastDuck} accessible={false} /> : null}
              <View style={{ flex: 1 }}>
                {saveMessage.ok ? <Text style={styles.toastTitle}>Saved</Text> : null}
                <Text style={styles.toastBody}>{saveMessage.text}</Text>
              </View>
              {saveMessage.ok && undo ? (
                <Tappable
                  onPress={() => {
                    const back = undo;
                    setUndo(null);
                    setSelected(back.ids);
                    setFeatured(back.featured);
                    save.mutate(
                      { achievementIds: back.ids, featuredAchievementId: back.featured },
                      { onSuccess: () => setSaveMessage({ ok: true, text: "Change undone." }) },
                    );
                  }}
                  accessibilityRole="button"
                  style={styles.undo}
                >
                  <Text style={styles.undoText}>Undo</Text>
                </Tappable>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const BADGE = 48;

const toastStyles = {
  toast: {
    position: "absolute" as const,
    left: 16,
    right: 16,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#14140F",
  },
  toastDuck: { width: 40, height: 44 },
  toastTitle: { fontFamily: font.sansBold, fontSize: 14, color: "#FFFFFF" },
  toastBody: { fontFamily: font.sans, fontSize: 13, color: "#E8E6DE" },
  undo: { paddingHorizontal: 10, paddingVertical: 8 },
  undoText: { fontFamily: font.sansBold, fontSize: 14, color: "#7FD992" },
};

const styles = StyleSheet.create({
  ...toastStyles,
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
  badgeSelected: { borderWidth: border.chip, borderColor: color.forest },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  selectionCount: { paddingHorizontal: space.screenX, paddingBottom: space.home.tileBody, color: color.inkSecondary },

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
  saving: { flexDirection: "row", alignItems: "center", gap: space.home.searchGap },
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
