import { useEffect } from "react";

import { useProfileMe } from "../api/profile";
import { noteOpeningReputation } from "./opening-tier-store";

/**
 * Keeps the cached opening tier in step with the server, IN THE BACKGROUND.
 *
 * Mounted by the (app) layout, so it only ever runs after the intro has ended
 * and a session exists: it cannot delay the film, and it never changes the one
 * already played. Its job is the NEXT launch.
 *
 * It observes the same profile/me query every other reader shares, so a login,
 * a refresh, an invalidation after a switch or a Premium change all arrive
 * here without anyone having to call it. Switching personal <-> shop does not
 * wait for that refetch: the store re-resolves the moment the acting org moves
 * (see `onActingOrgChange` in ./opening-tier-store).
 */
export function useOpeningTierSync(signedIn: boolean): void {
  const { data } = useProfileMe(signedIn);
  const premium = data?.reputation.premium;
  const vip = data?.reputation.vip;

  useEffect(() => {
    if (!signedIn || !data) return;
    noteOpeningReputation({ premium, vip });
    // `data` itself is not a dependency: a refetch with the same standing has
    // nothing new to write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, !!data, premium, vip]);
}
