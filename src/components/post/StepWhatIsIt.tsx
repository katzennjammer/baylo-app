import { Image } from "expo-image";
import { TagIcon } from "phosphor-react-native";
import { Fragment, useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import {
  CATEGORIES,
  CATEGORY_LABELS,
  categoryLabel,
  conditionLabel,
  type Category,
} from "../../api/post";
import { leadPhoto } from "../../post/photos";
import { titleError, unitLabel, usePost } from "../../post/state";
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
  HelperRow,
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
 * The reason is that the user did nothing. "Failed" here means our model could
 * not read a photograph, or /api/ai/identify could not reach it at all (a 503)
 * — which is our problem, and dressing it as the
 * user's mistake would be both wrong and, given how often a dark room causes
 * it, frequent.
 */

export function StepWhatIsIt({
  board,
  keyboardUp,
  titleRef,
  onFieldBlur,
  retryDetection,
  scrollerRef,
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
  /** The wizard's ScrollView, so a perishable field can scroll itself above the IME. */
  scrollerRef: React.RefObject<ScrollView | null>;
}) {
  const { state, dispatch } = usePost();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [brandAdded, setBrandAdded] = useState(false);

  const lead = leadPhoto(state.photos);
  const phase = state.detection.phase;
  const brand = state.detection.original?.brand;
  const brandEvidence = state.detection.original?.brandEvidence;
  const showBrand = Boolean(brand && brandEvidence);
  const titleAlreadyHasBrand = Boolean(
    brand && state.title.toLowerCase().includes(brand.toLowerCase()),
  );
  const titleWithBrand = brand
    ? state.title
      ? `${brand} ${state.title}`
      : brand
    : state.title;
  const brandTitleTooLong = Boolean(
    brand && !titleAlreadyHasBrand && titleWithBrand.length > rules.titleMax,
  );
  const error = titleError(state);

  useEffect(() => {
    setBrandAdded(false);
  }, [brand, brandEvidence]);

  const limit = state.rateLimit?.action === "detect" ? state.rateLimit : null;
  const secondsLeft = useCountdown(limit?.until ?? null, () =>
    dispatch({ type: "rate-limit/clear" }),
  );

  const addBrandToTitle = () => {
    if (brand && !titleAlreadyHasBrand && !brandTitleTooLong) {
      dispatch({ type: "detect/brand-title", value: titleWithBrand });
    }
    setBrandAdded(true);
  };

  const chooseCategory = (category: Category) => {
    setPickerOpen(false);
    if (phase === "failed") dispatch({ type: "field/category", value: category });
    else dispatch({ type: "detect/correct", category, title: state.title });
    requestAnimationFrame(() => titleRef.current?.focus());
  };

  // Only the TOP of the step changes with the keyboard. See the note on the
  // ItemTypeBlock slot below for why the switch stops there.
  const compact = keyboardUp && phase !== "failed";

  return (
    <View style={{ paddingHorizontal: board.screenX }}>
      {compact ? (
        /* ── keyboard up: the whole top of the step collapses into one 44 row ── */
        <Fragment key="compact">
          <SummaryRow
            uri={lead?.localUri ?? null}
            title={state.title}
            category={state.category}
            condition={state.condition}
            onChange={() => setPickerOpen(true)}
          />
          {showBrand && brand && brandEvidence ? (
            <BrandEvidenceRow
              brand={brand}
              evidence={brandEvidence}
              added={brandAdded}
              tooLong={brandTitleTooLong}
              onAdd={addBrandToTitle}
            />
          ) : null}
          <View style={{ height: 20 }} />
        </Fragment>
      ) : (
        /* ── the full step ── */
        <Fragment key="full">
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
              onOpenPicker={() => setPickerOpen(true)}
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

              {showBrand && brand && brandEvidence ? (
                <BrandEvidenceRow
                  brand={brand}
                  evidence={brandEvidence}
                  added={brandAdded}
                  tooLong={brandTitleTooLong}
                  onAdd={addBrandToTitle}
                />
              ) : null}

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
            </>
          )}
        </Fragment>
      )}
      <Text
        style={[
          textStyle(postType.smallTextLabel),
          {
            color: postColor.inkSecondary,
            marginTop: compact || phase === "failed" ? 0 : postSpace.what.dividerToLabel,
            marginBottom: postSpace.what.labelToField,
          },
        ]}
      >
        Give it a title
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
          phase === "failed" && keyboardUp
            ? "Say the brand and size if you know them."
            : "Say the brand and size if you know them. That is what people search for."
        }
        counter={`${state.title.length}/${rules.titleMax}`}
      />
      {phase === "failed" && !keyboardUp ? (
        <>
          <View style={{ height: 22 }} />
          <Text style={[textStyle(postType.helperLong), { color: postColor.inkMuted }]}>
            A photo taken in brighter light usually helps us guess, but you do not have to
            retake it.
          </Text>
        </>
      ) : null}

      {/*
        THE PERISHABLE BLOCK HAS A SLOT OF ITS OWN, outside the switch above,
        and that is the whole of two fixes.

        It used to live inside the detected-photo branch only. So (1) the
        detection-failed form had no Standard/Perishable toggle at all — a
        photo we could not read meant a listing that could not be perishable —
        and (2) it vanished when the keyboard came up, because the compact
        layout is a different tree. Tapping "Quantity" raised the keyboard,
        the keyboard swapped the tree, and the field that was just tapped was
        unmounted with its focus. Adding the block to the compact tree as well
        would not have fixed that: a TextInput in a different position is a
        different TextInput, and React would remount it all the same.

        Here it is one element at one position whatever the phase and
        whatever the keyboard is doing, so it renders in every form and its
        inputs keep their focus across the collapse. The collapse itself is
        untouched — the title's keyboard layout is exactly what it was — and
        now also lifts this block up the screen, which is what makes room for
        the quantity row above the keyboard. `scrollerRef` finishes the job.
      */}
      <ItemTypeBlock keyboardUp={keyboardUp} scrollerRef={scrollerRef} />

      {!compact && limit ? (
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

/* ──────────────────────── standard or perishable ────────────────────── */

/** Space left above the quantity row when it is scrolled clear of the keyboard. */
const REVEAL_GAP = 16;

/** ScrollView as it is at runtime; see the measure in ItemTypeBlock. */
type ScrollViewWithInnerRef = ScrollView & { getInnerViewRef(): View | null };

/**
 * The item-type toggle, and the three fields that only a perishable has.
 *
 * ── WHY IT IS ON THIS STEP AND NOT A STEP OF ITS OWN ────────────────────────
 *
 * The wizard is seven steps and a tick rail that counts them. An eighth for one
 * binary would lengthen every listing anybody posts — and the overwhelming
 * majority are standard — to ask a question most people answer by walking past
 * it. It sits under the title because that is where the listing stops being a
 * photo and starts being a description of a thing, and because a perishable's
 * quantity reads as part of what the thing IS.
 *
 * ── THE COPY HAS TO SELL THE TRADE HONESTLY ────────────────────────────────
 *
 * Perishable is not the better option and the step must not imply it is. What
 * it buys is going live immediately instead of possibly waiting for a value
 * review; what it costs is a ceiling — a value more than one bracket above the
 * suggestion is lowered to the cap rather than parked. Saying only the first
 * half would make this the obvious choice for everyone, and the listings that
 * followed would be wrong about their own shelf life.
 *
 * ── AND THE WINDOW IS NOT A DEADLINE FOR THE POSTER ─────────────────────────
 *
 * "Trade within" reads as a promise the poster is making, which it is not: it
 * is when the listing stops being shown. Nobody is penalised for a perishable
 * that expires unsold. The helper says that, because the alternative is people
 * choosing 24 out of caution on a thing that is still suitable for six hours.
 */
function ItemTypeBlock({
  keyboardUp,
  scrollerRef,
}: {
  keyboardUp: boolean;
  scrollerRef: React.RefObject<ScrollView | null>;
}) {
  const { state, dispatch } = usePost();
  const quantityRow = useRef<View>(null);
  const [quantityFocused, setQuantityFocused] = useState(false);

  // Bring the quantity row above the keyboard once it is up.
  //
  // Nothing else does this reliably. The focus lands BEFORE the keyboard's
  // height reaches the host's margin, so at the moment of focus the field is
  // still "visible" and the ScrollView has no reason to move; a frame later
  // the viewport shrinks and the keyboard is sitting on it. So this waits for
  // `keyboardUp` — the render in which the collapse and the margin have both
  // been committed — and a frame for their layout, then measures the row
  // against the scroller's content and puts it just under the top edge. The
  // unit chips are in the same row, so they come with it.
  //
  // getInnerViewREF, not getInnerViewNode. The Node variant is a numeric
  // handle, and on the new architecture measureLayout accepts only a host
  // element: given a number it logs "must be called with a ref to a native
  // component" and RETURNS without measuring, so the scroll never happened.
  useEffect(() => {
    if (!keyboardUp || !quantityFocused) return;
    const frame = requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      // Cast: RN 0.86 implements getInnerViewRef (ScrollView.js) but its
      // ScrollView.d.ts still declares only getInnerViewNode.
      const content = (scroller as ScrollViewWithInnerRef | null)?.getInnerViewRef();
      if (!scroller || !content || !quantityRow.current) return;
      quantityRow.current.measureLayout(content, (_x, y) => {
        scroller.scrollTo({ y: Math.max(0, y - REVEAL_GAP), animated: true });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [keyboardUp, quantityFocused, scrollerRef]);

  return (
    <View style={{ marginTop: postSpace.what.confirmToDivider }}>
      <Divider />

      <Text
        style={[
          textStyle(postType.smallTextLabel),
          {
            color: postColor.inkSecondary,
            marginTop: postSpace.what.dividerToLabel,
            marginBottom: postSpace.what.labelToField,
          },
        ]}
      >
        What kind of item
      </Text>

      <View style={{ flexDirection: "row", gap: postSpace.what.confirmGap }}>
        <ConfirmButton
          label="Standard item"
          tone={state.isPerishable ? "outline" : "confirm"}
          style={{ flex: 1 }}
          onPress={() => dispatch({ type: "item-type/set", perishable: false })}
        />
        <ConfirmButton
          label="Perishable"
          tone={state.isPerishable ? "confirm" : "outline"}
          style={{ flex: 1 }}
          onPress={() => dispatch({ type: "item-type/set", perishable: true })}
        />
      </View>

      <View style={{ height: postSpace.what.fieldToHelper }} />
      <HelperRow>
        {state.isPerishable
          ? "Food, flowers, produce — anything with a shelf life. It goes live straight away instead of waiting for a value check, but its value is capped a little lower in exchange."
          : "Most things. If it keeps, leave it here."}
      </HelperRow>

      {state.isPerishable ? (
        <View style={{ marginTop: postSpace.what.dividerToLabel, gap: 18 }}>
          {state.perishablePrefilled ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: postRadius.field,
                backgroundColor: postColor.greenWash,
                borderWidth: 1,
                borderColor: postColor.greenLine,
              }}
            >
              <CheckIcon size={14} stroke={postIcon.check.stroke} color={postColor.forest} />
              <Text style={[textStyle(postType.smallTextLabel), { color: postColor.onGreen, flex: 1 }]}>
                Filled in from your photo. Check the amount before you post.
              </Text>
            </View>
          ) : null}

          <View ref={quantityRow}>
            <Text style={[textStyle(postType.smallTextLabel), perishableLabel]}>How much</Text>
            <QuantityStepper
              value={state.quantity}
              unit={state.quantityUnit}
              onChange={(v) => dispatch({ type: "field/quantity", value: v })}
              onFocus={() => setQuantityFocused(true)}
              onBlur={() => setQuantityFocused(false)}
            />
            <View style={{ height: 8 }} />
            <Segmented
              options={[
                { value: "PCS", label: "Pieces" },
                { value: "KG", label: "Kilos" },
                { value: "LITERS", label: "Liters" },
              ]}
              selected={state.quantityUnit}
              onSelect={(u) => dispatch({ type: "field/quantity-unit", value: u })}
            />
            <View style={{ height: postSpace.what.fieldToHelper }} />
            <HelperRow>Optional. Leave it empty for a basket, a bundle or a tray.</HelperRow>
          </View>

          <View>
            <Text style={[textStyle(postType.smallTextLabel), perishableLabel]}>Trade within</Text>
            <Segmented
              options={[
                { value: 6, label: "6 hours" },
                { value: 24, label: "24 hours" },
              ]}
              selected={state.tradeWithinHours}
              onSelect={(h) => dispatch({ type: "field/trade-within", value: h })}
            />
            <View style={{ height: postSpace.what.fieldToHelper }} />
            <HelperRow>The listing is hidden after this. Nothing happens to you if it expires unsold.</HelperRow>
          </View>
        </View>
      ) : null}

      {keyboardUp ? <View style={{ height: 12 }} /> : null}
    </View>
  );
}

const perishableLabel = {
  color: postColor.inkSecondary,
  marginBottom: postSpace.what.labelToField,
};

/** Step size for the stepper: whole pieces, half kilos and half liters. */
function stepFor(unit: "KG" | "PCS" | "LITERS"): number {
  return unit === "PCS" ? 1 : 0.5;
}

/**
 * A number with a minus and a plus beside it. Empty means "no number", which
 * is allowed, so the field shows "Any" rather than a made-up example value.
 * Minus from the smallest step clears it back to empty.
 */
function QuantityStepper({
  value,
  unit,
  onChange,
  onFocus,
  onBlur,
}: {
  value: string;
  unit: "KG" | "PCS" | "LITERS";
  onChange: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const step = stepFor(unit);
  const n = Number.parseFloat(value);
  const current = Number.isFinite(n) ? n : 0;
  const fmt = (x: number) => String(Math.round(x * 100) / 100);
  const minus = () => {
    const next = current - step;
    onChange(next <= 0 ? "" : fmt(next));
  };
  const plus = () => onChange(fmt(current + step));

  const button = (label: string, onPress: () => void, disabled: boolean, a11y: string) => (
    <Tappable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={{
        width: 52,
        alignSelf: "stretch",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.35 : 1,
      }}
      pressedStyle={{ backgroundColor: postColor.inset }}
    >
      <Text style={{ fontSize: 22, lineHeight: 24, color: postColor.ink }}>{label}</Text>
    </Tappable>
  );

  return (
    <View
      style={{
        height: 52,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: postRadius.field,
        borderWidth: focused ? 2 : 1,
        borderColor: focused ? postColor.green : postColor.line,
        backgroundColor: postColor.surface,
        overflow: "hidden",
      }}
    >
      {button("−", minus, current <= 0, "Less")}
      <View style={{ width: 1, alignSelf: "stretch", backgroundColor: postColor.divider }} />
      <View style={{ flex: 1, flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 6 }}>
        <TextInput
          value={value}
          onChangeText={(v) => onChange(v.replace(",", ".").replace(/[^0-9.]/g, ""))}
          onFocus={() => {
            setFocused(true);
            onFocus();
          }}
          onBlur={() => {
            setFocused(false);
            onBlur();
          }}
          placeholder="Any"
          placeholderTextColor={postColor.inkMuted}
          keyboardType="decimal-pad"
          accessibilityLabel="Quantity"
          style={[
            textStyle(postType.fieldValue),
            { width: value ? Math.max(24, value.length * 11 + 6) : 60, textAlign: "center", color: postColor.ink, fontSize: 18, padding: 0 },
          ]}
        />
        {value ? (
          <Text style={[textStyle(postType.smallTextLabel), { color: postColor.inkSecondary }]}>
            {unitLabel(unit)}
          </Text>
        ) : null}
      </View>
      <View style={{ width: 1, alignSelf: "stretch", backgroundColor: postColor.divider }} />
      {button("+", plus, false, "More")}
    </View>
  );
}

/** One row of options in an inset track; the chosen one sits raised on top. */
function Segmented<T extends string | number>({
  options,
  selected,
  onSelect,
}: {
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (v: T) => void;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      style={{
        flexDirection: "row",
        padding: 3,
        borderRadius: postRadius.field,
        backgroundColor: postColor.inset,
      }}
    >
      {options.map((o) => {
        const on = o.value === selected;
        return (
          <Tappable
            key={String(o.value)}
            onPress={() => onSelect(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            style={{
              flex: 1,
              height: 40,
              borderRadius: postRadius.field - 3,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: on ? postColor.surface : "transparent",
              borderWidth: on ? 1 : 0,
              borderColor: postColor.line,
            }}
          >
            <Text
              style={[
                textStyle(postType.smallTextLabel),
                { color: on ? postColor.ink : postColor.inkSecondary },
              ]}
            >
              {o.label}
            </Text>
          </Tappable>
        );
      })}
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
        <Text style={[textStyle(postType.tag), { color: postColor.inkMuted }]}>
          {category ? categoryLabel(category) : "—"}
        </Text>
        <View
          style={{
            width: postSpace.what.eyebrowDot,
            height: postSpace.what.eyebrowDot,
            borderRadius: postSpace.what.eyebrowDot / 2,
            backgroundColor: postColor.dashed,
          }}
        />
        <Text style={[textStyle(postType.tag), { color: postColor.inkMuted }]}>
          {conditionLabel(condition as never)}
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
          <Text style={[textStyle(postType.conditionDesc), { color: postColor.inkMuted, flex: 1 }]}>
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
  onOpenPicker,
}: {
  onOpenPicker: () => void;
}) {
  const { state } = usePost();

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
    </View>
  );
}

function BrandEvidenceRow({
  brand,
  evidence,
  added,
  tooLong,
  onAdd,
}: {
  brand: string;
  evidence: string;
  added: boolean;
  tooLong: boolean;
  onAdd: () => void;
}) {
  return (
    <View
      style={{
        marginTop: postSpace.what.resultToEyebrow,
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: postSpace.what.eyebrowGap,
      }}
    >
      <TagIcon size={16} color={postColor.inkMuted} />
      <View style={{ flex: 1 }}>
        <Text style={[textStyle(postType.tag), { color: postColor.inkSecondary }]}>
          Brand seen: {brand}
        </Text>
        <Text style={[textStyle(postType.helper), { color: postColor.inkMuted }]}>
          {evidence}
        </Text>
      </View>
      {added ? (
        <Text
          style={[textStyle(postType.smallTextLabel), { color: postColor.inkMuted }]}
          accessibilityLabel={`Brand ${brand} added to title`}
        >
          Added
        </Text>
      ) : (
        <>
          <Tappable
            onPress={tooLong ? undefined : onAdd}
            disabled={tooLong}
            accessibilityRole="button"
            accessibilityState={{ disabled: tooLong }}
            accessibilityLabel={`Add ${brand} to title`}
            style={{ minHeight: postSize.button.smallText, justifyContent: "center" }}
          >
            <Text
              style={[
                textStyle(postType.smallTextLabel),
                { color: tooLong ? postColor.inkDisabled : postColor.forest },
              ]}
            >
              Add to title
            </Text>
          </Tappable>
          {tooLong ? (
            <Text
              style={[textStyle(postType.helper), { color: postColor.inkMuted, flexBasis: "100%" }]}
              accessibilityLabel="Title is too long to add the brand."
            >
              Title is too long to add the brand.
            </Text>
          ) : null}
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
 * nineteen options is more than a chip group can carry and exactly what a list
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
