import * as Haptics from "expo-haptics";
import { useCallback, useRef, useState } from "react";
import { PanResponder, Text, View } from "react-native";

import { bracketLabel, bracketOf } from "../../lib/brackets";
import { classifyValue, valueCap } from "../../lib/trade-rules";
import { effectiveValue, usePost } from "../../post/state";
import {
  postBorder,
  postColor,
  postIcon,
  postRadius,
  postSize,
  postSpace,
  postType,
  rules,
  sliderThumbShadow,
  textStyle,
  type Board,
} from "../../theme/post-tokens";
import { LeafIcon, PencilIcon, SwapIcon } from "../icons";
import { ClockIcon, InfoIcon } from "./post-icons";
import { Field, HelperRow, NoticePanel, Skeleton, TextButton } from "./ui";

/**
 * Step 4 — what it is worth in Leaves.
 *
 * ── THE SUGGESTION IS THE DEFAULT; "SET MY OWN VALUE" IS THE OTHER ROUTE ────
 *
 * Two ways through this step, and the first is the one almost everybody
 * takes: the suggested value, nudged with the slider inside its ±25 % band,
 * posted as-is. That path is unchanged. The second is the typed field, and it
 * exists because the server stopped refusing values on 16 Sep 2026:
 *
 *   lower than the suggestion       always fine, however far
 *   up to ONE bracket above it      goes live at once
 *   more than that                  saved as asked, but PARKED — the listing
 *                                   shows to nobody else until a person
 *                                   approves the value
 *
 * The rule lives in `classifyValue()` (mirrored from the server) and the step
 * applies it LIVE, under the field, so the third case is something the owner
 * reads before they post rather than discovers from a listing nobody can see.
 * The resulting bracket is printed beside every keystroke for the same
 * reason: the bracket is what trading is judged on, and this is the one place
 * a person can move their own.
 *
 * ── THE SLIDER'S TRACK IS THE QUICK RANGE, NOT A WALL ───────────────────────
 *
 * The ±25 % band used to be the server's rule. It is the slider's range now,
 * and nothing more: a fast way to adjust that never leaves the bracket you
 * would expect. Anything past it is the typed field's job, and the helper line
 * says so.
 *
 * ── AND WHY THE SUGGESTION IS NOT PRESENTED AS AN AI OPINION ────────────────
 *
 * /api/v1/valuation makes no model call. It is arithmetic over settled trades
 * or, failing that, over a category band, and its own header says so at length.
 * The provenance line under the numeral carries that distinction to the user:
 * "Suggested from 6 similar trades" against "Category estimate — no similar
 * trades yet". Both are true statements about where a number came from, and the
 * second is the honest one for a listing in a quiet category.
 */

export function StepValue({ board }: { board: Board }) {
  const { state, dispatch } = usePost();

  // `useValuation()` is NOT called here. It lives at the wizard, because its
  // "already asked about this pair" memo is a ref: remounting this step would
  // clear it and refetch — free on a new listing, and on an EDIT it would spend
  // the listing's one and only re-valuation a second time.
  const valuation = state.valuation;
  const value = effectiveValue(state);
  const locked = state.revaluationSpent;
  const own = state.ownValue;

  if (!valuation || (value === null && !own)) return <ValueSkeleton board={board} />;

  const { allowed, valuationSource, sampleSize, suggestedLeaves } = valuation;

  const provenance =
    valuationSource === "comparables"
      ? sampleSize === 1
        ? "Suggested from 1 similar trade"
        : `Suggested from ${sampleSize} similar trades`
      : "Category estimate — no similar trades yet";

  return (
    <View style={{ paddingHorizontal: board.screenX }}>
      <Text
        style={[
          textStyle(postType.stepHeading),
          { color: postColor.ink, fontSize: board.stepHeading },
        ]}
      >
        What is it worth in Leaves?
      </Text>

      {/* The numeral block. Centred, and the only place in the flow with type
          this large — the number IS the step. */}
      <View
        style={{
          marginTop: postSpace.value.headingToNumeral,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: postSpace.value.leafGap,
        }}
      >
        <LeafIcon
          size={postIcon.leafValue.size}
          stroke={postIcon.leafValue.stroke}
          color={postColor.forest}
        />
        <Text
          style={[
            textStyle(postType.leavesValue),
            {
              // Stays #14140F at full weight even when locked. The slider going
              // flat says "you cannot change this"; greying the numeral would
              // say "this is not the real value", which is false.
              color: postColor.ink,
              fontSize: board.leavesValue,
              letterSpacing: board.leavesTracking,
            },
          ]}
        >
          {value === null ? "—" : value.toLocaleString("en-US")}
        </Text>
      </View>

      <View
        style={{
          marginTop: postSpace.value.numeralToProvenance,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: postSpace.value.provenanceIconGap,
        }}
      >
        <SwapIcon
          size={postIcon.provenance.size}
          stroke={postIcon.provenance.stroke}
          color={postColor.inkMuted}
        />
        <Text style={[textStyle(postType.provenance), { color: postColor.inkSecondary }]}>
          {provenance}
        </Text>
      </View>

      {own ? (
        <OwnValue
          value={value}
          suggested={suggestedLeaves}
          onChange={(leaves) => dispatch({ type: "value/typed", leaves })}
          onUseSuggestion={() => dispatch({ type: "value/suggestion" })}
        />
      ) : (
        <ValueSlider
          min={allowed.min}
          max={allowed.max}
          value={value ?? suggestedLeaves}
          locked={locked}
          onChange={(leaves) => dispatch({ type: "value/set", leaves })}
        />
      )}

      {own ? null : locked ? (
        <>
          <View style={{ marginTop: postSpace.value.bandToPanel }}>
            <NoticePanel
              icon={
                <ClockIcon
                  size={postIcon.clock.size}
                  stroke={postIcon.clock.stroke}
                  color={postColor.inkSecondary}
                />
              }
              heading="You have used your one re-valuation"
              // The spec's copy names a date and a figure. The figure is real —
              // it is the value on screen. The DATE is not returned by
              // /api/v1/valuation's 409, whose meta carries only
              // `revaluationCount` and `maxRevaluations`, so the sentence is
              // written without it rather than with a date this client invented.
              body={`Each listing can be valued again once, and this one already was. The value stays at ${(value ?? suggestedLeaves).toLocaleString(
                "en-US",
              )} Leaves for as long as it is posted.`}
            />
          </View>
          <View style={{ marginTop: postSpace.value.panelToHelper }}>
            <HelperRow gap={postSpace.value.helperIconGap}>
              If the item has changed since you posted it, take the listing down and post it
              again as a new one.
            </HelperRow>
          </View>
        </>
      ) : (
        <>
          <View
            style={{
              marginTop: postSpace.value.bandToDivider,
              height: 1,
              backgroundColor: postColor.divider,
            }}
          />
          <View style={{ marginTop: postSpace.value.dividerToHelper }}>
            <HelperRow gap={postSpace.value.helperIconGap}>
              The slider moves the value 25% either way. After you post, you can ask us to value it
              again once.
            </HelperRow>
          </View>

          {/* The other route. A text control at 44, forest ink, the pencil
              beside it — the same register as every "change this" in the flow. */}
          <View
            style={{
              marginTop: postSpace.value.dividerToHelper,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <PencilIcon size={16} stroke={1.8} color={postColor.forest} />
            <TextButton label="Set my own value" onPress={() => dispatch({ type: "value/own" })} />
          </View>
        </>
      )}

      <View style={{ height: 24 }} />
    </View>
  );
}

/* ─────────────────────────── the typed value ────────────────────────── */

/**
 * "Set my own value". A 56 field on the number pad, the bracket it lands in
 * printed live, and one of four sentences under it — see the header.
 *
 * ── THE FIELD HOLDS TEXT; THE STATE HOLDS A NUMBER ──────────────────────────
 *
 * The input's string is local so a person can clear the field and type a new
 * figure without the numeral above snapping to `1` on the empty keystroke.
 * Digits only reach the store, as whole Leaves, and an empty field is `null`
 * — which is what gates Next, so nothing posts with no number in it.
 *
 * `value` / `Leaves` throughout, never `price`; there is no currency here and
 * the copy does not borrow one.
 */
function OwnValue({
  value,
  suggested,
  onChange,
  onUseSuggestion,
}: {
  value: number | null;
  suggested: number;
  onChange: (leaves: number | null) => void;
  onUseSuggestion: () => void;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const decision = classifyValue(value, suggested);
  const cap = valueCap(suggested);
  const bracket = value === null ? null : bracketOf(value);

  const line =
    value === null
      ? "Type a value in Leaves."
      : decision === "suggested"
        ? `${bracketLabel(bracket as number)} · the suggested value`
        : decision === "lowered"
          ? `${bracketLabel(bracket as number)} · below the suggestion. Lowering is always fine.`
          : decision === "raisedWithinCap"
            ? `${bracketLabel(bracket as number)} · above the suggestion, within one bracket. Goes live right away.`
            : `${bracketLabel(bracket as number)} · more than one bracket above the suggestion.`;

  return (
    <View style={{ marginTop: postSpace.value.provenanceToSlider }}>
      <Field
        label="Your value in Leaves"
        value={text}
        placeholder={String(suggested)}
        keyboardType="number-pad"
        maxLength={7}
        autoFocus
        onChangeText={(t) => {
          const digits = t.replace(/[^0-9]/g, "");
          setText(digits);
          onChange(digits === "" ? null : Number(digits));
        }}
      />

      <Text
        accessibilityLiveRegion="polite"
        style={[
          textStyle(postType.provenance),
          {
            color: decision === "needsReview" ? postColor.ink : postColor.inkSecondary,
            marginTop: 12,
          },
        ]}
      >
        {line}
      </Text>

      <Text style={[textStyle(postType.helper), { color: postColor.inkMuted, marginTop: 6 }]}>
        {`Suggested ${suggested.toLocaleString("en-US")} · ${bracketLabel(cap.suggestedBracket)}. ` +
          `Live without a check up to ${bracketLabel(cap.maxBracketWithoutReview)}` +
          (cap.maxValueWithoutReview !== null
            ? ` (${cap.maxValueWithoutReview.toLocaleString("en-US")} Leaves).`
            : ".")}
      </Text>

      {decision === "needsReview" ? (
        <View style={{ marginTop: postSpace.value.bandToPanel }}>
          <NoticePanel
            icon={<InfoIcon size={postIcon.clock.size} stroke={postIcon.clock.stroke} color={postColor.inkSecondary} />}
            heading="A person checks this value first"
            body={
              `Values more than one bracket above the suggestion are reviewed before they go live. ` +
              `You can still post it now — the listing will show only to you until an admin approves ` +
              `the value, and you will be told either way.`
            }
          />
        </View>
      ) : null}

      <View style={{ marginTop: postSpace.value.dividerToHelper, alignItems: "center" }}>
        <TextButton label="Use the suggestion instead" onPress={onUseSuggestion} />
      </View>
    </View>
  );
}

/* ────────────────────────────── the slider ──────────────────────────── */

function ValueSlider({
  min,
  max,
  value,
  locked,
  onChange,
}: {
  min: number;
  max: number;
  value: number;
  locked: boolean;
  onChange: (leaves: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);

  /**
   * The live geometry, in a ref rather than read from props inside the gesture.
   *
   * `PanResponder.create` runs once and its handlers close over whatever was in
   * scope at that moment. Reading `value` or `onChange` from that closure
   * freezes them at their first-render values, which shows up as a thumb that
   * snaps back to where it started on the second drag. The ref is the standard
   * answer, and it is rewritten on every render immediately below.
   */
  const geometry = useRef({ min, max, value, width: 0, locked });
  const onChangeRef = useRef(onChange);
  /** Where inside the row the finger landed. Everything else is a delta on it. */
  const grantX = useRef(0);
  /** Which end the last haptic fired at, so it fires once per arrival. */
  const lastEnd = useRef<"min" | "max" | null>(null);

  geometry.current = { min, max, value, width: trackWidth, locked };
  onChangeRef.current = onChange;

  const valueFromX = useCallback((x: number) => {
    const g = geometry.current;
    if (g.width <= 0) return g.value;
    const fraction = Math.max(0, Math.min(1, x / g.width));
    const raw = g.min + fraction * (g.max - g.min);
    // Steps of 5, ROUNDED rather than floored, so the thumb sits under the
    // finger instead of always a little behind it.
    const stepped = Math.round(raw / rules.valueStep) * rules.valueStep;
    // The band's own ends win over the step grid. A band of 315–525 is not a
    // multiple of 5 at both ends in the general case, and a thumb that stops
    // three Leaves short of the wall makes the wall look arbitrary.
    return Math.max(g.min, Math.min(g.max, stepped));
  }, []);

  /**
   * The haptic at each end.
   *
   * ONE TICK PER ARRIVAL, not one per frame. Without `lastEnd`, a finger held
   * past the wall fires the motor sixty times a second — an audible buzz on
   * Android, silently throttled on iOS, and on neither does it still mean "you
   * have reached the end".
   */
  const feedback = useCallback((next: number) => {
    const g = geometry.current;
    const end = next <= g.min ? "min" : next >= g.max ? "max" : null;
    if (end && end !== lastEnd.current) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    lastEnd.current = end;
  }, []);

  /**
   * The gesture, in the row's OWN coordinates.
   *
   * `locationX` on the grant is relative to the responder view and `dx` is a
   * delta, so the two together never touch a page coordinate. That matters
   * because this row sits inside a ScrollView inside a shell with a keyboard
   * margin: converting `moveX` back into the track's space would mean measuring
   * the row's window origin and re-measuring it whenever anything above it
   * changed height.
   */
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !geometry.current.locked,
      onMoveShouldSetPanResponder: () => !geometry.current.locked,
      // Hold the gesture against the ScrollView, which would otherwise read a
      // slightly diagonal drag as a scroll and take it away mid-adjustment.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        if (geometry.current.locked) return;
        grantX.current = e.nativeEvent.locationX;
        const next = valueFromX(grantX.current);
        feedback(next);
        onChangeRef.current(next);
      },
      onPanResponderMove: (_e, gesture) => {
        if (geometry.current.locked) return;
        const next = valueFromX(grantX.current + gesture.dx);
        feedback(next);
        onChangeRef.current(next);
      },
      onPanResponderRelease: () => {
        lastEnd.current = null;
      },
      onPanResponderTerminate: () => {
        lastEnd.current = null;
      },
    }),
  ).current;

  const span = Math.max(1, max - min);
  const fraction = Math.max(0, Math.min(1, (value - min) / span));
  const thumbX = fraction * trackWidth - postSize.slider.thumb / 2;

  return (
    <View style={{ marginTop: postSpace.value.provenanceToSlider }}>
      <View
        {...(locked ? {} : responder.panHandlers)}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        style={{ height: postSize.slider.row, justifyContent: "center" }}
        accessibilityRole="adjustable"
        accessibilityValue={{ min, max, now: value }}
        accessibilityLabel="Value in Leaves"
        accessibilityState={{ disabled: locked }}
        // A slider that can only be driven by a drag is a slider a screen
        // reader cannot move. These two actions are the same clamp and the same
        // 5-Leaf step as the gesture, so the two paths cannot disagree.
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => {
          if (locked) return;
          const delta =
            e.nativeEvent.actionName === "increment" ? rules.valueStep : -rules.valueStep;
          onChange(Math.max(min, Math.min(max, value + delta)));
        }}
      >
        <View
          style={{
            height: postSize.slider.track,
            borderRadius: postRadius.sliderTrack,
            backgroundColor: postColor.line,
          }}
        >
          {/* No fill segment at all when locked. A green bar under a dead thumb
              reads as a control that has broken rather than one that is spent. */}
          {locked ? null : (
            <View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: fraction * trackWidth,
                borderRadius: postRadius.sliderTrack,
                backgroundColor: postColor.green,
              }}
            />
          )}
        </View>

        {/* The band markers. They are the wall, made visible before it is hit. */}
        <BandMarker side="left" />
        <BandMarker side="right" />

        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: Math.max(
              -postSize.slider.thumb / 2,
              Math.min(trackWidth - postSize.slider.thumb / 2, thumbX),
            ),
            width: postSize.slider.thumb,
            height: postSize.slider.thumb,
            borderRadius: postRadius.sliderThumb,
            backgroundColor: locked ? postColor.inset : postColor.surface,
            borderWidth: postBorder.sliderThumb,
            borderColor: locked ? postColor.dashed : postColor.green,
            ...(locked ? {} : sliderThumbShadow),
          }}
        />
      </View>

      {/* The band row: min left, label centred, max right. */}
      <View
        style={{
          marginTop: postSpace.value.sliderToBand,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={[
            textStyle(postType.bandValue),
            { color: locked ? postColor.inkDisabled : postColor.inkMuted },
          ]}
        >
          {min.toLocaleString("en-US")}
        </Text>
        <Text
          style={[
            textStyle(postType.bandLabel),
            { color: locked ? postColor.inkDisabled : postColor.inkMuted },
          ]}
        >
          {locked ? "LOCKED" : "±25% band"}
        </Text>
        <Text
          style={[
            textStyle(postType.bandValue),
            { color: locked ? postColor.inkDisabled : postColor.inkMuted },
          ]}
        >
          {max.toLocaleString("en-US")}
        </Text>
      </View>

      {/* Shown only while the thumb is against a wall. The spec forbids a toast
          on hitting the end; this is the alternative — a line that is present
          exactly while the limit is the thing under the user's finger. */}
      {!locked && (value <= min || value >= max) ? (
        <Text style={[textStyle(postType.helper), { color: postColor.inkMuted, marginTop: 8 }]}>
          That is as far as the slider goes — 25% from what we suggested. Set your own value to go further.
        </Text>
      ) : null}
    </View>
  );
}

/** 2 × 12, at the track's ends, centred on the track's own line. */
function BandMarker({ side }: { side: "left" | "right" }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        [side]: 0,
        width: postSize.slider.bandMarkerW,
        height: postSize.slider.bandMarkerH,
        backgroundColor: postColor.dashed,
      }}
    />
  );
}

/* ───────────────────────────── the skeleton ─────────────────────────── */

/**
 * While /api/v1/valuation is out.
 *
 * The blocks are the SHAPE of the answer — a wide numeral, a provenance line, a
 * track, a band row — so the step does not reflow when the number lands. One
 * shimmer driver, in phase, as everywhere else in the flow.
 */
function ValueSkeleton({ board }: { board: Board }) {
  return (
    <View style={{ paddingHorizontal: board.screenX }}>
      <Text
        style={[
          textStyle(postType.stepHeading),
          { color: postColor.ink, fontSize: board.stepHeading },
        ]}
      >
        What is it worth in Leaves?
      </Text>
      <View style={{ alignItems: "center", marginTop: postSpace.value.headingToNumeral }}>
        <Skeleton width={180} height={board.leavesValue} radius={10} />
      </View>
      <View style={{ alignItems: "center", marginTop: postSpace.value.numeralToProvenance }}>
        <Skeleton width={190} height={13} tone="soft" />
      </View>
      <View style={{ marginTop: postSpace.value.provenanceToSlider + 20 }}>
        <Skeleton width="100%" height={postSize.slider.track} radius={postRadius.sliderTrack} />
      </View>
      <View
        style={{
          marginTop: postSpace.value.sliderToBand + 6,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Skeleton width={36} height={12} tone="soft" />
        <Skeleton width={72} height={11} tone="soft" />
        <Skeleton width={36} height={12} tone="soft" />
      </View>
    </View>
  );
}
