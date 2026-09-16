import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { color, font, radius, textStyle } from "../../theme/tokens";

export type MessagePayload = Record<string, unknown> & {
  type?: string;
};

function asJsonObject(content: string): MessagePayload | null {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" && "type" in parsed ? (parsed as MessagePayload) : null;
  } catch {
    return null;
  }
}

export function previewFromContent(content: string, fromMe: boolean): string {
  const parsed = asJsonObject(content);
  if (!parsed) {
    return content.length > 60 ? `${content.slice(0, 60)}…` : content;
  }

  switch (parsed.type) {
    case "offer":
      return fromMe ? "You sent a trade offer" : "Sent a trade offer";
    case "offer_update":
      return fromMe ? `Offer ${String(parsed.status ?? "updated").toLowerCase()}` : `Offer ${String(parsed.status ?? "updated").toLowerCase()}`;
    case "shared_post":
      return `Shared: ${parsed.postItem ?? "a post"}`;
    case "image":
      return "Sent an image";
    case "voice":
      return "Sent a voice message";
    default:
      return content.length > 60 ? `${content.slice(0, 60)}…` : content;
  }
}

export function renderMessageBody({
  content,
  mine,
}: {
  content: string;
  mine: boolean;
}) {
  const parsed = asJsonObject(content);

  if (!parsed) {
    return <Text style={[styles.text, mine ? styles.mineText : styles.theirText]}>{content}</Text>;
  }

  switch (parsed.type) {
    case "offer": {
      const offeredItems = Array.isArray(parsed.offeredItems) ? parsed.offeredItems : [];
      const offered = offeredItems
        .map((item: unknown) => (typeof item === "object" && item && "title" in item && typeof item.title === "string" ? item.title : ""))
        .filter(Boolean)
        .join(", ") || "Item";
      const offeredLeaves = typeof parsed.offeredLeaves === "number" && parsed.offeredLeaves > 0 ? ` + ${parsed.offeredLeaves} Leaves` : "";
      const itemTitle = typeof parsed.postItem === "string"
        ? parsed.postItem
        : typeof parsed.postItem === "object" && parsed.postItem && "title" in parsed.postItem && typeof parsed.postItem.title === "string"
          ? parsed.postItem.title
          : "item";
      const userMessage = typeof parsed.userMessage === "string" ? parsed.userMessage : null;
      const senderName = typeof parsed.senderName === "string" ? parsed.senderName : "They";
      const status = typeof parsed.status === "string" ? parsed.status : "PENDING";

      return (
        <View style={[styles.offerCard, mine ? styles.mineCard : styles.theirCard]}>
          <Text style={styles.offerLabel}>Trade offer</Text>
          <Text style={styles.offerLine}>{mine ? "You offer" : `${senderName} offers`} {offered}{offeredLeaves}</Text>
          <Text style={styles.offerFor}>For {itemTitle}</Text>
          {userMessage ? <Text style={styles.offerMessage}>“{userMessage}”</Text> : null}
          <Text style={styles.offerStatus}>{status}</Text>
        </View>
      );
    }
    case "offer_update": {
      const status = typeof parsed.status === "string" ? parsed.status : "updated";
      return (
        <View style={[styles.statusPill, mine ? styles.mineStatus : styles.theirStatus]}>
          <Text style={[styles.statusText, mine ? styles.mineStatusText : styles.theirStatusText]}>
            {status === "ACCEPTED" ? "Offer accepted" : status === "DECLINED" ? "Offer declined" : `Offer ${status.toLowerCase()}`}
          </Text>
        </View>
      );
    }
    case "shared_post": {
      const imageUrl = typeof parsed.imageUrl === "string" ? parsed.imageUrl : undefined;
      const postItem = typeof parsed.postItem === "string" ? parsed.postItem : "Shared post";
      const postUser = typeof parsed.postUser === "string" ? parsed.postUser : "Baylo";

      return (
        <View style={[styles.sharedCard, mine ? styles.mineCard : styles.theirCard]}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.sharedImage} resizeMode="cover" />
          ) : null}
          <View style={styles.sharedBody}>
            <Text style={[styles.sharedTitle, mine ? styles.mineText : styles.theirText]}>{postItem}</Text>
            <Text style={[styles.sharedMeta, mine ? styles.mineMeta : styles.theirMeta]}>
              by {postUser}
            </Text>
          </View>
        </View>
      );
    }
    case "image": {
      const imageUrl = typeof parsed.url === "string" ? parsed.url : undefined;
      const caption = typeof parsed.caption === "string" ? parsed.caption : null;

      return (
        <View style={[styles.imageWrap, mine ? styles.mineCard : styles.theirCard]}>
          {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.messageImage} resizeMode="cover" /> : null}
          {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        </View>
      );
    }
    case "voice": {
      const duration = typeof parsed.duration === "number" ? parsed.duration : 0;
      return (
        <View style={[styles.voiceCard, mine ? styles.mineCard : styles.theirCard]}>
          <Text style={[styles.voiceBadge, mine ? styles.mineText : styles.theirText]}>
            {mine ? "Voice" : "Voice"}
          </Text>
          <Text style={[styles.voiceTime, mine ? styles.mineText : styles.theirText]}>
            {formatDuration(duration)}
          </Text>
        </View>
      );
    }
    default:
      return <Text style={[styles.text, mine ? styles.mineText : styles.theirText]}>{content}</Text>;
  }
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  text: {
    fontFamily: font.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  mineText: {
    color: color.surface,
  },
  theirText: {
    color: color.ink,
  },
  offerCard: {
    maxWidth: 280,
    borderRadius: radius.card,
    padding: 12,
    borderWidth: 1,
    borderColor: color.greenLine,
    backgroundColor: color.greenWash,
  },
  mineCard: {
    backgroundColor: color.forest,
    borderColor: color.forest,
  },
  theirCard: {
    backgroundColor: color.surface,
    borderColor: color.divider,
  },
  offerLabel: {
    fontFamily: font.mono,
    fontSize: 10,
    color: color.surface, // Changed offer label color for better contrast
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  offerLine: {
    fontFamily: font.sansSemi,
    fontSize: 14,
    color: color.surface, // Changed offer line color for better contrast
    marginBottom: 4,
  },
  offerFor: {
    fontFamily: font.sans,
    fontSize: 13,
    color: color.surface, // Changed offer for color for better contrast
    marginBottom: 6,
  },
  offerMessage: {
    fontFamily: font.sans,
    fontSize: 13,
    color: color.surface, // Changed offer message color for better contrast
    marginBottom: 6,
  },
  offerStatus: {
    fontFamily: font.mono,
    fontSize: 10,
    color: color.surface, // Changed offer status color for better contrast
    textTransform: "uppercase",
  },
  statusPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  mineStatus: {
    backgroundColor: color.greenWash,
    borderColor: color.greenLine,
  },
  theirStatus: {
    backgroundColor: color.control,
    borderColor: color.divider,
  },
  mineStatusText: {
    color: color.onGreen,
  },
  theirStatusText: {
    color: color.inkSecondary,
  },
  statusText: {
    fontFamily: font.sansSemi,
    fontSize: 12,
  },
  sharedCard: {
    maxWidth: 260,
    borderRadius: radius.card,
    overflow: "hidden",
    borderWidth: 1,
  },
  sharedImage: {
    width: "100%",
    height: 120,
  },
  sharedBody: {
    padding: 10,
    gap: 4,
  },
  sharedTitle: {
    fontFamily: font.sansSemi,
    fontSize: 14,
  },
  sharedMeta: {
    fontFamily: font.sans,
    fontSize: 11,
  },
  mineMeta: {
    color: color.surface,
  },
  theirMeta: {
    color: color.inkSecondary,
  },
  imageWrap: {
    maxWidth: 260,
    borderRadius: radius.card,
    overflow: "hidden",
    borderWidth: 1,
  },
  messageImage: {
    width: 240,
    height: 180,
    borderRadius: radius.card,
  },
  caption: {
    fontFamily: font.sans,
    fontSize: 12,
    padding: 8,
    color: color.inkSecondary,
  },
  voiceCard: {
    minWidth: 120,
    maxWidth: 180,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  voiceBadge: {
    fontFamily: font.sansSemi,
    fontSize: 12,
  },
  voiceTime: {
    fontFamily: font.mono,
    fontSize: 11,
  },
});
