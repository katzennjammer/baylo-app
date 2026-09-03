import Svg, { Circle, Path } from "react-native-svg";

import { authIcon } from "../theme/auth-tokens";

/**
 * The eight marks the auth screens use.
 *
 * Separate from `icons.tsx` rather than added to it because three of these —
 * the leaf, the alert and the chevron — already exist there at DIFFERENT
 * geometry, drawn for the feed's light canvas at the feed's sizes. Reusing
 * those would mean either bending the feed's marks to this spec or accepting
 * two silently different leaves. A second small file is the cheaper of the two.
 *
 * STROKE WIDTH IS CONVERTED, NOT PASSED THROUGH — the same rule as `icons.tsx`,
 * repeated because it is the one thing that silently mis-renders. Every glyph
 * is authored in a 24×24 box, so a `strokeWidth` of 1.6 rendered at 21px would
 * paint 1.6 × (21/24) = 1.4px. `scale()` inverts that, which makes the number
 * in `authIcon` the width in device-independent pixels that actually lands.
 *
 * Round caps and joins on everything, fill none, per the spec's blanket rule.
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

/** Settings. The only chrome on the sign-in screen. */
export function GearIcon({ size = authIcon.gear.size, color, stroke = authIcon.gear.stroke }: Props) {
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

/** Back, on create account. */
export function BackIcon({ size = authIcon.back.size, color, stroke = authIcon.back.stroke }: Props) {
  const w = scale(stroke, size);
  return (
    <Svg {...frame(size)}>
      <Path d="M19 12H5" stroke={color} strokeWidth={w} {...round} />
      <Path d="M11.2 5.2 4.4 12l6.8 6.8" stroke={color} strokeWidth={w} {...round} />
    </Svg>
  );
}

/** The error strip's mark. */
export function AlertIcon({ size = authIcon.alert.size, color, stroke = authIcon.alert.stroke }: Props) {
  const w = scale(stroke, size);
  return (
    <Svg {...frame(size)}>
      <Circle cx={12} cy={12} r={8.8} stroke={color} strokeWidth={w} {...round} />
      <Path d="M12 7.4v5.4" stroke={color} strokeWidth={w} {...round} />
      <Path d="M12 16.4v.05" stroke={color} strokeWidth={w} {...round} />
    </Svg>
  );
}

/**
 * A monoline G.
 *
 * NOT Google's mark. Google's brand terms require their own four-colour G on a
 * "Continue with Google" control, and this is a placeholder that honours the
 * direction's line-icon rule until that asset is dropped in. The box is 19px
 * either way, so swapping it changes nothing about the row's geometry.
 */
export function GoogleGlyph({ size = authIcon.google.size, color, stroke = authIcon.google.stroke }: Props) {
  const w = scale(stroke, size);
  return (
    <Svg {...frame(size)}>
      <Path d="M20.4 12.35A8.4 8.4 0 1 1 17.55 6.1" stroke={color} strokeWidth={w} {...round} />
      <Path d="M20.4 12.35h-7.55" stroke={color} strokeWidth={w} {...round} />
    </Svg>
  );
}

/** Trailing mark on the Google row. */
export function ChevronIcon({ size = authIcon.chevron.size, color, stroke = authIcon.chevron.stroke }: Props) {
  const w = scale(stroke, size);
  return (
    <Svg {...frame(size)}>
      <Path d="M9.5 5.5 16 12l-6.5 6.5" stroke={color} strokeWidth={w} {...round} />
    </Svg>
  );
}

/** Show / hide password. */
export function EyeIcon({
  size = authIcon.eye.size,
  color,
  stroke = authIcon.eye.stroke,
  off = false,
}: Props & { off?: boolean }) {
  const w = scale(stroke, size);
  return (
    <Svg {...frame(size)}>
      <Path
        d="M2.6 12S6.2 5.9 12 5.9 21.4 12 21.4 12 17.8 18.1 12 18.1 2.6 12 2.6 12Z"
        stroke={color}
        strokeWidth={w}
        {...round}
      />
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={w} {...round} />
      {off ? <Path d="M4.2 19.8 19.8 4.2" stroke={color} strokeWidth={w} {...round} /> : null}
    </Svg>
  );
}

/** The action bar's trailing mark. */
export function ArrowIcon({ size = authIcon.arrow.size, color, stroke = authIcon.arrow.stroke }: Props) {
  const w = scale(stroke, size);
  return (
    <Svg {...frame(size)}>
      <Path d="M4.5 12h14" stroke={color} strokeWidth={w} {...round} />
      <Path d="M12.8 6.2 18.6 12l-5.8 5.8" stroke={color} strokeWidth={w} {...round} />
    </Svg>
  );
}

/** The welcome-grant strip. */
export function AuthLeafIcon({ size = authIcon.leaf.size, color, stroke = authIcon.leaf.stroke }: Props) {
  const w = scale(stroke, size);
  return (
    <Svg {...frame(size)}>
      <Path
        d="M20.4 3.6c.9 8.6-4.2 14.9-12.2 14.9H4.1C3.2 9.9 8.3 3.6 16.3 3.6Z"
        stroke={color}
        strokeWidth={w}
        {...round}
      />
      <Path d="M3.9 20.4c2.4-4.8 6.1-8.3 10.9-10.5" stroke={color} strokeWidth={w} {...round} />
    </Svg>
  );
}
