import { Share } from "react-native";

import { getApiBase } from "../api/config";

/**
 * Sharing a listing, and the honest state of the link it shares.
 *
 * ── WHAT THIS SENDS ─────────────────────────────────────────────────────────
 *
 * `<origin>/listings/<id>` — the web app's public listing page. It is genuinely
 * public: `proxy.ts` matches only `/`, `/auth/*`, `/dashboard/*` and `/admin/*`,
 * and the page itself renders for a signed-out visitor and offers them a sign-in
 * link instead of the trade button. So a recipient with no account sees the
 * item, which is the whole point of a share.
 *
 * The origin comes from `getApiBase()` — the same value the API client is
 * pointed at, including whatever the login screen's gear has overridden it to.
 * That is correct rather than convenient: the web app and the API are one
 * Next.js deployment, so the host serving `/api/v1/home` is by construction the
 * host serving `/listings/<id>`. Hardcoding a production origin here would send
 * a link to a server that does not have the listing on it.
 *
 * ── WHAT DOES NOT EXIST YET, AND SHOULD BE SAID PLAINLY ─────────────────────
 *
 * THIS LINK DOES NOT OPEN THE APP. It opens a browser, on every device,
 * including one with Baylo installed. Making it open the app needs universal
 * links / App Links, which is three things this project does not have:
 *
 *   1. an HTTPS origin. `getApiBase()` is `http://<laptop>:3000` today. Both
 *      platforms refuse to associate a plain-HTTP domain, so there is nothing
 *      to configure until the backend is deployed somewhere with a certificate.
 *   2. association files served from that origin — `/.well-known/assetlinks.json`
 *      (Android, carrying the release keystore's SHA-256 fingerprint) and
 *      `/.well-known/apple-app-site-association` (iOS). Neither is in the web
 *      app's `public/`; there is no `public/.well-known` directory at all.
 *   3. `android.intentFilters` and `ios.associatedDomains` in `app.json`. Not
 *      there either — `expo.scheme` is set (`baylo`, `com.baylo.app`) and that
 *      covers only custom-scheme links.
 *
 * A `baylo://item?id=…` link WOULD open the app, today, and is deliberately not
 * what is shared: it is inert for everyone who does not already have the app
 * installed, which is most of the people a listing gets sent to. A share sheet
 * that produces a dead link for a stranger is worse than one that produces a
 * web page for everybody.
 *
 * So: an https link, and the app-opening half is a deployment task. When the
 * three items above land, this function does not change — the same URL simply
 * starts resolving to the app on a device that has it.
 */

/** `<origin>/listings/<id>`, or null when no API base is configured yet. */
export function listingUrl(id: string): string | null {
  const base = getApiBase().replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/listings/${encodeURIComponent(id)}`;
}

export interface ShareResult {
  /** False only when there was no link to send. A dismissed sheet is not a failure. */
  ok: boolean;
}

/**
 * Opens the OS share sheet for a listing.
 *
 * ── THE URL IS IN `message`, NOT IN `url` ───────────────────────────────────
 *
 * React Native's `Share.share` takes both, and `url` is iOS-only — Android
 * ignores it outright and sends `message` alone, so a link passed as `url`
 * arrives on Android as a title with nothing to tap. Sending one string that
 * contains the link is the only form both platforms deliver intact. `title` is
 * Android-only in turn and sets the chooser's heading, so it is set as well;
 * each platform reads the fields it has and ignores the rest.
 *
 * A DISMISSED SHEET IS A SUCCESS. `Share.share` resolves with
 * `action: "dismissedAction"` when somebody backs out, and this reports `ok`
 * either way — closing a share sheet is a decision, not an error, and there is
 * nothing to tell the user about it.
 *
 * A THROW IS SWALLOWED. The only way this rejects is the sheet failing to
 * open at all, which on Android means an activity-not-found on a device with no
 * share targets. There is no useful recovery and no useful message, and an
 * error dialog over a feed because a share sheet did not open would be a worse
 * outcome than the silence.
 */
export async function shareListing(item: {
  id: string;
  title: string;
  valueLeaves: number | null;
}): Promise<ShareResult> {
  const url = listingUrl(item.id);
  if (!url) return { ok: false };

  // The value is included when there is one because it is the single most
  // useful fact in a link preview that has no image — and omitted rather than
  // written as "0 Leaves" when there is not, for the same reason the card omits
  // the chip: an unvalued item is not an item worth nothing.
  const worth = item.valueLeaves !== null ? ` — ${item.valueLeaves} Leaves` : "";

  try {
    await Share.share(
      { message: `${item.title}${worth} on Baylo\n${url}`, title: item.title },
      { dialogTitle: "Share this listing" },
    );
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
