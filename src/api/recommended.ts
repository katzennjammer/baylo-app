import { useQuery } from "@tanstack/react-query";

import { apiV1 } from "./client";
import type { Item } from "./types";

/**
 * GET /api/v1/recommended — Home's "Recommended for you".
 *
 * The server's hybrid scorer (see @/lib/recommend there): the viewer's
 * category interest from their trades, offers, likes and own listings, plus
 * 14-day popularity, plus a little recency. With no history it is popularity
 * alone, and `personalized` says so -- the section is titled from it, so a
 * shelf that is only "what is popular" is never labelled "for you".
 *
 * Each item carries `recommendation.reasonLabel`, the server's one line on
 * why it is here. The client shows it as given.
 */
export type RecommendationReason = "CATEGORY" | "POPULAR" | "NEW";

export type RecommendedItem = Item & {
  recommendation: {
    score: number;
    personal: number;
    popularity: number;
    recency: number;
    reason: RecommendationReason;
    reasonLabel: string;
  };
};

export interface RecommendedShelf {
  items: RecommendedItem[];
  personalized: boolean;
}

export const RECOMMENDED_KEY = ["recommended"] as const;

/**
 * A few more than the shelf shows: Home drops any that are also in Featured,
 * so the same listing is never on screen twice.
 */
const REQUEST_LIMIT = 14;

export function useRecommended() {
  return useQuery({
    queryKey: RECOMMENDED_KEY,
    queryFn: async (): Promise<RecommendedShelf> => {
      const { data, meta } = await apiV1<{ items: RecommendedItem[] }>(
        `/api/v1/recommended?limit=${REQUEST_LIMIT}`,
      );
      return { items: data.items, personalized: meta.personalized === true };
    },
  });
}
