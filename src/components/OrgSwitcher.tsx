import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Image, Text, View } from "react-native";

import {
  switchToOrganization,
  useOrganizations,
  useRespondToInvitation,
  type ActingOrg,
  type OrgInvitation,
} from "../api/organizations";
import { getActingOrgId } from "../api/org-context";
import { Tappable } from "./Tappable";
import { CheckIcon, StoreIcon, VerifiedOrgIcon } from "./icons";
import { color, icon, radius, textStyle, type } from "../theme/tokens";

/**
 * Who this device is posting and trading as: you, or one of your organisations.
 *
 * ── WITHOUT THIS SCREEN THE FEATURE IS HALF-BUILT ───────────────────────────
 *
 * Creating an organisation switches to it automatically, so the founder never
 * needs a switcher. Everybody else does: a staff member who accepts an
 * invitation has an ACTIVE membership the server will honour and no way to
 * exercise it, because the context header is only ever set from here or from
 * the create flow. An invitation that cannot be acted on is an invitation that
 * did nothing.
 *
 * ── THE ACTIVE CONTEXT IS READ, NOT STORED IN STATE ─────────────────────────
 *
 * `getActingOrgId()` is a module variable that the request layer reads
 * synchronously on every call, so it is the single source of truth about which
 * identity is live. Mirroring it into component state would create a second
 * one, and the two would disagree the moment anything else cleared it -- which
 * `useRespondToInvitation` does on leave, and the 403 handler does on a revoked
 * membership. The local `tick` exists only to force a re-render after a switch;
 * it is not the value.
 *
 * ── SWITCHING INVALIDATES EVERYTHING ────────────────────────────────────────
 *
 * Every cached list was fetched as somebody. After a switch, the shelf, the
 * offers and the trades all belong to a different account, and serving the
 * previous identity's cache under the new one is how a staff member sees the
 * shop's listings labelled as their own. `invalidateQueries()` with no key
 * drops the lot, which is heavy-handed and correct: this is a rare action, and
 * anything cheaper means auditing every query key for identity-dependence
 * forever.
 */
export function OrgSwitcher() {
  const qc = useQueryClient();
  const { data, isPending } = useOrganizations();
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);

  const payload = data?.data;
  const organizations = payload?.organizations ?? [];
  const invitations = payload?.invitations ?? [];

  // Read fresh on every render. See the note above — this is not state.
  const activeId = getActingOrgId();

  async function switchTo(organizationId: string | null) {
    if (busy || organizationId === activeId) return;
    setBusy(true);
    try {
      await switchToOrganization(organizationId);
      await qc.invalidateQueries();
      setTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }

  // Nothing to show until there is something to switch between. A card saying
  // "you belong to no organisations" is a card about a feature most people are
  // not using, on the screen they opened to do something else.
  if (isPending || (organizations.length === 0 && invitations.length === 0)) return null;

  return (
    <View style={{ marginTop: 16 }} key={tick}>
      <Text style={[textStyle(type.itemTitle), { color: color.ink, marginBottom: 4 }]}>
        Posting as
      </Text>
      <Text style={[textStyle(type.detailBody), { color: color.inkMuted, marginBottom: 10 }]}>
        New listings, offers and messages are attributed to whoever is selected here.
      </Text>

      <IdentityRow
        label="Myself"
        sub="Your own account"
        selected={activeId === null}
        disabled={busy}
        onPress={() => void switchTo(null)}
        leading={
          <View style={rowStyles.logoFallback}>
            <StoreIcon size={18} stroke={1.6} color={color.inkMuted} />
          </View>
        }
      />

      {organizations.map((org: ActingOrg) => (
        <IdentityRow
          key={org.id}
          label={org.name}
          sub={org.role === "OWNER" ? "Owner" : "Staff"}
          verified={org.verified}
          selected={activeId === org.id}
          disabled={busy}
          onPress={() => void switchTo(org.id)}
          leading={
            org.logoUrl ? (
              <Image source={{ uri: org.logoUrl }} style={rowStyles.logo} resizeMode="cover" />
            ) : (
              <View style={rowStyles.logoFallback}>
                <StoreIcon size={18} stroke={1.6} color={color.forest} />
              </View>
            )
          }
        />
      ))}

      {invitations.length > 0 ? (
        <View style={{ marginTop: 14 }}>
          <Text style={[textStyle(type.itemTitle), { color: color.ink, marginBottom: 4 }]}>
            Invitations
          </Text>
          {invitations.map((invite: OrgInvitation) => (
            <InvitationRow key={invite.membershipId} invite={invite} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function IdentityRow({
  label,
  sub,
  selected,
  disabled,
  onPress,
  leading,
  verified,
}: {
  label: string;
  sub: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  leading: React.ReactNode;
  verified?: boolean;
}) {
  return (
    <Tappable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${label}. ${sub}${verified ? ". Verified organization" : ""}`}
      style={[rowStyles.row, selected && rowStyles.rowOn]}
      pressedStyle={{ opacity: 0.8 }}
    >
      {leading}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Text style={[textStyle(type.itemTitle), { color: color.ink }]} numberOfLines={1}>
            {label}
          </Text>
          {verified ? (
            <VerifiedOrgIcon
              size={icon.orgBadge.size}
              stroke={icon.orgBadge.stroke}
              color={color.forest}
            />
          ) : null}
        </View>
        <Text style={[textStyle(type.detailBody), { color: color.inkMuted }]}>{sub}</Text>
      </View>
      {selected ? (
        <CheckIcon size={icon.check.size} stroke={icon.check.stroke} color={color.forest} />
      ) : null}
    </Tappable>
  );
}

/**
 * An invitation, with the only two answers there are.
 *
 * Accepting does NOT switch to the organisation. Somebody accepting an
 * invitation is agreeing to be staff, which is not the same statement as "post
 * my next listing as the shop" — and silently rebinding their next post to
 * somebody else's account on the strength of a Yes would be the worst possible
 * reading of it. It appears in the list above, and they choose.
 */
function InvitationRow({ invite }: { invite: OrgInvitation }) {
  const respond = useRespondToInvitation(invite.organization.id);
  const busy = respond.isPending;

  return (
    <View style={rowStyles.row}>
      {invite.organization.logoUrl ? (
        <Image source={{ uri: invite.organization.logoUrl }} style={rowStyles.logo} resizeMode="cover" />
      ) : (
        <View style={rowStyles.logoFallback}>
          <StoreIcon size={18} stroke={1.6} color={color.forest} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[textStyle(type.itemTitle), { color: color.ink }]} numberOfLines={1}>
          {invite.organization.name}
        </Text>
        <Text style={[textStyle(type.detailBody), { color: color.inkMuted }]}>
          Invited you to join as staff
        </Text>
      </View>
      <Tappable
        onPress={
          busy
            ? undefined
            : () => respond.mutate({ membershipId: invite.membershipId, action: "accept" })
        }
        accessibilityRole="button"
        accessibilityLabel={`Accept invitation from ${invite.organization.name}`}
        style={rowStyles.accept}
        pressedStyle={{ opacity: 0.8 }}
      >
        <Text style={[textStyle(type.detailBody), { color: color.onGreen }]}>
          {busy ? "…" : "Accept"}
        </Text>
      </Tappable>
    </View>
  );
}

const rowStyles = {
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.controlLine,
    marginBottom: 8,
    minHeight: 56,
  },
  rowOn: { borderColor: color.forest, backgroundColor: color.greenWash },
  logo: { width: 36, height: 36, borderRadius: 8 },
  logoFallback: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: color.control,
  },
  accept: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: color.green,
  },
};
