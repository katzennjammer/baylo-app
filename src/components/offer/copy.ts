/**
 * §10 — the copy, verbatim, as rewritten for bracket trading on 17 Sep 2026.
 *
 * ── WHY THE STRINGS ARE A MODULE AND NOT INLINE JSX ─────────────────────────
 *
 * The spec's own framing: "Copy, verbatim … the strings are part of the spec,
 * not placeholders." Putting them in one file means a wording change is a diff
 * against §10 rather than a search across fifteen components.
 *
 * ── THE RULES §10 SETS FOR ITSELF, WHICH ANYTHING ADDED HERE MUST KEEP ──────
 *
 *   Filipino English. No exclamation marks. Nothing congratulates.
 *   Numbers are bare (`480`); `Leaves` appears once per context, not per figure.
 *   Never `unfortunately`, never `you can't afford`, never `only`, and never a
 *   comparison to other traders.
 *   Never, in the out-of-reach area: `locked`, `unavailable`, `you can't`,
 *   `too expensive`, `upgrade`, `unlock`, or any figure describing the user's
 *   total worth.
 *
 * ── WHAT CHANGED WITH BRACKET TRADING ───────────────────────────────────────
 *
 * The five gap copies, the settlement rows, the DPA proposal, the creditor's
 * record and the tier ceiling table are gone: there is no gap to settle. An
 * offer is the same bracket, one below or one above, and a bridge in either
 * direction is a flat fee the lower side pays. Every sentence about an item in
 * this flow — either side's — names its BRACKET, never its value. Exact
 * figures are shown on the owner's own listing page and in the post wizard,
 * and nowhere in the offer or trade flow.
 */

import { bracketLabel, bracketsWord, PREMIUM_MIN_BRACKET } from "../../lib/brackets";
import { grouped } from "../../lib/gap";
import type { OfferLegality } from "../../lib/trade-rules";

/** `Marco A.` → `Marco`. The spec addresses people by first name throughout. */
export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full.trim();
}

/* ───────────────────── §10.1 offer flow — the chrome ────────────────── */

export const chrome = {
  navTitle: "Offer trade",
  sheetHeading: "Which item are you offering",
  sheetFootnote:
    "You can offer an item in the same bracket, one below, or one above. " +
    "Items already promised to another trade don't appear here.",
  sheetButton: "Use this item",
  itemRowAction: "Change",
  messagePlaceholder: "Add a message (optional)",
  messageOptional: "Optional",
  hubSubtitle: "Safe-Zone Hub",
} as const;

/** §10.1's section labels. */
export const label = {
  offering: "You're offering",
  brackets: "The brackets",
  message: "Your message",
  meet: "Where you'll meet",
  whatYouSent: "What you sent",
  /** §7.3 / §10.8. */
  whereYouStand: "Where you stand",
} as const;

/** The sheet subtitle: `For Marco's Nike Air Max 90, in Bracket 3.` */
export function sheetSubtitle(owner: string, title: string, bracket: number): string {
  return `For ${owner}'s ${title}, in ${bracketLabel(bracket)}.`;
}

/** §10.1's counter: `124 / 400`. */
export function messageCounter(used: number, max: number): string {
  return `${used} / ${max}`;
}

/* ─────────────────────── §10.1 buttons and footnotes ────────────────── */

export const button = {
  send: "Send offer",
  /** The proposer-pays bridge: the fee is named on the button, once. */
  sendWithFee: (fee: number) => `Send offer · ${grouped(fee)}-Leaf fee`,
  /** Inside the consent sheet. Disabled until the box is ticked. */
  propose: "Propose",
  accept: "Accept",
} as const;

export const footnote = {
  /** `Marco has three days to reply.` */
  threeDays: (owner: string) => `${owner} has three days to reply.`,
  /** `20 Leaves held from 310 until Marco replies.` The proposer-pays bridge. */
  heldFrom: (held: number, balance: number, owner: string) =>
    `${grouped(held)} Leaves held from ${grouped(balance)} until ${owner} replies.`,
  /** The up-bridge note the spec names: `Marco will pay a 30-Leaf bridging fee to accept.` */
  theyPay: (owner: string, fee: number) =>
    `${owner} will pay a ${grouped(fee)}-Leaf bridging fee to accept.`,
} as const;

/* ─────────────────────── the bracket section, per case ──────────────── */

/**
 * The one paragraph under `The brackets`, for each of the three legal cases.
 *
 * Both items are named by BRACKET; the paragraph is about the relationship
 * between the two, which is a sentence about brackets.
 */
export const bracket = {
  /** The figure column: `Same bracket` / `One below` / `One above`. */
  figure: (legality: OfferLegality): string => {
    switch (legality) {
      case "same":
        return "Same bracket";
      case "bridgeUp":
        return "One below";
      case "bridgeDown":
        return "One above";
      case "tooLow":
        return "Two or more below";
      case "tooHigh":
        return "Two or more above";
    }
  },
  /** The mono suffix beside it: `Bracket 3 for Bracket 3`. */
  suffix: (offered: number, target: number) =>
    `${bracketLabel(offered)} for ${bracketLabel(target)}`,
  same: (owner: string) =>
    `Both items sit in the same bracket, so this is a straight swap. Nothing is held and ` +
    `nothing changes hands but the items. ${owner} decides.`,
  /** The proposer pays. `fee` is 10 × the proposer's own bracket. */
  bridgeUp: (fee: number, balance: number, owner: string) =>
    `Your item is one bracket below ${owner}'s, so a ${grouped(fee)}-Leaf bridging fee makes ` +
    `up the difference. It is held from your ${grouped(balance)} when you send and goes to ` +
    `${owner} when the swap completes. If ${owner} declines or the offer expires, it comes back.`,
  /** The receiver pays. `fee` is 10 × the receiver's own bracket. */
  bridgeDown: (fee: number, owner: string) =>
    `Your item is one bracket above ${owner}'s. ${owner} will pay a ${grouped(fee)}-Leaf ` +
    `bridging fee to accept, which comes to you when the swap completes. Nothing is held ` +
    `from you.`,
  /** The proposer cannot cover the fee. `need` vs `have`, and no send. */
  short: (fee: number, balance: number) =>
    `This bridge needs ${grouped(fee)} Leaves and you hold ${grouped(balance)}. Complete a ` +
    `trade or a task to earn more, or offer an item in the same bracket instead.`,
} as const;

/* ───────────────── the picker: why a row is greyed ──────────────────── */

/**
 * The one short reason under a greyed picker row. Short because there are
 * usually several of them on one sheet and a sentence each is a wall.
 */
export const picker = {
  tooLow: "Two or more brackets below",
  tooHigh: "Two or more brackets above",
  unvalued: "Value not loaded",
  notAvailable: "Promised to another trade",
  /** The row's own line: `Bracket 3`. No value — see §2: none in the offer flow, either side. */
  rowMeta: (bracket: number) => bracketLabel(bracket),
} as const;

/* ─────────────────── the bridge consent sheet ───────────────────────── */

/**
 * The sheet that stands between a paying party and their tap. It appears on
 * SEND for a proposer paying a bridge and on ACCEPT for a receiver paying one,
 * and it appears for nobody else — a same-bracket offer never sees it.
 *
 * Everything the spec asks it to state is a function of two numbers: the fee
 * and the balance. The checkbox label is the sentence the server records the
 * user as having agreed to, under `TRADING_POLICY_VERSION`.
 */
export const consent = {
  headingSend: "Before you send",
  headingAccept: "Before you accept",
  /** `Bracket 2 for Bracket 3 · 20-Leaf bridging fee` */
  terms: (yours: number, theirs: number, fee: number) =>
    `${bracketLabel(yours)} for ${bracketLabel(theirs)} · ${grouped(fee)}-Leaf bridging fee`,
  bodySend: (owner: string) =>
    `The fee is held now and goes to ${owner} when the swap completes. If ${owner} declines, ` +
    `or the offer expires after three days, it comes back to you in full.`,
  bodyAccept: (sender: string) =>
    `The fee is held now and goes to ${sender} when the swap completes. If the trade is ` +
    `cancelled before then, it comes back to you in full.`,
  balanceNow: "Your balance now",
  balanceAfter: "After the fee",
  checkbox: "I agree to the bridging fee and the trading policy",
  policyLink: "Read the trading policy",
  /** The insufficient-balance variant. No button; these two lines instead. */
  shortHeading: "Not enough Leaves for this bridge",
  shortBody: (need: number, have: number) =>
    `You need ${grouped(need)} and you hold ${grouped(have)}. Complete a trade or a task to ` +
    `earn more, or choose an item in the same bracket.`,
  need: "You need",
  have: "You hold",
  cancel: "Not now",
} as const;

/* ───────────────────────── §10.5 the seven states ───────────────────── */

/** §10.5 "No items". */
export const noItems = {
  heading: "You need something to offer first",
  body:
    "A trade in Baylo is one item for another, so nothing can be sent until you have a " +
    "listing of your own. Post one item and this offer takes about a minute.",
  step1: "Photograph it and post it. Baylo suggests a value.",
  step2: (owner: string, theirItem: string) =>
    `Come back here. We'll keep ${owner}'s ${theirItem} saved for you.`,
  primary: "Post your first item",
} as const;

/**
 * A shelf with items, none of which may be offered on THIS listing — every
 * one of them two or more brackets away. Distinct from "no items": the fix is
 * not to post, it is to post or trade closer to this bracket.
 */
export const noneInRange = {
  heading: (bracket: number) => `Nothing on your shelf is within a bracket of ${bracketLabel(bracket)}`,
  body:
    "An offer can be the same bracket as the listing, one below, or one above. " +
    "Your items are all further off than that.",
  above: "This listing is above everything you have posted. Trade closer to what you own first.",
  below: "This listing is below everything you have posted. Post something smaller, or find a listing nearer your own.",
} as const;

/**
 * The tier's item cap — the server's `enforceItemValueCeiling()`, in brackets.
 * The server enforces it on POST /api/offers; this is the sentence that saves
 * somebody from composing an offer it will refuse.
 */
export const tierCap = {
  heading: (tier: string, capBracket: number) =>
    `A ${tier} can trade for items up to ${bracketLabel(capBracket)}`,
  body: (listingBracket: number) =>
    `This listing is in ${bracketLabel(listingBracket)}. The limit rises with completed ` +
    `trades — it isn't about this item.`,
} as const;

/** §10.5 "Pending offer". */
export const pending = {
  heading: "You already have an offer on this",
  /**
   * `Sent two days ago. Marco has until Tuesday to reply, then it expires on
   * its own.` — the elapsed phrase and the weekday are both computed.
   */
  body: (sentAgo: string, owner: string, weekday: string) =>
    `Sent ${sentAgo}. ${owner} has until ${weekday} to reply, then it expires on its own.`,
  /** `Bracket 2 for Bracket 3 · 20 Leaves held` / `· no fee` / `· Marco pays 30 on accepting` */
  termsHeld: (fee: number) => `${grouped(fee)} Leaves held`,
  termsFree: "no fee",
  termsTheyPay: (owner: string, fee: number) => `${owner} pays ${grouped(fee)} on accepting`,
  leaveIt: "Leave it as it is",
} as const;

/** §10.5 "Sending" and "Send failed". */
export const sending = {
  label: "Sending",
  footnote: (held: number) => (held > 0 ? `Holding ${grouped(held)} Leaves` : "Sending your offer"),
} as const;

export const sendFailed = {
  heading: "The offer didn't send",
  /** `…your 20 Leaves were released back to your balance…` */
  body: (owner: string, held: number) =>
    `The connection dropped partway. Nothing reached ${owner}, ` +
    (held > 0 ? `your ${grouped(held)} Leaves were released back to your balance, ` : "") +
    `and the offer is still here exactly as you built it.`,
  retry: "Try sending again",
  keep: "Keep it and send later",
} as const;

/* ─────────────────────────── §10.8 out-of-reach ─────────────────────── */

export const reach = {
  /**
   * `Bracket 6 · 2 brackets above your reach`. The tile's out-of-reach line.
   *
   * A BRACKET, NOT A FIGURE. The grid shows brackets (see
   * `src/lib/brackets.ts`), and the distance is in the same unit as the value
   * beside it, or the two would contradict.
   */
  tileValue: (bracket: number, above: number) =>
    `${bracketLabel(bracket)} · ${bracketsWord(above)} above your reach`,
  label: label.whereYouStand,
  /** Both items by bracket. Nothing in the trade flow prints an exact value. */
  body: (highestTitle: string, highestBracket: number, reachTo: number, listingBracket: number) =>
    `This one is further than your items reach on their own. Your highest is the ` +
    `${highestTitle}, in ${bracketLabel(highestBracket)}, which can be offered up to ` +
    `${bracketLabel(reachTo)}. This listing is in ${bracketLabel(listingBracket)}, ` +
    `${bracketsWord(listingBracket - reachTo)} above that.`,
  /**
   * The empty-shelf variant. §10.8's paragraph names "your highest item", which
   * cannot be written for a viewer who has posted nothing.
   */
  emptyHeading: "You haven't posted anything yet",
  emptyBody: (reachTo: number, listingBracket: number) =>
    `Your reach starts at ${bracketLabel(reachTo)} until you post something. ` +
    `This item is in ${bracketLabel(listingBracket)}, ` +
    `${bracketsWord(listingBracket - reachTo)} above that.`,
  /** The two legend labels either end of the bracket ticks. */
  legendYours: (title: string, bracket: number) => `Your ${title} · ${bracketLabel(bracket)}`,
  /** Left legend label when there is no item to name — the ticks start at the floor. */
  legendStarting: "Starting reach",
  legendTheirs: (bracket: number) => bracketLabel(bracket),
  /** The empty-shelf route. Posting is the real fix: the reach is one bracket above the highest posted item. */
  routePost: "Post an item",
  routePostSub:
    "Your reach is one bracket above your highest posted item, so a single listing moves the line.",
  routeTradeUp: "Trade up to it",
  routeTradeUpSub:
    "An offer can go one bracket up at a time. A trade or two near your own value moves the line.",
  footnote: "This listing is outside your current reach. Trade closer to what you own first.",
  button: "Offer a trade",
} as const;

/**
 * The premium lock on item detail and the composer.
 *
 * ── WHAT THIS STATE MUST NOT DO ─────────────────────────────────────────────
 *
 * It must not imply a purchase is possible today: no price, no "Upgrade" or
 * "Subscribe" control, no button that leads nowhere. There is no billing yet
 * and a control that pretends there is would be a promise the app cannot keep.
 * And it must not make the listing feel hidden — the photo, title, bracket,
 * owner, hubs, share, comments and likes are all untouched. The lock explains
 * the CONTROL, not the listing. `locked` is used here and nowhere else in the
 * offer area, and only because this one is a lock.
 */
export const premium = {
  bar: "Premium needed to trade here",
  heading: "Trading at bracket 7 and above needs a premium subscription",
  body: (bracket: number, owner: string) =>
    `This listing is in ${bracketLabel(bracket)}. Premium is coming soon — there is nothing ` +
    `to buy yet, and nothing here is hidden. ${owner}'s listing stays in view; only proposing ` +
    `on it is locked until then.`,
  a11y: (bracket: number) =>
    `Offer locked. Trading at bracket ${PREMIUM_MIN_BRACKET} and above needs a premium ` +
    `subscription, which is coming soon. This listing is in ${bracketLabel(bracket)}.`,
} as const;

/** §10.8 — the one-time prompt. */
export const prompt = {
  heading: "Why some listings look faded",
  body:
    "Those ones are further than your items reach on their own right now. " +
    "We keep them in view on purpose, so you can see what things are worth around here.",
  exampleNear: "within reach",
  exampleFar: "further off",
  step1: "Faded ones open like any other listing, but you cannot offer on them yet.",
  step2:
    "An offer can be the same bracket as the listing, one below, or one above. " +
    "A bridge one way or the other is a small fee the lower side pays.",
  step3: "The line moves as you post and trade. Nothing is fixed.",
  button: "Got it",
} as const;

/* ─────────────────────────────── helpers ────────────────────────────── */

/**
 * `4` → `"four"`, up to twelve, then digits.
 *
 * The spec spells small counts and leaves Leaf figures as bare numerals,
 * which is the same distinction ordinary prose makes. Twelve is where it
 * stops because that is where spelling stops helping.
 */
const WORDS = [
  "zero", "one", "two", "three", "four", "five", "six",
  "seven", "eight", "nine", "ten", "eleven", "twelve",
] as const;

export function spellCount(n: number): string {
  return n >= 0 && n < WORDS.length ? WORDS[n] : grouped(n);
}

/**
 * §10.5's `Sent two days ago`.
 *
 * Spelled and lower-cased to sit inside a sentence, which is why
 * `relativeShort()` ("2d ago") and `relativeLong()` ("2 days ago") in
 * `src/lib/format.ts` are both wrong here.
 */
export function sentAgo(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "recently";
  const mins = Math.max(0, Math.floor((now - then) / 60_000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${spellCount(mins)} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${spellCount(hours)} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${spellCount(days)} ${days === 1 ? "day" : "days"} ago`;
}

const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

/**
 * §10.1's "three days to reply", and the server agrees: `OFFER_EXPIRY_DAYS` in
 * the server's @/lib/offers is 3 and a lazy sweep enforces it. A HAND-KEPT
 * MIRROR: if the window moves there it must move here, or the weekday this
 * renders is not the day the offer dies.
 */
export const OFFER_REPLY_DAYS = 3;

export function replyBy(sentIso: string): string {
  const sent = Date.parse(sentIso);
  if (Number.isNaN(sent)) return "the deadline";
  const due = new Date(sent + OFFER_REPLY_DAYS * 86_400_000);
  const daysOut = Math.round((due.getTime() - Date.now()) / 86_400_000);
  if (daysOut > 6 || daysOut < 0) {
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${due.getDate()} ${MONTHS[due.getMonth()]}`;
  }
  return WEEKDAYS[due.getDay()];
}
