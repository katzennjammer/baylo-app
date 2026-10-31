import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import type { MascotPose } from "../media/mascots";
import { border, color, popup, radius, space, textStyle, type } from "../theme/tokens";
import { PopupActions, PopupButton, PopupSheet } from "./PopupSheet";

export function NoticeDialog({
  visible,
  title,
  body,
  icon,
  onDismiss,
  pose,
  buttonLabel = "OK",
  listingPreview,
  onViewListing,
}: {
  visible: boolean;
  title: string;
  body: string;
  icon: React.ReactNode;
  onDismiss: () => void;
  pose?: MascotPose;
  buttonLabel?: string;
  listingPreview?: { title: string | null; photoUrl: string | null };
  onViewListing?: () => void;
}) {
  return (
    <PopupSheet
      visible={visible}
      title={title}
      message={body}
      icon={icon}
      pose={pose}
      liveSticker={listingPreview !== undefined}
      onDismiss={onDismiss}
      dismissLabel="Close"
    >
      {listingPreview ? (
        <View style={s.preview}>
          {listingPreview.photoUrl ? (
            <Image
              source={{ uri: listingPreview.photoUrl }}
              contentFit="cover"
              style={s.previewImage}
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          ) : null}
          <View style={s.previewCopy}>
            {listingPreview.title ? (
              <Text style={[textStyle(type.itemTitle), s.previewTitle]} numberOfLines={1}>
                {listingPreview.title}
              </Text>
            ) : null}
            <Text style={[textStyle(type.metadata), s.previewStatus]}>
              Live in the marketplace
            </Text>
          </View>
        </View>
      ) : null}

      {onViewListing ? (
        <PopupActions layout="row">
          <PopupButton
            label="Later"
            tone="secondary"
            onPress={onDismiss}
            containerStyle={s.secondarySlot}
          />
          <PopupButton
            label="See my listing"
            tone="primary"
            onPress={onViewListing}
            containerStyle={s.primarySlot}
          />
        </PopupActions>
      ) : (
        <PopupActions layout="single">
          <PopupButton label={buttonLabel} tone="primary" onPress={onDismiss} />
        </PopupActions>
      )}
    </PopupSheet>
  );
}

const s = StyleSheet.create({
  preview: {
    minHeight: popup.previewThumbnail + popup.previewPadding * 2,
    flexDirection: "row",
    alignItems: "center",
    gap: popup.previewPadding,
    marginTop: space.sheet.groupGap,
    padding: popup.previewPadding,
    borderWidth: border.dashed,
    borderColor: color.homeOutline,
    borderStyle: "dashed",
    borderRadius: popup.previewRadius,
    backgroundColor: color.inset,
  },
  previewImage: {
    width: popup.previewThumbnail,
    height: popup.previewThumbnail,
    borderRadius: radius.dPhoto,
  },
  previewCopy: { flex: 1, minWidth: 0 },
  previewTitle: { color: color.homeOutline },
  previewStatus: { color: color.inkSecondary, marginTop: 2 },
  secondarySlot: { flex: 35 },
  primarySlot: { flex: 65 },
});
