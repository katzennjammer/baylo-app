import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, ScrollView, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { useProfileMe } from "../src/api/profile";
import { LockIcon } from "../src/components/offer/icons";
import { OfferSheet } from "../src/components/offer/OfferSheet";
import { Glyph, LeafIcon, StarIcon, type IconProps } from "../src/components/icons";
import { Tappable } from "../src/components/Tappable";
import { BRACKET_COUNT, bracketLabel, PREMIUM_MIN_BRACKET, VIP_MIN_BRACKET } from "../src/lib/brackets";
import {
  hasPremiumAccess,
  PREMIUM_BETA_NOTE,
  PREMIUM_BRIDGE_FEE_PER_BRACKET,
  PREMIUM_PRICE,
  PREMIUM_TERM_LABEL,
  type PremiumReason,
} from "../src/lib/premium";
import { BRIDGE_FEE_PER_BRACKET } from "../src/lib/trade-rules";
import { noteOpeningReputation } from "../src/media/opening-tier-store";
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
 * ── THE LAYOUT ───────────────────────────────────────────────────────────────
 *
 * A storefront paywall, top to bottom: a green-wash hero with a cloud-shaped
 * top, sparkles and Baylo's leaf mascot as a white-edged sticker; a large
 * two-line Bricolage headline with its payoff in forest green; one plan card
 * (term, a BETA tag, the price, the beta note); `What's included for you`; and
 * a dark pill button pinned at the bottom with one centred line under it.
 * There is one plan, so there is no `Show more plans`.
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
 * premium.ts's mirror of the server's PREMIUM_BRIDGE_FEE_PER_BRACKET, and the
 * price and term from premium.ts.
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

/** `one-time · lifetime` → the price's suffix and the card's title word. */
const [TERM_PAYMENT, TERM_LENGTH = ""] = PREMIUM_TERM_LABEL.split(" · ");
const TERM_TITLE = TERM_LENGTH ? TERM_LENGTH[0].toUpperCase() + TERM_LENGTH.slice(1) : "Premium";

const HERO_HEIGHT = 236;
/** The top of the hero wash: a step deeper than `trackGreen`, so white sparkles and the sticker edge read on it. */
const HERO_WASH = "#C9E8D0";
const NOT_CHARGED = "Payments open in a future update. You will not be charged today.";

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
    // Every bracket from PREMIUM_MIN_BRACKET up since 22 Oct 2026, when the
    // server dropped the VIP-only bracket (9+), a tier nobody could buy.
    body: `Propose on and accept items in Bracket ${PREMIUM_MIN_BRACKET} and every bracket above it.`,
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

  // The opening film's cached tier follows the paywall's own read of the
  // server's verdict. There is no purchase callback to hang this on — the buy
  // button is disabled until Play Billing exists — so this is the success path:
  // a grant (today by hand, later a purchase that invalidates profile/me)
  // reaches here as `active`, and the next launch plays the Premium film.
  useEffect(() => {
    if (rep) noteOpeningReputation({ premium: rep.premium, vip: rep.vip });
  }, [rep?.premium, rep?.vip]); // eslint-disable-line react-hooks/exhaustive-deps
  const p = offerSpace.prompt;
  // Taller than `How trading works`: the hero takes the top of the sheet.
  const height = Math.round(windowHeight * 0.92);
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
        contentContainerStyle={{ paddingBottom: p.listToButton }}
        showsVerticalScrollIndicator={false}
      >
        <Hero />

        <View style={{ paddingHorizontal: p.x }}>
          {/* ── Headline ──────────────────────────────────────────────── */}
          <Text
            style={[
              textStyle(offerType.screenHeading),
              { color: offerColor.ink, fontSize: 30, lineHeight: 36, letterSpacing: -0.4, textAlign: "center" },
            ]}
            accessibilityRole="header"
          >
            {active ? "You're a\n" : "Trade bigger.\nBridge "}
            <Text style={{ color: offerColor.deep }}>{active ? "Premium member" : `${DISCOUNT_PERCENT}% cheaper`}</Text>
            {active ? "" : "."}
          </Text>
          {rep ? (
            <View style={{ alignItems: "center" }}>
              <StatusPill active={active} rep={rep} />
            </View>
          ) : null}

          {/* ── Why you're here, when a gate sent you ────────────────── */}
          {reason && !active ? <BlockedNote reason={reason} bracket={bracket} /> : null}
          {reason === "vip" && active ? <BlockedNote reason="vip" bracket={bracket} /> : null}

          {/* ── The plan ──────────────────────────────────────────────── */}
          {!active ? <PlanCard /> : null}

          {/* ── Perks ─────────────────────────────────────────────────── */}
          <Text style={[textStyle(offerType.sheetHeading), { color: offerColor.ink, fontSize: 19, marginTop: 28 }]}>
            {active ? "What's included" : "What's included for you"}
          </Text>
          <View style={{ marginTop: 6 }}>
            {PERKS.map(({ key, Icon, title, body }) => (
              <View key={key} style={{ flexDirection: "row", gap: 14, paddingVertical: 12 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: offerColor.trackGreen,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={18} stroke={1.8} color={offerColor.deep} />
                </View>
                <View style={{ flex: 1, gap: p.titleToBody }}>
                  <Text style={[textStyle(offerType.reachHeading), { color: offerColor.ink }]}>{title}</Text>
                  <Text style={[textStyle(offerType.bodyDense), { color: offerColor.inkSecondary }]}>{body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Pinned under the scroll, as `Got it` is. The sheet already pads for
          the home indicator, so this is not `OfferBottomBar`, which would pad
          for it a second time. */}
      <View style={{ paddingHorizontal: p.x, paddingTop: 10 }}>
        {active ? (
          <PillButton label="Done" onPress={close} />
        ) : (
          <>
            <PillButton label={`Get Premium for ${PREMIUM_PRICE}`} onPress={() => {}} disabled disabledHint={NOT_CHARGED} />
            <Text
              style={[
                textStyle(offerType.helper),
                {
                  color: offerColor.inkTertiary,
                  marginTop: offerSpace.bottomBar.buttonToFootnote,
                  textAlign: "center",
                },
              ]}
            >
              {NOT_CHARGED}
            </Text>
          </>
        )}
      </View>
    </OfferSheet>
  );
}

/**
 * The top of the sheet: a green wash with a scalloped, cloud-like top edge
 * that fades into paper, a smiling cloud, a scatter of sparkles, and the
 * mascot standing in the middle.
 */
function Hero() {
  return (
    <View style={{ height: HERO_HEIGHT, marginTop: 6 }} accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height={HERO_HEIGHT} viewBox={`0 0 360 ${HERO_HEIGHT}`} preserveAspectRatio="none" style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={HERO_WASH} />
            <Stop offset="0.65" stopColor={offerColor.trackGreen} />
            <Stop offset="1" stopColor={offerColor.paper} />
          </LinearGradient>
        </Defs>
        <Path
          d={`M0 78 C0 52 22 40 46 44 C58 16 100 6 130 24 C150 2 206 0 226 24 C254 6 300 12 314 42 C340 40 360 56 360 80 V${HERO_HEIGHT} H0 Z`}
          fill="url(#wash)"
        />
      </Svg>

      {/* The cloud, top left. */}
      <View style={{ position: "absolute", left: 30, top: 34 }}>
        <Svg width={64} height={40} viewBox="0 0 64 40">
          <Path
            d="M14 38 C5 38 2 30 6 25 C2 18 9 10 17 13 C19 4 31 1 37 8 C43 2 55 5 55 15 C62 16 64 25 59 30 C59 36 54 38 49 38 Z"
            fill="#FFFFFF"
          />
          <Circle cx={26} cy={24} r={1.8} fill={offerColor.ink} />
          <Circle cx={38} cy={24} r={1.8} fill={offerColor.ink} />
          <Path d="M29 29 Q32 32 35 29" stroke={offerColor.ink} strokeWidth={1.4} fill="none" strokeLinecap="round" />
          <Ellipse cx={21} cy={28} rx={3} ry={1.8} fill={offerColor.warm} opacity={0.3} />
          <Ellipse cx={43} cy={28} rx={3} ry={1.8} fill={offerColor.warm} opacity={0.3} />
        </Svg>
      </View>

      <Sparkle size={22} style={{ left: "20%", top: 108 }} />
      <Sparkle size={26} style={{ right: "22%", top: 38 }} />
      <Sparkle size={14} style={{ right: "10%", top: 76 }} />
      <Sparkle size={18} style={{ right: "14%", top: 150 }} />

      <View style={{ position: "absolute", left: 0, right: 0, top: 40, alignItems: "center" }}>
        <Mascot size={180} />
      </View>
    </View>
  );
}

/** A white four-point sparkle, absolutely placed. */
function Sparkle({ size, style }: { size: number; style: { left?: `${number}%`; right?: `${number}%`; top: number } }) {
  return (
    <View style={[{ position: "absolute" }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z" fill="#FFFFFF" />
      </Svg>
    </View>
  );
}

/**
 * Baylo's leaf, given a face and a wave, drawn as a sticker: a thick white
 * edge around the whole figure and a soft shadow under it.
 */
function Mascot({ size }: { size: number }) {
  const body =
    "M80 22 C122 34 140 74 128 110 C118 138 96 146 80 146 C64 146 42 138 32 110 C20 74 38 34 80 22 Z";
  const leftArm = "M38 106 Q24 104 20 90";
  const rightArm = "M122 100 Q138 92 138 74";
  return (
    <Svg width={size} height={size} viewBox="0 0 160 170">
      <Ellipse cx={80} cy={160} rx={46} ry={7} fill={offerColor.ink} opacity={0.08} />

      {/* The sticker edge: every part, stroked thick in white, underneath. */}
      <G stroke="#FFFFFF" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" fill="#FFFFFF">
        <Path d={body} />
        <Path d={leftArm} fill="none" />
        <Path d={rightArm} fill="none" />
        <Path d="M80 22 C82 12 90 6 100 6" fill="none" />
        <Ellipse cx={66} cy={148} rx={11} ry={6} />
        <Ellipse cx={94} cy={148} rx={11} ry={6} />
      </G>

      {/* Stem, feet, arms. */}
      <Path d="M80 22 C82 12 90 6 100 6" stroke={offerColor.deep} strokeWidth={4} fill="none" strokeLinecap="round" />
      <Ellipse cx={66} cy={148} rx={11} ry={6} fill={offerColor.deep} />
      <Ellipse cx={94} cy={148} rx={11} ry={6} fill={offerColor.deep} />
      <Path d={leftArm} stroke={offerColor.deep} strokeWidth={7} fill="none" strokeLinecap="round" />
      <Path d={rightArm} stroke={offerColor.deep} strokeWidth={7} fill="none" strokeLinecap="round" />

      {/* Body, its midrib, and a pale belly. */}
      <Path d={body} fill={offerColor.green} />
      <Path d="M80 30 V62" stroke={offerColor.deep} strokeWidth={2.5} strokeLinecap="round" opacity={0.35} />
      <Ellipse cx={80} cy={124} rx={26} ry={17} fill={offerColor.soft} />

      {/* Face. */}
      <Circle cx={64} cy={84} r={7.5} fill={offerColor.ink} />
      <Circle cx={96} cy={84} r={7.5} fill={offerColor.ink} />
      <Circle cx={66.5} cy={81.5} r={2.6} fill="#FFFFFF" />
      <Circle cx={98.5} cy={81.5} r={2.6} fill="#FFFFFF" />
      <Ellipse cx={52} cy={98} rx={6.5} ry={4} fill={offerColor.warm} opacity={0.4} />
      <Ellipse cx={108} cy={98} rx={6.5} ry={4} fill={offerColor.warm} opacity={0.4} />
      <Path d="M71 97 Q80 106 89 97" stroke={offerColor.ink} strokeWidth={3} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/**
 * The one plan: its term, a BETA tag where a discount tag would sit, the
 * price, and the beta note — so nobody reads the beta price as the final figure.
 */
function PlanCard() {
  return (
    <View
      style={{
        marginTop: 24,
        borderRadius: offerRadius.sheet,
        borderWidth: offerBorder.selected,
        borderColor: offerColor.green,
        backgroundColor: offerColor.tintGreen,
        paddingVertical: 16,
        paddingHorizontal: 18,
      }}
      accessible
      accessibilityLabel={`Premium costs ${PREMIUM_PRICE}, ${PREMIUM_TERM_LABEL.replace(" · ", ", ")}. ${PREMIUM_BETA_NOTE}`}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={[textStyle(offerType.reachHeading), { color: offerColor.ink }]}>
          <Text style={{ color: offerColor.deep }}>{TERM_TITLE}</Text> access
        </Text>
        <View
          style={{
            paddingHorizontal: 10,
            height: 24,
            borderRadius: 12,
            justifyContent: "center",
            backgroundColor: offerColor.green,
          }}
        >
          <Text style={[textStyle(offerType.chip), { color: offerColor.onGreen, fontSize: 11, letterSpacing: 0.5 }]}>
            BETA PRICE
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 8 }}>
        <Text style={[textStyle(offerType.detailTitle), { color: offerColor.ink, fontSize: 30, lineHeight: 36 }]}>
          {PREMIUM_PRICE}
        </Text>
        <Text style={[textStyle(offerType.rowSubtitle), { color: offerColor.inkSecondary, marginLeft: 4, marginBottom: 6 }]}>
          / {TERM_PAYMENT}
        </Text>
      </View>
      <Text style={[textStyle(offerType.helper), { color: offerColor.inkTertiary, marginTop: 4 }]}>
        {PREMIUM_BETA_NOTE}
      </Text>
    </View>
  );
}

/** The paywall's dark pill. Disabled, it fades and says why through its hint. */
function PillButton({
  label,
  onPress,
  disabled,
  disabledHint,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <Tappable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      accessibilityHint={disabled ? disabledHint : undefined}
      style={{
        height: 54,
        borderRadius: 27,
        backgroundColor: offerColor.ink,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.55 : 1,
      }}
      pressedStyle={disabled ? undefined : { opacity: 0.85 }}
    >
      <Text style={[textStyle(offerType.buttonPrimary), { color: offerColor.onDark }]}>{label}</Text>
    </Tappable>
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
      ? `${where}Brackets ${VIP_MIN_BRACKET} and ${BRACKET_COUNT} need VIP, which isn't part of Premium and isn't available yet.`
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
