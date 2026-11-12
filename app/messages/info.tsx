import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "../../src/api/client";
import { useBlockUser, useReport } from "../../src/api/item";
import { useChatSettings, useThread, useUpdateChatSettings } from "../../src/api/messages";
import { usePublicProfile } from "../../src/api/profile";
import { useActiveTrades, useTradeHistory } from "../../src/api/trades";
import { showDialog } from "../../src/components/dialog";
import { ChevronLeftIcon, ChevronRightIcon } from "../../src/components/icons";
import { ReportSheet } from "../../src/components/ReportSheet";
import { Tappable } from "../../src/components/Tappable";
import { offerHref, tradeHref } from "../../src/components/trades/present";
import { getActingOrgId } from "../../src/api/org-context";
import { sizedImage } from "../../src/media/image-url";
import { color, font } from "../../src/theme/tokens";
import { StarText } from "../../src/components/StarText";

/**
 * Chat info -- the i button in a chat (4 Nov 2026 design). Messenger's info
 * screen without groups: who this is with their trust facts, three round
 * shortcuts (Profile, Search, Mute), the trades with this person -- what
 * Baylo adds over a plain chat -- the photos sent in the chat, and Report /
 * Block / Delete chat.
 */
export default function ChatInfoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { partner, partnerName, partnerAvatar } = useLocalSearchParams<{ partner?: string; partnerName?: string; partnerAvatar?: string }>();
  const profile = usePublicProfile(partner);
  const thread = useThread(partner ?? null);
  const active = useActiveTrades();
  const history = useTradeHistory(true);
  const settings = useChatSettings(partner);
  const update = useUpdateChatSettings(partner);
  const block = useBlockUser();
  const report = useReport();
  const [reportOpen, setReportOpen] = useState(false);
  const actingAsShop = !!getActingOrgId();

  const p = profile.data;
  const name = p?.user.org?.name ?? p?.user.name ?? partnerName ?? "Conversation";
  const first = name.split(/\s+/)[0] || name;
  const avatar = p?.user.org?.logoUrl ?? p?.user.avatar ?? (partnerAvatar || null);
  const facts = [
    p?.user.org ? (p.user.org.verified ? "Verified shop" : "Shop") : p?.user.trustTier ? p.user.trustTier.charAt(0) + p.user.trustTier.slice(1).toLowerCase() : null,
    p && p.counts.reviews > 0 ? `★ ${p.user.rating.toFixed(1)}` : null,
    p?.user.location ?? null,
  ].filter(Boolean).join(" · ");

  // Every trade and offer with this person, newest first: live ones first.
  const trades = useMemo(() => {
    const rows: { id: string; title: string; sub: string; image: string | null; href: string; done: boolean; at: number }[] = [];
    const add = (data: typeof active.data, done: boolean) => {
      for (const t of data?.trades ?? []) {
        if (t.counterparty.id !== partner) continue;
        const give = t.direction === "sent" ? t.offeredItem : t.requestedItem;
        const get = t.direction === "sent" ? t.requestedItem : t.offeredItem;
        rows.push({
          id: `t-${t.id}`,
          title: `${give?.title ?? "Your item"} for ${get?.title ?? "their item"}`,
          sub: tradeStatus(t.status, first),
          image: get?.image ?? give?.image ?? null,
          href: tradeHref(t.id),
          done,
          at: Date.parse(t.updatedAt ?? t.createdAt),
        });
      }
      for (const o of data?.offers ?? []) {
        if (o.counterparty.id !== partner) continue;
        const mine = o.direction === "sent";
        rows.push({
          id: `o-${o.id}`,
          title: `${mine ? o.offeredItems[0]?.title ?? "Your item" : o.offeredItems[0]?.title ?? "Their item"} for ${o.post.title}`,
          sub: o.status === "PENDING" ? (mine ? `Your offer · waiting for ${first}` : `Offer from ${first} · your call`) : `${capital(o.status)} · ${shortDay(o.createdAt)}`,
          image: o.post.image ?? null,
          href: offerHref(o.id),
          done: o.status !== "PENDING",
          at: Date.parse(o.createdAt),
        });
      }
    };
    add(active.data, false);
    add(history.data, true);
    const seen = new Set<string>();
    return rows
      .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
      .sort((a, b) => Number(a.done) - Number(b.done) || b.at - a.at);
  }, [active.data, history.data, partner, first]);

  // The photos sent in this chat, newest first.
  const photos = useMemo(() => {
    const out: string[] = [];
    for (const m of [...(thread.data?.messages ?? [])].reverse()) {
      try {
        const parsed = JSON.parse(m.content) as { type?: string; url?: string; imageUrl?: string };
        const url = parsed.type === "image" ? parsed.url ?? parsed.imageUrl : undefined;
        if (url) out.push(url);
      } catch {
        // plain text
      }
    }
    return out;
  }, [thread.data]);
  const [allPhotos, setAllPhotos] = useState(false);
  // Measured, not "24%": a percentage width on expo-image inside a wrapping
  // row can lay out at zero on Android, which left the section with a title
  // and no photos.
  const [gridWidth, setGridWidth] = useState(0);
  const tile = gridWidth > 0 ? Math.floor((gridWidth - 3 * 4) / 4) : 0;

  const muted = settings.data?.muted ?? false;
  const backToChat = (extra?: Record<string, string>) =>
    router.replace({ pathname: "/messages/thread", params: { partner: partner ?? "", partnerName: name, partnerAvatar: avatar ?? "", ...extra } });

  const confirmBlock = () =>
    showDialog(`Block ${name}?`, "You will not see each other's listings and neither of you can message the other. Trades already in progress are not cancelled.", [
      { text: "Cancel", style: "cancel" },
      { text: "Block", style: "destructive", onPress: () => block.mutate(partner!, {
        onSuccess: () => router.dismissTo("/messages"),
        onError: (error) => showDialog(
          "Could not block",
          error instanceof ApiError && error.status < 500 ? error.message : "Check your connection and try again.",
          [{ text: "Got it" }],
          { pose: "worry" },
        ),
      }) },
    ]);
  const confirmDelete = () =>
    showDialog("Delete this chat?", `It is removed for you only. ${first} keeps their copy, and new messages will still arrive.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          update.mutate(
            { clear: true },
            {
              onSuccess: () => router.dismissTo("/messages"),
              onError: (e) => showDialog("Could not delete the chat", e instanceof Error ? e.message : "Try again."),
            },
          ),
      },
    ]);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.top}>
        <Tappable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={s.back}>
          <ChevronLeftIcon size={24} stroke={2} color={color.ink} />
        </Tappable>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Who: photo, name, the trust facts. */}
        <View style={s.who}>
          {avatar ? (
            <Image source={{ uri: sizedImage(avatar, "thumb") }} contentFit="cover" style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.avatarFallback]}>
              <Text style={s.initials}>{initials(name)}</Text>
            </View>
          )}
          <Text style={s.name} numberOfLines={1}>{name}</Text>
          {facts ? <StarText style={s.facts} numberOfLines={1}>{facts}</StarText> : null}
        </View>

        {/* Three round shortcuts, Messenger-style. No group chats on Baylo. */}
        <View style={s.shortcuts}>
          <Shortcut label="Profile" onPress={() => router.push({ pathname: "/user", params: { id: partner ?? "" } })}>
            <Ionicons name="person-outline" size={20} color={color.ink} />
          </Shortcut>
          <Shortcut label="Search" onPress={() => backToChat({ search: "1" })}>
            <Ionicons name="search" size={20} color={color.ink} />
          </Shortcut>
          <Shortcut
            label={muted ? "Muted" : "Mute"}
            lit={muted}
            onPress={() =>
              update.mutate({ muted: !muted }, { onError: (e) => showDialog("Could not change that", e instanceof ApiError || e instanceof Error ? e.message : "Try again.") })
            }
          >
            <Ionicons name={muted ? "notifications-off" : "notifications-outline"} size={20} color={muted ? "#FFFFFF" : color.ink} />
          </Shortcut>
        </View>

        <View style={s.body}>
          {/* What Baylo adds over a plain chat: the trades with this person. */}
          {trades.length > 0 ? (
            <View style={{ gap: 6 }}>
              <Text style={s.section}>Trades with {first}</Text>
              <View style={s.card}>
                {trades.map((t, i) => (
                  <Tappable key={t.id} onPress={() => router.push(t.href as never)} accessibilityRole="button" style={[s.tradeRow, i > 0 && s.rowLine]}>
                    <View style={[s.tradeThumb, t.done && { opacity: 0.55 }]}>
                      {t.image ? <Image source={{ uri: sizedImage(t.image, "thumb") }} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[s.tradeTitle, t.done && { color: color.inkSecondary }]} numberOfLines={1}>{t.title}</Text>
                      <Text style={[s.tradeSub, !t.done && { color: color.forest, fontWeight: "600" }]} numberOfLines={1}>{t.sub}</Text>
                    </View>
                    <ChevronRightIcon size={16} stroke={2} color={color.inkMuted} />
                  </Tappable>
                ))}
              </View>
            </View>
          ) : null}

          {photos.length > 0 ? (
            <View style={{ gap: 6 }}>
              <View style={s.sectionRow}>
                <Text style={s.section}>Photos</Text>
                {photos.length > 4 ? (
                  <Tappable onPress={() => setAllPhotos((v) => !v)} accessibilityRole="button">
                    <Text style={s.seeAll}>{allPhotos ? "Show less" : "See all"}</Text>
                  </Tappable>
                ) : null}
              </View>
              <View style={s.photos} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
                {tile > 0
                  ? (allPhotos ? photos : photos.slice(0, 4)).map((url, i) => (
                      <Image
                        key={`${url}-${i}`}
                        source={{ uri: sizedImage(url, "thumb") }}
                        contentFit="cover"
                        style={[s.photo, { width: tile, height: tile }]}
                      />
                    ))
                  : null}
              </View>
            </View>
          ) : null}

          <View style={s.card}>
            {!actingAsShop ? (
              <Tappable onPress={() => setReportOpen(true)} accessibilityRole="button" style={s.actionRow}>
                <Ionicons name="flag-outline" size={20} color={color.ink} />
                <Text style={s.actionText}>Report {first}</Text>
              </Tappable>
            ) : null}
            {!actingAsShop ? (
              <Tappable onPress={confirmBlock} accessibilityRole="button" style={[s.actionRow, s.rowLine]}>
                <Ionicons name="ban-outline" size={20} color={color.urgent} />
                <Text style={[s.actionText, s.danger]}>Block {first}</Text>
              </Tappable>
            ) : null}
            <Tappable onPress={confirmDelete} accessibilityRole="button" style={[s.actionRow, !actingAsShop && s.rowLine]}>
              <Ionicons name="trash-outline" size={20} color={color.urgent} />
              <Text style={[s.actionText, s.danger]}>Delete chat</Text>
            </Tappable>
          </View>
        </View>
      </ScrollView>

      {reportOpen && partner ? (
        <ReportSheet
          target="user"
          targetName={name}
          busy={report.isPending}
          onPick={(category) =>
            report.mutate(
              { targetType: "user", targetId: partner, category },
              {
                onSuccess: () => {
                  setReportOpen(false);
                  showDialog("Thanks — that is with a moderator", "They review every report and will let you know the outcome.");
                },
                onError: (error) => {
                  setReportOpen(false);
                  showDialog("Could not send that report", error instanceof Error ? error.message : "Something went wrong. Please try again.");
                },
              },
            )
          }
          onClose={() => setReportOpen(false)}
        />
      ) : null}
    </View>
  );
}

function Shortcut({ label, lit = false, onPress, children }: { label: string; lit?: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Tappable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={s.shortcut}>
      <View style={[s.shortcutCircle, lit && { backgroundColor: color.forest }]}>{children}</View>
      <Text style={s.shortcutText}>{label}</Text>
    </Tappable>
  );
}

function tradeStatus(status: string, first: string): string {
  switch (status) {
    case "PENDING":
      return `Waiting for ${first}`;
    case "ACCEPTED":
      return "Trade on · arrange the meetup";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return capital(status);
  }
}

function capital(raw: string): string {
  const lower = raw.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function shortDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", Date.now() - d.getTime() < 6 * 86_400_000 ? { weekday: "short" } : { month: "short", day: "numeric" });
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  top: { paddingHorizontal: 8, height: 52, justifyContent: "center" },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  who: { alignItems: "center", gap: 4, paddingHorizontal: 20, paddingBottom: 14 },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  avatarFallback: { backgroundColor: "#D9E6F2", alignItems: "center", justifyContent: "center" },
  initials: { fontFamily: font.displayBold, fontSize: 28, color: color.ink },
  name: { marginTop: 8, fontFamily: font.displayBold, fontSize: 22, color: color.ink },
  facts: { fontFamily: font.sans, fontSize: 13, color: color.inkSecondary },
  shortcuts: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 40, paddingBottom: 14 },
  shortcut: { alignItems: "center", gap: 6, minWidth: 64 },
  shortcutCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: color.control, alignItems: "center", justifyContent: "center" },
  shortcutText: { fontFamily: font.sansSemi, fontSize: 12, color: color.ink },
  body: { paddingHorizontal: 16, gap: 12 },
  section: { marginHorizontal: 4, fontFamily: font.sansBold, fontSize: 13, color: color.inkSecondary },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginRight: 4 },
  seeAll: { fontFamily: font.sansSemi, fontSize: 13, color: color.forest },
  card: { borderRadius: 16, borderWidth: 1, borderColor: color.controlLine, backgroundColor: color.searchSurface, overflow: "hidden" },
  rowLine: { borderTopWidth: 1, borderTopColor: color.divider },
  tradeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  tradeThumb: { width: 36, height: 36, borderRadius: 9, overflow: "hidden", backgroundColor: "#CBD5DE" },
  tradeTitle: { fontFamily: font.sansSemi, fontSize: 14, color: color.ink },
  tradeSub: { fontFamily: font.sans, fontSize: 12, color: color.inkSecondary },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  photo: { borderRadius: 10, backgroundColor: color.control },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  actionText: { flex: 1, fontFamily: font.sansMedium, fontSize: 15, color: color.ink },
  danger: { color: color.urgent, fontFamily: font.sansSemi },
});
