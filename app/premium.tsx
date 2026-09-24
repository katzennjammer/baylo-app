import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useProfileMe } from "../src/api/profile";
import { Splash } from "../src/components/Splash";
import { color, radius, textStyle, type } from "../src/theme/tokens";
import { PREMIUM_MIN_BRACKET } from "../src/lib/brackets";
import { BRIDGE_FEE_PER_BRACKET, PREMIUM_BRIDGE_FEE_PER_BRACKET } from "../src/lib/trade-rules";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `18 Oct 2026`. Plain enough to read as a date and not a timestamp. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * The four perks on the PM's final list (24 Sep 2026). The daily free-Leaves
 * allowance that used to be here is GONE, deliberately -- not hidden, dropped
 * -- so this list must never grow back a line for it without a matching
 * product decision, the same way it must never quote a number this file
 * cannot point at in @/lib somewhere.
 */
const premiumPerks = [
  `Trade for items in Bracket ${PREMIUM_MIN_BRACKET} and above`,
  `Discounted Value Bridging price (${PREMIUM_BRIDGE_FEE_PER_BRACKET} Leaves per bracket instead of ${BRIDGE_FEE_PER_BRACKET})`,
  "A Premium badge on your profile",
  "The Premium Member achievement",
];

/**
 * The membership screen, reached from the account menu's "Premium" row.
 *
 * Premium only -- VIP is not offered here. If VIP comes back, its perks and
 * the second MembershipCard live in git history (see the commit that
 * removed them) rather than being re-derived from scratch.
 *
 * ── WHAT THIS SCREEN MUST NOT DO ─────────────────────────────────────────────
 *
 * Same rule the offer-flow lock states follow (see
 * src/components/offer/copy.ts): no price, no "Upgrade" or "Subscribe"
 * control, no button that leads nowhere. There is no Play Billing account to
 * sell a subscription through yet, so a tappable-looking CTA here would be a
 * promise the app cannot keep. Status is read live from `reputation` on
 * GET /api/v1/profile/me — the same `premium`/`premiumUntil` fields the
 * offer flow's lock screens are driven by — never hand-typed, so this screen
 * can never show "active" to someone the server would refuse.
 */
export default function PremiumScreen() {
  const router = useRouter();
  const { data, isLoading } = useProfileMe();

  if (isLoading || !data) {
    return <Splash waitingOn="Loading membership" />;
  }

  const { reputation } = data;
  const premiumActive = reputation.premium ?? false;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={color.ink} />
        </Pressable>
        <Text style={[textStyle(type.sectionHeading), styles.title]}>Premium</Text>
      </View>

      <View style={styles.hero}>
        <View style={styles.badge}>
          <Ionicons name="star" size={28} color={color.onGreen} />
        </View>
        <Text style={[textStyle(type.detailTitle), styles.heroTitle]}>
          {premiumActive ? "You're a Premium member" : "Premium, coming soon"}
        </Text>
        <Text style={[textStyle(type.detailBody), styles.heroBody]}>
          Premium unlocks higher-value trading brackets and a cheaper bridging fee.
          There is no billing yet, so there is nothing to buy here today.
        </Text>
      </View>

      <MembershipCard
        name="Premium"
        active={premiumActive}
        until={reputation.premiumUntil ?? null}
        perks={premiumPerks}
      />
    </ScrollView>
  );
}

function MembershipCard({
  name,
  active,
  until,
  perks,
}: {
  name: string;
  active: boolean;
  until: string | null;
  perks: string[];
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeadRow}>
        <Text style={[textStyle(type.itemTitle), styles.cardTitle]}>{name}</Text>
        <View style={[styles.statusPill, active ? styles.statusPillActive : styles.statusPillInactive]}>
          <Text style={[styles.statusPillText, active ? styles.statusPillTextActive : styles.statusPillTextInactive]}>
            {active ? "Active" : "Not active"}
          </Text>
        </View>
      </View>
      <Text style={[textStyle(type.detailBody), styles.copy]}>
        {active && until
          ? `Renews or expires on ${formatDate(until)}.`
          : until
            ? `Expired on ${formatDate(until)}.`
            : `Not subscribed yet — pricing is coming in a future update.`}
      </Text>
      <View style={styles.perkList}>
        {perks.map((perk) => (
          <View key={perk} style={styles.perkRow}>
            <Ionicons
              name={active ? "checkmark-circle" : "checkmark-circle-outline"}
              size={18}
              color={active ? color.green : color.inkSecondary}
            />
            <Text style={[textStyle(type.detailBody), styles.perkText]}>{perk}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  content: { padding: 20, gap: 18, paddingBottom: 36 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { color: color.ink },
  hero: {
    backgroundColor: color.inset,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.divider,
    padding: 20,
    gap: 12,
    alignItems: "center",
  },
  badge: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: color.ink, textAlign: "center" },
  heroBody: { color: color.inkSecondary, textAlign: "center" },
  card: {
    backgroundColor: color.inset,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.divider,
    padding: 18,
    gap: 12,
  },
  cardHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: color.ink },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusPillActive: { backgroundColor: color.green },
  statusPillInactive: { backgroundColor: color.divider },
  statusPillText: { fontSize: 12, fontWeight: "700" },
  statusPillTextActive: { color: color.onGreen },
  statusPillTextInactive: { color: color.inkSecondary },
  copy: { color: color.inkSecondary },
  perkList: { gap: 10 },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  perkText: { color: color.ink, flex: 1 },
});
