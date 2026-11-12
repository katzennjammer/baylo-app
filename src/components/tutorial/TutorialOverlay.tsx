import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";

import { useSession } from "../../auth/session";
import { color, radius, size, textStyle, type } from "../../theme/tokens";
import {
  holeFor,
  isUsable,
  mascotLeft,
  placementFor,
  scrimPath,
  unionRect,
  type Hole,
  type Rect,
} from "../../tutorial/layout";
import { TOUR_STEPS, type MascotPose, type TourStep } from "../../tutorial/steps";
import {
  endTour,
  measureTarget,
  nextTourStep,
  prevTourStep,
  resetTour,
  useTourState,
} from "../../tutorial/store";
import { Tappable } from "../Tappable";

/**
 * The first-time tour, drawn over the tabs.
 *
 * ── A VIEW OVER THE NAVIGATOR, NOT A Modal ──────────────────────────────────
 *
 * Every other overlay in the app is a `Modal`, and this one deliberately is
 * not. The whole job here is to cut a hole exactly around a real control, and
 * the control's position comes from `measureInWindow`. A Modal is its own
 * native window, and on Android whether that window starts under the status
 * bar or below it depends on flags that have changed between releases — so a
 * hole drawn in one would be off by the status bar's height on some phones
 * and not others. A plain view in the same window as the thing it points at
 * has no such gap: this measures its own origin the same way and subtracts.
 *
 * It is mounted in the (app) layout, as a sibling after <Tabs>, so it covers
 * the header and the tab bar and exists only behind the session gate. Root
 * routes pushed over the tabs (the post wizard, settings) cover IT, which is
 * the right way round: the last step's "Post my first item" ends the tour and
 * then pushes the wizard.
 *
 * ── WHAT A STEP DOES WHEN ITS TARGET IS NOT THERE ───────────────────────────
 *
 * Targets are measured fresh at each step. One that is missing, zero-sized or
 * off screen (Home scrolled down before a replay, a header variant without
 * Quests) gets no hole: the step shows as a centred card over a full scrim,
 * and the words still say what to look for. See `isUsable`.
 *
 * ── TOUCHES ─────────────────────────────────────────────────────────────────
 *
 * The scrim swallows every touch, the hole included. Letting the highlighted
 * control through would turn "this is where you post" into the post wizard
 * opening mid-tour. Only the card's buttons do anything. Android's back
 * button is the card's Back — and Skip on the first step, where there is
 * nothing to go back to.
 *
 * ── THE LOOK ────────────────────────────────────────────────────────────────
 *
 * Home's own vocabulary (HomeTopSection): the dark outline, the hard offset
 * shadow and the yellow primary of its "View trades" button, so the tour
 * reads as part of that screen rather than a dialog laid over it.
 */

const POSES: Record<MascotPose, { source: number; ratio: number }> = {
  // ratio = width / height of the cut-out file, so the box never letterboxes.
  wave: { source: require("../../../assets/mascots/Tour_duck_waving.webp"), ratio: 492 / 640 },
  up: { source: require("../../../assets/mascots/Tour_duck_pointing_up.webp"), ratio: 528 / 640 },
  down: { source: require("../../../assets/mascots/Tour_duck_pointing_down.webp"), ratio: 505 / 640 },
  cheer: { source: require("../../../assets/mascots/Tour_duck_cheering.webp"), ratio: 665 / 640 },
};

/** Mascot height beside a hole, and on the two centred cards. */
const MASCOT_BESIDE = 150;
const MASCOT_CENTRED = 200;
/** How far the mascot's feet stand in front of the card's edge. */
const OVERLAP = 10;
const CARD_MARGIN = 24;
const CARD_MAX = 420;
const RING = 3;
/** The hard shadow's offset, down and right, as on Home's action buttons. */
const SHADOW = 4;
/** `color.homeOutline` at 74%: the dim is the brand's dark green, not grey. */
const SCRIM = "rgba(13, 40, 23, 0.74)";

export function TutorialOverlay() {
  const tour = useTourState();

  // The host goes when the session does. A tour left "running" in module
  // state would otherwise resume mid-step for the next person to sign in.
  useEffect(() => resetTour, []);

  if (!tour.active) return null;
  return <ActiveTour index={tour.index} />;
}

function ActiveTour({ index }: { index: number }) {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id ?? null;

  const step = TOUR_STEPS[index] ?? TOUR_STEPS[0];
  const first = index === 0;
  const last = index === TOUR_STEPS.length - 1;

  const root = useRef<View>(null);
  /** This overlay's own box, in the window coordinates the targets answer in. */
  const [frame, setFrame] = useState<Rect | null>(null);
  /** The hole for the step it was measured for. Stale until `index` matches. */
  const [measured, setMeasured] = useState<{ index: number; hole: Hole | null } | null>(null);

  const onLayout = () => {
    root.current?.measureInWindow((x, y, width, height) => setFrame({ x, y, width, height }));
  };

  useEffect(() => {
    if (!frame) return;
    if (step.targets.length === 0) {
      setMeasured({ index, hole: null });
      return;
    }
    let cancelled = false;
    void locate(step, frame).then((hole) => {
      if (!cancelled) setMeasured({ index, hole });
    });
    return () => {
      cancelled = true;
    };
  }, [index, step, frame]);

  // Registered last, so it wins over the tab navigator.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (first) endTour(userId);
      else prevTourStep();
      return true;
    });
    return () => sub.remove();
  }, [userId, first]);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${step.title} ${step.body}`);
  }, [step]);

  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [fade]);

  const bob = useBob();

  const ready = frame !== null && measured !== null && measured.index === index;
  const hole = ready ? measured.hole : null;
  const window = frame ?? { width: 0, height: 0 };
  const centred = step.targets.length === 0;

  const finish = () => endTour(userId);
  const postFirstItem = () => {
    endTour(userId);
    router.push("/post-item");
  };

  return (
    <Animated.View
      ref={root}
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, { opacity: fade }]}
      accessibilityViewIsModal
      importantForAccessibility="yes"
    >
      {/* Swallows every touch that is not one of the card's buttons. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} accessible={false}>
        {frame ? (
          <Svg width={frame.width} height={frame.height}>
            <Path d={scrimPath(frame, hole)} fill={SCRIM} fillRule="evenodd" />
          </Svg>
        ) : null}
      </Pressable>

      {hole ? (
        <View
          pointerEvents="none"
          style={[
            s.ring,
            {
              left: hole.x - RING,
              top: hole.y - RING,
              width: hole.width + RING * 2,
              height: hole.height + RING * 2,
              borderRadius: hole.radius + RING,
            },
          ]}
        />
      ) : null}

      {ready ? (
        <Stage step={step} hole={hole} window={window} bob={bob}>
          {/* Progress on the left, Skip in the corner. The last step has
              nothing left to skip, so its dots sit alone in the middle. */}
          <View style={[s.header, last ? s.headerAlone : null]}>
            <Dots index={index} />
            {last ? null : <TourButton tone="text" label="Skip" onPress={finish} />}
          </View>

          <Text
            style={[textStyle(centred ? type.dDisplay : type.dSheetTitle), s.title, centred ? s.centredText : null]}
            accessibilityRole="header"
          >
            {step.title}
          </Text>
          <Text style={[textStyle(type.emptyBody), s.body, centred ? s.centredText : null]}>{step.body}</Text>

          {last ? (
            <View style={s.stack}>
              <View style={s.lastRow}>
                <TourButton tone="outline" label="Back" icon="back" iconOnly onPress={prevTourStep} />
                <TourButton tone="primary" label="Post my first item" onPress={postFirstItem} grow />
              </View>
              <TourButton tone="outline" label="Start browsing" onPress={finish} />
              <Text style={[textStyle(type.emptyBody), s.footnote]}>
                You can replay this tour anytime from Settings.
              </Text>
            </View>
          ) : first ? (
            <View style={s.stack}>
              <TourButton tone="primary" label="Show me around" icon="forward" onPress={nextTourStep} />
            </View>
          ) : (
            <View style={s.row}>
              <TourButton tone="outline" label="Back" icon="back" onPress={prevTourStep} />
              <TourButton tone="primary" label="Next" icon="forward" onPress={nextTourStep} />
            </View>
          )}
        </Stage>
      ) : null}
    </Animated.View>
  );
}

/** The first usable rect for each of the step's targets, as one hole in `frame`'s space. */
async function locate(step: TourStep, frame: Rect): Promise<Hole | null> {
  const found: Rect[] = [];
  for (const id of step.targets) {
    const rects = await measureTarget(id);
    const local = rects
      .map((r) => ({ ...r, x: r.x - frame.x, y: r.y - frame.y }))
      .find((r) => isUsable(r, frame));
    if (local) found.push(local);
  }
  const box = unionRect(found);
  return box ? holeFor(box, step.shape, frame) : null;
}

/** Six dots, the current one stretched; everything up to it is filled. */
function Dots({ index }: { index: number }) {
  return (
    <View
      style={s.dots}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Step ${index + 1} of ${TOUR_STEPS.length}`}
    >
      {TOUR_STEPS.map((step, i) => (
        <View
          key={step.id}
          style={[s.dot, i <= index ? s.dotDone : null, i === index ? s.dotCurrent : null]}
        />
      ))}
    </View>
  );
}

/** The mascot and the card, arranged around the hole (or centred without one). */
function Stage({
  step,
  hole,
  window,
  bob,
  children,
}: {
  step: TourStep;
  hole: Hole | null;
  window: { width: number; height: number };
  bob: Animated.Value;
  children: React.ReactNode;
}) {
  const place = placementFor(hole, window);
  const pose = POSES[step.pose];
  const cardWidth = Math.min(window.width - CARD_MARGIN * 2, CARD_MAX);

  const mascotHeight = place.mode === "center" ? MASCOT_CENTRED : MASCOT_BESIDE;
  const mascotWidth = Math.round(mascotHeight * pose.ratio);

  // Aimed at the hole when the step has a pointing pose and a hole to point
  // at; a step that lost its target is centred and never gets here.
  let left = 0;
  if (hole && place.mode !== "center") {
    const aim = step.pose === "down" ? "down" : "up";
    // In "above" the mascot is the last thing in a stack pinned `bottom` up
    // from the window's bottom edge, so that is where its feet are.
    const feet = place.mode === "above" ? window.height - place.bottom : 0;
    left = mascotLeft(aim, hole, { width: mascotWidth, height: mascotHeight }, feet, window);
  }

  const mascot = (
    <Animated.View
      // Decoration: the card's own text is what a screen reader should land on.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        s.mascot,
        { width: mascotWidth, height: mascotHeight, transform: [{ translateY: bob }] },
        place.mode === "center" ? { alignSelf: "center", marginBottom: -OVERLAP } : { marginLeft: left },
        place.mode === "below" ? { marginBottom: -OVERLAP } : null,
        place.mode === "above" ? { marginTop: -OVERLAP / 2 } : null,
      ]}
    >
      <Image source={pose.source} style={s.mascotImage} contentFit="contain" />
    </Animated.View>
  );

  const card = (
    <View style={[s.cardSlot, { width: cardWidth }]}>
      <View pointerEvents="none" style={s.cardShadow} />
      <View style={s.card}>{children}</View>
    </View>
  );

  if (place.mode === "center") {
    return (
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, s.centre]}>
        {mascot}
        {card}
      </View>
    );
  }
  if (place.mode === "below") {
    return (
      <View pointerEvents="box-none" style={[s.beside, { top: place.top }]}>
        {mascot}
        {card}
      </View>
    );
  }
  return (
    <View pointerEvents="box-none" style={[s.beside, { bottom: place.bottom }]}>
      {card}
      {mascot}
    </View>
  );
}

function TourButton({
  tone,
  label,
  onPress,
  icon,
  iconOnly = false,
  grow = false,
}: {
  tone: "primary" | "outline" | "text";
  label: string;
  onPress: () => void;
  /** A chevron: before the label for `back`, after it for `forward`. */
  icon?: "back" | "forward";
  /** A round button showing only the chevron; `label` is still what is read out. */
  iconOnly?: boolean;
  /** Takes the row's remaining width. */
  grow?: boolean;
}) {
  const chevron = icon ? (
    <Ionicons
      name={icon === "back" ? "chevron-back" : "chevron-forward"}
      size={18}
      color={color.homeOutline}
    />
  ) : null;

  if (tone === "text") {
    return (
      <Tappable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        pressedStyle={s.pressedText}
        hitSlop={6}
        style={s.textButton}
      >
        <Text style={[textStyle(type.primaryButton), { color: color.forest }]}>{label}</Text>
      </Tappable>
    );
  }

  return (
    <View style={grow ? s.grow : null}>
      {tone === "primary" ? <View pointerEvents="none" style={s.buttonShadow} /> : null}
      <Tappable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        // Primary sinks onto its own shadow; outline has none and just dims.
        pressedStyle={tone === "primary" ? s.pressedPrimary : s.pressedText}
        style={[
          s.button,
          tone === "primary" ? s.buttonPrimary : s.buttonOutline,
          iconOnly ? s.buttonRound : null,
        ]}
      >
        {icon === "back" ? chevron : null}
        {iconOnly ? null : (
          <Text style={[textStyle(type.primaryButton), { color: color.homeOutline }]} numberOfLines={1}>
            {label}
          </Text>
        )}
        {icon === "forward" ? chevron : null}
      </Tappable>
    </View>
  );
}

/**
 * A slow 6 px bob, so the mascot reads as alive rather than pasted on. Off
 * entirely under Reduce Motion — the value simply stays at 0.
 */
function useBob(): Animated.Value {
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (reduced || cancelled) return;
        const leg = (toValue: number) =>
          Animated.timing(bob, {
            toValue,
            duration: 1300,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          });
        loop = Animated.loop(Animated.sequence([leg(-6), leg(0)]));
        loop.start();
      });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [bob]);
  return bob;
}

const BUTTON_HEIGHT = 46;
const CARD_RADIUS = 22;

const s = StyleSheet.create({
  ring: {
    position: "absolute",
    borderWidth: RING,
    borderColor: color.homeYellow,
  },
  centre: { justifyContent: "center", alignItems: "center" },
  beside: { position: "absolute", left: 0, right: 0 },
  mascot: { zIndex: 1 },
  mascotImage: { width: "100%", height: "100%" },

  cardSlot: { alignSelf: "center" },
  cardShadow: {
    position: "absolute",
    top: SHADOW,
    left: SHADOW,
    right: -SHADOW,
    bottom: -SHADOW,
    borderRadius: CARD_RADIUS,
    backgroundColor: color.homeOutline,
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: CARD_RADIUS,
    borderWidth: 2,
    borderColor: color.homeOutline,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 16,
  },

  header: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerAlone: { justifyContent: "center" },
  dots: { flexDirection: "row", alignItems: "center", gap: 6, height: 24 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.dashed },
  dotDone: { backgroundColor: color.accentGreen },
  dotCurrent: { width: 20 },

  title: { color: color.ink, marginTop: 2 },
  body: { color: color.inkSecondary, marginTop: 6 },
  centredText: { textAlign: "center" },
  footnote: { color: color.inkSecondary, textAlign: "center" },

  stack: { marginTop: 16, gap: 12 },
  lastRow: { flexDirection: "row", gap: 8 },
  row: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  grow: { flex: 1 },

  button: {
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_HEIGHT / 2,
    borderWidth: 2,
    borderColor: color.homeOutline,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 20,
  },
  buttonPrimary: { backgroundColor: color.homeYellow },
  buttonOutline: { backgroundColor: color.surface },
  buttonRound: { width: BUTTON_HEIGHT, paddingHorizontal: 0 },
  buttonShadow: {
    position: "absolute",
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: BUTTON_HEIGHT / 2,
    backgroundColor: color.homeOutline,
  },
  textButton: { height: 44, justifyContent: "center", paddingLeft: 12 },
  pressedPrimary: { transform: [{ translateX: 3 }, { translateY: 3 }] },
  pressedText: { opacity: 0.7 },
});
