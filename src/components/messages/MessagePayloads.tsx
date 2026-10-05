import React from "react";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { Tappable } from "../Tappable";
import type { ActiveTrade, LiveOffer } from "../../api/types";
import * as copy from "../trades/copy";
import type { CardSide } from "../trades/present";
import { giveGet } from "../../lib/trade-sides";
import { ChatOfferCard } from "./ChatOfferCard";

import { color, font, radius, textStyle, type } from "../../theme/tokens";

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

/**
 * Give / get for an offer card drawn from its chat payload, once the offer has
 * left the live list. The offer message is always written by the offer's
 * sender, so `mine` IS "the viewer is the sender"; giveGet() does the rest.
 */
export function offerPayloadSides(parsed: MessagePayload, mine: boolean): { give: CardSide; get: CardSide } {
  const offeredItems = Array.isArray(parsed.offeredItems) ? parsed.offeredItems : [];
  const firstOffered = offeredItems.find(
    (item: unknown): item is { title: string; imageUrl?: unknown } =>
      typeof item === "object" && !!item && "title" in item && typeof item.title === "string",
  );
  const offeredLeaves = typeof parsed.offeredLeaves === "number" ? parsed.offeredLeaves : 0;
  const postTitle = typeof parsed.postItem === "string"
    ? parsed.postItem
    : typeof parsed.postItem === "object" && parsed.postItem && "title" in parsed.postItem && typeof parsed.postItem.title === "string"
      ? parsed.postItem.title
      : copy.tradeCard.unnamed;
  const postImage = typeof parsed.postItem === "object" && parsed.postItem && "imageUrl" in parsed.postItem && typeof parsed.postItem.imageUrl === "string"
    ? parsed.postItem.imageUrl
    : null;
  const offeredSide: CardSide = firstOffered
    ? {
        image: typeof firstOffered.imageUrl === "string" ? firstOffered.imageUrl : null,
        title: offeredLeaves > 0
          ? copy.tradeCard.itemPlusLeaves(firstOffered.title, offeredLeaves)
          : offeredItems.length > 1
            ? copy.tradeCard.itemPlusMore(firstOffered.title, offeredItems.length - 1)
            : firstOffered.title,
        leaves: false,
      }
    : offeredLeaves > 0
      ? { image: null, title: copy.tradeCard.leaves(offeredLeaves), leaves: true }
      : { image: null, title: copy.tradeCard.unnamed, leaves: false };
  const postSide: CardSide = { image: postImage, title: postTitle, leaves: false };
  return giveGet(mine, { offered: offeredSide, requested: postSide });
}

/** One line for a list row: runs of whitespace (newlines included) become one space, as the server's describeMessage() does. */
function flatPreview(content: string): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > 60 ? `${flat.slice(0, 60)}…` : flat;
}

export function previewFromContent(content: string, fromMe: boolean): string {
  const parsed = asJsonObject(content);
  if (!parsed) {
    return flatPreview(content);
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
      return flatPreview(content);
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
  partnerName = "them",
  offerTradeId = null,
  onOpenTrade,
  contentMax = Number.POSITIVE_INFINITY,
}: {
  content: string;
  mine: boolean;
  onImagePress?: (url: string) => void;
  onOfferPress?: (offerId: string) => void;
  onRatePress?: (tradeId: string) => void;
  offerDetails?: LiveOffer;
  tradeDetails?: ActiveTrade;
  /** The other person in the thread — the offer card's "from" when it is theirs. */
  partnerName?: string;
  /** For an offer: the trade it became, from the thread's offer_update rows. */
  offerTradeId?: string | null;
  onOpenTrade?: (tradeId: string) => void;
  /**
   * The room inside a bubble, in px (`useBubbleContentMax()`). Media below is
   * min(its fixed width, this), so a narrow phone shrinks it rather than
   * letting it overflow. Omitted, the fixed widths apply unchanged.
   */
  contentMax?: number;
}) {
  const parsed = asJsonObject(content);

  if (!parsed) {
    return <Text style={[styles.text, mine ? styles.mineText : styles.theirText]}>{content}</Text>;
  }

  switch (parsed.type) {
    case "offer": {
      const offerId = typeof parsed.offerId === "string" ? parsed.offerId : null;

      return (
        <ChatOfferCard
          mine={mine}
          partnerName={partnerName}
          status={typeof parsed.status === "string" ? parsed.status : "PENDING"}
          live={offerDetails}
          fallback={offerPayloadSides(parsed, mine)}
          message={typeof parsed.userMessage === "string" && parsed.userMessage.trim() ? parsed.userMessage : null}
          tradeId={offerTradeId}
          onOpen={() => (offerId ? onOfferPress?.(offerId) : undefined)}
          onOpenTrade={(id) => onOpenTrade?.(id)}
        />
      );
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
      // A definite width, so the photo is sized in px from it, never as a % of a content-sized card.
      const sharedWidth = Math.min(MEDIA.shared, contentMax);

      return (
        <View style={[styles.sharedCard, { width: sharedWidth }, mine ? styles.mineCard : styles.theirCard]}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={[styles.sharedImage, { width: sharedWidth - 2 * MEDIA_BORDER }]}
              resizeMode="cover"
            />
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
      // The photo keeps its 4:3 frame as it shrinks; the wrap's border is inside the cap.
      const imageWidth = Math.min(MEDIA.image, contentMax - 2 * MEDIA_BORDER);
      const imageHeight = Math.round((imageWidth * MEDIA.imageHeight) / MEDIA.image);

      return (
        <View style={[styles.imageWrap, { maxWidth: Math.min(MEDIA.imageWrap, contentMax) }, mine ? styles.mineCard : styles.theirCard]}>
          {imageUrl ? (
            <Tappable
              onPress={() => onImagePress?.(imageUrl)}
              disabled={!onImagePress}
              accessibilityRole="button"
              accessibilityLabel="View image full screen"
            >
              <Image
                source={{ uri: imageUrl }}
                style={[styles.messageImage, { width: imageWidth, height: imageHeight }]}
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
        <View
          style={[
            styles.voiceCard,
            { minWidth: Math.min(MEDIA.voiceMin, contentMax), maxWidth: Math.min(MEDIA.voice, contentMax) },
            mine ? styles.mineCard : styles.theirCard,
          ]}
        >
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

/** Media's own widths, in px: the CEILINGS. A narrow bubble's `contentMax` wins. */
const MEDIA = { shared: 260, imageWrap: 260, image: 240, imageHeight: 180, voice: 180, voiceMin: 120 } as const;
const MEDIA_BORDER = 1;

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
  mineCard: {
    backgroundColor: color.forest,
    borderColor: color.forest,
  },
  theirCard: {
    backgroundColor: color.control,
    borderColor: color.divider,
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
    borderRadius: radius.card,
    overflow: "hidden",
    borderWidth: MEDIA_BORDER,
  },
  sharedImage: {
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
    borderRadius: radius.card,
    overflow: "hidden",
    borderWidth: MEDIA_BORDER,
  },
  messageImage: {
    borderRadius: radius.card,
  },
  caption: {
    fontFamily: font.sans,
    fontSize: 12,
    padding: 8,
    color: color.inkSecondary,
  },
  voiceCard: {
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
    ...type.gridMeta,
  },
});
