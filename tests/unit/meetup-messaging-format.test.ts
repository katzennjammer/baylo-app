import assert from "node:assert/strict";

import { clockTime, compactCount, formatBadge, formatFollowers, formatLeaves, relativeLong, relativeShort } from "../../src/lib/format";
import { distanceKm, formatDistanceKm } from "../../src/lib/hub-distance";
import { combine, fullWhen, groupHubs, meetupGap, pickerStartTime, MEETUP_MAX_DAYS_AHEAD } from "../../src/lib/meetup-when";
import { countdownA11yLabel, formatCountdown, secondsLeft } from "../../src/lib/perishable";
import { collapseSystemPairs } from "../../src/lib/system-pairs";
import { withTimeout } from "../../src/lib/with-timeout";
import { suite } from "../support/case";

const meet = suite("Meetup Scheduling");
const msg = suite("Messaging");
const fmt = suite("Display Formatting");

// ── Meetup scheduling ───────────────────────────────────────────────────────
const NOW = new Date(2026, 5, 10, 15, 30); // 10 Jun 2026 15:30 local
const DAY = new Date(2026, 5, 12);
const TIME = { h: 14, m: 0 };

meet("Meetup Form", "User has not chosen a safe-zone hub", "First missing item is 'hub'", () => {
  assert.equal(meetupGap({ hubId: null, day: DAY, time: TIME, now: NOW }), "hub");
});
meet("Meetup Form", "User chose a hub but no day", "First missing item is 'day'", () => {
  assert.equal(meetupGap({ hubId: "h1", day: null, time: TIME, now: NOW }), "day");
});
meet("Meetup Form", "User chose a hub and day but no time", "First missing item is 'time'", () => {
  assert.equal(meetupGap({ hubId: "h1", day: DAY, time: null, now: NOW }), "time");
});
meet("Meetup Form", "User picks a time that already passed", "Meetup is refused as 'past'", () => {
  assert.equal(meetupGap({ hubId: "h1", day: new Date(2026, 5, 10), time: { h: 9, m: 0 }, now: NOW }), "past");
});
meet("Meetup Form", "User picks the current minute", "Meetup is allowed (not in the past)", () => {
  assert.equal(meetupGap({ hubId: "h1", day: new Date(2026, 5, 10), time: { h: 15, m: 30 }, now: NOW }), null);
});
meet("Meetup Form", `User picks a date more than ${MEETUP_MAX_DAYS_AHEAD} days ahead`, "Meetup is refused as 'tooFar'", () => {
  assert.equal(meetupGap({ hubId: "h1", day: new Date(2026, 11, 1), time: TIME, now: NOW }), "tooFar");
});
meet("Meetup Form", "User picks hub, day and a future time", "No gap; meetup can be proposed", () => {
  assert.equal(meetupGap({ hubId: "h1", day: DAY, time: TIME, now: NOW }), null);
});
meet("Meetup Form", "Day and time are combined", "One date at that local time", () => {
  const d = combine(DAY, { h: 9, m: 5 });
  assert.deepEqual([d.getDate(), d.getHours(), d.getMinutes()], [12, 9, 5]);
});
meet("Meetup Form", "A meetup time is displayed", "Shown as 'Fri 12 Jun, 14:00' style text", () => {
  assert.match(fullWhen(combine(DAY, TIME)), /^Fri .*14:00$/);
});
meet("Meetup Form", "Time picker opens before 2 PM", "It starts at 14:00", () => {
  const t = pickerStartTime(null, new Date(2026, 5, 10, 9, 0));
  assert.deepEqual([t.getHours(), t.getMinutes()], [14, 0]);
});
meet("Meetup Form", "Time picker opens at 3:30 PM the same day", "It starts at the next whole hour (16:00)", () => {
  const t = pickerStartTime(new Date(2026, 5, 10), NOW);
  assert.deepEqual([t.getHours(), t.getMinutes()], [16, 0]);
});

const hubs = [
  { id: "a", name: "Alpha Mall", city: "Mandaue", typeLabel: "Mall" },
  { id: "b", name: "Bravo Plaza", city: "Cebu", typeLabel: "Plaza" },
  { id: "c", name: "Charlie Hall", city: "Mandaue", typeLabel: "Hall" },
];
meet("Hub List", "User opens the hub list with a suggested and a shared hub", "Groups are ordered suggested, shared, then cities", () => {
  const g = groupHubs({ hubs, shared: new Set(["c"]), suggestedId: "a", km: null });
  assert.deepEqual(g.map((x) => x.kind), ["suggested", "shared", "city"]);
});
meet("Hub List", "User searches 'plaza'", "Only matching hubs are listed", () => {
  const g = groupHubs({ hubs, shared: new Set(), suggestedId: null, km: null, query: "plaza" });
  assert.deepEqual(g.flatMap((x) => x.hubs.map((h) => h.id)), ["b"]);
});
meet("Hub List", "User searches text that matches no hub", "The list is empty", () => {
  assert.deepEqual(groupHubs({ hubs, shared: new Set(), suggestedId: null, km: null, query: "zzz" }), []);
});
meet("Hub List", "Cities are listed without distance data", "Cities are alphabetical", () => {
  const g = groupHubs({ hubs, shared: new Set(), suggestedId: null, km: null });
  assert.deepEqual(g.map((x) => (x.kind === "city" ? x.city : "")), ["Cebu", "Mandaue"]);
});
meet("Distance", "User is at the hub's exact location", "Distance is 0 km", () => {
  assert.equal(distanceKm(10.3157, 123.8854, { latitude: 10.3157, longitude: 123.8854 } as never), 0);
});
meet("Distance", "Hub is one degree of longitude away on the equator", "Distance is about 111 km", () => {
  const km = distanceKm(0, 0, { latitude: 0, longitude: 1 } as never);
  assert.ok(Math.abs(km - 111.19) < 0.1, String(km));
});
meet("Distance", "Distance under 100 metres is displayed", "Shown as 'Nearby'", () => {
  assert.equal(formatDistanceKm(0.05), "Nearby");
});
meet("Distance", "Distances of 2.34 km and 42.6 km are displayed", "'2.3 km' and '43 km'", () => {
  assert.equal(formatDistanceKm(2.34), "2.3 km");
  assert.equal(formatDistanceKm(42.6), "43 km");
});

// ── Messaging ───────────────────────────────────────────────────────────────
const update = (senderId: string, status = "ACCEPTED") => ({ senderId, content: JSON.stringify({ type: "offer_update", offerId: "o1", status }) });
msg("System Messages", "Both traders' phones post the same offer update", "Only the partner's copy is shown", () => {
  const out = collapseSystemPairs([update("me"), update("partner")], "partner");
  assert.deepEqual(out.map((m) => m.senderId), ["partner"]);
});
msg("System Messages", "Offer goes ACCEPTED then COMPLETED", "Both different updates are kept", () => {
  assert.equal(collapseSystemPairs([update("me", "ACCEPTED"), update("me", "COMPLETED")], "partner").length, 2);
});
msg("System Messages", "Normal chat messages and invalid JSON", "They are never collapsed or lost", () => {
  const list = [{ senderId: "me", content: "hello" }, { senderId: "me", content: "hello" }, { senderId: "me", content: "{bad" }];
  assert.equal(collapseSystemPairs(list, "partner").length, 3);
});
msg("System Messages", "Trade-completed notice is posted twice", "One copy remains", () => {
  const done = (s: string) => ({ senderId: s, content: JSON.stringify({ type: "trade_completed", tradeId: "t1" }) });
  assert.equal(collapseSystemPairs([done("me"), done("partner")], "partner").length, 1);
});

// ── Formatting ──────────────────────────────────────────────────────────────
fmt("Leaves Balance", "Balance is 1240", "Shown with a comma: 1,240", () => assert.equal(formatLeaves(1240), "1,240"));
fmt("Leaves Balance", "Balance is 99,999", "Still grouped: 99,999", () => assert.equal(formatLeaves(99999), "99,999"));
fmt("Leaves Balance", "Balance is 99,960 or 128,500", "Compact and truncated, never rounded up (99,960 stays; 128.5k)", () => {
  assert.equal(formatLeaves(99960), "99,960");
  assert.equal(formatLeaves(128500), "128.5k");
});
fmt("Leaves Balance", "Balance is negative or 2,400,000", "Never below 0; millions use M", () => {
  assert.equal(formatLeaves(-5), "0");
  assert.equal(formatLeaves(2_400_000), "2.4M");
});
fmt("Counts", "Follower counts 1, 950, 1,999 and 12,000", "'1 follower', '950 followers', '1.9K followers', '12K followers'", () => {
  assert.deepEqual([1, 950, 1999, 12000].map(formatFollowers), ["1 follower", "950 followers", "1.9K followers", "12K followers"]);
});
fmt("Counts", "Compact count of 3,400,000", "'3.4M'", () => assert.equal(compactCount(3_400_000), "3.4M"));
fmt("Counts", "Unread badge of 5 and 150", "'5' and '99+'", () => {
  assert.equal(formatBadge(5), "5");
  assert.equal(formatBadge(150), "99+");
});
fmt("Time Ago", "Message sent 30 seconds ago", "'now'", () => {
  const now = Date.parse("2026-06-10T12:00:30Z");
  assert.equal(relativeShort("2026-06-10T12:00:00Z", now), "now");
});
fmt("Time Ago", "Message sent 5 minutes, 3 hours and 2 days ago", "'5m ago', '3h ago', '2d ago'", () => {
  const now = Date.parse("2026-06-10T12:00:00Z");
  assert.equal(relativeShort("2026-06-10T11:55:00Z", now), "5m ago");
  assert.equal(relativeShort("2026-06-10T09:00:00Z", now), "3h ago");
  assert.equal(relativeShort("2026-06-08T12:00:00Z", now), "2d ago");
});
fmt("Time Ago", "Timestamp is not a valid date", "Empty text instead of 'NaN'", () => assert.equal(relativeShort("garbage"), ""));
fmt("Time Ago", "Long form for 1 hour, 2 hours and 1 day", "'1 hour ago', '2 hours ago', '1 day ago'", () => {
  const now = 10 * 24 * 3600_000;
  assert.equal(relativeLong(now - 3600_000, now), "1 hour ago");
  assert.equal(relativeLong(now - 7200_000, now), "2 hours ago");
  assert.equal(relativeLong(now - 86400_000, now), "1 day ago");
});
fmt("Time Ago", "Clock time at 9:05 local", "'09:05' in 24-hour format", () => {
  assert.equal(clockTime(new Date(2026, 5, 10, 9, 5).getTime()), "09:05");
});
fmt("Perishable Countdown", "Window ends 3 seconds from now", "secondsLeft is 3", () => {
  assert.equal(secondsLeft("2026-06-10T12:00:03Z", Date.parse("2026-06-10T12:00:00Z") / 1000), 3);
});
fmt("Perishable Countdown", "Window already ended or date is invalid", "secondsLeft is 0, never negative", () => {
  assert.equal(secondsLeft("2026-06-10T11:00:00Z", Date.parse("2026-06-10T12:00:00Z") / 1000), 0);
  assert.equal(secondsLeft("nope", 0), 0);
});
fmt("Perishable Countdown", "5h 12m 44s and 1d 14h 22m 5s remain", "'05:12:44' and '1d 14:22:05'", () => {
  assert.equal(formatCountdown(5 * 3600 + 12 * 60 + 44), "05:12:44");
  assert.equal(formatCountdown(86400 + 14 * 3600 + 22 * 60 + 5), "1d 14:22:05");
});
fmt("Perishable Countdown", "Screen reader reads 0, 30 s, 1 h 1 m, 1 d", "'Ended', 'less than a minute', '1 hour 1 minute', '1 day'", () => {
  assert.equal(countdownA11yLabel(0), "Ended");
  assert.equal(countdownA11yLabel(30), "Ends in less than a minute");
  assert.equal(countdownA11yLabel(3660), "Ends in 1 hour 1 minute");
  assert.equal(countdownA11yLabel(86400), "Ends in 1 day");
});
fmt("Timeout Helper", "Operation finishes before the limit", "Its value is returned", async () => {
  assert.equal(await withTimeout(new Promise((r) => setTimeout(() => r("ok"), 5)), 200), "ok");
});
fmt("Timeout Helper", "Operation is slower than the limit", "null is returned instead of waiting forever", async () => {
  assert.equal(await withTimeout(new Promise((r) => setTimeout(() => r("late"), 200)), 10), null);
});
fmt("Timeout Helper", "Operation fails before the limit", "The original error is passed on", async () => {
  await assert.rejects(withTimeout(Promise.reject(new Error("denied")), 200), /denied/);
});
