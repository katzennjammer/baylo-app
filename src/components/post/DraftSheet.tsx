import { Image } from "expo-image";
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { RETENTION_LINE } from "../../post/draft";
import { draftProgress, isVisible, type PostState } from "../../post/state";
import {
  draftSheetShadow,
  postColor,
  postLines,
  postRadius,
  postSize,
  postSpace,
  postType,
  textStyle,
} from "../../theme/post-tokens";
import { PrimaryButton, TextButton } from "./ui";

/**
 * The sheet that appears when someone leaves mid-flow.
 *
 * ── THE DECISION IS "YES, THERE IS A DRAFT" ─────────────────────────────────
 *
 * The alternative — losing the work — is not defensible in a flow whose first
 * step is uploading photographs over a phone connection. So the question this
 * sheet asks is not "shall we save it" but "you are leaving; the work is safe;
 * what did you mean to do". `Keep draft and leave` is the primary and it is the
 * unsurprising answer.
 *
 * ── DISCARD ASKS TWICE, AND THE SECOND ASK REPLACES THE FIRST ───────────────
 *
 * Not a second modal on top of a modal. The three buttons are replaced in place
 * by "Yes, discard it" and "No, keep it", so there is exactly one thing on
 * screen to decide about. The confirming button is the only warm-filled control
 * in the whole flow and the only white label — both because it is the one
 * action here that destroys something.
 *
 * The retention line is not fine print. "Drafts are kept for 30 days. You can
 * have one draft at a time." is the answer to the two questions somebody
 * leaving actually has, and it is the reason discard is a rare choice rather
 * than a nervous one.
 */

export function DraftSheet({
  open,
  state,
  onKeepAndLeave,
  onCarryOn,
  onDiscard,
  onClose,
}: {
  open: boolean;
  state: PostState;
  onKeepAndLeave: () => void;
  onCarryOn: () => void;
  onDiscard: () => void;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  // `isVisible`, not `isPostable`: the draft sheet shows what the draft HAS,
  // and a photo whose duplicate check is still in flight is in the draft. It
  // would be shown, vanish for the second the check takes, and come back.
  const photos = state.photos.filter(isVisible);
  const thumb = state.photos[0]?.localUri ?? null;
  const meta = `${draftProgress(state)} of 7 steps · ${photos.length} photo${
    photos.length === 1 ? "" : "s"
  }`;

  const close = () => {
    setConfirming(false);
    onClose();
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
      <Pressable
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={{ flex: 1, backgroundColor: postColor.scrim, justifyContent: "flex-end" }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: postColor.surface,
            borderTopLeftRadius: postRadius.draftSheet,
            borderTopRightRadius: postRadius.draftSheet,
            paddingHorizontal: postSpace.draft.x,
            paddingTop: postSpace.draft.top,
            paddingBottom: postSpace.draft.bottom,
            ...draftSheetShadow,
          }}
        >
          <View
            style={{
              width: postSize.draft.grabberW,
              height: postSize.draft.grabberH,
              borderRadius: postRadius.draftGrabber,
              backgroundColor: postColor.line,
              alignSelf: "center",
              marginBottom: postSpace.draft.grabberBelow,
            }}
          />

          <Text style={[textStyle(postType.draftHeading), { color: postColor.ink }]}>
            Your draft is saved
          </Text>
          <Text
            style={[
              textStyle(postType.stepSub),
              {
                color: postColor.inkSecondary,
                marginTop: postSpace.draft.headingToBody,
                lineHeight: 21.7,
              },
            ]}
          >
            We kept your photos and everything you filled in. Pick it up from the Post tab
            whenever you are ready.
          </Text>

          <View
            style={{
              marginTop: postSpace.draft.bodyToRow,
              backgroundColor: postColor.inset,
              borderRadius: postRadius.noticePanel,
              padding: postSpace.draft.rowPadding,
              flexDirection: "row",
              alignItems: "center",
              gap: postSpace.draft.rowGap,
            }}
          >
            <View
              style={{
                width: postSize.draft.thumb,
                height: postSize.draft.thumb,
                borderRadius: postRadius.thumb,
                overflow: "hidden",
                backgroundColor: postColor.line,
              }}
            >
              {thumb ? (
                <Image
                  source={{ uri: thumb }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[textStyle(postType.draftRowTitle), { color: postColor.ink }]}
                numberOfLines={postLines.draftRowTitle}
              >
                {state.title.trim() || "Untitled item"}
              </Text>
              <Text
                style={[
                  textStyle(postType.draftRowMeta),
                  { color: postColor.inkMuted, marginTop: 5 },
                ]}
              >
                {meta}
              </Text>
            </View>
          </View>

          {confirming ? (
            <View style={{ marginTop: postSpace.draft.rowToPrimary }}>
              <Text
                style={[
                  textStyle(postType.noticeBody),
                  { color: postColor.inkSecondary, marginBottom: 14 },
                ]}
              >
                Discard this draft? Your photos and answers will be deleted.
              </Text>
              <Pressable
                onPress={onDiscard}
                accessibilityRole="button"
                accessibilityLabel="Yes, discard it"
                style={{
                  height: postSize.button.primary,
                  borderRadius: postRadius.button,
                  backgroundColor: postColor.discardFill,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={[textStyle(postType.primaryLabel), { color: postColor.discardLabel }]}
                >
                  Yes, discard it
                </Text>
              </Pressable>
              <TextButton label="No, keep it" onPress={() => setConfirming(false)} />
            </View>
          ) : (
            <View style={{ marginTop: postSpace.draft.rowToPrimary }}>
              <PrimaryButton label="Keep draft and leave" onPress={onKeepAndLeave} />
              <View style={{ height: postSpace.draft.primaryToText }} />
              <TextButton label="Carry on posting" onPress={onCarryOn} />
              <TextButton
                label="Discard this draft"
                tone="warm"
                onPress={() => setConfirming(true)}
              />
            </View>
          )}

          <Text
            style={[
              textStyle(postType.helperLong),
              {
                color: postColor.inkMuted,
                marginTop: postSpace.draft.textToRetention,
                textAlign: "center",
              },
            ]}
          >
            {RETENTION_LINE}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
