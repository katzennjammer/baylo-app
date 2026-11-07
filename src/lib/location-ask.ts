import * as Location from "expo-location";

import { showDialog } from "../components/dialog";

type Point = { latitude: number; longitude: number };

/** "Not now" is remembered for the rest of this app session. */
let declinedThisSession = false;

/**
 * The phone's position for a moment that needs it, asking for permission IN
 * CONTEXT (7 Nov 2026). The app never asks on launch.
 *
 *   already allowed    → a fresh fix (5 s at most), else the last known one
 *   never asked        → the app's own dialog with the duck explains `reason`
 *                        first; only "Allow" brings up the phone's prompt
 *   refused for good   → null, without asking again
 *
 * Asking with the reason on screen is what gets a "yes". On Android, two
 * refusals block the prompt for good, so a blind ask on launch can lose it
 * for good. Null is always a valid answer: every caller works without a
 * position.
 */
export async function ensureLocation(reason: string): Promise<Point | null> {
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain || declinedThisSession) return null;
      const allow = await new Promise<boolean>((resolve) =>
        showDialog(
          "Use your location?",
          reason,
          [
            { text: "Not now", style: "cancel", onPress: () => resolve(false) },
            { text: "Allow", onPress: () => resolve(true) },
          ],
          { pose: "search" },
        ),
      );
      if (!allow) {
        declinedThisSession = true;
        return null;
      }
      permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        declinedThisSession = true;
        return null;
      }
    }
    return await currentPoint();
  } catch {
    return null;
  }
}

async function currentPoint(): Promise<Point | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
  const fresh = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null),
    timeout,
  ]);
  const fix = fresh ?? (await Location.getLastKnownPositionAsync({ maxAge: 15 * 60 * 1000 }).catch(() => null));
  return fix ? { latitude: fix.coords.latitude, longitude: fix.coords.longitude } : null;
}
