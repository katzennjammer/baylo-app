import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSendMessage, useThread, type LegacyThreadResponse, type ThreadMessage } from "../../src/api/messages";
import { request } from "../../src/api/client";
import { subscribeToUserChannel } from "../../src/api/pusher";
import { useSession } from "../../src/auth/session";
import { ImageIcon } from "../../src/components/icons";
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
  const { partner, partnerName, partnerAvatar } = useLocalSearchParams<{
    partner?: string;
    partnerName?: string;
    partnerAvatar?: string;
  }>();
  const { keyboardUp, imeHeight } = useKeyboardState();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [typingName, setTypingName] = useState<string | null>(null);
  const listRef = useRef<ScrollView | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // Timer for typing indication
  const typingClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const thread = useThread(partner ?? null);
  const sendMessage = useSendMessage();
  const sortedMessages = useMemo(
    () => [...(thread.data?.messages ?? [])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    ),
    [thread.data],
  );

  const onNewMessage = useCallback((message: Omit<ThreadMessage, "read">) => {
    if (!partner || message.senderId !== partner) return;
    queryClient.setQueryData<LegacyThreadResponse>(["messages", "thread", partner], (current) => {
      if (!current || current.messages.some((item) => item.id === message.id)) return current;
      return { ...current, messages: [...current.messages, { ...message, read: true }] };
    });
    listRef.current?.scrollToEnd({ animated: true });
  }, [partner, queryClient]);

  const onTyping = useCallback((event: { senderId: string; senderName: string; isTyping: boolean }) => {
    if (event.senderId !== partner) return;
    setTypingName(event.isTyping ? event.senderName : null);
    if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
    if (event.isTyping) {
      typingClearTimer.current = setTimeout(() => setTypingName(null), 2500);
    }
  }, [partner]);

  useEffect(() => {
    if (!session?.user.id) return;
    return subscribeToUserChannel(session.user.id, onNewMessage, onTyping) ?? undefined;
  }, [onNewMessage, onTyping, session?.user.id]);

  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
  }, []);

  const notifyTyping = (value: string) => {
    setDraft(value);
    if (!partner) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      void request("/api/messages/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: partner, isTyping: value.trim().length > 0 }),
      });
    }, 250);
  };

  const pickImage = async () => {
    if (!partner || uploadingImage) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setSendError("Photo access is needed to attach an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      selectionLimit: 1,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploadingImage(true);
    setSendError(null);
    try {
      const form = new FormData();
      form.append("file", {
        uri: asset.uri,
        name: asset.fileName ?? "photo.jpg",
        type: asset.mimeType ?? "image/jpeg",
      } as unknown as Blob);
      const upload = await request("/api/upload", { method: "POST", body: form });
      if (!upload.ok) throw new Error("Photo upload failed.");
      const { url } = (await upload.json()) as { url: string };
      await sendMessage.mutateAsync({
        partnerId: partner,
        content: JSON.stringify({ type: "image", url, caption: null }),
      });
      await thread.refetch();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Photo could not be sent.");
    } finally {
      setUploadingImage(false);
    }
  };

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
  const otherName = thread.data?.partnerName ?? partnerName ?? "Conversation";
  const otherAvatar = thread.data?.partnerAvatar ?? partnerAvatar ?? "";

  return (
    <View style={[styles.screen, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={[styles.header, { height: insets.top + 52 }]}> 
        <Tappable onPress={() => router.back()} style={styles.backButton} pressedStyle={styles.backButtonPressed}>
          <Text style={styles.backText}>←</Text>
        </Tappable>
        <Text style={styles.title}>{otherName}</Text>
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
                  {!mine ? (
                    <View style={styles.avatarColumn}>
                      {otherAvatar ? (
                        <Image source={{ uri: otherAvatar }} style={styles.messageAvatar} />
                      ) : (
                        <View style={styles.messageAvatarFallback}>
                          <Text style={styles.messageAvatarInitial}>{otherName.slice(0, 1).toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                  ) : null}
                  <View style={styles.messageContent}>
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheir]}>
                      {renderMessageBody({ content: message.content, mine })}
                    </View>
                    <Text style={styles.time}>{relativeTime(message.createdAt)}</Text>
                  </View>
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
            <Tappable
              onPress={() => void pickImage()}
              disabled={sending || uploadingImage}
              style={styles.attachButton}
              pressedStyle={styles.attachButtonPressed}
              accessibilityLabel="Attach a photo"
            >
              <ImageIcon size={20} stroke={1.8} color={color.forest} />
            </Tappable>
            <TextInput
              value={draft}
              onChangeText={notifyTyping}
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
          {typingName ? <Text style={styles.typing}>{typingName} is typing…</Text> : null}
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
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingTop: 0,
    paddingBottom: 0,
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
    transform: [{ translateY: 16 }],
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
    flex: 1,
    transform: [{ translateY: 16 }],
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
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 8,
  },
  avatarColumn: {
    width: 28,
    alignSelf: "flex-end",
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  messageAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.forest,
  },
  messageAvatarInitial: {
    fontFamily: font.displaySemi,
    fontSize: 12,
    color: color.surface,
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
  },
  messageContent: {
    maxWidth: "80%",
    minWidth: 0,
    flexShrink: 1,
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
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: color.greenLine,
    alignItems: "center",
    justifyContent: "center",
  },
  attachButtonPressed: {
    backgroundColor: color.greenWash,
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
  typing: {
    marginHorizontal: 12,
    marginBottom: 8,
    color: color.inkSecondary,
    fontFamily: font.sans,
    fontSize: 12,
  },
});
