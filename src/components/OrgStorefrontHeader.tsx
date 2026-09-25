import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type FlatList, type ScrollView } from "react-native";

import { ApiError } from "../api/client";
import {
  orgLogoUrl,
  useChangeMemberRole,
  useInviteMember,
  useOrganizations,
  useOrgMembers,
  useRemoveMember,
  type OrgMember,
} from "../api/organizations";
import type { PublicProfilePayload } from "../api/types";
import { businessCategoryLabel } from "../lib/business-category";
import { compactCount, formatFollowers } from "../lib/format";
import { ORG_BADGE_LABEL } from "../lib/org";
import { border, color, dark as darkTokens, icon, radius, size, space, textStyle, type } from "../theme/tokens";
import { useKeyboardState } from "./auth-sheet";
import { showDialog } from "./dialog";
import { CheckIcon, PlusIcon, ShareIcon, VerifiedOrgIcon } from "./icons";
import { Tappable } from "./Tappable";

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
 * ── THE STAFF ROSTER IS FOR MEMBERS ONLY ────────────────────────────────────
 *
 * A non-member sees the Staff COUNT and nothing else. Staff are private people
 * who agreed to post for a shop, not to be listed by name to every stranger
 * who opens it; a public roster is a directory of a small business's employees
 * for anyone with a grudge against one. The server already enforces this —
 * GET .../members 404s a non-member — and `viewerRole` is what stops the
 * client asking.
 *
 * ── EVERY NUMBER AND EVERY CHECKMARK IS A REAL ROW ──────────────────────────
 *
 * The stats card and the owner's setup checklist read only what the server
 * sent. Nothing in this file renders a figure it had to make up.
 */

type Org = NonNullable<PublicProfilePayload["user"]["org"]>;
type Palette = typeof lightPalette;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the header never reads the rows
type Scroller = React.RefObject<FlatList<any> | null>;

/** Space left above the invite row when it is scrolled clear of the keyboard. */
const REVEAL_GAP = 16;

/** ScrollView as it is at runtime; see the measure in StaffSection. */
type ScrollViewWithInnerRef = ScrollView & { getInnerViewRef(): View | null };

/**
 * The keyboard arithmetic for a screen that hosts this header, lifted from
 * post-item.tsx's `imeInset` unchanged -- read the derivation there.
 *
 * In short: edge-to-edge makes `adjustResize` a no-op, so the window never
 * shrinks and the list keeps scrolling UNDER the keyboard. The host gives the
 * IME's height back as the list's `marginBottom`; without it there is no
 * scroll range to bring the invite field up into. `useKeyboardState()` is the
 * same auth-sheet hook the post flow and the auth screens measure with.
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
  viewerId,
  follow,
  onMessage,
  onEdit,
  onShare,
  onPost,
  scrollerRef,
  keyboardUp = false,
}: {
  dark: boolean;
  org: Org;
  counts: PublicProfilePayload["counts"];
  /** The signed-in PERSON, so the owner is not offered "Remove" on their own row. */
  viewerId: string | null;
  /** Follow + Message are for outsiders. Members get Edit / Share instead. */
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
  /** The host screen's list, so the invite field can be scrolled clear of the keyboard. */
  scrollerRef?: Scroller;
  /** From the host's useStorefrontKeyboard(). */
  keyboardUp?: boolean;
}) {
  const palette = dark ? darkPalette : lightPalette;
  const role = org.viewerRole ?? null;
  const isOwner = role === "OWNER";
  const logo = orgLogoUrl(org.logoUrl);
  const banner = org.bannerUrl ? orgLogoUrl(org.bannerUrl) : null;
  const staffCount = counts.staff ?? org.staffCount;
  const completedTrades = org.completedTrades ?? counts.completedTrades;
  // Lifted out of StaffSection so the checklist's "Invite" step can open it.
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <View style={s.root}>
      {/* ── Cover, with the logo anchored on its bottom edge ── */}
      <View>
        {banner ? (
          <Image source={{ uri: banner }} contentFit="cover" style={s.banner} accessibilityLabel={`${org.name} cover image`} />
        ) : (
          // No banner yet: a token gradient, so a new shop's page still reads
          // as designed rather than as an image that failed to load.
          <LinearGradient colors={[color.forest, color.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.banner} />
        )}
        {isOwner ? (
          // Edit shop is where the banner is changed, so this is a shortcut to
          // the same screen, not a second editor. The design's gear ("Shop
          // settings") is not drawn: it has no destination distinct from this.
          <Tappable onPress={onEdit} hitSlop={5} style={s.overlayPill} pressedStyle={s.pressed} accessibilityRole="button" accessibilityLabel={banner ? "Change cover image" : "Add a cover image"}>
            <Text style={[textStyle(type.storefrontOverlay), { color: color.onScrim }]}>{banner ? "Change cover" : "Add cover"}</Text>
          </Tappable>
        ) : null}
      </View>

      <View style={s.body}>
        <View style={[s.logoFrame, { borderColor: palette.surface, backgroundColor: palette.surface }]}>
          {logo ? (
            <Image source={{ uri: logo }} contentFit="cover" style={s.logo} accessibilityLabel={`${org.name} logo`} />
          ) : (
            // No logo: the person profile's initial avatar (profile.tsx Avatar --
            // green fill, onGreen initial), squared to the logo slot.
            <View style={[s.logo, s.logoFallback]} accessibilityLabel={`${org.name}, no logo`}>
              <Text style={[textStyle(type.storefrontLogoInitial), { color: color.onGreen }]}>{org.name.trim().charAt(0).toUpperCase() || "?"}</Text>
            </View>
          )}
        </View>

        {/* ── Name, checkmark ── */}
        <View style={s.nameRow}>
          <Text style={[textStyle(type.storefrontName), s.name, { color: palette.ink }]} numberOfLines={2}>{org.name}</Text>
          {org.verified ? (
            <View style={[s.badge, { backgroundColor: palette.wash }]} accessibilityRole="text" accessibilityLabel={ORG_BADGE_LABEL.full}>
              <VerifiedOrgIcon size={icon.storefrontBadge.size} stroke={icon.storefrontBadge.stroke} color={palette.onWash} />
              <Text style={[textStyle(type.storefrontBadge), { color: palette.onWash }]}>{ORG_BADGE_LABEL.full}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Category · staff count. The count is public; the names are not. ── */}
        <View style={s.metaRow}>
          <Text style={[textStyle(type.storefrontCategory), { color: palette.link }]}>{businessCategoryLabel(org.businessCategory)}</Text>
          <Text style={[textStyle(type.storefrontMeta), { color: palette.muted }]}>·</Text>
          <Text style={[textStyle(type.storefrontMeta), { color: palette.muted }]}>{staffCount} staff</Text>
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

        {/* ── Follower count, directly over the Follow button it goes with. ── */}
        <Text style={[textStyle(type.storefrontMeta), s.followers, { color: palette.muted }]} accessibilityLabel={formatFollowers(counts.followers)}>
          <Text style={{ color: palette.ink }}>{compactCount(counts.followers)}</Text>
          {counts.followers === 1 ? " follower" : " followers"}
        </Text>

        {/* ── Actions: members manage and share; everyone else follows and messages. ── */}
        <View style={s.actions}>
          {isOwner ? (
            <>
              <ActionButton palette={palette} label="Edit shop" onPress={onEdit} primary />
              <Tappable onPress={onShare} style={[s.iconButton, { backgroundColor: palette.control }]} pressedStyle={s.pressed} accessibilityRole="button" accessibilityLabel="Share shop">
                <ShareIcon size={icon.storefrontShare.size} stroke={icon.storefrontShare.stroke} color={palette.ink} />
              </Tappable>
            </>
          ) : role === "STAFF" ? (
            <ActionButton palette={palette} label="Share shop" onPress={onShare} withShareIcon />
          ) : (
            <>
              <ActionButton palette={palette} label={follow.busy ? "Updating..." : follow.label} onPress={follow.onPress} disabled={follow.disabled} primary={follow.primary} />
              <ActionButton palette={palette} label="Message" onPress={onMessage} />
            </>
          )}
        </View>

        {/* ── Business numbers. All three are real counts from the server. ── */}
        <View style={[s.statsCard, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
          <Stat palette={palette} label="Staff" value={staffCount} />
          <Stat palette={palette} label="Active listings" value={counts.listed} ruled />
          <Stat palette={palette} label="Trades completed" value={completedTrades} ruled />
        </View>

        {isOwner ? (
          <SetupCard
            palette={palette}
            org={org}
            hasListings={counts.listed > 0 || completedTrades > 0}
            staffCount={staffCount}
            onEdit={onEdit}
            onPost={onPost}
            onInvite={() => setInviteOpen(true)}
          />
        ) : null}

        {role ? (
          <StaffSection palette={palette} organizationId={org.id} isOwner={isOwner} viewerId={viewerId} inviteOpen={inviteOpen} setInviteOpen={setInviteOpen} scrollerRef={scrollerRef} keyboardUp={keyboardUp} />
        ) : null}
      </View>
    </View>
  );
}

/**
 * "Finish setting up" — the OWNER's checklist. Every step is read from a real
 * field, and the card is gone once all four are done:
 *
 *   Get verified            org.verified (the admin's decision; no CTA, the
 *                           owner cannot do anything but wait)
 *   Add a shop description  org.description
 *   Post your first listing an active listing OR a completed trade, so a shop
 *                           whose only listing traded is not asked again
 *   Invite a staff member   any membership beyond the owner's own, pending
 *                           invitations included (the owner's roster sends
 *                           them); the public staff count until it loads
 */
function SetupCard({ palette, org, hasListings, staffCount, onEdit, onPost, onInvite }: {
  palette: Palette;
  org: Org;
  hasListings: boolean;
  staffCount: number;
  onEdit: () => void;
  onPost?: () => void;
  onInvite: () => void;
}) {
  // Both are shared react-query caches the Profile tab and StaffSection already
  // read, so these are not extra requests.
  const members = useOrgMembers(org.id).data?.data.members;
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
    { key: "staff", label: "Invite a staff member", done: members ? members.length > 1 : staffCount > 1, cta: { label: "Invite", onPress: onInvite } },
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
 * The roster, for members. The OWNER also gets the three verbs the server
 * offers them: invite by email, change a role, remove. Nobody can act on their
 * own row from here — leaving is in Settings, next to the context switcher,
 * and the server refuses removing or demoting the last owner in any case.
 */
function StaffSection({ palette, organizationId, isOwner, viewerId, inviteOpen, setInviteOpen, scrollerRef, keyboardUp }: {
  palette: Palette;
  organizationId: string;
  isOwner: boolean;
  viewerId: string | null;
  inviteOpen: boolean;
  setInviteOpen: (open: boolean) => void;
  scrollerRef?: Scroller;
  keyboardUp: boolean;
}) {
  const inviteRow = useRef<View>(null);
  const [emailFocused, setEmailFocused] = useState(false);

  // Bring the invite row above the keyboard once it is up. The same mechanism
  // as the quantity row in StepWhatIsIt.tsx's ItemTypeBlock -- see the full
  // reasoning there. Focus lands BEFORE the keyboard's height reaches the
  // host's margin, so this waits for `keyboardUp` and a frame for layout, then
  // measures the row against the list's content and scrolls it under the top.
  //
  // getInnerViewREF, not getInnerViewNode: on the new architecture
  // measureLayout accepts only a host element, and given the Node variant's
  // numeric handle it logs and returns without measuring.
  useEffect(() => {
    if (!keyboardUp || !emailFocused) return;
    const frame = requestAnimationFrame(() => {
      const list = scrollerRef?.current;
      // Cast: FlatList's native scroll ref IS the ScrollView (VirtualizedList
      // .getScrollRef), and RN 0.86 implements getInnerViewRef on it while its
      // .d.ts still declares only getInnerViewNode.
      const content = (list?.getNativeScrollRef() as ScrollViewWithInnerRef | null | undefined)?.getInnerViewRef();
      if (!list || !content || !inviteRow.current) return;
      inviteRow.current.measureLayout(content, (_x, y) => {
        list.scrollToOffset({ offset: Math.max(0, y - REVEAL_GAP), animated: true });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [keyboardUp, emailFocused, scrollerRef]);

  const { data, isPending, isError } = useOrgMembers(organizationId);
  const invite = useInviteMember(organizationId);
  const changeRole = useChangeMemberRole(organizationId);
  const remove = useRemoveMember(organizationId);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  const payload = data?.data;
  // Staff see who they work with; pending invitations are the owner's business.
  const members = (payload?.members ?? []).filter((m) => isOwner || m.status === "ACTIVE");
  const value = email.trim().toLowerCase();
  // A shape check only, to light the button; the server is the real validator.
  const canSend = /\S+@\S+\.\S+/.test(value) && !invite.isPending;

  function fail(title: string, err: unknown) {
    showDialog(title, err instanceof ApiError ? err.message : "Check your connection and try again.");
  }

  async function sendInvite() {
    if (!canSend) return;
    try {
      await invite.mutateAsync({ email: value });
      setEmail("");
      setInviteOpen(false);
      setSentTo(value);
    } catch (err) {
      fail("Could not invite", err);
    }
  }

  function manage(member: OrgMember) {
    const nextRole = member.role === "OWNER" ? "STAFF" : "OWNER";
    showDialog(member.user.name, undefined, [
      ...(member.status === "ACTIVE"
        ? [{
            text: nextRole === "OWNER" ? "Make owner" : "Make staff",
            onPress: () => { changeRole.mutateAsync({ membershipId: member.membershipId, role: nextRole }).catch((err) => fail("Could not change role", err)); },
          }]
        : []),
      {
        text: member.status === "PENDING" ? "Withdraw invitation" : "Remove from staff",
        style: "destructive" as const,
        onPress: () => { remove.mutateAsync(member.membershipId).catch((err) => fail("Could not remove", err)); },
      },
      { text: "Cancel", style: "cancel" as const },
    ]);
  }

  return (
    <View style={s.staff}>
      <View style={s.staffHeading}>
        <Text style={[textStyle(type.storefrontSection), { color: palette.ink }]}>Staff</Text>
        {isOwner ? (
          <Tappable
            onPress={() => { setInviteOpen(!inviteOpen); setSentTo(null); }}
            hitSlop={5}
            style={[s.invitePill, { borderColor: palette.dashed }]}
            pressedStyle={s.pressed}
            accessibilityRole="button"
            accessibilityLabel={inviteOpen ? "Cancel invitation" : "Invite a staff member"}
          >
            {inviteOpen ? null : <PlusIcon size={icon.storefrontPlus.size} stroke={icon.storefrontPlus.stroke} color={palette.ink} />}
            <Text style={[textStyle(type.storefrontLink), { color: palette.ink }]}>{inviteOpen ? "Cancel" : "Invite"}</Text>
          </Tappable>
        ) : null}
      </View>

      {isOwner && inviteOpen ? (
        <View ref={inviteRow} style={s.inviteRow}>
          <TextInput
            value={email}
            onChangeText={(text) => { setEmail(text); setSentTo(null); }}
            placeholder="Invite by email"
            placeholderTextColor={palette.muted}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            keyboardType="email-address"
            style={[textStyle(type.searchInput), s.inviteInput, { color: palette.ink, backgroundColor: palette.surface, borderColor: palette.border }]}
            onSubmitEditing={() => void sendInvite()}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            editable={!invite.isPending}
          />
          <Pressable onPress={() => void sendInvite()} disabled={!canSend} style={[s.inviteButton, { backgroundColor: canSend ? color.green : palette.inviteOff }]} accessibilityRole="button" accessibilityState={{ disabled: !canSend }}>
            <Text style={[textStyle(type.secondaryButton), { color: canSend ? color.onGreen : palette.muted }]}>{invite.isPending ? "Sending..." : "Invite"}</Text>
          </Pressable>
        </View>
      ) : null}
      {sentTo ? <Text style={[textStyle(type.storefrontLink), s.sent, { color: palette.link }]}>Invite sent to {sentTo}</Text> : null}

      {isPending ? (
        <ActivityIndicator color={palette.green} style={s.staffSpinner} />
      ) : isError ? (
        <Text style={[textStyle(type.storefrontStaffRole), s.staffError, { color: palette.muted }]}>Could not load the staff list.</Text>
      ) : (
        members.map((m) => (
          <View key={m.membershipId} style={s.staffRow}>
            {m.user.avatar ? (
              <Image source={{ uri: m.user.avatar }} contentFit="cover" style={s.staffAvatar} />
            ) : (
              <View style={[s.staffAvatar, s.staffAvatarFallback, { backgroundColor: palette.wash }]}>
                <Text style={[textStyle(type.storefrontSection), { color: palette.onWash }]}>{m.user.name.trim().charAt(0).toUpperCase() || "?"}</Text>
              </View>
            )}
            <View style={s.flex}>
              <Text style={[textStyle(type.storefrontStaffName), { color: palette.ink }]} numberOfLines={1}>{m.user.name}</Text>
              <Text style={[textStyle(type.storefrontStaffRole), { color: palette.muted }]}>
                {m.role === "OWNER" ? "Owner" : "Staff"}{m.status === "PENDING" ? " · invited" : ""}
              </Text>
            </View>
            {isOwner && m.user.id !== viewerId ? (
              <Pressable onPress={() => manage(m)} style={s.manage} accessibilityRole="button" accessibilityLabel={`Manage ${m.user.name}`}>
                <Text style={[textStyle(type.storefrontLink), { color: palette.link }]}>Manage</Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

/**
 * The storefront's empty list, under its tabs. A title and a line of guidance,
 * as the design draws it, in place of the person profile's one muted sentence.
 */
export function StorefrontEmpty({ dark, title, body }: { dark: boolean; title: string; body: string }) {
  const palette = dark ? darkPalette : lightPalette;
  return (
    <View style={s.empty}>
      <Text style={[textStyle(type.storefrontEmptyTitle), s.emptyText, { color: palette.ink }]}>{title}</Text>
      <Text style={[textStyle(type.emptyBody), s.emptyText, s.emptyBody, { color: palette.muted }]}>{body}</Text>
    </View>
  );
}

function Stat({ palette, label, value, ruled = false }: { palette: Palette; label: string; value: number; ruled?: boolean }) {
  return (
    <View style={[s.stat, ruled && { borderLeftWidth: border.hairline, borderLeftColor: palette.divider }]} accessibilityRole="text" accessibilityLabel={`${value} ${label}`}>
      <Text style={[textStyle(type.storefrontStat), { color: palette.ink }]}>{value}</Text>
      <Text style={[textStyle(type.storefrontStatLabel), { color: palette.muted }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function ActionButton({ palette, label, onPress, disabled = false, primary = false, withShareIcon = false }: {
  palette: Palette;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  withShareIcon?: boolean;
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
      <Text style={[textStyle(type.primaryButton), { color: ink }]}>{label}</Text>
    </Tappable>
  );
}

const LOGO_INNER = size.storefront.logo;
const LOGO_OUTER = LOGO_INNER + size.storefront.logoRing * 2;

const s = StyleSheet.create({
  root: { paddingBottom: space.storefront.bottom },
  banner: { width: "100%", height: size.storefront.banner },
  overlayPill: {
    position: "absolute",
    top: space.storefront.overlayInset,
    right: space.storefront.overlayInset,
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
  name: { flexShrink: 1 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: size.storefront.badge,
    paddingHorizontal: size.storefront.badgeX,
    borderRadius: radius.storefrontBadge,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.storefront.metaGap, marginTop: space.storefront.nameToMeta },
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
  staff: { marginTop: space.storefront.staffTop },
  staffHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: size.storefront.pill },
  invitePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: size.storefront.pill,
    paddingHorizontal: size.storefront.pillX,
    borderWidth: border.dashed,
    borderRadius: radius.storefrontPill,
  },
  inviteRow: { flexDirection: "row", gap: space.storefront.inviteGap, marginTop: space.storefront.inviteTop },
  inviteInput: {
    flex: 1,
    minWidth: 0,
    height: size.storefront.input,
    borderWidth: border.hairline,
    borderRadius: radius.storefrontInput,
    paddingHorizontal: 12,
  },
  inviteButton: {
    height: size.storefront.input,
    paddingHorizontal: 16,
    borderRadius: radius.storefrontInput,
    alignItems: "center",
    justifyContent: "center",
  },
  sent: { marginTop: 8 },
  staffSpinner: { marginVertical: 12 },
  staffError: { marginTop: space.storefront.staffRowTop },
  staffRow: { flexDirection: "row", alignItems: "center", gap: space.storefront.staffGap, marginTop: space.storefront.staffRowTop },
  staffAvatar: { width: size.storefront.staffAvatar, height: size.storefront.staffAvatar, borderRadius: size.storefront.staffAvatar / 2 },
  staffAvatarFallback: { alignItems: "center", justifyContent: "center" },
  manage: { minHeight: 44, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
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
  inviteOff: color.greenLine,
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
  inviteOff: darkTokens.greenWash,
};
