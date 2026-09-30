import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Path, Rect } from "react-native-svg";

import { useProfileMe } from "../src/api/profile";
import { PrimaryButton, SecondaryButton, SectionLabel } from "../src/components/offer/chrome";
import { LockIcon } from "../src/components/offer/icons";
import { OfferSheet } from "../src/components/offer/OfferSheet";
import { Glyph, LeafIcon, StarIcon, type IconProps } from "../src/components/icons";
import { bracketLabel, PREMIUM_MIN_BRACKET, VIP_MIN_BRACKET } from "../src/lib/brackets";
import {
  hasPremiumAccess,
  PREMIUM_BETA_NOTE,
  PREMIUM_BRIDGE_FEE_PER_BRACKET,
  PREMIUM_PRICE,
  PREMIUM_TERM_LABEL,
  type PremiumReason,
} from "../src/lib/premium";
import { BRIDGE_FEE_PER_BRACKET } from "../src/lib/trade-rules";
import {
  offerBorder,
  offerColor,
  offerIcon,
  offerRadius,
  offerSpace,
  offerType,
  textStyle,
} from "../src/theme/offer-tokens";

/**
 * The Premium sheet — the ONE paywall.
 *
 * Reached from the account menu, and from every place the bracket gate blocks
 * an action: the locked offer bar on item detail, the composer's lock panel,
 * and a 403 PREMIUM_REQUIRED / VIP_REQUIRED on send or accept (see
 * `openPremium()` in src/lib/premium). There is no second paywall anywhere;
 * a gate that wants to explain itself sends people here with `reason`.
 *
 * ── IT IS A SHEET, AND THE SAME ONE AS `How trading works` ──────────────────
 *
 * Still a route, so `openPremium()` stays the one way in and every entry point
 * gets the same thing: app/_layout declares `/premium` a `transparentModal`
 * with no navigator animation, and this screen draws nothing but an
 * `OfferSheet` — the shell `How trading works` uses — over whatever opened it.
 * The sheet brings its own slide-up, scrim and rounded top. Unlike that
 * first-run prompt this one is dismissible: a scrim tap, the back gesture, a
 * drag down on the handle, or `Done`, all of which pop the route.
 *
 * Same tokens, same rhythm: `offerSpace.prompt`'s 20 gutter, a 700 Bricolage
 * heading, then titled paragraphs — a 15/600 `reachHeading` over a 14/21
 * `bodyDense` in inkSecondary, 3 apart, 16 between — and one green primary
 * button pinned at the bottom. Where that sheet numbers its rules `01`–`04`
 * in mono, the perks here lead with an icon on a green-wash tile, because a
 * perk is a thing you get rather than a step you follow.
 *
 * ── WHAT THIS SCREEN MUST NOT DO ─────────────────────────────────────────────
 *
 * Pretend a purchase exists. There is no Play Billing integration, so the
 * buy button is DISABLED and says why directly under it; nothing here
 * grants Premium, and nothing here charges anyone. Status is read live from
 * `reputation` on GET /api/v1/profile/me — the server's own verdict — never
 * inferred, so this screen cannot say "Active" to someone the gate refuses.
 *
 * Every number is imported, not typed: the bracket floors from brackets.ts,
 * the standard fee from the trade-rules mirror, the Premium rate from
 * premium.ts's mirror of the server's PREMIUM_BRIDGE_FEE_PER_BRACKET.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `18 Oct 2026`. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const DISCOUNT_PERCENT = Math.round(
  ((BRIDGE_FEE_PER_BRACKET - PREMIUM_BRIDGE_FEE_PER_BRACKET) / BRIDGE_FEE_PER_BRACKET) * 100,
);

/**
 * The perks, each one something a live subscription actually changes on the
 * server today. The search assistant (Premium-gated POST /api/v1/assistant) is
 * deliberately absent: the phone has no way to reach it yet, and a perk you
 * cannot use is not one.
 */
const PERKS: readonly { key: string; Icon: (p: IconProps) => React.JSX.Element; title: string; body: string }[] = [
  {
    key: "brackets",
    Icon: UnlockIcon,
    title: `Trade in ${bracketLabel(PREMIUM_MIN_BRACKET)} and above`,
    body:
      `Propose on and accept items in Brackets ${PREMIUM_MIN_BRACKET} and ${VIP_MIN_BRACKET - 1}. ` +
      `Brackets ${VIP_MIN_BRACKET} and 10 need VIP, which comes later.`,
  },
  {
    key: "bridge",
    Icon: LeafIcon,
    title: "Cheaper bridging fees",
    body:
      `${PREMIUM_BRIDGE_FEE_PER_BRACKET} Leaves per bracket instead of ${BRIDGE_FEE_PER_BRACKET} — ` +
      `${DISCOUNT_PERCENT}% off whenever you're the one paying the bridge.`,
  },
  {
    key: "badge",
    Icon: StarIcon,
    title: "Premium badge",
    body: "The Premium Member badge, shown on your profile. It stays yours even if Premium lapses.",
  },
];

export default function PremiumScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ reason?: string; bracket?: string }>();
  const reason: PremiumReason | null =
    params.reason === "premium" || params.reason === "vip" ? params.reason : null;
  const bracket = params.bracket ? Number(params.bracket) : NaN;
  const { data, isLoading } = useProfileMe();
  const { height: windowHeight } = useWindowDimensions();

  const rep = data?.reputation;
  const active = hasPremiumAccess(rep);
  const p = offerSpace.prompt;
  // `How trading works`'s sizing: its height, clamped to the window; the body scrolls.
  const height = Math.min(p.height, Math.round(windowHeight * 0.88));
  const close = () => router.back();

  if (isLoading) {
    return (
      <OfferSheet dismissible swipeToDismiss onDismiss={close} height={height}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={offerColor.green} accessibilityLabel="Loading Premium" />
        </View>
      </OfferSheet>
    );
  }

  return (
    <OfferSheet dismissible swipeToDismiss onDismiss={close} height={height}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: p.x, paddingTop: p.handleToHeading, paddingBottom: p.listToButton }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <View style={{ alignItems: "center" }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: offerColor.green,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <StarIcon size={34} stroke={2} color={offerColor.onGreen} />
          </View>
          <Text
            style={[
              textStyle(offerType.screenHeading),
              { color: offerColor.ink, marginTop: p.handleToHeading, textAlign: "center" },
            ]}
            accessibilityRole="header"
          >
            {active ? "You're a Premium member" : "Unlock Premium"}
          </Text>
          <Text
            style={[
              textStyle(offerType.body),
              { color: offerColor.inkSecondary, marginTop: 6, textAlign: "center" },
            ]}
          >
            {active
              ? "Here's everything your membership includes."
              : "Trade for bigger things, pay less to bridge, and show it on your profile."}
          </Text>
          {rep ? <StatusPill active={active} rep={rep} /> : null}
        </View>

        {/* ── Why you're here, when a gate sent you ────────────────────── */}
        {reason && !active ? <BlockedNote reason={reason} bracket={bracket} /> : null}
        {reason === "vip" && active ? <BlockedNote reason="vip" bracket={bracket} /> : null}

        {/* ── Perks ───────────────────────────────────────────────────── */}
        <View style={{ marginTop: 28 }}>
          <SectionLabel>What you get</SectionLabel>
          <View
            style={{
              marginTop: offerSpace.labelToContent,
              borderRadius: offerRadius.sheet,
              borderWidth: offerBorder.hairline,
              borderColor: offerColor.hairline,
              backgroundColor: offerColor.paper,
              paddingHorizontal: 16,
            }}
          >
            {PERKS.map(({ key, Icon, title, body }, i) => (
              <View
                key={key}
                style={{
                  flexDirection: "row",
                  gap: 14,
                  paddingVertical: p.sectionGap,
                  borderTopWidth: i === 0 ? 0 : offerBorder.hairline,
                  borderTopColor: offerColor.hairline,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: offerColor.trackGreen,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={20} stroke={1.8} color={offerColor.deep} />
                </View>
                <View style={{ flex: 1, gap: p.titleToBody }}>
                  <Text style={[textStyle(offerType.reachHeading), { color: offerColor.ink }]}>{title}</Text>
                  <Text style={[textStyle(offerType.bodyDense), { color: offerColor.inkSecondary }]}>{body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── Price ───────────────────────────────────────────────────── */}
        {!active ? (
          <View
            style={{
              marginTop: 20,
              borderRadius: offerRadius.sheet,
              borderWidth: offerBorder.selected,
              borderColor: offerColor.green,
              backgroundColor: offerColor.tintGreen,
              paddingVertical: 18,
              paddingHorizontal: 20,
              alignItems: "center",
            }}
            accessibilityLabel={`Premium costs ${PREMIUM_PRICE}, ${PREMIUM_TERM_LABEL.replace(" · ", ", ")}. ${PREMIUM_BETA_NOTE}`}
          >
            <SectionLabel>Beta price</SectionLabel>
            <Text
              style={[
                textStyle(offerType.detailTitle),
                { color: offerColor.ink, fontSize: 36, lineHeight: 42, marginTop: 8 },
              ]}
            >
              {PREMIUM_PRICE}
            </Text>
            <Text style={[textStyle(offerType.leavesRow), { color: offerColor.inkSecondary, marginTop: 2 }]}>
              {PREMIUM_TERM_LABEL}
            </Text>
            <Text
              style={[
                textStyle(offerType.helper),
                { color: offerColor.inkTertiary, marginTop: 8, textAlign: "center" },
              ]}
            >
              {PREMIUM_BETA_NOTE}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Pinned under the scroll, as `Got it` is. The sheet already pads for
          the home indicator, so this is not `OfferBottomBar`, which would pad
          for it a second time. */}
      <View style={{ paddingHorizontal: p.x }}>
        {active ? (
          <SecondaryButton label="Done" onPress={close} />
        ) : (
          <>
            <PrimaryButton
              label={`Get Premium · ${PREMIUM_PRICE} one-time`}
              onPress={() => {}}
              disabled
              disabledHint="Payments open in a future update. You will not be charged today."
            />
            <Text
              style={[
                textStyle(offerType.helper),
                { color: offerColor.inkTertiary, marginTop: offerSpace.bottomBar.buttonToFootnote },
              ]}
            >
              Payments open in a future update. You will not be charged today.
            </Text>
          </>
        )}
      </View>
    </OfferSheet>
  );
}

/** Active / Not active, with the date the server holds when there is one. */
function StatusPill({
  active,
  rep,
}: {
  active: boolean;
  rep: { vip?: boolean; premiumUntil?: string | null; premiumLifetime?: boolean; vipUntil?: string | null };
}) {
  const viaVip = rep.vip === true;
  const until = viaVip ? rep.vipUntil : rep.premiumUntil;
  const base = viaVip ? "Active through VIP" : "Active";
  let label: string;
  if (!active) {
    label = rep.premiumUntil ? `Not active · expired ${formatDate(rep.premiumUntil)}` : "Not active";
  } else if (!viaVip && rep.premiumLifetime) {
    // A beta lifetime grant holds a 9999 sentinel date; never print it.
    label = "Active · lifetime";
  } else {
    label = until ? `${base} · until ${formatDate(until)}` : base;
  }

  return (
    <View
      style={{
        marginTop: 14,
        paddingHorizontal: 12,
        height: 28,
        borderRadius: 14,
        justifyContent: "center",
        backgroundColor: active ? offerColor.trackGreen : offerColor.quiet,
      }}
    >
      <Text style={[textStyle(offerType.chip), { color: active ? offerColor.deep : offerColor.inkSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

/**
 * What the gate just refused, in one quiet line — the lock panel's treatment
 * (hairline, padlock, inkSecondary), never the warm failure accent: being
 * below a bracket is not an error.
 */
function BlockedNote({ reason, bracket }: { reason: PremiumReason; bracket: number }) {
  const where = Number.isFinite(bracket) ? `That listing is in ${bracketLabel(bracket)}. ` : "";
  const text =
    reason === "vip"
      ? `${where}Brackets ${VIP_MIN_BRACKET} and 10 need VIP, which isn't part of Premium and isn't available yet.`
      : `${where}Trading at ${bracketLabel(PREMIUM_MIN_BRACKET)} and above opens with Premium.`;

  return (
    <View
      style={{
        marginTop: 22,
        flexDirection: "row",
        gap: 12,
        padding: 14,
        borderRadius: offerRadius.row,
        borderWidth: offerBorder.hairline,
        borderColor: offerColor.rule,
        backgroundColor: offerColor.sunk,
      }}
    >
      <LockIcon size={offerIcon.lock.size} stroke={offerIcon.lock.stroke} color={offerColor.inkSecondary} />
      <Text style={[textStyle(offerType.bodyDense), { color: offerColor.inkSecondary, flex: 1 }]}>{text}</Text>
    </View>
  );
}

/** The padlock from the lock states, opened. Same box and shackle geometry. */
function UnlockIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Rect x="4" y="10.5" width="16" height="10.5" rx="2.2" />
      <Path d="M7.6 10.5V7.6a4.4 4.4 0 0 1 8.5-1.6" />
    </Glyph>
  );
}
