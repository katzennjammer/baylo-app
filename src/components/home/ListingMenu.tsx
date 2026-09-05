import { useEffect, useState } from "react";
import { Alert } from "react-native";

import { BlockIcon, FlagIcon, PencilIcon, TrashIcon } from "../icons";
import { ReportReasonRows } from "../ReportSheet";
import { SheetRow, SheetRows, SheetShell } from "../sheet-ui";
import { ApiError } from "../../api/client";
import { useBlockUser, useDeleteItem, useReport } from "../../api/item";
import { color, icon } from "../../theme/tokens";
import type { Item } from "../../api/types";

/**
 * The three dots on the owner row, wired.
 *
 * ── ONE SHEET FOR THE WHOLE FEED ────────────────────────────────────────────
 *
 * Mounted once by the feed screen and handed whichever item was tapped, NOT
 * rendered inside FeedCard. A `Modal` per card is a native modal host per card:
 * twenty of them on screen, each with its own mount cost and its own animation
 * driver, for a control that can only ever be open once. The card raises
 * `onMenu(item)` and knows nothing about what happens next.
 *
 * ── WHAT IS OFFERED DEPENDS ON WHOSE LISTING IT IS ──────────────────────────
 *
 * Somebody else's:  report the listing · report the person · block the person
 * Your own:         edit · remove
 *
 * The two sets do not overlap, and that is the server's rule showing through
 * rather than a design choice: POST /api/v1/reports answers 403 SELF_REPORT for
 * your own listing and your own account, and POST /api/v1/blocks answers 400
 * for blocking yourself. Offering rows that are guaranteed to fail is the same
 * mistake as a menu that does nothing.
 *
 * ── THE REASON PICKER IS A PANEL, NOT A SECOND MODAL ────────────────────────
 *
 * Picking a reason swaps the sheet's contents in place and lights the back
 * chevron. Pushing a second Modal instead would put a scrim over a scrim, and
 * on Android the inner one's hardware back dismisses both — so somebody backing
 * out of the reason list would lose the menu too.
 *
 * The rows themselves come from `ReportReasonRows`, shared with the item detail
 * screen. See that file for why neither screen may use `Alert` for this.
 *
 * CONFIRMATIONS STAY AS ALERTS. Block and remove are two buttons plus a cancel,
 * which is inside Android's three-button ceiling, and an OS dialog is the right
 * weight for "are you sure" — it is modal over everything, it cannot be mistaken
 * for part of the sheet, and it is what a destructive confirmation looks like on
 * both platforms.
 */

type Panel = "menu" | "report-listing" | "report-user";

export function ListingMenu({
  item,
  viewerId,
  onClose,
  onEdit,
}: {
  /** The listing whose menu is open. Null closes the sheet. */
  item: Item | null;
  /** Who is looking. Null while /home is still loading — treated as "not mine". */
  viewerId: string | null;
  onClose: () => void;
  /** Raised instead of editing here: the edit sheet is the screen's to own. */
  onEdit: (item: Item) => void;
}) {
  const [panel, setPanel] = useState<Panel>("menu");

  const report = useReport();
  const block = useBlockUser();
  const remove = useDeleteItem();

  // Back to the root panel whenever a DIFFERENT listing's menu opens. Without
  // this, dismissing the sheet from the reason picker and tapping another
  // card's dots would reopen straight into the picker — pointed at the listing
  // that is no longer on screen.
  //
  // Keyed on the id, not the object. The screen resolves `item` out of the feed
  // cache on every render, so a background refetch hands this component a new
  // object with identical contents — and depending on the object would throw
  // somebody back to the root panel mid-way through choosing a report reason,
  // for no reason they could see.
  useEffect(() => {
    if (item) setPanel("menu");
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;

  const isMine = viewerId !== null && item.owner.id === viewerId;
  const busy = report.isPending || block.isPending || remove.isPending;
  const reporting = panel !== "menu";

  const sendReport = (category: string) => {
    const targetType = panel === "report-user" ? "user" : "listing";
    report.mutate(
      {
        targetType,
        targetId: targetType === "user" ? item.owner.id : item.id,
        category,
      },
      {
        onSuccess: () => {
          onClose();
          Alert.alert(
            "Thanks — that is with a moderator",
            "They review every report and will let you know the outcome.",
          );
        },
        onError: (e) => {
          onClose();
          Alert.alert(
            // A 409 is not a failure: this reporter already has an open report
            // against this target. Saying so is the truthful answer and stops
            // them retrying something the server will refuse identically.
            e instanceof ApiError && e.code === "CONFLICT"
              ? "Already reported"
              : "Could not send that report",
            e instanceof ApiError ? e.message : "Something went wrong. Please try again.",
          );
        },
      },
    );
  };

  const confirmBlock = () => {
    Alert.alert(
      `Block ${item.owner.name}?`,
      "You will not see each other's listings and neither of you can message the other. " +
        "Trades already in progress are not cancelled — a block cannot undo a handover, " +
        "and it does not clear a deferred agreement.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () =>
            block.mutate(item.owner.id, {
              onSuccess: () => {
                onClose();
                Alert.alert(
                  `${item.owner.name} is blocked`,
                  "Their listings are gone from your feed. You can undo this in Settings.",
                );
              },
              onError: (e) => {
                onClose();
                Alert.alert(
                  "Could not block",
                  e instanceof ApiError ? e.message : "Something went wrong. Please try again.",
                );
              },
            }),
        },
      ],
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      "Remove this listing?",
      "It leaves the feed and the marketplace straight away. Offers and messages about it " +
        "are kept, and a trade already under way is not cancelled.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            remove.mutate(item.id, {
              onSuccess: onClose,
              onError: (e) => {
                onClose();
                Alert.alert(
                  "Could not remove that",
                  e instanceof ApiError ? e.message : "Something went wrong. Please try again.",
                );
              },
            }),
        },
      ],
    );
  };

  return (
    <SheetShell
      title={
        reporting
          ? `Why are you reporting ${panel === "report-user" ? item.owner.name : "this listing"}?`
          : item.title
      }
      onBack={reporting ? () => setPanel("menu") : undefined}
      onClose={onClose}
      busy={busy}
    >
      {reporting ? (
        <ReportReasonRows onPick={sendReport} disabled={busy} />
      ) : isMine ? (
        <SheetRows>
          <SheetRow
            glyph={
              <PencilIcon
                size={icon.menuRow.size}
                stroke={icon.menuRow.stroke}
                color={color.inkSecondary}
              />
            }
            label="Edit listing"
            disabled={busy}
            onPress={() => onEdit(item)}
          />
          <SheetRow
            glyph={
              <TrashIcon
                size={icon.menuRow.size}
                stroke={icon.menuRow.stroke}
                color={color.urgent}
              />
            }
            label="Remove listing"
            destructive
            disabled={busy}
            onPress={confirmDelete}
          />
        </SheetRows>
      ) : (
        <SheetRows>
          <SheetRow
            glyph={
              <FlagIcon
                size={icon.menuRow.size}
                stroke={icon.menuRow.stroke}
                color={color.inkSecondary}
              />
            }
            label="Report this listing"
            disabled={busy}
            onPress={() => setPanel("report-listing")}
          />
          <SheetRow
            glyph={
              <FlagIcon
                size={icon.menuRow.size}
                stroke={icon.menuRow.stroke}
                color={color.inkSecondary}
              />
            }
            label={`Report ${item.owner.name}`}
            disabled={busy}
            onPress={() => setPanel("report-user")}
          />
          <SheetRow
            glyph={
              <BlockIcon
                size={icon.menuRow.size}
                stroke={icon.menuRow.stroke}
                color={color.urgent}
              />
            }
            label={`Block ${item.owner.name}`}
            destructive
            disabled={busy}
            onPress={confirmBlock}
          />
        </SheetRows>
      )}
    </SheetShell>
  );
}
