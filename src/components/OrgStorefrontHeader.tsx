import { Image } from "expo-image";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { orgLogoUrl, useOrganizations } from "../api/organizations";
import type { PublicProfilePayload } from "../api/types";
import { businessCategoryLabel } from "../lib/business-category";
import { compactCount, formatFollowers } from "../lib/format";
import { ORG_BADGE_LABEL } from "../lib/org";
import { border, color, dark as darkTokens, icon, radius, size, space, textStyle, type } from "../theme/tokens";
import { useKeyboardState } from "./auth-sheet";
import { CheckIcon, ChevronLeftIcon, MessageIcon, PlusIcon, ShareIcon, VerifiedOrgIcon } from "./icons";
import { bracketOf } from "../lib/brackets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tappable } from "./Tappable";
import { PremiumTag } from "./PremiumTag";
import { sizedImage } from "../media/image-url";
import { MascotEmptyState } from "./MascotEmptyState";
import type { MascotPose } from "../media/mascots";

/**
 * The MSME storefront header — the top of an organisation's profile.
 *
 * Visual source: docs/design/MSME Profile 1a.dc.html. Read that file for the
 * layout; this comment is about what the layout is NOT allowed to change.
 *
 * ── A DIFFERENT LAYOUT, NOT A RE-SKINNED PERSON ─────────────────────────────
 *
 * A person's header is a portrait: round avatar left, social stats right, a bio.
 * A shop's is a shopfront, the Shopee/Carousell shape: a full-bleed cover image,
 * the square logo anchored where the cover meets the page, then the business
 * identity (name, checkmark, category, tagline) and the business numbers.
 * Everything a person's header has that does not describe a business is simply
 * not here: no trust tier (orgs do not climb the ladder), no personal bio (the
 * tagline is the org's own column), no Followers/Following stats, and no
 * achievements shelf (the backing account cannot log in to pick badges, so the
 * shelf could only ever be empty or accidental).
 *
 * Followers ARE shown, as one "1.2K followers" line right above the Follow
 * button -- people follow shops, and the count is the shop's social proof.
 * Following a shop is the ordinary Follow row on its backing account, so this
 * is the same `counts.followers` a person's profile shows.
 *
 * Below this header the screen is UNCHANGED from a person's: the same tabs and
 * the same three-across listings grid. That half is shared on purpose. The
 * design draws labelled tabs and a two-column priced grid; neither is adopted
 * here -- Baylo has no peso prices, and the tabs are shared with the person
 * profile.
 *
 * ── STANDALONE, NOT IMPORTED FROM app/(app)/profile ─────────────────────────
 *
 * It replaces the square-logo variant of the person header that user.tsx used
 * to draw (OrgLogo / VerifiedOrgBadge, removed from profile.tsx with it), and
 * imports nothing from a route file, so profile.tsx can render it without an
 * import cycle.
 *
 * ── OWNER ONLY ──────────────────────────────────────────────────────────────
 *
 * Staff, the staff roster and staff invitations were removed on 2 Oct 2026. A
 * shop is its owner: `viewerRole` is "OWNER" for them and null for everybody
 * else, and that is the only thing this header branches on.
 *
 * ── EVERY NUMBER AND EVERY CHECKMARK IS A REAL ROW ──────────────────────────
 *
 * The stats card and the owner's setup checklist read only what the server
 * sent. Nothing in this file renders a figure it had to make up.
 */

type Org = NonNullable<PublicProfilePayload["user"]["org"]>;
type Palette = typeof lightPalette;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the header never reads the rows
/**
 * The keyboard arithmetic for a screen that hosts this header, lifted from
 * post-item.tsx's `imeInset` unchanged -- read the derivation there.
 *
 * In short: edge-to-edge makes `adjustResize` a no-op, so the window never
 * shrinks and the list keeps scrolling UNDER the keyboard. The host gives the
 * IME's height back as the list's `marginBottom`. `useKeyboardState()` is the
 * same auth-sheet hook the post flow and the auth screens measure with.
 *
 * STAFF INVITES WERE REMOVED (2 Oct 2026), and the invite field was the only
 * text input on this header. The hook and the two props it feeds stay so the
 * host screens need no change; nothing here reads them any more.
 */
export function useStorefrontKeyboard() {
  const { height } = useWindowDimensions();
  const { keyboardUp, imeHeight } = useKeyboardState();
  const restHeight = useRef(height);
  if (!keyboardUp) restHeight.current = height;
  const shrunk = Math.max(0, restHeight.current - height);
  const imeInset = keyboardUp ? Math.max(0, Math.min(imeHeight - shrunk, height * 0.7)) : 0;
  return { keyboardUp, imeInset };
}

export function OrgStorefrontHeader({
  dark,
  org,
  counts,
  follow,
  onMessage,
  onEdit,
  onShare,
  onPost,
  onBack,
  location,
  listingValues = [],
  premium = false,
}: {
  dark: boolean;
  org: Org;
  /** The shop's own live Premium or VIP term: the PREMIUM tag beside its name. */
  premium?: boolean;
  counts: PublicProfilePayload["counts"];
  /** Unused since the staff roster was removed; accepted so hosts need no change. */
  viewerId?: string | null;
  /** Follow + Message are for outsiders. The owner gets Edit / Share instead. */
  follow: { label: string; busy: boolean; disabled: boolean; primary: boolean; onPress: () => void };
  onMessage: () => void;
  onEdit: () => void;
  onShare: () => void;
  /**
   * The setup checklist's "Post" step. Passed ONLY when this device is acting
   * as this shop: otherwise the post flow would list on the owner's personal
   * shelf, which is exactly what the checklist must not lead them into.
   */
  onPost?: () => void;
  /** The pushed screen's back button. Absent on the Profile tab, which has its own header. */
  onBack?: () => void;
  /** The backing account's location line, e.g. "Tagbilaran, Bohol". */
  location?: string | null;
  /** Leaf values of the shop's live listings: the bracket range in the facts line. */
  listingValues?: (number | null)[];
}) {
  const palette = dark ? darkPalette : lightPalette;
  const insets = useSafeAreaInsets();
  const role = org.viewerRole ?? null;
  const isOwner = role === "OWNER";
  const logo = orgLogoUrl(org.logoUrl);
  const banner = org.bannerUrl ? orgLogoUrl(org.bannerUrl) : null;
  const completedTrades = org.completedTrades ?? counts.completedTrades;
  const joined = joinedMonth(org.createdAt);
  const brackets = listingValues.filter((v): v is number => v !== null).map(bracketOf);
  const lo = brackets.length ? Math.min(...brackets) : null;
  const hi = brackets.length ? Math.max(...brackets) : null;
  const range = lo === null ? null : lo === hi ? `Bracket ${lo}` : `Brackets ${lo}–${hi}`;
  // Only the owner ever learns why there is no badge; for everyone else an
  // unverified shop simply has none.
  const verificationStatus = useOrganizations(isOwner).data?.data.organizations.find((o) => o.id === org.id)?.verificationStatus;
  const place = [location?.trim() || null, joined ? `Joined ${joined}` : null].filter(Boolean).join(" · ");

  return (
    <View style={s.root}>
      {/* ── Back and share, on the page (the pushed screen only) ── */}
      {onBack ? (
        <View style={[s.topBar, { paddingTop: insets.top }]}>
          <Tappable onPress={onBack} style={s.topButton} pressedStyle={s.pressed} accessibilityRole="button" accessibilityLabel="Go back">
            <ChevronLeftIcon size={22} stroke={2.4} color={palette.ink} />
          </Tappable>
          <Tappable onPress={onShare} style={s.topButton} pressedStyle={s.pressed} accessibilityRole="button" accessibilityLabel="Share shop">
            <ShareIcon size={20} stroke={2.2} color={palette.ink} />
          </Tappable>
        </View>
      ) : null}

      <View style={s.body}>
        {/* ── Cover and logo as ONE block: the logo sits on the cover's bottom edge ── */}
        <View style={s.coverBlock}>
          {banner ? (
            <Image source={{ uri: sizedImage(banner, "full") }} contentFit="cover" style={s.cover} accessibilityLabel={`${org.name} cover image`} />
          ) : (
            // No cover yet: flat brand green, no gradient.
            <View style={[s.cover, { backgroundColor: color.forest }]} />
          )}
          {isOwner ? (
            <Tappable onPress={onEdit} hitSlop={5} style={s.overlayPill} pressedStyle={s.pressed} accessibilityRole="button" accessibilityLabel={banner ? "Change cover image" : "Add a cover image"}>
              <Text style={[textStyle(type.storefrontOverlay), { color: color.onScrim }]}>{banner ? "Change cover" : "Add cover"}</Text>
            </Tappable>
          ) : null}
          <View style={[s.logoFrame, { borderColor: palette.surface, backgroundColor: palette.surface }]}>
            {logo ? (
              <Image source={{ uri: sizedImage(logo, "thumb") }} contentFit="cover" style={s.logo} accessibilityLabel={`${org.name} logo`} />
            ) : (
              <View style={[s.logo, s.logoFallback]} accessibilityLabel={`${org.name}, no logo`}>
                <Text style={[textStyle(type.storefrontLogoInitial), { color: color.onGreen }]}>{org.name.trim().charAt(0).toUpperCase() || "?"}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={s.nameWithTag}>
          <Text style={[textStyle(type.storefrontName), s.name, { color: palette.ink }]} numberOfLines={2}>{org.name}</Text>
          {premium ? <PremiumTag size="large" /> : null}
        </View>

        {/*
          "Verified MSME" ONLY when org.verified -- true only after an admin
          approved the shop (verificationStatus VERIFIED on the server). A
          pending or rejected shop shows the category alone; its owner also
          sees why, marked as visible only to them.
        */}
        <View style={s.identityLine}>
          {org.verified ? (
            <>
              <VerifiedOrgIcon size={15} stroke={2} color={palette.link} />
              <Text style={[textStyle(type.storefrontMeta), s.verified, { color: palette.link }]} accessibilityLabel={ORG_BADGE_LABEL.full}>{ORG_BADGE_LABEL.full}</Text>
              <Text style={[textStyle(type.storefrontMeta), { color: palette.muted }]}> · </Text>
            </>
          ) : isOwner ? (
            <Text style={[textStyle(type.storefrontMeta), { color: palette.muted }]}>
              {verificationStatus === "REJECTED" ? "Not approved (only you see this)" : "Pending review (only you see this)"}
              {" · "}
            </Text>
          ) : null}
          <Text style={[textStyle(type.storefrontMeta), { color: palette.muted }]}>{businessCategoryLabel(org.businessCategory)}</Text>
        </View>

        {/* ── Tagline, or the owner's prompt to write one ── */}
        {org.description ? (
          <Text style={[textStyle(type.storefrontBody), s.description, { color: palette.ink }]} numberOfLines={4}>{org.description}</Text>
        ) : isOwner ? (
          <Tappable onPress={onEdit} style={[s.addDescription, { borderColor: palette.dashed }]} pressedStyle={s.pressed} accessibilityRole="button" accessibilityLabel="Add a short description of your shop">
            <View style={[s.addMark, { backgroundColor: palette.control }]}>
              <PlusIcon size={icon.storefrontPlus.size} stroke={icon.storefrontPlus.stroke} color={palette.ink} />
            </View>
            <Text style={[textStyle(type.storefrontStep), s.flex, { color: palette.muted }]}>Add a short description of your shop</Text>
          </Tappable>
        ) : null}

        {place ? <Text style={[textStyle(type.storefrontMeta), s.place, { color: palette.muted }]}>{place}</Text> : null}

        {/* ── The numbers as a sentence: "4 listings in Brackets 1–3 · No trades yet" ── */}
        <Text style={[textStyle(type.storefrontBody), s.facts, { color: palette.ink }]}>
          <Text style={s.strong}>{counts.listed === 0 ? "No listings yet" : `${counts.listed} ${counts.listed === 1 ? "listing" : "listings"}`}</Text>
          {counts.listed > 0 && range ? ` in ${range}` : ""}
          {" · "}
          <Text style={s.strong}>{completedTrades === 0 ? "No trades yet" : `${completedTrades} ${completedTrades === 1 ? "trade" : "trades"}`}</Text>
          {"\n"}
          <Text style={{ color: palette.muted }} accessibilityLabel={formatFollowers(counts.followers)}>
            {compactCount(counts.followers)} {counts.followers === 1 ? "follower" : "followers"}
          </Text>
        </Text>

        {/* ── Actions: the owner manages and shares; everyone else follows and messages. ── */}
        <View style={s.actions}>
          {isOwner ? (
            <>
              <ActionButton palette={palette} label="Edit shop" onPress={onEdit} primary />
              <ActionButton palette={palette} label="Share shop" onPress={onShare} />
            </>
          ) : (
            <>
              <ActionButton palette={palette} label={follow.busy ? "Updating..." : follow.label} onPress={follow.onPress} disabled={follow.disabled} primary={follow.primary} />
              <ActionButton palette={palette} label="Message" onPress={onMessage} />
            </>
          )}
        </View>

        {isOwner ? (
          <SetupCard
            palette={palette}
            org={org}
            hasListings={counts.listed > 0 || completedTrades > 0}
            onEdit={onEdit}
            onPost={onPost}
          />
        ) : null}
      </View>
    </View>
  );
}

/**
 * The shop's "About" tab: the business facts as label / value rows. Every row
 * is a field the server sent; a row with nothing to say is left out.
 */
export function ShopAbout({ dark, org, location, completedTrades }: {
  dark: boolean;
  org: Org;
  location?: string | null;
  completedTrades: number;
}) {
  const palette = dark ? darkPalette : lightPalette;
  const rows: [string, string][] = [
    ["Category", businessCategoryLabel(org.businessCategory)],
    ...(location?.trim() ? [["Based in", location.trim()] as [string, string]] : []),
    ...(joinedMonth(org.createdAt) ? [["On Baylo since", joinedMonth(org.createdAt)!] as [string, string]] : []),
    ["Verification", org.verified ? ORG_BADGE_LABEL.full : "Not verified yet"],
    ["Trades completed", String(completedTrades)],
    ["Where trades happen", "At Safe-Zone hubs, like every Baylo trade"],
  ];
  return (
    <View style={s.about}>
      {org.description ? (
        <Text style={[textStyle(type.storefrontBody), { color: palette.ink }]}>{org.description}</Text>
      ) : null}
      <View style={[s.aboutCard, { borderColor: palette.divider, backgroundColor: palette.card }]}>
        {rows.map(([label, value], i) => (
          <View key={label} style={[s.aboutRow, i > 0 && { borderTopWidth: border.hairline, borderTopColor: palette.divider }]}>
            <Text style={[textStyle(type.storefrontMeta), { color: palette.muted }]}>{label}</Text>
            <Text style={[textStyle(type.storefrontStep), s.aboutValue, { color: palette.ink }]}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** "Mar 2026" from an ISO date, or null if it does not parse. */
function joinedMonth(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * "Finish setting up" — the OWNER's checklist. Every step is read from a real
 * field, and the card is gone once all three are done:
 *
 *   Get verified            org.verified (the admin's decision; no CTA, the
 *                           owner cannot do anything but wait)
 *   Add a shop description  org.description
 *   Post your first listing an active listing OR a completed trade, so a shop
 *                           whose only listing traded is not asked again
 */
function SetupCard({ palette, org, hasListings, onEdit, onPost }: {
  palette: Palette;
  org: Org;
  hasListings: boolean;
  onEdit: () => void;
  onPost?: () => void;
}) {
  // A shared react-query cache the Profile tab already reads, so not an extra request.
  const verificationStatus = useOrganizations().data?.data.organizations.find((o) => o.id === org.id)?.verificationStatus;

  const steps: { key: string; label: string; done: boolean; cta?: { label: string; onPress: () => void }; note?: string }[] = [
    {
      key: "verified",
      label: "Get verified",
      done: org.verified,
      note: verificationStatus === "REJECTED" ? "Not approved" : "In review",
    },
    { key: "description", label: "Add a shop description", done: !!org.description?.trim(), cta: { label: "Add", onPress: onEdit } },
    {
      key: "listing",
      label: "Post your first listing",
      done: hasListings,
      // Only a verified shop can post, and only while acting as it.
      cta: org.verified && onPost ? { label: "Post", onPress: onPost } : undefined,
    },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  if (doneCount === steps.length) return null;

  return (
    <View style={[s.setupCard, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
      <View style={s.setupHeading}>
        <Text style={[textStyle(type.storefrontSection), { color: palette.ink }]}>Finish setting up</Text>
        <Text style={[textStyle(type.storefrontStaffRole), { color: palette.muted }]}>{doneCount} of {steps.length}</Text>
      </View>
      <View style={[s.progressTrack, { backgroundColor: palette.control }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: steps.length, now: doneCount }}>
        <View style={[s.progressFill, { width: `${(doneCount / steps.length) * 100}%` }]} />
      </View>
      {steps.map((step) => (
        <View key={step.key} style={[s.step, { borderTopColor: palette.divider }]}>
          <View style={[s.stepMark, step.done ? s.stepMarkDone : { borderColor: palette.dashed }]}>
            {step.done ? <CheckIcon size={icon.storefrontStep.size} stroke={icon.storefrontStep.stroke} color={color.onGreen} /> : null}
          </View>
          <Text style={[textStyle(type.storefrontStep), s.flex, step.done ? [s.stepDone, { color: palette.muted }] : { color: palette.ink }]}>{step.label}</Text>
          {step.done ? null : step.cta ? (
            <Pressable onPress={step.cta.onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${step.cta.label}: ${step.label}`}>
              <Text style={[textStyle(type.storefrontLink), { color: palette.link }]}>{step.cta.label}</Text>
            </Pressable>
          ) : step.note ? (
            <Text style={[textStyle(type.storefrontStaffRole), { color: palette.muted }]}>{step.note}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/**
 * The storefront's empty list, under its tabs. A title and a line of guidance,
 * as the design draws it, in place of the person profile's one muted sentence.
 */
export function StorefrontEmpty({
  dark,
  title,
  body,
  pose,
}: {
  dark: boolean;
  title: string;
  body: string;
  pose?: MascotPose;
}) {
  if (pose) return <MascotEmptyState pose={pose} title={title} message={body} />;

  const palette = dark ? darkPalette : lightPalette;
  return (
    <View style={s.empty}>
      <Text style={[textStyle(type.storefrontEmptyTitle), s.emptyText, { color: palette.ink }]}>{title}</Text>
      <Text style={[textStyle(type.emptyBody), s.emptyText, s.emptyBody, { color: palette.muted }]}>{body}</Text>
    </View>
  );
}


function ActionButton({ palette, label, onPress, disabled = false, primary = false, withShareIcon = false, withMessageIcon = false }: {
  palette: Palette;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  withShareIcon?: boolean;
  withMessageIcon?: boolean;
}) {
  const ink = primary ? color.onGreen : palette.ink;
  return (
    <Tappable
      onPress={onPress}
      disabled={disabled}
      style={[s.actionButton, { backgroundColor: primary ? color.green : palette.control }, disabled && s.disabled]}
      pressedStyle={s.pressed}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      {withShareIcon ? <ShareIcon size={icon.storefrontShare.size - 2} stroke={icon.storefrontShare.stroke} color={ink} /> : null}
      {withMessageIcon ? <MessageIcon size={18} stroke={2} color={ink} /> : null}
      <Text style={[textStyle(type.primaryButton), { color: ink }]}>{label}</Text>
    </Tappable>
  );
}

const LOGO_INNER = size.storefront.logo;
const LOGO_OUTER = LOGO_INNER + size.storefront.logoRing * 2;
/** Cover height below the status bar; the cover runs up under it (no top bar on a shop). */
const COVER = 160;

const s = StyleSheet.create({
  root: { paddingBottom: space.storefront.bottom },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 8, paddingBottom: 4 },
  topButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  coverBlock: { marginTop: 8, marginBottom: LOGO_OUTER / 2 },
  cover: { width: "100%", height: COVER, borderRadius: 18 },
  overlayPill: {
    position: "absolute",
    top: 12,
    right: 12,
    height: size.storefront.pill,
    paddingHorizontal: size.storefront.pillX,
    borderRadius: radius.storefrontPill,
    backgroundColor: color.captionFill,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingHorizontal: space.screenX },
  // The logo straddles the banner's bottom edge. The page-coloured ring is what
  // separates it from a busy banner.
  logoFrame: {
    position: "absolute",
    left: 16,
    bottom: -LOGO_OUTER / 2,
    width: LOGO_OUTER,
    height: LOGO_OUTER,
    borderWidth: size.storefront.logoRing,
    borderRadius: radius.storefrontLogo,
    overflow: "hidden",
  },
  logo: { width: LOGO_INNER, height: LOGO_INNER, borderRadius: radius.storefrontLogo - size.storefront.logoRing },
  logoFallback: { alignItems: "center", justifyContent: "center", backgroundColor: color.green },
  nameRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.storefront.nameGap, marginTop: space.storefront.logoToName },
  nameWithTag: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 10, marginTop: 10 },
  name: { flexShrink: 1 },
  identityLine: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: 4 },
  verified: { fontWeight: "700", marginLeft: 5 },
  place: { marginTop: 8 },
  facts: { marginTop: 14 },
  strong: { fontWeight: "700" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: size.storefront.badge,
    paddingHorizontal: size.storefront.badgeX,
    borderRadius: radius.storefrontBadge,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14, marginTop: space.storefront.metaToBody },
  description: { marginTop: space.storefront.metaToBody },
  addDescription: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.storefront.descriptionGap,
    marginTop: space.storefront.metaToBody,
    paddingVertical: space.storefront.descriptionY,
    paddingHorizontal: space.storefront.descriptionX,
    borderWidth: border.dashed,
    borderStyle: "dashed",
    borderRadius: radius.storefrontButton,
  },
  addMark: {
    width: size.storefront.descriptionMark,
    height: size.storefront.descriptionMark,
    borderRadius: size.storefront.descriptionMark / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1, minWidth: 0 },
  followers: { marginTop: space.storefront.block },
  actions: { flexDirection: "row", gap: space.storefront.actionGap, marginTop: space.storefront.metaToBody },
  actionButton: {
    flex: 1,
    height: size.storefront.button,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.storefrontButton,
  },
  iconButton: {
    width: size.storefront.button,
    height: size.storefront.button,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.storefrontButton,
  },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.8 },
  statsCard: {
    flexDirection: "row",
    // Lifted off the page like the design's card.
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    marginTop: space.storefront.block,
    paddingVertical: space.storefront.statsY,
    borderWidth: border.hairline,
    borderRadius: radius.storefrontCard,
  },
  stat: { flex: 1, alignItems: "center", gap: space.storefront.statGap, paddingHorizontal: 4 },
  setupCard: {
    marginTop: space.storefront.block,
    padding: space.storefront.cardPad,
    borderWidth: border.hairline,
    borderRadius: radius.storefrontSetupCard,
  },
  setupHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  progressTrack: {
    height: size.storefront.progress,
    borderRadius: radius.storefrontProgress,
    marginTop: space.storefront.progressTop,
    marginBottom: space.storefront.progressBottom,
    overflow: "hidden",
  },
  progressFill: { height: size.storefront.progress, borderRadius: radius.storefrontProgress, backgroundColor: color.green },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.storefront.stepGap,
    paddingVertical: space.storefront.stepY,
    borderTopWidth: border.hairline,
  },
  stepMark: {
    width: size.storefront.stepMark,
    height: size.storefront.stepMark,
    borderRadius: size.storefront.stepMark / 2,
    borderWidth: border.dashed,
    alignItems: "center",
    justifyContent: "center",
  },
  stepMarkDone: { backgroundColor: color.green, borderColor: color.green },
  stepDone: { textDecorationLine: "line-through" },
  about: { paddingHorizontal: space.screenX, paddingTop: 16, gap: 14 },
  aboutCard: { borderWidth: border.hairline, borderRadius: radius.storefrontCard, paddingHorizontal: 14 },
  aboutRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 12 },
  aboutValue: { flexShrink: 1, textAlign: "right" },
  empty: { alignItems: "center", paddingVertical: space.storefront.emptyY, paddingHorizontal: space.screenX, gap: space.storefront.emptyGap },
  emptyText: { textAlign: "center" },
  emptyBody: { maxWidth: 260 },
});

/*
 * `link` is TEXT green. The fill green (`color.green`) is too light to read as
 * type on the cream surface, which is why the design sets its links a shade
 * darker than its buttons; `forest` is this token set's darker green.
 */
const lightPalette = {
  surface: color.surface,
  control: color.control,
  ink: color.ink,
  muted: color.inkMuted,
  divider: color.divider,
  border: color.controlLineStrong,
  dashed: color.dashed,
  green: color.green,
  link: color.forest,
  wash: color.greenWash,
  onWash: color.forest,
  greenLine: color.greenLine,
  card: "#FFFFFF",
};
const darkPalette: Palette = {
  surface: darkTokens.surface,
  control: darkTokens.control,
  ink: darkTokens.ink,
  muted: darkTokens.muted,
  divider: darkTokens.divider,
  border: darkTokens.border,
  dashed: darkTokens.border,
  green: darkTokens.green,
  link: darkTokens.green,
  wash: darkTokens.greenWash,
  onWash: darkTokens.onGreenWash,
  greenLine: darkTokens.border,
  card: darkTokens.control,
};
