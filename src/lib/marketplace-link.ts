import { CATEGORIES } from "../api/post";
import { CONDITIONS, MAX_CATEGORIES, type BrowseFilters } from "../api/browse";
import { isKnownBusinessCategory } from "./business-category";

/**
 * Opening Marketplace with a whole filter set applied.
 *
 * Home's links send `category` or `q` (see the arrival note in marketplace.tsx).
 * The search helper needs everything a person can set in Marketplace itself --
 * several categories, a bracket range, condition, the Organizations pill and
 * its shop types, perishable -- so it sends them as ONE JSON param, `filters`,
 * beside the same `applyAt` nonce the other links use.
 *
 * ── PARSED LIKE INPUT FROM OUTSIDE, BECAUSE IT IS ───────────────────────────
 *
 * A route param can come from anywhere a link can: a deep link, a stale
 * notification, an older build of this code. So parseMarketplaceFilters()
 * keeps only what /api/v1/browse would accept and drops the rest field by
 * field. A bad field is ignored, never a reason to show nothing: /browse
 * answers an unknown category with a 400, and a Marketplace that opens on an
 * error because one chip was misspelt is worse than one missing that chip.
 */

export const MARKETPLACE_FILTERS_PARAM = "filters";

/** The href for Marketplace with `filters` applied. Pass straight to router.push(). */
export function marketplaceWithFilters(filters: BrowseFilters) {
  // Only what is set, so the param stays short and readable in a deep link.
  const compact: Record<string, unknown> = {};
  if (filters.q?.trim()) compact.q = filters.q.trim();
  if (filters.categories?.length) compact.categories = [...filters.categories];
  if (filters.condition) compact.condition = filters.condition;
  if (filters.minLeaves != null) compact.minLeaves = filters.minLeaves;
  if (filters.maxLeaves != null) compact.maxLeaves = filters.maxLeaves;
  if (filters.orgsOnly) compact.orgsOnly = true;
  if (filters.orgsOnly && filters.businessCategories?.length) {
    compact.businessCategories = [...filters.businessCategories];
  }
  if (filters.perishable != null) compact.perishable = filters.perishable;

  return {
    pathname: "/(app)/marketplace" as const,
    params: { [MARKETPLACE_FILTERS_PARAM]: JSON.stringify(compact), applyAt: String(Date.now()) },
  };
}

const isLeafBound = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 2147483647;

/** The filters a `filters` param carries, sanitised; null when there are none. */
export function parseMarketplaceFilters(raw: string | undefined): BrowseFilters | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  const out: BrowseFilters = {};

  if (typeof d.q === "string" && d.q.trim()) out.q = d.q.trim().slice(0, 100);

  if (Array.isArray(d.categories)) {
    const known = d.categories.filter(
      (c): c is string => typeof c === "string" && (CATEGORIES as readonly string[]).includes(c),
    );
    const unique = [...new Set(known)].slice(0, MAX_CATEGORIES);
    if (unique.length) out.categories = unique;
  }

  if (typeof d.condition === "string" && CONDITIONS.some((c) => c.value === d.condition)) {
    out.condition = d.condition;
  }

  const min = isLeafBound(d.minLeaves) ? d.minLeaves : null;
  const max = isLeafBound(d.maxLeaves) ? d.maxLeaves : null;
  // An inverted range is a 400 at /browse; keep neither rather than guess.
  if (min === null || max === null || min <= max) {
    if (min !== null) out.minLeaves = min;
    if (max !== null) out.maxLeaves = max;
  }

  if (d.orgsOnly === true) {
    out.orgsOnly = true;
    if (Array.isArray(d.businessCategories)) {
      const known = d.businessCategories.filter(
        (c): c is string => typeof c === "string" && isKnownBusinessCategory(c),
      );
      const unique = [...new Set(known)];
      if (unique.length) out.businessCategories = unique;
    }
  }

  if (typeof d.perishable === "boolean") out.perishable = d.perishable;

  return out;
}
