import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Image, Text, View } from "react-native";

import {
  orgLogoUrl,
  switchToOrganization,
  useOrganizations,
  type ActingOrg,
} from "../api/organizations";
import { getActingOrgId, hasChosenActingOrg } from "../api/org-context";
import { LeavesPill } from "./AppHeader";
import { Tappable } from "./Tappable";
import { ORG_BADGE_LABEL } from "../lib/org";
import { CheckIcon, PersonIcon, StoreIcon, VerifiedOrgIcon } from "./icons";
import { color, icon, radius, textStyle, type } from "../theme/tokens";

/**
 * Who this device is posting and trading as: you, or one of your organisations.
 *
 * ── WITHOUT THIS SCREEN THE FEATURE IS HALF-BUILT ───────────────────────────
 *
 * Creating an organisation switches to it automatically, but the owner still
 * needs a way back to themselves, and back to the shop again: the context
 * header is only ever set from here or from the create flow.
 *
 * OWNER ONLY (2 Oct 2026). Staff and staff invitations were removed, so every
 * shop listed here is one this person owns, and there is no Invitations list.
 *
 * ── THE ACTIVE CONTEXT IS READ, NOT STORED IN STATE ─────────────────────────
 *
 * `getActingOrgId()` is a module variable that the request layer reads
 * synchronously on every call, so it is the single source of truth about which
 * identity is live. Mirroring it into component state would create a second
 * one, and the two would disagree the moment anything else cleared it -- which
 * the 403 handler does on a revoked
 * membership. The local `tick` exists only to force a re-render after a switch;
 * it is not the value.
 *
 * ── SWITCHING INVALIDATES EVERYTHING ────────────────────────────────────────
 *
 * Every cached list was fetched as somebody. After a switch, the shelf, the
 * offers and the trades all belong to a different account, and serving the
 * previous identity's cache under the new one is how an owner sees the
 * shop's listings labelled as their own. `invalidateQueries()` with no key
 * drops the lot, which is heavy-handed and correct: this is a rare action, and
 * anything cheaper means auditing every query key for identity-dependence
 * forever.
 *
 * ── THE COPY SAYS LISTINGS AND MESSAGES, AND NOT OFFERS OR TRADES ───────────
 *
 * The writes that read X-Baylo-Org are POST /api/items and, since 25 Sep 2026,
 * messaging: acting as a shop, Messages is the shop's inbox and a reply goes
 * out as the shop. Offers and trades are still made as the signed-in person
 * whatever is selected here. This card once said "New listings, offers and
 * messages are attributed to whoever is selected", which promised the shop a
 * reach it did not have. If org trading lands, widen the copy with it -- not
 * before.
 */
export function OrgSwitcher() {
  const qc = useQueryClient();
  const { data, isPending } = useOrganizations();
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);

  const payload = data?.data;
  const organizations = payload?.organizations ?? [];

  // Read fresh on every render. See the note above — this is not state.
  const activeId = getActingOrgId();

  async function switchTo(organizationId: string | null) {
    // Re-tapping the active row still counts once: "Myself" on a fresh session
    // is already null, but tapping it is the choice the Profile tab honours.
    if (busy || (organizationId === activeId && hasChosenActingOrg())) return;
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
  if (isPending || organizations.length === 0) return null;

  return (
    <View style={{ marginTop: 16 }} key={tick}>
      <Text style={[textStyle(type.itemTitle), { color: color.ink, marginBottom: 4 }]}>
        Posting as
      </Text>
      <Text style={[textStyle(type.detailBody), { color: color.inkMuted, marginBottom: 10 }]}>
        Choose who your new listings and messages are posted as. Offers and trades
        are always sent as you, whichever is selected.
      </Text>

      <IdentityRow
        label="Myself"
        sub="Your own account"
        effect="New listings go on your personal profile."
        selected={activeId === null}
        disabled={busy}
        onPress={() => void switchTo(null)}
        leading={
          <View style={rowStyles.logoFallback}>
            <PersonIcon size={18} stroke={1.6} color={color.inkMuted} />
          </View>
        }
      />

      {organizations.map((org: ActingOrg) => (
        <IdentityRow
          key={org.id}
          label={org.name}
          sub="Owner"
          effect={postingEffect(org)}
          verified={org.verified}
          balance={org.leaves}
          selected={activeId === org.id}
          disabled={busy}
          onPress={() => void switchTo(org.id)}
          leading={
            orgLogoUrl(org.logoUrl) ? (
              <Image source={{ uri: orgLogoUrl(org.logoUrl)! }} style={rowStyles.logo} resizeMode="cover" />
            ) : (
              <View style={rowStyles.logoFallback}>
                <StoreIcon size={18} stroke={1.6} color={color.forest} />
              </View>
            )
          }
        />
      ))}

    </View>
  );
}

/**
 * What choosing this shop changes, in one line. A shop that cannot post yet
 * says so here, before somebody switches to it and finds out in the wizard.
 */
function postingEffect(org: ActingOrg): string {
  if (org.verificationStatus === "PENDING") {
    return `Listings will be posted as ${org.name} once it is verified.`;
  }
  if (org.verificationStatus === "REJECTED") {
    return `${org.name} can't post until its business documents are fixed.`;
  }
  return `New listings go on ${org.name}'s storefront.`;
}

function IdentityRow({
  label,
  sub,
  effect,
  selected,
  disabled,
  onPress,
  leading,
  verified,
  balance,
}: {
  label: string;
  sub: string;
  /** What selecting this row changes. See the note on the card's copy. */
  effect: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  leading: React.ReactNode;
  verified?: boolean;
  /**
   * A shop's own Leaf balance, drawn with the header's pill so it reads as the
   * same kind of number. Shops only: the person's balance is already in the
   * header, and a second copy on "Myself" would be one more place to go stale.
   */
  balance?: number;
}) {
  return (
    <Tappable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${label}. ${sub}${verified ? `. ${ORG_BADGE_LABEL.full}` : ""}${
        balance !== undefined ? `. Shop balance ${balance} Leaves` : ""
      }. ${effect}`}
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
        <Text style={[textStyle(type.detailBody), { color: selected ? color.forest : color.inkSecondary, marginTop: 2 }]}>
          {effect}
        </Text>
      </View>
      {balance !== undefined ? <LeavesPill value={balance} stale={false} tight /> : null}
      {selected ? (
        <CheckIcon size={icon.check.size} stroke={icon.check.stroke} color={color.forest} />
      ) : null}
    </Tappable>
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
};
