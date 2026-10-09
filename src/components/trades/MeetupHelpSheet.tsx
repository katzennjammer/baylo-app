import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Linking, StyleSheet, Text, View } from "react-native";

import { ApiError } from "../../api/client";
import { REPORT_REASONS, useReport } from "../../api/item";
import { useCancelTrade } from "../../api/trades";
import type { ActiveTrade } from "../../api/types";
import { ReportReasonRows } from "../ReportSheet";
import { showDialog } from "../dialog";
import { CloseIcon, FlagIcon, MessageIcon, PencilIcon, PinIcon, WarningIcon } from "../icons";
import { SheetNote, SheetRow, SheetRows, SheetShell } from "../sheet-ui";
import * as copy from "./copy";
import { color, icon, space, textStyle, type } from "../../theme/tokens";

/**
 * "What happened?" — the help sheet behind "Something went wrong at the
 * meetup?", from the handoff panel and from the trade screen's ⋯ menu.
 *
 * ══ ONLY WHAT ALREADY EXISTS ════════════════════════════════════════════════
 *
 *   message     /(app)/messages?partner=        the conversation
 *   reschedule  /trade-meetup?id=               ACCEPTED only (see below)
 *   cancel      PATCH /api/trades/[id] cancel   useCancelTrade(); items back
 *                                               to AVAILABLE, a held bridging
 *                                               fee returned to its payer
 *   report      POST /api/v1/reports            useReport(), target "user"
 *   call 911    tel:911                         the phone's own dialer
 *
 * RESCHEDULING IS ACCEPTED-ONLY because the meetup route is: once the codes
 * are issued the trade is CONFIRMING, and POST /api/v1/trades/[id]/meetup
 * answers 409 "moved past arranging a meeting". Offering the row there would
 * open a picker whose every send fails.
 *
 * A REPORT CANNOT NAME A TRADE — the server's targets are listing, user,
 * message and story — so the report is against the person, and the trade id
 * and the reason ride in `notes`, written by helpReportNotes() rather than
 * typed. The category is the user's, from the same ReportReasonRows every
 * other report uses; "I felt unsafe" starts on harassment and can change it.
 *
 * Panels swap in place inside one SheetShell, with its back chevron, rather
 * than stacking a second Modal (see SheetShell's note on `onBack`).
 */

export type HelpReason = keyof typeof copy.help.reason;
export type HelpAction = "message" | "reschedule" | "cancel" | "call911" | "report";

const REASONS: readonly HelpReason[] = ["noShow", "notAsDescribed", "unsafe", "other"];

/** The server's MAX_REPORT_NOTES (@/lib/moderation in the API). */
export const REPORT_NOTES_MAX = 2000;

/** The category "I felt unsafe" starts on. The nearest of the six. */
export const UNSAFE_DEFAULT_CATEGORY = "harassment";

/**
 * Which actions a reason offers, in order, on a trade in `status`. Pure, so
 * scripts/verify-meetup-chat.ts can hold the ACCEPTED-only rule in place.
 */
export function helpActions(reason: HelpReason, status: ActiveTrade["status"]): HelpAction[] {
  switch (reason) {
    case "noShow":
      return status === "ACCEPTED" ? ["message", "cancel", "reschedule"] : ["message", "cancel"];
    case "notAsDescribed":
      return ["message", "cancel"];
    case "unsafe":
      return ["call911", "report", "cancel"];
    case "other":
      return ["message", "report"];
  }
}

/** The report's notes: the trade and the reason, never longer than the server takes. */
export function helpReportNotes(tradeId: string, reason: HelpReason): string {
  return copy.help.notes(tradeId, copy.help.reason[reason]).slice(0, REPORT_NOTES_MAX);
}

type Panel =
  | { kind: "reasons" }
  | { kind: "actions"; reason: HelpReason }
  | { kind: "pickCategory"; reason: HelpReason }
  | { kind: "confirmReport"; reason: HelpReason };

export function MeetupHelpSheet({
  trade,
  partner,
  onClose,
}: {
  trade: ActiveTrade;
  partner: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const report = useReport();
  const cancelTrade = useCancelTrade();
  const [panel, setPanel] = useState<Panel>({ kind: "reasons" });
  const [category, setCategory] = useState<string | null>(null);
  const busy = report.isPending || cancelTrade.isPending;

  // The 911 line is first in reading order on its panel; announcing it as
  // well means TalkBack says it on arrival rather than after a swipe.
  const unsafeShowing = panel.kind === "actions" && panel.reason === "unsafe";
  useEffect(() => {
    if (unsafeShowing) AccessibilityInfo.announceForAccessibility(copy.help.danger);
  }, [unsafeShowing]);

  const rowIcon = (Glyph: typeof MessageIcon, tint: string = color.inkSecondary) => (
    <Glyph size={icon.menuRow.size} stroke={icon.menuRow.stroke} color={tint} />
  );

  const message = () => {
    onClose();
    router.push(`/(app)/messages?partner=${encodeURIComponent(trade.counterparty.id)}`);
  };

  const reschedule = () => {
    onClose();
    router.push(`/trade-meetup?id=${encodeURIComponent(trade.id)}`);
  };

  const call911 = () => {
    Linking.openURL("tel:911").catch(() =>
      showDialog(copy.help.callFailed, copy.help.callFailedBody),
    );
  };

  const cancel = () =>
    showDialog(copy.help.cancelTitle, copy.help.cancelBody, [
      { text: copy.help.keep, style: "cancel" },
      {
        text: copy.help.cancelConfirm,
        style: "destructive",
        // useCancelTrade() invalidates the trade lists on success, which is
        // what moves the trade screen on to the cancelled trade.
        onPress: () =>
          cancelTrade.mutate(trade.id, {
            onSuccess: onClose,
            onError: (e) =>
              showDialog(
                copy.help.cancelFailed,
                e instanceof ApiError ? e.message : "Nothing has changed. Try again.",
              ),
          }),
      },
    ]);

  const startReport = (reason: HelpReason) => {
    if (reason === "unsafe") {
      setCategory(UNSAFE_DEFAULT_CATEGORY);
      setPanel({ kind: "confirmReport", reason });
    } else {
      setCategory(null);
      setPanel({ kind: "pickCategory", reason });
    }
  };

  const sendReport = (reason: HelpReason) => {
    if (!category) return;
    report.mutate(
      {
        targetType: "user",
        targetId: trade.counterparty.id,
        category,
        notes: helpReportNotes(trade.id, reason),
      },
      {
        onSuccess: () => {
          onClose();
          showDialog(copy.help.reportSent);
        },
        onError: (e) => {
          onClose();
          // A 409 is the one-live-report rule: already reported, not a failure.
          if (e instanceof ApiError && e.status === 409) {
            showDialog(copy.help.reportAlreadyOpen(partner));
          } else {
            showDialog(
              copy.help.reportFailed,
              e instanceof ApiError ? e.message : "Something went wrong. Please try again.",
            );
          }
        },
      },
    );
  };

  const actionRow = (action: HelpAction, reason: HelpReason) => {
    switch (action) {
      case "message":
        return (
          <SheetRow
            key={action}
            glyph={rowIcon(MessageIcon)}
            label={copy.tradeScreen.message(partner)}
            disabled={busy}
            onPress={message}
          />
        );
      case "reschedule":
        return (
          <SheetRow
            key={action}
            glyph={rowIcon(PinIcon)}
            label={copy.help.reschedule}
            disabled={busy}
            onPress={reschedule}
          />
        );
      case "cancel":
        return (
          <SheetRow
            key={action}
            glyph={rowIcon(CloseIcon, color.urgent)}
            label={copy.help.cancel}
            destructive
            disabled={busy}
            onPress={cancel}
          />
        );
      case "call911":
        return (
          <SheetRow
            key={action}
            glyph={rowIcon(WarningIcon, color.urgent)}
            label={copy.help.call}
            destructive
            onPress={call911}
          />
        );
      case "report":
        return (
          <SheetRow
            key={action}
            glyph={rowIcon(FlagIcon)}
            label={reason === "other" ? copy.help.reportProblem : copy.help.report(partner)}
            disabled={busy}
            onPress={() => startReport(reason)}
          />
        );
    }
  };

  let title: string = copy.help.title;
  let onBack: (() => void) | undefined;
  let body: React.ReactNode;

  switch (panel.kind) {
    case "reasons":
      body = (
        <SheetRows>
          {REASONS.map((r) => (
            <SheetRow
              key={r}
              label={copy.help.reason[r]}
              onPress={() => setPanel({ kind: "actions", reason: r })}
            />
          ))}
        </SheetRows>
      );
      break;

    case "actions": {
      const { reason } = panel;
      title = copy.help.reason[reason];
      onBack = () => setPanel({ kind: "reasons" });
      body = (
        <>
          {reason === "unsafe" ? (
            <View style={s.danger} accessible accessibilityRole="alert">
              <Text style={[textStyle(type.dangerAction), { color: color.urgent }]}>
                {copy.help.danger}
              </Text>
            </View>
          ) : null}
          <SheetRows>{helpActions(reason, trade.status).map((a) => actionRow(a, reason))}</SheetRows>
        </>
      );
      break;
    }

    case "pickCategory": {
      const { reason } = panel;
      title = copy.help.reportPickTitle(partner);
      // Back from the picker: to the confirm panel when a category is already
      // chosen (the user came here to change it), otherwise to the actions.
      onBack = () =>
        setPanel(category ? { kind: "confirmReport", reason } : { kind: "actions", reason });
      body = (
        <ReportReasonRows
          disabled={busy}
          onPick={(c) => {
            setCategory(c);
            setPanel({ kind: "confirmReport", reason });
          }}
        />
      );
      break;
    }

    case "confirmReport": {
      const { reason } = panel;
      const label = REPORT_REASONS.find((r) => r.value === category)?.label ?? category ?? "";
      title = copy.help.report(partner);
      onBack = () => setPanel({ kind: "actions", reason });
      body = (
        <>
          <SheetRows>
            <SheetRow
              glyph={rowIcon(PencilIcon)}
              label={copy.help.reportReason(label)}
              disabled={busy}
              onPress={() => setPanel({ kind: "pickCategory", reason })}
            />
            <SheetRow
              glyph={rowIcon(FlagIcon)}
              label={copy.help.sendReport}
              disabled={busy || !category}
              onPress={() => sendReport(reason)}
            />
          </SheetRows>
          <SheetNote>{copy.help.reportNote}</SheetNote>
        </>
      );
      break;
    }
  }

  return (
    <SheetShell title={title} onBack={onBack} onClose={onClose} busy={busy}>
      {body}
    </SheetShell>
  );
}

const s = StyleSheet.create({
  danger: {
    marginTop: space.sheet.menuTop,
    paddingHorizontal: space.sheet.x,
  },
});
