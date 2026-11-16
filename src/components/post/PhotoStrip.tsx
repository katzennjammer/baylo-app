import { Image } from "expo-image";
import { ScrollView, Text, View } from "react-native";

import { CloseIcon } from "../icons";
import { showDialog } from "../dialog";
import { Tappable } from "../Tappable";
import { MarkerBadge } from "./CameraMarker";
import { postColor, postRadius, postType, textStyle } from "../../theme/post-tokens";

type StripPhoto = { id: string; localUri: string; source: "camera" | "gallery" };

/**
 * EVERY photo on the listing, in a row (16 Nov 2026).
 *
 * The identify and review steps used to show the first photo (and a "+3"), so
 * a wrong photo mixed into the set was invisible until the listing was live.
 * Now each one is shown, and each has a remove button. Removing asks first,
 * and the last photo cannot be removed here (a listing needs one; step 1
 * replaces it). The order is the listing's order: the first is the cover.
 */
export function PhotoStrip({
  photos,
  tile,
  onRemove,
  paddingX = 0,
}: {
  photos: StripPhoto[];
  tile: number;
  onRemove?: (id: string) => void;
  paddingX?: number;
}) {
  const canRemove = !!onRemove && photos.length > 1;
  const confirmRemove = (id: string, index: number) =>
    showDialog(
      "Remove this photo?",
      index === 0 ? "It's your cover photo. The next one becomes the cover." : "It won't be posted with this listing.",
      [
        { text: "Keep it", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => onRemove?.(id) },
      ],
    );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: paddingX }}
    >
      {photos.map((photo, index) => (
        <View key={photo.id}>
          <View
            style={{
              width: tile,
              height: tile,
              borderRadius: postRadius.reviewTile,
              overflow: "hidden",
              backgroundColor: postColor.inset,
            }}
            accessible
            accessibilityLabel={`Photo ${index + 1} of ${photos.length}${index === 0 ? ", cover" : ""}`}
          >
            <Image source={{ uri: photo.localUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            {photo.source === "camera" && tile >= 78 ? <MarkerBadge tile={tile >= 104 ? 104 : 78} /> : null}
          </View>
          {index === 0 ? (
            <Text style={[textStyle(postType.helper), { color: postColor.inkDisabled, marginTop: 4, fontSize: 11 }]}>
              Cover
            </Text>
          ) : null}
          {canRemove ? (
            <Tappable
              onPress={() => confirmRemove(photo.id, index)}
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
              hitSlop={8}
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "rgba(0,0,0,0.6)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CloseIcon size={14} stroke={2.4} color="#FFFFFF" />
            </Tappable>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}
