import { useCallback, useState } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

/**
 * A Pressable whose fill changes while it is held down — WITHOUT handing React
 * Native a function as its `style`.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
 *
 * `style={({ pressed }) => [base, pressed && held]}` is the idiomatic way to do
 * this in React Native, and under NativeWind it silently erases the style.
 * Not the pressed half — ALL of it. The control keeps its text and loses its
 * fill, its height, its radius and its centring, which reads as "someone forgot
 * to style this" rather than as a bug. It cost a full afternoon to find, so the
 * chain is written out here:
 *
 *   1. `babel-preset-expo` is configured with `jsxImportSource: "nativewind"`,
 *      so every JSX element in the app goes through NativeWind's wrapped `jsx`.
 *   2. That wrapper swaps `Pressable` for the css-interop version
 *      UNCONDITIONALLY — `interopComponents.get(type) ?? type`. There is no
 *      "only if it has a className" check, so this applies to every Pressable
 *      in the app including the ones that have never heard of Tailwind.
 *   3. The interop is registered as `cssInterop(Pressable, { className: "style" })`,
 *      and `getNormalizeConfig` turns a mapping whose target differs from its
 *      source into an `inlineProp` — here, `style`. That makes the interop
 *      claim ownership of the `style` prop itself, not just of `className`.
 *   4. So `collectInlineRules()` is handed the existing `style` prop and treats
 *      whatever it finds as an inline rule. Arrays it walks; objects it merges.
 *      A function is neither, so it falls to `applyRules`' final branch:
 *      `assignToTarget(props, { ...declaration }, ...)`.
 *   5. `{ ...aFunction }` is `{}`. Functions have no own enumerable properties.
 *   6. That `{}` is written to `state.props.style`, and `renderComponent` does
 *      `props = { ...props, ...possiblyAnimatedProps }` — so the empty object
 *      OVERWRITES the function. The real Pressable is rendered with `style={{}}`
 *      and never learns it was supposed to be green.
 *
 * Object and array styles come through this same path intact, which is why
 * every other control in the app looks right and only these ones did not.
 *
 * ── WHAT THIS DOES INSTEAD ───────────────────────────────────────────────────
 *
 * Tracks the held state itself and passes a plain ARRAY, which step 4 above
 * merges correctly. The result is identical to what the function form was meant
 * to produce; it just never gives the interop a value it cannot read.
 *
 * The alternative was `cssInterop={false}`, NativeWind's per-element opt-out.
 * It is one prop instead of one component — and it is also five separate places
 * that would each have to remember an escape hatch whose name gives no hint of
 * what it is escaping. This way the trap is described once and the call sites
 * read as ordinary buttons.
 */
export function Tappable({
  style,
  pressedStyle,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  /** Merged over `style` while held. Omit for a control with no held state. */
  pressedStyle?: StyleProp<ViewStyle>;
}) {
  const [pressed, setPressed] = useState(false);

  // The caller's own handlers still run. These are a detail of how the fill is
  // drawn, and a component that quietly ate an onPressIn someone passed would
  // be a worse trap than the one this file exists to close.
  const handlePressIn = useCallback<NonNullable<PressableProps["onPressIn"]>>(
    (e) => {
      setPressed(true);
      onPressIn?.(e);
    },
    [onPressIn],
  );

  const handlePressOut = useCallback<NonNullable<PressableProps["onPressOut"]>>(
    (e) => {
      setPressed(false);
      onPressOut?.(e);
    },
    [onPressOut],
  );

  return (
    <Pressable
      {...rest}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      // Only allocates the array while held, so the common case passes the
      // caller's own style object straight through unchanged.
      style={pressed && pressedStyle ? [style, pressedStyle] : style}
    >
      {children}
    </Pressable>
  );
}
