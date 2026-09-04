import * as ImagePicker from "expo-image-picker";
import { createContext, createElement, useCallback, useContext, useEffect, useRef } from "react";

import { ApiError } from "../api/client";
import {
  checkDuplicate,
  fetchMatchedListing,
  uploadPhotoWithProgress,
  type PhashStatus,
} from "../api/post";
import { rules } from "../theme/post-tokens";
import { usePost, type Photo } from "./state";

/**
 * The photo pipeline: pick or capture → upload → check for duplicates.
 *
 * ── THE ORDER IS FORCED BY THE ENDPOINTS, NOT CHOSEN ────────────────────────
 *
 * /api/ai/phash takes an `imageUrl` and fetches it server-side, so it cannot
 * run until the bytes are on Cloudinary. Everything downstream of the upload is
 * therefore downstream in time as well, and the interface has to be honest
 * about that: the photo appears the instant it is picked, veiled, with a real
 * percentage over it, and the duplicate check starts only once the veil lifts.
 *
 * ── A FAILED UPLOAD NEVER LOSES THE PHOTO ───────────────────────────────────
 *
 * `localUri` is a file on the device and stays in state whatever the network
 * does. The row keeps its thumbnail, gets a warm rule and a "Try again", and
 * the wizard carries on to the next step. Removing the row on failure would
 * mean a person who took three photos in a lift arrives at step 2 with none and
 * no idea why.
 *
 * ── THE DUPLICATE CHECK FAILS CLOSED, SO THIS CODE MUST NOT "HELP" ──────────
 *
 * `checkDuplicate` resolves to `failed` on any error, timeout or non-response.
 * There is deliberately no try/catch here that turns that back into `passed`.
 * The one thing this file DOES treat specially is a 429: a rate limit is not a
 * verdict about a photo, so it surfaces as a countdown and the photo stays
 * `running` until the user re-checks.
 */

/* ─────────────────────── what may be uploaded ───────────────────────── */

/**
 * The three extensions `sanitizeImage` decodes, from the spec's own copy.
 *
 * Checked before the request rather than after, because the alternative is
 * spending a 10 MB upload to be told 415. The server checks the BYTES rather
 * than the name and is the real gate; this is the one that can answer instantly.
 */
const ALLOWED = /\.(jpe?g|png|heic|heif)$/i;

export const PHOTO_ERRORS = {
  tooLarge: "That photo is too big to send. Baylo will make it smaller — this may take a moment.",
  unsupported: "Baylo can use JPG, PNG and HEIC photos. Pick another one.",
} as const;

let seq = 0;
/** Stable within a wizard session, which is all a list key needs. */
const nextId = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`;

function makePhoto(uri: string, source: Photo["source"], size: number | undefined): Photo {
  const tooLarge = size !== undefined && size > rules.uploadMaxBytes;
  const unsupported = !ALLOWED.test(uri.split("?")[0]);
  return {
    id: nextId(),
    localUri: uri,
    source,
    // A rejected photo is born failed. It is still SHOWN — the row explains
    // itself and offers a removal — because a photo that vanishes on being
    // picked reads as the picker not working.
    upload: tooLarge || unsupported ? "failed" : "uploading",
    progress: 0,
    url: null,
    dup: "idle",
    hash: null,
    match: null,
    rejected: tooLarge ? "too-large" : unsupported ? "unsupported" : null,
  };
}

/* ────────────────────────────── the hook ────────────────────────────── */

function usePhotoPipeline() {
  const { state, dispatch } = usePost();

  /**
   * One abort controller per photo, so removing a row cancels its in-flight
   * upload and its duplicate check rather than letting them land on a photo
   * that no longer exists and patch state for a missing id.
   */
  const controllers = useRef(new Map<string, AbortController>());

  useEffect(
    () => () => {
      for (const c of controllers.current.values()) c.abort();
      controllers.current.clear();
    },
    [],
  );

  /* ── upload → duplicate check ── */

  const run = useCallback(
    async (photo: Photo) => {
      const controller = new AbortController();
      controllers.current.set(photo.id, controller);
      const patch = (p: Partial<Photo>) =>
        dispatch({ type: "photo/patch", id: photo.id, patch: p });

      let url: string;
      try {
        const result = await uploadPhotoWithProgress(
          photo.localUri,
          (fraction) => patch({ progress: fraction }),
          controller.signal,
        );
        url = result.url;
        patch({ upload: "done", progress: 1, url });
      } catch (e) {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && e.status === 429) {
          dispatch({
            type: "rate-limit",
            action: "duplicate",
            seconds: e.retryAfter ?? 60,
          });
        }
        // The photo is KEPT. `upload: "failed"` is what draws the warm rule and
        // the "Try again"; the bytes are still on the phone either way.
        patch({ upload: "failed" });
        return;
      }

      /* ── the duplicate check ── */

      patch({ dup: "running" });
      let verdict: { status: PhashStatus; hash: string | null; matchedItemId?: string };
      try {
        verdict = await checkDuplicate(url, controller.signal);
      } catch (e) {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && e.status === 429) {
          // NOT a verdict about the photo. It stays `running` and the step
          // shows the countdown with a re-check.
          dispatch({ type: "rate-limit", action: "duplicate", seconds: e.retryAfter ?? 60 });
          return;
        }
        // Anything else already resolved to `failed` inside checkDuplicate; this
        // branch is only reachable for the 429 re-throw, so treating an unknown
        // throw as a block keeps the fail-closed guarantee intact.
        patch({ dup: "failed" });
        return;
      }
      if (controller.signal.aborted) return;

      patch({ dup: verdict.status, hash: verdict.hash });

      // The matched listing is fetched only when a panel will show it. `passed`
      // shows nothing, ever, so it costs nothing.
      if (verdict.matchedItemId && verdict.status !== "passed") {
        const match = await fetchMatchedListing(verdict.matchedItemId);
        if (!controller.signal.aborted) patch({ match });
      }
    },
    [dispatch],
  );

  /* ── adding ── */

  const add = useCallback(
    (uri: string, source: Photo["source"], size?: number) => {
      if (state.photos.length >= rules.maxPhotos) return;
      const photo = makePhoto(uri, source, size);
      dispatch({ type: "photo/add", photo });
      // A photo rejected on size or type never reaches the network. The row
      // explains itself; there is nothing to upload.
      if (!photo.rejected) void run(photo);
    },
    [dispatch, run, state.photos.length],
  );

  /**
   * The gallery.
   *
   * `mediaTypes: ["images"]` — the SDK 52+ array form. The old
   * `MediaTypeOptions.Images` enum still resolves and is deprecated, and the
   * two are not interchangeable in this version.
   *
   * NO `base64: true`. It would put the whole image on the JS bridge as a
   * string for no benefit: the upload streams from the uri.
   */
  const addFromGallery = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return "denied" as const;

    const remaining = rules.maxPhotos - state.photos.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: remaining > 1,
      selectionLimit: remaining,
      quality: 0.9,
      exif: false,
    });
    if (result.canceled) return "cancelled" as const;

    for (const asset of result.assets.slice(0, remaining)) {
      add(asset.uri, "gallery", asset.fileSize);
    }
    return "added" as const;
  }, [add, state.photos.length]);

  /**
   * A capture from the in-app camera.
   *
   * Called by `CameraSheet` with the uri `takePictureAsync` produced. The
   * source is "camera" and that is the ONLY place that value is ever set — the
   * camera marker's entire meaning is that the bytes came from this path.
   */
  const addFromCamera = useCallback(
    (uri: string) => {
      add(uri, "camera");
    },
    [add],
  );

  /* ── retry and removal ── */

  const retry = useCallback(
    (id: string) => {
      const photo = state.photos.find((p) => p.id === id);
      if (!photo || photo.rejected) return;
      controllers.current.get(id)?.abort();
      dispatch({ type: "photo/patch", id, patch: { upload: "uploading", progress: 0 } });
      void run({ ...photo, upload: "uploading", progress: 0 });
    },
    [dispatch, run, state.photos],
  );

  /** Re-runs only the duplicate check, for a photo whose upload already landed. */
  const recheck = useCallback(
    (id: string) => {
      const photo = state.photos.find((p) => p.id === id);
      if (!photo?.url) return;
      dispatch({ type: "rate-limit/clear" });
      dispatch({ type: "photo/patch", id, patch: { dup: "running", match: null } });
      void (async () => {
        const verdict = await checkDuplicate(photo.url!);
        dispatch({
          type: "photo/patch",
          id,
          patch: { dup: verdict.status, hash: verdict.hash },
        });
        if (verdict.matchedItemId && verdict.status !== "passed") {
          const match = await fetchMatchedListing(verdict.matchedItemId);
          dispatch({ type: "photo/patch", id, patch: { match } });
        }
      })();
    },
    [dispatch, state.photos],
  );

  const remove = useCallback(
    (id: string) => {
      controllers.current.get(id)?.abort();
      controllers.current.delete(id);
      dispatch({ type: "photo/remove", id });
    },
    [dispatch],
  );

  return { addFromCamera, addFromGallery, retry, recheck, remove };
}

/* ──────────────────────── one pipeline per flow ─────────────────────── */

export type PhotoPipeline = ReturnType<typeof usePhotoPipeline>;

const PipelineCtx = createContext<PhotoPipeline | null>(null);

/**
 * THE PIPELINE MUST OUTLIVE THE STEP THAT STARTED IT.
 *
 * Two things go wrong if each step calls `usePhotoPipeline` for itself.
 *
 * The first is that the abort controllers live in a ref, so the hook's cleanup
 * cancels every in-flight upload when its component unmounts. Step 1 unmounts
 * the moment somebody presses Next — which is exactly what the spec asks people
 * to do: "Baylo keeps trying quietly in the background while you carry on with
 * the next steps." A per-step pipeline would cancel the upload on the press
 * that the copy promises is safe.
 *
 * The second is that a photo captured through the wizard's own camera sheet and
 * a photo picked inside step 1 would register their controllers in different
 * maps, so removing one would abort nothing.
 *
 * Mounted once, at the wizard, and consumed by whichever step needs it.
 */
export function PhotoPipelineProvider({ children }: { children: React.ReactNode }) {
  const pipeline = usePhotoPipeline();
  return createElement(PipelineCtx.Provider, { value: pipeline }, children);
}

export function usePhotos(): PhotoPipeline {
  const ctx = useContext(PipelineCtx);
  if (!ctx) throw new Error("post: usePhotos used outside <PhotoPipelineProvider>");
  return ctx;
}

/**
 * The photo everything downstream is about.
 *
 * The FIRST one that finished uploading and was not blocked — not simply the
 * first in the list, which may be a failed upload or a duplicate. Detection
 * reads it and the review rail leads with it.
 *
 * NOT "the photo whose hash is posted": EVERY photo's hash is sent now. This
 * predicate also does not wait for a duplicate verdict, deliberately — making
 * detection wait on the duplicate check would hold the item's name hostage to
 * an unrelated request. `isPostable` in state.tsx is the one that waits.
 */
export function leadPhoto(photos: Photo[]): Photo | null {
  return photos.find((p) => p.upload === "done" && p.url && p.dup !== "failed") ?? null;
}
