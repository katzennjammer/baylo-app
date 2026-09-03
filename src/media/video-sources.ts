/**
 * The two pieces of footage, and the transform that makes them shippable.
 *
 * ── NEVER THE RAW ORIGINAL ──────────────────────────────────────────────────
 *
 * Cloudinary serves whatever you ask for, and asking for the bare public ID
 * gets you the master upload. The masters here are 4.72 MB and 22.55 MB. The
 * second one is the BAND video — the one that loops behind every auth screen,
 * on every cold start, for as long as somebody is deciding how to sign in — so
 * shipping it unmodified would put 22.55 MB on the mobile data of a tester who
 * has not yet typed a password. Every URL below therefore carries a transform,
 * and the builder is the only way to construct one so a raw ID cannot be
 * pasted in by hand later.
 *
 * ── WHAT THE TRANSFORM SEGMENTS DO, AND THE NUMBERS THEY PRODUCED ───────────
 *
 *   f_auto        let Cloudinary pick the container/codec per client
 *   q_auto:eco    the quality tier below the `q_auto` default. The footage sits
 *                 under a 28-62% scrim in the band and plays once at speed in
 *                 the intro; the tier below default is invisible in both and is
 *                 the single biggest lever on the byte count.
 *   w_1080,c_limit  cap the width at 1080, NEVER upscale. c_limit is the half
 *                 that matters — plain w_1080 would enlarge a narrower master.
 *   du_6          BAND ONLY: the first six seconds. See the note on it below.
 *
 * Measured against the live CDN on 4 Sept 2026, every figure a real response
 * body rather than an estimate:
 *
 *   INTRO  raw master                                4,944,181 B   4.72 MB
 *          f_auto,q_auto,w_1080,c_limit              1,651,891 B   1.58 MB
 *          f_auto,q_auto:eco,w_1080,c_limit          1,360,475 B   1.30 MB  ← shipped
 *
 *   BAND   raw master                               23,649,339 B  22.55 MB
 *          f_auto,q_auto,w_1080,c_limit              7,391,963 B   7.05 MB
 *          f_auto,q_auto:eco,w_720,c_limit           3,601,947 B   3.44 MB
 *          f_auto,q_auto:low,w_540,c_limit           2,196,661 B   2.09 MB
 *          f_auto,q_auto:eco,w_1080,c_limit,du_6     1,470,305 B   1.40 MB  ← shipped
 *
 * ── WHY THE BAND IS TRIMMED AND NOT SHRUNK ──────────────────────────────────
 *
 * The band is full-bleed across the top of the screen, so every pixel of width
 * is on display; its LENGTH is not, because it loops and sits behind an opaque
 * sheet that nobody studies. No full-length variant reaches the 1.5 MB budget —
 * the closest is 2.09 MB at w_540, which is a 2× upscale on a 1080p phone and
 * visible as softness in exactly the dimension that shows. Six seconds at full
 * width is 1.40 MB and looks native. Length was the cheap axis; width was not.
 *
 * If 0-6s turns out to be a poor loop point, the fix is `so_<start>,eo_<end>`
 * in place of `du_6` — same budget, different window — and nothing else in the
 * app changes.
 *
 * ── THE VERSION SEGMENT IS PART OF THE CACHE KEY ────────────────────────────
 *
 * `v1788278268` is not decoration. It is what makes the URL immutable, which is
 * what lets `useCaching` on the player keep a copy on disk indefinitely instead
 * of revalidating on every cold start. Re-uploading footage under the same
 * public ID with a new version produces a new URL and a clean re-fetch; editing
 * the transform does the same. Neither can serve a stale frame.
 */

const CLOUD_BASE = "https://res.cloudinary.com/dm7ctbxq7/video/upload";

/**
 * The only way a Cloudinary video URL is built in this app.
 *
 * `transform` is required and has no default on purpose: a default would make
 * the untransformed master reachable by omission, which is the one mistake this
 * module exists to prevent.
 */
function cloudinaryVideo(transform: string, version: string, publicId: string): string {
  return `${CLOUD_BASE}/${transform}/${version}/${publicId}.mp4`;
}

/** Plays once on a cold start, before the auth screens. ~7s, 1.30 MB. */
export const INTRO_VIDEO_URL = cloudinaryVideo(
  "f_auto,q_auto:eco,w_1080,c_limit",
  "v1788278268",
  "1_vm9emg",
);

/** Loops in the band above the auth sheet. 6s, 1.40 MB. */
export const BAND_VIDEO_URL = cloudinaryVideo(
  "f_auto,q_auto:eco,w_1080,c_limit,du_6",
  "v1788278527",
  "2_xopfjw",
);

/**
 * How long the intro is allowed to take before entry proceeds without it.
 *
 * The intro is decoration in front of a sign-in screen. It gets two seconds to
 * put a frame on the glass and is abandoned otherwise — a rule that is checked
 * against the FIRST RENDERED FRAME rather than against a status flag, because
 * "the player says it is ready" and "there is a picture" are not the same
 * moment and only the second one is worth waiting for.
 */
export const INTRO_FIRST_FRAME_BUDGET_MS = 2_000;

/**
 * The ceiling on a playing intro, as a guard against a stall.
 *
 * `playToEnd` is what normally ends the intro. A clip that buffers mid-play
 * never fires it, and without this the app would sit on a frozen frame with no
 * way forward but the tap-to-skip hint. The clip is about seven seconds, so
 * twelve is generous and still bounded.
 */
export const INTRO_MAX_MS = 12_000;
