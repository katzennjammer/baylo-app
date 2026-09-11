import { Text, View } from "react-native";

import { ArrowsIcon, LockIcon, WarningTriangleIcon } from "./icons";
import { ItemRow, NumberedStep, RecordRow, RouteRow } from "./rows";
import {
  Hairline,
  PrimaryButton,
  SecondaryButton,
  Section,
  SectionLabel,
  TertiaryButton,
} from "./chrome";
import * as copy from "./copy";
import { ceilingTable, grouped, nextRung, shortTier, type CeilingRow } from "../../lib/gap";
import type { TrustTier } from "../../lib/trust";
import {
  offerBorder,
  offerColor,
  offerIcon,
  offerRadius,
  offerSize,
  offerSpace,
  offerType,
  textStyle,
} from "../../theme/offer-tokens";

/**
 * §5.2's blocking and edge states, and §1.10's two failure panels.
 *
 * ── WHAT THESE ALL HAVE IN COMMON ───────────────────────────────────────────
 *
 * None of them is an error screen, and none of them uses an illustration —
 * §5.2 says "No illustration" for the two it could have applied to, and the
 * others follow. Each states a fact, names a number, and hands over a route,
 * which is §10.2's stated rule generalised to every state in the flow.
 *
 * §1.10's rule for the two that ARE failures: "outline warns, fill fails", and
 * a FILLED `#C56A4B` panel is reserved for hard failures which §1.4 says do not
 * occur in these areas. So both panels here are 1.5px outlines on paper.
 */

/* ───────────────────── §5.2 no items to offer (§10.5) ───────────────── */

/**
 * The listing header is RETAINED above this — §5.2 is explicit — so this
 * component is the body only and the screen keeps its own header block.
 *
 * §10.5's tertiary `Save this listing for later` is NOT drawn. There is no
 * saved/watched/bookmarked model on the server at all (the schema has
 * `PostLike` and nothing else of the kind), so the control would do nothing.
 * The primary works, and it is the one that matters: with no items there is
 * nothing to offer, and posting is the whole of the way forward.
 */
export function NoItemsState({
  owner,
  theirItem,
  onPost,
}: {
  owner: string;
  theirItem: string;
  onPost: () => void;
}) {
  return (
    <View>
      <Section pad={offerSpace.section.gap}>
        <Text style={[textStyle(offerType.screenHeading), { color: offerColor.ink }]}>
          {copy.noItems.heading}
        </Text>
        <Text
          style={[
            textStyle(offerType.body),
            { color: offerColor.inkSecondary, marginTop: offerSpace.labelToContent },
          ]}
        >
          {copy.noItems.body}
        </Text>

        <View style={{ marginTop: offerSpace.paragraphToControl, gap: 11 }}>
          <NumberedStep n={1}>{copy.noItems.step1}</NumberedStep>
          <NumberedStep n={2}>{copy.noItems.step2(owner, theirItem)}</NumberedStep>
        </View>

        <View style={{ marginTop: offerSpace.paragraphToControl + 8 }}>
          <PrimaryButton label={copy.noItems.primary} onPress={onPost} />
        </View>
      </Section>
    </View>
  );
}

/* ────────────────── §5.2 not ID-verified (§10.5) ────────────────────── */

/**
 * ONLY THE DPA ROW CHANGES. §5.2 is precise about this and it is the whole
 * point of the state: Leaves and send-as-is stay live, so the person can still
 * make an offer — they simply cannot promise. The greyed row, the 48px verify
 * button below the rows, and a 12px footnote.
 *
 * The row itself is drawn by `SettlementRow` with `locked`, so its fill, its
 * dashed edge and its lock icon come from §1.7's table rather than from here.
 */
export function VerifyPromiseBlock({ onVerify }: { onVerify: () => void }) {
  return (
    <View style={{ marginTop: offerSpace.rowGap }}>
      <SecondaryButton
        label={copy.notVerified.button}
        onPress={onVerify}
        height={offerSize.verifyButton}
      />
      <Text
        style={[
          textStyle(offerType.helper),
          { color: offerColor.inkTertiary, marginTop: offerSpace.labelToContent },
        ]}
      >
        {copy.notVerified.footnote}
      </Text>
    </View>
  );
}

/* ─────────────────── §5.2 tier too low (§10.5) ──────────────────────── */

/**
 * A FULL SCREEN REPLACING THE DPA PROPOSAL, not a panel inside it.
 *
 * §5.2 says so, and the reason shows in the content: this is not "that number
 * is too big", it is "promises of this size are not open to you yet, here is
 * the ladder and here is where you are on it". A panel would put that inside a
 * form the person cannot complete.
 *
 * ── THE CEILING TABLE'S NUMBERS ─────────────────────────────────────────────
 *
 * The viewer's own row is the server's `maxOutstandingDebtLeaves`; the other
 * three are `TIER_LADDER`'s hand-kept mirror, and the reasoning for both is on
 * `ceilingTable()`. §10.5's own figures (200 / 900 / 2,500) are NOT used —
 * they would promise ceilings the server refuses.
 */
export function TierTooLowState({
  tier,
  serverCeiling,
  completedTrades,
  gapNeeded,
  balance,
  owner,
  alternativeItem,
  onSendLargestLegal,
  onChangeItem,
}: {
  tier: TrustTier;
  serverCeiling: number;
  completedTrades: number;
  /** The shortfall that could not be covered. §10.5's "This gap needs 640". */
  gapNeeded: number;
  balance: number;
  owner: string;
  /** The viewer's highest-value item, for §10.5's second `From here` row. */
  alternativeItem: { title: string; valueLeaves: number } | null;
  onSendLargestLegal: () => void;
  onChangeItem: () => void;
}) {
  const rows = ceilingTable(tier, serverCeiling);
  const next = nextRung(tier);
  const moreTrades = next ? Math.max(0, next.minTrades - completedTrades) : 0;

  // §10.5's primary "sends the largest legal combination": everything the
  // balance covers plus everything the ceiling allows.
  const legalLeaves = Math.min(balance, gapNeeded);
  const legalPromise = Math.min(serverCeiling, Math.max(0, gapNeeded - legalLeaves));
  const remainder = Math.max(0, gapNeeded - legalLeaves - legalPromise);

  return (
    <View>
      <Section pad={offerSpace.section.gap}>
        <Text style={[textStyle(offerType.screenHeading), { color: offerColor.ink }]}>
          {copy.tierTooLow.heading(tier, serverCeiling)}
        </Text>
        <Text
          style={[
            textStyle(offerType.body),
            { color: offerColor.inkSecondary, marginTop: offerSpace.labelToContent },
          ]}
        >
          {copy.tierTooLow.body(gapNeeded, serverCeiling)}
        </Text>
      </Section>

      <Hairline />

      <Section pad={offerSpace.section.settle}>
        <SectionLabel>{copy.label.ceilings}</SectionLabel>
        <View style={{ marginTop: offerSpace.labelToContent }}>
          {rows.map((row, i) => (
            <CeilingTableRow key={row.tier} row={row} first={i === 0} />
          ))}
        </View>

        {next ? (
          <Text
            style={[
              textStyle(offerType.body),
              { color: offerColor.inkSecondary, marginTop: offerSpace.paragraphToControl },
            ]}
          >
            {copy.tierTooLow.progress(completedTrades, moreTrades, shortTier(next.tier))}
          </Text>
        ) : null}
      </Section>

      <Hairline />

      <Section pad={offerSpace.section.settle}>
        <SectionLabel>{copy.label.fromHere}</SectionLabel>
        <View style={{ marginTop: offerSpace.labelToContent, gap: offerSpace.rowGap }}>
          <RouteRow
            icon={
              <ArrowsIcon
                size={offerSize.routeRow.icon}
                stroke={offerIcon.inlineRow.stroke}
                color={offerColor.inkSecondary}
              />
            }
            title={copy.tierTooLow.fromHereAdd(legalLeaves, legalPromise)}
            subtitle={copy.tierTooLow.fromHereAddSub(remainder, owner)}
            onPress={onSendLargestLegal}
          />
          {alternativeItem ? (
            <RouteRow
              icon={
                <ArrowsIcon
                  size={offerSize.routeRow.icon}
                  stroke={offerIcon.inlineRow.stroke}
                  color={offerColor.inkSecondary}
                />
              }
              title={copy.tierTooLow.fromHereOther}
              subtitle={copy.tierTooLow.fromHereOtherSub(
                alternativeItem.title,
                alternativeItem.valueLeaves,
              )}
              onPress={onChangeItem}
            />
          ) : null}
        </View>
      </Section>
    </View>
  );
}

/**
 * One rung: the tier, what reaches it, and what it permits.
 *
 * `you are here` is §1.6's ONE exception to "tiers are typographic, not
 * coloured" — it is `#1B4D2B` mono, and it is the only coloured tier marker
 * anywhere in the app. Nothing else in this table takes a colour.
 */
function CeilingTableRow({ row, first }: { row: CeilingRow; first: boolean }) {
  return (
    <View
      style={{
        borderTopWidth: first ? 0 : offerBorder.hairline,
        borderTopColor: offerColor.hairline,
        paddingVertical: offerSize.recordRow.padYWide,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
      accessibilityLabel={
        `${row.tier}. ${row.here ? "You are here. " : `${copy.tierTooLow.tradesToReach(row.minTrades)}. `}` +
        (row.ceiling === null ? copy.tierTooLow.noLimit : `${grouped(row.ceiling)} Leaves`)
      }
    >
      <Text
        style={[
          textStyle(offerType.body),
          { color: offerColor.ink, flex: 1 },
        ]}
      >
        {shortTier(row.tier)}
      </Text>

      <Text
        style={[
          textStyle(offerType.trustTier),
          { color: row.here ? offerColor.deep : offerColor.inkSecondary, flex: 1 },
        ]}
      >
        {row.here ? copy.tierTooLow.youAreHere : copy.tierTooLow.tradesToReach(row.minTrades)}
      </Text>

      <Text style={[textStyle(offerType.tableFigure), { color: offerColor.ink }]}>
        {row.ceiling === null ? copy.tierTooLow.noLimit : grouped(row.ceiling)}
      </Text>
    </View>
  );
}

/* ──────────────── §5.2 a pending offer already exists ───────────────── */

/**
 * §5.2: "Status, not error."
 *
 * Heading, the sent-time sentence, a `What you sent` summary and a meetup row.
 * All of it is real: the summary is built from `GET /api/v1/trades`'s `offers`
 * array, which is the only place an offer's own contents appear on the wire.
 *
 * ── BOTH CONTROLS ARE LIVE ──────────────────────────────────────────────────
 *
 * §5.2's secondary is `Withdraw and offer again`, and it now does exactly that:
 * POST /api/v1/offers/[id]/withdraw retracts the offer, releases the Leaves it
 * had pledged, and declines any deferred agreement proposed with it. §9 shortens
 * the label to `Withdraw and re-offer` on the 360 board, which is why the string
 * arrives as a prop rather than being read from the copy module here.
 */
export function PendingOfferState({
  owner,
  sentIso,
  offeredItems,
  offeredLeaves,
  message,
  hubName,
  withdrawLabel,
  onWithdraw,
  withdrawing,
  onLeaveIt,
}: {
  owner: string;
  sentIso: string;
  offeredItems: { id: string; title: string; image: string | null }[];
  offeredLeaves: number | null;
  message: string | null;
  /** The listing's first Safe Zone, when it has one. §5.2's "meetup row". */
  hubName: string | null;
  /** §9's board-dependent string. See the note above. */
  withdrawLabel: string;
  onWithdraw: () => void;
  withdrawing: boolean;
  onLeaveIt: () => void;
}) {
  return (
    <View>
      <Section pad={offerSpace.section.gap}>
        <Text style={[textStyle(offerType.screenHeading), { color: offerColor.ink }]}>
          {copy.pending.heading}
        </Text>
        <Text
          style={[
            textStyle(offerType.body),
            { color: offerColor.inkSecondary, marginTop: offerSpace.labelToContent },
          ]}
        >
          {copy.pending.body(copy.sentAgo(sentIso), owner, copy.replyBy(sentIso))}
        </Text>
      </Section>

      <Hairline />

      <Section pad={offerSpace.section.settle}>
        <SectionLabel>{copy.label.whatYouSent}</SectionLabel>
        <View style={{ marginTop: offerSpace.labelToContent, gap: offerSpace.rowGap }}>
          {offeredItems.map((item) => (
            <ItemRow
              key={item.id}
              image={item.image}
              title={item.title}
              meta="Offered"
            />
          ))}

          {offeredLeaves && offeredLeaves > 0 ? (
            <RecordRow
              first
              label="Leaves added"
              value={grouped(offeredLeaves)}
            />
          ) : null}

          {message ? (
            <Text
              style={[
                textStyle(offerType.bodyDense),
                { color: offerColor.inkSecondary, marginTop: 4 },
              ]}
            >
              {message}
            </Text>
          ) : null}
        </View>
      </Section>

      {hubName ? (
        <>
          <Hairline />
          <Section pad={offerSpace.section.settle}>
            <SectionLabel>{copy.label.meet}</SectionLabel>
            <View style={{ marginTop: offerSpace.labelToContent }}>
              <ItemRow image={null} title={hubName} meta="Safe-Zone Hub" photoSize={44} />
            </View>
          </Section>
        </>
      ) : null}

      <Section pad={offerSpace.section.offering}>
        {/*
          The secondary sits above the tertiary, which is §5.2's own ordering:
          withdrawing is the action somebody came to this screen to take, and
          leaving it alone is what happens if they do nothing anyway.
        */}
        <SecondaryButton
          label={withdrawing ? "Withdrawing" : withdrawLabel}
          onPress={withdrawing ? () => undefined : onWithdraw}
        />
        <TertiaryButton label={copy.pending.leaveIt} onPress={onLeaveIt} />
      </Section>
    </View>
  );
}

/* ────────────────────────── §1.10 / §5.2 failures ───────────────────── */

/**
 * The send-failed panel: a 1.5px `#C56A4B` outline on paper, a triangle, a
 * heading and a body naming what was preserved.
 *
 * §5.2's ordering matters and is honoured by the caller: "Leaves are released
 * before this renders." The copy says so, and it is true — nothing was pledged,
 * because the offer row was never created.
 *
 * `serverMessage` is the one departure from §10.5's body, and it is an addition
 * rather than a replacement. §10.5 is written for a dropped connection; the same
 * panel also carries the four refusals POST /api/offers can still answer with
 * (a tier item-value cap, a standing default, a block, and an `offeredLeaves`
 * above the AVAILABLE balance — the last of which no endpoint lets this client
 * predict). The server's own sentence carries the numbers, so it is shown
 * verbatim below the panel's heading INSTEAD of the connection-dropped body
 * when there is one.
 */
export function SendFailedPanel({
  owner,
  heldLeaves,
  serverMessage,
  onRetry,
  onKeep,
}: {
  owner: string;
  heldLeaves: number;
  /** The server's own message when it refused. Null for a transport failure. */
  serverMessage: string | null;
  onRetry: () => void;
  onKeep: () => void;
}) {
  return (
    <View style={{ marginBottom: offerSpace.bottomBar.consequenceToButton }}>
      <View
        style={{
          borderWidth: offerBorder.promise,
          borderColor: offerColor.promise,
          borderRadius: offerRadius.row,
          backgroundColor: offerColor.paper,
          padding: 14,
          flexDirection: "row",
          gap: 12,
        }}
        accessibilityRole="alert"
      >
        <WarningTriangleIcon
          size={offerIcon.warning.size}
          stroke={offerIcon.warning.stroke}
          color={offerColor.warm}
        />
        <View style={{ flex: 1 }}>
          <Text style={[textStyle(offerType.errorHeading), { color: offerColor.ink }]}>
            {copy.sendFailed.heading}
          </Text>
          <Text
            style={[textStyle(offerType.errorText), { color: offerColor.inkSecondary, marginTop: 4 }]}
          >
            {serverMessage ?? copy.sendFailed.body(owner, heldLeaves)}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: offerSpace.labelToContent }}>
        <PrimaryButton label={copy.sendFailed.retry} onPress={onRetry} />
        <TertiaryButton label={copy.sendFailed.keep} onPress={onKeep} />
      </View>
    </View>
  );
}

/**
 * The same outline panel, used for a load failure rather than a send failure.
 *
 * §6's Trades table gives this shape a heading and a `Try again`; the offer
 * screen has the same need when /items/[id] or /profile/me will not load, and
 * the treatment is the one §1.10 assigns to "Network error": the same panel,
 * inline in the list position.
 */
export function LoadFailedPanel({
  heading,
  body,
  onRetry,
}: {
  heading: string;
  body: string;
  onRetry: () => void;
}) {
  return (
    <Section pad={offerSpace.section.gap}>
      <View
        style={{
          borderWidth: offerBorder.promise,
          borderColor: offerColor.promise,
          borderRadius: offerRadius.row,
          backgroundColor: offerColor.paper,
          padding: 14,
          flexDirection: "row",
          gap: 12,
        }}
        accessibilityRole="alert"
      >
        <WarningTriangleIcon
          size={offerIcon.warning.size}
          stroke={offerIcon.warning.stroke}
          color={offerColor.warm}
        />
        <View style={{ flex: 1 }}>
          <Text style={[textStyle(offerType.errorHeading), { color: offerColor.ink }]}>
            {heading}
          </Text>
          <Text
            style={[textStyle(offerType.errorText), { color: offerColor.inkSecondary, marginTop: 4 }]}
          >
            {body}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: offerSpace.labelToContent }}>
        <SecondaryButton label="Try again" onPress={onRetry} />
      </View>
    </Section>
  );
}

/* ───────────────────────── the premium lock ─────────────────────────── */

/**
 * The composer under a premium lock, reached by deep link or a stale detail.
 *
 * Item detail normally replaces the offer control before anyone gets here —
 * see `PremiumLockedBar` — so this panel is the belt to that brace: a viewer
 * who arrives with `viewer.offerLock === "premium"` is told the same thing in
 * the same words, and POST /api/offers would answer 403 PREMIUM_REQUIRED if
 * they somehow sent anyway.
 *
 * NOT `LoadFailedPanel`. That panel is a warm-bordered alert with a warning
 * triangle and a "Try again" button, and none of the three is true here:
 * nothing failed, there is nothing to retry, and §1.4 keeps the warm accent
 * for failures, debts and defaults. This is a quiet border, a lock, and a way
 * back. See the copy module for what this state must not do — no price, no
 * purchase control, and nothing that makes the listing feel hidden.
 */
export function PremiumLockedPanel({
  bracket,
  owner,
  onBack,
}: {
  bracket: number;
  owner: string;
  onBack: () => void;
}) {
  return (
    <Section pad={offerSpace.section.gap}>
      <View
        style={{
          borderWidth: offerBorder.hairline,
          borderColor: offerColor.hairline,
          borderRadius: offerRadius.row,
          backgroundColor: offerColor.paper,
          padding: 14,
          flexDirection: "row",
          gap: 12,
        }}
        accessibilityRole="text"
        accessibilityLabel={copy.premium.a11y(bracket)}
      >
        <LockIcon
          size={offerIcon.warning.size}
          stroke={offerIcon.warning.stroke}
          color={offerColor.inkSecondary}
        />
        <View style={{ flex: 1 }}>
          <Text style={[textStyle(offerType.errorHeading), { color: offerColor.ink }]}>
            {copy.premium.heading}
          </Text>
          <Text
            style={[textStyle(offerType.errorText), { color: offerColor.inkSecondary, marginTop: 4 }]}
          >
            {copy.premium.body(bracket, owner)}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: offerSpace.labelToContent }}>
        <SecondaryButton label="Back to the listing" onPress={onBack} />
      </View>
    </Section>
  );
}

/* ────────────────────── §5.2 the loading arrangement ────────────────── */

/**
 * §5.2: the listing header renders from cached feed data immediately; the gap
 * section shows the wash track with a `#EDEBE3` block where the figure goes;
 * the settlement rows render as three 60px `#F5F4EE` rows.
 *
 * NO SHIMMER ON TEXT — §5.2's own instruction, and it is followed everywhere in
 * this flow rather than only on the text: a pulse over a figure that is about to
 * become a fact reads as the figure changing.
 */
export function SettlementSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View
      style={{ gap: offerSpace.rowGap }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={i}
          style={{
            height: offerSize.settleRow.minHeight,
            borderRadius: offerRadius.row,
            backgroundColor: offerColor.sunk,
          }}
        />
      ))}
    </View>
  );
}
