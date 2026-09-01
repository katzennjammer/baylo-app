import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

import { PinIcon, RefreshIcon, WarningIcon } from "../icons";
import { Tappable } from "../Tappable";
import {
  border,
  color,
  icon,
  radius,
  size,
  space,
  textStyle,
  type,
} from "../../theme/tokens";
import { buildMapHtml, parseMapMessage, type MapHub } from "./map-html";
import { ATTRIBUTION_TEXT, ATTRIBUTION_URL, TILE_USER_AGENT } from "./osm";

/**
 * The map surface: a WebView running Leaflet, plus every state it can be in.
 *
 * Read map-html.ts first for WHY this is a WebView and not `react-native-maps`
 * — the short version is that react-native-maps on Android is the Google Maps
 * SDK and needs an API key, and its `<UrlTile>` has no way to set the User-Agent
 * that OSM's tile policy requires. Both are hard requirements here.
 *
 * ── THIS MAP NEVER ASKS FOR LOCATION ────────────────────────────────────────
 *
 * There is no `expo-location` in this app and no permission prompt anywhere in
 * this component, and that is a design decision rather than an omission.
 *
 * The map's job is "where are the Safe Zones", which is answered completely by
 * a fixed set of 22 public coordinates and a view of Metro Cebu. Knowing where
 * the USER is would only ever reorder that list. Asking for location before
 * showing a map is the pattern that trains people to refuse permissions, and it
 * puts a modal in front of a screen that does not need one — on a screen whose
 * entire premise is that this app is careful with where people are.
 *
 * So the "location permission not granted" state is not a degraded mode here:
 * IT IS THE ONLY MODE. There is no blue dot, no "centre on me", and nothing on
 * this screen behaves differently for a user who has granted location to some
 * other app. If a "hubs near me" feature is ever wanted, it should ask at the
 * moment somebody taps something that needs it — never as a gate on the map.
 *
 * ── THE STATES ──────────────────────────────────────────────────────────────
 *
 *   loading        Leaflet is up but no tile has painted. A spinner over the
 *                  canvas colour, not a blank screen.
 *   tiles failed   Nothing painted and the layer gave up. Retryable in place —
 *                  `retryTiles()` redraws WITHOUT remounting the WebView, so a
 *                  retry does not also throw away pan, zoom and every tile that
 *                  had already loaded.
 *   no hubs        Rendered INSTEAD of the WebView, not over it. A map with no
 *                  pins teaches nobody anything, and building one would spend
 *                  a screenful of donated tiles to say "there is nothing here".
 *
 * A partial tile failure is deliberately NOT a state. Some tiles fail on any
 * moving phone; covering a usable map with an error card because of it would be
 * a worse map than the one underneath.
 */

export interface HubMapProps {
  hubs: MapHub[];
  /**
   * False draws a still map: no dragging, no zoom, and the WebView takes no
   * touches at all, so a parent `Tappable` can own the whole surface. That is
   * how the item-detail preview opens the full screen with one tap anywhere.
   */
  interactive?: boolean;
  /** Open centred on this hub instead of fitted to all of them. */
  focusHubId?: string;
  /** The pin drawn as selected. Controlled — the sheet above owns it. */
  selectedHubId?: string | null;
  onSelectHub?: (hubId: string | null) => void;
  /** Copy for the empty state, which differs by screen. */
  emptyMessage?: string;
  style?: object;
}

export function HubMap({
  hubs,
  interactive = true,
  focusHubId,
  selectedHubId = null,
  onSelectHub,
  emptyMessage = "No Safe Zones have been set up yet.",
  style,
}: HubMapProps) {
  const webRef = useRef<WebView>(null);
  const [tiles, setTiles] = useState<"loading" | "ok" | "failed">("loading");

  /**
   * Set when Android kills the WebView's render process. Rethrown below.
   *
   * This is NOT the tile-failure path — that one is recoverable in place and
   * has its own card. This is the WebView itself dying, after which the view is
   * permanently blank and no amount of `injectJavaScript` reaches it, because
   * there is no longer a process on the other end to reach.
   */
  const [crashed, setCrashed] = useState<string | null>(null);

  /**
   * The document is rebuilt only when the PINS change, not on every render.
   *
   * A new `source` reloads the WebView, which re-runs Leaflet and re-requests
   * every visible tile. Selection changes therefore go through
   * `injectJavaScript` below rather than through this — the map is told to move
   * rather than rebuilt to be different.
   */
  const html = useMemo(
    () => buildMapHtml({ hubs, focusHubId, interactive }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      hubs.map((h) => `${h.id}:${h.isActive}`).join("|"),
      focusHubId,
      interactive,
    ],
  );

  /** Selection pushed down without a reload. See the note on `html`. */
  useEffect(() => {
    if (!interactive) return;
    webRef.current?.injectJavaScript(
      `window.__baylo && window.__baylo.select(${JSON.stringify(selectedHubId)}); true;`,
    );
  }, [selectedHubId, interactive]);

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      const msg = parseMapMessage(event.nativeEvent.data);
      if (!msg) return;

      switch (msg.type) {
        case "tiles":
          setTiles(msg.ok ? "ok" : "failed");
          break;
        case "hub":
          onSelectHub?.(msg.id);
          break;
        case "background":
          onSelectHub?.(null);
          break;
        case "ready":
          break;
      }
    },
    [onSelectHub],
  );

  const retry = useCallback(() => {
    setTiles("loading");
    webRef.current?.injectJavaScript("window.__baylo && window.__baylo.retryTiles(); true;");
  }, []);

  /* ── the WebView died ──────────────────────────────────────────────────

     THROWN, NOT RENDERED, and the throw is the whole point.

     `onRenderProcessGone` is a callback, not a render error, so nothing catches
     it on its own — the default outcome is a blank rectangle that stays blank.
     Rethrowing it during render hands it to <MapErrorBoundary>, which already
     owns the answer to "what does this screen look like without a map": the
     hub list. Handling it here instead would mean a second, parallel fallback
     that could drift from that one.

     Only an unambiguous process death gets to do this. A tile failure is
     recoverable in place and must NOT come through here — replacing a usable
     map with a list because some tiles 404'd would be a worse map, and this
     path is one-way until the boundary is reset. */
  if (crashed) throw new Error(crashed);

  /* ── no hubs ───────────────────────────────────────────────────────────
     Before the WebView, not over it — see the header. */
  if (hubs.length === 0) {
    return (
      <View style={[s.surface, s.empty, style]}>
        <View style={s.emptyCircle}>
          <PinIcon size={icon.emptyGrid.size} stroke={icon.emptyGrid.stroke} color={color.inkMuted} />
        </View>
        <Text style={[textStyle(type.hubLandmark), s.emptyText]}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={[s.surface, style]}>
      {/* `pointerEvents` is on the WRAPPER rather than the WebView: on Android
          the WebView manages its own touch handling and ignores the prop on
          itself, so a non-interactive preview would still swallow the parent's
          tap. A plain View honours it on both platforms. */}
      <View style={StyleSheet.absoluteFill} pointerEvents={interactive ? "auto" : "none"}>
        <WebView
          ref={webRef}
          // `baseUrl: ""` rather than the default. Android loads bare HTML with
          // a null origin, which some WebView builds treat as opaque and refuse
          // subresource loads from — an empty base gives the document an origin
          // the tile <img> requests are allowed to be issued from.
          source={{ html, baseUrl: "" }}
          // THE OSM POLICY REQUIREMENT. This replaces the User-Agent on every
          // request the page makes, tiles included. See osm.ts.
          userAgent={TILE_USER_AGENT}
          onMessage={onMessage}
          // The tile cache. Both platforms keep an on-disk HTTP cache honouring
          // the tile server's Cache-Control, which is what stops a pan back
          // over ground already seen from re-fetching it.
          cacheEnabled
          originWhitelist={["*"]}
          // Nothing in the document navigates. Anything trying to is either a
          // bug or something injected, and either way it does not get to
          // replace the map with a web page.
          //
          // BLOCKS http(s) RATHER THAN ALLOWING A KNOWN LIST, and the polarity
          // matters: the document itself loads under a url that differs by
          // platform and by how `source.html` is handed over ("about:blank", an
          // empty string, a data: url), so an allowlist risks blocking the map's
          // own load and rendering nothing at all. Denying the one scheme a
          // navigation away would use is the version that cannot misfire.
          //
          // Tiles are unaffected either way — they are <img> subresources, not
          // navigations, and never reach this callback.
          onShouldStartLoadWithRequest={(req) => !/^https?:/i.test(req.url)}
          // Android only, API 26+. The system reclaims a WebView's render
          // process under memory pressure — routine on a mid-range phone with
          // a 160 KB Leaflet document alive in the background — and the view it
          // leaves behind is blank forever. Returning nothing here (rather than
          // `true`) leaves react-native-webview's own handling alone; the state
          // set below is what actually reaches the boundary. See the throw above.
          onRenderProcessGone={(event) => {
            const { didCrash } = event.nativeEvent;
            setCrashed(
              didCrash
                ? "The map's WebView process crashed."
                : "Android reclaimed the map's WebView process.",
            );
          }}
          setSupportMultipleWindows={false}
          javaScriptEnabled
          domStorageEnabled
          // The document is a fixed viewport; bouncing it reveals the canvas
          // colour behind the tiles and looks like the map came loose.
          bounces={false}
          overScrollMode="never"
          scrollEnabled={false}
          // Transparent would let the screen's cream show through the gaps
          // between tiles while they load, which reads as holes in the map.
          style={s.web}
          androidLayerType="hardware"
          // A blank white flash before the first paint, on a cream app.
          containerStyle={s.webContainer}
        />
      </View>

      {/* ── loading ── over the map, so a slow tile does not hide the pins
          that have already been placed. */}
      {tiles === "loading" ? (
        <View style={s.overlay} pointerEvents="none">
          <ActivityIndicator color={color.forest} />
        </View>
      ) : null}

      {/* ── tiles failed ── */}
      {tiles === "failed" ? (
        <View style={s.overlay}>
          <View style={s.failCard}>
            <WarningIcon size={icon.offlineWarning.size} stroke={icon.offlineWarning.stroke} color={color.urgent} />
            <Text style={[textStyle(type.hubLandmark), s.failText]}>
              The map could not load. The hub list below still works.
            </Text>
            <Tappable
              onPress={retry}
              accessibilityRole="button"
              accessibilityLabel="Retry loading the map"
              style={s.retry}
              pressedStyle={s.retryPressed}
            >
              <RefreshIcon size={icon.retryPhoto.size} stroke={icon.retryPhoto.stroke} color={color.forest} />
              <Text style={[textStyle(type.secondaryButton), { color: color.forest }]}>Retry</Text>
            </Tappable>
          </View>
        </View>
      ) : null}

      <MapAttribution />
    </View>
  );
}

/**
 * "© OpenStreetMap contributors", drawn as a NATIVE view over the map.
 *
 * ── WHY THIS IS NOT LEAFLET'S ATTRIBUTION CONTROL ───────────────────────────
 *
 * Leaflet ships one and it is disabled in map-html.ts, which looks like extra
 * work for the same result. It is not the same result.
 *
 * Attribution is an ODbL LICENCE CONDITION — showing OSM tiles without it is
 * using the data outside its terms, not committing a UX oversight. Leaflet's
 * control lives inside the WebView, where a stylesheet change, a Leaflet
 * upgrade, or a document that half-loaded could hide it while tiles carried on
 * rendering perfectly. That failure is invisible: the map still looks right.
 *
 * Rendered here, the credit is a sibling of the WebView in the native tree. It
 * cannot be styled away by anything inside the document, it survives the
 * document failing to run at all, and it is drawn from the same tokens as the
 * rest of the app. It is also the only element of the map that is deliberately
 * NOT conditional on any state.
 */
function MapAttribution() {
  return (
    <View style={s.attribution} pointerEvents="box-none">
      <Tappable
        onPress={() => {
          void Linking.openURL(ATTRIBUTION_URL).catch(() => {
            // No browser, or the URL was refused. The credit is already on
            // screen, which is what the licence asks for — the link is a
            // courtesy and its failure is not worth an alert.
          });
        }}
        accessibilityRole="link"
        accessibilityLabel="OpenStreetMap copyright and licence"
        style={s.attributionPill}
        pressedStyle={s.attributionPressed}
      >
        <Text style={[textStyle(type.photoCaption), s.attributionText]}>{ATTRIBUTION_TEXT}</Text>
      </Tappable>
    </View>
  );
}

const s = StyleSheet.create({
  surface: {
    overflow: "hidden",
    borderRadius: radius.gridPhoto,
    backgroundColor: color.skeleton,
  },
  web: { flex: 1, backgroundColor: color.skeleton },
  webContainer: { backgroundColor: color.skeleton },

  // Written out rather than spread from `StyleSheet.absoluteFillObject`, which
  // this React Native version no longer types. `absoluteFill` is a registered
  // ID and cannot be extended with the two alignment rules below.
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  failCard: {
    alignItems: "center",
    gap: space.detail.headingToBody,
    paddingHorizontal: space.empty.x,
    paddingVertical: space.card.top,
    marginHorizontal: space.screenX,
    borderRadius: radius.hubRow,
    backgroundColor: color.surface,
    borderWidth: border.hairline,
    borderColor: color.controlLine,
  },
  failText: { color: color.inkSecondary, textAlign: "center" },
  retry: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.card.socialGap,
    height: size.control.reloadButton,
    paddingHorizontal: size.control.reloadButtonX,
    borderRadius: radius.reloadButton,
    borderWidth: border.hairline,
    borderColor: color.greenLine,
    backgroundColor: color.greenWash,
  },
  retryPressed: { backgroundColor: color.greenLine },

  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: space.detail.headingToBody,
    paddingHorizontal: space.empty.x,
    backgroundColor: color.inset,
  },
  emptyCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.control,
  },
  emptyText: { color: color.inkSecondary, textAlign: "center" },

  attribution: {
    position: "absolute",
    right: 6,
    bottom: 6,
  },
  attributionPill: {
    paddingHorizontal: space.photoCaption.x,
    paddingVertical: 3,
    borderRadius: radius.photoCaption,
    // Semi-opaque rather than solid: the credit must be readable over any tile,
    // and a solid chip large enough to guarantee that would cover the map.
    backgroundColor: "rgba(250, 250, 247, 0.86)",
  },
  attributionPressed: { backgroundColor: color.surface },
  attributionText: { color: color.inkSecondary },
});
