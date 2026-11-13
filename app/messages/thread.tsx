import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Keyboard,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { NOTIFICATIONS_KEY } from "../../src/api/notifications";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { threadQueryKey, useChatSettings, useSendMessage, useThread, useUpdateChatSettings, type LegacyThreadResponse, type ThreadMessage } from "../../src/api/messages";
import { ApiError, request } from "../../src/api/client";
import { usePublicProfile } from "../../src/api/profile";
import { collapseSystemPairs } from "../../src/lib/system-pairs";
import { useActiveTrades, useTradeHistory } from "../../src/api/trades";
import type { ActiveTrade } from "../../src/api/types";
import { PinnedTrade } from "../../src/components/messages/PinnedTrade";
import { QuotedReply, SwipeToReply } from "../../src/components/messages/SwipeToReply";
import { useBlockUser } from "../../src/api/item";
import { uploadPhoto } from "../../src/api/post";
import { getActingOrgId } from "../../src/api/org-context";
import { subscribeToUserChannel } from "../../src/api/pusher";
import { useSession } from "../../src/auth/session";
import { clearActiveConversationPartnerId, setActiveConversationPartnerId } from "../../src/notifications/active-conversation";
import { dismissNotificationsForPartner } from "../../src/notifications/conversation-notifications";
import { Ionicons } from "@expo/vector-icons";
import { BlockIcon, ChevronLeftIcon, ChevronRightIcon, PersonIcon } from "../../src/components/icons";
import { useKeyboardState } from "../../src/components/auth-sheet";
import { Tappable } from "../../src/components/Tappable";
import { SheetRow, SheetRows, SheetShell } from "../../src/components/sheet-ui";
import { ChatBubble, useBubbleContentMax, type GroupPosition } from "../../src/components/messages/ChatBubble";
import { previewFromContent, renderMessageBody } from "../../src/components/messages/MessagePayloads";
import { chatTradeFor, offerHref, tradeHref } from "../../src/components/trades/present";
import { color, font, radius, textStyle } from "../../src/theme/tokens";
import { showDialog } from "../../src/components/dialog";
import { sizedImage } from "../../src/media/image-url";
import { cacheMeasuredChatImageSize } from "../../src/components/messages/chat-image-sizing";
import { StarText } from "../../src/components/StarText";
import { PremiumName } from "../../src/components/PremiumName";

/** Consecutive messages from one sender closer than this are one run. */
const GROUP_GAP_MS = 5 * 60 * 1000;
/** A gap at least this long gets a centred time, as in Messenger. */
const SEPARATOR_GAP_MS = 15 * 60 * 1000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isUnavailableConversationError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 403 || error.status === 404 || /blocked/i.test(`${error.code} ${error.message}`))
  );
}

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
  const { partner, partnerName, partnerAvatar, messageId, search } = useLocalSearchParams<{
    search?: string;
    partner?: string;
    partnerName?: string;
    partnerAvatar?: string;
    messageId?: string;
  }>();
  const { keyboardUp, imeHeight } = useKeyboardState();
  const { width: screenWidth } = useWindowDimensions();
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
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [initialScrollComplete, setInitialScrollComplete] = useState(false);
  const listRef = useRef<ScrollView | null>(null);
  const contentHeightRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const scrollYRef = useRef(0);
  const nearBottomRef = useRef(true);
  const pendingScrollRef = useRef<"initial" | "animated" | null>("initial");
  const knownMessageIdsRef = useRef(new Set<string>());
  const trackedPartnerRef = useRef(partner);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // Timer for typing indication
  const typingClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const thread = useThread(partner ?? null);
  const partnerProfile = usePublicProfile(partner);
  const unavailableHandled = useRef(false);
  const lastReadRefreshMessageId = useRef<string | null>(null);
  const activeTrades = useActiveTrades();
  const tradeHistory = useTradeHistory(true);
  const sendMessage = useSendMessage();
  const chatSettings = useChatSettings(partner);
  const standing = (() => {
    const p = partnerProfile.data;
    if (!p) return null;
    if (p.user.org) return p.user.org.verified ? "Verified shop" : "Shop";
    const tier = p.user.trustTier ? p.user.trustTier.charAt(0) + p.user.trustTier.slice(1).toLowerCase() : null;
    const rating = p.counts.reviews > 0 ? `★ ${p.user.rating.toFixed(1)}` : null;
    return [tier, rating].filter(Boolean).join(" · ") || null;
  })();
  const updateChat = useUpdateChatSettings(partner);
  // In-chat search (Chat info > Search): matches, and which one is shown.
  // Chat info's Search comes back here with ?search=1.
  const [searchOpen, setSearchOpen] = useState(search === "1");
  const [searchText, setSearchText] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  // Swipe to reply: the message being answered, shown above the field.
  const [replyingTo, setReplyingTo] = useState<ThreadMessage | null>(null);
  // Where each message sits in the list, so a quote can jump to its original.
  const messageY = useRef(new Map<string, number>());
  const [flashId, setFlashId] = useState<string | null>(null);
  const jumpTo = (id: string) => {
    const y = messageY.current.get(id);
    if (y === undefined) return;
    listRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
    setFlashId(id);
    setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1200);
  };
  const block = useBlockUser();
  const currentUserId = thread.data?.currentUserId ?? "";
  useEffect(() => {
    unavailableHandled.current = false;
  }, [partner]);
  useEffect(() => {
    if (unavailableHandled.current || !thread.isError || !isUnavailableConversationError(thread.error)) return;
    unavailableHandled.current = true;
    showDialog("Conversation unavailable", "This conversation could not be opened.");
    router.replace("/messages");
  }, [router, thread.error, thread.isError]);

  const sortedMessages = useMemo(
    () => collapseSystemPairs(
      Array.from(
        new Map((thread.data?.messages ?? []).map((message) => [message.id, message])).values(),
      ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      partner ?? null,
    ),
    [thread.data, partner],
  );

  const updateNearBottom = () => {
    const distance = contentHeightRef.current - viewportHeightRef.current - scrollYRef.current;
    nearBottomRef.current = distance <= 120;
    if (nearBottomRef.current) setNewMessageCount(0);
  };

  const performPendingScroll = () => {
    const mode = pendingScrollRef.current;
    if (!mode || !listRef.current || viewportHeightRef.current <= 0 || contentHeightRef.current <= 0) return;
    listRef.current.scrollToEnd({ animated: mode === "animated" });
    scrollYRef.current = Math.max(0, contentHeightRef.current - viewportHeightRef.current);
    pendingScrollRef.current = null;
    nearBottomRef.current = true;
    setNewMessageCount(0);
    if (mode === "initial") setInitialScrollComplete(true);
  };

  const requestBottomScroll = (mode: "initial" | "animated") => {
    if (pendingScrollRef.current !== "initial") pendingScrollRef.current = mode;
  };

  useLayoutEffect(() => {
    if (trackedPartnerRef.current !== partner) {
      trackedPartnerRef.current = partner;
      knownMessageIdsRef.current = new Set();
      pendingScrollRef.current = "initial";
      nearBottomRef.current = true;
      contentHeightRef.current = 0;
      viewportHeightRef.current = 0;
      scrollYRef.current = 0;
      setInitialScrollComplete(false);
      setNewMessageCount(0);
    }

    if (!partner || thread.isPending || thread.isError || thread.data?.partnerId !== partner) return;

    const ids = new Set(sortedMessages.map((message) => message.id));
    if (pendingScrollRef.current === "initial" && knownMessageIdsRef.current.size === 0) {
      knownMessageIdsRef.current = ids;
      performPendingScroll();
      return;
    }

    const additions = sortedMessages.filter((message) => !knownMessageIdsRef.current.has(message.id));
    knownMessageIdsRef.current = ids;
    if (additions.length === 0) return;

    if (additions.some((message) => message.senderId === currentUserId)) {
      setNewMessageCount(0);
      requestBottomScroll("animated");
    } else if (nearBottomRef.current) {
      requestBottomScroll("animated");
    } else {
      setNewMessageCount((count) => count + additions.length);
    }
  }, [currentUserId, partner, sortedMessages, thread.data?.partnerId, thread.isError, thread.isPending]);

  const onMessageListContentSizeChange = (_width: number, height: number) => {
    const wasNearBottom = nearBottomRef.current;
    contentHeightRef.current = height;
    if (pendingScrollRef.current) {
      performPendingScroll();
    } else if (wasNearBottom) {
      listRef.current?.scrollToEnd({ animated: false });
      scrollYRef.current = Math.max(0, contentHeightRef.current - viewportHeightRef.current);
      updateNearBottom();
    } else {
      updateNearBottom();
    }
  };

  const onMessageListLayout = (height: number) => {
    const wasNearBottom = nearBottomRef.current;
    viewportHeightRef.current = height;
    if (pendingScrollRef.current) {
      performPendingScroll();
    } else if (wasNearBottom) {
      listRef.current?.scrollToEnd({ animated: false });
      scrollYRef.current = Math.max(0, contentHeightRef.current - viewportHeightRef.current);
      updateNearBottom();
    } else {
      updateNearBottom();
    }
  };
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
  }, [partner, queryClient]);

  const onOfferUpdated = useCallback((event: {
    systemMessage?: Omit<ThreadMessage, "read">;
  }) => {
    if (event.systemMessage) onNewMessage(event.systemMessage);
  }, [onNewMessage]);

  const refreshThread = useCallback(() => {
    void thread.refetch({ cancelRefetch: false });
  }, [thread.refetch]);

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
    return subscribeToUserChannel(
      inboxId,
      onNewMessage,
      onTyping,
      onOfferUpdated,
      undefined,
      refreshThread,
    ) ?? undefined;
  }, [onNewMessage, onOfferUpdated, onTyping, inboxId, refreshThread]);

  // Every thread fetch marks it read on the server (messages, and since 20 Oct
  // the bell's message row), so everything counting unread is refreshed: the
  // list, and the header badges, which come from /home.
  useEffect(() => {
    const latestMessageId = thread.data?.messages.at(-1)?.id ?? null;
    if (latestMessageId === lastReadRefreshMessageId.current) return;
    lastReadRefreshMessageId.current = latestMessageId;
    if (!thread.data) return;
    void queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    void queryClient.invalidateQueries({ queryKey: ["home"] });
    void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
  }, [queryClient, thread.data]);

  // Pusher is the fast path. Keep the visible conversation current if the
  // socket drops, the phone misses an event, or the channel is still authorizing.
  // The thread GET also marks incoming messages read, which is correct while
  // this conversation is actively open.
  useFocusEffect(
    useCallback(() => {
      if (!partner) return;
      const updateActivePartner = (state: string) => {
        if (state === "active") {
          setActiveConversationPartnerId(partner);
        } else {
          clearActiveConversationPartnerId(partner);
        }
      };
      updateActivePartner(AppState.currentState);
      void dismissNotificationsForPartner(partner).catch((error: unknown) => {
        console.warn("Could not dismiss notifications for the open conversation.", error);
      });
      const appState = AppState.addEventListener("change", updateActivePartner);
      return () => {
        appState.remove();
        clearActiveConversationPartnerId(partner);
      };
    }, [partner]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!partner) return;
      let inFlight = false;
      const syncThread = (appIsActive = AppState.currentState === "active") => {
        if (!appIsActive || inFlight) return;
        inFlight = true;
        void thread.refetch({ cancelRefetch: false }).finally(() => {
          inFlight = false;
        });
      };

      syncThread();
      const interval = setInterval(syncThread, 5_000);
      const appState = AppState.addEventListener("change", (state) => {
        if (state === "active") syncThread(true);
      });
      return () => {
        clearInterval(interval);
        appState.remove();
      };
    }, [partner, thread.refetch]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!partner || !messageId) return;
      const retries = [1_500, 4_000].map((delay) =>
        setTimeout(() => {
          const cached = queryClient.getQueryData<LegacyThreadResponse>(threadQueryKey(partner));
          if (cached?.messages.some((message) => message.id === messageId)) return;
          void thread.refetch({ cancelRefetch: false });
        }, delay),
      );
      return () => retries.forEach(clearTimeout);
    }, [messageId, partner, queryClient, thread.refetch]),
  );

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
      const { url, width, height } = await uploadPhoto(asset.uri);
      cacheMeasuredChatImageSize(url, width, height);
      const content = JSON.stringify({ type: "image", url, caption: null, width, height });
      const optimisticId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimisticMessage: ThreadMessage = {
        id: optimisticId,
        senderId: currentUserId,
        receiverId: partner,
        content,
        read: true,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<LegacyThreadResponse>(threadQueryKey(partner), (current) =>
        current ? { ...current, messages: [...current.messages, optimisticMessage] } : current,
      );
      requestBottomScroll("animated");
      try {
        await sendMessage.mutateAsync({ partnerId: partner, content });
        await thread.refetch();
      } finally {
        queryClient.setQueryData<LegacyThreadResponse>(threadQueryKey(partner), (current) =>
          current ? { ...current, messages: current.messages.filter((message) => message.id !== optimisticId) } : current,
        );
      }
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
      requestBottomScroll("animated");
      await sendMessage.mutateAsync({ partnerId: partner, content, replyToId: replyingTo?.id ?? null });
      setReplyingTo(null);
      if (!quick) {
        setDraft("");
        setToolsOpen(false);
        Keyboard.dismiss();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Your message could not be sent.";
      setSendError(message);
    } finally {
      setSending(false);
    }
  };

  const otherName =
    partnerName ||
    (thread.data?.partnerName && thread.data.partnerName !== "Conversation" ? thread.data.partnerName : null) ||
    partnerProfile.data?.user.org?.name ||
    partnerProfile.data?.user.name ||
    "Conversation";
  const otherFirst = (otherName ?? "").split(/\s+/)[0] || otherName;
  const otherAvatar =
    partnerAvatar ||
    thread.data?.partnerAvatar ||
    partnerProfile.data?.user.org?.logoUrl ||
    partnerProfile.data?.user.avatar ||
    "";
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
          onPress: () =>
            block.mutate(partner, {
              onSuccess: () => router.back(),
              // Without this a failed block did nothing visible, and the
              // person left believing they were blocked.
              onError: (error) =>
                showDialog(
                  "Could not block",
                  error instanceof ApiError && error.status < 500 ? error.message : "Check your connection and try again.",
                  [{ text: "Got it" }],
                  { pose: "worry" },
                ),
            }),
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

  // In-chat search matches, newest first, as message ids.
  const searchQ = searchText.trim().toLowerCase();
  const searchMatches = searchQ
    ? sortedMessages
        .filter((m) => previewFromContent(m.content, m.senderId === currentUserId).toLowerCase().includes(searchQ))
        .map((m) => m.id)
        .reverse()
    : [];

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
            <PremiumName premium={partnerProfile.data?.user.premium === true} style={[styles.title, { color: palette.ink }]}>{otherName}</PremiumName>
            {typingName ? (
              <Text style={[styles.subtitle, { color: palette.forest }]} numberOfLines={1}>typing…</Text>
            ) : standing ? (
              // Their standing under the name: tier and rating.
              <StarText style={[styles.subtitle, { color: palette.inkSecondary }]} numberOfLines={1}>{standing}</StarText>
            ) : null}
          </View>
        </Tappable>
        {/* The menu's only action is Block (hiding conversations was removed in
            schema v2), and blocking is not offered while acting as a shop. */}
        {/* Chat info: its own screen (Profile / Search / Mute, trades, photos,
            Report / Block / Delete chat). */}
        <Tappable
          onPress={() =>
            router.push({ pathname: "/messages/info", params: { partner: partner ?? "", partnerName: otherName, partnerAvatar: otherAvatar ?? "" } })
          }
          style={styles.iconButton}
          pressedStyle={{ backgroundColor: palette.control }}
          accessibilityLabel="Chat info"
        >
          <Ionicons name="information-circle-outline" size={24} color={palette.forest} />
        </Tappable>
      </View>

      {/* In-chat search: matches step from newest to oldest. */}
      {searchOpen ? (
        <View style={[styles.searchBar, { borderBottomColor: palette.divider, backgroundColor: palette.surface }]}>
          <TextInput
            value={searchText}
            onChangeText={(t) => {
              setSearchText(t);
              setSearchIndex(0);
            }}
            autoFocus
            placeholder="Search this chat"
            placeholderTextColor={palette.inkMuted}
            returnKeyType="search"
            onSubmitEditing={() => searchMatches[0] && jumpTo(searchMatches[0])}
            style={[styles.searchField, { backgroundColor: palette.control, color: palette.ink }]}
            accessibilityLabel="Search this chat"
          />
          <Text style={[styles.searchCount, { color: palette.inkSecondary }]}>
            {searchText.trim() ? (searchMatches.length ? `${searchIndex + 1}/${searchMatches.length}` : "0") : ""}
          </Text>
          <Tappable
            onPress={() => {
              if (searchMatches.length === 0) return;
              const next = (searchIndex + 1) % searchMatches.length;
              setSearchIndex(next);
              jumpTo(searchMatches[next]);
            }}
            accessibilityRole="button"
            accessibilityLabel="Older match"
            style={styles.iconButton}
          >
            <Ionicons name="chevron-up" size={20} color={palette.ink} />
          </Tappable>
          <Tappable
            onPress={() => {
              setSearchOpen(false);
              setSearchText("");
            }}
            accessibilityRole="button"
            accessibilityLabel="Close search"
            style={styles.iconButton}
          >
            <Ionicons name="close" size={20} color={palette.ink} />
          </Tappable>
        </View>
      ) : null}

      {/* PINNED: the live trade stays here however long the chat gets. */}
      {activeTrades.data && partner ? (
        <PinnedTrade
          partnerId={partner}
          partnerName={otherName}
          trades={activeTrades.data.trades}
          offers={activeTrades.data.offers}
        />
      ) : null}

      {thread.isPending ? (
        <View style={styles.centered}>
            <ActivityIndicator size="small" color={palette.forest} />
        </View>
      ) : thread.isError ? (
        <View style={styles.centered}>
            <Text style={[styles.emptyTitle, { color: palette.ink }]}>
              {isUnavailableConversationError(thread.error)
                ? "This conversation is unavailable."
                : "This conversation failed to load."}
            </Text>
            {!isUnavailableConversationError(thread.error) ? (
              <Tappable
                onPress={() => void thread.refetch()}
                style={styles.newMessageButton}
                pressedStyle={styles.newMessageButtonPressed}
                accessibilityRole="button"
              >
                <Text style={styles.newMessageButtonText}>Try again</Text>
              </Tappable>
            ) : null}
        </View>
      ) : (
        <>
          <View style={styles.listContainer}>
            <ScrollView
              ref={listRef}
              style={[styles.list, !initialScrollComplete && styles.listUnpositioned]}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={thread.isRefetching}
                  onRefresh={() => thread.refetch({ cancelRefetch: false })}
                  tintColor={palette.forest}
                />
              }
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              onScroll={(event) => {
                scrollYRef.current = event.nativeEvent.contentOffset.y;
                updateNearBottom();
              }}
              onContentSizeChange={onMessageListContentSizeChange}
              onLayout={(event) => onMessageListLayout(event.nativeEvent.layout.height)}
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
              const quoted = message.replyTo ?? null;
              return (
                <View
                  key={message.id}
                  onLayout={(e) => messageY.current.set(message.id, e.nativeEvent.layout.y)}
                  style={flashId === message.id ? { backgroundColor: palette.control } : undefined}
                >
                  {separator ? <Text style={[styles.separator, { color: palette.inkSecondary }]}>{separator}</Text> : null}
                  {/* A reply shows what it answers; tap to jump to it. */}
                  {quoted ? (
                    <QuotedReply
                      mine={mine}
                      label={
                        mine
                          ? `You replied to ${quoted.senderId === currentUserId ? "yourself" : otherFirst}`
                          : `${otherFirst} replied to ${quoted.senderId === currentUserId ? "you" : "themself"}`
                      }
                      text={previewFromContent(quoted.content, quoted.senderId === currentUserId)}
                      onPress={() => jumpTo(quoted.id)}
                    />
                  ) : null}
                  <SwipeToReply enabled={!isSystem && !message.id.startsWith("local-")} onReply={() => setReplyingTo(message)}>
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
                      screenWidth,
                      onImagePress: setLightboxUrl,
                      onImageSizeChange: () => {
                        if (nearBottomRef.current) requestBottomScroll("animated");
                      },
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
                      onSharedPostPress: (itemId) => router.push({ pathname: "/item", params: { id: itemId } }),
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
                  </SwipeToReply>
                </View>
              );
            })}
            </ScrollView>
            {newMessageCount > 0 ? (
              <Tappable
                onPress={() => {
                  pendingScrollRef.current = "animated";
                  setNewMessageCount(0);
                  performPendingScroll();
                }}
                style={styles.newMessageButton}
                pressedStyle={styles.newMessageButtonPressed}
                accessibilityRole="button"
                accessibilityLabel={newMessageCount === 1 ? "Scroll to new message" : `Scroll to ${newMessageCount} new messages`}
              >
                <Ionicons name="arrow-down" size={16} color={color.surface} />
                <Text style={styles.newMessageButtonText}>
                  {newMessageCount === 1 ? "New message" : `New messages · ${newMessageCount}`}
                </Text>
              </Tappable>
            ) : null}
          </View>

          {sendError ? <Text style={[styles.sendError, { color: palette.inkSecondary }]}>{sendError}</Text> : null}

          {/* Replying: what you answer sits right above the field. */}
          {replyingTo ? (
            <View style={[styles.replyBar, { borderTopColor: palette.divider, backgroundColor: palette.surface }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.replyBarTitle, { color: palette.forest }]} numberOfLines={1}>
                  Replying to {replyingTo.senderId === currentUserId ? "yourself" : otherName}
                </Text>
                <Text style={[styles.replyBarText, { color: palette.inkSecondary }]} numberOfLines={1}>
                  {previewFromContent(replyingTo.content, replyingTo.senderId === currentUserId)}
                </Text>
              </View>
              <Tappable onPress={() => setReplyingTo(null)} accessibilityRole="button" accessibilityLabel="Cancel reply" style={styles.iconButton}>
                <Ionicons name="close" size={20} color={palette.inkSecondary} />
              </Tappable>
            </View>
          ) : null}

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
        name={otherName}
        avatar={avatarNode(64)}
        onProfile={() => {
          setMenuOpen(false);
          openProfile();
        }}
        trades={[
          ...(activeTrades.data?.trades
            .filter((t) => t.counterparty.id === partner)
            .map((t) => ({ id: t.id, title: `${t.offeredItem?.title ?? "Your item"} for ${t.requestedItem.title}`, sub: t.status === "PENDING" ? "Waiting for an answer" : "In progress", href: `/trade?id=${encodeURIComponent(t.id)}` })) ?? []),
          ...(activeTrades.data?.offers
            .filter((o) => o.counterparty.id === partner && o.status === "PENDING")
            .map((o) => ({ id: o.id, title: `${o.offeredItems[0]?.title ?? "An item"} for ${o.post.title}`, sub: o.direction === "sent" ? "Your offer · waiting" : "Offer to you · your call", href: `/trade?offer=${encodeURIComponent(o.id)}` })) ?? []),
        ]}
        onOpenTrade={(href) => {
          setMenuOpen(false);
          router.push(href as never);
        }}
        muted={chatSettings.data?.muted ?? false}
        onSearch={() => {
          setMenuOpen(false);
          setSearchOpen(true);
        }}
        onToggleMute={() =>
          updateChat.mutate(
            { muted: !(chatSettings.data?.muted ?? false) },
            { onError: (e) => showDialog("Could not change that", e instanceof Error ? e.message : "Try again.", [{ text: "Got it" }], { pose: "worry" }) },
          )
        }
        onDeleteChat={() =>
          // The app dialog, not Alert.alert: every other confirm in the app
          // uses it, and the system popup looked like a different app.
          showDialog(
            "Delete this chat?",
            `It is removed for you only. ${otherName} keeps their copy, and new messages will still arrive.`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () =>
                  updateChat.mutate(
                    { clear: true },
                    {
                      onSuccess: () => {
                        setMenuOpen(false);
                        router.back();
                      },
                      onError: (e) => showDialog("Could not delete the chat", e instanceof Error ? e.message : "Try again.", [{ text: "Got it" }], { pose: "worry" }),
                    },
                  ),
              },
            ],
          )
        }
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

/**
 * Chat info (the i button): who this is, a Profile shortcut, the trades with
 * them -- what Baylo adds over a plain chat -- and Block. No group chats.
 */
function ConversationMenu({
  visible,
  onClose,
  onBlock,
  colors,
  name,
  avatar,
  onProfile,
  trades,
  onOpenTrade,
  muted,
  onSearch,
  onToggleMute,
  onDeleteChat,
}: {
  visible: boolean;
  onClose: () => void;
  onBlock?: () => void;
  colors: { surface: string; ink: string; inkSecondary: string; divider: string; controlLine: string; urgent: string; control: string; forest: string };
  name: string;
  avatar: React.ReactNode;
  onProfile: () => void;
  trades: { id: string; title: string; sub: string; href: string }[];
  onOpenTrade: (href: string) => void;
  muted: boolean;
  onSearch: () => void;
  onToggleMute: () => void;
  onDeleteChat: () => void;
}) {
  if (!visible) return null;
  const first = name.split(/\s+/)[0] || name;
  return (
    <SheetShell title="Chat info" onClose={onClose} colors={colors}>
      <View style={styles.infoWho}>
        {avatar}
        <Text style={[styles.infoName, { color: colors.ink }]} numberOfLines={1}>{name}</Text>
        {/* Three round shortcuts, Messenger-style. */}
        <View style={styles.infoShortcuts}>
          <Tappable onPress={onProfile} accessibilityRole="button" style={styles.infoShortcut}>
            <View style={[styles.infoShortcutCircle, { backgroundColor: colors.control }]}>
              <PersonIcon size={20} stroke={1.9} color={colors.ink} />
            </View>
            <Text style={[styles.infoShortcutText, { color: colors.ink }]}>Profile</Text>
          </Tappable>
          <Tappable onPress={onSearch} accessibilityRole="button" style={styles.infoShortcut}>
            <View style={[styles.infoShortcutCircle, { backgroundColor: colors.control }]}>
              <Ionicons name="search" size={20} color={colors.ink} />
            </View>
            <Text style={[styles.infoShortcutText, { color: colors.ink }]}>Search</Text>
          </Tappable>
          <Tappable onPress={onToggleMute} accessibilityRole="switch" accessibilityState={{ checked: muted }} style={styles.infoShortcut}>
            <View style={[styles.infoShortcutCircle, { backgroundColor: muted ? colors.forest : colors.control }]}>
              <Ionicons name={muted ? "notifications-off" : "notifications-outline"} size={20} color={muted ? "#FFFFFF" : colors.ink} />
            </View>
            <Text style={[styles.infoShortcutText, { color: colors.ink }]}>{muted ? "Muted" : "Mute"}</Text>
          </Tappable>
        </View>
      </View>
      {trades.length > 0 ? (
        <>
          <Text style={[styles.infoSection, { color: colors.inkSecondary }]}>TRADES WITH {first.toUpperCase()}</Text>
          <SheetRows>
            {trades.map((t) => (
              <SheetRow key={t.id} label={`${t.title} · ${t.sub}`} colors={colors} onPress={() => onOpenTrade(t.href)} />
            ))}
          </SheetRows>
        </>
      ) : null}
      <SheetRows>
        {onBlock ? <SheetRow glyph={<BlockIcon size={20} stroke={1.6} color={colors.urgent} />} label={`Block ${first}`} destructive colors={colors} onPress={onBlock} /> : null}
        <SheetRow glyph={<Ionicons name="trash-outline" size={20} color={colors.urgent} />} label="Delete chat" destructive colors={colors} onPress={onDeleteChat} />
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
  replyBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 16, paddingRight: 4, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
  replyBarTitle: { fontFamily: font.sansBold, fontSize: 13 },
  replyBarText: { fontFamily: font.sans, fontSize: 13 },
  infoWho: { alignItems: "center", gap: 8, paddingBottom: 12 },
  infoName: { fontFamily: font.displayBold, fontSize: 20 },
  infoShortcuts: { flexDirection: "row", gap: 28, marginTop: 4 },
  infoShortcut: { alignItems: "center", gap: 6, minWidth: 56 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 12, paddingRight: 4, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  searchField: { flex: 1, height: 38, borderRadius: 19, paddingHorizontal: 14, fontFamily: font.sans, fontSize: 15 },
  searchCount: { fontFamily: font.sansSemi, fontSize: 12, minWidth: 44, textAlign: "center" },
  infoShortcutCircle: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  infoShortcutText: { fontFamily: font.sansSemi, fontSize: 12 },
  infoSection: { fontFamily: font.sansBold, fontSize: 12, letterSpacing: 0.6, paddingTop: 8, paddingBottom: 4 },
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
  listContainer: {
    flex: 1,
    position: "relative",
  },
  listUnpositioned: {
    opacity: 0,
  },
  newMessageButton: {
    position: "absolute",
    right: 16,
    bottom: 12,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: color.forest,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  newMessageButtonPressed: {
    opacity: 0.9,
  },
  newMessageButtonText: {
    fontFamily: font.sansSemi,
    fontSize: 13,
    color: color.surface,
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
