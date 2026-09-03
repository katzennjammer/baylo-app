import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoginBackground } from "./LoginBackground";
import { Tappable } from "./Tappable";
import {
  AlertIcon,
  BackIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  EnvelopeIcon,
  InfoIcon,
} from "./auth-sheet-icons";
import {
  authBoard,
  authIcon,
  authRadius,
  authSize,
  authText,
  authType,
  bandHeight,
  gap,
  keyboardRule,
  scrim as scrimStops,
  sheetColor,
  type AuthBoard,
  type ScrimName,
} from "../theme/auth-sheet-tokens";
import {
  MONTH_NAMES,
  clampDay,
  daysInMonth,
  defaultDobParts,
  formatLongDate,
  selectableYears,
  todayParts,
  type DateParts,
} from "../lib/dob";
import {
  NativeDateSpinner,
  dateBounds,
  dateToParts,
  nativeDatePickerAvailable,
  openAndroidDatePicker,
  partsToDate,
} from "./native-date-dialog";

/**
 * The auth kit: a sheet over a video band.
 *
 * ── THE FOUR RULES THIS FILE ENFORCES ───────────────────────────────────────
 *
 *   THE FIELD IS 56, ALWAYS. Empty, focused, filled, error, picker, on either
 *   board, with or without a keyboard. Only fill, border and label colour move
 *   between states, and the horizontal padding drops 14 → 13 exactly when the
 *   border grows 1 → 1.5, so the text baseline does not shift when a field is
 *   tapped. That single relationship is why the whole stack is stable.
 *
 *   THE SHEET IS THE PAGE. It is opaque, it starts 28px up over the band, and
 *   everything the user reads or touches is inside it on the sheet's own light
 *   surface. The band is footage and four pieces of chrome, nothing else.
 *
 *   THE 56 / 9 / 52 RHYTHM SURVIVES THE KEYBOARD. When the IME opens the band
 *   goes, the subhead goes, the legal copy and the footer go, the headline
 *   drops 23 → 19 — and the field height, the gap between fields and the button
 *   height are untouched. That is the entire point of those three numbers.
 *
 *   `Tappable`, NEVER `style={({ pressed }) => …}`. Under NativeWind a function
 *   `style` on a Pressable is silently replaced with `{}` — not the pressed
 *   half, ALL of it. The full chain is written out in `Tappable.tsx`. Every
 *   pressable in this file goes through it.
 */

/* ─────────────────────────── board context ──────────────────────────── */

interface AuthMetrics {
  board: AuthBoard;
  width: number;
  keyboardUp: boolean;
  /** What the IME covers of the content host, after any window resize. */
  keyboardInset: number;
  /** The IME's gross height. Section 6's "> 380" rule reads this one. */
  imeHeight: number;
  safeTop: number;
  safeBottom: number;
}

const Ctx = createContext<AuthMetrics | null>(null);

function useMetrics(): AuthMetrics {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("auth-sheet: component used outside <AuthScreen>");
  return ctx;
}

/** Margins, paddings and the two type sizes that move at 360. */
export function useAuthBoard(): AuthBoard {
  return useMetrics().board;
}

/** True while the IME is up. Screens read this to pick their 4c layout. */
export function useAuthKeyboardUp(): boolean {
  return useMetrics().keyboardUp;
}

/**
 * Keyboard tracking.
 *
 * ── WHY NOT `KeyboardAvoidingView`, WHICH IS THE OBVIOUS ANSWER ─────────────
 *
 * `android/gradle.properties` sets `edgeToEdgeEnabled=true`, and from API 35
 * `SOFT_INPUT_ADJUST_RESIZE` is a NO-OP for an edge-to-edge window: the window
 * stays the full screen and the IME arrives as an inset the app is expected to
 * apply itself. KeyboardAvoidingView's `_relativeKeyboardHeight` is
 * `frame.y + frame.height − endCoordinates.screenY`, and React Native fills
 * `screenY` from `getWindowVisibleDisplayFrame()` — the frame that no longer
 * shrinks. It computes ~0 and pads by nothing.
 *
 * What survives that change is `endCoordinates.height`, because React Native
 * takes THAT from `WindowInsetsCompat.Type.ime()`, which is inset-based and
 * still correct. So the height is the number to build on:
 *
 *   RN's `height` = imeInsets.bottom − systemBarInsets.bottom
 *   the IME's real overlap of a full-screen window = height + insets.bottom
 *
 * ── AND IT STILL WORKS IF THE WINDOW DOES RESIZE ────────────────────────────
 *
 * On a build where the window really does resize, the layout gives that space
 * back a second time and the two would double up. Rather than branching on a
 * platform or an API level — either of which is a guess about a device this has
 * not been run on — the shell subtracts what it actually got. `restHeight` is
 * the host's height with no keyboard up, so anything the host has lost since
 * then is space the IME is no longer covering. Both arrangements land on the
 * same number without being told which they are.
 */
function useKeyboardOverlap(safeBottom: number) {
  const [raw, setRaw] = useState({ height: 0, up: false });

  useEffect(() => {
    const ios = Platform.OS === "ios";
    // `will*` on iOS so the sheet moves WITH the keyboard rather than after it;
    // `did*` on Android, where the `will*` events do not fire at all.
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (e) =>
      setRaw({ height: e.endCoordinates.height, up: true }),
    );
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () =>
      setRaw({ height: 0, up: false }),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // On iOS the reported height already spans to the bottom of the window. On
  // Android it stops at the top of the navigation bar, which the IME draws over.
  const gross = raw.up ? raw.height + (Platform.OS === "ios" ? 0 : safeBottom) : 0;
  return { grossOverlap: gross, keyboardUp: raw.up };
}

/**
 * Keyboard state WITHOUT the shell's context.
 *
 * A screen has to choose its layout — which headline, whether the primary
 * button is in the flow or pinned, what the sheet's padding-top is — BEFORE it
 * can render an `<AuthScreen>`, because those are its props. `useAuthKeyboardUp`
 * cannot help there: it reads a context the shell provides, so calling it one
 * render above the provider throws.
 *
 * The cost is a second set of `Keyboard` listeners on those screens. They are
 * two closures over a native event that fires twice per keyboard, which is the
 * cheapest of the available answers — the others are a render prop that inverts
 * every screen in the file, or hoisting the whole layout decision into the
 * shell, which would mean the shell knowing what a create-account form is.
 */
export function useKeyboardState() {
  const insets = useSafeAreaInsets();
  const { grossOverlap, keyboardUp } = useKeyboardOverlap(insets.bottom);
  return {
    keyboardUp,
    imeHeight: grossOverlap,
    /**
     * Section 6's escape hatch: past a 380px IME the sheet keeps its
     * (844 − IME) height, the field stack becomes the scrolling region and the
     * primary button pins to the sheet's bottom edge. The FIELDS DO NOT SHRINK
     * — that is the spec's own instruction, and it is what keeps the 56/9/52
     * rhythm identical in every state.
     */
    tallIme: keyboardUp && grossOverlap > keyboardRule.tallImeThreshold,
  };
}

/* ─────────────────────────────── the shell ──────────────────────────── */

export interface AuthScreenProps {
  /** Which of the five scrims goes over the footage. */
  scrim: ScrimName;
  /** The band's DECLARED height at rest — one of `bandHeight`'s five values. */
  band: number;
  /** Wordmark row, pill, Google card, dev chip. Hidden while the IME is up. */
  bandContent?: React.ReactNode;
  /** The sheet's scrolling content. */
  children: React.ReactNode;
  /**
   * Welded to the sheet's bottom edge, outside the scroller.
   *
   * Section 6's tall-IME arrangement, and nothing else uses it. Being outside
   * the scroller is what matters: the first tap on a pinned primary button
   * submits, rather than being eaten dismissing the keyboard.
   */
  pinned?: React.ReactNode;
  /** Sheet padding-top. 24 at rest, 26 on sign in and with the IME up. */
  padTop?: number;
}

/**
 * Background layer, band, sheet, and the keyboard arithmetic.
 *
 * ── THE BAND LAYER NEVER MOVES; THE SHEET SLIDES OVER IT ────────────────────
 *
 * When the IME opens, the spec collapses the band to zero and squares the
 * sheet's corners. The obvious implementation animates the band's own height,
 * and it flickers: for the 220ms of the restore the band is shorter than the
 * gradient drawn behind it, so the frame colour shows through under the sliding
 * sheet.
 *
 * So the band's PAINT is static at its rest height and only the sheet's
 * `marginTop` animates — from `band − 28` down to 0, which covers the band
 * completely. The band's CONTENT cross-fades on opacity over the same curve.
 * Nothing behind the sheet ever changes size, so there is nothing to tear.
 */
export function AuthScreen({
  scrim,
  band,
  bandContent,
  children,
  pinned,
  padTop = keyboardRule.sheetPadTopRest,
}: AuthScreenProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // The host's BORDER-BOX height — what the window handed this screen, before
  // any margin of ours. It has to be the border box: a flex:1 box keeps its
  // border-box height whatever its padding, so this number moves if and only if
  // the WINDOW moved, which is exactly what `givenBack` is asking.
  const [hostHeight, setHostHeight] = useState(0);
  const restHeight = useRef(0);

  const { grossOverlap, keyboardUp } = useKeyboardOverlap(insets.bottom);

  // Only ever written while the IME is down, so a resize cannot poison its own
  // baseline — and the value is a pure function of committed state, so writing
  // it in render is stable under a double-invoked one.
  if (!keyboardUp && hostHeight > 0) restHeight.current = hostHeight;

  const givenBack =
    keyboardUp && restHeight.current > 0 ? Math.max(0, restHeight.current - hostHeight) : 0;
  const keyboardInset = Math.max(0, grossOverlap - givenBack);

  const board = authBoard(width);
  const restTop = Math.max(0, band - authSize.overlap);

  // 0 at rest, 1 with the IME up. One value drives the sheet's top, the sheet's
  // corners and the band content's opacity, so the three cannot disagree.
  const collapse = useRef(new Animated.Value(keyboardUp ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(collapse, {
      toValue: keyboardUp ? 1 : 0,
      // The spec animates the RESTORE — "sheet top 0 → 172 over 220ms
      // ease-out" — and says nothing about the open. Opening instantly is the
      // safer of the two: it is the direction in which a slow sheet leaves the
      // focused field underneath a keyboard that has already arrived.
      duration: keyboardUp ? 0 : keyboardRule.restoreMs,
      easing: Easing.out(Easing.ease),
      // Layout properties. There is no native-driver path for marginTop or a
      // border radius, and pretending otherwise silently disables the animation.
      useNativeDriver: false,
    }).start();
  }, [keyboardUp, collapse]);

  const value = useMemo<AuthMetrics>(
    () => ({
      board,
      width,
      keyboardUp,
      keyboardInset,
      imeHeight: grossOverlap,
      safeTop: insets.top,
      // With the IME up the sheet sheds the gesture inset entirely — the
      // keyboard is already covering the area that inset exists to avoid.
      safeBottom: keyboardUp ? 0 : insets.bottom,
    }),
    [board, width, keyboardUp, keyboardInset, grossOverlap, insets.top, insets.bottom],
  );

  const sheetTop = collapse.interpolate({ inputRange: [0, 1], outputRange: [restTop, 0] });
  const sheetRadius = collapse.interpolate({
    inputRange: [0, 1],
    outputRange: [authRadius.sheet, 0],
  });

  return (
    <LoginBackground band={{ height: band, scrim: scrimStops[scrim] }}>
      <Ctx.Provider value={value}>
        {/*
          TWO VIEWS, AND THE SPLIT IS LOAD-BEARING.

          The outer one is never resized by anything of ours, so its onLayout
          answers exactly one question: did the WINDOW move? Measuring the inner
          box instead would see this screen's own keyboard offset, call it a
          window resize, and cancel it out — a loop that settles on half a
          keyboard.

          The inner one is the content host, and it sheds the IME's height with
          `marginBottom` rather than `paddingBottom`. Padding was the first
          attempt and it moved nothing: Yoga resolves a trailing offset on an
          absolutely positioned child against its parent's BORDER box, so
          `bottom: 0` stayed pinned to the bottom of the screen. A margin
          shrinks the box itself, which no reading of the absolute-position
          rules can disagree with.
        */}
        <View style={{ flex: 1 }} onLayout={(e) => setHostHeight(e.nativeEvent.layout.height)}>
          <View style={{ flex: 1, marginBottom: keyboardInset }}>
            {bandContent && band > 0 ? (
              <Animated.View
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  height: band,
                  opacity: collapse.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                }}
                pointerEvents={keyboardUp ? "none" : "auto"}
              >
                {bandContent}
              </Animated.View>
            ) : null}

            <Animated.View
              style={{
                flex: 1,
                marginTop: sheetTop,
                backgroundColor: sheetColor.surface,
                borderTopLeftRadius: sheetRadius,
                borderTopRightRadius: sheetRadius,
                // The band content is a sibling ABOVE this in paint order at
                // rest; with the IME up the sheet has to cover it.
                zIndex: 1,
              }}
            >
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                  flexGrow: 1,
                  paddingHorizontal: board.sheetX,
                  paddingTop: padTop,
                  // The spec's canvas ends the footer flush with 844 because a
                  // canvas has no gesture bar. A real one does.
                  paddingBottom: pinned ? 0 : value.safeBottom,
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                // No rubber-banding: the sheet is welded to the band above it
                // and to the screen edge below, and a bounce visibly unwelds it.
                bounces={false}
                overScrollMode="never"
              >
                {children}
              </ScrollView>

              {pinned ? (
                <View
                  style={{
                    paddingHorizontal: board.sheetX,
                    paddingTop: keyboardRule.pinnedButtonY,
                    paddingBottom: keyboardRule.pinnedButtonY + value.safeBottom,
                  }}
                >
                  {pinned}
                </View>
              ) : null}
            </Animated.View>
          </View>
        </View>
      </Ctx.Provider>
    </LoginBackground>
  );
}

/* ──────────────────────────── the video band ────────────────────────── */

/**
 * The band's 44px content row: back button, wordmark, and whatever trails.
 *
 * `leading` shrinks the row's horizontal padding from 16 to 12 (12 → 8 on the
 * tight board) so that a 44px back button's GLYPH lands on the same vertical
 * edge the wordmark would have started on. That is the spec's own rule, and it
 * is why the padding is a function of what is in the row rather than a constant.
 */
export function BandRow({
  leading,
  trailing,
  children,
}: {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { board, safeTop } = useMetrics();
  const padding = leading ? board.bandXWithBack : board.bandX;

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        // The spec's 44 clears a standard status bar. A taller one (a display
        // cutout, an island) would overlap it, so the spec value is a floor
        // rather than a constant.
        top: Math.max(authSize.bandTop, safeTop),
        height: authSize.bandRow,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: padding,
      }}
    >
      {leading}
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>{children}</View>
      {trailing}
    </View>
  );
}

/** "Baylo", over the footage. 24 on sign in, 20 everywhere else. */
export function Wordmark({ large = false }: { large?: boolean }) {
  const { board } = useMetrics();
  const role = large
    ? board.tight
      ? authType.wordmarkSignInTight
      : authType.wordmarkSignIn
    : board.tight
      ? authType.wordmarkTight
      : authType.wordmark;

  return (
    <Text
      style={[authText(role), { color: sheetColor.onVideo }]}
      // A wordmark is a mark. It does not grow with the system font scale,
      // because at 1.6 it would take the whole row and push the pill off it.
      allowFontScaling={false}
    >
      Baylo
    </Text>
  );
}

/** The location pill beside the wordmark on sign in. */
export function CebuPill({ label = "Cebu" }: { label?: string }) {
  return (
    <View
      style={{
        height: 32,
        justifyContent: "center",
        paddingHorizontal: 12,
        borderRadius: authRadius.pill,
        backgroundColor: sheetColor.pillFill,
        marginLeft: 10,
      }}
    >
      <Text style={[authText(authType.pillLabel), { color: sheetColor.pillLabel }]}>{label}</Text>
    </View>
  );
}

/** A back arrow sized for the band row. 44 × 44, 40 × 44 on the tight board. */
export function BandBackButton({ onPress, label }: { onPress: () => void; label: string }) {
  const { board } = useMetrics();
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: board.backWidth,
        height: authSize.backButton,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <BackIcon color={sheetColor.onVideo} />
    </Tappable>
  );
}

/** "STEP 2 OF 2" — mono, over the footage. */
export function BandEyebrow({ children }: { children: React.ReactNode }) {
  const { board, safeTop } = useMetrics();
  return (
    <Text
      style={[
        authText(authType.eyebrow),
        {
          position: "absolute",
          left: board.bandXWithBack + board.backWidth,
          right: board.bandX,
          top: Math.max(authSize.bandTop, safeTop) + authSize.bandRow + 18,
          color: sheetColor.onVideoEyebrow,
        },
      ]}
    >
      {children}
    </Text>
  );
}

/**
 * The dev caption chip.
 *
 * The spec draws one over the placeholder footage and calls it a dev stand-in.
 * Rather than draw an empty chip, it carries the thing this app most often
 * needs to read off a screen without tapping anything: which server it is
 * pointing at. It renders in development builds only.
 */
export function DevChip({ children }: { children: React.ReactNode }) {
  const { board } = useMetrics();
  if (!__DEV__) return null;

  return (
    <View
      style={{
        position: "absolute",
        left: board.bandX,
        bottom: authSize.bandTop,
        maxWidth: "80%",
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: authRadius.devChip,
        backgroundColor: sheetColor.devChipFill,
      }}
      pointerEvents="none"
    >
      <Text
        style={[authText(authType.devChip), { color: sheetColor.onVideoMono }]}
        numberOfLines={1}
        // The interesting end of a URL is the RIGHT one — the port, and which
        // host it is. A truncated `http://192.168.1…` says nothing.
        ellipsizeMode="head"
      >
        {children}
      </Text>
    </View>
  );
}

/**
 * The Google confirmation card — "this is the account you chose".
 *
 * It sits over the footage rather than on the sheet, and that is the spec's
 * arrangement: the sheet below asks for one new fact, and the card above it is
 * the context for why. The email is one line with an ellipsis because a wrapped
 * address would push the card into the wordmark row.
 */
export function GoogleAccountCard({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email: string;
  avatarUrl?: string | null;
}) {
  const { board, safeTop } = useMetrics();

  return (
    <View
      style={{
        position: "absolute",
        left: board.bandX,
        right: board.bandX,
        top: Math.max(authSize.bandTop, safeTop) + authSize.bandRow + 46,
        flexDirection: "row",
        alignItems: "center",
        gap: gap.cardInternal,
        padding: board.cardPad,
        borderRadius: authRadius.card,
        backgroundColor: sheetColor.cardFill,
      }}
    >
      <Avatar name={name} url={avatarUrl} />

      <View style={{ flex: 1 }}>
        <Text style={[authText(authType.cardName), { color: sheetColor.onVideo }]} numberOfLines={1}>
          {name}
        </Text>
        <Text
          style={[authText(authType.cardEmail), { color: sheetColor.onVideoSecondary }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {email}
        </Text>
      </View>

      <CheckIcon size={authIcon.cardCheck.size} color={sheetColor.cardCheck} />
    </View>
  );
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  const box = {
    width: authSize.cardAvatar,
    height: authSize.cardAvatar,
    borderRadius: authRadius.avatar,
  } as const;

  if (url) {
    return <Image source={{ uri: url }} style={box} contentFit="cover" transition={160} />;
  }

  return (
    <View style={[box, { alignItems: "center", justifyContent: "center", backgroundColor: sheetColor.pillFill }]}>
      <Text style={[authText(authType.avatarInitials), { color: sheetColor.onVideo }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

/** Up to two letters. Falls back to a dot rather than to an empty circle. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ─────────────────────────── sheet type blocks ──────────────────────── */

export type HeadlineVariant =
  | "signIn"
  | "logIn"
  | "googleDob"
  | "rejected"
  | "createAccount"
  | "compact";

export function Headline({
  variant,
  children,
}: {
  variant: HeadlineVariant;
  children: React.ReactNode;
}) {
  const { board } = useMetrics();

  const role =
    variant === "signIn"
      ? board.tight
        ? authType.headlineSignInTight
        : authType.headlineSignIn
      : variant === "logIn"
        ? authType.headlineLogIn
        : variant === "googleDob"
          ? authType.headlineGoogleDob
          : variant === "rejected"
            ? authType.headlineRejected
            : variant === "compact"
              ? authType.headlineCompact
              : board.tight
                ? authType.headlineCreateTight
                : authType.headlineCreate;

  // No `numberOfLines`. The spec's note is explicit — headlines are authored to
  // fit and are never clamped — and a clamp is what turns a large system font
  // scale into an ellipsis instead of a second line.
  return <Text style={[authText(role), { color: sheetColor.ink }]}>{children}</Text>;
}

export function Body({ large = false, children }: { large?: boolean; children: React.ReactNode }) {
  return (
    <Text
      style={[
        authText(large ? authType.bodySignIn : authType.body),
        { color: sheetColor.body },
      ]}
    >
      {children}
    </Text>
  );
}

export function Subhead({ children }: { children: React.ReactNode }) {
  return (
    <Text style={[authText(authType.subhead), { color: sheetColor.body }]}>{children}</Text>
  );
}

export function LegalCopy({ children }: { children: React.ReactNode }) {
  return <Text style={[authText(authType.legal), { color: sheetColor.label }]}>{children}</Text>;
}

/**
 * The age declaration above the primary button.
 *
 * Two lines at rest, one centred line at 11/16.5 with the keyboard up — the
 * spec's 4c collapse. It is a statement, not a checkbox: the act of submitting
 * is the declaration, and a checkbox here would add a fifty-first thing to tap
 * on a screen that already has five fields and a picker.
 */
export function Declaration({
  compact = false,
  children,
}: {
  compact?: boolean;
  children: React.ReactNode;
}) {
  if (compact) {
    return (
      <Text
        style={[
          authText(authType.declarationCompact),
          { color: sheetColor.body, textAlign: "center" },
        ]}
      >
        {children}
      </Text>
    );
  }

  return (
    <View style={{ flexDirection: "row", gap: gap.declarationIconToText }}>
      <View style={{ paddingTop: 1.5 }}>
        <InfoIcon color={sheetColor.forest} />
      </View>
      <Text style={[authText(authType.declaration), { color: sheetColor.body, flex: 1 }]}>
        {children}
      </Text>
    </View>
  );
}

/* ────────────────────────────── the field ───────────────────────────── */

type FieldState = "empty" | "focused" | "filled" | "error";

/** Fill, border and label colour — the only three things a state changes. */
function fieldSkin(state: FieldState, board: AuthBoard) {
  const strong = state === "focused" || state === "error";
  return {
    backgroundColor: strong ? sheetColor.inputFillFocus : sheetColor.inputFill,
    borderWidth: strong ? authSize.inputBorderStrong : authSize.inputBorder,
    borderColor:
      state === "focused"
        ? sheetColor.green
        : state === "error"
          ? sheetColor.errorLine
          : sheetColor.inputLine,
    // 14 → 13 exactly as the border goes 1 → 1.5, so the total inset either
    // side is 15 in every state and the value does not step sideways when the
    // field is tapped. This pairing is the whole reason both numbers exist.
    paddingHorizontal: strong ? board.inputXStrong : board.inputX,
    labelColor:
      state === "focused"
        ? sheetColor.forest
        : state === "error"
          ? sheetColor.errorInk
          : sheetColor.label,
    labelRole: strong ? authType.inputLabelStrong : authType.inputLabel,
  };
}

/**
 * The 56px box every field shares: ring, fill, border, label, and a value row.
 *
 * VERTICAL RHYTHM. The spec puts a 10px label and a 15px value 3px apart inside
 * 56. Laying that out literally means a 15px-tall row holding a 15px font,
 * which on Android clips the descenders off g, y and p — an email address is
 * the worst possible place for that. The row is 19 instead and the stack is
 * centred, which puts the VALUE's centre line at 34.5px from the top of the
 * box: exactly where the spec's own 14 + 10 + 3 arithmetic puts it. The label
 * rides 2px higher than drawn, and that is the trade.
 */
function FieldBox({
  label,
  state,
  children,
  trailing,
  onPress,
  backdropPress,
  accessibility,
}: {
  label: string;
  state: FieldState;
  children: React.ReactNode;
  trailing?: React.ReactNode;
  /**
   * The WHOLE box is the button — a picker field, which has no caret and
   * nothing else in it that wants a touch.
   */
  onPress?: () => void;
  /**
   * A tap target BEHIND the contents — a text field, where the 56px box should
   * focus the input but the TextInput, the "Show" button and the label must
   * keep their own touch handling.
   *
   * The two are not interchangeable. Wrapping a text field's contents in a
   * Pressable nests the reveal button inside another pressable, and nested
   * touchables on Android resolve by whichever view claims the responder first
   * — which is not reliably the inner one. A sibling rendered underneath has no
   * such argument to lose: the Text nodes above it carry no handlers and let
   * the touch fall through, and the two real controls sit on top of it.
   */
  backdropPress?: () => void;
  accessibility?: { role: "button" | "none"; label?: string; hint?: string };
}) {
  const board = useAuthBoard();
  const skin = fieldSkin(state, board);

  const inner = (
    <>
      <Text style={[authText(skin.labelRole), { height: 10, color: skin.labelColor }]}>
        {label}
      </Text>
      <View
        style={{
          height: 19,
          marginTop: authSize.inputLabelToValue,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <View style={{ flex: 1 }}>{children}</View>
        {trailing}
      </View>
    </>
  );

  const boxStyle: ViewStyle = {
    height: authSize.input,
    justifyContent: "center",
    borderRadius: authRadius.input,
    backgroundColor: skin.backgroundColor,
    borderWidth: skin.borderWidth,
    borderColor: skin.borderColor,
    paddingHorizontal: skin.paddingHorizontal,
  };

  return (
    <View>
      {/*
        The focus ring: 3px of spread, painted BEHIND the field rather than as a
        border. React Native has no box-shadow spread that works on both
        platforms, and a third border would change the box's size and move the
        text. An inset-negative sibling changes nothing about layout.
      */}
      {state === "focused" ? (
        <View
          style={{
            position: "absolute",
            top: -authSize.focusRing,
            left: -authSize.focusRing,
            right: -authSize.focusRing,
            bottom: -authSize.focusRing,
            borderRadius: authRadius.input + authSize.focusRing,
            backgroundColor: sheetColor.focusRing,
          }}
          pointerEvents="none"
        />
      ) : null}

      {onPress ? (
        <Tappable
          onPress={onPress}
          accessibilityRole={accessibility?.role ?? "button"}
          accessibilityLabel={accessibility?.label}
          accessibilityHint={accessibility?.hint}
          style={boxStyle}
          // The spec draws no pressed state for a picker field, only the rule
          // that it never takes FOCUS styling. `pressedSurface` is the feed's
          // `color.inset` — one step off the sheet, and deliberately not the
          // focused fill.
          pressedStyle={{ backgroundColor: sheetColor.pressedSurface }}
        >
          {inner}
        </Tappable>
      ) : (
        <View style={boxStyle}>
          {/* FIRST child, so it renders underneath everything else in the box.
              See the note on `backdropPress`. */}
          {backdropPress ? (
            <Tappable
              onPress={backdropPress}
              accessibilityRole="none"
              style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
            />
          ) : null}
          {inner}
        </View>
      )}
    </View>
  );
}

/** The message under an errored field. 8 below it, icon at 15 / 1.9. */
export function FieldMessage({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: gap.errorIconToMessage,
        marginTop: gap.inputToMessage,
      }}
    >
      <View style={{ paddingTop: 1 }}>
        <AlertIcon color={sheetColor.errorInk} />
      </View>
      <Text style={[authText(authType.errorMessage), { color: sheetColor.errorInk, flex: 1 }]}>
        {children}
      </Text>
    </View>
  );
}

export interface FieldProps extends Omit<TextInputProps, "style" | "placeholder"> {
  label: string;
  /** Drives the error state and renders a message underneath. */
  error?: string | null;
  /** Password fields: the "Show" / "Hide" text button. */
  reveal?: { visible: boolean; onToggle: () => void };
  /** Confirm-password: an 18px check REPLACES "Show" once the two match. */
  matched?: boolean;
}

/**
 * A text field.
 *
 * NO PLACEHOLDER, and the prop is omitted from the type rather than merely left
 * unset — which is why `Omit<…, "placeholder">` above is not re-widened. The
 * label sits above the rule and never moves, so a hint underneath it can only
 * repeat it, and grey text in an empty box makes a field that has not been
 * filled in look as though it has. Worse, a hint is the one piece of help that
 * disappears at the exact moment it would be used: "At least 8 characters" is
 * gone by the second keystroke. That rule belongs in `error`, which appears
 * when it is broken and stays until it is not. `AuthField` in auth-thumbbar.tsx
 * has had the same shape since the spec first said so; passing a placeholder
 * here is now a type error in both, so it cannot quietly come back a third
 * time.
 *
 * `SelectRow` below is the deliberate exception. Its "placeholder" is not a
 * hint over an empty input — it is what the row DISPLAYS until a value is
 * picked, and a picker showing nothing at all is a blank rectangle.
 *
 * THE CARET IS THE NATIVE ONE, TINTED. The spec draws a 1.5 × 17 bar in #1B4D2B
 * blinking on a 1s step; that is exactly what `cursorColor` (Android) and
 * `selectionColor` (both) produce, and a drawn caret would have to blink on the
 * JS thread while fighting the real one for the same pixels.
 */
export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, error, reveal, matched, onFocus, onBlur, editable, secureTextEntry, value, ...input },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const inner = useRef<TextInput>(null);

  const state: FieldState = focused
    ? "focused"
    : error
      ? "error"
      : value
        ? "filled"
        : "empty";

  const masked = !!secureTextEntry;
  const valueRole = masked ? authType.inputValueMasked : authType.inputValue;

  return (
    <View>
      <FieldBox
        label={label}
        state={state}
        // A tap anywhere in the 56 focuses the input, not only the 19 the
        // TextInput actually occupies. BEHIND the contents, not around them.
        backdropPress={() => inner.current?.focus()}
        trailing={
          matched ? (
            <CheckIcon color={sheetColor.forest} />
          ) : reveal ? (
            <Tappable
              onPress={reveal.onToggle}
              accessibilityRole="button"
              accessibilityLabel={reveal.visible ? "Hide password" : "Show password"}
              // The control is 12px of text; the target is 44. hitSlop is what
              // gets the second number without a 44-tall box stretching the
              // 19px value row it sits in.
              hitSlop={{ top: 16, bottom: 16, left: 12, right: 12 }}
              style={{ marginLeft: 10 }}
            >
              <Text style={[authText(authType.textButtonSmall), { color: sheetColor.forest }]}>
                {reveal.visible ? "Hide" : "Show"}
              </Text>
            </Tappable>
          ) : undefined
        }
      >
        <TextInput
          ref={(node) => {
            inner.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          {...input}
          value={value}
          editable={editable}
          secureTextEntry={secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          selectionColor={sheetColor.forest}
          cursorColor={sheetColor.forest}
          style={[
            authText(valueRole),
            {
              color: editable === false ? sheetColor.placeholder : sheetColor.ink,
              height: 19,
              // Android gives TextInput its own padding and vertical centring
              // that CSS does not. Both have to go, or the value sits low in
              // the row and the label-to-value gap comes out wider than 3.
              padding: 0,
              textAlignVertical: "center",
            },
          ]}
        />
      </FieldBox>

      {error ? <FieldMessage>{error}</FieldMessage> : null}
    </View>
  );
});

/**
 * A field that opens a picker instead of a keyboard.
 *
 * It NEVER takes focus styling — no green border, no ring, no focused label —
 * because there is no caret in it and a focus ring around a control that cannot
 * receive text is a lie about what the next keystroke will do. It answers a
 * press with a fill change and opens its picker. That is the spec's rule, and
 * this is the only place it is implemented.
 */
export function PickerField({
  label,
  value,
  placeholder,
  icon = "chevron",
  error,
  disabled,
  onPress,
  style,
}: {
  label: string;
  value?: string | null;
  placeholder: string;
  icon?: "chevron" | "calendar";
  error?: string | null;
  disabled?: boolean;
  onPress: () => void;
  style?: ViewStyle;
}) {
  const state: FieldState = error ? "error" : value ? "filled" : "empty";

  return (
    <View style={style}>
      <FieldBox
        label={label}
        state={state}
        onPress={disabled ? undefined : onPress}
        accessibility={{
          role: "button",
          label: `${label}. ${value ?? placeholder}`,
          hint: "Opens a picker",
        }}
        trailing={
          icon === "calendar" ? (
            <CalendarIcon color={sheetColor.label} />
          ) : (
            <ChevronDownIcon color={sheetColor.label} />
          )
        }
      >
        <Text
          style={[
            authText(value ? authType.inputValue : authType.inputPlaceholder),
            { color: value ? sheetColor.ink : sheetColor.placeholder },
          ]}
          numberOfLines={1}
        >
          {value ?? placeholder}
        </Text>
      </FieldBox>

      {error ? <FieldMessage>{error}</FieldMessage> : null}
    </View>
  );
}

/* ───────────────────────────── the controls ─────────────────────────── */

export function PrimaryButton({
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
  /** The Google glyph, on the sign-in screen's primary. */
  leading?: React.ReactNode;
}) {
  const { board } = useMetrics();
  const active = !disabled && !busy;
  const ink = active ? sheetColor.onGreen : sheetColor.disabledInk;

  return (
    <Tappable
      onPress={onPress}
      disabled={!active}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !active, busy: !!busy }}
      style={{
        height: authSize.primaryButton,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: gap.googleGlyphToLabel,
        borderRadius: authRadius.primaryButton,
        // The spec has no disabled fill. `color.control` and `color.inkStale`
        // are lifted from its own disabled-INPUT row rather than invented.
        backgroundColor: active ? sheetColor.green : sheetColor.disabledFill,
      }}
      pressedStyle={{ backgroundColor: sheetColor.pressedGreen }}
    >
      {busy ? (
        <ActivityIndicator color={sheetColor.onGreen} />
      ) : (
        <>
          {leading}
          <Text
            style={[
              authText(board.tight ? authType.primaryLabelTight : authType.primaryLabel),
              { color: ink },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </>
      )}
    </Tappable>
  );
}

/**
 * The Google "G".
 *
 * NOT Google's mark. Their brand terms require the four-colour G on a "Continue
 * with Google" control, and this is the spec's own placeholder — a 20px ring
 * with an 11px letter in it — which holds the row's geometry until that asset
 * is dropped in. Swapping it changes nothing about the button.
 */
export function GoogleGlyph({ color = sheetColor.onGreen }: { color?: string }) {
  return (
    <View
      style={{
        width: authSize.googleGlyph,
        height: authSize.googleGlyph,
        borderRadius: authRadius.glyphRing,
        borderWidth: authSize.googleGlyphRing,
        borderColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={[authText(authType.googleGlyph), { color }]} allowFontScaling={false}>
        G
      </Text>
    </View>
  );
}

export function OutlineButton({
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
    <Tappable
      onPress={onPress}
      disabled={!active}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !active, busy: !!busy }}
      style={{
        height: authSize.outlineButton,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: gap.outlineIconToLabel,
        borderRadius: authRadius.outlineButton,
        borderWidth: authSize.outlineBorder,
        borderColor: sheetColor.outlineLine,
        backgroundColor: sheetColor.outlineFill,
        opacity: active ? 1 : 0.45,
      }}
      pressedStyle={{ backgroundColor: sheetColor.pressedSurface }}
    >
      {busy ? (
        <ActivityIndicator color={sheetColor.ink} />
      ) : (
        <>
          {leading}
          <Text style={[authText(authType.outlineLabel), { color: sheetColor.ink }]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Tappable>
  );
}

/** The envelope that leads "Continue with email". */
export function EnvelopeGlyph() {
  return <EnvelopeIcon color={sheetColor.ink} />;
}

/**
 * A text button. Three sizes, because the spec gives three:
 * 12 for "Show", 13 for "Forgot password?", 14 at footer level.
 */
export function TextButton({
  label,
  onPress,
  size = "medium",
  disabled,
  align = "left",
}: {
  label: string;
  onPress: () => void;
  size?: "small" | "medium" | "footer";
  disabled?: boolean;
  align?: "left" | "center" | "right";
}) {
  const role =
    size === "small"
      ? authType.textButtonSmall
      : size === "footer"
        ? authType.textButtonFooter
        : authType.textButton;

  const hit = size === "footer" ? authSize.footerTextButtonHit : authSize.textButtonHit;

  return (
    <Tappable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        height: hit,
        justifyContent: "center",
        alignItems:
          align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Text style={[authText(role), { color: sheetColor.forest }]}>{label}</Text>
    </Tappable>
  );
}

/** "Already have an account? Log in" — a prompt and a link on one row. */
export function FooterPrompt({
  prompt,
  label,
  onPress,
  disabled,
  tall = false,
}: {
  prompt: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tall?: boolean;
}) {
  return (
    <View
      style={{
        height: tall ? authSize.footerRowSignIn : authSize.footerRow,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        // The spec's footer is pushed to the bottom of the sheet by an auto
        // top margin rather than positioned — so a short screen closes the gap
        // instead of overlapping the block above it.
        marginTop: "auto",
      }}
    >
      <Text style={[authText(authType.footerPrompt), { color: sheetColor.body }]}>{prompt}</Text>
      <Tappable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="link"
        accessibilityLabel={label}
        style={{
          height: authSize.footerTextButtonHit,
          justifyContent: "center",
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <Text style={[authText(authType.textButtonFooter), { color: sheetColor.forest }]}>
          {label}
        </Text>
      </Tappable>
    </View>
  );
}

/** A hairline, a mono label, a hairline. */
export function OrDivider({ label = "or" }: { label?: string }) {
  return (
    <View
      style={{
        height: authSize.dividerLabelRow,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <View style={{ flex: 1, height: authSize.dividerRule, backgroundColor: sheetColor.dividerLine }} />
      <Text style={[authText(authType.dividerLabel), { color: sheetColor.label }]}>{label}</Text>
      <View style={{ flex: 1, height: authSize.dividerRule, backgroundColor: sheetColor.dividerLine }} />
    </View>
  );
}

/* ─────────────────────── the 4c compact header ──────────────────────── */

/**
 * What replaces the whole video band when the keyboard is up.
 *
 * Back button, title, and a counter. The counter is not decoration: with the
 * band gone and the subhead removed, it is the only thing left on the screen
 * that says how much of the form is behind and how much is ahead.
 */
export function CompactHeader({
  title,
  counter,
  onBack,
  backLabel,
}: {
  title: string;
  counter?: string;
  onBack: () => void;
  backLabel: string;
}) {
  return (
    <View
      style={{
        height: authSize.compactHeaderRow,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <Tappable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        style={{
          width: authSize.backButton,
          height: authSize.backCompactHeight,
          alignItems: "flex-start",
          justifyContent: "center",
        }}
        // The box is 32 tall to hold the row's height; the TARGET is still 44.
        hitSlop={{ top: 6, bottom: 6 }}
      >
        <BackIcon size={authIcon.backCompact.size} stroke={authIcon.backCompact.stroke} color={sheetColor.ink} />
      </Tappable>

      <View style={{ flex: 1 }}>
        <Headline variant="compact">{title}</Headline>
      </View>

      {counter ? (
        <Text style={[authText(authType.fieldCounter), { color: sheetColor.label }]}>
          {counter}
        </Text>
      ) : null}
    </View>
  );
}

/* ──────────────────────── the rejection screen ──────────────────────── */

/** The 72px circle at the top of the under-18 sheet. */
export function RejectionMark() {
  return (
    <View
      style={{
        width: authSize.rejectionCircle,
        height: authSize.rejectionCircle,
        borderRadius: authRadius.circle,
        borderWidth: authSize.panelBorder,
        borderColor: sheetColor.panelLine,
        backgroundColor: sheetColor.panelFill,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AlertIcon
        size={authIcon.rejectionAlert.size}
        stroke={authIcon.rejectionAlert.stroke}
        color={sheetColor.errorInk}
      />
    </View>
  );
}

export interface PanelRow {
  label: string;
  value: string;
}

/**
 * The panel that shows the arithmetic.
 *
 * It exists so the refusal is checkable rather than assertive: the date that
 * was entered, the date it was compared against, and the number that came out.
 * Somebody who mis-picked a year can see which one, which is the entire
 * difference between this screen and an error toast.
 */
export function RejectionPanel({ rows }: { rows: PanelRow[] }) {
  const { board } = useMetrics();
  const valueRole = board.tight ? authType.panelValueTight : authType.panelValue;

  return (
    <View
      style={{
        borderRadius: authRadius.panel,
        borderWidth: authSize.panelBorder,
        borderColor: sheetColor.panelLine,
        backgroundColor: sheetColor.panelFill,
        paddingHorizontal: board.panelX,
      }}
    >
      {rows.map((row, i) => (
        <View
          key={row.label}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: gap.panelRow,
            paddingVertical: board.panelY,
            borderTopWidth: i === 0 ? 0 : authSize.panelBorder,
            borderTopColor: sheetColor.panelLine,
          }}
        >
          <Text style={[authText(authType.panelLabel), { color: sheetColor.errorInk }]}>
            {row.label}
          </Text>
          <Text style={[authText(valueRole), { color: sheetColor.ink }]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * A screen-level message — a failed sign-in, a hydration failure, a 429.
 *
 * NOT IN THE SPEC, which resolves field-level errors and the rejection panel
 * and stops. Rather than invent a treatment, this is the rejection panel's own
 * geometry and palette carrying the field message's icon and type: every value
 * in it is quoted from somewhere the spec does draw. It sits directly above the
 * primary button, where the thing the user is waiting on an answer about is
 * next to the control they were waiting on it for.
 */
export function Banner({
  message,
  action,
}: {
  message: string;
  action?: { label: string; onPress: () => void };
}) {
  const { board } = useMetrics();

  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: "row",
        gap: gap.errorIconToMessage,
        padding: board.panelX,
        borderRadius: authRadius.panel,
        borderWidth: authSize.panelBorder,
        borderColor: sheetColor.panelLine,
        backgroundColor: sheetColor.panelFill,
      }}
    >
      <View style={{ paddingTop: 1 }}>
        <AlertIcon color={sheetColor.errorInk} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[authText(authType.errorMessage), { color: sheetColor.errorInk }]}>
          {message}
        </Text>
        {action ? (
          <Tappable
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            style={{ marginTop: 6 }}
          >
            <Text
              style={[
                authText(authType.textButtonSmall),
                { color: sheetColor.forest, textDecorationLine: "underline" },
              ]}
            >
              {action.label}
            </Text>
          </Tappable>
        ) : null}
      </View>
    </View>
  );
}

/* ────────────────────────── date of birth ───────────────────────────── */

/**
 * The date row: three pickers on one 56px line.
 *
 * ── WHY NOT THE OS PICKER ───────────────────────────────────────────────────
 *
 * The spec asks for the native modal, and the honest answer is that this app
 * has no native date picker in it: `@react-native-community/datetimepicker` is
 * a native module, and adding one means a new development build on every
 * machine and device the project touches. This is a JS picker with the same
 * behaviour the spec actually specifies — modal, no IME, the sheet does not
 * reposition — built entirely out of the spec's own field and sheet tokens.
 * Swapping in the native module later replaces this component and nothing else.
 *
 * MONTH IS FIRST AND WIDEST because it is the only one of the three that is a
 * word. The 1.25 / 0.85 / 1 split is read off the longest label ("September"),
 * not given by the spec.
 */
export function DateRow({
  value,
  onChange,
  error,
  disabled,
}: {
  value: DateParts | null;
  /** Null until ALL THREE columns have been chosen. See `useDateDraft`. */
  onChange: (next: DateParts | null) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState<DateColumn | null>(null);

  /*
   * THE COLUMNS ARE THE DISPLAY; THE PICKER BEHIND THEM IS SWAPPABLE.
   *
   * The spec draws this row as three fields and that has not changed — the
   * system picker replaces what a TAP opens, not what the row looks like. The
   * draft is therefore still what the three fields read from, and a native
   * confirm has to land in it rather than beside it.
   *
   * That is what the nonce is for. `useDateDraft` re-seeds from `value` only
   * when the nonce moves, so reporting a date upward without bumping it would
   * update the parent and leave these three fields showing their placeholders —
   * the row would look untouched immediately after being filled in.
   */
  const [nonce, setNonce] = useState(0);
  const draft = useDateDraft(value, onChange, nonce);

  const native = useNativeDatePicker(value ?? (draft.complete ? draft.parts : null), (picked) => {
    onChange(picked);
    setNonce((n) => n + 1);
  });

  return (
    <View>
      <DateColumns
        parts={draft.parts}
        chosen={draft.chosen}
        // Which column was tapped stops mattering the moment the system picker
        // takes over — it asks for the whole date at once. The column is still
        // passed through to the fallback, so a device without the native module
        // opens exactly the sheet it always did.
        onOpenColumn={(column) => native.tryOpen(() => setOpen(column))}
        disabled={disabled}
      />

      {error ? <FieldMessage>{error}</FieldMessage> : null}

      {native.sheet}

      {/*
        The fallback. One sheet, opened for whichever column was tapped. Safe to
        be a modal here because this row renders on the PAGE - nothing above it
        is already a modal. `DateOfBirthField` cannot use it for exactly that
        reason and swaps its own sheet's content instead.
      */}
      <OptionSheet
        visible={open !== null}
        title={open ? COLUMN_TITLE[open] : ""}
        options={open ? columnOptions(open, draft.parts) : []}
        selected={open && draft.chosen[open] ? columnKey(open, draft.parts) : ""}
        onSelect={(key) => open && draft.choose(open, Number(key))}
        onClose={() => setOpen(null)}
      />
    </View>
  );
}

/**
 * The compact form: one 56px field with a calendar mark, opening a sheet that
 * holds the same three columns.
 *
 * This is what create account uses, because it is field five of five and has to
 * weigh the same as the four above it. The Google step uses the row directly -
 * it is asking for one fact and has the room to ask for it in full.
 */
export function DateOfBirthField({
  value,
  onChange,
  error,
  disabled,
  label = "Date of birth",
}: {
  value: DateParts | null;
  onChange: (next: DateParts) => void;
  error?: string | null;
  disabled?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  /** Which column's list the sheet is showing, or null for the three fields. */
  const [column, setColumn] = useState<DateColumn | null>(null);
  const [nonce, setNonce] = useState(0);
  const draft = useDateDraft(value, undefined, nonce);

  const native = useNativeDatePicker(value, onChange);

  /** The fallback: the column sheet this field opened before there was a native one. */
  const openColumnSheet = () => {
    // Re-seed from the committed value, so an abandoned edit does not
    // reappear next time as though it had been saved.
    setNonce((n) => n + 1);
    setColumn(null);
    setOpen(true);
  };

  return (
    <>
      <PickerField
        label={label}
        value={value ? formatLongDate(value) : null}
        placeholder="Select your date of birth"
        icon="calendar"
        error={error}
        disabled={disabled}
        // The system picker first, this field's own sheet when there is not
        // one. Both write through `onChange`, so nothing downstream of this
        // control can tell which of them ran.
        onPress={() => native.tryOpen(openColumnSheet)}
      />

      {native.sheet}

      {/*
        ONE MODAL, NOT A MODAL INSIDE A MODAL.

        The obvious build is a sheet containing a `DateRow`, and a `DateRow`
        opens its own `OptionSheet` per column - which puts a React Native
        `Modal` inside another `Modal`. That nests two native dialog windows on
        Android, and the inner one lands behind the outer's scrim about as often
        as it lands in front. So this sheet swaps its own CONTENT instead: three
        fields, or one list, in the same window.
      */}
      <ModalSheet
        visible={open}
        title={column ? COLUMN_TITLE[column] : "Date of birth"}
        onClose={() => (column ? setColumn(null) : setOpen(false))}
      >
        {column ? (
          <OptionList
            options={columnOptions(column, draft.parts)}
            selected={draft.chosen[column] ? columnKey(column, draft.parts) : ""}
            onSelect={(key) => {
              draft.choose(column, Number(key));
              setColumn(null);
            }}
          />
        ) : (
          <>
            <DateColumns parts={draft.parts} chosen={draft.chosen} onOpenColumn={setColumn} />
            <View style={{ height: 20 }} />
            <PrimaryButton
              label="Set date of birth"
              // Disabled until all three have been picked. See `useDateDraft`.
              disabled={!draft.complete}
              onPress={() => {
                onChange(draft.parts);
                setOpen(false);
              }}
            />
          </>
        )}
      </ModalSheet>
    </>
  );
}

/* -- the system picker, and the column picker it falls back to ------------ */

/**
 * The platform's own date picker, with the column sheet behind it.
 *
 * ── WHY THE FALLBACK IS NOT OPTIONAL ────────────────────────────────────────
 *
 * `native-date-dialog.tsx` can report unavailable for three different reasons —
 * the native module missing from the installed shell (the normal state of this
 * project between rebuilds), `open()` throwing, or Android's own dialog failing
 * asynchronously because there was no Activity to attach to. The first is known
 * before the tap; the other two are not. So `tryOpen` takes the fallback as an
 * argument and every path that cannot produce a native dialog calls it. A tap
 * on a date field always opens SOMETHING.
 *
 * ── TWO PLATFORMS, TWO SHAPES, ONE ENTRY POINT ──────────────────────────────
 *
 * Android's picker IS a dialog, so it is fired imperatively and this hook
 * renders nothing for it. iOS's is an inline view, so it needs a host — and the
 * host is `ModalSheet`, the same one the column picker uses, with the same
 * title and the same "Set date of birth" button underneath. That is deliberate:
 * the two pickers are alternatives, and a person who hits the fallback should
 * not be able to tell that anything switched except the wheels themselves.
 *
 * ── THE SEED IS TODAY, AND THAT IS THE WHOLE POINT ──────────────────────────
 *
 * `useDateDraft` refuses to let its seed become a value: it opens on MIN_AGE
 * years ago for the scroll position but reports null until all three columns
 * have been chosen, because a control that committed its own seed would hand
 * somebody an age they never claimed on the one screen where that matters.
 *
 * A system picker has no way to express "nothing chosen yet" — every date
 * picker on both platforms opens on a date and commits whatever is showing when
 * the positive button is pressed. So the rule is kept by moving the seed
 * instead: it opens on TODAY, which is an age of zero.
 *
 * The obvious alternative is to seed MIN_AGE years ago, where the wheels open
 * on a plausible birth year and an adult is a short scroll in either direction.
 * That is rejected here, and the reason is what this control is for. This is the
 * only age gate in the app and it is self-declared, so the single thing it can
 * actually establish is that the claim was DELIBERATE. A picker opening on a
 * date that already passes, where one confirm commits it, cannot establish that
 * — it collects "did not disagree with a prefilled 18+" and records it as
 * "declared 18+". Those are different facts and only one of them is worth
 * storing.
 *
 * The cost is real and it is accepted: every honest user spins the year wheel
 * about eighteen notches. Eighteen notches is cheap for the difference above,
 * and `display: "spinner"` is what keeps it to one flick of one column rather
 * than a journey through a calendar grid.
 *
 * An unmoved confirm therefore commits today, `isAdult()` refuses it, and the
 * rejection screen explains why — which is the correct outcome for somebody who
 * did not answer the question. A field being EDITED still seeds from its
 * committed value; the ceiling only applies where there is nothing to reopen on.
 *
 * Nothing downstream relaxes either way. `isAdult()` runs on the client, the
 * server checks the same rule again, and the 403 it answers with is still what
 * the rejection screen renders.
 */
function useNativeDatePicker(current: DateParts | null, onPicked: (next: DateParts) => void) {
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<DateParts>(() => current ?? todayParts());

  const tryOpen = useCallback(
    (onUnavailable: () => void) => {
      const seed = current ?? todayParts();

      if (!nativeDatePickerAvailable) {
        onUnavailable();
        return;
      }

      if (NativeDateSpinner) {
        // Re-seeded on every open, so an abandoned edit does not reappear next
        // time as though it had been saved. Same rule as `DateOfBirthField`'s
        // nonce, for the same reason.
        setDraft(seed);
        setIosOpen(true);
        return;
      }

      const opened = openAndroidDatePicker({
        value: seed,
        onConfirm: onPicked,
        // Dismissing is a decision, not a failure. The field keeps whatever it
        // had, which for an untouched field is still nothing.
        onCancel: () => {},
        onFailed: onUnavailable,
      });
      if (!opened) onUnavailable();
    },
    [current, onPicked],
  );

  const sheet = NativeDateSpinner ? (
    <ModalSheet visible={iosOpen} title="Date of birth" onClose={() => setIosOpen(false)}>
      <NativeDateSpinner
        value={partsToDate(draft)}
        mode="date"
        display="spinner"
        {...dateBounds()}
        onValueChange={(_event, date) => setDraft(dateToParts(date))}
        // The sheet is the app's own light surface and the app is locked to a
        // light interface, so the picker is told the same rather than following
        // a system dark mode that nothing else here follows.
        themeVariant="light"
      />
      <View style={{ height: 20 }} />
      <PrimaryButton
        label="Set date of birth"
        onPress={() => {
          setIosOpen(false);
          onPicked(draft);
        }}
      />
    </ModalSheet>
  ) : null;

  return { tryOpen, sheet };
}

/* -- the three columns, and the draft behind them ------------------------- */

type DateColumn = "month" | "day" | "year";
type ChosenColumns = Record<DateColumn, boolean>;

const COLUMN_TITLE: Record<DateColumn, string> = {
  month: "Month of birth",
  day: "Day of birth",
  year: "Year of birth",
};

const NONE_CHOSEN: ChosenColumns = { month: false, day: false, year: false };
const ALL_CHOSEN: ChosenColumns = { month: true, day: true, year: true };

/**
 * A date of birth being assembled one column at a time.
 *
 * -- AN AGE GATE MUST NOT FILL ITSELF IN -------------------------------------
 *
 * The pickers have to OPEN somewhere, and the sensible place is `MIN_AGE` years
 * ago: an adult is then a short scroll in either direction rather than a
 * hundred-row journey from today. But that seed is also, exactly, a date that
 * passes the gate. A control that committed it on a stray tap would hand
 * somebody an age they never claimed, on the one screen in the app where a
 * fabricated value is the whole thing being guarded against.
 *
 * So the seed is a SCROLL POSITION and never a value. `chosen` records which of
 * the three the user has actually picked, each column shows its placeholder
 * until then, and the date is not reported as a date until all three are in.
 * `DateRow` passes null upward until that point; `DateOfBirthField` keeps its
 * commit button disabled.
 */
function useDateDraft(
  value: DateParts | null,
  onChange?: (next: DateParts | null) => void,
  /** Bump to re-seed from `value` - reopening a sheet after an abandoned edit. */
  nonce = 0,
) {
  const [parts, setParts] = useState<DateParts>(value ?? defaultDobParts());
  const [chosen, setChosen] = useState<ChosenColumns>(value ? ALL_CHOSEN : NONE_CHOSEN);
  const seeded = useRef(nonce);

  if (seeded.current !== nonce) {
    // Written in render rather than in an effect: an effect would paint one
    // frame of the previous draft before resetting it, and that frame is the
    // abandoned edit reappearing. Both writes are pure functions of props, so
    // this is stable under a double-invoked render.
    seeded.current = nonce;
    setParts(value ?? defaultDobParts());
    setChosen(value ? ALL_CHOSEN : NONE_CHOSEN);
  }

  function choose(column: DateColumn, next: number) {
    // Editing one column can strand another - 31 May into February has no 31st.
    // Clamping at the commit means the invalid state never exists, not even for
    // the frame between the tap and the re-render.
    const updated = clampDay(withColumn(column, parts, next));
    const nextChosen = { ...chosen, [column]: true };
    setParts(updated);
    setChosen(nextChosen);
    onChange?.(isComplete(nextChosen) ? updated : null);
  }

  return { parts, chosen, choose, complete: isComplete(chosen) };
}

function isComplete(chosen: ChosenColumns): boolean {
  return chosen.month && chosen.day && chosen.year;
}

/** The three picker fields on one 56px line. Shared by the row and the sheet. */
function DateColumns({
  parts,
  chosen,
  onOpenColumn,
  disabled,
}: {
  parts: DateParts;
  chosen: ChosenColumns;
  onOpenColumn: (column: DateColumn) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {/*
        MONTH IS FIRST AND WIDEST because it is the only one of the three that
        is a word. The 1.25 / 0.85 / 1 split is read off the longest label
        ("September"); the spec does not give it.
      */}
      <PickerField
        label="Month"
        value={chosen.month ? MONTH_NAMES[parts.month - 1] : null}
        placeholder="Month"
        disabled={disabled}
        onPress={() => onOpenColumn("month")}
        style={{ flex: 1.25 }}
      />
      <PickerField
        label="Day"
        value={chosen.day ? String(parts.day) : null}
        placeholder="Day"
        disabled={disabled}
        onPress={() => onOpenColumn("day")}
        style={{ flex: 0.85 }}
      />
      <PickerField
        label="Year"
        value={chosen.year ? String(parts.year) : null}
        placeholder="Year"
        disabled={disabled}
        onPress={() => onOpenColumn("year")}
        style={{ flex: 1 }}
      />
    </View>
  );
}

function columnOptions(column: DateColumn, parts: DateParts): Option[] {
  if (column === "month") {
    return MONTH_NAMES.map((name, i) => ({ key: String(i + 1), label: name }));
  }
  if (column === "day") {
    // Bounded by the month currently chosen, so February never offers a 30th.
    return Array.from({ length: daysInMonth(parts.year, parts.month) }, (_, i) => ({
      key: String(i + 1),
      label: String(i + 1),
    }));
  }
  return selectableYears().map((y) => ({ key: String(y), label: String(y) }));
}

function columnKey(column: DateColumn, parts: DateParts): string {
  return String(column === "month" ? parts.month : column === "day" ? parts.day : parts.year);
}

function withColumn(column: DateColumn, parts: DateParts, value: number): DateParts {
  if (column === "month") return { ...parts, month: value };
  if (column === "day") return { ...parts, day: value };
  return { ...parts, year: value };
}

/* ───────────────────────────── modal sheets ─────────────────────────── */

/**
 * The shell both pickers use: a bottom sheet on the auth surface.
 *
 * It reuses the page sheet's own radius and fill so a picker reads as the same
 * piece of paper sliding up rather than as a different app's dialog. Dismissal
 * is the scrim, the system back button, and nothing else — there is no cancel
 * button, because backing out of a picker is what the back gesture already is.
 */
export function ModalSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { board, safeBottom } = useMetrics();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Tappable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{ flex: 1, backgroundColor: "rgba(20,20,15,0.5)" }}
        />
        <View
          style={{
            maxHeight: "72%",
            backgroundColor: sheetColor.surface,
            borderTopLeftRadius: authRadius.sheet,
            borderTopRightRadius: authRadius.sheet,
            paddingHorizontal: board.sheetX,
            paddingTop: 22,
            paddingBottom: 20 + safeBottom,
          }}
        >
          <Text
            style={[
              authText(authType.headlineCompact),
              { color: sheetColor.ink, marginBottom: 16 },
            ]}
          >
            {title}
          </Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export interface Option {
  key: string;
  label: string;
}

/**
 * A scrolling list of options, opening on the one already chosen.
 *
 * Not a modal. `OptionSheet` puts it in one; `DateOfBirthField` renders it
 * inside a sheet it already owns.
 */
export function OptionList({
  options,
  selected,
  onSelect,
}: {
  options: Option[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const scroller = useRef<ScrollView>(null);

  // Opening a year list on 1915 and asking somebody to scroll ninety rows is
  // not a picker. `scrollTo` rather than a virtualised list because this is at
  // most 111 rows of fixed height, which a ScrollView handles for less.
  useEffect(() => {
    const index = Math.max(
      0,
      options.findIndex((o) => o.key === selected),
    );
    const t = setTimeout(
      () => scroller.current?.scrollTo({ y: Math.max(0, (index - 2) * OPTION_ROW), animated: false }),
      0,
    );
    return () => clearTimeout(t);
  }, [options, selected]);

  return (
    <ScrollView ref={scroller} style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
      {options.map((option) => {
        const chosen = option.key === selected;
        return (
          <Tappable
            key={option.key}
            onPress={() => onSelect(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: chosen }}
            accessibilityLabel={option.label}
            style={{
              height: OPTION_ROW,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
            pressedStyle={{ backgroundColor: sheetColor.pressedSurface }}
          >
            <Text
              style={[
                authText(authType.inputValue),
                { color: chosen ? sheetColor.forest : sheetColor.ink },
              ]}
            >
              {option.label}
            </Text>
            {chosen ? <CheckIcon color={sheetColor.forest} /> : null}
          </Tappable>
        );
      })}
    </ScrollView>
  );
}

/** The spec's minimum target, which is what an option row is. */
const OPTION_ROW = 44;

/** `OptionList` in a bottom sheet. Selecting closes it. */
export function OptionSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: Option[];
  selected: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <ModalSheet visible={visible} title={title} onClose={onClose}>
      <OptionList
        options={options}
        selected={selected}
        onSelect={(key) => {
          onSelect(key);
          onClose();
        }}
      />
    </ModalSheet>
  );
}

/* ────────────────────────────── re-exports ──────────────────────────── */

export { bandHeight, gap, authSize, keyboardRule, sheetColor };
export type { DateParts };
