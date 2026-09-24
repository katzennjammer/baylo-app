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
export function Glyph({
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

/* ──────────────────────── marketplace and detail ────────────────────── */

export function SearchIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Circle cx="10.5" cy="10.5" r="6.5" />
      <Path d="M15.4 15.4 20.5 20.5" />
    </Glyph>
  );
}

/**
 * Filters — three sliders, not a funnel.
 *
 * A funnel is the commoner mark and it means "this list is reduced". Sliders
 * mean "these are the controls", which is what the button opens. The sheet has
 * a Clear action of its own; the icon does not need to carry the state too.
 */
export function FilterIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M3.5 7h11" />
      <Path d="M18.5 7h2" />
      <Circle cx="16.5" cy="7" r="2" />
      <Path d="M3.5 17h2" />
      <Path d="M9.5 17h11" />
      <Circle cx="7.5" cy="17" r="2" />
    </Glyph>
  );
}

/** Clears the search field. Also the filter sheet's dismiss. */
export function CloseIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M6 6 18 18" />
      <Path d="M18 6 6 18" />
    </Glyph>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M14.5 5 7.5 12l7 7" />
    </Glyph>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M9.5 5 16.5 12l-7 7" />
    </Glyph>
  );
}

/** The selected state inside the filter sheet. */
export function CheckIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </Glyph>
  );
}

/**
 * A Safe-Zone hub. A map pin, and the only pin in the app.
 *
 * Deliberately NOT used for a seller's pickup point anywhere: a pin is what a
 * coordinate you may publish looks like, and the whole reason hubs exist is
 * that a seller's own coordinates are not that. See src/lib/safe-zones.ts on
 * the server.
 */
export function PinIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M12 21.5s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" />
      <Circle cx="12" cy="10.2" r="2.6" />
    </Glyph>
  );
}

/** Report. A flag, which is the mark every platform uses for exactly this. */
export function FlagIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M5.5 21.5V3.5" />
      <Path d="M5.5 4.5h11l-2.2 3.8 2.2 3.8h-11" />
    </Glyph>
  );
}

/** Edit. A pencil on a baseline — the mark for changing what is already there. */
export function PencilIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <Path d="M14.5 5.5 18.5 9.5" />
    </Glyph>
  );
}

/**
 * Delete. A bin, and it is drawn OPEN — the lid is a separate line above the
 * body rather than a closed box, so it reads as a bin at 19 px where a filled
 * rectangle reads as a chip.
 */
export function TrashIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M4 6.5h16" />
      <Path d="M9.5 6.5V4.5h5v2" />
      <Path d="M6 6.5 7 20a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 17 20l1-13.5" />
      <Path d="M10.5 10.5v6.5" />
      <Path d="M13.5 10.5v6.5" />
    </Glyph>
  );
}

/** Block. A circle with a bar — the universal "no". */
export function BlockIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M6 6 18 18" />
    </Glyph>
  );
}

/* ──────────────────────────── organisations ─────────────────────────── */

/**
 * The verified-organisation mark: a check inside a rosette.
 *
 * DELIBERATELY NOT THE PLAIN CheckIcon. That glyph means "selected" everywhere
 * else in this app — it is the filter sheet's tick and the post wizard's
 * confirm — and reusing it for a claim about an account would make the same
 * mark mean two unrelated things on screens that show both. The rosette is
 * what says this is a badge rather than a state.
 *
 * Drawn as an outline like everything else here, so it inherits the stroke
 * table rather than arriving as a filled shape that ignores it.
 */
export function VerifiedOrgIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M12 2.6l2.3 1.7 2.8-.2.9 2.7 2.4 1.5-1 2.7 1 2.7-2.4 1.5-.9 2.7-2.8-.2L12 21.4l-2.3-1.7-2.8.2-.9-2.7-2.4-1.5 1-2.7-1-2.7 2.4-1.5.9-2.7 2.8.2z" />
      <Path d="M8.6 12.2 11 14.6l4.4-4.6" />
    </Glyph>
  );
}

/**
 * The placeholder where an organisation has no logo: a shop front.
 *
 * An awning over a counter, not a generic building. The distinction matters at
 * 40 px, which is the size this renders at on a feed card: a plain rectangle
 * with windows reads as an office block or, worse, as a broken image, while an
 * awning reads as a shop even when it is barely legible.
 *
 * It fills a SQUARE, because an organisation's logo slot is square — see the
 * profile header. A round mask over this would crop the awning's corners off,
 * which is most of what makes it recognisable.
 */
export function StoreIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M4 9.5h16V20H4z" />
      <Path d="M3.2 9.5 5 4.2h14l1.8 5.3z" />
      <Path d="M9.6 20v-5.4h4.8V20" />
    </Glyph>
  );
}

/* ────────────────────── home redesign (preview) ─────────────────────── */

/**
 * Perishable. A bolt, not a clock: the clock already means "rate limited" in
 * the post flow (post-icons.tsx), and a perishable is an opportunity, not a
 * wait. Drawn in `color.urgent` by the caller.
 */
export function BoltIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12Z" />
    </Glyph>
  );
}

/**
 * Featured — a paid boost. A star, so it never reads as the perishable bolt
 * beside it: the two can share a Home grid, and a user has to tell them apart
 * without tapping in.
 */
export function StarIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 5.9L12 16.8l-5.3 2.8 1.1-5.9-4.4-4.2 6-.8z" />
    </Glyph>
  );
}

/** The Community tab — the old Home feed. Two people, same weight as PersonIcon. */
export function CommunityIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Circle cx="9" cy="8" r="3.6" />
      <Path d="M2.5 20.5v-1.2A4.8 4.8 0 0 1 7.3 14.5h3.4a4.8 4.8 0 0 1 4.8 4.8v1.2" />
      <Path d="M15.5 4.6a3.6 3.6 0 0 1 0 6.8" />
      <Path d="M18.2 14.8a4.8 4.8 0 0 1 3.3 4.5v1.2" />
    </Glyph>
  );
}

/**
 * The Quests header icon. A target: a quest is a goal you are working toward,
 * and the concentric-ring mark is the one shape in this set that says "aim" without
 * saying anything else.
 *
 * WHY NOT ONE OF THE GLYPHS ALREADY HERE. Every near-fit is already spoken for
 * and would collide on a screen where both appear:
 *
 *   LeafIcon    is the CURRENCY. It is in the header pill, on every card's
 *               value line and in the Exclusive tiles. A leaf on the bar would
 *               read as "your Leaves", which is a balance, not a destination.
 *   FlagIcon    is Report. It is the mark in the listing kebab and the report
 *               sheet, and an icon that shares a glyph with "report this" is
 *               one people will hesitate over.
 *   SproutIcon  is the PLANTS category, drawn in the category circles on Home
 *               itself — one of the screens this icon sits above.
 *
 * Two circles and nothing else, because this is drawn at header-icon size: a bullseye with
 * tick marks or a centre dot turns to mud at that size, and the rings survive.
 */
export function QuestIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Circle cx="12" cy="12" r="8.5" />
      <Circle cx="12" cy="12" r="3.5" />
    </Glyph>
  );
}

/*
 * Category glyphs, for the Home category circles. One per category enum value
 * (src/api/post.ts CATEGORIES) that the circles map; anything unmapped falls
 * back to GridIcon in CategoryCircles. Same 24 box, same round caps and joins,
 * same scale() conversion — they are Glyphs like everything above.
 */

/** ELECTRONICS */
export function MonitorIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Rect x="3" y="4" width="18" height="12.5" rx="2" />
      <Path d="M8.5 20.5h7" />
      <Path d="M12 16.5v4" />
    </Glyph>
  );
}

/** CLOTHING ("Fashion") */
export function ShirtIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M8.5 3.5 3 6.6l2 4.4 2.5-1.2v10.7h9V9.8L19 11l2-4.4-5.5-3.1a3.5 3.5 0 0 1-7 0Z" />
    </Glyph>
  );
}

/** BAGS */
export function BagIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M5 8h14l-1 12.5H6Z" />
      <Path d="M9 10V6.5a3 3 0 0 1 6 0V10" />
    </Glyph>
  );
}

/** FURNITURE ("Home & Garden") */
export function SofaIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3" />
      <Path d="M3.5 11a1.5 1.5 0 0 1 3 0v2h11v-2a1.5 1.5 0 0 1 3 0v5.5h-17Z" />
      <Path d="M5.5 16.5V19" />
      <Path d="M18.5 16.5V19" />
    </Glyph>
  );
}

/** BOOKS ("Books & Media") */
export function BookIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M4 5.5a2 2 0 0 1 2-2h13v14H6a2 2 0 0 0-2 2Z" />
      <Path d="M4 19.5a2 2 0 0 0 2 2h13v-4" />
    </Glyph>
  );
}

/** GAMING */
export function GamepadIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M7 7.5h10a4.5 4.5 0 0 1 4.4 5.4l-.9 4.4a2.2 2.2 0 0 1-3.8 1l-2.2-2.8h-5l-2.2 2.8a2.2 2.2 0 0 1-3.8-1l-.9-4.4A4.5 4.5 0 0 1 7 7.5Z" />
      <Path d="M8 10.5v3" />
      <Path d="M6.5 12h3" />
      <Path d="M15.5 11h.01" />
      <Path d="M17.5 13h.01" />
    </Glyph>
  );
}

/** SPORTS */
export function BallIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M3.5 12h17" />
      <Path d="M12 3.5v17" />
      <Path d="M6 6a8.5 8.5 0 0 1 0 12" />
      <Path d="M18 6a8.5 8.5 0 0 0 0 12" />
    </Glyph>
  );
}

/** BIKES */
export function BikeIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Circle cx="5.5" cy="16" r="3.5" />
      <Circle cx="18.5" cy="16" r="3.5" />
      <Path d="M5.5 16 9.5 8.5h5l4 7.5" />
      <Path d="M9.5 8.5 12 16h-6.5" />
      <Path d="M8 5.5h3" />
    </Glyph>
  );
}

/** TOYS ("Kids & Toys") */
export function BlocksIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Rect x="3.5" y="12.5" width="7.5" height="7.5" rx="1.5" />
      <Rect x="13" y="12.5" width="7.5" height="7.5" rx="1.5" />
      <Rect x="8.25" y="4" width="7.5" height="7.5" rx="1.5" />
    </Glyph>
  );
}

/** PLANTS */
export function SproutIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M12 21v-9" />
      <Path d="M12 12C12 8 9.5 5.5 5 5.5c0 4.5 2.5 6.5 7 6.5Z" />
      <Path d="M12 14c0-3.5 2.2-5.5 7-5.5 0 3.8-2.4 5.5-7 5.5Z" />
    </Glyph>
  );
}

/** FOOD */
export function AppleIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M12 7.5c-1.6-1.2-4.6-1.4-6.3.6-2 2.4-1.2 6.9 1 9.7 1.5 1.9 3 2.4 5.3 1.3 2.3 1.1 3.8.6 5.3-1.3 2.2-2.8 3-7.3 1-9.7-1.7-2-4.7-1.8-6.3-.6Z" />
      <Path d="M12 7.5c0-2 .8-3.5 2.5-4.5" />
    </Glyph>
  );
}
