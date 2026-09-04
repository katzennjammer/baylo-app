import Svg, { Circle, Path, Rect } from "react-native-svg";

import { Glyph, type IconProps } from "../icons";

/**
 * The six marks the post flow needs that the app did not already have.
 *
 * Everything else it asks for is already drawn: the back chevron is
 * `ChevronLeftIcon`, the close and remove crosses are `CloseIcon`, the gallery
 * mark is `ImageIcon`, the add-photo plus is `PlusIcon`, both checks are
 * `CheckIcon`, the retry arrow is `RefreshIcon`, the running-check magnifier is
 * `SearchIcon`, the leaf is `LeafIcon` and the provenance arrows are
 * `SwapIcon`. Only these six had no equivalent, and each is here because the
 * spec names a mark the app has never drawn — not because an existing one
 * looked slightly wrong at a new size.
 *
 * They share `Glyph` from `../icons`, which is what converts the spec's stroke
 * from device-independent pixels into the SVG user units a 24-box needs. Every
 * size/stroke pair in `postIcon` therefore lands at the width it names.
 *
 * ONE DELIBERATE SUBSTITUTION, called out because it is the kind of thing that
 * silently drifts: the spec's "alert circle" is a circle, and the app's
 * existing `WarningIcon` is a TRIANGLE. They are not interchangeable here —
 * the triangle is the feed's offline banner and carries "something is broken",
 * while all three warm-accent states in this flow are "we are telling you
 * something about this photo". The circle is the quieter mark and it is the one
 * the spec asked for, so it is drawn rather than borrowed.
 */

/**
 * The camera. Used at four sizes — 20 on the primary button, 13 in the marker
 * chip, 10/11 in a thumbnail badge, 17 in the tooltip — so the body is kept
 * simple enough to survive being drawn at 10 px.
 */
export function CameraIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.6l1.3-2.2h6.2L15.9 7h3.6A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5Z" />
      <Circle cx="12" cy="13" r="3.6" />
    </Glyph>
  );
}

/** The picker field's affordance, on step 2's detection-failed layout. */
export function ChevronDownIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M5 9.5 12 16.5l7-7" />
    </Glyph>
  );
}

/**
 * The helper mark: an info circle, at 15/1.7.
 *
 * It leads the marker note on step 1 and the ±25% note on step 4. Both are
 * explanations of a rule, never a warning, which is why this is grey and not
 * warm anywhere it appears.
 */
export function InfoIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Circle cx="12" cy="12" r="8.6" />
      <Path d="M12 11.2v5" />
      <Path d="M12 8.1h.01" />
    </Glyph>
  );
}

/** Rate limiting and the spent re-valuation. Both are "wait", not "no". */
export function ClockIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Circle cx="12" cy="12" r="8.6" />
      <Path d="M12 7.4V12l3.2 1.9" />
    </Glyph>
  );
}

/**
 * Relist — two arrows going round, for "you used this photo before".
 *
 * Not `RefreshIcon`, which is one arrow and means "try that again". This one
 * means "the same thing, posted a second time", which is precisely the case the
 * `self` duplicate result is describing and the reason it is allowed through.
 */
export function RelistIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M3.8 9.2A8.4 8.4 0 0 1 19 7.4" />
      <Path d="M19.4 3.4v4.2h-4.2" />
      <Path d="M20.2 14.8A8.4 8.4 0 0 1 5 16.6" />
      <Path d="M4.6 20.6v-4.2h4.2" />
    </Glyph>
  );
}

/**
 * The alert circle, at 17 (warned, failed upload) and 18 (failed duplicate).
 *
 * A circle, not the app's existing triangle — see the note at the top of the
 * file. It never appears in green and never appears on a skeleton.
 */
export function AlertCircleIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Circle cx="12" cy="12" r="8.6" />
      <Path d="M12 7.6v5" />
      <Path d="M12 16.2h.01" />
    </Glyph>
  );
}

/**
 * The hub row's unchecked box.
 *
 * A square rather than a mark, because it is the one control in the flow whose
 * empty state has to read as "you may pick up to five of these" rather than as
 * "this one is off". Drawn here rather than composed from a bordered `View` so
 * its 1.5 stroke matches the check that replaces it at the same 22 box.
 */
export function CheckboxIcon({
  size,
  color,
  stroke = 1.5,
}: {
  size: number;
  color: string;
  stroke?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none">
      <Rect
        x={stroke / 2}
        y={stroke / 2}
        width={24 - stroke}
        height={24 - stroke}
        rx={6.5}
        fill="none"
        stroke={color}
        strokeWidth={(stroke * 24) / size}
      />
    </Svg>
  );
}
