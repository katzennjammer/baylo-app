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
import { SheetRow, SheetRows, SheetShell } from "../src/components/sheet-ui";
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
  const [pickingHome, setPickingHome] = useState(false);
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
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 18 }}>
            {/* A live preview of the profile strip: what others will see. */}
            <View style={styles.preview}>
              <View style={styles.previewHead}>
                <Text style={styles.previewTitle}>On your profile</Text>
                <Text style={styles.previewCount}>{selected.length} of {maxSlots}</Text>
              </View>
              <View style={styles.slots}>
                {Array.from({ length: maxSlots }, (_, i) => {
                  const a = achievements.find((x) => x.id === selected[i]);
                  return (
                    <View key={i} style={[styles.slot, !a && styles.slotEmpty]}>
                      {a ? <BadgeIcon icon={a.icon} imageUrl={a.imageUrl} size={52} /> : null}
                    </View>
                  );
                })}
              </View>
              <View style={styles.homeRow}>
                <Text style={styles.homeText}>
                  Beside your name on Home:{" "}
                  <Text style={{ fontWeight: "700" }}>{achievements.find((x) => x.id === featured)?.name ?? "none"}</Text>
                </Text>
                {earned.length > 0 ? (
                  <Tappable onPress={() => setPickingHome(true)} accessibilityRole="button" style={styles.changeButton}>
                    <Text style={styles.changeText}>Change</Text>
                  </Tappable>
                ) : null}
              </View>
            </View>

            {/* Earned: tap to put on (or take off) your profile. */}
            {earned.length > 0 ? (
              <View style={{ gap: 8 }}>
                <Text style={styles.groupTitle}>EARNED · {earned.length} · tap to show on your profile</Text>
                <View style={styles.earnedGrid}>
                  {earned.map((a) => {
                    const on = selected.includes(a.id);
                    return (
                      <Tappable
                        key={a.id}
                        onPress={() => toggleSelected(a.id)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={`${a.name}. ${a.description}`}
                        style={[styles.earnedTile, on && styles.earnedTileOn]}
                      >
                        <BadgeIcon icon={a.icon} imageUrl={a.imageUrl} size={56} />
                        <Text style={styles.earnedName} numberOfLines={2}>{a.name}</Text>
                        {on ? (
                          <View style={styles.earnedCheck}>
                            <CheckIcon size={12} stroke={3} color={color.onGreen} />
                          </View>
                        ) : null}
                      </Tappable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Not yet: what to do to get them. */}
            {achievements.some((a) => !a.unlocked) ? (
              <View style={{ gap: 6 }}>
                <Text style={styles.groupTitle}>NOT YET · {achievements.filter((a) => !a.unlocked).length}</Text>
                <View style={styles.notYet}>
                  {achievements
                    .filter((a) => !a.unlocked)
                    .map((a, i) => (
                      <View key={a.id} style={[styles.notYetRow, i > 0 && styles.notYetLine]}>
                        <View style={styles.notYetIcon}>
                          <BadgeIcon icon={a.icon} imageUrl={a.imageUrl} size={30} dimmed />
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                          <Text style={styles.notYetName}>{a.name}</Text>
                          <Text style={styles.notYetSub}>{a.description}</Text>
                        </View>
                        <Text style={styles.notYetProgress}>
                          {Math.min(a.progress, a.threshold)}/{a.threshold}
                        </Text>
                      </View>
                    ))}
                </View>
              </View>
            ) : null}
            {achievements.length === 0 ? (
              <Text style={[textStyle(type.emptyBody), styles.empty]}>No achievements are available yet.</Text>
            ) : null}
          </ScrollView>

          {/* Change the Home badge. */}
          {pickingHome ? (
            <SheetShell title="Beside your name on Home" onClose={() => setPickingHome(false)}>
              <SheetRows>
                {earned.map((a) => (
                  <SheetRow
                    key={a.id}
                    glyph={<BadgeIcon icon={a.icon} imageUrl={a.imageUrl} size={24} />}
                    label={featured === a.id ? `${a.name} (showing)` : a.name}
                    onPress={() => {
                      setPickingHome(false);
                      if (featured !== a.id) commit(selected, a.id, `${a.name} now shows on Home.`);
                    }}
                  />
                ))}
                {featured ? (
                  <SheetRow
                    label="Show no badge"
                    onPress={() => {
                      setPickingHome(false);
                      commit(selected, null, "Home shows no badge now.");
                    }}
                  />
                ) : null}
              </SheetRows>
            </SheetShell>
          ) : null}

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
  preview: { gap: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: color.controlLine, backgroundColor: color.searchSurface },
  previewHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  previewTitle: { fontFamily: font.sansBold, fontSize: 15, color: color.ink },
  previewCount: { fontFamily: font.sans, fontSize: 12, color: color.inkSecondary },
  slots: { flexDirection: "row", gap: 8 },
  slot: { flex: 1, aspectRatio: 1, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: color.greenWash, borderWidth: 2, borderColor: color.green, overflow: "hidden" },
  slotEmpty: { backgroundColor: "transparent", borderColor: color.dashed, borderStyle: "dashed" },
  homeRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: color.divider },
  homeText: { flex: 1, fontFamily: font.sans, fontSize: 13, color: "#3F3E37" },
  changeButton: { height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: color.controlLineStrong, justifyContent: "center" },
  changeText: { fontFamily: font.sansSemi, fontSize: 13, color: color.ink },
  groupTitle: { marginHorizontal: 4, fontFamily: font.sansBold, fontSize: 13, color: color.inkSecondary },
  earnedGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  earnedTile: { width: "31.5%", alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 16, borderWidth: 1, borderColor: color.controlLine, backgroundColor: color.searchSurface },
  earnedTileOn: { borderColor: color.green, borderWidth: 2, backgroundColor: color.greenWash },
  earnedName: { fontFamily: font.sansBold, fontSize: 12, textAlign: "center", color: color.ink },
  earnedCheck: { position: "absolute", right: 6, top: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: color.green, alignItems: "center", justifyContent: "center" },
  notYet: { borderRadius: 16, borderWidth: 1, borderColor: color.controlLine, backgroundColor: color.searchSurface, overflow: "hidden" },
  notYetRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  notYetLine: { borderTopWidth: 1, borderTopColor: color.divider },
  notYetIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#EFEDE5", alignItems: "center", justifyContent: "center" },
  notYetName: { fontFamily: font.sansSemi, fontSize: 14, color: color.ink },
  notYetSub: { fontFamily: font.sans, fontSize: 12, color: color.inkSecondary },
  notYetProgress: { fontFamily: font.sansBold, fontSize: 13, color: color.forest },
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
