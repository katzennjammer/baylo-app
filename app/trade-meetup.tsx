import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, ScrollView, Text, TextInput, View } from "react-native";

import { ApiError } from "../src/api/client";
import {
  meetupState,
  useAcceptMeetup,
  useActiveTrades,
  useMeetupOptions,
  useProposeMeetup,
} from "../src/api/trades";
import type { SafeZoneHub } from "../src/api/types";
import { Splash } from "../src/components/Splash";
import { Tappable } from "../src/components/Tappable";
import {
  Hairline,
  OfferScreenHost,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
} from "../src/components/offer/chrome";
import { firstName } from "../src/components/offer/copy";
import { Gutter, TradesBackTitle } from "../src/components/trades/chrome";
import * as copy from "../src/components/trades/copy";
import { TradesErrorPanel, TradesSkeleton } from "../src/components/trades/states";
import { meetupWhen } from "../src/lib/gap";
import { offerColor, offerSpace, offerType, textStyle } from "../src/theme/offer-tokens";

/**
 * Arranging where and when — gap 6, and the screen that closes it.
 *
 * ══ WHAT WAS MISSING ════════════════════════════════════════════════════════
 *
 * Between accepting a trade and meeting for it there was nothing at all. The hub
 * was claimed at confirm/submit — AFTER the meeting — so two people who had just
 * agreed to swap had no way in the app to settle where or when, and Messages is
 * still a placeholder, so there was no fallback either. They accepted, and then
 * the app had no further opinion until they were somehow standing together.
 *
 * ══ THE PLAN IS NOT THE CLAIM ═══════════════════════════════════════════════
 *
 * Nothing on this screen writes `safeZoneHubId`. That column means "we met here",
 * it is what the 10-Leaf Safe-Zone award reads, and writing a plan into it would
 * pay out the moment somebody SUGGESTED a place — for a meeting that had not
 * happened, on one person's say-so. The plan becomes the claim in exactly one
 * place, `confirm/submit`, after both codes match and only if both parties
 * agreed it. A suggestion is not evidence.
 *
 * ══ AND IT DOES NOT ISSUE CODES ═════════════════════════════════════════════
 *
 * Agreeing here does not start a confirmation. Codes live 15 minutes, so a pair
 * minted when a meeting is agreed for Saturday would be dead days before either
 * of them could read one out — and the trade would sit in CONFIRMING having
 * confirmed nothing. Codes come from the code screen, which is the only thing
 * that has ever issued them.
 *
 * ══ THERE IS NO DECLINE, AND THAT IS THE DESIGN ═════════════════════════════
 *
 * `Suggest another` is the disagreement. A bare decline empties the table and
 * puts both people back where they started with nothing to react to; countering
 * always leaves something on it. The server treats a counter as a new proposal,
 * which clears the agreement and hands the question to the other side.
 *
 * ══ ANY OPEN HUB CAN BE PROPOSED; ONLY A SHARED ONE PAYS ════════════════════
 *
 * The list is every active hub, not the intersection of the two listings'
 * hubs. A listing's hubs are the owner saying "I will meet at any of these",
 * not the only places they will ever go — and requiring a match left two people
 * who had each named five different public places with nowhere to meet. So the
 * shared hubs sort first, marked as ones you both already offer, and anything
 * else is allowed but flagged as new to the other person, who agrees or
 * counters. The claim rule is unchanged: at confirmation only a hub both
 * listings named becomes the claim, so a meeting elsewhere earns no Leaves. That
 * is said once, above the rows, and the empty intersection keeps its route out
 * — now as a notice over a working picker rather than in place of one.
 */
export default function TradeMeetupScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const active = useActiveTrades();
  const options = useMeetupOptions(id);
  const propose = useProposeMeetup(id);
  const accept = useAcceptMeetup(id);

  const trade = (active.data?.trades ?? []).find((t) => t.id === id) ?? null;
  const plan = trade?.meetup ?? null;
  const state = trade ? meetupState(trade) : "none";

  const [hubId, setHubId] = useState<string | null>(null);
  const [when, setWhen] = useState<Date | null>(null);
  const [note, setNote] = useState("");
  const [picking, setPicking] = useState<"date" | "time" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /*
   * ── THE STANDING PLAN SEEDS THE FORM, BUT ONLY AS A STARTING POINT ────────
   *
   * Somebody countering is nearly always changing ONE of the two — the place or
   * the time — and making them re-enter the half they agree with is how a
   * counter-proposal turns into a typo. Seeded from the plan, overridden the
   * moment they touch either control, which is what the `??` chain is doing:
   * local state wins, the plan fills in, and neither is copied into the other.
   */
  const chosenHubId = hubId ?? plan?.hub.id ?? null;
  const chosenWhen = when ?? (plan ? new Date(plan.at) : null);

  const partner = firstName(trade?.counterparty.name ?? "them");

  /*
   * Shared first, then the ones the other listing names (not new to them),
   * then everything else — each group alphabetical, which is the server's
   * order and is preserved by a stable sort. Computed once per payload rather
   * than on every keystroke in the note field.
   */
  const shared = useMemo(() => new Set(options.data?.sharedHubIds ?? []), [options.data]);
  const theirs = useMemo(() => new Set(options.data?.theirHubIds ?? []), [options.data]);
  const hubs = useMemo(() => {
    const rank = (h: SafeZoneHub) => (shared.has(h.id) ? 0 : theirs.has(h.id) ? 1 : 2);
    return [...(options.data?.hubs ?? [])].sort((a, b) => rank(a) - rank(b));
  }, [options.data, shared, theirs]);
  const noneShared = shared.size === 0;

  const apiError = active.error instanceof ApiError ? active.error : null;
  if (apiError?.code === "UNAUTHENTICATED") return <Splash waitingOn="Signing you back in" />;

  if (!trade || options.isPending) {
    return (
      <OfferScreenHost imeInset={0}>
        <TradesBackTitle title={copy.meetup.setIt} onBack={() => router.back()} />
        {!trade && !active.isPending ? (
          <Gutter style={{ paddingTop: 18 }}>
            <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
              That trade is not open any more.
            </Text>
          </Gutter>
        ) : (
          <TradesSkeleton />
        )}
      </OfferScreenHost>
    );
  }

  const busy = propose.isPending || accept.isPending;

  const onError = (e: unknown) => {
    if (e instanceof ApiError) {
      // The server puts the branchable reason in `meta.rule` — /api/v1's error
      // codes are a closed set by design. A closed hub wants "pick another";
      // an unknown one means this list is stale and wants a fresh one.
      const rule = (e.meta as { rule?: string } | undefined)?.rule;
      setFailure(rule === "SAFEZONE_HUB_CLOSED" ? copy.meetup.hubClosed : e.message);
      // A hub that is no longer proposable should stop being selected, so the
      // next tap is not the same rejected request.
      if (rule) setHubId(null);
      if (rule === "SAFEZONE_HUB_INVALID") void options.refetch();
      return;
    }
    setFailure("That did not go through. Nothing has changed.");
  };

  const send = () => {
    if (!chosenHubId || !chosenWhen) return;
    setFailure(null);
    propose.mutate(
      { hubId: chosenHubId, at: chosenWhen, note },
      { onSuccess: () => router.back(), onError },
    );
  };

  const agree = () => {
    if (!plan) return;
    setFailure(null);
    // The echo is what protects against a counter landing between this screen
    // rendering and the tap. See `useAcceptMeetup`.
    accept.mutate(
      { confirmHubId: plan.hub.id, confirmAt: plan.at },
      { onSuccess: () => router.back(), onError },
    );
  };

  /* ── Nothing to pick from at all — not "nothing shared", nothing. ───────── */
  if (hubs.length === 0 && !options.isError) {
    return (
      <OfferScreenHost imeInset={0}>
        <TradesBackTitle title={copy.meetup.setIt} onBack={() => router.back()} />
        <Gutter style={{ paddingTop: 18 }}>
          <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
            {copy.meetup.noHubsAtAll}
          </Text>
        </Gutter>
      </OfferScreenHost>
    );
  }

  const canSend = !!chosenHubId && !!chosenWhen;

  return (
    <OfferScreenHost imeInset={0} dimmed={busy}>
      <TradesBackTitle title={copy.meetup.setIt} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        {options.isError ? <TradesErrorPanel onRetry={() => void options.refetch()} /> : null}

        {failure ? (
          <Gutter style={{ paddingTop: 12 }}>
            <Text style={[textStyle(offerType.body), { color: offerColor.warm }]}>
              {failure}
            </Text>
          </Gutter>
        ) : null}

        {/* ── What is on the table, when something is. ─────────────────────── */}
        {plan ? (
          <>
            <View style={{ height: 14 }} />
            <Gutter style={{ gap: 4 }}>
              <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}>
                {state === "agreed"
                  ? copy.meetup.agreed
                  : state === "yours-to-answer"
                    ? copy.meetup.theyProposed(partner)
                    : copy.meetup.waitingOnThem(partner)}
              </Text>
              <Text style={[textStyle(offerType.itemTitleRow), { color: offerColor.ink }]}>
                {copy.meetup.where(plan.hub.name, meetupWhen(new Date(plan.at)))}
              </Text>
              <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
                {plan.hub.landmark}
              </Text>
              {plan.note ? (
                <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
                  {plan.note}
                </Text>
              ) : null}
            </Gutter>

            {/* The one filled control is `Agree`, and only when agreeing is
                this viewer's to do. Somebody looking at their own standing
                proposal gets no primary action — there is nothing for them to
                do but wait or change it. */}
            {state === "yours-to-answer" ? (
              <Gutter style={{ paddingTop: 14 }}>
                <PrimaryButton
                  label={copy.meetup.agree}
                  onPress={agree}
                  accessibilityLabel={`Agree to meet at ${plan.hub.name}`}
                />
              </Gutter>
            ) : null}

            <View style={{ height: 18 }} />
            <Hairline />
            <View style={{ height: 6 }} />
            <SectionLabel>{copy.meetup.suggestAnother}</SectionLabel>
          </>
        ) : null}

        {/* ── The empty intersection: a notice with a route out, NOT a wall.
            The picker below still works; this says why the reward is off the
            table and which one tap fixes it. ────────────────────────────── */}
        {noneShared ? (
          <>
            <View style={{ height: 14 }} />
            <Gutter style={{ gap: 6 }}>
              <Text style={[textStyle(offerType.itemTitleRow), { color: offerColor.ink }]}>
                {copy.meetup.noSharedTitle}
              </Text>
              <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
                {theirs.size > 0
                  ? copy.meetup.noSharedBody(partner)
                  : copy.meetup.neitherHasHubs(partner)}
              </Text>
            </Gutter>
            <Gutter style={{ paddingTop: 12 }}>
              <SecondaryButton
                label={copy.meetup.addToMine}
                // Straight to the hub editor for the viewer's own listing, with
                // the other side's hubs passed as the suggestion — adding one
                // of those is what makes the intersection non-empty.
                onPress={() =>
                  router.push({
                    pathname: "/edit-hubs",
                    params: {
                      itemId: options.data?.yourItemId ?? "",
                      suggest: [...theirs].join(","),
                    },
                  })
                }
              />
            </Gutter>
            <View style={{ height: 6 }} />
          </>
        ) : null}

        {/* ── Where ───────────────────────────────────────────────────────── */}
        <View style={{ height: 12 }} />
        <SectionLabel>{copy.meetup.pickHub}</SectionLabel>
        {shared.size < hubs.length ? (
          <Gutter style={{ paddingBottom: 8 }}>
            <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}>
              {copy.meetup.sharedEarns}
            </Text>
          </Gutter>
        ) : null}
        <Hairline />
        {hubs.map((hub) => (
          <View key={hub.id}>
            <HubRow
              hub={hub}
              selected={hub.id === chosenHubId}
              badge={
                shared.has(hub.id)
                  ? copy.meetup.bothNamed
                  : theirs.has(hub.id)
                    ? copy.meetup.theyOffer(partner)
                    : copy.meetup.newToThem(partner)
              }
              // The shared badge is the reassuring one and is worth its line on
              // every row. The other two are context for a choice, so they
              // appear on the chosen row only — the list stays scannable.
              badgeAlways={shared.has(hub.id)}
              onPress={() => {
                setFailure(null);
                setHubId(hub.id);
              }}
            />
            <Hairline />
          </View>
        ))}

        {/* ── When ────────────────────────────────────────────────────────── */}
        <View style={{ height: 18 }} />
        <SectionLabel>{copy.meetup.pickTime}</SectionLabel>
        <Gutter style={{ paddingTop: 8, flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <SecondaryButton
              label={chosenWhen ? meetupWhen(chosenWhen) : "Pick a day and time"}
              onPress={() => setPicking("date")}
            />
          </View>
        </Gutter>

        {/*
          TWO STEPS ON ANDROID, ONE CONTROL ON iOS — the platform's own idiom,
          not a shared lowest common denominator. Android's picker is a modal
          that does one of date or time, so the date dismisses into the time;
          iOS shows a single inline spinner that does both.

          `minimumDate` is now: the server refuses a past time with 15 minutes of
          slack, and a picker that lets somebody scroll to last Tuesday and then
          rejects it has wasted the one interaction that could have prevented it.
        */}
        {picking ? (
          <DateTimePicker
            value={chosenWhen ?? defaultWhen()}
            mode={Platform.OS === "ios" ? "datetime" : picking}
            minimumDate={new Date()}
            onChange={(e: DateTimePickerEvent, picked?: Date) => {
              if (e.type === "dismissed" || !picked) {
                setPicking(null);
                return;
              }
              setFailure(null);
              if (Platform.OS === "android" && picking === "date") {
                // Carry the chosen day forward and ask for the time on top of
                // it, keeping whatever hour was already selected.
                const base = chosenWhen ?? defaultWhen();
                const merged = new Date(picked);
                merged.setHours(base.getHours(), base.getMinutes(), 0, 0);
                setWhen(merged);
                setPicking("time");
                return;
              }
              setWhen(picked);
              setPicking(null);
            }}
          />
        ) : null}

        {/* ── The note ────────────────────────────────────────────────────── */}
        <View style={{ height: 18 }} />
        <SectionLabel>{copy.meetup.noteLabel}</SectionLabel>
        <Gutter style={{ paddingTop: 8 }}>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            // The column is VARCHAR(200) and the route's schema caps at 200, so
            // the field stops rather than being refused after the fact.
            maxLength={200}
            placeholder={copy.meetup.notePlaceholder}
            placeholderTextColor={offerColor.inkTertiary}
            textAlignVertical="top"
            style={[
              textStyle(offerType.body),
              { color: offerColor.ink, minHeight: 56, padding: 0 },
            ]}
            cursorColor={offerColor.green}
            selectionColor={offerColor.green}
            accessibilityLabel={copy.meetup.noteLabel}
          />
        </Gutter>

        <Gutter style={{ paddingTop: 20 }}>
          <PrimaryButton
            label={plan ? copy.meetup.counter : copy.meetup.propose}
            onPress={send}
            disabled={!canSend}
            disabledHint="Pick a hub and a time first"
          />
        </Gutter>
      </ScrollView>
    </OfferScreenHost>
  );
}

/**
 * A sensible first offer for the picker: tomorrow at 14:00.
 *
 * NOT `new Date()`. Opening on this instant means the first value the spinner
 * shows is already in the past by the time somebody has read the screen, and on
 * Android that value is one confirm away from being submitted. An afternoon
 * tomorrow is a plausible swap slot and is never rejected by the server's
 * past-time check.
 */
function defaultWhen(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(14, 0, 0, 0);
  return d;
}

/**
 * One hub in the picker.
 *
 * Three kinds of row now, told apart by `badge`: both listings name it (the
 * one that earns the reward), only the other listing names it, or neither —
 * the last being the one the other person will see for the first time. The
 * shared badge is always drawn; the other two only on the selected row, so
 * that a list of twenty hubs is not twenty lines of caveat.
 */
function HubRow({
  hub,
  selected,
  badge,
  badgeAlways,
  onPress,
}: {
  hub: SafeZoneHub;
  selected: boolean;
  badge: string;
  badgeAlways: boolean;
  onPress: () => void;
}) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${hub.name}, ${hub.city}`}
      style={{
        paddingHorizontal: offerSpace.screenX,
        paddingVertical: 12,
        backgroundColor: selected ? offerColor.tintGreen : undefined,
      }}
      pressedStyle={{ opacity: 0.85 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            borderWidth: selected ? 6 : 1.5,
            borderColor: selected ? offerColor.green : offerColor.hairline,
          }}
        />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={[textStyle(offerType.body), { color: offerColor.ink }]} numberOfLines={1}>
            {hub.name}
          </Text>
          <Text
            style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}
            numberOfLines={1}
          >
            {hub.landmark}
          </Text>
          {selected || badgeAlways ? (
            <Text
              style={[
                textStyle(offerType.footnoteMono),
                { color: badgeAlways ? offerColor.green : offerColor.inkTertiary },
              ]}
            >
              {badge}
            </Text>
          ) : null}
        </View>
      </View>
    </Tappable>
  );
}
