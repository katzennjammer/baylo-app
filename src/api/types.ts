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
  totalTrades: number;
  lifetimeLeaves: number;
  /** "Seedling" | "Sprout" | "Grower" | "Guardian" — resolved server-side. */
  rank: string;
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
  stats: { likes: number; liked: boolean; comments: number };
  createdAt: string;
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
