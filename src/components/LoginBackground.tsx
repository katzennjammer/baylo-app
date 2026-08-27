import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { auth } from "../theme/palette";

/**
 * The background layer of the auth screens. One component, one job.
 *
 * TODAY it renders a green gradient. LATER it renders a looping muted video
 * with the same scrim on top. The reason it exists now, while it is still a
 * gradient, is that those are not the same amount of work if the swap has to
 * happen inside the login screen: a video needs a fixed-size absolutely
 * positioned host, a scrim that is part of the background rather than part of
 * the content, and a foreground whose contrast does not depend on what is
 * behind it. Building those three things after the fact means rewriting the
 * screen. Building them now costs one file.
 *
 * THE CONTRACT, which is what the swap actually depends on:
 *
 *   - The layer fills its parent and is behind everything. Children render
 *     above it, in normal flow, with no positioning of their own.
 *   - The layer is `pointerEvents="none"` below the children, so nothing it
 *     ever contains can eat a tap meant for a field.
 *   - The scrim is the LAYER's, not the content's. Whatever is underneath —
 *     flat green today, an arbitrary video frame later — the top of this
 *     component is a known, dark, low-variance surface. That is what makes the
 *     foreground's contrast a constant.
 *
 * WHEN THE VIDEO GOES IN. Install expo-video, then replace the `<LinearGradient>`
 * below with a `<VideoView>` (`contentFit="cover"`, muted, looping, no controls)
 * and keep the gradient as the poster underneath it so the first frame is never
 * a black rectangle. Nothing outside this file changes. Two things to get right
 * when you do:
 *
 *   - Pause on blur. A video that keeps decoding behind the app's own consent
 *     browser during Google sign-in is a battery complaint in a Play Store
 *     review.
 *   - Ship it small. This plays under a form nobody looks at for more than
 *     fifteen seconds; a 20 MB loop in the APK is 20 MB of install size spent
 *     on wallpaper.
 */
export function LoginBackground({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-1 bg-auth-3">
      {/* ── The layer ────────────────────────────────────────────────────── */}
      <View
        className="absolute inset-0"
        // Nothing in here is interactive, and nothing in here ever should be.
        // Without this a full-bleed video view sits on top of the touch target
        // of every field on the screen.
        pointerEvents="none"
      >
        <LinearGradient
          colors={[auth["auth-1"], auth["auth-2"], auth["auth-3"]]}
          // Off-axis rather than straight down: a vertical gradient behind a
          // vertical form reads as a seam where the two rates of change fail to
          // line up. The diagonal keeps the brightest corner away from the
          // card.
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          locations={[0, 0.55, 1]}
          style={{ flex: 1 }}
        />

        {/*
         * The scrim. Redundant over a flat gradient, load-bearing over video.
         *
         * It stays here rather than being added at the same time as the video
         * because it is what the foreground's colours were chosen against —
         * adding it later would change every contrast ratio on the screen at
         * the same moment as the thing hardest to eyeball.
         */}
        <View className="absolute inset-0 bg-auth-scrim" />
      </View>

      {/* ── The content ──────────────────────────────────────────────────── */}
      {children}
    </View>
  );
}
