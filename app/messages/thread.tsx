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
import { NOTIFICATIONS_KEY } from "../../src/api/notifications";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { threadQueryKey, useSendMessage, useThread, type LegacyThreadResponse, type ThreadMessage } from "../../src/api/messages";
import { collapseSystemPairs } from "../../src/lib/system-pairs";
import { useActiveTrades, useTradeHistory } from "../../src/api/trades";
import type { ActiveTrade } from "../../src/api/types";
import { useBlockUser } from "../../src/api/item";
import { request } from "../../src/api/client";
import { uploadPhoto } from "../../src/api/post";
import { getActingOrgId } from "../../src/api/org-context";
import { subscribeToUserChannel } from "../../src/api/pusher";
import { useSession } from "../../src/auth/session";
import { Ionicons } from "@expo/vector-icons";
import { BlockIcon, ChevronLeftIcon, ChevronRightIcon } from "../../src/components/icons";
import { useKeyboardState } from "../../src/components/auth-sheet";
import { Tappable } from "../../src/components/Tappable";
import { SheetRow, SheetRows, SheetShell } from "../../src/components/sheet-ui";
import { ChatBubble, useBubbleContentMax, type GroupPosition } from "../../src/components/messages/ChatBubble";
import { renderMessageBody } from "../../src/components/messages/MessagePayloads";
import { chatTradeFor, offerHref, tradeHref } from "../../src/components/trades/present";
import { color, font, radius, textStyle } from "../../src/theme/tokens";
import { showDialog } from "../../src/components/dialog";
import { sizedImage } from "../../src/media/image-url";

/** Consecutive messages from one sender closer than this are one run. */
const GROUP_GAP_MS = 5 * 60 * 1000;
/** A gap at least this long gets a centred time, as in Messenger. */
const SEPARATOR_GAP_MS = 15 * 60 * 1000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "12:13 PM" today, "Mon 12:13 PM" this week, "Oct 3, 12:13 PM" before that. */
function separatorLabel(dateIso: string): string {
  const date = new Date(dateIso);
  const now = new Date();
  const hours = date.getHours();
  const clock = `${hours % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (date.getTime() >= startOfToday) return clock;
  if (date.getTime() >= startOfToday - 6 * 86400000) return `${WEEKDAYS[date.getDay()]} ${clock}`;
  const year = date.getFullYear() === now.getFullYear() ? "" : ` ${date.getFullYear()}`;
  return `${MONTHS[date.getMonth()]} ${date.getDate()}${year}, ${clock}`;
}

/** The JSON payload's `type`, or undefined for plain text. */
function payloadTypeOf(content: string): string | undefined {
  try {
    return (JSON.parse(content) as { type?: string }).type;
  } catch {
    return undefined;
  }
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
  // While typing, the camera/gallery buttons fold behind a chevron (Messenger).
  const [toolsOpen, setToolsOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const listRef = useRef<ScrollView | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // Timer for typing indication
  const typingClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const thread = useThread(partner ?? null);
  const activeTrades = useActiveTrades();
  const tradeHistory = useTradeHistory(true);
  const sendMessage = useSendMessage();
  const block = useBlockUser();
  const sortedMessages = useMemo(
    () => collapseSystemPairs(
      Array.from(
        new Map((thread.data?.messages ?? []).map((message) => [message.id, message])).values(),
      ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      partner ?? null,
    ),
    [thread.data, partner],
  );
  // The newest offer_update per offer: its status, and the trade it became.
  const offerStatuses = useMemo(() => {
    const statuses = new Map<string, { status: string; tradeId: string | null }>();
    for (const message of sortedMessages) {
      try {
        const payload = JSON.parse(message.content) as { type?: string; offerId?: unknown; status?: unknown; tradeId?: unknown };
        if (payload.type === "offer_update" && typeof payload.offerId === "string" && typeof payload.status === "string") {
          statuses.set(payload.offerId, {
            status: payload.status,
            tradeId: typeof payload.tradeId === "string" ? payload.tradeId : null,
          });
        }
      } catch {
        // Plain-text messages are not offer payloads.
      }
    }
    return statuses;
  }, [sortedMessages]);

  const onNewMessage = useCallback((message: Omit<ThreadMessage, "read">) => {
    if (!partner || message.senderId !== partner) return;
    queryClient.setQueryData<LegacyThreadResponse>(threadQueryKey(partner), (current) => {
      if (!current || current.messages.some((item) => item.id === message.id)) return current;
      return { ...current, messages: [...current.messages, { ...message, read: true }] };
    });
    // Drawn as read above, but only the thread GET marks it read on the
    // server, so refetch: without this a message that arrived while the chat
    // was open stayed unread until the chat was opened again.
    void queryClient.invalidateQueries({ queryKey: threadQueryKey(partner) });
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

  // The INBOX's channel: the shop's while acting as it, where the partner's
  // messages to the shop are published. See the note in src/api/messages.
  const inboxId = thread.data?.currentUserId || session?.user.id;
  useEffect(() => {
    if (!inboxId) return;
    return subscribeToUserChannel(inboxId, onNewMessage, onTyping, onOfferUpdated) ?? undefined;
  }, [onNewMessage, onOfferUpdated, onTyping, inboxId]);

  // Every thread fetch marks it read on the server (messages, and since 20 Oct
  // the bell's message row), so everything counting unread is refreshed: the
  // list, and the header badges, which come from /home.
  useEffect(() => {
    if (thread.data) {
      void queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["home"] });
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
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

  const pickImage = async (source: "camera" | "library") => {
    if (!partner || uploadingImage) return;
    const permission = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setSendError(source === "camera" ? "Camera access is needed to take a photo." : "Photo access is needed to attach an image.");
      return;
    }
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 0.85, exif: false })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.85,
          selectionLimit: 1,
        });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploadingImage(true);
    setSendError(null);
    try {
      // uploadPhoto() resizes to a JPEG first, like every other photo.
      const { url } = await uploadPhoto(asset.uri);
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

  /** Sends the draft, or `quick` (the thumbs-up) without touching the draft. */
  const onSend = async (quick?: string) => {
    const content = quick ?? draft.trim();
    if (!partner || !content) return;
    setSending(true);
    setSendError(null);

    try {
      await sendMessage.mutateAsync({ partnerId: partner, content });
      if (!quick) {
        setDraft("");
        setToolsOpen(false);
        Keyboard.dismiss();
      }
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
  const bubbleContentMax = useBubbleContentMax();
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

  // Messenger's layout, computed once per message list: a centred time where
  // the gap is long, runs of one sender's messages (only the run's last bubble
  // carries the face), and "Seen"/"Sent" under your newest message.
  const layout = useMemo(() => {
    const types = sortedMessages.map((message) => payloadTypeOf(message.content));
    const isSystemAt = (index: number) => types[index] === "offer_update" || types[index] === "trade_completed";
    const separatorAt = (index: number) =>
      index === 0 ||
      new Date(sortedMessages[index].createdAt).getTime() - new Date(sortedMessages[index - 1].createdAt).getTime() >= SEPARATOR_GAP_MS;
    const joins = (above: number, below: number) =>
      above >= 0 &&
      below < sortedMessages.length &&
      !isSystemAt(above) &&
      !isSystemAt(below) &&
      !separatorAt(below) &&
      sortedMessages[above].senderId === sortedMessages[below].senderId &&
      new Date(sortedMessages[below].createdAt).getTime() - new Date(sortedMessages[above].createdAt).getTime() < GROUP_GAP_MS;
    let lastMine = -1;
    sortedMessages.forEach((message, index) => {
      if (message.senderId === currentUserId && !isSystemAt(index)) lastMine = index;
    });
    return sortedMessages.map((message, index) => {
      const up = joins(index - 1, index);
      const down = joins(index, index + 1);
      const position: GroupPosition = up && down ? "middle" : up ? "last" : down ? "first" : "single";
      return {
        separator: separatorAt(index) ? separatorLabel(message.createdAt) : null,
        position,
        footer: index === lastMine ? (message.read ? "Seen" : "Sent") : null,
      };
    });
  }, [sortedMessages, currentUserId]);

  const composing = draft.trim().length > 0;
  const showTools = !composing || toolsOpen;
  const openProfile = () => {
    // /view-profile is a ROOT-stack route, so it opens on top of this chat and
    // Back returns here. `/user` is a tab and cannot. See app/view-profile.tsx.
    if (partner) router.push({ pathname: "/view-profile", params: { id: partner } });
  };
  const avatarNode = (size: number) =>
    otherAvatar ? (
      <Image source={{ uri: sizedImage(otherAvatar, "thumb") }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    ) : (
      <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.avatarInitial, { fontSize: Math.round(size * 0.42) }]}>{otherName.slice(0, 1).toUpperCase()}</Text>
      </View>
    );

  return (
    <View style={[styles.screen, { backgroundColor: palette.surface, paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + HEADER_HEIGHT, backgroundColor: palette.surface, borderBottomColor: palette.divider }]}>
        <Tappable onPress={() => router.back()} style={styles.iconButton} pressedStyle={{ backgroundColor: palette.control }} accessibilityLabel="Go back">
          <ChevronLeftIcon size={24} stroke={2} color={palette.forest} />
        </Tappable>
        <Tappable
          onPress={openProfile}
          style={styles.identity}
          pressedStyle={{ backgroundColor: palette.control }}
          accessibilityRole="button"
          accessibilityLabel={`View ${otherName}'s profile`}
        >
          {avatarNode(36)}
          <View style={styles.identityText}>
            <Text style={[styles.title, { color: palette.ink }]} numberOfLines={1}>{otherName}</Text>
            {typingName ? <Text style={[styles.subtitle, { color: palette.forest }]} numberOfLines={1}>typing…</Text> : null}
          </View>
        </Tappable>
        {/* The menu's only action is Block (hiding conversations was removed in
            schema v2), and blocking is not offered while acting as a shop. */}
        {getActingOrgId() ? null : (
          <Tappable onPress={() => setMenuOpen(true)} style={styles.iconButton} pressedStyle={{ backgroundColor: palette.control }} accessibilityLabel="Conversation options">
            <Ionicons name="information-circle-outline" size={24} color={palette.forest} />
          </Tappable>
        )}
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
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          >
            {/* Messenger's thread opener: who you are talking to. */}
            <View style={styles.intro}>
              {avatarNode(72)}
              <Text style={[styles.introName, { color: palette.ink }]} numberOfLines={1}>{otherName}</Text>
              <Tappable onPress={openProfile} style={[styles.introButton, { backgroundColor: palette.control }]} pressedStyle={styles.pressedDim} accessibilityRole="button">
                <Text style={[styles.introButtonText, { color: palette.ink }]}>View profile</Text>
              </Tappable>
            </View>
            {sortedMessages.map((message, index) => {
              const mine = message.senderId === currentUserId;
              let displayContent = message.content;
              let offerTradeId: string | null = null;
              let offerTrade: ActiveTrade | null = null;
              let isOffer = false;
              try {
                const payload = JSON.parse(message.content) as { type?: string; offerId?: unknown };
                if (payload.type === "offer" && typeof payload.offerId === "string") {
                  isOffer = true;
                  const update = offerStatuses.get(payload.offerId);
                  if (update) {
                    displayContent = JSON.stringify({ ...payload, status: update.status });
                    offerTradeId = update.tradeId;
                  }
                  offerTrade = chatTradeFor(payload.offerId, update?.tradeId ?? null, tradesById);
                }
              } catch {
                // Plain-text messages are rendered unchanged.
              }
              // System rows ("You declined the offer", "Trade completed") are
              // centred pills belonging to neither side.
              const payloadType = payloadTypeOf(displayContent);
              const isOfferUpdate = payloadType === "offer_update";
              const isSystem = isOfferUpdate || payloadType === "trade_completed";
              const { separator, position, footer } = layout[index];
              return (
                <View key={message.id}>
                  {separator ? <Text style={[styles.separator, { color: palette.inkSecondary }]}>{separator}</Text> : null}
                  <ChatBubble
                    mine={mine}
                    kind={isSystem ? "status" : isOffer ? "card" : payloadType === "image" ? "media" : "bubble"}
                    position={position}
                    footer={footer}
                    avatar={avatarNode(28)}
                  >
                    {renderMessageBody({
                      content: displayContent,
                      mine,
                      contentMax: bubbleContentMax,
                      onImagePress: setLightboxUrl,
                      // An offer opens its trade screen; an offer_update's
                      // "Open trade" passes the trade id it carries.
                      onOfferPress: (id) => {
                        router.push(isOfferUpdate ? tradeHref(id) : offerHref(id));
                      },
                      onOpenTrade: (tradeId) => router.push(tradeHref(tradeId)),
                      offerTradeId,
                      offerTrade,
                      partnerName: otherName,
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
                  </ChatBubble>
                </View>
              );
            })}
          </ScrollView>

          {sendError ? <Text style={[styles.sendError, { color: palette.inkSecondary }]}>{sendError}</Text> : null}

          {/* Messenger's composer: photo tools on the left, a pill field, and a
              thumbs-up that becomes Send once something is typed. While typing,
              the tools fold behind a chevron to give the field room. */}
          <View style={[styles.composer, { backgroundColor: palette.surface, marginBottom: keyboardUp ? Math.max(imeHeight, 8) : 8 }]}>
            {showTools ? (
              <>
                <Tappable
                  onPress={() => void pickImage("camera")}
                  disabled={sending || uploadingImage}
                  style={styles.toolButton}
                  pressedStyle={{ backgroundColor: palette.control }}
                  accessibilityLabel="Take a photo"
                >
                  <Ionicons name="camera-outline" size={24} color={palette.forest} />
                </Tappable>
                <Tappable
                  onPress={() => void pickImage("library")}
                  disabled={sending || uploadingImage}
                  style={styles.toolButton}
                  pressedStyle={{ backgroundColor: palette.control }}
                  accessibilityLabel="Attach a photo"
                >
                  {uploadingImage ? <ActivityIndicator size="small" color={palette.forest} /> : <Ionicons name="image-outline" size={24} color={palette.forest} />}
                </Tappable>
              </>
            ) : (
              <Tappable onPress={() => setToolsOpen(true)} style={styles.toolButton} pressedStyle={{ backgroundColor: palette.control }} accessibilityLabel="Show photo options">
                <ChevronRightIcon size={24} stroke={2} color={palette.forest} />
              </Tappable>
            )}
            <TextInput
              value={draft}
              onChangeText={(value) => {
                if (toolsOpen) setToolsOpen(false);
                notifyTyping(value);
              }}
              placeholder="Message"
              multiline
              style={[styles.input, { backgroundColor: palette.control, color: palette.ink }]}
              placeholderTextColor={palette.inkSecondary}
            />
            <Tappable
              onPress={() => void (composing ? onSend() : onSend("\u{1F44D}"))}
              disabled={sending}
              style={[styles.toolButton, sending && styles.sendButtonDisabled]}
              pressedStyle={{ backgroundColor: palette.control }}
              accessibilityLabel={composing ? "Send" : "Send a thumbs up"}
            >
              {composing ? <Ionicons name="send" size={24} color={palette.forest} /> : <Ionicons name="thumbs-up" size={24} color={palette.forest} />}
            </Tappable>
          </View>
        </>
      )}
      <ConversationMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        colors={palette}
        // Not while acting as a shop: POST /api/v1/blocks acts as the PERSON, so
        // it would block from their own account and leave the shop's thread
        // open. Shop-level blocking is not built.
        onBlock={getActingOrgId() ? undefined : confirmBlock}
      />
      <Modal visible={!!lightboxUrl} transparent animationType="fade" onRequestClose={() => setLightboxUrl(null)}>
        <Pressable style={styles.lightbox} onPress={() => setLightboxUrl(null)} accessibilityLabel="Close full-screen image">
          {lightboxUrl ? <Image source={{ uri: sizedImage(lightboxUrl, "full") }} style={styles.fullImage} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </View>
  );
}

function ConversationMenu({
  visible,
  onClose,
  onBlock,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onBlock?: () => void;
  colors: { surface: string; ink: string; inkSecondary: string; divider: string; controlLine: string; urgent: string };
}) {
  if (!visible) return null;
  return (
    <SheetShell title="Conversation" onClose={onClose} colors={colors}>
      <SheetRows>
        {onBlock ? <SheetRow glyph={<BlockIcon size={20} stroke={1.6} color={colors.urgent} />} label="Block account" destructive colors={colors} onPress={onBlock} /> : null}
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

const HEADER_HEIGHT = 60;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.divider,
    backgroundColor: color.surface,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  identity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...textStyle({ fontFamily: font.displaySemi, fontSize: 17 }),
    color: color.ink,
  },
  subtitle: {
    fontFamily: font.sans,
    fontSize: 12,
    marginTop: 1,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.forest,
  },
  avatarInitial: {
    fontFamily: font.displaySemi,
    color: color.surface,
  },
  pressedDim: {
    opacity: 0.8,
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
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  intro: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 20,
    gap: 8,
  },
  introName: {
    ...textStyle({ fontFamily: font.displaySemi, fontSize: 18 }),
    maxWidth: "80%",
  },
  introButton: {
    minHeight: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  introButtonText: {
    fontFamily: font.sansSemi,
    fontSize: 13,
  },
  separator: {
    alignSelf: "center",
    fontFamily: font.sansSemi,
    fontSize: 11,
    marginTop: 8,
    marginBottom: 10,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    paddingHorizontal: 6,
    paddingTop: 6,
  },
  toolButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    marginHorizontal: 4,
    marginBottom: 1,
    borderRadius: 20,
    backgroundColor: color.control,
    paddingHorizontal: 16,
    paddingTop: 9,
    paddingBottom: 9,
    fontFamily: font.sans,
    fontSize: 15,
    color: color.ink,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendError: {
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
