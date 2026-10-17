import { StyleSheet, Text, View } from "react-native";

import { VerifiedOrgIcon } from "./icons";
import type { OrgBadge } from "../api/types";
import { businessCategoryLabel } from "../lib/business-category";
import { ORG_BADGE_LABEL } from "../lib/org";
import { color, font, icon } from "../theme/tokens";

/**
 * The business-category chip, and the verified-MSME chip it sits beside, for a
 * listing card whose poster is an organisation.
 *
 * ── THE CATEGORY SHOWS FOR EVERY ORG; THE CHECKMARK ONLY FOR A VERIFIED ONE ──
 *
 * The category is a fact the shop declared about itself, and it is true the
 * moment the org exists. The checkmark is a claim that a reviewer looked at a
 * document, and ownerBadge() in lib/org is the one place allowed to make it:
 * only `verified` earns it. So a PENDING shop shows "Sari-sari store" and no
 * rosette -- not a greyed one. Same rule as everywhere else.
 *
 * `showBadge={false}` is for a card that already draws the rosette somewhere
 * of its own (ExclusiveTile's icon column), so the pair never appears twice.
 *
 * The label comes from lib/business-category rather than the server's list:
 * a card cannot afford a second request to turn one enum into one word. See
 * the note there on why that copy exists and how it degrades.
 */
export function OrgChips({
  org,
  showBadge = true,
  tone = "light",
}: {
  org: OrgBadge;
  showBadge?: boolean;
  /** "dark" on a photo scrim, where the light wash would glare. */
  tone?: "light" | "dark";
}) {
  const wash = tone === "dark" ? "rgba(255,255,255,0.16)" : color.greenWash;
  const ink = tone === "dark" ? "#FFFFFF" : color.forest;
  return (
    <View style={s.row}>
      {showBadge && org.verified ? (
        <View
          style={[s.chip, { backgroundColor: wash }]}
          accessibilityRole="text"
          accessibilityLabel={ORG_BADGE_LABEL.full}
        >
          <VerifiedOrgIcon size={icon.orgBadge.size} stroke={icon.orgBadge.stroke} color={ink} />
          <Text style={[s.text, { color: ink }]} numberOfLines={1}>
            {ORG_BADGE_LABEL.compact}
          </Text>
        </View>
      ) : null}
      <View
        style={[s.chip, s.category, { borderColor: tone === "dark" ? "rgba(255,255,255,0.35)" : color.greenLine }]}
        accessibilityRole="text"
        accessibilityLabel={`Business category: ${businessCategoryLabel(org.businessCategory)}`}
      >
        <Text style={[s.text, { color: ink }]} numberOfLines={1}>
          {businessCategoryLabel(org.businessCategory)}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    maxWidth: "100%",
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  // The category is OUTLINED where the checkmark is FILLED: one is a declared
  // fact, the other a reviewed claim, and they should not read as equals.
  category: { borderWidth: StyleSheet.hairlineWidth, backgroundColor: "transparent" },
  text: { fontFamily: font.sansSemi, fontSize: 10 },
});
