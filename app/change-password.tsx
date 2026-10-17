import { useRouter } from "expo-router";

import { goBack } from "../src/lib/go-back";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { MIN_PASSWORD_LENGTH, changePassword } from "../src/api/account";
import { ApiError } from "../src/api/client";
import { showDialog } from "../src/components/dialog";
import { color, font } from "../src/theme/tokens";

/**
 * Change password. Same frame as Edit profile: title bar, fields, and a
 * Cancel / Save pair pinned to the bottom.
 *
 * Current password is labelled optional-for-Google rather than hidden, because
 * the app does not know which kind of account this is -- the server does, and
 * says "Current password is required" if it was needed after all.
 */
export default function ChangePasswordScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && next !== confirm;
  const canSave = !saving && next.length >= MIN_PASSWORD_LENGTH && next === confirm;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      showDialog("Password changed", "Use your new password the next time you sign in.", [
        { text: "Done", onPress: () => goBack(router) },
      ]);
    } catch (e) {
      // The server's 400s ("Current password is incorrect") are written for
      // people; anything else is a transport failure.
      setError(e instanceof ApiError && e.status < 500 ? e.message : "Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={s.screen}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.top}>
          <Text style={s.title}>Change password</Text>
        </View>

        <PasswordField
          label="Current password"
          hint="Leave blank if you signed up with Google and never set one."
          value={current}
          onChangeText={setCurrent}
          autoComplete="current-password"
        />
        <PasswordField
          label="New password"
          hint={tooShort ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
          hintIsError={tooShort}
          value={next}
          onChangeText={setNext}
          autoComplete="new-password"
        />
        <PasswordField
          label="Confirm new password"
          hint={mismatch ? "Passwords do not match." : undefined}
          hintIsError={mismatch}
          value={confirm}
          onChangeText={setConfirm}
          autoComplete="new-password"
        />

        {error ? <Text style={s.error}>{error}</Text> : null}
      </ScrollView>

      <View style={s.bottomActions}>
        <Pressable onPress={() => goBack(router)} style={s.cancelButton} accessibilityRole="button">
          <Text style={s.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => void save()}
          disabled={!canSave}
          style={[s.saveButton, !canSave && s.disabled]}
          accessibilityRole="button"
        >
          <Text style={s.saveText}>{saving ? "Saving..." : "Save"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PasswordField({
  label,
  hint,
  hintIsError = false,
  value,
  onChangeText,
  autoComplete,
}: {
  label: string;
  hint?: string;
  hintIsError?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  autoComplete: "current-password" | "new-password";
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        style={s.input}
        placeholder={label}
        placeholderTextColor={color.inkMuted}
        accessibilityLabel={label}
      />
      {hint ? <Text style={[s.hint, hintIsError && s.hintError]}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  top: { height: 64, alignItems: "center", justifyContent: "center", borderBottomWidth: 1, borderBottomColor: color.divider, marginBottom: 24 },
  title: { color: color.ink, fontFamily: font.sansBold, fontSize: 17 },
  field: { marginBottom: 20 },
  label: { color: color.inkSecondary, fontFamily: font.sansSemi, fontSize: 12, marginBottom: 7 },
  input: { minHeight: 48, borderWidth: 1, borderColor: color.controlLine, borderRadius: 8, color: color.ink, fontFamily: font.sans, fontSize: 15, paddingHorizontal: 14, backgroundColor: color.control },
  hint: { color: color.inkMuted, fontFamily: font.sans, fontSize: 12, marginTop: 6 },
  hintError: { color: color.urgent },
  error: { color: color.urgent, fontFamily: font.sansSemi, fontSize: 14 },
  bottomActions: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, borderTopWidth: 1, borderTopColor: color.divider, backgroundColor: color.surface },
  cancelButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: color.control },
  saveButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: color.green },
  cancelText: { color: color.ink, fontFamily: font.sansSemi, fontSize: 14 },
  saveText: { color: color.onGreen, fontFamily: font.sansSemi, fontSize: 14 },
  disabled: { opacity: 0.5 },
});
