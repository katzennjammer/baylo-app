import { ApiError } from "../api/client";

/** Where a suspended account writes to appeal. The API's SUPPORT_EMAIL. */
export const SUPPORT_EMAIL = "hello@baylo.ph";

/** What the server says about a suspension, when it refuses a sign-in for one. */
export interface SuspensionNotice {
  /** What the admin wrote when imposing it. Null from a server that predates the field. */
  reason: string | null;
  since: Date | null;
  /** Null means indefinite — until staff lift it. */
  until: Date | null;
  /** Which suspension this is for the account: 1 = first. Null when unknown. */
  level: number | null;
}

function toDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Reads a sign-in failure as a suspension, or returns null if it is not one.
 *
 * Both sign-in endpoints (/api/auth/token and /api/auth/google/token) answer a
 * suspended account with 403 and code ACCOUNT_SUSPENDED, and only after the
 * caller has proved the account is theirs. Everything except the code is
 * optional here: an older server sends the code and a sentence and nothing
 * else, and that must still open the screen rather than fall back to a banner.
 */
export function suspensionFrom(err: unknown): SuspensionNotice | null {
  if (!(err instanceof ApiError) || err.code !== "ACCOUNT_SUSPENDED") return null;
  const { reason, level } = err.meta;
  return {
    reason: typeof reason === "string" && reason.trim() ? reason.trim() : null,
    since: toDate(err.meta.since),
    until: toDate(err.meta.until),
    level: typeof level === "number" ? level : null,
  };
}
