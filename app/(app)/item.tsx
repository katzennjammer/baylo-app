import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "../../src/api/client";
import { useProfileMe } from "../../src/api/profile";
import { useReach } from "../../src/api/offer";
import { firstName, premium as premiumCopy, vip as vipCopy } from "../../src/components/offer/copy";
import { LockIcon } from "../../src/components/offer/icons";
import {
  WhereYouStand,
  shouldShowWhereYouStand,
} from "../../src/components/offer/WhereYouStand";
import { bracketLabel, bracketOf, bracketsWord } from "../../src/lib/brackets";
import { bracketsBeyondReach, shelfMisses } from "../../src/lib/gap";
import { secondsLeft } from "../../src/lib/perishable";
import { useLiveDerived } from "../../src/lib/live-clock";
import { Splash } from "../../src/components/Splash";
import { useBlockUser, useItem, useReport } from "../../src/api/item";
import { canBoost } from "../../src/api/featured";
import { useConfirmBoost } from "../../src/components/useConfirmBoost";
import { useLike } from "../../src/api/social";
import {
  BlockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CommentIcon,
  FlagIcon,
  HeartIcon,
  KebabIcon,
  LeafIcon,
  PinIcon,
  ShareIcon,
  StoreIcon,
  SwapIcon,
  VerifiedOrgIcon,
  WarningIcon,
} from "../../src/components/icons";
import { CountdownPill } from "../../src/components/CountdownPill";
import { NoticeDialog } from "../../src/components/NoticeDialog";
import { ReportReasonRows } from "../../src/components/ReportSheet";
import { SheetRow, SheetRows, SheetShell } from "../../src/components/sheet-ui";
import { EditListingSheet } from "../../src/components/home/EditListingSheet";
import { HubMap } from "../../src/components/map/HubMap";
import { MapErrorBoundary } from "../../src/components/map/MapErrorBoundary";
import { LISTING_PREVIEW_ZOOM_OUT } from "../../src/components/map/osm";
import { openDirections } from "../../src/components/map/directions";
import { BrowseError } from "../../src/components/marketplace/BrowseStates";
import { PhotoCarousel } from "../../src/components/marketplace/PhotoCarousel";
import { CommentsSheet } from "../../src/components/home/CommentsSheet";
import { Tappable } from "../../src/components/Tappable";
import { openPremium, type PremiumReason } from "../../src/lib/premium";
import { ORG_BADGE_LABEL } from "../../src/lib/org";
import { businessCategoryLabel } from "../../src/lib/business-category";
import type { TrustTier } from "../../src/lib/trust";
import {
  border,
  color,
  font,
  icon,
  radius,
  size,
  space,
  textStyle,
  type,
} from "../../src/theme/tokens";
import type { Item, OrgBadge, SafeZoneHub } from "../../src/api/types";
import { showDialog } from "../../src/components/dialog";

/**
 * The listing screen. Every listing opens here, whatever its kind: a person's
 * or a shop's, perishable or not, in reach or not, yours or someone else's.
 *
 * ONE REQUEST. /api/v1/items/[id] is a composite: the item, the owner with a
 * REAL trust tier, the Safe-Zone hubs, and everything an offer sheet would
 * need. Nothing on this screen issues a second fetch.
 *
 * ── LAYOUT (1 Oct 2026) ─────────────────────────────────────────────────────
 *
 *   Photo, full bleed, with round back / share / ⋯ buttons over it and page
 *   dots from the second photo. Report and Block live in the ⋯ menu, with the
 *   same handlers and confirmations they had as rows at the bottom.
 *
 *   The live CountdownPill (large), for perishables only. A standard listing
 *   has no pill and no gap: the title moves up.
 *
 *   Title, description, then the bracket with the viewer's distance to it
 *   ("within your reach" / "2 brackets above you", the Marketplace tile's
 *   rule), then condition · category · quantity as tags.
 *
 *   "Trades for": `wanted` (the owner's words) over `lookingForLabels` (the
 *   categories the matcher uses), in one card. Gone when both are empty.
 *
 *   The seller directly after, then "Ask a question" (the comments), then the
 *   Safe Zone. No like/comment count row: the heart is in the bottom bar.
 *
 *   A sticky bottom bar in place of the tab bar (TabBar hides itself on this
 *   route): the heart and "Send offer" for a visitor; the owner's own actions
 *   for the owner. The offer rules underneath it are unchanged -- see
 *   `BottomBar` for the order they are checked in.
 *
 * ── THE TRUST TIER IS THE SERVER'S OR IT IS NOTHING ─────────────────────────
 *
 * `resolveTier()` — the client-side approximation the feed and the grid fall
 * back to — is NOT used here. It reads `totalTrades`, a denormalised counter
 * that sits above the real completed count on live rows, and it cannot see
 * deferred-agreement defaults at all, so it reads HIGH for exactly the people
 * it matters most for. This is the screen where somebody decides whether to go
 * and meet a stranger in person, so when `trustTier` is null no tier is shown.
 *
 * ── THE MAP ─────────────────────────────────────────────────────────────────
 *
 * All 22 hub coordinates were confirmed by hand on 2026-08-29, so the pins
 * mean something. The preview opens two levels wider than the full map would
 * (LISTING_PREVIEW_ZOOM_OUT) and takes no gestures: one tap opens the full map.
 * The hub rows stay under it -- a pin gets two people to the same building,
 * the LANDMARK gets them to the same spot inside it. Each active hub has a
 * "Directions" link to the phone's own maps app, at the hub's coordinates.
 *
 * THE SELLER'S OWN PICKUP POINT IS NOT RENDERED AT ALL. `item.pickup` arrives
 * coarsened to ~1 km for anyone who is not the owner or an accepted
 * counterparty, and even coarsened it is a claim about where somebody lives.
 * The hub coordinate is the only location this screen puts anywhere.
 */
export default function ItemDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, comments } = useLocalSearchParams<{ id?: string; comments?: string }>();
  const { data, isPending, isError, error, refetch } = useItem(id);

  /*
   * §7 of the offer spec, fetched HERE rather than below the early returns:
   * hooks must run in the same order on every render, and three of the branches
   * under this line return before the item exists.
   *
   * Both are the queries the marketplace grid already ran on the way in, so
   * arriving from a tile costs nothing — TanStack dedupes by key. Arriving by
   * deep link, it is one extra request for the viewer's own shelf.
   */
  const { reach } = useReach();
  const me = useProfileMe().data;
  /**
   * The item §10.8's paragraph names by title. Highest AVAILABLE, per §7.1.
   * Null for an empty shelf — which is NOT a reason to skip the insert: the
   * reach is then §7.1's floor and the grid greys against it, so the insert
   * draws its empty-shelf variant instead. See the WhereYouStand header.
   */
  const highestItem = (me?.items ?? []).reduce<Item | null>(
    (best, row) =>
      row.status === "AVAILABLE" &&
      !row.hiddenByModerator &&
      row.valueLeaves !== null &&
      (best === null || row.valueLeaves > (best.valueLeaves ?? 0))
        ? row
        : best,
    null,
  );

  /**
   * Whether a perishable's window has run out, by the live clock or by the
   * server's flag. Re-renders this screen once, when it flips -- the pill does
   * the per-second work.
   */
  const perishable = data?.item.perishable ?? null;
  const ended = useLiveDerived(
    (now) => perishable !== null && (perishable.expired || secondsLeft(perishable.expiresAt, now) <= 0),
    perishable !== null && !perishable.expired,
  );

  const report = useReport();
  const block = useBlockUser();
  const { confirmBoost, isBoosting } = useConfirmBoost();
  const [acted, setActed] = useState<"reported" | "blocked" | null>(null);
  const [reachDialogOpen, setReachDialogOpen] = useState(false);
  /**
   * The ⋯ menu, and which panel of it is showing. The report reasons are a
   * PANEL of the menu, not a second modal over it -- see SheetShell's note on
   * `onBack`. The reasons themselves are ReportReasonRows: never an Alert,
   * which on Android silently drops every button past the third.
   */
  const [menu, setMenu] = useState<null | "menu" | "report">(null);
  const [editing, setEditing] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(comments === "1");
  const [barHeight, setBarHeight] = useState<number>(size.detail.actionButton + space.detail.actionBarY * 2);
  const { mutate: like } = useLike();

  const apiError = error instanceof ApiError ? error : null;

  // Same rule as every other screen: a 401 means the interceptor has already
  // given up and cleared the session, so the group guard is about to swap in
  // the login screen. An error card would flash for one frame.
  if (isError && apiError?.code === "UNAUTHENTICATED") {
    return <Splash waitingOn="Signing you back in" />;
  }

  if (!id) {
    return (
      <View style={s.screen}>
        <BackRow onPress={() => router.back()} />
        <BrowseError
          headline="Could not open this listing"
          message="No item was named in that link."
          onRetry={() => router.back()}
        />
      </View>
    );
  }

  if (isPending) {
    return (
      <View style={s.screen}>
        <BackRow onPress={() => router.back()} />
        <DetailSkeleton />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={s.screen}>
        <BackRow onPress={() => router.back()} />
        <BrowseError
          headline={
            apiError?.code === "NOT_FOUND" ? "Listing unavailable" : "Could not open this listing"
          }
          message={
            apiError?.code === "NOT_FOUND"
              ? "This listing is no longer available. It may have been traded, removed by its owner, or taken down."
              : (apiError?.message ??
                "Check your mobile data or Wi-Fi and try again. Nothing you posted was lost.")
          }
          onRetry={refetch}
        />
      </View>
    );
  }

  const { item, viewer, review } = data;
  const hubs = item.safeZones ?? [];
  const own = viewer.isOwner;

  /**
   * THE LOCK WINS OVER THE INSERT. `Where you stand` ends "you can send an
   * offer regardless", and the premium lock says you cannot; drawing both
   * would put a contradiction on one screen. Precedence on this screen, top
   * to bottom: owner / unavailable → premium lock → tier cap (the composer's)
   * → out-of-reach, which is advisory. The server applies the same order in
   * `enforceInitiateTrade()`.
   */
  // "vip" locks the control too (bracket 9+, which Premium does not open).
  const locked = viewer.offerLock !== null;
  const showReach = !locked && shouldShowWhereYouStand(item.valueLeaves, reach);
  const outOfReach =
    !locked && item.valueLeaves !== null && reach !== null && bracketOf(item.valueLeaves) > reach;
  /**
   * THE RULE, NOT THE REACH. The reach is the upper edge — one bracket above
   * the best item — and the grid greys against it. But an offer may also be
   * one bracket BELOW the listing, so the real test for "can this person
   * offer on this at all" is whether ANY item on their shelf is within a
   * bracket of it, in either direction. `shelfMisses()` answers that and says
   * which way it missed, so the notice can name the actual reason.
   */
  const listingBracket = item.valueLeaves !== null ? bracketOf(item.valueLeaves) : null;
  const shelfValues = (me?.items ?? [])
    .filter((row) => row.status === "AVAILABLE" && !row.hiddenByModerator)
    .map((row) => row.valueLeaves);
  const misses = listingBracket !== null && me ? shelfMisses(shelfValues, listingBracket) : null;
  const cannotOffer = !locked && listingBracket !== null && (outOfReach || misses !== null);
  const reachInsert =
    showReach && me ? (
      <WhereYouStand
        listingValue={item.valueLeaves as number}
        highestItem={
          highestItem && highestItem.valueLeaves !== null
            ? { title: highestItem.title, valueLeaves: highestItem.valueLeaves }
            : null
        }
        reach={reach as number}
      />
    ) : null;

  /**
   * The Marketplace tile's distance line, beside the bracket: strictly
   * greater is out of reach; in the reach bracket is in reach. Nothing while
   * the reach is loading (null is not zero), for an unvalued listing, or on
   * your own.
   */
  const beyond =
    !own && reach != null && item.valueLeaves !== null
      ? bracketsBeyondReach(item.valueLeaves, reach)
      : null;
  const reachLine =
    beyond === null ? null : beyond === 0 ? "within your reach" : `${bracketsWord(beyond)} above you`;

  const amount = item.perishable ? perishableAmount(item.perishable) : null;
  const wanted = item.wanted?.trim() ?? "";
  const lookingFor = item.lookingForLabels.join(" · ");

  /**
   * A reason was picked. The menu stays up while the request is in flight —
   * SheetShell swaps its Cancel for a spinner — and comes down on either
   * outcome, because both of them are answered by a dialog.
   */
  const onPickReason = (category: string) => {
    report.mutate(
      { targetType: "listing", targetId: item.id, category },
      {
        onSuccess: () => {
          setMenu(null);
          setActed("reported");
          showDialog(
            "Thanks — that is with a moderator",
            "They review every report and will let you know the outcome.",
          );
        },
        onError: (e) => {
          setMenu(null);
          showDialog(
            // A 409 is not a failure: it means this reporter already has an
            // open report against this listing. Saying "already reported" is
            // the truthful answer and stops them retrying.
            e instanceof ApiError && e.code === "CONFLICT"
              ? "Already reported"
              : "Could not send that report",
            e instanceof ApiError ? e.message : "Something went wrong. Please try again.",
          );
        },
      },
    );
  };

  // The confirmation is the themed dialog, which stacks over the open menu.
  const onBlock = () => {
    showDialog(
      `Block ${item.owner.name}?`,
      "You will not see each other's listings and neither of you can message the other. " +
        "Trades already in progress are not cancelled — a block cannot undo a handover " +
        "that has already happened.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () =>
            block.mutate(item.owner.id, {
              onSuccess: () => {
                setMenu(null);
                setActed("blocked");
                // The listing is now invisible to this viewer, so staying on it
                // would show something the rest of the app has just hidden.
                router.back();
              },
              onError: (e) => {
                setMenu(null);
                showDialog(
                  "Could not block",
                  e instanceof ApiError ? e.message : "Something went wrong.",
                );
              },
            }),
        },
      ],
    );
  };

  const onShare = () => void Share.share({ message: item.title, title: item.title });

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: barHeight + space.detail.sectionY }}>
        <View>
          <PhotoCarousel images={item.images} title={item.title} counter={false} />

          {/* Over the photo. The status bar is drawn over it too, so the row
              starts below the inset. */}
          <View style={[s.photoButtons, { top: insets.top + 8 }]} pointerEvents="box-none">
            <PhotoButton label="Go back" onPress={() => router.back()}>
              <ChevronLeftIcon size={icon.photoOverlay.size} stroke={icon.photoOverlay.stroke} color={color.onScrim} />
            </PhotoButton>
            <View style={s.photoButtonsRight} pointerEvents="box-none">
              <PhotoButton label="Share" onPress={onShare}>
                <ShareIcon size={icon.photoOverlay.size} stroke={icon.photoOverlay.stroke} color={color.onScrim} />
              </PhotoButton>
              {/* Report and Block act on someone else. On your own listing the
                  server refuses both, so there is no menu to open. */}
              {!own ? (
                <PhotoButton label="More options" onPress={() => setMenu("menu")}>
                  <View style={s.horizontal}>
                    <KebabIcon size={icon.photoOverlay.size} color={color.onScrim} />
                  </View>
                </PhotoButton>
              ) : null}
            </View>
          </View>
        </View>

        <View style={s.body}>
          {/* The owner's own listing, when something has happened to it:
              parked for review, refused, or taken down. One line and a way to
              the screen that explains it. */}
          {own && review ? (
            <Tappable
              onPress={() => router.push({ pathname: "/listing-review", params: { id: item.id } })}
              accessibilityRole="button"
              style={s.reviewBanner}
              pressedStyle={{ opacity: 0.85 }}
            >
              <Text style={[textStyle(type.detailBody), { color: color.ink, flex: 1 }]}>
                {review.state === "hidden"
                  ? "Hidden by a moderator — only you can see this."
                  : review.state === "waiting"
                    ? "Waiting for a value review — only you can see this."
                    : "Value not approved — only you can see this."}
              </Text>
              <Text style={[textStyle(type.detailBody), { color: color.forest }]}>What now?</Text>
            </Tappable>
          ) : null}

          {/* Perishables only; a standard listing has no pill and no gap. At
              zero it asks for a refetch: the server's lazy sweep is what turns
              the window into `expired`. */}
          {item.perishable ? (
            <CountdownPill
              size="large"
              expiresAt={item.perishable.expiresAt}
              expired={item.perishable.expired}
              onEnd={item.perishable.expired ? undefined : () => void refetch()}
              style={s.countdown}
            />
          ) : null}

          <Text style={[textStyle(type.detailTitle), s.title]}>{item.title}</Text>

          {item.description.trim() ? (
            <Text style={[textStyle(type.detailBody), s.description]}>{item.description}</Text>
          ) : null}

          {/* Omitted, never "0", for a listing that predates the valuation
              model — an unvalued item is not an item worth nothing. The
              bracket, never the figure: see `src/lib/brackets.ts`. */}
          {listingBracket !== null ? (
            <View
              style={s.bracketRow}
              accessible
              accessibilityRole="text"
              accessibilityLabel={
                bracketLabel(listingBracket) +
                (beyond === null
                  ? ""
                  : beyond === 0
                    ? ", within your reach"
                    : `, ${bracketsWord(beyond)} above your reach`)
              }
            >
              <LeafIcon size={icon.detailLeaf.size} stroke={icon.detailLeaf.stroke} color={color.forest} />
              <Text style={[textStyle(type.detailLeaves), { color: color.forest }]}>
                {bracketLabel(listingBracket)}
              </Text>
              {reachLine ? (
                <Text style={[textStyle(type.detailBody), s.reachLine]}>· {reachLine}</Text>
              ) : null}
            </View>
          ) : null}

          {/* Both labels arrive resolved from the server — never the raw enum.
              The quantity replaced the old "Perishable: 1 KG" section. */}
          <View style={s.tags}>
            <Tag label={item.conditionLabel} />
            <Tag label={item.categoryLabel} />
            {amount ? <Tag label={amount} /> : null}
          </View>

          {/* ── Owner: a live boost says when it ends. The Boost button itself
              is in the bottom bar with Edit. */}
          {own && item.featuredUntil ? (
            <View style={s.featuredNote} accessibilityRole="text">
              <LeafIcon size={icon.detailLeaf.size} stroke={icon.detailLeaf.stroke} color={color.forest} />
              <Text style={[textStyle(type.detailBody), { color: color.forest, flex: 1 }]}>
                Featured until {formatFeaturedUntil(item.featuredUntil)}
              </Text>
            </View>
          ) : null}

          {/* §7.3 of the offer spec — `Where you stand`, whenever this listing
              is beyond the viewer's reach. Unchanged; only its place moved. */}
          {!own ? reachInsert : null}

          {wanted || lookingFor ? (
            <View
              style={s.tradesFor}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`Trades for: ${[wanted, lookingFor].filter(Boolean).join(". ")}`}
            >
              <View style={s.tradesForIcon}>
                <SwapIcon size={icon.hubPin.size} stroke={icon.hubPin.stroke} color={color.forest} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[textStyle(type.detailSection), { color: color.forest }]}>Trades for</Text>
                <Text style={[textStyle(type.detailBody), s.tradesForMain]}>{wanted || lookingFor}</Text>
                {wanted && lookingFor ? (
                  <Text style={[textStyle(type.hubLandmark), s.tradesForSub]}>{lookingFor}</Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <SellerRow
            owner={item.owner}
            onPress={() => router.push({ pathname: "/user", params: { id: item.owner.id } })}
          />

          <Tappable
            onPress={() => setCommentsOpen(true)}
            accessibilityRole="button"
            style={s.askRow}
            pressedStyle={s.pressed}
          >
            <CommentIcon size={icon.danger.size} stroke={icon.danger.stroke} color={color.forest} />
            <Text style={[textStyle(type.secondaryButton), { color: color.forest }]}>Ask a question</Text>
          </Tappable>

          {!own && hubs.length > 0 ? (
            <View style={s.section}>
              <Text style={[textStyle(type.detailSection), s.sectionHeading]}>Meet at a safe hub</Text>
              {/* The whole preview is one target. `HubMap` with
                  `interactive={false}` takes no touches, so this Tappable
                  receives them. */}
              <Tappable
                onPress={() => router.push({ pathname: "/hubs", params: { itemId: item.id } })}
                accessibilityRole="button"
                accessibilityLabel={
                  `Open the map. ${hubs.length} safe ${hubs.length === 1 ? "hub" : "hubs"} ` +
                  `for this listing: ${hubs.map((h) => h.name).join(", ")}.`
                }
                style={s.mapPreview}
              >
                {/* `listHubs={false}`: the hub rows are printed directly below,
                    so the fallback shows the notice alone. */}
                <MapErrorBoundary hubs={hubs} listHubs={false}>
                  <HubMap
                    hubs={hubs}
                    interactive={false}
                    zoomOut={LISTING_PREVIEW_ZOOM_OUT}
                    emptyMessage="No safe hub set for this listing."
                    style={s.mapSurface}
                  />
                </MapErrorBoundary>
              </Tappable>

              <View style={s.hubs}>
                {hubs.map((h) => (
                  <HubRow key={h.id} hub={h} />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View
        style={[s.bar, { paddingBottom: space.detail.actionBarY + insets.bottom }]}
        onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}
      >
        <BottomBar
          own={own}
          action={viewer.action}
          existingOfferId={viewer.existingOfferId}
          ended={ended}
          lock={
            locked && item.valueLeaves !== null
              ? {
                  kind: viewer.offerLock ?? "premium",
                  bracket: bracketOf(item.valueLeaves),
                  owner: firstName(item.owner.name),
                  onPress: () =>
                    openPremium(router, viewer.offerLock ?? "premium", bracketOf(item.valueLeaves!)),
                }
              : null
          }
          liked={item.stats.liked}
          onLike={() => like({ itemId: item.id, next: !item.stats.liked })}
          onEdit={() => setEditing(true)}
          boost={
            own && !item.featuredUntil && canBoost(item)
              ? { busy: isBoosting, onPress: () => confirmBoost(item) }
              : null
          }
          onOffer={() => {
            if (cannotOffer) {
              setReachDialogOpen(true);
              return;
            }
            router.push({ pathname: "/offer", params: { itemId: item.id, title: item.title } });
          }}
        />
      </View>

      {/*
        THE ONE-BRACKET RULE, STATED THE RIGHT WAY ROUND.

        An offer may be the same bracket as the listing, one below, or one
        above; what is not allowed is two or more apart, in either direction.
        So the sentence names the rule and then the direction this shelf
        missed in. `misses === null` with `outOfReach` true cannot happen (the
        reach is one above the best item, so anything past it is two above),
        but the fallback wording is still true if it ever did.
      */}
      <NoticeDialog
        visible={reachDialogOpen}
        title={
          misses === "below"
            ? "This item is below everything you have"
            : "This item is too far above your items"
        }
        body={
          listingBracket === null
            ? "This listing has no value yet, so there is no bracket to match it against."
            : misses === "below"
              ? `An offer can be the same bracket as the listing, one below, or one above. ` +
                `This listing is in ${bracketLabel(listingBracket)}, and everything you have posted ` +
                `is two or more brackets above it. Post something smaller, or find a listing nearer your own.`
              : `Trading for an item 2 or more brackets above your item isn't allowed — one bracket ` +
                `above at most. This listing is in ${bracketLabel(listingBracket)}. ` +
                `Trade for items closer to what you own to move your reach higher.`
        }
        icon={<WarningIcon size={24} stroke={2} color={color.forest} />}
        onDismiss={() => setReachDialogOpen(false)}
      />

      {menu ? (
        <SheetShell
          title={menu === "report" ? "Why are you reporting this listing?" : item.title}
          onBack={menu === "report" ? () => setMenu("menu") : undefined}
          onClose={() => setMenu(null)}
          busy={report.isPending || block.isPending}
        >
          {menu === "report" ? (
            <ReportReasonRows onPick={onPickReason} disabled={report.isPending} />
          ) : (
            <SheetRows>
              <SheetRow
                glyph={<FlagIcon size={icon.menuRow.size} stroke={icon.menuRow.stroke} color={color.inkSecondary} />}
                label={acted === "reported" ? "Reported — a moderator will review it" : "Report this listing"}
                disabled={acted === "reported" || report.isPending}
                onPress={() => setMenu("report")}
              />
              <SheetRow
                glyph={<BlockIcon size={icon.menuRow.size} stroke={icon.menuRow.stroke} color={color.urgent} />}
                label={`Block ${item.owner.name}`}
                destructive
                disabled={block.isPending || acted === "blocked"}
                onPress={onBlock}
              />
            </SheetRows>
          )}
        </SheetShell>
      ) : null}
      <EditListingSheet item={editing ? item : null} onClose={() => setEditing(false)} />
      <CommentsSheet item={commentsOpen ? item : null} onClose={() => setCommentsOpen(false)} />
    </View>
  );
}

/* ─────────────────────────────── pieces ─────────────────────────────── */

/** The plain back row, for the loading and error states that have no photo. */
function BackRow({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.backRow, { paddingTop: insets.top + 4 }]}>
      <Tappable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={s.back}
        pressedStyle={s.pressed}
      >
        <ChevronLeftIcon size={icon.back.size} stroke={icon.back.stroke} color={color.ink} />
      </Tappable>
    </View>
  );
}

/** A round button over the photo: the scrim and ink the photo badges use. */
function PhotoButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={s.photoButton}
      pressedStyle={s.pressed}
      hitSlop={4}
    >
      {children}
    </Tappable>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={s.tag}>
      <Text style={[textStyle(type.chip), { color: color.inkSecondary }]}>{label}</Text>
    </View>
  );
}

/** "Thu 3:40 PM" — a boost window is never more than a day, so no date. */
function formatFeaturedUntil(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "1.5 kg", "3 pcs", "2 L" — or null when the owner gave no amount. */
function perishableAmount(p: NonNullable<Item["perishable"]>): string | null {
  if (p.quantity == null || !p.quantityUnit) return null;
  // Lowercase units, except the litre: a lowercase "l" reads as the digit 1.
  const unit = p.quantityUnit === "LITERS" ? "L" : p.quantityUnit.toLowerCase();
  return `${p.quantity} ${unit}`;
}

/**
 * Who is offering it, tappable through to their profile.
 *
 * A PERSON: avatar, name, "Rising Trader · Cebu · 12 trades". The tier is
 * the server's resolved one or it is left out (see the file header); there
 * is no tier badge any more, the tier is in the line. The trade count is
 * `totalTrades`, which is fine as a displayed statistic (not as a tier input).
 *
 * A SHOP: its square logo, its name, the verified checkmark once reviewed,
 * and its business category. The chevron opens the storefront, which is the
 * shop's backing account's profile.
 */
function SellerRow({ owner, onPress }: { owner: Item["owner"]; onPress: () => void }) {
  const org: OrgBadge | null = owner.org;
  const tier: TrustTier | null = owner.trustTier;
  const meta = org
    ? businessCategoryLabel(org.businessCategory)
    : [
        tier,
        owner.location?.trim() || null,
        `${owner.totalTrades} ${owner.totalTrades === 1 ? "trade" : "trades"}`,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        `${org ? org.name : owner.name}` +
        (org?.verified ? `, ${ORG_BADGE_LABEL.full}` : "") +
        `. ${meta}. ${org ? "Open storefront." : "View profile."}`
      }
      style={s.seller}
      pressedStyle={s.pressed}
    >
      {/* Square for a shop, round for a person: a round mask crops the
          corners off a wordmark. */}
      {org ? (
        org.logoUrl ? (
          <Image source={{ uri: org.logoUrl }} contentFit="cover" style={[s.avatar, s.orgAvatar]} />
        ) : (
          <View style={[s.avatar, s.orgAvatar, s.avatarFallback]}>
            <StoreIcon size={22} stroke={1.6} color={color.forest} />
          </View>
        )
      ) : owner.avatar ? (
        <Image source={{ uri: owner.avatar }} contentFit="cover" style={s.avatar} />
      ) : (
        <View style={[s.avatar, s.avatarFallback]}>
          <Text style={[textStyle(type.avatarInitials40), { color: color.forest }]}>
            {owner.name.trim().charAt(0).toUpperCase() || "?"}
          </Text>
        </View>
      )}

      <View style={s.sellerText}>
        <View style={s.sellerNameRow}>
          <Text style={[textStyle(type.username), s.sellerName]} numberOfLines={1}>
            {org ? org.name : owner.name}
          </Text>
          {org?.verified ? (
            <View style={s.verifiedBadge}>
              <VerifiedOrgIcon size={icon.orgBadge.size} stroke={icon.orgBadge.stroke} color={color.forest} />
              <Text style={[textStyle(type.tierBadge), { color: color.forest }]}>{ORG_BADGE_LABEL.compact}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[textStyle(type.metadata), s.sellerMeta]} numberOfLines={2}>
          {meta}
        </Text>
      </View>

      <ChevronRightIcon size={icon.chevron.size} stroke={icon.chevron.stroke} color={color.inkMuted} />
    </Tappable>
  );
}

/**
 * One Safe-Zone hub, with a way to get there.
 *
 * A DEACTIVATED HUB IS SHOWN, struck through and labelled, and gets no
 * Directions: sending someone to a place that is no longer a Safe Zone is
 * the one thing this row must not do.
 */
function HubRow({ hub }: { hub: SafeZoneHub }) {
  return (
    <View style={s.hub}>
      <View style={[s.hubIcon, !hub.isActive && s.hubIconOff]}>
        <PinIcon
          size={icon.hubPin.size}
          stroke={icon.hubPin.stroke}
          color={hub.isActive ? color.forest : color.inkStale}
        />
      </View>

      <View style={s.hubText}>
        <Text
          style={[
            textStyle(type.hubName),
            { color: hub.isActive ? color.ink : color.inkStale },
            !hub.isActive && s.struck,
          ]}
          numberOfLines={2}
        >
          {hub.name}
        </Text>
        <Text style={[textStyle(type.hubLandmark), s.hubLandmark]}>
          {hub.isActive
            ? `${hub.typeLabel} · ${hub.landmark}`
            : "No longer a safe hub — agree somewhere else"}
        </Text>
        {hub.isActive ? (
          <Tappable
            onPress={() => void directionsTo(hub)}
            accessibilityRole="link"
            accessibilityLabel={`Directions to ${hub.name}`}
            style={s.directions}
            pressedStyle={s.pressed}
          >
            <Text style={[textStyle(type.hubName), { color: color.forest }]}>Directions</Text>
          </Tappable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The phone's own maps app at the hub's coordinates, through the same helper
 * the map's hub card uses (`geo:`, then OpenStreetMap on the web). See
 * components/map/directions for why it tries the open instead of asking.
 */
async function directionsTo(hub: SafeZoneHub) {
  const outcome = await openDirections({ latitude: hub.latitude, longitude: hub.longitude, name: hub.name });
  if (outcome === "failed") showDialog("Could not open maps", "No maps app or browser is available on this phone.");
}

/**
 * The sticky bar. Checked in this order, so each state is the first true one:
 *
 *   1. Your own listing: your actions — Edit, and Boost while it can be
 *      boosted — or the inert "In trade" / "Traded". No heart, no offer.
 *   2. In trade / traded: said, inert. (Unchanged.)
 *   3. A perishable that has ended: "This listing has ended", inert.
 *   4. The premium / VIP lock: the lock line and its explanation, opening the
 *      Premium screen. (Unchanged: it says what is locked, never "Upgrade".)
 *   5. "Send offer", or "See your offer" when one is pending. An out-of-reach
 *      tap still opens the one-bracket notice instead of the composer.
 *
 * The heart sits beside 2–5.
 */
function BottomBar({
  own,
  action,
  existingOfferId,
  ended,
  lock,
  liked,
  onLike,
  onEdit,
  boost,
  onOffer,
}: {
  own: boolean;
  action: "EDIT" | "SEND_OFFER" | "IN_TRADE" | "TRADED";
  existingOfferId: string | null;
  ended: boolean;
  lock: { kind: PremiumReason; bracket: number; owner: string; onPress: () => void } | null;
  liked: boolean;
  onLike: () => void;
  onEdit: () => void;
  boost: { busy: boolean; onPress: () => void } | null;
  onOffer: () => void;
}) {
  const inert = (label: string) => (
    <View style={[s.action, s.actionInert]} accessible accessibilityRole="text">
      <Text style={[textStyle(type.primaryButton), s.barLabel, { color: color.inkMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );

  if (own) {
    if (action === "IN_TRADE" || action === "TRADED") {
      return <View style={s.barRow}>{inert(action === "IN_TRADE" ? "In trade" : "Traded")}</View>;
    }
    return (
      <View style={s.barRow}>
        <Tappable
          onPress={onEdit}
          accessibilityRole="button"
          style={[s.action, s.actionOutline]}
          pressedStyle={s.pressed}
        >
          <Text style={[textStyle(type.primaryButton), s.barLabel, { color: color.forest }]}>Edit listing</Text>
        </Tappable>
        {boost ? (
          <Tappable
            onPress={boost.onPress}
            disabled={boost.busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: boost.busy }}
            style={s.action}
            pressedStyle={s.pressed}
          >
            <Text style={[textStyle(type.primaryButton), { color: color.onGreen }]}>
              {boost.busy ? "Boosting…" : "Boost"}
            </Text>
          </Tappable>
        ) : null}
      </View>
    );
  }

  const heart = (
    <Tappable
      onPress={onLike}
      accessibilityRole="button"
      accessibilityLabel="Favorite"
      accessibilityState={{ selected: liked }}
      style={s.heart}
      pressedStyle={s.pressed}
    >
      <HeartIcon liked={liked} size={icon.social.size} stroke={icon.social.stroke} color={liked ? color.like : color.ink} />
    </Tappable>
  );

  if (action === "IN_TRADE" || action === "TRADED") {
    return (
      <View style={s.barRow}>
        {heart}
        {inert(action === "IN_TRADE" ? "In trade" : "Traded")}
      </View>
    );
  }

  if (ended) {
    return (
      <View style={s.barRow}>
        {heart}
        {inert("This listing has ended")}
      </View>
    );
  }

  if (lock) {
    // It replaces the offer button rather than sitting beside it: a locked
    // line above a live "Send offer" would be the contradiction the server
    // then resolves with a 403. It must not imply a purchase is possible
    // today — the Premium screen says payments are not open yet.
    const c = lock.kind === "vip" ? vipCopy : premiumCopy;
    return (
      <View>
        <View style={s.barRow}>
          {heart}
          <Tappable
            onPress={lock.onPress}
            accessibilityRole="button"
            accessibilityLabel={c.a11y(lock.bracket)}
            style={[s.action, s.actionInert, s.actionLocked]}
            pressedStyle={s.pressed}
          >
            <LockIcon size={icon.danger.size} stroke={icon.danger.stroke} color={color.inkSecondary} />
            <Text style={[textStyle(type.primaryButton), s.barLabel, { color: color.inkSecondary, flexShrink: 1 }]} numberOfLines={2}>
              {c.bar}
            </Text>
          </Tappable>
        </View>
        <Text style={[textStyle(type.gridMeta), s.lockedBody]} onPress={lock.onPress}>
          {c.body(lock.bracket, lock.owner)} <Text style={s.lockedLink}>{c.see}</Text>
        </Text>
      </View>
    );
  }

  return (
    <View style={s.barRow}>
      {heart}
      <Tappable
        onPress={onOffer}
        disabled={action !== "SEND_OFFER"}
        accessibilityRole="button"
        accessibilityState={{ disabled: action !== "SEND_OFFER" }}
        style={s.action}
        pressedStyle={s.pressed}
      >
        <Text style={[textStyle(type.primaryButton), s.barLabel, { color: color.onGreen }]} numberOfLines={2}>
          {/*
            "See your offer", not "Update your offer". Nothing on the server can
            change or withdraw a sent offer, so the button leads to §5.2's
            pending-offer state rather than promising an edit.
          */}
          {existingOfferId ? "See your offer" : "Send offer"}
        </Text>
      </Tappable>
    </View>
  );
}

function DetailSkeleton() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={s.skeletonPhoto} />
      <View style={s.body}>
        <View style={[s.skeletonLine, { width: "80%", height: 22 }]} />
        <View style={[s.skeletonLine, { width: 90, height: 16, marginTop: 14 }]} />
        <View style={[s.skeletonLine, { width: 170, height: 26, marginTop: 16 }]} />
        <View style={[s.skeletonLine, { width: "100%", height: 56, marginTop: 22 }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  pressed: { opacity: 0.7 },

  backRow: { paddingHorizontal: space.screenXTight, paddingTop: 4 },
  back: {
    width: size.detail.backButton,
    height: size.detail.backButton,
    alignItems: "center",
    justifyContent: "center",
  },

  photoButtons: {
    position: "absolute",
    left: space.screenXTight,
    right: space.screenXTight,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  photoButtonsRight: { flexDirection: "row", gap: 8 },
  photoButton: {
    width: size.detail.overlayButton,
    height: size.detail.overlayButton,
    borderRadius: size.detail.overlayButton / 2,
    backgroundColor: color.captionFill,
    alignItems: "center",
    justifyContent: "center",
  },
  // The kebab glyph is vertical; the photo's "more" is the horizontal ⋯.
  horizontal: { transform: [{ rotate: "90deg" }] },

  body: { paddingHorizontal: space.detail.x, paddingTop: space.detail.photoToBody },
  reviewBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: color.greenWash,
  },
  countdown: { marginBottom: space.detail.titleToLeaves },
  title: { color: color.ink },
  description: { color: color.inkSecondary, marginTop: 10 },

  bracketRow: {
    marginTop: space.detail.titleToLeaves + 4,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: size.leaves.gap,
    rowGap: 2,
  },
  reachLine: { color: color.inkSecondary },

  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.card.chipGap,
    marginTop: space.detail.leavesToChips,
  },
  tag: {
    paddingHorizontal: space.chip.x,
    paddingVertical: space.chip.y,
    borderRadius: radius.chip,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    backgroundColor: color.control,
  },

  featuredNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: color.greenWash,
  },

  tradesFor: {
    marginTop: space.detail.sectionY,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.detail.hubIconToText,
    padding: space.browse.tileBody + 2,
    borderRadius: radius.hubRow,
    borderWidth: border.chip,
    borderColor: color.greenLine,
    backgroundColor: color.greenWash,
  },
  tradesForIcon: {
    width: size.detail.hubIcon,
    height: size.detail.hubIcon,
    borderRadius: size.detail.hubIcon / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surface,
  },
  tradesForMain: { color: color.ink, marginTop: 2 },
  tradesForSub: { color: color.inkSecondary, marginTop: 2 },

  seller: {
    marginTop: space.detail.sectionY,
    flexDirection: "row",
    alignItems: "center",
    gap: space.card.ownerGap,
    paddingVertical: space.detail.ownerY,
    borderTopWidth: border.hairline,
    borderBottomWidth: border.hairline,
    borderColor: color.divider,
  },
  avatar: {
    width: size.avatar.owner,
    height: size.avatar.owner,
    borderRadius: radius.ownerAvatar,
    backgroundColor: color.greenWash,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  // Square logo in the same 40 slot as the avatar; only the mask differs.
  orgAvatar: { borderRadius: 8 },
  sellerText: { flex: 1 },
  sellerNameRow: { flexDirection: "row", alignItems: "center", gap: space.card.nameToBadge },
  sellerName: { flexShrink: 1, color: color.ink },
  sellerMeta: { marginTop: space.card.nameToMeta, color: color.inkSecondary },
  verifiedBadge: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.tierBadge,
    borderWidth: border.chip,
    paddingHorizontal: space.tierBadge.x,
    paddingVertical: space.tierBadge.y,
    backgroundColor: color.greenWash,
    borderColor: color.greenLine,
  },

  askRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: size.detail.dangerRow,
    alignSelf: "flex-start",
  },

  section: { marginTop: space.detail.sectionY - 4 },
  sectionHeading: { color: color.ink, marginBottom: space.detail.headingToBody },

  /* 16:10 — wide enough to hold two hubs on opposite sides of the channel,
     short enough that the landmark text under it stays on screen with it. */
  mapPreview: {
    aspectRatio: 16 / 10,
    marginBottom: space.detail.hubGap + 4,
    borderRadius: radius.gridPhoto,
    overflow: "hidden",
    borderWidth: border.hairline,
    borderColor: color.divider,
  },
  mapSurface: { flex: 1, borderRadius: 0 },

  hubs: { gap: space.detail.hubGap },
  hub: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.detail.hubIconToText,
    padding: space.browse.tileBody,
    borderRadius: radius.hubRow,
    borderWidth: border.chip,
    borderColor: color.greenLine,
    backgroundColor: color.greenWash,
  },
  hubIcon: {
    width: size.detail.hubIcon,
    height: size.detail.hubIcon,
    borderRadius: size.detail.hubIcon / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surface,
  },
  hubIconOff: { backgroundColor: color.control },
  hubText: { flex: 1 },
  hubLandmark: { marginTop: space.detail.hubNameToLandmark, color: color.inkSecondary },
  struck: { textDecorationLine: "line-through" },
  directions: { alignSelf: "flex-start", paddingVertical: 8, marginBottom: -4 },

  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    paddingHorizontal: space.detail.x,
    paddingTop: space.detail.actionBarY,
    backgroundColor: color.surface,
    borderTopWidth: border.hairline,
    borderTopColor: color.divider,
  },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heart: {
    width: size.detail.actionButton,
    height: size.detail.actionButton,
    borderRadius: radius.primaryButton,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    alignItems: "center",
    justifyContent: "center",
  },
  action: {
    flex: 1,
    minHeight: size.detail.actionButton,
    paddingHorizontal: 12,
    borderRadius: radius.primaryButton,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
  },
  actionOutline: {
    backgroundColor: color.greenWash,
    borderWidth: border.chip,
    borderColor: color.forest,
  },
  actionInert: { backgroundColor: color.control },
  actionLocked: { flexDirection: "row", gap: 8 },
  // Wraps to a second line at large text sizes rather than truncating beside
  // the heart; the bar measures itself, so the scroll padding follows.
  barLabel: { textAlign: "center", paddingVertical: 6 },
  lockedBody: { color: color.inkMuted, marginTop: 8 },
  lockedLink: { color: color.forest, fontFamily: font.sansSemi },

  skeletonPhoto: {
    width: "100%",
    aspectRatio: size.detail.photoAspect,
    backgroundColor: color.skeleton,
  },
  skeletonLine: { borderRadius: 4, backgroundColor: color.skeletonSoft },
});
