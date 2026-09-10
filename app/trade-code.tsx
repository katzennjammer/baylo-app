import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { ApiError } from "../src/api/client";
import {
  codeState,
  confirmSides,
  isCodeRejection,
  useActiveTrades,
  useConfirmStart,
  useConfirmStatus,
  useConfirmSubmit,
  useContracts,
  ownCode,
  type CodeRejection,
} from "../src/api/trades";
import type { ActiveTrade, V1Contract } from "../src/api/types";
import { useKeyboardState } from "../src/components/auth-sheet";
import { Splash } from "../src/components/Splash";
import {
  Hairline,
  NavDone,
  OfferBottomBar,
  OfferScreenHost,
  PrimaryButton,
  SecondaryButton,
  Section,
  TertiaryButton,
} from "../src/components/offer/chrome";
import { ArrowsIcon } from "../src/components/offer/icons";
import {
  Gutter,
  TradesBackTitle,
  TradesSectionLabel,
} from "../src/components/trades/chrome";
import {
  CodeCounter,
  CodeDisplay,
  CodeDisplayLine,
  CodeEntry,
  useCodeEntry,
} from "../src/components/trades/code";
import * as copy from "../src/components/trades/copy";
import * as present from "../src/components/trades/present";
import { PromiseRow, Thumb } from "../src/components/trades/rows";
import { TradesErrorPanel } from "../src/components/trades/states";
import { clockTime } from "../src/lib/format";
import {
  offerColor,
  offerIcon,
  offerSize,
  offerSpace,
  offerType,
  textStyle,
} from "../src/theme/offer-tokens";

/**
 * §6.1 — the confirmation code. All four states, and the one that matters most.
 *
 * ══ SOMEBODY IS STANDING IN A CAR PARK ══════════════════════════════════════
 *
 * Next to a stranger, about to hand over a jacket, holding a phone in one hand.
 * Three things have to be true:
 *
 *   THE CODE IS READABLE AT ARM'S LENGTH.  40px mono in its own cell, which is
 *      what §6.1 specifies and why — a 15px line of digits cannot be read across
 *      a table by somebody who did not bring their glasses to a mall.
 *   ENTRY IS SIMPLE.  One field, a number pad, no cell-hopping.
 *   WHOSE TURN IT IS, IS OBVIOUS.  The block you have to act on is on top. That
 *      is the entire layout rule of this screen and it is why the two blocks
 *      swap places between states rather than one of them changing colour.
 *
 * ══ THE FOUR STATES §6.1 NAMES ══════════════════════════════════════════════
 *
 *   Waiting for them        neither side has typed. Your code on top, entry
 *                           below, empty and unfocused — reading yours out comes
 *                           first.
 *   They're waiting for you they typed yours in. Entry goes to the top, your own
 *                           code drops to a single 15px line.
 *   You are done            you typed theirs in, they have not typed yours.
 *                           §10.7's `Marco hasn't typed yours in yet.`
 *   Both submitted          both blocks collapse to a hairline row with the
 *                           time. NO SUCCESS COLOUR, no confetti — §1.10.
 *
 * A fifth, which §6.1 treats as a modifier rather than a state: a wrong code.
 * The digits STAY IN THE CELLS — frame 9g's reasoning is that clearing them
 * makes the other person read all six out again — the rules go terracotta, the
 * mono counter says how many tries are left, and nothing shakes.
 *
 * ══ THE KEYBOARD ════════════════════════════════════════════════════════════
 *
 * `edgeToEdgeEnabled=true` in `android/gradle.properties`, so from API 35
 * `SOFT_INPUT_ADJUST_RESIZE` is a NO-OP: the window stays full-screen and the IME
 * arrives as an inset the app applies itself. `KeyboardAvoidingView` takes its
 * offset from `getWindowVisibleDisplayFrame()` — the frame that no longer shrinks
 * — so it computes ~0 and pads by nothing.
 *
 * `marginBottom: imeInset` on the root is the whole correction, and the inset
 * comes from `useKeyboardState()` in `auth-sheet.tsx`, which derives it from
 * `endCoordinates.height` — the number React Native still fills from
 * `WindowInsetsCompat.Type.ime()`. Auth hit this first, the post wizard and the
 * offer flow already reuse it, and this is the fourth caller rather than a fourth
 * copy of a subtle piece of platform arithmetic.
 *
 * §8.4's budget: a 358 IME on the 844 canvas leaves 486. The nav keeps its 44,
 * the instruction sits at 100, the cells at 140, and the viewer's own code drops
 * to one 15px line at 240. The trade summary and both footer controls drop out —
 * which is what `keyboardUp` gates below.
 */
export default function TradeCodeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const active = useActiveTrades();
  const contracts = useContracts();
  const { keyboardUp, imeHeight } = useKeyboardState();

  const trade = (active.data?.trades ?? []).find((t) => t.id === id) ?? null;

  const start = useConfirmStart(id);
  const status = useConfirmStatus(id);
  const submit = useConfirmSubmit(id);
  const entry = useCodeEntry();

  // The viewer's OWN code, off the same poll that decides whose turn it is.
  // Never the partner's — the server does not return it and this screen does not
  // ask. Still `string | null`: no key, a rotated key, an expired or burned code
  // all answer null, and §6.1's block names the email in every one of those.
  const myCode = ownCode(status.data);
  const [rejection, setRejection] = useState<CodeRejection | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Issue the codes on the way in, once.
   *
   * IDEMPOTENT WHILE BOTH ARE LIVE AND UNBURNED — `confirm/start` answers
   * `alreadyStarted` for two live rows and re-emails nobody. So arriving at this
   * screen is what puts a trade into CONFIRMING, and re-arriving costs nothing.
   *
   * `start.isIdle` rather than a ref: the mutation's own state is already the
   * "has this run" flag, and a second source for it is a second thing to keep in
   * step. A trade that is already CONFIRMING still calls it, because that is the
   * call that reissues a pair somebody burned.
   */
  useEffect(() => {
    if (!id || !trade) return;
    if (trade.status !== "ACCEPTED" && trade.status !== "CONFIRMING") return;
    if (!start.isIdle) return;
    start.mutate(undefined, {
      onError: (e) =>
        setFailure(
          e instanceof ApiError ? e.message : "Could not start the confirmation just now.",
        ),
    });
  }, [id, trade, start]);

  const apiError = active.error instanceof ApiError ? active.error : null;
  if (apiError?.code === "UNAUTHENTICATED") {
    return <Splash waitingOn="Signing you back in" />;
  }

  if (!trade) {
    return (
      <OfferScreenHost imeInset={0}>
        <TradesBackTitle title={copy.nav.trades} onBack={() => router.back()} />
        {active.isError ? (
          <TradesErrorPanel onRetry={() => void active.refetch()} />
        ) : active.isPending ? null : (
          <Gutter style={{ paddingTop: 18 }}>
            <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
              That trade is not open any more. It may already be in your finished trades.
            </Text>
          </Gutter>
        )}
      </OfferScreenHost>
    );
  }

  const partner = present.firstName(trade.counterparty.name);
  const sides = confirmSides(status.data, trade.direction);
  const state = codeState(sides);

  const send = () => {
    setRejection(null);
    setFailure(null);
    submit.mutate(
      {
        code: entry.value,
        // The hub the trade already names, re-asserted at confirmation. The
        // server validates it against BOTH listings' declared hubs BEFORE the
        // bcrypt compare, so a bad claim cannot burn one of the partner's
        // guesses. Null when no hub was named, which is most trades.
        safeZoneHubId: trade.safeZoneHub?.id ?? null,
      },
      {
        onError: (e) => {
          if (isCodeRejection(e)) {
            setRejection(e);
            // The digits stay. §6.1 and frame 9g: clearing them makes the other
            // person read all six out again for one transposed digit.
            return;
          }
          setFailure(
            e instanceof ApiError ? e.message : "Could not check that code just now.",
          );
        },
      },
    );
  };

  /* ═══════════════════ §6.1 "Both submitted" — frame 9h ══════════════════ */
  if (state === "matched") {
    return (
      <MatchedScreen
        trade={trade}
        partner={partner}
        matchedAt={clockTime(Date.parse(trade.updatedAt) || Date.now())}
        promise={
          (contracts.data?.contracts ?? []).find(
            (c) => c.tradeId === trade.id && (c.status === "ACTIVE" || c.status === "PENDING_ACCEPT"),
          ) ?? null
        }
        onBack={() => router.back()}
      />
    );
  }

  const burned = rejection?.locked === true;

  /* ═══════════ §8.4 — the keyboard-up arrangement, and nothing else ══════ */
  if (keyboardUp) {
    return (
      <OfferScreenHost imeInset={imeHeight}>
        <TradesBackTitle
          title={copy.nav.meeting(trade.counterparty.name)}
          onBack={() => router.back()}
          trailing={<NavDone onPress={() => entry.inputRef.current?.blur()} />}
        />

        <View style={{ paddingHorizontal: offerSpace.screenX + 4, flex: 1 }}>
          <View style={{ height: 12 }} />
          <Text style={[textStyle(offerType.body), { color: offerColor.ink }]}>
            {state === "they-wait-for-you"
              ? copy.code.theyTypedYours(partner)
              : copy.code.askFor(partner)}
          </Text>

          <View style={{ height: 18 }} />
          <CodeEntry
            entry={entry}
            rejected={!!rejection}
            onSubmit={entry.complete ? send : undefined}
            label={copy.code.askFor(partner)}
          />

          {rejection ? (
            <View style={{ marginTop: 12 }}>
              <CodeCounter remaining={rejection.remaining} />
            </View>
          ) : null}

          <View style={{ height: 16 }} />
          {/* §8.4: the viewer's own code drops to a single 15px line at y 240. */}
          <CodeDisplayLine code={myCode} />
        </View>
      </OfferScreenHost>
    );
  }

  /* ═══════════════ §6.1 at rest — the two blocks, in turn order ═════════ */
  const entryFirst = state === "they-wait-for-you";

  const displayBlock = (
    <Section pad={{ top: entryFirst ? 20 : 24, bottom: 20 }}>
      <View style={{ gap: 14 }}>
        <TradesSectionLabel>
          {state === "you-are-done" || rejection
            ? copy.code.yourCodeUnchanged
            : copy.code.showThis(partner)}
        </TradesSectionLabel>

        <CodeDisplay code={myCode} partner={partner} spent={sides.theySubmitted} />

        {/* §10.7's waiting line, on the state it belongs to. */}
        {state === "you-are-done" ? (
          <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
            {copy.code.notYetTyped(partner)}
          </Text>
        ) : null}
      </View>
    </Section>
  );

  const entryBlock = (
    <Section pad={{ top: 20, bottom: 20 }}>
      <View style={{ gap: 14 }}>
        <TradesSectionLabel>{copy.code.askFor(partner)}</TradesSectionLabel>

        {sides.iSubmitted ? (
          // Already typed theirs in correctly. The cells would be a control for
          // an act that is finished, so the block states the fact instead.
          <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
            {copy.code.notYetTyped(partner)}
          </Text>
        ) : (
          <>
            <CodeEntry
              entry={entry}
              rejected={!!rejection}
              onSubmit={entry.complete ? send : undefined}
              label={copy.code.askFor(partner)}
            />

            {rejection ? <CodeCounter remaining={rejection.remaining} /> : null}

            <Text
              style={[
                textStyle(rejection ? offerType.body : offerType.helper),
                { color: rejection ? offerColor.inkSecondary : offerColor.inkTertiary },
              ]}
            >
              {rejection ? copy.code.readItAgain(partner) : copy.code.typeBelowLong}
            </Text>
          </>
        )}
      </View>
    </Section>
  );

  return (
    <OfferScreenHost imeInset={0} dimmed={submit.isPending}>
      <TradesBackTitle
        title={copy.nav.meeting(trade.counterparty.name)}
        onBack={() => router.back()}
      />

      <ScrollView>
        {/* The trade itself, so nobody reads a code out for the wrong meeting. */}
        <TradeSummary trade={trade} />
        <Hairline />

        {entryFirst ? entryBlock : displayBlock}
        <Hairline />
        {entryFirst ? displayBlock : entryBlock}

        {failure ? (
          <Gutter style={{ paddingTop: 14 }}>
            <Text
              accessibilityLiveRegion="polite"
              style={[textStyle(offerType.errorText), { color: offerColor.warm }]}
            >
              {failure}
            </Text>
          </Gutter>
        ) : null}
      </ScrollView>

      {/*
        The bar. Two controls, and which pair depends on whether the code is
        burned.

        §6.1's "After 3, the cells clear and a 52px `Ask Marco to read it again`
        outline button appears. No lockout." The server's budget is five rather
        than three and its refusal is a 429 with `locked: true`, but the shape is
        the spec's: NO LOCKOUT — the control reissues a fresh pair through
        `confirm/start`, which is exactly what "the code simply gets read again"
        means. So the burned state clears the cells and swaps the primary.
      */}
      <OfferBottomBar>
        {burned ? (
          <SecondaryButton
            label={copy.code.readItAgainButton(partner)}
            onPress={() => {
              entry.clear();
              setRejection(null);
              start.mutate(undefined, {
                onError: (e) =>
                  setFailure(
                    e instanceof ApiError ? e.message : "Could not issue new codes just now.",
                  ),
              });
            }}
          />
        ) : sides.iSubmitted ? (
          <SecondaryButton label={copy.code.matchedPrimary} onPress={() => router.back()} />
        ) : entry.complete ? (
          <PrimaryButton
            label={copy.code.typeTheirs(partner)}
            onPress={send}
            accessibilityLabel={`Submit ${partner}'s code`}
          />
        ) : (
          <SecondaryButton
            label={copy.code.typeTheirs(partner)}
            onPress={() => entry.focus()}
          />
        )}

        {/*
          Frame 9e's tertiary, `Something went wrong at the meetup`.

          It goes to Messages rather than to a support form. There is no dispute
          endpoint, and the honest thing a phone can do at a hub where something
          has gone wrong is put the two people in a conversation — which is the
          route the app already has.
        */}
        <TertiaryButton
          label={copy.code.somethingWrong}
          onPress={() =>
            router.push(`/(app)/messages?userId=${encodeURIComponent(trade.counterparty.id)}`)
          }
        />
      </OfferBottomBar>
    </OfferScreenHost>
  );
}

/* ─────────────────────────── the trade summary ──────────────────────── */

/**
 * Both items and the meeting place, above the codes.
 *
 * Two thumbnails with §10's swap glyph between them, then a mono line naming the
 * hub and the Leaves. VALUES ARE ABSENT from that line and frame 9e writes `Vans
 * 440 for Air Max 480`: `ITEM_BRIEF` on this route carries no `valueLeaves`. See
 * gap 3 in `src/api/trades.ts`. `offeredLeaves` IS on the wire, so the Leaves
 * half of the line is real.
 */
function TradeSummary({ trade }: { trade: ActiveTrade }) {
  const added = trade.offeredLeaves ?? 0;
  const hub = trade.safeZoneHub?.name ?? null;
  const meta = [hub, added > 0 ? `${present.grouped(added)} added` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Gutter style={{ paddingTop: 6, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
      {trade.offeredItem ? (
        <Thumb image={trade.offeredItem.image} size={offerSize.tradeRow.thumb} />
      ) : null}
      <ArrowsIcon size={16} stroke={offerIcon.inlineRow.stroke} color={offerColor.inkTertiary} />
      <Thumb image={trade.requestedItem.image} size={offerSize.tradeRow.thumb} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text
          style={[textStyle(offerType.itemTitleTile), { color: offerColor.ink }]}
          numberOfLines={2}
        >
          {present.swapLine(trade)}
        </Text>
        {meta ? (
          <Text style={[textStyle(offerType.deadline), { color: offerColor.inkSecondary }]}>
            {meta}
          </Text>
        ) : null}
      </View>
    </Gutter>
  );
}

/* ────────────────────── §6.1 "Both submitted" — 9h ──────────────────── */

/**
 * The codes matched. NOTHING CONGRATULATES.
 *
 * §1.10 is explicit: "No colour event. The screen changes to the next state and
 * a mono line states what happened. There is no success green flash and no
 * confetti anywhere in Baylo." So the heading is a fact with a timestamp, the
 * body says where the trade now lives, and the only accent left on the screen
 * belongs to a promise that outlives the meeting.
 *
 * The time is the trade's `updatedAt` — the completion transaction is the last
 * write on the row, so it is the instant the second code landed. There is no
 * `matchedAt` column and none is invented.
 */
function MatchedScreen({
  trade,
  partner,
  matchedAt,
  promise,
  onBack,
}: {
  trade: ActiveTrade;
  partner: string;
  matchedAt: string;
  promise: V1Contract | null;
  onBack: () => void;
}) {
  const words = promise ? present.promiseWords(promise) : null;

  return (
    <OfferScreenHost imeInset={0}>
      <TradesBackTitle title={copy.nav.traded(trade.counterparty.name)} onBack={onBack} />

      <ScrollView>
        <Section pad={{ top: 20, bottom: 18 }}>
          <View style={{ gap: 10 }}>
            <Text
              accessibilityRole="header"
              style={[textStyle(offerType.screenHeading), { color: offerColor.ink }]}
            >
              {copy.code.matched(matchedAt)}
            </Text>
            <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
              {copy.code.matchedBody(partner)}
            </Text>
          </View>
        </Section>

        <Hairline />
        <TradeSummary trade={trade} />

        {promise && words ? (
          <>
            <Hairline />
            <Section pad={{ top: 18, bottom: 18 }}>
              <View style={{ gap: 12 }}>
                <TradesSectionLabel>{copy.label.stillOpen}</TradesSectionLabel>
                <PromiseRow
                  title={words.title}
                  meta={words.subtitle ?? ""}
                  state={present.promiseRowState(promise)}
                  deadline={new Date(promise.deadline)}
                  paid={promise.amountPaidLeaves}
                  total={promise.amountLeaves}
                />
                <Text style={[textStyle(offerType.helper), { color: offerColor.inkTertiary }]}>
                  {copy.code.promiseOutlives}
                </Text>
              </View>
            </Section>
          </>
        ) : null}
      </ScrollView>

      <OfferBottomBar>
        <PrimaryButton label={copy.code.matchedPrimary} onPress={onBack} />
      </OfferBottomBar>
    </OfferScreenHost>
  );
}
