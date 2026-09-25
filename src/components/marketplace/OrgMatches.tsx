import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { orgLogoUrl } from "../../api/organizations";
import { followButtonStatus, useFollow, useUnfollow } from "../../api/profile";
import type { BrowseOrgMatch } from "../../api/types";
import { formatFollowers } from "../../lib/format";
import { ORG_BADGE_LABEL } from "../../lib/org";
import { ChevronRightIcon, StoreIcon, VerifiedOrgIcon } from "../icons";
import { Tappable } from "../Tappable";
import { border, color, icon, radius, space, textStyle, type } from "../../theme/tokens";

/**
 * Shops whose NAME matched the search, above the item results.
 *
 * ── A TOP CARD, NOT A "SHOPS" TAB ───────────────────────────────────────────
 *
 * A tab would hide the answer behind a tap for the one search where it matters
 * most: somebody typing a shop's name wants that shop, and a tab strip over
 * the grid makes them notice the tab, tap it, and then tap the shop. It would
 * also give every OTHER search a permanently empty second tab. A card appears
 * only when there is a match and costs the item grid one row when it does --
 * the same bargain TikTok's top-account result makes.
 *
 * At most three (the server caps it). Tapping one opens the storefront, which
 * is the /user screen reading the shop's backing account. The Follow button
 * beside it follows the shop from here -- the same Follow row, and the same
 * mutation, as the storefront's own button, so the two never disagree.
 */
export function OrgMatches({
  orgs,
  onOpen,
}: {
  orgs: BrowseOrgMatch[];
  onOpen: (org: BrowseOrgMatch) => void;
}) {
  const follow = useFollow();
  const unfollow = useUnfollow();
  if (orgs.length === 0) return null;
  return (
    <View style={s.wrap}>
      <Text style={[textStyle(type.resultCount), s.heading]}>
        {orgs.length === 1 ? "Shop" : "Shops"}
      </Text>
      {orgs.map((org) => {
        const logo = orgLogoUrl(org.logoUrl);
        // No button on a member's own shop, or from a server too old to say.
        const status = org.isMember || org.follow === undefined ? null : org.follow;
        // Per card: following one shop must not grey out the others.
        const busy =
          (follow.isPending && follow.variables?.userId === org.orgUserId) ||
          (unfollow.isPending && unfollow.variables?.userId === org.orgUserId);
        const toggleFollow = () => {
          if (busy || status === "PENDING") return;
          if (status === "ACCEPTED") unfollow.mutate({ userId: org.orgUserId });
          else follow.mutate({ userId: org.orgUserId });
        };
        return (
          /*
            TWO SIBLING TAP TARGETS, not a button nested in the card's
            Tappable. The body opens the storefront as before; Follow is its
            own button beside it. Nested, the card's accessibility node would
            swallow the inner button for a screen reader, and a press on Follow
            would light the whole card's pressed state.
          */
          <View key={org.id} style={s.card}>
            <Tappable
              onPress={() => onOpen(org)}
              accessibilityRole="button"
              accessibilityLabel={`${org.name}${org.verified ? `, ${ORG_BADGE_LABEL.full}` : ""}, ${org.businessCategoryLabel}${org.followers !== undefined ? `, ${formatFollowers(org.followers)}` : ""}. Open shop`}
              style={s.body}
              pressedStyle={s.bodyPressed}
            >
              {logo ? (
                <Image source={{ uri: logo }} contentFit="cover" style={s.logo} />
              ) : (
                <View style={[s.logo, s.logoFallback]}>
                  <StoreIcon size={22} stroke={1.6} color={color.forest} />
                </View>
              )}
              <View style={s.text}>
                <View style={s.nameRow}>
                  <Text style={[textStyle(type.itemTitle), { color: color.ink, flexShrink: 1 }]} numberOfLines={1}>
                    {org.name}
                  </Text>
                  {org.verified ? (
                    <VerifiedOrgIcon
                      size={icon.orgBadge.size}
                      stroke={icon.orgBadge.stroke}
                      color={color.forest}
                    />
                  ) : null}
                </View>
                <Text style={[textStyle(type.detailBody), { color: color.inkMuted }]} numberOfLines={1}>
                  {org.verified ? `${ORG_BADGE_LABEL.compact} · ` : ""}
                  {org.businessCategoryLabel}
                </Text>
                {org.followers !== undefined ? (
                  <Text style={[textStyle(type.detailBody), { color: color.inkMuted }]} numberOfLines={1}>
                    {formatFollowers(org.followers)}
                  </Text>
                ) : null}
              </View>
              {status === null ? <ChevronRightIcon size={18} stroke={1.6} color={color.inkMuted} /> : null}
            </Tappable>
            {status !== null ? (
              <Tappable
                onPress={toggleFollow}
                disabled={busy || status === "PENDING"}
                hitSlop={6}
                style={[s.follow, status === "NONE" ? s.followPrimary : s.followQuiet, (busy || status === "PENDING") && s.disabled]}
                pressedStyle={s.followPressed}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy || status === "PENDING" }}
                accessibilityLabel={`${followButtonStatus(status)}, ${org.name}`}
              >
                <Text style={[textStyle(type.secondaryButton), { color: status === "NONE" ? color.onGreen : color.ink }]}>
                  {followButtonStatus(status)}
                </Text>
              </Tappable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.browse.gridX,
    paddingBottom: space.browse.countY,
    gap: 8,
  },
  heading: { color: color.inkMuted },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.card,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    backgroundColor: color.surface,
    overflow: "hidden",
  },
  body: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  bodyPressed: { backgroundColor: color.control },
  logo: { width: 48, height: 48, borderRadius: 10 },
  logoFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.greenWash,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  follow: {
    minWidth: 92,
    height: 36,
    marginRight: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  followPrimary: { backgroundColor: color.green },
  followQuiet: { backgroundColor: color.control },
  followPressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
});