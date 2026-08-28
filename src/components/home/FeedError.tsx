import { StyleSheet, Text, View } from "react-native";

import { RefreshIcon, WarningIcon } from "../icons";
import { clockTime, relativeLong } from "../../lib/format";
import { border, color, icon, radius, size, space, textStyle, type } from "../../theme/tokens";
import { Tappable } from "../Tappable";

/**
 * The urgent layer: the whole screen, shown only when there is nothing cached.
 *
 * The persistent layer — the terracotta bar — is in AppHeader and is showing
 * above this at the same time. The two are not alternatives: the bar says the
 * connection is gone and stays for as long as that is true, and this appears
 * underneath it only when the app has no previous page to fall back on. When it
 * does have one, the cached cards render here instead and the bar alone carries
 * the message.
 *
 * "Nothing you posted was lost" is doing real work. The failure someone is
 * looking at is a READ failure, and the fear it produces is about their own
 * listings — the one thing a failed feed fetch says nothing about.
 *
 * The artboard also offers "See your saved items". That link is not here:
 * /api/v1/home returns no saved or liked collection and there is no screen
 * behind it, and an offline escape hatch that leads nowhere is worse than none,
 * because it is tapped exactly when someone is already frustrated.
 */
export function FeedError({
  message,
  lastSyncedAt,
  onRetry,
}: {
  message: string;
  lastSyncedAt: number | null;
  onRetry: () => void;
}) {
  return (
    <View style={s.wrap}>
      <View style={s.circle}>
        <WarningIcon
          size={icon.errorMark.size}
          stroke={icon.errorMark.stroke}
          color={color.inkMuted}
        />
      </View>

      <Text style={[textStyle(type.errorHeadline), s.headline]}>
        Couldn&apos;t load your feed
      </Text>

      <Text style={[textStyle(type.emptyBody), s.body]}>{message}</Text>

      <Tappable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry loading your feed"
        style={s.retry}
        pressedStyle={s.retryPressed}
      >
        <RefreshIcon
          size={icon.retryError.size}
          stroke={icon.retryError.stroke}
          color={color.onGreen}
        />
        <Text style={[textStyle(type.primaryButton), { color: color.onGreen }]}>Retry</Text>
      </Tappable>

      {/*
        Absent on a cold start that never succeeded. There is no last sync to
        report, and inventing one — "never" — answers a question nobody asked on
        their first ever launch.
      */}
      {lastSyncedAt ? (
        <Text style={[textStyle(type.lastSynced), s.synced]}>
          last synced {clockTime(lastSyncedAt)} · {relativeLong(lastSyncedAt)}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surface,
    paddingHorizontal: space.error.x,
  },
  circle: {
    width: size.errorIconCircle,
    height: size.errorIconCircle,
    borderRadius: size.errorIconCircle / 2,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    backgroundColor: color.control,
    alignItems: "center",
    justifyContent: "center",
  },
  headline: {
    marginTop: space.error.iconToHeadline,
    textAlign: "center",
    color: color.ink,
  },
  body: {
    marginTop: space.error.headlineToBody,
    textAlign: "center",
    color: color.inkSecondary,
  },
  retry: {
    marginTop: space.error.bodyToButton,
    flexDirection: "row",
    alignItems: "center",
    gap: space.card.socialGap,
    height: size.control.errorRetry,
    paddingHorizontal: size.control.errorRetryX,
    borderRadius: radius.primaryButton,
    backgroundColor: color.green,
  },
  retryPressed: { opacity: 0.85 },
  synced: { marginTop: space.error.buttonToSynced, color: color.inkStale },
});
