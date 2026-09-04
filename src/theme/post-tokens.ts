/**
 * Direction A — "the tick rail". Every value in the Post-an-item spec, once.
 *
 * ── RELATIONSHIP TO `tokens.js` ─────────────────────────────────────────────
 *
 * This file does not restate a value that file already holds. Every hex the two
 * specs share is RE-EXPORTED from `color` below rather than typed again, so a
 * tuning pass on the feed's palette moves this flow with it. What is genuinely
 * new here is the flow's own vocabulary — the tick rail, the value slider, the
 * hub row, the camera marker, the four duplicate outcomes, the veils over a
 * photo mid-upload — plus the six alpha fills the feed has no use for.
 *
 * Where a name differs it is because the two specs disagree about the ROLE, not
 * about the value: this spec's "inset surface" is #F1EFE8, which `tokens.js`
 * calls `control` because that is what it dresses over there. The alias is
 * written out rather than papered over, so a reader who greps for #F1EFE8 finds
 * one definition and two names for it.
 *
 * PLAIN TYPESCRIPT, unlike `tokens.js`. Nothing in Tailwind's config reads this
 * file — the flow is styled entirely through `style` props, because half of it
 * is arithmetic on a running y — so there is no reason to give up types.
 */

import type { TextStyle } from "react-native";

import { color as base, font, textStyle } from "./tokens";

/* ────────────────────────────── 1. COLOUR ───────────────────────────── */

export const postColor = {
  /* Surfaces. There is NO elevated surface in this flow: cards are replaced by
     hairlines and inset fills, and the only two things that cast a shadow are
     the value slider's thumb and the draft sheet. */
  surface: base.surface, // #FAFAF7
  /** Inset — field fill, correction strip, notices, draft row, marker tooltip. */
  inset: base.control, // #F1EFE8
  /** Add-photo tile fill, under the dashed border. */
  addTile: base.storyPost, // #F3F2EC
  /** Failed-DUPLICATE panel only. Never a failed upload, which has no box. */
  failPanel: base.urgentWash, // #FBEEE9
  greenWash: base.greenWash, // #EAF6EC
  greenLine: base.greenLine, // #D2EAD8

  /* The six alpha fills. Written as literals because they are compositing
     decisions about what sits UNDER them — a photo, in every case — and there
     is no opaque equivalent to name. */
  /** Camera marker chip and badge, over a photo. */
  markerFill: "rgba(20, 20, 15, 0.62)",
  /** The 44 remove button on the hero photo. */
  removeFill: base.captionFill, // rgba(20, 20, 15, 0.55)
  /** Dev-placeholder caption chip. Not shipped over a real photo. */
  captionChip: "rgba(250, 250, 247, 0.86)",
  /** Over the photo while its bytes are still going up. */
  veilUploading: "rgba(250, 250, 247, 0.34)",
  /** Over a photo whose upload failed. Heavier — it is not coming back on its own. */
  veilFailed: "rgba(250, 250, 247, 0.42)",
  /** Over a photo the duplicate check blocked. Heaviest: it is not being posted. */
  veilBlocked: "rgba(250, 250, 247, 0.50)",
  /** Behind the draft sheet. */
  scrim: "rgba(20, 20, 15, 0.42)",

  /* Text */
  ink: base.ink, // #14140F
  inkSecondary: base.inkSecondary, // #5C5B52
  inkMuted: base.inkMuted, // #8C8A7E
  inkDisabled: base.inkStale, // #A8A69A
  onGreen: base.onGreen, // #0B2A15
  /** The marker label, over a photo. The only on-dark text in the flow. */
  onDark: base.greenWash, // #EAF6EC

  /* Greens */
  forest: base.forest, // #1B4D2B
  green: base.green, // #3DBE5A
  /** Focus ring, 3 px spread. Also the selected-condition ring. */
  focusRing: "rgba(61, 190, 90, 0.16)",

  /* Warm accent. FOUR PLACES, and the spec names them: a failed upload, a
     warned duplicate, a failed duplicate, and "Discard this draft". A fifth use
     is a bug, not a judgement call. */
  warm: base.like, // #C56A4B — the rules
  warmInk: base.urgent, // #B0553A — headings, icons, the discard label
  warmLine: base.urgentLine, // #F0D8CE

  /* Borders, dividers, hairlines */
  divider: base.divider, // #EDEBE3
  line: base.controlLine, // #E2E0D6
  lineStrong: base.controlLineStrong, // #D8D6CC
  dashed: base.dashed, // #C9C7BC
  /** The IME accessory bar's top rule and its modifier keys. */
  imeLine: "#CFCDC3",
  /** The IME accessory bar's own fill. */
  imeBar: "#EFEEE7",

  /* Skeleton and determinate progress */
  skeleton: base.skeleton, // #EBE9E0 — result line, confirm button, photo area
  skeletonSoft: base.skeletonSoft, // #EFEDE5 — eyebrows, metadata, change button
  /** The 3 px upload bar's track. Sits over a photo, so it is not `line`. */
  uploadTrack: "rgba(20, 20, 15, 0.12)",

  /* Buttons */
  primary: base.green,
  /** Held. The spec's own value — not an opacity on `primary`. */
  primaryPressed: "#35A94F",
  disabledFill: base.controlLine, // #E2E0D6
  /** The discard confirmation's destructive fill. The one white label in the flow. */
  discardFill: base.like, // #C56A4B
  discardLabel: "#FFFFFF",
} as const;

/* ─────────────────────────────── 2. TYPE ────────────────────────────── */

/**
 * `lineHeight` IS SET ONLY WHERE THE SPEC'S MULTIPLIER IS ABOVE 1.0 — the same
 * rule as `tokens.js`, and for the same reason: React Native clips a glyph to
 * its line box, so a literal `lineHeight: 56` under a 56 px numeral shears the
 * tail off a 4 or a 9. Every 1.0 role below is one line inside a container
 * whose height is fixed independently, so dropping it moves nothing.
 *
 * `fontVariant: ["tabular-nums"]` on both Leaves numerals, because they are
 * driven by a slider: proportional digits make the whole block twitch sideways
 * as 455 becomes 460.
 */
export const postType = {
  stepHeading: { fontFamily: font.displayBold, fontSize: 26, lineHeight: 31.2 },
  /** Keyboard up. The heading shrinks rather than leaving, on every step but 2. */
  stepHeadingTight: { fontFamily: font.displayBold, fontSize: 19, lineHeight: 23.75 },
  stepSub: { fontFamily: font.sans, fontSize: 14, lineHeight: 21 },
  /** Step 2's detection line specifically — a notch smaller than a subheading. */
  detectLine: { fontFamily: font.sans, fontSize: 13, lineHeight: 19.5 },
  detectResult: { fontFamily: font.displayBold, fontSize: 22, lineHeight: 27.5 },

  /* The two Leaves numerals are the only roles in the file with a declared
     type. `as const` on the enclosing object would freeze `fontVariant` into a
     readonly tuple, and React Native's own `TextStyle` wants a mutable array —
     so the annotation is what lets these two keep tabular figures without the
     whole table giving up its literal types. */
  leavesValue: {
    fontFamily: font.displaySemi,
    fontSize: 56,
    letterSpacing: -1.68,
    fontVariant: ["tabular-nums"],
  } as TextStyle,
  leavesReview: {
    fontFamily: font.displaySemi,
    fontSize: 22,
    fontVariant: ["tabular-nums"],
  } as TextStyle,

  reviewTitle: { fontFamily: font.displaySemi, fontSize: 17, lineHeight: 22.1 },
  headerTitle: { fontFamily: font.sansSemi, fontSize: 15 },

  conditionName: { fontFamily: font.sansSemi, fontSize: 16, lineHeight: 19.2 },
  conditionDesc: { fontFamily: font.sans, fontSize: 12, lineHeight: 16.2 },

  hubName: { fontFamily: font.sansSemi, fontSize: 15, lineHeight: 18 },
  hubEyebrow: { fontFamily: font.mono, fontSize: 10, letterSpacing: 0.6 },
  hubNote: { fontFamily: font.sans, fontSize: 12, lineHeight: 16.2 },

  fieldLabel: { fontFamily: font.sansMedium, fontSize: 10, letterSpacing: 0.4 },
  fieldValue: { fontFamily: font.sansMedium, fontSize: 15 },
  fieldValueMulti: { fontFamily: font.sans, fontSize: 15, lineHeight: 23.25 },
  fieldPlaceholder: { fontFamily: font.sans, fontSize: 14 },

  helper: { fontFamily: font.sans, fontSize: 12, lineHeight: 17.4 },
  /** The long-form helpers — the marker note, the ±25% explanation. */
  helperLong: { fontFamily: font.sans, fontSize: 12, lineHeight: 18 },
  counter: { fontFamily: font.mono, fontSize: 11 },

  noticeHeading: { fontFamily: font.sansSemi, fontSize: 15, lineHeight: 20.25 },
  noticeBody: { fontFamily: font.sans, fontSize: 13, lineHeight: 19.5 },
  fieldError: { fontFamily: font.sansMedium, fontSize: 12, lineHeight: 16.8 },

  primaryLabel: { fontFamily: font.sansBold, fontSize: 16 },
  outlineLabel: { fontFamily: font.sansSemi, fontSize: 15 },
  textLabel: { fontFamily: font.sansSemi, fontSize: 14 },
  /** Save draft, Edit, Undo, Change — the small ones. */
  smallTextLabel: { fontFamily: font.sansSemi, fontSize: 13 },
  confirmLabel: { fontFamily: font.sansSemi, fontSize: 14 },
  imeLabel: { fontFamily: font.sansBold, fontSize: 14 },

  chip: { fontFamily: font.sansMedium, fontSize: 13 },
  chipSelected: { fontFamily: font.sansSemi, fontSize: 13 },
  tag: { fontFamily: font.sansMedium, fontSize: 12 },

  sectionLabel: { fontFamily: font.mono, fontSize: 10, letterSpacing: 1.0 },
  /** Step 2's `CLOTHING · LIKE NEW` row. */
  eyebrow: { fontFamily: font.mono, fontSize: 11, letterSpacing: 0.66 },
  photoCounter: { fontFamily: font.mono, fontSize: 11 },
  hubCounter: { fontFamily: font.mono, fontSize: 12 },

  bandValue: { fontFamily: font.monoMedium, fontSize: 12 },
  bandLabel: { fontFamily: font.mono, fontSize: 11, letterSpacing: 0.66 },
  provenance: { fontFamily: font.sansMedium, fontSize: 13 },

  refCode: { fontFamily: font.monoMedium, fontSize: 12 },
  refLabel: { fontFamily: font.mono, fontSize: 10, letterSpacing: 1.0 },
  /** "We thought: denim jacket, like new". Struck through. */
  struck: {
    fontFamily: font.mono,
    fontSize: 12,
    lineHeight: 16.8,
    textDecorationLine: "line-through" as const,
  },

  markerLabel: { fontFamily: font.sansMedium, fontSize: 11 },
  tooltipHeading: { fontFamily: font.sansSemi, fontSize: 15, lineHeight: 19.5 },
  tooltipBody: { fontFamily: font.sans, fontSize: 13, lineHeight: 20.15 },

  draftHeading: { fontFamily: font.displayBold, fontSize: 22, lineHeight: 27.5 },
  draftRowTitle: { fontFamily: font.sansMedium, fontSize: 14, lineHeight: 18.2 },
  draftRowMeta: { fontFamily: font.mono, fontSize: 11 },
  /** "Checking this photo against existing listings". */
  checkLine: { fontFamily: font.mono, fontSize: 11, letterSpacing: 0.44 },
} as const;

/**
 * `textStyle` from `tokens.js`, re-exported so a component in this flow imports
 * one module. It adds `includeFontPadding: false`, which is Android-only and is
 * the difference between the measured gaps in section 3 and gaps several px
 * larger than they were drawn.
 */
export { textStyle };

/** Truncation, from the spec's own rules. */
export const postLines = {
  reviewTitle: 2,
  hubName: 1,
  hubNote: 1,
  draftRowTitle: 1,
  keyboardSummary: 1,
} as const;

/* ───────────────────────────── 3. SPACING ───────────────────────────── */

/**
 * The chrome is IDENTICAL on all seven steps, which is what makes the tick rail
 * legible as progress rather than as decoration. 114 above, 90 below, 640 of
 * scroll between them on the 844 canvas.
 */
export const chrome = {
  statusBar: 44,
  headerRow: 44,
  headerX: 12,
  /** The right-hand small text button's inset from the edge. */
  headerActionInset: 12,
  railAbove: 12,
  /**
   * 11, NOT the spec's "14 below" — and the spec's own running y is why.
   *
   * Section 3 says "12 above, 14 below" and also says the header block totals
   * 114; step 1's table then puts the rail's line at y=100 and the scroll top
   * at y=114. Those three only agree if the 14 is measured from the RAIL'S OWN
   * TOP rather than from the bottom of its 3 px tick: 44 status + 44 header +
   * 12 = 100, the tick occupies 100–103, and 103 + 11 = 114. Taking "14 below"
   * as a margin under the tick gives 117 and puts every step's scroll top 3 px
   * lower than the table it is drawn from.
   *
   * So the rail's line sits at 100 and the scroll starts at 114 on all seven
   * steps, which is the constraint that actually matters — see the note at the
   * top of `chrome.tsx` on why identical chrome is what makes the rail legible.
   */
  railBelow: 11,
  railInset: 4,
  /** 44 status + 44 header + 12 + 3 + 11. */
  headerBlock: 114,

  footerRule: 1,
  footerTop: 12,
  footerX: 16,
  footerBottom: 26,
  footerButton: 52,
  /** 12 + 52 + 26. The rule sits above it and is counted separately. */
  footerBlock: 90,

  /** Step 6 only: a 44 counter row, 10, then the button. */
  hubFooterCounterRow: 44,
  hubFooterGap: 10,
  hubFooterBlock: 122,

  scrollArea: 640,
} as const;

export const postSpace = {
  /** Text steps — 2, 3, 4, 5 — plus hub text and review sections. */
  screenX: 20,
  /** Button stacks inside the scroll area, so they line up with the footer. */
  stackX: 16,

  /* Step 1 — photos. The running y in the spec, expressed as the gaps between
     the blocks rather than as absolute offsets, so a hero photo that is not
     square (a real upload, clamped) does not desynchronise everything below. */
  photos: {
    heroToRail: 12,
    railToPrimary: 18,
    primaryToSecondary: 9,
    secondaryToHelper: 16,
    bottom: 24,
    thumbGap: 8,
    /** Marker chip inset from the hero's left and bottom edges. */
    markerInset: 12,
    /** Remove button inset from the hero's right and top edges. */
    removeInset: 12,
    helperIconGap: 9,
  },

  /* Step 2 — what is it. */
  what: {
    headingToRef: 20,
    /** Reference tile → the result column beside it. */
    refGap: 14,
    refToConfirm: 16,
    confirmGap: 10,
    confirmToDivider: 22,
    dividerToLabel: 22,
    labelToField: 9,
    fieldToHelper: 8,
    /** Result column internals: framing line → result → eyebrow row. */
    frameToResult: 5,
    resultToEyebrow: 8,
    eyebrowGap: 8,
    eyebrowDot: 3,
    /** Corrected inserts: result column → strip → "Change it again" → divider. */
    resultToStrip: 14,
    stripY: 12,
    stripX: 14,
    stripToChangeAgain: 12,
    /** Detection failed: category field → title label. */
    fieldToLabel: 18,
  },

  /* Step 3 — condition. */
  condition: {
    headingToNote: 11,
    noteToList: 20,
    rowGap: 9,
    rowX: 16,
    /** The border grows to 1.5 when selected; the padding gives back the 1. */
    rowXSelected: 15,
    nameToDesc: 4,
    checkGap: 12,
    noteIconGap: 8,
    bottom: 24,
  },

  /* Step 4 — value. */
  value: {
    headingToNumeral: 34,
    leafGap: 11,
    numeralToProvenance: 12,
    provenanceIconGap: 7,
    provenanceToSlider: 30,
    sliderToBand: 4,
    bandToDivider: 26,
    dividerToHelper: 16,
    helperIconGap: 9,
    /** Re-valuation used: band row → panel → helper. */
    bandToPanel: 24,
    panelToHelper: 18,
    panelY: 14,
    panelX: 16,
    panelIconGap: 10,
    panelHeadingToBody: 6,
  },

  /* Step 5 — in return. */
  ret: {
    headingToSub: 11,
    subToArea: 22,
    areaToHelper: 8,
    helperToDivider: 22,
    dividerToLabel: 22,
    labelToChips: 12,
    chipGap: 8,
    areaPadding: 14,
    /** Focused: the border grows to 1.5 and the padding gives back the 1. */
    areaPaddingFocused: 13,
  },

  /* Step 6 — hubs. The heading block is fixed; the rows scroll under it. */
  hubs: {
    headingToSub: 11,
    subToEnd: 16,
    rowX: 20,
    nameGap: 8,
    nameToNote: 5,
    controlGap: 12,
  },

  /* Step 7 — review. */
  review: {
    headingBelow: 18,
    railGap: 8,
    railBelow: 18,
    sectionY: 16,
    sectionX: 20,
    labelToContent: 8,
    contentToTags: 8,
    contentToTagsWide: 10,
    editGap: 12,
    tagGap: 8,
    closingTop: 16,
    closingBottom: 24,
    leafGap: 7,
  },

  /* The draft sheet. */
  draft: {
    x: 24,
    top: 24,
    bottom: 26,
    grabberBelow: 20,
    headingToBody: 10,
    bodyToRow: 18,
    rowToPrimary: 20,
    primaryToText: 6,
    textToRetention: 10,
    rowPadding: 12,
    rowGap: 12,
  },
} as const;

/* ──────────────────────────── border radii ──────────────────────────── */

export const postRadius = {
  hero: 0,
  thumb: 8,
  addTile: 8,
  refTile: 10,
  reviewTile: 8,
  field: 10,
  textArea: 10,
  button: 10,
  confirmButton: 8,
  textButton: 0,
  chip: 22,
  tag: 6,
  leavesChip: 15,
  conditionRow: 10,
  hubRow: 0,
  hubCheckbox: 6,
  sliderTrack: 2,
  sliderThumb: 14,
  noticePanel: 10,
  failPanel: 10,
  correctionStrip: 8,
  otherListingCard: 10,
  innerListingRow: 8,
  markerChip: 4,
  markerBadge: 3,
  markerTooltip: 12,
  draftSheet: 20,
  draftGrabber: 2,
  skeleton: 6,
  imeKey: 5,
} as const;

/* ─────────────────────────── 4. COMPONENTS ──────────────────────────── */

export const postSize = {
  photo: {
    /** The hero is full-bleed and square by declaration. */
    heroAspect: 1,
    /** A real upload is clamped between these two and centre-cropped. */
    aspectMin: 4 / 5,
    aspectMax: 16 / 9,
    thumb: 78,
    thumbTight: 72,
    refTile: 96,
    refTileTight: 88,
    reviewTile: 104,
    reviewTileTight: 96,
    remove: 44,
    /** Determinate bars. Upload is thicker because it sits over a photo. */
    uploadBar: 3,
    dupBar: 2,
    max: 5,
  },

  entry: {
    button: 52,
    iconGap: 9,
  },

  condition: {
    row: 68,
    /** A 12/16.2 description wraps to two lines at 328. The row GROWS. */
    rowGrown: 76,
    check: 20,
  },

  slider: {
    row: 44,
    track: 4,
    thumb: 28,
    bandMarkerW: 2,
    bandMarkerH: 12,
  },

  chip: {
    height: 44,
    x: 14,
    check: 14,
    checkGap: 7,
    tagX: 10,
    tagY: 7,
  },

  hub: {
    row: 76,
    checkbox: 22,
    checkboxBorder: 1.5,
    check: 20,
    max: 5,
  },

  button: {
    primary: 52,
    confirm: 44,
    text: 48,
    smallText: 44,
    ime: 40,
    imeBar: 56,
    imeX: 18,
  },

  marker: {
    /** The chip on the hero photo. */
    chipH: 24,
    chipX: 8,
    chipGap: 5,
    /** The badge on a 78 thumbnail and on a 104 review tile. */
    badge78: 18,
    badge104: 20,
    badgeInset: 6,
  },

  draft: {
    grabberW: 38,
    grabberH: 4,
    thumb: 44,
  },

  /** Nothing tappable in this flow is under 44. */
  minTarget: 44,
} as const;

/**
 * The tick rail.
 *
 * Six ticks at 13 plus one at 26 = 104, plus 30 of gaps = 134, left-aligned
 * with 4 of inset. No labels, no counter, no percentage — the whole indicator
 * is 134 × 3 and says only "some behind, one here, some ahead".
 */
export const tick = {
  steps: 7,
  gap: 5,
  done: { w: 13, h: 2, r: 2, color: postColor.forest },
  current: { w: 26, h: 3, r: 2, color: postColor.green },
  upcoming: { w: 13, h: 1, r: 0, color: postColor.line },
  /** 6 × 13 + 26 + 6 × 5. */
  totalW: 134,
  /** The row's height IS the current tick's height. */
  rowH: 3,
  /** Leaving and arriving animate simultaneously. */
  durationMs: 200,
} as const;

/**
 * Icons. Size and stroke travel together, exactly as in `tokens.js` — the spec
 * pairs them for every mark and splitting them is how the pairing gets lost.
 */
export const postIcon = {
  back: { size: 22, stroke: 1.9 },
  close: { size: 22, stroke: 1.9 },
  cameraPrimary: { size: 20, stroke: 1.9 },
  cameraChip: { size: 13, stroke: 1.8 },
  cameraBadge78: { size: 10, stroke: 2.2 },
  cameraBadge104: { size: 11, stroke: 2.2 },
  cameraTooltip: { size: 17, stroke: 1.7 },
  gallery: { size: 19, stroke: 1.6 },
  addPhoto: { size: 20, stroke: 1.7 },
  removePhoto: { size: 19, stroke: 1.8 },
  leafValue: { size: 30, stroke: 1.5 },
  leafReview: { size: 18, stroke: 1.7 },
  provenance: { size: 14, stroke: 1.8 },
  check: { size: 20, stroke: 2.2 },
  checkSmall: { size: 14, stroke: 1.8 },
  chevronDown: { size: 18, stroke: 1.7 },
  info: { size: 15, stroke: 1.7 },
  clock: { size: 16, stroke: 1.8 },
  relist: { size: 17, stroke: 1.8 },
  alertWarned: { size: 17, stroke: 1.9 },
  alertUpload: { size: 17, stroke: 1.9 },
  alertFailed: { size: 18, stroke: 1.8 },
  retry: { size: 19, stroke: 2.1 },
  magnifier: { size: 14, stroke: 1.8 },
} as const;

export const postBorder = {
  hairline: 1,
  field: 1,
  fieldActive: 1.5,
  /** The focus ring's spread. Drawn as a second, outset view. */
  ring: 3,
  addTileNext: 1.5,
  addTileLater: 1,
  thumbSelected: 1.5,
  thumb: 1,
  /** The three warm rules, by what they sit under. */
  ruleUploadFailed: 3,
  ruleWarned: 2,
  ruleBlocked: 3,
  sliderThumb: 2,
} as const;

/** The one shadow in the flow that is not the draft sheet. */
export const sliderThumbShadow = {
  shadowColor: "#141419",
  shadowOpacity: 0.16,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
} as const;

export const draftSheetShadow = {
  shadowColor: "#141419",
  shadowOpacity: 0.18,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: -6 },
  elevation: 16,
} as const;

/** Shimmer: 0.55 → 1 → 0.55, 1600 ms, ease-in-out, ONE driver per step. */
export const postMotion = {
  shimmerMs: 1600,
  shimmerFrom: 0.55,
  shimmerTo: 1,
  tickMs: tick.durationMs,
  /** The caret's blink. 1 s, step-end — a hard on/off, not a fade. */
  caretMs: 1000,
} as const;

/* ─────────────────── 5. RULES THE SERVER ENFORCES ───────────────────── */

/**
 * These four are not style. They are the server's constraints, restated here so
 * the interface can EXPRESS them rather than discover them — a slider that
 * cannot select an invalid value never has to explain a rejection.
 *
 * Each one is checked against its server-side twin in the note beside it. If
 * one of these drifts, the symptom is a control that offers something the
 * server refuses, so they are grouped where a reviewer can see all four.
 */
export const rules = {
  /** `OVERRIDE_BAND_PCT` in @/lib/valuation. The slider's ends ARE these. */
  bandPct: 0.25,
  /** The slider moves in fives. Not a server rule — a usability one. */
  valueStep: 5,
  /** `MAX_REVALUATIONS`. One per listing, ever. */
  maxRevaluations: 1,
  /** `resolveHubIds` rejects a sixth. */
  maxHubs: 5,
  /** The wizard's own cap. `createItemSchema` allows 10; the design allows 5. */
  maxPhotos: 5,
  /** `MAX_TITLE` is 200 server-side; the counter and the design say 70. */
  titleMax: 70,
  titleMin: 3,
  /** `MAX_WANTED` is 500 server-side; the counter says 300. */
  wantedMax: 300,
  /** `MAX_IMAGE_BYTES` in the upload route. */
  uploadMaxBytes: 10 * 1024 * 1024,
} as const;

/* ─────────────────── 6. KEYBOARD-UP AND 7. REFLOW ───────────────────── */

/**
 * The IME budget. 358 on 844 leaves 486, and the sheet becomes a fixed 486
 * block with `box-sizing: border-box` so the two sum to the canvas exactly.
 *
 * `tallImeThreshold` is section 6's escape hatch, and it is the SAME number the
 * auth spec uses — deliberately, because it is a statement about devices rather
 * than about either screen. Past it the field block becomes the scrolling
 * region and the primary pins to the bottom; a field never shrinks below 56 and
 * the text area never below 132.
 */
export const keyboardRule = {
  nominalIme: 358,
  canvas: 844,
  tallImeThreshold: 380,
  minField: 56,
  minTextArea: 132,
  /** Above and below the pinned primary in the tall-IME fallback. */
  pinnedY: 12,
} as const;

/** Field and text-area geometry. The text area grows, then scrolls internally. */
export const fieldSize = {
  row: 56,
  textAreaMin: 132,
  textAreaMax: 220,
  /** The caret. 1.5 × 17, forest, blinking on a 1 s step-end. */
  caretW: 1.5,
  caretH: 17,
} as const;

/**
 * The single breakpoint, and everything that moves at it.
 *
 * HORIZONTAL ONLY. Every height, every vertical gap and both keyboard budgets
 * are unchanged at 360 — which is why this is a table of widths and two type
 * sizes rather than a second spec.
 */
export const board = {
  breakpoint: 360,
  wide: {
    screenX: 20,
    headerX: 12,
    stackX: 16,
    hubX: 20,
    reviewX: 20,
    stepHeading: 26,
    detectResult: 22,
    leavesValue: 56,
    leavesTracking: -1.68,
    thumb: 78,
    refTile: 96,
    reviewTile: 104,
    markerInset: 12,
  },
  tight: {
    screenX: 16,
    headerX: 8,
    stackX: 12,
    hubX: 16,
    reviewX: 16,
    stepHeading: 24,
    detectResult: 21,
    leavesValue: 52,
    /** −0.03em of 52. The tracking is proportional, so it moves with the size. */
    leavesTracking: -1.56,
    thumb: 72,
    refTile: 88,
    reviewTile: 96,
    markerInset: 10,
  },
} as const;

/**
 * One width column.
 *
 * Declared as an interface rather than inferred from `board.wide`, because
 * inference makes every field a LITERAL — `screenX: 20` rather than `number` —
 * and the tight column then fails to satisfy it. The widths are the whole point
 * of the type, so they have to be numbers.
 */
export interface Board {
  screenX: number;
  headerX: number;
  stackX: number;
  hubX: number;
  reviewX: number;
  stepHeading: number;
  detectResult: number;
  leavesValue: number;
  leavesTracking: number;
  thumb: number;
  refTile: number;
  reviewTile: number;
  markerInset: number;
}
