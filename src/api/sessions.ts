import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiV1 } from "./client";

/**
 * Active sessions: the devices signed in to this account.
 *
 * A session is a refresh FAMILY on the server -- one sign-in on one device and
 * every token rotated from it since. `id` is that family's id. `isCurrent` is
 * worked out by the server from the access token this request carried, so the
 * phone never has to know its own family id.
 *
 * Revoking is immediate: the server refuses that device's very next request,
 * not fifteen minutes later.
 */
export interface ActiveSession {
  id: string;
  /** When the device signed in (ISO). */
  signedInAt: string;
  /** When it last refreshed its sign-in (ISO); lags real use by up to 15 min. */
  lastActiveAt: string;
  isCurrent: boolean;
}

export const SESSIONS_KEY = ["sessions"] as const;

/** GET /api/v1/sessions -- this device first, then most recently active. */
export function useActiveSessions() {
  return useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: async () => (await apiV1<{ sessions: ActiveSession[] }>("/api/v1/sessions")).data.sessions,
    // A list someone opens to check for strangers should not be a minute old.
    staleTime: 0,
  });
}

/**
 * DELETE /api/v1/sessions/[id] -- sign one other device out.
 *
 * Refetched on settle, not success: a 404 means that device was already signed
 * out (or never this account's), and a fresh list is the fix for that too.
 */
export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiV1<{ revoked: string }>(`/api/v1/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSettled: () => void qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}

/**
 * POST /api/v1/sessions/revoke-others -- "Log out all other devices".
 *
 * The server keeps the family this request's token came from and revokes the
 * rest. A 409 (rule NO_SESSION_ID) means this device's token predates session
 * ids; it clears itself at the next refresh, within fifteen minutes.
 */
export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiV1<{ kept: string }>("/api/v1/sessions/revoke-others", { method: "POST" }),
    onSettled: () => void qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}
