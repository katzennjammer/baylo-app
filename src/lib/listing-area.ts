import type { Item } from "../api/types";

/**
 * Where a listing is, in a card's few characters: "Lapu-Lapu", "Mandaue".
 *
 * IN ORDER OF PREFERENCE (30 Sep 2026):
 *
 *   1. The listing's Safe Zone hub city -- where the owner said they would
 *      meet. Every hub-bearing listing on live has exactly one hub; if a
 *      listing ever has several, the first active one is used (the server
 *      sorts active first).
 *   2. The seller's profile location -- free text the seller typed, almost
 *      always a city.
 *   3. Nothing: the card shows the condition alone.
 *
 * `item.safeZones` is NULL when the endpoint did not load hubs, which is
 * /browse today; the card then falls through to (2). An approved API change
 * that adds hubs to /browse makes (1) light up with no client change.
 *
 * SHORT FORM: a trailing " City" is dropped ("Lapu-Lapu City" -> "Lapu-Lapu"),
 * for hubs and seller text alike, so two cards in the same place read the
 * same whichever source they came from. The full hub name stays on the
 * listing screen.
 */
export function listingArea(item: Pick<Item, "safeZones" | "owner">): string | null {
  const hubs = item.safeZones;
  if (hubs && hubs.length > 0) {
    const hub = hubs.find((h) => h.isActive) ?? hubs[0];
    const city = shortPlace(hub.city);
    if (city) return city;
  }
  return shortPlace(item.owner.location);
}

function shortPlace(raw: string | null | undefined): string | null {
  const s = raw?.trim().replace(/\s+city$/i, "").trim();
  return s ? s : null;
}
