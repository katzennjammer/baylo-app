import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useTradeHistory } from "../src/api/trades";
import type { ActiveTrade } from "../src/api/types";
import { LeafIcon, StarIcon } from "../src/components/icons";
import { OfferScreenHost } from "../src/components/offer/chrome";
import { Tappable } from "../src/components/Tappable";
import { Gutter, TradesBackTitle } from "../src/components/trades/chrome";
import * as copy from "../src/components/trades/copy";
import * as present from "../src/components/trades/present";
import type { CardSide } from "../src/components/trades/present";
import { Thumb } from "../src/components/trades/rows";
import { TradesErrorPanel, TradesSkeleton } from "../src/components/trades/states";
import { clockTime } from "../src/lib/format";
import { border, color, radius, size, space, textStyle, type } from "../src/theme/tokens";
import { offerBorder } from "../src/theme/offer-tokens";

/**
 * Finished trades (1 Oct 2026 redesign). Deliberately quiet, grouped by month.
 *
 * ══ ONE SWITCH, TWO LISTS ═══════════════════════════════════════════════════
 *
 * "Completed · N" / "Called off · N", Completed by default. A trade can end
 * three ways and each was performed by a different party:
 *
 *   COMPLETED   the codes matched.          Completed
 *   REJECTED    they said no.               Called off, chip "Declined"
 *   CANCELLED   it was called off.          Called off, chip "Called off"
 *
 * REJECTED and CANCELLED share the second list because neither is a swap,
 * but the chip keeps the two facts apart — they are never collapsed into one
 * word. See `present.finishedRowWords()`.
 *
 * ══ AND OFFERS ARE NOT ON THE WIRE ══════════════════════════════════════════
 *
 * `offers` on /api/v1/trades filters `status: "PENDING"`, and `tab=history`
 * pages `TradeRequest` rows rather than `Offer` rows. So a declined, withdrawn
 * or expired offer appears on no endpoint this client can call, and the line
 * at the bottom says so. See gap 4 in `src/api/trades.ts`.
 *
 * ══ NOTHING CONGRATULATES ═══════════════════════════════════════════════════
 *
 * The only colour on a row is the amber "Rate Aya" pill, which is a thing
 * left to do, and the star beside a score you gave.
 */
export default function TradesHistoryScreen() {
  const router = useRouter();
  const history = useTradeHistory();
  const [tab, setTab] = useState<"completed" | "calledOff">("completed");

  const trades = history.data?.trades ?? [];
  const completed = useMemo(() => trades.filter((t) => t.status === "COMPLETED"), [trades]);
  const calledOff = useMemo(() => trades.filter((t) => t.status !== "COMPLETED"), [trades]);
  const shown = tab === "completed" ? completed : calledOff;
  const months = useMemo(() => present.groupByMonth(shown), [shown]);

  if (history.isPending && !history.data) {
    return (
      <OfferScreenHost imeInset={0}>
        <TradesBackTitle title={copy.nav.history} onBack={() => router.back()} />
        <TradesSkeleton />
      </OfferScreenHost>
    );
  }

  return (
    <OfferScreenHost imeInset={0}>
      <TradesBackTitle title={copy.nav.history} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {history.isError ? (
          <TradesErrorPanel
            heading="Can't load your finished trades"
            onRetry={() => void history.refetch()}
          />
        ) : null}

        <Gutter style={s.switchRow}>
          <View style={s.toggle} accessibilityRole="tablist" accessibilityLabel="Finished trades">
            <Segment
              label={copy.history.completedTab(completed.length)}
              on={tab === "completed"}
              onPress={() => setTab("completed")}
            />
            <Segment
              label={copy.history.calledOffTab(calledOff.length)}
              on={tab === "calledOff"}
              onPress={() => setTab("calledOff")}
            />
          </View>
        </Gutter>

        {months.map((month) => (
          <View key={month.label}>
            <Gutter style={s.month}>
              <Text
                style={[textStyle(type.sectionHeading), { color: color.inkSecondary }]}
                accessibilityRole="header"
              >
                {month.label}
              </Text>
            </Gutter>
            {month.rows.map((trade) => (
              <FinishedRow
                key={trade.id}
                trade={trade}
                onPress={() =>
                  router.push(`/trade-summary?id=${encodeURIComponent(trade.id)}`)
                }
                onRate={() => router.push(`/rate-trade?id=${encodeURIComponent(trade.id)}`)}
              />
            ))}
          </View>
        ))}

        {shown.length === 0 && history.data && !history.isError ? (
          <Gutter style={{ paddingTop: space.home.headingToContent }}>
            <Text style={[textStyle(type.emptyBody), { color: color.inkSecondary }]}>
              {trades.length === 0
                ? copy.empty.body
                : tab === "completed"
                  ? copy.history.noneCompleted
                  : copy.history.noneCalledOff}
            </Text>
          </Gutter>
        ) : null}

        {/* What this list does NOT contain, said plainly. Not an apology and
            not an error: somebody looking for the offer they withdrew last
            Tuesday will not find it here. */}
        <Gutter style={{ paddingTop: space.home.sectionTop, paddingBottom: 30 }}>
          <Text style={[textStyle(type.metadata), { color: color.inkMuted }]}>
            {copy.history.offersNote}
          </Text>
        </Gutter>
      </ScrollView>
    </OfferScreenHost>
  );
}

/** One half of the switch. The marketplace sort toggle's geometry, at full width. */
function Segment({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      hitSlop={{ top: 7, bottom: 7 }}
      style={[s.segment, on && { backgroundColor: color.green }]}
      pressedStyle={{ opacity: 0.75 }}
    >
      <Text
        style={[textStyle(type.chip), { color: on ? color.onGreen : color.inkSecondary }]}
        maxFontSizeMultiplier={size.home.headingMaxFontScale}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Tappable>
  );
}

/**
 * One finished trade: the pair of photos, overlapping; "With Aya"; the date
 * line; and on the right the rating, the "Rate Aya" pill, or the grey chip.
 */
function FinishedRow({
  trade,
  onPress,
  onRate,
}: {
  trade: ActiveTrade;
  onPress: () => void;
  onRate: () => void;
}) {
  const words = present.finishedRowWords(trade, clockTime);
  const rated = trade.myReview?.rating ?? null;
  const completed = trade.status === "COMPLETED";

  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[
        copy.history.withPartner(words.partner),
        words.meta,
        words.chip,
        rated !== null ? `You rated ${rated} out of 5` : null,
      ]
        .filter(Boolean)
        .join(". ")}
      style={s.row}
      pressedStyle={{ backgroundColor: color.inset }}
    >
      <View style={s.pair}>
        <Mini side={words.give} />
        <View style={s.pairBack}>
          <Mini side={words.get} />
        </View>
      </View>

      <View style={s.body}>
        <Text style={[textStyle(type.username), { color: color.ink }]} numberOfLines={1}>
          {copy.history.withPartner(words.partner)}
        </Text>
        <Text style={[textStyle(type.metadata), { color: color.inkSecondary }]} numberOfLines={2}>
          {words.meta}
        </Text>
      </View>

      {words.chip ? (
        <View style={s.greyChip}>
          <Text
            style={[textStyle(type.chip), { color: color.inkSecondary }]}
            maxFontSizeMultiplier={size.home.headingMaxFontScale}
            numberOfLines={1}
          >
            {words.chip}
          </Text>
        </View>
      ) : completed && rated !== null ? (
        <View style={s.rated}>
          <StarIcon size={14} stroke={1.8} color={color.accentGold} />
          <Text style={[textStyle(type.username), { color: color.ink }]}>{rated}</Text>
        </View>
      ) : completed ? (
        <Tappable
          onPress={onRate}
          accessibilityRole="button"
          accessibilityLabel={`Rate ${trade.counterparty.name}`}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          style={s.ratePill}
          pressedStyle={{ backgroundColor: color.inset }}
        >
          <Text
            style={[textStyle(type.chip), { color: color.accentGold }]}
            maxFontSizeMultiplier={size.home.headingMaxFontScale}
            numberOfLines={1}
          >
            {copy.history.rate(words.partner)}
          </Text>
        </Tappable>
      ) : null}
    </Tappable>
  );
}

/** A small thumbnail, or the leaf tile for a side that was Leaves. */
function Mini({ side }: { side: CardSide }) {
  if (side.leaves) {
    return (
      <View style={[s.mini, s.leafTile]}>
        <LeafIcon size={16} stroke={1.7} color={color.forest} />
      </View>
    );
  }
  return (
    <View style={s.mini}>
      <Thumb image={side.image} size={MINI} />
    </View>
  );
}

const MINI = 34;
const OVERLAP = 12;

const s = StyleSheet.create({
  switchRow: { paddingTop: space.home.headingToContent / 2 },
  toggle: {
    flexDirection: "row",
    gap: 3,
    padding: 3,
    borderRadius: radius.filterButton,
    backgroundColor: color.control,
    borderWidth: border.chip,
    borderColor: color.controlLine,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    minHeight: size.browse.chip - 8,
    paddingHorizontal: 10,
    borderRadius: radius.filterButton - 3,
  },
  month: { paddingTop: space.home.sectionTop, paddingBottom: space.browse.searchGap },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.home.tileBody,
    paddingHorizontal: space.screenX,
    paddingVertical: space.home.tileBody,
    borderBottomWidth: offerBorder.rule,
    borderBottomColor: color.divider,
  },
  pair: { flexDirection: "row", flexShrink: 0 },
  pairBack: { marginLeft: -OVERLAP },
  mini: {
    width: MINI + 4,
    height: MINI + 4,
    padding: 2,
    borderRadius: radius.matchesThumb,
    backgroundColor: color.surface,
  },
  leafTile: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.greenWash,
    borderWidth: 2,
    borderColor: color.surface,
  },
  body: { flex: 1, minWidth: 0, gap: 2 },
  greyChip: {
    flexShrink: 0,
    paddingHorizontal: space.chip.x,
    paddingVertical: space.chip.y - 2,
    borderRadius: radius.chip,
    backgroundColor: color.control,
  },
  rated: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 },
  ratePill: {
    flexShrink: 0,
    paddingHorizontal: space.chip.x + 2,
    paddingVertical: space.chip.y - 2,
    borderRadius: radius.heroCta,
    borderWidth: offerBorder.rule,
    borderColor: color.accentGold,
    backgroundColor: color.surface,
  },
});
