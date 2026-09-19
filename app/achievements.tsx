import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { ApiError } from "../src/api/client";
import { DEFAULT_MAX_PROFILE_BADGES, fetchAchievements, updateDisplayedAchievements } from "../src/api/achievements";
import { color, radius, textStyle, type } from "../src/theme/tokens";

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
  size,
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
        style={{ width: size, height: size, borderRadius: size / 4, opacity: dimmed ? 0.4 : 1 }}
        resizeMode="cover"
      />
    );
  }
  return <Text style={[{ fontSize: size }, dimmed && styles.lockedText]}>{icon}</Text>;
}

export default function AchievementsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const query = useQuery({ queryKey: ["achievements"], queryFn: fetchAchievements, staleTime: 30_000 });
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: updateDisplayedAchievements,
    onSuccess: () => {
      setSaveMessage("Saved to your profile.");
      void queryClient.invalidateQueries({ queryKey: ["achievements"] });
      void queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
    },
    onError: () => {
      setSaveMessage("Could not save your changes.");
    },
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [featured, setFeatured] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
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

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={color.ink} />
        </Pressable>
        <View>
          <Text style={[textStyle(type.sectionHeading), styles.title]}>Achievements</Text>
          <Text style={[textStyle(type.sectionSubcopy), styles.subtitle]}>Milestones earned through real activity</Text>
        </View>
      </View>
      {query.isPending ? (
        <View style={styles.center}><ActivityIndicator color={color.green} /></View>
      ) : query.isError ? (
        <View style={styles.center}>
          <Text style={[textStyle(type.emptyHeadline), styles.errorTitle]}>Could not load achievements</Text>
          <Text style={[textStyle(type.emptyBody), styles.errorBody]}>{query.error instanceof ApiError ? query.error.message : "Try again in a moment."}</Text>
          <Pressable onPress={() => query.refetch()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.selectionHeader}>
            <View>
              <Text style={[textStyle(type.itemTitle), { color: color.ink }]}>Your profile badges</Text>
              <Text style={[textStyle(type.detailBody), styles.description]}>Choose up to {maxSlots} earned badges to display.</Text>
            </View>
            <Pressable
              disabled={save.isPending}
              onPress={() => save.mutate({ achievementIds: selected, featuredAchievementId: featured })}
              style={styles.saveButton}
            >
              <Text style={styles.saveText}>{save.isPending ? "Saving..." : "Save"}</Text>
            </Pressable>
          </View>

          <View style={styles.sectionCard}>
            <Text style={[textStyle(type.itemTitle), { color: color.ink }]}>Profile badges</Text>
            <Text style={[textStyle(type.detailBody), styles.description]}>
              Choose up to {maxSlots} badges to show on your profile. Only the badges you pick appear — an
              empty slot is not shown.
            </Text>
          </View>

          {saveMessage ? (
            <View style={styles.saveNotice}>
              <Text style={styles.saveNoticeText}>{saveMessage}</Text>
            </View>
          ) : null}

          <View style={styles.sectionCard}>
            <Text style={[textStyle(type.itemTitle), { color: color.ink }]}>Featured home badge</Text>
            <Text style={[textStyle(type.detailBody), styles.description]}>Pick one badge to show beside your name on the home feed.</Text>
            <View style={styles.featuredRow}>
              {(query.data?.achievements ?? []).filter((achievement) => achievement.unlocked).map((achievement) => {
                const isFeatured = featured === achievement.id;
                return (
                  <Pressable
                    key={achievement.id}
                    onPress={() => setFeatured((current) => (current === achievement.id ? null : achievement.id))}
                    style={[styles.featureBadge, isFeatured && styles.selectedCard]}
                  >
                    <BadgeIcon icon={achievement.icon} imageUrl={achievement.imageUrl} size={22} />
                    <Text style={styles.featureBadgeName}>{achievement.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {(query.data?.achievements ?? []).map((achievement) => {
            const progress = Math.min(achievement.progress, achievement.threshold);
            const isSelected = selected.includes(achievement.id);
            const isFeatured = featured === achievement.id;
            return (
              <Pressable key={achievement.id} disabled={!achievement.unlocked} onPress={() => toggleSelected(achievement.id)} style={[styles.card, !achievement.unlocked && styles.lockedCard, isSelected && styles.selectedCard, isFeatured && styles.featuredCard]}>
                <View style={[styles.badge, !achievement.unlocked && styles.lockedBadge]}>
                  <BadgeIcon icon={achievement.icon} imageUrl={achievement.imageUrl} size={30} dimmed={!achievement.unlocked} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardHeading}>
                    <Text style={[textStyle(type.itemTitle), !achievement.unlocked && styles.lockedText]}>{achievement.name}</Text>
                    {achievement.unlocked && (
                      <View style={styles.rightMeta}>
                        {isSelected && <Ionicons name="checkmark-circle" size={20} color={color.green} />}
                        {isFeatured && <Ionicons name="star" size={18} color={color.green} />}
                      </View>
                    )}
                  </View>
                  <Text style={[textStyle(type.detailBody), styles.description, !achievement.unlocked && styles.lockedText]}>{achievement.description}</Text>
                  {achievement.unlocked ? (
                    <Text style={styles.earned}>Earned {new Date(achievement.unlockedAt!).toLocaleDateString()}</Text>
                  ) : (
                    <Text style={styles.progress}>{progress} of {achievement.threshold} completed</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
          {query.data?.achievements.length === 0 && <Text style={styles.empty}>No achievements are available yet.</Text>}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: color.divider },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { color: color.ink },
  subtitle: { color: color.inkSecondary, marginTop: 2 },
  content: { padding: 20, gap: 12 },
  selectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 2 },
  sectionCard: { gap: 6, padding: 16, backgroundColor: color.inset, borderRadius: radius.card, borderWidth: 1, borderColor: color.divider },
  featuredRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  featureBadge: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: color.divider, backgroundColor: color.surface },
  featureBadgeName: { fontSize: 12, fontWeight: "700", color: color.ink },
  card: { flexDirection: "row", gap: 14, padding: 16, backgroundColor: color.inset, borderRadius: radius.card, borderWidth: 1, borderColor: color.divider },
  lockedCard: { backgroundColor: "#F0F1EE", borderColor: "#E1E3DE" },
  selectedCard: { borderColor: color.green, backgroundColor: "#F1F8F2" },
  featuredCard: { borderColor: "#D8B634", backgroundColor: "#FFF7D8" },
  badge: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#E1F1E5" },
  lockedBadge: { backgroundColor: "#D9DCD7" },
  icon: { fontSize: 24 },
  cardBody: { flex: 1, gap: 5 },
  cardHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rightMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  description: { color: color.inkSecondary },
  lockedText: { color: "#858A84" },
  earned: { color: color.green, fontSize: 12, fontWeight: "700", marginTop: 3 },
  progress: { color: "#777D76", fontSize: 12, fontWeight: "700", marginTop: 3 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  errorTitle: { color: color.ink, textAlign: "center" },
  errorBody: { color: color.inkSecondary, textAlign: "center", marginTop: 8 },
  retry: { marginTop: 18, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: color.green },
  retryText: { color: "#fff", fontWeight: "700" },
  saveButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: color.green },
  saveText: { color: "#fff", fontWeight: "700" },
  saveNotice: { backgroundColor: "#EAF9EE", borderColor: "#B9E7C9", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  saveNoticeText: { color: color.green, fontWeight: "700" },
  empty: { color: color.inkSecondary, textAlign: "center", paddingVertical: 40 },
});
