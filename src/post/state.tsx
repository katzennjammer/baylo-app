import { createContext, useContext, useMemo, useReducer, type Dispatch } from "react";

import {
  CONDITIONS,
  type Category,
  type Condition,
  type IdentifyResult,
  type MatchedListing,
  type PhashStatus,
  type ValuationPayload,
} from "../api/post";
import { rules } from "../theme/post-tokens";

/**
 * Everything the wizard knows, and the only place it changes.
 *
 * ── WHY A REDUCER AND NOT SEVEN SCREENS WITH SEVEN useStates ────────────────
 *
 * Because the steps are not independent. Detection on step 2 prefills the
 * condition on step 3; the condition on step 3 invalidates the valuation on
 * step 4; the valuation's band bounds the value the slider may reach; the value
 * and the hubs and the free text all have to survive being edited from the
 * review step and jumped back from. Held as local state that would be seven
 * components lifting props through a parent that owns them anyway — which is
 * this, with the transitions written down instead of implied.
 *
 * The second reason is the draft. It is saved on every step transition and
 * every field blur, and it is restored into a running wizard. Serialising one
 * object is a function; serialising seven components' worth of local state is a
 * convention nobody keeps.
 *
 * ── WHAT IS NOT IN HERE ─────────────────────────────────────────────────────
 *
 * Per-photo upload and duplicate-check PROGRESS. Those live on the photo rows
 * below because they belong to a photo, but the async machinery that drives
 * them is in `./photos.ts` — this file has no effects, no timers and no fetch.
 * It is a pure reducer, which is what makes the draft round-trip testable and
 * what keeps "what does Next do on step 4" answerable by reading one function.
 */

/* ──────────────────────────── the photo ─────────────────────────────── */

export type UploadState = "uploading" | "done" | "failed";

/** `idle` before the upload finishes — the check needs a Cloudinary URL. */
export type DupState = "idle" | "running" | PhashStatus;

export interface Photo {
  /** Local, stable across a re-order. Not the Cloudinary URL, which arrives late. */
  id: string;
  /** The file on the device. Survives a failed upload — that is the point. */
  localUri: string;
  /**
   * WHERE THE PHOTO CAME FROM, AND THE ONLY THING THE MARKER MEANS.
   *
   * "camera" earns the "Photographed in Baylo" mark. It is recorded at the
   * moment of capture and is never inferred later — a gallery photo that
   * happens to be a camera roll photo taken seconds ago is still `gallery`,
   * because the claim is about the path the bytes took, not about the item.
   */
  source: "camera" | "gallery";
  upload: UploadState;
  /** 0…1. Real, from the request's own upload progress — never simulated. */
  progress: number;
  /** Null until the upload lands. Both AI calls need it. */
  url: string | null;
  dup: DupState;
  /** The dHash, sent on to /api/items so the NEXT upload can match this one. */
  hash: string | null;
  /** Fetched only when the verdict is self or warned. */
  match: MatchedListing | null;
  /** Set when a photo was rejected for size or type before any request went out. */
  rejected: "too-large" | "unsupported" | null;
}

/**
 * Whether the duplicate check has come back at all.
 *
 * `idle` is before the upload lands, `running` is the request in flight.
 * Everything else is a verdict the server actually issued.
 */
export const dupSettled = (p: Photo): boolean =>
  p.dup !== "idle" && p.dup !== "running";

/**
 * Uploaded and not blocked — what the tiles, the draft sheet and detection are
 * about. Says nothing about whether the duplicate check has finished, because
 * none of those should sit and wait for it: the photo is on screen and the item
 * can be identified from it long before a verdict exists.
 */
export const isVisible = (p: Photo): boolean =>
  p.upload === "done" && p.url !== null && p.dup !== "failed";

/**
 * A photo that may become part of a listing. A blocked photo is held for its
 * panel and never posted.
 *
 * THE VERDICT MUST EXIST. This used to be `isVisible` — upload done and not
 * blocked — and the missing clause was a hole rather than a nicety. Step 0's
 * Next is gated on this predicate, so an unsettled photo enabled Next the
 * instant the upload landed; a quick tap through the wizard then posted before
 * the check returned, and `hash` is written by the SAME patch that writes the
 * verdict, so that listing was created with `imageHash: null`.
 *
 * A listing with no hash is not merely unchecked. It is invisible to every
 * future check as well, permanently — so each one that slips through makes the
 * next duplicate harder to catch. The check is worth the two seconds it costs;
 * a pool with holes in it is not worth having.
 */
export const isPostable = (p: Photo): boolean =>
  isVisible(p) && dupSettled(p);

/**
 * Step 0 is waiting on a verdict: nothing is postable yet, but something is
 * still being checked rather than merely failing.
 *
 * Drives the footer's own `detecting` register — a disabled Next that says why
 * it is disabled. A dead grey button with no sentence attached is the state
 * this replaces, and it read as a bug.
 */
export const isChecking = (p: Photo): boolean =>
  isVisible(p) && !dupSettled(p);

/* ────────────────────────── step 2, detection ───────────────────────── */

/**
 * `idle` before there is a photo to look at. `detecting` from the moment the
 * first upload lands. `failed` is reached two ways — an empty `name` from the
 * endpoint, or fifteen seconds of nothing — and looks identical either way,
 * because to the person filling in the form they ARE identical.
 */
export type DetectPhase = "idle" | "detecting" | "detected" | "corrected" | "failed";

export interface Detection {
  phase: DetectPhase;
  /** What the model said. Kept after a correction so "We thought: …" can be shown. */
  original: IdentifyResult | null;
  /** Ticks true at 8s: the framing line becomes "Still looking." */
  slow: boolean;
}

/* ─────────────────────────── the whole form ─────────────────────────── */

export interface PostState {
  /** 0-indexed. Seven steps, and the tick rail reads this directly. */
  step: number;

  photos: Photo[];
  /** Which photo the hero and the step-2 reference tile show. */
  selectedPhoto: number;

  detection: Detection;

  category: Category | null;
  title: string;
  condition: Condition;
  /** True until the user touches step 3 — drives "We filled this in…". */
  conditionPrefilled: boolean;

  valuation: ValuationPayload | null;
  valuationPending: boolean;
  /** The user's number. Null means "use the suggestion untouched". */
  valueLeaves: number | null;
  /** True once the one re-valuation is gone. Locks the slider flat. */
  revaluationSpent: boolean;

  wanted: string;
  returnCategories: Category[];

  hubIds: string[];
  /** True when "Skip for now" was taken. A real route, not an empty selection. */
  hubsSkipped: boolean;

  /**
   * Set when this flow was entered from an existing listing rather than from
   * the Post tab. Changes the header title to "Edit listing", the step-4 footer
   * to "Save changes", and is what `fetchValuation` spends a re-valuation
   * against.
   */
  editingItemId: string | null;

  posting: boolean;
  postError: string | null;
  /** The created listing's id. Non-null only after a successful post. */
  postedItemId: string | null;

  /**
   * A live 429. Holds the SECONDS remaining and which action is blocked, so the
   * step disables that one control and leaves the rest of itself usable —
   * which is the spec's rule and the difference between a rate limit and an
   * outage.
   */
  rateLimit: { action: "detect" | "duplicate" | "post"; until: number } | null;
}

export function initialState(editingItemId: string | null = null): PostState {
  return {
    step: 0,
    photos: [],
    selectedPhoto: 0,
    detection: { phase: "idle", original: null, slow: false },
    category: null,
    title: "",
    // GOOD, not null. Step 3 is prefilled by design and its Next is always
    // enabled; a null here would make "always" a lie on the one path where
    // detection failed and the user skipped straight past.
    condition: "GOOD",
    conditionPrefilled: true,
    valuation: null,
    valuationPending: false,
    valueLeaves: null,
    revaluationSpent: false,
    wanted: "",
    returnCategories: [],
    hubIds: [],
    hubsSkipped: false,
    editingItemId,
    posting: false,
    postError: null,
    postedItemId: null,
    rateLimit: null,
  };
}

/* ──────────────────────────── the actions ───────────────────────────── */

export type PostAction =
  | { type: "goto"; step: number }
  | { type: "next" }
  | { type: "back" }
  | { type: "photo/add"; photo: Photo }
  | { type: "photo/patch"; id: string; patch: Partial<Photo> }
  | { type: "photo/remove"; id: string }
  | { type: "photo/select"; index: number }
  | { type: "detect/start" }
  | { type: "detect/slow" }
  | { type: "detect/done"; result: IdentifyResult }
  | { type: "detect/fail" }
  | { type: "detect/correct"; category: Category; title: string }
  | { type: "detect/undo" }
  | { type: "field/title"; value: string }
  | { type: "field/category"; value: Category }
  | { type: "field/condition"; value: Condition }
  | { type: "valuation/pending" }
  | { type: "valuation/done"; payload: ValuationPayload }
  | { type: "valuation/spent" }
  | { type: "valuation/failed" }
  | { type: "value/set"; leaves: number }
  | { type: "field/wanted"; value: string }
  | { type: "return/toggle"; category: Category }
  | { type: "hub/toggle"; id: string }
  | { type: "hub/skip" }
  | { type: "post/start" }
  | { type: "post/done"; itemId: string }
  | { type: "post/fail"; message: string }
  | { type: "rate-limit"; action: "detect" | "duplicate" | "post"; seconds: number }
  | { type: "rate-limit/clear" }
  | { type: "restore"; state: PostState };

export const LAST_STEP = 6;

export function reduce(s: PostState, a: PostAction): PostState {
  switch (a.type) {
    case "goto":
      return { ...s, step: Math.max(0, Math.min(LAST_STEP, a.step)) };
    case "next":
      return { ...s, step: Math.min(LAST_STEP, s.step + 1) };
    case "back":
      return { ...s, step: Math.max(0, s.step - 1) };

    /* ── photos ── */

    case "photo/add": {
      if (s.photos.length >= rules.maxPhotos) return s;
      const photos = [...s.photos, a.photo];
      // The new photo becomes the hero. Adding one and looking at a different
      // one is the interaction nobody wants: you took it to see it.
      return { ...s, photos, selectedPhoto: photos.length - 1 };
    }

    case "photo/patch": {
      const photos = s.photos.map((p) => (p.id === a.id ? { ...p, ...a.patch } : p));
      return { ...s, photos };
    }

    case "photo/remove": {
      const index = s.photos.findIndex((p) => p.id === a.id);
      if (index < 0) return s;
      const photos = s.photos.filter((p) => p.id !== a.id);
      // Clamp rather than reset: removing the third of four should leave the
      // hero on a neighbour, not jump back to the first.
      const selected = Math.max(0, Math.min(photos.length - 1, s.selectedPhoto));
      return { ...s, photos, selectedPhoto: selected };
    }

    case "photo/select":
      return { ...s, selectedPhoto: Math.max(0, Math.min(s.photos.length - 1, a.index)) };

    /* ── detection ── */

    case "detect/start":
      return { ...s, detection: { phase: "detecting", original: null, slow: false } };

    case "detect/slow":
      return s.detection.phase === "detecting"
        ? { ...s, detection: { ...s.detection, slow: true } }
        : s;

    case "detect/done": {
      // The model's condition is a PREFILL, not an answer. It goes into the
      // field and step 3 says so; the user overriding it clears the flag and
      // the note goes with it.
      const condition = CONDITIONS.some((c) => c.value === a.result.condition)
        ? a.result.condition
        : s.condition;
      return {
        ...s,
        detection: { phase: "detected", original: a.result, slow: false },
        category: a.result.category,
        // Sentence case: the endpoint's prompt asks for a concise name and gets
        // back anything from "Denim jacket" to "DENIM JACKET". The field is what
        // the user will edit, so it is normalised once here rather than at every
        // place that renders it.
        title: s.title.trim() ? s.title : sentenceCase(a.result.name),
        condition,
        conditionPrefilled: true,
      };
    }

    case "detect/fail":
      // The original is KEPT if there was one — a 15-second timeout after a
      // result would be a bug, but if it happens the result is the better fact.
      return { ...s, detection: { ...s.detection, phase: "failed", slow: false } };

    case "detect/correct":
      return {
        ...s,
        detection: { ...s.detection, phase: "corrected" },
        category: a.category,
        title: a.title,
      };

    case "detect/undo": {
      const original = s.detection.original;
      if (!original) return s;
      return {
        ...s,
        detection: { ...s.detection, phase: "detected" },
        category: original.category,
        title: sentenceCase(original.name),
      };
    }

    /* ── fields ── */

    case "field/title":
      // Clamped at the boundary rather than validated after. The server's cap is
      // 200 and the design's is 70; the tighter one is the one a user can see,
      // so it is the one enforced.
      return { ...s, title: a.value.slice(0, rules.titleMax) };

    case "field/category":
      // A category change invalidates the valuation — the suggestion is a
      // function of (category, condition) and a stale one would put the slider
      // on a band the server will not accept.
      return { ...s, category: a.value, valuation: null };

    case "field/condition":
      return {
        ...s,
        condition: a.value,
        conditionPrefilled: false,
        valuation: null,
      };

    /* ── valuation ── */

    case "valuation/pending":
      return { ...s, valuationPending: true };

    case "valuation/done": {
      // The user's number is carried across a re-valuation only if it still
      // falls inside the NEW band. Keeping it outside would leave the thumb
      // pinned past the end of its own track and the server would refuse the
      // post — the exact discovery-after-the-fact the band is drawn to prevent.
      const inBand =
        s.valueLeaves !== null &&
        s.valueLeaves >= a.payload.allowed.min &&
        s.valueLeaves <= a.payload.allowed.max;
      return {
        ...s,
        valuation: a.payload,
        valuationPending: false,
        valueLeaves: inBand ? s.valueLeaves : a.payload.suggestedLeaves,
      };
    }

    case "valuation/spent":
      return { ...s, valuationPending: false, revaluationSpent: true };

    // NOT the same as `spent`. A network failure leaves the step on its
    // skeleton and re-armed; locking the slider and telling the user they had
    // used their one re-valuation would be a false statement about their
    // listing, made because a request timed out.
    case "valuation/failed":
      return { ...s, valuationPending: false };

    case "value/set": {
      const v = s.valuation;
      if (!v || s.revaluationSpent) return s;
      // Clamped HERE as well as at the gesture, so no path — a restored draft,
      // a re-valuation, a keyboard entry added later — can seat the value
      // outside the band.
      const clamped = Math.max(v.allowed.min, Math.min(v.allowed.max, a.leaves));
      return { ...s, valueLeaves: clamped };
    }

    /* ── in return ── */

    case "field/wanted":
      return { ...s, wanted: a.value.slice(0, rules.wantedMax) };

    case "return/toggle": {
      const has = s.returnCategories.includes(a.category);
      return {
        ...s,
        returnCategories: has
          ? s.returnCategories.filter((c) => c !== a.category)
          : [...s.returnCategories, a.category],
      };
    }

    /* ── hubs ── */

    case "hub/toggle": {
      const has = s.hubIds.includes(a.id);
      if (!has && s.hubIds.length >= rules.maxHubs) return s;
      return {
        ...s,
        hubIds: has ? s.hubIds.filter((h) => h !== a.id) : [...s.hubIds, a.id],
        // Choosing one after skipping un-skips. The two are the same question.
        hubsSkipped: false,
      };
    }

    case "hub/skip":
      return { ...s, hubIds: [], hubsSkipped: true, step: Math.min(LAST_STEP, s.step + 1) };

    /* ── posting ── */

    case "post/start":
      return { ...s, posting: true, postError: null };
    case "post/done":
      return { ...s, posting: false, postedItemId: a.itemId };
    case "post/fail":
      return { ...s, posting: false, postError: a.message };

    case "rate-limit":
      return {
        ...s,
        posting: false,
        rateLimit: { action: a.action, until: Date.now() + a.seconds * 1000 },
      };
    case "rate-limit/clear":
      return { ...s, rateLimit: null };

    case "restore":
      return a.state;

    default:
      return s;
  }
}

/**
 * "DENIM JACKET" and "denim jacket" both become "Denim jacket".
 *
 * Only the first character is touched. Lower-casing the rest would turn "iPhone
 * 12" into "Iphone 12" and "PS5" into "Ps5", and a brand the user has to
 * correct is worse than one that arrived shouting.
 */
function sentenceCase(s: string): string {
  const t = s.trim();
  if (!t) return t;
  const upperRun = t === t.toUpperCase() && /[A-Z]{4,}/.test(t);
  const body = upperRun ? t.toLowerCase() : t;
  return body.charAt(0).toUpperCase() + body.slice(1);
}

/* ─────────────────────────── derived reads ──────────────────────────── */

/**
 * Whether Next is enabled, per step.
 *
 * Four of the seven are ALWAYS enabled, and that is a decision rather than an
 * oversight: condition is prefilled, value has a suggestion, "in return" is
 * wholly optional and hubs have "Skip for now" as a real route. The only two
 * gates are the two where continuing would produce a listing that cannot exist
 * — no photo, or no category and no title.
 */
export function canAdvance(s: PostState): boolean {
  switch (s.step) {
    case 0:
      // At least one photo has finished uploading, was not blocked, AND has a
      // duplicate verdict. Waiting on the verdict is the point: see the note on
      // `isPostable`. The footer says it is checking rather than going quiet.
      return s.photos.some(isPostable);
    case 1:
      return s.category !== null && s.title.trim().length >= rules.titleMin;
    default:
      return true;
  }
}

/** The reason Next is off, for the field error under the offending input. */
export function titleError(s: PostState): string | null {
  if (s.step !== 1) return null;
  if (s.title.trim().length === 0) return null; // Untouched is not wrong yet.
  if (s.title.trim().length < rules.titleMin) {
    return "Add a few more words so people know what it is.";
  }
  return null;
}

/** The value that will actually be posted. The suggestion until it is moved. */
export function effectiveValue(s: PostState): number | null {
  return s.valueLeaves ?? s.valuation?.suggestedLeaves ?? null;
}

/** How many steps of seven are filled in — the draft row's meta line. */
export function draftProgress(s: PostState): number {
  return Math.min(LAST_STEP + 1, s.step + 1);
}

/* ─────────────────────────── the context ────────────────────────────── */

interface PostCtx {
  state: PostState;
  dispatch: Dispatch<PostAction>;
}

const Ctx = createContext<PostCtx | null>(null);

export function PostStateProvider({
  editingItemId = null,
  initial,
  children,
}: {
  editingItemId?: string | null;
  /**
   * A restored draft, seeded as the reducer's INITIAL state rather than
   * dispatched into it after mount.
   *
   * Dispatching a "restore" one render later would paint an empty step 1 first
   * and replace it with the restored step — a visible flash of the wrong screen
   * every time somebody resumes. The route holds its own paint until the draft
   * has been read, so by the time this provider mounts the answer is known.
   */
  initial?: PostState;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(
    reduce,
    initial ?? initialState(editingItemId),
    (s) => s,
  );
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePost(): PostCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("post: component used outside <PostStateProvider>");
  return ctx;
}
