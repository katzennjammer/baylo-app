import { Image } from "expo-image";
import { Text, View } from "react-native";

import { usePhotos } from "../../post/photos";
import { isPending, isPostable, photoProblem, usePost, type Photo } from "../../post/state";
import { postColor, postRadius, postType, textStyle } from "../../theme/post-tokens";
import { formatCountdown, SmallTextButton, useCountdown } from "./ui";

/**
 * Every photo that is not going on the listing yet, and what to do about it.
 *
 * ── NOTHING IS LEFT OUT QUIETLY ─────────────────────────────────────────────
 *
 * Post used to send the postable photos and drop the rest, so a listing went
 * up with two of three photos and nothing said why. Post now waits on every
 * photo (see `photosReady`), and this is the sentence beside the disabled
 * button: one row per photo, its state in words, and the action that unsticks
 * it — Try again, Check again, See why, or Remove.
 *
 * Renders nothing when every photo is postable.
 */
export function PhotoIssues({
  onShowPhoto,
  style,
}: {
  /** Opens the photo step with this photo selected, where its full panel is. */
  onShowPhoto: (index: number) => void;
  style?: object;
}) {
  const { state, dispatch } = usePost();
  const { retry, recheck, remove } = usePhotos();

  const limit = state.rateLimit;
  const dupSeconds = useCountdown(limit?.action === "duplicate" ? limit.until : null, () =>
    dispatch({ type: "rate-limit/clear" }),
  );
  const uploadSeconds = useCountdown(limit?.action === "upload" ? limit.until : null, () =>
    dispatch({ type: "rate-limit/clear" }),
  );

  const rows = state.photos
    .map((photo, index) => ({ photo, index }))
    .filter(({ photo }) => !isPostable(photo));
  if (rows.length === 0) return null;

  const problems = rows.filter(({ photo }) => photoProblem(photo) !== null).length;
  const heading =
    problems > 0
      ? `${problems === 1 ? "1 photo needs" : `${problems} photos need`} a look before you can post.`
      : `Post unlocks once ${rows.length === 1 ? "this photo has" : "these photos have"} finished.`;

  return (
    <View style={[{ gap: 12 }, style]}>
      <Text
        style={[
          textStyle(postType.helperLong),
          { color: problems > 0 ? postColor.warmInk : postColor.inkSecondary },
        ]}
      >
        {heading}
      </Text>

      {rows.map(({ photo, index }) => (
        <View key={photo.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: postRadius.thumb,
              overflow: "hidden",
              backgroundColor: postColor.inset,
            }}
          >
            <Image
              source={{ uri: photo.localUri }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[textStyle(postType.helper), { color: postColor.ink }]}>
              {`Photo ${index + 1} · ${issueLine(photo, dupSeconds, uploadSeconds)}`}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 16 }}>
              {photo.upload === "failed" && !photo.rejected ? (
                <SmallTextButton
                  label="Try again"
                  onPress={() => retry(photo.id)}
                  disabled={uploadSeconds > 0}
                />
              ) : null}
              {photo.checkPaused && photo.url ? (
                <SmallTextButton
                  label="Check again"
                  onPress={() => recheck(photo.id)}
                  disabled={dupSeconds > 0}
                />
              ) : null}
              {photoProblem(photo) === "blocked" ? (
                <SmallTextButton label="See why" onPress={() => onShowPhoto(index)} />
              ) : null}
              <SmallTextButton label="Remove" onPress={() => remove(photo.id)} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/** The photo's state in a few words. Exported for the photo step's summary. */
export function issueLine(photo: Photo, dupSeconds = 0, uploadSeconds = 0): string {
  switch (photoProblem(photo)) {
    case "rejected":
      return photo.rejected === "too-large"
        ? "too big to send. Pick a smaller photo."
        : "not a JPG, PNG or HEIC photo.";
    case "failed":
      return uploadSeconds > 0
        ? `too many uploads in a row. Try again in ${formatCountdown(uploadSeconds)}.`
        : "did not finish uploading.";
    case "blocked":
      return "matches an existing listing, so it cannot be posted.";
    default:
      break;
  }
  if (photo.upload === "uploading") {
    return `uploading · ${Math.max(0, Math.min(99, Math.floor(photo.progress * 100)))}%`;
  }
  if (photo.checkPaused) {
    return dupSeconds > 0
      ? `check paused. Check again in ${formatCountdown(dupSeconds)}.`
      : "check paused. Tap Check again.";
  }
  return isPending(photo) ? "checking against existing listings…" : "not ready yet.";
}
