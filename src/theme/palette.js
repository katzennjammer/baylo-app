/**
 * Baylo's palette, ported from the web app's design tokens.
 *
 * The source of truth on the web is `baylo/src/app/globals.css`, where every
 * token is authored in oklch(). React Native's style engine does not parse
 * oklch, so each value below is the sRGB conversion of the corresponding
 * `--token` — same colour, a notation the platform can read.
 *
 * The app carries exactly two surface sets, and they are not a light/dark pair
 * a viewer can switch between: `colors` is what everything behind the sign-in
 * gate renders on, `auth` is what the sign-in screens render on. Neither is
 * derived from the other. The web's three re-skinnable `[data-direction]`
 * palettes are not ported — the app has no such switch, and porting palettes
 * nothing renders would be tables to keep in sync rather than tables in use.
 *
 * Keep this file plain CommonJS. It is required by `tailwind.config.js`, which
 * Tailwind loads through Node before any TypeScript transform runs — a .ts file
 * here would work in the app and fail in the CLI.
 */

/**
 * Daylight: the (app) surface set.
 *
 * The artboards for the Home tab are a LIGHT theme — white cards on a warm
 * near-white canvas, near-black type — where this file used to hold the dark
 * Forest/Cream port of the web tokens. The flip is deliberate and it is
 * app-wide rather than Home-only, because the tab bar and header are shared
 * chrome: a light feed under a dark bar is not a half-migrated theme, it is a
 * broken one.
 *
 * `accent` and `accent-2` are carried over UNCHANGED. They are the brand green,
 * they read correctly on both grounds, and they are the only two tokens the
 * (auth) screens borrow from this block — leaving them alone is what keeps the
 * auth flow exactly as it was while everything behind the gate changes.
 *
 * Note on type over `accent`: the artboards put WHITE on the green fills
 * (Offer Trade, Post your first item, Retry), not the near-black `on-accent`
 * that the dark theme used. White on this green is roughly 3:1 — fine for the
 * button-sized weights it is used at, short of AA for body copy, which is why
 * it appears on fills and nowhere else.
 */
const colors = {
  /** --bg — the canvas the feed scrolls on. Warm, not pure white. */
  bg: "#faf9f6",
  /** --bg-2 — raised chrome: header, tab bar. Lifts by being cleaner, not darker. */
  "bg-2": "#ffffff",
  /** --card — cards and inputs. */
  card: "#ffffff",
  /** --text — near-black body type, warmed a touch off neutral. */
  text: "#12140f",
  /** --muted — secondary type. Passes AA on both bg and card. */
  muted: "#63665d",
  /** --line — hairline borders and the full-bleed card divider. */
  line: "rgba(18, 20, 15, 0.10)",
  /** --accent — the green everything actionable is. Unchanged from the dark set. */
  accent: "#45a92b",
  /** --accent-2 — pressed/hover accent. Unchanged. */
  "accent-2": "#5bb846",
  /** --on-accent — near-black, kept for marks that sit on an accent fill. */
  "on-accent": "#001300",
  /** The Leaves pill: a green wash with type dark enough to read at 13px. */
  "leaf-wash": "#e6f4e8",
  "leaf-ink": "#1b5e20",
  /**
   * Skeleton blocks. One step off `bg` — a skeleton that contrasts hard reads
   * as content rather than as absence, and the whole point of 2a is that the
   * chrome looks settled while only the feed is pending.
   */
  skeleton: "#e8e4dd",
  /**
   * The offline bar. Terracotta, not the danger red: 2c is explicit that this
   * is the persistent, non-urgent layer, and it sits under the top bar for as
   * long as the connection is gone. `danger` stays reserved for the urgent one.
   */
  "warn-wash": "#fcede9",
  "warn-ink": "#a8432a",
  "warn-line": "rgba(168, 67, 42, 0.22)",
  /** --ph-stripe — the striped image placeholder. */
  "ph-stripe": "rgba(69, 169, 43, 0.12)",
  /** --scrim-1 / --scrim-2 — gradient scrims over media. */
  "scrim-1": "rgba(250, 249, 246, 0.94)",
  "scrim-2": "rgba(250, 249, 246, 0.5)",
  /** Destructive state, tuned for a light canvas. */
  danger: "#c0392b",
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
