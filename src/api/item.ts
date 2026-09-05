import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiV1, legacyFailure, request } from "./client";
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
 * What can be reported. The server's REPORT_TARGET_TYPES, minus "message",
 * which is reported from the conversation and not from a listing.
 */
export type ReportTarget = "listing" | "user";

/**
 * POST /api/v1/reports.
 *
 * ONE HOOK FOR BOTH TARGETS. The listing overflow menu offers "report this
 * listing" and "report this user" as separate rows, and they are separate
 * reports — a moderator acting on one does not act on the other, and the
 * server's one-live-report-per-target index treats them as different targets.
 * A hook per target would be the same request twice with a different string.
 *
 * A 409 means this reporter already has an OPEN report against this target —
 * the server holds one live report per (reporter, target) in a unique index.
 * That is a normal outcome to show plainly ("you have already reported this"),
 * not an error to retry.
 */
export function useReport() {
  return useMutation({
    mutationFn: (input: {
      targetType: ReportTarget;
      targetId: string;
      category: string;
      notes?: string;
    }) =>
      apiV1<{ report: { id: string; status: string }; message: string }>("/api/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: input.targetType,
          targetId: input.targetId,
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

/* ────────────────────── the owner's own two actions ─────────────────── */

/**
 * PATCH and DELETE /api/items/[id] — NOT /api/v1.
 *
 * There is no v1 route for either. The two below are the ONLY calls in this
 * client that reach a legacy endpoint on purpose, and it is worth saying why
 * rather than leaving it to look like an oversight:
 *
 *   - Both are already correct. `resolveSession()` accepts this app's Bearer
 *     token on every route in the application, and both handlers check
 *     ownership against it (`item.userId !== session.user.id` → 403) before
 *     writing anything. There is no authorisation gap to close.
 *
 *   - The PATCH handler is 190 lines of valuation re-derivation, Safe-Zone hub
 *     reconciliation and per-photo hash bookkeeping, all of it load-bearing and
 *     shared with the web wizard's edit mode. A v1 route would either call into
 *     it or reimplement it, and the second option is how the two paths start
 *     disagreeing about what a listing's value is allowed to be.
 *
 * So they go through `request()` + `legacyFailure()`, which is the same path
 * `createItem()` already takes to POST /api/items — a bare body on success, and
 * `{ error }` on failure, unwrapped into the same ApiError the rest of the app
 * throws. A v1 pair belongs in the task that gives editing its own screen.
 */

/**
 * The fields the listing menu's edit sheet may change.
 *
 * DELIBERATELY THE THREE THAT COST NOTHING TO TOUCH. The PATCH handler re-runs
 * the valuation model whenever `category`, `condition` or `valueLeaves` is
 * present — and can then refuse the request because the stored price no longer
 * fits the new band — and it rewrites hub associations whenever `hubIds` is,
 * and per-photo hashes whenever `images` is. Every one of those is a step in
 * the post wizard, with its own screen and its own explanation of what the
 * server just decided.
 *
 * Omitting a field leaves it alone; that is the handler's own convention, and
 * it is what makes a three-field PATCH safe. Sending `images` unchanged, for
 * instance, would be read as a photo restatement and drop four of a five-photo
 * listing's hashes out of the duplicate pool.
 */
export interface EditListingInput {
  title: string;
  description: string;
  /** "What are you hoping to get?" — free text. `""` clears it. */
  wantedItems: string;
}

/** Server-side caps, mirrored so the composer can stop rather than be refused. */
export const EDIT_LIMITS = { title: 200, description: 5000, wanted: 500 } as const;

export function useUpdateItem(itemId: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: EditListingInput) => {
      const res = await request(`/api/items/${encodeURIComponent(itemId!)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) return legacyFailure(res, "We could not save that just now.");
      return (await res.json()) as { id: string };
    },

    // Invalidated, not patched. Unlike a like, an edit changes fields that are
    // rendered all over the card — title, and the description the detail screen
    // shows — and the server may have trimmed or normalised them on the way in.
    // Refetching is the only way to be sure the screen shows what was stored
    // rather than what was typed.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["home"] });
      void qc.invalidateQueries({ queryKey: ["browse"] });
      if (itemId) void qc.invalidateQueries({ queryKey: ["item", itemId] });
    },
  });
}

/**
 * Delist. A SOFT delete — the handler sets status REMOVED and nulls the pickup
 * coordinates, because a delisted item has no reason to keep the owner's
 * address on file. Offers, messages and any trade already in flight survive it,
 * which is the same rule blocking follows: withdrawing a listing is not a way
 * to make an obligation disappear.
 */
export function useDeleteItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const res = await request(`/api/items/${encodeURIComponent(itemId)}`, {
        method: "DELETE",
      });
      if (!res.ok) return legacyFailure(res, "We could not remove that just now.");
      return (await res.json()) as { success: boolean };
    },

    onSuccess: (_data, itemId) => {
      void qc.invalidateQueries({ queryKey: ["home"] });
      void qc.invalidateQueries({ queryKey: ["browse"] });
      void qc.invalidateQueries({ queryKey: ["item", itemId] });
    },
  });
}
