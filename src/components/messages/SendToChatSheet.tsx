import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { useConversations, useSendMessage } from "../../api/messages";
import { sizedImage } from "../../media/image-url";
import { color } from "../../theme/tokens";
import { SheetShell } from "../sheet-ui";
import { Tappable } from "../Tappable";

/**
 * "Send in chat" from a listing's menu: pick one of your recent chats and the
 * listing goes over as a card (the existing `shared_post` message) that
 * opens the listing when tapped. Each row says Sent once it has gone, so the
 * same listing can go to a few people without the sheet closing.
 */
export function SendToChatSheet({
  item,
  onClose,
}: {
  item: { id: string; title: string; images: string[]; owner: { name: string } };
  onClose: () => void;
}) {
  const { data, isPending, isError } = useConversations();
  const send = useSendMessage();
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const conversations = data?.conversations ?? [];
  const content = JSON.stringify({
    type: "shared_post",
    postId: item.id,
    postItem: item.title,
    postUser: item.owner.name,
    imageUrl: item.images[0] ?? null,
  });

  const sendTo = (partnerId: string) => {
    setSending(partnerId);
    setFailed(null);
    send.mutate(
      { partnerId, content },
      {
        onSuccess: () => setSent((s) => new Set(s).add(partnerId)),
        onError: (e) => setFailed(e instanceof Error ? e.message : "Could not send it."),
        onSettled: () => setSending(null),
      },
    );
  };

  return (
    <SheetShell title="Send in chat" onClose={onClose}>
      {isPending ? (
        <ActivityIndicator color={color.green} style={{ marginVertical: 24 }} />
      ) : isError || conversations.length === 0 ? (
        <Text style={s.empty}>
          {isError ? "Could not load your chats." : "No chats yet. Message someone first, then you can send listings to them."}
        </Text>
      ) : (
        <ScrollView style={{ maxHeight: 380 }}>
          {conversations.map((c) => {
            const done = sent.has(c.partnerId);
            return (
              <View key={c.partnerId} style={s.row}>
                {c.partnerAvatar ? (
                  <Image source={{ uri: sizedImage(c.partnerAvatar, "thumb") }} style={s.avatar} />
                ) : (
                  <View style={[s.avatar, s.fallback]}>
                    <Text style={s.initial}>{c.partnerName.slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={s.name} numberOfLines={1}>{c.partnerName}</Text>
                <Tappable
                  onPress={() => sendTo(c.partnerId)}
                  disabled={done || sending !== null}
                  accessibilityRole="button"
                  accessibilityLabel={done ? `Sent to ${c.partnerName}` : `Send to ${c.partnerName}`}
                  style={[s.send, done && s.sent]}
                >
                  {sending === c.partnerId ? (
                    <ActivityIndicator size="small" color={color.onGreen} />
                  ) : (
                    <Text style={[s.sendText, done && s.sentText]}>{done ? "Sent" : "Send"}</Text>
                  )}
                </Tappable>
              </View>
            );
          })}
        </ScrollView>
      )}
      {failed ? <Text style={s.error}>{failed}</Text> : null}
    </SheetShell>
  );
}

const s = StyleSheet.create({
  empty: { fontSize: 14, color: color.inkSecondary, paddingVertical: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  fallback: { backgroundColor: color.greenWash, alignItems: "center", justifyContent: "center" },
  initial: { fontSize: 16, fontWeight: "700", color: color.forest },
  name: { flex: 1, fontSize: 15, fontWeight: "600", color: color.ink },
  send: { minWidth: 72, height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: color.green, alignItems: "center", justifyContent: "center" },
  sent: { backgroundColor: color.control },
  sendText: { fontSize: 14, fontWeight: "700", color: color.onGreen },
  sentText: { color: color.inkSecondary },
  error: { fontSize: 13, color: color.urgent, paddingTop: 8 },
});
