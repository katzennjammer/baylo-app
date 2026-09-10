import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { ScrollView, Text, View } from "react-native";

import { ApiError } from "../src/api/client";
import {
  notificationTarget,
  useMarkAllNotificationsRead,
  useNotifications,
} from "../src/api/notifications";
import type { NotificationItem } from "../src/api/types";
import { Splash } from "../src/components/Splash";
import { Hairline, OfferScreenHost } from "../src/components/offer/chrome";
import { PersonIcon } from "../src/components/icons";
import { Gutter, TradesBackTitle } from "../src/components/trades/chrome";
import { RowChevron, Thumb } from "../src/components/trades/rows";
import { TradesErrorPanel, TradesSkeleton } from "../src/components/trades/states";
import { Tappable } from "../src/components/Tappable";
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
 * ══ EVERY ROW IS READ ON OPEN. THE DOTS STAY ANYWAY. ═══════════════════════
 *
 * Opening the list marks the whole thing read — see `useMarkAllNotificationsRead`
 * for why that, and not per-row. But the unread DOT is drawn from a snapshot
 * taken on the first render and does not move while the screen is up.
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
  const list = useNotifications();
  const markAll = useMarkAllNotificationsRead();

  /*
   * The snapshot behind the dots. Captured the first time rows arrive and never
   * rewritten — `markAll` invalidates the query a moment later and the refetched
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
   * Fire once, and only when there is something to clear.
   *
   * `markAll.mutate` is deliberately NOT in the dependency array: the mutation
   * object is a new reference on every render, and depending on it would fire
   * this effect on each one — a PATCH per render for as long as the screen is
   * open. The ref guard is what makes "once" true rather than merely likely.
   */
  const cleared = useRef(false);
  const unreadCount = list.data?.unreadCount ?? 0;
  useEffect(() => {
    if (cleared.current || unreadCount === 0) return;
    cleared.current = true;
    markAll.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount]);

  const apiError = list.error instanceof ApiError ? list.error : null;
  if (apiError?.code === "UNAUTHENTICATED") {
    return <Splash waitingOn="Signing you back in" />;
  }

  const rows = list.data?.notifications ?? [];

  return (
    <OfferScreenHost imeInset={0}>
      <TradesBackTitle title="Notifications" onBack={() => router.back()} />

      {list.isError ? (
        <TradesErrorPanel onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <TradesSkeleton />
      ) : rows.length === 0 ? (
        <Gutter style={{ paddingTop: 18 }}>
          <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
            Nothing yet. Offers, trades and messages you need to know about land here.
          </Text>
        </Gutter>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          <Hairline />
          {rows.map((n) => (
            <View key={n.id}>
              <NotificationRow
                item={n}
                wasUnread={unreadOnEntry.current?.has(n.id) ?? false}
                onOpen={(path) => router.push(path as never)}
              />
              <Hairline />
            </View>
          ))}
        </ScrollView>
      )}
    </OfferScreenHost>
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
  // predicate. A system row is already whole and gets no prefix.
  const line = name ? `${name} ${item.message}` : item.message;

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
      <Thumb
        image={item.actor?.avatar ?? null}
        size={offerSize.tradeRow.thumb}
        icon={
          item.actor ? undefined : (
            <PersonIcon size={20} stroke={1.5} color={offerColor.inkDisabled} />
          )
        }
      />

      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text
          style={[
            textStyle(offerType.body),
            { color: wasUnread ? offerColor.ink : offerColor.inkSecondary },
          ]}
          numberOfLines={3}
        >
          {line}
        </Text>
        <Text style={[textStyle(offerType.deadline), { color: offerColor.inkTertiary }]}>
          {relativeShort(item.createdAt)}
        </Text>
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
      <View accessible accessibilityRole="text" accessibilityLabel={line}>
        {body}
      </View>
    );
  }

  return (
    <Tappable
      onPress={() => onOpen(target)}
      accessibilityRole="button"
      accessibilityLabel={wasUnread ? `Unread. ${line}` : line}
      pressedStyle={{ backgroundColor: offerColor.quiet }}
    >
      {body}
    </Tappable>
  );
}
