import { Image } from "expo-image";
import { Text, View } from "react-native";

import { useHubs } from "../../api/hubs";
import { categoryLabel, conditionLabel } from "../../api/post";
import { effectiveValue, isPostable, usePost } from "../../post/state";
import {
  postColor,
  postLines,
  postRadius,
  postSpace,
  postType,
  textStyle,
  type Board,
} from "../../theme/post-tokens";
import { MarkerBadge } from "./CameraMarker";
import { Divider, LeavesChip, SectionLabel, SmallTextButton, Tag } from "./ui";

/**
 * Step 7 — have a last look.
 *
 * ── EVERY SECTION IS EDITABLE, AND EDIT MEANS "GO BACK TO THAT STEP" ────────
 *
 * Not an inline editor. The wizard's steps already know how to render and
 * validate their own fields, and a second, smaller editor per section is a
 * second place for the value slider's band or the title's minimum to be
 * enforced — which is how the two drift apart. `goto` puts the user on the real
 * step with everything they filled in still there, and Next walks them back.
 *
 * ── THE TWO "NOTHING HERE" LINES ARE STATEMENTS, NOT PLACEHOLDERS ───────────
 *
 * "None chosen — you can agree a place in chat." and "Open to offers." are
 * what those sections say when they are empty, and both describe a listing that
 * works rather than a field that was missed. A greyed "not set" would make two
 * deliberately optional steps read as incomplete on the last screen before
 * posting, which is the worst possible moment to introduce a doubt.
 */

export function StepReview({ board }: { board: Board }) {
  const { state, dispatch } = usePost();
  const { data } = useHubs();

  const photos = state.photos.filter(isPostable);
  const value = effectiveValue(state);
  const chosenHubs = (data?.hubs ?? []).filter((h) => state.hubIds.includes(h.id));

  return (
    <View>
      <View style={{ paddingHorizontal: board.reviewX }}>
        <Text
          style={[
            textStyle(postType.stepHeading),
            { color: postColor.ink, fontSize: board.stepHeading },
          ]}
        >
          Have a last look
        </Text>
      </View>
      <View style={{ height: postSpace.review.headingBelow }} />

      <PhotoRail photos={photos} board={board} />
      <View style={{ height: postSpace.review.railBelow }} />

      <Divider />

      <Section
        label="ITEM"
        onEdit={() => dispatch({ type: "goto", step: 1 })}
        board={board}
      >
        <Text
          style={[textStyle(postType.reviewTitle), { color: postColor.ink }]}
          numberOfLines={postLines.reviewTitle}
        >
          {state.title || "Untitled"}
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: postSpace.review.tagGap,
            marginTop: postSpace.review.contentToTagsWide,
          }}
        >
          {state.category ? <Tag label={categoryLabel(state.category)} /> : null}
          <Tag label={conditionLabel(state.condition)} />
        </View>
      </Section>

      <Section
        label="VALUE"
        onEdit={() => dispatch({ type: "goto", step: 3 })}
        board={board}
      >
        {value !== null ? <LeavesChip leaves={value} /> : null}
        <Text
          style={[
            textStyle(postType.helper),
            { color: postColor.inkMuted, marginTop: postSpace.review.contentToTags },
          ]}
        >
          {state.valuation?.valuationSource === "comparables"
            ? `From ${state.valuation.sampleSize} similar trade${
                state.valuation.sampleSize === 1 ? "" : "s"
              }`
            : "Category estimate"}
        </Text>
      </Section>

      <Section
        label="HOPING TO GET"
        onEdit={() => dispatch({ type: "goto", step: 4 })}
        board={board}
      >
        <Text style={[textStyle(postType.stepSub), { color: postColor.ink }]}>
          {state.wanted.trim() || "Open to offers."}
        </Text>
        {state.returnCategories.length > 0 ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: postSpace.review.tagGap,
              marginTop: postSpace.review.contentToTags,
            }}
          >
            {state.returnCategories.map((c) => (
              <Tag key={c} label={categoryLabel(c)} tone="green" />
            ))}
          </View>
        ) : null}
      </Section>

      <Section
        label="MEETING PLACES"
        onEdit={() => dispatch({ type: "goto", step: 5 })}
        board={board}
      >
        {chosenHubs.length === 0 ? (
          <Text style={[textStyle(postType.stepSub), { color: postColor.ink }]}>
            None chosen — you can agree a place in chat.
          </Text>
        ) : (
          <View style={{ gap: 6 }}>
            {chosenHubs.map((hub) => (
              <Text
                key={hub.id}
                style={[textStyle(postType.hubName), { color: postColor.ink }]}
                numberOfLines={postLines.hubName}
              >
                {hub.name}
              </Text>
            ))}
          </View>
        )}
      </Section>

      <Section
        label="PHOTOS"
        onEdit={() => dispatch({ type: "goto", step: 0 })}
        board={board}
      >
        <Text style={[textStyle(postType.stepSub), { color: postColor.ink }]}>
          {`${photos.length} photo${photos.length === 1 ? "" : "s"}`}
          {photos.some((p) => p.source === "camera")
            ? ` · ${photos.filter((p) => p.source === "camera").length} taken in Baylo`
            : ""}
        </Text>
      </Section>

      <View
        style={{
          paddingHorizontal: board.reviewX,
          paddingTop: postSpace.review.closingTop,
          paddingBottom: postSpace.review.closingBottom,
        }}
      >
        <Text style={[textStyle(postType.helperLong), { color: postColor.inkMuted }]}>
          Once posted, traders near you can send offers. You can take the listing down any time.
        </Text>
      </View>
    </View>
  );
}

/* ───────────────────────────── the sections ─────────────────────────── */

function Section({
  label,
  onEdit,
  board,
  children,
}: {
  label: string;
  onEdit: () => void;
  board: Board;
  children: React.ReactNode;
}) {
  return (
    <>
      <View
        style={{
          paddingVertical: postSpace.review.sectionY,
          paddingHorizontal: board.reviewX,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: postSpace.review.editGap,
        }}
      >
        <View style={{ flex: 1 }}>
          <SectionLabel>{label}</SectionLabel>
          <View style={{ marginTop: postSpace.review.labelToContent }}>{children}</View>
        </View>
        {/* 52 × 44, right-aligned and top-aligned with the label rather than
            centred on a section whose height depends on its content. */}
        <SmallTextButton
          label="Edit"
          onPress={onEdit}
          style={{ width: 52, alignItems: "flex-end" }}
        />
      </View>
      <Divider />
    </>
  );
}

/* ──────────────────────────── the photo rail ────────────────────────── */

/**
 * Two 104 tiles and a remainder.
 *
 * The remainder tile is a `+N` count in an empty bordered box rather than a
 * third thumbnail, because the rail is a reminder of what is attached, not a
 * gallery — the gallery is one Edit away and it is step 1, where the photos can
 * actually be changed.
 */
function PhotoRail({
  photos,
  board,
}: {
  photos: { id: string; localUri: string; source: "camera" | "gallery" }[];
  board: Board;
}) {
  const tile = board.reviewTile;
  const shown = photos.slice(0, 2);
  const remainder = photos.length - shown.length;

  return (
    <View
      style={{
        flexDirection: "row",
        gap: postSpace.review.railGap,
        paddingHorizontal: board.reviewX,
      }}
    >
      {shown.map((photo) => (
        <View
          key={photo.id}
          style={{
            width: tile,
            height: tile,
            borderRadius: postRadius.reviewTile,
            overflow: "hidden",
            backgroundColor: postColor.inset,
          }}
        >
          <Image
            source={{ uri: photo.localUri }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
          {photo.source === "camera" ? <MarkerBadge tile={104} /> : null}
        </View>
      ))}
      <View
        style={{
          flex: 1,
          height: tile,
          borderRadius: postRadius.reviewTile,
          borderWidth: 1,
          borderColor: postColor.divider,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={[textStyle(postType.counter), { color: postColor.inkDisabled }]}>
          {`+${Math.max(0, remainder)}`}
        </Text>
      </View>
    </View>
  );
}
