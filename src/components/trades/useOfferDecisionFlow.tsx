import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";

import { ApiError } from "../../api/client";
import { currentConsent } from "../../api/offer";
import { useActiveTrades, useOfferDecision, type OfferDecided } from "../../api/trades";
import type { LiveOffer } from "../../api/types";
import { openPremium, premiumGateReason } from "../../lib/premium";
import { BridgeConsentSheet } from "../offer/BridgeConsentSheet";
import { firstName } from "./copy";

/**
 * Accepting or declining an incoming OFFER — the one implementation.
 *
 * Lifted out of `app/offer-review.tsx` unchanged so the trade screen and the
 * chat offer card cannot drift into two versions of the same decision:
 *
 *   - PATCH /api/offers/[id] via `useOfferDecision()`, nothing else.
 *   - A receiver-pays bridge opens `BridgeConsentSheet` first, and consent rides
 *     only on that accept, from the sheet's own button.
 *   - A bracket-gate refusal goes to the Premium screen, the one paywall.
 *   - Any other refusal is the SERVER'S sentence, not a generic one.
 *
 * `sheet` is the consent sheet when it is open; the caller renders it.
 */
export function useOfferDecisionFlow(offer: LiveOffer | null): {
  accept: () => void;
  decline: () => void;
  busy: boolean;
  /** What this screen decided, once it has. */
  decided: { action: "accept" | "decline"; result: OfferDecided } | null;
  failure: string | null;
  receiverPays: boolean;
  fee: number;
  /** The fee is held from this balance — the acting identity's, shop or person. */
  balance: number | null;
  sheet: ReactNode;
} {
  const router = useRouter();
  const active = useActiveTrades();
  const decide = useOfferDecision();
  const [failure, setFailure] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [decided, setDecided] = useState<{
    action: "accept" | "decline";
    result: OfferDecided;
  } | null>(null);

  const fee = offer?.bridgeFeeLeaves ?? 0;
  const receiverPays = fee > 0 && offer?.bridgeFeePayer === "receiver";
  const balance = active.data?.viewer.leaves ?? null;

  const run = (action: "accept" | "decline") => {
    if (!offer) return;
    setFailure(null);
    decide.mutate(
      {
        offerId: offer.id,
        action,
        consent: action === "accept" && receiverPays ? currentConsent() : null,
      },
      {
        onSuccess: (result) => {
          setConsentOpen(false);
          setDecided({ action, result });
        },
        onError: (e) => {
          setConsentOpen(false);
          const gated = premiumGateReason(e);
          if (gated) {
            openPremium(router, gated, offer.offeredBracket ?? undefined);
            return;
          }
          setFailure(
            e instanceof ApiError
              ? e.message
              : "That did not go through. Nothing has changed on your side.",
          );
        },
      },
    );
  };

  const accept = () => {
    if (receiverPays) {
      setConsentOpen(true);
      return;
    }
    run("accept");
  };

  const sheet =
    consentOpen && offer && offer.offeredBracket !== null && offer.targetBracket !== null ? (
      <BridgeConsentSheet
        side="accept"
        otherName={firstName(offer.counterparty.name)}
        yourBracket={offer.targetBracket}
        theirBracket={offer.offeredBracket}
        fee={fee}
        balance={balance ?? 0}
        busy={decide.isPending}
        onConfirm={() => run("accept")}
        onDismiss={() => setConsentOpen(false)}
      />
    ) : null;

  return {
    accept,
    decline: () => run("decline"),
    busy: decide.isPending,
    decided,
    failure,
    receiverPays,
    fee,
    balance,
    sheet,
  };
}
