import { useRouter } from "expo-router";

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
 * ── LIVE POSTS CAN BE OPENED; REVIEW POSTS CANNOT CLAIM TO BE LIVE ──────────
 *
 * The notice carries the title, lead photo and id from the post that just
 * completed. A live listing can open its existing `/item` route; a value under
 * review keeps the server's waiting copy and acknowledgement instead.
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
  const router = useRouter();
  const notice = usePostedNotice();
  const review = notice?.reviewNotice ?? null;
  const live = notice !== null && review === null;

  const seeListing = () => {
    if (!notice) return;
    const itemId = notice.itemId;
    dismissPostedNotice();
    router.push({ pathname: "/item", params: { id: itemId } });
  };

  return (
    <NoticeDialog
      visible={notice !== null}
      title={review ? "Your listing is waiting for a check." : "Quack! Your listing's out there."}
      body={review ?? "It's live in the marketplace and feed now."}
      icon={
        review ? (
          <ClockIcon size={24} stroke={2} color={color.forest} />
        ) : (
          <CheckIcon size={24} stroke={2} color={color.forest} />
        )
      }
      pose={review ? undefined : "box"}
      buttonLabel={review ? undefined : "Nice"}
      listingPreview={
        live
          ? {
              title: notice.listingTitle,
              photoUrl: notice.photoUrl,
            }
          : undefined
      }
      onViewListing={live ? seeListing : undefined}
      onDismiss={dismissPostedNotice}
    />
  );
}
