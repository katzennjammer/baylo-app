import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { orgLogoUrl, useOrganizations } from "../api/organizations";
import type { PublicProfilePayload } from "../api/types";
import { businessCategoryLabel } from "../lib/business-category";
import { compactCount, formatFollowers } from "../lib/format";
import { ORG_BADGE_LABEL } from "../lib/org";
import { border, color, dark as darkTokens, icon, radius, size, space, textStyle, type } from "../theme/tokens";
import { useKeyboardState } from "./auth-sheet";
import { CheckIcon, ChevronLeftIcon, MessageIcon, PinIcon, PlusIcon, ShareIcon, SparkleIcon, StoreIcon, VerifiedOrgIcon } from "./icons";
import { BracketChip } from "./BracketChip";
import { bracketOf } from "../lib/brackets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tappable } from "./Tappable";
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

/** A shop younger than this reads "New shop" beside its logo. */
const NEW_SHOP_DAYS = 30;

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
}: {
  dark: boolean;
  org: Org;
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
  /** Drawn over the cover (6 Nov 2026): the shop page has no separate top bar. */
  onBack?: () => void;
  /** The backing account's location line, e.g. "Tagbilaran, Bohol". */
  location?: string | null;
  /** Leaf values of the shop's live listings, for the "Trades in brackets" card. */
  listingValues?: (number | null)[];
}) {
  const palette = dark ? darkPalette : lightPalette;
  // The cover runs up under the status bar only on the pushed screen, which
  // has no top bar of its own (onBack). As a tab it sits under the app header.
  const insets = useSafeAreaInsets();
  const coverTop = onBack ? insets.top : 0;
  const role = org.viewerRole ?? null;
  const isOwner = role === "OWNER";
  const logo = orgLogoUrl(org.logoUrl);
  const banner = org.bannerUrl ? orgLogoUrl(org.bannerUrl) : null;
  const completedTrades = org.completedTrades ?? counts.completedTrades;
  const joined = joinedMonth(org.createdAt);
  const isNew = Date.now() - new Date(org.createdAt).getTime() < NEW_SHOP_DAYS * 86_400_000;
  // The brackets the shop's live listings sit in, low to high. A trader can
  // offer on any of them with an item within one bracket -- the same rule the
  // offer screen enforces -- so the card states the rule, not a promise.
  const brackets = [...new Set(listingValues.filter((v): v is number => v !== null).map(bracketOf))].sort((a, b) => a - b);
  // The owner's own view of a shop that is not verified yet. Outsiders see no
  // badge at all, which is what they already saw.
  const verificationStatus = useOrganizations(isOwner).data?.data.organizations.find((o) => o.id === org.id)?.verificationStatus;

  return (
    <View style={s.root}>
      {/* ── Cover, with back / share over it and the logo on its bottom edge ── */}
      <View>
        {banner ? (
          <Image source={{ uri: sizedImage(banner, "full") }} contentFit="cover" style={[s.banner, { height: COVER + coverTop }]} accessibilityLabel={`${org.name} cover image`} />
        ) : (
          // No banner yet: a token gradient, so a new shop's page still reads
          // as designed rather than as an image that failed to load.
          <LinearGradient colors={[color.forest, color.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.banner, { height: COVER + coverTop }]} />
        )}
        <View style={[s.coverBar, { top: coverTop + 8 }]}>
          {onBack ? (
            <Tappable onPress={onBack} style={s.coverButton} pressedStyle={s.pressed} accessibilityRole="button" accessibilityLabel="Go back">
              <ChevronLeftIcon size={20} stroke={2.4} color={color.onScrim} />
            </Tappable>
          ) : <View />}
          <View style={s.coverRight}>
            {isOwner ? (
              // Edit shop is where the banner is changed, so this is a shortcut to
              // the same screen, not a second editor.
              <Tappable onPress={onEdit} hitSlop={5} style={s.overlayPill} pressedStyle={s.pressed} accessibilityRole="button" accessibilityLabel={banner ? "Change cover image" : "Add a cover image"}>
                <Text style={[textStyle(type.storefrontOverlay), { color: color.onScrim }]}>{banner ? "Change cover" : "Add cover"}</Text>
              </Tappable>
            ) : null}
            <Tappable onPress={onShare} style={s.coverButton} pressedStyle={s.pressed} accessibilityRole="button" accessibilityLabel="Share shop">
              <ShareIcon size={18} stroke={2.2} color={color.onScrim} />
            </Tappable>
          </View>
        </View>
      </View>

      <View style={s.body}>
        {/* ── Logo (verified seal on its corner), "New shop" on the right ── */}
        <View style={s.logoRow}>
          <View>
            <View style={[s.logoFrame, { borderColor: palette.surface, backgroundColor: palette.surface }]}>
              {logo ? (
                <Image source={{ uri: sizedImage(logo, "thumb") }} contentFit="cover" style={s.logo} accessibilityLabel={`${org.name} logo`} />
              ) : (
                <View style={[s.logo, s.logoFallback]} accessibilityLabel={`${org.name}, no logo`}>
                  <Text style={[textStyle(type.storefrontLogoInitial), { color: color.onGreen }]}>{org.name.trim().charAt(0).toUpperCase() || "?"}</Text>
                </View>
              )}
            </View>
            {org.verified ? (
              <View style={[s.seal, { borderColor: palette.surface }]} accessible={false}>
                <CheckIcon size={12} stroke={3} color={color.onGreen} />
              </View>
            ) : null}
          </View>
          {isNew ? (
            <View style={[s.newPill, { backgroundColor: palette.control }]}>
              <SparkleIcon size={13} stroke={2} color={color.urgent} />
              <Text style={[textStyle(type.storefrontStaffRole), { color: palette.ink }]}>New shop</Text>
            </View>
          ) : null}
        </View>

        <Text style={[textStyle(type.storefrontName), s.name, { color: palette.ink }]} numberOfLines={2}>{org.name}</Text>

        {/* ── Badges: Verified MSME ONLY when an admin approved it; the category always ── */}
        <View style={s.pills}>
          {org.verified ? (
            <View style={[s.badge, { backgroundColor: palette.wash }]} accessibilityRole="text" accessibilityLabel={ORG_BADGE_LABEL.full}>
              <VerifiedOrgIcon size={icon.storefrontBadge.size} stroke={icon.storefrontBadge.stroke} color={palette.onWash} />
              <Text style={[textStyle(type.storefrontBadge), { color: palette.onWash }]}>{ORG_BADGE_LABEL.full}</Text>
            </View>
          ) : isOwner ? (
            // Only the owner sees this; everyone else simply sees no badge.
            <View style={[s.badge, { backgroundColor: palette.control }]} accessibilityRole="text">
              <Text style={[textStyle(type.storefrontBadge), { color: palette.muted }]}>
                {verificationStatus === "REJECTED" ? "Not approved · only you see this" : "Pending review · only you see this"}
              </Text>
            </View>
          ) : null}
          <View style={[s.badge, s.outlinePill, { borderColor: palette.border }]}>
            <Text style={[textStyle(type.storefrontBadge), { color: palette.ink }]}>{businessCategoryLabel(org.businessCategory)}</Text>
          </View>
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

        {/* ── Where and since when ── */}
        <View style={s.metaRow}>
          {location?.trim() ? (
            <View style={s.metaItem}>
              <PinIcon size={14} stroke={2} color={palette.muted} />
              <Text style={[textStyle(type.storefrontMeta), { color: palette.muted }]}>{location.trim()}</Text>
            </View>
          ) : null}
          {joined ? (
            <View style={s.metaItem}>
              <StoreIcon size={14} stroke={2} color={palette.muted} />
              <Text style={[textStyle(type.storefrontMeta), { color: palette.muted }]}>Joined {joined}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Actions: the owner manages and shares; everyone else follows and messages. ── */}
        <View style={s.actions}>
          {isOwner ? (
            <>
              <ActionButton palette={palette} label="Edit shop" onPress={onEdit} primary />
              <ActionButton palette={palette} label="Share shop" onPress={onShare} withShareIcon />
            </>
          ) : (
            <>
              <ActionButton palette={palette} label={follow.busy ? "Updating..." : follow.label} onPress={follow.onPress} disabled={follow.disabled} primary={follow.primary} />
              <ActionButton palette={palette} label="Message" onPress={onMessage} withMessageIcon />
            </>
          )}
        </View>

        {/* ── Business numbers. All three are real counts from the server. ── */}
        <View style={[s.statsCard, { borderColor: palette.divider, backgroundColor: palette.card }]}>
          <Stat palette={palette} label={counts.listed === 1 ? "Listing" : "Listings"} value={counts.listed} />
          <Stat palette={palette} label={completedTrades === 1 ? "Trade" : "Trades"} value={completedTrades} ruled />
          <Stat palette={palette} label={counts.followers === 1 ? "Follower" : "Followers"} value={compactCount(counts.followers)} ruled />
        </View>

        {/* ── Which brackets this shop trades in, from its own listings ── */}
        {brackets.length > 0 ? (
          <View style={[s.bracketCard, { borderColor: palette.greenLine, backgroundColor: palette.wash }]}>
            <View style={s.flex}>
              <Text style={[textStyle(type.storefrontStep), { color: palette.onWash, fontWeight: "700" }]}>Trades in brackets</Text>
              <Text style={[textStyle(type.storefrontStaffRole), { color: palette.onWash }]}>Offer an item within one bracket of these</Text>
            </View>
            <View style={s.bracketChips}>
              {brackets.map((b) => <BracketChip key={b} bracket={b} small />)}
            </View>
          </View>
        ) : null}

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

function Stat({ palette, label, value, ruled = false }: { palette: Palette; label: string; value: number | string; ruled?: boolean }) {
  return (
    <View style={[s.stat, ruled && { borderLeftWidth: border.hairline, borderLeftColor: palette.divider }]} accessibilityRole="text" accessibilityLabel={`${value} ${label}`}>
      <Text style={[textStyle(type.storefrontStat), { color: palette.ink }]}>{value}</Text>
      <Text style={[textStyle(type.storefrontStatLabel), { color: palette.muted }]} numberOfLines={1}>{label}</Text>
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
const COVER = 190;

const s = StyleSheet.create({
  root: { paddingBottom: space.storefront.bottom },
  banner: { width: "100%" },
  coverBar: { position: "absolute", left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  coverRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  coverButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.captionFill, alignItems: "center", justifyContent: "center" },
  overlayPill: {
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
  logoRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  seal: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
  },
  newPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, height: 28, borderRadius: 14, marginBottom: 4 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: space.storefront.nameToMeta + 6 },
  outlinePill: { borderWidth: border.hairline },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  bracketCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: space.storefront.block,
    padding: 14,
    borderWidth: border.hairline,
    borderStyle: "dashed",
    borderRadius: radius.storefrontCard,
  },
  bracketChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "flex-end", maxWidth: "55%" },
  logoFrame: {
    width: LOGO_OUTER,
    height: LOGO_OUTER,
    marginTop: -size.storefront.logoLift,
    borderWidth: size.storefront.logoRing,
    borderRadius: radius.storefrontLogo,
    overflow: "hidden",
  },
  logo: { width: LOGO_INNER, height: LOGO_INNER, borderRadius: radius.storefrontLogo - size.storefront.logoRing },
  logoFallback: { alignItems: "center", justifyContent: "center", backgroundColor: color.green },
  nameRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.storefront.nameGap, marginTop: space.storefront.logoToName },
  name: { flexShrink: 1, marginTop: space.storefront.logoToName },
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
