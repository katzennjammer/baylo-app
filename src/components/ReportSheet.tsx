import { SheetNote, SheetRow, SheetRows, SheetShell } from "./sheet-ui";
import { REPORT_REASONS, type ReportTarget } from "../api/item";

/**
 * Choosing a report reason — the six of them, as rows.
 *
 * ── WHY THIS IS NOT AN Alert, ANYWHERE ──────────────────────────────────────
 *
 * `Alert.alert` ON ANDROID RENDERS AT MOST THREE BUTTONS. React Native maps the
 * array onto an AlertDialog's three slots — negative, neutral, positive — and
 * DROPS everything past the third. Silently: no warning, no error, no crash.
 *
 * Six reasons plus a Cancel is seven buttons, so on Android testers were being
 * offered three of them, and WHICH three is an artefact of the mapping rather
 * than anything anyone chose. Somebody reporting a scam could find that "Scam
 * or fraud" was simply not on the menu. On iOS all seven render, which is what
 * made it survive review: it looked correct on the simulator and was wrong on
 * every real device the app is aimed at.
 *
 * There is no cap to work around here, only a control that was the wrong shape.
 * A list of six mutually exclusive choices is a list, and a list belongs in a
 * sheet where it can be read top to bottom.
 *
 * ── ONE PICKER, TWO SCREENS ─────────────────────────────────────────────────
 *
 * Rendered as a PANEL inside the feed's overflow menu (which has to get back to
 * its own root) and as a whole SHEET on the item detail screen (which has
 * nowhere to go back to). Those are two different containers, so the rows and
 * the note live here and the container is the caller's — which is what keeps
 * the wording and the ordering identical on both without either one owning the
 * other.
 */

export function ReportReasonRows({
  onPick,
  disabled = false,
}: {
  onPick: (category: string) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <SheetRows>
        {REPORT_REASONS.map((r) => (
          <SheetRow key={r.value} label={r.label} disabled={disabled} onPress={() => onPick(r.value)} />
        ))}
      </SheetRows>

      {/*
        Three facts, and each one answers a question people actually hesitate
        over before tapping: is this read by a person, does it take the listing
        down on its own, and will they know it was me.
      */}
      <SheetNote>
        A moderator reads every report. Nothing is hidden automatically, and the person you
        report is not told who reported them.
      </SheetNote>
    </>
  );
}

/**
 * The picker as a sheet of its own, for a screen with no menu around it.
 *
 * `targetName` is the phrase that completes "Why are you reporting …", so it
 * arrives already in the right form — "this listing", or a person's name. The
 * caller knows which it is; this does not need to.
 */
export function ReportSheet({
  target,
  targetName,
  busy = false,
  onPick,
  onClose,
}: {
  /** Only for the accessibility of the title. The category is the caller's to send. */
  target: ReportTarget;
  targetName: string;
  busy?: boolean;
  onPick: (category: string) => void;
  onClose: () => void;
}) {
  return (
    <SheetShell
      title={`Why are you reporting ${targetName}?`}
      onClose={onClose}
      busy={busy}
      closeLabel={target === "user" ? "Never mind" : "Cancel"}
    >
      <ReportReasonRows onPick={onPick} disabled={busy} />
    </SheetShell>
  );
}
