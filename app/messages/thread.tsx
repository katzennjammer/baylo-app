import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSendMessage, useThread } from "../../src/api/messages";
import { useKeyboardState } from "../../src/components/auth-sheet";
import { Tappable } from "../../src/components/Tappable";
import { renderMessageBody } from "../../src/components/messages/MessagePayloads";
import { color, font, radius, textStyle } from "../../src/theme/tokens";

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

export default function MessagesThreadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { partner } = useLocalSearchParams<{ partner?: string }>();
  const { keyboardUp, imeHeight } = useKeyboardState();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<ScrollView | null>(null);

  const thread = useThread(partner ?? null);
  const sendMessage = useSendMessage();
  const sortedMessages = useMemo(
    () => [...(thread.data?.messages ?? [])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    ),
    [thread.data],
  );

  const onSend = async () => {
    if (!partner || !draft.trim()) return;
    setSending(true);
    setSendError(null);

    try {
      await sendMessage.mutateAsync({ partnerId: partner, content: draft.trim() });
      setDraft("");
      Keyboard.dismiss();
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 50);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Your message could not be sent.";
      setSendError(message);
    } finally {
      setSending(false);
    }
  };

  const currentUserId = thread.data?.currentUserId ?? "";

  return (
    <View style={[styles.screen, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.header}>
        <Tappable onPress={() => router.back()} style={styles.backButton} pressedStyle={styles.backButtonPressed}>
          <Text style={styles.backText}>←</Text>
        </Tappable>
        <Text style={styles.title}>{thread.data?.partnerName ?? "Conversation"}</Text>
      </View>

      {thread.isPending ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={color.forest} />
        </View>
      ) : thread.isError ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>This conversation failed to load.</Text>
        </View>
      ) : (
        <>
          <ScrollView
            ref={listRef}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          >
            {sortedMessages.map((message) => {
              const mine = message.senderId === currentUserId;
              return (
                <View key={message.id} style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheir]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheir]}>
                    {renderMessageBody({ content: message.content, mine })}
                  </View>
                  <Text style={styles.time}>{relativeTime(message.createdAt)}</Text>
                </View>
              );
            })}
          </ScrollView>

          {sendError ? <Text style={styles.sendError}>{sendError}</Text> : null}

          <View
            style={[
              styles.composer,
              {
                marginBottom: keyboardUp ? Math.max(imeHeight, 12) : 12,
              },
            ]}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message…"
              multiline
              style={styles.input}
              placeholderTextColor={color.inkSecondary}
            />
            <Tappable
              onPress={() => void onSend()}
              disabled={sending || !draft.trim()}
              style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]}
              pressedStyle={styles.sendButtonPressed}
            >
              <Text style={styles.sendButtonText}>{sending ? "…" : "Send"}</Text>
            </Tappable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
    backgroundColor: color.surface,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  backButtonPressed: {
    backgroundColor: color.control,
  },
  backText: {
    fontSize: 22,
    color: color.ink,
  },
  title: {
    ...textStyle({ fontFamily: font.displaySemi, fontSize: 18 }),
    color: color.ink,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: color.surface,
  },
  emptyTitle: {
    ...textStyle({ fontFamily: font.displayBold, fontSize: 22, lineHeight: 28 }),
    color: color.ink,
    textAlign: "center",
  },
  list: {
    flex: 1,
    backgroundColor: color.surface,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
  },
  bubbleRow: {
    marginBottom: 12,
  },
  bubbleRowMine: {
    alignItems: "flex-end",
  },
  bubbleRowTheir: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
  },
  bubbleMine: {
    backgroundColor: color.forest,
    borderColor: color.forest,
  },
  bubbleTheir: {
    backgroundColor: color.control,
    borderColor: color.divider,
  },
  time: {
    fontFamily: font.mono,
    fontSize: 10,
    color: color.inkSecondary,
    marginTop: 4,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: color.divider,
    backgroundColor: color.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: color.controlLine,
    backgroundColor: color.control,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: font.sans,
    fontSize: 14,
    color: color.ink,
  },
  sendButton: {
    minWidth: 72,
    height: 44,
    borderRadius: 14,
    backgroundColor: color.forest,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonPressed: {
    opacity: 0.9,
  },
  sendButtonText: {
    fontFamily: font.sansSemi,
    fontSize: 14,
    color: color.surface,
  },
  sendError: {
    marginHorizontal: 12,
    marginBottom: 8,
    color: color.inkSecondary,
    fontFamily: font.sans,
    fontSize: 12,
  },
});
