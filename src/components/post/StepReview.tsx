import { Image } from "expo-image";
import { Text, View } from "react-native";

import { BOOST_COST_LEAVES, BOOST_HOURS } from "../../api/featured";
import { useHubs } from "../../api/hubs";
import { categoryLabel, conditionLabel } from "../../api/post";
import { bracketLabel, bracketOf } from "../../lib/brackets";
import { classifyValue } from "../../lib/trade-rules";
import { effectiveValue, isPostable, parseQuantity, usePost, type PostState } from "../../post/state";
import {
  postBorder,
  postColor,
  postIcon,
  postLines,
  postRadius,
  postSize,
  postSpace,
  postType,
  textStyle,
  type Board,
} from "../../theme/post-tokens";
import { CheckIcon, LeafIcon } from "../icons";
import { Tappable } from "../Tappable";
import { MarkerBadge } from "./CameraMarker";
import { CheckboxIcon } from "./post-icons";
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

      {state.isPerishable ? (
        <Section
          label="PERISHABLE"
          // Step 1, same as ITEM: the item-type toggle and its three fields
          // live on the what-is-it step, under the title.
          onEdit={() => dispatch({ type: "goto", step: 1 })}
          board={board}
        >
          <Text style={[textStyle(postType.stepSub), { color: postColor.ink }]}>
            {perishableAmount(state)}
          </Text>
          <Text
            style={[
              textStyle(postType.helper),
              { color: postColor.inkMuted, marginTop: postSpace.review.contentToTags },
            ]}
          >
            {`Trade within ${state.tradeWithinHours} hours of posting. It goes live straight away.`}
          </Text>
        </Section>
      ) : null}

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
          {reviewLine(state)}
        </Text>
      </Section>

      {/* Straight after VALUE, not after PHOTOS: it is the other thing on this
          screen that costs Leaves, and at the bottom it read as a footnote. */}
      {state.isPerishable ? null : (
        <BoostAfterPost
          on={state.boostAfterPost}
          onToggle={() => dispatch({ type: "boost-after-post/set", value: !state.boostAfterPost })}
          board={board}
        />
      )}

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

/**
 * "Boost this listing after posting" — a decision card, not a checkbox row.
 * Standard listings only; the parent does not draw it for a perishable, and
 * the reducer will not store it for one.
 *
 * Bordered and inset from the dividers around it so it reads as a choice on
 * its own, with the Leaf the item screen's Boost button carries. Ticked, it
 * goes green-wash and forest, the app's "on" state. The whole card is the
 * control.
 *
 * Ticking it charges nothing yet. After the post lands, post-item.tsx hands
 * the new item to useConfirmBoost() with `afterPost`, which charges WITHOUT a
 * second dialog (25 Sep 2026): this card quotes the price, so ticking it and
 * tapping Post is the confirmation. The copy must keep naming the price.
 */
function BoostAfterPost({
  on,
  onToggle,
  board,
}: {
  on: boolean;
  onToggle: () => void;
  board: Board;
}) {
  return (
    <>
      <View style={{ paddingHorizontal: board.reviewX, paddingVertical: postSpace.review.sectionY }}>
        <Tappable
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: on }}
          accessibilityLabel={`Boost this listing after posting, ${BOOST_COST_LEAVES} Leaves`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: postSpace.review.editGap,
            padding: postSpace.review.sectionY,
            borderRadius: postRadius.noticePanel,
            borderWidth: on ? postBorder.fieldActive : postBorder.field,
            borderColor: on ? postColor.forest : postColor.lineStrong,
            backgroundColor: on ? postColor.greenWash : postColor.surface,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: on ? postColor.surface : postColor.greenWash,
              borderWidth: postBorder.field,
              borderColor: postColor.greenLine,
            }}
          >
            <LeafIcon size={20} stroke={1.8} color={postColor.forest} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[textStyle(postType.hubName), { color: on ? postColor.forest : postColor.ink }]}>
              Boost this listing
            </Text>
            <Text
              style={[
                textStyle(postType.helper),
                { color: postColor.inkMuted, marginTop: 3 },
              ]}
            >
              {`Featured in its category for ${BOOST_HOURS} hours, right after it posts, for ${BOOST_COST_LEAVES} Leaves.`}
            </Text>
          </View>
          {on ? (
            <CheckIcon size={postSize.hub.check} stroke={postIcon.check.stroke} color={postColor.forest} />
          ) : (
            <CheckboxIcon
              size={postSize.hub.checkbox}
              stroke={postSize.hub.checkboxBorder}
              color={postColor.lineStrong}
            />
          )}
        </Tappable>
      </View>
      <Divider />
    </>
  );
}

/**
 * The quantity as it will be POSTED, not as it was typed.
 *
 * Parsed with the same parseQuantity the submit path uses, so a box holding
 * "0" or a stray "." reads here exactly as the server will receive it: no
 * number. The unit is dropped with it, because the submit path drops it too.
 * Units are written as the item page writes them.
 */
function perishableAmount(state: PostState): string {
  const n = parseQuantity(state.quantity);
  if (n === null) return "No set quantity";
  return `${n} ${state.quantityUnit === "LITERS" ? "L" : state.quantityUnit}`;
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

/**
 * The mono line under the value chip: where the number came from, its
 * bracket, and — when the owner typed one past the cap — that a person
 * checks it first. Said here as well as on the value step, because this is
 * the last screen before Post and the review is the one thing about the
 * listing the owner cannot see from the marketplace afterwards.
 */
function reviewLine(state: PostState): string {
  const value = effectiveValue(state);
  const v = state.valuation;
  const source =
    v?.valuationSource === "comparables"
      ? `From ${v.sampleSize} similar trade${v.sampleSize === 1 ? "" : "s"}`
      : "Category estimate";
  if (value === null) return source;
  const bracket = bracketLabel(bracketOf(value));
  if (!state.ownValue || !v) return `${source} · ${bracket}`;
  const decision = classifyValue(value, v.suggestedLeaves);
  if (decision === "needsReview") return `Your own value · ${bracket} · checked by a person before it goes live`;
  if (decision === "suggested") return `${source} · ${bracket}`;
  return `Your own value · ${bracket} · goes live right away`;
}

