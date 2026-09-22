/**
 * Business-category labels, for the one surface that cannot fetch them.
 *
 * ── A HAND-KEPT COPY, AND THE HONEST WORD FOR IT ────────────────────────────
 *
 * GET /api/v1/organizations serves this vocabulary, and the registration form
 * uses that — correctly, because a shipped build that hard-codes eleven
 * categories has to go through the Play Store the day a twelfth is accepted.
 *
 * The listing detail screen cannot. It renders an organisation's category
 * under the owner's name from the item payload it already has, and calling a
 * second endpoint to turn one enum value into one label would be a request per
 * listing opened, for a subtitle. So the labels are duplicated here, and the
 * duplication is bounded by the fallback below rather than by hoping.
 *
 * Same arrangement, and the same trade, as CATEGORY_LABELS in src/api/post.ts
 * and CONDITIONS in src/api/browse.ts. Kept in step with
 * BUSINESS_CATEGORY_LABEL in the server's /api/v1/organizations route.
 */

const LABELS: Record<string, string> = {
  SARI_SARI: "Sari-sari store",
  FOOD_AND_BEVERAGE: "Food & beverage",
  AGRICULTURE: "Agriculture & farming",
  HANDICRAFT: "Handicraft",
  APPAREL: "Apparel",
  ELECTRONICS_REPAIR: "Electronics & repair",
  SERVICES: "Services",
  RETAIL: "Retail",
  COOPERATIVE: "Cooperative",
  NONPROFIT: "Non-profit",
  OTHER: "Other",
};

/**
 * The label, or a readable version of the raw value.
 *
 * THE FALLBACK IS THE POINT. A category added on the server before this build
 * shipped arrives here as an unknown key, and the alternatives are printing
 * "ELECTRONICS_REPAIR" under somebody's shop name or printing nothing. This
 * title-cases it instead, which is wrong in its details and right in its
 * shape — and it degrades quietly rather than looking like a bug.
 */
export function businessCategoryLabel(value: string): string {
  const known = LABELS[value];
  if (known) return known;
  return value
    .toLowerCase()
    .split("_")
    .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}
