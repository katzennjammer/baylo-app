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
 * opening mid-tour. Only the card's buttons do anything, and Android's back
 * button is Skip.
 */

const POSES: Record<MascotPose, { source: number; ratio: number }> = {
  // ratio = width / height of the cut-out file, so the box never letterboxes.
  wave: { source: require("../../../assets/mascots/Tour_duck_waving.webp"), ratio: 492 / 640 },
  point: { source: require("../../../assets/mascots/Tour_duck_pointing.webp"), ratio: 561 / 640 },
  cheer: { source: require("../../../assets/mascots/Tour_duck_cheering.webp"), ratio: 665 / 640 },
};

/** Mascot height beside a hole, and on the two centred cards. */
const MASCOT_BESIDE = 150;
const MASCOT_CENTRED = 200;
/** How far the mascot's feet stand in front of the card's edge. */
const OVERLAP = 12;
const CARD_MARGIN = 24;
const CARD_MAX = 420;
const RING = 3;

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

  // Android back is Skip. Registered last, so it wins over the tab navigator.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      endTour(userId);
      return true;
    });
    return () => sub.remove();
  }, [userId]);

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
            <Path d={scrimPath(frame, hole)} fill={color.captionFill} fillRule="evenodd" />
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
          <Text style={[textStyle(type.sectionEyebrow), s.eyebrow]}>
            {`${index + 1} OF ${TOUR_STEPS.length}`}
          </Text>
          <Text style={[textStyle(type.errorHeadline), s.title]} accessibilityRole="header">
            {step.title}
          </Text>
          <Text style={[textStyle(type.emptyBody), s.body]}>{step.body}</Text>

          {last ? (
            <View style={s.stack}>
              <TourButton tone="primary" label="Post my first item" onPress={postFirstItem} />
              <TourButton tone="outline" label="Start browsing" onPress={finish} />
              <Text style={[textStyle(type.emptyBody), s.footnote]}>
                You can replay this tour anytime from Settings.
              </Text>
            </View>
          ) : first ? (
            <View style={s.stack}>
              <TourButton tone="primary" label="Show me around" onPress={nextTourStep} />
              <TourButton tone="text" label="Skip" onPress={finish} />
            </View>
          ) : (
            <View style={s.row}>
              <TourButton tone="text" label="Skip" onPress={finish} />
              <TourButton tone="primary" label="Next" onPress={nextTourStep} inline />
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

  const mascot = (
    <Animated.View
      // Decoration: the card's own text is what a screen reader should land on.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        s.mascot,
        { width: mascotWidth, height: mascotHeight, transform: [{ translateY: bob }] },
        place.mode === "center"
          ? { alignSelf: "center", marginBottom: -OVERLAP }
          : { marginLeft: hole ? mascotLeft(hole, mascotWidth, window) : 0 },
        place.mode === "below" ? { marginBottom: -OVERLAP } : null,
        place.mode === "above" ? { marginTop: -OVERLAP / 2 } : null,
      ]}
    >
      <Image source={pose.source} style={s.mascotImage} contentFit="contain" />
    </Animated.View>
  );

  const card = (
    <View style={[s.card, { width: cardWidth }, place.mode === "center" ? s.cardCentred : null]}>
      {children}
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
  inline = false,
}: {
  tone: "primary" | "outline" | "text";
  label: string;
  onPress: () => void;
  /** Sized to its label rather than the card's width (the Next button). */
  inline?: boolean;
}) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      pressedStyle={s.pressed}
      style={[
        s.button,
        tone === "primary" ? s.buttonPrimary : null,
        tone === "outline" ? s.buttonOutline : null,
        tone === "text" ? s.buttonText : null,
        inline ? s.buttonInline : null,
      ]}
    >
      <Text
        style={[
          textStyle(type.primaryButton),
          { color: tone === "primary" ? color.onGreen : tone === "text" ? color.forest : color.ink },
        ]}
      >
        {label}
      </Text>
    </Tappable>
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

const s = StyleSheet.create({
  ring: {
    position: "absolute",
    borderWidth: RING,
    borderColor: color.green,
  },
  centre: { justifyContent: "center", alignItems: "center" },
  beside: { position: "absolute", left: 0, right: 0 },
  mascot: { zIndex: 1 },
  mascotImage: { width: "100%", height: "100%" },
  card: {
    alignSelf: "center",
    backgroundColor: color.surface,
    borderRadius: radius.sheet,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 14,
  },
  cardCentred: { paddingTop: 28, paddingBottom: 18, alignItems: "stretch" },
  eyebrow: { color: color.inkSecondary, letterSpacing: 0.6 },
  title: { color: color.ink, marginTop: 8 },
  body: { color: color.inkSecondary, marginTop: 8 },
  footnote: { color: color.inkSecondary, textAlign: "center", marginTop: 4 },
  stack: { marginTop: 18, gap: 8 },
  row: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  button: {
    height: size.control.primaryButton,
    borderRadius: radius.primaryButton,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  buttonPrimary: { backgroundColor: color.green },
  buttonOutline: { borderWidth: 1, borderColor: color.controlLineStrong },
  // No fill to pad: just wide enough to be a comfortable target.
  buttonText: { paddingHorizontal: 0, minWidth: 56 },
  buttonInline: { paddingHorizontal: 28 },
  pressed: { opacity: 0.8 },
});
