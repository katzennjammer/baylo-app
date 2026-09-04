import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { Tappable } from "../Tappable";
import { CameraIcon } from "./post-icons";
import {
  postColor,
  postIcon,
  postRadius,
  postSize,
  postType,
  textStyle,
} from "../../theme/post-tokens";

/**
 * "Photographed in Baylo".
 *
 * ── WHAT THIS MARK MAY AND MAY NOT CLAIM ────────────────────────────────────
 *
 * It means the bytes came from the camera inside this app rather than from a
 * gallery. That is ALL it means, and the tooltip's second sentence exists to
 * say so: "It does not mean we checked the item itself." Without that sentence
 * the mark drifts into reading as "verified", which Baylo cannot support — no
 * one has looked at the item, and a badge that implies someone has is the kind
 * of claim that gets people to meet a stranger with more confidence than the
 * evidence justifies.
 *
 * ── AND WHY IT IS NEVER GREEN ───────────────────────────────────────────────
 *
 * Green is the flow's success and confirmation colour: a done tick, a selected
 * hub, a confirmed detection. Putting the marker in green would enrol it in
 * that vocabulary and make it read as an endorsement of the listing. It is
 * therefore the one persistent element drawn in neutral-over-dark — a 62 %
 * scrim with the tint used only as ink.
 */

/** The chip on the hero photo. 12 from the left and bottom edges. */
export function MarkerChip({ inset }: { inset: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tappable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Photographed in Baylo. What this means."
        style={{
          position: "absolute",
          left: inset,
          bottom: inset,
          height: postSize.marker.chipH,
          borderRadius: postRadius.markerChip,
          backgroundColor: postColor.markerFill,
          paddingHorizontal: postSize.marker.chipX,
          flexDirection: "row",
          alignItems: "center",
          gap: postSize.marker.chipGap,
        }}
      >
        <CameraIcon
          size={postIcon.cameraChip.size}
          stroke={postIcon.cameraChip.stroke}
          color={postColor.onDark}
        />
        <Text style={[textStyle(postType.markerLabel), { color: postColor.onDark }]}>
          Photographed in Baylo
        </Text>
      </Tappable>
      <MarkerTooltip open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * The badge on a thumbnail or a review tile — the mark with no label.
 *
 * The words do not fit on a 78 tile and abbreviating them would produce a
 * second, shorter claim. The camera glyph alone is not a claim; it is a
 * pointer back to the chip on the hero, which is where the sentence lives.
 */
export function MarkerBadge({ tile }: { tile: 78 | 104 }) {
  const size = tile === 104 ? postSize.marker.badge104 : postSize.marker.badge78;
  const spec = tile === 104 ? postIcon.cameraBadge104 : postIcon.cameraBadge78;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: postSize.marker.badgeInset,
        bottom: postSize.marker.badgeInset,
        width: size,
        height: size,
        borderRadius: postRadius.markerBadge,
        backgroundColor: postColor.markerFill,
        alignItems: "center",
        justifyContent: "center",
      }}
      accessible
      accessibilityLabel="Photographed in Baylo"
    >
      <CameraIcon size={spec.size} stroke={spec.stroke} color={postColor.onDark} />
    </View>
  );
}

/**
 * The tapped state.
 *
 * A centred card rather than an anchored popover: the chip sits at the bottom
 * of a full-bleed photo, and a popover tethered to it would be half off the
 * screen on the small board. The scrim is the draft sheet's, because it is the
 * same gesture — something has been put in front of the flow and tapping away
 * from it dismisses.
 */
function MarkerTooltip({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={{
          flex: 1,
          backgroundColor: postColor.scrim,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
        }}
      >
        {/* A Pressable that swallows the tap, so a press INSIDE the card does
            not dismiss it. `onPress` with no handler is enough — the touch is
            captured and never reaches the scrim behind. */}
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: postColor.inset,
            borderRadius: postRadius.markerTooltip,
            padding: 18,
            width: "100%",
            maxWidth: 320,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <CameraIcon
              size={postIcon.cameraTooltip.size}
              stroke={postIcon.cameraTooltip.stroke}
              color={postColor.ink}
            />
            <Text style={[textStyle(postType.tooltipHeading), { color: postColor.ink }]}>
              Photographed in Baylo
            </Text>
          </View>
          <Text
            style={[
              textStyle(postType.tooltipBody),
              { color: postColor.inkSecondary, marginTop: 10 },
            ]}
          >
            This photo was taken with the camera inside Baylo, not picked from a gallery. It
            does not mean we checked the item itself.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
