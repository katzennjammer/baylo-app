import { Text, View } from "react-native";

import { LockIcon, WarningTriangleIcon } from "./icons";
import { ItemRow, NumberedStep, RecordRow } from "./rows";
import {
  Hairline,
  PrimaryButton,
  SecondaryButton,
  Section,
  SectionLabel,
  TertiaryButton,
} from "./chrome";
import * as copy from "./copy";
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
  termsLine,
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
  /** `Bracket 2 for Bracket 3 · 20 Leaves held`. The offer's terms, in one mono line. */
  termsLine: string;
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

          <RecordRow first label="Terms" value={termsLine} />

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
