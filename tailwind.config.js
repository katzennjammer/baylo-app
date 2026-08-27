const { colors, auth } = require("./src/theme/palette");

/**
 * Tailwind v3 — required by NativeWind v4, which does not support v4's
 * CSS-first config. The web app is on Tailwind v4 and keeps its tokens in
 * `@theme`; here they come from `src/theme/palette.js` so the two never drift
 * by way of a second hand-typed copy.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: { ...colors, ...auth },
      fontFamily: {
        // The web loads Archivo and Playfair from Google Fonts. Shipping them
        // as bundled assets is a separate job; until then these resolve to the
        // platform's own faces, which is why they are named by role rather than
        // by family — the role survives the swap.
        body: ["System"],
        display: ["System"],
      },
    },
  },
  plugins: [],
};
