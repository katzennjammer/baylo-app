import { useSyncExternalStore } from "react";

/**
 * "Your listing is up." — the one message that outlives the screen that
 * produced it.
 *
 * ── WHY A STORE AND NOT A ROUTE PARAM ───────────────────────────────────────
 *
 * The wizard is pushed over the tabs from the bar's centre FAB and from the
 * offer screen, so the screen a poster returns to is whichever one they left:
 * Home, Marketplace, an offer in progress. `router.back()` finds it; nothing
 * the wizard knows lets it address that screen by name to hand it a param.
 * What the wizard CAN do is leave a note, and the root layout — which is
 * mounted under every one of those screens — draws the popup when there is
 * one. The result is a dialog over the place the person started from, with
 * no screen having to know that a post just happened.
 *
 * Module state, not context: there is exactly one of these, it is written
 * from one place, and it must not be lost by the wizard unmounting — which is
 * the very moment it is written.
 */

interface PostedNotice {
  itemId: string;
}

let current: PostedNotice | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Called by the wizard on the way out. */
export function announcePosted(itemId: string) {
  current = { itemId };
  emit();
}

export function dismissPostedNotice() {
  if (current === null) return;
  current = null;
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const read = () => current;

export function usePostedNotice(): PostedNotice | null {
  return useSyncExternalStore(subscribe, read, read);
}
