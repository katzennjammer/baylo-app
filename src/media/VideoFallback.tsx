import { Component, type ReactNode } from "react";

/**
 * Keeps a broken video from taking the screen with it.
 *
 * The same posture as `MapErrorBoundary`, and for the same reason: an uncaught
 * render error unmounts the nearest tree that has no boundary, and on the auth
 * screens that tree is the whole sign-in flow. A codec the device refuses, a
 * surface that cannot be allocated, `useVideoPlayer` throwing on a source the
 * platform will not parse — none of those are reasons a person should be unable
 * to log in.
 *
 * ── THE FALLBACK IS `null`, AND THAT IS THE WHOLE POINT ─────────────────────
 *
 * `MapErrorBoundary` degrades to a list because the hubs are the point of that
 * screen and the map is one presentation of them — losing the map must not lose
 * the data. Here the opposite is true: the video is presentation and nothing
 * else, and the thing it is presented ON TOP OF is already painted underneath
 * it. The band keeps its ground and stripes and scrim; the intro is skipped and
 * the auth screen arrives. Rendering `null` restores exactly the design that
 * shipped before there was any footage, which is why there is no notice, no
 * warning strip and no "try again" button: there is nothing for a person to do
 * about it and nothing they have lost.
 *
 * NO AUTOMATIC RETRY, for the reason the map boundary also gives — a video that
 * fails in a loop would remount in a loop and take the battery with it. Unlike
 * the map there is no manual retry either, because a control offering to
 * re-attempt decoration would be more intrusive than the decoration.
 *
 * The failure is logged rather than swallowed. Without that line, footage that
 * quietly stopped rendering would look exactly like footage that had not
 * downloaded yet, and those want different fixes.
 */
export class VideoFallback extends Component<
  { what: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn(`[video] ${this.props.what} fell back to the still paint:`, error.message);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
