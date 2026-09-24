import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { apiV1 } from "./client";
import { PROFILE_ME_KEY } from "./profile";

export type QuestTier = "EASY" | "MEDIUM" | "HARD";

export interface QuestView {
  tier: QuestTier;
  quest: string;
  label: string;
  description: string;
  rewardLeaves: number;
  completed: boolean;
}

export interface QuestsPayload {
  quests: QuestView[];
  weekStart: string;
  /** ISO instant. The countdown on the Quests screen is `resetsAt - now`. */
  resetsAt: string;
}

export const QUESTS_KEY = ["quests", "week"] as const;

/**
 * GET /api/v1/quests — the week's three quests, one per tier (Easy, Medium, Hard).
 *
 * There is no claim step: the server credits Leaves the moment it notices the
 * underlying action (an Offer sent, an Item listed, a completed trade) has
 * happened, on whichever call to this route sees it first — see
 * reconcileQuests() in @/lib/quests on the API. So `completed` here already
 * means "paid," not "ready to collect."
 *
 * A short staleTime, not the minute profile.ts uses: this screen is exactly
 * where someone lands right after finishing a quest action elsewhere in the
 * app, and a stale "not completed" would read as the app not noticing.
 *
 * ── WHY THIS INVALIDATES ["home"] AND profile/me ON EVERY FETCH ─────────────
 *
 * The header's Leaves pill (AppHeader.tsx) reads `viewer.leaves` from
 * useHome(), not from this hook — see the note there: "the balance is not
 * treated as authoritative anywhere a decision depends on it... it goes
 * stale until something refetches it." Every other place that credits or
 * spends Leaves (offer.ts, trades.ts, post.ts, notifications.ts,
 * edit-profile.tsx, verify.tsx) invalidates ["home"] right after, for
 * exactly this reason. This route can ALSO credit Leaves, silently, as a
 * side effect of being called — not of anything the USER did on this
 * screen, which is why there is no mutation to hang an onSuccess off of.
 * So the invalidation runs on every successful fetch instead: harmless
 * (React Query dedupes/no-ops when nothing is listening) when nothing
 * changed, and it is the only way the header pill in the screenshot picks
 * up a quest that just got credited without a full app restart.
 */
export function useQuests(enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUESTS_KEY,
    queryFn: () => apiV1<QuestsPayload>("/api/v1/quests"),
    enabled,
    select: (r) => r.data,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!query.dataUpdatedAt) return
    void queryClient.invalidateQueries({ queryKey: ["home"] });
    void queryClient.invalidateQueries({ queryKey: PROFILE_ME_KEY });
    // Keyed on dataUpdatedAt, not on `query.data` itself: a new object with
    // the same content (e.g. a refetch that changed nothing) still bumps
    // dataUpdatedAt, and that is fine to invalidate on -- but keying on
    // `query.data` would also refire for every unrelated re-render that
    // happens to produce a new reference, which `select` here does not,
    // but is not a distinction worth relying on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.dataUpdatedAt]);

  return query;
}
