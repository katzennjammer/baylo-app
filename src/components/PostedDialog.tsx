import { dismissPostedNotice, usePostedNotice } from "../post/posted-notice";
import { color } from "../theme/tokens";
import { CheckIcon } from "./icons";
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
 */
export function PostedDialog() {
  const notice = usePostedNotice();

  return (
    <NoticeDialog
      visible={notice !== null}
      title="Your listing is up."
      body="It's live in the marketplace and feed now."
      icon={<CheckIcon size={24} stroke={2} color={color.forest} />}
      onDismiss={dismissPostedNotice}
    />
  );
}
