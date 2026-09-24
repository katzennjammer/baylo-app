import { useSyncExternalStore } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { usePostedNotice } from "../post/posted-notice";
import { border, color, radius, size, textStyle, type } from "../theme/tokens";
import { Tappable } from "./Tappable";

/**
 * The app's dialog: a themed stand-in for React Native's `Alert.alert`.
 *
 * ── THE SAME CALL AS Alert.alert, ON PURPOSE ────────────────────────────────
 *
 * `showDialog(title, message?, buttons?)` takes exactly what `Alert.alert` took
 * — `{ text, style: "cancel" | "destructive" | "default", onPress }` — so every
 * call site moved over by changing one name, and none of their wording, order
 * or callbacks had to be re-decided on the way. It is imperative for the same
 * reason Alert is: most callers are mutation callbacks, not render code.
 *
 * ── A STORE AND ONE HOST, NOT A COMPONENT PER SCREEN ────────────────────────
 *
 * Same shape as `posted-notice.ts`: a module-level queue, drawn by
 * `<DialogHost />` mounted once in the root layout. A dialog therefore outlives
 * the screen that raised it — the Post flow's "boost after posting" confirm is
 * raised by a wizard that has already closed — and two raised back to back
 * (a confirm's own result, say) queue instead of stacking two scrims.
 *
 * It WAITS FOR THE POSTED POPUP. The post-then-boost path raises the boost
 * confirm in the same tick as "Your listing is up."; the queue holds it until
 * that card is dismissed, so the two read in order rather than on top of each
 * other.
 *
 * ── THE LOOK ────────────────────────────────────────────────────────────────
 *
 * NoticeDialog's card, measure for measure — surface fill, sheet radius, the
 * caption scrim, the display face for the title — so a confirmation and the
 * posted popup are visibly one family. Buttons are the app's primary button
 * (48 tall, primaryButton radius) in three tones:
 *
 *   default      green fill, on-green ink — the app's primary action
 *   destructive  urgent fill, surface ink — Block, Delete, Sign out
 *   cancel       outlined, ink — present, never the loudest thing
 *
 * One button fills the width. Two sit side by side, cancel first, so the
 * action is always under the right thumb. More than two stack -- and so do
 * two whose labels will not fit half a card (SIDE_BY_SIDE_MAX_CHARS below).
 *
 * ── DISMISSING ──────────────────────────────────────────────────────────────
 *
 * The scrim and the hardware back press the cancel button when there is one,
 * and the only button when there is just one ("OK"). A dialog with two actions
 * and no cancel has to be answered — neither is safe to pick on someone's
 * behalf.
 */

export interface DialogButton {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
}

interface Dialog {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
}

/**
 * The longest label that fits one of two side-by-side buttons on a 360dp
 * phone: 24 scrim + 24 card padding each side leaves 264, less the 10 gap is
 * 127 a button, less 16 padding each side is ~95px of 15px bold -- about 11
 * characters. Past that the label is cut to one line with an ellipsis, which
 * turned the staff roster's "Withdraw invitation" into "Withdraw in…"
 * (24 Sep 2026). Stacking gives every button the full width instead.
 */
const SIDE_BY_SIDE_MAX_CHARS = 11;

let queue: Dialog[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function showDialog(title: string, message?: string, buttons?: DialogButton[]) {
  const list = buttons && buttons.length > 0 ? buttons : [{ text: "OK" }];
  queue = [...queue, { id: nextId++, title, message, buttons: list }];
  emit();
}

/** Takes `id` off the queue, then runs the button — so a button that raises a dialog of its own queues it behind nothing. */
function answer(id: number, button: DialogButton | undefined) {
  // A second tap on a card that is already on its way out.
  if (queue[0]?.id !== id) return;
  queue = queue.slice(1);
  emit();
  button?.onPress?.();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const readHead = () => queue[0] ?? null;

export function DialogHost() {
  const head = useSyncExternalStore(subscribe, readHead, readHead);
  const postedUp = usePostedNotice() !== null;
  const dialog = postedUp ? null : head;

  const dismissal = dialog
    ? dialog.buttons.find((b) => b.style === "cancel") ??
      (dialog.buttons.length === 1 ? dialog.buttons[0] : undefined)
    : undefined;
  const dismiss = () => {
    if (dialog && dismissal) answer(dialog.id, dismissal);
  };

  const cancelFirst = dialog
    ? [...dialog.buttons].sort((a, b) => Number(b.style === "cancel") - Number(a.style === "cancel"))
    : [];
  const stacked =
    cancelFirst.length > 2 || cancelFirst.some((b) => b.text.length > SIDE_BY_SIDE_MAX_CHARS);

  return (
    <Modal
      visible={dialog !== null}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <Pressable
        style={s.scrim}
        onPress={dismiss}
        accessibilityRole={dismissal ? "button" : undefined}
        accessibilityLabel={dismissal ? dismissal.text : undefined}
      >
        {dialog ? (
          <Pressable onPress={() => {}} style={s.card} accessible={false} accessibilityViewIsModal>
            <Text style={[textStyle(type.errorHeadline), s.title]} accessibilityRole="header">
              {dialog.title}
            </Text>
            {dialog.message ? (
              <Text style={[textStyle(type.emptyBody), s.body]}>{dialog.message}</Text>
            ) : null}

            <View style={stacked ? s.buttonsStacked : s.buttonsRow}>
              {cancelFirst.map((b, i) => (
                <DialogButtonView
                  key={`${dialog.id}-${i}`}
                  button={b}
                  grow={!stacked}
                  onPress={() => answer(dialog.id, b)}
                />
              ))}
            </View>
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

function DialogButtonView({
  button,
  grow,
  onPress,
}: {
  button: DialogButton;
  grow: boolean;
  onPress: () => void;
}) {
  const tone = button.style ?? "default";
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={button.text}
      style={[
        tone === "cancel" ? s.cancel : tone === "destructive" ? s.destructive : s.primary,
        grow ? s.grow : null,
      ]}
      pressedStyle={s.pressed}
    >
      <Text
        style={[
          textStyle(type.primaryButton),
          {
            color:
              tone === "cancel" ? color.ink : tone === "destructive" ? color.surface : color.onGreen,
          },
        ]}
        numberOfLines={1}
      >
        {button.text}
      </Text>
    </Tappable>
  );
}

/** The box every tone shares, so only the colours are ever written three times. */
const buttonBox = {
  height: size.control.primaryButton,
  borderRadius: radius.primaryButton,
  borderWidth: border.chip,
  paddingHorizontal: 16,
  alignItems: "center",
  justifyContent: "center",
} as const;

const s = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: color.captionFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: color.surface,
    borderRadius: radius.sheet,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  title: { color: color.ink, textAlign: "center" },
  body: { color: color.inkSecondary, textAlign: "center", marginTop: 8 },
  buttonsRow: { flexDirection: "row", gap: 10, marginTop: 24 },
  buttonsStacked: { gap: 10, marginTop: 24 },
  grow: { flex: 1 },
  primary: { ...buttonBox, backgroundColor: color.green, borderColor: color.green },
  destructive: { ...buttonBox, backgroundColor: color.urgent, borderColor: color.urgent },
  cancel: { ...buttonBox, backgroundColor: color.surface, borderColor: color.controlLineStrong },
  pressed: { opacity: 0.85 },
});
