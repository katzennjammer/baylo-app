import { shortDate } from "./gap";

/**
 * The meetup picker's date and time rules, kept apart from the screen so
 * scripts/verify-meetup-picker.ts can run them without React Native.
 *
 * NONE OF THIS REPLACES THE SERVER'S CHECK. POST /api/v1/trades/[id]/meetup
 * still refuses a time more than 15 minutes past and one more than 90 days
 * ahead. The app blocks the same two mistakes earlier, before a round trip,
 * and a little stricter on the past side (no slack): "earlier than now" is
 * what a person reads on the button.
 */

/**
 * How far ahead a meeting may be arranged. MIRRORS the server's
 * `MAX_DAYS_AHEAD` in baylo/src/app/api/v1/trades/[id]/meetup/route.ts — the
 * API does not send it, so if that constant changes, change this one too.
 */
export const MEETUP_MAX_DAYS_AHEAD = 90;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type ClockTime = { h: number; m: number };

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function clock(t: ClockTime): string {
  return `${String(t.h).padStart(2, "0")}:${String(t.m).padStart(2, "0")}`;
}

/** The instant a chosen day and time name, in the phone's timezone. */
export function combine(day: Date, time: ClockTime): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.h, time.m);
}

/**
 * `Sun 18 Oct, 20:00` — always the full date, never "Today". The summary line
 * is the last look before sending, and the weekday plus the date is the half
 * that catches a wrong pick.
 */
export function fullWhen(at: Date): string {
  return `${WEEKDAYS[at.getDay()]} ${shortDate(at)}, ${clock({ h: at.getHours(), m: at.getMinutes() })}`;
}

/**
 * What is still missing, in the order the screen asks for it, or null when the
 * suggestion can be sent. The button's label is this, worded.
 */
export type MeetupGap = "hub" | "day" | "time" | "past" | "tooFar";

export function meetupGap({
  hubId,
  day,
  time,
  now,
}: {
  hubId: string | null;
  day: Date | null;
  time: ClockTime | null;
  now: Date;
}): MeetupGap | null {
  if (!hubId) return "hub";
  if (!day) return "day";
  if (!time) return "time";
  const at = combine(day, time);
  // Minute precision: the picker has no seconds, so 20:00 chosen at 20:00:40 is "now", not past.
  const thisMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
  if (at.getTime() < thisMinute.getTime()) return "past";
  if (at.getTime() > now.getTime() + MEETUP_MAX_DAYS_AHEAD * DAY_MS) return "tooFar";
  return null;
}

/**
 * Where the native time picker opens. 14:00 as before; but on today, once
 * 14:00 has gone, the next whole hour, so the first thing on the dial is a
 * time that can be sent. Only the picker's starting point — nothing is chosen
 * until the person confirms.
 */
export function pickerStartTime(day: Date | null, now: Date): Date {
  const base = day ?? startOfDay(now);
  const twoPm = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 14, 0);
  if (twoPm.getTime() > now.getTime()) return twoPm;
  const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0);
  // Past 23:00 the next hour is tomorrow; keep the dial on the chosen day.
  return nextHour.getDate() === base.getDate() ? nextHour : twoPm;
}

/* ───────────────────────── the hub sheet's groups ───────────────────────── */

/** The fields the grouping reads. `SafeZoneHub` satisfies it. */
export interface GroupableHub {
  id: string;
  name: string;
  city: string;
  typeLabel: string;
  address?: string;
  landmark?: string;
}

export type HubGroup<H extends GroupableHub> =
  | { kind: "suggested"; hubs: H[] }
  | { kind: "shared"; hubs: H[] }
  | { kind: "city"; city: string; hubs: H[] };

/**
 * The hub sheet, top to bottom: the partner's standing suggestion, then the
 * hubs both listings name, then everything else grouped by city. Inside each
 * group, and between cities, nearest first when `km` is given (the phone
 * already knew where it was), else by name. A hub appears once, in the first
 * group it qualifies for. `query` filters on name, city, type, address and
 * landmark; groups it empties are dropped.
 */
export function groupHubs<H extends GroupableHub>({
  hubs,
  shared,
  suggestedId,
  km,
  query = "",
}: {
  hubs: readonly H[];
  shared: ReadonlySet<string>;
  suggestedId: string | null;
  km: ((hub: H) => number) | null;
  query?: string;
}): HubGroup<H>[] {
  const q = query.trim().toLowerCase();
  const matches = (h: H) =>
    !q ||
    [h.name, h.city, h.typeLabel, h.address ?? "", h.landmark ?? ""].some((f) => f.toLowerCase().includes(q));
  const order = (a: H, b: H) => (km ? km(a) - km(b) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));

  const visible = hubs.filter(matches);
  const suggested = visible.filter((h) => h.id === suggestedId);
  const sharedHubs = visible.filter((h) => h.id !== suggestedId && shared.has(h.id)).sort(order);
  const rest = visible.filter((h) => h.id !== suggestedId && !shared.has(h.id));

  const byCity = new Map<string, H[]>();
  for (const h of rest) {
    const city = h.city.trim() || "Other";
    byCity.set(city, [...(byCity.get(city) ?? []), h]);
  }
  const cities = [...byCity.entries()].map(([city, list]) => ({ city, hubs: list.sort(order) }));
  cities.sort((a, b) =>
    km ? km(a.hubs[0]) - km(b.hubs[0]) || a.city.localeCompare(b.city) : a.city.localeCompare(b.city),
  );

  const groups: HubGroup<H>[] = [];
  if (suggested.length > 0) groups.push({ kind: "suggested", hubs: suggested });
  if (sharedHubs.length > 0) groups.push({ kind: "shared", hubs: sharedHubs });
  for (const c of cities) groups.push({ kind: "city", city: c.city, hubs: c.hubs });
  return groups;
}
