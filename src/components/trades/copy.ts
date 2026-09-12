import { CODE_LENGTH } from "../../api/trades";
import { grouped, shortDate } from "../../lib/gap";
import { spellCount } from "../offer/copy";

/**
 * §10.6, §10.7 and the frames' own strings, verbatim.
 *
 * ── THE SAME RULES §10 SETS FOR ITSELF ──────────────────────────────────────
 *
 *   Filipino English. No exclamation marks. NOTHING CONGRATULATES — §1.10 is
 *   explicit that a matched code produces no success colour and no confetti, and
 *   the copy holds the same line: `Codes matched 15:42` is a fact with a
 *   timestamp, not a celebration.
 *   Numbers are bare (`480`); `Leaves` appears once per context, not per figure.
 *   Never `unfortunately`, never `you can't afford`, never `only`, and never a
 *   comparison to other traders.
 *
 * ── THE FOUR PLACES A STRING IS NOT §10's, AND WHY EACH IS NOT ──────────────
 *
 *   1. `askForDigits` / `yourCodeIs` / `emptyStep2` — §10.7 and §10.5 write
 *      "four digits" and "the four-digit codes". The server issues SIX
 *      (`randomDigits(6)`, `^\d{6}$`), so a sentence promising four would send
 *      somebody looking for a four-digit number in an email that holds six. The
 *      count is interpolated from `CODE_LENGTH` and everything else in the
 *      sentence is §10.7's, comma for comma. See gap 2 in `src/api/trades.ts`.
 *
 *   2. `whereYourCodeIs` — §10.7's `Your code is 4182` and §6.1's block of four
 *      cells both assume the app knows the viewer's own code. It does not and
 *      cannot: the plaintext exists in the email and in nothing else, and what is
 *      stored is a bcrypt hash. Rather than draw invented digits, this says where
 *      the code actually is. Gap 1.
 *
 *   3. `promise.extend` — a SECOND control beside `Settle`, which §6 does not
 *      contemplate because §6 assumes settling is the only thing a debtor does.
 *      Asking for more time is a real act with a real endpoint, and it needs a
 *      label §10 never wrote.
 *
 *   4. `historyOffersNote` — frame 9d shows three terminal offer states in
 *      History. No endpoint lists a DECLINED, WITHDRAWN or EXPIRED offer, so
 *      History draws the finished trades it can see and this line says, without
 *      apologising, what is not in the list.
 *
 * Every other string below is the spec's or the frame's, unchanged.
 */

/* ────────────────────────── §10.6 the list ──────────────────────────── */

export const nav = {
  /** §10.6. The 22px Bricolage large title, not a 15px nav title. */
  trades: "Trades",
  /** Frame 9c's pushed screen. */
  waiting: "Waiting",
  /** Frame 9d. Matches the History row's own label, so the push reads as a zoom. */
  history: "Finished trades",
  /** Frame 9j. */
  promises: "Promises",
  /** Frame 9e/9f/9g — `Meeting Marco A.`, and 9h's past tense. */
  meeting: (partner: string) => `Meeting ${partner}`,
  traded: (partner: string) => `Traded with ${partner}`,
  /** §10.4 / frame 9i. */
  offerFrom: (sender: string) => `Offer from ${sender}`,
} as const;

/** §10.6's three section labels, plus the four the frames add. */
export const label = {
  needsToday: "Needs you today",
  waiting: "Waiting",
  history: "History",
  /* Frame 9c splits Waiting into three when it is pushed full-screen. */
  offersToYou: "Offers to you",
  offersYouSent: "Offers you sent",
  /* Not offers. A PENDING TradeRequest — a swap proposed directly. */
  requestsToYou: "Swap requests to you",
  requestsYouSent: "Swap requests you sent",
  meetingToSet: "Accepted, meeting to set",
  /* Frame 9j's two halves. */
  youPromised: "You promised",
  owedToYou: "Owed to you",
  /* Frame 9h. */
  stillOpen: "Still open",
  /* §10.4 / frame 9i. */
  record: (name: string) => `${name}'s record`,
  openAgreements: (name: string) => `${name}'s open agreements`,
  /* §6 network error — the mono label over cached rows. */
  lastLoaded: (clock: string) => `Last loaded ${clock}`,
} as const;

/** §10.6's History row. */
export const history = {
  rowTitle: "Finished trades",
  /** `14 trades`. Singular at one, because "1 trades" is a bug people report. */
  count: (n: number, capped = false) =>
    capped ? `${n}+ trades` : `${n} ${n === 1 ? "trade" : "trades"}`,
  /** NOT VERBATIM — reason 4 in the header. */
  offersNote:
    "Offers that were declined, withdrawn or expired are not kept here. " +
    "Only finished trades are.",
  /** Frame 9d's completed row. */
  traded: (partner: string) => `Traded with ${partner}`,
  /** Frame 9d's mono second line. `8 Sep · codes matched 15:42` */
  tradedMeta: (date: Date, clock: string) => `${shortDate(date)} · codes matched ${clock}`,
  /** REJECTED — the receiver said no to the trade. */
  rejected: (partner: string) => `${partner} declined the trade`,
  /** CANCELLED — it was called off. */
  cancelled: "The trade was called off",
  plainMeta: (date: Date, line: string) => `${shortDate(date)} · ${line}`,
} as const;

/** §10.6's card lines, and the frames' third mono line. */
export const card = {
  /** §10.6 `Code ready · Marco A.` */
  codeReady: (partner: string) => `Code ready · ${partner}`,
  /** §10.6 `Ayala Center Cebu · today`. Falls back when no hub was named. */
  codeWhere: (hub: string | null) => (hub ? `${hub} · today` : "Meet-up point not named"),
  codeAction: "Open code",
  /** §10.6 `100 promised to Jess M.` */
  promised: (amount: number, creditor: string) => `${grouped(amount)} promised to ${creditor}`,
  /** Frame 9a's third line. */
  nothingSettled: "nothing settled yet",
  partSettled: (paid: number, total: number) => `${grouped(paid)} of ${grouped(total)} settled`,
  /** §10.6 `Offer from Renz P.` */
  offerFrom: (sender: string) => `Offer from ${sender}`,
  /**
   * A PENDING TradeRequest addressed to the viewer.
   *
   * §10 has no line for it — the spec is written against a world where every
   * trade starts as an offer, and one can also start on the web as a direct
   * request. Written to §10's own rules: names the party, names the act, no
   * exclamation, nothing congratulates.
   */
  tradeRequestFrom: (sender: string) => `Swap request from ${sender}`,
  /** The viewer's own outgoing one, waiting on the other side. */
  tradeRequestSent: (partner: string) => `Waiting for ${partner} to answer`,
  /** Frame 9m's cached row. */
  savedOnPhone: "saved on this phone",
  mayBeStale: "may be out of date",
} as const;

/** §10.6's Waiting rows, verbatim, plus the frames' right-hand mono. */
export const waiting = {
  /** §10.6 `Waiting for Marco · promise of 100` */
  forPartner: (partner: string, promise: number | null) =>
    promise !== null
      ? `Waiting for ${partner} · promise of ${grouped(promise)}`
      : `Waiting for ${partner}`,
  /** §10.6 `Sent 2 days ago · expires Tuesday` */
  sentExpires: (ago: string, weekday: string) => `Sent ${ago} · expires ${weekday}`,
  /** §10.6 `Accepted · meeting not set` */
  acceptedNoMeeting: "Accepted · meeting not set",
  /** Frame 9c's second line on that row. */
  pickAHub: (partner: string) => `With ${partner} · pick a hub`,
  /**
   * Frame 9c's second line on an accepted row.
   *
   * WAS `Codes appear once you both agree a time`, which was false in both
   * directions: nothing in the app watched for agreement, nothing made codes
   * appear on their own, and agreeing a time was not something the app could do
   * at all. It described a mechanism that did not exist, on the one row whose
   * missing tap made confirmation unreachable.
   *
   * What replaces it is what actually happens: opening the row issues the pair.
   */
  codesWhenReady: "Open this when you meet to get your codes",
  /** The control on that row. Opens `/trade-code`, which issues the codes. */
  getCodes: "Get codes",
  /** Frame 9a's right-hand mono, and frame 9c's `since 4 Sep`. */
  daysLeft: (n: number) => (n === 1 ? "1 day left" : `${n} days left`),
  lastDay: "today is the last day",
  since: (d: Date) => `since ${shortDate(d)}`,
  /** Frame 9c's line beside Withdraw. */
  nothingHeld: (partner: string) =>
    `If ${partner} does not reply it expires on its own. Nothing is held.`,
  leavesHeld: (partner: string, held: number) =>
    `If ${partner} does not reply it expires on its own. ${grouped(held)} Leaves come back.`,
  withdraw: "Withdraw",
  /** Ends a trade row and releases both items. Not the same act as a withdrawal. */
  cancel: "Call it off",
  accept: "Accept",
  decline: "Decline",
  /** Frame 9c's promise strip on an incoming offer. */
  includesPromise: (amount: number, date: Date) =>
    `Includes a promise to settle ${grouped(amount)} by ${shortDate(date)}`,
  readFirst: "Read the agreement first",
} as const;

/**
 * Arranging the meeting — gap 6's words.
 *
 * NOTHING HERE MAY CALL A PLAN A MEETING. "Meeting set" would be a claim about
 * the world; these two have agreed something on their phones and neither has
 * left the house. The Safe-Zone award reads a different column for that reason
 * and this copy keeps the same line: `agreed` describes the agreement, never the
 * meeting.
 */
export const meetup = {
  /** No plan yet. The control that starts one. */
  setIt: "Set a place and time",
  none: "No place or time yet",

  /** One proposal standing, made by the viewer. */
  waitingOnThem: (partner: string) => `Waiting for ${partner} to agree`,

  /** One proposal standing, made by the other person — the viewer's move. */
  theyProposed: (partner: string) => `${partner} suggested a place and time`,
  agree: "Agree",
  /** A counter is a proposal. There is no decline, and this is why it reads so. */
  suggestAnother: "Suggest another",

  /** Agreed by both. */
  agreed: "Agreed",
  change: "Change",

  /** `Parkmall · Sat, 14:00`. The one line that says what was arranged. */
  where: (hub: string, when: string) => `${hub} · ${when}`,

  /* ── The picker ──────────────────────────────────────────────────────── */
  pickHub: "Where",
  pickTime: "When",
  noteLabel: "Anything else (optional)",
  notePlaceholder: "the bench outside, I'll have the blue bag",
  propose: "Send this",
  counter: "Send this instead",
  /** Shown on a hub row that both listings name. */
  bothNamed: "You both offer this hub",
  /** A hub the other listing does not name — they will be seeing it for the first time. */
  newToThem: (partner: string) => `New to ${partner} — they can agree or suggest another`,
  /** A hub only the other listing names: fine for them, not on yours. */
  theyOffer: (partner: string) => `${partner} offers this hub`,
  /** Said once, above the rows, when the shared ones are not the whole list. */
  sharedEarns: "Meeting at a hub you both offer earns the Safe-Zone reward.",

  /* ── The empty intersection. NOT A DEAD END — the picker is still below. ── */
  noSharedTitle: "You have no hub in common yet",
  noSharedBody: (partner: string) =>
    `Your listing and ${partner}'s do not name the same Safe-Zone hub. You can still ` +
    `suggest any hub below — but only a meeting at one you both offer earns the ` +
    `Safe-Zone reward. Either of you can fix that by adding one to your own listing.`,
  /** The other listing's hubs — the shortlist worth adding from. */
  theyAlreadyOffer: (partner: string) => `${partner} already offers`,
  addToMine: "Add a hub to my listing",
  /** When even the other listing names none. */
  neitherHasHubs: (partner: string) =>
    `Neither listing names a Safe-Zone hub yet. Add one to yours and ask ${partner} to ` +
    `add the same one to theirs.`,
  /** When there is no hub anywhere — the server's list came back empty. */
  noHubsAtAll: "There are no Safe-Zone hubs to choose from right now. Agree a place in chat.",

  /* ── Failures the client branches on, by `meta.rule`. ─────────────────── */
  hubClosed: "That hub is closed at the moment. Pick another one.",
  planChanged: "That plan changed before you agreed. Have another look.",
} as const;

/** §10.6's `Nothing needs you right now.` — one 15px line, in place of the block. */
export const nothingPending = "Nothing needs you right now.";

/* ─────────────────────────── §10.6 empty ────────────────────────────── */

/**
 * §10.6's empty state, plus frame 9k's three numbered lines.
 *
 * §10.6 gives the heading, the body and the button. The frame adds three
 * numbered steps in the post flow's own `01 / 02 / 03` shape, which §5.2's "No
 * items" state already uses — so they are the same component, not a new idea.
 */
export const empty = {
  heading: "No trades yet",
  body:
    "When you send or accept an offer it shows up here, along with anything " +
    "that needs doing on the day.",
  step1: "Offers you send and receive, with three days to reply.",
  /** NOT VERBATIM — reason 1. The frame writes "four-digit". */
  step2: `The ${spellCount(CODE_LENGTH)}-digit codes you swap at the hub.`,
  step3: "Anything you promised to settle later.",
  primary: "Browse the marketplace",
} as const;

/** §6's "Empty (all settled)" — History alone, with a line above it. */
export const allSettled = nothingPending;

/* ─────────────────────── §10.6 the network error ────────────────────── */

export const networkError = {
  heading: "Can't load your trades",
  body:
    "The connection dropped. Nothing has changed on your side — offers, " +
    "promises and codes are all still where they were.",
  retry: "Try again",
} as const;

/* ────────────────────────── §10.7 the codes ─────────────────────────── */

/**
 * §10.7, with the digit count interpolated. See reasons 1 and 2 in the header.
 */
export const code = {
  /** §10.7 `Show this to Marco` */
  showThis: (partner: string) => `Show this to ${partner}`,
  /** §10.7 `Ask Marco for his four digits` — six, here. */
  askFor: (partner: string) => `Ask ${partner} for their ${spellCount(CODE_LENGTH)} digits`,
  typeBelow: "Type them in below",
  /** Frame 9e's fuller version of the same line. */
  typeBelowLong: "Type them in below. The code changes if either of you leaves the hub.",
  /** §10.7's waiting line. */
  notYetTyped: (partner: string) =>
    `${partner} hasn't typed yours in yet. You can both do this at the same time.`,
  /** Frame 9f — they have gone first. */
  theyTypedYours: (partner: string) =>
    `${partner} has typed yours in. Ask them for their ${spellCount(CODE_LENGTH)} digits.`,
  /** Frame 9g's second block, when the viewer's own code is already spent. */
  alreadyTyped: (partner: string) => `${partner} already typed this one in.`,
  yourCodeUnchanged: "Your code, unchanged",
  /** §10.7 `Codes matched 15:42` */
  matched: (clock: string) => `Codes matched ${clock}`,
  /** Frame 9h. */
  matchedBody: (partner: string) =>
    `The trade is recorded. It sits in your finished trades now, and ${partner}'s ` +
    `record shows the same.`,
  matchedPrimary: "Back to trades",
  /** §6.1 `Not a match · 2 tries left` */
  notAMatch: (triesLeft: number) =>
    `Not a match · ${triesLeft} ${triesLeft === 1 ? "try" : "tries"} left`,
  notAMatchPlain: "Not a match",
  /** §10.7's after-three line, and the control under it. */
  readItAgain: (partner: string) =>
    `The code changes if either of you leaves the hub. Ask ${partner} to read it again.`,
  readItAgainButton: (partner: string) => `Ask ${partner} to read it again`,
  /** Frame 9e's bottom bar. */
  typeTheirs: (partner: string) => `Type ${partner}'s code`,
  somethingWrong: "Something went wrong at the meetup",
  /**
   * NOT VERBATIM — reason 2 in the header, and the only place this screen tells
   * the user something §10.7 does not. §10.7 assumes the app can print the
   * viewer's own code; it cannot, so this says where it is instead of inventing
   * digits. Written to §10's rules: no apology, no `unfortunately`, states the
   * fact and hands over the route.
   */
  whereYourCodeIs: (partner: string) =>
    `Your own ${spellCount(CODE_LENGTH)} digits are in the email Baylo sent when this ` +
    `meeting started. Open it and read them out to ${partner}.`,
  whereYourCodeIsShort: "Your code is in the email Baylo sent you.",
  /** The label over the block that would have held the viewer's own digits. */
  yourCodeLabel: "Your own code",
  /** Frame 9h's promise section footnote. */
  promiseOutlives: "The trade is done. The promise runs until you settle it.",
} as const;

/* ─────────────────── §10.4 / frame 9i — the incoming offer ──────────── */

/**
 * §10.4's strings live in `src/components/offer/copy.ts` under `creditor` and
 * are reused rather than retyped — the contract screen already renders them, and
 * two copies of `Accepting adds 100 to what Dana owes` is one copy too many.
 * What is here is only what frame 9i adds on top.
 */
export const review = {
  /** Frame 9i's nav-right mono. */
  expiresIn: (days: number) => (days === 1 ? "1 day left" : `${days} days left`),
  /** Frame 9i's second line under the swap. `80 added now · 100 promised` */
  splitLine: (now: number, promised: number) =>
    `${grouped(now)} added now · ${grouped(promised)} promised`,
  addedNow: (now: number) => `${grouped(now)} added now`,
  noLeaves: "No Leaves either way",
  /** The line that makes the same-tap rule explicit before the tap. */
  sameTap:
    "Accepting the offer accepts the promise in the same tap. There is no second step.",
} as const;

/* ───────────────────────── frame 9j — promises ──────────────────────── */

export const promise = {
  /** Debtor. Frame 9j `100 to Marco A.` */
  toCreditor: (amount: number, creditor: string) => `${grouped(amount)} to ${creditor}`,
  /** Creditor. Frame 9j `100 owed by Dana L.` */
  owedBy: (amount: number, debtor: string) => `${grouped(amount)} owed by ${debtor}`,
  /** PENDING_ACCEPT, debtor side. */
  waitingToAccept: (creditor: string) => `waiting for ${creditor} to accept`,
  /** PENDING_ACCEPT, creditor side — it is the viewer who has to answer. */
  waitingOnYou: "waiting for you to accept",
  /** §5.3 `40 of 100 settled` */
  partSettled: (paid: number, total: number) => `${grouped(paid)} of ${grouped(total)} settled`,
  nothingSettled: "nothing settled yet",
  /** §1.7 `Settled 4 Oct` — a hairline row, no accent. Nothing congratulates. */
  settled: (d: Date) => `settled ${shortDate(d)}`,
  /** §5.3 `Defaulted 7 Oct · 100 still owed` */
  defaulted: (d: Date, stillOwed: number) =>
    `defaulted ${shortDate(d)} · ${grouped(stillOwed)} still owed`,
  /** Frame 9j's creditor-side default line. */
  defaultedTheirs: (d: Date, name: string) => `defaulted ${shortDate(d)} · ${name}'s tier dropped`,
  /** §6 and the frames. The control that pays it down, now that one exists. */
  settle: "Settle",
  /** NOT VERBATIM — reason 3 in the header. The second, quieter control. */
  extend: "Ask for more time",
  extensionPending: "more time asked for",
  extensionUsed: "extension already used",
  /** Frame 9j's closing footnote. */
  footnote:
    "Baylo records what is owed and reminds both sides. There is nothing to chase here.",
  /**
   * How settling works, said once under the debtor's own rows.
   *
   * BOTH HALVES ARE TRUE AND THE ORDER MATTERS. Earned Leaves still go to the
   * oldest agreement first without being asked — that rule did not change when
   * the Settle control arrived — and on top of it a debtor can now pay
   * deliberately. Saying only the second half would suggest a debt sits still
   * until pressed, which it does not.
   */
  howSettling:
    "Leaves you earn go to your oldest agreement first, on their own. " +
    "You can also settle one now from your balance.",
  /** The sheet that asks how much. */
  settleHeading: (creditor: string) => `Settle with ${creditor}`,
  settleBody: (owed: number, balance: number) =>
    `${grouped(owed)} is still owed on this agreement. You hold ${grouped(balance)}.`,
  settleAll: (amount: number) => `Settle all ${grouped(amount)}`,
  settlePart: (amount: number) => `Settle ${grouped(amount)}`,
  settleHalf: "Settle half",
  settleCancel: "Not now",
  /** §1.10: no colour event, no congratulation. A mono line, and the numbers. */
  settledLine: (amount: number, remaining: number) =>
    remaining > 0
      ? `${grouped(amount)} settled · ${grouped(remaining)} to go`
      : `${grouped(amount)} settled · nothing left owing`,
  /** The one refusal a debtor can act on. The server sends both figures. */
  notEnough: (balance: number, requested: number) =>
    `You hold ${grouped(balance)} and this payment needs ${grouped(requested)}.`,
} as const;

/* ───────────────────────────── small helpers ────────────────────────── */

/** `Marco A.` → `Marco`. Re-exported so a call site imports one copy module. */
export { firstName } from "../offer/copy";
