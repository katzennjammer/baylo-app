import { useInfiniteQuery } from "@tanstack/react-query";

import { apiV1 } from "./client";

export interface ProfileReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer: { id: string; name: string; avatar: string | null };
  item: {
    id: string;
    title: string;
    image: string | null;
    bracket: number | null;
  } | null;
}

export interface ProfileReviewsPayload {
  summary: {
    averageRating: number;
    totalReviews: number;
    trustTier: string | null;
  };
  reviews: ProfileReview[];
}

type ReviewsPage = {
  payload: ProfileReviewsPayload;
  nextCursor: string | null;
};

export const profileReviewsKey = (userId: string) => ["profile-reviews", userId] as const;

async function fetchReviews(userId: string, cursor: string | null): Promise<ReviewsPage> {
  const params = new URLSearchParams({ limit: "20" });
  if (cursor) params.set("cursor", cursor);
  const response = await apiV1<ProfileReviewsPayload>(
    `/api/v1/profile/${encodeURIComponent(userId)}/reviews?${params.toString()}`,
  );
  return {
    payload: response.data,
    nextCursor: typeof response.meta.nextCursor === "string" ? response.meta.nextCursor : null,
  };
}

export function useProfileReviews(userId: string | undefined, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: profileReviewsKey(userId ?? ""),
    queryFn: ({ pageParam }) => fetchReviews(userId!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!userId && enabled,
  });

  const pages = query.data?.pages ?? [];
  return {
    ...query,
    summary: pages[0]?.payload.summary ?? null,
    reviews: pages.flatMap((page) => page.payload.reviews),
  };
}
