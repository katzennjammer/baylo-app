import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ApiError } from "../src/api/client";
import { useActiveTrades, useMeetupOptions, useProposeMeetup } from "../src/api/trades";
import type { SafeZoneHub } from "../src/api/types";
import { Splash } from "../src/components/Splash";
import { Tappable } from "../src/components/Tappable";
import { LeafIcon } from "../src/components/icons";
import { OfferBottomBar, OfferScreenHost } from "../src/components/offer/chrome";
import { firstName } from "../src/components/offer/copy";
import { InfoIcon } from "../src/components/post/post-icons";
import { CardLink } from "../src/components/trades/TradeCard";
import { Gutter, TradesBackTitle, TradesSectionLabel } from "../src/components/trades/chrome";
import * as copy from "../src/components/trades/copy";
import { TradesErrorPanel, TradesSkeleton } from "../src/components/trades/states";
import { NoticeRow, TradeButton } from "../src/components/trades/trade-ui";
import { shortDate } from "../src/lib/gap";
import { distanceKm, formatDistanceKm, useLastKnownLocation } from "../src/lib/hub-distance";
import { useTradeLiveness } from "../src/lib/trade-liveness";
import { border, color, radius, size, space, textStyle, type } from "../src/theme/tokens";
import { offerBorder } from "../src/theme/offer-tokens";

/**
 * The hub picker: "Where will you meet Aj?" (Round 2, 1 Oct 2026).
 *
 * Opened from the trade screen's hub step ("Choose a hub", "Suggest another",
 * "Change suggestion"). It does ONE thing — POST …/meetup — and goes back.
 * Agreeing to the other person's suggestion is on the trade screen.
 *
 * ══ UNCHANGED FROM THE SCREEN IT REPLACES ═══════════════════════════════════
 *
 *   - THE PLAN IS NOT THE CLAIM. Nothing here writes `safeZoneHubId`.
 *   - Nothing here issues codes.
 *   - Any active hub can be suggested; only a hub both listings name earns the
 *     safe hub reward at confirmation. The server's rule, not this screen's.
 *   - The standing plan seeds the form, so a counter changes one half, not both.
 *   - `meta.rule` failures: a closed hub is un-selected; an unknown one
 *     refetches the list.
 *
 * ══ WHAT CHANGED ════════════════════════════════════════════════════════════
 *
 *   - The paragraph about shared hubs is one notice row, shown only when the
 *     two listings share none, with the "Add a hub to my listing" route out.
 *   - Shared hubs first with a "Safe hub reward" chip; the rest by distance
 *     when the phone already knows where it is (passive — no prompt),
 *     alphabetical when it does not.
 *   - The other person's standing suggestion is marked on its row.
 *   - "When" is Today / Tomorrow / Pick a date, and a time chip.
 */
export default function TradeMeetupScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const active = useActiveTrades();
  const options = useMeetupOptions(id);
  const propose = useProposeMeetup(id);
  const location = useLastKnownLocation();

  const trade = (active.data?.trades ?? []).find((t) => t.id === id) ?? null;
  const plan = options.data ? options.data.plan : (trade?.meetup ?? null);
  const you = options.data?.you ?? (trade?.direction === "sent" ? "sender" : "receiver");
  const theirSuggestion = plan && !plan.agreedAt && plan.proposedBy !== you ? plan.hub.id : null;

  useTradeLiveness(
    useCallback(
      (o: { cancelRefetch: boolean }) => Promise.all([active.refetch(o), options.refetch(o)]),
      [active.refetch, options.refetch],
    ),
  );

  const [hubId, setHubId] = useState<string | null>(null);
  const [day, setDay] = useState<Date | null>(null);
  const [time, setTime] = useState<{ h: number; m: number } | null>(null);
  const [note, setNote] = useState("");
  const [picking, setPicking] = useState<"date" | "time" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  // Local choice wins; the standing plan fills in what was not touched.
  const planAt = plan ? new Date(plan.at) : null;
  const chosenHubId = hubId ?? plan?.hub.id ?? null;
  const chosenDay = day ?? (planAt ? startOfDay(planAt) : null);
  const chosenTime = time ?? (planAt ? { h: planAt.getHours(), m: planAt.getMinutes() } : null);
  const chosenWhen =
    chosenDay && chosenTime
      ? new Date(chosenDay.getFullYear(), chosenDay.getMonth(), chosenDay.getDate(), chosenTime.h, chosenTime.m)
      : null;

  const partner = firstName(trade?.counterparty.name ?? "them");

  const shared = useMemo(() => new Set(options.data?.sharedHubIds ?? []), [options.data]);
  const theirs = useMemo(() => new Set(options.data?.theirHubIds ?? []), [options.data]);
  const hubs = useMemo(() => {
    const all = options.data?.hubs ?? [];
    const km = (h: SafeZoneHub) => (location ? distanceKm(location.latitude, location.longitude, h) : 0);
    const rest = (a: SafeZoneHub, b: SafeZoneHub) =>
      location ? km(a) - km(b) : a.name.localeCompare(b.name);
    return [
      ...all.filter((h) => shared.has(h.id)).sort(rest),
      ...all.filter((h) => !shared.has(h.id)).sort(rest),
    ];
  }, [options.data, shared, location]);

  const apiError = active.error instanceof ApiError ? active.error : null;
  if (apiError?.code === "UNAUTHENTICATED") return <Splash waitingOn="Signing you back in" />;

  const title = copy.tradeScreen.hubStepTitle(partner);

  if (options.isPending || (!trade && active.isPending)) {
    return (
      <OfferScreenHost imeInset={0}>
        <TradesBackTitle title={title} onBack={() => router.back()} />
        <TradesSkeleton />
      </OfferScreenHost>
    );
  }
  if (!trade && !options.data) {
    return (
      <OfferScreenHost imeInset={0}>
        <TradesBackTitle title={title} onBack={() => router.back()} />
        {options.isError ? (
          <TradesErrorPanel onRetry={() => void Promise.all([active.refetch(), options.refetch()])} />
        ) : (
          <Gutter style={{ paddingTop: 18 }}>
            <Text style={[textStyle(type.detailBody), { color: color.inkSecondary }]}>
              That trade is not open any more.
            </Text>
          </Gutter>
        )}
      </OfferScreenHost>
    );
  }
  if (hubs.length === 0 && !options.isError) {
    return (
      <OfferScreenHost imeInset={0}>
        <TradesBackTitle title={title} onBack={() => router.back()} />
        <Gutter style={{ paddingTop: 18 }}>
          <Text style={[textStyle(type.detailBody), { color: color.inkSecondary }]}>
            {copy.meetup.noHubsAtAll}
          </Text>
        </Gutter>
      </OfferScreenHost>
    );
  }

  const onError = (e: unknown) => {
    if (e instanceof ApiError) {
      const rule = (e.meta as { rule?: string } | undefined)?.rule;
      setFailure(rule === "SAFEZONE_HUB_CLOSED" ? copy.meetup.hubClosed : e.message);
      if (rule) setHubId(null);
      if (rule === "SAFEZONE_HUB_INVALID") void options.refetch();
      return;
    }
    setFailure("That did not go through. Nothing has changed.");
  };

  const send = () => {
    if (!chosenHubId || !chosenWhen) return;
    setFailure(null);
    propose.mutate({ hubId: chosenHubId, at: chosenWhen, note }, { onSuccess: () => router.back(), onError });
  };

  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const isToday = !!chosenDay && chosenDay.getTime() === today.getTime();
  const isTomorrow = !!chosenDay && chosenDay.getTime() === tomorrow.getTime();
  const otherDay = !!chosenDay && !isToday && !isTomorrow;

  const onPicked = (e: DateTimePickerEvent, picked?: Date) => {
    const mode = picking;
    setPicking(null);
    if (e.type === "dismissed" || !picked) return;
    setFailure(null);
    if (mode === "date") setDay(startOfDay(picked));
    else setTime({ h: picked.getHours(), m: picked.getMinutes() });
  };

  return (
    <OfferScreenHost imeInset={0} dimmed={propose.isPending}>
      <TradesBackTitle title={title} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {options.isError ? <TradesErrorPanel onRetry={() => void options.refetch()} /> : null}

        {shared.size === 0 ? (
          <Gutter style={{ paddingTop: space.home.tileBody }}>
            <NoticeRow
              icon={<InfoIcon size={16} stroke={1.7} color={color.inkSecondary} />}
              link={
                <CardLink
                  label={copy.picker.addHub}
                  onPress={() =>
                    router.push({
                      pathname: "/edit-hubs",
                      params: { itemId: options.data?.yourItemId ?? "", suggest: [...theirs].join(",") },
                    })
                  }
                />
              }
            >
              {copy.picker.noShared}
            </NoticeRow>
          </Gutter>
        ) : null}

        <Gutter style={s.rows}>
          {hubs.map((hub) => (
            <HubRow
              key={hub.id}
              hub={hub}
              selected={hub.id === chosenHubId}
              reward={shared.has(hub.id)}
              suggestedBy={hub.id === theirSuggestion ? partner : null}
              km={location ? distanceKm(location.latitude, location.longitude, hub) : null}
              onPress={() => {
                setFailure(null);
                setHubId(hub.id);
              }}
            />
          ))}
        </Gutter>

        <Gutter style={{ paddingTop: space.home.sectionTop, gap: space.home.tileBody }}>
          <TradesSectionLabel>{copy.picker.when}</TradesSectionLabel>
          <View style={s.chips} accessibilityRole="radiogroup">
            <Chip label={copy.picker.today} on={isToday} onPress={() => setDay(today)} />
            <Chip label={copy.picker.tomorrow} on={isTomorrow} onPress={() => setDay(tomorrow)} />
            <Chip
              label={otherDay ? shortDate(chosenDay!) : copy.picker.pickDate}
              on={otherDay}
              onPress={() => setPicking("date")}
            />
          </View>
          <View style={s.chips}>
            <Chip
              label={chosenTime ? clock(chosenTime) : copy.picker.pickTime}
              on={!!chosenTime}
              onPress={() => setPicking("time")}
            />
          </View>
        </Gutter>

        {picking ? (
          <DateTimePicker
            value={
              picking === "date"
                ? (chosenDay ?? tomorrow)
                : chosenWhen ?? new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0)
            }
            mode={picking}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            minimumDate={picking === "date" ? today : undefined}
            onChange={onPicked}
          />
        ) : null}

        <Gutter style={{ paddingTop: space.home.sectionTop, gap: space.browse.searchGap }}>
          <TradesSectionLabel>{copy.meetup.noteLabel}</TradesSectionLabel>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={200}
            placeholder={copy.meetup.notePlaceholder}
            placeholderTextColor={color.inkMuted}
            textAlignVertical="top"
            style={[textStyle(type.detailBody), s.note]}
            cursorColor={color.forest}
            selectionColor={color.green}
            accessibilityLabel={copy.meetup.noteLabel}
          />
        </Gutter>
      </ScrollView>

      <OfferBottomBar
        above={
          failure ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[textStyle(type.detailBody), { color: color.urgent, marginBottom: space.browse.searchGap }]}
            >
              {failure}
            </Text>
          ) : undefined
        }
      >
        <TradeButton
          label={copy.picker.submit(partner)}
          onPress={send}
          disabled={!chosenHubId || !chosenWhen || propose.isPending}
          accessibilityHint={!chosenHubId || !chosenWhen ? copy.picker.needBoth : undefined}
        />
      </OfferBottomBar>
    </OfferScreenHost>
  );
}

/* ─────────────────────────────── pieces ─────────────────────────────── */

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function clock(t: { h: number; m: number }): string {
  return `${String(t.h).padStart(2, "0")}:${String(t.m).padStart(2, "0")}`;
}

/**
 * One hub: name, then "Type · Area · 1.2 km". Selected is a 1.5 forest rule
 * and a filled radio — nothing else moves, so the list does not jump.
 */
function HubRow({
  hub,
  selected,
  reward,
  suggestedBy,
  km,
  onPress,
}: {
  hub: SafeZoneHub;
  selected: boolean;
  reward: boolean;
  suggestedBy: string | null;
  km: number | null;
  onPress: () => void;
}) {
  const meta = [hub.typeLabel, hub.city, km !== null ? formatDistanceKm(km) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={[
        hub.name,
        meta,
        reward ? copy.picker.rewardChip : null,
        suggestedBy ? copy.picker.suggestedChip(suggestedBy) : null,
      ]
        .filter(Boolean)
        .join(", ")}
      style={[
        s.row,
        selected
          ? { borderWidth: offerBorder.selected, borderColor: color.forest }
          : { borderWidth: offerBorder.rule, borderColor: color.controlLine },
      ]}
      pressedStyle={{ backgroundColor: color.inset }}
    >
      <View style={[s.radio, selected ? s.radioOn : null]}>
        {selected ? <View style={s.radioDot} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[textStyle(type.username), { color: color.ink }]} numberOfLines={2}>
          {hub.name}
        </Text>
        <Text style={[textStyle(type.metadata), { color: color.inkSecondary }]} numberOfLines={2}>
          {meta}
        </Text>
        {reward || suggestedBy ? (
          <View style={s.rowChips}>
            {reward ? (
              <View style={[s.smallChip, { backgroundColor: color.greenWash }]}>
                <LeafIcon size={12} stroke={1.8} color={color.forest} />
                <Text
                  style={[textStyle(type.chip), { color: color.forest }]}
                  maxFontSizeMultiplier={size.home.headingMaxFontScale}
                >
                  {copy.picker.rewardChip}
                </Text>
              </View>
            ) : null}
            {suggestedBy ? (
              <View style={[s.smallChip, { backgroundColor: color.control }]}>
                <Text
                  style={[textStyle(type.chip), { color: color.inkSecondary }]}
                  maxFontSizeMultiplier={size.home.headingMaxFontScale}
                >
                  {copy.picker.suggestedChip(suggestedBy)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Tappable>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      style={[
        s.chip,
        on
          ? { borderWidth: offerBorder.selected, borderColor: color.forest, backgroundColor: color.greenWash }
          : { borderWidth: border.chip, borderColor: color.controlLine, backgroundColor: color.surface },
      ]}
      pressedStyle={{ opacity: 0.75 }}
    >
      <Text
        style={[textStyle(type.trendingChip), { color: on ? color.forest : color.ink }]}
        maxFontSizeMultiplier={size.home.headingMaxFontScale}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Tappable>
  );
}

const RADIO = 20;

const s = StyleSheet.create({
  rows: { paddingTop: space.home.tileBody, gap: space.browse.searchGap },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.home.tileBody,
    padding: space.home.tileBody,
    borderRadius: radius.hubRow,
    backgroundColor: color.surface,
  },
  radio: {
    width: RADIO,
    height: RADIO,
    borderRadius: RADIO / 2,
    borderWidth: 1.5,
    borderColor: color.controlLineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: color.forest },
  radioDot: { width: RADIO / 2, height: RADIO / 2, borderRadius: RADIO / 4, backgroundColor: color.forest },
  rowChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  smallChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.chip.x,
    paddingVertical: space.chip.y - 3,
    borderRadius: radius.chip,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.browse.searchGap },
  chip: {
    minHeight: size.browse.chip,
    paddingHorizontal: size.browse.chipX,
    borderRadius: radius.trendingChip,
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    color: color.ink,
    minHeight: 72,
    padding: space.home.tileBody,
    borderRadius: radius.hubRow,
    borderWidth: offerBorder.rule,
    borderColor: color.controlLine,
  },
});
