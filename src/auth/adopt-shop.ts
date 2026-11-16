import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { getActingOrgId, hasChosenActingOrg } from "../api/org-context";
import { switchToOrganization, useOrganizations } from "../api/organizations";
import { useProfileMe } from "../api/profile";

/**
 * A SHOP-ONLY OWNER LANDS IN SHOP MODE FROM THE FIRST SCREEN (16 Nov 2026).
 *
 * Sign-out clears the acting shop (clearActingOrg), so a person who only ever
 * trades as their shop came back from sign-in in PERSONAL mode: Home greeted
 * them by their own name and points, Trades showed their empty personal
 * shelf, and an offer sent before they happened to open the Profile tab went
 * out as the person. The Profile tab already adopted the shop, but only when
 * it mounted.
 *
 * This is the same rule, run once per signed-in user from the app layout:
 * no personal activity (the server's `hasPersonalActivity`) and exactly one
 * shop. Several shops still go through the Profile tab's picker. It never
 * overrides a shop already chosen, nor a deliberate "Switch to Myself"
 * (hasChosenActingOrg), and a person with their own history is left alone.
 */
export function useAdoptShopOnSignIn(userId: string | undefined): void {
  const qc = useQueryClient();
  const me = useProfileMe(!!userId);
  const orgs = useOrganizations(!!userId);
  const decidedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || decidedFor.current === userId) return;
    if (getActingOrgId() !== null || hasChosenActingOrg()) {
      decidedFor.current = userId;
      return;
    }
    const profile = me.data;
    const list = orgs.data?.data.organizations;
    if (!profile || !list) return; // wait for both answers
    decidedFor.current = userId;

    const shops = list.filter((o) => !!o.orgUserId);
    if (profile.hasPersonalActivity !== false || shops.length !== 1) return;
    void (async () => {
      await switchToOrganization(shops[0].id);
      // Every list was fetched as the person; refetch them as the shop.
      await qc.invalidateQueries();
    })();
  }, [userId, me.data, orgs.data, qc]);
}
