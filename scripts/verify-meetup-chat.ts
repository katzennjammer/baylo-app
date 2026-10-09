/**
 * The meetup redesign and the chat card's status (Oct 2026), checked without a
 * phone:
 *
 *   node --require ./scripts/rn-stub.cjs --import tsx scripts/verify-meetup-chat.ts
 *
 *   1. meetupGap(): what the button says is missing, in order; a past time on
 *      today is refused; the 90-day ceiling; minute precision at "now".
 *   2. pickerStartTime(): 14:00, or the next hour once 14:00 has gone today.
 *   3. groupHubs(): suggestion first, shared next, the rest by city; distance
 *      order when given; search; no hub listed twice.
 *   4. chatTradeFor(): an offer_update's tradeId wins (a pre-v2 row whose ids
 *      differ); with none, the offer id itself is the trade id (schema v2).
 *   5. chatTradeChip(): every trade status maps to the trade screen's words.
 *   6. No hardcoded reward amount: the reward copy uses the number it is given.
 */
import type { ActiveTrade } from "../src/api/types";
import * as copy from "../src/components/trades/copy";
import { chatTradeChip, chatTradeFor } from "../src/components/trades/present";
import {
  MEETUP_MAX_DAYS_AHEAD,
  addDays,
  fullWhen,
  groupHubs,
  meetupGap,
  pickerStartTime,
  startOfDay,
} from "../src/lib/meetup-when";

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

/* 1. meetupGap */
{
  const now = new Date(2026, 9, 18, 20, 0, 40); // Sun 18 Oct 2026, 20:00:40
  const today = startOfDay(now);
  eq("no hub", meetupGap({ hubId: null, day: today, time: { h: 21, m: 0 }, now }), "hub");
  eq("no day", meetupGap({ hubId: "h", day: null, time: { h: 21, m: 0 }, now }), "day");
  eq("no time", meetupGap({ hubId: "h", day: today, time: null, now }), "time");
  eq("today, earlier", meetupGap({ hubId: "h", day: today, time: { h: 8, m: 0 }, now }), "past");
  eq("today, a minute ago", meetupGap({ hubId: "h", day: today, time: { h: 19, m: 59 }, now }), "past");
  eq("today, this minute", meetupGap({ hubId: "h", day: today, time: { h: 20, m: 0 }, now }), null);
  eq("today, later", meetupGap({ hubId: "h", day: today, time: { h: 21, m: 0 }, now }), null);
  eq("tomorrow, early", meetupGap({ hubId: "h", day: addDays(today, 1), time: { h: 6, m: 0 }, now }), null);
  eq("yesterday's plan", meetupGap({ hubId: "h", day: addDays(today, -1), time: { h: 22, m: 0 }, now }), "past");
  eq("day 90, earlier hour", meetupGap({ hubId: "h", day: addDays(today, MEETUP_MAX_DAYS_AHEAD), time: { h: 19, m: 0 }, now }), null);
  eq("day 90, later hour", meetupGap({ hubId: "h", day: addDays(today, MEETUP_MAX_DAYS_AHEAD), time: { h: 21, m: 0 }, now }), "tooFar");
  eq("day 91", meetupGap({ hubId: "h", day: addDays(today, MEETUP_MAX_DAYS_AHEAD + 1), time: { h: 9, m: 0 }, now }), "tooFar");
  eq("max days mirrors the API", MEETUP_MAX_DAYS_AHEAD, 90);
  eq("summary date", fullWhen(new Date(2026, 9, 18, 20, 0)), "Sun 18 Oct, 20:00");
  eq("summary line", copy.picker.summary(fullWhen(new Date(2026, 9, 18, 20, 0)), "Cebu North Bus Terminal"),
    "Sun 18 Oct, 20:00 at Cebu North Bus Terminal");
}

/* 2. pickerStartTime */
{
  const hm = (d: Date) => [d.getDate(), d.getHours(), d.getMinutes()];
  const morning = new Date(2026, 9, 18, 9, 30);
  eq("morning, today", hm(pickerStartTime(startOfDay(morning), morning)), [18, 14, 0]);
  const evening = new Date(2026, 9, 18, 20, 10);
  eq("evening, today", hm(pickerStartTime(startOfDay(evening), evening)), [18, 21, 0]);
  eq("evening, tomorrow", hm(pickerStartTime(addDays(startOfDay(evening), 1), evening)), [19, 14, 0]);
  eq("no day yet, evening", hm(pickerStartTime(null, evening)), [18, 21, 0]);
  const late = new Date(2026, 9, 18, 23, 20);
  eq("23:20 stays on the day", hm(pickerStartTime(startOfDay(late), late)), [18, 14, 0]);
}

/* 3. groupHubs */
{
  const hub = (id: string, name: string, city: string, d: number) => ({ id, name, city, typeLabel: "Mall", d });
  const hubs = [
    hub("a", "Ayala Center", "Cebu City", 3),
    hub("b", "Bus Terminal North", "Mandaue", 1),
    hub("c", "City Hall", "Cebu City", 2),
    hub("d", "Dock Police Station", "Lapu-Lapu", 9),
    hub("e", "Escario Hall", "Cebu City", 5),
    hub("f", "Fuente Mall", "", 4),
  ];
  const shared = new Set(["c", "e"]);
  const flat = (g: ReturnType<typeof groupHubs<(typeof hubs)[number]>>) =>
    g.map((x) => `${x.kind === "city" ? x.city : x.kind}:${x.hubs.map((h) => h.id).join("")}`);

  eq("by name, no location", flat(groupHubs({ hubs, shared, suggestedId: "b", km: null })),
    ["suggested:b", "shared:ce", "Cebu City:a", "Lapu-Lapu:d", "Other:f"]);
  eq("by distance", flat(groupHubs({ hubs, shared, suggestedId: null, km: (h) => h.d })),
    ["shared:ce", "Mandaue:b", "Cebu City:a", "Other:f", "Lapu-Lapu:d"]);
  eq("suggested that is also shared is listed once", flat(groupHubs({ hubs, shared, suggestedId: "e", km: null })),
    ["suggested:e", "shared:c", "Cebu City:a", "Lapu-Lapu:d", "Mandaue:b", "Other:f"]);
  eq("search by city", flat(groupHubs({ hubs, shared, suggestedId: "b", km: null, query: "  mandaue " })), ["suggested:b"]);
  eq("search by name", flat(groupHubs({ hubs, shared, suggestedId: null, km: null, query: "hall" })),
    ["shared:ce"]);
  eq("search, no match", groupHubs({ hubs, shared, suggestedId: null, km: null, query: "zzz" }).length, 0);
  const all = groupHubs({ hubs, shared, suggestedId: "c", km: (h) => h.d }).flatMap((g) => g.hubs.map((h) => h.id));
  eq("every hub exactly once", [...all].sort(), ["a", "b", "c", "d", "e", "f"]);
}

/* 4 + 5. chat card */
{
  const trade = (id: string, status: ActiveTrade["status"], agreed = false) =>
    ({ id, status, meetup: agreed ? { agreedAt: "2026-10-18T12:00:00Z" } : null }) as unknown as ActiveTrade;
  const byId = new Map<string, ActiveTrade>([
    ["offer-v2", trade("offer-v2", "ACCEPTED")],
    ["legacy-trade", trade("legacy-trade", "COMPLETED")],
  ]);
  eq("v2: offer id is the trade id", chatTradeFor("offer-v2", null, byId)?.id, "offer-v2");
  eq("v2: update names the same id", chatTradeFor("offer-v2", "offer-v2", byId)?.id, "offer-v2");
  eq("pre-v2: the update's tradeId wins", chatTradeFor("legacy-offer", "legacy-trade", byId)?.id, "legacy-trade");
  eq("pre-v2: never falls back to the offer id", chatTradeFor("offer-v2", "gone-trade", byId), null);
  eq("outside history: null, saved status applies", chatTradeFor("old-offer", null, byId), null);

  eq("PENDING", chatTradeChip(trade("t", "PENDING")), null);
  eq("ACCEPTED", chatTradeChip(trade("t", "ACCEPTED")), { label: "Accepted", tone: "green" });
  eq("ACCEPTED + agreed hub", chatTradeChip(trade("t", "ACCEPTED", true)), { label: "Hub set", tone: "green" });
  eq("CONFIRMING", chatTradeChip(trade("t", "CONFIRMING")), { label: "Handoff", tone: "green" });
  eq("COMPLETED", chatTradeChip(trade("t", "COMPLETED")), { label: "Done", tone: "green" });
  eq("REJECTED", chatTradeChip(trade("t", "REJECTED")), { label: "Declined", tone: "grey" });
  eq("CANCELLED", chatTradeChip(trade("t", "CANCELLED")), { label: "Cancelled", tone: "grey" });
}

/* 6. reward copy */
{
  eq("reward with amount", copy.picker.rewardBody(25).includes("each earn 25 Leaves"), true);
  eq("reward without amount", /\d/.test(copy.picker.rewardBody(null)), false);
}

console.log(failures === 0 ? `verify-meetup-chat: all ${checks} checks passed` : `verify-meetup-chat: ${failures} of ${checks} FAILED`);
if (failures > 0) (globalThis as { process?: { exitCode?: number } }).process!.exitCode = 1;
