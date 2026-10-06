import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { goBack } from "../src/lib/go-back";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBlockedUsers, useUnblockUser, type BlockedUser } from "../src/api/account";
import { BackHeader } from "../src/components/BackHeader";
import { showDialog } from "../src/components/dialog";
import { Tappable } from "../src/components/Tappable";
import { border, color, radius, size, space, textStyle, type } from "../src/theme/tokens";

/**
 * Blocked users, with Unblock. Reached from Settings.
 *
 * Blocking lives on listings and conversations; this is the only place it can
 * be undone, which is why it exists at all -- without it a block was permanent.
 *
 * Drawn like Settings (3 Oct 2026): the shared back row, rows on the canvas
 * with a hairline under each, no tinted card.
 */
export default function BlockedUsersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isPending, isError, isRefetching, refetch } = useBlockedUsers();
  const unblock = useUnblockUser();

  function confirmUnblock(block: BlockedUser) {
    showDialog(
      `Unblock ${block.user.name}?`,
      "Their listings and posts will show up for you again, and you will be able to message each other.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          style: "destructive",
          onPress: () =>
            unblock.mutate(block.user.id, {
              onError: () => showDialog("Could not unblock", "Check your connection and try again."),
            }),
        },
      ],
    );
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <BackHeader title="Blocked users" onBack={() => goBack(router)} />

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
            <Text style={[textStyle(type.emptyBody), s.muted]}>Could not load your blocked users.</Text>
            <Tappable onPress={() => void refetch()} accessibilityRole="button" style={s.retry}>
              <Text style={[textStyle(type.secondaryButton), s.retryText]}>Try again</Text>
            </Tappable>
          </View>
        ) : data && data.length === 0 ? (
          <Text style={[textStyle(type.emptyBody), s.muted, s.center]}>You have not blocked anyone.</Text>
        ) : data ? (
          data.map((block) => {
            const busy = unblock.isPending && unblock.variables === block.user.id;
            return (
              <View key={block.id} style={s.row}>
                {block.user.avatar ? (
                  <Image source={{ uri: block.user.avatar }} contentFit="cover" style={s.avatar} />
                ) : (
                  <View style={[s.avatar, s.avatarFallback]}>
                    <Text style={[textStyle(type.avatarInitials40), s.initial]}>
                      {block.user.name.trim().charAt(0).toUpperCase() || "?"}
                    </Text>
                  </View>
                )}
                <Text style={[textStyle(type.username), s.name]} numberOfLines={1}>
                  {block.user.name}
                </Text>
                <Tappable
                  onPress={() => confirmUnblock(block)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Unblock ${block.user.name}`}
                  style={[s.unblock, busy && s.unblockPressed]}
                  pressedStyle={s.unblockPressed}
                >
                  <Text style={[textStyle(type.secondaryButton), s.unblockText]}>{busy ? "..." : "Unblock"}</Text>
                </Tappable>
              </View>
            );
          })
        ) : null}
      </ScrollView>
    </View>
  );
}

const AVATAR = radius.ownerAvatar * 2;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  center: { marginTop: 48, alignItems: "center", gap: 12, textAlign: "center", paddingHorizontal: space.screenX },
  muted: { color: color.inkSecondary },
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
  avatar: { width: AVATAR, height: AVATAR, borderRadius: radius.ownerAvatar },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: color.green },
  initial: { color: color.onGreen },
  name: { flex: 1, color: color.ink },
  unblock: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.heroCta,
    borderWidth: border.chip,
    borderColor: color.controlLineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  unblockPressed: { backgroundColor: color.control },
  unblockText: { color: color.ink },
});
