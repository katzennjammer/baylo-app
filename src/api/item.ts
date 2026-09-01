import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiV1 } from "./client";
import type { ItemDetailPayload } from "./types";

/**
 * GET /api/v1/items/[id], plus the two moderation actions the detail screen
 * offers.
 *
 * The detail route is a composite like /home: one request returns the item, the
 * owner (with a REAL trust tier — see below), the Safe-Zone hubs, and
 * everything the offer sheet would need. There is no second call to make.
 *
 * ON THE TRUST TIER: this endpoint resolves it server-side. Do NOT run the
 * item's owner through `resolveTier()` here the way the feed and the grid do.
 * That fallback is documented as optimistic — it reads a denormalised counter
 * that sits above the real completed-trade count and cannot see DPA defaults at
 * all — and this is the one screen where the badge is read by somebody deciding
 * whether to go and meet a stranger. An inflated badge there is worse than no
 * badge, so the server answers or nothing is drawn.
 */

export const itemKey = (id: string) => ["item", id] as const;

export function useItem(id: string | undefined) {
  return useQuery({
    queryKey: itemKey(id ?? ""),
    queryFn: () => apiV1<ItemDetailPayload>(`/api/v1/items/${encodeURIComponent(id!)}`),
    // A screen reached without an id has nothing to fetch. Guarding here rather
    // than at the call site keeps the hook order stable across renders.
    enabled: !!id,
    select: (r) => r.data,
  });
}

/* ────────────────────────────── report ──────────────────────────────── */

/**
 * The reasons, mirrored from the server's REPORT_CATEGORIES.
 *
 * Wire values are lower_snake and are a CLOSED SET the server maps explicitly —
 * they are not derived from the database enum's name, so they do not change if
 * somebody renames it. Another hand-kept mirror, like CONDITIONS in browse.ts.
 */
export const REPORT_REASONS: readonly { value: string; label: string }[] = [
  { value: "spam", label: "Spam or misleading" },
  { value: "prohibited_item", label: "Prohibited item" },
  { value: "scam_or_fraud", label: "Scam or fraud" },
  { value: "counterfeit", label: "Counterfeit" },
  { value: "harassment", label: "Harassment" },
  { value: "other", label: "Something else" },
];

/**
 * POST /api/v1/reports.
 *
 * A 409 means this reporter already has an OPEN report against this target —
 * the server holds one live report per (reporter, target) in a unique index.
 * That is a normal outcome to show plainly ("you have already reported this"),
 * not an error to retry.
 */
export function useReportItem() {
  return useMutation({
    mutationFn: (input: { itemId: string; category: string; notes?: string }) =>
      apiV1<{ report: { id: string; status: string }; message: string }>("/api/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "listing",
          targetId: input.itemId,
          category: input.category,
          ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
        }),
      }),
  });
}

/* ─────────────────────────────── block ──────────────────────────────── */

/**
 * POST /api/v1/blocks.
 *
 * Blocking is symmetric in EFFECT — every feed and message query filters both
 * directions — so the listing this screen is showing is about to become
 * invisible to this viewer. The whole browse cache is therefore invalidated on
 * success, not just this item: the blocked owner's OTHER listings have to leave
 * the grid too, and they are spread across pages this screen cannot see.
 *
 * A block does NOT cancel a trade in progress. That is the server's rule and it
 * is deliberate — the items may already have changed hands at a meetup, and
 * nothing here can undo a physical handover.
 */
export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiV1<{
        block: { id: string; user: { id: string; name: string; avatar: string | null } };
        // Stated positively by the server so a client can render facts rather
        // than infer them from absence. Surfaced verbatim in the confirmation.
        effects: { hidden: string[]; unchanged: string[] };
      }>("/api/v1/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["browse"] });
      void qc.invalidateQueries({ queryKey: ["home"] });
    },
  });
}
