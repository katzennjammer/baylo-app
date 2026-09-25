import { CATEGORIES, type Category } from "../api/post";
import type { Item } from "../api/types";
import { showDialog } from "../components/dialog";
import { rules } from "../theme/post-tokens";
import { isWorthSaving, loadDraft, saveDraft } from "./draft";
import { initialState, type PostState, type QuantityUnit, type TradeWithinHours } from "./state";

/**
 * Relist an expired perishable: a NEW post, prefilled from the old one.
 *
 * ── IT IS A DRAFT, NOT A SECOND WAY INTO THE WIZARD ─────────────────────────
 *
 * The wizard already restores one thing on open: the draft file. So relist
 * writes the expired listing into that file with `saveDraft()` and pushes
 * /post-item, and `useStoredDraft()` restores it exactly as it restores a
 * half-filled form. No route params, no second initial-state path, and the
 * result behaves like any draft afterwards — autosaved, discarded on post.
 *
 * ── WHAT IS CARRIED, AND WHAT IS NOT ────────────────────────────────────────
 *
 * The photos, title, category and the perishable block (quantity, unit, and
 * the window LENGTH the owner chose). Not the value, not the status, not the
 * clock: the post is a fresh POST /api/items, so it is valued, reviewed or
 * published, and timed from its own createdAt like any other listing. The
 * expired row is left exactly as it is.
 *
 * ── THE PHOTOS ARE ALREADY UPLOADED ─────────────────────────────────────────
 *
 * Each comes in as `upload: "done"` with its Cloudinary URL, so nothing is
 * re-uploaded. The duplicate check has NOT run: the photo pipeline runs it on
 * mount for any uploaded photo without a verdict, and the server answers
 * "self" for the owner's own earlier listing, which is allowed. `source` is
 * "gallery" because the camera mark claims the bytes came straight from the
 * camera on this post, which a reused photo cannot.
 */
export function relistState(item: Item): PostState {
  const base = initialState();
  const category = (CATEGORIES as readonly string[]).includes(item.category)
    ? (item.category as Category)
    : null;
  const p = item.perishable;
  const unit: QuantityUnit =
    p?.quantityUnit === "PCS" || p?.quantityUnit === "LITERS" ? p.quantityUnit : "KG";
  const hours: TradeWithinHours = p?.tradeWithinHours === 6 ? 6 : 24;

  return {
    ...base,
    photos: item.images.slice(0, rules.maxPhotos).map((url, i) => ({
      id: `relist-${item.id}-${i}`,
      localUri: url,
      source: "gallery",
      upload: "done",
      progress: 1,
      url,
      dup: "idle",
      hash: null,
      match: null,
      rejected: null,
    })),
    // "corrected" so detection leaves the carried title and category alone:
    // it skips a flow whose answer the owner already gave.
    detection: { phase: "corrected", original: null, slow: false },
    category,
    title: item.title.slice(0, rules.titleMax),
    isPerishable: p != null,
    quantity: p?.quantity != null ? String(p.quantity) : "",
    quantityUnit: unit,
    tradeWithinHours: hours,
  };
}

/**
 * Write the relist draft and open the wizard.
 *
 * There is ONE draft per account (see draft.ts), so an unfinished one would be
 * overwritten. That is asked about first rather than done silently — a
 * half-written listing is somebody's work.
 */
export async function startRelist(item: Item, open: () => void): Promise<void> {
  const existing = await loadDraft();
  if (existing && isWorthSaving(existing.state)) {
    const replace = await new Promise<boolean>((resolve) =>
      showDialog(
        "Replace your draft?",
        "You have an unfinished listing saved. Relisting starts a new draft in its place.",
        [
          { text: "Keep my draft", style: "cancel", onPress: () => resolve(false) },
          { text: "Relist", onPress: () => resolve(true) },
        ],
      ),
    );
    if (!replace) return;
  }
  await saveDraft(relistState(item));
  open();
}
