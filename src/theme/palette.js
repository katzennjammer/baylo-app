/**
 * Baylo's palette, ported from the web app's design tokens.
 *
 * The source of truth on the web is `baylo/src/app/globals.css`, where every
 * token is authored in oklch(). React Native's style engine does not parse
 * oklch, so each value below is the sRGB conversion of the corresponding
 * `--token` — same colour, a notation the platform can read.
 *
 * Only the DEFAULT direction (Forest/Cream) is ported. The web carries two more
 * (`[data-direction="green"]`, `[data-direction="day"]`) that exist so the
 * landing page can be re-skinned; the app has no such switch, and porting
 * palettes nothing renders would be three tables to keep in sync instead of one.
 *
 * Keep this file plain CommonJS. It is required by `tailwind.config.js`, which
 * Tailwind loads through Node before any TypeScript transform runs — a .ts file
 * here would work in the app and fail in the CLI.
 */

/** Forest/Cream: dark olive canvas, cream type, bright green accent. */
const colors = {
  /** --bg — the canvas. oklch(0.22 0.062 145) */
  bg: "#032206",
  /** --bg-2 — raised surfaces: tab bar, headers. oklch(0.265 0.065 145) */
  "bg-2": "#0d2d0f",
  /** --card — cards and inputs. oklch(0.295 0.065 145) */
  card: "#153517",
  /** --text — cream body type. oklch(0.935 0.030 88) */
  text: "#f2e9d3",
  /** --muted — secondary type. oklch(0.74 0.022 90) */
  muted: "#b0aa9c",
  /** --line — hairline borders. oklch(0.48 0.06 145 / 0.5) */
  line: "rgba(72, 103, 73, 0.5)",
  /** --accent — the green everything actionable is. oklch(0.65 0.185 140) */
  accent: "#45a92b",
  /** --accent-2 — pressed/hover accent. oklch(0.70 0.175 140) */
  "accent-2": "#5bb846",
  /** --on-accent — type on an accent fill. oklch(0.16 0.06 145) */
  "on-accent": "#001300",
  /** --ph-stripe — the striped image placeholder. */
  "ph-stripe": "rgba(69, 169, 43, 0.17)",
  /** --scrim-1 / --scrim-2 — gradient scrims over media. */
  "scrim-1": "rgba(3, 34, 6, 0.94)",
  "scrim-2": "rgba(3, 34, 6, 0.5)",
  /** Not a web token: destructive state, which the web spells inline. */
  danger: "#e06c5a",
};

/**
 * The auth surface: green and white, and deliberately NOT the app's palette.
 *
 * Everything past the sign-in gate is Forest/Cream — a dark olive canvas with
 * cream type. The auth screens are the one place that is inverted: a green
 * field with a white card on it. That is not a second theme by accident, it is
 * what the background layer forces. `<LoginBackground>` renders a gradient
 * today and a looping video later, and a video frame can be any brightness at
 * any moment — cream-on-olive would be unreadable over a bright one. White card,
 * ink type, and a scrim under anything that sits directly on the background is
 * the arrangement that survives the swap without a redesign.
 *
 * Kept in the same file as `colors` so Tailwind picks both up from one require,
 * and separate from it so nothing inside (app) can reach for an auth colour.
 */
const auth = {
  /** The gradient, top to bottom. Baylo green, deepening. */
  "auth-1": "#0f6a24",
  "auth-2": "#0a4a18",
  "auth-3": "#04250a",
  /**
   * The scrim laid over the background layer, under everything.
   *
   * Pointless over today's flat gradient and load-bearing the day a video goes
   * in: it is what keeps the contrast ratio of the header type a constant
   * rather than a property of whichever frame is on screen.
   */
  "auth-scrim": "rgba(4, 37, 10, 0.55)",
  /** The card the fields sit on. Translucent, so the background still reads. */
  "auth-card": "rgba(255, 255, 255, 0.95)",
  "auth-card-line": "rgba(11, 36, 16, 0.10)",
  /** Inputs, on the white card. */
  "auth-field": "#f2f6f1",
  "auth-field-line": "rgba(11, 36, 16, 0.16)",
  /** Type on the white card. */
  ink: "#0b2410",
  "ink-muted": "#5a7360",
  /** Type on the green background. */
  "on-green": "#ffffff",
  "on-green-muted": "rgba(255, 255, 255, 0.78)",
  /** Destructive, on white. The app's `danger` is tuned for a dark canvas. */
  "danger-ink": "#a32d16",
  "danger-wash": "#fdeeea",
  "danger-line": "rgba(163, 45, 22, 0.28)",
  /** Positive, on white. Used by the "check your email" state. */
  "ok-ink": "#186a2c",
  "ok-wash": "#eef7ee",
};

module.exports = { colors, auth };
