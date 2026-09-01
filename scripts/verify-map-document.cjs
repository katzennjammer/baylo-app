/**
 * Acceptance harness for the map document.
 *
 * Run:  npx tsx scripts/verify-map-document.cjs
 *
 * The map's HTML is assembled by string concatenation and then executed inside
 * a WebView, which is the worst combination there is for feedback: a typo in
 * the inline script does not fail the build, does not fail `tsc`, and does not
 * throw anywhere React Native can see it. It produces a grey rectangle on a
 * phone, and the only clue is a `postMessage` that never arrives.
 *
 * So everything that CAN be checked off-device is checked here:
 *
 *   §1  the vendored Leaflet survived being turned into a string literal
 *   §2  the document's own inline script is syntactically valid JavaScript
 *   §3  hub data reaches the document intact, including a hostile name
 *   §4  the OSM policy items are actually in the output
 *   §5  the non-interactive preview really does disable interaction
 *
 * What this CANNOT check: that Leaflet then behaves, that tiles load, or that a
 * tap crosses the bridge. Those need a device. This is the layer under that.
 *
 * CommonJS + `npx tsx`, and `react-native` stubbed through Module._load before
 * anything is required — the same arrangement, for the same reason, as
 * verify-api-client.cjs. osm.ts imports `Platform` to build the User-Agent, and
 * the real react-native package cannot load under Node.
 */

const assert = require("assert");
const vm = require("vm");
const Module = require("module");

// ── react-native stub ────────────────────────────────────────────────────────

const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "react-native") {
    return { Platform: { OS: "android", select: (o) => o.android ?? o.default } };
  }
  return originalLoad.call(this, request, ...rest);
};

const { buildMapHtml } = require("../src/components/map/map-html.ts");
const osm = require("../src/components/map/osm.ts");
const bundle = require("../src/components/map/leaflet-bundle.generated.ts");

// ── harness ──────────────────────────────────────────────────────────────────

let failures = 0;
function check(label, fn) {
  try {
    fn();
    console.log(`  ok    ${label}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL  ${label}`);
    console.log(`        ${String(err.message).split("\n")[0]}`);
  }
}

/* ── §1 ─────────────────────────────────────────────────────────────────── */

console.log("\n§1  the vendored Leaflet\n");

check("LEAFLET_JS round-tripped out of the string literal", () => {
  assert.ok(bundle.LEAFLET_JS.length > 100000, `only ${bundle.LEAFLET_JS.length} chars`);
});

check("LEAFLET_CSS round-tripped out of the string literal", () => {
  assert.ok(bundle.LEAFLET_CSS.length > 5000, `only ${bundle.LEAFLET_CSS.length} chars`);
});

check("the vendored Leaflet is syntactically valid JavaScript", () => {
  // If the escaping in vendor-leaflet.mjs ever mangles the source, it shows up
  // here rather than as a blank map on a phone.
  new vm.Script(bundle.LEAFLET_JS, { filename: "leaflet.js" });
});

check("nothing in the bundle can close its own <script>/<style> tag", () => {
  assert.ok(!/<\/script/i.test(bundle.LEAFLET_JS), "LEAFLET_JS contains </script");
  assert.ok(!/<\/style/i.test(bundle.LEAFLET_CSS), "LEAFLET_CSS contains </style");
});

check("the bundle reports the version it was cut from", () => {
  assert.equal(bundle.LEAFLET_VERSION, "1.9.4");
});

/* ── building documents ─────────────────────────────────────────────────── */

const HUBS = [
  {
    id: "szh-mnd-parkmall",
    name: "Parkmall",
    type: "mall",
    latitude: 10.32271,
    longitude: 123.93852,
    isActive: true,
  },
  {
    id: "szh-llc-police-station",
    name: "Lapu-Lapu City Police Station",
    type: "police_station",
    latitude: 10.30982,
    longitude: 123.95003,
    isActive: true,
  },
  {
    // The row that would break naive string building: a name that closes the
    // script tag, an unknown type, quotes and a backslash. Hub names are seeded
    // today; this is the check that survives them becoming admin-editable.
    id: "szh-hostile",
    name: "</script><script>alert('xss')</script> \"quoted\" \\ backslash",
    type: "not_a_real_type",
    latitude: 10.3,
    longitude: 123.9,
    isActive: false,
  },
];

const html = buildMapHtml({ hubs: HUBS, interactive: true });

/**
 * The document's own inline script.
 *
 * NOT `match(/<script>([\s\S]*?)<\/script>/g)` and taking the last one, which
 * is what this did first and which was quietly wrong: the hostile hub name
 * above contains a literal `<script>`, so that regex found a third "block"
 * starting inside our JSON payload and returned a fragment of it. Every check
 * run against that fragment was meaningless — including the one asserting it
 * parsed, which passed on a few lines of string literal.
 *
 * The document has a known shape: Leaflet's block, then ours. So the end of the
 * FIRST `</script>` locates the boundary between them, and everything from the
 * next `<script>` to the LAST `</script>` is ours. An opening `<script>` inside
 * a string cannot confuse that, and a closing one cannot exist — `safeJson`
 * escapes it, which is what §3 checks.
 */
function inlineScript(doc) {
  const CLOSE = "</script>";
  const firstClose = doc.indexOf(CLOSE);
  const open = doc.indexOf("<script>", firstClose + CLOSE.length);
  const lastClose = doc.lastIndexOf(CLOSE);
  assert.ok(
    firstClose !== -1 && open !== -1 && lastClose > open,
    "could not locate the document's own script block",
  );
  return doc.slice(open + "<script>".length, lastClose);
}

/* ── §2 ─────────────────────────────────────────────────────────────────── */

console.log("\n§2  the document's inline script\n");

check("the assembled document's inline script parses as JavaScript", () => {
  new vm.Script(inlineScript(html), { filename: "map-document-inline.js" });
});

check("the document contains exactly two script CLOSINGS", () => {
  // Closings, not openings, and the distinction is the whole point. An opening
  // `<script>` inside a JS string is inert — the HTML parser's script-data
  // state only ends at `</script`. So the invariant that matters is that no
  // payload can contribute a CLOSING tag: exactly two means Leaflet's and ours,
  // and the hostile hub name did not manage to end a block early.
  const n = (html.match(/<\/script>/g) || []).length;
  assert.equal(n, 2, `found ${n}`);
});

check("Leaflet is injected before the script that uses it", () => {
  assert.ok(html.indexOf("L.map(") > html.indexOf("createTile"), "ordering wrong");
});

check("the document's script closes its IIFE", () => {
  // Everything the page defines lives inside one immediately-invoked function,
  // so nothing leaks onto `window` except the `__baylo` surface RN calls.
  assert.match(inlineScript(html).trimEnd(), /\}\(\)\);$/);
});

check("every injectJavaScript call ends with a value", () => {
  // THIS is where the trailing-`true;` rule actually applies — `injectJavaScript`,
  // not a <script> block. react-native-webview evaluates the string and warns on
  // Android when the last statement has no value. An earlier version of the
  // document carried a `true;` at the end of its <script>, where it did nothing
  // at all; the real requirement is on these call sites.
  const src = require("fs").readFileSync(
    require("path").join(__dirname, "../src/components/map/HubMap.tsx"),
    "utf8",
  );
  const calls = src.match(/injectJavaScript\(\s*[`"'][\s\S]*?[`"'],?\s*\)/g) || [];
  assert.ok(calls.length >= 2, `expected injectJavaScript call sites, found ${calls.length}`);
  for (const call of calls) {
    assert.ok(/true;\s*[`"']/.test(call), `missing trailing true; in: ${call.slice(0, 60)}…`);
  }
});

/* ── §3 ─────────────────────────────────────────────────────────────────── */

console.log("\n§3  hub data crossing into the document\n");

check("every hub id reaches the document", () => {
  for (const h of HUBS) assert.ok(html.includes(h.id), `missing ${h.id}`);
});

check("a hub name containing </script> cannot close the tag early", () => {
  const script = inlineScript(html);
  assert.ok(script.includes("szh-hostile"), "hostile hub did not reach the document");
  assert.ok(!/<\/script>/i.test(script), "raw </script> survived into the script body");
});

check("the escaped payload still parses, with the hostile name intact", () => {
  const script = inlineScript(html);
  const decl = script.match(/var HUBS = (\[[\s\S]*?\]);/)[1];
  const parsed = new vm.Script(`(${decl})`).runInNewContext({});
  const hostile = parsed.find((h) => h.id === "szh-hostile");
  assert.equal(hostile.name, HUBS[2].name, "name was corrupted in transit");
  assert.equal(parsed.length, HUBS.length);
});

check("an unknown hub type falls back to a glyph rather than drawing nothing", () => {
  assert.ok(html.includes("FALLBACK_GLYPH"), "no fallback path in the document");
  const script = inlineScript(html);
  const decl = script.match(/var GLYPHS = (\{[\s\S]*?\});/)[1];
  const glyphs = new vm.Script(`(${decl})`).runInNewContext({});
  assert.ok(!glyphs["not_a_real_type"], "test type should be unknown to the map");
  for (const t of ["mall", "barangay_hall", "police_station", "public_plaza", "transport_hub"]) {
    assert.ok(glyphs[t], `no glyph for ${t}`);
  }
});

check("the pin anchors on its tip, not its centre", () => {
  // The pin marks the ground a person is told to stand on. Anchoring at the
  // centre would put every hub ~20 px north of where it is.
  assert.match(html, /iconAnchor: \[16, 42\]/);
});

/* ── §4 ─────────────────────────────────────────────────────────────────── */

console.log("\n§4  the OSM policy items\n");

check("tiles are requested from the URL osm.ts names", () => {
  assert.ok(html.includes(osm.TILE_URL), "tile url missing from the document");
  assert.ok(osm.TILE_URL.includes("tile.openstreetmap.org"));
});

check("no subdomain sharding — the ops team asks clients not to", () => {
  assert.ok(!osm.TILE_URL.includes("{s}"), "tile url still uses {s}");
});

check("zoom is capped at the policy's 19", () => {
  assert.equal(osm.MAX_ZOOM, 19);
  assert.ok(html.includes("maxZoom: 19"));
});

check("the viewport is fenced to Metro Cebu", () => {
  assert.ok(html.includes("maxBounds"), "no maxBounds in the document");
  const { southWest, northEast } = osm.MAX_BOUNDS;
  assert.ok(northEast.latitude - southWest.latitude < 1, "fence is too tall to be Cebu");
  assert.ok(northEast.longitude - southWest.longitude < 1, "fence is too wide to be Cebu");
});

check("every seeded hub falls inside the fence", () => {
  // A hub outside maxBounds can never be reached by panning — it would be
  // pinned somewhere the user is not allowed to go.
  const { southWest: sw, northEast: ne } = osm.MAX_BOUNDS;
  const corners = [
    ["Gaisano Grand Mactan", 10.28646, 123.97023],
    ["Mactan Shrine", 10.31221, 124.01668],
    ["Barangay Marigondon", 10.30047, 124.00718],
    ["Barangay Banilad", 10.34102, 123.92941],
    ["Cebu North Bus Terminal", 10.31109, 123.92078],
  ];
  for (const [name, lat, lng] of corners) {
    assert.ok(
      lat >= sw.latitude && lat <= ne.latitude && lng >= sw.longitude && lng <= ne.longitude,
      `${name} is outside MAX_BOUNDS`,
    );
  }
});

check("tiles are retained off-screen so panning does not refetch", () => {
  assert.ok(osm.KEEP_BUFFER >= 2, "keepBuffer below Leaflet's default");
  assert.match(html, /keepBuffer: \d+/);
});

check("the User-Agent identifies Baylo", () => {
  assert.match(osm.TILE_USER_AGENT, /^Baylo\//, "UA does not lead with the app name");
  assert.ok(osm.TILE_USER_AGENT.includes("com.baylo.app"), "UA carries no bundle id");
});

check("Leaflet's own attribution control is off", () => {
  assert.match(html, /attributionControl: false/);
});

check("the attribution is drawn natively, not inside the WebView", () => {
  // If the string appears in the document, somebody moved the credit back
  // inside the WebView, where a stylesheet change can hide it silently while
  // tiles keep rendering. That failure mode is a licence breach nobody sees.
  assert.ok(
    !html.includes("OpenStreetMap contributors"),
    "attribution string found inside the WebView document",
  );
  assert.equal(osm.ATTRIBUTION_TEXT, "© OpenStreetMap contributors");
});

/* ── §5 ─────────────────────────────────────────────────────────────────── */

console.log("\n§5  the non-interactive preview\n");

const still = buildMapHtml({ hubs: HUBS, interactive: false });

check("dragging and zoom are disabled in the preview", () => {
  assert.match(still, /var INTERACTIVE = false;/);
  assert.match(still, /dragging: INTERACTIVE/);
  assert.match(still, /touchZoom: INTERACTIVE/);
});

check("the preview's markers do not take taps", () => {
  assert.match(still, /interactive: INTERACTIVE/);
});

check("the preview's inline script also parses", () => {
  new vm.Script(inlineScript(still), { filename: "map-preview-inline.js" });
});

check("focusing one hub produces a different opening view", () => {
  const focused = buildMapHtml({ hubs: HUBS, focusHubId: HUBS[0].id, interactive: true });
  assert.ok(focused.includes(`var FOCUS_ID = "${HUBS[0].id}"`), "focus id not injected");
  assert.ok(html.includes("var FOCUS_ID = null"), "unfocused document should have none");
});

check("an empty hub list still produces a valid document", () => {
  // The shell renders its own empty state instead of this, but a document that
  // threw on zero pins would take the whole screen down if that ever changed.
  const none = buildMapHtml({ hubs: [], interactive: true });
  new vm.Script(inlineScript(none), { filename: "map-empty-inline.js" });
  assert.match(none, /var HUBS = \[\];/);
});

console.log(
  failures === 0 ? "\n  all checks passed\n" : `\n  ${failures} check(s) FAILED\n`,
);

process.exit(failures === 0 ? 0 : 1);
