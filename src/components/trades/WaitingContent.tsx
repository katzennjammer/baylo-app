import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { meetupState, type WaitingItem } from "../../api/trades";
import type { ActiveTrade } from "../../api/types";
import { color, textStyle as baseTextStyle, type } from "../../theme/tokens";
import { offerColor, offerType, textStyle } from "../../theme/offer-tokens";
import { Gutter } from "./chrome";
import * as copy from "./copy";
import * as present from "./present";
import { CardLink, TradeCard } from "./TradeCard";
import type { useWithdraw } from "./useWithdraw";

/**
 * Everything waiting on the other person — offers you sent, and trades where
 * they move next — without a screen around it. Drawn by the Trades tab's Sent
 * section and by /trades-waiting.
 */
export function WaitingList({
  waiting,
  withdraw,
  loaded,
}: {
  waiting: WaitingItem[];
  withdraw: ReturnType<typeof useWithdraw>;
  /** False until the feed has answered once; hides the empty line meanwhile. */
  loaded: boolean;
}) {
  return (
    <>
      {withdraw.failure ? <FailureLine>{withdraw.failure}</FailureLine> : null}
      <View style={{ gap: 10 }}>
        {waiting.map((item) => (
          <WaitingCard
            key={item.key}
            item={item}
            onWithdraw={() =>
              item.kind === "sent-offer" ? withdraw.offer(item.offer) : withdraw.request(item.trade)
            }
          />
        ))}
      </View>
      {waiting.length === 0 && loaded ? (
        <Gutter>
          <Text style={[baseTextStyle(type.emptyBody), { color: color.inkSecondary }]}>
            {copy.tradeCard.waitingEmpty}
          </Text>
        </Gutter>
      ) : null}
    </>
  );
}

/**
 * One waiting trade as a card. The card opens the trade screen; the links
 * under it are the acts still open today:
 *
 *   Change suggestion   an ACCEPTED trade whose standing hub suggestion is the
 *                       viewer's own and still unanswered.
 *   Withdraw offer      a PENDING offer the viewer sent. Sender only.
 *   Withdraw            a PENDING swap request the viewer sent (calls it off).
 *
 * A CONFIRMING trade has neither: the viewer's half is done and there is
 * nothing left to take back.
 */
export function WaitingCard({ item, onWithdraw }: { item: WaitingItem; onWithdraw: () => void }) {
  const router = useRouter();
  const words = present.waitingScreenCard(item);
  const trade: ActiveTrade | null = item.kind === "trade" ? item.trade : null;

  const canChange = !!trade && trade.status === "ACCEPTED" && meetupState(trade) === "waiting-on-them";
  const canWithdraw = item.kind === "sent-offer" || trade?.status === "PENDING";

  return (
    <TradeCard words={words}>
      {trade && canChange ? (
        <CardLink
          label={copy.tradeCard.changeSuggestion}
          onPress={() => router.push(`/trade-meetup?id=${encodeURIComponent(trade.id)}`)}
          accessibilityLabel={`Change your suggestion to ${words.partner}`}
        />
      ) : null}
      {canWithdraw ? (
        <CardLink
          label={
            item.kind === "sent-offer" ? copy.tradeCard.withdrawOffer : copy.tradeCard.withdraw
          }
          tone="secondary"
          onPress={onWithdraw}
          accessibilityLabel={
            item.kind === "sent-offer"
              ? `Withdraw your offer to ${words.partner}`
              : `Withdraw your swap request to ${words.partner}`
          }
        />
      ) : null}
    </TradeCard>
  );
}

/**
 * A failed accept, decline or withdrawal.
 *
 * The SERVER'S OWN SENTENCE, not a generic one. Every refusal on these routes
 * carries the numbers — "the sender now has only 260 Leaves available but this
 * offer requires 310" — and replacing that with "something went wrong" throws
 * away the only part the reader can act on.
 */
export function FailureLine({ children }: { children: string }) {
  return (
    <Gutter style={{ paddingTop: 12 }}>
      <Text
        accessibilityLiveRegion="polite"
        style={[textStyle(offerType.errorText), { color: offerColor.warm }]}
      >
        {children}
      </Text>
    </Gutter>
  );
}


