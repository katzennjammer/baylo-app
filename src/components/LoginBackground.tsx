import { useState } from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { ColorValue } from "react-native";

import { authColor, authScrim } from "../theme/auth-tokens";
import { sheetColor } from "../theme/auth-sheet-tokens";
import { BandVideo } from "../media/BandVideo";

/**
 * The background layer of the auth screens. One component, one job.
 *
 * It renders a flat ground, a looping muted video over it, and a scrim over
 * that. The reason it is its own file is the reason it always was: a video
 * needs a fixed-size absolutely positioned host, a scrim that belongs to the
 * background rather than to the content, and a foreground whose contrast does
 * not depend on what is behind it. All three are here.
 *
 * THE CONTRACT:
 *
 *   - The layer fills its parent and sits behind everything. Children render
 *     above it, positioned by the screen, with no knowledge of this file.
 *   - The layer is `pointerEvents="none"`, so nothing it ever contains can eat
 *     a tap meant for a field.
 *   - The scrim is the LAYER's, not the content's. Whatever is underneath —
 *     flat ground, a stripe poster, or an arbitrary video frame — the top of
 *     this component is a known surface. That is what makes every contrast
 *     ratio in the spec a constant rather than a property of frame 412.
 *
 * ── TWO MODES, AND WHY BOTH ARE STILL HERE ──────────────────────────────────
 *
 * `band` — the current auth direction. The footage is a BAND across the top of
 * the screen (281px, or 200 on create account) with an opaque sheet covering
 * everything below it, so the scrim is one top-to-bottom gradient scoped to
 * that band. The layer still fills the whole screen rather than only the band,
 * because the sheet slides up over it when the keyboard opens and the video
 * must not be unmounted and remounted at its first frame every time.
 *
 * no `band` — the previous "Thumb Bar" direction: full-screen footage, three
 * flat scrim layers, cream type over the top of it. `app/verify.tsx` is still
 * drawn that way through `auth-ui.tsx`, and it is the only caller left. When
 * verify is redrawn to the sheet, this branch and the tokens it reads go with
 * it. Nothing new should be built on it.
 *
 * ── THE VIDEO IS IN, AND THE STRIPES STAYED ─────────────────────────────────
 *
 * `<BandVideo>` renders between the stripes and the scrim. The stripes were a
 * dev stand-in for footage that did not exist; they are now the POSTER and the
 * permanent fallback, which is a promotion rather than a leftover. They paint
 * first and are never removed, so the band looks exactly as it did before there
 * was any video whenever there is not one on screen: the first frames of a cold
 * start, a slow network, Cloudinary down, expo-video missing from the shell, a
 * decode failure, or Reduce Motion. That is what makes "no white or black frame
 * at any point" a structural property here rather than a thing to test for.
 *
 * The three requirements this file used to list as future work now live in
 * `media/BandVideo.tsx`, which is where they are enforced — pause on blur and
 * on background, Reduce Motion, and the `textureView` surface the fade needs.
 * One thing did NOT move, because it is a property of this layer: the scrim is
 * painted over the video, not under it, so the cream band chrome keeps its
 * measured contrast against a known surface instead of against frame 412.
 */

/** expo-linear-gradient types `colors` as a tuple of at least two ColorValues,
 *  and `locations` likewise. Spreading a `readonly` token array widens both to
 *  plain arrays, so they are narrowed back here rather than at five call sites. */
const stops = (c: readonly string[]) =>
  [...c] as unknown as readonly [ColorValue, ColorValue, ...ColorValue[]];
const at = (l: readonly number[]) =>
  [...l] as unknown as readonly [number, number, ...number[]];

export interface BandSpec {
  /** Declared band height. The sheet then rides 28px up over it. */
  height: number;
  /** The screen's own two-stop scrim, top → bottom. */
  scrim: readonly [string, string] | readonly string[];
}

export function LoginBackground({
  children,
  band,
  /** Which lower gradient, in the legacy full-screen mode. */
  scrim = "twoField",
  /**
   * Height at the BOTTOM of this layer that the keyboard is covering.
   *
   * On a window that really resizes this is 0 and the layer is already the
   * visible window. Under edge-to-edge on API 35+ it is the IME's own height.
   * Either way `visible` below is the region the scrim has to work across.
   */
  keyboardInset = 0,
  /** True while the IME is up, on either platform. Selects the tighter scrim. */
  keyboardUp = false,
}: {
  children: React.ReactNode;
  band?: BandSpec;
  scrim?: "twoField" | "fourField";
  keyboardInset?: number;
  keyboardUp?: boolean;
}) {
  const [height, setHeight] = useState(0);
  const visible = Math.max(0, height - keyboardInset);
  const lower = scrim === "fourField" ? authScrim.bottomFourField : authScrim.bottomTwoField;
  const kb = authScrim.keyboard;

  // The ground. In band mode it is the spec's #14140F "phone frame behind the
  // video band"; in the legacy mode it is the deep green the lower scrim
  // resolves to. Either way it is the colour a frame that has not decoded yet
  // shows, which is why it is never black.
  const ground = band ? sheetColor.frame : authColor.ground;

  return (
    <View className="flex-1" style={{ backgroundColor: ground }}>
      <View
        className="absolute inset-0"
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
        // Nothing in here is interactive and nothing in here ever should be.
        // Without this a full-bleed video view sits on top of the touch target
        // of every field on the screen.
        pointerEvents="none"
      >
        <View className="absolute inset-0" style={{ backgroundColor: ground }} />

        {band ? (
          <BandLayer band={band} />
        ) : height > 0 ? (
          <>
            {/* Layer 2 — flat tint, across the visible window only. Running it
                under the keyboard would tint nothing and cost a composite. */}
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                height: visible,
                backgroundColor: authScrim.tint,
              }}
            />

            {/* Layer 3 — down from the top. */}
            <LinearGradient
              colors={stops(keyboardUp ? kb.topColors : authScrim.top.colors)}
              locations={at(keyboardUp ? kb.topLocations : authScrim.top.locations)}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                height: keyboardUp ? kb.topHeight : visible * authScrim.top.heightRatio,
              }}
            />

            {/* Layer 4 — up from the bottom of the VISIBLE window, which is the
                top of the keyboard when one is open. */}
            <LinearGradient
              colors={stops(keyboardUp ? kb.bottomColors : lower.colors)}
              locations={at(keyboardUp ? kb.bottomLocations : lower.locations)}
              style={
                keyboardUp
                  ? {
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: kb.bottomTop,
                      height: kb.bottomHeight,
                    }
                  : {
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: visible - visible * lower.heightRatio,
                      height: visible * lower.heightRatio,
                    }
              }
            />
          </>
        ) : null}
      </View>

      {children}
    </View>
  );
}

/**
 * The band: the poster, the footage over it, then the screen's scrim over both.
 *
 * ── THE STRIPES ARE THE POSTER NOW, NOT A STAND-IN ──────────────────────────
 *
 * They began as a dev placeholder — structure under the scrim so that a
 * gradient had something to be judged against, because a gradient over a flat
 * fill looks correct at every opacity and tells you nothing. Now that there is
 * real footage they keep the same pixels and change job: they are what the band
 * shows whenever the video is not on screen, and they are never removed.
 *
 * "Whenever" is a long list and that is the point of painting them first rather
 * than swapping them out: the opening frames of every cold start, a slow
 * network, Cloudinary unreachable, expo-video missing from the installed shell,
 * a decode failure, Reduce Motion. In all of them the band looks exactly as it
 * did before video existed. Nothing here ever paints white or black.
 *
 * ── ORDER IS THE WHOLE DESIGN ───────────────────────────────────────────────
 *
 *   stripes  → poster, always painted
 *   BandVideo → absolute, opacity 0 → 1 on its first real frame
 *   scrim    → LAST, so the band chrome's contrast is against a known surface
 *
 * The scrim being last is what lets the wordmark, back button, gear and dev
 * chip stay cream over arbitrary footage. Moving the video above it would make
 * every contrast figure in the spec a property of whatever frame is showing.
 *
 * The band is painted at its DECLARED height, not its visible one. The sheet
 * overlaps the bottom 28px of it, so drawing only the visible 253 would put the
 * scrim's darkest stop 28px above where the gradient was measured to end — and
 * would crop the footage to a different rectangle than the one the scrim was
 * built for.
 */
function BandLayer({ band }: { band: BandSpec }) {
  if (band.height <= 0) return null;

  const stripes = 7;
  const stripeHeight = band.height / stripes;

  return (
    <View
      style={{ position: "absolute", left: 0, right: 0, top: 0, height: band.height }}
      // The whole band is clipped, so neither a stripe nor a video frame can
      // paint over the sheet during the 220ms in which the band collapses.
      pointerEvents="none"
    >
      {Array.from({ length: stripes }, (_, i) => (
        <View
          key={i}
          style={{
            height: stripeHeight,
            backgroundColor: i % 2 === 0 ? sheetColor.stripeA : sheetColor.stripeB,
          }}
        />
      ))}

      {/* Between the poster and the scrim. Renders nothing at all when
          expo-video is absent, which leaves the two layers that were here
          before it and a band that is indistinguishable from the old one. */}
      <BandVideo height={band.height} />

      <LinearGradient
        colors={stops(band.scrim)}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />
    </View>
  );
}
