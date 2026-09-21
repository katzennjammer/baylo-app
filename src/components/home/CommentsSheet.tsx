import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Tappable } from "../Tappable";
import { ApiError } from "../../api/client";
import { useAddComment, useComments } from "../../api/social";
import { relativeShort } from "../../lib/format";
import { border, color, radius, size, space, textStyle, type } from "../../theme/tokens";
import type { Item, ItemComment } from "../../api/types";

const MAX_COMMENT = 2000;

export function CommentsSheet({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const { comments, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useComments(item?.id ?? null, item !== null);
  const add = useAddComment(item?.id ?? null);
  useEffect(() => { setDraft(""); setReplyTo(null); }, [item?.id]);
  if (!item) return null;
  const send = () => {
    const content = draft.trim();
    if (!content || add.isPending) return;
    add.mutate({ content, parentId: replyTo?.id }, { onSuccess: () => { setDraft(""); setReplyTo(null); }, onError: (e) => Alert.alert("Could not post that", e instanceof ApiError ? e.message : "Something went wrong. Please try again.") });
  };
  return <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
    <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close comments" />
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.sheet}>
        <View style={s.handle} />
        <Text style={[textStyle(type.sheetTitle), s.title]} numberOfLines={1}>{item.stats.comments === 1 ? "1 comment" : `${item.stats.comments} comments`}</Text>
        <View style={s.list}>{isPending ? <View style={s.state}><ActivityIndicator color={color.green} /></View> : isError ? <View style={s.state}><Text style={[textStyle(type.detailBody), s.stateText]}>{error instanceof ApiError && error.code === "NOT_FOUND" ? "This listing is no longer available." : "Could not load the comments."}</Text><Tappable onPress={() => refetch()} accessibilityRole="button" style={s.retry}><Text style={[textStyle(type.secondaryButton), { color: color.inkSecondary }]}>Try again</Text></Tappable></View> : comments.length === 0 ? <View style={s.state}><Text style={[textStyle(type.detailBody), s.stateText]}>No comments yet. Ask the owner anything you need to know before offering.</Text></View> : <FlatList data={comments} keyExtractor={(comment) => comment.id} renderItem={({ item: comment }) => <CommentRow comment={comment} onReply={(id, name) => setReplyTo({ id, name })} onAuthor={(id) => router.push({ pathname: "/user", params: { id } })} />} onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }} onEndReachedThreshold={0.5} keyboardShouldPersistTaps="handled" ListFooterComponent={isFetchingNextPage ? <View style={s.more}><ActivityIndicator color={color.green} /></View> : null} />}</View>
        <View style={s.composer}>
          {replyTo ? <View style={{ position: "absolute", left: space.sheet.x, right: space.sheet.x, top: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={[textStyle(type.metadata), { color: color.inkMuted, flex: 1 }]} numberOfLines={1}>Replying to {replyTo.name}</Text><Tappable onPress={() => setReplyTo(null)} accessibilityRole="button" accessibilityLabel="Cancel reply" style={{ padding: 6 }}><Text style={[textStyle(type.metadata), { color: color.green }]}>Cancel</Text></Tappable></View> : null}
          <TextInput value={draft} onChangeText={setDraft} maxLength={MAX_COMMENT} placeholder={replyTo ? `Reply to ${replyTo.name}` : "Add a comment"} placeholderTextColor={color.inkMuted} accessibilityLabel="Write a comment" multiline style={[textStyle(type.detailBody), s.input]} />
          <Tappable onPress={send} disabled={!draft.trim() || add.isPending} accessibilityRole="button" accessibilityLabel="Post comment" style={[s.send, (!draft.trim() || add.isPending) && s.sendDisabled]}><Text style={[textStyle(type.secondaryButton), { color: color.onGreen }]}>{add.isPending ? "..." : "Post"}</Text></Tappable>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

function CommentRow({ comment, onReply, onAuthor }: { comment: ItemComment; onReply: (id: string, name: string) => void; onAuthor: (id: string) => void }) {
  return <View><View style={s.row}><AuthorButton user={comment.user} onPress={() => onAuthor(comment.user.id)} /><View style={s.rowText}><View style={s.rowHead}><Tappable onPress={() => onAuthor(comment.user.id)}><Text style={[textStyle(type.username), s.name]} numberOfLines={1}>{comment.user.name}</Text></Tappable><Text style={[textStyle(type.metadata), { color: color.inkMuted }]}>{relativeShort(comment.createdAt)}</Text></View><Text style={[textStyle(type.detailBody), s.body]}>{comment.content}</Text><Tappable onPress={() => onReply(comment.id, comment.user.name)} accessibilityRole="button"><Text style={[textStyle(type.metadata), { color: color.green }]}>Reply</Text></Tappable></View></View>{comment.replies?.map((reply) => <View key={reply.id} style={s.replyRow}><AuthorButton user={reply.user} onPress={() => onAuthor(reply.user.id)} /><View style={s.rowText}><Tappable onPress={() => onAuthor(reply.user.id)}><Text style={[textStyle(type.username), s.name]}>{reply.user.name}</Text></Tappable><Text style={[textStyle(type.detailBody), s.body]}>{reply.content}</Text></View></View>)}</View>;
}
function AuthorButton({ user, onPress }: { user: ItemComment["user"]; onPress: () => void }) { return <Tappable onPress={onPress} accessibilityRole="button" accessibilityLabel={`View ${user.name}'s profile`}>{user.avatar ? <Image source={{ uri: user.avatar }} contentFit="cover" style={s.avatar} /> : <View style={[s.avatar, s.avatarFallback]}><Text style={[textStyle(type.avatarInitials40), { color: color.forest }]}>{user.name.trim().charAt(0).toUpperCase() || "?"}</Text></View>}</Tappable>; }

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: color.captionFill }, sheet: { backgroundColor: color.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: space.sheet.top, paddingBottom: space.sheet.bottom, height: "78%" }, handle: { alignSelf: "center", width: size.sheet.handleW, height: size.sheet.handleH, borderRadius: size.sheet.handleH / 2, backgroundColor: color.controlLineStrong }, title: { marginTop: space.sheet.top, paddingHorizontal: space.sheet.x, color: color.ink }, list: { flex: 1, marginTop: space.sheet.titleToBody, paddingHorizontal: space.sheet.x }, state: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sheet.actionGap }, stateText: { textAlign: "center", color: color.inkMuted }, retry: { padding: 12 }, more: { paddingVertical: 16 }, row: { flexDirection: "row", gap: space.card.ownerGap, paddingVertical: space.sheet.labelToOptions }, replyRow: { flexDirection: "row", gap: space.card.ownerGap, paddingVertical: 6, paddingLeft: 36 }, avatar: { width: size.avatar.owner, height: size.avatar.owner, borderRadius: radius.ownerAvatar, backgroundColor: color.greenWash }, avatarFallback: { alignItems: "center", justifyContent: "center" }, rowText: { flex: 1 }, rowHead: { flexDirection: "row", alignItems: "baseline", gap: space.card.nameToBadge }, name: { flexShrink: 1, color: color.ink }, body: { marginTop: space.card.nameToMeta, marginBottom: 5, color: color.inkSecondary }, composer: { flexDirection: "row", alignItems: "flex-end", gap: space.sheet.actionGap, paddingHorizontal: space.sheet.x, paddingTop: space.sheet.labelToOptions, borderTopWidth: border.hairline, borderTopColor: color.divider }, input: { flex: 1, minHeight: size.sheet.rangeInput, maxHeight: 120, padding: 10, borderRadius: radius.rangeInput, borderWidth: border.chip, borderColor: color.controlLine, backgroundColor: color.control, color: color.ink }, send: { height: size.sheet.rangeInput, paddingHorizontal: 18, borderRadius: radius.rangeInput, backgroundColor: color.green, alignItems: "center", justifyContent: "center" }, sendDisabled: { opacity: 0.45 },
});
