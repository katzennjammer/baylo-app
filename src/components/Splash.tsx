import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, DevSettings, StyleSheet, Text, View } from "react-native";

import {
  readBootDiagnostics,
  REVEAL_AFTER_MS,
  type BootDiagnostics,
} from "../dev/boot-diagnostics";
import { Tappable } from "./Tappable";
import { border, color, font, radius, space, textStyle, type } from "../theme/tokens";

/**
 * The first frame of the app — and, after a few seconds, an explanation of why
 * it is still the first frame.
 *
 * ── THE TWO PHASES ──────────────────────────────────────────────────────────
 *
 *   < REVEAL_AFTER_MS   A spinner on the app canvas. Unchanged from before, and
 *                       deliberately so: a normal boot is under a second and
 *                       must not flash a diagnostic on its way past.
 *   ≥ REVEAL_AFTER_MS   The same spinner, plus a readout naming what is being
 *                       waited on, the Metro origin the bundle came from, and
 *                       the API base every request is built on.
 *
 * A boot that takes four seconds is not slow, it is stuck, and the thing that
 * makes it stuck is nearly always one of those two URLs. Before this, neither
 * was reachable from the device — the screen was a blank rectangle in
 * `color.surface`, which on a phone is simply "white", and it looked identical
 * whether SecureStore had wedged, the API was hanging, or a font had failed.
 *
 * ── WHY `waitingOn` IS A REQUIRED-ISH PROP ──────────────────────────────────
 *
 * There are three call sites and they mean three different things: the root
 * layout waits on fonts, and the index route and the (app) guard both wait on
 * SecureStore. The default covers a caller that has not been updated, but a
 * caller that passes nothing is exactly the case this component was written to
 * stop being possible, so every call site in the app names its reason.
 *
 * ── IT DOES NOT UNBLOCK ANYTHING ────────────────────────────────────────────
 *
 * Nothing here cancels, retries or times out. The deadlines that do that live
 * where the waiting happens — `HYDRATION_TIMEOUT_MS` in `src/auth/session.tsx`
 * is the one that guarantees this screen is not permanent. This component only
 * decides what a person looks at while those run, so it cannot itself become a
 * reason the app fails to start.
 */

export interface SplashProps {
  /** What this particular mount is blocked on. Shown verbatim in the readout. */
  waitingOn?: string;
}

export function Splash({ waitingOn = "Starting up" }: SplashProps) {
  const [diagnostics, setDiagnostics] = useState<BootDiagnostics | null>(null);
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    // Read the diagnostics WHEN THE TIMER FIRES, not at mount. `apiBase` and
    // `apiBaseHydrated` both change during the window this screen covers, so a
    // snapshot taken at mount would report the pre-hydration values and send
    // somebody to look at the wrong URL.
    const reveal = setTimeout(() => setDiagnostics(readBootDiagnostics()), REVEAL_AFTER_MS);

    // Ticks only once the readout is up. Its job is to distinguish "wedged"
    // from "slowly making progress", which needs a number that visibly moves.
    const tick = setInterval(() => {
      setSeconds(Math.round((Date.now() - startedAt.current) / 1000));
    }, 1_000);

    return () => {
      clearTimeout(reveal);
      clearInterval(tick);
    };
  }, []);

  return (
    <View style={s.screen}>
      <ActivityIndicator color={color.green} />

      {diagnostics ? (
        <View style={s.panel}>
          <Text style={[textStyle(type.sectionEyebrow), s.eyebrow]}>
            STILL LOADING — {seconds}s
          </Text>

          <Text style={[textStyle(type.emptyBody), s.waiting]}>{waitingOn}</Text>

          <View style={s.rows}>
            <Row
              label="bundle"
              value={diagnostics.bundleUrl}
              // A packaged bundle in a build you are actively developing means
              // the app is running JS that Metro is not serving — every edit is
              // going nowhere, which looks exactly like the app ignoring you.
              note={diagnostics.fromDevServer ? null : "not from a dev server"}
            />
            <Row
              label="api"
              value={diagnostics.apiBase}
              note={
                !diagnostics.apiBaseHydrated
                  ? "override not read yet"
                  : diagnostics.apiBaseOverridden
                    ? "from the gear's override, NOT .env — Reset in the gear to drop it"
                    : null
              }
            />
          </View>

          {/* Dev only. In a release build there is no packager to reload from,
              and DevSettings.reload is a no-op stub there anyway — offering a
              button that cannot work is worse than offering none. */}
          {__DEV__ ? (
            <Tappable
              onPress={() => DevSettings.reload("Reloaded from the boot diagnostic")}
              accessibilityRole="button"
              accessibilityLabel="Reload the app"
              style={s.reload}
              pressedStyle={s.reloadPressed}
            >
              <Text style={[textStyle(type.secondaryButton), { color: color.forest }]}>
                Reload
              </Text>
            </Tappable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * One `label  value` line, monospaced.
 *
 * Mono because every value on this panel is a URL that somebody is going to
 * compare character by character against something on their laptop — a
 * proportional face makes `10.60.93.88` and `10.141.155.88` look alike at a
 * glance, which is the specific mistake this readout exists to prevent.
 */
function Row({ label, value, note }: { label: string; value: string; note: string | null }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.rowValue}>
        {/* Never truncated. A URL cut off at the port is not a URL. */}
        <Text style={s.rowText}>{value}</Text>
        {note ? <Text style={s.rowNote}>{note}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.screenX,
    backgroundColor: color.surface,
  },

  panel: {
    alignSelf: "stretch",
    marginTop: space.empty.x,
    padding: space.empty.x,
    borderRadius: radius.hubRow,
    borderWidth: border.hairline,
    borderColor: color.controlLine,
    backgroundColor: color.inset,
    gap: space.detail.headingToBody,
  },

  eyebrow: { color: color.urgent },
  waiting: { color: color.ink },

  rows: { gap: 6 },
  row: { flexDirection: "row", gap: 8 },
  rowLabel: {
    fontFamily: font.mono,
    fontSize: 11,
    color: color.inkMuted,
    width: 52,
    includeFontPadding: false,
  },
  rowValue: { flex: 1 },
  rowText: {
    fontFamily: font.mono,
    fontSize: 11,
    lineHeight: 16,
    color: color.inkSecondary,
    includeFontPadding: false,
  },
  rowNote: {
    fontFamily: font.mono,
    fontSize: 11,
    lineHeight: 16,
    color: color.urgent,
    includeFontPadding: false,
  },

  reload: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.hubRow,
    borderWidth: border.hairline,
    borderColor: color.greenLine,
    backgroundColor: color.greenWash,
  },
  reloadPressed: { backgroundColor: color.greenLine },
});
