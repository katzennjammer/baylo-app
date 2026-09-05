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
