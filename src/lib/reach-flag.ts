import { File, Paths } from "expo-file-system";

import { currentSession } from "../api/client";

/**
 * `seen_reach_explainer` — the once-per-account flag behind the first-run
 * `How trading works` sheet.
 *
 * ── WHERE IT LIVES ──────────────────────────────────────────────────────────
 *
 * A forty-byte JSON file, `reach-explainer.v1.json`, in the app's document
 * directory (`expo-file-system`'s `Paths.document`), holding the user id it
 * belongs to and when it was set. There is no endpoint that stores a
 * per-account UI flag — no PATCH /api/v1/profile with a preferences bag,
 * nothing on `User` for it — so it is on the device.
 *
 * The cost of keeping it locally is exact and worth stating: the prompt can
 * appear a second time on a second device, and it can appear again after the app
 * is reinstalled. Both are once-per-INSTALL rather than once-per-account, which
 * is the honest description of what this file implements. It cannot appear twice
 * on the same install, which is the failure this is actually guarding against —
 * never shown again, INCLUDING AFTER THE THRESHOLD MOVES, i.e. do not let a
 * changing reach re-trigger it. Settings reopens the sheet on demand without
 * touching the flag; only the dev-only reset below clears it.
 *
 * ── KEYED BY USER ID, LIKE THE POST DRAFT ───────────────────────────────────
 *
 * Same arrangement as `src/post/draft.ts` and for the same reason: on a shared
 * phone, one account's flag must not silence another account's first-run
 * explanation. A mismatched `userId` reads as "not seen".
 *
 * ── WRITE-ONCE, AND A FAILED WRITE IS NOT AN ERROR ──────────────────────────
 *
 * Every call is wrapped. A file system that will not answer is a reason to show
 * the prompt again, never a reason to fail the marketplace: the worst outcome of
 * a broken read is one extra explanation, and the worst outcome of a throw here
 * would be a blank grid.
 */

const FILE_NAME = "reach-explainer.v1.json";

interface Flag {
  version: 1;
  /** Whose flag this is. A mismatch reads as "not seen". */
  userId: string;
  seenAt: number;
}

function flagFile(): File {
  return new File(Paths.document, FILE_NAME);
}

/** True once this account has dismissed the prompt with `Got it`. */
export function hasSeenReachExplainer(): boolean {
  const userId = currentSession()?.user?.id;
  if (!userId) return true; // No session, no prompt. The grid is not reachable anyway.

  try {
    const file = flagFile();
    if (!file.exists) return false;
    // SYNCHRONOUS, unlike `post/draft.ts`'s `await file.text()`. The grid has to
    // decide whether to open the prompt on the same tick it first renders a
    // greyed tile; an async read would let one frame through without it, and the
    // file is forty bytes.
    const parsed = JSON.parse(file.textSync()) as Partial<Flag>;
    return parsed.version === 1 && parsed.userId === userId;
  } catch {
    // Unreadable or malformed. Showing the explanation again is the harmless
    // direction, so that is the direction a failure takes.
    return false;
  }
}

/**
 * Called by the first-run sheet's `Got it` and by nothing else.
 *
 * Dismissed only by `Got it` — no X, not dismissible by scrim tap, so it can't
 * be missed by accident. That rule is enforced in `OfferSheet`, which takes
 * `dismissible: false`; this function is the other half of it, and the reason
 * it is not called from an unmount effect: a prompt torn down by a process
 * death was not read, and marking it seen would lose the explanation
 * permanently.
 */
export function markReachExplainerSeen(): void {
  const userId = currentSession()?.user?.id;
  if (!userId) return;

  try {
    const flag: Flag = { version: 1, userId, seenAt: Date.now() };
    const file = flagFile();
    // `create` before `write`, the same order `post/draft.ts` uses: `write` on a
    // path that does not exist yet throws rather than creating it.
    if (!file.exists) file.create({ overwrite: true });
    file.write(JSON.stringify(flag));
  } catch {
    // The prompt will appear once more next session. Acceptable; a throw is not.
  }
}

/**
 * Dev only — the Settings row that puts the first-run sheet back for a demo.
 * Deletes the file rather than rewriting it with another user id, so the next
 * `hasSeenReachExplainer()` reads "not seen" for every account on the device.
 * A missing file is already the "not seen" state, so there is nothing to do
 * when it is absent and nothing to report when the delete fails.
 */
export function resetReachExplainerSeen(): void {
  if (!__DEV__) return;
  try {
    const file = flagFile();
    if (file.exists) file.delete();
  } catch {
    // Same stance as the write: the flag is a convenience, never a failure.
  }
}
