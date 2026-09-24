/**
 * How long a perishable listing has left, as a tier rather than a number:
 *
 *   under 1 h        "Ending soon"
 *   1 h up to 6 h    "A few hours left"
 *   6 h and over     "Ends today" / "Ends tomorrow" (by the local calendar)
 *                    "More than a day left" (past tomorrow; no window is that
 *                    long today, but hours are not capped server-side)
 *
 * The 6 h boundary is the shorter trade-within window: a fresh 6 h listing
 * starts in "A few hours left", a fresh 24 h one in the day tier. That tier
 * is split by calendar day, not by hours, because "Ends today" on a 24 h
 * listing posted at 8 pm would be false for most of its life.
 *
 * ONE SOURCE FOR EVERY LIST SURFACE. Home's Exclusive pill and each tile both
 * call this, so the two can never word the same listing differently. List
 * surfaces do not tick: a 1 s timer per card is a re-render per card per
 * second. The item page is the exception — one listing, one timer — and ticks
 * with formatClock().
 *
 * Past the window it still says "Ending soon" rather than anything stronger:
 * `expired` comes from the server, and the callers say "closed" from that
 * flag, not from this clock.
 */
export function expiryTierLabel(expiresAt: string, now: number = Date.now()): string {
  const end = new Date(expiresAt);
  const hoursLeft = (end.getTime() - now) / (60 * 60 * 1000);
  if (hoursLeft < 1) return "Ending soon";
  if (hoursLeft < 6) return "A few hours left";
  const days = calendarDaysBetween(new Date(now), end);
  return days <= 0 ? "Ends today" : days === 1 ? "Ends tomorrow" : "More than a day left";
}

/** Local-midnight to local-midnight, so 11 pm → 1 am is one day, not zero. */
function calendarDaysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/**
 * `15129` → `04:12:09`. The item page's live clock — the one surface that
 * shows a single listing, so a 1 s tick costs one re-render, not one per card.
 * Hours are not capped at 24: a window longer than a day reads `30:00:00`.
 */
export function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => n.toString().padStart(2, "0")).join(":");
}
