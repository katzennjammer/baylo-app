import { usePathname, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "../api/client";
import { BellIcon, LeafIcon, MessageIcon } from "./icons";
import { NoticeDialog } from "./NoticeDialog";
import { Divider } from "./Divider";
import { OfflineBar } from "./home/OfflineBar";
import { formatBadge, formatLeaves } from "../lib/format";
import {
  border,
  breakpoint,
  color,
  icon,
  radius,
  size,
  space,
  textStyle,
  type,
} from "../theme/tokens";
import { useHome } from "../api/home";
import { useSession } from "../auth/session";

/**
 * The header on every tab: wordmark, Leaves balance, notifications, messages.
 *
 * All four numbers come from useHome(), the SAME query the feed renders from.
 * That is the point of /api/v1/home being a composite endpoint — the viewer
 * block and the three unread counts ride along with the feed page, so the
 * header costs nothing. Calling the hook here does not issue a second request;
 * TanStack dedupes on the query key, and this component and the Home screen
 * share one.
 *
 * The consequence, and it is a real one: on tabs that are not Home, the numbers
 * are whatever the last /home fetch returned. They go stale until something
 * refetches it. That is the correct trade at this stage — the alternative is a
 * second polling endpoint for two integers — but it is why the balance is not
 * treated as authoritative anywhere a decision depends on it.
 *
 * MESSAGES IS A HEADER ICON rather than a bottom tab. A bottom tab spends a
 * fifth of the bar permanently, and the bar is for the places you go to do the
 * app's job — look at what is offered, list a thing, run a trade. Messages is
 * where you go when a trade is already happening, which is a notification-
 * shaped need rather than a destination-shaped one: as a header icon it keeps
 * its unread count visible from every tab and hands the freed slot to
 * Marketplace.
 *
 * GEOMETRY. The spec's 98 px is 44 of safe area + a 44 content row + 10 below
 * it. Only the last two are fixed here; the first is whatever the handset
 * actually reserves, which on Android is frequently 24 rather than 44. Pinning
 * it to 44 would paint 20 px of dead space above the wordmark on most of the
 * devices this ships to.
 */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { viewer, unread, isPending, isError, error, dataUpdatedAt } = useHome();
  const [menuOpen, setMenuOpen] = useState(false);

  // A 401 is not a connection problem, and saying so would be the last thing
  // someone reads before being bounced to the login screen. By the time the
  // query fails this way the interceptor has already tried to refresh and given
  // up, so the session is cleared and (app)/_layout.tsx is one render away from
  // replacing this whole tree.
  const offline = isError && !(error instanceof ApiError && error.code === "UNAUTHENTICATED");

  // The spec's second breakpoint. Only the header reflows; everything below it
  // is on flex and needs nothing.
  const tight = width <= breakpoint.tight;

  return (
    <View style={{ backgroundColor: color.surface }}>
      {/* paddingTop rather than SafeAreaView: the header must PAINT behind the
          status bar and merely inset its contents. A SafeAreaView here would
          leave an unpainted strip above it in whatever the window colour is. */}
      <View style={{ paddingTop: insets.top }}>
        <View
          style={[
            s.row,
            {
              height: space.header.row,
              marginBottom: space.header.bottom,
              paddingHorizontal: tight ? space.screenXTight : space.screenX,
            },
          ]}
        >
          {/*
            The wordmark is what yields. The spec is explicit that the Leaves
            pill never shrinks, so the pill is the rigid one and this is the
            flexible one — at 360 px with a five-digit balance and a 99+ badge
            the space has to come from somewhere, and a clipped "Bayl…" is a
            better failure than a balance the reader cannot trust.
          */}
          <Text
            style={[
              textStyle(tight ? type.wordmarkTight : type.wordmark),
              // flexShrink is 0 by default in React Native, unlike CSS. Without
              // this the wordmark refuses to give ground and the row overflows
              // instead of eliding — which is the opposite of the rule above.
              { color: color.ink, flexShrink: 1 },
            ]}
            numberOfLines={1}
          >
            Baylo
          </Text>

          <View style={[s.actions, { gap: tight ? space.header.gapTight : space.header.gap }]}>
            <LeavesPill
              // A dash, not 0. Before the first response lands the balance is
              // unknown, and 0 is a number someone might act on.
              value={isPending && viewer === undefined ? null : (viewer?.leaves ?? 0)}
              stale={offline}
              tight={tight}
            />

            <HeaderIconButton
              label="Notifications"
              count={unread?.notifications ?? 0}
              tight={tight}
              // It opens something now. This was `() => {}` for the life of the
              // client while the badge beside it reported a real, accurate,
              // unreachable number — see the note at the top of
              // `app/notifications.tsx`.
              onPress={() => router.push("/notifications")}
            >
              <BellIcon
                size={icon.headerAction.size}
                stroke={icon.headerAction.stroke}
                color={color.ink}
              />
            </HeaderIconButton>

            <HeaderIconButton
              label="Messages"
              count={unread?.messages ?? 0}
              tight={tight}
              onPress={() => router.push("/messages")}
            >
              <MessageIcon
                size={icon.headerAction.size}
                stroke={icon.headerAction.stroke}
                color={color.ink}
              />
            </HeaderIconButton>
            {pathname.endsWith("/profile") ? (
              <View style={s.menuAnchor}>
                <HeaderIconButton
                  label={menuOpen ? "Close account menu" : "Open account menu"}
                  count={0}
                  tight={tight}
                  onPress={() => setMenuOpen((open) => !open)}
                >
                  <Ionicons name="menu" size={24} color={color.ink} />
                </HeaderIconButton>
                {menuOpen ? (
                  <AccountMenu
                    onClose={() => setMenuOpen(false)}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/*
        Under the top bar, above everything else, and pinned. It lives here
        rather than on the Home screen so it survives a tab change — the
        connection is gone on Trades too. The divider goes BELOW it so the
        header always ends in one rule, whether or not the bar is showing.
      */}
      {offline ? <OfflineBar lastSyncedAt={dataUpdatedAt || null} /> : null}
      <Divider />
    </View>
  );
}

function AccountMenu({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { signOut } = useSession();
  // Quests has no screen yet, so the menu item opens a notice rather than a
  // route. The dialog is mounted here (not in the header) so it lives and dies
  // with the menu that opened it, the same way the Premium/VIP item states
  // its "coming soon" without leaving the screen.
  const [questOpen, setQuestOpen] = useState(false);

  const confirmSignOut = () => {
    Alert.alert(
      "Sign out?",
      "This device will forget your tokens, and the session is revoked on the server so it cannot be resumed.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => void signOut() },
      ],
    );
  };

  return (
    <View style={s.accountMenu} accessibilityRole="menu">
      <Pressable
        onPress={() => {
          onClose();
          router.push("/settings");
        }}
        accessibilityRole="menuitem"
        style={s.accountMenuItem}
      >
        <Ionicons name="settings-outline" size={19} color={color.ink} />
        <Text style={s.accountMenuText}>Settings</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          onClose();
          Alert.alert("Premium/VIP", "Premium and VIP features are coming soon.");
        }}
        accessibilityRole="menuitem"
        style={s.accountMenuItem}
      >
        <Ionicons name="star-outline" size={19} color={color.ink} />
        <Text style={s.accountMenuText}>Premium/VIP</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          onClose();
          router.push("/achievements");
        }}
        accessibilityRole="menuitem"
        style={s.accountMenuItem}
      >
        <Ionicons name="trophy-outline" size={19} color={color.ink} />
        <Text style={s.accountMenuText}>Achievements</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          onClose();
          setQuestOpen(true);
        }}
        accessibilityRole="menuitem"
        style={s.accountMenuItem}
      >
        <Ionicons name="flag-outline" size={19} color={color.ink} />
        <Text style={s.accountMenuText}>Quests</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          onClose();
          confirmSignOut();
        }}
        accessibilityRole="menuitem"
        style={[s.accountMenuItem, s.accountMenuItemLast]}
      >
        <Ionicons name="log-out-outline" size={19} color={color.urgent} />
        <Text style={[s.accountMenuText, { color: color.urgent }]}>Sign out</Text>
      </Pressable>

      <NoticeDialog
        visible={questOpen}
        title="Quests are on the way"
        body="Ongoing quests will land here soon — little challenges you complete for Leaves. Check back shortly."
        icon={<Ionicons name="flag-outline" size={24} color={color.forest} />}
        onDismiss={() => setQuestOpen(false)}
      />
    </View>
  );
}

/**
 * The Leaves balance. Fixed height, never shrinks, tabular numerals.
 *
 * `tabular-nums` is honoured on iOS and is a no-op on Android, where React
 * Native exposes no way to switch on an OpenType feature. That asymmetry is
 * survivable because nothing here is positioned off the digits' width: the pill
 * hugs its content and the row reserves space for it before the wordmark. The
 * digits may breathe by a pixel on Android; nothing moves.
 *
 * `stale` is the offline treatment — the numerals drop to the disabled grey.
 * The balance is the one number on this screen someone might act on, and while
 * the app cannot reach the server it is a number of unknown age.
 */
function LeavesPill({
  value,
  stale,
  tight,
}: {
  value: number | null;
  stale: boolean;
  tight: boolean;
}) {
  const leaf = tight ? icon.headerLeafTight : icon.headerLeaf;
  const ink = stale ? color.inkStale : color.forest;

  return (
    <View
      style={[
        s.pill,
        {
          height: tight ? size.leaves.headerPillTight : size.leaves.headerPill,
          borderRadius: tight ? radius.leavesPillHeaderTight : radius.leavesPillHeader,
          paddingLeft: tight ? size.leaves.headerPillLeftTight : size.leaves.headerPillLeft,
          paddingRight: tight ? size.leaves.headerPillRightTight : size.leaves.headerPillRight,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={value === null ? "Leaves balance loading" : `${value} Leaves`}
    >
      <LeafIcon size={leaf.size} stroke={leaf.stroke} color={ink} />
      <Text
        style={[textStyle(tight ? type.leavesHeaderTight : type.leavesHeader), { color: ink }]}
      >
        {value === null ? "—" : formatLeaves(value)}
      </Text>
    </View>
  );
}

/**
 * A 44 px target with a count on it.
 *
 * The glyph is 21 px inside a 44 px box, so most of what a thumb lands on is
 * empty space around the mark. That is the point — the artboard draws no button
 * chrome at all, and the only thing keeping this reachable is the box being
 * much larger than what it contains. At the tight breakpoint the box gives up
 * width and keeps its height: height is the axis a thumb misses on in a row of
 * icons, so it is the one that is fixed.
 */
function HeaderIconButton({
  label,
  count,
  tight,
  onPress,
  children,
}: {
  label: string;
  count: number;
  tight: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `${label}, ${count} unread` : label}
      style={{
        width: tight ? size.control.headerIconTight : size.control.headerIcon,
        height: size.control.headerIcon,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
      {count > 0 ? <UnreadBadge count={count} /> : null}
    </Pressable>
  );
}

/**
 * 17 px tall, capped at 99+, ringed in the surface colour.
 *
 * The ring is not decoration. The badge overlaps the glyph it belongs to, and
 * a bright green shape on a dark stroke at 10 px has no edge of its own; the
 * 2 px of surface around it is what separates the two. It is drawn as a border
 * rather than a shadow so it renders identically on both platforms.
 *
 * "99+" is wider than a digit, so it also shifts 4 px further right — otherwise
 * the third glyph pushes past the button's own box and clips against whatever
 * is beside it.
 */
function UnreadBadge({ count }: { count: number }) {
  const label = formatBadge(count);
  const wide = label === "99+";

  return (
    <View
      style={[
        s.badge,
        {
          height: size.badge.unread,
          minWidth: size.badge.unread,
          borderRadius: radius.unreadBadge,
          borderWidth: border.unreadRing,
          paddingHorizontal: wide ? size.badge.unreadXWide : size.badge.unreadX,
          top: size.badge.unreadTop,
          right: wide ? size.badge.unreadRightWide : size.badge.unreadRight,
        },
      ]}
      // The count is already in the button's accessibilityLabel; announcing it
      // twice makes the button read "Messages, 3 unread, 3".
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[textStyle(type.unreadBadge), { color: color.onGreen }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actions: { flexShrink: 0, flexDirection: "row", alignItems: "center" },
  menuAnchor: { position: "relative" },
  accountMenu: {
    position: "absolute",
    top: size.control.headerIcon + 4,
    right: 0,
    minWidth: 166,
    backgroundColor: color.surface,
    borderColor: color.divider,
    borderWidth: 1,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
    zIndex: 20,
  },
  accountMenuItem: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  accountMenuItemLast: { borderTopWidth: 1, borderTopColor: color.divider },
  accountMenuText: { color: color.ink, fontSize: 14, fontWeight: "600" },
  pill: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: size.leaves.gap,
    backgroundColor: color.greenWash,
    borderWidth: border.chip,
    borderColor: color.greenLine,
  },
  badge: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.green,
    borderColor: color.surface,
  },
});
