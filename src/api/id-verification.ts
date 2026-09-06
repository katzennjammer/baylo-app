import { ApiError, apiV1, request } from "./client";

/**
 * The ID gate, client side.
 *
 * ── WHAT IT GATES, AND WHAT IT DOES NOT ─────────────────────────────────────
 *
 *   NEEDS IT   posting an item, proposing a deferred agreement
 *   DOES NOT   browsing, searching, messaging, liking, commenting, and —
 *              the important one — ACCEPTING a trade or a DPA
 *
 * The last one is not an oversight and no screen should ever "helpfully" add
 * the check: a trade reaches an unverified user because somebody else proposed
 * it, and blocking their accept strands a counterparty in a deal they did not
 * cause. The server enforces exactly this split and the app must not invent a
 * stricter one.
 *
 * ── THE UI IS NOT THE GATE ──────────────────────────────────────────────────
 *
 * Everything here is ADVISORY. `fetchIdVerification()` exists so a person finds
 * out before they have taken seven photos, not to decide anything: POST
 * /api/items re-derives the same answer from the database on every attempt and
 * answers 403 with `code: "ID_VERIFICATION_REQUIRED"` regardless of what this
 * client believed. `isIdGateError()` below is how a screen recognises that 403
 * when the optimistic check was stale or was skipped.
 */

export type IdVerificationStatus =
  /** Never submitted, or rejected with attempts left to spend. */
  | "unverified"
  | "pending"
  | "approved"
  | "rejected"
  /** Rejected three times. Support only. */
  | "exhausted";

export interface IdVerificationLatest {
  idType: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  /** The sentence to show the user. Written server-side; display verbatim. */
  rejectionFix: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  attemptCount: number;
}

export interface IdVerificationState {
  verified: boolean;
  status: IdVerificationStatus;
  /** Let past without a review, when ID checks launched. */
  grandfathered: boolean;
  attemptsUsed: number;
  attemptsRemaining: number;
  maxAttempts: number;
  latest: IdVerificationLatest | null;
}

export interface IdTypeOption {
  value: string;
  label: string;
}

export interface IdVerificationPayload extends IdVerificationState {
  /**
   * The accepted documents, SERVED RATHER THAN COMPILED IN.
   *
   * A shipped build that hard-codes the seven types is a build that has to go
   * through the Play Store the day an eighth is accepted or a seventh is
   * withdrawn. Served here, that is a server deploy and every installed copy
   * picks it up on the next screen open.
   */
  idTypes: IdTypeOption[];
  rejectionReasons: IdTypeOption[];
  limits: {
    maxAttempts: number;
    maxImageBytes: number;
    minIdNumberLength: number;
    maxIdNumberLength: number;
  };
}

/** Where this account stands, plus everything the submit screen renders from. */
export async function fetchIdVerification(): Promise<IdVerificationPayload> {
  const { data } = await apiV1<IdVerificationPayload>("/api/v1/id-verification");
  return data;
}

export interface SubmitIdInput {
  idType: string;
  idNumber: string;
  /** A local file URI from the camera or the picker. */
  imageUri: string;
  mimeType?: string;
}

/**
 * Submits one ID.
 *
 * MULTIPART, STRAIGHT TO THIS ENDPOINT — deliberately NOT through
 * `uploadPhoto()` first, the way every other image in this app travels.
 * /api/upload writes PUBLIC Cloudinary assets: an ID routed through it would be
 * world-readable at a stable URL for the whole time it sat in the review queue,
 * and would stay readable if the person then abandoned the form. This endpoint
 * puts the file into a private, signature-only folder in the same request that
 * creates the row, so there is no window where an uploaded ID exists with
 * nothing tracking it.
 *
 * NO Content-Type HEADER IS SET, on purpose. The transport fills in the
 * multipart boundary it generated; setting the header by hand replaces it with
 * one that has no boundary in it, and the server then parses an empty body.
 * That failure looks like "the file did not arrive" and takes an afternoon.
 *
 * THE FILE PART IS `{ uri, name, type }`, React Native's descriptor, NOT a Blob
 * and NOT a File. `request()` sees that and sends the whole thing over XHR
 * rather than fetch, because `globalThis.fetch` on SDK 57 is Expo's and its
 * JS-side encoder rejects a `uri` part outright. The note on sendMultipart() in
 * ./client is the full story; do not "fix" this by converting the photo to a
 * Blob to make fetch happy, which reintroduces the memory blowup the descriptor
 * exists to avoid.
 */
export async function submitIdVerification(input: SubmitIdInput): Promise<IdVerificationState> {
  const form = new FormData();
  form.append("idType", input.idType);
  form.append("idNumber", input.idNumber);
  form.append("file", {
    uri: input.imageUri,
    name: "id.jpg",
    type: input.mimeType ?? "image/jpeg",
  } as unknown as Blob);

  const res = await request("/api/v1/id-verification", { method: "POST", body: form });

  const body = (await res.json().catch(() => null)) as {
    data: IdVerificationState | null;
    error: { code: string; message: string } | null;
  } | null;

  if (!res.ok || !body?.data) {
    const header = res.headers.get("Retry-After");
    const retryAfter = header ? Number(header) : null;
    throw new ApiError(
      res.status,
      body?.error?.code ?? "REQUEST_FAILED",
      body?.error?.message ?? "We could not send that just now.",
      [],
      retryAfter !== null && Number.isFinite(retryAfter) ? retryAfter : null,
    );
  }
  return body.data;
}

/**
 * Is this failure the ID gate refusing?
 *
 * TWO SHAPES, BECAUSE THE TWO GATED ROUTES ANSWER DIFFERENTLY AND ALWAYS WILL.
 * POST /api/items predates /api/v1 and returns a bare `{ error, code }`, so its
 * code lands directly on `ApiError.code`. POST /api/v1/contracts returns the
 * envelope, whose `code` is the transport-level `FORBIDDEN` — the closed set
 * has no room for a per-gate code — with the specific rule in `meta.rule`,
 * which `apiV1()` now carries through the throw for exactly this.
 *
 * Checking both is not defensive padding. Matching only `code` would silently
 * miss every DPA refusal; matching only `meta.rule` would miss every posting
 * refusal. One constant, two places it can appear.
 *
 * A screen calls this on any failure from posting or proposing; if it is true,
 * send the person to /verify-id rather than showing a generic error.
 */
export const ID_VERIFICATION_REQUIRED = "ID_VERIFICATION_REQUIRED";

export function isIdGateError(e: unknown): boolean {
  if (!(e instanceof ApiError) || e.status !== 403) return false;
  return e.code === ID_VERIFICATION_REQUIRED || e.meta?.rule === ID_VERIFICATION_REQUIRED;
}
