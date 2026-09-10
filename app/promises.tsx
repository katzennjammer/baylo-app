import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { ApiError } from "../src/api/client";
import { useActiveTrades } from "../src/api/trades";
import {
  EXTENSION_DAYS,
  promiseActions,
  useContracts,
  useRequestExtension,
  useSettleContract,
} from "../src/api/trades";
import type { V1Contract } from "../src/api/types";
import { Hairline, OfferScreenHost } from "../src/components/offer/chrome";
import { BlockHeader, Gutter, TradesBackTitle } from "../src/components/trades/chrome";
import * as copy from "../src/components/trades/copy";
import * as present from "../src/components/trades/present";
import { PromiseRow, RowAction } from "../src/components/trades/rows";
import { SettleSheet } from "../src/components/trades/SettleSheet";
import { TradesErrorPanel, TradesSkeleton } from "../src/components/trades/states";
import { grouped, shortDate } from "../src/lib/gap";
import { offerColor, offerSize, offerType, textStyle } from "../src/theme/offer-tokens";

/**
 * Frame 9j — every promise, from both sides. §1.7's six states as a real list.
 *
 * ══ DEBTOR ROWS SAY `promised`. CREDITOR ROWS SAY `owed`. ═══════════════════
 *
 * Frame 9j's note is the rule and it is not a wording preference: the two
 * sentences describe two different obligations, and a row that read the same
 * from both sides would let a creditor believe there was something for them to
 * do. There is not. YOU CANNOT MAKE SOMEONE PAY — so creditor rows carry no
 * control at all, and the footnote says out loud that there is nothing to chase.
 *
 * ══ §1.7's SIX STATES, AND WHERE EACH ONE'S TREATMENT LIVES ═════════════════
 *
 * All six are `PromiseRow` in `src/components/trades/rows.tsx`, which is the one
 * place the outline, the fill, the left rule and the meter are decided. What is
 * here is only which contract goes in which block:
 *
 *   PENDING_ACCEPT  → a 1.5px terracotta OUTLINE — a proposal awaiting an answer
 *                     has not failed, and §1.4's rule for the whole system is
 *                     that outline warns and fill fails.
 *   ACTIVE          → the deadline in §1.8's ink, and nothing else.
 *   ACTIVE + paid   → the same row with a meter under it.
 *   ACTIVE + near   → §1.8 again. NOT a separate treatment; the scale IS the
 *                     treatment, which is why a deadline never gets an icon.
 *   DEFAULTED       → `#F5F4EE` fill, 3px terracotta left rule.
 *   FULFILLED       → a hairline row, `settled 4 Oct`, no accent whatsoever.
 *
 * ══ `Settle` IS A REAL CONTROL NOW ══════════════════════════════════════════
 *
 * It calls POST /api/v1/contracts/[id]/settle, debtor only, partial or full.
 *
 * THE PASSIVE RULE IS UNCHANGED and both halves are said in one sentence under
 * the rows: Leaves the debtor EARNS still go to their oldest agreement first,
 * without being asked, and on top of that they can now pay one deliberately from
 * their balance. Only saying the second half would suggest a debt sits still
 * until pressed, which it does not — and only saying the first was the old
 * screen, where the button in the frames had nothing behind it.
 *
 * A DEFAULTED AGREEMENT KEEPS ITS SETTLE CONTROL, and that is the point of it:
 * paying a lapsed agreement off reaches FULFILLED and lifts the trading
 * restriction. `defaultedAt` is never cleared, so settling late repairs the
 * standing without erasing the history — §10.4's `1, settled late`.
 *
 * `Ask for more time` stays as the second, quieter control, and it is not a
 * substitute: asking does not move the deadline, only the creditor's grant does.
 */
export default function PromisesScreen() {
  const router = useRouter();
  const contracts = useContracts();
  // For the viewer's balance, which the settle sheet has to show and clamp to.
  // Same query the Trades list already holds, so this costs nothing.
  const active = useActiveTrades();

  const extend = useRequestExtension();
  const settle = useSettleContract();

  const [failure, setFailure] = useState<string | null>(null);
  const [asked, setAsked] = useState<Set<string>>(new Set());
  /** §1.10's mono line after a payment: what happened, in figures. No colour. */
  const [settled, setSettled] = useState<{ id: string; line: string } | null>(null);
  const [settling, setSettling] = useState<V1Contract | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [openedFromLink, setOpenedFromLink] = useState(false);
  const { settle: settleParam } = useLocalSearchParams<{ settle?: string }>();

  const rows = contracts.data?.contracts ?? [];
  const mine = rows.filter((c) => c.role === "debtor" && c.status !== "DECLINED");
  const theirs = rows.filter((c) => c.role === "creditor" && c.status !== "DECLINED");

  /**
   * `?settle=<contractId>` — arrive with the amount question already open.
   *
   * The Settle control on a `Needs you today` card pushes this route with the id
   * on it, so one tap goes from the list to the question rather than to a screen
   * where the same button has to be found again.
   *
   * ONCE, AND ONLY BEFORE THE FIRST INTERACTION. `openedFromLink` latches, so
   * closing the sheet does not have it spring back open on the next render —
   * which is what a bare `if (param) setSettling(...)` in a render body would do,
   * and it would make the sheet impossible to dismiss.
   */
  useEffect(() => {
    if (openedFromLink || !settleParam) return;
    const target = mine.find((c) => c.id === settleParam);
    if (!target) return;
    setOpenedFromLink(true);
    setSettling(target);
  }, [openedFromLink, settleParam, mine]);

  // The RAW balance, not `availableLeaves`. Contract debt outranks Leaves
  // pledged to pending offers — the server makes the same call in
  // `applyEarningsToContracts()`, and for the same reason: netting off open
  // offers here would let a debtor park their balance in offers and never pay.
  const balance = active.data?.viewer.leaves ?? 0;

  if (contracts.isPending && !contracts.data) {
    return (
      <OfferScreenHost imeInset={0}>
        <TradesBackTitle title={copy.nav.promises} onBack={() => router.back()} />
        <TradesSkeleton />
      </OfferScreenHost>
    );
  }

  /**
   * The extension request. `deadline` is the CURRENT one plus a week.
   *
   * The server bounds it to between +1 and +14 days of the existing deadline and
   * re-checks; `EXTENSION_DAYS.suggested` is the middle of that window, which is
   * the honest default for a control whose whole label is "more time". A date
   * picker would be a better answer and is a bigger change than this screen — it
   * would need §3.4's date sheet, which belongs to the DPA proposal flow.
   */
  const askForTime = (contract: V1Contract) => {
    setFailure(null);
    const next = new Date(
      new Date(contract.deadline).getTime() + EXTENSION_DAYS.suggested * 86_400_000,
    );
    extend.mutate(
      { contractId: contract.id, deadline: next },
      {
        onSuccess: () => setAsked((prev) => new Set(prev).add(contract.id)),
        onError: (e) =>
          setFailure(
            e instanceof ApiError
              ? e.message
              : "That did not go through. The agreement is unchanged.",
          ),
      },
    );
  };

  /**
   * The payment. `amountLeaves` undefined means "all of it" and sends no figure
   * — the server computes the remainder, which is what survives the remainder
   * moving between the read that drew the sheet and the write.
   */
  const paySettlement = (contract: V1Contract, amountLeaves?: number) => {
    setSheetError(null);
    settle.mutate(
      { contractId: contract.id, amountLeaves },
      {
        onSuccess: (res) => {
          setSettling(null);
          // §1.10: no colour event, nothing congratulates. A mono line states
          // what happened and the figures come from the server's own response
          // rather than from what this screen asked for — a partial that landed
          // against a remainder that had moved is still the truth.
          setSettled({
            id: contract.id,
            line: copy.promise.settledLine(
              res.data.payment.amountLeaves,
              res.data.payment.remainingLeaves,
            ),
          });
        },
        onError: (e) => {
          // THE SERVER'S OWN SENTENCE, which carries the numbers. A 400 with
          // `rule: "INSUFFICIENT_LEAVES"` names the balance and the amount, and
          // replacing that with "payment failed" throws away the actionable half.
          setSheetError(
            e instanceof ApiError
              ? e.message
              : "That payment did not go through. Nothing was taken.",
          );
        },
      },
    );
  };

  return (
    <OfferScreenHost imeInset={0} dimmed={extend.isPending}>
      <TradesBackTitle title={copy.nav.promises} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {contracts.isError ? (
          <TradesErrorPanel
            heading="Can't load your promises"
            onRetry={() => void contracts.refetch()}
          />
        ) : null}

        {failure ? (
          <Gutter style={{ paddingTop: 12 }}>
            <Text
              accessibilityLiveRegion="polite"
              style={[textStyle(offerType.errorText), { color: offerColor.warm }]}
            >
              {failure}
            </Text>
          </Gutter>
        ) : null}

        {/* ── You promised. The only side with anything to do. ── */}
        {mine.length > 0 ? (
          <>
            <BlockHeader label={copy.label.youPromised} top={12} />
            <Hairline />
            {mine.map((contract) => (
              <View key={contract.id}>
                <DebtorRow
                  contract={contract}
                  justAsked={asked.has(contract.id)}
                  settledLine={settled?.id === contract.id ? settled.line : null}
                  onAsk={() => askForTime(contract)}
                  onSettle={() => {
                    setSheetError(null);
                    setSettling(contract);
                  }}
                />
                <Hairline />
              </View>
            ))}
            <Gutter style={{ paddingTop: 12 }}>
              <Text style={[textStyle(offerType.helper), { color: offerColor.inkTertiary }]}>
                {copy.promise.howSettling}
              </Text>
            </Gutter>
          </>
        ) : null}

        {/* ── Owed to you. No controls, on purpose. ── */}
        {theirs.length > 0 ? (
          <>
            <BlockHeader label={copy.label.owedToYou} top={18} />
            <Hairline />
            {theirs.map((contract) => {
              const words = present.promiseWords(contract);
              return (
                <View key={contract.id}>
                  <PromiseRow
                    title={words.title}
                    meta={words.subtitle ?? ""}
                    state={present.promiseRowState(contract)}
                    deadline={new Date(contract.deadline)}
                    paid={contract.amountPaidLeaves}
                    total={contract.amountLeaves}
                  />
                  <Hairline />
                </View>
              );
            })}
          </>
        ) : null}

        <Gutter style={{ paddingTop: 14, paddingBottom: 30 }}>
          <Text style={[textStyle(offerType.helper), { color: offerColor.inkTertiary }]}>
            {mine.length === 0 && theirs.length === 0
              ? copy.promise.howSettling
              : copy.promise.footnote}
          </Text>
        </Gutter>
      </ScrollView>

      {settling ? (
        <SettleSheet
          visible
          creditorName={present.firstName(settling.creditor?.name ?? "them")}
          owed={settling.remainingLeaves}
          balance={balance}
          busy={settle.isPending}
          error={sheetError}
          onSettle={(amountLeaves) => paySettlement(settling, amountLeaves)}
          onClose={() => {
            if (settle.isPending) return;
            setSettling(null);
            setSheetError(null);
          }}
        />
      ) : null}
    </OfferScreenHost>
  );
}

/**
 * One promise the viewer owes.
 *
 * TWO CONTROLS AT MOST, and their weights differ because the acts differ.
 * `Settle` is the primary one — it is what the row is about — and `Ask for more
 * time` is the quiet alternative for somebody who cannot pay today. A row that
 * offered them at equal weight would be asking a question the debtor did not
 * come here to answer.
 *
 * ASKING DOES NOT MOVE THE DEADLINE, and the row must not imply that it does.
 * Only the creditor's grant moves anything; `extensionUsed` is set by the grant
 * rather than by the request, so a debtor cannot burn their own extension by
 * asking. Once asked, the control is replaced by the state rather than left
 * pressable — a second tap would 409 and the row would look broken.
 */
function DebtorRow({
  contract,
  justAsked,
  settledLine,
  onAsk,
  onSettle,
}: {
  contract: V1Contract;
  justAsked: boolean;
  /** §1.10's mono line after a payment. Replaces the deadline until refetch. */
  settledLine: string | null;
  onAsk: () => void;
  onSettle: () => void;
}) {
  const words = present.promiseWords(contract);
  const actions = promiseActions(contract);
  const pendingAsk = justAsked || contract.extension.pending;
  const canAsk = actions.extend && !justAsked;

  const meta = settledLine
    ? settledLine
    : pendingAsk
      ? `${words.subtitle ?? ""} · ${copy.promise.extensionPending}`
      : (words.subtitle ?? "");

  return (
    <PromiseRow
      title={words.title}
      meta={meta}
      state={present.promiseRowState(contract)}
      deadline={new Date(contract.deadline)}
      paid={contract.amountPaidLeaves}
      total={contract.amountLeaves}
      action={
        actions.settle ? (
          <View style={{ flexDirection: "row", gap: offerSize.button.splitGap }}>
            {canAsk ? (
              <RowAction
                label={copy.promise.extend}
                onPress={onAsk}
                tone="quiet"
                accessibilityLabel={`Ask for more time on the ${grouped(
                  contract.remainingLeaves,
                )} you owe, due ${shortDate(new Date(contract.deadline))}`}
              />
            ) : null}
            <RowAction
              label={copy.promise.settle}
              onPress={onSettle}
              // §6's rule for a filled control: the one thing in front of you
              // that needs doing. On this screen a promise inside its deadline
              // is exactly that, and one outside it doubly so.
              tone={present.promiseRowState(contract) === "defaulted" ? "filled" : "outline"}
              accessibilityLabel={`Settle the ${grouped(
                contract.remainingLeaves,
              )} you owe, due ${shortDate(new Date(contract.deadline))}`}
            />
          </View>
        ) : canAsk ? (
          <RowAction label={copy.promise.extend} onPress={onAsk} tone="quiet" />
        ) : undefined
      }
    />
  );
}
