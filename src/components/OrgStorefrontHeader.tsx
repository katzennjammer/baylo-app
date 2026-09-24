import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ApiError } from "../api/client";
import {
  orgLogoUrl,
  useChangeMemberRole,
  useInviteMember,
  useOrgMembers,
  useRemoveMember,
  type OrgMember,
} from "../api/organizations";
import type { PublicProfilePayload } from "../api/types";
import { businessCategoryLabel } from "../lib/business-category";
import { ORG_BADGE_LABEL } from "../lib/org";
import { color, font, icon } from "../theme/tokens";
import { showDialog } from "./dialog";
import { StoreIcon, VerifiedOrgIcon } from "./icons";

/**
 * The MSME storefront header — the top of an organisation's profile.
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
 * Below this header the screen is UNCHANGED from a person's: the same tabs and
 * the same three-across listings grid. That half is shared on purpose.
 *
 * ── STANDALONE, NOT IMPORTED FROM app/(app)/profile ─────────────────────────
 *
 * It replaces the square-logo variant of the person header that user.tsx used
 * to draw (OrgLogo / VerifiedOrgBadge, removed from profile.tsx with it), and
 * imports nothing from a route file, so profile.tsx can render it later
 * without an import cycle.
 *
 * ── THE STAFF ROSTER IS FOR MEMBERS ONLY ────────────────────────────────────
 *
 * A non-member sees the Staff COUNT and nothing else. Staff are private people
 * who agreed to post for a shop, not to be listed by name to every stranger
 * who opens it; a public roster is a directory of a small business's employees
 * for anyone with a grudge against one. The server already enforces this —
 * GET .../members 404s a non-member — and `viewerRole` is what stops the
 * client asking.
 */

type Org = NonNullable<PublicProfilePayload["user"]["org"]>;

const BANNER_HEIGHT = 136;
const LOGO_SIZE = 84;

export function OrgStorefrontHeader({
  dark,
  org,
  counts,
  viewerId,
  follow,
  onMessage,
  onEdit,
  onShare,
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
}) {
  const palette = dark ? darkColors : lightColors;
  const role = org.viewerRole ?? null;
  const logo = orgLogoUrl(org.logoUrl);
  const banner = org.bannerUrl ? orgLogoUrl(org.bannerUrl) : null;

  return (
    <View>
      {/* ── Banner, with the logo anchored on its bottom edge ── */}
      <View style={s.bannerWrap}>
        {banner ? (
          <Image source={{ uri: banner }} contentFit="cover" style={s.banner} accessibilityLabel={`${org.name} cover image`} />
        ) : (
          // No banner yet: a token gradient, so a new shop's page still reads
          // as designed rather than as an image that failed to load.
          <LinearGradient colors={[color.forest, color.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.banner} />
        )}
        <View style={[s.logoFrame, { borderColor: palette.surface, backgroundColor: palette.surface }]}>
          {logo ? (
            <Image source={{ uri: logo }} contentFit="cover" style={s.logo} accessibilityLabel={`${org.name} logo`} />
          ) : (
            <View style={[s.logo, s.logoFallback]} accessibilityLabel={`${org.name}, no logo`}>
              <StoreIcon size={icon.orgLogo.size} stroke={icon.orgLogo.stroke} color={color.forest} />
            </View>
          )}
        </View>
      </View>

      <View style={s.body}>
        {/* ── Name, checkmark, category, tagline ── */}
        <View style={s.nameRow}>
          <Text style={[s.name, { color: palette.ink }]} numberOfLines={2}>{org.name}</Text>
          {org.verified ? (
            <View style={[s.badge, { backgroundColor: dark ? "#244A31" : color.greenWash }]} accessibilityRole="text" accessibilityLabel={ORG_BADGE_LABEL.full}>
              <VerifiedOrgIcon size={icon.orgBadge.size} stroke={icon.orgBadge.stroke} color={dark ? "#BFE8C7" : color.forest} />
              <Text style={[s.badgeText, { color: dark ? "#BFE8C7" : color.forest }]}>{ORG_BADGE_LABEL.full}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[s.category, { color: palette.green }]}>{businessCategoryLabel(org.businessCategory)}</Text>
        {org.description ? (
          <Text style={[s.description, { color: palette.secondary }]} numberOfLines={4}>{org.description}</Text>
        ) : role === "OWNER" ? (
          <Text style={[s.description, { color: palette.muted }]}>Add a short description of your shop from Edit shop.</Text>
        ) : null}

        {/* ── Business numbers. All three are real counts from the server. ── */}
        <View style={[s.stats, { borderColor: palette.divider }]}>
          <Stat dark={dark} label="Staff" value={counts.staff ?? org.staffCount} />
          <View style={[s.statRule, { backgroundColor: palette.divider }]} />
          <Stat dark={dark} label="Active listings" value={counts.listed} />
          <View style={[s.statRule, { backgroundColor: palette.divider }]} />
          <Stat dark={dark} label="Trades completed" value={org.completedTrades ?? counts.completedTrades} />
        </View>

        {/* ── Actions: members manage and share; everyone else follows and messages. ── */}
        <View style={s.actions}>
          {role === "OWNER" ? (
            <ActionButton dark={dark} label="Edit shop" onPress={onEdit} />
          ) : role === null ? (
            <ActionButton dark={dark} label={follow.busy ? "Updating..." : follow.label} onPress={follow.onPress} disabled={follow.disabled} primary={follow.primary} />
          ) : null}
          {role === null ? (
            <ActionButton dark={dark} label="Message" onPress={onMessage} />
          ) : (
            <ActionButton dark={dark} label="Share shop" onPress={onShare} />
          )}
        </View>

        {role ? <StaffSection dark={dark} organizationId={org.id} isOwner={role === "OWNER"} viewerId={viewerId} /> : null}
      </View>
    </View>
  );
}

/**
 * The roster, for members. The OWNER also gets the three verbs the server
 * offers them: invite by email, change a role, remove. Nobody can act on their
 * own row from here — leaving is in Settings, next to the context switcher,
 * and the server refuses removing or demoting the last owner in any case.
 */
function StaffSection({ dark, organizationId, isOwner, viewerId }: { dark: boolean; organizationId: string; isOwner: boolean; viewerId: string | null }) {
  const palette = dark ? darkColors : lightColors;
  const { data, isPending, isError } = useOrgMembers(organizationId);
  const invite = useInviteMember(organizationId);
  const changeRole = useChangeMemberRole(organizationId);
  const remove = useRemoveMember(organizationId);
  const [email, setEmail] = useState("");

  const payload = data?.data;
  // Staff see who they work with; pending invitations are the owner's business.
  const members = (payload?.members ?? []).filter((m) => isOwner || m.status === "ACTIVE");

  function fail(title: string, err: unknown) {
    showDialog(title, err instanceof ApiError ? err.message : "Check your connection and try again.");
  }

  async function sendInvite() {
    const value = email.trim().toLowerCase();
    if (!value || invite.isPending) return;
    try {
      await invite.mutateAsync({ email: value });
      setEmail("");
      showDialog("Invitation sent", "They'll join your staff once they accept it.");
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
    <View style={[s.staff, { borderColor: palette.divider }]}>
      <Text style={[s.sectionTitle, { color: palette.ink }]}>Staff</Text>
      {isPending ? (
        <ActivityIndicator color={palette.green} style={{ marginVertical: 12 }} />
      ) : isError ? (
        <Text style={[s.staffMeta, { color: palette.muted }]}>Could not load the staff list.</Text>
      ) : (
        members.map((m) => (
          <View key={m.membershipId} style={s.staffRow}>
            {m.user.avatar ? (
              <Image source={{ uri: m.user.avatar }} contentFit="cover" style={s.staffAvatar} />
            ) : (
              <View style={[s.staffAvatar, s.staffAvatarFallback, { backgroundColor: palette.control }]}>
                <Text style={[s.staffInitial, { color: palette.green }]}>{m.user.name.trim().charAt(0).toUpperCase() || "?"}</Text>
              </View>
            )}
            <View style={s.staffText}>
              <Text style={[s.staffName, { color: palette.ink }]} numberOfLines={1}>{m.user.name}</Text>
              <Text style={[s.staffMeta, { color: palette.muted }]}>
                {m.role === "OWNER" ? "Owner" : "Staff"}{m.status === "PENDING" ? " · invited" : ""}
              </Text>
            </View>
            {isOwner && m.user.id !== viewerId ? (
              <Pressable onPress={() => manage(m)} style={[s.manage, { backgroundColor: palette.control }]} accessibilityRole="button" accessibilityLabel={`Manage ${m.user.name}`}>
                <Text style={[s.manageText, { color: palette.ink }]}>Manage</Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}
      {isOwner ? (
        <View style={s.inviteRow}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Invite by email"
            placeholderTextColor={palette.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={[s.inviteInput, { color: palette.ink, backgroundColor: palette.control, borderColor: palette.border }]}
            onSubmitEditing={() => void sendInvite()}
            editable={!invite.isPending}
          />
          <Pressable onPress={() => void sendInvite()} disabled={!email.trim() || invite.isPending} style={[s.inviteButton, (!email.trim() || invite.isPending) && s.disabled]} accessibilityRole="button">
            <Text style={s.inviteText}>{invite.isPending ? "Sending..." : "Invite"}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Stat({ dark, label, value }: { dark: boolean; label: string; value: number }) {
  const palette = dark ? darkColors : lightColors;
  return (
    <View style={s.stat} accessibilityRole="text" accessibilityLabel={`${value} ${label}`}>
      <Text style={[s.statValue, { color: palette.ink }]}>{value}</Text>
      <Text style={[s.statLabel, { color: palette.muted }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function ActionButton({ dark, label, onPress, disabled = false, primary = false }: { dark: boolean; label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  const palette = dark ? darkColors : lightColors;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[s.actionButton, primary ? { backgroundColor: color.green } : { backgroundColor: palette.control }, disabled && s.disabled]} accessibilityRole="button">
      <Text style={[s.actionText, { color: primary ? color.onGreen : palette.ink }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  bannerWrap: { height: BANNER_HEIGHT + LOGO_SIZE / 2 },
  banner: { width: "100%", height: BANNER_HEIGHT },
  // The logo straddles the banner's bottom edge: half on the image, half on the
  // page. The surface-coloured frame is what separates it from a busy banner.
  logoFrame: { position: "absolute", left: 16, top: BANNER_HEIGHT - LOGO_SIZE / 2, borderWidth: 3, borderRadius: 16 },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: 13 },
  logoFallback: { alignItems: "center", justifyContent: "center", backgroundColor: color.greenWash },
  body: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  nameRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  name: { fontFamily: font.displaySemi, fontSize: 20, flexShrink: 1 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 4, paddingVertical: 3, paddingHorizontal: 7 },
  badgeText: { fontFamily: font.sansSemi, fontSize: 11 },
  category: { fontFamily: font.sansSemi, fontSize: 13, marginTop: 3 },
  description: { fontFamily: font.sans, fontSize: 14, lineHeight: 20, marginTop: 8 },
  stats: { flexDirection: "row", alignItems: "center", marginTop: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  stat: { flex: 1, alignItems: "center" },
  statRule: { width: StyleSheet.hairlineWidth, alignSelf: "stretch" },
  statValue: { fontFamily: font.sansSemi, fontSize: 18 },
  statLabel: { fontFamily: font.sans, fontSize: 12, marginTop: 3 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  actionText: { fontFamily: font.sansSemi, fontSize: 14 },
  disabled: { opacity: 0.55 },
  staff: { marginTop: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontFamily: font.sansSemi, fontSize: 15, marginBottom: 6 },
  staffRow: { flexDirection: "row", alignItems: "center", minHeight: 52, gap: 10 },
  staffAvatar: { width: 36, height: 36, borderRadius: 18 },
  staffAvatarFallback: { alignItems: "center", justifyContent: "center" },
  staffInitial: { fontFamily: font.sansBold, fontSize: 14 },
  staffText: { flex: 1, minWidth: 0 },
  staffName: { fontFamily: font.sansSemi, fontSize: 14 },
  staffMeta: { fontFamily: font.sans, fontSize: 12, marginTop: 2 },
  manage: { minHeight: 36, paddingHorizontal: 12, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  manageText: { fontFamily: font.sansSemi, fontSize: 13 },
  inviteRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  inviteInput: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontFamily: font.sans, fontSize: 14 },
  inviteButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: color.green },
  inviteText: { color: color.onGreen, fontFamily: font.sansSemi, fontSize: 14 },
});

const lightColors = { surface: color.surface, control: color.control, ink: color.ink, secondary: color.inkSecondary, muted: color.inkMuted, divider: color.divider, border: color.controlLine, green: color.green };
const darkColors = { surface: "#171A17", control: "#252A25", ink: "#F4F5F0", secondary: "#B6BDB3", muted: "#929B91", divider: "#343A34", border: "#596159", green: "#72D681" };
