import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError } from "../../src/api/client";
import { useConversations } from "../../src/api/messages";
import { useHome } from "../../src/api/home";
import { getActingOrgId } from "../../src/api/org-context";
import { subscribeToUserChannel } from "../../src/api/pusher";
import { useSession } from "../../src/auth/session";
import { MessageIcon, SearchIcon, StoreIcon } from "../../src/components/icons";
import { useActiveTrades } from "../../src/api/trades";
import { MascotEmptyState } from "../../src/components/MascotEmptyState";
import { Tappable } from "../../src/components/Tappable";
import { previewFromContent } from "../../src/components/messages/MessagePayloads";
import { useRealtimeLiveness } from "../../src/lib/trade-liveness";
import { color, font, icon, radius, textStyle, type } from "../../src/theme/tokens";
import { sizedImage } from "../../src/media/image-url";

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
  const { data, error, isPending, isError, isRefetching, refetch } = useConversations(params.partner ?? null);
  const activeTrades = useActiveTrades();
  const [query, setQuery] = useState("");
  const [inboxFilter, setInboxFilter] = useState<"all" | "unread" | "trading">("all");
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  useRealtimeLiveness(refetch);
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
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={color.green} />
          }
        >
          <View style={styles.centered}>
            <MascotEmptyState
              pose="search"
              title="No conversations yet."
              message={
                shopName
                  ? `Messages to ${shopName} will appear here.`
                  : "Messages will appear here when someone starts a conversation."
              }
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  const q = query.trim().toLowerCase();
  // What is live with each person, said on their row: the item and where it stands.
  const tradeTags = new Map<string, { label: string; image: string | null; good: boolean }>();
  for (const o of activeTrades.data?.offers ?? []) {
    if (o.status !== "PENDING" || tradeTags.has(o.counterparty.id)) continue;
    tradeTags.set(o.counterparty.id, {
      label: `${o.direction === "sent" ? "Offer waiting" : "Offer for you"} · ${o.post.title}`,
      image: o.post.image ?? null,
      good: false,
    });
  }
  for (const t of activeTrades.data?.trades ?? []) {
    const get = t.direction === "sent" ? t.requestedItem : t.offeredItem;
    const at = t.meetup?.agreedAt ? new Date(t.meetup.at) : null;
    tradeTags.set(t.counterparty.id, {
      label: at
        ? `Meetup ${at.toLocaleDateString("en-US", { weekday: "short" })} ${at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
        : `${t.status === "PENDING" ? "Request" : "Trade on"} · ${get?.title ?? "trade"}`,
      image: get?.image ?? null,
      good: !!at || t.status === "ACCEPTED",
    });
  }
  const tradingIds = new Set(tradeTags.keys());
  const shown = conversations.filter(
    (c) =>
      (!q || c.partnerName?.toLowerCase().includes(q) || previewFromContent(c.content, c.fromMe).toLowerCase().includes(q)) &&
      (inboxFilter === "all" || (inboxFilter === "unread" ? c.unreadCount > 0 : tradingIds.has(c.partnerId))),
  );
  const unreadTotal = conversations.filter((c) => c.unreadCount > 0).length;

  return (
    <View style={styles.screen}>
      {shopStrip}
      {/* Search and filters (4 Nov 2026). The screen title is the header's
          own message icon, so there is no "Messages" heading. */}
      <View style={styles.tools}>
        <View style={styles.search}>
          <SearchIcon size={18} stroke={2} color={color.inkSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search people and messages"
            placeholderTextColor={color.inkMuted}
            style={styles.searchInput}
            accessibilityLabel="Search messages"
            returnKeyType="search"
          />
        </View>
        <View style={styles.filters}>
          {(["all", "unread", "trading"] as const).map((f) => (
            <Tappable
              key={f}
              onPress={() => setInboxFilter(f)}
              accessibilityRole="button"
              accessibilityState={{ selected: inboxFilter === f }}
              style={[styles.filter, inboxFilter === f && styles.filterOn]}
            >
              <Text style={[styles.filterText, inboxFilter === f && styles.filterTextOn]}>
                {f === "all" ? "All" : f === "unread" ? "Unread" : "Trading"}
              </Text>
              {f === "unread" && unreadTotal > 0 ? (
                <View style={styles.filterCount}><Text style={styles.filterCountText}>{unreadTotal}</Text></View>
              ) : null}
            </Tappable>
          ))}
        </View>
      </View>
      <FlatList
        data={shown}
        keyExtractor={(item) => item.partnerId}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={color.green} />
        }
        // A filter or search with nothing in it says so (5 Nov 2026); it was
        // a blank screen.
        ListEmptyComponent={
          <View style={{ paddingTop: 48 }}>
            {q ? (
              <MascotEmptyState pose="search" size={110} title="No matches" message={`No chats match "${query.trim()}".`} />
            ) : inboxFilter === "unread" ? (
              <MascotEmptyState pose="celebrate" size={110} title="All caught up" message="You have read every message. New ones show up here." />
            ) : (
              <MascotEmptyState pose="leaf" size={110} title="No chats about a trade" message="Chats with someone you have an offer or trade with show up here." />
            )}
          </View>
        }
        renderItem={({ item }) => {
          // A system event is written as a pair of rows, so the newest one is
          // often "from" the viewer. It is nobody's message: no "You: " on it.
          // `system` is the server's flag; the content check covers an older one.
          const system = item.system ?? /"type":"(trade_completed|offer_update)"/.test(item.content);
          const preview = previewFromContent(item.content, item.fromMe && !system);
          const label = item.fromMe && !system ? `You: ${preview}` : preview;

          return (
            <View style={styles.row}>
              <Tappable onPress={() => router.push({ pathname: "/user", params: { id: item.partnerId } })} style={styles.partnerIdentity} pressedStyle={styles.rowPressed} accessibilityRole="button" accessibilityLabel={`View ${item.partnerName}'s profile`}>
                {item.partnerAvatar ? <Image source={{ uri: sizedImage(item.partnerAvatar, "thumb") }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{item.partnerName?.slice(0, 1).toUpperCase() ?? "?"}</Text></View>}
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
                  <Text style={[styles.time, item.unreadCount > 0 && { color: color.forest, fontFamily: font.sansBold }]}>{relativeTime(item.lastMessageAt)}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={[styles.preview, item.unreadCount > 0 && styles.unreadText]} numberOfLines={1}>{label}</Text>
                  {item.unreadCount > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadCount}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>
                    </View>
                  ) : null}
                </View>
                {/* A trade is live in this chat: say so on the row. */}
                {tradeTags.get(item.partnerId) ? (() => {
                  const tag = tradeTags.get(item.partnerId)!;
                  return (
                    <View style={[styles.tradeTag, tag.good && { backgroundColor: color.greenWash }]}>
                      <View style={styles.tradeTagThumb}>
                        {tag.image ? <Image source={{ uri: sizedImage(tag.image, "thumb") }} style={StyleSheet.absoluteFill} /> : null}
                      </View>
                      <Text style={[styles.tradeTagText, tag.good && { color: color.forest }]} numberOfLines={1}>{tag.label}</Text>
                    </View>
                  );
                })() : null}
              </Tappable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tools: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6, gap: 10 },
  search: { height: 42, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, borderRadius: 21, backgroundColor: color.control },
  searchInput: { flex: 1, fontFamily: font.sans, fontSize: 15, color: color.ink, paddingVertical: 0 },
  filters: { flexDirection: "row", gap: 8 },
  filter: { height: 32, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: color.controlLine, backgroundColor: color.searchSurface },
  filterOn: { backgroundColor: color.ink, borderColor: color.ink },
  filterText: { fontFamily: font.sansMedium, fontSize: 13, color: color.ink },
  filterTextOn: { color: "#FFFFFF", fontFamily: font.sansSemi },
  filterCount: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: color.green, alignItems: "center", justifyContent: "center" },
  filterCountText: { fontFamily: font.sansBold, fontSize: 11, color: color.onGreen },
  tradeTag: { alignSelf: "flex-start", maxWidth: "100%", marginTop: 4, height: 22, flexDirection: "row", alignItems: "center", gap: 5, paddingLeft: 3, paddingRight: 8, borderRadius: 11, backgroundColor: color.control },
  tradeTagThumb: { width: 16, height: 16, borderRadius: 4, overflow: "hidden", backgroundColor: "#CBD5DE" },
  tradeTagText: { flexShrink: 1, fontFamily: font.sansSemi, fontSize: 12, color: "#3F3E37" },
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
    ...type.gridMeta,
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
    ...type.gridMeta,
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
