import type { ReactNode } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { color, type } from "../../theme/tokens";

/**
 * One chat message's row: the avatar (received only), the bubble, its time.
 * EVERY message in a thread goes through this, so sent and received, text and
 * media, follow one width rule:
 *
 *   bubble   up to 75% of the SCREEN, in pixels; short text stays on one line
 *   card     75% of the screen, at least 260 and at most 360 px, and the card
 *            FILLS it: a trade offer needs a definite width for its split
 *   status   centred, up to 90%: "You declined the offer", "Trade completed"
 *
 * ── WHY PIXELS, NOT PERCENTAGES ─────────────────────────────────────────────
 *
 * The bubble used to be `maxWidth: "80%"` inside a wrapper that was itself
 * `maxWidth: "80%"` and content-sized. A percentage resolves against its
 * parent, and a content-sized parent in a row shrinks toward the text, so a
 * received "Unds" was given 80% of its own width and broke mid-word. A pixel
 * cap from `useWindowDimensions()` has no parent to resolve against, and it
 * follows rotation and split-screen, which a one-time `Dimensions` read would
 * not.
 *
 * The avatar sits OUTSIDE the cap: received bubbles get the same 75% as sent
 * ones rather than 75% minus a face.
 *
 * ── A CARD FILLS ITS COLUMN ─────────────────────────────────────────────────
 *
 * The column aligns its children to one side (flex-start / flex-end), and a
 * child aligned that way is sized to its CONTENT, not to the column. So the
 * column's pixel width alone did not reach the trade card: two short item
 * names shrank it, and "You give" / "You get" were cut off. The card is
 * therefore wrapped in a view that stretches to the column, which gives the
 * card itself the definite width. Text bubbles keep their content sizing.
 */
export type BubbleKind = "bubble" | "card" | "status";

export function ChatBubble({
  mine,
  kind,
  avatar,
  time,
  children,
}: {
  mine: boolean;
  kind: BubbleKind;
  /** Drawn left of a received bubble or card; ignored on sent and status rows. */
  avatar: ReactNode;
  time: string;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const caps = bubbleCaps(width);

  if (kind === "status") {
    return (
      <View style={[s.row, s.rowStatus]}>
        <View style={[s.column, s.columnCentre, { maxWidth: caps.status }]}>
          {children}
          <Text style={s.time}>{time}</Text>
        </View>
      </View>
    );
  }

  const size = kind === "card" ? { width: caps.card } : { maxWidth: caps.bubble };
  return (
    <View style={[s.row, mine ? s.rowMine : s.rowTheir]}>
      {!mine ? <View style={s.avatarColumn}>{avatar}</View> : null}
      <View style={[s.column, mine ? s.columnMine : s.columnTheir, size]}>
        {kind === "card" ? (
          <View style={s.cardFill}>{children}</View>
        ) : (
          <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheir]}>{children}</View>
        )}
        <Text style={s.time}>{time}</Text>
      </View>
    </View>
  );
}

/** The three widths, in px, for a screen `width` wide. */
export function bubbleCaps(width: number): { bubble: number; card: number; status: number } {
  return {
    bubble: Math.round(width * 0.75),
    card: Math.min(Math.max(Math.round(width * 0.75), CARD_MIN), CARD_MAX),
    status: Math.round(width * 0.9),
  };
}

/** The card's floor and ceiling, in px. Below 260 the swap split cannot hold two photos and a seam. */
const CARD_MIN = 260;
const CARD_MAX = 360;

export const AVATAR_SIZE = 28;
const BUBBLE_PADDING = 10;
const BUBBLE_BORDER = 1;

/**
 * The room INSIDE a bubble, in px: the 75% cap less the bubble's own padding
 * and border. Media in a bubble (an image, a shared listing, a voice note) is
 * sized as min(its fixed width, this), so a narrow phone shrinks it instead of
 * letting it run past the bubble. Call it once per screen and pass it down;
 * the message renderer runs inside a map and cannot call a hook itself.
 */
export function useBubbleContentMax(): number {
  const { width } = useWindowDimensions();
  return bubbleCaps(width).bubble - 2 * (BUBBLE_PADDING + BUBBLE_BORDER);
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 12,
  },
  rowMine: { justifyContent: "flex-end" },
  rowTheir: { justifyContent: "flex-start" },
  rowStatus: { justifyContent: "center" },
  avatarColumn: {
    width: AVATAR_SIZE,
  },
  column: {
    // Shrink, never overflow, on a screen too narrow for a card plus a face.
    flexShrink: 1,
    minWidth: 0,
  },
  columnMine: { alignItems: "flex-end" },
  columnTheir: { alignItems: "flex-start" },
  columnCentre: { alignItems: "center" },
  cardFill: { alignSelf: "stretch" },
  bubble: {
    borderRadius: 16,
    padding: BUBBLE_PADDING,
    borderWidth: BUBBLE_BORDER,
  },
  bubbleMine: {
    backgroundColor: color.forest,
    borderColor: color.forest,
  },
  bubbleTheir: {
    backgroundColor: color.control,
    borderColor: color.divider,
  },
  time: {
    ...type.gridMeta,
    color: color.inkSecondary,
    marginTop: 4,
  },
});
