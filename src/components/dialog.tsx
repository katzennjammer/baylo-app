import { useSyncExternalStore } from "react";
import { StyleSheet } from "react-native";

import type { MascotPose } from "../media/mascots";
import { usePostedNotice } from "../post/posted-notice";
import { PopupActions, PopupButton, PopupSheet } from "./PopupSheet";

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
 * The queued alert uses the same bottom-sheet surface and button family as
 * NoticeDialog. Cancel remains secondary, default remains primary, and
 * destructive keeps its urgent fill.
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
  pose?: MascotPose;
}

/**
 * The cancel slot is 35% wide on a 360dp phone. Keep its label short enough
 * to fit; longer labels stack so none of the actions are truncated.
 */
const SIDE_BY_SIDE_MAX_CHARS = 8;

let queue: Dialog[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function showDialog(
  title: string,
  message?: string,
  buttons?: DialogButton[],
  options?: { pose?: MascotPose },
) {
  const list = buttons && buttons.length > 0 ? buttons : [{ text: "OK" }];
  queue = [...queue, { id: nextId++, title, message, buttons: list, pose: options?.pose }];
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

  const actionLayout = stacked ? "stacked" : cancelFirst.length > 1 ? "row" : "single";

  return (
    <PopupSheet
      visible={dialog !== null}
      title={dialog?.title ?? ""}
      message={dialog?.message}
      pose={dialog?.pose}
      onDismiss={dismissal ? dismiss : undefined}
      dismissLabel={dismissal?.text}
    >
      {dialog ? (
        <PopupActions layout={actionLayout}>
          {cancelFirst.map((button, index) => {
            const tone =
              button.style === "cancel"
                ? "secondary"
                : button.style === "destructive"
                  ? "destructive"
                  : "primary";
            const containerStyle =
              actionLayout !== "row"
                ? undefined
                : cancelFirst[0]?.style === "cancel"
                  ? index === 0
                    ? s.secondaryAction
                    : s.primaryAction
                  : s.equalAction;
            return (
              <PopupButton
                key={`${dialog.id}-${index}`}
                label={button.text}
                tone={tone}
                onPress={() => answer(dialog.id, button)}
                containerStyle={containerStyle}
              />
            );
          })}
        </PopupActions>
      ) : null}
    </PopupSheet>
  );
}

const s = StyleSheet.create({
  secondaryAction: { flex: 35 },
  primaryAction: { flex: 65 },
  equalAction: { flex: 1 },
});
