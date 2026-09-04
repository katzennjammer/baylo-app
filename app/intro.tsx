import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { prewarmBandPlayer } from "../src/media/BandVideo";
import { markIntroPlayed } from "../src/media/intro-gate";
import { videoKit } from "../src/media/video-kit";
import { VideoFallback } from "../src/media/VideoFallback";
import {
  INTRO_FIRST_FRAME_BUDGET_MS,
  INTRO_MAX_MS,
  INTRO_VIDEO_URL,
} from "../src/media/video-sources";
import { authText, authType, sheetColor } from "../src/theme/auth-sheet-tokens";

/**
 * The film that plays once, on a cold start, in front of the auth screens.
 *
 * ── IT IS NOT ALLOWED TO BE THE REASON SOMEBODY CANNOT SIGN IN ──────────────
 *
 * That single rule shapes everything below, and it is why there are FOUR
 * separate ways off this screen rather than one:
 *
 *   1. The clip finishes            → `playToEnd`
 *   2. The user taps                → the whole screen is the button
 *   3. No picture within 2 seconds  → `INTRO_FIRST_FRAME_BUDGET_MS`
 *   4. Still here after 12 seconds  → `INTRO_MAX_MS`, the stall guard
 *
 * plus a fifth that never reaches this file at all: `app/index.tsx` does not
 * route here when there is a session, when the intro has already played in this
 * process, or when expo-video did not load. And a sixth, `VideoFallback`, for a
 * player that throws once mounted.
 *
 * (3) and (4) are different failures and both are real. (3) is a cold start on
 * a bad connection, where the film never begins — two seconds is the entire
 * budget, measured to the FIRST RENDERED FRAME rather than to a ready status,
 * because a player that reports itself ready while showing nothing is exactly
 * the state this rule exists to escape. (4) is a clip that starts and then
 * stalls mid-buffer, which fires no `playToEnd` and would otherwise sit on a
 * frozen frame forever.
 *
 * ── EVERY EXIT IS THE SAME EXIT ─────────────────────────────────────────────
 *
 * All four call `leave()`, which is idempotent through a ref. Without that,
 * `playToEnd` landing in the same frame as the stall timer would issue two
 * navigations, and a double `replace` on this stack pops the login screen the
 * first one just installed. The ref is checked and set synchronously, so the
 * second caller cannot see a stale value the way a piece of state could.
 *
 * ── WHY `replace` AND WHY `/(auth)/login` ───────────────────────────────────
 *
 * `replace` because there is no back to the intro: it is a cold-start event,
 * not a place. And the destination is the auth screen rather than a session
 * check, because the (auth) guard one level down already does that job — the
 * same contract the rest of this app follows, where exactly one thing decides
 * where a signed-in user goes. If a session lands while the film is playing,
 * this screen still exits to /(auth)/login and the guard bounces it onward.
 *
 * ── NO WHITE OR BLACK FRAME, HERE EITHER ────────────────────────────────────
 *
 * The screen's own ground is `sheetColor.frame` — the same #14140F the auth
 * band paints behind its footage — and it is painted before anything else
 * mounts. The video sits on top at opacity 0 and fades in on its first real
 * frame, so the transition into this screen, out of it, and every failure in
 * between resolves to the same dark ground the next screen also starts from.
 * `useExoShutter={false}` keeps ExoPlayer from drawing its own black rectangle
 * over that ground while it loads.
 *
 * ── THE HANDOFF IS A CROSS-FADE, AND IT IS PREPARED FOR IN ADVANCE ──────────
 *
 * Leaving this screen used to look like a freeze: the film reached its end and
 * its last frame sat on the glass for a beat before the auth screen appeared.
 * Two things were producing it, and both are handled — one here, one next door.
 *
 *   THE GAP. `replace` off a screen with `animation: "none"` is a hard cut, and
 *   the intro never faded out. `app/_layout.tsx` now gives this route
 *   `animation: "fade"`, which under a `replace` is a 150ms cross-fade with the
 *   OUTGOING screen drawn on top — so the intro's frame dissolves into the auth
 *   screen instead of being swapped for it.
 *
 *   THE WORK. The band's ExoPlayer was being constructed during the auth
 *   screen's first render, in the same commit that tears this player down. Both
 *   are main-thread native calls. `prewarmBandPlayer()` moves that construction
 *   into the middle of the film, where there is nothing else to contend with.
 *
 * And `leave()` PAUSES before it navigates, so what dissolves is a held frame
 * rather than a video still decoding underneath a fade. On the natural exit that
 * is a no-op — the clip has already ended on its last frame, which is the frame
 * worth holding. On a tap, a timeout, or a backgrounding it is the difference
 * between the intro ending and the intro being interrupted.
 */
export default function IntroScreen() {
  const leaving = useRef(false);

  /**
   * Freezes the player on whatever frame is showing. Installed by `IntroPlayer`,
   * null when there is no player — a missing kit, or a boundary that has already
   * caught one. A ref rather than a prop because the four exits are split across
   * both components and only this one has a player to stop.
   */
  const holdFrame = useRef<(() => void) | null>(null);

  const leave = useCallback(() => {
    // Synchronous and ref-based; see the note above on why this cannot be state.
    if (leaving.current) return;
    leaving.current = true;
    // Before the navigation, not after: the cross-fade should dissolve a still.
    holdFrame.current?.();
    router.replace("/(auth)/login");
  }, []);

  // Marked on mount, not on exit. Whatever happens next — the clip playing out,
  // a tap two frames in, a timeout, a crash caught by the boundary — the intro
  // has had its turn and must not reappear when this process re-enters "/".
  useEffect(() => {
    markIntroPlayed();
  }, []);

  // The stall guard, and the only timer that runs for the whole screen. The
  // first-frame budget lives inside the player, where the first frame is known.
  useEffect(() => {
    const t = setTimeout(leave, INTRO_MAX_MS);
    return () => clearTimeout(t);
  }, [leave]);

  // Defensive, and normally unreachable: index.tsx does not route here without
  // a kit. It is here so that a future caller cannot strand somebody on a
  // permanently black screen by forgetting that check.
  useEffect(() => {
    if (!videoKit) leave();
  }, [leave]);

  return (
    <Pressable
      onPress={leave}
      accessibilityRole="button"
      accessibilityLabel="Skip the intro"
      // The ground, painted before anything mounts over it.
      style={{ flex: 1, backgroundColor: sheetColor.frame }}
    >
      {videoKit ? (
        <VideoFallback what="IntroVideo">
          <IntroPlayer onFinished={leave} holdFrame={holdFrame} />
        </VideoFallback>
      ) : null}

      <SkipHint />
    </Pressable>
  );
}

/**
 * The source, built once at module scope.
 *
 * `useCaching` matters more here than anywhere: this is the first network
 * request of every cold start, on testers' mobile data, in front of a screen
 * they are trying to get past. Cached, the second launch onward costs nothing.
 * The URL is immutable — version segment and transform are both in it — so a
 * cached copy can never be a stale copy.
 */
const introSource = { uri: INTRO_VIDEO_URL, useCaching: true };

const FADE_MS = 320;

/**
 * How long after the intro's first frame the band's player is built.
 *
 * `prewarmBandPlayer()` blocks the main thread for as long as it takes to
 * construct an ExoPlayer, so it must not land inside the fade-in above — that
 * animation is native-driven and immune to a busy JS thread, but not to a busy
 * MAIN thread. One fade's length after the picture arrives, the reveal is over
 * and there are still several seconds of film left to hide the cost in.
 */
const BAND_PREWARM_DELAY_MS = FADE_MS;

function IntroPlayer({
  onFinished,
  holdFrame,
}: {
  onFinished: () => void;
  holdFrame: React.RefObject<(() => void) | null>;
}) {
  const { useVideoPlayer, VideoView } = videoKit!;

  const player = useVideoPlayer(introSource, (p) => {
    p.loop = false;
    p.muted = true;
    p.audioMixingMode = "mixWithOthers";
    p.showNowPlayingNotification = false;
    p.staysActiveInBackground = false;
    p.play();
  });

  const opacity = useRef(new Animated.Value(0)).current;
  const shown = useRef(false);
  const prewarm = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── The screen's exits reach the player through here ─────────────────────
  //
  // Registered in an effect so it is paired with a cleanup: a player released
  // by a re-render must not stay reachable through a stale closure.
  useEffect(() => {
    holdFrame.current = () => {
      try {
        player.pause();
      } catch {
        // Already torn down natively. There is nothing left to freeze, and the
        // frame it left behind is the one that stays on screen anyway.
      }
    };
    return () => {
      holdFrame.current = null;
    };
  }, [player, holdFrame]);

  // ── The band's player is built while the film is still running ───────────
  //
  // Armed by the first frame rather than by mount: at mount this screen is
  // itself constructing a player and racing a two-second budget to show a
  // picture, and a second construction alongside it is the one place this call
  // could do harm. Cleared on unmount so a skip inside the delay does not fire
  // it into the transition it exists to keep clear.
  useEffect(
    () => () => {
      if (prewarm.current) clearTimeout(prewarm.current);
    },
    [],
  );

  // ── The two-second budget, held against the first RENDERED frame ─────────
  useEffect(() => {
    const t = setTimeout(() => {
      if (!shown.current) onFinished();
    }, INTRO_FIRST_FRAME_BUDGET_MS);
    return () => clearTimeout(t);
  }, [onFinished]);

  // ── The clip ending, and the player failing, are the same event here ─────
  useEffect(() => {
    const ended = player.addListener("playToEnd", onFinished);
    const status = player.addListener("statusChange", ({ status: next, error }) => {
      if (next !== "error") return;
      console.warn("[video] intro failed, skipping to auth:", error?.message ?? "unknown");
      onFinished();
    });
    return () => {
      ended.remove();
      status.remove();
    };
  }, [player, onFinished]);

  // ── Backgrounding mid-intro ──────────────────────────────────────────────
  //
  // Not a pause-and-resume. Somebody who leaves the app during a seven-second
  // title card and comes back has already spent longer away than the film
  // lasts, and returning them to a half-played intro in front of a login screen
  // is worse than not showing it. So it ends.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") onFinished();
    });
    return () => sub.remove();
  }, [onFinished]);

  // ── Reduce Motion skips it outright ──────────────────────────────────────
  //
  // A full-screen film is the most motion this app ever produces, and it is
  // decoration in front of a form. Under Reduce Motion the honest response is
  // not a static frame but no intro at all.
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive && on) onFinished();
    });
    return () => {
      alive = false;
    };
  }, [onFinished]);

  const onFirstFrame = useCallback(() => {
    shown.current = true;
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    // There is a picture and this screen's own work is done. The next screen's
    // most expensive piece of setup goes here, in the slack, rather than into
    // the frame in which this one is being replaced.
    prewarm.current = setTimeout(prewarmBandPlayer, BAND_PREWARM_DELAY_MS);
  }, [opacity]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      <VideoView
        player={player}
        style={{ flex: 1 }}
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
        useExoShutter={false}
        onFirstFrameRender={onFirstFrame}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </Animated.View>
  );
}

/**
 * "Tap to skip", low on the screen.
 *
 * It appears after a beat rather than immediately, which is the difference
 * between an invitation and an apology: a hint that is already there when the
 * film starts reads as the app expecting you to want out of it. A second in, it
 * is an answer to a question somebody has by then actually asked.
 *
 * It is not the skip control — the whole screen is — so it carries no press
 * handler of its own and is hidden from the screen reader, which is already
 * being told the screen is a button labelled "Skip the intro".
 */
function SkipHint() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1_000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible) return;
    Animated.timing(opacity, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: Math.max(28, insets.bottom + 20),
        alignItems: "center",
        opacity,
      }}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: "rgba(20,20,15,0.38)",
        }}
      >
        <Text style={[authText(authType.eyebrow), { color: sheetColor.onVideoEyebrow }]}>
          Tap to skip
        </Text>
      </View>
    </Animated.View>
  );
}
