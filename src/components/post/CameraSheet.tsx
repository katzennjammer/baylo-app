import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { Modal, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  postColor,
  postIcon,
  postRadius,
  postSize,
  postType,
  textStyle,
} from "../../theme/post-tokens";
import { CloseIcon } from "../icons";
import { Tappable } from "../Tappable";
import { CameraIcon } from "./post-icons";
import { OutlineButton, PrimaryButton } from "./ui";

/**
 * The in-app camera.
 *
 * ── THIS IS THE ONLY PATH THAT EARNS THE MARKER ─────────────────────────────
 *
 * A photo produced here is recorded with `source: "camera"` and carries
 * "Photographed in Baylo" on the listing. A photo chosen from the gallery never
 * does, even if it was taken thirty seconds earlier by this same phone. The
 * claim is about the path the bytes took and nothing else, and the only way to
 * keep it true is for capture to be a different code path from selection —
 * which is why this exists rather than `ImagePicker.launchCameraAsync`, whose
 * result is indistinguishable from a library pick by the time it reaches state.
 *
 * ── AND WHY THE CAPTURE IS NOT PROCESSED HERE ───────────────────────────────
 *
 * `skipProcessing` is left at its default and `exif` is false, but nothing else
 * is done to the image: no resize, no re-encode, no metadata handling. All of
 * that happens server-side in /api/upload, which decodes the bytes with sharp
 * and re-encodes them WITHOUT metadata before Cloudinary ever sees them. A
 * client-side pass would be a second, weaker implementation of the thing that
 * strips a seller's home GPS coordinates out of a photo taken in their kitchen.
 *
 * `quality: 0.9` is the one exception and it is a bandwidth decision, not a
 * privacy one: it is applied by the camera during encode, before any file
 * exists, and keeps a 12 MP capture comfortably under the route's 10 MB cap.
 */

export function CameraSheet({
  open,
  onClose,
  onCaptured,
}: {
  open: boolean;
  onClose: () => void;
  onCaptured: (uri: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();

  const capture = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.9, exif: false });
      if (photo?.uri) {
        onCaptured(photo.uri);
        onClose();
      }
    } catch {
      // A capture that throws is a camera that was interrupted — a call, the
      // app backgrounding, another app taking the sensor. The sheet stays open
      // with the shutter live rather than reporting an error about a photo that
      // was never taken.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: postColor.ink }}>
        {permission?.granted ? (
          <CameraView ref={camera} style={{ flex: 1 }} facing="back" />
        ) : (
          <PermissionGate
            asked={permission !== null}
            onAsk={requestPermission}
            insetTop={insets.top}
          />
        )}

        {/* The close cross, over the preview. 44 × 44 like every other target. */}
        <Tappable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close the camera"
          style={{
            position: "absolute",
            top: Math.max(insets.top, 12) + 4,
            left: 12,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: postColor.removeFill,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CloseIcon
            size={postIcon.close.size}
            stroke={postIcon.close.stroke}
            color={postColor.onDark}
          />
        </Tappable>

        {permission?.granted ? (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              paddingHorizontal: 16,
              paddingBottom: Math.max(26, insets.bottom),
              paddingTop: 16,
            }}
          >
            <PrimaryButton
              label="Take the photo"
              onPress={capture}
              loading={busy}
              icon={
                <CameraIcon
                  size={postIcon.cameraPrimary.size}
                  stroke={postIcon.cameraPrimary.stroke}
                  color={postColor.onGreen}
                />
              }
            />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/**
 * Before permission, and after it has been refused.
 *
 * Both say the same thing, because the useful sentence is the same in both
 * cases: this is what the camera is for here. A refusal is not treated as an
 * error — the gallery is a full-width button one screen back, and the flow
 * works without ever opening this sheet.
 */
function PermissionGate({
  asked,
  onAsk,
  insetTop,
}: {
  asked: boolean;
  onAsk: () => void;
  insetTop: number;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
        paddingTop: insetTop,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: postRadius.markerTooltip,
          backgroundColor: postColor.markerFill,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CameraIcon size={32} stroke={1.6} color={postColor.onDark} />
      </View>
      <Text
        style={[
          textStyle(postType.draftHeading),
          { color: postColor.surface, marginTop: 20, textAlign: "center" },
        ]}
      >
        Take a photo in Baylo
      </Text>
      <Text
        style={[
          textStyle(postType.noticeBody),
          { color: postColor.line, marginTop: 10, textAlign: "center" },
        ]}
      >
        Photos taken here carry a camera mark on your listing, and they are not flagged as
        possible duplicates. Baylo needs permission to open the camera.
      </Text>
      <View style={{ height: 24, width: "100%" }} />
      {asked ? (
        <OutlineButton
          label="Open the camera"
          onPress={onAsk}
          style={{ alignSelf: "stretch" }}
        />
      ) : (
        <PrimaryButton
          label="Allow the camera"
          onPress={onAsk}
          style={{ alignSelf: "stretch", height: postSize.entry.button }}
        />
      )}
    </View>
  );
}
