/**
 * The server's clock, as best this device knows it.
 *
 * `expiresAt` is the server's instant. A phone whose clock is five minutes
 * fast would show every perishable window five minutes shorter, and "Ended"
 * on a listing the server still accepts offers on. So the live countdowns
 * (lib/live-clock) read `serverNow()`: the device clock plus an offset learnt
 * from the HTTP `Date` header on every API response, which api/client.ts
 * `request()` records. No API change was needed: Node sets the header on
 * every response.
 *
 * The header has one-second resolution, so a sample is good to about ±0.5 s
 * plus half the round trip. The sample with the smallest round trip wins. It
 * is re-learnt after ten minutes in case the device clock was changed.
 *
 * Plain module, no React: the API client imports it.
 */

let offsetMs = 0;
let bestError = Infinity;
let bestAt = 0;
const SAMPLE_TTL_MS = 10 * 60 * 1000;

/** Called by the API client with every response's `Date` header. */
export function recordServerDate(sentAt: number, receivedAt: number, header: string | null): void {
  if (!header) return;
  const server = Date.parse(header);
  if (!Number.isFinite(server)) return;
  const rtt = Math.max(0, receivedAt - sentAt);
  // The header truncates to the second: the true instant is in [server, server + 1000).
  const error = 500 + rtt / 2;
  if (error > bestError && receivedAt - bestAt < SAMPLE_TTL_MS) return;
  offsetMs = server + 500 - (sentAt + receivedAt) / 2;
  bestError = error;
  bestAt = receivedAt;
}

/** Milliseconds since the epoch, by the server's clock. */
export function serverNow(): number {
  return Date.now() + offsetMs;
}
