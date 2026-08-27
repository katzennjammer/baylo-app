import { forwardRef } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LoginBackground } from "./LoginBackground";
import { auth } from "../theme/palette";

/**
 * The pieces both auth screens are built from.
 *
 * Login and register are separate routes — a toggle on one screen makes the
 * back button ambiguous and the "which am I doing" question permanent — but
 * they are the same surface, and the constraints below are the ones that are
 * easy to satisfy on a designer's 390pt canvas and easy to break on a real
 * phone. They are enforced here, once, rather than per screen:
 *
 *   44px MINIMUM TAP TARGET. Every Pressable in this file is at least h-12
 *   (48px). The two that look small — the gear and the show/hide toggle — carry
 *   hitSlop that takes them past 44 without making them visually heavy.
 *
 *   THE KEYBOARD MUST NOT COVER THE PASSWORD FIELD. See AuthScreen below; the
 *   arrangement there is specific and the reason is in its note.
 *
 *   360px WIDE. Padding is px-5 (20px) rather than the px-7 this started with,
 *   so the card's usable width on a 360px screen is 320px — enough for
 *   "Continue with Google" on one line at 15px, which is the widest string
 *   either screen contains.
 */

// ── The screen shell ─────────────────────────────────────────────────────────

/**
 * Background layer, safe area, keyboard avoidance, scroll.
 *
 * WHY THIS COMBINATION. `behavior="padding"` on Android fights the native
 * `adjustResize` the window already does and ends up double-counting the
 * keyboard, so the behavior is iOS-only — that part is conventional. What is
 * NOT conventional, and is the actual fix for "the keyboard covers the password
 * field", is the ScrollView underneath it:
 *
 *   - `flex-grow` + `justify-center` on the CONTENT CONTAINER centres the form
 *     while it fits and lets it SCROLL once it does not. Without flex-grow the
 *     centring collapses; without the ScrollView the overflow is unreachable,
 *     which is the actual failure mode being avoided — a password field the
 *     keyboard covers and nothing can move.
 *   - Android resizes the window when the keyboard opens
 *     (`softwareKeyboardLayoutMode: "resize"`, set explicitly in app.json), and
 *     React Native then scrolls the focused input into the shrunken viewport.
 *     `automaticallyAdjustKeyboardInsets` is the iOS half of the same job.
 *     Together they are what make the field reachable; the KeyboardAvoidingView
 *     above only handles the iOS padding.
 *   - `keyboardShouldPersistTaps="handled"` means the first tap on the submit
 *     button submits, instead of being eaten dismissing the keyboard. That is
 *     the difference between one tap and two on the most important control on
 *     the screen.
 *
 * The background is OUTSIDE the SafeAreaView on purpose: the gradient (and
 * later the video) runs edge to edge under the status bar, while the content
 * respects the inset.
 */
export function AuthScreen({ children }: { children: React.ReactNode }) {
  return (
    <LoginBackground>
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            // All of it as classes, and none of it as `contentContainerStyle`.
            // NativeWind compiles `contentContainerClassName` INTO that prop,
            // so passing both puts two writers on one style object and the
            // loser is decided by version.
            contentContainerClassName="flex-grow justify-center px-5 py-8 pb-6"
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LoginBackground>
  );
}

/**
 * The eyebrow and wordmark, on their own scrim.
 *
 * This is the only text on the screen that sits directly on the background
 * rather than on the card, so it is the only text whose contrast depends on
 * what the background is doing. The scrim behind it is that dependency being
 * removed in advance: white on `auth-scrim` is a fixed ratio whether the layer
 * underneath is today's gradient or tomorrow's brightest video frame.
 */
export function AuthHeader({ tagline }: { tagline: string }) {
  return (
    <View className="mb-6 self-start rounded-2xl bg-auth-scrim px-4 py-3">
      <Text className="text-on-green text-[11px] font-semibold tracking-[3px]">
        BARTER, NOT BUY
      </Text>
      <Text className="text-on-green text-[44px] font-bold tracking-tight mt-1">Baylo</Text>
      <Text className="text-on-green-muted text-[15px] leading-5 mt-1">{tagline}</Text>
    </View>
  );
}

/** The translucent white card the form sits on. */
export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <View className="rounded-3xl border border-auth-card-line bg-auth-card px-5 py-6">
      {children}
    </View>
  );
}

// ── Fields ───────────────────────────────────────────────────────────────────

export interface FieldProps extends TextInputProps {
  label: string;
  /**
   * The message for THIS field, shown under it.
   *
   * Field-level rather than banner-level because a banner cannot say which of
   * four inputs is wrong, and on a register form with two password boxes that
   * is the whole question. The banner is still there for everything that is not
   * about one field — a 409, a network failure, a rate limit.
   */
  error?: string | null;
}

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, error, ...input },
  ref,
) {
  return (
    <View>
      <Text className="text-ink-muted text-[11px] font-semibold uppercase tracking-widest mb-1.5">
        {label}
      </Text>
      <TextInput
        ref={ref}
        {...input}
        placeholderTextColor={auth["ink-muted"]}
        // h-12 is 48px — above the 44px floor with room for the border.
        className={`h-12 rounded-xl border bg-auth-field px-4 text-ink text-base ${
          error ? "border-danger-line" : "border-auth-field-line"
        }`}
      />
      {error ? <Text className="text-danger-ink text-xs mt-1.5 leading-4">{error}</Text> : null}
    </View>
  );
});

/**
 * A password field with a show/hide toggle.
 *
 * The toggle is not decoration. Typing a password blind on a phone keyboard is
 * where "wrong password" mostly comes from, and on the register screen — where
 * the same string has to be typed twice — being able to see it is the
 * difference between one attempt and several. The eye is a text button rather
 * than an icon because it needs to read at a glance in a Play Store screenshot.
 */
export const PasswordField = forwardRef<
  TextInput,
  FieldProps & { visible: boolean; onToggleVisible: () => void }
>(function PasswordField({ visible, onToggleVisible, ...props }, ref) {
  return (
    <View>
      <Field
        ref={ref}
        {...props}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        onPress={onToggleVisible}
        // The control is visually small; hitSlop is what makes the TARGET big.
        // 12 on each side of a ~24px label clears 44px in both directions.
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        // Pinned to the field's own row, not the label above it or the error
        // below it, so it stays put when either appears.
        className="absolute right-3 top-[20px] h-12 justify-center px-1"
      >
        <Text className="text-ink-muted text-xs font-semibold uppercase tracking-wider">
          {visible ? "Hide" : "Show"}
        </Text>
      </Pressable>
    </View>
  );
});

// ── Buttons ──────────────────────────────────────────────────────────────────

/** The one filled, green, primary action. There is never more than one. */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const active = !disabled && !busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={!active}
      accessibilityRole="button"
      accessibilityState={{ disabled: !active, busy: !!busy }}
      className={`h-[52px] flex-row items-center justify-center rounded-full ${
        active ? "bg-accent active:bg-accent-2" : "bg-accent/40"
      }`}
    >
      {busy ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <Text className="text-white text-[15px] font-bold tracking-wider uppercase">{label}</Text>
      )}
    </Pressable>
  );
}

/** Outlined. Used for Google, and for the secondary actions on the sent state. */
export function SecondaryButton({
  label,
  onPress,
  disabled,
  busy,
  leading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  leading?: React.ReactNode;
}) {
  const active = !disabled && !busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={!active}
      accessibilityRole="button"
      accessibilityState={{ disabled: !active, busy: !!busy }}
      className={`h-[52px] flex-row items-center justify-center gap-2.5 rounded-full border bg-white ${
        active ? "border-auth-field-line active:bg-auth-field" : "border-auth-card-line opacity-50"
      }`}
    >
      {busy ? (
        <ActivityIndicator color={auth.ink} />
      ) : (
        <>
          {leading}
          <Text className="text-ink text-[15px] font-semibold">{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/**
 * Google's G, drawn rather than shipped as an asset.
 *
 * Four coloured wedges is enough to read as the Google mark at 18px, and it
 * avoids adding a binary to the repo for something this small. If this ever
 * needs to be exact — Google's brand guidelines are specific about the mark —
 * swap in the official SVG asset; nothing else changes.
 */
export function GoogleMark() {
  return (
    <View className="h-[18px] w-[18px] items-center justify-center rounded-full bg-white">
      <Text className="text-[15px] font-bold leading-[18px] text-[#4285F4]">G</Text>
    </View>
  );
}

// ── Banners ──────────────────────────────────────────────────────────────────

/**
 * The error banner, kept from the original screen and deliberately not buried.
 *
 * It carries the server's message verbatim, and on this backend that message is
 * often the ONLY explanation the user gets — a 403 from /api/auth/token is the
 * one place an account is told it is suspended. Truncating it, collapsing it
 * behind a chevron, or replacing it with "Something went wrong" would throw
 * that away. It is placed directly above the submit button, where the eye
 * already is after a failed tap.
 */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <View
      accessibilityRole="alert"
      className="rounded-xl border border-danger-line bg-danger-wash px-4 py-3"
    >
      <Text className="text-danger-ink text-[13px] leading-5">{message}</Text>
    </View>
  );
}

export function NoticeBanner({ message }: { message: string }) {
  return (
    <View className="rounded-xl bg-ok-wash px-4 py-3">
      <Text className="text-ok-ink text-[13px] leading-5">{message}</Text>
    </View>
  );
}

/** "or" with a rule either side. */
export function Divider({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-px flex-1 bg-auth-card-line" />
      <Text className="text-ink-muted text-[11px] font-semibold uppercase tracking-widest">
        {label}
      </Text>
      <View className="h-px flex-1 bg-auth-card-line" />
    </View>
  );
}
