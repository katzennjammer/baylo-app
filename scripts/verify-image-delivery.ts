/**
 * Image delivery (Oct 2026), checked without a phone:
 *
 *   node --import tsx scripts/verify-image-delivery.ts
 *
 *   1. sizedImage(): a public Cloudinary upload gets f_auto,q_auto,c_limit and
 *      one of the three widths; everything else passes through untouched --
 *      private/authenticated assets, already-transformed URLs, Google avatars,
 *      seed photos, local files, null.
 *   2. photoReducer()/shouldAutoRetry(): one automatic retry per URL, then a
 *      manual one; a new URL starts clean; repeated errors do not stack.
 */
import { IMAGE_WIDTH, sizedImage } from "../src/media/image-url";
import { photoReducer, shouldAutoRetry, type PhotoState } from "../src/media/usePhotoRetry";

let failures = 0;
let checks = 0;
function eq<T>(label: string, got: T, want: T) {
  checks++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) {
    failures++;
    console.log(`FAIL ${label}\n  got  ${a}\n  want ${b}`);
  }
}

// 1. sizedImage()
{
  const up = "https://res.cloudinary.com/dm7ctbxq7/image/upload/v1792127313/baylo/h1vrxb8hb2a4fqds05ti.jpg";
  const at = (w: number) => `https://res.cloudinary.com/dm7ctbxq7/image/upload/f_auto,q_auto,c_limit,w_${w}/v1792127313/baylo/h1vrxb8hb2a4fqds05ti.jpg`;
  eq("thumb", sizedImage(up, "thumb"), at(400));
  eq("card", sizedImage(up, "card"), at(600));
  eq("full", sizedImage(up, "full"), at(1080));
  eq("three widths only", Object.values(IMAGE_WIDTH), [400, 600, 1080]);
  eq("idempotent", sizedImage(sizedImage(up, "card"), "full"), at(600));

  const untouched = [
    "https://res.cloudinary.com/dm7ctbxq7/image/private/s--abc--/v1/baylo/id.jpg",
    "https://res.cloudinary.com/dm7ctbxq7/image/authenticated/s--abc--/v1/baylo/dti.jpg",
    "https://res.cloudinary.com/dm7ctbxq7/image/upload/w_200/v1/baylo/x.jpg",
    "https://res.cloudinary.com/dm7ctbxq7/video/upload/v1/baylo/clip.mp4",
    "https://lh3.googleusercontent.com/a/ACg8ocK=s96-c",
    "https://images.unsplash.com/photo-1?w=800",
    "file:///data/user/0/com.baylo.app/cache/photo.jpg",
  ];
  for (const u of untouched) eq(`untouched ${u.slice(0, 60)}`, sizedImage(u, "card"), u);
  eq("null", sizedImage(null, "card"), undefined);
  eq("undefined", sizedImage(undefined, "card"), undefined);
  eq("empty", sizedImage("", "card"), undefined);
}

// 2. photoReducer() / shouldAutoRetry()
{
  const start: PhotoState = { uri: "a", attempt: 0, failed: false };
  const failed1 = photoReducer(start, { type: "error" });
  eq("first error fails", failed1, { uri: "a", attempt: 0, failed: true });
  eq("first error auto-retries", shouldAutoRetry(failed1), true);
  eq("error twice is one failure", photoReducer(failed1, { type: "error" }), failed1);

  const retried = photoReducer(failed1, { type: "retry" });
  eq("retry remounts clean", retried, { uri: "a", attempt: 1, failed: false });
  const failed2 = photoReducer(retried, { type: "error" });
  eq("second error waits for a tap", shouldAutoRetry(failed2), false);
  eq("tap retries again", photoReducer(failed2, { type: "retry" }), { uri: "a", attempt: 2, failed: false });

  eq("new url starts clean", photoReducer(failed2, { type: "reset", uri: "b" }), { uri: "b", attempt: 0, failed: false });
  eq("not failed: no auto retry", shouldAutoRetry(start), false);
}

console.log(failures === 0 ? `verify-image-delivery: all ${checks} checks passed` : `verify-image-delivery: ${failures} of ${checks} FAILED`);
if (failures > 0) (globalThis as { process?: { exitCode?: number } }).process!.exitCode = 1;
