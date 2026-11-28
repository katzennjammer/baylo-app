import * as SecureStore from "expo-secure-store";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { apiV1 } from "./client";
import { withTimeout } from "./timeout";
import { setBracketCeilings, validCeilings } from "../lib/brackets";

/**
 * The value-bracket table from the server (28 Nov 2026).
 *
 * The server works the limits out from Baylo's own listing values
 * (GET /api/v1/brackets) and may change them when it recalculates. The app
 * keeps the in-memory table in ../lib/brackets:
 *
 *   readCachedBrackets()  one SecureStore read at boot (started by
 *                         app/_layout.tsx alongside the font load), so a
 *                         cold start brackets tiles with the table the last
 *                         launch saw, not the hand-set default.
 *   useBracketSync()      mounted by the signed-in (app) layout. Fetches the
 *                         table on launch and on foreground (it changes at most
 *                         monthly). A changed table is installed, saved for
 *                         the next launch, and every query is invalidated so
 *                         screens redraw their bracket labels and padlocks.
 *
 * Every failure (no network, an older server without the route, a wedged
 * Keystore) keeps the current table. The server enforces its own.
 */

export interface BracketsPayload {
  ceilings: number[];
  count: number;
  premiumMinBracket: number;
  /** How the table was worked out, for an explanation line. */
  basis: {
    schemeId: string | null;
    method: string;
    activatedAt: string | null;
    sampleSize: number;
    stepRatio: number | null;
    lowAnchor: number | null;
    highAnchor: number | null;
  };
}

const CACHE_KEY = "baylo.bracketCeilings";
const READ_TIMEOUT_MS = 800;

export const bracketsKey = ["brackets"] as const;

let boot: Promise<void> | null = null;

/** Installs the table the last launch saved. Memoised; never rejects. */
export function readCachedBrackets(): Promise<void> {
  if (!boot) {
    boot = withTimeout(SecureStore.getItemAsync(CACHE_KEY), READ_TIMEOUT_MS, "bracket cache")
      .then((raw) => {
        if (!raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (validCeilings(parsed)) setBracketCeilings(parsed);
      })
      .catch(() => undefined);
  }
  return boot;
}

let writes: Promise<unknown> = Promise.resolve();
function saveCeilings(c: number[]): void {
  writes = writes.then(() => SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(c))).catch(() => undefined);
}

export function useBrackets(enabled = true) {
  return useQuery({
    queryKey: bracketsKey,
    queryFn: () => apiV1<BracketsPayload>("/api/v1/brackets"),
    select: (r) => r.data,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: true,
    // An older server has no route; that is "keep the current table", not an error to retry.
    retry: false,
    enabled,
  });
}

/** Keeps the in-memory bracket table in step with the server. See the header. */
export function useBracketSync(signedIn: boolean): void {
  const queryClient = useQueryClient();
  const { data } = useBrackets(signedIn);
  const ceilings = data?.ceilings;
  const key = ceilings?.join(",");

  useEffect(() => {
    if (!ceilings || !validCeilings(ceilings)) return;
    void readCachedBrackets().then(() => {
      if (!setBracketCeilings(ceilings)) return;
      saveCeilings(ceilings);
      // Bracket labels are computed while rendering, so redraw what is on screen.
      void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== bracketsKey[0] });
    });
    // `key` stands for `ceilings`: only a different table needs installing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, queryClient]);
}
