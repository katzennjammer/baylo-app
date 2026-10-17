import { Linking, Platform } from "react-native";

/**
 * Open the phone's mail app, as near to the inbox as the platform allows.
 * iOS has `message:` for the Mail inbox; Android has no inbox scheme, so
 * `mailto:` opens the default mail app at a blank compose, which is one
 * back-press from the inbox. Resolves false when nothing could open it.
 */
export async function openMailApp(): Promise<boolean> {
  try {
    await Linking.openURL(Platform.OS === "ios" ? "message:" : "mailto:");
    return true;
  } catch {
    return false;
  }
}
