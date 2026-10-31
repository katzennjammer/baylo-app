const { colors, auth } = require("./src/theme/palette");
const { dColor, font } = require("./src/theme/tokens");

/**
 * Tailwind v3 — required by NativeWind v4, which does not support v4's
 * CSS-first config. The web app is on Tailwind v4 and keeps its tokens in
 * `@theme`; here they come from files under `src/theme/` so the two never drift
 * by way of a second hand-typed copy.
 *
 * The legacy palette and Direction 1 remain isolated.
 *
 *   `tokens.js`  — Direction 1 roles exposed with a `d-` prefix.
 *   `palette.js` — unchanged legacy colors for auth and Profile; Direction 1
 *                  colors are separately exported and never overwrite them.
 *
 * The prefix is what makes the boundary visible in the markup: a `d-` class in
 * an (auth) screen, or a bare `bg-card` inside the feed, is a mistake you can
 * see while reading it rather than one you find by comparing two greys.
 *
 * MOST OF DIRECTION 1 DOES NOT COME THROUGH HERE. The spec resolves everything
 * to the pixel — 22.1 line heights, a 7 px chip gap, 1.7 stroke weights — and
 * expressing that as `leading-[22.1px]` scattered across twenty components is
 * precisely what the "one tokens file" instruction rules out. Those components
 * build StyleSheets from `tokens.js` directly. What is mapped below is the part
 * that is genuinely useful as a utility, and it reads from the same file, so
 * there is still exactly one place to tune.
 */

/** `{ surface: … }` → `{ "d-surface": … }`, isolated from legacy colors. */
const prefixed = Object.fromEntries(Object.entries(dColor).map(([k, v]) => [`d-${k}`, v]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: { ...colors, ...auth, ...prefixed },
      fontFamily: {
        // Direction 1 uses Figtree faces loaded by app/_layout.tsx at runtime.
        "d-regular": [font.figtreeRegular],
        "d-medium": [font.figtreeMedium],
        "d-semibold": [font.figtreeSemi],
        "d-bold": [font.figtreeBold],
        // ── Existing mobile font faces. The static instances are bundled and
        // embedded at BUILD time by the expo-font config plugin (app.json)
        // rather than fetched by useFonts at runtime — SDK 57 recommends the
        // plugin for native, and it means there is no frame where the app
        // renders in a fallback face and then reflows.
        //
        // Each weight is its OWN family rather than one family plus a
        // fontWeight utility. These are static instances: asking Android for
        // "PublicSans-Regular at 700" gets synthetic emboldening, not the Bold
        // file. Naming the face directly is what makes the two platforms agree
        // — each file's basename matches its PostScript name, so the same
        // string resolves on iOS and Android.
        //
        // Named by family-and-weight, not by role. Roles live in
        // `tokens.type`, which is where a component should be reading them
        // from; these exist for the odd one-off and for parity with the config
        // instruction, and a second role vocabulary here would just be a
        // vocabulary to keep in sync.
        "bricolage-semibold": [font.displaySemi],
        "bricolage-bold": [font.displayBold],
        "sans-regular": [font.sans],
        "sans-medium": [font.sansMedium],
        "sans-semibold": [font.sansSemi],
        "sans-bold": [font.sansBold],
        mono: [font.mono],

        // ── Archivo. (auth) and Profile only. See the note above.
        body: ["Archivo-Regular"],
        label: ["Archivo-Medium"],
        strong: ["Archivo-SemiBold"],
        heading: ["Archivo-Bold"],
        display: ["Archivo-ExtraBold"],
      },
    },
  },
  plugins: [],
};
