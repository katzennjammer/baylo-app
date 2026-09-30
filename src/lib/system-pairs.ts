/**
 * One status row per event, not two.
 *
 * Since 20 Sep 2026 an accept/decline writes an `offer_update` row to EACH
 * side, and a completion writes a `trade_completed` row to each side (see
 * PATCH /api/offers/[id] and confirm/submit). Both rows sit between the same
 * two accounts, so both came back in a thread and drew twice — and the
 * completion pair drew "Rate <yourself>" as the second one.
 *
 * The copy kept is the one addressed to THIS inbox. No client-side id decides
 * that: GET /api/messages returns only rows between the partner and the inbox
 * the server resolved from X-Baylo-Org (resolveInbox → resolveActingIdentity,
 * the same identity resolveTradeParticipant acts as), so in a thread
 * "addressed to the inbox" is exactly "sent by the partner". As a shop that is
 * the Mary→shop row; as Mary it is the shop→Mary row. A pre-20 Sep event with
 * a single row keeps that row, whichever way it points.
 *
 * Pure and dependency-free so the API repo's HTTP harness
 * (verify-offer-accept-realtime-http.ts) runs this exact code.
 */
type PairCandidate = { senderId: string; content: string };

function systemEventKey(content: string): string | null {
  try {
    const payload = JSON.parse(content) as { type?: unknown; offerId?: unknown; status?: unknown; tradeId?: unknown };
    if (payload.type === "offer_update" && typeof payload.offerId === "string") {
      return `offer_update:${payload.offerId}:${String(payload.status)}`;
    }
    if (payload.type === "trade_completed" && typeof payload.tradeId === "string") {
      return `trade_completed:${payload.tradeId}`;
    }
  } catch {
    // Plain text is never a system pair.
  }
  return null;
}

export function collapseSystemPairs<T extends PairCandidate>(messages: T[], partnerId: string | null): T[] {
  const chosen = new Map<string, T>();
  for (const message of messages) {
    const key = systemEventKey(message.content);
    if (!key) continue;
    const held = chosen.get(key);
    if (!held || (held.senderId !== partnerId && message.senderId === partnerId)) chosen.set(key, message);
  }
  return messages.filter((message) => {
    const key = systemEventKey(message.content);
    return !key || chosen.get(key) === message;
  });
}
