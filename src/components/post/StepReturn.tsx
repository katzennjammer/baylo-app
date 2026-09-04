import { Text, TextInput, View } from "react-native";

import { CATEGORIES, CATEGORY_LABELS } from "../../api/post";
import { usePost } from "../../post/state";
import {
  postColor,
  postSpace,
  postType,
  rules,
  textStyle,
  type Board,
} from "../../theme/post-tokens";
import { Chip, Divider, HelperCounterRow, TextArea } from "./ui";

/**
 * Step 5 — what you want in return.
 *
 * ── THE WHOLE STEP IS OPTIONAL, AND THE COPY HAS TO MEAN IT ─────────────────
 *
 * Next is always enabled, the helper says "You can leave this open if you are
 * not sure yet", and the chip group's own label ends in "— optional". Three
 * separate places saying the same thing is not redundancy: a free-text box
 * under a heading that asks a question reads as required no matter what the
 * Next button does, and someone who does not know what they want will otherwise
 * stall here rather than post.
 *
 * The subheading does the other half of that work — "No need to be strict —
 * people will still offer things you did not think of" — which is a statement
 * about how the marketplace behaves, not a reassurance about the form.
 *
 * ── THE TEXT AREA KEEPS ITS FULL 132 WITH THE KEYBOARD UP ───────────────────
 *
 * The opposite of every other field in the flow. Section 6 drops the
 * subheading and shrinks the heading to 19, and leaves the box alone, because
 * the box IS the step: a three-line answer being typed into a box that has been
 * squeezed to two lines is the one thing that would make this step worse.
 *
 * The chips fall below the fold and that is intended — the accessory button
 * says "Done" rather than "Next" precisely so it dismisses the keyboard and
 * hands them back, rather than advancing past a group the user never saw.
 */

export function StepReturn({
  board,
  keyboardUp,
  areaRef,
  onFieldBlur,
}: {
  board: Board;
  keyboardUp: boolean;
  areaRef: React.RefObject<TextInput | null>;
  onFieldBlur: () => void;
}) {
  const { state, dispatch } = usePost();

  return (
    <View style={{ paddingHorizontal: board.screenX }}>
      <Text
        style={[
          textStyle(postType.stepHeading),
          {
            color: postColor.ink,
            fontSize: keyboardUp ? postType.stepHeadingTight.fontSize : board.stepHeading,
            lineHeight: keyboardUp
              ? postType.stepHeadingTight.lineHeight
              : postType.stepHeading.lineHeight,
          },
        ]}
      >
        What are you hoping to get?
      </Text>

      {keyboardUp ? null : (
        <Text
          style={[
            textStyle(postType.stepSub),
            { color: postColor.inkSecondary, marginTop: postSpace.ret.headingToSub },
          ]}
        >
          Say what you have in mind. No need to be strict — people will still offer things you
          did not think of.
        </Text>
      )}

      <View style={{ height: keyboardUp ? 14 : postSpace.ret.subToArea }} />
      <TextArea
        value={state.wanted}
        placeholder="A bag, shoes, something for the kitchen…"
        onChangeText={(v) => dispatch({ type: "field/wanted", value: v })}
        onBlur={onFieldBlur}
        maxLength={rules.wantedMax}
        inputRef={areaRef}
      />

      <View style={{ height: postSpace.ret.areaToHelper }} />
      <HelperCounterRow
        helper="You can leave this open if you are not sure yet."
        counter={`${state.wanted.length}/${rules.wantedMax}`}
      />

      <Divider style={{ marginTop: postSpace.ret.helperToDivider }} />

      <Text
        style={[
          textStyle(postType.fieldLabel),
          { color: postColor.inkMuted, marginTop: postSpace.ret.dividerToLabel },
        ]}
      >
        CATEGORIES YOU WOULD CONSIDER — OPTIONAL
      </Text>

      <View
        style={{
          marginTop: postSpace.ret.labelToChips,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: postSpace.ret.chipGap,
        }}
      >
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={CATEGORY_LABELS[c]}
            selected={state.returnCategories.includes(c)}
            onPress={() => dispatch({ type: "return/toggle", category: c })}
          />
        ))}
      </View>

      <View style={{ height: 24 }} />
    </View>
  );
}
