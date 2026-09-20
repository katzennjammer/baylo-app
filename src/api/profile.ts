import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiV1, request } from "./client";
import type { FollowStatus, ProfileConnectionUser, ProfileMePayload, PublicProfilePayload } from "./types";

/**
 * GET /api/v1/profile/me — the viewer's own shelf, standing and ID gate.
 *
 * ── WHY THE OFFER FLOW NEEDS THIS AT ALL ────────────────────────────────────
 *
 * /api/v1/items/[id] already carries most of an offer sheet: the listing, the
 * viewer's Leaf balance, whether they have a pending offer, and the ids of
 * their tradeable items. What it does NOT carry is what those items are WORTH —
 * `viewer.tradeableItems` is `{ id, title, image }` — and the gap between two
 * values is the entire subject of the offer screen. This route returns the same
 * items as full `Item` rows, `valueLeaves` included, so the two are joined by
 * id in `useOfferContext()`.
 *
 * It is also the only route that serves `reputation` and `idVerification`, both
 * of which the screen has to express before somebody fills in a proposal.
 *
 * ── `limit=50` IS THE MAXIMUM, AND IT IS STILL A PAGE ───────────────────────
 *
 * The route is keyset-paginated: default 20, `MAX_LIMIT` 50, and it returns
 * AVAILABLE and OWNED rows together. So 50 is asked for rather than the default
 * — a shelf of 30 listings would otherwise come back with ten of them missing
 * their value — and the join in `useOfferContext()` still treats a miss as
 * "unknown value" rather than as "worth nothing". A user with more than 50
 * shelf rows will have their oldest listings come back unvalued; that is a real
 * limit and it is stated at the join rather than hidden here.
 *
 * ── STALENESS ──────────────────────────────────────────────────────────────
 *
 * A minute. The balance, the tier and the debt headroom all move as a result of
 * things happening elsewhere — an offer accepted, a contract swept into default
 * — and this is the payload that decides whether a promise route is offered at
 * all. Long enough that opening three listings in a row is one request; short
 * enough that a tier change is not carried around for a session.
 */

export const PROFILE_ME_KEY = ["profile", "me"] as const;

/** The route's own MAX_LIMIT. Asking for more is a 400, not a clamp. */
const SHELF_PAGE = 50;

export function useProfileMe(enabled = true) {
  return useQuery({
    queryKey: PROFILE_ME_KEY,
    queryFn: () => apiV1<ProfileMePayload>(`/api/v1/profile/me?limit=${SHELF_PAGE}`),
    enabled,
    select: (r) => r.data,
    staleTime: 60_000,
  });
}

export function usePublicProfile(id: string | undefined) {
  return useQuery({
    queryKey: ["profile", id],
    queryFn: () => apiV1<PublicProfilePayload>(`/api/v1/profile/${encodeURIComponent(id!)}`),
    enabled: !!id,
    select: (r) => r.data,
    staleTime: 60_000,
  });
}

export function useFollow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const response = await request("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followeeId: userId }),
      });
      if (!response.ok) throw new Error("Could not follow this user");
    },
    onMutate: async ({ userId }) => {
      await queryClient.cancelQueries({ queryKey: ["profile", userId] });
      await queryClient.cancelQueries({ queryKey: ["profile-connections"] });
      queryClient.setQueryData<PublicProfilePayload>(["profile", userId], (profile) => profile ? {
        ...profile,
        counts: { ...profile.counts, followers: profile.counts.followers + 1 },
        follow: { ...profile.follow, status: "ACCEPTED" },
      } : profile);
      updateConnectionCaches(queryClient, userId, "ACCEPTED");
    },
    onError: (_error, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      void queryClient.invalidateQueries({ queryKey: ["profile-connections"] });
    },
  });
}

export function useUnfollow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const response = await request(`/api/follows/${encodeURIComponent(userId)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not unfollow this user");
    },
    onMutate: async ({ userId }) => {
      await queryClient.cancelQueries({ queryKey: ["profile", userId] });
      await queryClient.cancelQueries({ queryKey: ["profile-connections"] });
      queryClient.setQueryData<PublicProfilePayload>(["profile", userId], (profile) => profile ? {
        ...profile,
        counts: { ...profile.counts, followers: Math.max(0, profile.counts.followers - 1) },
        follow: { ...profile.follow, status: "NONE" },
      } : profile);
      updateConnectionCaches(queryClient, userId, "NONE");
    },
    onError: (_error, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      void queryClient.invalidateQueries({ queryKey: ["profile-connections"] });
    },
  });
}

function updateConnectionCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  status: FollowStatus,
) {
  queryClient.setQueriesData<{ pages: Array<{ users: ProfileConnectionUser[] }> }>(
    { queryKey: ["profile-connections"] },
    (data) => data ? {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        users: page.users.map((user) => user.id === userId ? { ...user, follow: { status } } : user),
      })),
    } : data,
  );
}

type ConnectionKind = "followers" | "following";
type ConnectionPage = { users: ProfileConnectionUser[]; nextCursor: string | null };

async function fetchConnections(userId: string, kind: ConnectionKind, cursor: string | null): Promise<ConnectionPage> {
  const params = new URLSearchParams({ limit: "20" });
  if (cursor) params.set("cursor", cursor);
  const response = await apiV1<{ users: ProfileConnectionUser[] }>(
    `/api/v1/profile/${encodeURIComponent(userId)}/${kind}?${params.toString()}`,
  );
  return {
    users: response.data.users,
    nextCursor: typeof response.meta.nextCursor === "string" ? response.meta.nextCursor : null,
  };
}

export function useProfileConnections(userId: string | undefined, kind: ConnectionKind, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: ["profile-connections", userId, kind],
    queryFn: ({ pageParam }) => fetchConnections(userId!, kind, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!userId && enabled,
  });
  return {
    ...query,
    users: query.data?.pages.flatMap((page) => page.users) ?? [],
  };
}

export function followButtonStatus(status: FollowStatus): "Follow" | "Following" | "Requested" {
  if (status === "ACCEPTED") return "Following";
  if (status === "PENDING") return "Requested";
  return "Follow";
}
