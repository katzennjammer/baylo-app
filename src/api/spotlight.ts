import { useQuery } from "@tanstack/react-query";

import { apiV1 } from "./client";

/**
 * GET /api/v1/organizations/spotlight — Home's Shop Spotlights.
 *
 * VERIFIED shops with something available, at most `cap` of them, in an
 * hourly rotation the server owns (the same one /featured uses). This renders
 * what it is given, in the order given.
 *
 * NOT A RANKING. The server draws the shops at random for the hour on
 * purpose; a list of shops ordered by merit is the deferred "Verified shops"
 * section, which does not exist yet.
 */
export interface SpotlightShop {
  id: string;
  /** The shop's backing account: its storefront is /user?id=<this>. */
  orgUserId: string;
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
  businessCategory: string;
  businessCategoryLabel: string;
  availableCount: number;
  /** Newest listing with a photo; the newest outright if none has one. */
  newestListing: {
    id: string;
    title: string;
    imageUrl: string | null;
    category: string;
    categoryLabel: string;
  } | null;
}

export const SPOTLIGHT_KEY = ["spotlight"] as const;

export function useShopSpotlight() {
  return useQuery({
    queryKey: SPOTLIGHT_KEY,
    queryFn: () => apiV1<{ shops: SpotlightShop[] }>("/api/v1/organizations/spotlight"),
    select: (r) => r.data.shops,
  });
}
