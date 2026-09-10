import * as copy from "./copy";
import { offerSwapLine, promiseIsNear, swapLine } from "../../api/trades";
import type { ActiveTrade, LiveOffer, V1Contract } from "../../api/types";
import { OFFER_REPLY_DAYS, firstName, replyBy, sentAgo } from "../offer/copy";
import { daysUntil, deadlineLabel, grouped, shortDate } from "../../lib/gap";
import { offerColor, deadlineInk } from "../../theme/offer-tokens";

/**
 * What each row SAYS — one place, so the list and the pushed Waiting screen
 * cannot drift into two vocabularies for the same fact.
 *
 * Pure functions over the wire shapes. No hooks, no components, no colour
 * decisions beyond §1.8's mono ink, which is a function of the deadline and
 * belongs with the string it colours.
 *
 * ── EVERY ROW NAMES ITS COUNTERPARTY BY FIRST NAME ──────────────────────────
 *
 * §10 addresses people as "Marco", never "Marco A.", in every sentence it
 * writes. The frames put the full form on a nav bar and the short form in prose,
 * which is the same distinction — a title is a label and a sentence is speech.
 */

/* ────────────────────────── offers: the clock ───────────────────────── */

/**
 * Days until a PENDING offer expires on its own.
 *
 * `OFFER_EXPIRY_DAYS` on the server is 3 and the window is DERIVED from
 * `createdAt` — there is no `expiresAt` column, deliberately, so this is the
 * same arithmetic the sweep does. `OFFER_REPLY_DAYS` in the offer flow's copy
 * module is the hand-kept mirror of it and is reused rather than re-declared:
 * two constants for one window is how a screen ends up naming a day the server
 * does not agree with.
 *
 * Floored at 0. A row that says "-1 days left" has already been swept and is
 * about to disappear from the list; until it does, "today is the last day" is
 * the truthful reading.
 */
export function offerDaysLeft(createdAt: string, now: number = Date.now()): number {
  const sent = Date.parse(createdAt);
  if (Number.isNaN(sent)) return 0;
  const due = sent + OFFER_REPLY_DAYS * 86_400_000;
  return Math.max(0, Math.ceil((due - now) / 86_400_000));
}

/** The right-hand mono on an offer row: `2 days left`, or the last-day form. */
export function offerClock(createdAt: string): string {
  const days = offerDaysLeft(createdAt);
  return days <= 0 ? copy.waiting.lastDay : copy.waiting.daysLeft(days);
}

/* ─────────────────────────── one row's words ────────────────────────── */

export interface RowWords {
  title: string;
  subtitle: string | null;
  trailing: string | null;
  /** §1.8's mono ink, where a deadline drives it. Undefined means the default. */
  trailingInk?: string;
}

/** An offer the viewer SENT and is waiting on. §10.6's `Sent 2 days ago · expires Tuesday`. */
export function sentOfferWords(offer: LiveOffer): RowWords {
  const partner = firstName(offer.counterparty.name);
  return {
    title: copy.waiting.sentExpires(sentAgo(offer.createdAt), replyBy(offer.createdAt)),
    subtitle: offer.contract
      ? copy.waiting.forPartner(partner, offer.contract.amountLeaves)
      : offerSwapLine(offer),
    trailing: offerClock(offer.createdAt),
  };
}

/** An offer the viewer RECEIVED. §10.6's `Offer from Renz P.` */
export function incomingOfferWords(offer: LiveOffer): RowWords {
  return {
    title: copy.card.offerFrom(firstName(offer.counterparty.name)),
    subtitle: offerSwapLine(offer),
    trailing: offerClock(offer.createdAt),
  };
}

/**
 * A trade with live codes. §10.6's `Code ready · Marco A.`
 *
 * The nav-bar form of the name here, not the first-name form — §10.6 writes it
 * with the surname initial, because this line is identifying a stranger in a car
 * park rather than referring to somebody already in the conversation.
 */
export function codeTradeWords(trade: ActiveTrade): RowWords {
  return {
    title: copy.card.codeReady(trade.counterparty.name),
    subtitle: copy.card.codeWhere(trade.safeZoneHub?.name ?? null),
    trailing: null,
  };
}

/**
 * A PENDING TradeRequest, from whichever side the viewer is on.
 *
 * A trade request carries no three-day clock — `expireStaleOffers()` sweeps
 * `Offer` rows and nothing sweeps `TradeRequest` — so the trailing mono is the
 * age rather than a countdown. Saying "2 days left" about a row that never
 * expires would be inventing a deadline.
 */
export function tradeRequestWords(trade: ActiveTrade): RowWords {
  const partner = firstName(trade.counterparty.name);
  return {
    title:
      trade.direction === "received"
        ? copy.card.tradeRequestFrom(partner)
        : copy.card.tradeRequestSent(partner),
    subtitle: swapLine(trade),
    trailing: copy.waiting.since(new Date(trade.createdAt)),
  };
}

/** An ACCEPTED trade with no meeting yet. §10.6's `Accepted · meeting not set`. */
export function acceptedTradeWords(trade: ActiveTrade): RowWords {
  return {
    title: copy.waiting.acceptedNoMeeting,
    subtitle: copy.waiting.pickAHub(firstName(trade.counterparty.name)),
    trailing: copy.waiting.since(new Date(trade.createdAt)),
  };
}

/** A CONFIRMING trade the viewer has already done their half of. */
export function confirmingTradeWords(trade: ActiveTrade): RowWords {
  const partner = firstName(trade.counterparty.name);
  return {
    title: copy.waiting.forPartner(partner, null),
    subtitle: copy.code.notYetTyped(partner),
    trailing: null,
  };
}

/**
 * A promise, from whichever side the viewer is on.
 *
 * DEBTOR ROWS SAY `promised`; CREDITOR ROWS SAY `owed`. Frame 9j's note is the
 * rule and it is not cosmetic — the two sentences describe two different
 * obligations, and a row that read the same from both sides would let a creditor
 * think they had something to do.
 */
export function promiseWords(contract: V1Contract, now: Date = new Date()): RowWords {
  const debtor = contract.role === "debtor";
  const other = debtor ? contract.creditor : contract.debtor;
  const otherName = firstName(other?.name ?? "them");
  const deadline = new Date(contract.deadline);

  const title = debtor
    ? copy.promise.toCreditor(contract.amountLeaves, otherName)
    : copy.promise.owedBy(contract.amountLeaves, otherName);

  if (contract.status === "PENDING_ACCEPT") {
    return {
      title,
      subtitle: debtor ? copy.promise.waitingToAccept(otherName) : copy.promise.waitingOnYou,
      trailing: null,
      // Not yet a debt, so §1.8's scale does not apply: nothing is due until it
      // is accepted, and colouring an unaccepted proposal by its deadline would
      // put terracotta on something nobody owes yet.
      trailingInk: offerColor.inkTertiary,
    };
  }

  if (contract.status === "FULFILLED") {
    const settledOn = contract.fulfilledAt ? new Date(contract.fulfilledAt) : null;
    return {
      title,
      // §1.7: a fulfilled agreement loses all accent colour. Nothing congratulates.
      subtitle: settledOn ? copy.promise.settled(settledOn) : "settled",
      trailing: null,
    };
  }

  if (contract.status === "DEFAULTED" || contract.defaulted) {
    const on = contract.defaultedAt ? new Date(contract.defaultedAt) : deadline;
    return {
      title,
      subtitle: debtor
        ? copy.promise.defaulted(on, contract.remainingLeaves)
        : copy.promise.defaultedTheirs(on, otherName),
      trailing: null,
    };
  }

  // ACTIVE. §5.3's two sub-states are one row: the deadline always, the settled
  // figure as well once anything has been paid.
  const paidPart =
    contract.amountPaidLeaves > 0
      ? `${copy.promise.partSettled(contract.amountPaidLeaves, contract.amountLeaves)} · `
      : "";

  return {
    title,
    subtitle: `${paidPart}${deadlineLabel(deadline, now)}`,
    trailing: null,
    trailingInk: deadlineInk(daysUntil(deadline, now)),
  };
}

/** §1.8's ink for a promise's mono line, which is the only place urgency shows. */
export function promiseInk(contract: V1Contract, now: Date = new Date()): string {
  if (contract.status === "FULFILLED") return offerColor.inkTertiary;
  if (contract.status === "DEFAULTED" || contract.defaulted) return offerColor.warm;
  if (contract.status === "PENDING_ACCEPT") return offerColor.inkTertiary;
  return deadlineInk(daysUntil(new Date(contract.deadline), now));
}

/** §1.7's four visual states, as `PromiseRow` takes them. */
export function promiseRowState(
  contract: V1Contract,
): "pending" | "active" | "defaulted" | "fulfilled" {
  if (contract.status === "PENDING_ACCEPT") return "pending";
  if (contract.status === "FULFILLED") return "fulfilled";
  if (contract.status === "DEFAULTED") return "defaulted";
  return "active";
}

/* ───────────────────── the "Needs you today" card ───────────────────── */

/**
 * The promise card in §6's top block. §10.6's `100 promised to Jess M.`
 *
 * Two mono lines, per frame 9a: the deadline in §1.8's ink, then what has been
 * settled in tertiary. `promiseIsNear()` is what put it here, and the card
 * repeats the deadline rather than assuming the reader remembers why it was
 * promoted.
 */
export interface PromiseCardLines {
  title: string;
  deadline: string;
  settled: string;
  ink: string;
}

export function promiseCardLines(
  contract: V1Contract,
  now: Date = new Date(),
): PromiseCardLines {
  const creditor = firstName(contract.creditor?.name ?? "them");
  const deadline = new Date(contract.deadline);

  return {
    title: copy.card.promised(contract.amountLeaves, creditor),
    deadline:
      contract.status === "DEFAULTED"
        ? copy.promise.defaulted(
            contract.defaultedAt ? new Date(contract.defaultedAt) : deadline,
            contract.remainingLeaves,
          )
        : deadlineLabel(deadline, now),
    settled:
      contract.amountPaidLeaves > 0
        ? copy.card.partSettled(contract.amountPaidLeaves, contract.amountLeaves)
        : copy.card.nothingSettled,
    ink: promiseInk(contract, now),
  };
}

/* ────────────────────────────── History ─────────────────────────────── */

/**
 * One finished trade, in frame 9d's two lines.
 *
 * THREE STATUSES, THREE SENTENCES, and they are never collapsed: COMPLETED is
 * "we traded", REJECTED is "they said no", CANCELLED is "it was called off".
 * The three terminal OFFER states — declined, withdrawn, expired — are the same
 * distinction one level up, and no endpoint lists them; see gap 4 in
 * `src/api/trades.ts` and `copy.history.offersNote`, which says so on the screen.
 *
 * `codes matched HH:MM` uses `updatedAt`, which is when the second code landed —
 * the completion transaction is the last write on the row. It is not a
 * `matchedAt` column, and there is none; naming it as the time the trade
 * finished is true, and it is the same instant §10.7's `Codes matched 15:42`
 * refers to.
 */
export function historyWords(
  trade: ActiveTrade,
  clock: (at: number) => string,
): { title: string; meta: string; tone: "neutral" | "quiet" } {
  const partner = firstName(trade.counterparty.name);
  const when = new Date(trade.updatedAt);

  if (trade.status === "COMPLETED") {
    return {
      title: copy.history.traded(partner),
      meta: copy.history.tradedMeta(when, clock(when.getTime())),
      tone: "neutral",
    };
  }
  if (trade.status === "REJECTED") {
    return {
      title: copy.history.rejected(partner),
      meta: copy.history.plainMeta(when, swapLine(trade)),
      tone: "quiet",
    };
  }
  return {
    title: copy.history.cancelled,
    meta: copy.history.plainMeta(when, swapLine(trade)),
    tone: "quiet",
  };
}

/**
 * Frame 9d groups History by month. `September`, `August`.
 *
 * The month is a label on a section, not a date on a row — each row already
 * carries its own `8 Sep`. Grouping is what turns a flat list of endings into
 * something a person can find a specific trade in.
 */
export function groupByMonth(trades: ActiveTrade[]): { label: string; rows: ActiveTrade[] }[] {
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const out: { label: string; rows: ActiveTrade[] }[] = [];
  for (const t of trades) {
    const d = new Date(t.updatedAt);
    const label = `${MONTHS[d.getMonth()]}${
      d.getFullYear() === new Date().getFullYear() ? "" : ` ${d.getFullYear()}`
    }`;
    const last = out[out.length - 1];
    if (last && last.label === label) last.rows.push(t);
    else out.push({ label, rows: [t] });
  }
  return out;
}

/* ───────────────────────── re-exports for the screens ───────────────── */

export { firstName, grouped, shortDate, swapLine, offerSwapLine, promiseIsNear };
