import Svg, { Circle, Path, Rect } from "react-native-svg";

import { authIcon } from "../theme/auth-sheet-tokens";

/**
 * The marks the sheet-over-video auth screens use.
 *
 * A separate file from both `icons.tsx` (the feed) and `auth-icons.tsx` (the
 * previous auth direction), for the reason `auth-icons.tsx` already gives about
 * the feed: several of these exist elsewhere at DIFFERENT geometry, and the
 * spec's table pairs a size with a stroke for each one. Reusing a 16/1.8
 * chevron where the spec asks for 18/1.7 is a change nobody would ever notice
 * reviewing the diff and everybody would notice on the screen.
 *
 * STROKE WIDTH IS CONVERTED, NOT PASSED THROUGH. Every glyph is authored in a
 * 24×24 box, so a `strokeWidth` of 1.6 rendered at an 18px size would actually
 * paint 1.6 × (18/24) = 1.2px. `scale()` inverts that, which makes the number
 * in the spec's table the width in device-independent pixels that lands.
 *
 * Round caps and joins on everything, fill none — the same blanket rule the
 * other two icon files follow.
 */

const BOX = 24;

/** The strokeWidth that paints `stroke` real px at a render size of `size`. */
function scale(stroke: number, size: number): number {
  return (stroke * BOX) / size;
}

interface Props {
  size?: number;
  color: string;
  stroke?: number;
}

function frame(size: number) {
  return {
    width: size,
    height: size,
    viewBox: `0 0 ${BOX} ${BOX}`,
    fill: "none" as const,
  };
}

const round = { strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** Back. 22 / 1.9 in the band row, 21 / 1.9 in the 4c compact header. */
export function BackIcon({
  size = authIcon.back.size,
  color,
  stroke = authIcon.back.stroke,
}: Props) {
  const w = scale(stroke, size);
  return (
    <Svg {...frame(size)}>
      <Path d="M19 12H5" stroke={color} strokeWidth={w} {...round} />
      <Path d="M11.2 5.2 4.4 12l6.8 6.8" stroke={color} strokeWidth={w} {...round} />
    </Svg>
  );
}

/** The outline button's leading mark on sign in — "Continue with email". */
export function EnvelopeIcon({
  size = authIcon.envelope.size,
  color,
  stroke = authIcon.envelope.stroke,
}: Props) {
  const w = scale(stroke, size);
  return (
    <Svg {...frame(size)}>
      <Rect x={2.8} y={5.2} width={18.4} height={13.6} rx={2.4} stroke={color} strokeWidth={w} {...round} />
      <Path d="m3.4 7.1 8.6 6 8.6-6" stroke={color} strokeWidth={w} {...round} />
    </Svg>
  );
}

/** The date-of-birth field's trailing mark. */
export function CalendarIcon({
  size = authIcon.calendar.size,
  color,
  stroke = authIcon.calendar.stroke,
}: Props) {
  const w = scale(stroke, size);
  return (
    <Svg {...frame(size)}>
      <Rect x={3.4} y={5} width={17.2} height={16} rx={2.4} stroke={color} strokeWidth={w} {...round} />
      <Path d="M3.4 9.8h17.2" stroke={color} strokeWidth={w} {...round} />
      <Path d="M8.2 2.9v4.2" stroke={color} strokeWidth={w} {...round} />
      <Path d="M15.8 2.9v4.2" stroke={color} strokeWidth={w} {...round} />
    </Svg>
  );
}

/** Every picker field's trailing mark. */
export function ChevronDownIcon({
  size = authIcon.chevronDown.size,
  color,
  stroke = authIcon.chevronDown.stroke,
}: Props) {
  const w = scale(stroke, size);
  return (
    <Svg {...frame(size)}>
      <Path d="m5.5 9 6.5 6.4L18.5 9" stroke={color} strokeWidth={w} {...round} />
    </Svg>
  );
}

/**
 * Confirm-password match, the Google card's confirmation, and a chosen option
 * in a picker sheet. One mark at 18 / 2.0 for all three — the spec gives the
 * first two identical geometry, and the third is the same idea.
 */
export function CheckIcon({
  size = authIcon.matchCheck.size,
  color,
  stroke = authIcon.matchCheck.stroke,
}: Props) {
  const w = scale(stroke, size);
  return (
    <Svg {...frame(size)}>
      <Path d="m4.8 12.6 4.7 4.7L19.2 7.6" stroke={color} strokeWidth={w} {...round} />
    </Svg>
  );
}

/** The declaration row's leading mark — the age statement above the button. */
export function InfoIcon({
  size = authIcon.info.size,
  color,
  stroke = authIcon.info.stroke,
}: Props) {
  const w = scale(stroke, size);
  return (
    <Svg {...frame(size)}>
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={w} {...round} />
      <Path d="M12 11.2v5.2" stroke={color} strokeWidth={w} {...round} />
      <Path d="M12 7.6v.05" stroke={color} strokeWidth={w} {...round} />
    </Svg>
  );
}

/**
 * The error mark. 15 / 1.9 beside a field message, 32 / 1.5 inside the
 * rejection screen's circle — one glyph, two sizes, and the stroke drops as the
 * size rises exactly as the spec's table says it should.
 */
export function AlertIcon({
  size = authIcon.alert.size,
  color,
  stroke = authIcon.alert.stroke,
}: Props) {
  const w = scale(stroke, size);
  return (
    <Svg {...frame(size)}>
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={w} {...round} />
      <Path d="M12 7.2v5.4" stroke={color} strokeWidth={w} {...round} />
      <Path d="M12 16.3v.05" stroke={color} strokeWidth={w} {...round} />
    </Svg>
  );
}

/**
 * Settings. NOT in the spec — the gear is a development affordance the design
 * does not draw, and it is staying: `adb reverse` drops on every replug, and a
 * screen you cannot repoint is a screen you cannot sign in from. It takes the
 * back chevron's weight so the two ends of the band row match.
 */
export function GearIcon({
  size = authIcon.gear.size,
  color,
  stroke = authIcon.gear.stroke,
}: Props) {
  const w = scale(stroke, size);
  return (
    <Svg {...frame(size)}>
      <Circle cx={12} cy={12} r={3.1} stroke={color} strokeWidth={w} {...round} />
      <Path
        d="M19.1 14.9a1.6 1.6 0 0 0 .32 1.77l.06.06a1.94 1.94 0 1 1-2.75 2.75l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47v.17a1.94 1.94 0 0 1-3.88 0v-.09a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.77.32l-.06.06a1.94 1.94 0 1 1-2.75-2.75l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97H3.1a1.94 1.94 0 0 1 0-3.88h.09a1.6 1.6 0 0 0 1.46-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a1.94 1.94 0 1 1 2.75-2.75l.06.06a1.6 1.6 0 0 0 1.77.32h.08a1.6 1.6 0 0 0 .97-1.47V3.1a1.94 1.94 0 0 1 3.88 0v.09a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a1.94 1.94 0 1 1 2.75 2.75l-.06.06a1.6 1.6 0 0 0-.32 1.77v.08a1.6 1.6 0 0 0 1.47.97h.17a1.94 1.94 0 0 1 0 3.88h-.09a1.6 1.6 0 0 0-1.46.97z"
        stroke={color}
        strokeWidth={w}
        {...round}
      />
    </Svg>
  );
}
