import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { goBack } from "../src/lib/go-back";

import { OrgDetailsStep } from "../src/components/auth-org-details";
import { showDialog } from "../src/components/dialog";

/**
 * /register-shop — register an MSME shop from inside the app. Reached from
 * Settings.
 *
 * ── WHY IT EXISTS ───────────────────────────────────────────────────────────
 *
 * The business-details form was only ever a step of signup. Both signups let
 * a person put it off — "Decide later" on the account-type screen, "Do this
 * later" on the form itself — and until this route there was no later: nothing
 * in the app could open the form again, so the choice was permanent. Since
 * staff were removed (2 Oct 2026) a shop's owner is also the only way anyone
 * ever acts as it, which made the missing door the only door.
 *
 * ── THE SAME FORM, NOT A COPY ───────────────────────────────────────────────
 *
 * `OrgDetailsStep` with `inApp`: same fields, same validation, same multipart
 * POST /api/v1/organizations. `accessToken` is null because a session IS
 * installed here, and the request layer attaches it — the component's own note
 * says null is for exactly this.
 *
 * ── AFTER IT IS CREATED ─────────────────────────────────────────────────────
 *
 * `useCreateOrganization()` switches this device to act as the new shop, the
 * same as signup. Every cached list was fetched as the person, so the whole
 * cache is dropped — the rule OrgSwitcher states for any switch. The shop
 * starts PENDING: it cannot post until an admin has checked the document, and
 * the dialog says so rather than leaving the first refused post to explain it.
 */
export default function RegisterShopScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  return (
    <OrgDetailsStep
      inApp
      accessToken={null}
      onSkip={() => goBack(router)}
      onDone={() => {
        void qc.invalidateQueries();
        goBack(router);
        showDialog(
          "Shop registered",
          "We will check your business document. Until it is approved the shop cannot post; you can keep posting as yourself from Settings.",
        );
      }}
    />
  );
}
