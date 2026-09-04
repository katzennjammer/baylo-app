import { Image } from "expo-image";
import { useCallback, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";

import { clampAspect } from "../../lib/format";
import { PHOTO_ERRORS, usePhotos } from "../../post/photos";
import { usePost, type Photo } from "../../post/state";
import {
  postBorder,
  postColor,
  postIcon,
  postRadius,
  postSize,
  postSpace,
  postType,
  rules,
  textStyle,
  type Board,
} from "../../theme/post-tokens";
import { CloseIcon, ImageIcon, PlusIcon } from "../icons";
import { Tappable } from "../Tappable";
import { MarkerBadge, MarkerChip } from "./CameraMarker";
import { CameraIcon } from "./post-icons";
import {
  DuplicateFailed,
  DuplicateRunning,
  DuplicateSelf,
  DuplicateWarned,
  UploadFailed,
} from "./DuplicatePanels";
import {
  HelperRow,
  OutlineButton,
  PrimaryButton,
  ProgressBar,
  RateLimitPanel,
  TextButton,
  useCountdown,
} from "./ui";

/**
 * Step 1 — photos.
 *
 * ── THE PHOTO IS THE HEADING ────────────────────────────────────────────────
 *
 * This is the only step with no step heading, and that is deliberate: a
 * full-bleed square photo at the top of a screen is not ambiguous about what
 * the screen is for. The heading only appears in the EMPTY state, where there
 * is nothing else to look at.
 *
 * ── CAMERA BEFORE GALLERY, ALWAYS ───────────────────────────────────────────
 *
 * The order in this file is not a layout preference. The camera earns the
 * "Photographed in Baylo" mark and it is the path that survives a duplicate
 * check, so putting it first is the cheapest thing the interface can do to
 * steer people toward the outcome that works. It is never enforced — the
 * gallery is a full-width button directly beneath, not a link.
 */

const HERO_UPLOAD_CAPTION = (progress: number) =>
  `uploading · ${Math.round(progress * 100)}%`;

export function StepPhotos({
  board,
  onOpenCamera,
  onSeeListing,
}: {
  board: Board;
  onOpenCamera: () => void;
  onSeeListing: (itemId: string) => void;
}) {
  const { state, dispatch } = usePost();
  const { addFromGallery, retry, recheck, remove } = usePhotos();
  const { width } = useWindowDimensions();

  /**
   * Intrinsic aspect per photo, measured from the LOCAL file the moment it
   * paints — not from the upload response.
   *
   * Both would give the same number, and only one of them arrives before the
   * photo is on screen. Waiting for the server would mean the hero opens square
   * and then jumps to 4:5 when the upload lands, which is a layout shift under
   * the user's thumb at the exact moment they are deciding whether to keep the
   * shot.
   */
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const measure = useCallback((id: string, w: number, h: number) => {
    setAspects((prev) => (prev[id] ? prev : { ...prev, [id]: clampAspect(w, h) }));
  }, []);

  const photos = state.photos;
  const hero = photos[state.selectedPhoto] ?? null;
  const atLimit = photos.length >= rules.maxPhotos;
  const busy = photos.some((p) => p.upload === "uploading");

  const [galleryDenied, setGalleryDenied] = useState(false);

  /**
   * A 429 from /api/ai/phash is NOT a verdict about the photo.
   *
   * The pipeline leaves such a photo on `running` rather than resolving it to
   * `failed`, because resolving it would tell somebody their own camera roll
   * was a duplicate for the sole reason that they added five photos quickly.
   * The countdown and the re-check are what closes that loop.
   */
  const dupLimit = state.rateLimit?.action === "duplicate" ? state.rateLimit : null;
  const dupSeconds = useCountdown(dupLimit?.until ?? null, () =>
    dispatch({ type: "rate-limit/clear" }),
  );

  const openGallery = useCallback(async () => {
    const result = await addFromGallery();
    setGalleryDenied(result === "denied");
  }, [addFromGallery]);

  return (
    <View>
      {hero ? (
        <HeroPhoto
          photo={hero}
          width={width}
          aspect={aspects[hero.id] ?? postSize.photo.heroAspect}
          onMeasure={measure}
          onRemove={() => remove(hero.id)}
          markerInset={board.markerInset}
        />
      ) : (
        <EmptyHero board={board} />
      )}

      {photos.length > 0 ? (
        <View style={{ marginTop: postSpace.photos.heroToRail }}>
          <ThumbnailRail
            photos={photos}
            selected={state.selectedPhoto}
            board={board}
            onSelect={(i) => dispatch({ type: "photo/select", index: i })}
            onAdd={openGallery}
          />
        </View>
      ) : null}

      {/* The two entry points. Padded to 16 so they line up with the footer
          button rather than with the text steps' 20 gutter. */}
      <View
        style={{
          marginTop: photos.length > 0 ? postSpace.photos.railToPrimary : 0,
          paddingHorizontal: board.stackX,
        }}
      >
        <PrimaryButton
          label="Take a photo"
          onPress={onOpenCamera}
          disabled={atLimit || busy}
          icon={
            <CameraIcon
              size={postIcon.cameraPrimary.size}
              stroke={postIcon.cameraPrimary.stroke}
              color={atLimit || busy ? postColor.inkDisabled : postColor.onGreen}
            />
          }
        />
        <GalleryButton
          onPress={openGallery}
          disabled={atLimit || busy}
          style={{ marginTop: postSpace.photos.primaryToSecondary }}
        />
      </View>

      {atLimit ? (
        <View
          style={{
            marginTop: postSpace.photos.secondaryToHelper,
            paddingHorizontal: board.stackX,
          }}
        >
          <HelperRow gap={postSpace.photos.helperIconGap}>
            That is the maximum of five photos. Remove one to add another.
          </HelperRow>
        </View>
      ) : null}

      {galleryDenied ? (
        <View
          style={{
            marginTop: postSpace.photos.secondaryToHelper,
            paddingHorizontal: board.stackX,
          }}
        >
          <HelperRow gap={postSpace.photos.helperIconGap}>
            Baylo needs permission to open your photos. You can allow it in your phone&apos;s
            settings, or take a photo instead.
          </HelperRow>
        </View>
      ) : null}

      {/* The marker note. It explains what the mark on a camera photo means
          BEFORE anyone has one, which is the only moment it is not defensive. */}
      <View
        style={{
          marginTop: postSpace.photos.secondaryToHelper,
          paddingHorizontal: board.stackX,
        }}
      >
        <HelperRow gap={postSpace.photos.helperIconGap}>
          Photos you take in Baylo carry a small camera mark on your listing. It only means the
          photo came straight from your camera, not from your gallery.
        </HelperRow>
      </View>

      {/* Everything that has something to say about the SELECTED photo. Only
          one photo's panel is ever shown: five stacked warnings is a wall. */}
      {dupLimit ? (
        <View style={{ marginTop: 24, paddingHorizontal: board.stackX, gap: 14 }}>
          <RateLimitPanel
            seconds={dupSeconds}
            body="You have tried this a few times in a row. Wait a little and try again — nothing you filled in was lost."
          />
          {hero?.url ? (
            <OutlineButton
              label="Check this photo again"
              onPress={() => recheck(hero.id)}
              disabled={dupSeconds > 0}
            />
          ) : null}
        </View>
      ) : null}

      {hero ? (
        <View
          style={{ marginTop: 24, paddingHorizontal: board.stackX }}
        >
          <PhotoState
            photo={hero}
            onRetry={() => retry(hero.id)}
            onRemove={() => remove(hero.id)}
            onTakePhoto={onOpenCamera}
            onChooseAnother={openGallery}
            onSeeListing={onSeeListing}
          />
        </View>
      ) : null}

      <View style={{ height: postSpace.photos.bottom }} />
    </View>
  );
}

/* ─────────────────────────── the hero ───────────────────────────────── */

function HeroPhoto({
  photo,
  width,
  aspect,
  onMeasure,
  onRemove,
  markerInset,
}: {
  photo: Photo;
  width: number;
  aspect: number;
  onMeasure: (id: string, w: number, h: number) => void;
  onRemove: () => void;
  markerInset: number;
}) {
  const veil =
    photo.upload === "uploading"
      ? postColor.veilUploading
      : photo.upload === "failed"
        ? postColor.veilFailed
        : photo.dup === "failed"
          ? postColor.veilBlocked
          : null;

  return (
    <View style={{ width, height: width / aspect, backgroundColor: postColor.inset }}>
      <Image
        source={{ uri: photo.localUri }}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        onLoad={(e) => onMeasure(photo.id, e.source.width, e.source.height)}
        transition={160}
      />

      {veil ? (
        <View
          pointerEvents="none"
          style={{ ...StyleSheetAbsolute, backgroundColor: veil }}
        />
      ) : null}

      {/* The upload bar sits ON the photo, at its top edge, with its own
          semi-opaque track — `line` would disappear over a pale photo. */}
      {photo.upload === "uploading" ? (
        <>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
            <ProgressBar
              fraction={photo.progress}
              height={postSize.photo.uploadBar}
              track={postColor.uploadTrack}
              fill={postColor.green}
            />
          </View>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: markerInset,
              bottom: markerInset,
              backgroundColor: postColor.captionChip,
              borderRadius: postRadius.markerChip,
              paddingHorizontal: 8,
              paddingVertical: 5,
            }}
          >
            <Text style={[textStyle(postType.photoCounter), { color: postColor.inkSecondary }]}>
              {HERO_UPLOAD_CAPTION(photo.progress)}
            </Text>
          </View>
        </>
      ) : null}

      {/* The mark is drawn only once the photo is really on the listing. A
          camera photo whose upload failed carries no claim yet. */}
      {photo.source === "camera" && photo.upload === "done" && photo.dup !== "failed" ? (
        <MarkerChip inset={markerInset} />
      ) : null}

      <Tappable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel="Remove this photo"
        style={{
          position: "absolute",
          top: postSpace.photos.removeInset,
          right: postSpace.photos.removeInset,
          width: postSize.photo.remove,
          height: postSize.photo.remove,
          borderRadius: postSize.photo.remove / 2,
          backgroundColor: postColor.removeFill,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CloseIcon
          size={postIcon.removePhoto.size}
          stroke={postIcon.removePhoto.stroke}
          color={postColor.onDark}
        />
      </Tappable>
    </View>
  );
}

const StyleSheetAbsolute = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

/**
 * Before any photo.
 *
 * The one place this step has a heading, and the helper under it is the only
 * piece of advice in the flow that is about getting OFFERS rather than about
 * getting through the form. It is here because this is the moment it changes
 * what someone does.
 */
function EmptyHero({ board }: { board: Board }) {
  return (
    <View style={{ paddingHorizontal: board.screenX }}>
      <Text
        style={[
          textStyle(postType.stepHeading),
          { color: postColor.ink, fontSize: board.stepHeading },
        ]}
      >
        Add a photo to start
      </Text>
      <Text
        style={[
          textStyle(postType.stepSub),
          { color: postColor.inkSecondary, marginTop: 11 },
        ]}
      >
        Two or three photos from different angles get more offers than one.
      </Text>
      <View style={{ height: 24 }} />
    </View>
  );
}

/* ──────────────────────── the thumbnail rail ────────────────────────── */

/**
 * Four 78 tiles at gap 8 = 336 of the 358 available. At 360 the tile drops to
 * 72 and the four fill the 336 exactly.
 *
 * The NEXT empty slot is a dashed 1.5 tile with a plus; the ones after it are a
 * lighter dashed 1 with nothing in them. That difference is the whole
 * affordance — one target, and a hint of how many more the flow will take.
 */
function ThumbnailRail({
  photos,
  selected,
  board,
  onSelect,
  onAdd,
}: {
  photos: Photo[];
  selected: number;
  board: Board;
  onSelect: (index: number) => void;
  onAdd: () => void;
}) {
  const tile = board.thumb;
  const slots = Array.from({ length: rules.maxPhotos }, (_, i) => i);

  return (
    <View
      style={{
        flexDirection: "row",
        gap: postSpace.photos.thumbGap,
        paddingHorizontal: board.stackX,
      }}
    >
      {slots.map((i) => {
        const photo = photos[i];
        if (photo) {
          const isSelected = i === selected;
          return (
            <Tappable
              key={photo.id}
              onPress={() => onSelect(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Photo ${i + 1} of ${photos.length}`}
              style={{
                width: tile,
                height: tile,
                borderRadius: postRadius.thumb,
                overflow: "hidden",
                borderWidth: isSelected ? postBorder.thumbSelected : postBorder.thumb,
                borderColor: isSelected ? postColor.green : postColor.line,
                backgroundColor: postColor.inset,
              }}
            >
              <Image
                source={{ uri: photo.localUri }}
                style={{
                  width: "100%",
                  height: "100%",
                  // A tile mid-upload is halved in opacity rather than veiled:
                  // the veil is for the hero, where there is room for a caption
                  // to explain it.
                  opacity: photo.upload === "uploading" ? 0.5 : 1,
                }}
                contentFit="cover"
              />
              {photo.upload === "failed" ? (
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: postBorder.ruleUploadFailed,
                    backgroundColor: postColor.warm,
                  }}
                />
              ) : null}
              {photo.dup === "failed" ? (
                <View
                  pointerEvents="none"
                  style={{ ...StyleSheetAbsolute, backgroundColor: postColor.veilBlocked }}
                />
              ) : null}
              {photo.source === "camera" && photo.upload === "done" ? (
                <MarkerBadge tile={78} />
              ) : null}
            </Tappable>
          );
        }

        // The first empty slot is the target; the rest are placeholders.
        const isNext = i === photos.length;
        return isNext ? (
          <Tappable
            key={`add-${i}`}
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel="Add another photo"
            style={{
              width: tile,
              height: tile,
              borderRadius: postRadius.addTile,
              borderWidth: postBorder.addTileNext,
              borderStyle: "dashed",
              borderColor: postColor.dashed,
              backgroundColor: postColor.addTile,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PlusIcon
              size={postIcon.addPhoto.size}
              stroke={postIcon.addPhoto.stroke}
              color={postColor.inkMuted}
            />
          </Tappable>
        ) : (
          <View
            key={`slot-${i}`}
            style={{
              width: tile,
              height: tile,
              borderRadius: postRadius.addTile,
              borderWidth: postBorder.addTileLater,
              borderStyle: "dashed",
              borderColor: postColor.line,
              backgroundColor: postColor.surface,
            }}
          />
        );
      })}
    </View>
  );
}

/* ─────────────────── the selected photo's own state ─────────────────── */

function PhotoState({
  photo,
  onRetry,
  onRemove,
  onTakePhoto,
  onChooseAnother,
  onSeeListing,
}: {
  photo: Photo;
  onRetry: () => void;
  onRemove: () => void;
  onTakePhoto: () => void;
  onChooseAnother: () => void;
  onSeeListing: (itemId: string) => void;
}) {
  const { dispatch } = usePost();

  // Rejected before any request went out.
  //
  // NO warm rule and NO "Try again", because neither is true: nothing failed to
  // upload — the file was never sent, and retrying the same file would reject
  // it the same way. The two messages are the spec's own, and the only action
  // that helps is removing the row.
  if (photo.rejected) {
    return (
      <View style={{ gap: 6 }}>
        <Text style={[textStyle(postType.helperLong), { color: postColor.inkSecondary }]}>
          {photo.rejected === "too-large" ? PHOTO_ERRORS.tooLarge : PHOTO_ERRORS.unsupported}
        </Text>
        <TextButton label="Remove this photo" onPress={onRemove} />
      </View>
    );
  }

  if (photo.upload === "failed") return <UploadFailed onRetry={onRetry} onRemove={onRemove} />;
  if (photo.upload === "uploading") return null;
  if (photo.dup === "running") return <DuplicateRunning />;

  switch (photo.dup) {
    case "self":
      return (
        <DuplicateSelf
          listing={photo.match}
          // "Keep this photo" changes nothing — the photo is already attached.
          // Dismissing the panel IS the action, so the verdict is recorded as
          // passed and the note goes away.
          onKeep={() => dispatch({ type: "photo/patch", id: photo.id, patch: { dup: "passed" } })}
          onDifferent={onChooseAnother}
          onSeeListing={() => photo.match && onSeeListing(photo.match.id)}
        />
      );
    case "warned":
      return (
        <DuplicateWarned
          listing={photo.match}
          onKeep={() => dispatch({ type: "photo/patch", id: photo.id, patch: { dup: "passed" } })}
          onTakeOwn={onTakePhoto}
        />
      );
    case "failed":
      return (
        <DuplicateFailed
          // No reference code comes back from /api/ai/phash. See the note on
          // PHASH_APPEAL_SUPPORTED — the block renders without it rather than
          // printing an identifier support cannot look up.
          reference={null}
          appealSent={false}
          onTakePhoto={onTakePhoto}
          onChooseAnother={onChooseAnother}
          onAppeal={() => {}}
        />
      );
    default:
      // `passed` shows nothing, ever.
      return null;
  }
}

/* ─────────────────────── the gallery button ─────────────────────────── */

function GalleryButton({
  onPress,
  disabled,
  style,
}: {
  onPress: () => void;
  disabled: boolean;
  style?: object;
}) {
  return (
    <Tappable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel="Choose from gallery"
      style={[
        {
          height: postSize.entry.button,
          borderRadius: postRadius.button,
          backgroundColor: disabled ? postColor.disabledFill : postColor.surface,
          borderWidth: postBorder.field,
          borderColor: disabled ? postColor.line : postColor.lineStrong,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: postSize.entry.iconGap,
        },
        style,
      ]}
      pressedStyle={disabled ? undefined : { backgroundColor: postColor.inset }}
    >
      <ImageIcon
        size={postIcon.gallery.size}
        stroke={postIcon.gallery.stroke}
        color={disabled ? postColor.inkDisabled : postColor.ink}
      />
      <Text
        style={[
          textStyle(postType.outlineLabel),
          { color: disabled ? postColor.inkDisabled : postColor.ink },
        ]}
      >
        Choose from gallery
      </Text>
    </Tappable>
  );
}
