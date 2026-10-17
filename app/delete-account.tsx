import { useRouter } from "expo-router";

import { goBack } from "../src/lib/go-back";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { deleteAccount } from "../src/api/account";
import { ApiError } from "../src/api/client";
import { useSession } from "../src/auth/session";
import { showDialog } from "../src/components/dialog";
import { color, font } from "../src/theme/tokens";

const CONFIRM_WORD = "DELETE";

/**
 * Delete account -- the in-app deletion the app stores require.
 *
 * Two deliberate speed bumps, both mirrored from the server so neither is
 * theatre: typing DELETE (the route's `confirm` literal) and, for password
 * accounts, the password (what stops a stolen access token from being enough).
 * Then one last dialog, because this is the only irreversible button in the app.
 */
export default function DeleteAccountScreen() {
  const router = useRouter();
  const { signOut } = useSession();
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = !deleting && typed.trim().toUpperCase() === CONFIRM_WORD;

  function confirmDelete() {
    if (!canDelete) return;
    showDialog("Delete your account?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete account", style: "destructive", onPress: () => void runDelete() },
    ]);
  }

  async function runDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount(password);
    } catch (e) {
      setError(e instanceof ApiError && e.status < 500 ? e.message : "Check your connection and try again.");
      setDeleting(false);
      return;
    }
    // The server has already revoked every refresh token, so there is nothing
    // to revoke: `revoke: false` skips a request that could only be a no-op and
    // could hold this await for seconds. signOut() still clears the dead pair
    // from the device and drops the query cache.
    await signOut({ revoke: false });

    // THIS SCREEN HAS TO LEAVE ON ITS OWN. It is a root Stack route pushed over
    // the tabs (Settings -> Delete account), not a child of (app), so the
    // session guard in app/(app)/_layout.tsx swaps the TABS to the login screen
    // underneath while this screen — button still reading "Deleting…" — stays
    // on top until the app is restarted. Pop every stacked screen, then land on
    // sign-in explicitly.
    if (router.canDismiss()) router.dismissAll();
    router.replace("/(auth)/login");
    showDialog("Account deleted", "Your account and your listings have been removed.");
  }

  return (
    <View style={s.screen}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.top}>
          <Text style={s.title}>Delete account</Text>
        </View>

        <View style={s.warning}>
          <Text style={s.warningTitle}>This is permanent</Text>
          <Text style={s.warningBody}>
            {"• Your profile, name and photo are erased.\n" +
              "• Your listings are removed and pending offers are declined.\n" +
              "• Your messages are redacted.\n" +
              "• Your Leaves balance is lost and cannot be recovered.\n" +
              "• You will be signed out on every device."}
          </Text>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            style={s.input}
            placeholder="Password"
            placeholderTextColor={color.inkMuted}
            accessibilityLabel="Password"
          />
          <Text style={s.hint}>Leave blank if you sign in with Google.</Text>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Type {CONFIRM_WORD} to confirm</Text>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="characters"
            autoCorrect={false}
            style={s.input}
            placeholder={CONFIRM_WORD}
            placeholderTextColor={color.inkMuted}
            accessibilityLabel={`Type ${CONFIRM_WORD} to confirm`}
          />
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}
      </ScrollView>

      <View style={s.bottomActions}>
        <Pressable onPress={() => goBack(router)} style={s.cancelButton} accessibilityRole="button">
          <Text style={s.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={confirmDelete}
          disabled={!canDelete}
          style={[s.deleteButton, !canDelete && s.disabled]}
          accessibilityRole="button"
        >
          <Text style={s.deleteText}>{deleting ? "Deleting..." : "Delete account"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  top: { height: 64, alignItems: "center", justifyContent: "center", borderBottomWidth: 1, borderBottomColor: color.divider, marginBottom: 24 },
  title: { color: color.ink, fontFamily: font.sansBold, fontSize: 17 },
  warning: { borderWidth: 1, borderColor: color.urgentLine, backgroundColor: color.urgentWash, borderRadius: 8, padding: 14, gap: 6, marginBottom: 24 },
  warningTitle: { color: color.urgent, fontFamily: font.sansBold, fontSize: 15 },
  warningBody: { color: color.ink, fontFamily: font.sans, fontSize: 14, lineHeight: 21 },
  field: { marginBottom: 20 },
  label: { color: color.inkSecondary, fontFamily: font.sansSemi, fontSize: 12, marginBottom: 7 },
  input: { minHeight: 48, borderWidth: 1, borderColor: color.controlLine, borderRadius: 8, color: color.ink, fontFamily: font.sans, fontSize: 15, paddingHorizontal: 14, backgroundColor: color.control },
  hint: { color: color.inkMuted, fontFamily: font.sans, fontSize: 12, marginTop: 6 },
  error: { color: color.urgent, fontFamily: font.sansSemi, fontSize: 14 },
  bottomActions: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, borderTopWidth: 1, borderTopColor: color.divider, backgroundColor: color.surface },
  cancelButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: color.control },
  deleteButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: color.urgent },
  cancelText: { color: color.ink, fontFamily: font.sansSemi, fontSize: 14 },
  deleteText: { color: color.surface, fontFamily: font.sansSemi, fontSize: 14 },
  disabled: { opacity: 0.5 },
});
