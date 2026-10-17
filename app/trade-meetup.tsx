import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ApiError } from "../src/api/client";
import {
  planConflictOf,
  replacesOf,
  useActiveTrades,
  useMeetupOptions,
  useProposeMeetup,
} from "../src/api/trades";
import type { MeetupPlan, SafeZoneHub } from "../src/api/types";
import { Splash } from "../src/components/Splash";
import { Tappable } from "../src/components/Tappable";
import { ChevronRightIcon, PinIcon } from "../src/components/icons";
import { OfferBottomBar, OfferScreenHost } from "../src/components/offer/chrome";
import { firstName } from "../src/components/offer/copy";
import { CalendarIcon } from "../src/components/offer/icons";
import { ClockIcon } from "../src/components/post/post-icons";
import {
  HubPickerSheet,
  RewardChip,
  SafeHubRewardSheet,
  SuggestedChip,
  hubMeta,
} from "../src/components/trades/MeetupSheets";
import { SuggestionCard } from "../src/components/trades/TradePanels";
import { Gutter, TradesBackTitle } from "../src/components/trades/chrome";
import * as copy from "../src/components/trades/copy";
import { TradesErrorPanel, TradesSkeleton } from "../src/components/trades/states";
import { StepHeading, TradeButton } from "../src/components/trades/trade-ui";
import { meetupWhen, shortDate } from "../src/lib/gap";
import { distanceKm, useLastKnownLocation } from "../src/lib/hub-distance";
import {
  MEETUP_MAX_DAYS_AHEAD,
  addDays,
  clock,
  combine,
  fullWhen,
  meetupGap,
  pickerStartTime,
  startOfDay,
  type ClockTime,
  type MeetupGap,
} from "../src/lib/meetup-when";
import { useTradeLiveness } from "../src/lib/trade-liveness";
import { border, color, radius, size, space, textStyle, type } from "../src/theme/tokens";
import { offerBorder } from "../src/theme/offer-tokens";

/**
 * The hub picker: "Plan your meetup with Aj" (three-step layout, Oct 2026).
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
 *   - The payload is {hubId, at, note, replaces}, built exactly as before.
 *
 * ══ WHAT CHANGED (Oct 2026) ═════════════════════════════════════════════════
 *
 *   - Three numbered steps — Where, When, Note — each ticked once done, so all
 *     of it fits on one screen. Where is ONE card showing the chosen hub; the
 *     list moved into a searchable sheet (MeetupSheets.tsx), the partner's
 *     suggestion and the shared hubs pinned first, the rest by city.
 *   - The time is a full-width row, not a chip.
 *   - The button says what is missing instead of greying out silently, and a
 *     plain-words summary sits above it once everything is chosen.
 *   - A time earlier than now, or a day past the server's 90-day limit, is
 *     refused HERE, before a round trip. The server's checks stay the backstop
 *     (it allows 15 minutes of slack in the past; this screen allows none).
 *   - "Safe hub reward" opens a sheet that explains it.
 *
 * ══ A PICK OVER SOMEBODY ELSE'S PLAN IS A COUNTER, AND SAYS SO ══════════════
 *
 * Since 8 Oct 2026 the server refuses a fresh pick while the partner's
 * suggestion stands, and takes a counter only when it names the plan it
 * replaces. `basis` is that plan: the one standing when this screen first
 * read fresh data, not whatever a later refetch brought in, so a suggestion
 * that lands while somebody is picking is SHOWN to them (a 409) rather than
 * silently countered. On MEETUP_PENDING_FROM_PARTNER the screen swaps to the
 * partner's suggestion with Agree / Suggest another; "Suggest another" makes
 * that suggestion the basis and keeps every choice already made here.
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
  const [time, setTime] = useState<ClockTime | null>(null);
  const [note, setNote] = useState("");
  const [picking, setPicking] = useState<"date" | "time" | null>(null);
  const [sheet, setSheet] = useState<"hubs" | null>(null);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  /** The plan a send counters. `undefined` until fresh data has arrived. */
  const [basis, setBasis] = useState<MeetupPlan | null | undefined>(undefined);
  /** The partner's suggestion a 409 handed back, while it is on screen. */
  const [conflictPlan, setConflictPlan] = useState<MeetupPlan | null>(null);

  // Fresh, not cached: staleTime 0 refetches on mount, and the cached copy
  // shown meanwhile is exactly the one that may predate the partner's pick.
  useEffect(() => {
    if (basis === undefined && options.isFetchedAfterMount && options.data) setBasis(options.data.plan);
  }, [basis, options.isFetchedAfterMount, options.data]);

  // Local choice wins; the standing plan fills in what was not touched.
  const planAt = plan ? new Date(plan.at) : null;
  const chosenHubId = hubId ?? plan?.hub.id ?? null;
  const chosenDay = day ?? (planAt ? startOfDay(planAt) : null);
  const chosenTime = time ?? (planAt ? { h: planAt.getHours(), m: planAt.getMinutes() } : null);
  const chosenWhen = chosenDay && chosenTime ? combine(chosenDay, chosenTime) : null;

  const partner = firstName(trade?.counterparty.name ?? "them");

  const shared = useMemo(() => new Set(options.data?.sharedHubIds ?? []), [options.data]);
  const theirs = useMemo(() => new Set(options.data?.theirHubIds ?? []), [options.data]);
  const hubs = options.data?.hubs ?? [];
  const kmTo = useMemo(
    () => (location ? (h: SafeZoneHub) => distanceKm(location.latitude, location.longitude, h) : null),
    [location],
  );
  const chosenHub = hubs.find((h) => h.id === chosenHubId) ?? null;

  const apiError = active.error instanceof ApiError ? active.error : null;
  if (apiError?.code === "UNAUTHENTICATED") return <Splash waitingOn="Signing you back in" />;

  const title = copy.picker.title(partner);

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
    const planConflict = planConflictOf(e);
    if (planConflict) {
      const standing = planConflict.plan;
      if (standing && !standing.agreedAt && standing.proposedBy !== you) {
        setFailure(null);
        setConflictPlan(standing);
        return;
      }
      // Agreed, or the viewer's own (another device), or gone: say so, and
      // make the next send name what is really standing.
      setBasis(standing);
      setFailure(
        standing?.agreedAt
          ? copy.picker.alreadyAgreed(partner, copy.meetup.where(standing.hub.name, meetupWhen(new Date(standing.at))))
          : copy.picker.planChanged,
      );
      return;
    }
    if (e instanceof ApiError) {
      const rule = (e.meta as { rule?: string } | undefined)?.rule;
      setFailure(rule === "SAFEZONE_HUB_CLOSED" ? copy.meetup.hubClosed : e.message);
      if (rule) setHubId(null);
      if (rule === "SAFEZONE_HUB_INVALID") void options.refetch();
      return;
    }
    setFailure("That did not go through. Nothing has changed.");
  };

  const gapNow = () => meetupGap({ hubId: chosenHub?.id ?? null, day: chosenDay, time: chosenTime, now: new Date() });

  const send = () => {
    // Checked again at the tap, not only at render: a screen left open can
    // cross the chosen time without re-rendering.
    const missing = gapNow();
    if (missing || !chosenHub || !chosenWhen) {
      if (missing) setFailure(gapLabel(missing));
      return;
    }
    setFailure(null);
    const standing = basis !== undefined ? basis : plan;
    // A fresh pick only over nothing, or over the viewer's own unanswered one.
    const counters = !!standing && (standing.proposedBy !== you || !!standing.agreedAt);
    propose.mutate(
      { hubId: chosenHub.id, at: chosenWhen, note, replaces: counters ? replacesOf(standing) : undefined },
      { onSuccess: () => router.back(), onError },
    );
  };

  if (conflictPlan && id) {
    return (
      <OfferScreenHost imeInset={0}>
        <TradesBackTitle title={title} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          <Gutter style={{ paddingTop: space.home.tileBody }}>
            <SuggestionCard
              tradeId={id}
              plan={conflictPlan}
              partner={partner}
              shared={shared.has(conflictPlan.hub.id)}
              notice={copy.picker.alreadySuggested(partner)}
              onAgreed={() => router.back()}
              onSuggestAnother={() => {
                setBasis(conflictPlan);
                setConflictPlan(null);
              }}
            />
          </Gutter>
        </ScrollView>
      </OfferScreenHost>
    );
  }

  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const isToday = !!chosenDay && chosenDay.getTime() === today.getTime();
  const isTomorrow = !!chosenDay && chosenDay.getTime() === tomorrow.getTime();
  const otherDay = !!chosenDay && !isToday && !isTomorrow;

  const gap = gapNow();
  const whenProblem = gap === "past" || gap === "tooFar" ? gapLabel(gap) : null;
  const whenDone = !!chosenDay && !!chosenTime && !whenProblem;

  const onPicked = (e: DateTimePickerEvent, picked?: Date) => {
    const mode = picking;
    setPicking(null);
    if (e.type === "dismissed" || !picked) return;
    setFailure(null);
    if (mode === "date") setDay(startOfDay(picked));
    else setTime({ h: picked.getHours(), m: picked.getMinutes() });
  };

  const pickDay = (d: Date) => {
    setFailure(null);
    setDay(d);
  };

  return (
    <OfferScreenHost imeInset={0} dimmed={propose.isPending}>
      <TradesBackTitle title={title} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {options.isError ? <TradesErrorPanel onRetry={() => void options.refetch()} /> : null}

        {/* ── 1 Where ── */}
        <Gutter style={{ paddingTop: space.home.tileBody, gap: space.home.tileBody }}>
          <StepHeading n={1} done={!!chosenHub}>
            {copy.picker.stepWhere}
          </StepHeading>
          <WhereCard
            hub={chosenHub}
            km={chosenHub && kmTo ? kmTo(chosenHub) : null}
            reward={!!chosenHub && shared.has(chosenHub.id)}
            suggestedBy={chosenHub && chosenHub.id === theirSuggestion ? partner : null}
            onPress={() => setSheet("hubs")}
            onReward={() => setRewardOpen(true)}
          />
        </Gutter>

        {/* ── 2 When ── */}
        <Gutter style={{ paddingTop: space.home.sectionTop, gap: space.home.tileBody }}>
          <StepHeading n={2} done={whenDone}>
            {copy.picker.stepWhen}
          </StepHeading>
          <View style={s.chips} accessibilityRole="radiogroup">
            <Chip label={copy.picker.today} on={isToday} onPress={() => pickDay(today)} />
            <Chip label={copy.picker.tomorrow} on={isTomorrow} onPress={() => pickDay(tomorrow)} />
            <Chip
              label={otherDay ? shortDate(chosenDay!) : copy.picker.pickDate}
              on={otherDay}
              icon={<CalendarIcon size={15} stroke={1.7} color={otherDay ? color.forest : color.ink} />}
              onPress={() => setPicking("date")}
            />
          </View>
          <TimeRow time={chosenTime} problem={!!whenProblem} onPress={() => setPicking("time")} />
          {whenProblem ? (
            <Text accessibilityLiveRegion="polite" style={[textStyle(type.metadata), { color: color.urgent }]}>
              {whenProblem}
            </Text>
          ) : null}
        </Gutter>

        {picking ? (
          <DateTimePicker
            value={picking === "date" ? (chosenDay ?? tomorrow) : (chosenWhen ?? pickerStartTime(chosenDay, now))}
            mode={picking}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            minimumDate={picking === "date" ? today : undefined}
            maximumDate={picking === "date" ? addDays(today, MEETUP_MAX_DAYS_AHEAD) : undefined}
            onChange={onPicked}
          />
        ) : null}

        {/* ── 3 Note ── */}
        <Gutter style={{ paddingTop: space.home.sectionTop, gap: space.home.tileBody }}>
          <StepHeading n={3} done={note.trim().length > 0}>
            {copy.picker.stepNote}
          </StepHeading>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={200}
            placeholder={copy.picker.notePlaceholder}
            placeholderTextColor={color.inkMuted}
            textAlignVertical="top"
            style={[textStyle(type.detailBody), s.note]}
            cursorColor={color.forest}
            selectionColor={color.green}
            accessibilityLabel={copy.picker.stepNote}
          />
        </Gutter>
      </ScrollView>

      <OfferBottomBar
        above={
          failure || (!gap && chosenHub && chosenWhen) ? (
            <View style={{ gap: 4, marginBottom: space.browse.searchGap }}>
              {failure ? (
                <Text accessibilityLiveRegion="polite" style={[textStyle(type.detailBody), { color: color.urgent }]}>
                  {failure}
                </Text>
              ) : null}
              {!gap && chosenHub && chosenWhen ? (
                <Text style={[textStyle(type.detailBody), { color: color.ink }]}>
                  {copy.picker.summary(fullWhen(chosenWhen), chosenHub.name)}
                </Text>
              ) : null}
            </View>
          ) : undefined
        }
      >
        <TradeButton
          label={gap ? gapLabel(gap) : copy.picker.submit(partner)}
          onPress={send}
          disabled={!!gap || propose.isPending}
          disabledInk={gap ? "readable" : "muted"}
        />
      </OfferBottomBar>

      {sheet === "hubs" ? (
        <HubPickerSheet
          hubs={hubs}
          shared={shared}
          suggestedId={theirSuggestion}
          partner={partner}
          selectedId={chosenHub?.id ?? null}
          kmTo={kmTo}
          showNoShared={shared.size === 0}
          onAddHub={() => {
            setSheet(null);
            router.push({
              pathname: "/edit-hubs",
              params: { itemId: options.data?.yourItemId ?? "", suggest: [...theirs].join(",") },
            });
          }}
          onPick={(picked) => {
            setFailure(null);
            setHubId(picked);
            setSheet(null);
          }}
          onReward={() => setRewardOpen(true)}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {rewardOpen ? <SafeHubRewardSheet onClose={() => setRewardOpen(false)} /> : null}
    </OfferScreenHost>
  );
}

/* ─────────────────────────────── pieces ─────────────────────────────── */

/** The button's words for what is still missing. */
function gapLabel(gap: MeetupGap): string {
  switch (gap) {
    case "hub":
      return copy.picker.needHub;
    case "day":
      return copy.picker.needDay;
    case "time":
      return copy.picker.needTime;
    case "past":
      return copy.picker.pastTime;
    case "tooFar":
      return copy.picker.tooFar(MEETUP_MAX_DAYS_AHEAD);
  }
}

/**
 * Step 1's one card: the chosen hub with "Tap to change", or "Choose a hub".
 * Either way the whole card opens the hub sheet.
 */
function WhereCard({
  hub,
  km,
  reward,
  suggestedBy,
  onPress,
  onReward,
}: {
  hub: SafeZoneHub | null;
  km: number | null;
  reward: boolean;
  suggestedBy: string | null;
  onPress: () => void;
  onReward: () => void;
}) {
  const meta = hub ? hubMeta(hub, km) : null;
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        hub ? `${hub.name}, ${meta}. ${copy.picker.tapToChange}` : `${copy.picker.chooseHub}. ${copy.picker.chooseHubHint}`
      }
      style={[s.card, hub ? s.cardChosen : null]}
      pressedStyle={{ backgroundColor: color.inset }}
    >
      <PinIcon size={22} stroke={1.7} color={hub ? color.forest : color.inkSecondary} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {hub ? (
          <>
            <Text style={[textStyle(type.username), { color: color.ink }]} numberOfLines={2}>
              {hub.name}
            </Text>
            <Text style={[textStyle(type.metadata), { color: color.inkSecondary }]} numberOfLines={2}>
              {meta}
            </Text>
            {reward || suggestedBy ? (
              <View style={s.rowChips}>
                {reward ? <RewardChip onPress={onReward} /> : null}
                {suggestedBy ? <SuggestedChip partner={suggestedBy} /> : null}
              </View>
            ) : null}
            <Text style={[textStyle(type.metadata), { color: color.forest, marginTop: 4 }]}>
              {copy.picker.tapToChange}
            </Text>
          </>
        ) : (
          <>
            <Text style={[textStyle(type.username), { color: color.ink }]}>{copy.picker.chooseHub}</Text>
            <Text style={[textStyle(type.metadata), { color: color.inkSecondary }]}>
              {copy.picker.chooseHubHint}
            </Text>
          </>
        )}
      </View>
      <ChevronRightIcon size={18} stroke={1.7} color={color.inkSecondary} />
    </Tappable>
  );
}

/** Step 2's time: a full-width row that opens the native time picker. */
function TimeRow({ time, problem, onPress }: { time: ClockTime | null; problem: boolean; onPress: () => void }) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={time ? `Time, ${clock(time)}. ${copy.picker.changeTime}` : copy.picker.chooseTime}
      style={[
        s.timeRow,
        problem
          ? { borderWidth: offerBorder.selected, borderColor: color.urgent }
          : time
            ? { borderWidth: offerBorder.selected, borderColor: color.forest }
            : { borderWidth: offerBorder.rule, borderColor: color.controlLine },
      ]}
      pressedStyle={{ backgroundColor: color.inset }}
    >
      <ClockIcon size={18} stroke={1.7} color={time ? color.forest : color.inkSecondary} />
      <Text
        style={[textStyle(type.username), { color: time ? color.ink : color.inkSecondary, flex: 1 }]}
        maxFontSizeMultiplier={size.home.headingMaxFontScale}
      >
        {time ? clock(time) : copy.picker.chooseTime}
      </Text>
      {time ? (
        <Text
          style={[textStyle(type.metadata), { color: color.forest }]}
          maxFontSizeMultiplier={size.home.headingMaxFontScale}
        >
          {copy.picker.changeTime}
        </Text>
      ) : null}
      <ChevronRightIcon size={18} stroke={1.7} color={color.inkSecondary} />
    </Tappable>
  );
}

function Chip({
  label,
  on,
  icon,
  onPress,
}: {
  label: string;
  on: boolean;
  icon?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      // The chip is 36 tall; the slop takes the target to 44.
      hitSlop={{ top: 4, bottom: 4 }}
      style={[
        s.chip,
        on
          ? { borderWidth: offerBorder.selected, borderColor: color.forest, backgroundColor: color.greenWash }
          : { borderWidth: border.chip, borderColor: color.controlLine, backgroundColor: color.surface },
      ]}
      pressedStyle={{ opacity: 0.75 }}
    >
      {icon ?? null}
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

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.home.tileBody,
    minHeight: size.control.primaryButton + 16,
    padding: space.home.tileBody,
    borderRadius: radius.hubRow,
    borderWidth: offerBorder.rule,
    borderColor: color.controlLine,
    backgroundColor: color.surface,
  },
  cardChosen: { borderWidth: offerBorder.selected, borderColor: color.forest },
  rowChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.browse.searchGap },
  chip: {
    flexDirection: "row",
    gap: 6,
    minHeight: size.browse.chip,
    paddingHorizontal: size.browse.chipX,
    borderRadius: radius.trendingChip,
    alignItems: "center",
    justifyContent: "center",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.browse.searchGap,
    minHeight: size.control.primaryButton,
    paddingHorizontal: space.home.tileBody,
    borderRadius: radius.hubRow,
    backgroundColor: color.surface,
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
