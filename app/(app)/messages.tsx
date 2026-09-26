import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError } from "../../src/api/client";
import { useConversations } from "../../src/api/messages";
import { useHome } from "../../src/api/home";
import { getActingOrgId } from "../../src/api/org-context";
import { subscribeToUserChannel } from "../../src/api/pusher";
import { useSession } from "../../src/auth/session";
import { MessageIcon, StoreIcon } from "../../src/components/icons";
import { Tappable } from "../../src/components/Tappable";
import { previewFromContent } from "../../src/components/messages/MessagePayloads";
import { color, font, icon, radius, textStyle } from "../../src/theme/tokens";

function relativeTime(dateIso: string): string {
  const date = new Date(dateIso);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSec < 60) return `${diffSec}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d`;
  return `${Math.floor(diffSec / 604800)}w`;
}

/**
 * What the list's error state says. A REFUSAL IS NOT AN EMPTY INBOX.
 *
 * `fetchConversations()` used to turn every 403 into an empty list, so a
 * refused request and an inbox with nothing in it both read "No conversations
 * yet" -- which is how a shop owner's empty screen on 26 Sep 2026 could not be
 * told apart from a real one. A 403 now arrives here as an error and is named
 * as a refusal, with the status and code printed small underneath, so a
 * screenshot is enough to say which one happened.
 *
 * ORG_CONTEXT_REFUSED has its own words because the client has ALREADY acted
 * on it: client.ts dropped the shop context on that code, so Retry loads the
 * person's own inbox, and the copy says so rather than promising the shop's.
 */
function conversationsErrorCopy(error: unknown): { headline: string; body: string; code: string | null } {
  if (error instanceof ApiError && error.status === 403) {
    const code = `403 · ${error.code || "FORBIDDEN"}`;
    if (error.code === "ORG_CONTEXT_REFUSED") {
      return {
        headline: "Can’t open the shop’s inbox",
        body: "This account can no longer act for that shop, so you’ve been switched back to your own account. Tap Retry to load your own messages.",
        code,
      };
    }
    return {
      headline: "Messages were refused",
      body: "The server wouldn’t show this inbox to this account. This is a permission problem, not an empty inbox.",
      code,
    };
  }
  return {
    headline: "Something went wrong",
    body: "We couldn’t load your messages right now.",
    code: error instanceof ApiError && error.status > 0 ? `${error.status} · ${error.code}` : null,
  };
}

export default function MessagesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ partner?: string }>();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { data, error, isPending, isError, refetch } = useConversations(params.partner ?? null);
  const conversations = useMemo(
    () => [...(data?.conversations ?? [])].sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    ),
    [data],
  );

  // Acting as a shop this list is the SHOP's inbox (the server reads the same
  // X-Baylo-Org header), so the realtime channel is the shop's too: `viewerId`
  // is whoever the list was fetched for. See the note in src/api/messages.
  const inboxId = data?.viewerId ?? session?.user.id;
  // Say whose inbox it is only when the server says it answered as the shop,
  // the same test the header pill uses. Deduped with the header's query.
  const { acting } = useHome();
  const shopName = acting && acting.organizationId === getActingOrgId() ? acting.name : null;

  useEffect(() => {
    if (!inboxId) return;

    return subscribeToUserChannel(inboxId, () => {
      void queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    }) ?? undefined;
  }, [queryClient, inboxId]);

  const shopStrip = shopName ? (
    <View style={styles.shopStrip}>
      <StoreIcon size={14} stroke={1.6} color={color.forest} />
      <Text style={styles.shopStripText} numberOfLines={1}>
        {`Inbox for ${shopName} · replies are sent as the shop`}
      </Text>
    </View>
  ) : null;

  if (isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={color.forest} />
        <Text style={styles.headline}>Loading conversations…</Text>
      </View>
    );
  }

  if (isError) {
    const failure = conversationsErrorCopy(error);
    return (
      <View style={styles.centered}>
        <MessageIcon size={icon.emptyLeaf.size} stroke={icon.emptyLeaf.stroke} color={color.forest} />
        <Text style={styles.headline}>{failure.headline}</Text>
        <Text style={styles.body}>{failure.body}</Text>
        {failure.code ? <Text style={styles.errorCode}>{failure.code}</Text> : null}
        <Tappable onPress={() => void refetch()} style={styles.retryButton} pressedStyle={styles.retryButtonPressed}>
          <Text style={styles.retryText}>Retry</Text>
        </Tappable>
      </View>
    );
  }

  if (conversations.length === 0) {
    return (
      <View style={styles.screen}>
        {shopStrip}
        <View style={styles.centered}>
          <MessageIcon size={icon.emptyLeaf.size} stroke={icon.emptyLeaf.stroke} color={color.forest} />
          <Text style={styles.headline}>No conversations yet.</Text>
          <Text style={styles.body}>
            {shopName
              ? `Messages to ${shopName} will appear here.`
              : "Messages will appear here when someone starts a conversation."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {shopStrip}
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.partnerId}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const preview = previewFromContent(item.content, item.fromMe);
          const label = item.fromMe ? `You: ${preview}` : preview;

          return (
            <View style={styles.row}>
              <Tappable onPress={() => router.push({ pathname: "/user", params: { id: item.partnerId } })} style={styles.partnerIdentity} pressedStyle={styles.rowPressed} accessibilityRole="button" accessibilityLabel={`View ${item.partnerName}'s profile`}>
                {item.partnerAvatar ? <Image source={{ uri: item.partnerAvatar }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{item.partnerName?.slice(0, 1).toUpperCase() ?? "?"}</Text></View>}
              </Tappable>

              <Tappable
                onPress={() => router.push({
                  pathname: "/messages/thread",
                  params: {
                    partner: item.partnerId,
                    partnerName: item.partnerName,
                    partnerAvatar: item.partnerAvatar ?? "",
                  },
                })}
                style={styles.bodyWrap}
                pressedStyle={styles.rowPressed}
                accessibilityRole="button"
                accessibilityLabel={`Open conversation with ${item.partnerName}`}
              >
                <View style={styles.metaRow}>
                  <Text style={[styles.name, item.unreadCount > 0 && styles.unreadText]}>{item.partnerName}</Text>
                  <Text style={styles.time}>{relativeTime(item.lastMessageAt)}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={[styles.preview, item.unreadCount > 0 && styles.unreadText]} numberOfLines={1}>{label}</Text>
                  {item.unreadCount > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadCount}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>
                    </View>
                  ) : null}
                </View>
              </Tappable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.surface,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: color.surface,
  },
  headline: {
    marginTop: 16,
    fontFamily: font.displayBold,
    fontSize: 22,
    lineHeight: 28,
    color: color.ink,
    textAlign: "center",
  },
  body: {
    marginTop: 8,
    fontFamily: font.sans,
    fontSize: 14,
    lineHeight: 20,
    color: color.inkSecondary,
    textAlign: "center",
  },
  errorCode: {
    marginTop: 8,
    fontFamily: font.mono,
    fontSize: 11,
    color: color.inkMuted,
    textAlign: "center",
  },
  shopStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: color.greenWash,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
  },
  shopStripText: {
    flex: 1,
    fontFamily: font.sansSemi,
    fontSize: 12,
    color: color.forest,
  },
  retryButton: {
    marginTop: 18,
    backgroundColor: color.forest,
    borderRadius: radius.primaryButton,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryButtonPressed: {
    opacity: 0.9,
  },
  retryText: {
    fontFamily: font.sansSemi,
    fontSize: 14,
    color: color.surface,
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
    gap: 12,
  },
  rowPressed: {
    backgroundColor: color.control,
  },
  partnerIdentity: {
    minHeight: 44,
    justifyContent: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.control,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.control,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontFamily: font.sansSemi,
    fontSize: 14,
    color: color.ink,
  },
  bodyWrap: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  name: {
    ...textStyle({ fontFamily: font.sansSemi, fontSize: 15 }),
    color: color.ink,
    flexShrink: 1,
  },
  unreadText: {
    fontFamily: font.sansBold,
    color: color.ink,
  },
  time: {
    marginLeft: 8,
    fontFamily: font.mono,
    fontSize: 10,
    color: color.inkSecondary,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  preview: {
    flex: 1,
    fontFamily: font.sans,
    fontSize: 13,
    color: color.inkSecondary,
  },
  unreadBadge: {
    minWidth: 8,
    height: 18,
    borderRadius: 9,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadCount: {
    fontFamily: font.sansBold,
    fontSize: 10,
    color: color.onGreen,
  },
});
