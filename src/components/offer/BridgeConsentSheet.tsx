import { useState } from "react";
import { Linking, Text, View } from "react-native";

import { getApiBase } from "../../api/config";
import { grouped } from "../../lib/gap";
import { TRADING_POLICY_PATH } from "../../lib/trade-rules";
import { CheckIcon } from "../icons";
import { Tappable } from "../Tappable";
import { OfferSheet } from "./OfferSheet";
import { PrimaryButton, TertiaryButton } from "./chrome";
import * as copy from "./copy";
import { RecordRow } from "./rows";
import {
  offerBorder,
  offerColor,
  offerRadius,
  offerSize,
  offerSpace,
  offerType,
  textStyle,
} from "../../theme/offer-tokens";

/**
 * The sheet between a paying party and their tap.
 *
 * ══ WHO SEES IT, AND WHEN ═══════════════════════════════════════════════════
 *
 * Exactly one person per bridge, at the moment they commit:
 *
 *   the PROPOSER, on Send, when their item is one bracket BELOW the listing
 *   the RECEIVER, on Accept, when the offered item is one bracket ABOVE theirs
 *
 * A same-bracket offer never opens it, on either side. The other side of a
 * bridge never opens it either — a proposer sending an up-bridge sees one
 * line under the button ("Marco will pay a 30-Leaf bridging fee to accept")
 * and no sheet, because there is nothing for them to agree to.
 *
 * ══ WHAT IT STATES, AND WHY ALL OF IT ═══════════════════════════════════════
 *
 * Both brackets, the fee, the balance now and the balance after — every
 * number the server is about to act on, before it acts. The checkbox is not
 * decoration: its label is the sentence the server records the user as having
 * agreed to, stamped with `TRADING_POLICY_VERSION`, and the primary is inert
 * until it is ticked. The policy is one tap away and opens in the browser,
 * because the sheet is not the place to read four paragraphs.
 *
 * ══ THE INSUFFICIENT VARIANT HAS NO PRIMARY ═════════════════════════════════
 *
 * When the balance cannot cover the fee the sheet says how much is needed
 * against how much is held and offers no way to proceed. The server would
 * refuse anyway; the point is that the person is not asked to agree to
 * something that cannot happen. The one control is `Not now`.
 *
 * ══ 44PX, LINE ICONS, NO EMOJI ══════════════════════════════════════════════
 *
 * The checkbox is a 44px hit target around a 22px box, the tick is the app's
 * own stroke icon, and every figure is the mono `tableFigure` the record rows
 * already use.
 */
export function BridgeConsentSheet({
  side,
  otherName,
  yourBracket,
  theirBracket,
  fee,
  balance,
  busy,
  onConfirm,
  onDismiss,
}: {
  /** Which commit this is guarding. Changes the heading, the body and the button. */
  side: "send" | "accept";
  /** The other party's first name, for the body copy. */
  otherName: string;
  /** The bracket of the item THIS user is handing over — the lower one. */
  yourBracket: number;
  /** The bracket of the item they get. */
  theirBracket: number;
  fee: number;
  /** This user's balance right now. */
  balance: number;
  /** The request is in flight. The primary reads as such and cannot fire twice. */
  busy: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const enough = balance >= fee;
  const after = balance - fee;
  const p = offerSpace.prompt;

  return (
    <OfferSheet dismissible={!busy} onDismiss={onDismiss}>
      <View style={{ paddingTop: p.handleToHeading, paddingHorizontal: p.x }}>
        <Text style={[textStyle(offerType.sheetHeading), { color: offerColor.ink }]}>
          {enough
            ? side === "send"
              ? copy.consent.headingSend
              : copy.consent.headingAccept
            : copy.consent.shortHeading}
        </Text>

        <Text
          style={[
            textStyle(offerType.leavesRow),
            { color: offerColor.inkSecondary, marginTop: p.headingToBody },
          ]}
        >
          {copy.consent.terms(yourBracket, theirBracket, fee)}
        </Text>

        <Text
          style={[
            textStyle(offerType.body),
            { color: offerColor.inkSecondary, marginTop: offerSpace.labelToContent },
          ]}
        >
          {enough
            ? side === "send"
              ? copy.consent.bodySend(otherName)
              : copy.consent.bodyAccept(otherName)
            : copy.consent.shortBody(fee, balance)}
        </Text>

        <View style={{ marginTop: offerSpace.paragraphToControl }}>
          {enough ? (
            <>
              <RecordRow first label={copy.consent.balanceNow} value={grouped(balance)} />
              <RecordRow label={copy.consent.balanceAfter} value={grouped(after)} />
            </>
          ) : (
            <>
              <RecordRow first label={copy.consent.need} value={grouped(fee)} tone="warm" />
              <RecordRow label={copy.consent.have} value={grouped(balance)} />
            </>
          )}
        </View>

        {enough ? (
          <>
            <Tappable
              onPress={busy ? undefined : () => setAgreed((a) => !a)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed, disabled: busy }}
              accessibilityLabel={copy.consent.checkbox}
              style={{
                marginTop: offerSpace.paragraphToControl,
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: offerBorder.selected,
                  borderColor: agreed ? offerColor.selected : offerColor.strong,
                  backgroundColor: agreed ? offerColor.selected : offerColor.paper,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {agreed ? <CheckIcon size={14} stroke={2.5} color={offerColor.paper} /> : null}
              </View>
              <Text style={[textStyle(offerType.body), { color: offerColor.ink, flex: 1 }]}>
                {copy.consent.checkbox}
              </Text>
            </Tappable>

            <Tappable
              onPress={() => {
                void Linking.openURL(`${getApiBase()}${TRADING_POLICY_PATH}`).catch(() => {});
              }}
              accessibilityRole="link"
              accessibilityLabel={copy.consent.policyLink}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={[textStyle(offerType.buttonTertiary), { color: offerColor.deep }]}>
                {copy.consent.policyLink}
              </Text>
            </Tappable>
          </>
        ) : null}

        <View style={{ marginTop: offerSpace.labelToContent, paddingBottom: p.x }}>
          {enough ? (
            agreed && !busy ? (
              <PrimaryButton
                label={side === "send" ? copy.button.propose : copy.button.accept}
                onPress={onConfirm}
              />
            ) : (
              <View
                accessibilityRole="button"
                accessibilityState={{ disabled: true }}
                accessibilityLabel={`${side === "send" ? copy.button.propose : copy.button.accept}. Tick the box first.`}
                style={{
                  height: offerSize.button.primary,
                  borderRadius: offerRadius.button,
                  backgroundColor: offerColor.quiet,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={[textStyle(offerType.buttonPrimary), { color: offerColor.inkTertiary }]}>
                  {busy ? "Sending" : side === "send" ? copy.button.propose : copy.button.accept}
                </Text>
              </View>
            )
          ) : null}
          <TertiaryButton label={copy.consent.cancel} onPress={busy ? () => undefined : onDismiss} />
        </View>
      </View>
    </OfferSheet>
  );
}
