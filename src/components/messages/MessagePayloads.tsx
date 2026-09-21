import React from "react";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { Tappable } from "../Tappable";
import type { ActiveTrade, LiveOffer } from "../../api/types";
import { ArrowsIcon } from "../offer/icons";
import { bracketLabel } from "../../lib/brackets";

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
      return String(parsed.status ?? "updated").toUpperCase() === "ACCEPTED" ? "Offer accepted"
        : String(parsed.status ?? "updated").toUpperCase() === "DECLINED" ? "Offer declined" : "Offer updated";
    case "trade_completed":
      return "Trade completed";
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
  onImagePress,
  onOfferPress,
  onRatePress,
  offerDetails,
  tradeDetails,
}: {
  content: string;
  mine: boolean;
  onImagePress?: (url: string) => void;
  onOfferPress?: (offerId: string) => void;
  onRatePress?: (tradeId: string) => void;
  offerDetails?: LiveOffer;
  tradeDetails?: ActiveTrade;
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
      const offerId = typeof parsed.offerId === "string" ? parsed.offerId : null;
      const offeredImage = offerDetails?.offeredItems[0]?.image
        ?? (typeof offeredItems[0] === "object" && offeredItems[0] && "imageUrl" in offeredItems[0] && typeof offeredItems[0].imageUrl === "string" ? offeredItems[0].imageUrl : null);
      const targetImage = offerDetails?.post.image
        ?? (typeof parsed.postItem === "object" && parsed.postItem && "imageUrl" in parsed.postItem && typeof parsed.postItem.imageUrl === "string" ? parsed.postItem.imageUrl : null);
      const offeredBracket = offerDetails?.offeredBracket
        ?? (typeof parsed.offeredBracket === "number" ? parsed.offeredBracket : null);
      const targetBracket = offerDetails?.targetBracket
        ?? (typeof parsed.targetBracket === "number" ? parsed.targetBracket : null);

      const card = (
        <View style={[styles.offerCard, mine ? styles.mineCard : styles.theirCard]}>
          <View style={styles.offerImages}>
            {offeredImage ? <Image source={{ uri: offeredImage }} style={styles.offerThumb} contentFit="cover" /> : <View style={styles.offerThumbFallback} />}
            <ArrowsIcon size={16} stroke={1.6} color={mine ? color.surface : color.inkSecondary} />
            {targetImage ? <Image source={{ uri: targetImage }} style={styles.offerThumb} contentFit="cover" /> : <View style={styles.offerThumbFallback} />}
          </View>
          <Text style={[styles.offerLabel, !mine && styles.theirOfferText]}>Trade offer</Text>
          <Text style={[styles.offerLine, !mine && styles.theirOfferText]}>{mine ? "You offer" : `${senderName} offers`} {offered} for {itemTitle}</Text>
          {offeredBracket !== null && targetBracket !== null ? (
            <Text style={[styles.offerBrackets, !mine && styles.theirOfferMuted]}>{bracketLabel(offeredBracket)} for {bracketLabel(targetBracket)}</Text>
          ) : null}
          {userMessage ? <Text style={[styles.offerMessage, !mine && styles.theirOfferText]}>{userMessage}</Text> : null}
          <Text style={[styles.offerStatus, !mine && styles.theirOfferMuted]}>{status}</Text>
        </View>
      );

      return offerId && onOfferPress ? (
        <Tappable onPress={() => onOfferPress(offerId)} accessibilityRole="button" accessibilityLabel="Open trade offer">
          {card}
        </Tappable>
      ) : card;
    }
    case "offer_update": {
      const status = typeof parsed.status === "string" ? parsed.status : "updated";
      const tradeId = typeof parsed.tradeId === "string" ? parsed.tradeId : null;
      const actorId = typeof parsed.accepterId === "string" ? parsed.accepterId : null;
      const actorName = typeof parsed.accepterName === "string" && parsed.accepterName.trim()
        ? parsed.accepterName.trim()
        : typeof parsed.actorName === "string" && parsed.actorName.trim()
          ? parsed.actorName.trim()
          : tradeDetails?.counterparty.name ?? "They";
      const proposerName = typeof parsed.proposerName === "string" ? parsed.proposerName : "your partner";
      const completed = status === "ACCEPTED" && tradeDetails?.status === "COMPLETED";
      const label = completed
        ? "Trade completed"
        : status === "ACCEPTED"
          ? actorId === tradeDetails?.counterparty.id ? `${actorName} accepted your offer` : `You accepted ${proposerName}'s offer`
          : status === "DECLINED"
            ? actorId === tradeDetails?.counterparty.id ? `${actorName} declined your offer` : "You declined the offer"
            : `${actorName} updated your offer`;
      const pill = (
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{label}</Text>
          {status === "ACCEPTED" && tradeId && !completed && onOfferPress ? (
            <Tappable onPress={() => onOfferPress(tradeId)} accessibilityRole="link" accessibilityLabel="Open trade">
              <Text style={styles.statusLink}>Open trade</Text>
            </Tappable>
          ) : null}
        </View>
      );
      return pill;
    }
    case "trade_completed": {
      const tradeId = typeof parsed.tradeId === "string" ? parsed.tradeId : null;
      const partnerName = typeof parsed.partnerName === "string" && parsed.partnerName.trim()
        ? parsed.partnerName.trim()
        : "your partner";
      const rated = !!tradeId && tradeDetails?.myReview != null;
      return (
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{rated ? `You rated ${partnerName}` : "Trade completed"}</Text>
          {!rated && tradeId && onRatePress ? (
            <Tappable onPress={() => onRatePress(tradeId)} accessibilityRole="link" accessibilityLabel={`Rate ${partnerName}`}>
              <Text style={styles.statusLink}>Rate {partnerName}</Text>
            </Tappable>
          ) : null}
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
      const imageUrl = typeof parsed.url === "string"
        ? parsed.url
        : typeof parsed.imageUrl === "string" ? parsed.imageUrl : undefined;
      const caption = typeof parsed.caption === "string" ? parsed.caption : null;

      return (
        <View style={[styles.imageWrap, mine ? styles.mineCard : styles.theirCard]}>
          {imageUrl ? (
            <Tappable
              onPress={() => onImagePress?.(imageUrl)}
              disabled={!onImagePress}
              accessibilityRole="button"
              accessibilityLabel="View image full screen"
            >
              <Image
                source={{ uri: imageUrl }}
                style={styles.messageImage}
                contentFit="cover"
                onLoad={() => console.log("[messages/thread] image loaded", { url: imageUrl })}
                onError={(event) => console.log("[messages/thread] image load failed", { url: imageUrl, error: event.error })}
              />
            </Tappable>
          ) : (
            <Text style={[styles.caption, mine ? styles.mineText : styles.theirText]}>Image unavailable</Text>
          )}
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
  offerImages: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
  },
  offerThumb: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#E6E4DA",
  },
  offerThumbFallback: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#E6E4DA",
  },
  mineCard: {
    backgroundColor: color.forest,
    borderColor: color.forest,
  },
  theirCard: {
    backgroundColor: color.control,
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
  offerBrackets: {
    fontFamily: font.mono,
    fontSize: 11,
    color: color.inkSecondary,
    marginTop: 4,
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
  theirOfferText: {
    color: color.ink,
  },
  theirOfferMuted: {
    color: color.inkSecondary,
  },
  statusPill: {
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: color.greenWash,
  },
  statusText: {
    fontFamily: font.sansSemi,
    fontSize: 12,
    color: color.ink,
  },
  statusLink: {
    fontFamily: font.sansSemi,
    fontSize: 12,
    color: color.forest,
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
