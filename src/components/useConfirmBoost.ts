import { useCallback } from "react";

import { ApiError } from "../api/client";
import { BOOST_COST_LEAVES, BOOST_HOURS, useBoostItem } from "../api/featured";
import { showDialog } from "./dialog";

/**
 * The Boost confirmation, shared by the item screen and Profile → My Listings
 * so the two cannot quote different prices or handle a refusal differently.
 *
 * Confirm → POST → a one-line result. The refusals the server can send are
 * each a sentence the owner can act on; `already_featured` in particular is
 * what a retry after a lost response sees, so it reads as good news, not as
 * an error.
 *
 * THE RESULT RIDES THE PROMISE, NOT mutate()'s CALLBACKS. TanStack drops
 * per-call callbacks once the calling component unmounts, and the Post flow's
 * "boost after posting" calls this from a screen that closes as the listing
 * lands — so the one message it must always show, "the boost didn't go
 * through", would have been the one that silently vanished.
 *
 * `afterPost` is that caller: the listing is already up, so a refusal says so
 * in front of the reason. Nothing here can touch the post.
 */
export function useConfirmBoost() {
  const boost = useBoostItem();

  const confirmBoost = useCallback(
    (item: { id: string; title: string }, opts?: { afterPost?: boolean }) => {
      showDialog(
        "Boost this listing?",
        `Feature this for ${BOOST_HOURS} hours for ${BOOST_COST_LEAVES} Leaves?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm",
            onPress: () => {
              boost.mutateAsync(item.id).then(
                () =>
                  showDialog(
                    "Listing featured",
                    `"${item.title}" is in Featured for the next ${BOOST_HOURS} hours.`,
                  ),
                (e: unknown) => {
                  const [title, body] = boostErrorCopy(e);
                  showDialog(
                    title,
                    opts?.afterPost
                      ? `Your listing is posted, but the boost didn't go through. ${body}`
                      : body,
                  );
                },
              );
            },
          },
        ],
      );
    },
    [boost],
  );

  return { confirmBoost, isBoosting: boost.isPending };
}

function boostErrorCopy(e: unknown): [string, string] {
  if (!(e instanceof ApiError)) return ["Could not boost", "Something went wrong. Please try again."];
  switch (e.meta.rule) {
    case "insufficient_leaves":
      return [
        "Not enough Leaves",
        `Boosting costs ${BOOST_COST_LEAVES} Leaves. Leaves promised to an open offer can't be spent here.`,
      ];
    case "already_featured":
      return ["Already featured", "This listing is already in Featured. You can boost it again once that ends."];
    case "perishable":
      return ["Can't boost this one", "Perishable listings already appear in Exclusive."];
    case "not_available":
      return ["Can't boost this one", "Only available listings can be featured."];
  }
  // The limiter answers outside the envelope, so the status is the reliable signal.
  if (e.status === 429) return ["Slow down", "Too many attempts. Try again in a little while."];
  return ["Could not boost", e.message];
}
