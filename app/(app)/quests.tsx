import { Image } from "expo-image";
import { MascotEmptyState } from "../../src/components/MascotEmptyState";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { useQuests, type Quest, type QuestTier } from "../../src/api/quests";
import { CheckIcon, ChevronRightIcon, LeafIcon } from "../../src/components/icons";
import { MASCOT } from "../../src/media/mascots";
import { Tappable } from "../../src/components/Tappable";
import { useRefetchOnFocus } from "../../src/lib/refetch-on-focus";
import { border, color, font, space, textStyle, type } from "../../src/theme/tokens";

/**
 * The Quests screen: today's five quests from GET /api/v1/quests.
 * Reached from the Quests icon in AppHeader, which only Home, Community and
 * Marketplace show (`showQuests`).
 *
 * ── COMPLETION SHOWS UP WHEN THIS SCREEN ASKS, NOT BEFORE ────────────────────
 *
 * The server does not mark a quest done when you send the offer or list the
 * item. reconcileQuests() in the server's @/lib/quests checks real rows and
 * pays the Leaves during the GET itself (see the header of src/api/quests.ts).
 * So this screen refetches every time it regains focus. It is a hidden tab
 * that stays mounted, so without that a quest finished elsewhere would still
 * read "not done" on the second visit.
 *
 * States follow Home: a spinner while there is nothing to show, and a plain
 * "Could not load" line with a Try again link on a failed first load. It is
 * never a blank screen. A failed REFETCH keeps the last list up.
 */
const TIER_LABEL: Record<QuestTier, string> = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };

/** Green for the everyday, neutral for the middle, terracotta for the one hard ask. */
const TIER_TONE: Record<QuestTier, { fill: string; line: string; ink: string }> = {
  EASY: { fill: color.greenWash, line: color.greenLine, ink: color.forest },
  MEDIUM: { fill: color.control, line: color.controlLineStrong, ink: color.ink },
  HARD: { fill: color.urgentWash, line: color.urgentLine, ink: color.urgent },
};

/**
 * Where "go do this" sends someone for a quest they haven't finished yet.
 *
 * Nothing ON THIS SCREEN completes a quest -- every one is satisfied by doing
 * something elsewhere (posting, offering, trading) and credited on the next
 * GET -- so tapping an unfinished card is navigation, not a claim. A quest
 * key missing from this table (a new one the server added) renders as a
 * plain, untappable card rather than a button that goes nowhere.
 */
const QUEST_ACTION: Record<string, { route: string; label: string }> = {
  SEND_OFFER: { route: "/marketplace", label: "Browse listings" },
  SEND_BRIDGE_OFFER: { route: "/marketplace", label: "Browse listings" },
  FOLLOW_TRADER: { route: "/marketplace", label: "Find traders" },
  LEAVE_REVIEW: { route: "/trades-history", label: "Review a trade" },
  LIST_ITEM: { route: "/post-item", label: "List an item" },
  RECEIVE_OFFER: { route: "/profile", label: "View your shelf" },
  COMPLETE_TRADE: { route: "/trades", label: "View your trades" },
  COMPLETE_BRIDGE_TRADE: { route: "/trades", label: "View your trades" },
  COMPLETE_SAFEZONE_TRADE: { route: "/trades", label: "View your trades" },
};

export default function QuestsScreen() {
  const router = useRouter();
  const { data, isPending, isError, isRefetching, refetch } = useQuests();
  useRefetchOnFocus(refetch);

  const resetsIn = useCountdown(data?.resetsAt);

  // Past midnight UTC the list on screen is yesterday's. Ask for today's.
  useEffect(() => {
    if (resetsIn === "now") void refetch();
  }, [resetsIn, refetch]);

  const done = data ? data.quests.filter((q) => q.completed).length : 0;
  const earned = data ? data.quests.reduce((n, q) => n + (q.completed ? q.rewardLeaves : 0), 0) : 0;
  const total = data ? data.quests.reduce((n, q) => n + q.rewardLeaves, 0) : 0;

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={{ paddingTop: space.home.top, paddingBottom: space.home.bottom }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={color.green} />
      }
    >
      <View style={s.heading}>
        <Text style={[textStyle(type.homeSection), { color: color.ink }]} accessibilityRole="header">
          Today&apos;s quests
        </Text>
        {resetsIn && resetsIn !== "now" ? (
          <Text style={[textStyle(type.gridMeta), { color: color.inkMuted }]}>
            Resets in {resetsIn}
          </Text>
        ) : null}
      </View>

      {isPending ? (
        <ActivityIndicator color={color.green} style={s.loading} />
      ) : isError && !data ? (
        <View style={s.stateBox}>
          <Text style={[textStyle(type.emptyBody), { color: color.inkSecondary }]}>
            Could not load today&apos;s quests.
          </Text>
          <Tappable onPress={() => void refetch()} accessibilityRole="button" style={s.retry}>
            <Text style={[textStyle(type.homeSeeAll), { color: color.forest }]}>Try again</Text>
          </Tappable>
        </View>
      ) : data ? (
        <>
          {/* Progress in one compact strip; it celebrates when all are done. */}
          {data.quests.length > 0 && done === data.quests.length ? (
            <View style={[s.strip, s.stripDone]}>
              <Image source={MASCOT.celebrateTrimmed} contentFit="contain" style={s.stripDuck} accessible={false} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={s.stripTitle}>All {done} done!</Text>
                <Text style={s.stripBody}>
                  You earned all {total} Leaves today.{resetsIn && resetsIn !== "now" ? ` New quests in ${resetsIn}.` : ""}
                </Text>
              </View>
            </View>
          ) : data.quests.length > 0 ? (
            <View style={s.strip}>
              <View style={s.stripHead}>
                <Text style={s.stripCount}>
                  {done} of {data.quests.length} done
                </Text>
                <View style={s.stripEarned}>
                  <LeafIcon size={13} stroke={2.4} color="#DDF1E2" />
                  <Text style={s.stripEarnedText}>
                    {earned} of {total} Leaves earned
                  </Text>
                </View>
              </View>
              <View style={s.segments} accessibilityLabel={`${done} of ${data.quests.length} quests done`}>
                {data.quests.map((q) => (
                  <View key={q.quest} style={[s.segment, q.completed && s.segmentDone]} />
                ))}
              </View>
            </View>
          ) : null}
          {data.quests.length === 0 ? (
            <MascotEmptyState pose="celebrate" size={100} title="No quests today" message="Check back tomorrow for new ones." />
          ) : (
            <View style={s.list}>
              {data.quests.map((q, i) => (
                <QuestRow
                  key={q.quest}
                  quest={q}
                  first={i === 0}
                  onNavigate={(route) => router.push(route as never)}
                />
              ))}
            </View>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

/**
 * One quest as a row. The circle is the status: empty to do, filled when
 * done. The whole row opens where the quest gets done.
 */
function QuestRow({ quest, first, onNavigate }: { quest: Quest; first: boolean; onNavigate: (route: string) => void }) {
  const action = quest.completed ? undefined : QUEST_ACTION[quest.quest];
  return (
    <Tappable
      onPress={action ? () => onNavigate(action.route) : undefined}
      disabled={!action}
      accessibilityRole={action ? "button" : undefined}
      accessibilityHint={action ? action.label : undefined}
      style={[s.row, !first && s.rowLine]}
      pressedStyle={action ? s.rowPressed : undefined}
      accessible
      accessibilityLabel={`${TIER_LABEL[quest.tier]} quest: ${quest.label}. ${quest.description} ${
        quest.completed ? "Done" : "Not done"
      }, ${quest.rewardLeaves} Leaves.`}
    >
      {quest.completed ? (
        <View style={s.doneMark}>
          <CheckIcon size={14} stroke={3} color={color.surface} />
        </View>
      ) : (
        <View style={s.todoMark} />
      )}
      <View style={s.rowText}>
        <Text style={[s.rowTitle, quest.completed && { color: color.inkSecondary }]}>{quest.label}</Text>
        <Text style={quest.completed ? s.rowDone : s.rowSub}>
          {quest.completed
            ? `Done · +${quest.rewardLeaves} Leaves earned`
            : `${quest.description} · ${TIER_LABEL[quest.tier]}`}
        </Text>
      </View>
      {!quest.completed ? (
        <>
          <View style={s.reward}>
            <LeafIcon size={12} stroke={2.6} color={color.forest} />
            <Text style={s.rewardText}>+{quest.rewardLeaves}</Text>
          </View>
          {action ? <ChevronRightIcon size={16} stroke={2} color={color.inkMuted} /> : null}
        </>
      ) : null}
    </Tappable>
  );
}

function useCountdown(iso: string | undefined): string | undefined {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  if (!iso) return undefined;
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return "now";
  const mins = Math.ceil(ms / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const MARK = 24;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  heading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: space.screenX,
    marginTop: space.home.sectionTop,
  },
  summary: {
    color: color.inkSecondary,
    paddingHorizontal: space.screenX,
    marginTop: 4,
    marginBottom: space.home.headingToContent,
  },
  loading: { marginTop: space.home.sectionTop * 2 },
  stateBox: { alignItems: "center", marginTop: space.home.sectionTop * 2, gap: 12 },
  retry: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  empty: { color: color.inkMuted, paddingHorizontal: space.screenX },
  strip: {
    marginHorizontal: space.screenX,
    marginTop: 10,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: color.forest,
    gap: 10,
  },
  stripDone: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  stripDuck: { width: 58, height: 64 },
  stripTitle: { fontFamily: font.displayBold, fontSize: 20, color: "#FFFFFF" },
  stripBody: { fontSize: 13, color: "#DDF1E2" },
  stripHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  stripCount: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  stripEarned: { flexDirection: "row", alignItems: "center", gap: 4 },
  stripEarnedText: { fontSize: 13, fontWeight: "600", color: "#DDF1E2" },
  segments: { flexDirection: "row", gap: 4 },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.22)" },
  segmentDone: { backgroundColor: color.green },
  // One card of rows (4 Nov 2026), not a stack of cards.
  list: {
    marginHorizontal: space.screenX,
    borderRadius: 18,
    borderWidth: border.hairline,
    borderColor: color.controlLine,
    backgroundColor: color.searchSurface,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  rowLine: { borderTopWidth: border.hairline, borderTopColor: color.divider },
  rowPressed: { backgroundColor: color.greenWash },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: color.ink },
  rowSub: { fontSize: 13, color: color.inkSecondary },
  rowDone: { fontSize: 12, fontWeight: "600", color: color.forest },
  reward: { flexDirection: "row", alignItems: "center", gap: 3 },
  rewardText: { fontSize: 13, fontWeight: "700", color: color.forest },
  doneMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: color.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  todoMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: color.dashed,
  },
});
