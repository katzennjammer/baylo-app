import { useRouter } from "expo-router";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "../src/api/client";
import {
  useActiveSessions,
  useRevokeOtherSessions,
  useRevokeSession,
  type ActiveSession,
} from "../src/api/sessions";
import { BackHeader } from "../src/components/BackHeader";
import { showDialog } from "../src/components/dialog";
import { PhoneIcon } from "../src/components/icons";
import { Tappable } from "../src/components/Tappable";
import { TradeButton } from "../src/components/trades/trade-ui";
import { relativeShort } from "../src/lib/format";
import { shortDate } from "../src/lib/gap";
import { goBack } from "../src/lib/go-back";
import { border, color, size, space, textStyle, type } from "../src/theme/tokens";

/**
 * Active sessions. Reached from Settings > Privacy and safety.
 *
 * Every device signed in to this account, this one first. "Log out" on another
 * device takes effect at once: the server refuses that device's next request.
 * This device has no button here -- Settings > Sign out is the way off it, and
 * it also forgets the tokens locally, which nothing on this screen could do for
 * another phone.
 *
 * Drawn like Blocked users: the shared back row, rows on the canvas with a
 * hairline under each, no tinted card.
 */
export default function ActiveSessionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isPending, isError, isRefetching, refetch } = useActiveSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();

  const others = data?.filter((s) => !s.isCurrent) ?? [];

  function confirmRevoke(session: ActiveSession) {
    showDialog(
      "Log out this device?",
      "It will be signed out right away and will need your password to get back in.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: () =>
            revoke.mutate(session.id, {
              onError: (e) => showDialog("Could not log that device out", failureMessage(e)),
            }),
        },
      ],
    );
  }

  function confirmRevokeOthers() {
    showDialog(
      "Log out all other devices?",
      `${others.length === 1 ? "1 other device" : `${others.length} other devices`} will be signed out right away. This device stays signed in.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out others",
          style: "destructive",
          onPress: () =>
            revokeOthers.mutate(undefined, {
              onError: (e) => showDialog("Could not log the other devices out", failureMessage(e)),
            }),
        },
      ],
    );
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <BackHeader title="Active sessions" onBack={() => goBack(router)} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space.home.sectionTop }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={color.green} />
        }
      >
        {isPending ? (
          <ActivityIndicator color={color.green} style={s.center} />
        ) : isError && !data ? (
          <View style={s.center}>
            <Text style={[textStyle(type.emptyBody), s.muted]}>Could not load your devices.</Text>
            <Tappable onPress={() => void refetch()} accessibilityRole="button" style={s.retry}>
              <Text style={[textStyle(type.secondaryButton), s.retryText]}>Try again</Text>
            </Tappable>
          </View>
        ) : data ? (
          <>
            <Text style={[textStyle(type.sectionSubcopy), s.muted, s.intro]}>
              Devices signed in to your account. If you don&apos;t recognise one, log it out and change your
              password.
            </Text>

            {data.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                busy={revoke.isPending && revoke.variables === session.id}
                onLogOut={() => confirmRevoke(session)}
              />
            ))}

            {others.length === 0 ? (
              <Text style={[textStyle(type.emptyBody), s.muted, s.center]}>
                Only this device is signed in.
              </Text>
            ) : (
              <View style={s.footer}>
                <TradeButton
                  label={revokeOthers.isPending ? "Logging out..." : "Log out all other devices"}
                  tone="outline"
                  disabled={revokeOthers.isPending}
                  onPress={confirmRevokeOthers}
                />
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SessionRow({
  session,
  busy,
  onLogOut,
}: {
  session: ActiveSession;
  busy: boolean;
  onLogOut: () => void;
}) {
  const title = session.isCurrent ? "This device" : "Other device";
  // This device is in use by definition; its lastActiveAt is only its last
  // refresh, up to fifteen minutes old, and "Active 12m ago" would be wrong.
  const active = session.isCurrent ? "now" : relativeShort(session.lastActiveAt);
  const meta = `Signed in ${shortDate(new Date(session.signedInAt))} · Active ${active}`;

  return (
    <View style={s.row} accessible={session.isCurrent} accessibilityLabel={`${title}. ${meta}`}>
      <View style={[s.badge, session.isCurrent && s.badgeCurrent]}>
        <PhoneIcon size={20} color={session.isCurrent ? color.forest : color.inkSecondary} />
      </View>
      <View style={s.rowText}>
        <Text style={[textStyle(type.username), s.ink]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[textStyle(type.sectionSubcopy), s.muted]} numberOfLines={2}>
          {meta}
        </Text>
      </View>
      {session.isCurrent ? null : (
        <TradeButton
          label={busy ? "..." : "Log out"}
          tone="quiet"
          disabled={busy}
          onPress={onLogOut}
          accessibilityLabel={`Log out this other device, signed in ${shortDate(new Date(session.signedInAt))}`}
          style={s.rowButton}
        />
      )}
    </View>
  );
}

/**
 * The server's message where it is meant for a person (a 404 "That device is
 * not signed in", the 409 for a token that predates session ids, the refresh
 * fallback); the generic line for a transport failure, whose message is written
 * for whoever is debugging the API URL.
 */
function failureMessage(e: unknown): string {
  if (e instanceof ApiError && e.status !== 0 && e.message) return e.message;
  return "Check your connection and try again.";
}

const BADGE = 40;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  center: { marginTop: 48, alignItems: "center", gap: 12, textAlign: "center", paddingHorizontal: space.screenX },
  muted: { color: color.inkSecondary },
  ink: { color: color.ink },
  intro: { paddingHorizontal: space.screenX, paddingTop: space.home.headingToContent, paddingBottom: space.home.tileBody },
  retry: { minHeight: size.control.headerIcon, justifyContent: "center", paddingHorizontal: 12 },
  retryText: { color: color.forest },
  // Settings' row: on the canvas, a hairline underneath.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.home.tileBody,
    minHeight: size.control.tabItem,
    paddingHorizontal: space.screenX,
    paddingVertical: space.home.tileBody,
    borderBottomWidth: border.hairline,
    borderBottomColor: color.divider,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.control,
  },
  badgeCurrent: { backgroundColor: color.greenWash },
  // The trade flow's button, at row height: it sits beside text, not under it.
  rowButton: { minHeight: 36, paddingHorizontal: 14, paddingVertical: 0 },
  footer: { paddingHorizontal: space.screenX, paddingTop: space.home.sectionTop },
});
