import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Easing } from "react-native";
import { useIsFocused } from "expo-router";
import type { VideoPlayer } from "expo-video";

import { BAND_VIDEO_URL } from "./video-sources";
import { videoKit } from "./video-kit";
import { VideoFallback } from "./VideoFallback";

/**
 * The looping footage in the band above the auth sheet.
 *
 * ── WHERE IT SITS IN THE STACK, AND WHY THAT ORDER ──────────────────────────
 *
 * `LoginBackground` paints the band in three layers and this is the middle one:
 *
 *     ground + stripes    ← the poster. Painted first, never removed.
 *     THIS                ← fades in over the poster once a frame exists.
 *     the screen's scrim  ← a gradient owned by the LAYER, not by this file.
 *
 * The poster staying underneath forever is what satisfies "no white or black
 * frame at any point". There is no moment — cold start, slow network,
 * Cloudinary down, expo-video missing, a decode failure mid-session — at which
 * the band is anything other than the paint it was before video existed. This
 * component only ever ADDS to that, and its opacity starts at zero.
 *
 * The scrim staying on top is what keeps the band chrome legible. The wordmark,
 * the back button, the gear and the dev chip are cream over the band, and their
 * contrast is measured against the scrim's known surface rather than against
 * whatever frame 412 happens to be. That is the contract `LoginBackground`
 * describes, and this file does not get to break it.
 *
 * ── THE FADE IS DRIVEN BY `onFirstFrameRender`, NOT BY STATUS ───────────────
 *
 * `readyToPlay` means the player has buffered enough to start. It does NOT mean
 * a frame is on the glass, and fading in on it reveals a transparent surface
 * over the poster for a beat — which reads as a flicker. `onFirstFrameRender`
 * fires when there is a picture, which is the only moment worth revealing.
 *
 * ── `surfaceType="textureView"` IS LOAD-BEARING ON ANDROID ──────────────────
 *
 * The default is `surfaceView`, which punches a hole through the window rather
 * than compositing into it. A SurfaceView cannot be alpha-blended by the view
 * system, so the fade would snap from invisible to opaque — and, much worse, it
 * does not reliably respect z-order against its React Native siblings, so the
 * scrim gradient that is supposed to sit ON TOP of the footage can end up
 * behind it. Both things this file promises depend on the TextureView.
 *
 * ── IT PAUSES WHENEVER IT IS NOT BEING LOOKED AT ────────────────────────────
 *
 * Two independent conditions, and it plays only when both hold: the screen is
 * focused, and the app is in the foreground. The second is not covered by the
 * first — the Google consent flow opens a browser over this screen without
 * unfocusing it, and a video that keeps decoding behind it is a battery
 * complaint that arrives as "signing in drains my phone".
 *
 * Under Reduce Motion it never plays at all. The poster is the design; nothing
 * on these screens depends on the footage moving.
 */
export function BandVideo({ height }: { height: number }) {
  // `videoKit` is a module constant, so this branch cannot change between
  // renders and the hooks in `BandVideoInner` always run in the same order.
  if (!videoKit || height <= 0) return null;

  return (
    <VideoFallback what="BandVideo">
      <BandVideoInner height={height} />
    </VideoFallback>
  );
}

/**
 * The source object, built once at module scope.
 *
 * `useCaching` is what keeps a cold start off the network — testers are on
 * mobile data and the band is the first thing every session paints. It is safe
 * because the URL is immutable: the Cloudinary version segment and the
 * transform are both part of it, so a cached copy can never be the wrong copy.
 */
const bandSource = { uri: BAND_VIDEO_URL, useCaching: true };

/** First reveal, over the poster. */
const FADE_MS = 420;

/**
 * A re-attach to a player that is already running, which is 1-2 frames of
 * transparent surface rather than a load. Long enough not to be a hard cut,
 * short enough not to read as the video starting again.
 */
const REATTACH_FADE_MS = 120;

/**
 * How long a player with no view attached is kept alive before it is released.
 *
 * Long enough to cover any navigation inside the auth flow, short enough that a
 * signed-in session is not holding a decoder open for the rest of the process.
 */
const IDLE_RELEASE_MS = 30_000;

/* ─────────────────── one player, shared by every auth screen ──────────────── */

/**
 * ── WHY THE PLAYER IS A MODULE SINGLETON AND NOT `useVideoPlayer` ───────────
 *
 * The obvious build is `useVideoPlayer` inside the component, and it produces a
 * visible bug. The auth flow's screens are DIFFERENT COMPONENT TYPES —
 * `ChooseHowToSignIn`, `EmailLogIn`, `GoogleDateOfBirth`, `UnderAgeSheet`, and
 * `register` on its own route — so moving between them is not a re-render, it
 * is an unmount and a mount. A per-component player would be torn down and
 * rebuilt on every one of those transitions, and because the fade is tied to
 * the first frame, tapping "Continue with email" would show the band drop to
 * the stripe poster and fade back up again. Restarting a six-second loop from
 * frame one, visibly, on a screen change nobody asked to be decorated.
 *
 * One player at module scope survives all of it. The loop keeps running, each
 * screen's `VideoView` attaches to a player that already has frames, and the
 * band looks continuous across the whole flow — which is what a background is
 * supposed to do.
 *
 * ── IT IS REFERENCE-COUNTED, SO IT DOES NOT OUTLIVE THE FLOW ────────────────
 *
 * The cost of a singleton is that nothing owns it. So mounts are counted: the
 * last one to leave pauses the player immediately and schedules its release,
 * and any new mount inside `IDLE_RELEASE_MS` cancels that. In practice a
 * navigation between two auth screens cancels it within a frame, and signing in
 * does not — thirty seconds later the decoder goes away, because `(app)` never
 * renders this component again.
 *
 * `firstFrameEver` is what keeps the re-attach honest. Once the band has shown
 * real footage in this process, later attaches are joining a running video
 * rather than starting one, so they use the short fade. It is not reset on
 * release: if the player is rebuilt after that, the poster is still what shows
 * underneath, and a 120ms reveal over it is still the right length.
 *
 * ── CREATING AND COUNTING ARE SEPARATE, AND THAT IS DELIBERATE ──────────────
 *
 * The view needs a player on its FIRST paint, so one has to exist during
 * render. But a render is not a commitment — React may throw a render away, and
 * `<StrictMode>` deliberately runs one twice and mounts, unmounts and remounts
 * the effects around it. Counting a reference in the render body and dropping
 * it in an effect cleanup is therefore not symmetric, and under those
 * conditions the count drifts: the band would pause itself while still on
 * screen, or hold a decoder open after leaving.
 *
 * So `ensureBandPlayer()` only makes sure one exists, and `retainBandPlayer()`
 * / `releaseBandPlayer()` are called exclusively from an effect and its
 * cleanup, which React guarantees are paired. `ensure` schedules the idle
 * release itself, so a player built during a render that never commits is
 * cleaned up on the same timer as any other — the count never goes negative and
 * nothing is stranded.
 */
let sharedPlayer: VideoPlayer | null = null;
let retained = 0;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;
let firstFrameEver = false;

function cancelRelease() {
  if (!releaseTimer) return;
  clearTimeout(releaseTimer);
  releaseTimer = null;
}

function scheduleRelease() {
  cancelRelease();
  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    if (retained > 0) return;
    try {
      sharedPlayer?.release();
    } catch {
      // Already torn down by the native side. The reference is dropped anyway.
    }
    sharedPlayer = null;
  }, IDLE_RELEASE_MS);
}

/** Called during render. Creates the player if there is not one; counts nothing. */
function ensureBandPlayer(): VideoPlayer {
  if (!sharedPlayer) {
    // Throws on a kit that loaded but cannot build a player. This runs during
    // render, so `VideoFallback` above catches it and the band keeps its
    // poster — which is exactly the intended degradation.
    const player = videoKit!.createVideoPlayer(bandSource);
    player.loop = true;
    player.muted = true;
    // Belt and braces on a muted loop: never take audio focus from whatever the
    // person already had playing, and never appear in the lock screen.
    player.audioMixingMode = "mixWithOthers";
    player.showNowPlayingNotification = false;
    player.staysActiveInBackground = false;
    sharedPlayer = player;

    // A render that never commits leaves nothing to run the cleanup below, so
    // the timer is armed here as well. A commit cancels it immediately.
    scheduleRelease();
  }
  return sharedPlayer;
}

/**
 * Build the band's player NOW, before anything renders a view for it.
 *
 * ── WHAT THIS IS FOR ────────────────────────────────────────────────────────
 *
 * `ensureBandPlayer()` runs in `BandVideoInner`'s render body, so without this
 * the band's ExoPlayer is constructed during the auth screen's FIRST RENDER —
 * which, coming out of the intro, is the same commit in which the intro's own
 * player is being torn down. Constructing and releasing an ExoPlayer are both
 * main-thread native calls, and two of them in the frame where a whole screen is
 * also mounting is the stall that showed up as the intro freezing on its last
 * frame before the auth screen appeared.
 *
 * The intro calls this a beat after its own first frame, where there are several
 * seconds of slack and nothing else contending. By the time the auth screen
 * renders, `ensureBandPlayer()` finds a player already built and returns it.
 *
 * ── IT COUNTS NOTHING, AND CANNOT LEAK ──────────────────────────────────────
 *
 * This is `ensure`, not `retain`: it takes no reference. `ensure` arms the idle
 * release itself for exactly this case — a player that exists with nothing
 * mounted against it — so a prewarm the auth screen never follows (the intro is
 * skipped, the process is backgrounded, sign-in happens from somewhere else) is
 * cleaned up on the same 30-second timer as any other. The intro's own ceiling
 * is 12 seconds, so a real handoff always lands well inside it.
 *
 * ── IT NEVER THROWS ─────────────────────────────────────────────────────────
 *
 * `ensureBandPlayer` throws on a kit that loaded but cannot build a player, and
 * that is correct where it is called from a render body: `VideoFallback` catches
 * it and the band keeps its poster. Here there is no boundary and no view — this
 * is a speculative call from an unrelated screen — so the same failure is logged
 * and dropped. The auth screen will try again on mount, inside its boundary,
 * and degrade there in the way that file already describes.
 */
export function prewarmBandPlayer(): void {
  if (!videoKit) return;
  try {
    ensureBandPlayer();
  } catch (err) {
    console.warn(
      "[video] band prewarm failed; the auth screen will build its own player:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Called from an effect. Paired with `releaseBandPlayer` by React. */
function retainBandPlayer() {
  retained += 1;
  cancelRelease();
}

function releaseBandPlayer() {
  retained = Math.max(0, retained - 1);
  if (retained > 0) return;

  // Paused NOW, released later. Pausing is what stops the decoding; the delay
  // only decides whether the next screen gets to reuse the player.
  try {
    sharedPlayer?.pause();
  } catch {
    // A player already torn down by the native side. Nothing to pause.
  }

  scheduleRelease();
}

function BandVideoInner({ height }: { height: number }) {
  const { VideoView } = videoKit!;

  // Resolved during render, because the view needs a player on its very first
  // paint and cannot wait for an effect. Creating is idempotent; the reference
  // COUNT is taken below, where React pairs it with a cleanup.
  const player = ensureBandPlayer();

  useEffect(() => {
    retainBandPlayer();
    return releaseBandPlayer;
  }, []);

  const [reduceMotion, setReduceMotion] = useState(false);
  const [foreground, setForeground] = useState(() => AppState.currentState === "active");
  const focused = useIsFocused();

  const opacity = useRef(new Animated.Value(0)).current;

  // ── Reduce Motion ────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setReduceMotion(on);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // ── Foreground / background ──────────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => setForeground(next === "active"));
    return () => sub.remove();
  }, []);

  // ── The one place playback is decided ────────────────────────────────────
  //
  // Every input above lands here rather than each calling play/pause itself, so
  // two of them disagreeing is not possible. The player is a native object and
  // calling play() on one that is already playing costs nothing.
  const shouldPlay = focused && foreground && !reduceMotion;
  useEffect(() => {
    try {
      if (shouldPlay) player.play();
      else player.pause();
    } catch (err) {
      // A player torn down between the render and this effect throws on use.
      // There is nothing to do about it and nothing to show for it — the poster
      // underneath is already the correct picture.
      console.warn(
        "[video] band playback command failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }, [player, shouldPlay]);

  const onFirstFrame = useCallback(() => {
    const duration = firstFrameEver ? REATTACH_FADE_MS : FADE_MS;
    firstFrameEver = true;
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.ease),
      // Opacity only — no layout involved, so this runs off the JS thread and
      // cannot be stuttered by whatever the sign-in screen is doing.
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  // Reduce Motion never reveals the video, so there is no reason to hold a
  // view over a decoder nobody will see.
  if (reduceMotion) return null;

  return (
    <Animated.View
      style={{ position: "absolute", left: 0, right: 0, top: 0, height, opacity }}
      // The band sits inside a layer that is already `pointerEvents="none"`.
      // Stated again here because a video view is exactly the kind of thing
      // that grows a gesture responder in a later version.
      pointerEvents="none"
    >
      <VideoView
        player={player}
        style={{ flex: 1 }}
        // The band is a wide letterbox and the footage is not; cover crops
        // rather than pillarboxing, which is the only fit that leaves no ground
        // showing through at the edges.
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
        // ExoPlayer's own shutter is an opaque black rectangle drawn until the
        // first frame arrives. This component's whole no-black-frame promise is
        // that the poster shows through until then, so the shutter has to go.
        useExoShutter={false}
        onFirstFrameRender={onFirstFrame}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </Animated.View>
  );
}
