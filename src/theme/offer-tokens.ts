/**
 * Direction A — "the bar". Every value in the offer / out-of-reach spec, once.
 *
 * ── RELATIONSHIP TO `tokens.js` AND `post-tokens.ts` ────────────────────────
 *
 * Same arrangement as `post-tokens.ts`: nothing that already has a home in
 * `tokens.js` is retyped here, it is RE-EXPORTED, so a tuning pass on the
 * feed's palette moves this flow with it. What is genuinely new is this spec's
 * own vocabulary — the gap track, the settlement rows, the promise outline, the
 * threshold bar, the confirmation cells — plus the five surfaces the feed has
 * never needed.
 *
 * ── THE FIVE HEXES THAT ARE NEW, AND WHY EACH IS NOT AN ALIAS ───────────────
 *
 *   #F5F4EE  sunk       — the disabled DPA row and the History row. `tokens.js`
 *                         calls #F5F3EC `inset`; they are two ticks apart and
 *                         this spec names both, so this is NOT that value.
 *   #F2F8F3  tint-green — selected settlement row / hub / date. There is no
 *                         green tint in the feed at all.
 *   #F6EBE6  track-warm — the promise meter's track. `urgentWash` (#FBEEE9) is
 *                         the post flow's failure fill and reads pinker.
 *   #E6E4DA  photo-ph   — their-side block and empty value blocks. Heavier than
 *                         `control` (#F1EFE8), which is a chip fill.
 *   #B7D9BE  green/soft — the margin segment of the threshold bar. Used in
 *                         exactly one place, per §1.3.
 *
 * `surface/desk` (#EFEEE8) is deliberately absent. §1.1 says it dresses the
 * canvas behind a device frame in the artboards and never appears in-app; a
 * token for it here would be an invitation to use it.
 *
 * PLAIN TYPESCRIPT, like `post-tokens.ts`. Nothing in Tailwind's config reads
 * this file — the flow is styled through `style` props because most of it is
 * arithmetic on a running y — so there is no reason to give up types.
 */

import type { FilterFunction, TextStyle } from "react-native";

import { color as base, font, textStyle } from "./tokens";

/* ────────────────────────────── 1. COLOUR ───────────────────────────── */

export const offerColor = {
  /* 1.1 Surfaces */
  /** Every screen background, sheet and bottom bar. */
  paper: base.surface, // #FAFAF7
  /** Disabled row fill (the unverified DPA row), collapsed History row. */
  sunk: "#F5F4EE",
  /** Keyboard suggestion chips, drag handle track, inert fills. */
  quiet: base.divider, // #EDEBE3
  /** Selected settlement row, selected hub, selected date preset. */
  tintGreen: "#F2F8F3",
  /** Unfilled portion of the gap track; the Leaves meter track. */
  trackGreen: base.greenWash, // #EAF6EC
  /** Promise meter track, DPA progress track. */
  trackWarm: "#F6EBE6",
  /** Their-side block, avatar circles, value blocks with no photo. */
  photoPlaceholder: "#E6E4DA",
  /** Behind any bottom sheet. #14140F at 42%. */
  scrim: "rgba(20, 20, 15, 0.42)",

  /* 1.2 Ink */
  ink: base.ink, // #14140F
  inkSecondary: base.inkSecondary, // #5C5B52
  inkTertiary: base.inkMuted, // #8C8A7E
  inkDisabled: base.inkStale, // #A8A69A
  /** On #3DBE5A. NEVER #FAFAF7 — §1.2 says the contrast is the point. */
  onGreen: base.onGreen, // #0B2A15
  /** On a #14140F chip. */
  onDark: base.surface, // #FAFAF7

  /* 1.3 Greens */
  green: base.green, // #3DBE5A
  deep: base.forest, // #1B4D2B
  /** OUT-OF-REACH ONLY: the margin between your highest item and the threshold. */
  soft: "#B7D9BE",

  /* 1.4 Warm accent. One hex, four jobs, never as a large fill.
     NEVER for out-of-reach — §1.4's closing line. Out-of-reach is not an error. */
  warm: base.like, // #C56A4B

  /* 1.5 Borders and dividers */
  hairline: base.divider, // #EDEBE3
  rule: base.controlLine, // #E2E0D6
  strong: base.controlLineStrong, // #D8D6CC
  selected: base.forest, // #1B4D2B
  promise: base.like, // #C56A4B
  field: base.ink, // #14140F
  fieldActive: base.forest, // #1B4D2B
} as const;

/**
 * Border WIDTHS, kept beside the colours they belong to because §1.5 pairs
 * them and splitting the pair is how a 1.5 quietly becomes a 1.
 */
export const offerBorder = {
  hairline: 1,
  rule: 1,
  strong: 1,
  selected: 1.5,
  promise: 1.5,
  field: 1.5,
  /** §1.7 "Active": a solid left rule on a DPA row. */
  dpaActiveRule: 3,
} as const;

/**
 * §1.8 — the deadline urgency scale.
 *
 * DAYS DRIVE A MONO COLOUR AND NOTHING ELSE. Never a fill, never an icon
 * change; that restraint is the whole of the treatment. Today and overdue fall
 * out of the first branch because both are `<= 3`.
 */
export function deadlineInk(daysRemaining: number): string {
  if (daysRemaining <= 3) return offerColor.warm;
  if (daysRemaining <= 7) return offerColor.ink;
  return offerColor.inkSecondary;
}

/**
 * §1.9 — the out-of-reach tile.
 *
 * THREE PROPERTIES, and §7.2 is explicit that they are the only three: the
 * photo, the title's ink and the value line's ink. Border, radius, size and
 * position in the sort are untouched, and the DETAIL photo stays full colour —
 * the grey is a grid-level signal about reach, not a claim about the item.
 *
 * `filter` is a React Native style prop (0.76+, New Architecture, which this
 * app is on) and needs no library and no native module. `grayscale` then
 * `opacity`, in that order, because a filter list applies left to right and
 * that is the order §1.9 writes them in.
 */
export const outOfReach = {
  photoFilter: [{ grayscale: 1 }, { opacity: 0.62 }] as readonly FilterFunction[],
  titleInk: base.inkSecondary,
  valueInk: base.inkMuted,
} as const;

/* ─────────────────────────────── 2. TYPE ────────────────────────────── */

/**
 * `lineHeight` IS SET ONLY WHERE THE SPEC'S MULTIPLIER IS ABOVE 1.0 — the same
 * rule `tokens.js` and `post-tokens.ts` follow, for the same reason: React
 * Native clips a glyph to its line box, so a literal `lineHeight: 12` under a
 * 12px mono line shears the tail off a comma. Every 1.0 role below sits alone
 * in a container whose height is fixed independently, so dropping it moves
 * nothing and only decides whether the descender survives.
 *
 * THE GAP FIGURE IS THE ONE PLACE THE SPEC ASKS FOR A LINE HEIGHT BELOW ITS
 * SIZE — 44 on 40. That is a negative leading, deliberate, and it is honoured
 * with an explicit height on the block rather than by setting `lineHeight: 40`
 * on the Text, which on a 44px Bricolage cap would clip. See
 * `offerSize.gapFigureBlock`.
 *
 * `fontVariant: ["tabular-nums"]` on every figure that can change under the
 * user's thumb. Proportional digits make the whole block twitch sideways as a
 * value moves, which on the gap figure is the most visible element on screen.
 */
export const offerType = {
  /* Bricolage. Every Bricolage role in this spec is 700, which is why only the
     Bold face is referenced and the SemiBold cut never appears here. */
  screenHeading: { fontFamily: font.displayBold, fontSize: 25, lineHeight: 30, letterSpacing: -0.25 },
  sheetHeading: { fontFamily: font.displayBold, fontSize: 21, lineHeight: 25 },
  detailTitle: { fontFamily: font.displayBold, fontSize: 23, lineHeight: 28, letterSpacing: -0.23 },
  gapFigure: {
    fontFamily: font.displayBold,
    fontSize: 44,
    letterSpacing: -0.88,
    fontVariant: ["tabular-nums"],
  },
  /** `Even`. `Level` is Direction B's word and is deliberately not in this file. */
  gapWord: { fontFamily: font.displayBold, fontSize: 40, letterSpacing: -0.8 },

  /* Public Sans */
  navTitle: { fontFamily: font.sansSemi, fontSize: 15 },
  itemTitleRow: { fontFamily: font.sansSemi, fontSize: 15, lineHeight: 19 },
  itemTitleTile: { fontFamily: font.sansSemi, fontSize: 14, lineHeight: 18 },
  /** §1.9: family, weight and size unchanged from the feed convention. */
  tileValueLine: { fontFamily: font.sansSemi, fontSize: 12 },
  rowSubtitle: { fontFamily: font.sans, fontSize: 12, lineHeight: 16 },
  body: { fontFamily: font.sans, fontSize: 15, lineHeight: 23 },
  bodyDense: { fontFamily: font.sans, fontSize: 14, lineHeight: 21 },
  buttonPrimary: { fontFamily: font.sansBold, fontSize: 16 },
  buttonSecondary: { fontFamily: font.sansSemi, fontSize: 15 },
  buttonTertiary: { fontFamily: font.sansSemi, fontSize: 14 },
  chip: { fontFamily: font.sansSemi, fontSize: 13 },
  helper: { fontFamily: font.sans, fontSize: 12, lineHeight: 18 },
  errorText: { fontFamily: font.sans, fontSize: 13, lineHeight: 20 },
  errorHeading: { fontFamily: font.sansSemi, fontSize: 15, lineHeight: 20 },
  /**
   * The empty-shelf heading inside `Where you stand` — one plain-sentence line
   * between the mono label and the paragraph. Same cut as `errorHeading` but
   * its own name: §1.4 keeps out-of-reach out of the error vocabulary, and a
   * heading styled "as an error" would be the first thing to drift back in.
   */
  reachHeading: { fontFamily: font.sansSemi, fontSize: 15, lineHeight: 20 },

  /* JetBrains Mono */
  sectionLabel: {
    fontFamily: font.monoMedium,
    fontSize: 11,
    letterSpacing: 1.32,
    textTransform: "uppercase" as const,
  },
  leavesRow: { fontFamily: font.mono, fontSize: 12, fontVariant: ["tabular-nums"] },
  leavesDetail: { fontFamily: font.monoMedium, fontSize: 20, fontVariant: ["tabular-nums"] },
  /** Direction B's column figure. Kept because §4 sizes it; never rendered. */
  leavesColumn: { fontFamily: font.monoMedium, fontSize: 22, fontVariant: ["tabular-nums"] },
  amountField: { fontFamily: font.monoMedium, fontSize: 40, fontVariant: ["tabular-nums"] },
  tableFigure: { fontFamily: font.mono, fontSize: 15, lineHeight: 20, fontVariant: ["tabular-nums"] },
  trustTier: { fontFamily: font.mono, fontSize: 12 },
  deadline: { fontFamily: font.mono, fontSize: 11, fontVariant: ["tabular-nums"] },
  codeDigits: { fontFamily: font.monoMedium, fontSize: 40, letterSpacing: 4 },
  codeEntry: { fontFamily: font.monoMedium, fontSize: 34, letterSpacing: 3 },
  footnoteMono: { fontFamily: font.mono, fontSize: 11, lineHeight: 16 },
} satisfies Record<string, TextStyle>;

/** `textStyle()` from tokens.js, re-exported so a call site imports one file. */
export { textStyle };

/* ───────────────────────────── 3. SPACING ───────────────────────────── */

/**
 * §3.1 — the globals.
 *
 * `statusBar` and `navBar` are the CANVAS's values. A real safe-area inset wins
 * where it is larger (a notch) and these hold where the device reports none —
 * the same rule `PostScreenHost` applies, and for the same reason.
 */
export const offerSpace = {
  screenX: 16,
  /** §3.1: 12, because the 44px tap targets absorb the remaining 4. */
  navX: 12,
  statusBar: 44,
  navBar: 44,
  labelToContent: 10,
  rowGap: 10,
  paragraphToControl: 14,

  /**
   * §3.2's running y, expressed as the paddings that reproduce it.
   *
   * The table is absolute and React Native lays out in flow, so each section's
   * padding is DERIVED from the table rather than taken from §3.1's "18/16/22
   * unless stated" default — several of these sections do state otherwise, and
   * using the default would move the whole column. The arithmetic is written
   * beside each so a reader can check it against §3.2 without re-deriving it.
   */
  section: {
    /** 88 → 94 content, 150 content end, 164 hairline. */
    listingHeader: { top: 6, bottom: 14 },
    /** 165 → 183 label, 194 label end, 204 row, 260 row end, 274 hairline. */
    offering: { top: 18, bottom: 14 },
    /** 275 → 295 label … 447 copy end, 469 ≈ the table's 470 hairline. */
    gap: { top: 20, bottom: 22 },
    /** 471 → 489 label, 500, 510 row 1 … 710 row 3 end, 732 the bar. */
    settle: { top: 18, bottom: 22 },
    /** §3.4 — every band of the DPA proposal is 20/16/20 but the intro. */
    dpaIntro: { top: 10, bottom: 20 },
    dpaBand: { top: 20, bottom: 20 },
    /** §3.6 — the "Where you stand" insert on item detail. */
    reachInsert: { top: 18, bottom: 18 },
  },

  /**
   * The gap section's internal rhythm.
   *
   * Stated separately from `labelToContent` because §3.2 gives it 14 where
   * every other section gets 10. A section that quietly reused 10 would put the
   * figure four pixels high in all five gap situations.
   */
  gapBlock: {
    labelToFigure: 14, // 306 → 320
    figureToTrack: 14, // 364 → 378
    trackToLegend: 7, // 392 → 399
    legendToCopy: 14, // 410 → 424
  },

  /** §3.2's bottom bar: hairline, 12, the 52 button, 8, the footnote, 26. */
  bottomBar: {
    top: 12,
    buttonToFootnote: 8,
    bottom: 26,
    /** §3.4's bar puts consequence copy ABOVE the button instead. */
    consequenceToButton: 9,
  },

  /** §3.4 — the DPA proposal's internals. */
  dpa: {
    presetGap: 8,
    presetsToDateRow: 12,
    recordRowY: 10,
  },

  /** §3.6 — the detail insert's internals. */
  reach: {
    labelToCopy: 8,
    /** Empty-shelf variant only: label → heading → paragraph. */
    labelToHeading: 8,
    headingToCopy: 4,
    copyToBar: 14,
    barToLegend: 7,
    legendToRoutes: 14,
    routeGap: 10,
    routesToFootnote: 14,
  },

  /** §3.6 — the one-time prompt sheet. */
  prompt: {
    x: 20,
    top: 20,
    bottom: 26,
    handleToHeading: 16,
    headingToBody: 9,
    bodyToExamples: 16,
    examplesToList: 16,
    listItemGap: 11,
    listToButton: 16,
    /** §3.6 fixes the sheet's height at 390 rather than letting it hug. */
    height: 512,
  },
} as const;

/** §3.7 — radii. */
export const offerRadius = {
  sheet: 20,
  button: 10,
  row: 10,
  chip: 8,
  thumbnail: 8,
  tile: 10,
  track: 3,
  /** Direction B's value block. Recorded so §12 is checkable; never drawn. */
  columnBlock: 4,
  codeCell: 8,
} as const;

/* ──────────────────────────── 4. COMPONENTS ─────────────────────────── */

export const offerSize = {
  /**
   * The gap track. 358 at 390 and 328 at 360 — which is exactly the width left
   * inside a 16px gutter on each device, so it is laid out with `flex` rather
   * than as a literal. §4 and §9 state the same rule twice as two numbers, and
   * a literal would be wrong on every width that is neither.
   */
  track: { height: 14, radius: offerRadius.track, minSegment: 4, segmentGap: 2 },

  /**
   * §4: "44px type on 40px line". A negative leading — see the note in §2. The
   * BLOCK is 40 tall and the glyph overhangs it, which is what the artboard
   * shows; `lineHeight: 40` on a 44px Bricolage cap would clip the figure.
   */
  gapFigureBlock: 40,
  /** The mono suffix beside the figure, baseline-aligned −5. */
  gapSuffix: { size: 14, baselineShift: -5 },

  /** Direction B. Recorded from §4 so §12 is checkable; never rendered. */
  columnPair: { height: 300, heightTight: 268, blockMin: 15, innerX: 16 },

  /** §4 — the item picker sheet's row. 84 = 60 photo + 12 + 12. */
  pickerRow: { photo: 60, photoTight: 56, gap: 12, radio: 22, height: 84, padY: 12 },
  /** §4 — the in-flow "You're offering" row. */
  itemRow: { photo: 56, photoTight: 52, gap: 12, changeX: 14, changeY: 14 },
  /** §4 — a settlement radio row. */
  settleRow: { minHeight: 60, padX: 14, radio: 20, gap: 12 },
  /** §4 — a route row in the very-large-gap and out-of-reach sections. */
  routeRow: { minHeight: 60, minHeightReach: 64, icon: 19, gap: 12, chevron: 18 },

  /** §4 — the DPA amount field and its caret. */
  amountField: { padBottom: 10, caretW: 2, caretH: 34 },
  datePreset: { minHeight: 56 },
  dateRow: { minHeight: 52, icon: 18, chevron: 18 },
  recordRow: { padY: 10, padYWide: 11 },

  /** §4 — confirmation codes. Specced for Trades; resolved here, not drawn. */
  codeDisplay: { w: 56, h: 72, wTight: 50, hTight: 68, gap: 14 },
  codeEntry: { w: 68, h: 84, wTight: 62, hTight: 80 },

  /** §4 — Trades cards and rows. Resolved, not drawn. */
  tradeCard: { height: 88, thumb: 48, gap: 12 },
  tradeRow: { height: 72, thumb: 44, gap: 12 },
  historyRow: { height: 60, chevron: 18 },

  /** §4 — "mono 11 label, 21px below label to first item". */
  sectionHeader: { labelToFirst: 21 },

  /** §7.3 / §4 — the threshold bar. Same flex rule as the gap track. */
  /**
   * §7.3's bar, redrawn as one tick per value bracket. Ten equal cells with a
   * 2px gap: equal cells rather than proportional segments, because a bar
   * whose widths follow the true values leaks the ratio the bracket exists to
   * withhold. Same height and radius as the threshold bar it replaces.
   */
  bracketTicks: { height: 14, radius: offerRadius.track, gap: 2 },

  /** §4 — buttons. */
  button: { primary: 52, secondary: 52, tertiary: 44, splitGap: 8 },
  /** §5.2's "Not ID-verified" state puts a 48 outline button under the rows. */
  verifyButton: 48,

  /** §4 — every tap target, everywhere. */
  tapTarget: 44,

  /** The drag handle at the top of a sheet. */
  handle: { w: 40, h: 4 },

  /** §5.2's loading state: the figure becomes a 44 × 40 block of `quiet`. */
  figureSkeleton: { w: 44, h: 40 },
} as const;

/** §4 — icons. Size and stroke travel together, as they do in `tokens.js`. */
export const offerIcon = {
  nav: { size: 22, stroke: 1.9 },
  inlineRow: { size: 19, stroke: 1.7 },
  inlineRowSmall: { size: 18, stroke: 1.7 },
  warning: { size: 19, stroke: 1.8 },
  radioCheck: { size: 13, stroke: 2.7 },
  chevron: { size: 18, stroke: 1.8 },
  lock: { size: 18, stroke: 1.7 },
} as const;

/* ─────────────────────────── 9. 360px REFLOW ────────────────────────── */

/**
 * The single breakpoint, and everything that moves at it.
 *
 * HORIZONTAL AND TYPE ONLY. §9's closing line is explicit that row heights and
 * every 44px target are unchanged, which is why this is a table of widths and
 * three type sizes rather than a second layout — the same shape as
 * `post-tokens.board`.
 *
 * The two strings that shorten live here rather than in the copy module,
 * because which one is used is a function of the BOARD and not of the state.
 */
export const offerBoard = {
  breakpoint: 360,
  wide: {
    itemPhoto: 56,
    pickerPhoto: 60,
    tilePhoto: 164,
    codeDisplay: { w: 56, h: 72 },
    codeEntry: { w: 68, h: 84 },
    datePresets: ["2 weeks", "1 month", "2 months"] as readonly string[],
    gapFigure: 44,
    gapFigureTracking: -0.88,
    amountField: 40,
    withdraw: "Withdraw and offer again",
  },
  tight: {
    itemPhoto: 52,
    pickerPhoto: 56,
    tilePhoto: 150,
    codeDisplay: { w: 50, h: 68 },
    codeEntry: { w: 62, h: 80 },
    datePresets: ["2 wks", "1 mo", "2 mos"] as readonly string[],
    gapFigure: 40,
    /** −0.02em of 40, holding the wide board's proportion. */
    gapFigureTracking: -0.8,
    amountField: 36,
    withdraw: "Withdraw and re-offer",
  },
} as const;

export type OfferBoard = (typeof offerBoard)["wide"] | (typeof offerBoard)["tight"];

/* ─────────────────────── 8. KEYBOARD-UP GEOMETRY ────────────────────── */

/**
 * §8 — the IME budget.
 *
 * 844 − 358 = 486 of window, minus 44 status and 44 nav = 398 of content. These
 * are the CANVAS's numbers; the host applies `marginBottom: imeInset` and a
 * real device lands wherever it lands. They are kept because §8.1's and §8.2's
 * y tables are quoted against them, and a reader checking one needs the other.
 */
export const offerKeyboard = {
  nominalIme: 358,
  canvas: 844,
  contentBudget: 398,
  /** §8.1 — what the amount screen keeps: label + field + constraint row. */
  amountKeptHeight: 98,
  summaryLine: 40,
  /** §8.2 — the pinned state line under the nav while the message is focused. */
  pinnedLine: { height: 30, top: 6, bottom: 4, x: 12 },
} as const;

/* ────────────────────────────── 11. MOTION ──────────────────────────── */

/**
 * §11. Nothing bounces, nothing sweeps, and nothing celebrates.
 *
 * There is no `reducedMotion` duration table here: §11's last line turns every
 * entry below into an INSTANT state change and holds the sending fill at a
 * static 62%, so the components branch on the flag rather than on a zeroed
 * duration. A zeroed duration would still run an animation loop.
 */
export const offerMotion = {
  /** Track segments animate width; the figure cross-fades under them. */
  trackMs: 220,
  /** cubic-bezier(.2,.6,.2,1), as the four numbers `Easing.bezier` takes. */
  trackBezier: [0.2, 0.6, 0.2, 1] as const,
  figureFadeMs: 120,
  rowSelectMs: 120,
  sheetInMs: 260,
  scrimFadeMs: 180,
  /** The sending fill breathes .55 → 1 → .55. No indeterminate sweep. */
  sendingBreatheMs: 1400,
  sendingFrom: 0.55,
  sendingTo: 1,
  /** §5.2: the footer track fills to 62% and STAYS there. It is not progress. */
  sendingFill: 0.62,
  /** §5.2's "Sending" state dims content and nav to 45%. */
  sendingDim: 0.45,
} as const;
