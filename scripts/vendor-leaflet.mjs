// Regenerates src/components/map/leaflet-bundle.generated.ts from node_modules.
//
// Run (from baylo-mobile/):
//   node scripts/vendor-leaflet.mjs
//
// ── WHY LEAFLET IS VENDORED INTO A .ts FILE AND NOT LOADED FROM A CDN ────────
//
// The map is a WebView rendering an HTML document this app builds. That
// document needs Leaflet's JS and CSS as TEXT, at runtime, on a device.
//
// The three ways to get it there, and why this is the one:
//
//   CDN <script src="https://unpkg.com/leaflet…">
//     Adds a second network dependency in front of the map, on top of the tile
//     server, on a phone that may be on patchy mobile data in Mandaue. It also
//     makes a third party able to change what executes inside our WebView.
//     A map that shows nothing because unpkg is unreachable is a worse product
//     than a map that is 160 KB larger.
//
//   require() the file out of node_modules at runtime
//     Metro bundles modules, not file bytes. `leaflet/dist/leaflet.js` would be
//     EXECUTED as a module rather than handed over as a string, and Leaflet
//     executed in the RN JS context is a library with no DOM to attach to.
//
//   THIS — read the bytes at build time, emit them as string literals.
//     The escaping is done by JSON.stringify, so nothing in Leaflet's source
//     can terminate the literal. The output is committed, so a fresh clone
//     builds without running this script and without a network fetch.
//
// The generated file is large and boring and nobody should read it. It is
// committed anyway: a build that silently depends on a devDependency having
// been installed is a build that breaks on the one machine that skipped it.

import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")

const dist = join(root, "node_modules", "leaflet", "dist")
const out = join(root, "src", "components", "map", "leaflet-bundle.generated.ts")

const pkg = JSON.parse(readFileSync(join(root, "node_modules", "leaflet", "package.json"), "utf8"))

const js = readFileSync(join(dist, "leaflet.js"), "utf8")
const css = readFileSync(join(dist, "leaflet.css"), "utf8")

/**
 * Both files are injected between literal <script>/<style> tags, so a "</script>"
 * ANYWHERE in the text — including inside one of Leaflet's own string constants —
 * would close the tag early and drop the rest of the library into the document as
 * text. Neither file contains one today. This is here so that stays true without
 * anybody having to check.
 */
const deTag = (s) => s.replace(/<\/(script|style)/gi, "<\\/$1")

const hash = createHash("sha256").update(js).update(css).digest("hex").slice(0, 16)

const banner = `// GENERATED FILE — DO NOT EDIT.
//
// Produced by scripts/vendor-leaflet.mjs from the installed \`leaflet\` package.
// Regenerate with:  node scripts/vendor-leaflet.mjs
//
//   leaflet version: ${pkg.version}
//   source:          node_modules/leaflet/dist/{leaflet.js,leaflet.css}
//   sha256(js+css):  ${hash}
//
// Read scripts/vendor-leaflet.mjs for why this is a committed string blob
// rather than a CDN tag or a require(). Nothing here is hand-written, and an
// edit made here is lost the next time the script runs.

/* eslint-disable */

/** Leaflet ${pkg.version}, minified, as it ships. Injected into a <script> tag. */
export const LEAFLET_JS = ${JSON.stringify(deTag(js))}

/** Leaflet ${pkg.version}'s stylesheet. Injected into a <style> tag. */
export const LEAFLET_CSS = ${JSON.stringify(deTag(css))}

/** The version these two strings were cut from, for the map's own diagnostics. */
export const LEAFLET_VERSION = ${JSON.stringify(pkg.version)}
`

writeFileSync(out, banner, "utf8")

console.log(
  `vendored leaflet ${pkg.version} → src/components/map/leaflet-bundle.generated.ts ` +
    `(${(js.length / 1024).toFixed(0)} KB js + ${(css.length / 1024).toFixed(0)} KB css, sha ${hash})`,
)
