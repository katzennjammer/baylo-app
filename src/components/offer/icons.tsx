import { Path, Rect } from "react-native-svg";

import { Glyph, type IconProps } from "../icons";

/**
 * The four marks this flow needs that `src/components/icons.tsx` does not have.
 *
 * Same 24×24 box, same `Glyph` frame, same stroke-in-real-pixels conversion —
 * they are here rather than in the main set because they are this spec's
 * vocabulary and nothing else in the app draws a padlock or a calendar. Adding
 * them to the shared file would put four marks in front of every reader of the
 * feed's icon table for the sake of one flow.
 *
 * `CalendarIcon` and `AlertIcon` already exist in `auth-sheet-icons.tsx` and are
 * NOT imported from there: that file's glyphs are authored against the auth
 * kit's own stroke conventions and importing one would drag the auth sheet's
 * token module into this flow's bundle for a shape that is nine bytes of path.
 */

/** §5.2's "Not ID-verified" row. `#A8A69A`, 18px, 1.7. */
export function LockIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Rect x="4" y="10.5" width="16" height="10.5" rx="2.2" />
      <Path d="M7.6 10.5V7.6a4.4 4.4 0 0 1 8.8 0v2.9" />
    </Glyph>
  );
}

/** §3.4's date row and §8.3's picker. */
export function CalendarIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Rect x="3.2" y="5.2" width="17.6" height="16" rx="2.4" />
      <Path d="M3.2 10h17.6M8 3v4.4M16 3v4.4" />
    </Glyph>
  );
}

/**
 * §1.10's failure panels. A triangle, not a circle — the post flow's
 * `AlertCircleIcon` is its duplicate-check mark and this is a send failure, and
 * §4 sizes this one separately at 19/1.8.
 */
export function WarningTriangleIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M12 3.6 22 20.4H2Z" />
      <Path d="M12 9.6v5M12 17.4h.01" />
    </Glyph>
  );
}

/**
 * The mark on §10.8's "Trade up to it" and §10.2's "Offer more than one item":
 * two items changing places. Distinct from the feed's `SwapIcon`, which is the
 * Offer control's mark and is authored heavy at 15px to survive beside a bold
 * label; this one sits at 19/1.7 in a route row and would read as a smear at
 * the feed's weight.
 */
export function ArrowsIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M3.5 8.4h13.2M13.2 4.9l3.5 3.5-3.5 3.5" />
      <Path d="M20.5 15.6H7.3M10.8 12.1l-3.5 3.5 3.5 3.5" />
    </Glyph>
  );
}

/** §10.8's "Offer with a promise" — a hand giving. Drawn as a clock over a leaf
 *  stem would be busy at 19px, so it is the promise's own shape: a circle with
 *  a forward tick, which is what a deadline is. */
export function PromiseIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M12 21.2a9.2 9.2 0 1 1 9.2-9.2" />
      <Path d="M12 6.8V12l3.4 2" />
      <Path d="M16.6 18.4l2.2 2.2 4-4.4" />
    </Glyph>
  );
}
