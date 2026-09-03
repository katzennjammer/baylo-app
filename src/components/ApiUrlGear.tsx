import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  defaultApiBase,
  getApiBase,
  isApiBaseOverridden,
  onApiBaseChange,
  pingApiBase,
  resetApiBase,
  setApiBase,
} from "../api/config";
import { ChromeButton } from "./auth-thumbbar";
import { Tappable } from "./Tappable";
import { GearIcon } from "./auth-sheet-icons";
import { authSize, sheetColor } from "../theme/auth-sheet-tokens";
import { auth } from "../theme/palette";

/**
 * The gear, and the line of text under it that says where the app is pointing.
 *
 * This is a development affordance and it is staying. `adb reverse` drops on
 * every replug, reboot and adb-server restart, and when it does every request
 * fails against a URL that is still, technically, correct — a failure that
 * looks exactly like a broken app. Being able to read the current URL off the
 * screen and change it in place is the difference between a ten-second fix and
 * a Metro restart on a machine that may not be within reach.
 *
 * The URL is shown in the collapsed state, not hidden behind the gear. Half the
 * value here is answering "what is it pointing at" without a tap.
 */
export function ApiUrlGear({ variant = "row" }: { variant?: "row" | "icon" | "band" } = {}) {
  const [open, setOpen] = useState(false);
  const [base, setBase] = useState(getApiBase);

  // The sheet is not the only writer — hydrateApiBase() at boot also changes
  // this — so the label subscribes rather than reading once.
  useEffect(() => onApiBaseChange(setBase), []);

  // ── "band": the sheet-over-video auth screens ───────────────────────────
  //
  // The current direction has a 44px content row across the top of the video
  // band, and the gear rides its trailing end beside the wordmark. Unlike
  // "icon" it positions NOTHING — `BandRow` places it — because that row is
  // also where the back button and the "Cebu" pill live, and three things
  // absolutely positioned into the same corner is how they end up on top of
  // each other on a device nobody tested.
  if (variant === "band") {
    return (
      <>
        <Tappable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="API server settings"
          accessibilityHint={`Currently ${base || "not set"}`}
          style={{
            width: authSize.backButton,
            height: authSize.backButton,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <GearIcon color={sheetColor.onVideo} />
        </Tappable>
        <ApiUrlSheet visible={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  // ── "icon": the previous "Thumb Bar" auth direction ─────────────────────
  //
  // Kept for the screens still drawn that way. It positions itself absolutely
  // in the top-right corner and reads `AuthShell`'s context to do it, so it can
  // only be used inside one — which is why the sheet screens have their own
  // variant above rather than reusing this.
  if (variant === "icon") {
    return (
      <>
        <ChromeButton
          kind="gear"
          onPress={() => setOpen(true)}
          label="API server settings"
          hint={`Currently ${base || "not set"}`}
        />
        <ApiUrlSheet visible={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="API server settings"
        accessibilityHint={`Currently ${base || "not set"}`}
        // 44px floor, met by the row's own height rather than by padding that
        // would push the label away from the card.
        className="min-h-[44px] flex-row items-center justify-center gap-2 px-3 py-2"
        hitSlop={8}
      >
        <Text className="text-on-green-muted text-base leading-5">⚙</Text>
        <Text
          className="text-on-green-muted text-[12px] leading-4 shrink"
          numberOfLines={1}
          // The interesting end of a URL is the RIGHT one — the port, and which
          // host it is. A truncated `http://192.168.1…` says nothing.
          ellipsizeMode="head"
        >
          {base || "No API URL set"}
        </Text>
      </Pressable>

      <ApiUrlSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ApiUrlSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState(getApiBase);
  const [status, setStatus] = useState<{ ok: boolean; detail: string } | null>(null);
  const [busy, setBusy] = useState<"save" | "test" | "reset" | null>(null);

  // Reopening shows what is stored NOW, not whatever was left in the box last
  // time. An abandoned edit that reappears as if it had been saved is the one
  // way this control can actively mislead.
  useEffect(() => {
    if (visible) {
      setDraft(getApiBase());
      setStatus(null);
      setBusy(null);
    }
  }, [visible]);

  async function onSave() {
    setBusy("save");
    setStatus(null);
    try {
      await setApiBase(draft);
      onClose();
    } catch (err) {
      setStatus({ ok: false, detail: err instanceof Error ? err.message : "Could not save that." });
    } finally {
      setBusy(null);
    }
  }

  async function onTest() {
    setBusy("test");
    setStatus(null);
    setStatus(await pingApiBase(draft));
    setBusy(null);
  }

  async function onReset() {
    setBusy("reset");
    setStatus(null);
    await resetApiBase();
    setDraft(defaultApiBase);
    setBusy(null);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable className="flex-1 bg-black/50" onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View className="rounded-t-3xl bg-white px-5 pb-8 pt-5">
          <View className="self-center h-1 w-10 rounded-full bg-auth-card-line mb-4" />

          <Text className="text-ink text-lg font-bold">API server</Text>
          <Text className="text-ink-muted text-[13px] leading-5 mt-1 mb-4">
            Where this app sends every request. Saved on the device, so it
            survives a reload — the value in .env is only the starting point.
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text className="text-ink-muted text-[11px] font-semibold uppercase tracking-widest mb-1.5">
              Base URL
            </Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="http://localhost:3000"
              placeholderTextColor={auth["ink-muted"]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              className="h-12 rounded-xl border border-auth-field-line bg-auth-field px-4 text-ink text-base"
            />

            <Text className="text-ink-muted text-[12px] leading-4 mt-2">
              Built in: {defaultApiBase || "(none)"}
              {isApiBaseOverridden() ? "  ·  currently overridden" : ""}
            </Text>

            {status ? (
              <View
                className={`mt-3 rounded-xl px-4 py-3 ${
                  status.ok ? "bg-ok-wash" : "bg-danger-wash"
                }`}
              >
                <Text
                  className={`text-[13px] leading-5 ${
                    status.ok ? "text-ok-ink" : "text-danger-ink"
                  }`}
                >
                  {status.detail}
                </Text>
              </View>
            ) : null}

            <View className="flex-row gap-3 mt-4">
              <SheetButton
                label="Test"
                onPress={onTest}
                busy={busy === "test"}
                disabled={busy !== null}
              />
              <SheetButton
                label="Reset"
                onPress={onReset}
                busy={busy === "reset"}
                disabled={busy !== null}
              />
            </View>

            <Pressable
              onPress={onSave}
              disabled={busy !== null}
              accessibilityRole="button"
              className={`h-[52px] flex-row items-center justify-center rounded-full mt-3 ${
                busy === null ? "bg-accent active:bg-accent-2" : "bg-accent/40"
              }`}
            >
              {busy === "save" ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white text-[15px] font-bold tracking-wider uppercase">
                  Save
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SheetButton({
  label,
  onPress,
  busy,
  disabled,
}: {
  label: string;
  onPress: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`h-[48px] flex-1 flex-row items-center justify-center rounded-full border border-auth-field-line ${
        disabled ? "opacity-50" : "active:bg-auth-field"
      }`}
    >
      {busy ? (
        <ActivityIndicator color={auth.ink} />
      ) : (
        <Text className="text-ink text-[14px] font-semibold">{label}</Text>
      )}
    </Pressable>
  );
}
