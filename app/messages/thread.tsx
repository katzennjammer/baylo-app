import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDeleteConversation, useSendMessage, useThread, type LegacyThreadResponse, type ThreadMessage } from "../../src/api/messages";
import { useActiveTrades, useTradeHistory } from "../../src/api/trades";
import { useBlockUser } from "../../src/api/item";
import { request } from "../../src/api/client";
import { subscribeToUserChannel } from "../../src/api/pusher";
import { useSession } from "../../src/auth/session";
import { BlockIcon, ChevronLeftIcon, ImageIcon, KebabIcon, TrashIcon } from "../../src/components/icons";
import { useKeyboardState } from "../../src/components/auth-sheet";
import { Tappable } from "../../src/components/Tappable";
import { SheetRow, SheetRows, SheetShell } from "../../src/components/sheet-ui";
import { renderMessageBody } from "../../src/components/messages/MessagePayloads";
import { color, font, radius, textStyle } from "../../src/theme/tokens";
import { showDialog } from "../../src/components/dialog";

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
  const dark = useColorScheme() === "dark";
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [typingName, setTypingName] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const listRef = useRef<ScrollView | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // Timer for typing indication
  const typingClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const thread = useThread(partner ?? null);
  const activeTrades = useActiveTrades();
  const tradeHistory = useTradeHistory(true);
  const sendMessage = useSendMessage();
  const block = useBlockUser();
  const deleteConversation = useDeleteConversation();
  const sortedMessages = useMemo(
    () => Array.from(
      new Map((thread.data?.messages ?? []).map((message) => [message.id, message])).values(),
    ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [thread.data],
  );
  const offerStatuses = useMemo(() => {
    const statuses = new Map<string, string>();
    for (const message of sortedMessages) {
      try {
        const payload = JSON.parse(message.content) as { type?: string; offerId?: unknown; status?: unknown };
        if (payload.type === "offer_update" && typeof payload.offerId === "string" && typeof payload.status === "string") {
          statuses.set(payload.offerId, payload.status);
        }
      } catch {
        // Plain-text messages are not offer payloads.
      }
    }
    return statuses;
  }, [sortedMessages]);

  const onNewMessage = useCallback((message: Omit<ThreadMessage, "read">) => {
    if (!partner || message.senderId !== partner) return;
    queryClient.setQueryData<LegacyThreadResponse>(["messages", "thread", partner], (current) => {
      if (!current || current.messages.some((item) => item.id === message.id)) return current;
      return { ...current, messages: [...current.messages, { ...message, read: true }] };
    });
    listRef.current?.scrollToEnd({ animated: true });
  }, [partner, queryClient]);

  const onOfferUpdated = useCallback((event: {
    systemMessage?: Omit<ThreadMessage, "read">;
  }) => {
    if (event.systemMessage) onNewMessage(event.systemMessage);
  }, [onNewMessage]);

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
    return subscribeToUserChannel(session.user.id, onNewMessage, onTyping, onOfferUpdated) ?? undefined;
  }, [onNewMessage, onOfferUpdated, onTyping, session?.user.id]);

  useEffect(() => {
    if (thread.data) {
      void queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    }
  }, [queryClient, thread.data]);

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
  const tradesById = new Map([
    ...(activeTrades.data?.trades ?? []),
    ...(tradeHistory.data?.trades ?? []),
  ].map((trade) => [trade.id, trade]));

  const palette = dark ? darkColors : lightColors;

  const confirmBlock = () => {
    if (!partner) return;
    setMenuOpen(false);
    showDialog(
      `Block ${otherName}?`,
      "You will not see each other's listings and neither of you can message the other. Trades already in progress are not cancelled.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => block.mutate(partner, { onSuccess: () => router.back() }),
        },
      ],
    );
  };

  const confirmDelete = () => {
    if (!partner) return;
    setMenuOpen(false);
    showDialog(
      "Hide conversation?",
      "This removes the conversation from your view only. Messages are kept for both people and for reports.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteConversation.mutate(partner, { onSuccess: () => router.back() }),
        },
      ],
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.surface, paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={[styles.header, { height: insets.top + 52, backgroundColor: palette.surface, borderBottomColor: palette.divider }]}>
        <Tappable onPress={() => router.back()} style={styles.backButton} pressedStyle={styles.backButtonPressed}>
          <ChevronLeftIcon size={22} stroke={1.8} color={palette.ink} />
        </Tappable>
        <Tappable
          onPress={() => partner && router.push(`/user?id=${encodeURIComponent(partner)}`)}
          style={styles.titleButton}
          pressedStyle={styles.backButtonPressed}
          accessibilityRole="button"
          accessibilityLabel={`View ${otherName}'s profile`}
        >
          <Text style={[styles.title, { color: palette.ink }]} numberOfLines={1}>{otherName}</Text>
        </Tappable>
        <Tappable onPress={() => setMenuOpen(true)} style={styles.menuButton} pressedStyle={styles.backButtonPressed} accessibilityLabel="Conversation options">
          <KebabIcon size={20} color={palette.ink} />
        </Tappable>
      </View>

      {thread.isPending ? (
        <View style={styles.centered}>
            <ActivityIndicator size="small" color={palette.forest} />
        </View>
      ) : thread.isError ? (
        <View style={styles.centered}>
            <Text style={[styles.emptyTitle, { color: palette.ink }]}>This conversation failed to load.</Text>
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
              let displayContent = message.content;
              try {
                const payload = JSON.parse(message.content) as { type?: string; offerId?: unknown };
                if (payload.type === "offer" && typeof payload.offerId === "string") {
                  const status = offerStatuses.get(payload.offerId);
                  if (status) displayContent = JSON.stringify({ ...payload, status });
                }
              } catch {
                // Plain-text messages are rendered unchanged.
              }
                  const isOfferUpdate = (() => {
                try {
                  return (JSON.parse(displayContent) as { type?: string }).type === "offer_update";
                } catch {
                  return false;
                }
              })();
              return (
                <View key={message.id} style={[styles.bubbleRow, isOfferUpdate ? styles.bubbleRowStatus : mine ? styles.bubbleRowMine : styles.bubbleRowTheir]}>
                  {!mine && !isOfferUpdate ? (
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
                    <View style={[styles.bubble, isOfferUpdate ? styles.statusBubble : mine ? styles.bubbleMine : styles.bubbleTheir]}>
                      {renderMessageBody({
                        content: displayContent,
                        mine,
                        onImagePress: setLightboxUrl,
                        onOfferPress: (id) => {
                          try {
                            const payload = JSON.parse(message.content) as { type?: string; tradeId?: unknown };
                            if (__DEV__) console.log("[messages/offer_update_lookup]", { payload, trade: activeTrades.data?.trades.find((trade) => trade.id === payload.tradeId) ?? null });
                            router.push(payload.type === "offer_update" && typeof payload.tradeId === "string"
                              ? `/trade-code?id=${encodeURIComponent(payload.tradeId)}&returnTo=trades`
                              : `/offer-review?id=${encodeURIComponent(id)}`);
                          } catch {
                            router.push(`/offer-review?id=${encodeURIComponent(id)}`);
                          }
                        },
                        onRatePress: (tradeId) => router.push(`/rate-trade?id=${encodeURIComponent(tradeId)}`),
                        offerDetails: (() => {
                          try {
                            const payload = JSON.parse(message.content) as { offerId?: unknown };
                            return typeof payload.offerId === "string"
                              ? activeTrades.data?.offers.find((offer) => offer.id === payload.offerId)
                              : undefined;
                          } catch {
                            return undefined;
                          }
                        })(),
                        tradeDetails: (() => {
                          try {
                            const payload = JSON.parse(message.content) as { tradeId?: unknown };
                            return typeof payload.tradeId === "string"
                              ? tradesById.get(payload.tradeId)
                              : undefined;
                          } catch {
                            return undefined;
                          }
                        })(),
                      })}
                    </View>
                    <Text style={styles.time}>{relativeTime(message.createdAt)}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {sendError ? <Text style={[styles.sendError, { color: palette.inkSecondary }]}>{sendError}</Text> : null}

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
              <ImageIcon size={20} stroke={1.8} color={palette.forest} />
            </Tappable>
            <TextInput
              value={draft}
              onChangeText={notifyTyping}
              placeholder="Type a message…"
              multiline
              style={styles.input}
              placeholderTextColor={palette.inkSecondary}
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
      <ConversationMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        colors={palette}
        onBlock={confirmBlock}
        onDelete={confirmDelete}
      />
      <Modal visible={!!lightboxUrl} transparent animationType="fade" onRequestClose={() => setLightboxUrl(null)}>
        <Pressable style={styles.lightbox} onPress={() => setLightboxUrl(null)} accessibilityLabel="Close full-screen image">
          {lightboxUrl ? <Image source={{ uri: lightboxUrl }} style={styles.fullImage} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </View>
  );
}

function ConversationMenu({
  visible,
  onClose,
  onBlock,
  onDelete,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onBlock: () => void;
  onDelete: () => void;
  colors: { surface: string; ink: string; inkSecondary: string; divider: string; controlLine: string; urgent: string };
}) {
  if (!visible) return null;
  return (
    <SheetShell title="Conversation" onClose={onClose} colors={colors}>
      <SheetRows>
        <SheetRow glyph={<BlockIcon size={20} stroke={1.6} color={colors.urgent} />} label="Block account" destructive colors={colors} onPress={onBlock} />
        <SheetRow glyph={<TrashIcon size={20} stroke={1.6} color={colors.urgent} />} label="Delete conversation" destructive colors={colors} onPress={onDelete} />
      </SheetRows>
    </SheetShell>
  );
}

const lightColors = { ...color, surface: color.surface, forest: color.forest };
const darkColors = {
  ...color,
  surface: "#14140F",
  control: "#2C2A22",
  ink: "#FAFAF7",
  inkSecondary: "#C5C1B5",
  inkMuted: "#999487",
  divider: "#4A473C",
  controlLine: "#4A473C",
  forest: "#3DBE5A",
  urgent: "#F08A69",
};

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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 0,
    transform: [{ translateY: 16 }],
  },
  backButtonPressed: {
    backgroundColor: color.control,
  },
  titleButton: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    transform: [{ translateY: 16 }],
  },
  menuButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: 16 }],
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
  bubbleRowStatus: {
    alignItems: "center",
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
  statusBubble: {
    maxWidth: "100%",
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
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
  lightbox: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
});
