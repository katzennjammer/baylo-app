import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { ApiError } from "../api/client";

/**
 * Every image is shrunk and re-encoded on the phone before it is sent.
 *
 * ── WHY, AND WHY HERE ───────────────────────────────────────────────────────
 *
 * The API runs on Vercel, which refuses a request body over 4.5 MB before our
 * route ever sees it. A modern phone's 12 MP photo is 3–8 MB as a JPEG and more
 * as HEIC, so sending the original fails on exactly the photos people take most.
 * The server's own 10 MB cap is never reached: the platform says no first, with
 * a bare 413 that is not even our JSON.
 *
 * Doing it here, once, for every upload path is what makes the limit a property
 * of the app instead of a property of whichever caller remembered.
 *
 * ── THE TWO PRESETS ─────────────────────────────────────────────────────────
 *
 * `photo` (listings, avatars, shop logos and banners, chat images): 1600 px on
 * the long edge, which is more than any screen in the app draws them at.
 *
 * `document` (government ID, business registration): 2000 px and a lighter
 * compression, because a reviewer has to read the small print on them.
 *
 * ── ALWAYS JPEG, NEVER LARGER ───────────────────────────────────────────────
 *
 * The output is JPEG whatever went in, which is also what turns an iPhone's
 * HEIC into something every decoder reads. An image already within the long
 * edge is re-encoded at its own size, never scaled up.
 */

export const IMAGE_PRESETS = {
  photo: { maxEdge: 1600, quality: 0.8 },
  document: { maxEdge: 2000, quality: 0.85 },
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

/**
 * The most a prepared image may weigh. Well under Vercel's 4.5 MB request
 * limit, which also has to carry the multipart framing and, for the ID and
 * shop forms, the text fields beside the file. A 2000 px JPEG at 0.85 is
 * typically under 1 MB; reaching this means something unusual went in.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export interface PreparedImage {
  uri: string;
  name: string;
  type: "image/jpeg";
  width: number;
  height: number;
  /** Bytes on disk, or null if the file system could not say. */
  size: number | null;
}

export async function prepareImage(uri: string, preset: ImagePreset): Promise<PreparedImage> {
  const { maxEdge, quality } = IMAGE_PRESETS[preset];

  let saved: { uri: string; width: number; height: number };
  const context = ImageManipulator.manipulate(uri);
  try {
    // Rendered once untouched to learn its size: the resize must know which
    // edge is the long one, and must not happen at all for a small image.
    let image = await context.renderAsync();
    const longEdge = Math.max(image.width, image.height);
    if (longEdge > maxEdge) {
      context.resize(image.width >= image.height ? { width: maxEdge } : { height: maxEdge });
      image.release();
      image = await context.renderAsync();
    }
    saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality });
    image.release();
  } catch {
    throw new ApiError(0, "IMAGE_UNREADABLE", "That photo could not be read. Pick another one.");
  } finally {
    context.release();
  }

  let size: number | null = null;
  try {
    size = new File(saved.uri).size;
  } catch {
    /* Unknown size is not a reason to stop; the server still checks. */
  }
  if (size !== null && size > MAX_UPLOAD_BYTES) {
    throw new ApiError(413, "IMAGE_TOO_LARGE", "That photo is too big to send. Pick a smaller one.");
  }

  const name = saved.uri.split("/").pop()?.replace(/\.[^.]*$/, "") || "photo";
  return {
    uri: saved.uri,
    name: `${name}.jpg`,
    type: "image/jpeg",
    width: saved.width,
    height: saved.height,
    size,
  };
}
