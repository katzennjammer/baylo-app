import { Linking } from "react-native";

/**
 * "Get directions" — hand a hub to whatever map app the phone already has.
 *
 * ── WHY `geo:` AND NOT canOpenURL ───────────────────────────────────────────
 *
 * The obvious shape is `canOpenURL(uri) ? openURL(uri) : fallback()`, and on
 * Android 11+ it is a trap: package visibility means `canOpenURL` returns FALSE
 * for any non-http scheme the app has not declared in a `<queries>` block in
 * AndroidManifest.xml — even when three map apps are installed and would handle
 * it perfectly. The check reports "nothing can open this" and the fallback
 * fires every time, so a phone with Google Maps, Waze and OsmAnd on it opens a
 * web page instead.
 *
 * Declaring the intent in the manifest would fix `canOpenURL`, but this project
 * runs `expo prebuild`, so a hand-edited manifest is overwritten on the next
 * one and the fix would need a config plugin to survive. TRYING THE OPEN AND
 * CATCHING THE FAILURE needs neither: `openURL` rejects when there is genuinely
 * no handler, which is the exact question `canOpenURL` was being asked, and it
 * answers it correctly on every Android version.
 *
 * ── ON iOS ──────────────────────────────────────────────────────────────────
 *
 * iOS does not register `geo:` for Apple Maps, so unless the user has installed
 * an app that claims the scheme (Google Maps and OsmAnd both do), the `geo:`
 * attempt rejects and this lands on the OpenStreetMap web page. That is the
 * specified behaviour and it works — the page has a "Directions" control of its
 * own — but a phone with no third-party map app gets a browser where it could
 * have had Apple Maps.
 *
 * If native iOS behaviour is wanted, it is one branch: try
 * `maps://?daddr=lat,lng` before the `geo:` attempt on iOS. It is not here
 * because it was not asked for, and because Apple Maps is a different provider
 * with different data — worth choosing deliberately rather than by default.
 */

export interface DirectionsTarget {
  latitude: number;
  longitude: number;
  /** Shown as the destination label by map apps that read it. */
  name: string;
}

/**
 * `geo:lat,lng?q=lat,lng(Label)`.
 *
 * The coordinate is repeated on purpose. Bare `geo:lat,lng` CENTRES a map there
 * and drops no marker and offers no route — several apps show a blank map of
 * the area and leave the user to guess. The `q=` form is what makes it a
 * destination, and the parenthesised label is what makes the pin say "Parkmall"
 * instead of a pair of numbers.
 */
function geoUri({ latitude, longitude, name }: DirectionsTarget): string {
  const at = `${latitude},${longitude}`;
  return `geo:${at}?q=${at}(${encodeURIComponent(name)})`;
}

/**
 * The fallback, and a deliberate choice of destination.
 *
 * `mlat`/`mlon` drop a marker; the `#map=` fragment sets the zoom and centre.
 * Zoom 17 is a block or two — close enough to see which entrance, far enough to
 * recognise the junction.
 */
function osmWebUrl({ latitude, longitude }: DirectionsTarget): string {
  return (
    `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}` +
    `#map=17/${latitude}/${longitude}`
  );
}

/** What actually happened, so a caller can tell the user something true. */
export type DirectionsOutcome = "map-app" | "web" | "failed";

/**
 * Opens `target` in a map app, falling back to OpenStreetMap on the web.
 *
 * Never throws. A caller that cannot open anything at all gets "failed" and can
 * say so; letting this reject would put an unhandled rejection behind a button
 * whose worst realistic outcome is "this phone has no browser".
 */
export async function openDirections(target: DirectionsTarget): Promise<DirectionsOutcome> {
  try {
    await Linking.openURL(geoUri(target));
    return "map-app";
  } catch {
    // No handler for `geo:`. Expected on a stock iPhone; see the header.
  }

  try {
    await Linking.openURL(osmWebUrl(target));
    return "web";
  } catch {
    return "failed";
  }
}
