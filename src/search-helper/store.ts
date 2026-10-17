import { useSyncExternalStore } from "react";

import type { HelperMatch } from "./match";

/**
 * The search helper's last search, shared by every screen that shows the
 * button (Home and Marketplace).
 *
 * The free tier is one question at a time, not a conversation, so this holds
 * ONE thing: what was typed last and what the helper made of it (after any
 * chips the person removed). Reopening the sheet on either screen shows it
 * again instead of an empty box.
 *
 * Module state, not React context: mounting a provider would mean editing the
 * (app) layout, and this is small enough not to need one. In memory only --
 * gone on a restart, which is the right lifetime for a search. `owner` stops
 * one account's last search from greeting the next person to sign in on the
 * same phone.
 */

export interface HelperState {
  owner: string | null;
  text: string;
  match: HelperMatch | null;
}

const EMPTY: HelperState = { owner: null, text: "", match: null };

let state: HelperState = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setHelperState(next: HelperState) {
  state = next;
  emit();
}

/** The last search, or an empty one if it belonged to somebody else. */
export function useHelperState(viewerId: string | null): HelperState {
  const current = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  return current.owner === viewerId ? current : { ...EMPTY, owner: viewerId };
}
