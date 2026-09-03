/**
 * Direction C — "Thumb Bar". The auth screens' implementation spec, once.
 *
 * Same arrangement as `tokens.js` is for the feed, and for the same reason: the
 * spec resolves everything to the pixel — 51.5 field blocks, 2.6 px tracking,
 * a 0.82 wordmark line height — and scattering that across four components as
 * NativeWind arbitrary values is how it drifts. Components compose from here.
 *
 * WHY .ts AND NOT .js. `tokens.js` and `palette.js` are CommonJS because
 * `tailwind.config.js` requires them through Node before any TypeScript
 * transform runs. Nothing here is mapped into Tailwind — every value below is
 * too specific to be a useful utility — so this file is free to be typed.
 *
 * RELATIONSHIP TO THE OTHER TWO TOKEN FILES: none. `tokens.js` dresses the feed
 * (light), `palette.js` dresses Profile and the legacy auth card. This dresses
 * the (auth) group's two screens and nothing else. The three are not merged
 * because merging them would mean touching screens this task does not.
 *
 * The three greens are quoted from `tokens.js` unchanged — `color.green`,
 * `color.onGreen`, `color.like`. Everything else is new: the feed has no dark
 * surface set to borrow a cream ramp from.
 */

import { type TextStyle } from "react-native";

/* ────────────────────────────── 1. COLOUR ────────────────────────────── */

export const authColor = {
  /** Terminal colour of the lower scrim, and the ground painted behind the
   *  video before its first frame decodes. The screen is never black. */
  ground: "#06140B",

  /* Greens. The first two are `color.green` / `color.onGreen` from tokens.js. */
  green: "#3DBE5A",
  greenPress: "#2FA449",
  onGreen: "#0B2A15",

  /* Cream ramp. Authored as literal rgba rather than an opacity prop so the
     value is the same whether it lands on text, a rule or a border. */
  cream: "#F7F5EC",
  cream88: "rgba(247,245,236,0.88)",
  cream72: "rgba(247,245,236,0.72)",
  cream56: "rgba(247,245,236,0.56)",
  cream46: "rgba(247,245,236,0.46)",
  cream34: "rgba(247,245,236,0.34)",
  cream22: "rgba(247,245,236,0.22)",
  cream14: "rgba(247,245,236,0.14)",

  /* Warm accent. Errors and the eyebrow. Never decorative — see the spec. */
  /** The eyebrow, and nothing else. Lightened off `like` so 10px mono clears
   *  contrast against the scrim; `like` itself does not at that size. */
  eyebrowInk: "#E08D6B",
  /** `color.like` from tokens.js. The error-state field rule. */
  terra: "#C56A4B",
  /** Error strip fill. Fully opaque — it must not sample the video. */
  terraDeep: "#9E4128",
  /** Error icon, error field label, field-level message, the strip's link. */
  terraLt: "#F2B8A0",
  /** Error strip body copy. 7.6:1 on terraDeep. */
  terraInk: "#FFEDE4",

  /** The welcome-grant strip's border. The only border in the flow. */
  leafLine: "rgba(61,190,90,0.38)",
} as const;

/* ────────────────────────────── 2. SCRIM ─────────────────────────────── */

/**
 * Three flat layers over the video. No blur, no saturation filter, no
 * backdrop-filter — none of which React Native can do cheaply over a playing
 * video, and none of which the spec needs.
 *
 * EVERY STOP CARRIES THE SCRIM'S OWN RGB, INCLUDING THE ZERO-ALPHA ONES.
 * `"transparent"` in React Native resolves to rgba(0,0,0,0), and Android
 * interpolates gradients through premultiplied RGB — so a stop list that ends
 * in `transparent` fades through BLACK and lays a visible grey bloom over the
 * footage. `rgba(6,18,10,0)` interpolates cleanly because its RGB already
 * matches its neighbour. This is the single most common way this scrim gets
 * broken by a later edit.
 *
 * Heights are fractions of the screen, applied by the consumer against real
 * layout height — not against the spec's 844, which is a canvas and not a
 * device.
 */
export const authScrim = {
  /** Layer 2 — flat, edge to edge. */
  tint: "rgba(7, 20, 12, 0.34)",

  /** Layer 3 — protects eyebrow, wordmark and subtitle. */
  top: {
    heightRatio: 0.5,
    colors: [
      "rgba(6,18,10,0.84)",
      "rgba(6,18,10,0.68)",
      "rgba(6,18,10,0.56)",
      "rgba(6,18,10,0.44)",
      "rgba(6,18,10,0.18)",
      "rgba(6,18,10,0)",
    ] as const,
    locations: [0, 0.22, 0.44, 0.66, 0.85, 1] as const,
  },

  /**
   * Layer 4, two-field screens — sign in and check-your-email.
   *
   * The five stops hold 0.56 to 44% and 0.44 to 66% before dropping fast. An
   * earlier three-stop version put the subtitle at 3.89:1 by leaving a valley
   * between this layer and the one above; this shape closes it while leaving
   * the empty middle almost as bright.
   */
  bottomTwoField: {
    heightRatio: 0.56,
    colors: [
      "rgba(6,18,10,0)",
      "rgba(7,19,11,0.30)",
      "rgba(7,20,12,0.72)",
      "rgba(6,19,11,0.92)",
      authColor.ground,
    ] as const,
    locations: [0, 0.18, 0.38, 0.58, 1] as const,
  },

  /** Layer 4, four-field screens — create account. Starts higher. */
  bottomFourField: {
    heightRatio: 0.66,
    colors: [
      "rgba(6,18,10,0)",
      "rgba(7,19,11,0.30)",
      "rgba(7,20,12,0.62)",
      "rgba(6,19,11,0.84)",
      "rgba(6,19,11,0.93)",
      authColor.ground,
    ] as const,
    locations: [0, 0.1, 0.26, 0.44, 0.66, 1] as const,
  },

  /**
   * Keyboard up. The visible window collapses, so all three layers re-scope to
   * it — the tint stops at the IME rather than running under it, and both
   * gradients are absolute px against the visible window, not fractions.
   */
  keyboard: {
    topHeight: 150,
    topColors: ["rgba(6,18,10,0.84)", "rgba(6,18,10,0.52)", "rgba(6,18,10,0)"] as const,
    topLocations: [0, 0.54, 1] as const,
    /** Offset from the TOP of the visible window, and its height. */
    bottomTop: 232,
    bottomHeight: 280,
    bottomColors: [
      "rgba(6,18,10,0)",
      "rgba(7,19,11,0.34)",
      "rgba(7,20,12,0.74)",
      "rgba(6,19,11,0.92)",
      authColor.ground,
    ] as const,
    bottomLocations: [0, 0.16, 0.4, 0.64, 1] as const,
  },
} as const;

/* ─────────────────────────────── 3. TYPE ─────────────────────────────── */

const font = {
  display: "BricolageGrotesque-Bold",
  sans: "PublicSans-Regular",
  sansMedium: "PublicSans-Medium",
  sansSemi: "PublicSans-SemiBold",
  sansBold: "PublicSans-Bold",
  /** Added for this direction — every eyebrow and field label is 500.
   *  Asking Android for JetBrainsMono-Regular at weight 500 synthesises. */
  mono: "JetBrainsMono-Medium",
} as const;

/**
 * DISPLAY LINE HEIGHTS ARE NOT SET DIRECTLY, AND THAT IS THE WHOLE TRICK.
 *
 * The spec's wordmark is 150px on a 123px line — a 0.82 multiplier. In CSS that
 * simply overlaps the line boxes. React Native CLIPS text to its line box, so
 * `lineHeight: 123` under a 150px font shears the descender clean off the "y"
 * in Baylo. `tokens.js` documents the same trap for the feed's 24px wordmark.
 *
 * So every sub-1.0 role below sets `lineHeight` EQUAL to `fontSize` — always
 * safe, never clips — and pulls the box back to the intended height with equal
 * negative margins. The glyph is untouched; only the space around it moves.
 *
 *   marginTop = marginBottom = (fontSize − intendedLineHeight) / 2
 *
 * The two-line headline cannot use this: negative vertical margins on a single
 * Text would close the gap between its lines as well as around them. It is
 * rendered as TWO Text nodes with `headlineLine2Offset` on the second, which
 * puts the inter-line advance at exactly 54.56 without touching either glyph.
 */
export const authType = {
  /* Display — Bricolage Grotesque Bold */
  /**
   * THE WORDMARK IS NOT A FIXED SIZE. It is the largest size that FITS.
   *
   * The spec's 150 (390) and 140 (360) do not fit, and the failure is silent
   * apart from the glyphs it eats: the Text is `numberOfLines={1}` inside a
   * column of `width − 2 × margin`, so it ellipsises and the screen renders
   * "Ba…" instead of "Baylo".
   *
   * Measured off the shipped `BricolageGrotesque-Bold.ttf` rather than assumed
   * — `hmtx`, 1000 units/em: B 683, a 585, y 602, l 274, o 609, Σ 2753, so
   * 2.753 em of advance. The GPOS `kern` feature carries the four pairs at
   * a combined −1 unit (−0.001 em), which is noise and is ignored.
   *
   *   390 board:  150 × (2.753 − 4 × 0.05) = 383.0 px of ink in a 342 column.
   *   360 board:  140 × (2.753 − 4 × 0.05) = 357.4 px of ink in a 320 column.
   *
   * Both overflow, by 41 and 37 px. There is no device width at which the spec
   * value was ever safe, which is why the fix is a fit test and not a smaller
   * pair of constants — the next board would break the same way.
   *
   * `wordmarkFit` below is that test. It keeps every proportion the spec
   * defines (the −0.05 em tracking, the 0.82 line ratio) and moves only the one
   * number the spec got wrong.
   */
  wordmark: {
    /** Σ advance of B a y l o, in em. Measured from the TTF's `hmtx`. */
    advanceEm: 2.753,
    /** The spec's tracking as a fraction of the size: −7.5 / 150, −7 / 140. */
    trackingEm: -0.05,
    /**
     * How many gaps the tracking is charged for in a fit test.
     *
     * Android's Minikin adds `letterSpacing` to EVERY glyph's advance — five
     * here — and shifts each glyph by half of it, so the ink runs half a step
     * past the measured width. UIKit's `kern` charges the four PAIRS. Four is
     * the wider of the two answers, so four is the one a fit test has to use
     * for the result to hold on both platforms.
     */
    trackedGaps: 4,
    /** The spec's line ratio: 150 → 123, 140 → 114.8, 72 → 59.04. */
    lineRatio: 0.82,
    /**
     * Slack between the ink and the margin. Advance sums are exact, but
     * hinting, `includeFontPadding` and the platform's own rounding are not,
     * and 2% of a 130px wordmark is 2.6px — cheaper than an ellipsis.
     */
    slack: 0.98,
    /** The spec's drawn sizes, kept as the ceiling a fit may not exceed. */
    capScreen1: 150,
    capScreen2: 72,
  },
  /** Keyboard up. Ratio is exactly 1.0, so no compensation. Fits every board:
   *  34 × 2.553 = 87px. */
  wordmarkCollapsed: {
    fontFamily: font.display,
    fontSize: 34,
    lineHeight: 34,
    letterSpacing: -1.7,
    marginVertical: 0,
  },
  /** Check your email. Two Text nodes — see the note above. */
  headline: {
    fontFamily: font.display,
    fontSize: 62,
    lineHeight: 62,
    letterSpacing: -3.1,
  },
  /** 54.56 − 62. Applied as marginTop to the SECOND line only. */
  headlineLine2Offset: -7.44,

  /* Mono — JetBrains Mono Medium, uppercase */
  eyebrow: {
    fontFamily: font.mono,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 2.6,
    textTransform: "uppercase",
  },
  fieldLabel: {
    fontFamily: font.mono,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },

  /* UI — Public Sans */
  subtitle: { fontFamily: font.sans, fontSize: 15, lineHeight: 22 },
  fieldValue: { fontFamily: font.sans, fontSize: 17, lineHeight: 22 },
  fieldMessage: { fontFamily: font.sans, fontSize: 11.5, lineHeight: 15 },
  /** Single line inside a fixed 64px row — no lineHeight, per the 1.0 rule. */
  barLabel: {
    fontFamily: font.sansBold,
    fontSize: 16,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  googleLabel: { fontFamily: font.sansSemi, fontSize: 14, lineHeight: 20 },
  footerPrefix: { fontFamily: font.sans, fontSize: 14, lineHeight: 20 },
  footerLink: { fontFamily: font.sansSemi, fontSize: 14, lineHeight: 20 },
  errorStripBody: { fontFamily: font.sansMedium, fontSize: 13, lineHeight: 18 },
  checkEmailBody: { fontFamily: font.sans, fontSize: 15, lineHeight: 23 },
  leafStrip: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 18 },
  /** The address inside the check-email body. Same metrics, heavier face. */
  checkEmailStrong: { fontFamily: font.sansSemi, fontSize: 15, lineHeight: 23 },
  leafStripStrong: { fontFamily: font.sansBold, fontSize: 13.5, lineHeight: 18 },
} as const;

/* ────────────────────────────── 4. LAYOUT ────────────────────────────── */

/**
 * Two boards, and one breakpoint between them.
 *
 * The spec is drawn at 390 × 844 and reflowed at 360 × 800. Anything at or
 * below 360 gets the compact board; everything above gets the regular one.
 * There is no interpolation, deliberately — the reflow changes the margin and
 * the wordmark, and a half-step between the two lands the wordmark somewhere
 * the spec never measured.
 */
export const AUTH_COMPACT_MAX_WIDTH = 360;

export interface AuthBoard {
  /** The single vertical edge everything starts on. */
  margin: number;
  /** Gear and back button: distance from the screen edge, and their top. */
  chromeInset: number;
  chromeTop: number;
  /** Brand block. */
  brandTop: number;
  brandGap: number;
  /** Distance from the bottom of the screen to the bottom of the form group. */
  formBottom: number;
  /** Sign in: fields ↔ actions. */
  formOuterGap: number;
  /** Sign in: between the two fields. */
  fieldGap: number;
  /** Sign in: between the bar-adjacent rows. */
  actionGap: number;
  /** Create account: fields ↔ footer, and between the four fields. */
  registerOuterGap: number;
  registerFieldGap: number;
  /** Error strip → first field. */
  stripToForm: number;
  /** Fallback bottom safe-area inset when the measured one is smaller. */
  barSafeFallback: number;
}

const regular: AuthBoard = {
  margin: 24,
  chromeInset: 12,
  chromeTop: 52,
  brandTop: 104,
  brandGap: 10,
  formBottom: 110,
  formOuterGap: 26,
  fieldGap: 18,
  actionGap: 8,
  registerOuterGap: 22,
  registerFieldGap: 16,
  stripToForm: 16,
  barSafeFallback: 34,
};

const compact: AuthBoard = {
  margin: 20,
  chromeInset: 8,
  chromeTop: 44,
  brandTop: 84,
  brandGap: 10,
  formBottom: 100,
  formOuterGap: 24,
  fieldGap: 16,
  actionGap: 6,
  /* The reflow table gives sign in's outer gap as 26 → 24. Create account's is
     22 at the regular board; the same −2 delta is applied here. That is the one
     extrapolated number in this file, and it is flagged rather than silent. */
  registerOuterGap: 20,
  registerFieldGap: 16,
  stripToForm: 16,
  barSafeFallback: 24,
};

export function authBoard(width: number): AuthBoard {
  return width <= AUTH_COMPACT_MAX_WIDTH ? compact : regular;
}

/* ──────────────────────────── 5. COMPONENTS ──────────────────────────── */

export const authSize = {
  /**
   * The field, part by part. Sums to 52, not the spec table's 51.5.
   *
   * The difference is deliberate and it comes from the spec's own component
   * rule: the rule sits in a FIXED 2px track with a 1.5px child at rest, so
   * that focus — which paints the full 2 — cannot shift the layout by half a
   * pixel. Laying out the track at 1.5 would reintroduce exactly the reflow
   * that rule exists to prevent. The form is bottom-anchored, so the extra
   * 0.5 per field travels up into the empty middle: 1px on sign in, 2px on
   * create account, out of 114 and 177 respectively.
   */
  field: {
    labelHeight: 12,
    labelToValue: 6,
    valueHeight: 22,
    valueToRule: 10,
    /** Fixed track. The painted rule is a bottom-aligned child of it. */
    ruleTrack: 2,
    ruleRest: 1.5,
    ruleFocus: 2,
    messageTop: 4,
    messageHeight: 15,
    /** 12 + 6 + 22 + 10 + 2 */
    block: 52,
    /** messageTop + messageHeight */
    messageBlock: 19,
  },

  /** Show/hide. Overhangs the margin by 12 so the glyph lands on it. */
  eyeButton: { size: 44, top: 8, right: -12 },

  /** The action bar. Content row is 64 on every board and in every state. */
  bar: { contentHeight: 64 },

  googleRow: { height: 56, gap: 12, hairline: 1 },
  footerRow: { height: 44, gap: 5 },
  chromeButton: 44,

  errorStrip: { paddingTop: 15, paddingBottom: 16, gap: 10, iconTop: 1 },

  /** The only radius in the flow, and it earns it by being the reward. */
  leafStrip: { radius: 4, border: 1, padding: 14, gap: 11, minHeight: 56 },

  /**
   * The collapsed brand row, keyboard up. The spec defines these on the 360
   * board only; they are used on both, because a device wide enough for the
   * regular board is not wide enough to want a different collapsed row.
   */
  collapsedBrand: { top: 36, chromeTop: 30 },

  /** Check your email. */
  checkEmail: { eyebrowToHeadline: 14, bodyToStrip: 18 },

  /**
   * Clearance between the bottom of the form group and the top of the bar.
   *
   * The spec's 110 / 100 form-bottoms are exactly barHeight + 12 at its assumed
   * safe insets, so the relationship is stored rather than the sum — that keeps
   * it true on a device whose measured inset is not 34 or 24.
   */
  formClearance: { rest: 12, keyboard: 20 },
} as const;

export const authIcon = {
  gear: { size: 21, stroke: 1.6 },
  back: { size: 22, stroke: 1.8 },
  alert: { size: 18, stroke: 1.7 },
  google: { size: 19, stroke: 1.6 },
  chevron: { size: 16, stroke: 1.8 },
  eye: { size: 19, stroke: 1.6 },
  arrow: { size: 20, stroke: 1.9 },
  leaf: { size: 18, stroke: 1.7 },
} as const;

/* ────────────────────────────── 6. MOTION ────────────────────────────── */

export const authMotion = {
  /** Rule colour and weight, and the label colour, on focus. */
  focusMs: 140,
  /** Half period — 530 on, 530 off. */
  caretBlinkMs: 530,
  /** Brand collapse when the keyboard opens. Opacity cross-fade between two
   *  pre-rendered wordmarks; animating fontSize re-measures every frame. */
  brandCollapseMs: 180,
  errorStripMs: 200,
} as const;

/* ─────────────────────────────── HELPERS ─────────────────────────────── */

/**
 * Wraps a type role for use as a Text style.
 *
 * One job: `includeFontPadding: false`. Android otherwise adds the font's own
 * ascent/descent padding on top of `lineHeight`, and every measured gap in
 * section 4 comes out several px larger than it was drawn. Android-only and
 * ignored elsewhere, which is why it lives here instead of in all twenty roles.
 */
export function authText<T extends object>(role: T): T & TextStyle {
  return { includeFontPadding: false, ...role } as T & TextStyle;
}

/**
 * The wordmark's type style at the largest size that fits `available` px.
 *
 * `cap` is the spec's drawn size and the ceiling — a wider screen gets the
 * spec's own proportions, never a bigger wordmark than it asked for. Narrower
 * screens get the size that fits, computed from the measured advance sum in
 * `authType.wordmark` rather than from a second table of guesses.
 *
 * The returned size is floored to a whole px. Fractional font sizes round
 * differently between measurement and paint on Android, and a wordmark that
 * fits by 0.4px is one rounding away from an ellipsis.
 *
 * `lineHeight` is EQUAL to `fontSize` and the 0.82 ratio is applied as negative
 * margin — the trap documented at the top of section 3. Do not "simplify" this
 * to `lineHeight: fontSize * lineRatio`; it shears the descender off the y.
 */
export function wordmarkFit(available: number, cap: number): TextStyle & { marginVertical: number } {
  const w = authType.wordmark;
  const emPerPx = w.advanceEm + w.trackedGaps * w.trackingEm;
  const fontSize = Math.max(1, Math.min(cap, Math.floor((available * w.slack) / emPerPx)));

  return {
    fontFamily: font.display,
    fontSize,
    lineHeight: fontSize,
    letterSpacing: fontSize * w.trackingEm,
    marginVertical: (fontSize - fontSize * w.lineRatio) / 2,
  };
}

/** The ink width "Baylo" paints at `fontSize`. Exported for the fit assertions
 *  in `scripts/verify-wordmark.cjs`; nothing in the app calls it. */
export function wordmarkWidth(fontSize: number): number {
  const w = authType.wordmark;
  return fontSize * (w.advanceEm + w.trackedGaps * w.trackingEm);
}
