/**
 * Direction 1 — "Quiet Feed". Every value in the implementation spec, once.
 *
 * Components import token roles and measurements from here and compose;
 * Direction 1's canonical colour values live in palette.js. This is the tuning
 * surface for type roles, gaps, radii, control heights, icons and strokes.
 *
 * PLAIN COMMONJS, deliberately. `tailwind.config.js` requires it, and Tailwind
 * loads that config through Node before any TypeScript transform runs — a .ts
 * file here would work inside the app and fail in the CLI. `tokens.d.ts` is
 * what gives the app its types. Same arrangement as `palette.js`, and for the
 * same reason.
 *
 * The legacy `color` roles stay unchanged for existing callers. Direction 1's
 * canonical colours live separately in `dColor` and palette.js.
 */

const { direction1: d } = require("./palette");

/* ────────────────────────────── 1. COLOR ────────────────────────────── */

const dColor = {
  primary: d.primary,
  primaryText: d.primaryText,
  accent: d.accent,
  accentText: d.accentText,
  accentSoft: d.accentSoft,
  background: d.background,
  surface: d.surface,
  tint: d.tint,
  text: d.text,
  mutedText: d.mutedText,
  border: d.border,
  success: d.success,
  warning: d.warning,
  danger: d.danger,

  /* Direction 1 semantic aliases retained by existing d-* utility classes. */
  searchSurface: d.surface,
  inset: d.accentSoft,
  control: d.tint,
  storyPost: d.tint,
  ink: d.text,
  inkSecondary: d.mutedText,
  inkMuted: d.mutedText,
  inkStale: d.mutedText,
  forest: d.primary,
  green: d.primary,
  mascotGreen: d.primary,
  onGreen: d.primaryText,
  greenWash: d.accentSoft,
  greenLine: d.border,
  accentGreen: d.primary,
  accentGold: d.accentText,
  like: d.danger,
  urgent: d.warning,
  urgentWash: d.tint,
  urgentLine: d.border,
  divider: d.border,
  controlLine: d.border,
  controlLineStrong: d.border,
  dashed: d.border,
  skeleton: d.tint,
  skeletonSoft: d.accentSoft,
  failedIcon: d.mutedText,
  captionFill: "rgba(28, 36, 32, 0.55)",
  onScrim: d.primaryText,
};

const color = {
  /** Existing palette roles. Keep these values stable for unmigrated screens. */
  surface: "#FAFAF7",
  searchSurface: "#FFFFFF",
  inset: "#F5F3EC",
  control: "#F1EFE8",
  storyPost: "#F3F2EC",
  ink: "#14140F",
  inkSecondary: "#5C5B52",
  inkMuted: "#8C8A7E",
  inkStale: "#A8A69A",
  forest: "#1B4D2B",
  green: "#3DBE5A",
  mascotGreen: "#1E6B35",
  onGreen: "#0B2A15",
  greenWash: "#EAF6EC",
  greenLine: "#D2EAD8",
  accentGreen: "#2A833E",
  accentGold: "#A0740D",
  like: "#C56A4B",
  urgent: "#B0553A",
  urgentWash: "#FBEEE9",
  urgentLine: "#F0D8CE",
  divider: "#EDEBE3",
  controlLine: "#E2E0D6",
  controlLineStrong: "#D8D6CC",
  dashed: "#C9C7BC",
  skeleton: "#EBE9E0",
  skeletonSoft: "#EFEDE5",
  failedIcon: "#B4B2A6",
  captionFill: "rgba(20, 20, 15, 0.55)",
  onScrim: "#FFFFFF",
  homeTop: "#064B25",
  homeMiddle: "#0B5B2C",
  homeBottom: "#627E38",
  homeYellow: "#F6CF43",
  homeCream: "#FAFAF7",
  homeOnGreen: "#FFFDF5",
  homeOnGreenMuted: "rgba(255, 253, 245, 0.78)",
  homePattern: "rgba(255, 255, 255, 0.07)",
  homeIconSurface: "rgba(255, 255, 255, 0.12)",
  homeFieldSurface: "rgba(255, 255, 255, 0.14)",
  homeFieldLine: "rgba(255, 255, 255, 0.22)",
  homeBadge: "#F15D3D",
  homeOutline: "#0D2817",
};

/**
 * The dark palette, written down once.
 *
 * Before this existed it was hand-rolled inline as `darkColors` in
 * connections.tsx, profile.tsx, user.tsx and messages/thread.tsx. These are the
 * profile/user values verbatim (the superset of the four #171A17 copies), so
 * those screens can switch to `dark.*` with no visual change. thread.tsx's copy
 * is a different, warmer set (#14140F base) and is NOT folded in here.
 *
 * First consumer: the Home redesign's Exclusive tiles.
 */
const dark = {
  surface: "#171A17",
  control: "#252A25",
  ink: "#F4F5F0",
  secondary: "#B6BDB3",
  muted: "#929B91",
  divider: "#343A34",
  border: "#596159",
  green: "#72D681",
  /** `surface` at 78% — the bottom scrim under a tile's title. */
  scrim: "rgba(23, 26, 23, 0.78)",
  /** `surface` at 0% — the scrim's transparent end, same RGB so it never greys. */
  scrimClear: "rgba(23, 26, 23, 0)",
  /* The dark stand-ins for `color.greenWash` / `color.forest` on a badge. Were
     inline in the storefront header, profile.tsx and user.tsx as #244A31 /
     #BFE8C7; the storefront reads them from here now. */
  greenWash: "#244A31",
  onGreenWash: "#BFE8C7",
};

/* ────────────────────────────── 2. TYPE ─────────────────────────────── */

/**
 * Font faces are addressed by their PostScript names. Each static weight is
 * its own family, so Android never has to synthesize a face.
 *
 * Each weight is its OWN family rather than one family plus `fontWeight`.
 * These are static instances cut from variable sources: asking Android for
 * "PublicSans-Regular at 600" gets synthetic emboldening, not the SemiBold
 * file. Naming the face directly is what makes iOS and Android agree — every
 * bundled file's basename equals its PostScript name (checked against each
 * font's `name` table), so one string resolves on both platforms.
 *
 * The existing legacy families remain unchanged. Figtree faces are used only
 * by the Direction 1 roles.
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
  /**
   * Mono 500. Its own family, not `mono` at weight 500 — asking Android for
   * Regular at 500 synthesises a face rather than reaching for this file. The
   * auth spec's rejection value and the post flow's slider band values and
   * reference codes are all Mono Medium; the .ttf has been bundled since the
   * auth work, and this is the name that reaches it.
   */
  monoMedium: "JetBrainsMono-Medium",
  figtreeRegular: "Figtree_400Regular",
  figtreeMedium: "Figtree_500Medium",
  figtreeSemi: "Figtree_600SemiBold",
  figtreeBold: "Figtree_700Bold",
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
  dDisplay: { fontFamily: font.figtreeBold, fontSize: 22, lineHeight: 26.4, letterSpacing: -0.22 },
  dSheetTitle: { fontFamily: font.figtreeBold, fontSize: 20, lineHeight: 25 },
  dSectionTitle: { fontFamily: font.figtreeBold, fontSize: 17, lineHeight: 20.4 },
  dCardTitle: { fontFamily: font.figtreeSemi, fontSize: 15, lineHeight: 19.5 },
  dButton: { fontFamily: font.figtreeSemi, fontSize: 15, lineHeight: 19.5 },
  dBody: { fontFamily: font.figtreeRegular, fontSize: 14, lineHeight: 19.6 },
  dCaption: { fontFamily: font.figtreeMedium, fontSize: 12, lineHeight: 15.6 },
  dSmall: { fontFamily: font.figtreeMedium, fontSize: 11, lineHeight: 13.2 },
  dCount: { fontFamily: font.figtreeSemi, fontSize: 9, lineHeight: 11 },

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

  /* ── Home redesign (preview) ──────────────────────────────────────────── */

  /** "Categories", "Exclusive". */
  homeSection: { fontFamily: font.displaySemi, fontSize: 20 },
  homeSeeAll: { fontFamily: font.sansSemi, fontSize: 13 },
  heroTitle: { fontFamily: font.displayBold, fontSize: 20, lineHeight: 25 },
  heroSubhead: { fontFamily: font.sans, fontSize: 13, lineHeight: 17.6 },
  heroCta: { fontFamily: font.sansBold, fontSize: 13 },
  categoryLabel: { fontFamily: font.sansMedium, fontSize: 11 },
  exclusiveTitle: { fontFamily: font.displaySemi, fontSize: 16, lineHeight: 20 },
  exclusiveMeta: { fontFamily: font.sans, fontSize: 11, lineHeight: 14.3 },
  /** The live countdown beside "Exclusive". Mono, so the digits never jitter. */
  countdownPill: { fontFamily: font.monoMedium, fontSize: 12 },
  /**
   * The LIVE countdown pill (1 Oct 2026): light bold figures on solid red.
   * Tabular, so "05:12:44" keeps one width while it ticks; Public Sans
   * carries `tnum`, as `gridLeaves` already relies on.
   */
  countdownLive: { fontFamily: font.sansBold, fontSize: 12, fontVariant: ["tabular-nums"] },
  /** The same, on the listing screen under the photo. */
  countdownLiveLarge: { fontFamily: font.sansBold, fontSize: 16, fontVariant: ["tabular-nums"] },

  /* ── MSME storefront (docs/design/MSME Profile 1a) ────────────────────────
     The design sets these in Figtree 800/700; Figtree is not bundled, so the
     heavy display weight maps to Bricolage Bold and the UI weights to Public
     Sans, the same substitution every other screen makes. */
  storefrontName: { fontFamily: font.displayBold, fontSize: 24, letterSpacing: -0.48, lineHeight: 29 },
  storefrontMeta: { fontFamily: font.sans, fontSize: 14 },
  storefrontCategory: { fontFamily: font.sansSemi, fontSize: 14 },
  storefrontBody: { fontFamily: font.sans, fontSize: 15, lineHeight: 21.75 },
  storefrontBadge: { fontFamily: font.sansBold, fontSize: 12 },
  storefrontStat: { fontFamily: font.sansBold, fontSize: 20, fontVariant: ["tabular-nums"] },
  storefrontStatLabel: { fontFamily: font.sans, fontSize: 12 },
  storefrontSection: { fontFamily: font.sansBold, fontSize: 17 },
  storefrontLink: { fontFamily: font.sansBold, fontSize: 13 },
  storefrontOverlay: { fontFamily: font.sansSemi, fontSize: 12 },
  storefrontStaffName: { fontFamily: font.sansSemi, fontSize: 15 },
  storefrontStaffRole: { fontFamily: font.sans, fontSize: 13 },
  storefrontStep: { fontFamily: font.sans, fontSize: 14 },
  storefrontEmptyTitle: { fontFamily: font.sansBold, fontSize: 16 },
  /** The initial in a logo-less shop's square. The person avatar's face, at the logo's scale. */
  storefrontLogoInitial: { fontFamily: font.sansBold, fontSize: 34 },
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
  design: {
    scale: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 },
    page: 20,
    section: 32,
    cardGap: 12,
  },
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
    /* The social group and the Offer control, when they share a row. Wider
       than `socialGap` because it separates two DIFFERENT things rather than
       two parts of one action — at 7 the pill reads as a fourth social item. */
    socialToOffer: 12,
    /** Glyph -> label inside the Offer control, either layout. */
    offerGap: 7,
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
    /** Glyph well -> label in a menu row. Matches the card's avatar -> text. */
    menuGap: 12,
    /** Title -> the first menu row, and the rule above a destructive group. */
    menuTop: 6,
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

  /* ── Home redesign (preview) ──────────────────────────────────────────── */
  home: {
    /** Safe-area top + this, then the search row. */
    top: 8,
    /** One shared gradient behind the pinned header and the scrolling hero. */
    gradientHeight: 520,
    headerFadeDistance: 24,
    mascotVisibleHeight: 180,
    archHeight: 160,
    archRise: 44,
    archButtonOffset: 14,
    actionTop: 38,
    searchGap: 10,
    headerToHero: 16,
    heroX: 18,
    heroY: 18,
    heroSubToCta: 12,
    /** Hero → Categories → Exclusive. */
    sectionTop: 24,
    headingToContent: 12,
    categoryGap: 14,
    circleToLabel: 7,
    tileBody: 12,
    tileTitleToMeta: 3,
    tileMetaToLeaves: 6,
    tileBadgeInset: 8,
    tileBadgeGap: 6,
    /**
     * Section header: title row -> subtitle. The squiggle starts at the
     * bottom of the title's line box and its stroke reaches about 6.25 px
     * below it, so 12 leaves ~5.75 px clear above the subtitle.
     */
    titleToSubtitle: 12,
    /** Title text -> its trailing icon. */
    titleToIcon: 6,
    /** Shop Spotlight card: body padding, and how far the logo rides up into the hero. */
    spotlightBody: 12,
    spotlightLogoOverlap: 22,
    bottom: 28,
  },

  matches: {
    y: 18,
    headerToRail: 12,
    headingToSub: 4,
    cardGap: 10,
    thumbToTitle: 8,
    titleToMeta: 5,
  },

  /* ── MSME storefront ──────────────────────────────────────────────────────
     Read off "MSME Profile 1a". The design's 20 px gutter is NOT carried over:
     the tabs and grid under the header sit on `screenX`, and a header on a
     different gutter from the list it heads reads as misaligned. */
  storefront: {
    /** Logo → name row. */
    logoToName: 12,
    nameToMeta: 4,
    nameGap: 8,
    metaGap: 6,
    metaToBody: 12,
    /** Description → actions, actions → stats card, stats card → setup card. */
    block: 16,
    actionGap: 10,
    statsY: 12,
    statGap: 2,
    cardPad: 16,
    /** Setup card: heading → progress bar → first step. */
    progressTop: 10,
    progressBottom: 6,
    stepY: 10,
    stepGap: 12,
    /** Stats / setup card → the staff section. */
    staffTop: 20,
    staffRowTop: 10,
    staffGap: 12,
    inviteTop: 12,
    inviteGap: 8,
    /** The header's bottom edge → the tabs. */
    bottom: 22,
    overlayInset: 12,
    overlayGap: 8,
    overlayX: 12,
    descriptionY: 12,
    descriptionX: 14,
    descriptionGap: 10,
    emptyY: 28,
    emptyGap: 6,
  },
};

const radius = {
  dButton: 12,
  dCard: 12,
  dPhoto: 8,
  dBadge: 6,
  dSheet: 16,
  dCategoryCircle: 28,
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
  /* Both Offer layouts are fully rounded rather than the 10 the full-width
     button used. A 10 px radius at 40 px tall still reads as a BUTTON, which
     is the shape that made the card look like a form; a capsule reads as an
     action. Half the height in each case. */
  offerInline: 20,
  offerPill: 22,

  /* Marketplace and detail. */
  searchField: 24,
  filterButton: 16,
  gridTile: 10,
  gridPhoto: 10,
  sheet: 18,
  sheetOption: 8,
  rangeInput: 8,
  hubRow: 10,
  carouselDot: 3,
  carouselCount: 10,

  /* Home redesign (preview). */
  hero: 18,
  heroCta: 18,
  categoryCircle: 28,
  exclusiveTile: 14,
  /** The Spotlight card's logo square. Square-ish, never round: see StoreIcon. */
  spotlightLogo: 10,
  tileBadge: 14,
  countdownPill: 12,
  countdownPillLarge: 17,

  /* MSME storefront. */
  storefrontLogo: 22,
  storefrontButton: 14,
  storefrontCard: 16,
  storefrontSetupCard: 18,
  storefrontBadge: 12,
  storefrontPill: 17,
  storefrontInput: 12,
  storefrontProgress: 3,
};

/* ──────────────────────────── 4. COMPONENTS ─────────────────────────── */

const size = {
  design: {
    button: 48,
    secondaryButton: 44,
    input: 44,
    categoryCircle: 56,
    categoryItem: 68,
    categoryIcon: 22,
    inputIcon: 18,
    notification: 16,
  },
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

    /* Offer Trade, in its two layouts. See the note in FeedCard.
       `offerInline` is 40, not 44, and that is deliberate: it rides the 44 px
       social row, so 44 would butt against the row's own bounds and leave the
       pill looking like a mis-drawn full-width button. 40 inside 44 reads as a
       control sitting IN a row. The touch target is not lost -- the row's own
       height is the slop, and 40 is above the 36 that Android's guidance
       treats as the floor for a control inside a list row. */
    offerInline: 40,
    offerInlineX: 16,
    /* On its own row it is not competing with anything, so it takes the full
       44 every other control in this app is built to. */
    offerPill: 44,
    offerPillX: 22,
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
    /** Search and filter share a row and stay comfortably tappable. */
    searchField: 48,
    filterButton: 48,
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
    /* A row in the listing overflow menu. Taller than `option` (44) because a
       menu row is a full-width target read left to right, not a chip in a wrap
       -- 52 is what puts a comfortable 16 of clear space above and below a 19
       px glyph, and it is the height the app's own detail-screen danger rows
       already sit at plus their surrounding gap. */
    menuRow: 52,
    /** Fixed leading well, so every row's label starts on the same x. */
    menuIcon: 24,
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
    /** The circular back / share / more buttons drawn over the photo. */
    overlayButton: 40,
    /** The large countdown pill under the photo. */
    countdownPill: 34,
    countdownPillX: 14,
  },

  /* ── Home redesign (preview) ──────────────────────────────────────────── */
  home: {
    heroHeight: 148,
    /** Fraction of the hero's width the photo occupies, measured from the right. */
    heroPhotoFraction: 0.44,
    /** How far the photo runs past the hero's right edge before the clip. */
    heroPhotoBleed: 18,
    heroCta: 36,
    heroCtaX: 16,
    /** 56, not 44: the label sits under it, so the circle IS the target. */
    categoryCircle: 56,
    /** Width per category column, so labels centre under their circles. */
    categoryItem: 64,
    /** Exclusive tiles are slightly taller than wide, like the reference. */
    exclusiveTileAspect: 0.86,
    /**
     * Exclusive cards visible at once in the single row. Not a whole number
     * on purpose: the sliver of the next card is what says the row scrolls.
     */
    exclusiveCardPerScreen: 1.2,
    /** The Exclusive card's photo, width over height. Wide, like the reference. */
    exclusiveCardPhotoAspect: 1.5,
    /**
     * Recommended cards visible at once: the same card, narrower than
     * Exclusive's, so the two rows do not read as one repeated section.
     */
    recommendedPerScreen: 1.6,
    /** The hand-drawn squiggle under "time": its box height and stroke (real px). */
    squiggleHeight: 8,
    squiggleStroke: 2.5,
    /**
     * Largest system font scale a section heading follows. Past this the
     * title would wrap or push "See all" off a 320 dp screen; body text below
     * it keeps scaling.
     */
    headingMaxFontScale: 1.3,
    searchControl: 52,
    /**
     * Largest font scale a badge ON A PHOTO follows (the lock badge, the
     * countdown pill on a grid tile). Measured 30 Sep 2026: at 320 dp a tile
     * leaves 127 dp for an overlay, and "A few hours left" needs 125 at 1.15x
     * but 139 at 1.3x. Past this it would cover the photo; the same facts are
     * in the tile's screen-reader label.
     */
    overlayMaxFontScale: 1.15,
    /** Shop Spotlight cards visible at once; the part-card says it scrolls. */
    spotlightPerScreen: 1.6,
    /** Width over height: tall, a promo card rather than a tile. */
    spotlightAspect: 0.68,
    /** Share of the card's height the hero image takes. */
    spotlightHeroFraction: 0.52,
    /** The square logo, or the shop-front placeholder in its place. */
    spotlightLogo: 44,
    tileBadge: 28,
    countdownPill: 26,
    countdownPillX: 10,
  },

  /* ── MSME storefront ──────────────────────────────────────────────────── */
  storefront: {
    banner: 148,
    logo: 84,
    /** The page-coloured ring that lifts the logo off a busy banner. */
    logoRing: 4,
    /** How far the logo rises into the banner. Just under half, as drawn. */
    logoLift: 40,
    /** Edit / Follow / Message / Share. 46, not 44: the design's own value. */
    button: 46,
    badge: 24,
    badgeX: 9,
    /** "Change cover" and "+ Invite". */
    pill: 34,
    pillX: 12,
    staffAvatar: 44,
    stepMark: 22,
    progress: 6,
    input: 44,
    descriptionMark: 24,
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
  orgBadge: { size: 12, stroke: 1.8 },
  orgLogo: { size: 30, stroke: 1.6 },
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

  /* The swap mark inside the Offer control. Small and HEAVY: it is carrying
     the salience the button lost when it stopped being 48 px of full-width
     green, and a 1.6 stroke at 15 px disappears against a bold 15 px label. */
  offer: { size: 15, stroke: 2 },
  /** Rows in the listing overflow sheet. */
  menuRow: { size: 19, stroke: 1.7 },

  /* Home redesign (preview). */
  category: { size: 23, stroke: 1.6 },
  tileBadge: { size: 14, stroke: 1.9 },
  /** The icon after a section title ("Featured" + sparkle). */
  sectionTitle: { size: 16, stroke: 1.7 },
  /** Shop Spotlight: the placeholder in the logo square, and in an imageless hero. */
  spotlightLogo: { size: 22, stroke: 1.6 },
  spotlightHero: { size: 40, stroke: 1.4 },
  spotlightBadge: { size: 13, stroke: 1.9 },
  /** The flame in the live countdown pill, card and listing sizes. */
  countdown: { size: 12, stroke: 1.2 },
  countdownLarge: { size: 16, stroke: 1.2 },
  /** Back / share / more over the listing photo. */
  photoOverlay: { size: 20, stroke: 1.9 },

  /* MSME storefront. */
  storefrontBadge: { size: 13, stroke: 1.9 },
  storefrontShare: { size: 19, stroke: 2 },
  storefrontStep: { size: 12, stroke: 2.4 },
  storefrontPlus: { size: 14, stroke: 2.2 },
};

const border = {
  d: 1,
  hairline: 1,
  chip: 1,
  /** The stories "+ Post" ring. */
  dashed: 1.5,
  storyRing: 2,
  unreadRing: 2,
  fabRing: 4,
};

const popup = {
  sheetMaxWidth: 560,
  sheetRadius: 28,
  outlineWidth: 2.5,
  shadowOffset: 6,
  mascotDiameter: 150,
  mascotOvalHeight: 132,
  mascotImageSize: 140,
  mascotTop: -76,
  contentTop: 112,
  buttonHeight: 52,
  buttonRadius: 26,
  buttonGap: 10,
  previewRadius: 18,
  previewPadding: 12,
  previewThumbnail: 48,
  stickerX: 10,
  stickerY: 5,
};

/** Direction 1 card and raised shadows; `fab` remains for existing callers. */
const shadow = {
  card: {
    shadowColor: dColor.text,
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  raised: {
    shadowColor: dColor.text,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
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

/**
 * Home's category circles, two-tone (30 Sep 2026).
 *
 * Each circle is a soft `bg` disc; the glyph's outline is `ink` and one of its
 * shapes is filled with `tint`, a step between the two. Six muted families
 * rather than twenty colours: enough that neighbours in the row differ, few
 * enough that the row still reads as one set. All light-only, like the rest
 * of Home. `ink` on `bg` clears 7:1 in every family.
 *
 * A LIT circle (forest disc, light glyph) must NOT take the tint -- that is
 * the one state where the glyph flips colour, and a fill chosen for the pale
 * disc would sit wrong on forest. The tint is an opt-in prop on the glyph for
 * exactly that reason; omit it and the glyph is the plain single-stroke mark.
 */
const categoryTone = {
  green: { bg: "#EAF6EC", tint: "#C9E8D1", ink: "#1B4D2B" },
  clay: { bg: "#FBEEE9", tint: "#F1D2C4", ink: "#80391F" },
  sand: { bg: "#F7F0E0", tint: "#EBDAB1", ink: "#6E5114" },
  sky: { bg: "#EAF1F7", tint: "#CBDCEB", ink: "#23445F" },
  lilac: { bg: "#F1EDF6", tint: "#DCD1EA", ink: "#4D3A66" },
  teal: { bg: "#E6F3F1", tint: "#C3E2DC", ink: "#1C5148" },
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
  dColor,
  dark,
  font,
  type,
  lines,
  space,
  radius,
  size,
  icon,
  border,
  popup,
  shadow,
  motion,
  categoryTone,
  breakpoint,
  textStyle,
};
