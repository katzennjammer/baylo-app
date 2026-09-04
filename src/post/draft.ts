import { File, Paths } from "expo-file-system";
import { useCallback, useEffect, useRef, useState } from "react";

import { currentSession } from "../api/client";
import { initialState, type PostState } from "./state";

/**
 * The draft. One per account, saved automatically, kept 30 days.
 *
 * ── WHY IT IS ON THE DEVICE AND NOT ON THE SERVER ───────────────────────────
 *
 * There is no draft endpoint. POST /api/items creates a live listing and there
 * is nothing between "nothing" and "posted", so a server-side draft would mean
 * either a new route or — much worse — creating the item early and hiding it,
 * which puts a half-filled listing in a table the browse query reads from.
 *
 * The cost is that a draft does not follow a user to a second device. That is
 * the right trade for something whose contents are mostly LOCAL FILE URIs: the
 * photos have not been uploaded yet in the common case, and a draft restored on
 * another phone would restore five references to files that do not exist there.
 *
 * ── ONE FILE, KEYED BY USER ID ──────────────────────────────────────────────
 *
 * The spec says one draft per account and does not offer a second concurrent
 * one, so this is a single file whose contents name the account they belong to.
 * A draft written by one user and read by another is the failure this guards
 * against — on a shared phone that is a stranger's photos and a stranger's
 * item, so a mismatched `userId` discards rather than restores.
 *
 * ── WHAT IS DELIBERATELY NOT SAVED ──────────────────────────────────────────
 *
 * Anything transient: in-flight upload progress, a duplicate check that was
 * running, a live rate-limit countdown, the posting flag. Restoring a photo as
 * "uploading · 62%" would mean a bar that never moves again, and restoring a
 * countdown from a 429 that expired two days ago would disable a control for no
 * reason. Those are all re-derived on restore.
 */

const FILE_NAME = "post-draft.v1.json";
const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

interface DraftEnvelope {
  version: 1;
  /** Whose draft this is. A mismatch discards rather than restores. */
  userId: string;
  savedAt: number;
  state: PostState;
}

function draftFile(): File {
  return new File(Paths.document, FILE_NAME);
}

/**
 * Strips everything that describes a moment rather than an answer.
 *
 * A photo mid-upload comes back as a failed one: the bytes are still on the
 * phone, "Try again" is the right affordance, and claiming an upload is in
 * flight when no request exists is the one state the photo row cannot recover
 * from on its own.
 */
function serialisable(state: PostState): PostState {
  return {
    ...state,
    photos: state.photos.map((p) => ({
      ...p,
      upload: p.upload === "uploading" ? ("failed" as const) : p.upload,
      progress: p.upload === "done" ? 1 : 0,
      dup: p.dup === "running" ? ("idle" as const) : p.dup,
      match: null,
    })),
    valuationPending: false,
    posting: false,
    postError: null,
    postedItemId: null,
    rateLimit: null,
  };
}

/** True when there is anything worth keeping. An untouched wizard is not a draft. */
export function isWorthSaving(state: PostState): boolean {
  return (
    state.photos.length > 0 ||
    state.title.trim().length > 0 ||
    state.wanted.trim().length > 0 ||
    state.hubIds.length > 0 ||
    state.step > 0
  );
}

export async function saveDraft(state: PostState): Promise<void> {
  const userId = currentSession()?.user?.id;
  if (!userId || !isWorthSaving(state)) return;

  const envelope: DraftEnvelope = {
    version: 1,
    userId,
    savedAt: Date.now(),
    state: serialisable(state),
  };

  try {
    const file = draftFile();
    if (!file.exists) file.create({ overwrite: true });
    file.write(JSON.stringify(envelope));
  } catch {
    // A draft that could not be written is not an error the user needs to see.
    // They are mid-flow and everything is still in memory; telling them the
    // disk is full at step 3 would interrupt the only thing that still works.
  }
}

export async function loadDraft(): Promise<DraftEnvelope | null> {
  const userId = currentSession()?.user?.id;
  if (!userId) return null;

  try {
    const file = draftFile();
    if (!file.exists) return null;

    const envelope = JSON.parse(await file.text()) as DraftEnvelope;
    if (envelope.version !== 1 || envelope.userId !== userId) {
      // Another account's draft, or a shape this build does not understand.
      // Both are discarded rather than migrated: the contents are photo URIs
      // and a half-filled form, neither of which is worth a migration path.
      await discardDraft();
      return null;
    }

    // Retention, enforced on READ rather than by a background job. A phone with
    // no scheduler still honours the 30 days the moment the flow is opened, and
    // there is no other way in — the draft is only ever read from here.
    if (Date.now() - envelope.savedAt > RETENTION_MS) {
      await discardDraft();
      return null;
    }

    return envelope;
  } catch {
    return null;
  }
}

export async function discardDraft(): Promise<void> {
  try {
    const file = draftFile();
    if (file.exists) file.delete();
  } catch {
    /* Nothing to do and nothing to say: the draft is already unreachable. */
  }
}

/**
 * Days left before the draft is deleted.
 *
 * ── THE THREE-DAY WARNING IS NOT WIRED UP, AND CANNOT BE FROM HERE ──────────
 *
 * The spec asks for a notification three days out: "Your draft listing will be
 * deleted in 3 days. Open it to finish posting." A local notification needs
 * `expo-notifications`, which is not installed, and a scheduled one needs
 * either a background task or a server that knows the draft exists — and the
 * draft deliberately never leaves the device. The retention itself IS enforced
 * (on read, above); only the reminder is missing, and this function is what a
 * notification would be built on when that decision is made.
 */
export function daysUntilExpiry(savedAt: number, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((savedAt + RETENTION_MS - now) / (24 * 60 * 60 * 1000)));
}

export const RETENTION_LINE =
  "Drafts are kept for 30 days. You can have one draft at a time.";

/* ────────────────────────────── the hook ────────────────────────────── */

/**
 * Autosave, on the two events the spec names.
 *
 * EVERY STEP TRANSITION and EVERY FIELD BLUR — not on every keystroke. Writing
 * a JSON file on each character typed into the title is a synchronous file
 * write per keypress on the JS thread, and the thing it protects against (the
 * app being killed between two letters) is not a thing that happens.
 *
 * `blur` is delivered by the fields themselves through `markDirty`, so the
 * autosave does not have to guess when a field has settled.
 */
export function useAutosave(state: PostState) {
  const lastStep = useRef(state.step);

  useEffect(() => {
    if (lastStep.current === state.step) return;
    lastStep.current = state.step;
    void saveDraft(state);
  }, [state]);

  return useCallback(() => {
    void saveDraft(state);
  }, [state]);
}

/**
 * Reads the draft once, at mount, before the wizard paints.
 *
 * `null` while it is being read, so the route can hold on a blank canvas rather
 * than paint an empty step 1 and then replace it with a restored step 4 — which
 * would be a visible flash of the wrong screen on every resumed draft.
 */
export function useStoredDraft(editingItemId: string | null) {
  const [status, setStatus] = useState<"reading" | "ready">("reading");
  const [draft, setDraft] = useState<DraftEnvelope | null>(null);

  useEffect(() => {
    let alive = true;
    // Editing an existing listing never opens a draft: the two would be
    // different items sharing one file, and the listing is the source of truth.
    if (editingItemId) {
      setStatus("ready");
      return;
    }
    void loadDraft().then((found) => {
      if (!alive) return;
      setDraft(found);
      setStatus("ready");
    });
    return () => {
      alive = false;
    };
  }, [editingItemId]);

  return { status, draft, initial: draft?.state ?? initialState(editingItemId) };
}

export type { DraftEnvelope };
