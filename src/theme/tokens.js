/**
 * Direction 1 — "Quiet Feed". Every value in the implementation spec, once.
 *
 * This file is the only place a colour, a type role, a gap, a radius, a control
 * height, an icon size or a stroke width is written down. Components import
 * from here and compose; nothing below is duplicated into a StyleSheet literal.
 * That is the point of the file — the spec is a tuning surface, and tuning it
 * has to be an edit here rather than a search across twenty components.
 *
 * PLAIN COMMONJS, deliberately. `tailwind.config.js` requires it, and Tailwind
 * loads that config through Node before any TypeScript transform runs — a .ts
 * file here would work inside the app and fail in the CLI. `tokens.d.ts` is
 * what gives the app its types. Same arrangement as `palette.js`, and for the
 * same reason.
 *
 * RELATIONSHIP TO `palette.js`: none. That file is the older Forest/Cream port
 * and still dresses the (auth) group and the Profile tab, neither of which this
 * task touches. Everything in the Home tab and the chrome around it reads from
 * here. The two are not merged because merging them would mean editing (auth).
 */

/* ────────────────────────────── 1. COLOR ────────────────────────────── */

const color = {
  /* Surfaces. Cards are NOT tinted — they are the same value as the canvas and
     are separated by dividers, never by elevation. That is the direction's
     whole premise, so `surface` intentionally serves both roles. */
  surface: "#FAFAF7",
  /** Inset surface — the "Matches for you" interstitial sits in this. */
  inset: "#F5F3EC",
  /** Chip / control fill — trending chips, the New/Rising tier badge, failed photo. */
  control: "#F1EFE8",
  /** The stories "+ Post" circle. A hair off `control`, and the spec means it. */
  storyPost: "#F3F2EC",

  /* Text */
  ink: "#14140F",
  inkSecondary: "#5C5B52",
  inkMuted: "#8C8A7E",
  /** Disabled / stale — the Leaves pill while offline, the "last synced" line. */
  inkStale: "#A8A69A",

  /* Greens */
  forest: "#1B4D2B",
  green: "#3DBE5A",
  onGreen: "#0B2A15",
  greenWash: "#EAF6EC",
  greenLine: "#D2EAD8",

  /* Warm accent. Likes and urgency only — see the spec's own note. */
  like: "#C56A4B",
  urgent: "#B0553A",
  urgentWash: "#FBEEE9",
  urgentLine: "#F0D8CE",

  /* Borders and dividers */
  divider: "#EDEBE3",
  controlLine: "#E2E0D6",
  controlLineStrong: "#D8D6CC",
  dashed: "#C9C7BC",

  /* Skeleton and failure */
  skeleton: "#EBE9E0",
  skeletonSoft: "#EFEDE5",
  failedIcon: "#B4B2A6",

  /** The scrim behind the "expand" label on a cropped photo. */
  captionFill: "rgba(20, 20, 15, 0.55)",
};

/* ────────────────────────────── 2. TYPE ─────────────────────────────── */

/**
 * The seven static instances, addressed by their PostScript names.
 *
 * Each weight is its OWN family rather than one family plus `fontWeight`.
 * These are static instances cut from variable sources: asking Android for
 * "PublicSans-Regular at 600" gets synthetic emboldening, not the SemiBold
 * file. Naming the face directly is what makes iOS and Android agree — every
 * bundled file's basename equals its PostScript name (checked against each
 * font's `name` table), so one string resolves on both platforms.
 *
 * Bricolage Grotesque is a three-axis variable font upstream (opsz, wdth,
 * wght). React Native has no variable-axis support, so what is bundled is the
 * default optical size at full width, cut at each weight the spec asks for.
 */
const font = {
  /** Display — wordmark, empty/error headlines. */
  displayBold: "BricolageGrotesque-Bold",
  /** Display — item titles. */
  displaySemi: "BricolageGrotesque-SemiBold",
  /** UI. */
  sans: "PublicSans-Regular",
  sansMedium: "PublicSans-Medium",
  sansSemi: "PublicSans-SemiBold",
  sansBold: "PublicSans-Bold",
  /** Eyebrows, timestamps, dev labels. */
  mono: "JetBrainsMono-Regular",
};

/**
 * `lineHeight` IS SET ONLY WHERE THE SPEC'S MULTIPLIER IS ABOVE 1.0.
 *
 * The spec resolves every line height, including the many at exactly 1.0. In
 * CSS a 1.0 line-height on a single line is harmless — the glyph overflows its
 * line box and still paints. React Native CLIPS to the line box, so a literal
 * `lineHeight: 24` under a 24 px wordmark shears the descender off "Baylo".
 * Every 1.0 role in the spec is a single line inside a container whose height
 * is fixed independently (a 44 px header row, a 34 px pill, a 44 px chip), so
 * omitting it changes nothing about where the glyph sits and only changes
 * whether its tail survives. The two "fills the box" values — the trending
 * chip's 44 and the unread badge's 17 — are that same CSS centring trick, and
 * are done here with flexbox instead.
 *
 * `includeFontPadding: false` is applied by `textStyle()` below rather than
 * being repeated in every role. It is Android-only and ignored elsewhere;
 * without it Android adds the font's own ascent/descent padding on top of
 * `lineHeight`, and every measured gap in section 3 comes out several px
 * larger than it was drawn.
 */
const type = {
  wordmark: { fontFamily: font.displayBold, fontSize: 24, letterSpacing: -0.48 },
  wordmarkTight: { fontFamily: font.displayBold, fontSize: 22, letterSpacing: -0.44 },

  itemTitle: { fontFamily: font.displaySemi, fontSize: 17, lineHeight: 22.1 },
  emptyHeadline: { fontFamily: font.displayBold, fontSize: 23, lineHeight: 28.75 },
  errorHeadline: { fontFamily: font.displayBold, fontSize: 22, lineHeight: 27.5 },

  username: { fontFamily: font.sansSemi, fontSize: 14 },
  metadata: { fontFamily: font.sans, fontSize: 12, lineHeight: 15.6 },
  tierBadge: { fontFamily: font.sansSemi, fontSize: 10, letterSpacing: 0.4 },

  leavesHeader: { fontFamily: font.sansSemi, fontSize: 14, fontVariant: ["tabular-nums"] },
  leavesHeaderTight: { fontFamily: font.sansSemi, fontSize: 13, fontVariant: ["tabular-nums"] },
  leavesCard: { fontFamily: font.sansBold, fontSize: 13, fontVariant: ["tabular-nums"] },

  chip: { fontFamily: font.sansMedium, fontSize: 12 },
  urgencyChip: { fontFamily: font.sansSemi, fontSize: 12 },

  primaryButton: { fontFamily: font.sansBold, fontSize: 15, letterSpacing: 0.15 },
  emptyPrimaryButton: { fontFamily: font.sansBold, fontSize: 16 },
  secondaryButton: { fontFamily: font.sansSemi, fontSize: 14 },

  socialCount: { fontFamily: font.sansMedium, fontSize: 13, fontVariant: ["tabular-nums"] },

  sectionHeading: { fontFamily: font.sansSemi, fontSize: 13 },
  sectionSubcopy: { fontFamily: font.sans, fontSize: 12, lineHeight: 16.8 },
  sectionEyebrow: { fontFamily: font.mono, fontSize: 11 },

  trendingChip: { fontFamily: font.sansMedium, fontSize: 13 },
  matchesTitle: { fontFamily: font.sansSemi, fontSize: 13, lineHeight: 16.9 },
  matchesMeta: { fontFamily: font.sansSemi, fontSize: 12 },

  storyPostLabel: { fontFamily: font.sansSemi, fontSize: 11 },
  storyHandle: { fontFamily: font.sans, fontSize: 11 },

  tabActive: { fontFamily: font.sansSemi, fontSize: 10 },
  tabInactive: { fontFamily: font.sansMedium, fontSize: 10 },

  unreadBadge: { fontFamily: font.sansBold, fontSize: 10, fontVariant: ["tabular-nums"] },

  avatarInitials40: { fontFamily: font.sansSemi, fontSize: 13 },
  avatarInitials62: { fontFamily: font.sansSemi, fontSize: 15 },

  emptyBody: { fontFamily: font.sans, fontSize: 14, lineHeight: 21.7 },
  offlineText: { fontFamily: font.sansSemi, fontSize: 12, lineHeight: 15.6 },
  lastSynced: { fontFamily: font.mono, fontSize: 11 },

  /** The expand affordance on a cropped photo. */
  photoCaption: { fontFamily: font.mono, fontSize: 9 },

  /* ── Marketplace and item detail ──────────────────────────────────────── */

  /** The search field's own text and its placeholder. */
  searchInput: { fontFamily: font.sans, fontSize: 15 },
  /** A grid tile's title. Smaller than `itemTitle` — two per row, not one. */
  gridTitle: { fontFamily: font.displaySemi, fontSize: 14, lineHeight: 18.2 },
  /** The Leaves figure on a grid tile. */
  gridLeaves: { fontFamily: font.sansBold, fontSize: 12, fontVariant: ["tabular-nums"] },
  /** A grid tile's condition line. */
  gridMeta: { fontFamily: font.sans, fontSize: 11, lineHeight: 14.3 },
  /** "24 results" above the grid. */
  resultCount: { fontFamily: font.mono, fontSize: 11 },
  /** The filter sheet's title. */
  sheetTitle: { fontFamily: font.displaySemi, fontSize: 18 },
  /** A labelled group inside the filter sheet. */
  sheetLabel: { fontFamily: font.sansSemi, fontSize: 13 },
  /** The detail screen's item title. Largest type outside a headline. */
  detailTitle: { fontFamily: font.displayBold, fontSize: 22, lineHeight: 28.6 },
  /** The Leaves figure on the detail screen. */
  detailLeaves: { fontFamily: font.sansBold, fontSize: 17, fontVariant: ["tabular-nums"] },
  /** A section heading on the detail screen — "Wanted in return". */
  detailSection: { fontFamily: font.sansSemi, fontSize: 13 },
  /** Body copy on the detail screen. */
  detailBody: { fontFamily: font.sans, fontSize: 14, lineHeight: 21 },
  /** A Safe-Zone hub's name. */
  hubName: { fontFamily: font.sansSemi, fontSize: 13 },
  /** A hub's "where exactly" line. */
  hubLandmark: { fontFamily: font.sans, fontSize: 12, lineHeight: 16.8 },
  /** The destructive row labels — Report, Block. */
  dangerAction: { fontFamily: font.sansMedium, fontSize: 14 },
  /** The 1-of-N counter over a carousel. */
  carouselCount: { fontFamily: font.mono, fontSize: 10 },
};

/** Truncation, from the spec's own rules. */
const lines = {
  itemTitle: 2,
  username: 1,
  metadata: 1,
  storyHandle: 1,
  matchesTitle: 2,
};

/* ───────────────────────────── 3. SPACING ───────────────────────────── */

const space = {
  /** Screen gutter. Every row carries it: header, owner row, titles, rails. */
  screenX: 16,
  screenXTight: 12,

  header: {
    /** The content row. The safe-area top is added to this at runtime. */
    row: 44,
    bottom: 10,
    gap: 10,
    gapTight: 6,
  },

  tab: {
    row: 56,
    top: 8,
    /** The spec's assumed bottom safe area; a larger real inset wins. */
    bottom: 22,
    /* Icon → label inside a tab item. Artboard-read; the spec fixes the row's
       height and both type roles but not the space between them. */
    iconToLabel: 5,
    /* Clearance between the FAB ring's bottom edge and the top of the label
       under it. The centre tab is the only one where those two can collide,
       and it decides where the icon row starts on ALL five — see the
       `iconTop` derivation in TabBar. Small on purpose: the artboard has the
       circle nearly touching the word. */
    fabToLabel: 3,
  },

  card: {
    top: 14,
    bottom: 18,
    ownerToPhoto: 12,
    photoToTitle: 14,
    titleToChips: 10,
    chipsToSocial: 8,
    socialToButton: 6,
    /** avatar → text → kebab */
    ownerGap: 10,
    nameToMeta: 3,
    /** title → Leaves chip */
    titleToLeaves: 12,
    chipGap: 7,
    /** The social row is pulled left so the first glyph optically hits 16. */
    socialInset: 10,
    /* Glyph → count inside one social action. Artboard-read; the spec gives
       the action's height and side padding but not its internal gap. */
    socialGap: 7,
    /* Name → tier badge, and the stack inside a failed photo box. Both
       artboard-read; the spec gives the owner row's outer gap and the failed
       box's fill and rules, not these two. */
    nameToBadge: 6,
    failedGap: 12,
  },

  /* Chip and badge padding. The spec fixes every chip's fill, border, radius
     and type but names padding only for the trending chip and the Leaves
     pills. These are artboard-read, and grouped here so a tuning pass can
     find them together. */
  chip: { x: 8, y: 5 },
  tierBadge: { x: 6, y: 3 },
  /** The spec's "6×8 padding": 6 vertical, 8 horizontal. `inset` is read. */
  photoCaption: { x: 8, y: 6, inset: 10 },

  stories: { top: 14, x: 16, bottom: 16, gap: 14, avatarToLabel: 7 },

  /* The offline banner's own padding is not in the spec's table — it names the
     banner's colours, its two rules and its type, and stops there. These are
     read off the artboard, like the three flagged values in `size.leaves`. */
  offline: { y: 10, gap: 8 },

  /* The two full-screen states. The spec fixes their type, their icon circles,
     their button heights and the empty state's 24 px gutter; the vertical
     rhythm between those blocks is artboard-read. */
  empty: { x: 24, iconToHeadline: 24, headlineToBody: 10, bodyToButton: 28, buttonToNote: 12 },
  error: { x: 24, iconToHeadline: 24, headlineToBody: 10, bodyToButton: 28, buttonToSynced: 24 },

  trending: { y: 18, headerToRail: 12, chipGap: 8 },

  /* ── Marketplace ──────────────────────────────────────────────────────────
     The browse tab is a different MODE from the feed: two columns, denser, and
     scanned rather than read. Its rhythm is therefore its own rather than
     inherited from `card`, which is tuned for one full-bleed item at a time. */
  browse: {
    /** Search row → chip rail → grid. */
    searchY: 12,
    searchGap: 8,
    chipsY: 10,
    chipGap: 8,
    /** Gutter around the grid, and the gap between the two columns. */
    gridX: 12,
    gridGap: 10,
    /** Grid tile internals. */
    tileBody: 10,
    tileTitleToMeta: 5,
    tileMetaToLeaves: 8,
    countY: 10,
  },

  /* ── Filter sheet ─────────────────────────────────────────────────────── */
  sheet: {
    x: 20,
    top: 18,
    bottom: 24,
    titleToBody: 18,
    groupGap: 22,
    labelToOptions: 10,
    optionGap: 8,
    /** The two range inputs, side by side. */
    rangeGap: 12,
    actionsTop: 20,
    actionGap: 10,
  },

  /* ── Item detail ──────────────────────────────────────────────────────── */
  detail: {
    x: 16,
    /** Carousel → title block. */
    photoToBody: 16,
    titleToLeaves: 10,
    leavesToChips: 12,
    chipsToOwner: 18,
    ownerY: 14,
    sectionY: 18,
    headingToBody: 8,
    hubGap: 10,
    hubIconToText: 10,
    hubNameToLandmark: 4,
    dangerY: 14,
    dangerGap: 12,
    /** Clearance under the last section so the sticky bar never covers it. */
    actionBarClearance: 96,
    actionBarY: 12,
  },

  matches: {
    y: 18,
    headerToRail: 12,
    headingToSub: 4,
    cardGap: 10,
    thumbToTitle: 8,
    titleToMeta: 5,
  },
};

const radius = {
  card: 0,
  primaryButton: 10,
  emptyPrimaryButton: 11,
  chip: 6,
  trendingChip: 22,
  leavesPillHeader: 17,
  leavesPillHeaderTight: 16,
  leavesChipCard: 15,
  tierBadge: 4,
  ownerAvatar: 20,
  storyAvatar: 31,
  fab: 29,
  unreadBadge: 9,
  matchesThumb: 8,
  photoCaption: 2,
  reloadButton: 22,

  /* Marketplace and detail. */
  searchField: 10,
  filterButton: 10,
  gridTile: 10,
  gridPhoto: 10,
  sheet: 18,
  sheetOption: 8,
  rangeInput: 8,
  hubRow: 10,
  carouselDot: 3,
  carouselCount: 10,
};

/* ──────────────────────────── 4. COMPONENTS ─────────────────────────── */

const size = {
  avatar: {
    owner: 40,
    /** Outer box. Ring is 2 px of fill, then a 2 px surface gap, then 54 image. */
    story: 62,
    storyRing: 2,
    storyGap: 2,
    storyImage: 54,
  },

  photo: {
    /** The box a never-before-measured image opens at, and the clamp band. */
    aspectDefault: 1,
    aspectMin: 4 / 5,
    aspectMax: 16 / 9,
    matchesThumb: 132,
  },

  control: {
    primaryButton: 48,
    emptyPrimaryButton: 52,
    secondaryButton: 48,
    errorRetry: 50,
    errorRetryX: 26,
    social: 44,
    socialX: 10,
    headerIcon: 44,
    headerIconTight: 40,
    kebab: 44,
    /** Pulls the 44 px kebab box back so its glyph lands on the 16 gutter. */
    kebabInset: 12,
    trendingChip: 44,
    trendingChipX: 14,
    tabItem: 56,
    fab: 58,
    /** How far the FAB rises above the top edge of the bar. */
    fabLift: 20,
    reloadButton: 44,
    reloadButtonX: 18,
  },

  badge: {
    unread: 17,
    unreadX: 4,
    unreadXWide: 5,
    unreadTop: 2,
    unreadRight: 0,
    unreadRightWide: -4,
  },

  leaves: {
    headerPill: 34,
    headerPillTight: 32,
    headerPillLeft: 10,
    headerPillRight: 12,
    headerPillLeftTight: 9,
    headerPillRightTight: 10,
    cardChip: 30,
    /* The spec fixes the pills' outer padding and their heights but not the
       space between the leaf and the numerals, nor the card chip's padding.
       These three are read off the artboards and are the only measurements in
       this file that are not quoted from the table — flagged so that a tuning
       pass knows which numbers are the spec's and which are an eye's. */
    gap: 5,
    cardChipLeft: 9,
    cardChipRight: 11,
  },

  emptyIconCircle: 96,
  errorIconCircle: 88,

  /* ── Marketplace and item detail ──────────────────────────────────────── */
  browse: {
    /** Both 44 — the spec's minimum target, and they sit on one row. */
    searchField: 44,
    filterButton: 44,
    /** The category rail's chips reuse the trending chip's geometry. */
    chip: 36,
    chipX: 14,
    /** A grid tile's photo is square; the body sits under it. */
    tilePhotoAspect: 1,
  },

  sheet: {
    /** A tappable option inside the sheet. 44, like everything else. */
    option: 44,
    optionX: 14,
    rangeInput: 44,
    action: 48,
    /** The grab handle at the top of the sheet. */
    handleW: 40,
    handleH: 4,
  },

  detail: {
    /** The carousel box. 4:5 — taller than wide, the spec's portrait clamp. */
    photoAspect: 4 / 5,
    dot: 6,
    dotGap: 6,
    /** The hub row's leading icon well. */
    hubIcon: 32,
    /** Report / block rows, and the sticky primary. */
    dangerRow: 44,
    actionButton: 50,
    backButton: 44,
  },

  /**
   * Skeleton block dimensions.
   *
   * Not in the spec, which names the two skeleton fills and the pulse and stops
   * there — everything structural about the skeleton is inherited from the real
   * card's tokens above. What is left is how WIDE a stand-in line should be,
   * which is a judgement about the copy it stands in for: a name is shorter
   * than a title, a title runs most of the width, a metadata line is shorter
   * than a name. Kept here so the whole skeleton is tunable from one place.
   */
  skeletonBlock: {
    storyLabel: { w: 38, h: 9 },
    name: { w: 132, h: 11 },
    meta: { w: 96, h: 9 },
    title: { w: "70%", h: 14 },
    leavesChip: 62,
    chip: 68,
    chipWide: 92,
    chipHeight: 24,
    social: { w: 52, h: 14 },
  },
};

/**
 * Icons. Every one is 1.6 stroke with round caps and joins unless named here.
 *
 * Size and stroke travel together because the spec pairs them: the tab bar's
 * active/inactive difference is a stroke weight at a constant 22, not two
 * different glyphs, and pulling the two apart is how that gets lost.
 */
const icon = {
  headerAction: { size: 21, stroke: 1.6 },
  headerLeaf: { size: 15, stroke: 1.7 },
  headerLeafTight: { size: 14, stroke: 1.7 },
  cardLeaf: { size: 13, stroke: 1.8 },
  matchesLeaf: { size: 12, stroke: 1.8 },
  social: { size: 21, stroke: 1.6 },
  kebab: { size: 18, dotRadius: 1.6 },
  tabActive: { size: 22, stroke: 1.9 },
  tabInactive: { size: 22, stroke: 1.6 },
  fabPlus: { size: 26, stroke: 2.1 },
  storyPlus: { size: 20, stroke: 1.6 },
  offlineWarning: { size: 16, stroke: 1.8 },
  failedPhoto: { size: 34, stroke: 1.4 },
  retryError: { size: 19, stroke: 2.1 },
  retryPhoto: { size: 16, stroke: 1.9 },
  emptyLeaf: { size: 42, stroke: 1.4 },
  /* The mark inside the error state's 88 px circle. The spec sizes the circle
     and stops; artboard-read, like the flagged values in `space`. */
  errorMark: { size: 38, stroke: 1.6 },

  /* Marketplace and item detail. All 1.6 unless the mark is small enough that
     1.6 reads heavy at its size, matching the table's own logic. */
  search: { size: 18, stroke: 1.7 },
  filter: { size: 19, stroke: 1.7 },
  clear: { size: 16, stroke: 1.8 },
  back: { size: 22, stroke: 1.8 },
  chevron: { size: 16, stroke: 1.8 },
  detailLeaf: { size: 16, stroke: 1.8 },
  hubPin: { size: 16, stroke: 1.7 },
  danger: { size: 18, stroke: 1.6 },
  check: { size: 14, stroke: 2.1 },
  emptyGrid: { size: 40, stroke: 1.4 },
};

const border = {
  hairline: 1,
  chip: 1,
  /** The stories "+ Post" ring. */
  dashed: 1.5,
  storyRing: 2,
  unreadRing: 2,
  fabRing: 4,
};

/**
 * Cards have no shadow at all — the direction separates them with dividers, and
 * an elevation here is the single change that would make the whole screen read
 * as a different design. The FAB is the only raised thing in the app.
 */
const shadow = {
  fab: {
    shadowColor: color.green,
    shadowOpacity: 0.42,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    // Android draws elevation shadows in its own grey and ignores shadowColor
    // below API 28. See the note in TabBar for what that costs.
    elevation: 8,
  },
};

/** opacity 0.55 → 1 → 0.55 over 1600 ms, every block driven in phase. */
const motion = {
  skeletonPulseMs: 1600,
  skeletonFrom: 0.55,
  skeletonTo: 1,
  /** expo-image's cross-fade when a photo resolves. */
  photoFadeMs: 160,
};

/** The single breakpoint. At or below this width, the header tightens. */
const breakpoint = { tight: 360 };

/**
 * Wraps a type role for use as a RN `Text` style.
 *
 * One job: add `includeFontPadding: false`. It is here rather than repeated in
 * all forty roles because it is a platform correction, not a design decision —
 * the spec has no opinion about it, and a role table full of it reads as though
 * it does.
 */
function textStyle(role) {
  return { includeFontPadding: false, ...role };
}

module.exports = {
  color,
  font,
  type,
  lines,
  space,
  radius,
  size,
  icon,
  border,
  shadow,
  motion,
  breakpoint,
  textStyle,
};
