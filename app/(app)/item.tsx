import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { ApiError } from "../../src/api/client";
import { Splash } from "../../src/components/Splash";
import { useBlockUser, useItem, useReport } from "../../src/api/item";
import {
  BlockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FlagIcon,
  LeafIcon,
  PinIcon,
} from "../../src/components/icons";
import { ReportSheet } from "../../src/components/ReportSheet";
import { HubMap } from "../../src/components/map/HubMap";
import { MapErrorBoundary } from "../../src/components/map/MapErrorBoundary";
import { BrowseError } from "../../src/components/marketplace/BrowseStates";
import { PhotoCarousel } from "../../src/components/marketplace/PhotoCarousel";
import { Tappable } from "../../src/components/Tappable";
import { TIER_LABEL, type TrustTier } from "../../src/lib/trust";
import {
  border,
  color,
  icon,
  radius,
  size,
  space,
  textStyle,
  type,
} from "../../src/theme/tokens";
import type { SafeZoneHub } from "../../src/api/types";

/**
 * Item detail. Reached from the grid, from the feed's Offer Trade button, and
 * from anywhere else that has an item id.
 *
 * ONE REQUEST. /api/v1/items/[id] is a composite: the item, the owner with a
 * REAL trust tier, the Safe-Zone hubs, and everything an offer sheet would
 * need. Nothing on this screen issues a second fetch.
 *
 * ── THE TRUST BADGE IS THE SERVER'S OR IT IS NOTHING ────────────────────────
 *
 * `resolveTier()` — the client-side approximation the feed and the grid fall
 * back to — is NOT used here, and that is the single most deliberate decision
 * on this screen. It reads `totalTrades`, a denormalised counter that sits
 * above the real completed count on live rows, and it cannot see deferred-
 * agreement defaults at all, so it reads HIGH for exactly the people it matters
 * most for. This is the screen where somebody decides whether to go and meet a
 * stranger in person. An inflated badge here is worse than no badge, so when
 * `trustTier` is null nothing is drawn.
 *
 * ── THE MAP, AND WHY IT IS ONLY NOW HERE ────────────────────────────────────
 *
 * This section listed hubs as text and nothing else, because the coordinates
 * were not verified: 9 of 22 had passed geocoding and pins for the other 13
 * would have been the ones nobody had checked. All 22 were confirmed by hand on
 * 2026-08-29 — which also overturned three of the nine — so the pins now mean
 * something and the map is drawn.
 *
 * THE TEXT LIST DID NOT GO AWAY, and should not. A pin gets two people to the
 * same building; the LANDMARK gets them to the same spot inside it, and that is
 * the harder half — "Parkmall" is not a meeting point, a mall has six
 * entrances. The map is above the list, not instead of it.
 *
 * The preview takes no gestures of its own: one tap anywhere on it opens the
 * full map. A pannable map inside a scrolling page fights the scroll, and this
 * one is four pins in a fixed frame, where panning has nothing to reveal.
 *
 * THE SELLER'S OWN PICKUP POINT IS NOT RENDERED AT ALL — least of all now that
 * there is a map to render it on. `item.pickup` arrives coarsened to ~1 km for
 * anyone who is not the owner or an accepted trade counterparty, and even
 * coarsened it is a claim about where somebody lives; a ~1 km circle around a
 * listing re-posted weekly from the same house resolves to that house after a
 * few observations. The hub coordinate is the only location this feature puts
 * on a screen, and `HubMap` has no prop that could accept another.
 */
export default function ItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isPending, isError, error, refetch } = useItem(id);

  const report = useReport();
  const block = useBlockUser();
  const [acted, setActed] = useState<"reported" | "blocked" | null>(null);
  /**
   * Whether the reason picker is up.
   *
   * IT REPLACED AN Alert, AND THAT WAS A BUG FIX, NOT A RESTYLE. The reasons
   * were the buttons of an `Alert.alert` — six of them plus a Cancel — and
   * Android renders at most THREE buttons in a dialog and silently drops the
   * rest. Testers on Android were being offered half the reasons, with no
   * indication that the list was truncated. See ReportSheet for the full note.
   */
  const [reporting, setReporting] = useState(false);

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
        <BrowseError message="No item was named in that link." onRetry={() => router.back()} />
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

  const { item, viewer } = data;
  const hubs = item.safeZones ?? [];

  /**
   * A reason was picked. The sheet stays up while the request is in flight —
   * SheetShell swaps its Cancel for a spinner — and comes down on either
   * outcome, because both of them are answered by a dialog and a sheet still
   * standing behind one reads as a step that did not finish.
   */
  const onPickReason = (category: string) => {
    report.mutate(
      { targetType: "listing", targetId: item.id, category },
      {
        onSuccess: () => {
          setReporting(false);
          setActed("reported");
          Alert.alert(
            "Thanks — that is with a moderator",
            "They review every report and will let you know the outcome.",
          );
        },
        onError: (e) => {
          setReporting(false);
          Alert.alert(
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

  const onBlock = () => {
    Alert.alert(
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
                setActed("blocked");
                // The listing is now invisible to this viewer, so staying on it
                // would show something the rest of the app has just hidden.
                router.back();
              },
              onError: (e) =>
                Alert.alert(
                  "Could not block",
                  e instanceof ApiError ? e.message : "Something went wrong.",
                ),
            }),
        },
      ],
    );
  };

  return (
    <View style={s.screen}>
      <BackRow onPress={() => router.back()} />

      <ScrollView contentContainerStyle={s.scroll}>
        <PhotoCarousel images={item.images} title={item.title} />

        <View style={s.body}>
          <Text style={[textStyle(type.detailTitle), s.title]}>{item.title}</Text>

          {/* Omitted, never "0", for a listing that predates the valuation
              model — an unvalued item is not an item worth nothing. */}
          {item.valueLeaves !== null ? (
            <View style={s.leavesRow}>
              <LeafIcon
                size={icon.detailLeaf.size}
                stroke={icon.detailLeaf.stroke}
                color={color.forest}
              />
              <Text style={[textStyle(type.detailLeaves), { color: color.forest }]}>
                {item.valueLeaves}
              </Text>
              <Text style={[textStyle(type.detailBody), { color: color.inkMuted }]}>Leaves</Text>
            </View>
          ) : null}

          <View style={s.chips}>
            <Chip label={item.conditionLabel} />
            <Chip label={item.categoryLabel} />
          </View>

          <OwnerRow
            name={item.owner.name}
            avatar={item.owner.avatar}
            location={item.owner.location}
            tier={item.owner.trustTier}
            rank={item.owner.rank}
            onPress={() =>
              router.push({ pathname: "/user", params: { id: item.owner.id } })
            }
          />

          {item.description.trim() ? (
            <Section heading="About this item">
              <Text style={[textStyle(type.detailBody), s.bodyText]}>{item.description}</Text>
            </Section>
          ) : null}

          {/* `wanted` is the owner's own words about what they will take back.
              Rendered plainly rather than in the urgency treatment — it is a
              wish list, not a deadline. */}
          {item.wanted?.trim() ? (
            <Section heading="Wanted in return">
              <Text style={[textStyle(type.detailBody), s.bodyText]}>{item.wanted}</Text>
            </Section>
          ) : null}

          {hubs.length > 0 ? (
            <Section heading="Meet at a Safe Zone">
              {/* The whole preview is one target. `HubMap` with
                  `interactive={false}` takes no touches, so this Tappable
                  receives them — see the note on that prop. */}
              <Tappable
                onPress={() => router.push({ pathname: "/hubs", params: { itemId: item.id } })}
                accessibilityRole="button"
                accessibilityLabel={
                  `Open the map. ${hubs.length} Safe ${hubs.length === 1 ? "Zone" : "Zones"} ` +
                  `for this listing: ${hubs.map((h) => h.name).join(", ")}.`
                }
                style={s.mapPreview}
              >
                {/* `listHubs={false}`: the hub rows are already printed
                    directly below this preview, so the fallback shows the
                    notice alone rather than the same rows twice. */}
                <MapErrorBoundary hubs={hubs} listHubs={false}>
                  <HubMap
                    hubs={hubs}
                    interactive={false}
                    emptyMessage="No Safe Zone set for this listing."
                    style={s.mapSurface}
                  />
                </MapErrorBoundary>
              </Tappable>

              <View style={s.hubs}>
                {hubs.map((h) => (
                  <HubRow key={h.id} hub={h} />
                ))}
              </View>
            </Section>
          ) : null}

          {/* Own listing: no reporting yourself, no blocking yourself. The
              server refuses both, and offering them would be a dead control. */}
          {!viewer.isOwner ? (
            <View style={s.danger}>
              <DangerRow
                icon={
                  <FlagIcon size={icon.danger.size} stroke={icon.danger.stroke} color={color.inkSecondary} />
                }
                label={acted === "reported" ? "Reported — a moderator will review it" : "Report this listing"}
                disabled={acted === "reported" || report.isPending}
                onPress={() => setReporting(true)}
              />
              <DangerRow
                icon={
                  <BlockIcon size={icon.danger.size} stroke={icon.danger.stroke} color={color.urgent} />
                }
                label={`Block ${item.owner.name}`}
                destructive
                disabled={block.isPending || acted === "blocked"}
                onPress={onBlock}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>

      <ActionBar
        canOffer={viewer.canOffer}
        isOwner={viewer.isOwner}
        status={item.status}
        existingOfferId={viewer.existingOfferId}
        onOffer={() =>
          router.push({ pathname: "/offer", params: { itemId: item.id, title: item.title } })
        }
      />

      {/*
        Mounted last so it sits over the sticky ActionBar. It renders nothing
        until `reporting` is true; the Modal inside it is created and destroyed
        with the picker rather than kept alive behind the screen.
      */}
      {reporting ? (
        <ReportSheet
          target="listing"
          targetName="this listing"
          busy={report.isPending}
          onPick={onPickReason}
          onClose={() => setReporting(false)}
        />
      ) : null}
    </View>
  );
}

/* ─────────────────────────────── pieces ─────────────────────────────── */

function BackRow({ onPress }: { onPress: () => void }) {
  return (
    <View style={s.backRow}>
      <Tappable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={s.back}
        pressedStyle={s.backPressed}
      >
        <ChevronLeftIcon size={icon.back.size} stroke={icon.back.stroke} color={color.ink} />
      </Tappable>
    </View>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View style={s.chip}>
      <Text style={[textStyle(type.chip), { color: color.inkSecondary }]}>{label}</Text>
    </View>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={[textStyle(type.detailSection), s.sectionHeading]}>{heading}</Text>
      {children}
    </View>
  );
}

/**
 * The owner, tappable through to their profile.
 *
 * The tier badge renders ONLY when the server sent a tier. See the note at the
 * top of this file — there is no fallback here on purpose.
 */
function OwnerRow({
  name,
  avatar,
  location,
  tier,
  rank,
  onPress,
}: {
  name: string;
  avatar: string | null;
  location: string | null;
  tier: TrustTier | null;
  rank: string;
  onPress: () => void;
}) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}${tier ? `, ${tier}` : ""}. View profile.`}
      style={s.owner}
      pressedStyle={s.ownerPressed}
    >
      {avatar ? (
        <Image source={{ uri: avatar }} contentFit="cover" style={s.avatar} />
      ) : (
        <View style={[s.avatar, s.avatarFallback]}>
          <Text style={[textStyle(type.avatarInitials40), { color: color.forest }]}>
            {name.trim().charAt(0).toUpperCase() || "?"}
          </Text>
        </View>
      )}

      <View style={s.ownerText}>
        <View style={s.ownerNameRow}>
          <Text style={[textStyle(type.username), s.ownerName]} numberOfLines={1}>
            {name}
          </Text>
          {tier ? <TierBadge tier={tier} /> : null}
        </View>
        {/* The Leaf rank is a different ladder from trust and is labelled as
            what it is, so the two are never read as one claim. */}
        <Text style={[textStyle(type.metadata), s.ownerMeta]} numberOfLines={1}>
          {location?.trim() ? `${location} · ${rank}` : rank}
        </Text>
      </View>

      <ChevronRightIcon size={icon.chevron.size} stroke={icon.chevron.stroke} color={color.inkMuted} />
    </Tappable>
  );
}

const TIER_TREATMENT: Record<TrustTier, { backgroundColor: string; borderColor: string; color: string }> = {
  "New Trader":     { backgroundColor: color.control,   borderColor: color.controlLine, color: color.inkMuted },
  "Rising Trader":  { backgroundColor: color.control,   borderColor: color.controlLine, color: color.inkMuted },
  "Trusted Trader": { backgroundColor: color.greenWash, borderColor: color.greenLine,   color: color.forest },
  "Top Trader":     { backgroundColor: color.green,     borderColor: "transparent",     color: color.onGreen },
};

function TierBadge({ tier }: { tier: TrustTier }) {
  const t = TIER_TREATMENT[tier];
  return (
    <View
      style={[s.tierBadge, { backgroundColor: t.backgroundColor, borderColor: t.borderColor }]}
      accessibilityRole="text"
      accessibilityLabel={tier}
    >
      <Text style={[textStyle(type.tierBadge), { color: t.color }]}>{TIER_LABEL[tier]}</Text>
    </View>
  );
}

/**
 * One Safe-Zone hub.
 *
 * A DEACTIVATED HUB IS SHOWN, struck through and labelled. The association
 * survives deactivation on the server precisely so the listing does not
 * silently lose the only answer it had to "where would we meet?" — filtering it
 * out here would undo that on the one screen it was built for.
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
          numberOfLines={1}
        >
          {hub.name}
        </Text>
        <Text style={[textStyle(type.hubLandmark), s.hubLandmark]}>
          {hub.isActive
            ? `${hub.typeLabel} · ${hub.landmark}`
            : "No longer a Safe Zone — agree somewhere else"}
        </Text>
      </View>
    </View>
  );
}

function DangerRow({
  icon: glyph,
  label,
  destructive = false,
  disabled = false,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Tappable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[s.dangerRow, disabled && s.dangerDisabled]}
      pressedStyle={s.dangerPressed}
    >
      {glyph}
      <Text
        style={[
          textStyle(type.dangerAction),
          { color: destructive ? color.urgent : color.inkSecondary },
        ]}
      >
        {label}
      </Text>
    </Tappable>
  );
}

/**
 * The sticky primary.
 *
 * It says WHY it is unavailable rather than being hidden or inert. A greyed
 * button with no explanation is the state people screenshot and send to
 * support; "You cannot offer on your own listing" ends the question.
 */
function ActionBar({
  canOffer,
  isOwner,
  status,
  existingOfferId,
  onOffer,
}: {
  canOffer: boolean;
  isOwner: boolean;
  status: string;
  existingOfferId: string | null;
  onOffer: () => void;
}) {
  const reason = isOwner
    ? "This is your listing"
    : status !== "AVAILABLE"
      ? "This listing is no longer available"
      : null;

  if (reason) {
    return (
      <View style={s.actionBar}>
        <View style={[s.action, s.actionInert]}>
          <Text style={[textStyle(type.primaryButton), { color: color.inkMuted }]}>{reason}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.actionBar}>
      <Tappable
        onPress={onOffer}
        disabled={!canOffer}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canOffer }}
        style={[s.action, !canOffer && s.actionInert]}
        pressedStyle={s.actionPressed}
      >
        <Text style={[textStyle(type.primaryButton), { color: color.onGreen }]}>
          {existingOfferId ? "Update your offer" : "Offer Trade"}
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
  scroll: { paddingBottom: space.detail.actionBarClearance },

  backRow: { paddingHorizontal: space.screenXTight, paddingTop: 4 },
  back: {
    width: size.detail.backButton,
    height: size.detail.backButton,
    alignItems: "center",
    justifyContent: "center",
  },
  backPressed: { opacity: 0.6 },

  body: { paddingHorizontal: space.detail.x, paddingTop: space.detail.photoToBody },
  title: { color: color.ink },
  leavesRow: {
    marginTop: space.detail.titleToLeaves,
    flexDirection: "row",
    alignItems: "center",
    gap: size.leaves.gap,
  },
  chips: {
    marginTop: space.detail.leavesToChips,
    flexDirection: "row",
    gap: space.card.chipGap,
  },
  chip: {
    paddingHorizontal: space.chip.x,
    paddingVertical: space.chip.y,
    borderRadius: radius.chip,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    backgroundColor: color.control,
  },

  owner: {
    marginTop: space.detail.chipsToOwner,
    flexDirection: "row",
    alignItems: "center",
    gap: space.card.ownerGap,
    paddingVertical: space.detail.ownerY,
    borderTopWidth: border.hairline,
    borderBottomWidth: border.hairline,
    borderColor: color.divider,
  },
  ownerPressed: { opacity: 0.7 },
  avatar: {
    width: size.avatar.owner,
    height: size.avatar.owner,
    borderRadius: radius.ownerAvatar,
    backgroundColor: color.greenWash,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  ownerText: { flex: 1 },
  ownerNameRow: { flexDirection: "row", alignItems: "center", gap: space.card.nameToBadge },
  ownerName: { flexShrink: 1, color: color.ink },
  ownerMeta: { marginTop: space.card.nameToMeta, color: color.inkMuted },
  tierBadge: {
    flexShrink: 0,
    borderRadius: radius.tierBadge,
    borderWidth: border.chip,
    paddingHorizontal: space.tierBadge.x,
    paddingVertical: space.tierBadge.y,
  },

  section: { marginTop: space.detail.sectionY },
  sectionHeading: { color: color.ink, marginBottom: space.detail.headingToBody },
  bodyText: { color: color.inkSecondary },

  /* The preview map above the hub list. 16:10 — wide enough to hold two hubs
     on opposite sides of the channel without the pins meeting in the middle,
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
    alignItems: "center",
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

  danger: {
    marginTop: space.detail.sectionY,
    paddingTop: space.detail.dangerY,
    borderTopWidth: border.hairline,
    borderTopColor: color.divider,
    gap: space.detail.dangerGap,
  },
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.card.ownerGap,
    height: size.detail.dangerRow,
  },
  dangerPressed: { opacity: 0.6 },
  dangerDisabled: { opacity: 0.45 },

  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.detail.x,
    paddingVertical: space.detail.actionBarY,
    backgroundColor: color.surface,
    borderTopWidth: border.hairline,
    borderTopColor: color.divider,
  },
  action: {
    height: size.detail.actionButton,
    borderRadius: radius.primaryButton,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
  },
  actionInert: { backgroundColor: color.control },
  actionPressed: { opacity: 0.85 },

  skeletonPhoto: {
    width: "100%",
    aspectRatio: size.detail.photoAspect,
    backgroundColor: color.skeleton,
  },
  skeletonLine: { borderRadius: 4, backgroundColor: color.skeletonSoft },
});
