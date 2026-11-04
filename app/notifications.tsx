import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ApiError, apiV1 } from "../src/api/client";
import { itemKey } from "../src/api/item";
import {
  notificationTarget,
  useMarkNotificationsRead,
  useNotifications,
} from "../src/api/notifications";
import type { ItemDetailPayload, NotificationItem } from "../src/api/types";
import { showDialog } from "../src/components/dialog";
import { startRelist } from "../src/post/relist";
import { Splash } from "../src/components/Splash";
import { Hairline, OfferScreenHost } from "../src/components/offer/chrome";
import { PersonIcon, StoreIcon } from "../src/components/icons";
import { orgLogoUrl } from "../src/api/organizations";
import { Gutter, TradesBackTitle } from "../src/components/trades/chrome";
import { RowChevron, Thumb } from "../src/components/trades/rows";
import { TradesErrorPanel } from "../src/components/trades/states";
import { Tappable } from "../src/components/Tappable";
import { MascotEmptyState } from "../src/components/MascotEmptyState";
import { color } from "../src/theme/tokens";
import { relativeShort } from "../src/lib/format";
import {
  offerColor,
  offerSize,
  offerSpace,
  offerType,
  textStyle,
} from "../src/theme/offer-tokens";

/**
 * The bell's destination.
 *
 * ══ WHY IT EXISTS ══════════════════════════════════════════════════════════
 *
 * `AppHeader` has been rendering an accurate unread count on the bell for the
 * life of this client, behind `onPress={() => {}}`. Twenty-four notifications,
 * no way to see any of them. A count with no destination is worse than no count:
 * it states an obligation, refuses to say what it is, and teaches the reader
 * that the app's badges are decoration.
 *
 * ══ WHAT A ROW IS ══════════════════════════════════════════════════════════
 *
 * The actor's face, the sentence, and how long ago. `message` from the server
 * starts MID-SENTENCE — "accepted your offer on \"Pizza\"" — because the actor's
 * name is its subject and the web dashboard supplied that from its own join. So
 * the name is prepended here rather than the message being rewritten server-side,
 * which would break the web rendering of the same rows.
 *
 * A system row has no actor. "your offer on X expired after 3 days" is already a
 * whole sentence, and it gets the leaf-less placeholder rather than a face.
 *
 * A row about an ORGANISATION -- an invitation to its staff, the outcome of its
 * document review -- shows the shop's logo, not the inviting owner's face: the
 * shop is what the row is about, and the owner is usually photo-less, which
 * drew a blank grey tile. No logo draws the store glyph, never a blank.
 *
 * ══ VISIBLE ROWS ARE READ ON OPEN. THE DOTS STAY ANYWAY. ══════════════════
 *
 * Opening the list marks its visible activity rows read. Message notifications
 * are excluded here and are marked read by fetching their conversation thread.
 * The unread DOT is drawn from a snapshot taken on the first render and does
 * not move while the screen is up.
 *
 * If it cleared live, the screen would blank its own dots a beat after opening
 * and the reader would never learn which rows were the new ones — the single
 * piece of information they came here for. So the mutation clears the BADGE
 * immediately and the marks on screen survive until the screen is left. Nothing
 * is lied about: the dot means "this was unread when you walked in", which is
 * exactly what it looks like it means.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const list = useNotifications();
  const markVisible = useMarkNotificationsRead();

  /*
   * The snapshot behind the dots. Captured the first time rows arrive and never
   * rewritten — `markVisible` invalidates the query a moment later and the refetched
   * rows all come back `read: true`, which is correct data and the wrong thing
   * to render. See the note above.
   */
  const unreadOnEntry = useRef<Set<string> | null>(null);
  if (unreadOnEntry.current === null && list.data) {
    unreadOnEntry.current = new Set(
      list.data.notifications.filter((n) => !n.read).map((n) => n.id),
    );
  }

  /*
   * Fire once, and only for visible unread activity rows.
   *
   * `markVisible.mutate` is deliberately NOT in the dependency array: the mutation
   * object is a new reference on every render, and depending on it would fire
   * this effect on each one. The ref guard is what makes "once" true rather
   * than merely likely.
   */
  const cleared = useRef(false);
  const visibleUnreadIds = list.data?.notifications.filter((n) => !n.read).map((n) => n.id) ?? [];
  useEffect(() => {
    if (cleared.current || visibleUnreadIds.length === 0) return;
    cleared.current = true;
    markVisible.mutate(visibleUnreadIds, {
      onError: (error: unknown) =>
        showDialog(
          "Could not mark those as read",
          error instanceof ApiError ? error.message : "Something went wrong. Try again.",
        ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleUnreadIds]);

  const apiError = list.error instanceof ApiError ? list.error : null;
  if (apiError?.code === "UNAUTHENTICATED") {
    return <Splash waitingOn="Signing you back in" />;
  }

  const all = list.data?.notifications ?? [];
  const rows = filter === "all" ? all : all.filter((n) => filterOf(n.type) === filter);
  const groups = groupByAge(rows);

  return (
    <OfferScreenHost imeInset={0}>
      <TradesBackTitle title="Notifications" onBack={() => router.back()} />

      {list.isError ? (
        <TradesErrorPanel onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <NotificationSkeleton />
      ) : all.length === 0 ? (
        // The duck, what is missing, what will appear, and the next step.
        <View style={{ flex: 1, justifyContent: "center", paddingBottom: 60 }}>
          <MascotEmptyState
            pose="search"
            title="No notifications yet"
            message="Offers on your items, accepted trades, meetup reminders and reviews will show up here."
            action={{ label: "Browse the marketplace", onPress: () => router.push("/marketplace") }}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          {/* Filter chips: what kind of update. */}
          <View style={chipStyles.row}>
            {FILTERS.map((f) => (
              <Tappable
                key={f.key}
                onPress={() => setFilter(f.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === f.key }}
                style={[chipStyles.chip, filter === f.key && chipStyles.chipOn]}
              >
                <Text style={[chipStyles.text, filter === f.key && chipStyles.textOn]}>{f.label}</Text>
              </Tappable>
            ))}
          </View>
          {rows.length === 0 ? (
            <Gutter style={{ paddingTop: 18 }}>
              <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
                Nothing here yet.
              </Text>
            </Gutter>
          ) : null}
          {groups.map((g) => (
            <View key={g.label}>
              <Text style={chipStyles.section}>{g.label}</Text>
              <Hairline />
              {g.items.map((n) => (
                <View key={n.id}>
                  <NotificationRow
                    item={n}
                    wasUnread={unreadOnEntry.current?.has(n.id) ?? false}
                    onOpen={(path) => router.push(path as never)}
                  />
                  <Hairline />
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </OfferScreenHost>
  );
}

type Filter = "all" | "offers" | "trades" | "people";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "offers", label: "Offers" },
  { key: "trades", label: "Trades" },
  { key: "people", label: "People" },
];

/** Which chip a notification type belongs to. Unknown types show under All only. */
function filterOf(type: string): Filter | null {
  if (type === "TRADE_REQUEST" || type.startsWith("OFFER_")) return "offers";
  if (type.startsWith("TRADE_") || type.startsWith("MEETUP_")) return "trades";
  if (type.startsWith("FOLLOW_") || type === "NEW_REVIEW") return "people";
  return null;
}

/** Today / This week / Earlier, newest first within each, in the server's order. */
function groupByAge<T extends { createdAt: string }>(rows: T[]): { label: string; items: T[] }[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();
  const week = today - 6 * 86_400_000;
  const buckets: { label: string; items: T[] }[] = [
    { label: "TODAY", items: [] },
    { label: "THIS WEEK", items: [] },
    { label: "EARLIER", items: [] },
  ];
  for (const r of rows) {
    const t = Date.parse(r.createdAt);
    buckets[t >= today ? 0 : t >= week ? 1 : 2].items.push(r);
  }
  return buckets.filter((b) => b.items.length > 0);
}

const chipStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, paddingHorizontal: offerSpace.screenX, paddingTop: 8, paddingBottom: 4 },
  chip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: color.controlLine,
    backgroundColor: color.searchSurface,
    justifyContent: "center",
  },
  chipOn: { backgroundColor: color.ink, borderColor: color.ink },
  text: { fontSize: 13, fontWeight: "500", color: color.ink },
  textOn: { color: "#FFFFFF", fontWeight: "600" },
  section: {
    paddingHorizontal: offerSpace.screenX,
    paddingTop: 16,
    paddingBottom: 6,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: color.inkSecondary,
  },
});

function NotificationSkeleton() {
  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 30 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Hairline />
      {Array.from({ length: 5 }, (_, index) => (
        <View key={index}>
          <View
            style={{
              minHeight: 82,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: offerSpace.screenX,
              paddingVertical: 14,
            }}
          >
            <View
              style={{
                width: offerSize.tradeRow.thumb,
                height: offerSize.tradeRow.thumb,
                borderRadius: offerSize.tradeRow.thumb / 2,
                backgroundColor: offerColor.sunk,
              }}
            />
            <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
              <SkeletonLine width="88%" height={14} />
              <SkeletonLine width="64%" height={14} />
              <SkeletonLine width="24%" height={10} />
            </View>
            <View style={{ width: 8 }} />
          </View>
          <Hairline />
        </View>
      ))}
    </ScrollView>
  );
}

function SkeletonLine({
  width,
  height,
}: {
  width: `${number}%`;
  height: number;
}) {
  return (
    <View
      style={{
        width,
        height,
        borderRadius: height / 2,
        backgroundColor: offerColor.sunk,
      }}
    />
  );
}

/**
 * One row.
 *
 * NOT TAPPABLE WHEN THERE IS NOWHERE TO GO. `notificationTarget()` returns null
 * for a row this client has no screen for — a resolved report, a pre-v1 row whose
 * entityId was never recorded — and such a row is drawn as plain text with no
 * chevron and no press feedback. A control that responds to a tap by doing
 * nothing is the same broken promise as the bell that led here.
 */
function NotificationRow({
  item,
  wasUnread,
  onOpen,
}: {
  item: NotificationItem;
  wasUnread: boolean;
  onOpen: (path: string) => void;
}) {
  const target = notificationTarget(item);
  const name = item.actor?.name?.trim() || null;

  // The actor's name is the sentence's subject; the server's `message` is its
  // predicate. A system row is already whole and gets no prefix -- and so does
  // a message that already names them (TRADE_CANCELLED: "Aj cancelled the
  // trade for ..."), which read "Aj Aj cancelled ..." until 20 Oct 2026. The
  // push uses the same rule (baylo-api @/lib/push).
  const line = name && !item.message.startsWith(name) ? `${name} ${item.message}` : item.message;

  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: offerSpace.screenX,
        paddingVertical: 14,
      }}
    >
      <RowPicture item={item} />

      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text
          style={[
            textStyle(offerType.body),
            { color: wasUnread ? offerColor.ink : offerColor.inkSecondary },
          ]}
          // A row with nowhere to go is shown whole: this list is the only
          // place its message exists, so cutting it at three lines loses the
          // rest for good (a suspension notice runs to six or seven).
          numberOfLines={target ? 3 : undefined}
        >
          {line}
        </Text>
        <Text style={[textStyle(offerType.helper), { color: offerColor.inkTertiary }]}>
          {relativeShort(item.createdAt)}
        </Text>
        {item.type === "LISTING_EXPIRED" && item.entityId ? (
          <RelistButton itemId={item.entityId} />
        ) : null}
      </View>

      {/* The unread mark: a plain dot, never a colour event on the whole row.
          §1.10's rule holds here as much as anywhere — the row states what
          happened and nothing celebrates it. */}
      {wasUnread ? (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: offerColor.green,
          }}
        />
      ) : null}

      {target ? <RowChevron /> : null}
    </View>
  );

  if (!target) {
    return (
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={line}
        style={wasUnread ? { backgroundColor: color.greenWash } : undefined}
      >
        {body}
      </View>
    );
  }

  return (
    <Tappable
      onPress={() => onOpen(target)}
      accessibilityRole="button"
      accessibilityLabel={wasUnread ? `Unread. ${line}` : line}
      // Unread rows get a soft tint as well as the dot (4 Nov 2026).
      style={wasUnread ? { backgroundColor: color.greenWash } : undefined}
      pressedStyle={{ backgroundColor: offerColor.quiet }}
    >
      {body}
    </Tappable>
  );
}

/**
 * The expiry notice's one-tap Relist. The row itself still opens the listing
 * screen; this skips it.
 *
 * The item is fetched at the tap, not trusted from the row: the notice can be
 * days old, and what the draft is built from has to be the listing as it is
 * now. It is relisted only while it is still the owner's and still EXPIRED --
 * anything else is said, not guessed at.
 */
function RelistButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const relist = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const detail = await qc.fetchQuery({
        queryKey: itemKey(itemId),
        queryFn: () => apiV1<ItemDetailPayload>(`/api/v1/items/${encodeURIComponent(itemId)}`),
        staleTime: 0,
      });
      const { item, viewer } = detail.data;
      if (!viewer.isOwner || item.status !== "EXPIRED") {
        showDialog("Can't relist this", "This listing is no longer an expired listing of yours.");
        return;
      }
      await startRelist(item, () => router.push("/post-item"));
    } catch (e) {
      showDialog(
        "Can't relist this",
        e instanceof ApiError && e.status === 404
          ? "This listing no longer exists."
          : "Something went wrong. Please try again.",
        [{ text: "Got it" }],
        { pose: "worry" },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Tappable
      onPress={() => void relist()}
      accessibilityRole="button"
      accessibilityLabel="Relist"
      hitSlop={8}
      style={{ alignSelf: "flex-start", marginTop: 6 }}
    >
      <Text style={[textStyle(offerType.rowSubtitle), { color: busy ? offerColor.inkTertiary : offerColor.deep }]}>
        {busy ? "Opening…" : "Relist"}
      </Text>
    </Tappable>
  );
}

/**
 * The picture at the head of a row, most specific first:
 *
 *   an organisation row   the shop's logo, else the store glyph
 *   an actor              their photo, else a store glyph for a shop's
 *                         account and a person glyph for a person
 *   neither               the listing's photo, else the person glyph
 *
 * Every branch ends in a glyph rather than an empty grey square. The grey
 * square is what a MISSING PHOTO looks like elsewhere in the app, and a person
 * or shop with no picture is not a photo that failed to load.
 */
function RowPicture({ item }: { item: NotificationItem }) {
  const glyph = (kind: "store" | "person") =>
    kind === "store" ? (
      <StoreIcon size={20} stroke={1.6} color={offerColor.inkSecondary} />
    ) : (
      <PersonIcon size={20} stroke={1.5} color={offerColor.inkDisabled} />
    );

  let image: string | null;
  let icon: React.ReactNode;
  if (item.org) {
    image = orgLogoUrl(item.org.logoUrl);
    icon = glyph("store");
  } else if (item.actor) {
    image = item.actor.avatar;
    icon = glyph(item.actor.isOrg ? "store" : "person");
  } else {
    image = item.itemImage;
    icon = glyph("person");
  }

  return <Thumb image={image} size={offerSize.tradeRow.thumb} icon={icon} />;
}
