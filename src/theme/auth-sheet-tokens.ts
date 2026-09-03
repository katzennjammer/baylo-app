/**
 * The auth spec — "sheet over a video band" — resolved once.
 *
 * ── THIS FILE IS MOSTLY RE-EXPORT, AND THAT IS THE POINT ────────────────────
 *
 * The auth screens now share the feed's palette. Every colour the spec's tables
 * name for a surface, a border or a piece of text already exists in
 * `tokens.js`, so it is aliased from there rather than written down a second
 * time: #FAFAF7 is `color.surface`, #F1EFE8 is `color.control`, #C56A4B is
 * `color.like`, and so on down the table. A hex literal below is therefore a
 * claim that the value genuinely does not exist in the feed's token set, and
 * the block it sits in says which ones those are and why.
 *
 * WHAT IS NEW, and had to be: the colours that only exist over the video band
 * (cream at five alphas, the five per-screen scrims, the placeholder footage
 * stripes), the focus ring, and the mint check on the Google card. None of them
 * has a feed counterpart — the feed has no dark surface and no focus ring.
 *
 * ── THE 360 BOARD IS A HORIZONTAL BOARD ─────────────────────────────────────
 *
 * Section 7 of the spec changes margins, a handful of type sizes and the back
 * button's width. It changes NO height, NO vertical gap and nothing in the
 * keyboard-up budget — the 56/9/52 field rhythm is identical on both. So
 * `authBoard()` returns only the values that move, and every vertical number
 * below is a plain constant shared by both widths.
 */

import { type TextStyle } from "react-native";

import { breakpoint, color, font } from "./tokens";

/* ────────────────────────────── 1. COLOUR ────────────────────────────── */

export const sheetColor = {
  /* Surfaces — all four are `color.surface` / `color.control`. */
  surface: color.surface,
  inputFill: color.control,
  inputFillFocus: color.surface,
  outlineFill: color.surface,
  /** Behind the video band, and the colour a frame resolves to before it
   *  decodes. `color.ink` — the spec uses one value for both roles. */
  frame: color.ink,

  /* Text */
  ink: color.ink,
  body: color.inkSecondary,
  label: color.inkMuted,
  placeholder: color.inkStale,

  /* Greens */
  green: color.green,
  onGreen: color.onGreen,
  /** Text buttons, focused label, confirm-match check, declaration icon. */
  forest: color.forest,

  /* Terracotta */
  errorLine: color.like,
  errorInk: color.urgent,
  panelFill: color.urgentWash,
  panelLine: color.urgentLine,

  /* Borders */
  inputLine: color.controlLine,
  outlineLine: color.controlLineStrong,
  dividerLine: color.divider,

  /** The "Cebu" pill's label. `color.greenWash`. */
  pillLabel: color.greenWash,

  /* ── Over the video. None of these has a feed counterpart. ──────────────
     Authored as literal rgba rather than as an opacity prop, so one value
     reads the same whether it lands on text, a fill or a border. */
  onVideo: "#FAFAF7",
  onVideoSecondary: "rgba(250,250,247,0.74)",
  onVideoEyebrow: "rgba(250,250,247,0.66)",
  onVideoMono: "rgba(250,250,247,0.62)",
  pillFill: "rgba(250,250,247,0.14)",
  cardFill: "rgba(250,250,247,0.12)",
  devChipFill: "rgba(20,20,15,0.50)",
  /** The check on the Google confirmation card. Over video only — it is too
   *  light to use on the sheet, which is what `forest` is for. */
  cardCheck: "#8FE3A6",

  /** The focus ring, 3px of spread behind a focused input. */
  focusRing: "rgba(61,190,90,0.16)",

  /* ── Pressed states. THE SPEC DRAWS NONE OF THESE. ─────────────────────
     It resolves four input states and two button fills and stops; a phone
     still has to answer a finger. Two of the three are quoted from values the
     spec does name, so only one hex here is genuinely invented:

       pressedSurface  `color.inset` — the fill a pressed picker field and a
                       pressed outline button take. A feed token, one step off
                       the sheet, and NOT the focused fill: the spec is explicit
                       that a picker field never takes focus styling.
       pressedGreen    invented. There is no darker green anywhere in the feed's
                       set, and dimming the label instead reads as disabled on a
                       control the size of the primary button.
       disabledInk     `color.inkStale`, promoted from the spec's own disabled
                       INPUT row to cover a disabled button's label as well. */
  pressedSurface: color.inset,
  pressedGreen: "#2FA449",
  disabledFill: color.control,
  disabledInk: color.inkStale,

  /* Placeholder footage. A dev stand-in for the video, and nothing else. */
  stripeA: "#3E3A33",
  stripeB: "#35322C",
} as const;

/**
 * The band's scrim — a single top-to-bottom gradient, per screen.
 *
 * EVERY STOP CARRIES THE SCRIM'S OWN RGB. `"transparent"` in React Native is
 * rgba(0,0,0,0), and Android interpolates gradients through premultiplied RGB,
 * so a list that ends in `transparent` fades through black and lays a grey
 * bloom over the footage. Both stops here are rgba(20,20,15,·) for that reason:
 * the RGB never changes across the ramp, only the alpha does.
 *
 * The heaviest is the rejection screen, and that is deliberate — it is the one
 * screen whose sheet is carrying bad news.
 */
export const scrim = {
  signIn: ["rgba(20,20,15,0.28)", "rgba(20,20,15,0.52)"],
  logIn: ["rgba(20,20,15,0.30)", "rgba(20,20,15,0.54)"],
  googleDob: ["rgba(20,20,15,0.32)", "rgba(20,20,15,0.56)"],
  createAccount: ["rgba(20,20,15,0.34)", "rgba(20,20,15,0.56)"],
  rejected: ["rgba(20,20,15,0.40)", "rgba(20,20,15,0.62)"],
} as const;

export type ScrimName = keyof typeof scrim;

/* ─────────────────────────────── 2. TYPE ─────────────────────────────── */

/**
 * `lineHeight` IS OMITTED WHERE THE SPEC'S MULTIPLIER IS 1.0.
 *
 * The same trap `tokens.js` documents for the feed: in CSS a 1.0 line height on
 * a single line is harmless, but React Native CLIPS text to its line box, so a
 * literal `lineHeight: 24` under a 24px wordmark shears the descender off the
 * "y" in Baylo. Every 1.0 role in the spec is one line inside a container whose
 * height is fixed independently — a 44 row, a 52 button, a 56 field — so
 * dropping it moves nothing and only decides whether the tail survives.
 *
 * Letter spacing is quoted in px, which is what React Native takes. The spec's
 * em figures are the source: −0.02em on a 24px wordmark is −0.48.
 */
export const authType = {
  /* Display — Bricolage Grotesque Bold */
  wordmarkSignIn: { fontFamily: font.displayBold, fontSize: 24, letterSpacing: -0.48 },
  wordmark: { fontFamily: font.displayBold, fontSize: 20, letterSpacing: -0.4 },
  wordmarkSignInTight: { fontFamily: font.displayBold, fontSize: 22, letterSpacing: -0.44 },
  wordmarkTight: { fontFamily: font.displayBold, fontSize: 19, letterSpacing: -0.38 },

  headlineSignIn: { fontFamily: font.displayBold, fontSize: 27, lineHeight: 32.4 },
  headlineSignInTight: { fontFamily: font.displayBold, fontSize: 25, lineHeight: 30 },
  headlineLogIn: { fontFamily: font.displayBold, fontSize: 25, lineHeight: 30 },
  headlineGoogleDob: { fontFamily: font.displayBold, fontSize: 25, lineHeight: 30.5 },
  headlineRejected: { fontFamily: font.displayBold, fontSize: 24, lineHeight: 29.3 },
  headlineCreate: { fontFamily: font.displayBold, fontSize: 23, lineHeight: 27.6 },
  headlineCreateTight: { fontFamily: font.displayBold, fontSize: 22, lineHeight: 26.4 },
  /** Keyboard up. The compact header's title; the same on both boards. */
  headlineCompact: { fontFamily: font.displayBold, fontSize: 19, lineHeight: 22.8 },

  /* Body — Public Sans */
  bodySignIn: { fontFamily: font.sans, fontSize: 15, lineHeight: 23.25 },
  body: { fontFamily: font.sans, fontSize: 14, lineHeight: 21.7 },
  subhead: { fontFamily: font.sans, fontSize: 13, lineHeight: 19.5 },

  /* The field */
  inputLabel: {
    fontFamily: font.sansMedium,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  inputLabelStrong: {
    fontFamily: font.sansSemi,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  inputValue: { fontFamily: font.sansMedium, fontSize: 15 },
  /** Masked. 0.18em on 15px is 2.7; revealed, the value drops to `inputValue`. */
  inputValueMasked: { fontFamily: font.sansMedium, fontSize: 15, letterSpacing: 2.7 },
  inputPlaceholder: { fontFamily: font.sans, fontSize: 14 },

  /* Controls */
  primaryLabel: { fontFamily: font.sansBold, fontSize: 16 },
  primaryLabelTight: { fontFamily: font.sansBold, fontSize: 15 },
  outlineLabel: { fontFamily: font.sansSemi, fontSize: 15 },
  textButtonSmall: { fontFamily: font.sansSemi, fontSize: 12 },
  textButton: { fontFamily: font.sansSemi, fontSize: 13 },
  textButtonFooter: { fontFamily: font.sansSemi, fontSize: 14 },
  footerPrompt: { fontFamily: font.sans, fontSize: 14 },
  googleGlyph: { fontFamily: font.sansSemi, fontSize: 11 },

  /* Blocks under the controls */
  declaration: { fontFamily: font.sans, fontSize: 12, lineHeight: 18 },
  declarationCompact: { fontFamily: font.sans, fontSize: 11, lineHeight: 16.5 },
  legal: { fontFamily: font.sans, fontSize: 12, lineHeight: 19.2 },
  errorMessage: { fontFamily: font.sansMedium, fontSize: 12, lineHeight: 16.8 },

  /* Mono — JetBrains Mono */
  dividerLabel: {
    fontFamily: font.mono,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  fieldCounter: { fontFamily: font.mono, fontSize: 11 },
  eyebrow: {
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  /** The rejection panel's dates and age. Medium, not Regular — see the note
   *  on MONO_MEDIUM below. */
  panelValue: { fontFamily: "JetBrainsMono-Medium", fontSize: 14 },
  panelValueTight: { fontFamily: "JetBrainsMono-Medium", fontSize: 13 },

  /* Over the video */
  panelLabel: {
    fontFamily: font.sansMedium,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  cardName: { fontFamily: font.sansSemi, fontSize: 14, lineHeight: 16.8 },
  cardEmail: { fontFamily: font.sans, fontSize: 12, lineHeight: 15.6 },
  pillLabel: { fontFamily: font.sansMedium, fontSize: 12 },
  avatarInitials: { fontFamily: font.sansSemi, fontSize: 13 },
  devChip: { fontFamily: font.mono, fontSize: 9 },
} satisfies Record<string, TextStyle>;

/**
 * The one font this file names by string rather than through `font`.
 *
 * `tokens.js` carries JetBrains Mono Regular only, because the feed's eyebrows
 * are 400. The spec's rejection-panel value is 500, and asking Android for
 * Regular at weight 500 gets a synthesised face rather than the Medium file —
 * the same reason `tokens.js` gives for naming every weight as its own family.
 * The file ships in `assets/fonts` and is registered in `app/_layout.tsx`.
 */
export const MONO_MEDIUM = "JetBrainsMono-Medium";

/**
 * Wraps a role for use as a `Text` style.
 *
 * One job — `includeFontPadding: false`. Android otherwise adds the font's own
 * ascent/descent padding on top of `lineHeight`, and every gap in section 3 of
 * the spec comes out several px larger than it was drawn. Android-only and
 * ignored elsewhere, which is why it is here and not repeated in forty roles.
 */
export function authText(role: TextStyle): TextStyle {
  return { includeFontPadding: false, ...role };
}

/* ───────────────────────────── 3. SPACING ────────────────────────────── */

/**
 * Every vertical number in the spec, and none of the horizontal ones.
 *
 * Section 7 is explicit that the 360 reflow touches nothing vertical: "Every
 * height, every gap in the vertical stack and the whole keyboard-up budget are
 * unchanged." So these are constants and the board below carries the rest.
 */
export const gap = {
  headlineToBody: 10,
  headlineToSubhead: 7,

  /** Body → the first control, per screen. */
  bodyToControl: {
    signIn: 28,
    logIn: 22,
    googleDob: 24,
    createAccount: 18,
    /** 4c: the compact header → the first field. */
    compact: 10,
  },

  /** Between inputs. 10 on log in, which has only two. */
  betweenInputs: 9,
  betweenInputsLogIn: 10,

  inputToMessage: 8,
  inputsToDeclaration: 12,
  inputsToDeclarationGoogleDob: 14,
  declarationToPrimary: 16,
  declarationToPrimaryGoogleDob: 20,
  /** 4c inverts the pair: the primary comes first, the line under it. */
  primaryToDeclarationCompact: 8,
  primaryToTextButton: 4,
  primaryToLegal: 14,
  /** Sign in: the outline button down to the legal block. Read off 4a's
   *  running-y (551 to 573), which the gap table itself does not list. */
  outlineToLegal: 22,

  buttonToDivider: 20,
  buttonToDividerLogIn: 18,

  googleGlyphToLabel: 10,
  outlineIconToLabel: 10,
  declarationIconToText: 8,
  errorIconToMessage: 7,

  panelRow: 10,
  rejectionIconToHeadline: 20,
  /** Google card: avatar → text → check. */
  cardInternal: 11,
} as const;

/* ───────────────────────────── 4. SIZES ──────────────────────────────── */

export const authSize = {
  /** 56 in every state, on every screen. The spec says "never changes". */
  input: 56,
  inputLabelToValue: 3,

  primaryButton: 52,
  outlineButton: 52,
  /** A text button's touch target, and the taller one used at footer level. */
  textButtonHit: 44,
  footerTextButtonHit: 48,
  footerRow: 56,
  footerRowSignIn: 64,

  /** The band's content row, and the status/safe-area space above it. */
  bandRow: 44,
  bandTop: 44,
  /** How far the sheet rides up over the band. */
  overlap: 28,

  backButton: 44,
  /** 4c's compact header: the same 44 target, squashed into a 32 row. */
  backCompactHeight: 32,
  compactHeaderRow: 32,

  googleGlyph: 20,
  googleGlyphRing: 1.6,
  rejectionCircle: 72,
  cardAvatar: 38,

  /** Focus ring spread, painted behind the input. */
  focusRing: 3,

  /** The rule beside the label in an "or" divider, and the row's own height. */
  dividerRule: 1,
  dividerLabelRow: 11,

  /** Field and outline-button border weights. */
  inputBorder: 1,
  inputBorderStrong: 1.5,
  outlineBorder: 1,
  panelBorder: 1,
} as const;

/** Declared band height, per screen. 4c has none — see section 6 of the spec. */
export const bandHeight = {
  signIn: 281,
  logIn: 281,
  googleDob: 281,
  rejected: 281,
  createAccount: 200,
  compact: 0,
} as const;

export const authRadius = {
  sheet: 28,
  input: 10,
  primaryButton: 10,
  outlineButton: 10,
  panel: 12,
  card: 12,
  /** Full circles: the rejection mark's 72 box, the card's 38 avatar. */
  circle: 36,
  avatar: 19,
  pill: 16,
  glyphRing: 10,
  devChip: 2,
} as const;

/**
 * Icons. Size and stroke travel together because the spec pairs them, and
 * splitting them is how a 1.5 stroke ends up on a 15px mark.
 */
export const authIcon = {
  back: { size: 22, stroke: 1.9 },
  backCompact: { size: 21, stroke: 1.9 },
  envelope: { size: 19, stroke: 1.6 },
  calendar: { size: 18, stroke: 1.6 },
  chevronDown: { size: 18, stroke: 1.7 },
  matchCheck: { size: 18, stroke: 2 },
  cardCheck: { size: 18, stroke: 2 },
  info: { size: 15, stroke: 1.7 },
  alert: { size: 15, stroke: 1.9 },
  rejectionAlert: { size: 32, stroke: 1.5 },
  /** Not in the spec's table. The gear is a development affordance the spec
   *  does not draw; it takes the back chevron's geometry so the two ends of the
   *  band row weigh the same. */
  gear: { size: 21, stroke: 1.7 },
  /** The check on a selected option inside a picker sheet. Same as the spec's
   *  confirm-match check, which is the nearest drawn mark. */
  optionCheck: { size: 18, stroke: 2 },
} as const;

/* ──────────────────────────── 5. THE BOARD ───────────────────────────── */

/**
 * The horizontal reflow, and nothing else.
 *
 * `breakpoint.tight` is the feed's own 360 — the same single breakpoint, so a
 * device that gets the feed's tight header gets the auth screens' tight board.
 */
export interface AuthBoard {
  /** Sheet horizontal padding: 24 / 20. Content width is width − 2 × this. */
  sheetX: number;
  /** Video band content padding: 16 / 12. */
  bandX: number;
  /** …and 12 / 8 when a 44-wide back button leads the row. */
  bandXWithBack: number;
  /** Input horizontal padding, at 1px border and at 1.5px. */
  inputX: number;
  inputXStrong: number;
  /** Back button width. Height is 44 on both. */
  backWidth: number;
  /** Rejection panel padding: vertical / horizontal. */
  panelY: number;
  panelX: number;
  /** Google confirmation card padding. */
  cardPad: number;
  tight: boolean;
}

const regular: AuthBoard = {
  sheetX: 24,
  bandX: 16,
  bandXWithBack: 12,
  inputX: 14,
  inputXStrong: 13,
  backWidth: 44,
  panelY: 14,
  panelX: 16,
  cardPad: 12,
  tight: false,
};

const tight: AuthBoard = {
  sheetX: 20,
  bandX: 12,
  bandXWithBack: 8,
  inputX: 13,
  inputXStrong: 12,
  backWidth: 40,
  panelY: 12,
  panelX: 14,
  cardPad: 10,
  tight: true,
};

export function authBoard(width: number): AuthBoard {
  return width <= breakpoint.tight ? tight : regular;
}

/* ───────────────────────────── 6. KEYBOARD ───────────────────────────── */

export const keyboardRule = {
  /**
   * Past this the sheet cannot hold the whole 4c budget, so the field stack
   * becomes the scrolling region and the primary button pins to the sheet
   * bottom. The fields do NOT shrink — that is the spec's own instruction, and
   * it is what keeps the 56/9/52 rhythm identical in every state.
   */
  tallImeThreshold: 380,
  /** Above and below the pinned button in that arrangement. */
  pinnedButtonY: 12,
  /** Sheet padding-top: 24 at rest, 26 on sign in and with the IME up. */
  sheetPadTopRest: 24,
  sheetPadTopSignIn: 26,
  sheetPadTopCompact: 26,
  /** Sheet top animates 0 → 172 / 253 on dismiss, 220ms ease-out. */
  restoreMs: 220,
} as const;
