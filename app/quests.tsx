import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ApiError } from "../src/api/client";
import { useQuests, type QuestTier, type QuestView } from "../src/api/quests";
import { color, radius, textStyle, type } from "../src/theme/tokens";

const TIER_LABEL: Record<QuestTier, string> = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };
const TIER_ORDER: QuestTier[] = ["EASY", "MEDIUM", "HARD"];

/**
 * Where "go do this" sends someone for a quest they haven't finished yet.
 *
 * There is no in-app action ON THIS SCREEN that completes a quest -- see the
 * note on useQuests(). Every quest is satisfied by doing something
 * elsewhere (posting, offering, trading), so the button here is navigation,
 * not a claim.
 */
const QUEST_ROUTE: Record<string, string> = {
  SEND_OFFER: "/marketplace",
  FOLLOW_TRADER: "/marketplace",
  LEAVE_REVIEW: "/trades",
  LIST_ITEM: "/post-item",
  RECEIVE_OFFER: "/profile",
  COMPLETE_TRADE: "/trades",
  COMPLETE_BRIDGE_TRADE: "/trades",
  COMPLETE_SAFEZONE_TRADE: "/trades",
};
const QUEST_ROUTE_LABEL: Record<string, string> = {
  SEND_OFFER: "Browse listings",
  FOLLOW_TRADER: "Find traders",
  LEAVE_REVIEW: "Review a trade",
  LIST_ITEM: "List an item",
  RECEIVE_OFFER: "View your shelf",
  COMPLETE_TRADE: "View your trades",
  COMPLETE_BRIDGE_TRADE: "View your trades",
  COMPLETE_SAFEZONE_TRADE: "View your trades",
};

/** `3h 42m` / `48m` / `Resetting…` -- ticks locally rather than refetching every second. */
function useCountdown(resetsAt: string | undefined): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!resetsAt) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [resetsAt]);
  if (!resetsAt) return "";
  const ms = new Date(resetsAt).getTime() - now;
  if (ms <= 0) return "Resetting…";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function QuestsScreen() {
  const router = useRouter();
  const query = useQuests();
  const countdown = useCountdown(query.data?.resetsAt);

  const quests = query.data?.quests ?? [];
  const earnedToday = quests.filter((q) => q.completed).reduce((sum, q) => sum + q.rewardLeaves, 0);
  const possibleToday = quests.reduce((sum, q) => sum + q.rewardLeaves, 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={color.ink} />
        </Pressable>
        <Text style={[textStyle(type.sectionHeading), styles.title]}>Quests</Text>
      </View>

      {query.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={color.green} />
        </View>
      ) : query.isError ? (
        <View style={styles.center}>
          <Text style={[textStyle(type.emptyHeadline), styles.errorTitle]}>Could not load today's quests</Text>
          <Text style={[textStyle(type.emptyBody), styles.errorBody]}>
            {query.error instanceof ApiError ? query.error.message : "Try again in a moment."}
          </Text>
          <Pressable onPress={() => query.refetch()} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.summaryCard}>
            <Text style={[textStyle(type.detailBody), styles.summaryLabel]}>Earned this week</Text>
            <Text style={[textStyle(type.detailTitle), styles.summaryValue]}>
              {earnedToday} / {possibleToday} Leaves
            </Text>
            <Text style={[textStyle(type.detailBody), styles.summaryMeta]}>
              Finish quests to earn Leaves. New quests in {countdown || "…"}.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={[textStyle(type.itemTitle), styles.cardTitle]}>This week's quests</Text>
            <Text style={[textStyle(type.detailBody), styles.cardSubtitle]}>
              One quest per tier -- credited the moment the app sees you've done it, no separate claim.
            </Text>
            {TIER_ORDER.map((tier) => {
              const tierQuests = quests.filter((q) => q.tier === tier);
              if (tierQuests.length === 0) return null;
              return (
                <View key={tier} style={styles.tierGroup}>
                  <Text style={[textStyle(type.metadata), styles.tierLabel]}>{TIER_LABEL[tier]}</Text>
                  {tierQuests.map((q) => (
                    <QuestRow key={`${q.tier}:${q.quest}`} quest={q} onNavigate={(path) => router.push(path as never)} />
                  ))}
                </View>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function QuestRow({ quest, onNavigate }: { quest: QuestView; onNavigate: (path: string) => void }) {
  const accent = quest.completed ? color.green : color.inkSecondary;
  const route = QUEST_ROUTE[quest.quest];
  const routeLabel = QUEST_ROUTE_LABEL[quest.quest] ?? "View";

  return (
    <View style={styles.taskCard}>
      <View style={styles.taskHeader}>
        <View style={styles.taskTextWrap}>
          <Text style={[textStyle(type.itemTitle), styles.taskTitle]}>{quest.label}</Text>
          <Text style={[textStyle(type.detailBody), styles.taskDetail]}>{quest.description}</Text>
        </View>
        <View style={[styles.statePill, { backgroundColor: `${accent}20` }]}>
          <Text style={[styles.stateText, { color: accent }]}>{quest.completed ? "Completed" : "Not yet"}</Text>
        </View>
      </View>

      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: quest.completed ? "100%" : "0%", backgroundColor: accent }]} />
        </View>
        <Text style={[textStyle(type.metadata), styles.progressValue]}>{quest.completed ? "1/1" : "0/1"}</Text>
      </View>

      <View style={styles.taskFooter}>
        <Text style={[textStyle(type.detailBody), styles.rewardText]}>
          {quest.completed ? `+${quest.rewardLeaves} Leaves earned` : `Finish to earn ${quest.rewardLeaves} Leaves`}
        </Text>
        {!quest.completed && route ? (
          <Pressable style={styles.claimButton} onPress={() => onNavigate(route)}>
            <Text style={styles.claimButtonText}>{routeLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  content: { padding: 20, gap: 18, paddingBottom: 36 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { color: color.ink },
  center: { paddingVertical: 60, alignItems: "center", justifyContent: "center", gap: 10 },
  errorTitle: { color: color.ink, textAlign: "center" },
  errorBody: { color: color.inkSecondary, textAlign: "center" },
  retry: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: color.green },
  retryText: { color: "#fff", fontWeight: "700" },
  summaryCard: {
    backgroundColor: color.inset,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.divider,
    padding: 18,
    gap: 6,
  },
  summaryLabel: { color: color.inkSecondary },
  summaryValue: { color: color.ink },
  summaryMeta: { color: color.inkSecondary },
  card: {
    backgroundColor: color.inset,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.divider,
    padding: 18,
    gap: 12,
  },
  cardTitle: { color: color.ink },
  cardSubtitle: { color: color.inkSecondary },
  tierGroup: { gap: 10 },
  tierLabel: { color: color.inkSecondary, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 4 },
  taskCard: {
    borderRadius: radius.card,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    padding: 14,
    gap: 10,
  },
  taskHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  taskTextWrap: { flex: 1, gap: 3 },
  taskTitle: { color: color.ink },
  taskDetail: { color: color.inkSecondary },
  statePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  stateText: { fontSize: 12, fontWeight: "700" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: color.divider, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  progressValue: { color: color.inkSecondary, width: 32, textAlign: "right" },
  taskFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rewardText: { color: color.inkSecondary, flex: 1 },
  claimButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: color.green },
  claimButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
