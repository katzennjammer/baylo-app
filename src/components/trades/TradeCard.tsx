import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import * as copy from "./copy";
import { Thumb } from "./rows";
import type { CardSide, CardWords, StepIndex } from "./present";
import { LeafIcon } from "../icons";
import { ClockIcon } from "../post/post-icons";
import { SwapSeam } from "../SwapSeam";
import { Tappable } from "../Tappable";
import { color, font, radius, size, space, textStyle, type } from "../../theme/tokens";
import { offerBorder, offerColor, offerSize } from "../../theme/offer-tokens";

/**
 * One trade on the Trades tab (1 Oct 2026 redesign).
 *
 *   With Aj                                   since 10 Sep
 *   You give  [photo] Vans    ┆⇄┆  You get  [photo] Air Max
 *   ●────●────◉────○      (Your move cards only)
 *   ──────────────────────────────────────────────────────
 *   Show your code to Aj at Basak Hall          [Show code]
 *
 * What a card SAYS is decided in `present.ts` (`yourMoveCard`, `waitingCard`);
 * this file is only how it looks. No monospace anywhere: every line is the body
 * family, so the list reads as sentences rather than a ledger.
 *
 * ONE SOLID BUTTON PER SCREEN. Only the top "Your move" card — the most urgent
 * one, per `buildTradesModel()` — gets the filled forest control and the 1.5
 * forest rule. Every other action is outlined: forest for the code, amber
 * (`accentGold`) while the step is choosing a hub.
 */
export function TradeCard({
  words,
  urgent = false,
  dim = false,
  onPress,
}: {
  words: CardWords;
  /** The single most urgent "Your move" card: solid button, 1.5 forest border. */
  urgent?: boolean;
  /** A cached card under a failed refresh. */
  dim?: boolean;
  /** Where the card body goes. Defaults to the action's own destination. */
  onPress?: () => void;
}) {
  const action = words.action;
  const open = onPress ?? (action ? () => router.push(action.href as never) : undefined);

  const label = [
    copy.tradeCard.withPartner(words.partner),
    words.since,
    `${copy.tradeCard.youGive} ${words.give.title}`,
    `${copy.tradeCard.youGet} ${words.get.title}`,
    words.progress ? `Step: ${copy.tradeCard.steps[words.progress.current]}` : null,
    words.footer,
    words.waitingOn,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <Tappable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        s.card,
        urgent && { borderWidth: offerBorder.selected, borderColor: offerColor.selected },
        dim && { opacity: 0.55 },
      ]}
      pressedStyle={{ backgroundColor: color.inset }}
    >
      {/* Top row: who, and since when. */}
      <View style={s.topRow}>
        <Text style={[textStyle(type.username), s.partner]} numberOfLines={1}>
          {copy.tradeCard.withPartner(words.partner)}
        </Text>
        <Text style={[textStyle(type.metadata), s.since]} numberOfLines={1}>
          {words.since}
        </Text>
      </View>

      {/* The split: give ┆⇄┆ get. */}
      <View style={s.split}>
        <Half label={copy.tradeCard.youGive} side={words.give} />
        <SwapSeam />
        <Half label={copy.tradeCard.youGet} side={words.get} />
      </View>

      {words.progress ? <ProgressTrack {...words.progress} /> : null}

      {/* Footer, above a hairline. */}
      <View style={s.footer}>
        <Text style={[textStyle(type.heroSubhead), s.footerText]}>{words.footer}</Text>
        {action ? (
          <CardButton
            label={action.label}
            tone={action.tone}
            solid={urgent}
            accessibilityLabel={action.a11y}
            onPress={() => router.push(action.href as never)}
          />
        ) : words.waitingOn ? (
          <View style={s.waitingOn}>
            <ClockIcon size={icon.size} stroke={icon.stroke} color={color.inkSecondary} />
            <Text
              style={[textStyle(type.metadata), { color: color.inkSecondary }]}
              numberOfLines={1}
            >
              {words.waitingOn}
            </Text>
          </View>
        ) : null}
      </View>
    </Tappable>
  );
}

/* ───────────────────────────── the halves ───────────────────────────── */

function Half({ label, side }: { label: string; side: CardSide }) {
  return (
    <View style={s.half}>
      <Text style={[textStyle(type.gridMeta), { color: color.inkSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={s.halfBody}>
        {side.leaves ? (
          <View style={s.leafTile}>
            <LeafIcon size={20} stroke={1.7} color={color.forest} />
          </View>
        ) : (
          <Thumb image={side.image} size={THUMB} />
        )}
        <Text
          style={[textStyle(type.hubName), s.itemName]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {side.title}
        </Text>
      </View>
    </View>
  );
}

/* ─────────────────────────── the progress track ─────────────────────── */

/**
 * Accepted · Hub set · Handoff · Done. Completed steps are filled forest dots on
 * a forest line; the current one is a round leaf marker (amber while choosing a
 * hub); later ones are hollow. A step before the current one CAN be hollow:
 * codes can be started with no hub agreed, and the track does not pretend one
 * was.
 */
function ProgressTrack({
  current,
  done,
  tone,
}: {
  current: StepIndex;
  done: [boolean, boolean, boolean, boolean];
  tone: "forest" | "amber";
}) {
  const ink = tone === "amber" ? color.accentGold : color.forest;
  const steps = copy.tradeCard.steps;
  // The line from step i to i+1 is forest once step i is done and i+1 is done or current.
  const segment = (i: number) =>
    i >= 0 && i < steps.length - 1 && done[i] && (done[i + 1] || current === i + 1)
      ? color.forest
      : color.controlLine;

  return (
    <View
      style={s.track}
      accessible
      accessibilityLabel={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}
    >
      {steps.map((name, i) => {
        const isCurrent = i === current;
        return (
          <View key={name} style={s.step}>
            <View style={s.markerRow}>
              <View
                style={[s.line, { backgroundColor: i === 0 ? "transparent" : segment(i - 1) }]}
              />
              {isCurrent ? (
                <View style={[s.marker, { backgroundColor: ink }]}>
                  <LeafIcon size={12} stroke={2} color={color.onScrim} />
                </View>
              ) : done[i] ? (
                <View style={[s.dot, { backgroundColor: color.forest }]} />
              ) : (
                <View style={[s.dot, s.hollow]} />
              )}
              <View
                style={[
                  s.line,
                  { backgroundColor: i === steps.length - 1 ? "transparent" : segment(i) },
                ]}
              />
            </View>
            <Text
              style={[
                textStyle(type.gridMeta),
                s.stepLabel,
                isCurrent
                  ? { color: ink, fontFamily: font.sansBold }
                  : { color: done[i] ? color.ink : color.inkMuted },
              ]}
              numberOfLines={1}
              // ~65 dp a step at 320 dp; "Accepted" in bold at 1.3x is ~60.
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              maxFontSizeMultiplier={size.home.headingMaxFontScale}
            >
              {name}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/* ──────────────────────────────── button ────────────────────────────── */

function CardButton({
  label,
  tone,
  solid,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  tone: "forest" | "amber";
  solid: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const ink = tone === "amber" ? color.accentGold : color.forest;
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={[
        s.button,
        solid
          ? { backgroundColor: color.forest, borderColor: color.forest }
          : { backgroundColor: color.surface, borderColor: ink },
      ]}
      pressedStyle={solid ? { opacity: 0.85 } : { backgroundColor: color.inset }}
    >
      <Text
        style={[textStyle(type.homeSeeAll), { color: solid ? color.onScrim : ink }]}
        numberOfLines={1}
        maxFontSizeMultiplier={size.home.headingMaxFontScale}
      >
        {label}
      </Text>
    </Tappable>
  );
}

/* ─────────────────────────────── styles ─────────────────────────────── */

const THUMB = offerSize.tradeRow.thumb;
/** The current-step leaf marker, and the plain dot. */
const MARKER = size.home.countdownPill - 4;
const DOT = 8;
const icon = { size: 13, stroke: 1.8 };

const s = StyleSheet.create({
  card: {
    marginHorizontal: space.screenX,
    borderRadius: radius.hubRow,
    borderWidth: offerBorder.rule,
    borderColor: color.controlLine,
    backgroundColor: color.surface,
    paddingTop: space.home.tileBody,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: space.browse.searchGap,
    paddingHorizontal: space.home.tileBody,
  },
  partner: { flex: 1, minWidth: 0, color: color.ink },
  since: { flexShrink: 0, color: color.inkSecondary },
  split: {
    flexDirection: "row",
    marginTop: space.home.tileBody,
    paddingHorizontal: space.home.tileBody,
  },
  half: { flex: 1, minWidth: 0, gap: 6, paddingVertical: 2 },
  halfBody: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemName: { flex: 1, minWidth: 0, color: color.ink },
  leafTile: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.matchesThumb,
    backgroundColor: color.greenWash,
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    flexDirection: "row",
    marginTop: space.home.tileBody + 2,
    paddingHorizontal: space.home.tileBody - 6,
  },
  step: { flex: 1, minWidth: 0, alignItems: "center", gap: 5 },
  markerRow: { flexDirection: "row", alignItems: "center", height: MARKER, alignSelf: "stretch" },
  line: { flex: 1, height: 2 },
  marker: {
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  hollow: {
    borderWidth: 1.5,
    borderColor: color.controlLineStrong,
    backgroundColor: color.surface,
  },
  stepLabel: { textAlign: "center" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: space.browse.searchGap,
    marginTop: space.home.tileBody,
    paddingHorizontal: space.home.tileBody,
    paddingVertical: space.home.tileBody - 2,
    borderTopWidth: offerBorder.rule,
    borderTopColor: color.divider,
  },
  footerText: { flexGrow: 1, flexShrink: 1, flexBasis: 140, color: color.ink },
  waitingOn: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 0, maxWidth: "100%" },
  button: {
    height: size.home.heroCta,
    paddingHorizontal: size.home.heroCtaX,
    borderRadius: radius.heroCta,
    borderWidth: offerBorder.rule,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginLeft: "auto",
  },
});
