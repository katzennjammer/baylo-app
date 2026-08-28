import Svg, { Circle, Path, Rect } from "react-native-svg";

import { icon as iconToken } from "../theme/tokens";

/**
 * The icon set, drawn rather than imported.
 *
 * WHY NOT `@expo/vector-icons`. The spec pairs a size with a stroke weight for
 * every single mark — 1.6 through the chrome, 1.7 on the header leaf, 1.8 on
 * the card leaf, 2.1 on the FAB's plus, and a tab bar whose active state is the
 * SAME glyph at 1.9 instead of 1.6. An icon font has one baked-in weight per
 * glyph and no way to vary it, which is why Ionicons expresses "active" as a
 * different (filled) glyph. Taking that substitution would quietly redraw the
 * one place the direction is most legible: a tab bar that thickens rather than
 * fills. Vector paths are the only way to honour the table, so the marks are
 * paths.
 *
 * STROKE WIDTH IS CONVERTED, NOT PASSED THROUGH. `strokeWidth` in SVG is in
 * user units, and every glyph below is authored in a 24×24 box. Rendered at,
 * say, 21 px, a `strokeWidth` of 1.6 would paint 1.6 × (21/24) = 1.4 px. The
 * `scale()` helper inverts that, so the number in `tokens.icon` is the width in
 * DEVICE-INDEPENDENT PIXELS that actually lands on the screen — which is what
 * the spec is measuring.
 *
 * Round caps and joins on everything, per the spec's blanket rule. Fill is
 * `none` unless a glyph is explicitly a filled one (the liked heart, the kebab).
 */

/** viewBox side. Every path below is authored against this. */
const BOX = 24;

/** The strokeWidth that paints `stroke` real pixels at a render size of `size`. */
function scale(stroke: number, size: number): number {
  return (stroke * BOX) / size;
}

export interface IconProps {
  size: number;
  color: string;
  /** Rendered stroke in real px. Falls back to the spec's blanket 1.6. */
  stroke?: number;
}

/**
 * The shared frame.
 *
 * `pointerEvents="none"` because every icon here sits inside a Pressable that
 * owns the hit area — without it Android hands the touch to the SVG on some
 * versions and the button under it never fires.
 */
function Glyph({
  size,
  color,
  stroke = 1.6,
  fill = "none",
  children,
}: IconProps & { fill?: string; children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${BOX} ${BOX}`}
      fill={fill}
      stroke={color}
      strokeWidth={scale(stroke, size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      pointerEvents="none"
    >
      {children}
    </Svg>
  );
}

/* ─────────────────────────────── header ─────────────────────────────── */

export function BellIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M6 8.5a6 6 0 0 1 12 0c0 6.5 2.6 8.5 2.6 8.5H3.4S6 15 6 8.5" />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Glyph>
  );
}

export function MessageIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M20.5 11.8a8.2 8.2 0 0 1-8.8 8.2 9 9 0 0 1-2.6-.5L4 21l1.5-4.4a8.2 8.2 0 0 1-1.2-4.3 8.2 8.2 0 0 1 8.2-8.2 8.2 8.2 0 0 1 8 7.7Z" />
    </Glyph>
  );
}

/**
 * The leaf. It appears at five different sizes and four stroke weights — the
 * header pill, the card chip, the matches rail, and 42 px inside the empty
 * state's circle — so it is one path rather than four traced marks.
 */
export function LeafIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M11 20.5A7.5 7.5 0 0 1 9.6 6.2C15.4 5 17 4.4 19 2c1 2 2 4.2 2 8 0 5.8-4.9 10.5-10 10.5Z" />
      <Path d="M2.5 21.5c0-3.2 1.9-5.6 5.2-6.3C10.3 14.7 12.6 13 14 11.5" />
    </Glyph>
  );
}

/* ──────────────────────────────── card ──────────────────────────────── */

/**
 * Two states in one component. Liked is a FILLED heart in the warm accent, not
 * a heavier outline — it is the only filled mark in the feed, which is what
 * makes a single liked card visible while scrolling past forty.
 */
export function HeartIcon({ liked, ...props }: IconProps & { liked?: boolean }) {
  return (
    <Glyph {...props} fill={liked ? props.color : "none"}>
      <Path d="M19 13.9c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.4c0 2.3 1.5 4 3 5.5l7 7Z" />
    </Glyph>
  );
}

export function CommentIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-2.8-.5L3.5 21l1.7-5.2a8.4 8.4 0 0 1-1.2-4.3 8.4 8.4 0 0 1 8.4-8.4 8.4 8.4 0 0 1 8.6 8.4Z" />
    </Glyph>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M4 12.5V19a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 19v-6.5" />
      <Path d="M16 6.5 12 2.5 8 6.5" />
      <Path d="M12 2.5V15" />
    </Glyph>
  );
}

/**
 * The overflow affordance. Filled dots, so it is the one glyph here whose
 * weight is a radius rather than a stroke — hence its own viewBox in real px,
 * which lets `tokens.icon.kebab.dotRadius` be read straight off the spec.
 */
export function KebabIcon({ size, color }: { size: number; color: string }) {
  const r = iconToken.kebab.dotRadius ?? 1.6;
  const cx = size / 2;
  const gap = size / 3.2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} pointerEvents="none">
      <Circle cx={cx} cy={cx - gap} r={r} fill={color} />
      <Circle cx={cx} cy={cx} r={r} fill={color} />
      <Circle cx={cx} cy={cx + gap} r={r} fill={color} />
    </Svg>
  );
}

/* ───────────────────────────── tab bar ──────────────────────────────── */

export function HomeIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M3 9.6 12 2.8l9 6.8V19a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 19Z" />
      <Path d="M9.2 21.5v-7h5.6v7" />
    </Glyph>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Rect x="3" y="3" width="7.5" height="7.5" rx="1.8" />
      <Rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" />
      <Rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" />
      <Rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" />
    </Glyph>
  );
}

export function SwapIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M16.5 3.5 20.5 7.5l-4 4" />
      <Path d="M20.5 7.5H3.5" />
      <Path d="M7.5 12.5 3.5 16.5l4 4" />
      <Path d="M3.5 16.5h17" />
    </Glyph>
  );
}

export function PersonIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M20 21.5v-2A4.5 4.5 0 0 0 15.5 15h-7A4.5 4.5 0 0 0 4 19.5v2" />
      <Circle cx="12" cy="7.5" r="4.2" />
    </Glyph>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M12 5v14" />
      <Path d="M5 12h14" />
    </Glyph>
  );
}

/* ──────────────────────────── states ────────────────────────────────── */

export function WarningIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <Path d="M12 9.5v4" />
      <Path d="M12 17.2h.01" />
    </Glyph>
  );
}

/** The failed-photo mark. 34 px at 1.4 — the lightest stroke in the app. */
export function ImageIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Rect x="3" y="3" width="18" height="18" rx="2.5" />
      <Circle cx="8.6" cy="8.6" r="1.6" />
      <Path d="m21 15.5-4.8-4.8L5.5 21.4" />
    </Glyph>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
      <Path d="M20.5 3v5.5H15" />
    </Glyph>
  );
}
