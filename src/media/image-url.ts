/**
 * A Cloudinary photo at the width the screen actually draws it.
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────
 *
 * The API returns the stored original, and listing photos uploaded before the
 * resize-on-phone change (prepare-image.ts) are up to 4080 px and 1.9 MB. The
 * Marketplace grid fetched 20 of them on first load: 2,141 KB as originals,
 * 721 KB at `w_600` with WebP, 851 KB without (measured 19 Oct 2026). On mobile
 * data the slow ones time out, and a tile that times out shows the broken-photo
 * icon.
 *
 * ── THREE WIDTHS, NO MORE ───────────────────────────────────────────────────
 *
 * Every distinct transform is one derived image Cloudinary stores and counts
 * against the plan, so callers pick a named size instead of a pixel number.
 * Widths are physical pixels: a ~190 dp grid tile on a 3x screen is ~570 px.
 *
 * ── WHAT IT LEAVES ALONE ────────────────────────────────────────────────────
 *
 * Only public `image/upload/v<version>/` URLs are rewritten, which is every
 * URL /api/upload hands back. Already-transformed, private or authenticated
 * Cloudinary URLs, Google avatars, seed photos and local files pass through
 * unchanged. ID and business-document images are never routed through here:
 * an admin reviews the original.
 */

export const IMAGE_WIDTH = {
  /** Avatars, logos, badges, row thumbnails. */
  thumb: 400,
  /** Grid tiles and cards. */
  card: 600,
  /** Full-width photos: feed, carousel, story, banner, chat viewer. */
  full: 1080,
} as const;

export type ImageSize = keyof typeof IMAGE_WIDTH;

const PUBLIC_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(v\d+\/)/;

export function sizedImage(url: string, size: ImageSize): string;
export function sizedImage(url: string | null | undefined, size: ImageSize): string | undefined;
export function sizedImage(url: string | null | undefined, size: ImageSize): string | undefined {
  if (!url) return undefined;
  return url.replace(PUBLIC_UPLOAD, `$1f_auto,q_auto,c_limit,w_${IMAGE_WIDTH[size]}/$2`);
}
