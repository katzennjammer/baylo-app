import type { DimensionValue, TextStyle } from "react-native";

/**
 * Type surface for `tokens.js`, which stays CommonJS so Tailwind can load it.
 *
 * Written by hand and kept deliberately literal: `color` is a closed union of
 * role names rather than `Record<string, string>`, so a typo in a component is
 * a compile error rather than `undefined` painting transparent. Same for the
 * type roles.
 */

export type ColorName =
  | "surface"
  | "inset"
  | "control"
  | "storyPost"
  | "ink"
  | "inkSecondary"
  | "inkMuted"
  | "inkStale"
  | "forest"
  | "green"
  | "onGreen"
  | "greenWash"
  | "greenLine"
  | "like"
  | "urgent"
  | "urgentWash"
  | "urgentLine"
  | "divider"
  | "controlLine"
  | "controlLineStrong"
  | "dashed"
  | "skeleton"
  | "skeletonSoft"
  | "failedIcon"
  | "captionFill";

export declare const color: Readonly<Record<ColorName, string>>;

export type FontName =
  | "displayBold"
  | "displaySemi"
  | "sans"
  | "sansMedium"
  | "sansSemi"
  | "sansBold"
  | "mono"
  | "monoMedium";

export declare const font: Readonly<Record<FontName, string>>;

/** A role carries only the properties the spec names for it. */
export type TypeRole = Pick<
  TextStyle,
  "fontFamily" | "fontSize" | "lineHeight" | "letterSpacing" | "fontVariant"
>;

export type TypeRoleName =
  | "wordmark"
  | "wordmarkTight"
  | "itemTitle"
  | "emptyHeadline"
  | "errorHeadline"
  | "username"
  | "metadata"
  | "tierBadge"
  | "leavesHeader"
  | "leavesHeaderTight"
  | "leavesCard"
  | "chip"
  | "urgencyChip"
  | "primaryButton"
  | "emptyPrimaryButton"
  | "secondaryButton"
  | "socialCount"
  | "sectionHeading"
  | "sectionSubcopy"
  | "sectionEyebrow"
  | "trendingChip"
  | "matchesTitle"
  | "matchesMeta"
  | "storyPostLabel"
  | "storyHandle"
  | "tabActive"
  | "tabInactive"
  | "unreadBadge"
  | "avatarInitials40"
  | "avatarInitials62"
  | "emptyBody"
  | "offlineText"
  | "lastSynced"
  | "photoCaption"
  | "searchInput"
  | "gridTitle"
  | "gridLeaves"
  | "gridMeta"
  | "resultCount"
  | "sheetTitle"
  | "sheetLabel"
  | "detailTitle"
  | "detailLeaves"
  | "detailSection"
  | "detailBody"
  | "hubName"
  | "hubLandmark"
  | "dangerAction"
  | "carouselCount";

export declare const type: Readonly<Record<TypeRoleName, TypeRole>>;

export declare const lines: Readonly<{
  itemTitle: number;
  username: number;
  metadata: number;
  storyHandle: number;
  matchesTitle: number;
}>;

export declare const space: Readonly<{
  screenX: number;
  screenXTight: number;
  header: Readonly<{ row: number; bottom: number; gap: number; gapTight: number }>;
  tab: Readonly<{
    row: number;
    top: number;
    bottom: number;
    iconToLabel: number;
    fabToLabel: number;
  }>;
  card: Readonly<{
    top: number;
    bottom: number;
    ownerToPhoto: number;
    photoToTitle: number;
    titleToChips: number;
    chipsToSocial: number;
    socialToButton: number;
    ownerGap: number;
    nameToMeta: number;
    titleToLeaves: number;
    chipGap: number;
    socialInset: number;
    socialGap: number;
    nameToBadge: number;
    failedGap: number;
    socialToOffer: number;
    offerGap: number;
  }>;
  chip: Readonly<{ x: number; y: number }>;
  tierBadge: Readonly<{ x: number; y: number }>;
  photoCaption: Readonly<{ x: number; y: number; inset: number }>;
  stories: Readonly<{
    top: number;
    x: number;
    bottom: number;
    gap: number;
    avatarToLabel: number;
  }>;
  offline: Readonly<{ y: number; gap: number }>;
  empty: Readonly<{
    x: number;
    iconToHeadline: number;
    headlineToBody: number;
    bodyToButton: number;
    buttonToNote: number;
  }>;
  error: Readonly<{
    x: number;
    iconToHeadline: number;
    headlineToBody: number;
    bodyToButton: number;
    buttonToSynced: number;
  }>;
  trending: Readonly<{ y: number; headerToRail: number; chipGap: number }>;
  browse: Readonly<{
    searchY: number;
    searchGap: number;
    chipsY: number;
    chipGap: number;
    gridX: number;
    gridGap: number;
    tileBody: number;
    tileTitleToMeta: number;
    tileMetaToLeaves: number;
    countY: number;
  }>;
  sheet: Readonly<{
    x: number;
    top: number;
    bottom: number;
    titleToBody: number;
    groupGap: number;
    labelToOptions: number;
    optionGap: number;
    rangeGap: number;
    actionsTop: number;
    actionGap: number;
    menuGap: number;
    menuTop: number;
  }>;
  detail: Readonly<{
    x: number;
    photoToBody: number;
    titleToLeaves: number;
    leavesToChips: number;
    chipsToOwner: number;
    ownerY: number;
    sectionY: number;
    headingToBody: number;
    hubGap: number;
    hubIconToText: number;
    hubNameToLandmark: number;
    dangerY: number;
    dangerGap: number;
    actionBarClearance: number;
    actionBarY: number;
  }>;
  matches: Readonly<{
    y: number;
    headerToRail: number;
    headingToSub: number;
    cardGap: number;
    thumbToTitle: number;
    titleToMeta: number;
  }>;
}>;

export type RadiusName =
  | "card"
  | "primaryButton"
  | "emptyPrimaryButton"
  | "chip"
  | "trendingChip"
  | "leavesPillHeader"
  | "leavesPillHeaderTight"
  | "leavesChipCard"
  | "tierBadge"
  | "ownerAvatar"
  | "storyAvatar"
  | "fab"
  | "unreadBadge"
  | "matchesThumb"
  | "photoCaption"
  | "reloadButton"
  | "offerInline"
  | "offerPill"
  | "searchField"
  | "filterButton"
  | "gridTile"
  | "gridPhoto"
  | "sheet"
  | "sheetOption"
  | "rangeInput"
  | "hubRow"
  | "carouselDot"
  | "carouselCount";

export declare const radius: Readonly<Record<RadiusName, number>>;

export declare const size: Readonly<{
  avatar: Readonly<{
    owner: number;
    story: number;
    storyRing: number;
    storyGap: number;
    storyImage: number;
  }>;
  photo: Readonly<{
    aspectDefault: number;
    aspectMin: number;
    aspectMax: number;
    matchesThumb: number;
  }>;
  control: Readonly<{
    primaryButton: number;
    emptyPrimaryButton: number;
    secondaryButton: number;
    errorRetry: number;
    errorRetryX: number;
    social: number;
    socialX: number;
    headerIcon: number;
    headerIconTight: number;
    kebab: number;
    kebabInset: number;
    trendingChip: number;
    trendingChipX: number;
    tabItem: number;
    fab: number;
    fabLift: number;
    reloadButton: number;
    reloadButtonX: number;
    offerInline: number;
    offerInlineX: number;
    offerPill: number;
    offerPillX: number;
  }>;
  badge: Readonly<{
    unread: number;
    unreadX: number;
    unreadXWide: number;
    unreadTop: number;
    unreadRight: number;
    unreadRightWide: number;
  }>;
  leaves: Readonly<{
    headerPill: number;
    headerPillTight: number;
    headerPillLeft: number;
    headerPillRight: number;
    headerPillLeftTight: number;
    headerPillRightTight: number;
    cardChip: number;
    gap: number;
    cardChipLeft: number;
    cardChipRight: number;
  }>;
  emptyIconCircle: number;
  errorIconCircle: number;
  browse: Readonly<{
    searchField: number;
    filterButton: number;
    chip: number;
    chipX: number;
    tilePhotoAspect: number;
  }>;
  sheet: Readonly<{
    option: number;
    optionX: number;
    rangeInput: number;
    action: number;
    menuRow: number;
    menuIcon: number;
    handleW: number;
    handleH: number;
  }>;
  detail: Readonly<{
    photoAspect: number;
    dot: number;
    dotGap: number;
    hubIcon: number;
    dangerRow: number;
    actionButton: number;
    backButton: number;
  }>;
  skeletonBlock: Readonly<{
    storyLabel: Readonly<{ w: number; h: number }>;
    name: Readonly<{ w: number; h: number }>;
    meta: Readonly<{ w: number; h: number }>;
    title: Readonly<{ w: DimensionValue; h: number }>;
    leavesChip: number;
    chip: number;
    chipWide: number;
    chipHeight: number;
    social: Readonly<{ w: number; h: number }>;
  }>;
}>;

/** Every icon carries its own stroke weight; the kebab carries a dot radius. */
export interface IconSpec {
  size: number;
  stroke?: number;
  dotRadius?: number;
}

export type IconName =
  | "headerAction"
  | "headerLeaf"
  | "headerLeafTight"
  | "cardLeaf"
  | "matchesLeaf"
  | "social"
  | "kebab"
  | "tabActive"
  | "tabInactive"
  | "fabPlus"
  | "storyPlus"
  | "offlineWarning"
  | "failedPhoto"
  | "retryError"
  | "retryPhoto"
  | "emptyLeaf"
  | "errorMark"
  | "search"
  | "filter"
  | "clear"
  | "back"
  | "chevron"
  | "detailLeaf"
  | "hubPin"
  | "danger"
  | "check"
  | "emptyGrid"
  | "offer"
  | "menuRow";

export declare const icon: Readonly<Record<IconName, IconSpec>>;

export declare const border: Readonly<{
  hairline: number;
  chip: number;
  dashed: number;
  storyRing: number;
  unreadRing: number;
  fabRing: number;
}>;

export declare const shadow: Readonly<{
  fab: Readonly<{
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: Readonly<{ width: number; height: number }>;
    elevation: number;
  }>;
}>;

export declare const motion: Readonly<{
  skeletonPulseMs: number;
  skeletonFrom: number;
  skeletonTo: number;
  photoFadeMs: number;
}>;

export declare const breakpoint: Readonly<{ tight: number }>;

/** Adds `includeFontPadding: false` to a role. See the note in tokens.js. */
export declare function textStyle(role: TypeRole): TextStyle;
