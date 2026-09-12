/**
 * §10 — the copy, verbatim.
 *
 * ── WHY THE STRINGS ARE A MODULE AND NOT INLINE JSX ─────────────────────────
 *
 * The spec's own framing: "Copy, verbatim … the strings are part of the spec,
 * not placeholders." Putting them in one file means a wording change is a diff
 * against §10 rather than a search across fifteen components, and it makes the
 * two places where a string CANNOT be verbatim visible instead of buried.
 *
 * ── WHAT "VERBATIM" MEANS WHERE THE SPEC WRITES AN EXAMPLE ──────────────────
 *
 * §10 is written against one worked example — Marco's Air Max at 480, a 310
 * balance, a 40 gap. The names and figures are the example's, the sentences are
 * the spec's. So every function below reproduces the SENTENCE exactly and
 * substitutes the example's numbers for the real ones. Where the spec writes
 *
 *     You hold 310 Leaves, so this one is covered.
 *
 * this file writes `You hold ${balance} Leaves, so this one is covered.` and
 * nothing else moves — not a comma, not "so", not the full stop.
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
 * ── THE TWO PLACES A STRING IS NOT §10's ────────────────────────────────────
 *
 * Both are marked NOT VERBATIM where they appear, and both exist because §10
 * writes a sentence that would be FALSE against this server:
 *
 *   `tierCeilingHeading`  §10.5 says "A New Trader can promise up to 200". The
 *                         server's New Trader ceiling is 0 and `mayProposeDpa`
 *                         is false — a New Trader cannot promise at all, at any
 *                         item cap, because a DPA is enforced only
 *                         reputationally and somebody with no completed trades
 *                         has no reputation to forfeit. A sentence promising 200
 *                         would be a promise the server refuses, which is
 *                         precisely what §5.2's "show the gate" premise exists
 *                         to prevent.
 *   `promiseUnavailable`  §10.5's "Not verified" block covers one refusal. The
 *                         server has five more (min trades, tier, one open
 *                         contract, no headroom, standing default) and §10 does
 *                         not contemplate them. Each gets one sentence written
 *                         to §10's own rules above.
 */

import { bracketLabel, bracketsWord, PREMIUM_MIN_BRACKET } from "../../lib/brackets";
import { grouped } from "../../lib/gap";
import type { PromiseBlock } from "../../lib/gap";
import type { TrustTier } from "../../lib/trust";

/** `Marco A.` → `Marco`. The spec addresses people by first name throughout. */
export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full.trim();
}

/* ───────────────────── §10.1 offer flow — the chrome ────────────────── */

export const chrome = {
  navTitle: "Offer trade",
  sheetHeading: "Which item are you offering",
  sheetFootnote: "Items already promised to another trade don't appear here.",
  sheetButton: "Use this item",
  itemRowAction: "Change",
  messagePlaceholder: "Add a message (optional)",
  messageOptional: "Optional",
  hubSubtitle: "Safe-Zone Hub",
} as const;

/** §10.1's section labels. The three that carry a figure are functions. */
export const label = {
  offering: "You're offering",
  gap: "The gap",
  difference: "The difference",
  whatWorks: "What works instead",
  message: "Your message",
  meet: "Where you'll meet",
  willSee: (owner: string) => `What ${owner} will see`,
  record: (owner: string) => `${owner}'s record`,
  /**
   * §10.3's record block on the DPA proposal, which is the proposer's OWN.
   *
   * Not `record("Your")` — that renders "Your's record". §10.1 lists the label
   * only in its possessive form (`Dana's record`) because every place it names
   * is the other party's; the proposer's own copy of it needs its own string.
   */
  yourRecord: "Your record",
  openAgreements: "Open agreements",
  fromHere: "From here",
  ceilings: "Promise ceilings by tier",
  whatYouSent: "What you sent",
  settle: (amount: number) => `Settle the ${grouped(amount)}`,
  /** §7.3 / §10.8. */
  whereYouStand: "Where you stand",
} as const;

/** §10.1's sheet subtitle: `For Marco's Nike Air Max 90, worth 480 Leaves.` */
export function sheetSubtitle(owner: string, title: string, value: number): string {
  return `For ${owner}'s ${title}, worth ${grouped(value)} Leaves.`;
}

/** §10.1's counter: `124 / 400`. */
export function messageCounter(used: number, max: number): string {
  return `${used} / ${max}`;
}

/* ─────────────────────── §10.1 buttons and footnotes ────────────────── */

export const button = {
  send: "Send offer",
  sendWithLeaves: (n: number) => `Send offer with ${grouped(n)} Leaves`,
  setUpAgreement: "Set up the agreement",
  sendWithAgreement: "Send offer with agreement",
  sendAsIsAnyway: "Send as-is anyway",
  /**
   * §10.1's `Send with 310 and a 200 promise`, and §9's tight-board shortening
   * to `Send 310 + 200 promise`. Which one is used is a function of the board.
   */
  sendWithBoth: (now: number, promised: number, tight: boolean) =>
    tight
      ? `Send ${grouped(now)} + ${grouped(promised)} promise`
      : `Send with ${grouped(now)} and a ${grouped(promised)} promise`,
} as const;

export const footnote = {
  /** `Marco has three days to reply.` */
  threeDays: (owner: string) => `${owner} has three days to reply.`,
  /** `Leaves are held, not spent, until Marco replies.` */
  heldNotSpent: (owner: string) => `Leaves are held, not spent, until ${owner} replies.`,
  amountNext: "You'll name the amount and the deadline next.",
  /** `40 Leaves held from 310 until Marco replies.` */
  heldFrom: (held: number, balance: number, owner: string) =>
    `${grouped(held)} Leaves held from ${grouped(balance)} until ${owner} replies.`,
} as const;

/* ─────────────────────── §10.2 the five gap copies ──────────────────── */

/** §10.2 Even. The figure reads `Even` and the mono suffix `40 apart`. */
export const even = {
  body: "Close enough that there's nothing to settle. You can send this as a straight swap.",
  figure: "Even",
  suffix: (apart: number) => `${grouped(apart)} apart`,
} as const;

/**
 * §10.2 Offering more.
 *
 * `Your chair is worth 280 Leaves more than Marco's shoes.` — the two nouns are
 * the item titles, which is why both are parameters rather than one being the
 * word "item".
 */
export const over = {
  body: (yourItem: string, amount: number, owner: string, theirItem: string) =>
    `Your ${yourItem} is worth ${grouped(amount)} Leaves more than ${owner}'s ${theirItem}. ` +
    `You can still send it, and ${owner} can add Leaves to even it out — ` +
    `or you can offer something smaller.`,
  askLeaves: (owner: string, amount: number) => `Ask ${owner} to add ${grouped(amount)} Leaves`,
  asIs: "Send as-is, no settlement",
} as const;

/** §10.2 Small gap. */
export const small = {
  body: (balance: number) => `You hold ${grouped(balance)} Leaves, so this one is covered.`,
  addLeaves: (amount: number) => `Add ${grouped(amount)} Leaves from your balance`,
  /** `310 now · 270 after` */
  balanceAfter: (now: number, after: number) => `${grouped(now)} now · ${grouped(after)} after`,
  asIs: "Send as-is",
  asIsSub: (owner: string, amount: number) =>
    `${owner} decides whether the ${grouped(amount)} matters.`,
  promise: "Promise to settle later",
  promiseSub: "Deferred Points Agreement.",
} as const;

/** §10.2 Large gap. */
export const large = {
  body: (balance: number, after: number) =>
    `You hold ${grouped(balance)} Leaves. Covering all of it leaves you ${grouped(after)}.`,
  addAll: (amount: number) => `Add all ${grouped(amount)} from your balance`,
  split: (now: number, promised: number) =>
    `Add ${grouped(now)} now, promise ${grouped(promised)}`,
  splitSub: "Deferred Points Agreement for the rest.",
  promiseWhole: (amount: number) => `Promise the whole ${grouped(amount)}`,
  promiseWholeSub: "Nothing leaves your balance now.",
  asIs: "Send as-is",
  asIsSub: "Some traders accept a gap this size.",
} as const;

/**
 * §10.2 Very large gap.
 *
 * The body names the tier, so a Rising Trader is told what a Rising Trader can
 * commit to rather than what a New Trader can — the sentence is about the
 * reader, and §10's closing rule forbids a comparison to other traders.
 */
export const veryLarge = {
  body: (balanceCovers: number, leftToPromise: number, tier: TrustTier) =>
    `This is a long way apart. Your balance covers ${grouped(balanceCovers)} of it, ` +
    `which still leaves ${grouped(leftToPromise)} to promise — ` +
    `more than a ${tier} can commit to. Two things do work from here.`,
  multiItem: "Offer more than one item",
  /** `Your four items together come to 1,620.` — the count is spelled out. */
  multiItemSub: (count: number, total: number) =>
    `Your ${spellCount(count)} items together come to ${grouped(total)}.`,
  watch: "Watch this listing",
  /**
   * `Two more trades makes you Rising, which raises what you can promise to 900.`
   *
   * `moreTrades` is how many are still NEEDED, not the rung's threshold. The
   * sentence is about the reader's distance from the next tier, and printing the
   * threshold would tell somebody with two completed trades that they need three
   * more.
   */
  watchSub: (moreTrades: number, nextTier: string, nextCeiling: number) =>
    `${capitalise(spellCount(moreTrades))} more ${moreTrades === 1 ? "trade" : "trades"} ` +
    `makes you ${nextTier}, which raises what you can promise to ${grouped(nextCeiling)}.`,
  footnote: (yourItem: string, owner: string) =>
    `You can still send the ${yourItem} on its own. ${owner} will see the gap the same way you do.`,
} as const;

/* ────────────────────────── §10.3 DPA proposal ──────────────────────── */

export const dpa = {
  nav: "Deferred Points Agreement",
  intro: (owner: string) =>
    `A recorded promise to ${owner}. The trade goes ahead now; ` +
    `you settle the difference by the date you set.`,
  amountLabel: "Amount you'll settle",
  /**
   * §6g's button when the amount is empty. It names the missing thing rather
   * than greying out `Send with the agreement` and leaving the reader to work
   * out why — the control is the only place the gap can be stated at the moment
   * it matters.
   */
  amountMissing: "Set an amount to promise",
  deadlineLabel: "Settle by",
  /** `80 added now, 100 promised` · `max 400` */
  constraint: (now: number, promised: number) =>
    `${grouped(now)} added now, ${grouped(promised)} promised`,
  constraintMax: (max: number) => `max ${grouped(max)}`,
  datePickAnother: "Pick another date",
  recordTrades: "Trades completed",
  recordOnTime: "Settled on time",
  recordOwed: "Owed right now",
  consequence: (date: string, amount: number) =>
    `If you miss ${date} the agreement is marked defaulted, your tier drops, ` +
    `and the ${grouped(amount)} stays owed until you settle it.`,
  /** §8.1's keyboard summary: `Settle by 6 Oct · 7 trades · no defaults`. */
  keyboardSummary: (date: string, trades: number, defaults: number) =>
    `Settle by ${date} · ${trades} ${trades === 1 ? "trade" : "trades"} · ` +
    (defaults === 0 ? "no defaults" : `${defaults} ${defaults === 1 ? "default" : "defaults"}`),
} as const;

/* ─────────────────── §10.4 the owner accepting (creditor) ───────────── */

export const creditor = {
  nav: (debtor: string) => `Offer from ${debtor}`,
  /** `Her jacket 300 for your Air Max 480` — the possessive is the debtor's name. */
  summary: (debtor: string, theirItem: string, theirValue: number, yourItem: string, yourValue: number) =>
    `${debtor}'s ${theirItem} ${grouped(theirValue)} for your ${yourItem} ${grouped(yourValue)}`,
  summarySplit: (now: number, promised: number) =>
    `${grouped(now)} added now · ${grouped(promised)} promised`,
  notice: (amount: number, date: string) =>
    `This offer includes a promise to settle ${grouped(amount)} Leaves by ${date}.`,
  recordTrades: "Trades completed",
  recordOnTime: "Settled on time",
  recordDefaults: "Past defaults",
  recordOwed: "Owed right now",
  /** `5 of 6` */
  onTimeOf: (onTime: number, finished: number) => `${onTime} of ${finished}`,
  /** NULL onTimeRate means no history — never "0%". The server insists on this. */
  onTimeNone: "no history",
  /** `1, settled late` — a default that has since been paid. */
  defaultsSettled: (n: number) => `${n}, settled late`,
  defaultsStanding: (n: number) => `${n}, still owed`,
  defaultsNone: "none",
  /** `220 across 2` */
  owedAcross: (amount: number, count: number) => `${grouped(amount)} across ${count}`,
  owedNone: "nothing",
  footnote: (amount: number, debtor: string, total: number) =>
    `Accepting adds ${grouped(amount)} to what ${debtor} owes, making ${grouped(total)} in total. ` +
    `You can also accept the trade and waive the difference.`,
  decline: "Decline",
  accept: "Accept",
  acceptWaiving: (amount: number) => `Accept without the ${grouped(amount)}`,
} as const;

/* ───────────────────────── §10.5 offer flow states ──────────────────── */

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

/** §10.5 "Not verified". */
export const notVerified = {
  rowTitle: "Promise to settle later",
  rowSub: "Needs ID verification. Takes about five minutes.",
  button: "Verify your ID",
  footnote: "Verification is only for promises. Everything else in Baylo works without it.",
} as const;

/**
 * §10.5 "Tier too low" — the ceiling screen.
 *
 * NOT VERBATIM, and this is the first of the two places §10 has to be departed
 * from. The spec writes:
 *
 *     A New Trader can promise up to 200
 *
 * The server's `TIER_LIMITS["New Trader"]` is `maxOutstandingDebtLeaves: 0` with
 * `mayProposeDpa: false`. Printing "up to 200" would promise something POST
 * /api/v1/contracts refuses outright, which is the exact failure §5.2 exists to
 * prevent — "show the gate, don't let someone fill in a proposal and then get
 * 403'd". So the sentence is generated from the real ceiling, and the zero case
 * gets its own wording rather than "up to 0".
 *
 * The second and third sentences ARE §10.5's, unchanged.
 */
export const tierTooLow = {
  heading: (tier: TrustTier, ceiling: number) =>
    ceiling > 0
      ? `A ${tier} can promise up to ${grouped(ceiling)}`
      : `A ${tier} cannot promise yet`,
  body: (needed: number, ceiling: number) =>
    ceiling > 0
      ? `This gap needs ${grouped(needed)}, which is above that ceiling. ` +
        `The limit rises with completed trades — it isn't about this item.`
      : `This gap needs ${grouped(needed)}, and promises open up with completed trades — ` +
        `it isn't about this item.`,
  /** `you are here`, in `#1B4D2B` mono. The one coloured tier marker in the app. */
  youAreHere: "you are here",
  /** `3 trades` in the ceiling table's middle column. */
  tradesToReach: (n: number) => `${n} ${n === 1 ? "trade" : "trades"}`,
  noLimit: "no limit",
  /** `You have one completed trade. Two more moves you to Rising.` */
  progress: (completed: number, more: number, nextTier: string) =>
    `You have ${spellCount(completed)} completed ` +
    `${completed === 1 ? "trade" : "trades"}. ` +
    `${capitalise(spellCount(more))} more moves you to ${nextTier}.`,
  fromHereAdd: (leaves: number, promise: number) =>
    `Add ${grouped(leaves)} and promise ${grouped(promise)}`,
  fromHereAddSub: (remainder: number, owner: string) =>
    `Leaves ${grouped(remainder)} of the gap for ${owner} to accept or refuse.`,
  fromHereOther: "Offer a different item",
  fromHereOtherSub: (title: string, value: number) =>
    `Your ${title} at ${grouped(value)} closes most of this.`,
} as const;

/**
 * The five refusals §10 does not write copy for.
 *
 * NOT VERBATIM — the second departure, and the reason is the same as
 * `tierTooLow`: the server refuses for these reasons and the spec's only
 * drawn refusal is the ID gate. Each sentence follows §10.2's own stated rule —
 * name the number, name what the user already has, hand over a route — and
 * avoids every word §10 forbids.
 */
export function promiseUnavailable(block: PromiseBlock, s: {
  completedTrades: number;
  openContracts: number;
  outstandingDebt: number;
}): string | null {
  switch (block) {
    case "none":
      return null;
    case "idUnverified":
      return notVerified.rowSub;
    case "minTrades":
      return `Promises open after three completed trades. You have ${s.completedTrades}.`;
    case "tierMayNotPropose":
      return "Promises open at the next tier, which is three completed trades away.";
    case "openContract":
      return "You have one agreement open already. Settle it and this opens again.";
    case "noHeadroom":
      return `You are already promising ${grouped(s.outstandingDebt)}, which is your whole ceiling.`;
    case "unsettledDefault":
      return "An agreement of yours went past its date. Settling it opens this back up.";
  }
}

/** §10.5 "Pending offer". */
export const pending = {
  heading: "You already have an offer on this",
  /**
   * `Sent two days ago. Marco has until Tuesday to reply, then it expires on
   * its own.` — the elapsed phrase and the weekday are both computed.
   */
  body: (sentAgo: string, owner: string, weekday: string) =>
    `Sent ${sentAgo}. ${owner} has until ${weekday} to reply, then it expires on its own.`,
  leaveIt: "Leave it as it is",
} as const;

/** §10.5 "Sending" and "Send failed". */
export const sending = {
  label: "Sending",
  footnote: (held: number) => `Holding ${grouped(held)} Leaves`,
} as const;

export const sendFailed = {
  heading: "The offer didn't send",
  /** `…your 40 Leaves were released back to your balance…` */
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
   * A BRACKET, NOT A FIGURE. §10.8 wrote `2,000 Leaves · 860 above your reach`
   * when the grid showed exact values; it shows brackets now (see
   * `src/lib/brackets.ts`), and the distance is in the same unit as the value
   * beside it, or the two would contradict.
   */
  tileValue: (bracket: number, above: number) =>
    `${bracketLabel(bracket)} · ${bracketsWord(above)} above your reach`,
  label: label.whereYouStand,
  /**
   * The viewer's OWN highest item is named with its exact value — it is theirs
   * to know — and the listing is named by bracket only.
   */
  body: (highestTitle: string, highestValue: number, reachTo: number, listingBracket: number) =>
    `This one is further than your items reach on their own. Your highest is the ` +
    `${highestTitle} at ${grouped(highestValue)}, which reaches into ${bracketLabel(reachTo)}. ` +
    `This listing is in ${bracketLabel(listingBracket)}, ` +
    `${bracketsWord(listingBracket - reachTo)} above that. Two routes do work.`,
  /**
   * The empty-shelf variant. §10.8's paragraph names "your highest item", which
   * cannot be written for a viewer who has posted nothing — and that viewer is
   * exactly who the reach floor exists for: an empty shelf still reaches
   * bracket 2, so the grid still greys and the insert still owes an
   * explanation. The heading is the fact the paragraph would otherwise have to
   * dance around.
   */
  emptyHeading: "You haven't posted anything yet",
  emptyBody: (reachTo: number, listingBracket: number) =>
    `Your reach starts at ${bracketLabel(reachTo)} until you post something. ` +
    `This item is in ${bracketLabel(listingBracket)}, ` +
    `${bracketsWord(listingBracket - reachTo)} above that. Two routes work from here.`,
  /** The two legend labels either end of the bracket ticks. */
  legendYours: (title: string, value: number) => `Your ${title} ${grouped(value)}`,
  /** Left legend label when there is no item to name — the ticks start at the floor. */
  legendStarting: "Starting reach",
  legendTheirs: (bracket: number) => bracketLabel(bracket),
  /**
   * The empty-shelf variant's first route, in place of "Trade up to it" — two
   * trades near your own value is advice about a shelf, and this viewer has
   * none. Posting is the real fix: the reach is one bracket above the highest
   * posted item.
   */
  routePost: "Post an item",
  routePostSub:
    "Your reach is one bracket above your highest posted item, so a single listing moves the line.",
  routePromise: "Offer with a promise",
  routePromiseSub: (tier: TrustTier, ceiling: number, owner: string) =>
    ceiling > 0
      ? `A Deferred Points Agreement covers up to ${grouped(ceiling)} as a ${tier}, ` +
        `so a promise alone will not close this one. ` +
        `${owner} decides whether to take a part-promise.`
      : `A Deferred Points Agreement opens up with completed trades, ` +
        `so a promise alone will not close this one. ` +
        `${owner} decides whether to take a part-promise.`,
  routeTradeUp: "Trade up to it",
  routeTradeUpSub:
    "Two trades near your own value usually move the line further than one big offer does.",
  /**
   * Used to end "…{owner} sees the same numbers you do." That clause is gone:
   * the owner sees their own exact value and the viewer sees a bracket, so it
   * stopped being true. The half that survives is the half that makes this
   * insert an explanation rather than a refusal.
   */
  footnote: "You can send an offer regardless.",
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
  step1: "Faded ones open like any other listing, and you can still send an offer.",
  step2:
    "Inside, you'll see the distance and the two ways across it — " +
    "a promise to settle later, or trading up first.",
  step3: "The line moves as you post and trade. Nothing is fixed.",
  button: "Got it",
} as const;

/* ─────────────────────────────── helpers ────────────────────────────── */

/**
 * `4` → `"four"`, up to twelve, then digits.
 *
 * §10.2 writes "Your four items together come to 1,620" and §10.5 writes "You
 * have one completed trade. Two more moves you to Rising" — the spec spells
 * small counts and leaves Leaf figures as bare numerals, which is the same
 * distinction ordinary prose makes. Twelve is where it stops because that is
 * where spelling stops helping.
 */
const WORDS = [
  "zero", "one", "two", "three", "four", "five", "six",
  "seven", "eight", "nine", "ten", "eleven", "twelve",
] as const;

export function spellCount(n: number): string {
  return n >= 0 && n < WORDS.length ? WORDS[n] : grouped(n);
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * §10.5's `Sent two days ago`.
 *
 * Spelled and lower-cased to sit inside a sentence, which is why
 * `relativeShort()` ("2d ago") and `relativeLong()` ("2 days ago") in
 * `src/lib/format.ts` are both wrong here — the first is a card timestamp being
 * skimmed and the second capitalises nothing but does not spell.
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
 * §10.5's `Marco has until Tuesday to reply`.
 *
 * Three days from when the offer was sent — §10.1's footnote states the window
 * ("Marco has three days to reply") and this is the same window named as a day.
 * Past six days out a weekday stops being a date and starts being ambiguous, so
 * it falls back to the short date; three days can never reach that, and the
 * guard is there because the expiry window is a product decision that may move.
 */
/**
 * §10.1's "three days to reply", and the server now agrees.
 *
 * It used to be this client's own assumption — nothing expired an offer, so the
 * sentence "then it expires on its own" was false. `OFFER_EXPIRY_DAYS` in the
 * server's @/lib/offers is 3 and a lazy sweep enforces it on every read that
 * measures a balance, so this constant and that one describe the same deadline.
 * A HAND-KEPT MIRROR, like `TIER_LADDER`: if the window moves there it must move
 * here, or the weekday this renders is not the day the offer dies.
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
