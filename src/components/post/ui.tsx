import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { CheckIcon, LeafIcon } from "../icons";
import { Tappable } from "../Tappable";
import { ChevronDownIcon, ClockIcon, InfoIcon } from "./post-icons";
import {
  fieldSize,
  postBorder,
  postColor,
  postIcon,
  postMotion,
  postRadius,
  postSize,
  postType,
  textStyle,
} from "../../theme/post-tokens";

/**
 * The controls the seven steps are built from.
 *
 * Every one of them goes through `Tappable`, never
 * `style={({ pressed }) => …}` — under NativeWind a function `style` on a
 * Pressable is silently replaced with `{}`, and not the pressed half: ALL of
 * it. The control keeps its text and loses its fill, height, radius and
 * centring. The full chain is written out in `Tappable.tsx`.
 *
 * Nothing tappable in this file is under 44 tall. Where the spec draws
 * something smaller — the 13 px "Undo", the 20 check on a condition row — the
 * VISIBLE mark is small and the hit area is not.
 */

/* ─────────────────────────── the focus ring ─────────────────────────── */

/**
 * The 3 px, 16 %-green ring around a focused field or a selected condition row.
 *
 * Drawn as a sibling rather than as a second border, because React Native has
 * no `box-shadow: 0 0 0 3px` and an outer wrapper View would change the
 * element's own box — which would move the 56 row and the 68 row off their
 * measured heights. Absolutely positioned at −3 with a matching radius, it
 * paints outside the control and costs the layout nothing.
 */
function FocusRing({ radius, color = postColor.focusRing }: { radius: number; color?: string }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: -postBorder.ring,
        left: -postBorder.ring,
        right: -postBorder.ring,
        bottom: -postBorder.ring,
        borderRadius: radius + postBorder.ring,
        borderWidth: postBorder.ring,
        borderColor: color,
      }}
    />
  );
}

/* ───────────────────────────── buttons ──────────────────────────────── */

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** The camera mark on "Take a photo", the retry arrow on "Try again". */
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || loading;
  return (
    <Tappable
      onPress={off ? undefined : onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      accessibilityLabel={label}
      style={[
        {
          height: postSize.button.primary,
          borderRadius: postRadius.button,
          backgroundColor: disabled ? postColor.disabledFill : postColor.primary,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: postSize.entry.iconGap,
        },
        style,
      ]}
      pressedStyle={disabled ? undefined : { backgroundColor: postColor.primaryPressed }}
    >
      {loading ? (
        // The label SWAPS for the spinner rather than sitting beside it: a
        // button that is 16 px wider while it works is a button that moves under
        // the thumb that just pressed it.
        <ActivityIndicator size="small" color={postColor.onGreen} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              textStyle(postType.primaryLabel),
              { color: disabled ? postColor.inkDisabled : postColor.onGreen },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Tappable>
  );
}

export function OutlineButton({
  label,
  onPress,
  disabled = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Tappable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={label}
      style={[
        {
          height: postSize.button.primary,
          borderRadius: postRadius.button,
          backgroundColor: postColor.surface,
          borderWidth: postBorder.field,
          borderColor: disabled ? postColor.line : postColor.lineStrong,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: postSize.entry.iconGap,
        },
        style,
      ]}
      pressedStyle={disabled ? undefined : { backgroundColor: postColor.inset }}
    >
      {icon}
      <Text
        style={[
          textStyle(postType.outlineLabel),
          { color: disabled ? postColor.inkDisabled : postColor.ink },
        ]}
      >
        {label}
      </Text>
    </Tappable>
  );
}

/**
 * A text button: 48 tall, forest by default.
 *
 * `tone="warm"` is "Discard this draft" and nothing else in this flow. The warm
 * accent has exactly four homes in the spec and this is the only one that is a
 * button label.
 */
export function TextButton({
  label,
  onPress,
  tone = "forest",
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: "forest" | "warm";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Tappable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[
        {
          height: postSize.button.text,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text
        style={[
          textStyle(postType.textLabel),
          {
            color: disabled
              ? postColor.inkDisabled
              : tone === "warm"
                ? postColor.warmInk
                : postColor.forest,
          },
        ]}
      >
        {label}
      </Text>
    </Tappable>
  );
}

/** Save draft, Edit, Undo, Change. 13/600 in a 44 hit area. */
export function SmallTextButton({
  label,
  onPress,
  disabled = false,
  style,
  textStyleOverride,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyleOverride?: StyleProp<TextStyle>;
}) {
  return (
    <Tappable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[
        { minHeight: postSize.button.smallText, justifyContent: "center" },
        style,
      ]}
    >
      <Text
        style={[
          textStyle(postType.smallTextLabel),
          { color: disabled ? postColor.inkDisabled : postColor.forest },
          textStyleOverride,
        ]}
      >
        {label}
      </Text>
    </Tappable>
  );
}

/**
 * Step 2's confirm row: 44 tall, radius 8.
 *
 * `tone="confirm"` is the green-wash "That's right"; `tone="outline"` is
 * "Change it". They are the same height and sit side by side at gap 10, which
 * is what makes "that's right" the easy answer without making "change it" a
 * demotion.
 */
export function ConfirmButton({
  label,
  onPress,
  tone,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  tone: "confirm" | "outline";
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const confirm = tone === "confirm";
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        {
          height: postSize.button.confirm,
          borderRadius: postRadius.confirmButton,
          backgroundColor: confirm ? postColor.greenWash : postColor.surface,
          borderWidth: postBorder.field,
          borderColor: confirm ? postColor.greenLine : postColor.lineStrong,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
        },
        style,
      ]}
      pressedStyle={{ backgroundColor: confirm ? postColor.greenLine : postColor.inset }}
    >
      {icon}
      <Text
        style={[
          textStyle(postType.confirmLabel),
          { color: confirm ? postColor.forest : postColor.ink },
        ]}
      >
        {label}
      </Text>
    </Tappable>
  );
}

/* ────────────────────────────── fields ──────────────────────────────── */

export type FieldState = "empty" | "focused" | "filled" | "error" | "disabled";

function fieldColors(state: FieldState) {
  switch (state) {
    case "focused":
      return {
        fill: postColor.surface,
        border: postColor.green,
        width: postBorder.fieldActive,
        label: postColor.forest,
        value: postColor.ink,
      };
    case "error":
      return {
        fill: postColor.surface,
        border: postColor.warm,
        width: postBorder.fieldActive,
        label: postColor.warmInk,
        value: postColor.ink,
      };
    case "filled":
      return {
        fill: postColor.inset,
        border: postColor.line,
        width: postBorder.field,
        label: postColor.inkMuted,
        value: postColor.ink,
      };
    case "disabled":
      return {
        fill: postColor.inset,
        border: postColor.line,
        width: postBorder.field,
        label: postColor.inkDisabled,
        value: postColor.inkDisabled,
      };
    default:
      return {
        fill: postColor.inset,
        border: postColor.line,
        width: postBorder.field,
        label: postColor.inkMuted,
        value: postColor.inkDisabled,
      };
  }
}

/**
 * The 56 text field.
 *
 * ── THE PADDING GIVES BACK WHAT THE BORDER TAKES ────────────────────────────
 *
 * Focused and error states grow the border from 1 to 1.5, and the spec's
 * "padding −1" is what stops the text shifting half a pixel sideways when a
 * field is tapped. Same trick as the condition row's 16 → 15. It is the
 * cheapest way to get a state change that reads as a state change rather than
 * as a reflow.
 *
 * The 14 px horizontal padding is artboard-read: the spec fixes the row's
 * height, its fill, its border, its radius and both type roles, and names the
 * padding only by that −1 correction. Flagged so a tuning pass knows which
 * number is the spec's and which is an eye's.
 */
export function Field({
  label,
  value,
  placeholder,
  onChangeText,
  onBlur,
  error,
  disabled = false,
  autoFocus = false,
  maxLength,
  trailing,
  inputRef,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  /** The chevron on a picker field. */
  trailing?: React.ReactNode;
  inputRef?: React.RefObject<TextInput | null>;
}) {
  const [focused, setFocused] = useState(false);
  const state: FieldState = disabled
    ? "disabled"
    : error
      ? "error"
      : focused
        ? "focused"
        : value
          ? "filled"
          : "empty";
  const c = fieldColors(state);
  const pad = c.width === postBorder.fieldActive ? 13 : 14;

  return (
    <View>
      <View
        style={{
          height: fieldSize.row,
          borderRadius: postRadius.field,
          backgroundColor: c.fill,
          borderWidth: c.width,
          borderColor: c.border,
          paddingHorizontal: pad,
          justifyContent: "center",
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {/* The ring is on focus only. An error field has no ring — two rings in
            two colours on one screen is how a form stops reading. */}
        {state === "focused" ? <FocusRing radius={postRadius.field} /> : null}

        <View style={{ flex: 1 }}>
          <Text style={[textStyle(postType.fieldLabel), { color: c.label }]}>
            {label.toUpperCase()}
          </Text>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            editable={!disabled}
            autoFocus={autoFocus}
            maxLength={maxLength}
            placeholder={placeholder}
            placeholderTextColor={postColor.inkDisabled}
            selectionColor={postColor.forest}
            // The caret is 1.5 × 17 in forest on a 1 s step-end blink. Android
            // takes the colour from `cursorColor`; iOS from `selectionColor`.
            cursorColor={postColor.forest}
            style={[
              textStyle(value ? postType.fieldValue : postType.fieldPlaceholder),
              {
                color: c.value,
                padding: 0,
                marginTop: 5,
                // A TextInput with no explicit height collapses differently on
                // the two platforms. 19 is the 15 px value's box plus its lead.
                height: 19,
              },
            ]}
          />
        </View>
        {trailing}
      </View>

      {error ? (
        <Text
          style={[
            textStyle(postType.fieldError),
            { color: postColor.warmInk, marginTop: 8 },
          ]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A field that opens a picker rather than a keyboard.
 *
 * Step 2's category, on the detection-failed layout. It is a Tappable wearing a
 * field's clothes, not a disabled TextInput — a text field that refuses the
 * keyboard is the most reliable way to make somebody think the form is broken.
 */
export function PickerField({
  label,
  value,
  placeholder,
  onPress,
  error,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  onPress: () => void;
  error?: string | null;
}) {
  const state: FieldState = error ? "error" : value ? "filled" : "empty";
  const c = fieldColors(state);
  const pad = c.width === postBorder.fieldActive ? 13 : 14;

  return (
    <View>
      <Tappable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${value ?? placeholder}`}
        style={{
          height: fieldSize.row,
          borderRadius: postRadius.field,
          backgroundColor: c.fill,
          borderWidth: c.width,
          borderColor: c.border,
          paddingHorizontal: pad,
          flexDirection: "row",
          alignItems: "center",
        }}
        pressedStyle={{ backgroundColor: postColor.line }}
      >
        <View style={{ flex: 1 }}>
          <Text style={[textStyle(postType.fieldLabel), { color: c.label }]}>
            {label.toUpperCase()}
          </Text>
          <Text
            style={[
              textStyle(value ? postType.fieldValue : postType.fieldPlaceholder),
              { color: value ? postColor.ink : postColor.inkDisabled, marginTop: 5 },
            ]}
            numberOfLines={1}
          >
            {value ?? placeholder}
          </Text>
        </View>
        <ChevronDown />
      </Tappable>
      {error ? (
        <Text
          style={[textStyle(postType.fieldError), { color: postColor.warmInk, marginTop: 8 }]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function ChevronDown() {
  return (
    <ChevronDownIcon
      size={postIcon.chevronDown.size}
      stroke={postIcon.chevronDown.stroke}
      color={postColor.inkMuted}
    />
  );
}

/**
 * The 132 text area on step 5.
 *
 * It grows to 220 and then scrolls internally rather than growing forever —
 * a step whose one field can push the chip group off the bottom of the screen
 * is a step that loses its optional half to a long answer.
 *
 * The keyboard rule is the opposite of every other field's: this one KEEPS its
 * full 132 with the IME up. The text area is the step.
 */
export function TextArea({
  value,
  placeholder,
  onChangeText,
  onBlur,
  maxLength,
  inputRef,
}: {
  value: string;
  placeholder: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  maxLength?: number;
  inputRef?: React.RefObject<TextInput | null>;
}) {
  const [focused, setFocused] = useState(false);
  const c = fieldColors(focused ? "focused" : value ? "filled" : "empty");
  const pad = focused ? 13 : 14;

  return (
    <View
      style={{
        minHeight: fieldSize.textAreaMin,
        maxHeight: fieldSize.textAreaMax,
        borderRadius: postRadius.textArea,
        backgroundColor: c.fill,
        borderWidth: c.width,
        borderColor: c.border,
        padding: pad,
      }}
    >
      {focused ? <FocusRing radius={postRadius.textArea} /> : null}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        multiline
        textAlignVertical="top"
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={postColor.inkDisabled}
        selectionColor={postColor.forest}
        cursorColor={postColor.forest}
        style={[
          textStyle(postType.fieldValueMulti),
          { color: postColor.ink, flex: 1, padding: 0 },
        ]}
      />
    </View>
  );
}

/**
 * The helper-and-counter row under a field.
 *
 * Baseline-aligned, which with two different families at two different sizes
 * means `alignItems: "flex-end"` on the row and no line height on either — the
 * mono counter's box is 11 tall and the helper's first line is 17.4, and
 * bottom-aligning them is what puts the two baselines on one line.
 */
export function HelperCounterRow({
  helper,
  counter,
  helperColor = postColor.inkMuted,
}: {
  helper: string;
  counter?: string;
  helperColor?: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
      <Text style={[textStyle(postType.helper), { color: helperColor, flex: 1 }]}>
        {helper}
      </Text>
      {counter ? (
        <Text style={[textStyle(postType.counter), { color: postColor.inkMuted }]}>
          {counter}
        </Text>
      ) : null}
    </View>
  );
}

/** An info-circle helper: a 15 mark and the copy beside it, top-aligned. */
export function HelperRow({
  children,
  gap = 9,
  icon,
}: {
  children: string;
  gap?: number;
  icon?: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", gap }}>
      <View style={{ paddingTop: 1.5 }}>
        {icon ?? (
          <InfoIcon
            size={postIcon.info.size}
            stroke={postIcon.info.stroke}
            color={postColor.inkMuted}
          />
        )}
      </View>
      <Text style={[textStyle(postType.helperLong), { color: postColor.inkMuted, flex: 1 }]}>
        {children}
      </Text>
    </View>
  );
}

/* ────────────────────────── chips and tags ──────────────────────────── */

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={{
        height: postSize.chip.height,
        borderRadius: postRadius.chip,
        paddingHorizontal: postSize.chip.x,
        backgroundColor: selected ? postColor.greenWash : postColor.surface,
        borderWidth: postBorder.field,
        borderColor: selected ? postColor.greenLine : postColor.line,
        flexDirection: "row",
        alignItems: "center",
        gap: postSize.chip.checkGap,
      }}
      pressedStyle={{ backgroundColor: selected ? postColor.greenLine : postColor.inset }}
    >
      {selected ? (
        <CheckIcon
          size={postSize.chip.check}
          stroke={postIcon.check.stroke}
          color={postColor.forest}
        />
      ) : null}
      <Text
        style={[
          textStyle(selected ? postType.chipSelected : postType.chip),
          { color: selected ? postColor.forest : postColor.ink },
        ]}
      >
        {label}
      </Text>
    </Tappable>
  );
}

/** A review tag. Not tappable — it is a statement, and Edit is beside it. */
export function Tag({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "green" }) {
  const green = tone === "green";
  return (
    <View
      style={{
        paddingHorizontal: postSize.chip.tagX,
        paddingVertical: postSize.chip.tagY,
        borderRadius: postRadius.tag,
        backgroundColor: green ? postColor.greenWash : "transparent",
        borderWidth: postBorder.field,
        borderColor: green ? postColor.greenLine : postColor.line,
      }}
    >
      <Text
        style={[
          textStyle(green ? postType.chipSelected : postType.tag),
          { color: green ? postColor.forest : postColor.inkSecondary },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/** The Leaves pill on the review step. Tint fill, tint border, forest ink. */
export function LeavesChip({ leaves }: { leaves: number }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
      }}
    >
      <LeafIcon
        size={postIcon.leafReview.size}
        stroke={postIcon.leafReview.stroke}
        color={postColor.forest}
      />
      <Text style={[textStyle(postType.leavesReview), { color: postColor.forest }]}>
        {leaves.toLocaleString("en-US")}
      </Text>
      <Text style={[textStyle(postType.provenance), { color: postColor.inkSecondary }]}>
        Leaves
      </Text>
    </View>
  );
}

/* ───────────────────────── notices and panels ───────────────────────── */

/**
 * The grey notice: rate limited, re-valuation used, duplicate self.
 *
 * ── CONTAINER, NOT HUE, CARRIES WARNING VERSUS BLOCK ────────────────────────
 *
 * This is the spec's own rule and it is the load-bearing one in the whole
 * flow. A note gets colour and no box; a block gets the box. This component is
 * the box — grey, with an icon and a heading — and nothing warm goes in it.
 * The warm-accent states (`warned`, failed upload) deliberately have NO
 * container, and a detection failure gets neither, because it is not a failure
 * the user did anything to cause.
 */
export function NoticePanel({
  icon,
  heading,
  body,
  children,
  tone = "grey",
}: {
  icon?: React.ReactNode;
  heading?: string;
  body?: string;
  children?: React.ReactNode;
  tone?: "grey" | "fail";
}) {
  const fail = tone === "fail";
  return (
    <View
      style={{
        backgroundColor: fail ? postColor.failPanel : postColor.inset,
        borderRadius: postRadius.noticePanel,
        borderWidth: fail ? postBorder.field : 0,
        borderColor: postColor.warmLine,
        paddingVertical: 14,
        paddingHorizontal: 16,
      }}
    >
      <View style={{ flexDirection: "row", gap: 10 }}>
        {icon ? <View style={{ paddingTop: 1 }}>{icon}</View> : null}
        <View style={{ flex: 1 }}>
          {heading ? (
            <Text
              style={[
                textStyle(postType.noticeHeading),
                { color: fail ? postColor.warmInk : postColor.ink },
              ]}
            >
              {heading}
            </Text>
          ) : null}
          {body ? (
            <Text
              style={[
                textStyle(postType.noticeBody),
                { color: postColor.inkSecondary, marginTop: heading ? 6 : 0 },
              ]}
            >
              {body}
            </Text>
          ) : null}
          {children}
        </View>
      </View>
    </View>
  );
}

/**
 * A warm note with NO container: a warned duplicate, a failed upload.
 *
 * The rule above it is drawn by the caller, because its thickness says which
 * of the two states this is — 2 for a warning, 3 for a block — and putting that
 * inside the component would hide the one difference that matters.
 */
export function WarmNotice({
  icon,
  heading,
  body,
}: {
  icon: React.ReactNode;
  heading: string;
  body: string;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ paddingTop: 1 }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[textStyle(postType.noticeHeading), { color: postColor.warmInk }]}>
          {heading}
        </Text>
        <Text
          style={[
            textStyle(postType.noticeBody),
            { color: postColor.inkSecondary, marginTop: 6 },
          ]}
        >
          {body}
        </Text>
      </View>
    </View>
  );
}

/* ────────────────────────── structural bits ─────────────────────────── */

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height: 1, backgroundColor: postColor.divider }, style]} />
  );
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={[textStyle(postType.sectionLabel), { color: postColor.inkMuted }]}>
      {children}
    </Text>
  );
}

/** A determinate bar. 3 tall over a photo, 2 tall for the duplicate check. */
export function ProgressBar({
  fraction,
  height,
  track,
  fill,
}: {
  fraction: number;
  height: number;
  track: string;
  fill: string;
}) {
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <View style={{ height, backgroundColor: track, overflow: "hidden" }}>
      <View
        style={{
          height,
          backgroundColor: fill,
          width: `${clamped * 100}%`,
        }}
      />
    </View>
  );
}

/* ──────────────────────────── the shimmer ───────────────────────────── */

/**
 * ONE DRIVER FOR EVERY SKELETON BLOCK, NO STAGGER.
 *
 * The spec is explicit about it, and the reason is that a staggered shimmer
 * reads as several things loading at different speeds — which on step 2 would
 * imply the eyebrows arrive after the result. They arrive together, from one
 * response, and the skeleton says so by pulsing in phase.
 *
 * A module-level value rather than a context: it is one loop for the whole app
 * and every consumer wants the same phase, so a provider would be ceremony
 * around a singleton. The loop starts on the first mount and is never stopped —
 * it drives nothing while no skeleton is mounted, and tearing it down and
 * restarting it would reset the phase and cause exactly the stagger this note
 * is about.
 */
const shimmer = new Animated.Value(postMotion.shimmerFrom);
let shimmerStarted = false;

function startShimmer() {
  if (shimmerStarted) return;
  shimmerStarted = true;
  Animated.loop(
    Animated.sequence([
      Animated.timing(shimmer, {
        toValue: postMotion.shimmerTo,
        duration: postMotion.shimmerMs / 2,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(shimmer, {
        toValue: postMotion.shimmerFrom,
        duration: postMotion.shimmerMs / 2,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]),
  ).start();
}

export function Skeleton({
  width,
  height,
  radius = postRadius.skeleton,
  tone = "primary",
  style,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  /** `primary` for a result line or a button; `soft` for eyebrows and metadata. */
  tone?: "primary" | "soft";
  style?: StyleProp<ViewStyle>;
}) {
  useEffect(startShimmer, []);
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: tone === "soft" ? postColor.skeletonSoft : postColor.skeleton,
          opacity: shimmer,
        },
        style,
      ]}
    />
  );
}

/* ────────────────────────── the rate-limit clock ────────────────────── */

/**
 * `Try again in 2:14`, counting down.
 *
 * Driven by a 1 s interval rather than by an animation, because the value is
 * text and the only thing that changes is which second it says. It stops itself
 * at zero and calls `onDone`, which is what re-enables the control — the spec's
 * rule is that the action that triggered the limit is disabled for the
 * DURATION and everything else on the step stays usable.
 */
export function useCountdown(until: number | null, onDone?: () => void): number {
  const [left, setLeft] = useState(() =>
    until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0,
  );
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!until) {
      setLeft(0);
      return;
    }
    const tickOnce = () => {
      const seconds = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setLeft(seconds);
      if (seconds === 0) doneRef.current?.();
      return seconds;
    };
    if (tickOnce() === 0) return;
    const id = setInterval(() => {
      if (tickOnce() === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [until]);

  return left;
}

/** `134` → `2:14`. Tabular by family — JetBrains Mono is monospaced throughout. */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * The rate-limit panel: a clock, a heading, a body, and a live countdown.
 *
 * ── ONE CONTROL IS DISABLED, NOT THE STEP ───────────────────────────────────
 *
 * The spec's rule is that the action which tripped the limit waits and
 * everything else on the step stays usable. So this is a panel and not a
 * blocking state: the title field goes on accepting text while detection is
 * rate limited, and more photos can be added while the duplicate check is.
 *
 * It appears in three places — detection retries, duplicate re-checks and
 * posting — with the same shape and different bodies, which is why it is here
 * rather than in whichever step happened to need it first.
 */
export function RateLimitPanel({ seconds, body }: { seconds: number; body: string }) {
  return (
    <NoticePanel
      icon={
        <ClockIcon
          size={postIcon.clock.size}
          stroke={postIcon.clock.stroke}
          color={postColor.inkSecondary}
        />
      }
      heading="Give it a moment"
      body={body}
    >
      <Text style={[textStyle(postType.refCode), { color: postColor.ink, marginTop: 10 }]}>
        {`Try again in ${formatCountdown(seconds)}`}
      </Text>
    </NoticePanel>
  );
}
