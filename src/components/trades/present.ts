import * as copy from "./copy";
import { meetupState, offerFeeLine, offerSwapLine, swapLine, tradeFeeLine } from "../../api/trades";
import type { NeedsItem, WaitingItem } from "../../api/trades";
import type { ActiveTrade, LiveOffer } from "../../api/types";
import { OFFER_REPLY_DAYS, firstName, replyBy, sentAgo } from "../offer/copy";
import { grouped, meetupWhen, shortDate } from "../../lib/gap";

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
  return {
    title: copy.waiting.sentExpires(sentAgo(offer.createdAt), replyBy(offer.createdAt)),
    subtitle: withFee(offerSwapLine(offer), offerFeeLine(offer)),
    trailing: offerClock(offer.createdAt),
  };
}

/**
 * `Your Vans 440 for their Bracket 4 · 20-Leaf fee held`. The bridge, when
 * there is one, rides the swap line rather than taking a line of its own — a
 * row is two lines and the fee is a fact about the swap, not a third thing.
 */
function withFee(line: string, fee: string | null): string {
  return fee ? `${line} · ${fee}` : line;
}

/** An offer the viewer RECEIVED. §10.6's `Offer from Renz P.` */
export function incomingOfferWords(offer: LiveOffer): RowWords {
  return {
    title: copy.card.offerFrom(firstName(offer.counterparty.name)),
    subtitle: withFee(offerSwapLine(offer), offerFeeLine(offer)),
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

/**
 * An ACCEPTED trade. The title says where the meeting stands.
 *
 * It used to be §10.6's `Accepted · meeting not set` in every state, which was
 * a lie in three of the four: a partner who had just suggested Saturday saw
 * "not set" on the Trades tab and reasonably concluded the suggestion had not
 * reached them. The title now follows `meetupState()` like the second line
 * does, so the tab and the pushed list tell the same story from the same row.
 */
export function acceptedTradeWords(trade: ActiveTrade): RowWords {
  const state = meetupState(trade);
  const title =
    state === "agreed" && trade.meetup
      ? copy.waiting.acceptedMeetingSet(meetupWhen(new Date(trade.meetup.at)))
      : state === "yours-to-answer"
        ? copy.waiting.acceptedYoursToAnswer
        : state === "waiting-on-them"
          ? copy.waiting.acceptedWaitingOnThem
          : copy.waiting.acceptedNoMeeting;
  // `pick a hub` only while there is nothing picked; once there is a plan the
  // second line is the plan, or a "meeting set for Saturday" title sits over
  // an instruction to pick one.
  const partner = firstName(trade.counterparty.name);
  const second = trade.meetup
    ? `With ${partner} · ${copy.meetup.where(trade.meetup.hub.name, meetupWhen(new Date(trade.meetup.at)))}`
    : copy.waiting.pickAHub(partner);
  return {
    title,
    subtitle: withFee(second, tradeFeeLine(trade)),
    trailing: copy.waiting.since(new Date(trade.createdAt)),
  };
}

/**
 * The second line on an accepted row — what has been arranged, if anything.
 *
 * FOUR STATES, SWITCHED ON `meetupState()` RATHER THAN RE-DERIVED. Comparing
 * `plan.proposedBy` against `trade.direction` is the kind of two-term comparison
 * that reads correct and is backwards, and getting it backwards here tells the
 * person who proposed a time that they are the one who has to answer it. It is
 * decided once, in `src/api/trades.ts`, and read here.
 *
 * `agreed` DESCRIBES THE AGREEMENT, NEVER THE MEETING. Two people have tapped
 * their phones; neither has left the house. The Safe-Zone claim is a different
 * column for exactly this reason and the words follow it.
 */
export function meetupWords(trade: ActiveTrade): { line: string; detail: string | null } {
  const partner = firstName(trade.counterparty.name);
  const plan = trade.meetup;
  const state = meetupState(trade);

  if (!plan || state === "none") {
    return { line: copy.meetup.none, detail: null };
  }

  const where = copy.meetup.where(plan.hub.name, meetupWhen(new Date(plan.at)));

  if (state === "agreed") return { line: `${copy.meetup.agreed} · ${where}`, detail: plan.note };
  if (state === "yours-to-answer") {
    return { line: copy.meetup.theyProposed(partner), detail: where };
  }
  return { line: copy.meetup.waitingOnThem(partner), detail: where };
}

/** A CONFIRMING trade the viewer has already done their half of. */
export function confirmingTradeWords(trade: ActiveTrade): RowWords {
  const partner = firstName(trade.counterparty.name);
  return {
    title: copy.waiting.forPartner(partner),
    subtitle: copy.code.notYetTyped(partner),
    trailing: null,
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

/* ─────────────────────── the Trades tab's cards ─────────────────────── */

/** One half of a card's split row. `leaves` draws the leaf tile instead of a photo. */
export interface CardSide {
  image: string | null;
  title: string;
  leaves: boolean;
}

/** Index into `copy.tradeCard.steps`: Accepted · Hub set · Handoff · Done. */
export type StepIndex = 0 | 1 | 2 | 3;

export interface CardProgress {
  current: StepIndex;
  /** Per step. A step BEFORE `current` can be false: codes started with no hub agreed. */
  done: [boolean, boolean, boolean, boolean];
  /** Amber while the current step is choosing a hub; forest otherwise. */
  tone: "forest" | "amber";
}

export interface CardWords {
  partner: string;
  since: string;
  give: CardSide;
  get: CardSide;
  /** Null on a "Waiting on them" card, which carries no track. */
  progress: CardProgress | null;
  footer: string;
  /** A second, secondary line under the footer: the time of a suggestion. */
  footerDetail?: string | null;
  /** "Your move" cards only. */
  action: { label: string; tone: "forest" | "amber"; href: string; a11y: string } | null;
  /** "Waiting on them" cards only: "Aj to confirm". */
  waitingOn: string | null;
  /** Where the card body goes: the one trade screen. */
  open: string;
}

function sideOf(
  item: { title: string; image: string | null } | null,
  leaves: number | null,
): CardSide {
  const n = leaves ?? 0;
  if (item && n > 0) {
    return { image: item.image, title: copy.tradeCard.itemPlusLeaves(item.title, n), leaves: false };
  }
  if (item) return { image: item.image, title: item.title, leaves: false };
  if (n > 0) return { image: null, title: copy.tradeCard.leaves(n), leaves: true };
  return { image: null, title: copy.tradeCard.unnamed, leaves: false };
}

/**
 * Give / get, from the viewer's side. The sender put up `offeredItem` (and any
 * `offeredLeaves`); the receiver put up `requestedItem`. On a Leaves-only trade
 * the wire sends `offeredItem: null`, so the sender's side is the leaf tile.
 */
export function tradeSides(trade: ActiveTrade): { give: CardSide; get: CardSide } {
  const senderSide = sideOf(trade.offeredItem, trade.offeredLeaves);
  const receiverSide = sideOf(trade.requestedItem, null);
  return trade.direction === "sent"
    ? { give: senderSide, get: receiverSide }
    : { give: receiverSide, get: senderSide };
}

export function offerSides(offer: LiveOffer): { give: CardSide; get: CardSide } {
  const [first, ...rest] = offer.offeredItems;
  const offered = sideOf(first ?? null, offer.offeredLeaves);
  const offeredSide =
    first && rest.length > 0 && !(offer.offeredLeaves && offer.offeredLeaves > 0)
      ? { ...offered, title: copy.tradeCard.itemPlusMore(first.title, rest.length) }
      : offered;
  const post = sideOf(offer.post, null);
  return offer.direction === "sent"
    ? { give: offeredSide, get: post }
    : { give: post, get: offeredSide };
}

/**
 * The hub the two of them are meeting at, if one is named: the AGREED plan
 * first, then the claim. Never an unanswered proposal — that is one person's
 * suggestion, not a place both have said yes to.
 */
function namedHub(trade: ActiveTrade): string | null {
  if (trade.meetup?.agreedAt) return trade.meetup.hub.name;
  return trade.safeZoneHub?.name ?? null;
}

const enc = encodeURIComponent;

/** The one trade screen, for a trade row or for an offer that is not a trade yet. */
export const tradeHref = (tradeId: string) => `/trade?id=${enc(tradeId)}`;
export const offerHref = (offerId: string) => `/trade?offer=${enc(offerId)}`;

/**
 * The four-step track for ANY trade, not only a "Your move" card — the trade
 * screen draws it in every state. Same mapping as `yourMoveCard()`:
 *
 *   PENDING (request or offer)     Accepted is current
 *   ACCEPTED, no agreed hub        Hub set is current, amber
 *   ACCEPTED, hub agreed           Handoff is current
 *   CONFIRMING                     Handoff; Hub set dashed if none was agreed
 *   COMPLETED                      all four, Done current
 *
 * Null for a trade that ended without a swap: there is no step to be on.
 */
export function tradeProgress(trade: ActiveTrade): CardProgress | null {
  const hubAgreed = !!trade.meetup?.agreedAt;
  switch (trade.status) {
    case "PENDING":
      return { current: 0, done: [false, false, false, false], tone: "forest" };
    case "ACCEPTED":
      return hubAgreed
        ? { current: 2, done: [true, true, false, false], tone: "forest" }
        : { current: 1, done: [true, false, false, false], tone: "amber" };
    case "CONFIRMING":
      return { current: 2, done: [true, hubAgreed, false, false], tone: "forest" };
    case "COMPLETED":
      return {
        current: 3,
        done: [true, hubAgreed || !!trade.safeZoneHub, true, true],
        tone: "forest",
      };
    default:
      return null;
  }
}

export const OFFER_PROGRESS: CardProgress = {
  current: 0,
  done: [false, false, false, false],
  tone: "forest",
};

/**
 * Whether a CONFIRMING trade has a code to show at `nowSec` (server-corrected
 * epoch seconds, from lib/live-clock).
 *
 *   live     codesLive on the wire and the window still open: "Show code".
 *   locked   wrong guesses spent the pair but its window is open.
 *   expired  everything else — the window closed, possibly while this screen
 *            sat open, which is why it is a function of the clock and not
 *            only of the response.
 *
 * Both non-live phases open the same trade screen, whose code panel issues a
 * fresh pair on arrival exactly as it always has.
 */
export type CodePhase = "live" | "locked" | "expired";

export function codePhase(trade: ActiveTrade, nowSec: number): CodePhase {
  const until = trade.codesExpireAt ? Date.parse(trade.codesExpireAt) / 1000 : null;
  const open = until !== null && nowSec < until;
  if (open && trade.codesLive) return "live";
  return open ? "locked" : "expired";
}

/**
 * A "Your move" card. The step mapping is the one written up for review (1 Oct 2026).
 *
 * `phase` is the screen's live reading of `codePhase()` for a `kind: "code"`
 * item; without one, the response's own `codesLive` decides.
 */
export function yourMoveCard(item: NeedsItem, phase?: CodePhase): CardWords {
  if (item.kind === "offer") {
    const offer = item.offer;
    const partner = firstName(offer.counterparty.name);
    return {
      partner,
      since: copy.waiting.since(new Date(offer.createdAt)),
      ...offerSides(offer),
      progress: OFFER_PROGRESS,
      footer: copy.tradeCard.replyToOffer(partner, replyBy(offer.createdAt)),
      action: {
        label: copy.tradeCard.action.review,
        tone: "forest",
        href: offerHref(offer.id),
        a11y: `Review the offer from ${offer.counterparty.name}`,
      },
      waitingOn: null,
      open: offerHref(offer.id),
    };
  }

  const trade = item.trade;
  const partner = firstName(trade.counterparty.name);
  const base = {
    partner,
    since: copy.waiting.since(new Date(trade.createdAt)),
    ...tradeSides(trade),
    waitingOn: null,
    open: tradeHref(trade.id),
  };

  if (item.kind === "trade-request") {
    return {
      ...base,
      progress: { current: 0, done: [false, false, false, false], tone: "forest" },
      footer: copy.tradeCard.replyToRequest(partner),
      action: {
        label: copy.tradeCard.action.review,
        tone: "forest",
        href: tradeHref(trade.id),
        a11y: `Review the swap request from ${trade.counterparty.name}`,
      },
    };
  }

  const codeAction = {
    label: copy.tradeCard.action.showCode,
    tone: "forest" as const,
    href: tradeHref(trade.id),
    a11y: `Open the confirmation code for ${trade.counterparty.name}`,
  };

  if (item.kind === "code") {
    const hub = namedHub(trade);
    const hubAgreed = !!trade.meetup?.agreedAt;
    const progress: CardProgress = { current: 2, done: [true, hubAgreed, false, false], tone: "forest" };
    const now = phase ?? (trade.codesLive ? "live" : "expired");
    if (now !== "live") {
      return {
        ...base,
        progress,
        footer:
          now === "locked"
            ? copy.tradeCard.startHandoffWith(partner, hub)
            : copy.tradeCard.codesExpired(partner, hub),
        action: {
          label: copy.tradeCard.action.startHandoff,
          tone: "forest",
          href: tradeHref(trade.id),
          a11y: `Start the handoff with ${trade.counterparty.name}`,
        },
      };
    }
    return {
      ...base,
      progress,
      footer: hub ? copy.tradeCard.showCodeAt(partner, hub) : copy.tradeCard.showCodeNoHub(partner),
      action: codeAction,
    };
  }

  // kind === "meetup": an ACCEPTED trade, in one of the three states that are
  // the viewer's move. `buildTradesModel()` never files "waiting-on-them" here.
  const state = meetupState(trade);
  const plan = trade.meetup;
  if (state === "agreed" && plan) {
    return {
      ...base,
      progress: { current: 2, done: [true, true, false, false], tone: "forest" },
      footer: `${copy.tradeCard.showCodeAt(partner, plan.hub.name)} · ${meetupWhen(new Date(plan.at))}`,
      action: codeAction,
    };
  }

  const meetupHref = `/trade-meetup?id=${enc(trade.id)}`;
  if (state === "yours-to-answer" && plan) {
    return {
      ...base,
      progress: { current: 1, done: [true, false, false, false], tone: "amber" },
      footer: copy.tradeCard.theySuggested(partner, plan.hub.name, meetupWhen(new Date(plan.at))),
      action: {
        label: copy.tradeCard.action.answer,
        tone: "amber",
        // Agree / Suggest another live on the trade screen's hub step.
        href: tradeHref(trade.id),
        a11y: `Answer ${trade.counterparty.name}'s suggested meeting`,
      },
    };
  }

  return {
    ...base,
    progress: { current: 1, done: [true, false, false, false], tone: "amber" },
    footer: copy.tradeCard.pickHub(partner),
    action: {
      label: copy.tradeCard.action.pickHub,
      tone: "amber",
      href: meetupHref,
      a11y: `Pick a hub to meet ${trade.counterparty.name}`,
    },
  };
}

/** A "Waiting on them" card: no track; the hub and time if set, and who it is with. */
export function waitingCard(item: WaitingItem): CardWords {
  if (item.kind === "sent-offer") {
    const offer = item.offer;
    const partner = firstName(offer.counterparty.name);
    return {
      partner,
      since: copy.waiting.since(new Date(offer.createdAt)),
      ...offerSides(offer),
      progress: null,
      footer: copy.tradeCard.noHub,
      action: null,
      waitingOn: copy.tradeCard.toConfirm(partner),
      open: offerHref(offer.id),
    };
  }

  const trade = item.trade;
  const partner = firstName(trade.counterparty.name);
  // An unanswered proposal the VIEWER made still names a place and time — it is
  // the thing the other person is being asked to confirm.
  const plan = trade.meetup;
  const footer = plan
    ? copy.tradeCard.hubAndTime(plan.hub.name, meetupWhen(new Date(plan.at)))
    : (namedHub(trade) ?? copy.tradeCard.noHub);
  return {
    partner,
    since: copy.waiting.since(new Date(trade.createdAt)),
    ...tradeSides(trade),
    progress: null,
    footer,
    action: null,
    waitingOn: copy.tradeCard.toConfirm(partner),
    open: tradeHref(trade.id),
  };
}

/**
 * A card on the pushed Waiting screen. Same item, same grouping as the tab's
 * `waitingCard()` — what changes is the footer, which says what the VIEWER did
 * ("You suggested Marigondon Hall") and, on the right, whose move it is now.
 */
export function waitingScreenCard(item: WaitingItem): CardWords {
  const card = waitingCard(item);
  const partner = card.partner;

  if (item.kind === "sent-offer") {
    return {
      ...card,
      footer: copy.tradeCard.youSentOffer,
      footerDetail: null,
      waitingOn: copy.tradeCard.toAnswer(partner),
    };
  }

  const trade = item.trade;
  if (trade.status === "PENDING") {
    return {
      ...card,
      footer: copy.tradeCard.youSentRequest,
      footerDetail: null,
      waitingOn: copy.tradeCard.toAnswer(partner),
    };
  }
  if (trade.status === "CONFIRMING") {
    return {
      ...card,
      footer: copy.tradeCard.youEnteredCode,
      footerDetail: namedHub(trade),
      waitingOn: copy.tradeCard.toConfirm(partner),
    };
  }
  // ACCEPTED with the viewer's own suggestion unanswered — the only ACCEPTED
  // state `buildTradesModel()` files under Waiting.
  const plan = trade.meetup;
  return {
    ...card,
    footer: plan ? copy.tradeCard.youSuggested(plan.hub.name) : copy.tradeCard.noHub,
    footerDetail: plan ? meetupWhen(new Date(plan.at)) : null,
    waitingOn: copy.tradeCard.toConfirm(partner),
  };
}

/**
 * One row on Finished trades (1 Oct 2026 redesign): "With Aya", then
 * `21 Sep · codes matched 21:23` for a completed trade, or
 * `5 Jul · Your 800 Leaves ⇄ Levi's Blue Cap` for one that ended without a swap.
 *
 * REJECTED and CANCELLED both sit under "Called off" on the switch, but the
 * chip keeps them apart — "Declined" is the other person saying no, "Called
 * off" is the trade being ended. They are never collapsed into one word.
 */
export function finishedRowWords(
  trade: ActiveTrade,
  clock: (at: number) => string,
): {
  partner: string;
  meta: string;
  give: CardSide;
  get: CardSide;
  chip: string | null;
} {
  const partner = firstName(trade.counterparty.name);
  const sides = tradeSides(trade);
  const when = new Date(trade.updatedAt);

  if (trade.status === "COMPLETED") {
    const matched = trade.codesMatchedAt ? Date.parse(trade.codesMatchedAt) : when.getTime();
    return {
      partner,
      ...sides,
      meta: copy.history.tradedMeta(new Date(matched), clock(matched)),
      chip: null,
    };
  }
  return {
    partner,
    ...sides,
    meta: `${shortDate(when)} · Your ${sides.give.title} ⇄ ${sides.get.title}`,
    chip: trade.status === "REJECTED" ? copy.history.declinedChip : copy.history.calledOffChip,
  };
}

/* ───────────────────────── re-exports for the screens ───────────────── */

export { firstName, grouped, shortDate, swapLine, offerSwapLine, offerFeeLine, tradeFeeLine };
