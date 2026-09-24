import { useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { useQuests, type Quest, type QuestTier } from "../../src/api/quests";
import { CheckIcon, LeafIcon } from "../../src/components/icons";
import { Tappable } from "../../src/components/Tappable";
import { useRefetchOnFocus } from "../../src/lib/refetch-on-focus";
import { border, color, icon, radius, space, textStyle, type } from "../../src/theme/tokens";

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

export default function QuestsScreen() {
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
          <Text style={[textStyle(type.sectionSubcopy), s.summary]}>
            {done} of {data.quests.length} done · {earned} of {total} Leaves earned. New quests
            every day.
          </Text>
          {data.quests.length === 0 ? (
            <Text style={[textStyle(type.emptyBody), s.empty]}>No quests today.</Text>
          ) : (
            <View style={s.list}>
              {data.quests.map((q) => (
                <QuestRow key={q.quest} quest={q} />
              ))}
            </View>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function QuestRow({ quest }: { quest: Quest }) {
  const tone = TIER_TONE[quest.tier];
  return (
    <View
      style={[s.card, quest.completed && s.cardDone]}
      accessible
      accessibilityLabel={`${TIER_LABEL[quest.tier]} quest: ${quest.label}. ${quest.description} ${
        quest.completed ? "Done" : "Not done"
      }, ${quest.rewardLeaves} Leaves.`}
    >
      <View style={s.cardTop}>
        <View style={[s.tier, { backgroundColor: tone.fill, borderColor: tone.line }]}>
          <Text style={[textStyle(type.tierBadge), { color: tone.ink }]}>
            {TIER_LABEL[quest.tier].toUpperCase()}
          </Text>
        </View>
        <View style={s.reward}>
          <LeafIcon size={icon.cardLeaf.size} stroke={icon.cardLeaf.stroke} color={color.forest} />
          <Text style={[textStyle(type.leavesCard), { color: color.forest }]}>
            +{quest.rewardLeaves}
          </Text>
        </View>
      </View>

      <View style={s.cardBody}>
        <View style={s.cardText}>
          <Text
            style={[
              textStyle(type.itemTitle),
              { color: quest.completed ? color.inkSecondary : color.ink },
            ]}
          >
            {quest.label}
          </Text>
          <Text style={[textStyle(type.metadata), { color: color.inkMuted, marginTop: 2 }]}>
            {quest.description}
          </Text>
        </View>
        {quest.completed ? (
          <View style={s.doneMark}>
            <CheckIcon size={icon.check.size} stroke={icon.check.stroke} color={color.onGreen} />
          </View>
        ) : (
          <View style={s.todoMark} />
        )}
      </View>
    </View>
  );
}

/**
 * "5h 12m" until `iso`, ticking each minute. "now" once it has passed, which
 * the screen reads as "go and get the new day". Undefined while there is
 * nothing to count down to.
 */
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
  list: { paddingHorizontal: space.screenX, gap: space.browse.gridGap },
  card: {
    borderRadius: radius.card,
    borderWidth: border.hairline,
    borderColor: color.controlLine,
    backgroundColor: color.surface,
    padding: 14,
    gap: 10,
  },
  cardDone: { backgroundColor: color.inset },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tier: {
    paddingHorizontal: space.tierBadge.x,
    paddingVertical: space.tierBadge.y,
    borderRadius: radius.tierBadge,
    borderWidth: border.chip,
  },
  reward: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardBody: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardText: { flex: 1 },
  doneMark: {
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
  },
  todoMark: {
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    borderWidth: border.chip,
    borderColor: color.controlLineStrong,
  },
});
