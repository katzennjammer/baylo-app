import { Image } from "expo-image";
import { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import {
  CATEGORIES,
  CATEGORY_LABELS,
  categoryLabel,
  conditionLabel,
  type Category,
} from "../../api/post";
import { leadPhoto } from "../../post/photos";
import { titleError, usePost } from "../../post/state";
import {
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
import { CheckIcon } from "../icons";
import { Tappable } from "../Tappable";
import {
  ConfirmButton,
  Divider,
  Field,
  HelperCounterRow,
  OutlineButton,
  PickerField,
  RateLimitPanel,
  Skeleton,
  SmallTextButton,
  useCountdown,
} from "./ui";

/**
 * Step 2 — what is it.
 *
 * Four states, one step: detecting, detected, corrected, and failed. The first
 * three share a shape — a 96 reference tile with a result column beside it —
 * and the fourth replaces that column with an ordinary two-field form.
 *
 * ── THE FAILED STATE IS NOT AN ERROR STATE ──────────────────────────────────
 *
 * Nothing in it says sorry, error or failed. It carries no icon, no warm
 * colour, no rule and no container. The heading changes from "What are you
 * trading?" to "Tell us what it is" and a category picker appears where the
 * confirm row was. That is the entire difference.
 *
 * The reason is that the user did nothing. /api/ai/identify answers 200 with
 * empty fields when its vision call throws, so "failed" here means our model
 * could not read a photograph — which is our problem, and dressing it as the
 * user's mistake would be both wrong and, given how often a dark room causes
 * it, frequent.
 */

export function StepWhatIsIt({
  board,
  keyboardUp,
  titleRef,
  onFieldBlur,
  retryDetection,
}: {
  board: Board;
  keyboardUp: boolean;
  titleRef: React.RefObject<TextInput | null>;
  onFieldBlur: () => void;
  /**
   * Passed in rather than taken from `useDetection()` here.
   *
   * The detection effect lives at the wizard, not on this step — see the note
   * there. A hook mounted on the step would have its cleanup run the moment
   * somebody pressed Next mid-detection, which marks the request settled,
   * leaves the phase on "detecting" forever, and cannot restart because the
   * memo already recorded that this photo had been asked about.
   */
  retryDetection: () => void;
}) {
  const { state, dispatch } = usePost();
  const [pickerOpen, setPickerOpen] = useState(false);

  const lead = leadPhoto(state.photos);
  const phase = state.detection.phase;
  const error = titleError(state);

  const limit = state.rateLimit?.action === "detect" ? state.rateLimit : null;
  const secondsLeft = useCountdown(limit?.until ?? null, () =>
    dispatch({ type: "rate-limit/clear" }),
  );

  const chooseCategory = (category: Category) => {
    setPickerOpen(false);
    if (phase === "failed") dispatch({ type: "field/category", value: category });
    else dispatch({ type: "detect/correct", category, title: state.title });
  };

  /* ── keyboard up: the whole top of the step collapses into one 44 row ── */

  if (keyboardUp && phase !== "failed") {
    return (
      <View style={{ paddingHorizontal: board.screenX }}>
        <SummaryRow
          uri={lead?.localUri ?? null}
          title={state.title}
          category={state.category}
          condition={state.condition}
          onChange={() => setPickerOpen(true)}
        />
        <View style={{ height: 20 }} />
        <Text
          style={[
            textStyle(postType.fieldLabel),
            { color: postColor.inkMuted, marginBottom: postSpace.what.labelToField },
          ]}
        >
          GIVE IT A TITLE
        </Text>
        <Field
          label="Give it a title"
          value={state.title}
          placeholder="What is it? Brand and size help"
          onChangeText={(v) => dispatch({ type: "field/title", value: v })}
          onBlur={onFieldBlur}
          error={error}
          maxLength={rules.titleMax}
          inputRef={titleRef}
        />
        <View style={{ height: postSpace.what.fieldToHelper }} />
        <HelperCounterRow
          helper="Say the brand and size if you know them."
          counter={`${state.title.length}/${rules.titleMax}`}
        />
        <CategoryPicker
          open={pickerOpen}
          selected={state.category}
          onSelect={chooseCategory}
          onClose={() => setPickerOpen(false)}
        />
      </View>
    );
  }

  /* ── the full step ── */

  return (
    <View style={{ paddingHorizontal: board.screenX }}>
      <Text
        style={[
          textStyle(postType.stepHeading),
          {
            color: postColor.ink,
            // Detection failed keeps a heading rather than losing one; with the
            // IME up it drops to 19 so BOTH fields stay visible. Section 6's
            // budget for that layout is 301 of 442.
            fontSize: keyboardUp ? postType.stepHeadingTight.fontSize : board.stepHeading,
            lineHeight: keyboardUp
              ? postType.stepHeadingTight.lineHeight
              : postType.stepHeading.lineHeight,
          },
        ]}
      >
        {phase === "failed" ? "Tell us what it is" : "What are you trading?"}
      </Text>

      {limit ? (
        <View style={{ marginTop: 16 }}>
          <RateLimitPanel
            seconds={secondsLeft}
            body="You have tried this a few times in a row. Wait a little and try again — nothing you filled in was lost."
          />
        </View>
      ) : null}

      {phase === "failed" ? (
        <FailedForm
          keyboardUp={keyboardUp}
          onOpenPicker={() => setPickerOpen(true)}
          titleRef={titleRef}
          onFieldBlur={onFieldBlur}
        />
      ) : (
        <>
          <View
            style={{
              marginTop: postSpace.what.headingToRef,
              flexDirection: "row",
              gap: postSpace.what.refGap,
            }}
          >
            <ReferenceTile uri={lead?.localUri ?? null} size={board.refTile} />
            <View style={{ flex: 1, justifyContent: "center" }}>
              {phase === "detecting" ? (
                <DetectingColumn slow={state.detection.slow} />
              ) : (
                <ResultColumn
                  framing={
                    phase === "corrected"
                      ? "You changed this to"
                      : "We looked at your photo and think this is a"
                  }
                  result={state.title || "—"}
                  category={state.category}
                  condition={state.condition}
                  board={board}
                />
              )}
            </View>
          </View>

          {phase === "detecting" ? (
            <View
              style={{
                marginTop: postSpace.what.refToConfirm,
                flexDirection: "row",
                gap: postSpace.what.confirmGap,
              }}
            >
              <Skeleton width="48%" height={postSize.button.confirm} radius={postRadius.confirmButton} />
              <Skeleton
                width="48%"
                height={postSize.button.confirm}
                radius={postRadius.confirmButton}
                tone="soft"
              />
            </View>
          ) : phase === "corrected" ? (
            <CorrectionBlock onChangeAgain={() => setPickerOpen(true)} />
          ) : (
            <View
              style={{
                marginTop: postSpace.what.refToConfirm,
                flexDirection: "row",
                gap: postSpace.what.confirmGap,
              }}
            >
              <ConfirmButton
                label="That's right"
                tone="confirm"
                style={{ flex: 1 }}
                icon={
                  <CheckIcon
                    size={postSize.chip.check}
                    stroke={postIcon.checkSmall.stroke}
                    color={postColor.forest}
                  />
                }
                // Confirming is not a state change — the values are already in
                // the form. It dismisses the question by moving on, which is
                // what the footer's Next does, so this is the same action with
                // the answer's own words on it.
                onPress={() => dispatch({ type: "next" })}
              />
              <ConfirmButton
                label="Change it"
                tone="outline"
                style={{ flex: 1 }}
                onPress={() => setPickerOpen(true)}
              />
            </View>
          )}

          <Divider style={{ marginTop: postSpace.what.confirmToDivider }} />

          <Text
            style={[
              textStyle(postType.fieldLabel),
              {
                color: postColor.inkMuted,
                marginTop: postSpace.what.dividerToLabel,
                marginBottom: postSpace.what.labelToField,
              },
            ]}
          >
            GIVE IT A TITLE
          </Text>
          <Field
            label="Give it a title"
            value={state.title}
            placeholder="What is it? Brand and size help"
            onChangeText={(v) => dispatch({ type: "field/title", value: v })}
            onBlur={onFieldBlur}
            error={error}
            maxLength={rules.titleMax}
            inputRef={titleRef}
          />
          <View style={{ height: postSpace.what.fieldToHelper }} />
          <HelperCounterRow
            helper="Say the brand and size if you know them. That is what people search for."
            counter={`${state.title.length}/${rules.titleMax}`}
          />
        </>
      )}

      {limit ? (
        <View style={{ marginTop: 18 }}>
          <OutlineButton
            label="Try detecting again"
            onPress={retryDetection}
            disabled={secondsLeft > 0}
          />
        </View>
      ) : null}

      <View style={{ height: 24 }} />

      <CategoryPicker
        open={pickerOpen}
        selected={state.category}
        onSelect={chooseCategory}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

/* ─────────────────────── the reference tile ─────────────────────────── */

function ReferenceTile({ uri, size }: { uri: string | null; size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: postRadius.refTile,
        overflow: "hidden",
        backgroundColor: postColor.inset,
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
      ) : null}
    </View>
  );
}

/* ────────────────────────── the three columns ───────────────────────── */

/**
 * Detecting: three shimmer blocks — a 22 at 70 %, then two 11s at 64 and 58.
 *
 * They are the SHAPE of the result that is coming, not generic bars: one long
 * line where the item name will be and two short ones where the category and
 * condition eyebrows will be. A skeleton that does not predict its content is
 * just a loading animation with extra steps.
 */
function DetectingColumn({ slow }: { slow: boolean }) {
  return (
    <View>
      <Text style={[textStyle(postType.detectLine), { color: postColor.inkSecondary }]}>
        {slow ? "Still looking. Your connection may be slow." : "Having a look at your photo…"}
      </Text>
      <Skeleton
        width="70%"
        height={postType.detectResult.fontSize}
        style={{ marginTop: postSpace.what.frameToResult }}
      />
      <View
        style={{
          flexDirection: "row",
          gap: postSpace.what.eyebrowGap,
          marginTop: postSpace.what.resultToEyebrow,
        }}
      >
        <Skeleton width={64} height={11} tone="soft" />
        <Skeleton width={58} height={11} tone="soft" />
      </View>
    </View>
  );
}

function ResultColumn({
  framing,
  result,
  category,
  condition,
  board,
}: {
  framing: string;
  result: string;
  category: Category | null;
  condition: string;
  board: Board;
}) {
  return (
    <View>
      <Text style={[textStyle(postType.detectLine), { color: postColor.inkSecondary }]}>
        {framing}
      </Text>
      <Text
        style={[
          textStyle(postType.detectResult),
          {
            color: postColor.ink,
            marginTop: postSpace.what.frameToResult,
            fontSize: board.detectResult,
          },
        ]}
      >
        {result}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: postSpace.what.eyebrowGap,
          marginTop: postSpace.what.resultToEyebrow,
        }}
      >
        <Text style={[textStyle(postType.eyebrow), { color: postColor.inkMuted }]}>
          {(category ? categoryLabel(category) : "—").toUpperCase()}
        </Text>
        <View
          style={{
            width: postSpace.what.eyebrowDot,
            height: postSpace.what.eyebrowDot,
            borderRadius: postSpace.what.eyebrowDot / 2,
            backgroundColor: postColor.dashed,
          }}
        />
        <Text style={[textStyle(postType.eyebrow), { color: postColor.inkMuted }]}>
          {conditionLabel(condition as never).toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

/**
 * The corrected state's record of what the model had said.
 *
 * The struck line is not an apology, it is an UNDO affordance: it is the only
 * thing on the screen that still knows the original guess, and without it a
 * mis-tap on "Change it" is unrecoverable except by leaving the step.
 */
function CorrectionBlock({ onChangeAgain }: { onChangeAgain: () => void }) {
  const { state, dispatch } = usePost();
  const original = state.detection.original;

  return (
    <View style={{ marginTop: postSpace.what.resultToStrip }}>
      {original ? (
        <View
          style={{
            backgroundColor: postColor.inset,
            borderRadius: postRadius.correctionStrip,
            paddingVertical: postSpace.what.stripY,
            paddingHorizontal: postSpace.what.stripX,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Text style={[textStyle(postType.struck), { color: postColor.inkMuted, flex: 1 }]}>
            {`We thought: ${original.name.toLowerCase()}, ${conditionLabel(
              original.condition,
            ).toLowerCase()}`}
          </Text>
          <SmallTextButton label="Undo" onPress={() => dispatch({ type: "detect/undo" })} />
        </View>
      ) : null}
      <ConfirmButton
        label="Change it again"
        tone="outline"
        onPress={onChangeAgain}
        style={{ marginTop: postSpace.what.stripToChangeAgain }}
      />
    </View>
  );
}

/* ───────────────────── the detection-failed form ────────────────────── */

function FailedForm({
  keyboardUp,
  onOpenPicker,
  titleRef,
  onFieldBlur,
}: {
  keyboardUp: boolean;
  onOpenPicker: () => void;
  titleRef: React.RefObject<TextInput | null>;
  onFieldBlur: () => void;
}) {
  const { state, dispatch } = usePost();
  const error = titleError(state);

  return (
    <View>
      <Text
        style={[
          textStyle(postType.stepSub),
          { color: postColor.inkSecondary, marginTop: postSpace.condition.headingToNote },
        ]}
      >
        We could not make out this photo well enough to guess. Fill it in yourself — it takes a
        moment.
      </Text>

      <View style={{ height: postSpace.what.headingToRef }} />
      <PickerField
        label="Category"
        value={state.category ? CATEGORY_LABELS[state.category] : null}
        placeholder="Choose a category"
        onPress={onOpenPicker}
        // Only once the user has started answering. An error on an untouched
        // field is a form telling somebody off for arriving.
        error={
          !state.category && state.title.trim().length > 0
            ? "Choose a category so people can find this."
            : null
        }
      />

      <View style={{ height: postSpace.what.fieldToLabel }} />
      <Text
        style={[
          textStyle(postType.fieldLabel),
          { color: postColor.inkMuted, marginBottom: postSpace.what.labelToField },
        ]}
      >
        GIVE IT A TITLE
      </Text>
      <Field
        label="Give it a title"
        value={state.title}
        placeholder="What is it? Brand and size help"
        onChangeText={(v) => dispatch({ type: "field/title", value: v })}
        onBlur={onFieldBlur}
        error={error}
        maxLength={rules.titleMax}
        inputRef={titleRef}
      />
      <View style={{ height: postSpace.what.fieldToHelper }} />
      <HelperCounterRow
        helper={
          keyboardUp
            ? "Say the brand and size if you know them."
            : "Say the brand and size if you know them. That is what people search for."
        }
        counter={`${state.title.length}/${rules.titleMax}`}
      />

      {keyboardUp ? null : (
        <>
          <View style={{ height: 22 }} />
          <Text style={[textStyle(postType.helperLong), { color: postColor.inkMuted }]}>
            A photo taken in brighter light usually helps us guess, but you do not have to
            retake it.
          </Text>
        </>
      )}
    </View>
  );
}

/* ─────────────────────── the keyboard summary row ───────────────────── */

/**
 * The 44 row that replaces 213 px of step when the keyboard is up.
 *
 * Out go the 26 heading, the 96 reference tile, the framing line, the 22
 * result, the confirm row and the divider — everything that answers a question
 * the user has stopped asking, because they are typing a title. What survives
 * is the ANSWER, on one line, with a Change beside it.
 */
function SummaryRow({
  uri,
  title,
  category,
  condition,
  onChange,
}: {
  uri: string | null;
  title: string;
  category: Category | null;
  condition: string;
  onChange: () => void;
}) {
  const summary = [
    title || "Untitled",
    category ? CATEGORY_LABELS[category] : null,
    conditionLabel(condition as never),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View
      style={{
        height: 44,
        borderRadius: postRadius.confirmButton,
        backgroundColor: postColor.inset,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          overflow: "hidden",
          backgroundColor: postColor.line,
        }}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : null}
      </View>
      <Text
        style={[textStyle(postType.fieldValue), { color: postColor.ink, flex: 1 }]}
        numberOfLines={1}
      >
        {summary}
      </Text>
      <SmallTextButton label="Change" onPress={onChange} style={{ minHeight: 44 }} />
    </View>
  );
}

/* ────────────────────────── the category picker ─────────────────────── */

/**
 * A native modal, deliberately.
 *
 * Section 6 says the date and category pickers do not reposition anything, and
 * the reason a sheet works here is that the choice is exclusive and long:
 * twenty options is more than a chip group can carry and exactly what a list
 * is for. It closes on selection — a Done button on a single-select list is a
 * second tap for no decision.
 */
function CategoryPicker({
  open,
  selected,
  onSelect,
  onClose,
}: {
  open: boolean;
  selected: Category | null;
  onSelect: (c: Category) => void;
  onClose: () => void;
}) {
  const scroller = useRef<ScrollView>(null);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
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
            paddingTop: postSpace.draft.top,
            paddingBottom: postSpace.draft.bottom,
            maxHeight: "78%",
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
          <Text
            style={[
              textStyle(postType.draftHeading),
              { color: postColor.ink, paddingHorizontal: postSpace.draft.x },
            ]}
          >
            Choose a category
          </Text>
          <ScrollView ref={scroller} style={{ marginTop: 12 }}>
            {CATEGORIES.map((c) => {
              const isSelected = c === selected;
              return (
                <Tappable
                  key={c}
                  onPress={() => onSelect(c)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  style={{
                    minHeight: 52,
                    paddingHorizontal: postSpace.draft.x,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: isSelected ? postColor.greenWash : "transparent",
                  }}
                  pressedStyle={{ backgroundColor: postColor.inset }}
                >
                  <Text
                    style={[
                      textStyle(isSelected ? postType.conditionName : postType.outlineLabel),
                      { color: isSelected ? postColor.forest : postColor.ink },
                    ]}
                  >
                    {CATEGORY_LABELS[c]}
                  </Text>
                  {isSelected ? (
                    <CheckIcon
                      size={postIcon.check.size}
                      stroke={postIcon.check.stroke}
                      color={postColor.forest}
                    />
                  ) : null}
                </Tappable>
              );
            })}
            <View style={{ height: 8 }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
