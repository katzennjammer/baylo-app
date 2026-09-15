import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { useConversations } from "../../src/api/messages";
import { subscribeToUserChannel } from "../../src/api/pusher";
import { useSession } from "../../src/auth/session";
import { MessageIcon } from "../../src/components/icons";
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

export default function MessagesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ partner?: string }>();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { data, isPending, isError, refetch } = useConversations(params.partner ?? null);
  const conversations = useMemo(
    () => [...(data?.conversations ?? [])].sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    ),
    [data],
  );

  useEffect(() => {
    if (!session?.user.id) return;

    return subscribeToUserChannel(session.user.id, () => {
      void queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    }) ?? undefined;
  }, [queryClient, session?.user.id]);

  if (isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={color.forest} />
        <Text style={styles.headline}>Loading conversations…</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <MessageIcon size={icon.emptyLeaf.size} stroke={icon.emptyLeaf.stroke} color={color.forest} />
        <Text style={styles.headline}>Something went wrong</Text>
        <Text style={styles.body}>We couldn’t load your messages right now.</Text>
        <Tappable onPress={() => void refetch()} style={styles.retryButton} pressedStyle={styles.retryButtonPressed}>
          <Text style={styles.retryText}>Retry</Text>
        </Tappable>
      </View>
    );
  }

  if (conversations.length === 0) {
    return (
      <View style={styles.centered}>
        <MessageIcon size={icon.emptyLeaf.size} stroke={icon.emptyLeaf.stroke} color={color.forest} />
        <Text style={styles.headline}>No conversations yet.</Text>
        <Text style={styles.body}>Messages will appear here when someone starts a conversation.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.partnerId}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const preview = previewFromContent(item.content, item.fromMe);
          const label = item.fromMe ? `You: ${preview}` : preview;

          return (
            <Tappable
              onPress={() => router.push({
                pathname: "/messages/thread",
                params: {
                  partner: item.partnerId,
                  partnerName: item.partnerName,
                  partnerAvatar: item.partnerAvatar ?? "",
                },
              })}
              style={styles.row}
              pressedStyle={styles.rowPressed}
            >
              {item.partnerAvatar ? (
                <Image source={{ uri: item.partnerAvatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{item.partnerName?.slice(0, 1).toUpperCase() ?? "?"}</Text>
                </View>
              )}

              <View style={styles.bodyWrap}>
                <View style={styles.metaRow}>
                  <Text style={styles.name}>{item.partnerName}</Text>
                  <Text style={styles.time}>{relativeTime(item.lastMessageAt)}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.preview} numberOfLines={1}>{label}</Text>
                  {item.unreadCount > 0 ? <View style={styles.unreadDot} /> : null}
                </View>
              </View>
            </Tappable>
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
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.green,
  },
});
