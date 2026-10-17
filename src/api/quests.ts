import { useQuery, useQueryClient } from "@tanstack/react-query";

import { apiV1 } from "./client";
import { PROFILE_ME_KEY } from "./profile";

/**
 * Daily quests: GET /api/v1/quests.
 *
 * Mirrors QuestView in the server's @/lib/quests. Five a day — 2 Easy, 2
 * Medium, 1 Hard — assigned per UTC calendar day; `resetsAt` is the next
 * midnight UTC (08:00 in Manila).
 *
 * ── THE GET IS THE COMPLETION PATH ───────────────────────────────────────────
 *
 * The server has no event hook for quests. reconcileQuests() recomputes each
 * quest from real rows (an Offer, an Item, a completed TradeRequest) INSIDE
 * this request, and pays the Leaves for anything newly satisfied right there.
 * Two consequences for the client:
 *
 *   1. Nothing is ever stale-but-correct here. A cached copy can say "not done"
 *      about a quest the user finished a minute ago, so `staleTime` is 0 and the
 *      screen refetches every time it comes back into view.
 *   2. A fetch can move the Leaf balance. When one reports more quests done
 *      than the copy it replaces, the balance's owners (useHome() behind
 *      AppHeader, and profile/me) are invalidated, as a boost does.
 */
export type QuestTier = "EASY" | "MEDIUM" | "HARD";

export interface Quest {
  tier: QuestTier;
  /** QuestKind on the server. Unique within a day, so it is the list key. */
  quest: string;
  label: string;
  description: string;
  /** Snapshotted at assignment, so it is what this day pays, not today's table. */
  rewardLeaves: number;
  completed: boolean;
}

export interface QuestDay {
  quests: Quest[];
  periodStart: string;
  resetsAt: string;
}

export const QUESTS_KEY = ["quests"] as const;

const doneCount = (day: QuestDay | undefined) =>
  day ? day.quests.filter((q) => q.completed).length : 0;

export function useQuests() {
  const qc = useQueryClient();
  return useQuery({
    queryKey: QUESTS_KEY,
    queryFn: async () => {
      const before = qc.getQueryData<QuestDay>(QUESTS_KEY);
      const { data } = await apiV1<QuestDay>("/api/v1/quests");
      // A new day starts from zero, so compare only within the same period.
      const sameDay = before?.periodStart === data.periodStart;
      if (doneCount(data) > (sameDay ? doneCount(before) : 0)) {
        void qc.invalidateQueries({ queryKey: ["home"] });
        void qc.invalidateQueries({ queryKey: PROFILE_ME_KEY });
      }
      return data;
    },
    staleTime: 0,
  });
}
