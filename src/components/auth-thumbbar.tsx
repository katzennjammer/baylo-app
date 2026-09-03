import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Platform,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoginBackground } from "./LoginBackground";
import { Tappable } from "./Tappable";
import {
  AlertIcon,
  ArrowIcon,
  AuthLeafIcon,
  BackIcon,
  ChevronIcon,
  EyeIcon,
  GearIcon,
  GoogleGlyph,
} from "./auth-icons";
import {
  authBoard,
  authColor,
  authMotion,
  authSize,
  authText,
  authType,
  wordmarkFit,
  type AuthBoard,
} from "../theme/auth-tokens";

/**
 * Direction C — "Thumb Bar". The pieces both auth screens are built from.
 *
 * SEPARATE FROM `auth-ui.tsx`, WHICH IS STILL LIVE. That file dresses
 * `app/verify.tsx` — AuthScreen, AuthCard, AuthHeader, ErrorBanner,
 * NoticeBanner, PrimaryButton — and rewriting it in place would have taken the
 * verify screen with it for no reason this task asked for. The two kits share
 * nothing and are not meant to; when verify is redrawn it moves here and
 * `auth-ui.tsx` goes away.
 *
 * ── THE SIX RULES THIS FILE ENFORCES ────────────────────────────────────────
 *
 *   ONE VERTICAL EDGE. Eyebrow, wordmark, subtitle, every label, every value,
 *   the footer link and the bar's own label all start on `board.margin`.
 *   Nothing is centred. The only things that cross it are the full-bleed error
 *   strip and the bar, and their TEXT still starts on it.
 *
 *   NO BOXES. Radius is 0 everywhere. The single exception is the welcome-grant
 *   strip at 4, and it earns it by being the reward.
 *
 *   THE RULE CARRIES THE STATE. Field labels are static — they do not float,
 *   shrink or move. Focus, fill and error are read off the underline.
 *
 *   THE MIDDLE STAYS EMPTY. The brand block is pinned to the top and the form
 *   group to the bottom; the gap between them is the footage, and it is the
 *   direction. Nothing may be added there.
 *
 *   THE BAR IS WELDED TO THE BOTTOM EDGE. Full bleed, no radius, and it
 *   re-seats above the keyboard rather than being covered by it.
 *
 *   44px MINIMUM TARGET. The field block is 52, the Google row 56, the footer
 *   row 44, every chrome button 44, the bar's content row 64.
 *
 * ── TAPPABLE, NEVER style={({ pressed }) => …} ──────────────────────────────
 *
 * Under NativeWind a function `style` on a Pressable is silently replaced with
 * `{}` — not just the pressed half, all of it. `Tappable` exists to close that
 * trap and the full chain is written out in its own file. Every pressable in
 * here goes through it.
 */

/* ─────────────────────────── board context ──────────────────────────── */

interface AuthCtx {
  board: AuthBoard;
  /** Window width. `Brand` sizes the wordmark off it — see `wordmarkFit`. */
  width: number;
  /** Height of the shell's own content host, as last laid out. */
  contentHeight: number;
  /**
   * Height at the BOTTOM OF THE CONTENT HOST that the IME covers, after
   * whatever the window itself gave back. See `useKeyboardOverlap`.
   */
  keyboardInset: number;
  keyboardUp: boolean;
  /** Measured bottom safe-area inset. The spec's 34 / 24 are assumptions. */
  safeBottom: number;
  safeTop: number;
  /** 64 + safeBottom, or 64 flat while the keyboard is up. */
  barHeight: number;
}

const Ctx = createContext<AuthCtx | null>(null);

function useAuthCtx(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("auth-thumbbar: component used outside <AuthShell>");
  return ctx;
}

/**
 * Keyboard tracking.
 *
 * ── THE PREVIOUS VERSION HARD-CODED 0 ON ANDROID, AND THAT IS THE BUG ───────
 *
 * It read: "on Android the window resizes (`softwareKeyboardLayoutMode:
 * "resize"`), so the layout is already the visible window and the inset is 0".
 * That was true until Android 15. It is not true here.
 *
 * `android/gradle.properties` sets `edgeToEdgeEnabled=true`, and from API 35
 * `SOFT_INPUT_ADJUST_RESIZE` is a no-op for an edge-to-edge window: the window
 * stays the full screen and the IME arrives as an inset the app is expected to
 * apply itself. So the layout was NOT the visible window, the inset was NOT 0,
 * and every consumer of it — the bar's re-seat, the form's clearance, the
 * scrim's visible region — was told the keyboard covered nothing. Reproduced on
 * SM-A156E / Android 16.
 *
 * ── WHY NOT `KeyboardAvoidingView`, WHICH IS THE OBVIOUS ANSWER ─────────────
 *
 * Because the same change breaks it. Its `_relativeKeyboardHeight` is
 * `frame.y + frame.height − endCoordinates.screenY`, and RN fills `screenY`
 * from `getWindowVisibleDisplayFrame()` (`ReactRootView.checkForKeyboardEvents`)
 * — the frame that no longer shrinks. It returns ~0 and pads by nothing. Only
 * `endCoordinates.height` survives, because RN takes THAT from
 * `WindowInsetsCompat.Type.ime()`, which is inset-based and still correct.
 *
 * So the height is the number to build on:
 *
 *   RN's `height` = imeInsets.bottom − systemBarInsets.bottom
 *   the IME's real overlap of a full-screen window = imeInsets.bottom
 *                                                 = height + insets.bottom
 *
 * ── AND IT STILL WORKS IF THE WINDOW DOES RESIZE ────────────────────────────
 *
 * On a build where the window really does resize, the layout gives the same
 * space back a second time and the two would double up. Rather than branching
 * on a platform or an API level — either of which is a guess about a device
 * this code has not been run on — the shell subtracts what it actually got:
 * `restHeight` is the content host's height with no keyboard up, so anything
 * the host has lost since then is space the IME is no longer covering. Both
 * arrangements land on the same number without being told which they are.
 */
function useKeyboardOverlap(safeBottom: number) {
  const [raw, setRaw] = useState({ height: 0, up: false });

  useEffect(() => {
    const ios = Platform.OS === "ios";
    // `will*` on iOS so the bar moves WITH the keyboard rather than after it;
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

/** The board in force — margin, gaps, chrome insets. Screens read gaps from it
 *  rather than hard-coding 26 / 18, so the 360 reflow is one branch, not five. */
export function useAuthBoard(): AuthBoard {
  return useAuthCtx().board;
}

/** True while the IME is up. The Google row and the footer link read this: the
 *  spec does not render either one over a keyboard. */
export function useAuthKeyboardUp(): boolean {
  return useAuthCtx().keyboardUp;
}

/**
 * The screen scaffold: background layer, board selection, keyboard tracking.
 *
 * ── THE KEYBOARD HANDLING IS BACK, AND IT IS NOT WHAT WAS REMOVED ───────────
 *
 * The note that used to sit here argued the shell needed neither a ScrollView
 * nor a KeyboardAvoidingView, because "the bar re-seats above the IME, so the
 * field being typed into is never underneath it". The premise was false on
 * Android 15+ — see `useKeyboardOverlap` — so the conclusion took the fields
 * down with it. Both jobs are done again, each by the piece that can actually
 * do it here:
 *
 *   AVOIDANCE is `marginBottom` on the content host, from a measured IME
 *   overlap. Shrinking the host re-seats everything absolutely anchored to its
 *   bottom edge — the bar and the form group — with one number, and
 *   `LoginBackground` gets that same number for the scrim, which is why it is
 *   computed once, here, rather than left inside a KeyboardAvoidingView that
 *   cannot share it and could not compute it correctly anyway.
 *
 *   OVERFLOW is `FormGroup`'s business, because it is the only block that can
 *   grow. It measures itself and scrolls ONLY when it does not fit. That keeps
 *   the thing the ScrollView was removed for: at every size the spec draws
 *   there is no scroll view in the tree, so the first tap on the bar submits
 *   rather than being eaten dismissing the keyboard.
 */
export function AuthShell({
  children,
  scrim = "twoField",
}: {
  children: React.ReactNode;
  scrim?: "twoField" | "fourField";
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // The host's BORDER-BOX height — what the window handed this screen, before
  // any padding of ours. It has to be the border box: a flex:1 box keeps its
  // border-box height whatever its padding, so this number moves if and only if
  // the WINDOW moved, which is exactly the question `givenBack` is asking.
  // Measuring the content box instead would see our own padding, call it a
  // window resize, and cancel the padding out — a loop that settles on half a
  // keyboard.
  const [hostHeight, setHostHeight] = useState(0);
  const restHeight = useRef(0);

  const { grossOverlap, keyboardUp } = useKeyboardOverlap(insets.bottom);

  // The host's height with no keyboard up, which is what "how much did the
  // window give back" is measured against. Only ever written while the IME is
  // down, so a resize cannot poison its own baseline — and the value is a pure
  // function of committed state, so writing it in render is stable under a
  // double-invoked one.
  if (!keyboardUp && hostHeight > 0) restHeight.current = hostHeight;

  const givenBack =
    keyboardUp && restHeight.current > 0 ? Math.max(0, restHeight.current - hostHeight) : 0;
  const keyboardInset = Math.max(0, grossOverlap - givenBack);
  const contentHeight = Math.max(0, hostHeight - keyboardInset);

  const value = useMemo<AuthCtx>(() => {
    const board = authBoard(width);
    // The spec's 34 / 24 are design assumptions. The measured inset wins, and
    // while the keyboard is up the bar sheds it entirely — the IME is already
    // covering the gesture area it was there to avoid.
    const safeBottom = keyboardUp ? 0 : insets.bottom;
    return {
      board,
      width,
      contentHeight,
      keyboardInset,
      keyboardUp,
      safeBottom,
      safeTop: insets.top,
      barHeight: authSize.bar.contentHeight + safeBottom,
    };
  }, [width, insets.bottom, insets.top, contentHeight, keyboardInset, keyboardUp]);

  return (
    <LoginBackground scrim={scrim} keyboardInset={keyboardInset} keyboardUp={keyboardUp}>
      <Ctx.Provider value={value}>
        {/*
          TWO VIEWS, AND THE SPLIT IS LOAD-BEARING.

          The outer one is never resized by anything of ours, so its onLayout
          answers exactly one question: did the WINDOW move? That is what
          `givenBack` is asking, and measuring the inner box instead would see
          this screen's own keyboard offset, call it a window resize, and cancel
          it out — a loop that settles on half a keyboard.

          The inner one is the content host, and it sheds the IME's height with
          `marginBottom` rather than `paddingBottom`. Padding was the first
          attempt and it moved nothing: Yoga resolves a trailing offset on an
          absolutely positioned child against its parent's BORDER box, taking
          off the border but not the padding, so `bottom: 0` stayed pinned to
          the bottom of the screen and the bar and the form group spent the
          whole time underneath the keyboard — the very bug this is fixing,
          reproduced a second way. A margin shrinks the box itself, which no
          reading of the absolute-position rules can disagree with.
        */}
        <View style={{ flex: 1 }} onLayout={(e) => setHostHeight(e.nativeEvent.layout.height)}>
          <View style={{ flex: 1, marginBottom: keyboardInset }}>{children}</View>
        </View>
      </Ctx.Provider>
    </LoginBackground>
  );
}

/* ──────────────────────────── top chrome ────────────────────────────── */

/** The gear (sign in) and the back arrow (create account). 44 × 44. */
export function ChromeButton({
  kind,
  onPress,
  label,
  hint,
}: {
  kind: "gear" | "back";
  onPress: () => void;
  label: string;
  hint?: string;
}) {
  const { board, safeTop, keyboardUp } = useAuthCtx();
  // The spec's 52 / 44 clear a standard status bar. A taller one (Dynamic
  // Island, a display cutout) would overlap the box, so it is floored — the
  // spec value is used on every device where it is the larger of the two.
  const top = keyboardUp
    ? authSize.collapsedBrand.chromeTop
    : Math.max(board.chromeTop, safeTop + 4);

  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={{
        position: "absolute",
        top,
        [kind === "gear" ? "right" : "left"]: board.chromeInset,
        width: authSize.chromeButton,
        height: authSize.chromeButton,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {kind === "gear" ? (
        <GearIcon color={authColor.cream72} />
      ) : (
        <BackIcon color={authColor.cream72} />
      )}
    </Tappable>
  );
}

/* ────────────────────────────── brand ───────────────────────────────── */

/**
 * Eyebrow, wordmark, subtitle — and the collapsed row the keyboard swaps in.
 *
 * BOTH STATES ARE RENDERED AT ALL TIMES and cross-faded on opacity. Animating
 * `fontSize` from 140 to 34 would re-measure the text on every frame and drops
 * frames on mid-range hardware; opacity runs on the native driver and never
 * touches layout. The two are absolutely positioned so neither can push the
 * other around mid-transition.
 */
export function Brand({
  eyebrow,
  subtitle,
  screen2 = false,
}: {
  eyebrow: string;
  subtitle?: string;
  /** Create account: the wordmark drops to the 72 cap and gives back its height. */
  screen2?: boolean;
}) {
  const { board, width, keyboardUp, safeTop } = useAuthCtx();
  const collapse = useRef(new Animated.Value(keyboardUp ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(collapse, {
      toValue: keyboardUp ? 1 : 0,
      duration: authMotion.brandCollapseMs,
      useNativeDriver: true,
    }).start();
  }, [keyboardUp, collapse]);

  /*
    THE SIZE IS A FIT, NOT A BOARD LOOKUP.

    This used to pick 150 / 140 / 72 off `board.margin`, and the first two do
    not fit their own boards — the Text is `numberOfLines={1}` in a column of
    `width − 2 × margin`, so it silently ellipsised to "Ba…" on a real 390 and
    on a real 360 alike. `wordmarkFit` derives the size from the font's measured
    advance sum instead, capped at the spec's drawn value; the arithmetic and
    the measurement are both written out in auth-tokens.ts.

    Deriving it also retires the 360 step. The old table had to name a second
    size because a fixed one cannot follow the column; this one follows it at
    every width, including the 393 and 411 that most Android phones actually
    report and that the spec never drew.
  */
  const full = wordmarkFit(
    width - board.margin * 2,
    screen2 ? authType.wordmark.capScreen2 : authType.wordmark.capScreen1,
  );

  const top = Math.max(board.brandTop, safeTop + 40);

  return (
    <>
      <Animated.View
        style={{
          position: "absolute",
          left: board.margin,
          right: board.margin,
          top,
          gap: board.brandGap,
          opacity: collapse.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        }}
        pointerEvents="none"
      >
        <Text style={[authText(authType.eyebrow), { color: authColor.eyebrowInk }]}>
          {eyebrow}
        </Text>
        {/*
          `marginVertical` is the sub-1.0 line height, applied as negative space
          rather than as a clipping lineHeight. See the long note in
          auth-tokens.ts — `lineHeight: 123` under a 150px font shears the
          descender off the y, and React Native gives no warning when it does.
        */}
        <Text
          style={[
            authText(full),
            { color: authColor.cream, marginTop: full.marginVertical, marginBottom: full.marginVertical },
          ]}
          allowFontScaling={false}
          numberOfLines={1}
        >
          Baylo
        </Text>
        {subtitle ? (
          <Text style={[authText(authType.subtitle), { color: authColor.cream72 }]}>
            {subtitle}
          </Text>
        ) : null}
      </Animated.View>

      <Animated.View
        style={{
          position: "absolute",
          left: board.margin,
          right: board.margin,
          top: authSize.collapsedBrand.top,
          opacity: collapse,
        }}
        pointerEvents="none"
      >
        <Text
          style={[authText(authType.wordmarkCollapsed), { color: authColor.cream }]}
          allowFontScaling={false}
        >
          Baylo
        </Text>
      </Animated.View>
    </>
  );
}

/** "Check your email" — two Text nodes, never one with a newline. */
export function Headline({ line1, line2 }: { line1: string; line2: string }) {
  const { board, safeTop } = useAuthCtx();
  return (
    <View
      style={{
        position: "absolute",
        left: board.margin,
        right: board.margin,
        top: Math.max(board.brandTop, safeTop + 40),
        gap: authSize.checkEmail.eyebrowToHeadline,
      }}
      pointerEvents="none"
    >
      <Text style={[authText(authType.eyebrow), { color: authColor.eyebrowInk }]}>
        Almost there
      </Text>
      <View>
        {/*
          TWO NODES, NOT ONE WITH \n. The headline's 0.88 line height cannot use
          the negative-margin trick the wordmark does: negative vertical margins
          on a single Text close the gap BETWEEN its lines as well as around
          them, so the two rows would collide. Rendering them separately puts
          the inter-line advance at exactly 54.56 without touching either glyph.
        */}
        <Text style={[authText(authType.headline), { color: authColor.cream }]}>{line1}</Text>
        <Text
          style={[
            authText(authType.headline),
            { color: authColor.cream, marginTop: authType.headlineLine2Offset },
          ]}
        >
          {line2}
        </Text>
      </View>
    </View>
  );
}

/* ────────────────────────────── the form ────────────────────────────── */

/**
 * How a field asks to be scrolled into view. Null outside a scrolling group,
 * which is the normal case and costs the field nothing.
 *
 * The field hands over its own host view and NOT a y it read off its onLayout,
 * because `layout.y` is relative to the immediate parent — and the fields sit
 * two nested gap-holders deep inside the group. On sign in that error happens
 * to be zero; on create account it is a whole field block. `measureLayout`
 * against the content view is the offset that is actually true, whatever a
 * screen nests its fields in.
 */
type RevealRequest = (node: React.ComponentRef<typeof View> | null) => void;
const RevealCtx = createContext<RevealRequest | null>(null);

/**
 * The bottom-anchored group: error strip, then everything inset to the margin.
 *
 * The strip is a sibling of the padded block rather than inside it because it
 * is full-bleed while the form is not. Its 16px gap to the first field is the
 * container's own `gap`, which means the whole group grows UPWARD when the
 * strip appears and the bar never moves — exactly the spec's stack, and it
 * degrades correctly on a screen that is not 844 tall, which an absolute
 * `top: 396` would not.
 *
 * ── AND IT SCROLLS, BUT ONLY WHEN IT HAS TO ─────────────────────────────────
 *
 * Growing upward has a ceiling: the brand block. Past that the group runs off
 * the top of the screen and the first field becomes unreachable — four fields,
 * an error strip and a tall IME on a 640px window is enough to do it, which the
 * previous note conceded and then shipped without a remedy.
 *
 * So the group measures its own content and compares it with the room it has.
 * Within the room it renders exactly as before, with NO ScrollView anywhere in
 * the tree — which is what keeps the property the ScrollView was removed for:
 * a first tap on the bar submits instead of being eaten dismissing the
 * keyboard. Over the room it becomes a scroller of exactly that height, with
 * `keyboardShouldPersistTaps="handled"` so that same tap still lands.
 *
 * The measurement is stable across the branch: the child that reports it is
 * inside the scroller when there is one, and a ScrollView does not constrain
 * its content's height, so the number does not change when the branch flips.
 * Nothing here can oscillate between the two.
 */
export function FormGroup({ strip, children }: { strip?: React.ReactNode; children: React.ReactNode }) {
  const { board, keyboardUp, barHeight, contentHeight } = useAuthCtx();
  const scroller = useRef<ScrollView>(null);
  const content = useRef<React.ComponentRef<typeof View>>(null);
  const [natural, setNatural] = useState(0);
  const [stripHeight, setStripHeight] = useState(0);

  // 12px clearance between the form and the bar — the spec's 110 / 100 are
  // exactly barHeight + 12 at the assumed insets, so deriving it keeps the
  // relationship true when the measured inset differs. With the keyboard up
  // the spec's clearance is 20.
  //
  // The IME's own height is NOT added here any more. The shell's content host
  // is already short by exactly that much, and this group is anchored to the
  // host's bottom — adding it again would lift the form by two keyboards.
  const bottom =
    barHeight + (keyboardUp ? authSize.formClearance.keyboard : authSize.formClearance.rest);

  // What the brand block is holding at the top. The collapsed row is 34 on a
  // 36 top; at rest the full block starts at `brandTop`, and the empty middle
  // under it is the direction — the group may not climb into either.
  const brandFloor = keyboardUp
    ? authSize.collapsedBrand.top + authType.wordmarkCollapsed.fontSize + board.brandGap
    : board.brandTop;

  // The strip is a sibling above the scroller, not content inside it — it is
  // full-bleed and the form is not — so its height and its gap come off the
  // room before anything is compared. Measured rather than assumed: the strip
  // is one line at 49, two at 67, three at 85, and which one it is depends on
  // a server message.
  const stripBlock = strip ? stripHeight + board.stripToForm : 0;
  const room = contentHeight - bottom - brandFloor - stripBlock;
  const overflows = contentHeight > 0 && natural > 0 && room > 0 && natural > room;

  const body = (
    <View
      ref={content}
      style={{ paddingHorizontal: board.margin }}
      onLayout={(e) => setNatural(e.nativeEvent.layout.height)}
    >
      {children}
    </View>
  );

  const reveal: RevealRequest = (node) => {
    const host = content.current;
    if (!node || !host) return;
    node.measureLayout(
      host,
      (_x, y, _w, height) => revealIn(scroller, natural, room, y, height),
      // Swallowed on purpose. A failed measure means the field or the content
      // view went away between the focus and this callback, and the only honest
      // response to that is to leave the scroll position alone.
      () => {},
    );
  };

  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom, gap: board.stripToForm }}>
      {strip ? (
        <View onLayout={(e) => setStripHeight(e.nativeEvent.layout.height)}>{strip}</View>
      ) : null}
      {overflows ? (
        <RevealCtx.Provider value={reveal}>
          <ScrollView
            ref={scroller}
            style={{ height: room }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            // No rubber-banding and no overscroll glow. The group is welded to
            // the bar; a bounce would visibly unweld it.
            bounces={false}
            overScrollMode="never"
          >
            {body}
          </ScrollView>
        </RevealCtx.Provider>
      ) : (
        body
      )}
    </View>
  );
}

/**
 * Bring a field that has just taken focus into the scroller's viewport.
 *
 * Only ever called while the group is actually scrolling. Android does not do
 * this for us here: its native "pan to the focused view" path runs off the
 * window resizing, which under edge-to-edge no longer happens — the same root
 * cause as the rest of this file's keyboard handling.
 *
 * Scrolls the field's BOTTOM edge to one message-block above the viewport
 * bottom, clamped to the content. That direction rather than the top one
 * because the bottom of this group is the end the bar is on: it keeps the field
 * and the rows under it in view, and it is a no-op for the first field, whose
 * clamp lands on 0.
 */
function revealIn(
  scroller: React.RefObject<ScrollView | null>,
  natural: number,
  room: number,
  y: number,
  height: number,
) {
  const pad = authSize.field.messageBlock;
  const target = Math.max(0, Math.min(natural - room, y + height + pad - room));
  scroller.current?.scrollTo({ y: target, animated: true });
}

/* ────────────────────────────── the field ───────────────────────────── */

export interface AuthFieldProps extends Omit<TextInputProps, "style" | "placeholder"> {
  label: string;
  /** Field-level message. Renders in terracotta and drives the error state. */
  error?: string | null;
  /** Show / hide toggle. Password fields only. */
  reveal?: { visible: boolean; onToggle: () => void };
}

/**
 * The underline field. 52px in every state, and nothing reflows between them.
 *
 * NO PLACEHOLDER, deliberately and per the spec: the label sits above the rule
 * and never moves, so a placeholder would only repeat it. An empty field is
 * genuinely empty. That is also what makes the empty and focused states differ
 * by colour alone, which is the point of "the rule carries the state".
 *
 * THE CARET IS THE NATIVE ONE, TINTED. The spec draws a 2 × 20 green bar; that
 * is exactly what `selectionColor` (and `cursorColor` on Android) produces, and
 * a drawn caret would have to blink on the JS thread and fight the real one.
 */
export const AuthField = forwardRef<TextInput, AuthFieldProps>(function AuthField(
  { label, error, reveal, onFocus, onBlur, editable, ...input },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const inner = useRef<TextInput>(null);
  const f = authSize.field;

  // The group's offer to scroll this field into view. Null in the ordinary case
  // — the group only makes one while it is actually scrolling — so a field that
  // fits pays for nothing but a ref it already wanted.
  const root = useRef<React.ComponentRef<typeof View>>(null);
  const askToReveal = useRef<RevealRequest | null>(null);
  askToReveal.current = useContext(RevealCtx);
  const keyboardUp = useAuthKeyboardUp();

  // Deliberately NOT done in onFocus. On the first tap the IME has not opened
  // yet, so the group has not been re-measured against the smaller window and a
  // scroll issued there is clamped against the old room and lands short. Firing
  // on `keyboardUp` as well means the request is repeated once the layout has
  // settled, which is the pass that has the right numbers in it.
  useEffect(() => {
    if (!focused) return;
    const t = setTimeout(() => askToReveal.current?.(root.current), 60);
    return () => clearTimeout(t);
  }, [focused, keyboardUp]);

  const state = focused ? "focus" : error ? "error" : input.value ? "filled" : "empty";

  const labelColor =
    state === "focus"
      ? authColor.green
      : state === "error"
        ? authColor.terraLt
        : authColor.cream56;

  const ruleColor =
    state === "focus"
      ? authColor.green
      : state === "error"
        ? authColor.terra
        : state === "filled"
          ? authColor.cream34
          : authColor.cream22;

  const ruleHeight = state === "focus" ? f.ruleFocus : f.ruleRest;

  return (
    <View ref={root} style={{ position: "relative", opacity: editable === false ? 0.6 : 1 }}>
      {/*
        Behind everything: a full-block target so a tap anywhere in the 52px
        focuses the input, not only the 22px the TextInput actually occupies.
        First child, so it renders underneath — the Text nodes above it have no
        touch handlers and let the touch through.
      */}
      <Tappable
        onPress={() => inner.current?.focus()}
        accessibilityRole="none"
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />

      <Text style={[authText(authType.fieldLabel), { height: f.labelHeight, color: labelColor }]}>
        {label}
      </Text>

      <View style={{ height: f.valueHeight, marginTop: f.labelToValue, justifyContent: "center" }}>
        <TextInput
          ref={(node) => {
            inner.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          {...input}
          editable={editable}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          selectionColor={authColor.green}
          cursorColor={authColor.green}
          style={[
            authText(authType.fieldValue),
            {
              color: authColor.cream,
              height: f.valueHeight,
              // Android gives TextInput its own padding and vertical centring
              // that CSS does not. Both have to go or the value sits low in a
              // 22px row and the rule ends up 3px further from it than drawn.
              padding: 0,
              textAlignVertical: "center",
            },
          ]}
        />
      </View>

      {/*
        A FIXED 2px TRACK with the painted rule bottom-aligned inside it. Laying
        the track out at 1.5 and growing it to 2 on focus would shift everything
        below by half a pixel every time a field is tapped, which is the reflow
        this arrangement exists to prevent.
      */}
      <View style={{ height: f.ruleTrack, marginTop: f.valueToRule, justifyContent: "flex-end" }}>
        <View style={{ height: ruleHeight, backgroundColor: ruleColor }} />
      </View>

      {error ? (
        <Text
          style={[
            authText(authType.fieldMessage),
            { marginTop: f.messageTop, height: f.messageHeight, color: authColor.terraLt },
          ]}
        >
          {error}
        </Text>
      ) : null}

      {reveal ? (
        <Tappable
          onPress={reveal.onToggle}
          accessibilityRole="button"
          accessibilityLabel={reveal.visible ? "Hide password" : "Show password"}
          style={{
            position: "absolute",
            top: authSize.eyeButton.top,
            right: authSize.eyeButton.right,
            width: authSize.eyeButton.size,
            height: authSize.eyeButton.size,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <EyeIcon color={authColor.cream46} off={!reveal.visible} />
        </Tappable>
      ) : null}
    </View>
  );
});

/* ───────────────────────────── error strip ──────────────────────────── */

/**
 * Full bleed, opaque, no radius. It must not sample the video: a translucent
 * fill over an unpredictable frame is the one element on this screen whose
 * contrast could not be guaranteed.
 *
 * Height is content-driven — one line is 49, two 67, three 85 — and the group
 * above grows upward to fit, so the bar and the fields never move.
 */
export function ErrorStrip({
  message,
  action,
}: {
  message: string;
  /** The way out. On sign in, the password reset. */
  action?: { label: string; onPress: () => void };
}) {
  const { board } = useAuthCtx();
  const s = authSize.errorStrip;

  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: s.gap,
        paddingTop: s.paddingTop,
        paddingBottom: s.paddingBottom,
        paddingHorizontal: board.margin,
        backgroundColor: authColor.terraDeep,
      }}
    >
      <View style={{ paddingTop: s.iconTop }}>
        <AlertIcon color={authColor.terraLt} />
      </View>
      <Text style={[authText(authType.errorStripBody), { color: authColor.terraInk, flex: 1 }]}>
        {message}
        {action ? (
          <Text
            onPress={action.onPress}
            suppressHighlighting
            style={{ color: authColor.terraLt, textDecorationLine: "underline" }}
          >
            {" "}
            {action.label}
          </Text>
        ) : null}
      </Text>
    </View>
  );
}

/* ─────────────────────────── secondary rows ─────────────────────────── */

/**
 * "Continue with Google". Deliberately the quietest tappable thing here — a
 * hairline above it and nothing else. No fill, no border, no radius.
 */
export function GoogleRow({
  onPress,
  busy,
  disabled,
}: {
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const active = !busy && !disabled;
  return (
    <Tappable
      onPress={onPress}
      disabled={!active}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityState={{ disabled: !active, busy: !!busy }}
      style={{
        height: authSize.googleRow.height,
        flexDirection: "row",
        alignItems: "center",
        gap: authSize.googleRow.gap,
        borderTopWidth: authSize.googleRow.hairline,
        borderTopColor: authColor.cream14,
        opacity: active ? 1 : 0.45,
      }}
    >
      {busy ? (
        <ActivityIndicator color={authColor.cream88} />
      ) : (
        <GoogleGlyph color={authColor.cream88} />
      )}
      <Text style={[authText(authType.googleLabel), { color: authColor.cream88, flexGrow: 1 }]}>
        Continue with Google
      </Text>
      <ChevronIcon color={authColor.cream56} />
    </Tappable>
  );
}

/**
 * "New here? Create an account". The link alone is the target, padded to 44.
 */
export function FooterLink({
  prefix,
  label,
  onPress,
  disabled,
}: {
  prefix: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <View
      style={{
        height: authSize.footerRow.height,
        flexDirection: "row",
        alignItems: "center",
        gap: authSize.footerRow.gap,
      }}
    >
      <Text style={[authText(authType.footerPrefix), { color: authColor.cream56 }]}>{prefix}</Text>
      <Tappable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="link"
        accessibilityLabel={label}
        style={{
          height: authSize.footerRow.height,
          justifyContent: "center",
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <Text style={[authText(authType.footerLink), { color: authColor.green }]}>{label}</Text>
      </Tappable>
    </View>
  );
}

/** A quiet line under the form — the Google-unavailable reason, and the like. */
export function FootNote({ children }: { children: React.ReactNode }) {
  return (
    <Text style={[authText(authType.fieldMessage), { color: authColor.cream46 }]}>{children}</Text>
  );
}

/* ─────────────────────────── the action bar ─────────────────────────── */

/**
 * Welded to the bottom edge. Full bleed, no radius, label on the margin and the
 * arrow on the opposite one.
 *
 * WHEN THE KEYBOARD IS UP it re-seats directly above the IME and sheds its
 * gesture inset — the keyboard is already covering the area that inset exists
 * to avoid. That is not a compromise: it puts the primary action one row above
 * the keys, which is the best this direction ever reads.
 *
 * THE RE-SEAT IS NOT DONE HERE. `bottom` is a flat 0; the shell's content host
 * carries the IME overlap as `paddingBottom`, and an absolutely positioned
 * child is laid out against its parent's padding box. This bar used to add the
 * inset itself, which was harmless only for as long as that inset was wrongly
 * reported as 0 on Android — the two together would now lift it by two
 * keyboards.
 *
 * THE DISABLED STATE IS NOT IN THE SPEC. A full-bleed bar dimmed to grey over
 * video reads as broken chrome rather than as "not yet", so the fill is left
 * alone and the label and arrow drop to 45% — visibly inert, still obviously
 * the same control. Flagged here because it is the one invented value in this
 * file.
 */
export function ActionBar({
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
  const { board, barHeight, safeBottom } = useAuthCtx();
  const active = !disabled && !busy;
  const ink = active ? authColor.onGreen : "rgba(11,42,21,0.45)";

  return (
    <Tappable
      onPress={onPress}
      disabled={!active}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !active, busy: !!busy }}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: barHeight,
        paddingHorizontal: board.margin,
        // The safe-area padding is at the BOTTOM, so the 64px content row stays
        // 64 and vertically honest whatever the device's inset turns out to be.
        paddingBottom: safeBottom,
        backgroundColor: authColor.green,
      }}
      pressedStyle={{ backgroundColor: authColor.greenPress }}
    >
      <View
        style={{
          height: authSize.bar.contentHeight,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {busy ? (
          <ActivityIndicator color={authColor.onGreen} />
        ) : (
          <>
            <Text style={[authText(authType.barLabel), { color: ink }]}>{label}</Text>
            <ArrowIcon color={ink} />
          </>
        )}
      </View>
    </Tappable>
  );
}

/* ──────────────────────── check-your-email parts ────────────────────── */

/** Body copy with the address emphasised. */
export function CheckEmailBody({ email }: { email: string }) {
  return (
    <Text style={[authText(authType.checkEmailBody), { color: authColor.cream72 }]}>
      We sent a verification link to{" "}
      <Text style={[authText(authType.checkEmailStrong), { color: authColor.cream }]}>{email}</Text>.
      Open it and you&rsquo;re in.
    </Text>
  );
}

/**
 * The welcome-grant strip — the only radius in the entire flow, and the only
 * bordered element. It earns both by being the reward.
 *
 * `leaves` is a prop rather than a literal because the number is a server fact
 * (`signupGrantClaimed` in the backend's verification module), not a design
 * value, and a screen that promises a different figure than the API pays is a
 * bug no amount of visual polish covers.
 */
export function LeafStrip({ leaves }: { leaves: number }) {
  const s = authSize.leafStrip;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: s.gap,
        minHeight: s.minHeight,
        padding: s.padding,
        borderWidth: s.border,
        borderColor: authColor.leafLine,
        borderRadius: s.radius,
      }}
    >
      <AuthLeafIcon color={authColor.green} />
      <Text style={[authText(authType.leafStrip), { color: authColor.cream88, flex: 1 }]}>
        <Text style={authText(authType.leafStripStrong)}>
          <Text style={{ color: authColor.cream }}>{leaves} Leaves</Text>
        </Text>{" "}
        are added to your balance the moment you verify.
      </Text>
    </View>
  );
}
