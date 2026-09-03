/**
 * Date of birth: the parts, the arithmetic, and the two strings.
 *
 * ── WHY A {year, month, day} TRIPLE AND NOT A `Date` ────────────────────────
 *
 * A date of birth is a calendar fact, not an instant. `new Date(2008, 8, 3)` is
 * midnight in whatever zone the phone happens to be in, and the moment that
 * value is serialised, sent to a server in another zone and parsed back, it can
 * land on the 2nd — which for somebody born exactly eighteen years ago is the
 * difference between being let in and being refused. The triple has no zone to
 * lose, and `isoDate()` is what crosses the wire.
 *
 * The server does the same arithmetic on the same string; see
 * `../../baylo/src/lib/age.ts`. Both sides have to agree, so both are written
 * from the same rule rather than one trusting the other.
 */

/** The gate. Baylo is 18+, on the client and in the register route alike. */
export const MIN_AGE = 18;

/** The oldest date of birth the pickers offer. A plausible human ceiling. */
export const MAX_AGE = 110;

export interface DateParts {
  /** Four digits. */
  year: number;
  /** 1–12, NOT the 0–11 that `Date` uses. */
  month: number;
  /** 1–31, bounded by `daysInMonth`. */
  day: number;
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Days in a month, leap years included. `month` is 1-based. */
export function daysInMonth(year: number, month: number): number {
  // Day 0 of the NEXT month is the last day of this one, which is the only
  // form of this that needs no leap-year branch of its own.
  return new Date(year, month, 0).getDate();
}

/** Clamps a day to a month that may not have it — 31 January → 28 February. */
export function clampDay(parts: DateParts): DateParts {
  const max = daysInMonth(parts.year, parts.month);
  return parts.day <= max ? parts : { ...parts, day: max };
}

/** "2008-09-03". The wire format, and the only one that leaves this device. */
export function isoDate(parts: DateParts): string {
  const mm = String(parts.month).padStart(2, "0");
  const dd = String(parts.day).padStart(2, "0");
  return `${parts.year}-${mm}-${dd}`;
}

/** "3 September 2008". What a field, a panel row or a summary shows. */
export function formatLongDate(parts: DateParts): string {
  return `${parts.day} ${MONTH_NAMES[parts.month - 1]} ${parts.year}`;
}

/** Today, as parts, in the device's own calendar. */
export function todayParts(): DateParts {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

/**
 * Completed years between two calendar dates.
 *
 * Counts a birthday as reached ON the day, which is what every jurisdiction
 * means by an age and what the server's copy of this function also does. The
 * comparison is on the (month, day) pair rather than on two timestamps, so it
 * cannot be moved by a time zone or by a daylight-saving boundary.
 */
export function ageOn(dob: DateParts, today: DateParts): number {
  let age = today.year - dob.year;
  const beforeBirthday =
    today.month < dob.month || (today.month === dob.month && today.day < dob.day);
  if (beforeBirthday) age -= 1;
  return age;
}

/** The age today. The one call sites actually want. */
export function currentAge(dob: DateParts): number {
  return ageOn(dob, todayParts());
}

/** True when this date of birth is old enough to hold an account. */
export function isAdult(dob: DateParts): boolean {
  return currentAge(dob) >= MIN_AGE;
}

/**
 * Whether a triple names a real day that is not in the future.
 *
 * `daysInMonth` is what makes 31 February a rejection rather than a silent roll
 * into March, which is what `new Date(2009, 1, 31)` would do.
 */
export function isRealPastDate(parts: DateParts): boolean {
  if (!Number.isInteger(parts.year) || !Number.isInteger(parts.month) || !Number.isInteger(parts.day)) {
    return false;
  }
  if (parts.month < 1 || parts.month > 12) return false;
  if (parts.day < 1 || parts.day > daysInMonth(parts.year, parts.month)) return false;

  const today = todayParts();
  if (parts.year > today.year) return false;
  if (parts.year === today.year) {
    if (parts.month > today.month) return false;
    if (parts.month === today.month && parts.day > today.day) return false;
  }
  return parts.year >= today.year - MAX_AGE;
}

/**
 * The years a picker offers, newest first.
 *
 * It does NOT stop at the 18-years-ago line. Somebody under 18 has to be able
 * to enter their real date of birth and be told why the answer is no — a picker
 * that silently refuses to show their birth year would leave them guessing at
 * which of five fields was wrong, and the rejection screen exists precisely so
 * that the refusal is legible.
 */
export function selectableYears(): number[] {
  const thisYear = todayParts().year;
  const years: number[] = [];
  for (let y = thisYear; y >= thisYear - MAX_AGE; y--) years.push(y);
  return years;
}

/**
 * Where a picker opens when nothing has been chosen.
 *
 * Exactly `MIN_AGE` years ago, so the common case — an adult — is a short
 * scroll in either direction rather than a hundred-row journey from today.
 */
export function defaultDobParts(): DateParts {
  const today = todayParts();
  return clampDay({ year: today.year - MIN_AGE, month: today.month, day: today.day });
}
