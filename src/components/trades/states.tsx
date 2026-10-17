import { Text, View } from "react-native";

import * as copy from "./copy";
import { Gutter } from "./chrome";
import { SectionHeader } from "../home-redesign/SectionHeader";
import { Hairline, PrimaryButton } from "../offer/chrome";
import { color, radius, space, type } from "../../theme/tokens";
import { WarningTriangleIcon } from "../offer/icons";
import { NumberedStep } from "../offer/rows";
import { RowAction } from "./rows";
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
 * §6's four table rows that are not a list: empty, all-settled, loading, error.
 *
 * NO ILLUSTRATION IN ANY OF THEM. §5.2 says it for the offer flow's empty state
 * and §6's table says it again here, and the reason is the same both times: a
 * drawing is a mood, and every one of these four is a statement of fact that the
 * reader is about to act on.
 */

/* ────────────────────────────── §6 empty ────────────────────────────── */

/**
 * "No trades yet". A new user's first sight of this tab.
 *
 * §10.6 gives the heading, the body and the button; frame 9k adds three numbered
 * lines in the `01 / 02 / 03` shape §5.2's "No items" state already uses — so
 * `NumberedStep` is imported from the offer flow rather than rebuilt.
 *
 * NO SECTION LABELS. Frame 9k's own note: no labels for sections that do not
 * exist. A `Needs you today` heading over nothing would read as a list that
 * failed to load, which is the one thing an empty state must not look like.
 */
export function TradesEmpty({ onBrowse }: { onBrowse: () => void }) {
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flex: 1,
          paddingTop: 44,
          paddingHorizontal: offerSpace.screenX,
          gap: offerSpace.paragraphToControl,
        }}
      >
        <Text
          accessibilityRole="header"
          style={[textStyle(offerType.screenHeading), { color: offerColor.ink }]}
        >
          {copy.empty.heading}
        </Text>
        <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
          {copy.empty.body}
        </Text>

        <View style={{ paddingTop: 16, gap: 12 }}>
          <NumberedStep n={1}>{copy.empty.step1}</NumberedStep>
          <NumberedStep n={2}>{copy.empty.step2}</NumberedStep>
          <NumberedStep n={3}>{copy.empty.step3}</NumberedStep>
        </View>
      </View>

      {/* §3.2's bar geometry, minus the footnote. The button is the only thing
          that turns this screen into a populated one, so it is the bottom of
          the screen rather than a link inside the copy. */}
      <View>
        <Hairline />
        <View
          style={{
            paddingTop: offerSpace.bottomBar.top,
            paddingHorizontal: offerSpace.screenX,
            paddingBottom: offerSpace.bottomBar.top,
          }}
        >
          {/* §4's 52 / radius 10 / `#3DBE5A` primary, straight out of the offer
              flow. NOT wrapped in `OfferBottomBar`: that component adds the
              safe-area padding a pushed screen needs, and this screen sits above
              a tab bar the navigator has already inset — the two would stack. */}
          <PrimaryButton label={copy.empty.primary} onPress={onBrowse} />
        </View>
      </View>
    </View>
  );
}

/**
 * §6's "Empty (all settled)": History alone, with one 15px line above it.
 *
 * Not the same screen as "no trades ever". Somebody with fourteen finished
 * trades and nothing live is not a new user, and showing them the onboarding
 * copy would be the app forgetting who it is talking to.
 */
export function NothingPending() {
  return (
    <Gutter style={{ paddingTop: 14, paddingBottom: 16 }}>
      <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
        {copy.nothingPending}
      </Text>
    </Gutter>
  );
}

/* ───────────────────────────── §6 loading ──────────────────────────── */

/**
 * §6's loading row: "Section labels render immediately. Labels never skeleton."
 *
 * The labels are STRUCTURE, not data — the ordering is decided by
 * `buildTradesModel()` on the device and is known before any request returns —
 * so drawing them as grey blocks would be pretending not to know something the
 * app already knows. Only the row bodies are blocks, and they hold the real
 * heights (88, 72, 60) so nothing jumps when the data lands.
 *
 * NO SHIMMER. §5.2's loading state for the offer screen says "No skeleton
 * shimmer on text", and a pulse on a to-do list reads as activity — as though
 * something is happening to the trades themselves rather than to the request.
 * The feed's `FeedSkeleton` pulses because a feed is entertainment; this is not.
 */
export function TradesSkeleton() {
  // Card-shaped blocks under the real headers (1 Oct 2026 redesign): a
  // "Your move" card carries the track and is taller than a waiting one.
  return (
    <View>
      <SectionHeader
        leading={copy.tradeCard.yourMoveLead}
        accent={copy.tradeCard.yourMoveAccent}
        accentColor={color.forest}
        squiggle
        top={TRADES_FIRST_HEADER_TOP}
      />
      <Gutter style={{ gap: 10 }}>
        <SkeletonBlock height={196} radius={radius.hubRow} />
        <SkeletonBlock height={196} radius={radius.hubRow} />
      </Gutter>

      <SectionHeader accent={copy.tradeCard.waitingOnThem} />
      <Gutter style={{ gap: 10 }}>
        <SkeletonBlock height={150} radius={radius.hubRow} />
      </Gutter>

      <View style={{ height: 24 }} />
      <Hairline />
      <SkeletonBlock height={offerSize.historyRow.height} radius={0} />
      <Hairline />
    </View>
  );
}

/**
 * The first section header's top margin on the Trades tab. There is no screen
 * title, and `TradesHost` already pads past the status bar, so the header needs
 * only the gap a heading keeps from what is above it — not a whole section's.
 */
export const TRADES_FIRST_HEADER_TOP = space.home.headingToContent;

function SkeletonBlock({ height, radius }: { height: number; radius: number }) {
  return (
    <View style={{ height, borderRadius: radius, backgroundColor: offerColor.sunk }} />
  );
}

/* ──────────────────────────── §6 network error ──────────────────────── */

/**
 * §10.6's error panel: 1.5px `#C56A4B` outline, paper fill, triangle, `Try again`.
 *
 * OUTLINE, NEVER FILL — §1.4's job 3, and frame 9m's note says why in one line:
 * outline warns, fill fails, and this is recoverable. A filled terracotta panel
 * is reserved for hard failures, which §1.4 states do not occur in these areas.
 *
 * The body names what was NOT lost rather than what went wrong, which is §10's
 * pattern everywhere a request fails: the reader's actual question is whether
 * their offer went out, not what the transport did.
 */
export function TradesErrorPanel({
  heading = copy.networkError.heading,
  body = copy.networkError.body,
  onRetry,
}: {
  heading?: string;
  body?: string;
  onRetry: () => void;
}) {
  return (
    <Gutter style={{ paddingTop: 14, paddingBottom: 18 }}>
      <View
        style={{
          borderRadius: offerRadius.tile,
          borderWidth: offerBorder.promise,
          borderColor: offerColor.promise,
          backgroundColor: offerColor.paper,
          padding: 14,
          flexDirection: "row",
          gap: 11,
        }}
      >
        <View style={{ marginTop: 1 }}>
          <WarningTriangleIcon
            size={offerIcon.warning.size}
            stroke={offerIcon.warning.stroke}
            color={offerColor.warm}
          />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Text
            accessibilityRole="header"
            style={[textStyle(offerType.errorHeading), { color: offerColor.ink }]}
          >
            {heading}
          </Text>
          <Text style={[textStyle(offerType.errorText), { color: offerColor.inkSecondary }]}>
            {body}
          </Text>
          {/* A one-child row, because `fill` is `flex: 1` and this panel's body
              is a column. See the prop's note in `rows.tsx`. */}
          <View style={{ marginTop: 7, flexDirection: "row" }}>
            <RowAction label={copy.networkError.retry} onPress={onRetry} fill />
          </View>
        </View>
      </View>
    </Gutter>
  );
}

/**
 * The mono label over rows that came from cache after a failed refresh.
 *
 * §6's table: "Cached rows, if any, render below the panel under a mono label
 * `Last loaded 14:20`." That is not decoration — the code somebody needs at the
 * hub was already on the device, and hiding it behind an error panel because the
 * refresh failed would take away the one thing they opened the app for.
 */
export function CachedLabel({ clock }: { clock: string }) {
  // Body family, not mono: the Trades tab carries no monospace (1 Oct 2026).
  return (
    <Gutter style={{ paddingTop: 18, paddingBottom: 10 }}>
      <Text style={[textStyle(type.metadata), { color: color.inkSecondary }]}>
        {copy.label.lastLoaded(clock)}
      </Text>
    </Gutter>
  );
}
