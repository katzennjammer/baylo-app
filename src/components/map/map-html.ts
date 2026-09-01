import { LEAFLET_CSS, LEAFLET_JS } from "./leaflet-bundle.generated";
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  FIT_PADDING,
  KEEP_BUFFER,
  MAX_BOUNDS,
  MAX_ZOOM,
  MIN_ZOOM,
  SINGLE_HUB_ZOOM,
  TILE_URL,
} from "./osm";

/**
 * The HTML document the map WebView renders, and the protocol it speaks.
 *
 * ── WHY THERE IS A WEBVIEW HERE AT ALL ──────────────────────────────────────
 *
 * The obvious choice is `react-native-maps` with a `<UrlTile>` pointed at OSM,
 * and it was rejected on two counts, both of them requirements rather than
 * preferences:
 *
 *   1. ON ANDROID, react-native-maps IS THE GOOGLE MAPS SDK. Not "defaults to"
 *      — there is no other Android provider. It needs `com.google.android.geo
 *      .API_KEY` in the manifest and a Google Cloud project with billing
 *      enabled, and without one the MapView fails authorisation and renders
 *      nothing. `mapType="none"` plus a tile overlay does not escape this: the
 *      overlay is drawn BY the Google map view, so it needs the map view to
 *      have come up. "No Google Maps, no API key, no billing account" is not
 *      satisfiable there.
 *
 *   2. `<UrlTile>` HAS NO HEADER HOOK. It takes a URL template and nothing
 *      else; its requests go out with the platform HTTP client's default
 *      User-Agent. OSM's Tile Usage Policy requires a descriptive UA
 *      identifying the application and blocks default library agents on sight.
 *      There is no prop, and no supported way, to set one.
 *
 * A WebView answers both: no Google SDK anywhere in the build, and
 * `react-native-webview`'s `userAgent` prop replaces the agent for every
 * request the page makes, tiles included.
 *
 * What it costs, stated plainly: taps cross a bridge instead of being native
 * gestures, and the map is 160 KB of vendored Leaflet. For a screen showing 22
 * fixed pins, neither is load-bearing. If the hub list ever became thousands of
 * live points, this decision is worth re-opening — against a paid vector-tile
 * provider, not against Google.
 *
 * ── THE PROTOCOL ────────────────────────────────────────────────────────────
 *
 * RN → page:  `window.__baylo.<fn>()`, called through `injectJavaScript`.
 *             Used for things that must NOT remount the WebView, because a
 *             remount throws away the user's pan and zoom and re-requests
 *             every tile — the one thing the tile policy asks us not to do.
 *
 * page → RN:  `postMessage(JSON.stringify(msg))`, typed as `MapMessage` below.
 *             Every message is a discriminated union member; the receiver
 *             ignores anything it does not recognise rather than throwing, so
 *             an older shell and a newer page cannot crash each other.
 */

/* ─────────────────────────── the wire protocol ──────────────────────── */

/** A hub as the map needs it. A structural subset of the API's `SafeZoneHub`. */
export interface MapHub {
  id: string;
  name: string;
  /** Wire form — "mall", "barangay_hall", … Decides the glyph. */
  type: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
}

export type MapMessage =
  /** Leaflet is up and the first tile request is in flight. */
  | { type: "ready" }
  /**
   * The tile layer's verdict, sent at most once each way.
   * `ok: true` on the first tile that paints; `ok: false` only when enough
   * have failed that "slow" is no longer an honest description.
   */
  | { type: "tiles"; ok: boolean }
  /** A pin was tapped. */
  | { type: "hub"; id: string }
  /** The map itself was tapped — anywhere that is not a pin. */
  | { type: "background" };

/** Narrows an arbitrary parsed message. Unknown shapes return null, never throw. */
export function parseMapMessage(raw: string): MapMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const m = value as Partial<MapMessage> & { type?: unknown };

  switch (m.type) {
    case "ready":
    case "background":
      return { type: m.type };
    case "tiles":
      return typeof (m as { ok?: unknown }).ok === "boolean"
        ? { type: "tiles", ok: (m as { ok: boolean }).ok }
        : null;
    case "hub":
      return typeof (m as { id?: unknown }).id === "string"
        ? { type: "hub", id: (m as { id: string }).id }
        : null;
    default:
      return null;
  }
}

/* ──────────────────────────── the pin design ────────────────────────── */

/**
 * Pins mark HUBS. There is no pin on this map for a seller.
 *
 * That is the privacy line the entire Safe-Zone design exists to hold, so it is
 * restated at the one place a coordinate becomes a dot on a screen: the only
 * latitude that reaches this file is a hub's, which is a mall entrance or a
 * barangay covered court and belongs to nobody. `Item.pickup` — coarsened or
 * not — is a claim about where a person lives, and it never enters this module.
 * There is no code path here that could draw one; `MapHub` has no field for it.
 *
 * ── Why the glyph carries the type and the colour does not ──────────────────
 *
 * Five hub types could be five colours, and that would read as a different app.
 * The design language has one green, and a map speaking a palette nothing else
 * on the screen uses is the sort of thing that makes a feature look bolted on.
 * So every active pin is `color.forest` and the GLYPH is the differentiator —
 * which is also how a paper map has always done it, and it survives being
 * looked at by someone who cannot distinguish the colours.
 *
 * Deactivated pins are the exception and are grey, because there the colour is
 * not naming a category, it is saying "this one is not available" — the same
 * job `color.inkStale` does for a struck-through hub row on item detail.
 */

/**
 * Glyph paths, drawn in a 16×16 box, stroked. Keyed by the API's wire type.
 *
 * EXPORTED so the legend can draw the identical marks with react-native-svg.
 * The legend exists to say "this glyph means police station", which it can only
 * do if it is the same glyph — two hand-matched copies would drift the first
 * time one was tuned, and a legend that quietly stops matching the map is worse
 * than none.
 */
export const GLYPHS: Record<string, string> = {
  // A shopfront: awning, box, doorway.
  mall: "M3 6.5 4.5 3h7L13 6.5M3 6.5V13h10V6.5M3 6.5h10M6.5 13V9.5h3V13",
  // A civic building: pediment, columns, plinth.
  barangay_hall: "M2.5 6.5 8 3l5.5 3.5M4 7.5v4.5M6.5 7.5v4.5M9.5 7.5v4.5M12 7.5v4.5M3 13h10",
  // A shield.
  police_station: "M8 2.5 13 4.5v4c0 3.1-2.2 4.7-5 5.6-2.8-.9-5-2.5-5-5.6v-4L8 2.5Z",
  // A tree over open ground.
  public_plaza: "M8 2.5 4.5 8H7l-2.5 3.5h7L9 8h2.5L8 2.5ZM8 11.5V14",
  // A bus: body, window band, wheels.
  transport_hub: "M3.5 3.5h9V11h-9V3.5ZM3.5 7h9M5.5 11v1.5M10.5 11v1.5",
};

/** The mark for a type we have no glyph for — a dot, never a broken pin. */
export const FALLBACK_GLYPH = "M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z";

/** The box every glyph above is authored in. The legend needs it too. */
export const GLYPH_BOX = 16;

/**
 * Palette, mirrored from `theme/tokens.js`.
 *
 * A HAND-KEPT COPY, and the honest word for it — same arrangement as
 * `CONDITIONS` in api/browse.ts. These values cross into a string of HTML that
 * Metro never parses as JS, so `tokens.js` cannot be imported into the document
 * itself; importing it here and interpolating would work but would put five
 * colours in two places anyway. Written down once, in the file that draws them.
 */
const PIN = {
  active: { body: "#1B4D2B", disc: "#FAFAF7", glyph: "#1B4D2B" },
  inactive: { body: "#A8A69A", disc: "#F1EFE8", glyph: "#8C8A7E" },
  ring: "#FAFAF7",
  selectedRing: "#3DBE5A",
};

/* ─────────────────────────────── the page ───────────────────────────── */

/**
 * `</script>` inside injected JSON would close the tag that carries it, which
 * turns the rest of the payload into visible text. Hub names are seeded data
 * and contain nothing of the sort; this is here so that stays true when hubs
 * become admin-editable.
 */
const safeJson = (value: unknown): string =>
  JSON.stringify(value).replace(/<\/(script)/gi, "<\\/$1");

export interface MapHtmlOptions {
  hubs: MapHub[];
  /**
   * Open focused on one hub rather than fitted to all of them. Used by the item
   * detail map, where one card's worth of hubs is the whole subject.
   */
  focusHubId?: string;
  /** Draw at a fixed scale with gestures off — the inline preview on item detail. */
  interactive: boolean;
}

export function buildMapHtml({ hubs, focusHubId, interactive }: MapHtmlOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<style>${LEAFLET_CSS}</style>
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #EDEBE3; }
  /* The canvas colour under the tiles. Matches the app's divider grey so the
     gap before the first tile paints reads as "loading", not as "broken". */
  #map { position: absolute; inset: 0; background: #EDEBE3; outline: none; }

  /* Leaflet's own attribution control is OFF (see the map options below) and
     the credit is drawn natively instead — see MapAttribution. Leaflet's
     control lives inside this document, where a styling mistake or a future
     Leaflet change could hide it silently while tiles kept rendering. A licence
     condition should not be able to fail quietly. */
  .leaflet-control-container { display: none; }

  .baylo-pin { background: none; border: 0; }
  .baylo-pin svg { display: block; }
  /* The tapped pin lifts slightly and takes a green ring. Transform only, so it
     never reflows the tile layer underneath. */
  .baylo-pin.is-selected svg { transform: scale(1.14); transform-origin: 50% 100%; }
  .baylo-pin svg { transition: transform 120ms ease-out; }

  /* Kills the blue tap flash Android WebView paints over the pin. */
  * { -webkit-tap-highlight-color: transparent; }
</style>
</head>
<body>
<div id="map"></div>
<script>${LEAFLET_JS}</script>
<script>
(function () {
  var HUBS = ${safeJson(hubs)};
  var FOCUS_ID = ${safeJson(focusHubId ?? null)};
  var INTERACTIVE = ${interactive ? "true" : "false"};
  var GLYPHS = ${safeJson(GLYPHS)};
  var FALLBACK_GLYPH = ${safeJson(FALLBACK_GLYPH)};
  var PIN = ${safeJson(PIN)};

  function post(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  }

  /* ── the map ─────────────────────────────────────────────────────────── */

  var map = L.map('map', {
    zoomControl: false,
    // Off; the credit is a native view over this one. See the CSS note.
    attributionControl: false,
    minZoom: ${MIN_ZOOM},
    maxZoom: ${MAX_ZOOM},
    maxBounds: L.latLngBounds(
      [${MAX_BOUNDS.southWest.latitude}, ${MAX_BOUNDS.southWest.longitude}],
      [${MAX_BOUNDS.northEast.latitude}, ${MAX_BOUNDS.northEast.longitude}]
    ),
    // Rubber-banding back into bounds rather than a hard stop, so the fence
    // feels like an edge instead of a bug.
    maxBoundsViscosity: 0.85,
    // The whole interaction set, off in one place for the inline preview.
    dragging: INTERACTIVE,
    touchZoom: INTERACTIVE,
    doubleClickZoom: INTERACTIVE,
    scrollWheelZoom: false,
    boxZoom: false,
    keyboard: false,
    // A one-finger drag inside the preview must scroll the SCREEN, not pan a
    // map the user cannot zoom anyway.
    tap: true
  });

  var tiles = L.tileLayer(${safeJson(TILE_URL)}, {
    maxZoom: ${MAX_ZOOM},
    keepBuffer: ${KEEP_BUFFER},
    // Draw while panning rather than only on settle: with keepBuffer this costs
    // no extra requests and avoids a blank band at the leading edge of a drag.
    updateWhenIdle: false,
    crossOrigin: false
  });

  /* ── tile health ─────────────────────────────────────────────────────── */
  //
  // Reported at most once in each direction. "Some tiles failed" is normal on a
  // moving phone and must not put a failure screen over a usable map, so a
  // failure is only declared while NOTHING has painted yet.

  var okPosted = false;
  var failPosted = false;
  var errorCount = 0;

  tiles.on('tileload', function () {
    if (okPosted) return;
    okPosted = true;
    post({ type: 'tiles', ok: true });
  });

  tiles.on('tileerror', function () {
    errorCount++;
    // Four is about one screenful's worth at these zooms — enough that this is
    // the server or the network, not one unlucky request.
    if (!okPosted && !failPosted && errorCount >= 4) {
      failPosted = true;
      post({ type: 'tiles', ok: false });
    }
  });

  // Nothing at all after 12s is its own failure: a hung DNS lookup or a captive
  // portal never fires 'tileerror', so without this the map spins forever.
  setTimeout(function () {
    if (!okPosted && !failPosted) {
      failPosted = true;
      post({ type: 'tiles', ok: false });
    }
  }, 12000);

  tiles.addTo(map);

  /* ── pins ────────────────────────────────────────────────────────────── */

  function pinSvg(hub, selected) {
    var c = hub.isActive ? PIN.active : PIN.inactive;
    var glyph = GLYPHS[hub.type] || FALLBACK_GLYPH;
    var ring = selected ? PIN.selectedRing : PIN.ring;
    return (
      '<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M16 1.6c-7.9 0-14.4 6.4-14.4 14.4 0 10.1 14.4 24 14.4 24s14.4-13.9 14.4-24c0-8-6.5-14.4-14.4-14.4z"' +
          ' fill="' + c.body + '" stroke="' + ring + '" stroke-width="2.2"/>' +
        '<circle cx="16" cy="16" r="10.4" fill="' + c.disc + '"/>' +
        '<g transform="translate(8,8)" fill="none" stroke="' + c.glyph + '"' +
          ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="' + glyph + '"/>' +
        '</g>' +
      '</svg>'
    );
  }

  function iconFor(hub, selected) {
    return L.divIcon({
      className: 'baylo-pin' + (selected ? ' is-selected' : ''),
      html: pinSvg(hub, selected),
      iconSize: [32, 42],
      // The point of the teardrop, not its middle — the pin marks the ground
      // under its tip, which is where a person is being told to stand.
      iconAnchor: [16, 42]
    });
  }

  var markers = {};
  var selectedId = null;

  HUBS.forEach(function (hub) {
    var marker = L.marker([hub.latitude, hub.longitude], {
      icon: iconFor(hub, false),
      keyboard: false,
      title: hub.name,
      alt: hub.name,
      // Active hubs sit above deactivated ones where they overlap: the one you
      // can still be sent to should be the one you can hit.
      zIndexOffset: hub.isActive ? 1000 : 0,
      interactive: INTERACTIVE
    });
    marker.on('click', function () {
      select(hub.id);
      post({ type: 'hub', id: hub.id });
    });
    marker.addTo(map);
    markers[hub.id] = { hub: hub, marker: marker };
  });

  function select(id) {
    if (selectedId === id) return;
    [selectedId, id].forEach(function (which) {
      if (!which || !markers[which]) return;
      var entry = markers[which];
      entry.marker.setIcon(iconFor(entry.hub, which === id));
    });
    selectedId = id;
  }

  map.on('click', function () {
    select(null);
    post({ type: 'background' });
  });

  /* ── the opening view ────────────────────────────────────────────────── */

  var FIT_PADDING = [
    [${FIT_PADDING.top}, ${FIT_PADDING.left}],
    [${FIT_PADDING.bottom}, ${FIT_PADDING.right}]
  ];

  function fitAll(animate) {
    var pts = HUBS.map(function (h) { return [h.latitude, h.longitude]; });
    if (pts.length === 0) {
      // No hubs is a legitimate state, not an error — the shell draws the copy
      // for it over this. Metro Cebu is still the right thing to be looking at.
      map.setView([${DEFAULT_CENTER.latitude}, ${DEFAULT_CENTER.longitude}], ${DEFAULT_ZOOM});
      return;
    }
    if (pts.length === 1) {
      // fitBounds on a single point has no scale to work from and snaps to
      // maxZoom, which shows four roof tiles and no context.
      map.setView(pts[0], ${SINGLE_HUB_ZOOM}, { animate: !!animate });
      return;
    }
    map.fitBounds(L.latLngBounds(pts), {
      paddingTopLeft: FIT_PADDING[0],
      paddingBottomRight: FIT_PADDING[1],
      maxZoom: ${SINGLE_HUB_ZOOM},
      animate: !!animate
    });
  }

  if (FOCUS_ID && markers[FOCUS_ID]) {
    var f = markers[FOCUS_ID].hub;
    map.setView([f.latitude, f.longitude], ${SINGLE_HUB_ZOOM});
    select(FOCUS_ID);
  } else {
    fitAll(false);
  }

  /* ── the RN-callable surface ─────────────────────────────────────────── */
  //
  // Everything here exists so the shell can change the map WITHOUT remounting
  // the WebView. A remount re-runs this whole document and re-requests every
  // tile on screen, which is exactly what the tile policy asks us not to do.

  window.__baylo = {
    focus: function (id, zoom) {
      var entry = markers[id];
      if (!entry) return;
      map.setView([entry.hub.latitude, entry.hub.longitude], zoom || ${SINGLE_HUB_ZOOM}, { animate: true });
      select(id);
    },
    select: function (id) { select(id); },
    fitAll: function () { fitAll(true); },
    retryTiles: function () {
      okPosted = false;
      failPosted = false;
      errorCount = 0;
      tiles.redraw();
    },
    invalidate: function () { map.invalidateSize(); }
  };

  post({ type: 'ready' });
}());
</script>
</body>
</html>`;
}
