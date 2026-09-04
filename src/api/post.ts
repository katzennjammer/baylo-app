import { ApiError, apiV1, currentSession, legacyFailure, request } from "./client";
import { getApiBase } from "./config";
import type { SafeZoneHub } from "./types";

/**
 * The five endpoints the listing wizard talks to.
 *
 * They do not share a response shape, and this module does not pretend they do.
 * Three of them predate /api/v1 and answer bare JSON; two are v1 and come
 * wrapped in the `{ data, error, meta }` envelope that `apiV1` unwraps. What
 * IS unified here is the failure type — everything below throws `ApiError`, so
 * a screen branches on `.status` and `.retryAfter` rather than on which
 * generation of the API it happened to be talking to.
 *
 *   POST /api/upload           multipart, images only, 10 MB, 30/hour
 *   POST /api/ai/identify      category + condition + tags from the photo, 20/hour
 *   POST /api/ai/phash         duplicate detection, FAILS CLOSED, 20/hour
 *   GET  /api/v1/valuation     the suggestion and the ±25% band
 *   GET  /api/v1/hubs          the 22 seeded Safe-Zone Hubs
 *   POST /api/items            creates the listing
 *
 * ── ORDER IS NOT NEGOTIABLE ─────────────────────────────────────────────────
 *
 * `identify` and `phash` both take an `imageUrl` and hand it to a server-side
 * fetcher, which means the photo has to be ON CLOUDINARY before either can run.
 * The pipeline is therefore upload → (identify ‖ phash), never in parallel with
 * the upload, and `src/post/photos.ts` is where that sequencing lives.
 *
 * The upload route strips EXIF with sharp before the bytes ever reach
 * Cloudinary — it decodes and re-encodes without metadata, so the ORIGINAL
 * stored object is already free of the GPS coordinates a phone writes into
 * every photo taken at home. NOTHING in this app may upload to Cloudinary by
 * any other path. A direct signed upload would be faster and would ship a
 * seller's home address with it.
 */

/* ──────────────────────────── taxonomy ──────────────────────────────── */

/** The server's enum, in the order `/api/ai/identify` validates against. */
export const CATEGORIES = [
  "ELECTRONICS",
  "CLOTHING",
  "BAGS",
  "BEAUTY",
  "ACCESSORIES",
  "FURNITURE",
  "BOOKS",
  "GAMING",
  "SPORTS",
  "BIKES",
  "TOYS",
  "TOOLS",
  "MUSIC",
  "ART",
  "COLLECTIBLES",
  "PETS",
  "PLANTS",
  "FOOD",
  "SERVICES",
  "OTHER",
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * Labels, copied from `@/lib/v1/taxonomy` on the server.
 *
 * DUPLICATED ON PURPOSE, and it is the only duplication in this file. The two
 * endpoints this flow uses that return a category — identify and valuation —
 * disagree about whether they send a label: valuation sends `categoryLabel`,
 * identify sends the bare enum. The picker on step 2 has to render twenty
 * options before either call has happened, so it cannot wait for a label it
 * will only be given for one of them. Where a server label IS present it wins;
 * this is the fallback and the picker's source.
 */
export const CATEGORY_LABELS: Record<Category, string> = {
  ELECTRONICS: "Electronics",
  CLOTHING: "Fashion",
  BAGS: "Bags",
  BEAUTY: "Beauty",
  ACCESSORIES: "Accessories",
  FURNITURE: "Home & Garden",
  BOOKS: "Books & Media",
  GAMING: "Gaming",
  SPORTS: "Sports",
  BIKES: "Bikes",
  TOYS: "Kids & Toys",
  TOOLS: "Tools & DIY",
  MUSIC: "Music",
  ART: "Art & Crafts",
  COLLECTIBLES: "Collectibles",
  PETS: "Pets",
  PLANTS: "Plants",
  FOOD: "Food",
  SERVICES: "Services",
  OTHER: "Miscellaneous",
};

/**
 * The five conditions, in the spec's order, with the spec's own descriptions.
 *
 * ALWAYS ALL FIVE, NEVER A PICKER — the spec is explicit, and the reason is
 * that the difference between Good and Fair is the difference between a trade
 * that completes and one that ends in an argument at the meetup. A picker hides
 * four of the five descriptions behind a tap.
 */
export const CONDITIONS = [
  { value: "NEW", label: "New", description: "Never used, tags may still be on" },
  { value: "LIKE_NEW", label: "Like new", description: "Used once or twice, no marks" },
  { value: "GOOD", label: "Good", description: "Used often, works as it should" },
  { value: "FAIR", label: "Fair", description: "Clear wear or small damage, still usable" },
  { value: "POOR", label: "Poor", description: "Needs repair, say what is wrong in your title" },
] as const;

export type Condition = (typeof CONDITIONS)[number]["value"];

export const conditionLabel = (c: Condition): string =>
  CONDITIONS.find((x) => x.value === c)?.label ?? c;

export const categoryLabel = (c: string): string =>
  CATEGORY_LABELS[c as Category] ?? c;

/* ──────────────────────────── 1. upload ─────────────────────────────── */

export interface UploadResult {
  url: string;
  width: number;
  height: number;
}

/**
 * One photo, to Cloudinary, through our own route.
 *
 * React Native's `FormData` takes `{ uri, name, type }` rather than a `Blob`,
 * and the native networking layer streams the file off disk from that uri. It
 * is the only form that works here: `fetch(uri).then(r => r.blob())` loads the
 * whole image into JS memory first, which on a 12 MP photo is a 40 MB string
 * on the bridge before a single byte has left the device.
 *
 * `Content-Type` IS DELIBERATELY NOT SET. React Native fills it in with the
 * multipart boundary it generated; setting it by hand overwrites that with a
 * boundary-less header and the server's `formData()` parse fails on every
 * upload. This is the single most common way this call breaks.
 */
export async function uploadPhoto(
  uri: string,
  signal?: AbortSignal,
): Promise<UploadResult> {
  const form = new FormData();
  const name = uri.split("/").pop() || "photo.jpg";
  const ext = name.split(".").pop()?.toLowerCase();
  const type =
    ext === "png" ? "image/png" : ext === "heic" || ext === "heif" ? "image/heic" : "image/jpeg";

  // The cast is React Native's file descriptor, which the DOM FormData types do
  // not describe. The runtime accepts it; TypeScript's lib.dom does not know it.
  form.append("file", { uri, name, type } as unknown as Blob);

  const res = await request("/api/upload", { method: "POST", body: form, signal });
  if (!res.ok) return legacyFailure(res, "Upload failed");

  return (await res.json()) as UploadResult;
}

/**
 * The same upload, with a REAL percentage.
 *
 * ── WHY XMLHttpRequest, IN AN APP THAT USES fetch EVERYWHERE ELSE ───────────
 *
 * `fetch` has no upload progress event — not in React Native and not in the
 * browser. The spec's photo caption is `uploading · 62%` over a 3 px
 * determinate bar, and there are exactly two ways to put a number there: read
 * it from the request, or invent it. Inventing it is a progress bar that lies
 * about a 40-second upload on a bad connection, which is the one moment a
 * person is deciding whether the app is working. React Native's XHR implements
 * `upload.onprogress` against the same native networking stack `fetch` sits on,
 * so this is the same request with the event attached.
 *
 * ── WHAT IT GIVES UP, AND HOW THAT IS PAID FOR ──────────────────────────────
 *
 * The Bearer token here is read straight from the session mirror, so this path
 * does NOT have `request()`'s refresh-on-401. Rather than reimplement the
 * refresh — two copies of that logic is how a token family ends up killed by a
 * replay — a 401 falls through to `uploadPhoto()`, which is the fetch path and
 * does refresh. The bar stops moving for that one retry. That is honest: the
 * upload genuinely restarted.
 *
 * `credentials: "omit"` has no XHR equivalent; `withCredentials = false` is the
 * same instruction, set explicitly because the whole client depends on no
 * cookie ever entering the jar. See the note at the top of `client.ts` for what
 * a stray cookie would do to `resolveSession()`.
 */
export function uploadPhotoWithProgress(
  uri: string,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<UploadResult> {
  const base = getApiBase();
  const token = currentSession()?.accessToken ?? null;

  // No base or no token: there is nothing this path can do that the fetch path
  // cannot do better, including producing the CONFIG_ERROR with the gear in it.
  if (!base || !token) return uploadPhoto(uri, signal);

  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    const name = uri.split("/").pop() || "photo.jpg";
    const ext = name.split(".").pop()?.toLowerCase();
    const type =
      ext === "png" ? "image/png" : ext === "heic" || ext === "heif" ? "image/heic" : "image/jpeg";
    form.append("file", { uri, name, type } as unknown as Blob);

    const abort = () => xhr.abort();
    signal?.addEventListener("abort", abort);
    const done = () => signal?.removeEventListener("abort", abort);

    xhr.open("POST", `${base}/api/upload`);
    xhr.withCredentials = false;
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    // Content-Type is NOT set. React Native fills in the multipart boundary it
    // generated; overwriting it with a boundary-less header makes the server's
    // formData() parse fail on every single upload.

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
    };

    xhr.onload = () => {
      done();
      if (xhr.status === 401) {
        // The token aged out mid-upload. Hand it to the path that can refresh.
        uploadPhoto(uri, signal).then(resolve, reject);
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        let body: { error?: string } = {};
        try {
          body = JSON.parse(xhr.responseText) as { error?: string };
        } catch {
          /* A non-JSON body from a proxy or a crash. The status is the fact. */
        }
        const header = xhr.getResponseHeader("Retry-After");
        const retryAfter = header ? Number(header) : null;
        reject(
          new ApiError(
            xhr.status,
            xhr.status === 429 ? "RATE_LIMITED" : "REQUEST_FAILED",
            body.error ?? "Upload failed",
            [],
            retryAfter !== null && Number.isFinite(retryAfter) ? retryAfter : null,
          ),
        );
        return;
      }
      try {
        resolve(JSON.parse(xhr.responseText) as UploadResult);
      } catch {
        reject(new ApiError(xhr.status, "MALFORMED_RESPONSE", "/api/upload did not return JSON"));
      }
    };

    xhr.onerror = () => {
      done();
      reject(new ApiError(0, "NETWORK_ERROR", "Could not reach the server."));
    };
    xhr.onabort = () => {
      done();
      reject(new ApiError(0, "ABORTED", "Upload cancelled."));
    };

    xhr.send(form);
  });
}

/* ─────────────────────────── 2. identify ────────────────────────────── */

export interface IdentifyResult {
  /** "" when the model could not make out the photo. THE FAILURE SIGNAL. */
  name: string;
  category: Category;
  condition: Condition;
  tags: string[];
}

/**
 * What the photo is.
 *
 * ── THIS ENDPOINT ANSWERS 200 ON FAILURE ────────────────────────────────────
 *
 * Deliberately, server-side: a vision call that throws returns
 * `{ name: "", category: "OTHER", condition: "GOOD", tags: [] }` with a 200,
 * because a listing flow that dead-ends on an AI outage is a worse product than
 * one that asks the user to type. So a caller cannot use the HTTP status to
 * tell success from failure — an EMPTY `name` is the signal, and it is the only
 * one there is. `detectionFailed()` below is where that reading lives so no
 * screen re-derives it.
 *
 * A 429 is still a real 429 and still throws, with Retry-After attached.
 */
export async function identifyPhoto(
  imageUrl: string,
  signal?: AbortSignal,
): Promise<IdentifyResult> {
  const res = await request("/api/ai/identify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl }),
    signal,
  });
  if (!res.ok) return legacyFailure(res, "Could not identify this photo");

  return (await res.json()) as IdentifyResult;
}

/** The one reading of "identify did not work". Empty name, nothing else. */
export const detectionFailed = (r: IdentifyResult | null): boolean =>
  !r || r.name.trim().length === 0;

/* ───────────────────────────── 3. phash ─────────────────────────────── */

export type PhashStatus = "passed" | "warned" | "failed" | "self";

export interface PhashResult {
  /** The 64-bit dHash. Sent back to /api/items so the next upload can match it. */
  hash: string | null;
  status: PhashStatus;
  /** Present on self / warned / failed. The listing this photo matched. */
  matchedItemId?: string;
  distance?: number;
}

/**
 * The duplicate check. **FAILS CLOSED.**
 *
 * Any error, timeout, or non-response resolves to `failed` — not to `passed`.
 * That is a product decision the server has already made (a Claude error in
 * Stage 2 sets `aiConfirmed = true`), and this client must not undo it by
 * treating a thrown fetch as "nothing to report". `checkDuplicate` below
 * therefore never throws for a network reason: it returns `failed`.
 *
 * The one exception is a 429, which is re-thrown. A rate limit is not a verdict
 * about the photo — turning it into `failed` would tell a user their own
 * camera roll was a duplicate because they had been quick with the last four
 * photos. The caller shows the countdown and offers a re-check.
 *
 * ── WHAT THE COPY HAS TO CARRY, AND WHY ─────────────────────────────────────
 *
 * Because it fails closed, a real share of blocks are honest photos. The
 * spec's `failed` copy is written for that: it describes what the CHECK did
 * rather than what the user did, names the innocent explanation beside the
 * guilty one, and admits the check can be wrong before the user has to argue.
 * None of that is decoration — it is the price of the fail-closed default.
 */
export async function checkDuplicate(
  imageUrl: string,
  signal?: AbortSignal,
): Promise<PhashResult> {
  let res: Response;
  try {
    res = await request("/api/ai/phash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl }),
      signal,
    });
  } catch (cause) {
    // An abort is the wizard tearing the photo down, not a verdict. Re-thrown so
    // the caller can drop the result instead of rendering a block on a photo
    // that no longer exists.
    if (signal?.aborted) throw cause;
    return { hash: null, status: "failed" };
  }

  if (res.status === 429) return legacyFailure(res, "Too many checks. Try again shortly.");
  if (!res.ok) return { hash: null, status: "failed" };

  try {
    const body = (await res.json()) as Partial<PhashResult>;
    const status = body.status;
    if (status !== "passed" && status !== "warned" && status !== "failed" && status !== "self") {
      return { hash: null, status: "failed" };
    }
    return {
      hash: typeof body.hash === "string" ? body.hash : null,
      status,
      matchedItemId: typeof body.matchedItemId === "string" ? body.matchedItemId : undefined,
      distance: typeof body.distance === "number" ? body.distance : undefined,
    };
  } catch {
    return { hash: null, status: "failed" };
  }
}

/**
 * WHETHER THE SERVER CAN ISSUE A DUPLICATE REFERENCE CODE, AND TAKE AN APPEAL.
 *
 * The spec's `failed` panel ends with a `REFERENCE` label and a `DUP-4193-KQ`
 * code, and a text button — "This photo is mine — get it checked" — that files
 * the block for human review. NEITHER IS RETURNED by /api/ai/phash. Its response
 * is `{ hash, status, matchedItemId, distance }` and there is no appeal route
 * anywhere in the API.
 *
 * Both are built and both are behind this flag, OFF, because the alternatives
 * are worse than an absent row:
 *
 *   — Generating the code on the device would print an identifier support
 *     cannot look up. The code's entire job is to let a person find the
 *     decision without the user having to describe it; a client-side one is a
 *     decoration that reads like a promise.
 *   — Wiring the appeal to any existing endpoint would mean showing "Sent. A
 *     person will look at this photo within one working day" when nothing was
 *     sent.
 *
 * Turning this on needs two things from the server, and nothing from this app
 * beyond flipping the flag: a stable `reference` string on the phash response
 * for any non-`passed` verdict, and a route that accepts one.
 */
export const PHASH_APPEAL_SUPPORTED = false;

/* ──────────────────────────── 4. valuation ──────────────────────────── */

export interface ValuationPayload {
  suggestedLeaves: number;
  min: number;
  max: number;
  /** The bounds the final value must fall inside. THE SLIDER'S STOPS. */
  allowed: { min: number; max: number };
  valuationSource: "comparables" | "category_band";
  /** How many settled trades fed the comparables path. 0 on the band path. */
  sampleSize: number;
  category: string;
  categoryLabel: string;
  condition: string;
  conditionLabel: string;
  comparables: { label: string; sublabel: string; leaves: string }[];
  basis: string;
}

/**
 * The suggested value, and the band around it the server will accept.
 *
 * `allowed` is not advice. The create handler recomputes the same suggestion
 * from the same (category, condition) and rejects anything outside ±25% of it,
 * so the slider's ends and the server's guard are the same arithmetic run
 * twice. THE SLIDER MUST NOT LET A USER SELECT A VALUE OUTSIDE `allowed` —
 * that is the whole reason the band is drawn as the track rather than as a
 * limit the user discovers by being refused.
 *
 * ── PASSING `itemId` SPENDS THE LISTING'S ONE RE-VALUATION ───────────────────
 *
 * Before the model runs, and irreversibly. It is omitted for a new listing —
 * there is nothing to spend it against — and passed only when step 4 is
 * reached from an existing listing and the user has asked for a fresh number.
 * A 409 CONFLICT means it was already spent; `meta.maxRevaluations` and the
 * message carry the detail the "You have used your one re-valuation" panel
 * renders.
 */
export async function fetchValuation(
  category: Category,
  condition: Condition,
  itemId?: string,
): Promise<ValuationPayload> {
  const q = new URLSearchParams({ category, condition });
  if (itemId) q.set("itemId", itemId);
  const { data } = await apiV1<ValuationPayload>(`/api/v1/valuation?${q.toString()}`);
  return data;
}

/** A 409 from `fetchValuation` means the one re-valuation is already spent. */
export const isRevaluationSpent = (e: unknown): boolean =>
  e instanceof ApiError && e.status === 409;

/* ────────────────────────────── 5. hubs ─────────────────────────────── */

export interface HubsPayload {
  hubs: SafeZoneHub[];
  cities: string[];
}

/**
 * Every ACTIVE hub. Not paginated — it is a curated table of 22 rows.
 *
 * This is the same endpoint and the same query key the marketplace map uses, so
 * a session that has opened the map has this cached and the hub step paints
 * with no request. Deliberately NOT wrapped in its own `useQuery` here: the
 * step calls `useHubs()` from `./hubs`, and a second hook over the same URL
 * with a different key would be a second fetch for the same 22 rows.
 */

/* ────────────────────────── 6. create the item ──────────────────────── */

export interface CreateItemInput {
  title: string;
  description: string;
  category: Category;
  condition: Condition;
  valueLeaves: number;
  images: string[];
  /** "What are you hoping to get?" — free text, optional. */
  wantedItems: string | null;
  /**
   * The lead photo's dHash. Still sent, because the server keeps a lead-hash
   * column the web wizard reads back in its edit mode.
   */
  imageHash: string | null;
  /**
   * ONE HASH PER PHOTO, POSITIONALLY ALIGNED WITH `images`.
   *
   * This is what the duplicate check actually scans. Sending only the lead hash
   * put one image per listing into the pool, so re-posting a listing's second
   * or third photo matched nothing — a bypass that cost nothing to find.
   *
   * NULLS ARE KEPT, NOT FILTERED. /api/ai/phash answers `{ hash: null,
   * status: "passed" }` when it could not fetch or decode an image. Dropping
   * that entry would shift every later hash one place left and bind it to the
   * wrong photo, and the server writes these by index.
   */
  imageHashes: (string | null)[];
  /** Max 5. `resolveHubIds` rejects a sixth and the item is not created. */
  hubIds: string[];
}

/** What POST /api/items answers with. Only the id is read by this flow. */
export interface CreatedItem {
  id: string;
  title: string;
  valueLeaves: number | null;
}

/**
 * Creates the listing.
 *
 * `valueLeaves` is re-derived and re-bounded server-side against a suggestion
 * this client is not trusted to have reported honestly — which is why the
 * slider's job is to make the band obvious rather than to be believed. A value
 * outside it comes back 400 with `suggestedLeaves` and `allowed` in the body.
 *
 * `description` falls back to the title server-side when it is empty, so the
 * wizard sends the title for it: the flow has no description field, and a
 * listing whose description is its own title reads better than one whose
 * description is the string "null".
 */
export async function createItem(input: CreateItemInput): Promise<CreatedItem> {
  const res = await request("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return legacyFailure(res, "We could not post this just now.");
  return (await res.json()) as CreatedItem;
}

/* ─────────────────── the matched listing, for self / warned ─────────── */

export interface MatchedListing {
  id: string;
  title: string;
  image: string | null;
  /** AVAILABLE | TRADED | REMOVED — what the meta line is built from. */
  status: string;
  updatedAt: string;
  ownerLocation: string | null;
}

/**
 * The listing a duplicate check matched, for the `self` and `warned` panels.
 *
 * phash returns a `matchedItemId` and nothing else about it, and both panels
 * show the listing — the spec's whole argument for `self` is "it is from your
 * own listing BELOW", which needs a thumbnail and a title. One extra request,
 * made only when the verdict is not `passed`.
 *
 * A NULL RETURN IS NORMAL AND IS NOT AN ERROR. /api/v1/items/[id] answers 404
 * for a listing that has been removed, hidden by a moderator, or belongs to
 * someone in a block relationship with the viewer — and `warned` matches
 * another trader's listing, which is exactly where a block is possible. The
 * panels render without the card in that case; they must not render an error,
 * because the verdict about the photo is unchanged either way.
 */
export async function fetchMatchedListing(id: string): Promise<MatchedListing | null> {
  try {
    const { data } = await apiV1<{
      item: {
        id: string;
        title: string;
        images: string[];
        status: string;
        updatedAt: string;
        owner: { location: string | null };
      };
    }>(`/api/v1/items/${encodeURIComponent(id)}`);

    return {
      id: data.item.id,
      title: data.item.title,
      image: data.item.images[0] ?? null,
      status: data.item.status,
      updatedAt: data.item.updatedAt,
      ownerLocation: data.item.owner?.location ?? null,
    };
  } catch {
    return null;
  }
}
