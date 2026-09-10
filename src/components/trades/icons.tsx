import { Path } from "react-native-svg";

import { Glyph, type IconProps } from "../icons";

/**
 * The one mark this feature needs that nothing else in the app draws.
 *
 * Everything else is already cut: `WarningTriangleIcon`, `ArrowsIcon` and
 * `PromiseIcon` live in `src/components/offer/icons.tsx`, and
 * `ChevronRightIcon`, `ChevronLeftIcon` and `ImageIcon` in
 * `src/components/icons.tsx`. All of them ride the same `Glyph` frame, which
 * inverts the viewBox scale so the number in `offerIcon` is the stroke width in
 * device-independent pixels that actually lands — see the note there.
 */

/**
 * A promise, in the well where a photo would be.
 *
 * §1.7 gives the DPA its colours and never gives it a glyph, so this is the
 * frames' own mark: a case with a handle and a line across it. Drawn rather than
 * borrowed from `PromiseIcon` (a clock with a tick) because that one is a 19px
 * inline row icon and reads as a busy scribble at the 20px this well shows it
 * at — a closed shape holds up where an open one does not.
 */
export function PromiseCaseIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M4.5 7.5h15v11h-15z" />
      <Path d="M9 7.5V5.5h6v2M4.5 12.5h15" />
    </Glyph>
  );
}
