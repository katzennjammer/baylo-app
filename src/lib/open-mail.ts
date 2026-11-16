import { Linking, Platform } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";

/**
 * Open the person's mail app on its INBOX, where Baylo's email is at the top.
 *
 * No app can open one particular email inside another app, so the inbox is
 * the target. Until 16 Nov 2026 Android used `mailto:`, which means "write a
 * new email": "Open email" under Show code landed on a blank compose screen.
 *
 *   iOS       `message:`, the Mail app's inbox (unchanged).
 *   Android   1. Gmail by package name: openApplication() launches it on its
 *                inbox, and it is on nearly every Android phone.
 *             2. Otherwise Android's "email app" intent (ACTION_MAIN +
 *                CATEGORY_APP_EMAIL), for phones whose mail app is another.
 *             3. Last resort, `mailto:`: compose, one back-press from the
 *                inbox, better than nothing.
 *
 * Resolves false only when nothing opened, so the caller can say "open your
 * inbox and look for the email from Baylo".
 */
export async function openMailApp(): Promise<boolean> {
  if (Platform.OS === "android") {
    try {
      IntentLauncher.openApplication("com.google.android.gm");
      return true;
    } catch {
      // No Gmail on this phone: try whichever app says it handles email.
    }
    // startActivityAsync resolves when the person comes BACK from the app,
    // so only a quick rejection (nothing can handle it) is treated as failure.
    const launched = IntentLauncher.startActivityAsync("android.intent.action.MAIN", {
      category: "android.intent.category.APP_EMAIL",
    }).then(
      () => true,
      () => false,
    );
    const opened = await Promise.race([
      launched,
      new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 700)),
    ]);
    if (opened) return true;
  }
  try {
    await Linking.openURL(Platform.OS === "ios" ? "message:" : "mailto:");
    return true;
  } catch {
    return false;
  }
}
