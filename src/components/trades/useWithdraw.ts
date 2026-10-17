import { useState } from "react";

import { ApiError } from "../../api/client";
import { useCancelTrade, useWithdrawFromTrades } from "../../api/trades";
import type { ActiveTrade, LiveOffer } from "../../api/types";
import { showDialog } from "../dialog";
import * as copy from "./copy";
import { firstName } from "./copy";

/**
 * Taking back what the viewer sent, behind its confirmation — one copy for the
 * Waiting list and the trade screen.
 *
 *   an offer        POST /api/v1/offers/[id]/withdraw   (sender, PENDING)
 *   a swap request  PATCH /api/trades/[id] cancel       (sender, PENDING)
 *
 * The dialog says what comes back, from the offer's own held fee.
 */
export function useWithdraw(onDone?: () => void) {
  const withdraw = useWithdrawFromTrades();
  const cancelTrade = useCancelTrade();
  const [failure, setFailure] = useState<string | null>(null);

  const onError = (e: unknown) =>
    setFailure(e instanceof ApiError ? e.message : "That did not go through. Nothing has changed.");

  const offer = (o: LiveOffer) => {
    const held = o.bridgeFeePayer === "proposer" ? (o.bridgeFeeLeaves ?? 0) : 0;
    showDialog(
      copy.tradeCard.withdrawOfferTitle(firstName(o.counterparty.name)),
      held > 0 ? copy.tradeCard.withdrawOfferHeld(held) : copy.tradeCard.withdrawOfferNothingHeld,
      [
        { text: copy.tradeCard.keep, style: "cancel" },
        {
          text: copy.tradeCard.withdraw,
          style: "destructive",
          onPress: () => {
            setFailure(null);
            withdraw.mutate(o.id, { onError, onSuccess: onDone });
          },
        },
      ],
    );
  };

  const request = (t: ActiveTrade) => {
    showDialog(
      copy.tradeCard.withdrawRequestTitle(firstName(t.counterparty.name)),
      copy.tradeCard.withdrawRequestBody,
      [
        { text: copy.tradeCard.keep, style: "cancel" },
        {
          text: copy.tradeCard.withdraw,
          style: "destructive",
          onPress: () => {
            setFailure(null);
            cancelTrade.mutate(t.id, { onError, onSuccess: onDone });
          },
        },
      ],
    );
  };

  return {
    offer,
    request,
    busy: withdraw.isPending || cancelTrade.isPending,
    failure,
    setFailure,
  };
}
