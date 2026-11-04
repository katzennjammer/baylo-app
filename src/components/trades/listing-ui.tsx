import { Image } from "expo-image";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import type { LiveOffer } from "../../api/types";
import { TIER_LABEL } from "../../lib/trust";
import { sizedImage } from "../../media/image-url";
import { color, font } from "../../theme/tokens";
import { Tappable } from "../Tappable";

/**
 * Small pieces shared by the redesigned Trades tab (Nov 2026): the listing
 * cards, the per-listing offer inbox and the compare screen.
 */

/* ───────────────────────────── bracket relation ───────────────────────────── */

export type Relation =
  | { kind: "same" }
  /** Their item is a bracket below yours: they pay the fee, already held. */
  | { kind: "below"; fee: number | null }
  /** Their item is a bracket above yours: you pay the fee when you accept. */
  | { kind: "above"; fee: number | null };

/**
 * Where an incoming offer stands against the listing, from the brackets the
 * server stored with it. The fee is the server's own quote (`bridgeFeeLeaves`),
 * never recomputed here, so the Premium rate and any later rule change come
 * through as they are. Null brackets (an offer from before bracket trading)
 * read as same-bracket, which is what the server treats them as on display.
 */
export function offerRelation(offer: LiveOffer): Relation {
  const theirs = offer.offeredBracket;
  const mine = offer.targetBracket;
  if (theirs === null || mine === null || theirs === mine) return { kind: "same" };
  return theirs < mine
    ? { kind: "below", fee: offer.bridgeFeeLeaves }
    : { kind: "above", fee: offer.bridgeFeeLeaves };
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** The short label on a card: "Same bracket", "One below · Ana pays 60 L". */
export function relationLabel(offer: LiveOffer): string {
  const r = offerRelation(offer);
  if (r.kind === "same") return "Same bracket";
  const fee = r.fee ? ` ${r.fee} L` : " the fee";
  return r.kind === "below"
    ? `One below · ${firstName(offer.counterparty.name)} pays${fee}`
    : `One above · you pay${fee}`;
}

export function RelationPill({ offer, style }: { offer: LiveOffer; style?: StyleProp<ViewStyle> }) {
  // Only "you pay" is coloured: it is the one case that costs the viewer.
  const youPay = offerRelation(offer).kind === "above";
  return (
    <View style={[s.pill, youPay ? s.pillWarm : s.pillQuiet, style]}>
      <Text style={[s.pillText, { color: youPay ? "#8A4A12" : color.ink }]} numberOfLines={1}>
        {relationLabel(offer)}
      </Text>
    </View>
  );
}

/* ─────────────────────────────── people ─────────────────────────────── */

const FACE_TINTS = ["#CFE0F0", "#F0DCCF", "#D6EBD2", "#E4D6EE", "#EDE5C8"];

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** A round photo, or initials on a soft tint. Decorative: the name is beside it. */
export function Face({
  name,
  avatar,
  size,
  ring,
  style,
}: {
  name: string;
  avatar: string | null;
  size: number;
  /** A border in the colour behind, so stacked faces read as separate. */
  ring?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: FACE_TINTS[(name.charCodeAt(0) || 0) % FACE_TINTS.length],
        },
        ring ? { borderWidth: 2, borderColor: ring } : null,
        style,
      ]}
    >
      {avatar ? (
        <Image source={{ uri: sizedImage(avatar, "thumb") }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
      ) : (
        <Text style={{ fontFamily: font.sansBold, fontSize: Math.round(size * 0.38), color: "#2B2A25" }}>
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}

export function TierPill({ tier }: { tier: LiveOffer["counterparty"]["trustTier"] }) {
  if (!tier) return null;
  const top = tier === "Top Trader";
  const trusted = tier === "Trusted Trader";
  return (
    <View
      style={[
        s.tier,
        top ? { backgroundColor: color.ink } : trusted ? { backgroundColor: color.greenWash } : { backgroundColor: color.control },
      ]}
    >
      <Text
        style={[s.tierText, { color: top ? color.surface : trusted ? color.forest : color.inkSecondary }]}
        numberOfLines={1}
      >
        {TIER_LABEL[tier]}
      </Text>
    </View>
  );
}

/* ─────────────────────────────── controls ─────────────────────────────── */

/** Underlined tabs across the top of the Trades tab. */
export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number; countTone?: "green" | "quiet" }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View style={s.tabs} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <Tappable
            key={t.id}
            onPress={() => onChange(t.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.count ? `${t.label}, ${t.count}` : t.label}
            style={[s.tab, { borderBottomColor: on ? color.ink : "transparent" }]}
          >
            <Text
              style={{ fontFamily: on ? font.sansBold : font.sansMedium, fontSize: 15, color: on ? color.ink : color.inkSecondary }}
              numberOfLines={1}
            >
              {t.label}
            </Text>
            {t.count ? (
              <View style={[s.count, t.countTone === "green" ? { backgroundColor: color.green } : { backgroundColor: color.controlLine }]}>
                <Text style={{ fontFamily: font.sansBold, fontSize: 11, color: t.countTone === "green" ? color.onGreen : color.inkSecondary }}>
                  {t.count}
                </Text>
              </View>
            ) : null}
          </Tappable>
        );
      })}
    </View>
  );
}

/** A sort/filter chip. Black when on. */
export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      style={[s.chip, on ? { backgroundColor: color.ink, borderColor: color.ink } : null]}
    >
      <Text style={{ fontFamily: on ? font.sansSemi : font.sansMedium, fontSize: 13, color: on ? color.surface : color.ink }}>
        {label}
      </Text>
    </Tappable>
  );
}

const s = StyleSheet.create({
  pill: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, maxWidth: "100%" },
  pillQuiet: { backgroundColor: color.control },
  pillWarm: { backgroundColor: "#FDF0E3" },
  pillText: { fontFamily: font.sansSemi, fontSize: 12 },
  tier: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tierText: { fontFamily: font.sansBold, fontSize: 10, letterSpacing: 0.5 },
  tabs: { flexDirection: "row", gap: 22, borderBottomWidth: 1, borderBottomColor: color.controlLine },
  tab: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderBottomWidth: 2,
    marginBottom: -1,
  },
  count: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: color.controlLine,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
});
