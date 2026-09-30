/**
 * A perishable's window as a live countdown (1 Oct 2026).
 *
 * EVERY SURFACE TICKS NOW. The relative tiers this file used to produce
 * ("Ending soon", "A few hours left", "Ends today" / "Ends tomorrow", "More
 * than a day left") were there because a 1 s timer per card was a re-render
 * per card per second. lib/live-clock is one shared ticker that only the pill
 * itself subscribes to, so every card shows the real number instead.
 *
 * All of it is in whole SERVER seconds (lib/server-time), so a phone with a
 * wrong clock still ends a window when the server does.
 */

/** Whole seconds left in the window at `nowSec`, never below zero. */
export function secondsLeft(expiresAt: string, nowSec: number): number {
  const end = Math.floor(Date.parse(expiresAt) / 1000);
  return Number.isFinite(end) ? Math.max(0, end - nowSec) : 0;
}

/**
 * `05:12:44` under a day, `1d 14:22:05` from a day up. Always two-digit
 * fields, so with tabular figures the pill keeps one width while it ticks.
 */
export function formatCountdown(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const clock = [h, m, s].map((n) => n.toString().padStart(2, "0")).join(":");
  return d > 0 ? `${d}d ${clock}` : clock;
}

/**
 * What a screen reader hears: "Ends in 5 hours 12 minutes". Minute
 * resolution on purpose. The label is recomputed every tick but only CHANGES
 * once a minute, and nothing announces it on its own (no live region), so a
 * countdown is never read out second by second.
 */
export function countdownA11yLabel(seconds: number): string {
  if (seconds <= 0) return "Ended";
  if (seconds < 60) return "Ends in less than a minute";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const part = (n: number, unit: string) => (n > 0 ? `${n} ${unit}${n === 1 ? "" : "s"}` : null);
  return `Ends in ${[part(d, "day"), part(h, "hour"), part(m, "minute")].filter(Boolean).join(" ")}`;
}
