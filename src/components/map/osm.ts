import { Platform } from "react-native";

/**
 * Everything this app promises OpenStreetMap, in one file.
 *
 * The map is drawn with tiles from openstreetmap.org, which are donated
 * infrastructure run for the OSM project — not a service we are a customer of.
 * The Tile Usage Policy is the terms, and every clause of it that this app has
 * to satisfy is implemented here rather than spread across the components, so
 * that "are we still complying?" is one file to read.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THIS IS NOT A PRODUCTION TILE SOURCE. READ BEFORE SHIPPING.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The public tile server explicitly prohibits heavy use, and a consumer app on
 * an app store is exactly the "heavy use" the policy names. What is here is
 * appropriate for development and for a small pilot; a public release needs
 * ONE of:
 *
 *   · our own tile server (a rendered or vector stack we host), or
 *   · a commercial provider serving OSM data under a paid plan
 *     (MapTiler, Thunderforest, Stadia, Geoapify — all serve OSM-derived
 *     tiles, all take a key, none of them are Google), or
 *   · written agreement from the OSMF for the volume in question.
 *
 * Whichever it is, it changes ONE constant in this file — `TILE_URL` — plus a
 * key. Nothing else in the map knows where a tile comes from, and that is the
 * point of routing it through here.
 *
 * ── The clauses, and where each is honoured ────────────────────────────────
 *
 *   Descriptive User-Agent          `TILE_USER_AGENT`, applied by HubMap via
 *   identifying the application.    the WebView's `userAgent` prop, which
 *                                   replaces the UA for every request the page
 *                                   makes, tiles included. The policy blocks
 *                                   unidentified and default library agents
 *                                   outright, so this is not decoration.
 *
 *   No bulk downloading.            `MAX_ZOOM` caps at the policy's own 19, and
 *                                   `MAX_BOUNDS` pins the viewport to Metro
 *                                   Cebu — a user cannot pan to Europe and
 *                                   pull tiles we have no use for.
 *
 *   Cache; do not re-request        The WebView's HTTP cache honours the tile
 *   what you already have.          server's Cache-Control on disk, and
 *                                   `KEEP_BUFFER` holds tiles just off-screen
 *                                   in the DOM so ordinary panning re-requests
 *                                   nothing at all. See CACHING below.
 *
 *   Attribution, visibly.           `ATTRIBUTION_TEXT`, drawn by MapAttribution
 *                                   as a native view over the map. See the note
 *                                   on that component for why it is not left to
 *                                   Leaflet's own attribution control.
 *
 * ── CACHING: what we actually have, stated honestly ────────────────────────
 *
 * Two layers, neither of them a real offline tile store:
 *
 *   1. Leaflet keeps `KEEP_BUFFER` rings of tiles beyond the viewport in the
 *      DOM. Panning within that ring issues NO requests — not a cache hit, no
 *      request at all. This is what makes a normal drag free.
 *   2. Anything evicted from the DOM and later re-shown goes back through the
 *      WebView's own HTTP cache (WKWebView / Android WebView, on disk, shared
 *      per app). The tile server sends a long Cache-Control, so this is
 *      normally a disk read rather than a fetch.
 *
 * What that is NOT: a durable tile store surviving a cache eviction or an
 * offline start. A hub map that works on a phone with no signal needs bundled
 * tiles for the Metro Cebu bounding box, which is a different feature and is
 * not pretended at anywhere in this code.
 */

/* ────────────────────────────── the tiles ───────────────────────────── */

/**
 * THE ONE LINE TO CHANGE when moving off the public server. See the header.
 *
 * `{s}` is deliberately absent. The subdomain form (a.tile, b.tile, c.tile)
 * dates from HTTP/1.1 connection limits and the OSM operations team now asks
 * clients not to use it — over HTTP/2 it costs three TLS handshakes and gains
 * nothing.
 */
export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/** The policy's own ceiling. Requesting z20 from this server is a violation. */
export const MAX_ZOOM = 19;

/**
 * Below this the whole of Cebu is on screen and every further step out is a
 * fresh set of tiles for water. Nothing on this map means anything at z9.
 */
export const MIN_ZOOM = 10;

/**
 * How many rings of off-screen tiles Leaflet retains. 2 is the library default
 * and is roughly one drag's worth; 4 covers the flick a person actually does
 * when they are looking for the next hub along, at the cost of ~2.5× the tiles
 * held in the DOM. Both numbers are small — this is a 22-pin map, not a world
 * atlas — and the trade is deliberately bought in the direction of fewer
 * requests, because the requests are the thing we are rationing.
 */
export const KEEP_BUFFER = 4;

/* ─────────────────────────── who is asking ──────────────────────────── */

/**
 * The User-Agent every tile request carries.
 *
 * ⚠ THIS IS NOT YET POLICY-COMPLETE. The Tile Usage Policy asks for a way to
 * CONTACT whoever is making the requests — an email address or a project URL —
 * so that the OSM operations team can reach a misbehaving client before
 * blocking it. Baylo has no public URL or contact address to put here yet, and
 * inventing one would be worse than leaving it out: a UA pointing at a domain
 * nobody reads is indistinguishable from no contact at all, except that it also
 * lies.
 *
 * BEFORE ANY PUBLIC RELEASE, add a real contact to this string. It is a
 * one-line change and it is the difference between "identified" and
 * "identified and reachable", which is what the policy is actually asking for.
 *
 * The platform and version are in here because they are what makes a report
 * actionable — "Baylo is hammering us" is not useful, "Baylo 1.0.0 on Android
 * is hammering us" is.
 */
export const TILE_USER_AGENT = `Baylo/1.0.0 (${Platform.OS}; com.baylo.app; Safe-Zone hub map; Metro Cebu, PH)`;

/* ────────────────────────── the licence text ────────────────────────── */

/**
 * Rendered on every map surface. THIS IS A LICENCE CONDITION.
 *
 * OSM data is ODbL. Displaying it without crediting the contributors is not a
 * missing nicety, it is using the data outside its licence — so this string is
 * not conditional on a layout, a screen size, or whether the map loaded
 * "enough". If tiles are visible, this is visible.
 */
export const ATTRIBUTION_TEXT = "© OpenStreetMap contributors";

/** Where the credit points. Opened in the system browser, never in the map. */
export const ATTRIBUTION_URL = "https://www.openstreetmap.org/copyright";

/* ───────────────────────────── the region ───────────────────────────── */

/**
 * Metro Cebu, and the map opens here when it has nothing better to show.
 *
 * "Nothing better" is the ordinary case rather than a failure: this app never
 * asks for location permission (see HubMap), so on a first open with no hubs
 * loaded yet, this is the view. Roughly the middle of the Mandaue/Lapu-Lapu
 * channel, which puts both cities' hubs on screen at `DEFAULT_ZOOM`.
 */
export const DEFAULT_CENTER = { latitude: 10.3157, longitude: 123.9554 };

/** Both cities and the bridges between them, on a phone screen. */
export const DEFAULT_ZOOM = 12;

/**
 * The pan fence. Generous around the seeded hubs — from Talisay in the
 * south-west to past Punta Engaño in the north-east — and firmly not the world.
 *
 * This is a POLICY control before it is a UX one. An unfenced slippy map lets
 * somebody drag to Berlin at z19 and pull a few hundred tiles nobody will ever
 * look at, off a donated server, for a hub list that covers two cities.
 */
export const MAX_BOUNDS = {
  southWest: { latitude: 10.15, longitude: 123.75 },
  northEast: { latitude: 10.5, longitude: 124.15 },
};

/**
 * How much room to leave around the pins when fitting the view to them, in px.
 *
 * Asymmetric on purpose: the bottom inset clears the sheet that slides up when
 * a pin is tapped, so the tapped pin does not end up underneath it.
 */
export const FIT_PADDING = { top: 48, right: 40, bottom: 96, left: 40 };

/**
 * The zoom the map settles at when it is fitting a SINGLE hub.
 *
 * Fitting bounds to one point has no scale to derive — Leaflet would snap to
 * `MAX_ZOOM` and show a person four roof tiles. Close enough to read the
 * street, far enough to recognise the block.
 */
export const SINGLE_HUB_ZOOM = 16;
