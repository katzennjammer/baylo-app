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
  featuredAchievement: { id: string; name: string; icon: string; imageUrl: string | null } | null;
  /**
   * The organisation this owner IS, or null for a person.
   *
   * WHEN THIS IS SET, `trustTier` IS ALWAYS NULL — the server enforces it, so
   * a card never has to choose between two badges. Organisations do not climb
   * the trade-count ladder; their badge is this one. Render `org` where the
   * RISING/NEW badge would have gone and nothing else changes.
   *
   * `verified` IS NOT "this object exists". A PENDING organisation is a real
   * account that posts and trades and has no checkmark yet, so the badge is
   * drawn on `org.verified` and never on `org != null`.
   */
  org: OrgBadge | null;
}

/** An organisation's public badge, as it appears on a card or a profile. */
export interface OrgBadge {
  id: string;
  name: string;
  logoUrl: string | null;
  businessCategory: string;
  /** Only a reviewed, VERIFIED organisation earns the checkmark. */
  verified: boolean;
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
  replies?: ItemComment[];
  parentId?: string | null;
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
  /**
   * TRUE when a moderator has taken the listing down. Only ever true on your
   * OWN shelf and detail — every other read path filters it out — and it is
   * what lets the shelf label the tile instead of 404ing when it is opened.
   */
  hiddenByModerator: boolean;
  /**
   * The code a value review was refused with, while `status` is
   * VALUE_REJECTED. Null otherwise. `src/lib/value-rejection.ts` turns it into
   * the sentence the owner reads.
   */
  valueRejectionReason: string | null;
  wanted: string | null;
  /**
   * The perishable block, or null for a standard listing.
   *
   * ONE NULLABLE OBJECT, not four loose fields: the four only mean anything
   * together, and a shape that can express "a quantity with no window" invites
   * a screen to render one. `expiresAt` is derived server-side from createdAt
   * plus the window; count down against it rather than recomputing.
   *
   * `expired` true means the window has passed but the server's lazy sweep has
   * not run yet. Treat it as gone — the status will catch up on the next feed
   * read.
   */
  perishable: {
    quantity: number | null;
    quantityUnit: string | null;
    tradeWithinHours: number;
    expiresAt: string;
    expired: boolean;
  } | null;
  /**
   * When this listing's paid Featured boost ends, or null when it is not
   * featured right now (never boosted, or the window has passed). The server
   * computes it against the clock, so null is safe to read as "can boost".
   */
  featuredUntil: string | null;
  /** Categories the owner will take back. `[]` means none were stated. */
  lookingFor: string[];
  lookingForLabels: string[];
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
/**
 * An organisation whose NAME matched the search, drawn as a top card above the
 * item grid. First page of a search only; an empty array otherwise.
 */
export interface BrowseOrgMatch {
  id: string;
  /** The storefront is read by this id — `/user?id=<orgUserId>`. */
  orgUserId: string;
  name: string;
  logoUrl: string | null;
  businessCategory: string;
  businessCategoryLabel: string;
  verified: boolean;
  /**
   * The viewer's Follow edge to the shop's backing account -- the same Follow
   * row a person's profile uses. These three are absent from a server older
   * than the card's Follow button; the card then draws no button.
   */
  follow?: FollowStatus;
  /** ACCEPTED followers of the shop. */
  followers?: number;
  /** The viewer is an ACTIVE member (owner or staff): no Follow on their own shop. */
  isMember?: boolean;
}

export interface BusinessCategoryFacet {
  businessCategory: string;
  label: string;
  /** Shops in this category with something available — not listings. */
  count: number;
}

export interface BrowsePayload {
  items: Item[];
  /** Absent from a server older than 25 Sep 2026. */
  organizations?: BrowseOrgMatch[];
  facets: {
    categories: { category: string; label: string; count: number }[];
    /** Only filled while `orgsOnly` is on. Absent from an older server. */
    businessCategories?: BusinessCategoryFacet[];
  };
}

/**
 * What happened to a listing, for its owner. Null for anybody else and for a
 * listing nothing has happened to. The review screen is drawn from this alone.
 *
 *   state "waiting"    PENDING_REVIEW — an admin has not answered yet
 *   state "rejected"   VALUE_REJECTED — answered no; the owner chooses
 *   state "hidden"     a moderator takedown; wins over the value states
 */
export interface ListingReview {
  state: "waiting" | "rejected" | "hidden";
  hiddenAt: string | null;
  requestedLeaves: number | null;
  suggestedLeaves: number | null;
  requestedBracket: number | null;
  suggestedBracket: number | null;
  /** The highest bracket that goes live without a review. */
  capBracket: number | null;
  reasonCode: string | null;
  /** The server's sentence for `reasonCode`; the local mirror is the fallback. */
  reason: string | null;
  appeal: {
    id: string | null;
    status: "OPEN" | "UPHELD" | "OVERTURNED" | "WITHDRAWN" | null;
    kind: "VALUE_REJECTION" | "MODERATION_HIDE" | null;
    message: string | null;
    createdAt: string | null;
    decidedAt: string | null;
    /** The one field that draws or hides the Appeal control; `status` says why. */
    canAppeal: boolean;
  };
}

/** GET /api/v1/items/[id] — the detail screen in one request. */
export interface ItemDetailPayload {
  item: Item & { imageHash: string | null; updatedAt: string };
  /** Owner only. See ListingReview. */
  review: ListingReview | null;
  viewer: {
    isOwner: boolean;
    state: string;
    action: "EDIT" | "SEND_OFFER" | "IN_TRADE" | "TRADED";
    /** False for your own listing and for anything that has left AVAILABLE. */
    canOffer: boolean;
    /**
     * Why the offer control is LOCKED, when it is. `"premium"`: the listing is
     * in bracket 7 or above and this viewer has no live subscription. Separate
     * from `canOffer` because the two draw different controls — an inert
     * button versus an explanation with the listing left fully in view.
     * Advisory; POST /api/offers re-checks and answers 403 PREMIUM_REQUIRED.
     */
    offerLock: "premium" | null;
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
  /**
   * The shop this request acted as (X-Baylo-Org), with the SHOP's balance --
   * what the header pill shows while acting as it. Null acting as yourself, or
   * when the server refused the context. `viewer.leaves` is always the
   * person's. Absent from a server older than 25 Sep 2026.
   *
   * `orgUserId` is the shop's backing account: its inbox, and the realtime
   * channel the header listens on while acting as it. `unread` below is that
   * inbox's while `acting` is non-null. Absent from a server before the shop
   * inbox (25 Sep 2026, evening).
   */
  acting?: { organizationId: string; name: string; leaves: number; orgUserId?: string } | null;
  unread: {
    messages: number;
    messageConversations: number;
    notifications: number;
    followRequests: number;
  };
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
  /** The trust tier, from COMPLETED TradeRequest rows and the rating. */
  tier: TrustTier;
  /** COMPLETED TradeRequest rows. Never `user.totalTrades`, which drifts high. */
  completedTrades: number;
  rating: number;
  /**
   * isPremium(User.premiumUntil) on the server. Optional because a server
   * older than this field omits it, and a missing flag must read as "not
   * subscribed", never as a crash. Advisory: enforced on POST /api/offers.
   */
  premium?: boolean;
  limits: {
    /**
     * The highest BRACKET this tier may ACQUIRE. `null` is unlimited. The
     * server's `enforceItemValueCeiling()` compares brackets since 17 Sep
     * 2026, and this is the figure it names in its refusal.
     */
    maxItemBracket: number | null;
  };
  restrictions: {
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
    /** Listings parked for a value review, and ones a review refused. */
    waitingReview: number;
    valueRejected: number;
    completedTrades: number;
    reviews: number;
    followers: number;
    following: number;
  };
  items: Item[];
  displayedAchievements: {
    id: string;
    name: string;
    icon: string;
    imageUrl: string | null;
    displayOrder: number | null;
  }[];
  achievementCount: number;
  reputation: ViewerReputation;
  idVerification: ViewerIdVerification;
  /**
   * False when this person has never listed, offered or traded AS THEMSELVES,
   * only for an organisation. Absent from a server older than 24 Sep 2026,
   * which the Profile tab reads as "has activity": the personal profile.
   */
  hasPersonalActivity?: boolean;
}

export interface PublicProfilePayload {
  user: Omit<ProfileMePayload["user"], "email" | "leaves" | "rank"> & {
    rank: { label: string };
    trustTier: string | null;
    /**
     * Set when this profile is an organisation. Null for a person, which is
     * almost every profile.
     *
     * THE SCREEN BRANCHES ON THIS AND NOTHING ELSE: square logo instead of a
     * round avatar, the shop-front placeholder instead of initials, the
     * verified badge instead of the trust tier, and the staff count instead of
     * Followers/Following. The rest of the profile -- posts grid, Follow,
     * Message, tabs -- is identical, which is why this is one extra field and
     * not a second payload shape.
     *
     * `trustTier` is ALWAYS null alongside it; the server guarantees that, so
     * no screen has to choose between two badges.
     */
    org: (OrgBadge & {
      createdAt: string;
      staffCount: number;
      /**
       * The storefront fields. OPTIONAL on the wire, not just nullable: a
       * server from before the storefront omits them, and the storefront then
       * renders its fallbacks (gradient band, no tagline, stat from counts).
       */
      bannerUrl?: string | null;
      description?: string | null;
      /** COMPLETED trades on either side, counted from the rows. */
      completedTrades?: number;
      /** The viewer's ACTIVE role in this org, or null for a non-member. */
      viewerRole?: "OWNER" | "STAFF" | null;
    }) | null;
  };
  counts: Pick<ProfileMePayload["counts"], "listed" | "completedTrades" | "reviews" | "followers" | "following"> & {
    /** ACTIVE staff, or null for a person. Sent beside followers, not instead. */
    staff: number | null;
  };
  follow: {
    status: "NONE" | "PENDING" | "ACCEPTED";
    followsYou: boolean;
  };
  items: Item[];
  reviews: unknown[];
  displayedAchievements: ProfileMePayload["displayedAchievements"];
}

export type FollowStatus = "NONE" | "PENDING" | "ACCEPTED";

export interface ProfileConnectionUser {
  id: string;
  name: string;
  avatar: string | null;
  trustTier: string | null;
  follow: { status: FollowStatus };
  followsYou: boolean;
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
  post: TradeItemBrief;
  /**
   * What the sender is putting up. VALUES COME FROM THE ITEM TABLE, not from the
   * stored blob: `Offer.offeredItems` is JSON the client wrote at offer time and
   * its titles are client-asserted, so the server looks the ids up and sends the
   * value it can stand behind. Null carries the same meaning as everywhere else.
   */
  offeredItems: { id: string; title: string; image: string | null; valueLeaves: number | null }[];
  offeredLeaves: number | null;
  message: string | null;
  counterparty: { id: string; name: string; avatar: string | null };
  /**
   * THE BRIDGE, as this screen needs it. Both brackets as they stood when the
   * offer was made; `bridgeFeeLeaves` is the QUOTE either way and
   * `bridgeFeePayer` says whose it is. A receiver looking at an incoming
   * offer whose payer is "receiver" is the one who will be charged on
   * accepting, and their consent sheet needs both numbers before they tap.
   *
   * Null brackets on an offer that predates bracket trading; the server
   * refuses to accept one of those (`OFFER_LEGACY_SHAPE`).
   */
  offeredBracket: number | null;
  targetBracket: number | null;
  bridgeFeeLeaves: number | null;
  bridgeFeePayer: "proposer" | "receiver" | null;
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
 * The Trades screen draws all four blocks, so `trades` is now typed too.
 */

/**
 * One TradeRequest, as the route's own `trades.map()` shapes it.
 *
 * WAS `unknown[]`. The offer flow read this payload for two fields and declined
 * to type a list it did not draw; the Trades screen draws it, so it is typed
 * here — against the route's mapper, field for field, and no wider.
 *
 * `kind` IS DERIVED FROM `offeredLeaves`, NOT FROM AN ID COMPARISON. The route
 * says so at length: `offeredItemId === requestedItemId` used to be the tell for
 * a Leaves-only trade and it never meant anything. On a `leaves` trade
 * `offeredItem` is null, because the column holds the listing itself as a
 * placeholder and sending it would show the recipient their own item as the
 * thing being offered to them.
 *
 * BOTH ITEMS CARRY `valueLeaves` NOW. They did not, and that single absence was
 * what stopped a screen about value gaps from showing a value — §10.6's "Vans
 * 440 for Air Max 480" degraded to two bare titles. `ITEM_BRIEF` gained the
 * field on the server; see `TradeItemBrief` for what null still means.
 */
export interface ActiveTrade {
  id: string;
  /** ACTIVE tab: PENDING | ACCEPTED | CONFIRMING. HISTORY: COMPLETED | REJECTED | CANCELLED. */
  status: TradeStatus;
  /** Whether the VIEWER opened this trade. Resolved by the server, never by id. */
  direction: "sent" | "received";
  kind: "leaves" | "items";
  offeredLeaves: number | null;
  /**
   * The bridging fee this trade carries, and which side paid it. NULL on a
   * same-bracket swap. The Leaves are already out of the payer's balance;
   * completion pays them to the other side, cancellation returns them.
   */
  bridgeFeeLeaves?: number | null;
  bridgeFeePaidBySender?: boolean | null;
  counterparty: { id: string; name: string; avatar: string | null };
  myReview: { rating: number } | null;
  receivedReview: { rating: number } | null;
  rewardLeaves: number | null;
  codesMatchedAt: string | null;
  /** NULL on a `leaves` trade — see the note above. */
  offeredItem: TradeItemBrief | null;
  requestedItem: TradeItemBrief;
  /** Derived from `safeZoneHubId` on the server. Kept on the wire under its old name. */
  safeZoneMeetup: boolean;
  /** Which hub, when one was claimed. NULL for every trade that named none. */
  safeZoneHub: SafeZoneHub | null;
  /**
   * Where and when the two of them have ARRANGED to meet.
   *
   * A DIFFERENT FACT FROM `safeZoneHub` ABOVE, and the distinction is the whole
   * reason this is a separate field rather than an early write to that one:
   *
   *   `safeZoneHub`  the CLAIM — "we met here", recorded after the codes match.
   *                  It is what the Safe-Zone award reads.
   *   `meetup`       the PLAN — "let us meet here", agreed beforehand. It awards
   *                  nothing, and a client must never present it as proof that a
   *                  meeting happened.
   *
   * NULL until somebody proposes. `meetup.agreedAt` is null while one proposal
   * is standing unanswered, which is the state the other party has to act on.
   */
  meetup: MeetupPlan | null;
  /**
   * Whether this viewer still has a confirmation step to perform.
   *
   * ACCEPTED (codes not started) or CONFIRMING with the partner's code either
   * expired or unused. A real answer from the code rows, not a guess from
   * `status` — which is why §6's "a confirmation code is live" test can be made
   * without a second request per trade.
   */
  canConfirm: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * The arrangement on an ACCEPTED trade. See `ActiveTrade.meetup`.
 *
 * `proposedBy` is a SIDE, not a user id — the server stores which of the two
 * parties put the plan on the table, which is a thing that cannot be wrong. Read
 * it against `direction` on the same trade: `proposedBy === "sender"` is the
 * viewer's own proposal exactly when `direction === "sent"`.
 */
export interface MeetupPlan {
  hub: SafeZoneHub;
  /** ISO-8601. A real instant, so it can be formatted in the device's locale. */
  at: string;
  /** "the bench outside, I'll have the blue bag". Never load-bearing. */
  note: string | null;
  proposedBy: "sender" | "receiver";
  /** NULL while the proposal is still waiting on the other person. */
  agreedAt: string | null;
}

export type TradeStatus =
  | "PENDING"
  | "ACCEPTED"
  | "CONFIRMING"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export interface TradeItemBrief {
  id: string;
  title: string;
  image: string | null;
  status: string;
  /**
   * NULL MEANS "NEVER VALUED", NOT "WORTH NOTHING".
   *
   * Listings that predate the valuation model have it, and so does an item that
   * has since been deleted out from under an offer. Rendering either as `0` is
   * a claim the wire did not make — `swapLine()` drops the figure instead, the
   * same call the offer flow's picker already makes for an unvalued item.
   */
  valueLeaves: number | null;
}

export interface TradesPayload {
  viewer: { leaves: number; availableLeaves: number };
  pendingIncoming: number;
  trades: ActiveTrade[];
  offers: LiveOffer[];
}

/* ──────── GET /api/trades/[id]/confirm/status — whose turn it is ───────── */

/**
 * THE TWO BOOLEANS DO NOT MEAN WHAT THEY ARE CALLED, and getting this backwards
 * puts the wrong half of §6.1 on screen at the car park.
 *
 * A code row is marked `used` when the OTHER person types it in correctly — the
 * submit route's own comment: "Mark the partner's code as used (= I submitted my
 * partner's code correctly)". So `senderSubmitted` is `senderCode.used`, which
 * means THE SENDER'S CODE HAS BEEN CONSUMED — that is, the RECEIVER has done
 * their part. The field is named for whose code it is, not for who acted.
 *
 * `confirmSides()` in `src/api/trades.ts` is the only place this is untangled,
 * and every screen reads its two flags instead of these.
 */
export interface ConfirmStatus {
  /** True once BOTH code rows exist — i.e. `confirm/start` has run. */
  started: boolean;
  /** The sender's code has been consumed, by the receiver. See above. */
  senderSubmitted: boolean;
  /** The receiver's code has been consumed, by the sender. See above. */
  receiverSubmitted: boolean;
  completed: boolean;

  /**
   * THE CALLER'S OWN CODE, in plain digits. Never the partner's.
   *
   * This is the code the OTHER person types in — it is not the one this account
   * submits, which is why handing it back to an authenticated session does not
   * let a stolen token complete a trade on its own. The server's route note has
   * the full reasoning; the client's job is to render it and never to log it.
   *
   * NULL IS A NORMAL ANSWER AND MUST BE RENDERED. A deployment with no
   * SWAP_CODE_KEY, a row issued before sealing existed, a rotated key, an
   * expired code and a burned code all land here. `codeAvailable` distinguishes
   * the configuration cases from the state cases.
   */
  code: string | null;
  /** Whether a readable copy was expected to exist. See `code`. */
  codeAvailable: boolean;
  /** Guesses the PARTNER has left against this viewer's code. */
  attemptsRemaining: number | null;
  /** When this viewer's code stops being typeable. ISO, or null. */
  expiresAt: string | null;
}

/* ─────────────────────────── notifications ──────────────────────────── */

/**
 * One row from GET /api/v1/notifications.
 *
 * `type` is the EVENT; `entityType`/`entityId` are WHAT TO OPEN, and the two do
 * not map one to one — TRADE_ACCEPTED and NEW_MESSAGE both point at a chat
 * partner, and TRADE_COMPLETED points at a list with no id. The server's note on
 * the `Notification` model has the full reasoning; the client's job is to route
 * from the pair and never to infer a target from `type`.
 *
 * `entityType` IS A PLAIN STRING, NOT A UNION, on purpose. Two vocabularies live
 * in that column — the fine-grained v1 set and the coarse pre-v1 set the backfill
 * could recover — and the server passes both through verbatim rather than
 * inventing ids the old rows never carried. A union here would be a promise this
 * client cannot keep about rows it did not write; `notificationTarget()` handles
 * the ones it knows and returns null for the rest.
 */
export interface NotificationItem {
  id: string;
  type: string;
  /** Starts mid-sentence — the actor's name is its subject. See `actor`. */
  message: string;
  read: boolean;
  createdAt: string;
  entityType: string | null;
  entityId: string | null;
  /** The lead photo for an item notification, when the event has no actor. */
  itemImage: string | null;
  /**
   * The organisation an `org_invite` or `organization` row is about. Its logo
   * is the row's picture, in place of the inviting owner's face. Absent from a
   * server older than 25 Sep 2026.
   */
  org?: { id: string; name: string; logoUrl: string | null } | null;
  /**
   * Who did it. Null for anything the system itself raised. `isOrg` marks a
   * shop's backing account, which is drawn as a shop when it has no logo.
   */
  actor: { id: string; name: string | null; avatar: string | null; isOrg?: boolean } | null;
}

export interface NotificationsPayload {
  notifications: NotificationItem[];
  /** Unread across the WHOLE list, not just this page. Matches the bell. */
  unreadCount: number;
}
