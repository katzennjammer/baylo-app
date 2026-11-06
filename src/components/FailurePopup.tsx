import { useEffect } from "react";

import { showDialog } from "./dialog";

/**
 * A failure, raised as the app's dialog with the worried duck instead of a
 * line of red text.
 *
 * The trade screens used to print a refused accept, withdraw or meetup as
 * small red text near the bottom of the screen, where it was easy to miss
 * (and was missed: the tier-cap refusal sat there unread). Each of those spots
 * now renders this instead, so the message pops up the moment it is set.
 *
 * It fires when `message` CHANGES to a non-empty string. Every caller clears
 * its failure to null before the next attempt, so the same refusal twice in a
 * row still pops up twice.
 */
export function FailurePopup({ message, title = "That did not go through" }: { message: string | null | undefined; title?: string }) {
  useEffect(() => {
    if (message) showDialog(title, message, [{ text: "Got it" }], { pose: "worry" });
  }, [message, title]);
  return null;
}
