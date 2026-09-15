import Pusher from "pusher-js";

import { currentSession } from "./client";
import { getApiBase } from "./config";

let client: Pusher | null = null;

// Metro resolves pusher-js to its React Native CommonJS bundle, which exposes
// the constructor as `module.Pusher` instead of an ES default export.
const PusherConstructor =
  (Pusher as unknown as { Pusher?: typeof Pusher }).Pusher ?? Pusher;

function getClient(): Pusher | null {
  const key = process.env.EXPO_PUBLIC_PUSHER_KEY;
  const cluster = process.env.EXPO_PUBLIC_PUSHER_CLUSTER;
  const session = currentSession();
  if (!key || !cluster || !session?.accessToken) return null;

  if (!client) {
    client = new PusherConstructor(key, {
      cluster,
      authEndpoint: `${getApiBase()}/api/pusher/auth`,
      auth: { headers: { Authorization: `Bearer ${session.accessToken}` } },
    });
  }

  return client;
}

export function subscribeToUserChannel(
  userId: string,
  onNewMessage: (message: {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    createdAt: string;
  }) => void,
): (() => void) | null {
  const pusher = getClient();
  if (!pusher) return null;

  const channelName = `private-user-${userId}`;
  const channel = pusher.subscribe(channelName);
  channel.bind("new-message", onNewMessage);

  return () => {
    channel.unbind("new-message", onNewMessage);
    pusher.unsubscribe(channelName);
  };
}