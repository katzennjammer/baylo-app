import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiV1, currentSession, request } from "./client";

export interface ConversationListItem {
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  lastMessageId: string;
  content: string;
  lastMessageAt: string;
  unreadCount: number;
  fromMe: boolean;
}

export interface ConversationListResponse {
  conversations: ConversationListItem[];
  nextCursor?: string | null;
}

export interface ThreadMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  read: boolean;
  createdAt: string;
}

export interface LegacyThreadResponse {
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  currentUserId: string;
  messages: ThreadMessage[];
}

export interface LegacyThreadEnvelope {
  messages?: ThreadMessage[];
  partnerId?: string;
  partnerName?: string;
  partnerAvatar?: string | null;
  currentUserId?: string;
  viewerId?: string;
}

async function fetchLegacyThread(partnerId: string): Promise<LegacyThreadResponse> {
  const res = await request(`/api/messages?partnerId=${encodeURIComponent(partnerId)}`);

  if (!res.ok) {
    let body: { error?: string; code?: string } = {};
    try {
      body = (await res.json()) as { error?: string; code?: string };
    } catch {
      // Legacy endpoint failed without JSON; let ApiError describe it below.
    }

    const code = body.code ?? "LEGACY_MESSAGE_ERROR";
    const message = body.error ?? `Could not load messages with ${partnerId}.`;
    throw new ApiError(res.status, code, message);
  }

  const body = (await res.json()) as LegacyThreadEnvelope | ThreadMessage[];
  const messages = Array.isArray(body) ? body : body.messages ?? [];
  let partnerName = Array.isArray(body) ? "Conversation" : body.partnerName ?? "Conversation";
  let partnerAvatar = Array.isArray(body) ? null : body.partnerAvatar ?? null;
  if (Array.isArray(body)) {
    try {
      const { data } = await apiV1<ConversationListResponse>("/api/v1/messages/conversations");
      const conversation = data.conversations.find((item) => item.partnerId === partnerId);
      partnerName = conversation?.partnerName ?? partnerName;
      partnerAvatar = conversation?.partnerAvatar ?? partnerAvatar;
    } catch {
      // The thread itself is still useful when the conversation summary is unavailable.
    }
  }
  // The legacy endpoint returns a bare message array, so it cannot carry the
  // viewer id. Use the authenticated mobile session for bubble ownership.
  const currentUserId = Array.isArray(body)
    ? currentSession()?.user.id ?? ""
    : body.currentUserId ?? body.viewerId ?? currentSession()?.user.id ?? "";
  const partnerIdValue = Array.isArray(body) ? partnerId : body.partnerId ?? partnerId;

  return {
    partnerId: partnerIdValue,
    partnerName,
    partnerAvatar,
    currentUserId,
    messages: messages.map((msg) => ({
      ...msg,
      createdAt: typeof msg.createdAt === "string" ? msg.createdAt : new Date().toISOString(),
    })),
  };
}

export async function fetchConversations(
  fallbackPartnerId?: string | null,
): Promise<ConversationListResponse> {
  try {
    const { data: body } = await apiV1<ConversationListResponse>("/api/v1/messages/conversations");
    return {
      conversations: Array.isArray(body.conversations) ? body.conversations : [],
      nextCursor: body.nextCursor ?? null,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      // TEMPORARY FALLBACK: the v1 conversations route does not exist yet.
      // The legacy single-thread endpoint requires a partnerId, so if the screen
      // has one we convert that thread into a single conversation entry; otherwise
      // we intentionally return an empty list until the server route is live.
      if (!fallbackPartnerId) return { conversations: [] };

      const legacy = await fetchLegacyThread(fallbackPartnerId);
      const lastMessage = legacy.messages[legacy.messages.length - 1];
      if (!lastMessage) return { conversations: [] };

      return {
        conversations: [
          {
            partnerId: legacy.partnerId,
            partnerName: legacy.partnerName,
            partnerAvatar: legacy.partnerAvatar,
            lastMessageId: lastMessage.id,
            content: lastMessage.content,
            lastMessageAt: lastMessage.createdAt,
            unreadCount: legacy.messages.filter(
              (msg) => !msg.read && msg.receiverId === legacy.currentUserId,
            ).length,
            fromMe: legacy.currentUserId ? lastMessage.senderId === legacy.currentUserId : false,
          },
        ],
      };
    }

    if (error instanceof ApiError && error.status === 403) {
      return { conversations: [] };
    }

    throw error;
  }
}

export function useConversations(fallbackPartnerId?: string | null) {
  return useQuery({
    queryKey: ["messages", "conversations", fallbackPartnerId ?? "all"],
    queryFn: () => fetchConversations(fallbackPartnerId),
    staleTime: 20_000,
  });
}

export function useThread(partnerId: string | null) {
  return useQuery({
    queryKey: ["messages", "thread", partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      if (!partnerId) throw new Error("No partner selected.");
      return fetchLegacyThread(partnerId);
    },
    staleTime: 30_000,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      partnerId,
      content,
    }: {
      partnerId: string;
      content: string;
    }) => {
      const res = await request("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: partnerId, content }),
      });

      if (!res.ok) {
        let body: { error?: string; code?: string } = {};
        try {
          body = (await res.json()) as { error?: string; code?: string };
        } catch {
          // Server returned a non-JSON failure body; let ApiError describe it.
        }

        if (res.status === 403 || /blocked|block/i.test(body.error ?? "")) {
          throw new ApiError(
            res.status,
            body.code ?? "BLOCKED_USER",
            body.error ?? "This conversation is unavailable.",
          );
        }

        throw new ApiError(
          res.status,
          body.code ?? "MESSAGE_SEND_FAILED",
          body.error ?? "Your message could not be sent.",
        );
      }

      return (await res.json()) as { id?: string; messageId?: string };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["messages", "conversations"] });
      void qc.invalidateQueries({ queryKey: ["messages", "thread"] });
    },
  });
}
