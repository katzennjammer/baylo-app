import { dismissPostedNotice, usePostedNotice } from "../post/posted-notice";
import { color } from "../theme/tokens";
import { CheckIcon } from "./icons";
import { ClockIcon } from "./post/post-icons";
import { NoticeDialog } from "./NoticeDialog";

/**
 * The popup after a listing is posted.
 *
 * Mounted ONCE, in the root layout, and drawn over whatever screen the person
 * came back to — see `src/post/posted-notice.ts` for why it is not part of the
 * wizard. It replaces the full success screen the wizard used to end on: that
 * screen was a blank page with one sentence on it, and a sentence is a popup's
 * worth of information, not a screen's.
 *
 * ── ONE ACTION ──────────────────────────────────────────────────────────────
 *
 * The only control is OK. The listing is already in the feed and the grid
 * behind this card (the post invalidated both caches before it closed), so
 * "see it in the feed" would be a button that dismisses the dialog and then
 * scrolls nowhere. The scrim and the hardware back are the same OK, so there
 * is no way to be stuck behind it.
 *
 * A centred card rather than a bottom sheet because it is not a menu and asks
 * for no decision. `SheetShell` is for a column of rows with a Cancel; this is
 * a statement with an acknowledgement, and a sheet would make it look like it
 * wanted something.
 *
 * ── THE REVIEW VARIANT SAYS "WAITING", NOT "UP" ─────────────────────────────
 *
 * An owner who set a value more than one bracket above the suggestion was
 * told on the value step that a person checks it first. This is where that
 * promise is kept: the listing exists, it is theirs to see, and nobody else
 * sees it until an admin approves — so the dialog says exactly that, in the
 * server's own sentence, and does not claim a listing is live when it is not.
 */
export function PostedDialog() {
  const notice = usePostedNotice();

  const review = notice?.reviewNotice ?? null;

  return (
    <NoticeDialog
      visible={notice !== null}
      title={review ? "Your listing is waiting for a check." : "Your listing is up."}
      body={review ?? "It's live in the marketplace and feed now."}
      icon={
        review ? (
          <ClockIcon size={24} stroke={2} color={color.forest} />
        ) : (
          <CheckIcon size={24} stroke={2} color={color.forest} />
        )
      }
      onDismiss={dismissPostedNotice}
    />
  );
}
