import { Image } from "expo-image";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Tappable } from "../Tappable";
import { ApiError } from "../../api/client";
import { useAddComment, useComments } from "../../api/social";
import { relativeShort } from "../../lib/format";
import {
  border,
  color,
  radius,
  size,
  space,
  textStyle,
  type,
} from "../../theme/tokens";
import type { Item, ItemComment } from "../../api/types";

/** The server's own cap, mirrored so the field stops rather than being refused. */
const MAX_COMMENT = 2000;

/**
 * The comment sheet behind the card's comment glyph.
 *
 * ── NEWEST FIRST, WHICH IS NOT WHAT A CHAT DOES ─────────────────────────────
 *
 * GET /api/v1/items/[id]/comments sorts descending, and this renders in the
 * order it arrives: the most recent comment is at the top, and "load more"
 * walks backwards in time. That is deliberate and it is the endpoint's own
 * reasoning — a listing's comments are a queue of questions ("is this still
 * available", "would you take X"), and the useful one is the last one asked,
 * not the first. A transcript reads oldest-first; a queue does not.
 *
 * It also means the list does NOT need to be inverted or scrolled to the
 * bottom on open, and a posted comment appears exactly where the reader is
 * already looking. `useAddComment` prepends it to page 0 for that reason.
 *
 * ── ONE SHEET, MOUNTED BY THE SCREEN ────────────────────────────────────────
 *
 * Same arrangement as ListingMenu: the feed owns it, the card only raises
 * `onComment(item)`. The query is `enabled` on visibility rather than on the
 * item id, so changing which listing the sheet points at while it is closed
 * fetches nothing.
 */
export function CommentsSheet({
  item,
  onClose,
}: {
  /** The listing whose comments are open. Null closes the sheet. */
  item: Item | null;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");

  const {
    comments,
    isPending,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useComments(item?.id ?? null, item !== null);

  const add = useAddComment(item?.id ?? null);

  // Cleared when the sheet is pointed at a different listing — a draft is about
  // the listing it was typed under, and carrying it across would put somebody's
  // half-written question on a stranger's item.
  useEffect(() => {
    setDraft("");
  }, [item?.id]);

  if (!item) return null;

  const trimmed = draft.trim();
  const canSend = trimmed.length > 0 && !add.isPending;

  const send = () => {
    if (!canSend) return;
    add.mutate(trimmed, {
      // The draft is cleared HERE and not before the request. A comment that
      // failed to send and took the text with it is the one failure in this
      // whole screen that loses something a person made.
      onSuccess: () => setDraft(""),
      onError: (e) =>
        Alert.alert(
          "Could not post that",
          e instanceof ApiError ? e.message : "Something went wrong. Please try again.",
        ),
    });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close comments" />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.sheet}>
          <View style={s.handle} />

          <Text style={[textStyle(type.sheetTitle), s.title]} numberOfLines={1}>
            {item.stats.comments === 1 ? "1 comment" : `${item.stats.comments} comments`}
          </Text>

          <View style={s.list}>
            {isPending ? (
              <View style={s.state}>
                <ActivityIndicator color={color.green} />
              </View>
            ) : isError ? (
              <View style={s.state}>
                <Text style={[textStyle(type.detailBody), s.stateText]}>
                  {error instanceof ApiError && error.code === "NOT_FOUND"
                    ? "This listing is no longer available."
                    : "Could not load the comments."}
                </Text>
                <Tappable
                  onPress={() => refetch()}
                  accessibilityRole="button"
                  style={s.retry}
                  pressedStyle={s.secondaryPressed}
                >
                  <Text style={[textStyle(type.secondaryButton), { color: color.inkSecondary }]}>
                    Try again
                  </Text>
                </Tappable>
              </View>
            ) : comments.length === 0 ? (
              <View style={s.state}>
                <Text style={[textStyle(type.detailBody), s.stateText]}>
                  No comments yet. Ask the owner anything you need to know before offering.
                </Text>
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(c) => c.id}
                renderItem={({ item: comment }) => <CommentRow comment={comment} />}
                onEndReached={() => {
                  if (hasNextPage && !isFetchingNextPage) fetchNextPage();
                }}
                onEndReachedThreshold={0.5}
                keyboardShouldPersistTaps="handled"
                ListFooterComponent={
                  isFetchingNextPage ? (
                    <View style={s.more}>
                      <ActivityIndicator color={color.green} />
                    </View>
                  ) : null
                }
              />
            )}
          </View>

          <View style={s.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              maxLength={MAX_COMMENT}
              placeholder="Add a comment"
              placeholderTextColor={color.inkMuted}
              accessibilityLabel="Write a comment"
              multiline
              style={[textStyle(type.detailBody), s.input]}
            />

            <Tappable
              onPress={send}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Post comment"
              accessibilityState={{ disabled: !canSend }}
              style={[s.send, !canSend && s.sendDisabled]}
              pressedStyle={s.sendPressed}
            >
              {add.isPending ? (
                <ActivityIndicator color={color.onGreen} />
              ) : (
                <Text style={[textStyle(type.secondaryButton), { color: color.onGreen }]}>
                  Post
                </Text>
              )}
            </Tappable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * One comment.
 *
 * `replyCount` arrives on every row and is deliberately not drawn. There is no
 * thread screen, so "2 replies" would be a line of text that reports something
 * the reader cannot go and see — the same dead affordance the card's own social
 * row had before this pass.
 */
function CommentRow({ comment }: { comment: ItemComment }) {
  return (
    <View style={s.row}>
      {comment.user.avatar ? (
        <Image source={{ uri: comment.user.avatar }} contentFit="cover" style={s.avatar} />
      ) : (
        <View style={[s.avatar, s.avatarFallback]}>
          <Text style={[textStyle(type.avatarInitials40), { color: color.forest }]}>
            {comment.user.name.trim().charAt(0).toUpperCase() || "?"}
          </Text>
        </View>
      )}

      <View style={s.rowText}>
        <View style={s.rowHead}>
          <Text style={[textStyle(type.username), s.name]} numberOfLines={1}>
            {comment.user.name}
          </Text>
          <Text style={[textStyle(type.metadata), { color: color.inkMuted }]}>
            {relativeShort(comment.createdAt)}
          </Text>
        </View>
        <Text style={[textStyle(type.detailBody), s.body]}>{comment.content}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: color.captionFill },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: space.sheet.top,
    paddingBottom: space.sheet.bottom,
    // A fixed fraction rather than content height: the list grows as pages
    // load, and a sheet that changed height under the reader's thumb as page 2
    // arrived would move the composer they were reaching for.
    height: "78%",
  },
  handle: {
    alignSelf: "center",
    width: size.sheet.handleW,
    height: size.sheet.handleH,
    borderRadius: size.sheet.handleH / 2,
    backgroundColor: color.controlLineStrong,
  },
  title: { marginTop: space.sheet.top, paddingHorizontal: space.sheet.x, color: color.ink },

  list: { flex: 1, marginTop: space.sheet.titleToBody, paddingHorizontal: space.sheet.x },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sheet.actionGap },
  stateText: { textAlign: "center", color: color.inkMuted },
  retry: {
    height: size.sheet.option,
    paddingHorizontal: size.sheet.optionX,
    borderRadius: radius.sheetOption,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryPressed: { backgroundColor: color.control },
  more: { paddingVertical: space.sheet.actionGap },

  row: {
    flexDirection: "row",
    gap: space.card.ownerGap,
    paddingVertical: space.sheet.labelToOptions,
  },
  avatar: {
    width: size.avatar.owner,
    height: size.avatar.owner,
    borderRadius: radius.ownerAvatar,
    backgroundColor: color.greenWash,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1 },
  rowHead: { flexDirection: "row", alignItems: "baseline", gap: space.card.nameToBadge },
  name: { flexShrink: 1, color: color.ink },
  body: { marginTop: space.card.nameToMeta, color: color.inkSecondary },

  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sheet.actionGap,
    paddingHorizontal: space.sheet.x,
    paddingTop: space.sheet.labelToOptions,
    borderTopWidth: border.hairline,
    borderTopColor: color.divider,
  },
  input: {
    flex: 1,
    minHeight: size.sheet.rangeInput,
    // Bounded so a long comment scrolls inside the field instead of pushing the
    // list off the top of the sheet.
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.rangeInput,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    backgroundColor: color.control,
    color: color.ink,
    textAlignVertical: "top",
  },
  send: {
    height: size.sheet.rangeInput,
    paddingHorizontal: 18,
    borderRadius: radius.rangeInput,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.45 },
  sendPressed: { opacity: 0.85 },
});
