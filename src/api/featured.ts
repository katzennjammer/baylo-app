import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiV1 } from "./client";
import { ORGANIZATIONS_KEY } from "./organizations";
import { PROFILE_ME_KEY } from "./profile";
import type { Item } from "./types";

/**
 * Featured boosts: GET /api/v1/featured and POST /api/v1/items/[id]/boost.
 *
 * Mirrors of the server's BOOST_COST_LEAVES / BOOST_HOURS / FEATURED_VISIBLE_CAP
 * in @/lib/featured. Hand-kept, like CONDITIONS in browse.ts: they are copy on
 * the confirmation dialog, and the server charges what it charges regardless.
 */
export const BOOST_COST_LEAVES = 2;
export const BOOST_HOURS = 24;
export const FEATURED_VISIBLE_CAP = 8;

export const featuredKey = (category: string) => ["featured", category] as const;

/**
 * One category's Featured section: at most FEATURED_VISIBLE_CAP items, newest
 * boost first. The cap and the order are the server's; this renders what it
 * gets. Disabled for a null category (Exclusive mode), so the hook can sit
 * unconditionally at the top of the screen.
 */
export function useFeatured(category: string | null) {
  return useQuery({
    queryKey: featuredKey(category ?? ""),
    queryFn: () =>
      apiV1<{ items: Item[] }>(`/api/v1/featured?category=${encodeURIComponent(category!)}`),
    enabled: !!category,
    select: (r) => r.data.items,
  });
}

/**
 * Whether `item` can be boosted by its owner right now. The server re-checks
 * every one of these inside the charging transaction; this only decides
 * whether to draw the button.
 */
export function canBoost(item: Item): boolean {
  return (
    item.status === "AVAILABLE" &&
    item.perishable == null && // undefined from a server without perishables
    !item.hiddenByModerator &&
    item.featuredUntil === null
  );
}

export interface BoostResult {
  itemId: string;
  featuredAt: string;
  featuredUntil: string;
  cost: number;
  /** The owner's Leaf balance after the charge. */
  balance: number;
}

/**
 * Pay BOOST_COST_LEAVES to feature a listing for BOOST_HOURS.
 *
 * NOT RETRIED. A 409 `already_featured` after a lost response means the first
 * attempt went through; the server never charges twice, and the refetch on
 * settle is what shows the listing as featured either way.
 */
export function useBoostItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const r = await apiV1<BoostResult>(`/api/v1/items/${encodeURIComponent(itemId)}/boost`, {
        method: "POST",
      });
      return r.data;
    },
    onSettled: (_data, _error, itemId) => {
      // The balance lives in useHome() (AppHeader) and profile/me; the badge
      // on the listing lives in the item and every list that carries it.
      void qc.invalidateQueries({ queryKey: ["home"] });
      void qc.invalidateQueries({ queryKey: PROFILE_ME_KEY });
      // A shop's listing is paid for from the shop's balance, which the switcher
      // and the storefront read from the organisations list.
      void qc.invalidateQueries({ queryKey: ORGANIZATIONS_KEY });
      void qc.invalidateQueries({ queryKey: ["item", itemId] });
      void qc.invalidateQueries({ queryKey: ["featured"] });
      void qc.invalidateQueries({ queryKey: ["browse"] });
    },
  });
}
