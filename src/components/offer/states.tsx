import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { MASCOT } from "../../media/mascots";
import { sizedImage } from "../../media/image-url";
import { color, font } from "../../theme/tokens";
import { PinIcon } from "../icons";
import { Tappable } from "../Tappable";

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
  target,
  termsLine,
  message,
  hubName,
  onMessage,
  onChange,
  onWithdraw,
  withdrawing,
}: {
  owner: string;
  sentIso: string;
  offeredItems: { id: string; title: string; image: string | null }[];
  /** The listing the offer is on. */
  target: { title: string; image: string | null };
  /** `Bracket 2 for Bracket 3 · 20 Leaves held`. The offer's terms, in one line. */
  termsLine: string;
  message: string | null;
  /** The listing's first Safe Zone, when it has one. */
  hubName: string | null;
  /** Opens the chat with the owner. */
  onMessage: () => void;
  /** Withdraw, then compose again on this screen. */
  onChange: () => void;
  /** Withdraw and leave. */
  onWithdraw: () => void;
  withdrawing: boolean;
}) {
  const given = offeredItems[0] ?? null;
  return (
    <View style={pending.body}>
      {/* Where it stands, as three steps: sent, they reply, you meet. */}
      <View style={pending.card}>
        <View style={pending.statusRow}>
          <Image source={MASCOT.search} contentFit="contain" style={pending.duck} accessible={false} />
          <View style={{ flex: 1 }}>
            <Text style={pending.statusTitle}>Waiting for {owner}</Text>
            <Text style={[textStyle(offerType.bodyDense), { color: offerColor.inkSecondary }]}>
              Sent {copy.sentAgo(sentIso)}. {owner} has until {copy.replyBy(sentIso)} to reply, then it expires on its own.
            </Text>
          </View>
        </View>
        <View style={pending.steps} accessibilityLabel={`Offer progress: sent, waiting for ${owner} to reply`}>
          <View style={pending.stepLine} />
          <Step label="Sent" state="done" />
          <Step label={`${owner} replies`} state="now" />
          <Step label="You meet" state="later" />
        </View>
      </View>

      {/* What you offered, compact. */}
      <View style={[pending.card, pending.summary]}>
        <View style={pending.stack}>
          <View style={[pending.thumb, { left: 0 }]}>
            {given?.image ? <Image source={{ uri: sizedImage(given.image, "thumb") }} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
          </View>
          <View style={[pending.thumb, pending.thumbFront]}>
            {target.image ? <Image source={{ uri: sizedImage(target.image, "thumb") }} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={pending.summaryTitle} numberOfLines={2}>
            {given ? `${given.title} for ${target.title}` : target.title}
          </Text>
          <Text style={[textStyle(offerType.helper), { color: offerColor.inkSecondary }]} numberOfLines={2}>
            {termsLine}
          </Text>
          {message ? (
            <Text style={[textStyle(offerType.helper), { color: offerColor.inkSecondary, marginTop: 4 }]} numberOfLines={3}>
              “{message}”
            </Text>
          ) : null}
        </View>
      </View>

      {hubName ? (
        <View style={[pending.card, pending.summary]}>
          <PinIcon size={20} stroke={1.9} color={color.forest} />
          <View style={{ flex: 1 }}>
            <Text style={pending.hubName}>{hubName}</Text>
            <Text style={[textStyle(offerType.helper), { color: offerColor.inkSecondary }]}>
              Where you&apos;ll meet if {owner} accepts
            </Text>
          </View>
        </View>
      ) : null}

      {/* Clear next steps: talk to them, change it, or take it back. */}
      <View style={{ gap: 8, marginTop: 4 }}>
        <Tappable onPress={onMessage} accessibilityRole="button" style={pending.primary}>
          <Text style={pending.primaryText}>Message {owner}</Text>
        </Tappable>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Tappable
            onPress={withdrawing ? () => undefined : onChange}
            accessibilityRole="button"
            accessibilityLabel="Change offer: withdraws this one so you can send a new one"
            style={pending.secondary}
          >
            <Text style={pending.secondaryText}>Change offer</Text>
          </Tappable>
          <Tappable
            onPress={withdrawing ? () => undefined : onWithdraw}
            accessibilityRole="button"
            style={[pending.secondary, { borderColor: color.urgentLine }]}
          >
            <Text style={[pending.secondaryText, { color: color.urgent }]}>{withdrawing ? "Withdrawing" : "Withdraw"}</Text>
          </Tappable>
        </View>
      </View>
    </View>
  );
}

function Step({ label, state }: { label: string; state: "done" | "now" | "later" }) {
  return (
    <View style={pending.step}>
      <View
        style={[
          pending.dot,
          state === "done"
            ? { backgroundColor: color.forest }
            : state === "now"
              ? { backgroundColor: color.searchSurface, borderWidth: 2, borderColor: color.forest }
              : { backgroundColor: color.searchSurface, borderWidth: 1.5, borderColor: color.dashed },
        ]}
      />
      <Text
        style={[
          pending.stepLabel,
          state === "now" ? { color: color.forest, fontWeight: "700" } : state === "later" ? { color: color.inkSecondary, fontWeight: "400" } : null,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const pending = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28, gap: 12 },
  card: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: color.searchSurface,
    borderWidth: 1,
    borderColor: color.controlLine,
    gap: 12,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  duck: { width: 44, height: 60 },
  statusTitle: { fontFamily: font.displayBold, fontSize: 19, color: color.ink },
  steps: { flexDirection: "row" },
  stepLine: { position: "absolute", left: "16.6%", right: "16.6%", top: 6, height: 2, backgroundColor: color.controlLine },
  step: { flex: 1, alignItems: "center", gap: 6 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  stepLabel: { fontSize: 12, fontWeight: "600", color: color.ink },
  summary: { flexDirection: "row", alignItems: "center", padding: 12 },
  stack: { width: 70, height: 46 },
  thumb: { position: "absolute", width: 46, height: 46, borderRadius: 10, overflow: "hidden", backgroundColor: color.control },
  thumbFront: { left: 24, borderWidth: 2, borderColor: color.searchSurface },
  summaryTitle: { fontSize: 14, fontWeight: "700", color: color.ink },
  hubName: { fontSize: 14, fontWeight: "600", color: color.ink },
  primary: { height: 52, borderRadius: 16, backgroundColor: color.green, alignItems: "center", justifyContent: "center" },
  primaryText: { fontSize: 16, fontWeight: "700", color: color.onGreen },
  secondary: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: color.controlLineStrong,
    backgroundColor: color.searchSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontSize: 14, fontWeight: "600", color: color.ink },
});

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
 * back — plus the way to the Premium screen, the one paywall, which is where
 * the price and the "payments are not open yet" line live. See the copy
 * module for what this state must not do.
 */
export function PremiumLockedPanel({
  kind = "premium",
  bracket,
  owner,
  onSeePremium,
  onBack,
}: {
  kind?: "premium" | "vip";
  bracket: number;
  owner: string;
  /** Opens the Premium screen — the one paywall. */
  onSeePremium: () => void;
  onBack: () => void;
}) {
  const c = kind === "vip" ? copy.vip : copy.premium;
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
        accessibilityLabel={c.a11y(bracket)}
      >
        <LockIcon
          size={offerIcon.warning.size}
          stroke={offerIcon.warning.stroke}
          color={offerColor.inkSecondary}
        />
        <View style={{ flex: 1 }}>
          <Text style={[textStyle(offerType.errorHeading), { color: offerColor.ink }]}>
            {c.heading}
          </Text>
          <Text
            style={[textStyle(offerType.errorText), { color: offerColor.inkSecondary, marginTop: 4 }]}
          >
            {c.body(bracket, owner)}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: offerSpace.labelToContent, gap: offerSpace.rowGap }}>
        <PrimaryButton label={c.see} onPress={onSeePremium} />
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
