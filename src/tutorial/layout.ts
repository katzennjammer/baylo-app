/**
 * Where the tour's hole, mascot and card go, as pure arithmetic.
 *
 * Kept out of the component so the cases that only show up on someone else's
 * phone — a target scrolled off screen, a narrow window, a target hard against
 * an edge — are checked by scripts/verify-tutorial.ts rather than by luck.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Hole extends Rect {
  radius: number;
}

/** Breathing room between a target and the edge of its hole. */
const HOLE_PAD = 8;
/** The hole never touches the window edge, so its ring is always whole. */
const EDGE = 4;
/** Corner radius of a boxy hole. */
const HOLE_RADIUS = 16;
/** Gap between the hole and the mascot or card beside it. */
export const HOLE_GAP = 12;

/** The smallest box around every rect, or null for none. */
export function unionRect(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const r of rects) {
    left = Math.min(left, r.x);
    top = Math.min(top, r.y);
    right = Math.max(right, r.x + r.width);
    bottom = Math.max(bottom, r.y + r.height);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Whether a measured rect is something a hole can honestly be cut around.
 *
 * A view on a tab that is not showing, or scrolled out of view, still answers
 * a measure — with zeros, or with a position outside the window. Pointing the
 * mascot at either would highlight nothing, so those are refused and the step
 * falls back to a centred card.
 */
export function isUsable(rect: Rect, window: Size): boolean {
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) return false;
  if (rect.width < 1 || rect.height < 1) return false;
  return rect.x >= -1 && rect.y >= -1 && rect.x + rect.width <= window.width + 1 && rect.y + rect.height <= window.height + 1;
}

/** The hole for a target: padded, kept inside the window, round if asked. */
export function holeFor(rect: Rect, shape: "rect" | "pill" | "circle", window: Size): Hole {
  if (shape === "circle") {
    const d = Math.max(rect.width, rect.height) + HOLE_PAD * 2;
    return {
      x: rect.x + rect.width / 2 - d / 2,
      y: rect.y + rect.height / 2 - d / 2,
      width: d,
      height: d,
      radius: d / 2,
    };
  }
  const left = Math.max(EDGE, rect.x - HOLE_PAD);
  const top = Math.max(EDGE, rect.y - HOLE_PAD);
  const right = Math.min(window.width - EDGE, rect.x + rect.width + HOLE_PAD);
  const bottom = Math.min(window.height - EDGE, rect.y + rect.height + HOLE_PAD);
  const width = right - left;
  const height = bottom - top;
  const round = Math.min(height / 2, width / 2);
  return { x: left, y: top, width, height, radius: shape === "pill" ? round : Math.min(HOLE_RADIUS, round) };
}

export type Placement =
  /** No target: mascot over a card, in the middle of the screen. */
  | { mode: "center" }
  /** Target in the top half: mascot then card, hanging below the hole. */
  | { mode: "below"; top: number }
  /** Target in the bottom half: card then mascot, stacked up from the hole. */
  | { mode: "above"; bottom: number };

export function placementFor(hole: Hole | null, window: Size): Placement {
  if (!hole) return { mode: "center" };
  const centre = hole.y + hole.height / 2;
  if (centre < window.height / 2) return { mode: "below", top: hole.y + hole.height + HOLE_GAP };
  return { mode: "above", bottom: window.height - hole.y + HOLE_GAP };
}

/**
 * Where each pointing pose's fingertip is, as fractions of the image box, read
 * off the artwork: `up` raises a finger near its left edge; `down` holds a
 * wing across its body aimed down and to the viewer's right at about 45°.
 */
const TIP = {
  up: { x: 0.18, y: 0.12 },
  down: { x: 0.4, y: 0.68 },
} as const;

/** A hole wider than this share of the window has no single point to aim at. */
const WIDE = 0.6;

/**
 * The mascot's left edge, chosen so the pose actually points at the hole.
 *
 * `up` (hole above the mascot): the fingertip goes directly under the hole's
 * centre. A hole that spans most of the screen — the search bar — has no
 * centre worth aiming at, so the mascot stands at the right and points at
 * that end of it.
 *
 * `down` (hole below the mascot): the wing points diagonally, so the tip is
 * set back to the left by as far as it is above the hole's centre; the line
 * of the wing then runs through the middle of the target. `mascotBottom` is
 * where the mascot's feet are, in the same coordinates as the hole.
 *
 * Either way it is clamped on screen: pointing slightly off beats a mascot
 * cut in half by the edge of a narrow phone.
 */
export function mascotLeft(
  pose: "up" | "down",
  hole: Hole,
  mascot: Size,
  mascotBottom: number,
  window: Size,
): number {
  const margin = 8;
  const centreX = hole.x + hole.width / 2;
  let wanted: number;
  if (pose === "up") {
    wanted =
      hole.width > window.width * WIDE
        ? window.width - mascot.width - 24
        : centreX - TIP.up.x * mascot.width;
  } else {
    const tipY = mascotBottom - (1 - TIP.down.y) * mascot.height;
    const drop = hole.y + hole.height / 2 - tipY;
    wanted = centreX - drop - TIP.down.x * mascot.width;
  }
  return Math.max(margin, Math.min(wanted, window.width - mascot.width - margin));
}

/**
 * The scrim as one SVG path: the whole window, with the hole subtracted by the
 * even-odd rule. One shape rather than four rectangles so the hole's corners
 * can be round.
 */
export function scrimPath(window: Size, hole: Hole | null): string {
  const outer = `M0 0H${window.width}V${window.height}H0Z`;
  if (!hole) return outer;
  const { x, y, width: w, height: h } = hole;
  const r = Math.max(0, Math.min(hole.radius, w / 2, h / 2));
  return (
    outer +
    `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}` +
    `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}` +
    `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
  );
}
