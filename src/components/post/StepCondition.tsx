import { Text, View } from "react-native";

import { CONDITIONS, type Condition } from "../../api/post";
import { usePost } from "../../post/state";
import {
  postBorder,
  postColor,
  postIcon,
  postRadius,
  postSize,
  postSpace,
  postType,
  textStyle,
  type Board,
} from "../../theme/post-tokens";
import { CheckIcon } from "../icons";
import { Tappable } from "../Tappable";

/**
 * Step 3 — condition.
 *
 * ── FIVE ROWS, ALWAYS, NEVER A PICKER ───────────────────────────────────────
 *
 * The spec is explicit and the reason is worth writing down: the difference
 * between Good and Fair is the difference between a trade that completes and
 * one that ends in an argument at a mall entrance. Those distinctions live in
 * the DESCRIPTIONS — "used often, works as it should" against "clear wear or
 * small damage, still usable" — and a picker hides four of the five behind a
 * tap. Five 68 rows cost 376 px of a 640 scroll and buy an honest listing.
 *
 * ── NEXT IS ALWAYS ENABLED, BECAUSE THE STEP IS PREFILLED ───────────────────
 *
 * Detection fills this in and the note at the top says so, in the same breath
 * as inviting a correction: "We filled this in from your photo. Change it if it
 * is off." The note goes away the moment the user picks a row — at that point
 * it is their answer, and continuing to attribute it to us would be wrong.
 */

export function StepCondition({ board }: { board: Board }) {
  const { state, dispatch } = usePost();

  return (
    <View style={{ paddingHorizontal: board.screenX }}>
      <Text
        style={[
          textStyle(postType.stepHeading),
          { color: postColor.ink, fontSize: board.stepHeading },
        ]}
      >
        How is it holding up?
      </Text>

      {state.conditionPrefilled ? (
        <View
          style={{
            marginTop: postSpace.condition.headingToNote,
            flexDirection: "row",
            alignItems: "flex-start",
            gap: postSpace.condition.noteIconGap,
          }}
        >
          <View style={{ paddingTop: 2 }}>
            <CheckIcon
              size={postIcon.checkSmall.size}
              stroke={postIcon.checkSmall.stroke}
              color={postColor.forest}
            />
          </View>
          <Text
            style={[textStyle(postType.conditionDesc), { color: postColor.inkSecondary, flex: 1 }]}
          >
            We filled this in from your photo. Change it if it is off.
          </Text>
        </View>
      ) : null}

      <View
        style={{
          marginTop: postSpace.condition.noteToList,
          gap: postSpace.condition.rowGap,
        }}
      >
        {CONDITIONS.map((option) => (
          <ConditionRow
            key={option.value}
            name={option.label}
            description={option.description}
            selected={state.condition === option.value}
            onPress={() =>
              dispatch({ type: "field/condition", value: option.value as Condition })
            }
          />
        ))}
      </View>

      <View style={{ height: postSpace.condition.bottom }} />
    </View>
  );
}

/**
 * One option.
 *
 * ── THE PADDING GIVES BACK WHAT THE BORDER TAKES ────────────────────────────
 *
 * 16 unselected, 15 selected, because the selected border grows from 1 to 1.5.
 * Without that the name and its description slide half a pixel left the instant
 * a row is chosen, across all five rows in sequence as somebody compares them.
 *
 * ── AND THE ROW IS ALLOWED TO GROW ──────────────────────────────────────────
 *
 * `minHeight: 68`, not `height`. At 360 the Fair description — "Clear wear or
 * small damage, still usable" — wraps to two lines at 12/16.2, and the spec's
 * own reflow note says to let the row grow to 76 rather than clamp it. A
 * clamped row would cut the second line, which is the half of the sentence that
 * says the item still works.
 */
function ConditionRow({
  name,
  description,
  selected,
  onPress,
}: {
  name: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name}. ${description}`}
      style={{
        minHeight: postSize.condition.row,
        borderRadius: postRadius.conditionRow,
        backgroundColor: selected ? postColor.greenWash : postColor.surface,
        borderWidth: selected ? postBorder.fieldActive : postBorder.field,
        borderColor: selected ? postColor.green : postColor.line,
        paddingHorizontal: selected
          ? postSpace.condition.rowXSelected
          : postSpace.condition.rowX,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: postSpace.condition.checkGap,
      }}
      pressedStyle={selected ? undefined : { backgroundColor: postColor.inset }}
    >
      {/* The ring, drawn outside the row's own box so the 68 stays 68. */}
      {selected ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -postBorder.ring,
            left: -postBorder.ring,
            right: -postBorder.ring,
            bottom: -postBorder.ring,
            borderRadius: postRadius.conditionRow + postBorder.ring,
            borderWidth: postBorder.ring,
            borderColor: postColor.focusRing,
          }}
        />
      ) : null}

      <View style={{ flex: 1 }}>
        <Text style={[textStyle(postType.conditionName), { color: postColor.ink }]}>{name}</Text>
        <Text
          style={[
            textStyle(postType.conditionDesc),
            {
              color: selected ? postColor.forest : postColor.inkSecondary,
              marginTop: postSpace.condition.nameToDesc,
            },
          ]}
        >
          {description}
        </Text>
      </View>

      {selected ? (
        <CheckIcon
          size={postSize.condition.check}
          stroke={postIcon.check.stroke}
          color={postColor.forest}
        />
      ) : null}
    </Tappable>
  );
}
