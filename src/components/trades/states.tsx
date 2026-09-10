import { Text, View } from "react-native";

import * as copy from "./copy";
import { BlockHeader, Gutter, TradesSectionLabel } from "./chrome";
import { Hairline, PrimaryButton } from "../offer/chrome";
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
  return (
    <View>
      <BlockHeader label={copy.label.needsToday} top={14} />
      <Gutter style={{ gap: 8 }}>
        <SkeletonBlock height={offerSize.tradeCard.height} radius={offerRadius.tile} />
        <SkeletonBlock height={offerSize.tradeCard.height} radius={offerRadius.tile} />
      </Gutter>

      <View style={{ height: 18 }} />
      <Hairline />

      <BlockHeader label={copy.label.waiting} top={18} />
      <View>
        <SkeletonRow widths={["64%", "44%"]} />
        <Hairline />
        <SkeletonRow widths={["52%", "60%"]} />
        <Hairline />
        <SkeletonRow widths={["58%", "38%"]} />
      </View>

      <View style={{ height: 16 }} />
      <Hairline />
      <SkeletonBlock height={offerSize.historyRow.height} radius={0} />
      <Hairline />
    </View>
  );
}

function SkeletonBlock({ height, radius }: { height: number; radius: number }) {
  return (
    <View style={{ height, borderRadius: radius, backgroundColor: offerColor.sunk }} />
  );
}

/** A 72px waiting row's shape: the 44 square and two lines of unequal width. */
function SkeletonRow({ widths }: { widths: [string, string] }) {
  return (
    <View
      style={{
        height: offerSize.tradeRow.height,
        paddingHorizontal: offerSpace.screenX,
        flexDirection: "row",
        alignItems: "center",
        gap: offerSize.tradeRow.gap,
      }}
    >
      <View
        style={{
          width: offerSize.tradeRow.thumb,
          height: offerSize.tradeRow.thumb,
          borderRadius: offerRadius.thumbnail,
          backgroundColor: offerColor.quiet,
        }}
      />
      <View style={{ flex: 1, gap: 7 }}>
        <View
          style={{
            height: 12,
            width: widths[0] as `${number}%`,
            borderRadius: offerRadius.track,
            backgroundColor: offerColor.quiet,
          }}
        />
        <View
          style={{
            height: 10,
            width: widths[1] as `${number}%`,
            borderRadius: offerRadius.track,
            backgroundColor: offerColor.sunk,
          }}
        />
      </View>
    </View>
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
  return (
    <Gutter style={{ paddingTop: 18, paddingBottom: 10 }}>
      <TradesSectionLabel>{copy.label.lastLoaded(clock)}</TradesSectionLabel>
    </Gutter>
  );
}
