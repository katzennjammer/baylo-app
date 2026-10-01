import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";

import { ApiError } from "../../api/client";
import {
  CODE_LENGTH,
  codeState,
  confirmSides,
  isCodeRejection,
  ownCode,
  useConfirmStart,
  useConfirmStatus,
  useConfirmSubmit,
  type CodeRejection,
} from "../../api/trades";
import type { ActiveTrade } from "../../api/types";
import { openMailApp } from "../../lib/open-mail";
import { CardLink } from "./TradeCard";
import { CodeCounter, CodeEntry, type CodeEntryState } from "./code";
import * as copy from "./copy";
import { StepHeading, TradeButton } from "./trade-ui";
import { color, size, space, textStyle, type } from "../../theme/tokens";
import { offerType, textStyle as offerTextStyle } from "../../theme/offer-tokens";

/**
 * The handoff step: read your code, type theirs. `app/trade-code.tsx`'s
 * behaviour, unchanged, in the trade screen's layout (Round 2, 1 Oct 2026).
 *
 * ══ WHAT IS CARRIED OVER EXACTLY ════════════════════════════════════════════
 *
 *   - MOUNTING THIS PANEL ISSUES THE CODES. `confirm/start` once, on an
 *     ACCEPTED or CONFIRMING trade, exactly as arriving at the code screen did.
 *     It is idempotent while both codes are live, so re-mounting costs nothing.
 *   - `confirm/status` polls every 2 s while the panel is up.
 *   - The submit carries the trade's claimed hub, and a wrong code keeps its
 *     digits; five wrong burns the pair and "Ask Aj to read it again" reissues.
 *   - Matched → straight to rating, as before.
 *
 * ══ YOUR CODE FIRST, THE EMAIL AS THE BACKUP ════════════════════════════════
 *
 * Whenever `confirm/status` returns the viewer's own code (`ownCode()` is not
 * null), step 1 IS that code — hidden as six dots behind "Show my code", and
 * hidden again whenever the screen loses focus or the app is backgrounded —
 * with the email named underneath as the backup. When it returns null (no
 * key, a rotated key, an expired or burned code) step 1 is the email alone.
 */
export function HandoffPanel({
  trade,
  partner,
  entry,
  keyboardUp,
}: {
  trade: ActiveTrade;
  partner: string;
  /** Owned by the screen, so the field survives the screen's own re-layouts. */
  entry: CodeEntryState;
  keyboardUp: boolean;
}) {
  const router = useRouter();
  const start = useConfirmStart(trade.id);
  const status = useConfirmStatus(trade.id);
  const submit = useConfirmSubmit(trade.id);

  const myCode = ownCode(status.data);
  const sides = confirmSides(status.data, trade.direction);
  const state = codeState(sides);

  const [rejection, setRejection] = useState<CodeRejection | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  // Re-hide on blur and on backgrounding. Somebody who shows their code, puts
  // the phone in a pocket and takes it out later should not find it showing.
  useFocusEffect(useCallback(() => () => setRevealed(false), []));
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") setRevealed(false);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (trade.status !== "ACCEPTED" && trade.status !== "CONFIRMING") return;
    if (!start.isIdle) return;
    start.mutate(undefined, {
      onError: (e) =>
        setFailure(e instanceof ApiError ? e.message : "Could not start the confirmation just now."),
    });
  }, [trade.status, start]);

  const prompted = useRef(false);
  useEffect(() => {
    if (state !== "matched" || prompted.current) return;
    prompted.current = true;
    router.replace(`/rate-trade?id=${encodeURIComponent(trade.id)}`);
  }, [router, state, trade.id]);

  const send = () => {
    setRejection(null);
    setFailure(null);
    submit.mutate(
      { code: entry.value, safeZoneHubId: trade.safeZoneHub?.id ?? null },
      {
        onError: (e) => {
          if (isCodeRejection(e)) {
            setRejection(e);
            return;
          }
          setFailure(e instanceof ApiError ? e.message : "Could not check that code just now.");
        },
      },
    );
  };

  const reissue = () => {
    entry.clear();
    setRejection(null);
    start.mutate(undefined, {
      onError: (e) =>
        setFailure(e instanceof ApiError ? e.message : "Could not issue new codes just now."),
    });
  };

  const openEmail = async () => {
    setFailure(null);
    if (!(await openMailApp())) setFailure(copy.handoff.openEmailFailed);
  };

  const burned = rejection?.locked === true;
  const hubAgreed = !!trade.meetup?.agreedAt || !!trade.safeZoneHub;

  /*
   * ONE TREE. Under the keyboard, step 1 drops out as `null` in a slot that
   * stays, and step 2 — which holds the field — never moves index. See "ONE
   * TREE, NOT TWO" in the old `app/trade-code.tsx`: a moved TextInput is an
   * unmounted one, and the keyboard closes with it.
   */
  return (
    <View style={{ gap: space.home.sectionTop - 4 }}>
      {keyboardUp ? null : (
        <View style={{ gap: space.home.tileBody }}>
          <StepHeading n={1}>{copy.handoff.step1(partner)}</StepHeading>

          {myCode ? (
            <>
              <Text
                style={[offerTextStyle(offerType.codeDigits), { color: color.ink }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                maxFontSizeMultiplier={1.2}
                accessibilityLabel={
                  revealed ? `Your code is ${myCode.split("").join(" ")}` : "Your code, hidden"
                }
              >
                {revealed ? myCode : "•".repeat(CODE_LENGTH)}
              </Text>
              <View style={s.wrapRow}>
                <CardLink
                  label={revealed ? copy.handoff.hide : copy.handoff.show}
                  onPress={() => setRevealed((r) => !r)}
                />
                <Text style={[textStyle(type.metadata), { color: color.inkMuted, flexShrink: 1 }]}>
                  {copy.handoff.hiddenNote}
                </Text>
              </View>
              <View style={s.wrapRow}>
                <Text style={[textStyle(type.metadata), { color: color.inkSecondary, flexShrink: 1 }]}>
                  {copy.handoff.alsoInEmail}
                </Text>
                <CardLink
                  label={copy.handoff.openEmail}
                  tone="secondary"
                  onPress={() => void openEmail()}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={[textStyle(type.detailBody), { color: color.inkSecondary }]}>
                {copy.handoff.step1Body}
              </Text>
              <TradeButton
                label={copy.handoff.openEmail}
                tone="outline"
                onPress={() => void openEmail()}
                style={{ alignSelf: "flex-start" }}
              />
            </>
          )}

          {sides.theySubmitted ? (
            <Text style={[textStyle(type.metadata), { color: color.inkSecondary }]}>
              {copy.handoff.theyTypedYours(partner)}
            </Text>
          ) : null}
        </View>
      )}

      <View style={{ gap: space.home.tileBody }}>
        <StepHeading n={2}>{copy.handoff.step2(partner)}</StepHeading>

        {sides.iSubmitted ? (
          <Text style={[textStyle(type.detailBody), { color: color.inkSecondary }]}>
            {copy.code.notYetTyped(partner)}
          </Text>
        ) : (
          <>
            <CodeEntry
              entry={entry}
              rejected={!!rejection}
              onSubmit={entry.complete ? send : undefined}
              label={copy.handoff.step2(partner)}
              compact
            />
            {rejection ? <CodeCounter remaining={rejection.remaining} /> : null}
            <Text style={[textStyle(type.metadata), { color: color.inkMuted }]}>
              {rejection
                ? copy.handoff.readAgain(partner)
                : hubAgreed
                  ? copy.handoff.refreshAtHub
                  : copy.handoff.refresh}
            </Text>
          </>
        )}

        {failure ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[textStyle(type.detailBody), { color: color.urgent }]}
          >
            {failure}
          </Text>
        ) : null}

        {burned ? (
          <TradeButton label={copy.code.readItAgainButton(partner)} tone="outline" onPress={reissue} />
        ) : sides.iSubmitted ? null : (
          <TradeButton
            label={copy.code.typeTheirs}
            onPress={send}
            disabled={!entry.complete || submit.isPending}
            accessibilityLabel={`Submit ${partner}'s code`}
            accessibilityHint={entry.complete ? undefined : `Type all ${CODE_LENGTH} digits first`}
          />
        )}

        <View style={{ alignItems: "center", minHeight: size.control.social, justifyContent: "center" }}>
          <CardLink
            label={copy.handoff.somethingWrong}
            tone="secondary"
            onPress={() =>
              router.push(`/(app)/messages?partner=${encodeURIComponent(trade.counterparty.id)}`)
            }
          />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: space.home.tileBody,
  },
});
