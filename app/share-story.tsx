import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CheckIcon, CloseIcon } from "../src/components/icons";
import { Divider } from "../src/components/Divider";
import { Tappable } from "../src/components/Tappable";
import { GridTile } from "../src/components/marketplace/GridTile";
import { showDialog } from "../src/components/dialog";
import { ApiError } from "../src/api/client";
import { getActingOrgId } from "../src/api/org-context";
import { useProfileMe } from "../src/api/profile";
import { STORY_CAPTION_MAX, useCreateStory, useStories } from "../src/api/stories";
import { clockTime } from "../src/lib/format";
import type { Item } from "../src/api/types";
import { border, color, radius, size, space, textStyle, type } from "../src/theme/tokens";

/**
 * "Share a listing" -- the one way to start a story in v1 (2 Oct 2026).
 *
 * A grid of YOUR AVAILABLE listings (from /api/v1/profile/me, the shelf the
 * offer flow already reads), an optional caption up to 200 characters, and
 * "Share to story". The server re-checks everything -- ownership, AVAILABLE,
 * not hidden, the 10-a-day cap -- so this screen only has to say the refusals
 * in plain words.
 *
 * A listing already in your story is shown but can't be picked: the server
 * allows one live story per listing.
 *
 * PERSONAL ONLY. While acting as a shop the screen says so instead of offering
 * the shop's shelf, which the server would refuse.
 */
export default function ShareStoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const actingAsShop = getActingOrgId() !== null;

  const me = useProfileMe(!actingAsShop);
  const { data: authors = [] } = useStories();
  const create = useCreateStory();

  const [selected, setSelected] = useState<string | null>(null);
  const [caption, setCaption] = useState("");

  const inStory = useMemo(
    () => new Set((authors.find((a) => a.isOwn)?.stories ?? []).map((st) => st.item.id)),
    [authors],
  );
  const listings = useMemo(
    () => (me.data?.items ?? []).filter((i) => i.status === "AVAILABLE" && !i.hiddenByModerator),
    [me.data],
  );

  const tileWidth = Math.floor((width - space.browse.gridX * 2 - space.browse.gridGap) / 2);
  const close = () => {
    if (router.canGoBack()) router.back();
  };

  const share = () => {
    if (!selected || create.isPending) return;
    create.mutate(
      { itemId: selected, caption },
      {
        onSuccess: close,
        onError: (e) => {
          const code = e instanceof ApiError ? (e.meta.code as string | undefined) ?? e.code : null;
          if (code === "DAILY_CAP") {
            const at = e instanceof ApiError ? Date.parse(String(e.meta.retryAt ?? "")) : NaN;
            showDialog(
              "That's today's limit",
              `You can share up to 10 stories a day.${Number.isFinite(at) ? ` You can share again at ${clockTime(at)}.` : ""}`,
            );
          } else if (code === "ALREADY_SHARED") {
            showDialog("Already in your story", "This listing is already in your story.");
          } else if (code === "PERSONAL_ONLY") {
            showDialog("Stories are personal", "Switch to your own account to share a story.");
          } else if (e instanceof ApiError && e.status === 404) {
            showDialog("Can't share this listing", "It's no longer available. Pick another one.");
            setSelected(null);
            void me.refetch();
          } else if (e instanceof ApiError && e.status === 429) {
            showDialog("Slow down a little", "You're sharing too fast. Try again in a few minutes.");
          } else {
            showDialog("Couldn't share", "Check your connection and try again.");
          }
        },
      },
    );
  };

  const header = (
    <View style={[s.header, { paddingTop: insets.top + 6 }]}>
      <Tappable
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={s.closeButton}
        pressedStyle={s.pressedFade}
      >
        <CloseIcon size={22} stroke={2} color={color.ink} />
      </Tappable>
      <Text style={[textStyle(type.sheetTitle), { color: color.ink }]}>Share a listing</Text>
    </View>
  );

  if (actingAsShop) {
    return (
      <View style={s.root}>
        {header}
        <Message title="Stories are personal" body="Switch to your own account to share a listing to your story." />
      </View>
    );
  }

  if (me.isPending) {
    return (
      <View style={s.root}>
        {header}
        <View style={s.center}>
          <ActivityIndicator color={color.green} />
        </View>
      </View>
    );
  }

  if (me.isError) {
    return (
      <View style={s.root}>
        {header}
        <Message title="Couldn't load your listings" body="Check your connection and try again." action={{ label: "Try again", onPress: () => void me.refetch() }} />
      </View>
    );
  }

  if (listings.length === 0) {
    return (
      <View style={s.root}>
        {header}
        <Message
          title="Nothing to share yet"
          body="Stories share one of your available listings. Post an item first."
          action={{ label: "Post an item", onPress: () => router.replace("/post") }}
        />
      </View>
    );
  }

  const renderTile = ({ item }: { item: Item }) => {
    const taken = inStory.has(item.id);
    const on = selected === item.id;
    return (
      <View style={{ width: tileWidth, opacity: taken ? 0.45 : 1 }}>
        <GridTile
          item={item}
          width={tileWidth}
          viewerId={item.owner.id}
          onPress={() => {
            if (taken) {
              showDialog("Already in your story", "This listing is already in your story.");
              return;
            }
            setSelected(on ? null : item.id);
          }}
        />
        {on ? (
          <View style={s.selectedRing} pointerEvents="none">
            <View style={s.check}>
              <CheckIcon size={14} stroke={2.4} color={color.onGreen} />
            </View>
          </View>
        ) : null}
        {taken ? (
          <View style={s.takenTag} pointerEvents="none">
            <Text style={[textStyle(type.storefrontOverlay), { color: color.onScrim }]}>In your story</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {header}
      <Text style={[textStyle(type.sectionSubcopy), s.subcopy]}>
        Pick one of your listings. It stays in your story for 24 hours.
      </Text>
      <FlatList
        data={listings}
        keyExtractor={(i) => i.id}
        renderItem={renderTile}
        numColumns={2}
        columnWrapperStyle={{ gap: space.browse.gridGap }}
        contentContainerStyle={s.grid}
        keyboardShouldPersistTaps="handled"
      />

      <Divider />
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Add a caption (optional)"
          placeholderTextColor={color.inkMuted}
          maxLength={STORY_CAPTION_MAX}
          multiline
          style={[textStyle(type.searchInput), s.input]}
          accessibilityLabel="Caption, optional"
        />
        <Text style={[textStyle(type.gridMeta), s.counter]}>
          {caption.length}/{STORY_CAPTION_MAX}
        </Text>
        <Tappable
          onPress={share}
          disabled={!selected || create.isPending}
          accessibilityRole="button"
          accessibilityLabel="Share to story"
          accessibilityState={{ disabled: !selected || create.isPending }}
          style={[s.shareButton, (!selected || create.isPending) && s.shareDisabled]}
          pressedStyle={s.pressedFade}
        >
          {create.isPending ? (
            <ActivityIndicator color={color.onGreen} />
          ) : (
            <Text style={[textStyle(type.primaryButton), { color: color.onGreen }]}>Share to story</Text>
          )}
        </Tappable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Message({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={s.center}>
      <Text style={[textStyle(type.emptyHeadline), s.centerText, { color: color.ink }]}>{title}</Text>
      <Text style={[textStyle(type.emptyBody), s.centerText, { color: color.inkSecondary }]}>{body}</Text>
      {action ? (
        <Tappable onPress={action.onPress} accessibilityRole="button" style={s.messageButton} pressedStyle={s.pressedFade}>
          <Text style={[textStyle(type.primaryButton), { color: color.onGreen }]}>{action.label}</Text>
        </Tappable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.screenX - 10,
    paddingBottom: 6,
  },
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pressedFade: { opacity: 0.7 },
  subcopy: { paddingHorizontal: space.screenX, paddingBottom: 10, color: color.inkSecondary },
  grid: { paddingHorizontal: space.browse.gridX, paddingBottom: 16, gap: space.browse.gridGap },

  selectedRing: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.gridTile,
    borderWidth: 3,
    borderColor: color.green,
  },
  check: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.green,
  },
  takenTag: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.countdownPill,
    backgroundColor: color.captionFill,
  },

  footer: { paddingHorizontal: space.screenX, paddingTop: 12, gap: 6 },
  input: {
    minHeight: 44,
    maxHeight: 110,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.primaryButton,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    backgroundColor: color.control,
    color: color.ink,
  },
  counter: { alignSelf: "flex-end", color: color.inkMuted },
  shareButton: {
    minHeight: size.control.primaryButton,
    borderRadius: radius.primaryButton,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.green,
  },
  shareDisabled: { opacity: 0.45 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 10 },
  centerText: { textAlign: "center" },
  messageButton: {
    marginTop: 8,
    minHeight: size.control.primaryButton,
    paddingHorizontal: 24,
    borderRadius: radius.primaryButton,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.green,
  },
});
