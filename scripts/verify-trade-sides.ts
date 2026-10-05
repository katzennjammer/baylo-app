/**
 * The give/get refactor (src/lib/trade-sides.ts) must not change what any
 * screen shows. This runs the PRE-REFACTOR logic, frozen below verbatim, and
 * the real exports side by side on the same inputs and fails on any difference.
 *
 *   node --require ./scripts/rn-stub.cjs --import tsx scripts/verify-trade-sides.ts [fixtures.json]
 *
 * Inputs: a synthetic matrix (sent/received × item-for-item, Leaves-only,
 * item + Leaves, multi-item offers, unvalued items, odd chat payloads), plus,
 * when a fixtures file is passed, every Trade row and every offer chat message
 * from a read-only dump of live, from BOTH viewers' sides.
 */
import type { ActiveTrade, LiveOffer } from "../src/api/types";
import { offerSwapLine, swapLine } from "../src/api/trades";
import * as copy from "../src/components/trades/copy";
import * as present from "../src/components/trades/present";
import type { CardSide } from "../src/components/trades/present";
import * as payloads from "../src/components/messages/MessagePayloads";
import { bracketLabel, bracketOf } from "../src/lib/brackets";
import { grouped } from "../src/lib/gap";

// The app's tsconfig has no Node types (this repo ships to a phone), so the one
// Node API this script uses is declared here rather than adding @types/node.
declare function require(id: "node:fs"): { readFileSync(path: string, encoding: "utf8"): string };
const { readFileSync } = require("node:fs");

/* ───────────── the old logic, frozen verbatim from before the refactor ───────────── */

function OLD_sideOf(item: { title: string; image: string | null } | null, leaves: number | null): CardSide {
  const n = leaves ?? 0;
  if (item && n > 0) {
    return { image: item.image, title: copy.tradeCard.itemPlusLeaves(item.title, n), leaves: false };
  }
  if (item) return { image: item.image, title: item.title, leaves: false };
  if (n > 0) return { image: null, title: copy.tradeCard.leaves(n), leaves: true };
  return { image: null, title: copy.tradeCard.unnamed, leaves: false };
}

function OLD_tradeSides(trade: ActiveTrade): { give: CardSide; get: CardSide } {
  const senderSide = OLD_sideOf(trade.offeredItem, trade.offeredLeaves);
  const receiverSide = OLD_sideOf(trade.requestedItem, null);
  return trade.direction === "sent"
    ? { give: senderSide, get: receiverSide }
    : { give: receiverSide, get: senderSide };
}

function OLD_offerSides(offer: LiveOffer): { give: CardSide; get: CardSide } {
  const [first, ...rest] = offer.offeredItems;
  const offered = OLD_sideOf(first ?? null, offer.offeredLeaves);
  const offeredSide =
    first && rest.length > 0 && !(offer.offeredLeaves && offer.offeredLeaves > 0)
      ? { ...offered, title: copy.tradeCard.itemPlusMore(first.title, rest.length) }
      : offered;
  const post = OLD_sideOf(offer.post, null);
  return offer.direction === "sent"
    ? { give: offeredSide, get: post }
    : { give: post, get: offeredSide };
}

function OLD_bracketed(item: { title: string; valueLeaves: number | null }): string {
  return item.valueLeaves === null
    ? item.title
    : `${item.title} · ${bracketLabel(bracketOf(item.valueLeaves))}`;
}

function OLD_swapLine(trade: ActiveTrade): string {
  const sent = trade.direction === "sent";
  const mineItem = sent ? trade.offeredItem : trade.requestedItem;
  const theirsItem = sent ? trade.requestedItem : trade.offeredItem;
  if (trade.kind === "leaves") {
    const leaves = trade.offeredLeaves ?? 0;
    const side = leaves > 0 ? `${grouped(leaves)} Leaves` : "Leaves";
    return sent
      ? `Your ${side} for ${OLD_bracketed(trade.requestedItem)}`
      : `Their ${side} for your ${OLD_bracketed(trade.requestedItem)}`;
  }
  const mine = mineItem ? OLD_bracketed(mineItem) : null;
  const theirs = theirsItem ? OLD_bracketed(theirsItem) : null;
  if (mine && theirs) return sent ? `Your ${mine} for ${theirs}` : `Their ${theirs} for your ${mine}`;
  return mine ? `Your ${mine}` : theirs ? `Their ${theirs}` : "";
}

function OLD_offerSwapLine(offer: LiveOffer): string {
  const offered = offer.offeredItems[0] ?? null;
  if (offer.direction === "sent") {
    const mine = offered ? OLD_bracketed(offered) : "your item";
    return `Your ${mine} for ${OLD_bracketed(offer.post)}`;
  }
  const theirs = offered ? OLD_bracketed(offered) : "their item";
  return `Their ${theirs} for your ${OLD_bracketed(offer.post)}`;
}

/** MessagePayloads.tsx's inline `case "offer":` fallback, as it stood. */
function OLD_chatFallback(parsed: Record<string, any>, mine: boolean): { give: CardSide; get: CardSide } {
  const offeredItems = Array.isArray(parsed.offeredItems) ? parsed.offeredItems : [];
  const firstOffered = offeredItems.find(
    (item: unknown): item is { title: string; imageUrl?: unknown } =>
      typeof item === "object" && !!item && "title" in item && typeof (item as any).title === "string",
  );
  const offeredLeaves = typeof parsed.offeredLeaves === "number" ? parsed.offeredLeaves : 0;
  const postTitle = typeof parsed.postItem === "string"
    ? parsed.postItem
    : typeof parsed.postItem === "object" && parsed.postItem && "title" in parsed.postItem && typeof parsed.postItem.title === "string"
      ? parsed.postItem.title
      : copy.tradeCard.unnamed;
  const postImage = typeof parsed.postItem === "object" && parsed.postItem && "imageUrl" in parsed.postItem && typeof parsed.postItem.imageUrl === "string"
    ? parsed.postItem.imageUrl
    : null;
  const offeredSide: CardSide = firstOffered
    ? {
        image: typeof firstOffered.imageUrl === "string" ? firstOffered.imageUrl : null,
        title: offeredLeaves > 0
          ? copy.tradeCard.itemPlusLeaves(firstOffered.title, offeredLeaves)
          : offeredItems.length > 1
            ? copy.tradeCard.itemPlusMore(firstOffered.title, offeredItems.length - 1)
            : firstOffered.title,
        leaves: false,
      }
    : offeredLeaves > 0
      ? { image: null, title: copy.tradeCard.leaves(offeredLeaves), leaves: true }
      : { image: null, title: copy.tradeCard.unnamed, leaves: false };
  const postSide: CardSide = { image: postImage, title: postTitle, leaves: false };
  return mine ? { give: offeredSide, get: postSide } : { give: postSide, get: offeredSide };
}

/* ───────────────────────────── inputs ───────────────────────────── */

type Item = { id: string; title: string; image: string | null; valueLeaves: number | null };
const item = (id: string, title: string, valueLeaves: number | null): Item => ({ id, title, image: `img:${id}`, valueLeaves });

function trade(label: string, direction: "sent" | "received", status: string, offered: Item | null, requested: Item, leaves: number | null): [string, ActiveTrade] {
  return [`${label} [${direction}, ${status}]`, {
    id: label, status, direction,
    kind: (leaves ?? 0) > 0 ? "leaves" : "items",
    offeredLeaves: leaves, bridgeFeeLeaves: null, bridgeFeePaidBySender: null,
    counterparty: { id: "cp", name: "Vinsento Cruz", image: null },
    myReview: null, receivedReview: null, rewardLeaves: null,
    codesMatchedAt: status === "COMPLETED" ? "2026-10-01T09:00:00.000Z" : null,
    offeredItem: offered, requestedItem: requested,
    safeZoneMeetup: false, safeZoneHub: null, meetup: null,
    canConfirm: false, codesLive: false, codesExpireAt: null,
    createdAt: "2026-09-30T09:00:00.000Z", updatedAt: "2026-10-01T09:00:00.000Z",
  } as unknown as ActiveTrade];
}

function offer(label: string, direction: "sent" | "received", offeredItems: Item[], post: Item, leaves: number | null): [string, LiveOffer] {
  return [`${label} [${direction}]`, {
    id: label, direction, status: "PENDING", post, offeredItems, offeredLeaves: leaves, message: null,
    counterparty: { id: "cp", name: "Vinsento Cruz", image: null },
    offeredBracket: null, targetBracket: null, bridgeFeeLeaves: null, bridgeFeePayer: null,
    createdAt: "2026-09-30T09:00:00.000Z",
  } as unknown as LiveOffer];
}

const fan = item("fan", "Cooling Fan", 900), ice = item("ice", "Ice cream", 120);
const vans = item("vans", "Vans", 440), cap = item("cap", "Cap", null), mug = item("mug", "Mug", 50);

const trades: [string, ActiveTrade][] = [];
const offers: [string, LiveOffer][] = [];
const chats: [string, Record<string, any>, boolean][] = [];

for (const dir of ["sent", "received"] as const) {
  for (const status of ["PENDING", "ACCEPTED", "CONFIRMING", "COMPLETED", "REJECTED", "CANCELLED"]) {
    trades.push(trade("item-for-item", dir, status, fan, ice, null));
    trades.push(trade("leaves-only", dir, status, null, ice, 300));
    trades.push(trade("item+leaves", dir, status, vans, fan, 40));
    trades.push(trade("unvalued", dir, status, cap, mug, null));
    trades.push(trade("nothing-offered", dir, status, null, ice, null));
  }
  offers.push(offer("item-for-item", dir, [fan], ice, null));
  offers.push(offer("leaves-only", dir, [], ice, 300));
  offers.push(offer("item+leaves", dir, [vans], fan, 40));
  offers.push(offer("multi-item", dir, [vans, cap, mug], fan, null));
  offers.push(offer("multi-item+leaves", dir, [vans, cap], fan, 25));
  offers.push(offer("unvalued", dir, [cap], mug, null));
  offers.push(offer("nothing-offered", dir, [], ice, null));
}
const chatPayloads: [string, Record<string, any>][] = [
  ["item-for-item", { type: "offer", offeredItems: [{ id: "fan", title: "Cooling Fan", imageUrl: "u:fan" }], postItem: { title: "Ice cream", imageUrl: "u:ice" }, offeredLeaves: null }],
  ["leaves-only", { type: "offer", offeredItems: [], postItem: { title: "Ice cream" }, offeredLeaves: 300 }],
  ["item+leaves", { type: "offer", offeredItems: [{ id: "v", title: "Vans" }], postItem: { title: "Fan" }, offeredLeaves: 40 }],
  ["multi-item", { type: "offer", offeredItems: [{ id: "v", title: "Vans" }, { id: "c", title: "Cap" }, { id: "m", title: "Mug" }], postItem: { title: "Fan" } }],
  ["string postItem", { type: "offer", offeredItems: [{ id: "v", title: "Vans" }], postItem: "Old listing" }],
  ["no postItem, junk items", { type: "offer", offeredItems: [null, 3, { id: "x" }, { id: "v", title: "Vans" }] }],
  ["empty", { type: "offer" }],
];
for (const [label, p] of chatPayloads) for (const mine of [true, false]) chats.push([label, p, mine]);

const fixtures = process.argv[2];
let liveTrades = 0, liveMsgs = 0;
if (fixtures) {
  const dump = JSON.parse(readFileSync(fixtures, "utf8")) as {
    trades: { id: string; cls: string; status: string | null; offerStatus: string | null; offeredLeaves: number | null; offeredItemId: string | null; requestedItemId: string; o_title: string | null; o_value: number | null; r_title: string; r_value: number | null }[];
    msgs: { id: string; content: string }[];
  };
  for (const r of dump.trades) {
    const requested = item(r.requestedItemId, r.r_title, r.r_value);
    // What the v1 route sends: a Leaves placeholder (offered id == requested id) goes out as null.
    const offered = r.offeredItemId && r.offeredItemId !== r.requestedItemId ? item(r.offeredItemId, r.o_title!, r.o_value) : null;
    const label = `live ${r.cls} ${r.id}`;
    for (const dir of ["sent", "received"] as const) {
      trades.push(trade(label, dir, r.status ?? `offer:${r.offerStatus}`, offered, requested, r.offeredLeaves));
      offers.push(offer(label, dir, offered ? [offered] : [], requested, r.offeredLeaves));
    }
    liveTrades++;
  }
  for (const m of dump.msgs) {
    for (const mine of [true, false]) chats.push([`live msg ${m.id}`, JSON.parse(m.content), mine]);
    liveMsgs++;
  }
}

/* ───────────────────────────── compare ───────────────────────────── */

let checks = 0;
const failures: string[] = [];
function same(what: string, oldValue: unknown, newValue: unknown) {
  checks++;
  const a = JSON.stringify(oldValue), b = JSON.stringify(newValue);
  if (a !== b) failures.push(`${what}\n    old ${a}\n    new ${b}`);
}

const clock = () => "09:00";
for (const [label, t] of trades) {
  const old = OLD_tradeSides(t);
  same(`tradeSides ${label}`, old, present.tradeSides(t));
  same(`swapLine ${label}`, OLD_swapLine(t), swapLine(t));
  const fin = present.finishedRowWords(t, clock);
  same(`finishedRowWords ${label}`, old, { give: fin.give, get: fin.get });
  const wait = present.waitingCard({ kind: "trade", trade: t } as any);
  same(`waitingCard ${label}`, old, { give: wait.give, get: wait.get });
  const move = present.yourMoveCard({ kind: "trade-request", trade: t } as any);
  same(`yourMoveCard ${label}`, old, { give: move.give, get: move.get });
}
for (const [label, o] of offers) {
  const old = OLD_offerSides(o);
  same(`offerSides ${label}`, old, present.offerSides(o));
  same(`offerSwapLine ${label}`, OLD_offerSwapLine(o), offerSwapLine(o));
  const wait = present.waitingCard({ kind: "sent-offer", offer: o } as any);
  same(`waitingCard(offer) ${label}`, old, { give: wait.give, get: wait.get });
  const move = present.yourMoveCard({ kind: "offer", offer: o } as any);
  same(`yourMoveCard(offer) ${label}`, old, { give: move.give, get: move.get });
}
// The chat fallback was inline JSX; the refactor exports it as offerPayloadSides().
const chatSides = (payloads as { offerPayloadSides?: (p: Record<string, any>, mine: boolean) => unknown }).offerPayloadSides;
for (const [label, p, mine] of chats) {
  if (chatSides) same(`chat fallback ${label} [mine=${mine}]`, OLD_chatFallback(p, mine), chatSides(p, mine));
}

console.log(
  `${checks} comparisons: ${trades.length} trade views, ${offers.length} offer views, ` +
    `${chatSides ? chats.length : 0} chat payload views` +
    (fixtures ? ` (live: ${liveTrades} Trade rows × 2 viewers, ${liveMsgs} offer messages × 2)` : " (no live fixtures)") +
    (chatSides ? "" : "; chat fallback SKIPPED, offerPayloadSides not exported yet"),
);
if (failures.length) {
  console.error(`\nFAIL: ${failures.length} difference(s)\n  ${failures.slice(0, 20).join("\n  ")}`);
  process.exit(1);
}
console.log("PASS: old and new agree exactly");
