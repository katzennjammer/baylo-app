/**
 * "Remove listing" in the edit sheet (Oct 2026), checked without a phone:
 *
 *   node --import tsx scripts/verify-listing-removal.ts
 *
 *   1. Blocked while the listing is in a trade: status IN_TRADE, or an active
 *      trade naming it on either side -- even before the trades list loads.
 *   2. Confirmed otherwise, with the pending-offer count when offers name it,
 *      as the listing offered on or as the item offered.
 *   3. Other people's listings in the payload do not count.
 *   4. Trades list unavailable: a confirm whose sentence is true either way.
 */
import type { TradesPayload } from "../src/api/types";
import { listingRemovalCheck } from "../src/lib/listing-removal";

let failures = 0;
let checks = 0;
function eq<T>(label: string, got: T, want: T) {
  checks++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) {
    failures++;
    console.log(`FAIL ${label}\n  got  ${a}\n  want ${b}`);
  }
}

type Active = Pick<TradesPayload, "trades" | "offers">;
const item = { id: "mine", status: "AVAILABLE" };
const brief = (id: string) => ({ id, title: id, image: null });
const trade = (requested: string, offered: string | null) =>
  ({ requestedItem: brief(requested), offeredItem: offered ? brief(offered) : null }) as unknown as Active["trades"][number];
const offer = (post: string, offered: string[]) =>
  ({ post: brief(post), offeredItems: offered.map((id) => ({ ...brief(id), valueLeaves: null })) }) as unknown as Active["offers"][number];
const none: Active = { trades: [], offers: [] };

// 1. Blocked
eq("IN_TRADE status", listingRemovalCheck({ id: "mine", status: "IN_TRADE" }, none).kind, "blocked");
eq("IN_TRADE before list loads", listingRemovalCheck({ id: "mine", status: "IN_TRADE" }, undefined).kind, "blocked");
eq("trade: requested side", listingRemovalCheck(item, { trades: [trade("mine", "x")], offers: [] }).kind, "blocked");
eq("trade: offered side", listingRemovalCheck(item, { trades: [trade("x", "mine")], offers: [] }).kind, "blocked");
eq("blocked title", listingRemovalCheck({ id: "mine", status: "IN_TRADE" }, none).title, "This listing is in a trade");

// 2. Confirm, with counts
eq("no offers", listingRemovalCheck(item, none), {
  kind: "confirm",
  title: "Remove this listing?",
  body: "It leaves the feed and the marketplace straight away.",
});
eq(
  "one offer on it",
  listingRemovalCheck(item, { trades: [], offers: [offer("mine", ["x"])] }).body,
  "There is 1 pending offer on it. Removed, that offer can no longer be accepted. It leaves the feed and the marketplace straight away.",
);
eq(
  "two offers: on it and offering it",
  listingRemovalCheck(item, { trades: [], offers: [offer("mine", ["x"]), offer("y", ["mine"])] }).body.startsWith(
    "There are 2 pending offers on it. Removed, those offers",
  ),
  true,
);

// 3. Other listings do not count
eq("others' trade", listingRemovalCheck(item, { trades: [trade("a", "b")], offers: [] }).kind, "confirm");
eq("others' offer", listingRemovalCheck(item, { trades: [], offers: [offer("a", ["b"])] }).body, "It leaves the feed and the marketplace straight away.");

// 4. List unavailable
const unknown = listingRemovalCheck(item, undefined);
eq("unknown: still confirms", unknown.kind, "confirm");
eq("unknown: hedged sentence", unknown.body.includes("If someone has offered on it"), true);

console.log(failures === 0 ? `verify-listing-removal: all ${checks} checks passed` : `verify-listing-removal: ${failures} of ${checks} FAILED`);
if (failures > 0) (globalThis as { process?: { exitCode?: number } }).process!.exitCode = 1;
