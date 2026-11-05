import { Image } from "expo-image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, type KeyboardEvent, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Tappable } from "../Tappable";
import { ApiError } from "../../api/client";
import { useAddComment, useComments } from "../../api/social";
import { relativeShort } from "../../lib/format";
import { border, color, font, radius, size, space, textStyle, type } from "../../theme/tokens";
import { MascotEmptyState } from "../MascotEmptyState";
import { Ionicons } from "@expo/vector-icons";
import type { Item, ItemComment } from "../../api/types";
import { showDialog } from "../dialog";
import { sizedImage } from "../../media/image-url";

const MAX_COMMENT = 2000;

export function CommentsSheet({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const { comments, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useComments(item?.id ?? null, item !== null);
  const add = useAddComment(item?.id ?? null);
  const insets = useSafeAreaInsets();
  const { rootRef, onRootLayout, overlap } = useKeyboardOverlap(item !== null);
  useEffect(() => { setDraft(""); setReplyTo(null); }, [item?.id]);
  if (!item) return null;
  const send = () => {
    const content = draft.trim();
    if (!content || add.isPending) return;
    add.mutate({ content, parentId: replyTo?.id }, { onSuccess: () => { setDraft(""); setReplyTo(null); }, onError: (e) => showDialog("Could not post that", e instanceof ApiError ? e.message : "Something went wrong. Please try again.") });
  };
  return <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
    <View ref={rootRef} onLayout={onRootLayout} style={s.root}>
    <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close comments" />
      {/* To the bottom of the SCREEN, over the listing's sticky bar: the modal
          is translucent under both system bars, so the sheet pads for the
          home indicator itself -- or, with the keyboard up, for the keyboard. */}
      <View style={[s.sheet, { paddingBottom: overlap > 0 ? overlap + KEYBOARD_GAP : space.sheet.bottom + insets.bottom }]}>
        <View style={s.handle} />
        <Text style={[textStyle(type.sheetTitle), s.title]} numberOfLines={1}>{item.stats.comments === 1 ? "1 comment" : `${item.stats.comments} comments`}</Text>
        <View style={s.list}>{isPending ? <View style={s.state}><ActivityIndicator color={color.green} /></View> : isError ? <View style={s.state}><Text style={[textStyle(type.detailBody), s.stateText]}>{error instanceof ApiError && error.code === "NOT_FOUND" ? "This listing is no longer available." : "Could not load the comments."}</Text><Tappable onPress={() => refetch()} accessibilityRole="button" style={s.retry}><Text style={[textStyle(type.secondaryButton), { color: color.inkSecondary }]}>Try again</Text></Tappable></View> : comments.length === 0 ? <View style={s.state}><MascotEmptyState pose="search" size={96} title="No questions yet" message="Ask the owner anything you need to know before you offer." /></View> : <FlatList data={comments} keyExtractor={(comment) => comment.id} renderItem={({ item: comment }) => <CommentRow comment={comment} ownerId={item.owner.id} onReply={(id, name) => setReplyTo({ id, name })} onAuthor={(id) => router.push({ pathname: "/user", params: { id } })} />} onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }} onEndReachedThreshold={0.5} keyboardShouldPersistTaps="handled" ListFooterComponent={isFetchingNextPage ? <View style={s.more}><ActivityIndicator color={color.green} /></View> : null} />}</View>
        <View style={s.composer}>
          {replyTo ? <View style={{ position: "absolute", left: space.sheet.x, right: space.sheet.x, top: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={[textStyle(type.metadata), { color: color.inkMuted, flex: 1 }]} numberOfLines={1}>Replying to {replyTo.name}</Text><Tappable onPress={() => setReplyTo(null)} accessibilityRole="button" accessibilityLabel="Cancel reply" style={{ padding: 6 }}><Text style={[textStyle(type.metadata), { color: color.green }]}>Cancel</Text></Tappable></View> : null}
          <TextInput value={draft} onChangeText={setDraft} maxLength={MAX_COMMENT} placeholder={replyTo ? `Reply to ${replyTo.name}` : "Add a comment"} placeholderTextColor={color.inkMuted} accessibilityLabel="Write a comment" multiline {...({ rows: 1 } as object)} style={s.input} />
          <Tappable onPress={send} disabled={!draft.trim() || add.isPending} accessibilityRole="button" accessibilityLabel="Post comment" style={[s.send, (!draft.trim() || add.isPending) && s.sendDisabled]}>{add.isPending ? <ActivityIndicator color={color.onGreen} /> : <Ionicons name="arrow-up" size={20} color={draft.trim() ? color.onGreen : color.inkMuted} />}</Tappable>
        </View>
      </View>
    </View>
  </Modal>;
}

/** Between the composer and the top of the keyboard. */
const KEYBOARD_GAP = 8;

/**
 * How far the keyboard reaches up into this sheet's window, in px.
 *
 * MEASURED, NOT ASSUMED. Whether Android resizes a modal's window for the
 * keyboard depends on the edge-to-edge mode (RN 0.86 is always edge-to-edge,
 * where `adjustResize` no longer resizes), and KeyboardAvoidingView's
 * Android behaviour relies on exactly that resize -- which is how the
 * composer used to end up hidden or floating. So this compares the window's
 * bottom edge with the keyboard's top edge: 0 if the window did shrink, the
 * keyboard's height if it did not. Re-measured on layout, so a late resize
 * settles to the right answer either way.
 */
function useKeyboardOverlap(active: boolean) {
  const rootRef = useRef<View>(null);
  const keyboardTop = useRef<number | null>(null);
  const [overlap, setOverlap] = useState(0);

  const measure = useCallback(() => {
    const top = keyboardTop.current;
    if (top === null) {
      setOverlap(0);
      return;
    }
    rootRef.current?.measureInWindow((_x, y, _w, h) => setOverlap(Math.max(0, Math.round(y + h - top))));
  }, []);

  useEffect(() => {
    if (!active) return;
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e: KeyboardEvent) => {
        keyboardTop.current = e.endCoordinates.screenY;
        measure();
      },
    );
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => {
      keyboardTop.current = null;
      setOverlap(0);
    });
    return () => {
      show.remove();
      hide.remove();
      keyboardTop.current = null;
      setOverlap(0);
    };
  }, [active, measure]);

  return { rootRef, onRootLayout: measure, overlap };
}

/**
 * One comment as a bubble (name and text inside, time and Reply under it),
 * the way people already read comments elsewhere. The listing's owner is
 * marked, because "the owner answered" is what a buyer scans for. Replies
 * sit under it, indented, as smaller bubbles.
 */
function CommentRow({ comment, ownerId, onReply, onAuthor }: { comment: ItemComment; ownerId: string; onReply: (id: string, name: string) => void; onAuthor: (id: string) => void }) {
  return (
    <View style={s.thread}>
      <Bubble c={comment} ownerId={ownerId} onAuthor={onAuthor} onReply={() => onReply(comment.id, comment.user.name)} />
      {comment.replies?.map((reply) => (
        <View key={reply.id} style={s.replyWrap}>
          <Bubble c={reply} ownerId={ownerId} onAuthor={onAuthor} small onReply={() => onReply(comment.id, reply.user.name)} />
        </View>
      ))}
    </View>
  );
}

function Bubble({ c, ownerId, onAuthor, onReply, small = false }: { c: { id: string; content: string; createdAt: string; user: ItemComment["user"] }; ownerId: string; onAuthor: (id: string) => void; onReply: () => void; small?: boolean }) {
  const isOwner = c.user.id === ownerId;
  return (
    <View style={s.row}>
      <AuthorButton user={c.user} small={small} onPress={() => onAuthor(c.user.id)} />
      <View style={s.rowText}>
        <View style={s.bubble}>
          <View style={s.rowHead}>
            <Tappable onPress={() => onAuthor(c.user.id)} style={{ flexShrink: 1 }}>
              <Text style={s.name} numberOfLines={1}>{c.user.name}</Text>
            </Tappable>
            {isOwner ? <View style={s.ownerTag}><Text style={s.ownerTagText}>Owner</Text></View> : null}
          </View>
          <Text style={s.body}>{c.content}</Text>
        </View>
        <View style={s.meta}>
          <Text style={s.metaText}>{relativeShort(c.createdAt)}</Text>
          <Tappable onPress={onReply} accessibilityRole="button" hitSlop={8}>
            <Text style={[s.metaText, s.metaAction]}>Reply</Text>
          </Tappable>
        </View>
      </View>
    </View>
  );
}

function AuthorButton({ user, onPress, small = false }: { user: ItemComment["user"]; onPress: () => void; small?: boolean }) {
  const st = small ? s.avatarSmall : s.avatar;
  return <Tappable onPress={onPress} accessibilityRole="button" accessibilityLabel={`View ${user.name}'s profile`}>{user.avatar ? <Image source={{ uri: sizedImage(user.avatar, "thumb") }} contentFit="cover" style={st} /> : <View style={[st, s.avatarFallback]}><Text style={{ fontFamily: font.sansBold, fontSize: small ? 11 : 14, color: color.forest }}>{user.name.trim().charAt(0).toUpperCase() || "?"}</Text></View>}</Tappable>;
}

const s = StyleSheet.create({
  root: { flex: 1 }, scrim: { flex: 1, backgroundColor: color.captionFill }, sheet: { backgroundColor: color.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: space.sheet.top, paddingBottom: space.sheet.bottom, height: "78%" }, handle: { alignSelf: "center", width: size.sheet.handleW, height: size.sheet.handleH, borderRadius: size.sheet.handleH / 2, backgroundColor: color.controlLineStrong }, title: { marginTop: space.sheet.top, paddingHorizontal: space.sheet.x, color: color.ink }, list: { flex: 1, marginTop: space.sheet.titleToBody, paddingHorizontal: space.sheet.x }, state: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sheet.actionGap }, stateText: { textAlign: "center", color: color.inkMuted }, retry: { padding: 12 }, more: { paddingVertical: 16 }, thread: { paddingVertical: 8, gap: 8 }, row: { flexDirection: "row", gap: 10, alignItems: "flex-start" }, replyWrap: { paddingLeft: 46 }, avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.greenWash }, avatarSmall: { width: 28, height: 28, borderRadius: 14, backgroundColor: color.greenWash }, avatarFallback: { alignItems: "center", justifyContent: "center" }, rowText: { flex: 1, minWidth: 0 }, bubble: { alignSelf: "flex-start", maxWidth: "100%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: color.control }, rowHead: { flexDirection: "row", alignItems: "center", gap: 6 }, name: { fontFamily: font.sansSemi, fontSize: 13, color: color.ink }, ownerTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: color.greenWash }, ownerTagText: { fontFamily: font.sansSemi, fontSize: 10, color: color.forest }, body: { marginTop: 2, fontFamily: font.sans, fontSize: 14, lineHeight: 20, color: color.ink }, meta: { flexDirection: "row", gap: 14, paddingLeft: 12, marginTop: 4 }, metaText: { fontFamily: font.sans, fontSize: 12, color: color.inkMuted }, metaAction: { fontFamily: font.sansSemi, color: color.inkSecondary }, composer: { flexDirection: "row", alignItems: "flex-end", gap: space.sheet.actionGap, paddingHorizontal: space.sheet.x, paddingTop: space.sheet.labelToOptions, borderTopWidth: border.hairline, borderTopColor: color.divider }, input: { flex: 1, minHeight: 38, maxHeight: 110, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8, fontSize: 15, lineHeight: 20, borderRadius: 19, textAlignVertical: "center", borderWidth: border.chip, borderColor: color.controlLine, backgroundColor: color.searchSurface, color: color.ink }, send: { width: 38, height: 38, borderRadius: 19, backgroundColor: color.green, alignItems: "center", justifyContent: "center" }, sendDisabled: { backgroundColor: color.control },
});
