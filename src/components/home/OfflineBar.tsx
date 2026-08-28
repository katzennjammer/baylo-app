import { StyleSheet, Text, View } from "react-native";

import { WarningIcon } from "../icons";
import { clockTime, relativeLong } from "../../lib/format";
import { border, color, icon, space, textStyle, type } from "../../theme/tokens";

/**
 * The persistent half of the two-layer error handling.
 *
 * Terracotta, not a danger red, and that distinction is the whole design: this
 * bar states a condition that may last minutes and asks for nothing, while the
 * full-screen retry underneath it is the urgent layer that appears only when
 * there is no cached feed to show. Painting both in the same alarm colour would
 * make the quiet one shout.
 *
 * TWO RULES, top and bottom, both in the urgency border. The bar interrupts the
 * chrome rather than belonging to it — it is the one element in the app that is
 * fenced on both edges, which is what makes it read as an insertion into a
 * settled surface rather than as a permanent part of the header.
 *
 * The right-hand clock is the last time the app actually heard from the server,
 * not the time now. It is the number that says whether the cards below are
 * minutes or hours stale, which is the only question this bar exists to answer.
 */
export function OfflineBar({ lastSyncedAt }: { lastSyncedAt: number | null }) {
  return (
    <View
      style={s.bar}
      accessibilityRole="alert"
      accessibilityLabel={
        lastSyncedAt
          ? `No connection. Showing what is saved. Last synced ${relativeLong(lastSyncedAt)}.`
          : "No connection. Showing what is saved."
      }
    >
      <WarningIcon
        size={icon.offlineWarning.size}
        stroke={icon.offlineWarning.stroke}
        color={color.urgent}
      />
      <Text style={[textStyle(type.offlineText), s.text]} numberOfLines={1}>
        No connection. Showing what&apos;s saved.
      </Text>
      {/*
        Absent on a cold start that has never succeeded — there is no last sync
        to name, and "—:—" reads as a broken clock rather than as an absence.
        The full-screen retry is what is showing in that case anyway.
      */}
      {lastSyncedAt ? (
        <Text style={[textStyle(type.lastSynced), s.clock]}>{clockTime(lastSyncedAt)}</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.offline.gap,
    paddingHorizontal: space.screenX,
    paddingVertical: space.offline.y,
    backgroundColor: color.urgentWash,
    borderTopWidth: border.hairline,
    borderBottomWidth: border.hairline,
    borderColor: color.urgentLine,
  },
  text: { flex: 1, color: color.urgent },
  clock: { color: color.urgent },
});
