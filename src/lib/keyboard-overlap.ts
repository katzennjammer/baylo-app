import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Platform, type KeyboardEvent, type View } from "react-native";

/**
 * How far the keyboard reaches up into a screen, in px: MEASURED, not assumed
 * (18 Nov 2026, the same approach as the Comments sheet).
 *
 * Whether Android shrinks the window for the keyboard depends on the device
 * and the edge-to-edge mode. A screen that always added the raw keyboard
 * height as a bottom margin was squeezed TWICE where the window had already
 * shrunk: the swap-code field under "Show code" got pushed up and cut off.
 * This compares the screen's bottom edge with the keyboard's top edge: 0 if
 * the window already shrank, the keyboard's height if it did not. It is
 * re-measured on layout, so a late resize settles to the right answer.
 *
 * Put `rootRef` and `onRootLayout` on a full-height wrapper OUTSIDE whatever
 * applies the inset, so applying it never changes what is measured.
 */
export function useMeasuredKeyboardOverlap(active = true) {
  const rootRef = useRef<View>(null);
  const keyboardTop = useRef<number | null>(null);
  const [overlap, setOverlap] = useState(0);

  const measure = useCallback(() => {
    const top = keyboardTop.current;
    if (top === null) {
      setOverlap(0);
      return;
    }
    rootRef.current?.measureInWindow((_x, y, _w, h) => setOverlap(Math.max(0, Math.round(y + h - top))));
  }, []);

  useEffect(() => {
    if (!active) return;
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e: KeyboardEvent) => {
        keyboardTop.current = e.endCoordinates.screenY;
        measure();
      },
    );
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => {
      keyboardTop.current = null;
      setOverlap(0);
    });
    return () => {
      show.remove();
      hide.remove();
      keyboardTop.current = null;
      setOverlap(0);
    };
  }, [active, measure]);

  return { rootRef, onRootLayout: measure, overlap };
}
