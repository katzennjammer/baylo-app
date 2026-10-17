import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiV1, legacyFailure, request } from "./client";

/**
 * The account half of Settings: password, blocked users, account deletion.
 *
 * Two of the three are LEGACY routes (`/api/user`), answering `{ error }`
 * rather than the v1 envelope, so they go through `request()` +
 * `legacyFailure()` exactly as the auth endpoints do. The blocks list is v1.
 */

/* ───────────────────────────── password ───────────────────────────── */

/**
 * PATCH /api/user with `currentPassword` / `newPassword`.
 *
 * `currentPassword` is optional because a Google-only account has no password
 * to prove -- the server lets that account SET one with the bearer token as
 * proof, and demands the current one from everybody else ("Current password is
 * required" / "is incorrect", both 400s whose message is shown verbatim).
 */
export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const res = await request("/api/user", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(input.currentPassword ? { currentPassword: input.currentPassword } : {}),
      newPassword: input.newPassword,
    }),
  });
  if (!res.ok) await legacyFailure(res, "Could not change your password");
}

/** Mirrors the server's passwordSchema, so the form refuses what the API would. */
export const MIN_PASSWORD_LENGTH = 8;

/* ─────────────────────────── blocked users ─────────────────────────── */

export interface BlockedUser {
  /** The Block row's id. Unblocking takes the USER's id, not this one. */
  id: string;
  user: { id: string; name: string; avatar: string | null };
  createdAt: string;
}

export const BLOCKS_KEY = ["blocks"] as const;

/** GET /api/v1/blocks -- newest block first. */
export function useBlockedUsers() {
  return useQuery({
    queryKey: BLOCKS_KEY,
    queryFn: async () => (await apiV1<{ blocks: BlockedUser[] }>("/api/v1/blocks")).data.blocks,
  });
}

/**
 * DELETE /api/v1/blocks/[userId].
 *
 * The feeds are invalidated for the same reason blocking invalidates them (see
 * useBlockUser): the unblocked person's listings are about to be visible again
 * on pages this screen cannot see.
 */
export function useUnblockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiV1<{ unblocked: string }>(`/api/v1/blocks/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      }),
    onSettled: () => {
      // Settled, not success: a 404 means "you were not blocking them", i.e.
      // the list on screen is stale, and a refetch is the fix for that too.
      void qc.invalidateQueries({ queryKey: BLOCKS_KEY });
      void qc.invalidateQueries({ queryKey: ["browse"] });
      void qc.invalidateQueries({ queryKey: ["home"] });
    },
  });
}

/* ────────────────────────── account deletion ────────────────────────── */

/**
 * DELETE /api/user -- permanent.
 *
 * The server anonymises the account rather than removing the row (the Leaf
 * ledger has to keep balancing), revokes every refresh token, and removes the
 * person's listings. `confirm: "DELETE"` is the typed confirmation the route
 * requires; `password` is required for password accounts and ignored for
 * Google-only ones. The caller signs out locally afterwards -- the tokens on
 * this device are already dead server-side.
 */
export async function deleteAccount(password: string): Promise<void> {
  const res = await request("/api/user", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: "DELETE", ...(password ? { password } : {}) }),
  });
  if (!res.ok) await legacyFailure(res, "Could not delete your account");
}
