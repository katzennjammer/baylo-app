import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiV1, request } from "./client";
import type { BrowsePayload, FollowStatus, ProfileConnectionUser, ProfileMePayload, PublicProfilePayload } from "./types";

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
      patchCachedProfile(queryClient, userId, "ACCEPTED");
      updateConnectionCaches(queryClient, userId, "ACCEPTED");
      updateBrowseOrgCaches(queryClient, userId, "ACCEPTED");
    },
    onError: (_error, { userId }) => {
      // The status flags on every connections list this patched; the count
      // and the followee's own list are re-read in onSettled.
      void queryClient.invalidateQueries({ queryKey: ["profile-connections"] });
      updateBrowseOrgCaches(queryClient, userId, "NONE");
    },
    // Success or not: the server's count and the followee's follower list are
    // the truth the optimistic patch guessed at. The list has to be refetched
    // rather than patched -- a new follower is a row it does not have yet.
    onSettled: (_data, _error, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      void queryClient.invalidateQueries({ queryKey: ["profile-connections", userId] });
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
      patchCachedProfile(queryClient, userId, "NONE");
      updateConnectionCaches(queryClient, userId, "NONE");
      updateBrowseOrgCaches(queryClient, userId, "NONE");
    },
    onError: (_error, { userId }) => {
      // The status flags on every connections list this patched; the count
      // and the followee's own list are re-read in onSettled.
      void queryClient.invalidateQueries({ queryKey: ["profile-connections"] });
      updateBrowseOrgCaches(queryClient, userId, "ACCEPTED");
    },
    // Success or not: the server's count and the followee's follower list are
    // the truth the optimistic patch guessed at. The list has to be refetched
    // rather than patched -- a new follower is a row it does not have yet.
    onSettled: (_data, _error, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      void queryClient.invalidateQueries({ queryKey: ["profile-connections", userId] });
    },
  });
}

/**
 * The optimistic half of follow / unfollow on a profile that is on screen.
 *
 * THE CACHE HOLDS THE ENVELOPE, NOT THE PAYLOAD. usePublicProfile() stores
 * apiV1()'s `{ data, meta }` and unwraps it with `select`, and `select` only
 * shapes what the screen reads -- setQueryData sees the raw entry. From 16 Sep
 * 2026 (3b83e43) until this was fixed, the updaters here read
 * `profile.counts.followers` off the envelope, threw inside onMutate, and so
 * the POST was never sent: every Follow tap on a profile silently rolled back
 * to "Follow" and the old count. The type parameter below is the real shape so
 * that drift is a compile error next time.
 *
 * Moving from "not ACCEPTED" to ACCEPTED is +1, the reverse -1; anything else
 * leaves the count alone, so a double tap cannot count twice.
 */
function patchCachedProfile(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  status: FollowStatus,
) {
  queryClient.setQueryData<{ data: PublicProfilePayload; meta: Record<string, unknown> }>(
    ["profile", userId],
    (entry) => {
      if (!entry) return entry;
      const profile = entry.data;
      const was = profile.follow.status;
      if (was === status) return entry;
      const delta = status === "ACCEPTED" ? 1 : was === "ACCEPTED" ? -1 : 0;
      return {
        ...entry,
        data: {
          ...profile,
          counts: { ...profile.counts, followers: Math.max(0, profile.counts.followers + delta) },
          follow: { ...profile.follow, status },
        },
      };
    },
  );
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

/**
 * The search results' shop cards carry the viewer's follow state too, so a
 * follow from the storefront shows on the card when you come back, and one
 * from the card shows on the storefront. `userId` is the shop's backing
 * account, which is what a card's `orgUserId` is.
 */
function updateBrowseOrgCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  status: FollowStatus,
) {
  queryClient.setQueriesData<{ pages: Array<{ payload: BrowsePayload }> }>(
    { queryKey: ["browse"] },
    (data) => data ? {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        payload: {
          ...page.payload,
          organizations: page.payload.organizations?.map((org) => {
            if (org.orgUserId !== userId || org.follow === status) return org;
            const delta = status === "ACCEPTED" ? 1 : org.follow === "ACCEPTED" ? -1 : 0;
            return { ...org, follow: status, followers: org.followers === undefined ? undefined : Math.max(0, org.followers + delta) };
          }),
        },
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

/**
 * The text on a follow button. `followButtonStatus` is the state (it drives
 * the button's styling and what a tap does); this adds the one case that is
 * wording only: they follow you and you do not follow them → "Follow Back".
 * A tap still just follows. Shared by the profile screen and the connections
 * list so the two cannot drift again — the profile used to ignore `followsYou`.
 */
export function followButtonLabel(
  status: FollowStatus,
  followsYou: boolean,
): "Follow" | "Follow Back" | "Following" | "Requested" {
  const label = followButtonStatus(status);
  return label === "Follow" && followsYou ? "Follow Back" : label;
}
