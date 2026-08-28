/**
 * The number and time formatting the Home artboards specify, done by hand.
 *
 * Deliberately NOT `toLocaleString()` / `Intl.DateTimeFormat`. Hermes ships
 * Intl, so those calls succeed — they just answer in the device's locale, and
 * the artboards are not locale-flexible: a phone set to de-DE renders
 * `toLocaleString()` of 1240 as "1.240", which in a pill next to a leaf glyph
 * reads as one-point-two-four rather than one thousand two hundred and forty.
 * The clock is the same trade: the offline bar is specified at 24-hour "14:32",
 * and a 12-hour locale would silently widen it to "2:32 PM".
 *
 * These are display strings for a fixed design, so the design decides the
 * format, not the handset.
 */

import { size } from "../theme/tokens";

/** `1240` -> `"1,240"`. Grouping is always a comma, by the argument above. */
function groupThousands(n: number): string {
  const s = Math.trunc(Math.abs(n)).toString();
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ",";
    out += s[i];
  }
  return n < 0 ? `-${out}` : out;
}

/**
 * The Leaves pill. Grouped up to 99,999; compact above it.
 *
 * The threshold is the pill's, not arithmetic's: 2e fixes the pill's width at
 * six grouped digits and says it never shrinks, so "100,000" is the first value
 * that would not fit. Compacting starts exactly there and one decimal is kept,
 * which is what makes the difference between 120k and 128k visible.
 *
 * Truncated rather than rounded. A balance is a quantity someone owns, and
 * rounding 99,960 up to "100.0k" shows a person more Leaves than they have.
 */
export function formatLeaves(n: number): string {
  const v = Math.max(0, Math.trunc(n));
  if (v <= 99_999) return groupThousands(v);
  if (v < 1_000_000) return `${(Math.trunc(v / 100) / 10).toFixed(1)}k`;
  return `${(Math.trunc(v / 100_000) / 10).toFixed(1)}M`;
}

/**
 * Unread badges. Past 99 the badge stops being a number and becomes a shape, so
 * it caps — 2e pins the badge's height and lets only its width breathe, and an
 * uncapped four-digit count would run out from under the icon it belongs to.
 */
export function formatBadge(n: number): string {
  return n > 99 ? "99+" : String(Math.max(0, Math.trunc(n)));
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Card timestamps: `"18m ago"`, `"2h ago"`, `"3d ago"`, then a date.
 *
 * Weeks and months are not units here. "5w ago" is read as a duration that has
 * to be converted before it means anything, where "12 Aug" is already the
 * answer, so past four weeks this switches to the date and stops counting.
 */
export function relativeShort(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";

  const delta = now - then;
  // Clock skew between handset and server puts fresh rows a few seconds in the
  // future. "in 4s" on a listing someone just made is a bug report; "now" is
  // the truth as far as the reader is concerned.
  if (delta < MINUTE) return "now";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  if (delta < 28 * DAY) return `${Math.floor(delta / DAY)}d ago`;

  const d = new Date(then);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/**
 * The offline bar's second half: `"6 min ago"`.
 *
 * Spelled out where the card is abbreviated, and that is 2c's call rather than
 * an inconsistency. The card's timestamp is one of forty on screen and is being
 * skimmed; this one appears once, under a warning, and is being read.
 */
export function relativeLong(at: number, now: number = Date.now()): string {
  const delta = Math.max(0, now - at);
  if (delta < MINUTE) return "just now";
  if (delta < HOUR) {
    const m = Math.floor(delta / MINUTE);
    return `${m} min ago`;
  }
  if (delta < DAY) {
    const h = Math.floor(delta / HOUR);
    return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  }
  const d = Math.floor(delta / DAY);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
}

/** `"14:32"`. 24-hour, zero-padded, no locale involvement. See the file note. */
export function clockTime(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * The photo box's aspect ratio, clamped to the band the spec allows.
 *
 * Max tall 4:5, max wide 16:9, centre-cropped by `contentFit="cover"` outside
 * that band; the bounds themselves live in `tokens.size.photo` with the rest of
 * the layout. The band is what keeps the scroll rhythm: an unclamped
 * feed of mixed uploads gives a 3:1 panorama immediately above a 9:16 phone
 * screenshot, and the eye loses the card boundary between them.
 */
export function clampAspect(width: number, height: number): number {
  const { aspectDefault, aspectMin, aspectMax } = size.photo;
  if (!width || !height) return aspectDefault;
  return Math.min(aspectMax, Math.max(aspectMin, width / height));
}

/**
 * True when the photo was cropped to get inside the band.
 *
 * Drives the small "expand" label the spec puts in the bottom-right of any
 * non-square photo: it is an admission that what is on screen is not the whole
 * frame, so it has to be keyed on the crop actually having happened rather than
 * on the ratio merely differing from 1:1.
 */
export function wasCropped(width: number, height: number): boolean {
  const { aspectMin, aspectMax } = size.photo;
  if (!width || !height) return false;
  const raw = width / height;
  return raw < aspectMin || raw > aspectMax;
}
