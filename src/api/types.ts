/**
 * The wire shapes /api/v1 returns.
 *
 * Hand-mirrored from the server's `src/lib/v1/item.ts` and the route handlers
 * themselves, not generated. Two consequences worth stating plainly: these
 * types are a claim about the server, not a proof, and nothing here validates
 * the body at runtime. They are for the compiler's benefit while writing
 * screens; the server is the authority on what actually arrives.
 *
 * Dates arrive as ISO strings, not Date objects — they went through
 * JSON.stringify on the way out. Typed as `string` here for that reason: the
 * server's own interface says `Date`, and copying that across would be a lie
 * the compiler would happily believe.
 */

import type { TrustTier } from "../lib/trust";

/** Precise coordinates reach only the owner and an accepted counterparty. */
export interface Pickup {
  lat: number;
  lng: number;
  address: string | null;
  /** False means lat/lng are the ~1 km rounding, not the real point. */
  precise: boolean;
}

export interface ItemOwner {
  id: string;
  name: string;
  avatar: string | null;
  location: string | null;
  rating: number;
  /**
   * The denormalised counter, fine as a displayed statistic and NOT a tier
   * input — it has drifted above the real completed count on live rows. The
   * server says the same thing in `V1Owner`.
   */
  totalTrades: number;
  lifetimeLeaves: number;
  /** The LEAF ladder: "Seedling" | "Sprout" | "Grower" | "Guardian". */
  rank: string;
  /**
   * The TRUST ladder, resolved server-side with DPA defaults charged against
   * it — the same value the contract gates enforce with.
   *
   * NULL ON ENDPOINTS THAT DO NOT RESOLVE IT. /home and /items/[id] both
   * resolve it; /browse and the two profile routes still send null, because
   * the three aggregates it costs are not worth adding to routes whose screens
   * do not draw the badge. Null means "unknown", never "New Trader".
   *
   * THE DETAIL SCREEN MUST NOT FALL BACK. `resolveTier()` exists for the
   * grid and the feed, where an approximate badge is a cosmetic error. On item
   * detail the badge is read by somebody deciding whether to go and meet a
   * stranger, and the fallback is known to read HIGH — it works off a
   * denormalised counter and cannot see DPA defaults. /items/[id] was changed
   * to resolve the real tier for exactly that reason; render nothing rather
   * than a guess if it ever comes back null again.
   */
  trustTier: TrustTier | null;
}

/** A curated public meetup point. Coordinates here are public and precise. */
export interface SafeZoneHub {
  id: string;
  name: string;
  /** Wire form: "mall" | "barangay_hall" | "police_station" | … */
  type: string;
  typeLabel: string;
  address: string;
  latitude: number;
  longitude: number;
  city: string;
  /** The "where exactly" note — the field that actually gets two people to one spot. */
  landmark: string;
  /**
   * FALSE MEANS "still listed here, but this place is no longer a Safe Zone".
   * The association survives deactivation deliberately, so the listing does not
   * silently lose the only answer it had to "where would we meet?". Render it
   * struck through; do not filter it out.
   */
  isActive: boolean;
}

/**
 * The like and comment counters on a listing, plus this viewer's own like.
 *
 * Named and exported rather than inlined on `Item` because it is now a wire
 * shape in its own right: POST/DELETE /api/v1/items/[id]/like and POST
 * .../comments all answer with exactly this block, so the client can replace
 * what it guessed with what the server counted. The server shapes all four
 * from one function (`v1Stats`) for the same reason.
 */
export interface ItemStats {
  likes: number;
  liked: boolean;
  comments: number;
}

/**
 * One top-level comment on a listing.
 *
 * `replyCount` arrives and is not rendered anywhere yet — there is no thread
 * screen, and GET .../comments returns top-level rows only. It is on the wire
 * so the day that screen exists it does not need a second endpoint. Comment
 * LIKES are deliberately absent: the legacy route returns them, no v1 endpoint
 * can change them, and a count with no control beside it is the dead affordance
 * this whole pass removed from the card.
 */
export interface ItemComment {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; avatar: string | null };
  replyCount: number;
}

export interface Item {
  id: string;
  title: string;
  description: string;
  images: string[];
  category: string;
  categoryLabel: string;
  condition: string;
  conditionLabel: string;
  valueLeaves: number | null;
  /** The model's number before the owner adjusted it. Null predates the model. */
  suggestedLeaves: number | null;
  valuationSource: string | null;
  status: string;
  wanted: string | null;
  pickup: Pickup | null;
  owner: ItemOwner;
  stats: ItemStats;
  /**
   * NULL means the endpoint did not load them; `[]` means the listing genuinely
   * has none. A client must not collapse the two — the feed sends null and a
   * card that rendered "no meetup points" from it would be making a claim the
   * feed never checked. Only /items/[id] populates this today.
   */
  safeZones: SafeZoneHub[] | null;
  createdAt: string;
}

/** GET /api/v1/browse — `meta.nextCursor` carries the keyset cursor. */
export interface BrowsePayload {
  items: Item[];
  facets: { categories: { category: string; label: string; count: number }[] };
}

/** GET /api/v1/items/[id] — the detail screen in one request. */
export interface ItemDetailPayload {
  item: Item & { imageHash: string | null; updatedAt: string };
  viewer: {
    isOwner: boolean;
    /** False for your own listing and for anything that has left AVAILABLE. */
    canOffer: boolean;
    leaves: number;
    tradeableItems: { id: string; title: string; image: string | null }[];
    /** Non-null when this viewer already has a PENDING offer on this listing. */
    existingOfferId: string | null;
  };
}

export interface HomeViewer {
  id: string;
  name: string;
  avatar: string | null;
  location: string | null;
  leaves: number;
  lifetimeLeaves: number;
  rank: { label: string; next: { label: string; toNext: number } | null };
  rating: number;
  totalTrades: number;
  isVerified: boolean;
}

export interface TrendingCategory {
  category: string;
  label: string;
  hashtag: string;
  count: number;
}

export interface MatchCandidate {
  userId: string;
  name: string;
  avatar: string | null;
  totalTrades: number;
  sharedCategories: string[];
  reason: string;
}

/** GET /api/v1/home — the whole home tab in one request. */
export interface HomePayload {
  viewer: HomeViewer;
  unread: { messages: number; notifications: number; followRequests: number };
  feed: Item[];
  trending: TrendingCategory[];
  matches: MatchCandidate[];
}

/* ─────────── GET /api/v1/profile/me — the viewer's own standing ─────────── */

/**
 * `reputation` on /api/v1/profile/me, from the server's `publicStanding()`.
 *
 * EVERYTHING HERE IS ADVISORY, and the server says so in its own comment: the
 * same numbers are re-derived by `loadStanding()` on every attempt and nothing
 * a client reports about its own tier is read back. It is served so a screen
 * can grey out what is locked AND SAY WHY, rather than letting somebody fill in
 * a proposal and then meet a 403.
 */
export interface ViewerReputation {
  /** The EFFECTIVE tier — base tier with DPA defaults charged against it. */
  tier: TrustTier;
  /** What the trade history alone says. Shown for explanation, never gated on. */
  baseTier: TrustTier;
  /** COMPLETED TradeRequest rows. Never `user.totalTrades`, which drifts high. */
  completedTrades: number;
  rating: number;
  limits: {
    /** The most valuable item this tier may ACQUIRE. `null` is unlimited. */
    maxItemValueLeaves: number | null;
    mayProposeDpa: boolean;
    maxOutstandingDebtLeaves: number;
  };
  contracts: {
    /** Unpaid principal across ACTIVE and DEFAULTED. */
    outstandingDebt: number;
    /** `outstandingDebt` plus principal on PENDING_ACCEPT proposals. */
    committedDebt: number;
    /** maxOutstandingDebtLeaves − committedDebt, floored at 0. */
    remainingDebtHeadroom: number;
    openContracts: number;
    lifetimeDefaults: number;
    hasUnsettledDefault: boolean;
    /** Null when this debtor has never FINISHED a contract — not 0. See below. */
    onTimeRate: number | null;
  };
  restrictions: {
    /** False while an unsettled default stands. Blocks offers as well as trades. */
    canInitiateTrades: boolean;
    /** Always true. Spelled out by the server so the asymmetry is legible. */
    canAcceptTrades: boolean;
    canListItems: boolean;
  };
}

/** `idVerification` on /api/v1/profile/me, from `publicIdVerification()`. */
export interface ViewerIdVerification {
  verified: boolean;
  status: "unverified" | "pending" | "approved" | "rejected" | "exhausted";
  grandfathered: boolean;
  attemptsUsed: number;
  attemptsRemaining: number;
  maxAttempts: number;
  latest: {
    idType: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    rejectionReason: string | null;
    rejectionFix: string | null;
    submittedAt: string;
    reviewedAt: string | null;
    attemptCount: number;
  } | null;
}

/**
 * GET /api/v1/profile/me — the shelf, the standing and the ID gate in one.
 *
 * `items` is a PAGE, not the whole shelf: the route is keyset-paginated with a
 * default limit of 20 and a maximum of 50, and it returns both AVAILABLE and
 * OWNED rows. Anything reading it for "my tradeable items" has to filter by
 * status itself and must not assume the page is complete — see the note in
 * `src/api/offer.ts`.
 *
 * Only the blocks this app reads are typed. `impact`, `reviews` and `tasks`
 * arrive and are deliberately left off: typing a field nobody renders is a
 * claim about the server that nothing checks.
 */
export interface ProfileMePayload {
  user: {
    id: string;
    name: string;
    avatar: string | null;
    bio: string | null;
    location: string | null;
    email: string;
    rating: number;
    totalTrades: number;
    /**
     * The RAW balance. NOT the committable one — Leaves already pledged to
     * other PENDING offers are still counted here. The server's
     * `availableLeaves()` is what POST /api/offers checks against, and no
     * endpoint exposes it. See `src/api/offer.ts`.
     */
    leaves: number;
    lifetimeLeaves: number;
    rank: { label: string; next: { label: string; toNext: number } | null };
    isVerified: boolean;
    createdAt: string;
  };
  counts: {
    listed: number;
    owned: number;
    completedTrades: number;
    reviews: number;
    followers: number;
    following: number;
  };
  items: Item[];
  reputation: ViewerReputation;
  idVerification: ViewerIdVerification;
}

/* ──────────── GET /api/v1/contracts/[id]/preview — the creditor ────────── */

/** One party on a contract, as `v1Contract()` shapes them. */
export interface ContractParty {
  id: string;
  name: string;
  avatar: string | null;
}

export interface Contract {
  id: string;
  tradeId: string;
  status: "PENDING_ACCEPT" | "ACTIVE" | "FULFILLED" | "DEFAULTED" | "DECLINED";
  amountLeaves: number;
  amountPaid: number;
  deadline: string;
  extensionUsed: boolean;
  debtor: ContractParty | null;
  creditor: ContractParty | null;
  createdAt: string;
}

/**
 * The creditor's decision screen, in one request.
 *
 * The server's own header calls this "the feature's only real defence": nothing
 * downstream of acceptance can compel payment, so the moment of protection is
 * BEFORE the yes and consists entirely of showing the creditor the debtor's
 * record. `debtorStats` is that record and `terms.noItemReturn` is the true
 * statement of what the platform will do if it goes wrong. Both are rendered
 * verbatim rather than summarised.
 */
export interface ContractPreviewPayload {
  contract: Contract;
  debtorStats: {
    completedTrades: number;
    outstandingDebt: number;
    /** NULL means "no history", never 0%. A first-time debtor is unproven. */
    onTimeFulfillmentRate: number | null;
    pastDefaults: number;
  };
  debtor: {
    id: string;
    name: string | null;
    avatar: string | null;
    tier: TrustTier;
    baseTier: TrustTier;
    rating: number;
    finishedContracts: number;
    hasUnsettledDefault: boolean;
    debtCeiling: number;
  };
  trade: {
    id: string;
    status: string;
    offeredLeaves: number | null;
    debtorReceives: { id: string; title: string; valueLeaves: number | null } | null;
    debtorGives: { id: string; title: string; valueLeaves: number | null } | null;
    valueDifferenceLeaves: number | null;
  };
  terms: {
    youReceiveNow: { id: string; title: string; valueLeaves: number | null } | null;
    youGiveNow: { id: string; title: string; valueLeaves: number | null } | null;
    theyOweYou: number;
    byDeadline: string;
    extensionsPossible: number;
    onDefault: string[];
    noItemReturn: string;
  };
}

/* ───────── GET /api/v1/trades — read for TWO fields, not for the tab ────── */

/**
 * One PENDING offer, in either direction.
 *
 * READ HERE BY THE OFFER FLOW, NOT BY A TRADES SCREEN. §5.2's "pending offer
 * exists" state has to render what was already sent — the items, the Leaves,
 * the message and when it went — and `viewer.existingOfferId` on
 * /api/v1/items/[id] is an id and nothing else. There is no GET on
 * /api/offers/[id], so this list is the only place an offer's own contents
 * appear on the wire.
 *
 * Capped at 50 and not paginated: the route puts its cursor on `trades`.
 */
export interface LiveOffer {
  id: string;
  direction: "sent" | "received";
  status: string;
  /** The listing the offer is ON. `ITEM_BRIEF` — no `valueLeaves`. */
  post: { id: string; title: string; image: string | null; status: string };
  offeredItems: { id: string; title: string; image: string | null }[];
  offeredLeaves: number | null;
  message: string | null;
  counterparty: { id: string; name: string; avatar: string | null };
  /**
   * A Deferred Points Agreement proposed WITH this offer, or null.
   *
   * Non-null means the promise is a real PENDING_ACCEPT row, not an intention —
   * a contract can now be attached to an Offer as well as to a TradeRequest, so
   * it exists from the moment it is proposed. ACCEPTING THE OFFER ACCEPTS IT;
   * there is no second call, and /contracts/[id]/accept answers 409 with
   * `meta.rule: "DPA_ACCEPTED_WITH_OFFER"` for one of these.
   */
  contract: {
    id: string;
    amountLeaves: number;
    deadline: string;
    status: "PENDING_ACCEPT" | "ACTIVE" | "FULFILLED" | "DEFAULTED" | "DECLINED";
    /** Where the creditor must go before accepting. Named by the server. */
    previewPath: string;
  } | null;
  createdAt: string;
}

/**
 * GET /api/v1/trades.
 *
 * The offer flow reads exactly two things from it and ignores the rest:
 *
 *   viewer.availableLeaves   the balance MINUS Leaves pledged to other PENDING
 *                            offers — `leafBalances()` on the server, and the
 *                            same figure POST /api/offers checks `offeredLeaves`
 *                            against. It appears on no other endpoint, which is
 *                            why this route is called from a flow that does not
 *                            otherwise care about trades.
 *   offers                   see `LiveOffer` above.
 *
 * `trades` is typed as `unknown[]` on purpose. This flow does not render one,
 * and typing 20 fields nobody reads would be a claim about the server that
 * nothing here checks. The Trades screen will type it when it is built.
 */
export interface TradesPayload {
  viewer: { leaves: number; availableLeaves: number };
  pendingIncoming: number;
  trades: unknown[];
  offers: LiveOffer[];
}
