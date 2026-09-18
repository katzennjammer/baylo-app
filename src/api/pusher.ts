import Pusher, { type Channel } from "pusher-js";

import { currentSession, onSessionChange } from "./client";
import { getApiBase } from "./config";

/**
 * The realtime client, and the one private channel this app listens on.
 *
 * ── ONE CHANNEL, MANY LISTENERS ─────────────────────────────────────────────
 *
 * Everything the server pushes to a person — messages, typing, trade status,
 * meetup plans — arrives on `private-user-<id>`. Until 17 Sep 2026 the two
 * Messages screens each called `pusher.subscribe()` on mount and
 * `pusher.unsubscribe()` on unmount, which was fine while they were the only
 * subscribers. It stops being fine the moment something app-level holds the
 * same channel for the whole session: pusher-js keys channels by name, so the
 * thread screen unmounting would have torn down the trades subscription with
 * it. The channel is therefore REF-COUNTED here — `acquire()` subscribes on
 * the first holder and `release()` unsubscribes on the last — and every
 * caller binds and unbinds its own handlers on the shared object.
 *
 * ── THE TOKEN IS READ PER AUTH, NOT AT CONSTRUCTION ─────────────────────────
 *
 * The client used to be built with `auth: { headers: { Authorization } }`,
 * captured once. Access tokens are short-lived; a reconnect an hour later
 * re-authorised every private channel with a dead token, got 401, and the
 * subscription silently never came back. `headersProvider` is called on every
 * authorisation, so it always hands over whatever token the session holds now
 * — including after the refresh interceptor has rotated it.
 *
 * ── LOGOUT ──────────────────────────────────────────────────────────────────
 *
 * `disconnectRealtime()` drops the socket and forgets the client. The next
 * sign-in builds a fresh one for the new user; nothing subscribed under the
 * old session can survive into the new one because the channel name carries
 * the user id and the ref-count is cleared with the client.
 */

let client: Pusher | null = null;

// Metro resolves pusher-js to its React Native CommonJS bundle, which exposes
// the constructor as `module.Pusher` instead of an ES default export.
const PusherConstructor =
  (Pusher as unknown as { Pusher?: typeof Pusher }).Pusher ?? Pusher;

function getClient(): Pusher | null {
  const key = process.env.EXPO_PUBLIC_PUSHER_KEY;
  const cluster = process.env.EXPO_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster || !currentSession()?.accessToken) return null;

  if (!client) {
    client = new PusherConstructor(key, {
      cluster,
      channelAuthorization: {
        transport: "ajax",
        endpoint: `${getApiBase()}/api/pusher/auth`,
        headersProvider: () => {
          const token = currentSession()?.accessToken;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      },
    });
  }

  return client;
}

/** Holders per channel name. Subscribe at 0→1, unsubscribe at 1→0. */
const holders = new Map<string, number>();

function acquire(channelName: string): { channel: Channel; release: () => void } | null {
  const pusher = getClient();
  if (!pusher) return null;

  holders.set(channelName, (holders.get(channelName) ?? 0) + 1);
  // Idempotent in pusher-js: a second subscribe() returns the same Channel.
  const channel = pusher.subscribe(channelName);

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    const left = (holders.get(channelName) ?? 1) - 1;
    if (left > 0) {
      holders.set(channelName, left);
      return;
    }
    holders.delete(channelName);
    // The client may already be gone (logout disconnects it). Then there is
    // nothing to unsubscribe from and the channel died with the socket.
    client?.unsubscribe(channelName);
  };
  return { channel, release };
}

const userChannel = (userId: string) => `private-user-${userId}`;

/**
 * Whether the socket is up. The polling fallback on the trade screens asks
 * this before each tick: a phone that is receiving pushes has nothing to poll
 * for, and one that is not — no Pusher keys in the build, a blocked WebSocket,
 * a reconnect in progress — should not sit stale until the next foregrounding.
 */
export function isRealtimeConnected(): boolean {
  return client?.connection.state === "connected";
}

/** Drops the socket and forgets the client. */
export function disconnectRealtime(): void {
  if (!client) return;
  client.disconnect();
  client = null;
  holders.clear();
}

/*
 * ── LOGOUT, WHICHEVER WAY IT HAPPENS ────────────────────────────────────────
 *
 * `signOut()` is one of three ways the session ends: the refresh interceptor
 * gives up on a revoked token, and the dev menu's shake-to-clear, both drop
 * it without going through the provider. All three publish on the session
 * stream, so that is what the socket follows. A user change is treated the
 * same as a sign-out — nothing subscribed under one account may outlive it.
 *
 * Module scope, once. The listener set lives in client.ts and is never
 * cleared, so this registration is for the life of the JS runtime, which is
 * the life of the client it guards.
 */
let lastUserId: string | null = currentSession()?.user.id ?? null;
onSessionChange((session) => {
  const next = session?.user.id ?? null;
  if (next !== lastUserId) disconnectRealtime();
  lastUserId = next;
});

/** The Messages screens' subscription, unchanged in shape. */
export function subscribeToUserChannel(
  userId: string,
  onNewMessage: (message: {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    createdAt: string;
  }) => void,
  onTyping?: (event: { senderId: string; senderName: string; isTyping: boolean }) => void,
): (() => void) | null {
  const held = acquire(userChannel(userId));
  if (!held) return null;

  held.channel.bind("new-message", onNewMessage);
  if (onTyping) held.channel.bind("typing", onTyping);

  return () => {
    held.channel.unbind("new-message", onNewMessage);
    if (onTyping) held.channel.unbind("typing", onTyping);
    held.release();
  };
}

/**
 * The two events that mean "a trade you are in changed under you".
 *
 * `meetup-changed` is sent by the two meetup routes to the PARTNER when a
 * plan is proposed, countered or agreed. `trade-status-changed` already
 * existed for the web dashboard — accept, cancel, both codes matched — and
 * was never bound here. Both carry a `tradeId`; neither carries anything the
 * client should render, because the client's job on receipt is to refetch.
 */
export type TradeEvent =
  | { name: "meetup-changed"; tradeId: string; kind: "proposed" | "agreed"; actorId: string }
  | { name: "trade-status-changed"; tradeId: string; newStatus?: string };

export function subscribeToTradeEvents(
  userId: string,
  onEvent: (event: TradeEvent) => void,
): (() => void) | null {
  const held = acquire(userChannel(userId));
  if (!held) return null;

  const onMeetup = (data: Omit<Extract<TradeEvent, { name: "meetup-changed" }>, "name">) =>
    onEvent({ name: "meetup-changed", ...data });
  const onStatus = (data: Omit<Extract<TradeEvent, { name: "trade-status-changed" }>, "name">) =>
    onEvent({ name: "trade-status-changed", ...data });

  held.channel.bind("meetup-changed", onMeetup);
  held.channel.bind("trade-status-changed", onStatus);

  return () => {
    held.channel.unbind("meetup-changed", onMeetup);
    held.channel.unbind("trade-status-changed", onStatus);
    held.release();
  };
}
