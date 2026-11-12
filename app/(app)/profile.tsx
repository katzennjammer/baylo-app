import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, FlatList, Pressable, RefreshControl, Share, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useProfileMe, usePublicProfile } from "../../src/api/profile";
import { useProfileReviews, type ProfileReview } from "../../src/api/reviews";
import { useRefetchOnFocus } from "../../src/lib/refetch-on-focus";
import { useSession } from "../../src/auth/session";
import type { Item, ProfileMePayload } from "../../src/api/types";
import { bracketLabel, bracketOf as bracketOfValue } from "../../src/lib/brackets";
import { categoryTone, color, font, motion } from "../../src/theme/tokens";
import { orgLogoUrl, switchToOrganization, useOrganizations, type ActingOrg } from "../../src/api/organizations";
import { getActingOrgId } from "../../src/api/org-context";
import { LeafIcon, StoreIcon } from "../../src/components/icons";
import { OrgStorefrontHeader, ShopAbout, StorefrontEmpty, useStorefrontKeyboard } from "../../src/components/OrgStorefrontHeader";
import { GridIcon } from "../../src/components/icons";
import { useColorScheme } from "react-native";
import { TIER_LABEL } from "../../src/lib/trust";
import { getApiBase } from "../../src/api/config";
import { DEFAULT_MAX_PROFILE_BADGES, fetchAchievements } from "../../src/api/achievements";
import { HeaderButtons, PersonHeader } from "../../src/components/profile/PersonHeader";
import { Tappable } from "../../src/components/Tappable";
import { CheckIcon, ChevronRightIcon } from "../../src/components/icons";
import { NoticeDialog } from "../../src/components/NoticeDialog";
import { MascotEmptyState } from "../../src/components/MascotEmptyState";
import { sizedImage } from "../../src/media/image-url";

/**
 * Profile — the account block and the owner's shelf.
 *
 * Sign-out is no longer here. It lives in the AppHeader account menu, next to
 * Settings and Achievements, which is the one place it is reachable from every
 * tab.
 *
 * THE IDENTITY BLOCK READS THE STORED SESSION, not useHome(). It costs no
 * request — name, email and avatar were written to SecureStore by the token
 * endpoint at sign-in — and, more to the point, it is still correct on a phone
 * with no signal. Which is exactly the state someone is in when they most want
 * to check whose account this is.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { data: profile, refetch, isError: profileError, isRefetching: profileRefetching, isPending: profileLoading } = useProfileMe();
  const dark = useColorScheme() === "dark";
  const [tab, setTab] = useState<ShelfTab>("posts");

  // Badge art, the shelf and the counts are written by other screens and by the
  // admin panel, and this tab stays mounted behind them. Without this the shelf
  // serves its cached payload for the whole `staleTime` after a badge image is
  // added — the achievements screen would show the new art while this one still
  // showed the icon fallback. Same ask the Home and Marketplace grids make.
  useRefetchOnFocus(refetch);

  const user = session?.user;
  const {
    summary,
    reviews,
    refetch: refetchReviews,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoadingError: reviewsLoadError,
    isRefetching: reviewsRefetching,
  } = useProfileReviews(user?.id, tab === "reviews");

  const shareProfile = useCallback(async () => {
    const profileUrl = `${getApiBase().replace(/\/+$/, "")}/profile/${encodeURIComponent(user?.id ?? "")}`;
    await Share.share({
      message: `${profile?.user.name ?? user?.name ?? "A Baylo trader"} on Baylo\n${profileUrl}`,
      title: "Share profile",
    });
  }, [profile?.user.name, user?.id, user?.name]);

  // The shop this device is ACTING AS, if any. getActingOrgId() is read per
  // render, not mirrored into state: it is a module variable the request layer
  // reads synchronously on every call, so it is the one source of truth, and a
  // state copy would disagree the moment anything else cleared it -- which the
  // 403 handler does on a revoked membership.
  //
  // WHILE ACTING AS A SHOP, THIS TAB IS THE SHOP -- for everybody, not just
  // shop-only accounts. Until 25 Sep 2026 somebody with a personal history
  // who switched to their shop still got their PERSONAL profile here, under a
  // small "Acting as" strip: the Post button made shop listings while the tab
  // showed their own shelf, which is the wrong half of the account to put in
  // front of them. Now the storefront is shown with a prominent "Switch to
  // Myself" above it, and choosing that brings the personal profile back.
  const qc = useQueryClient();
  const { data: orgsData, isLoading: orgsLoading } = useOrganizations();
  const [, setContextTick] = useState(0);
  const [pickingShop, setPickingShop] = useState(false);
  const actingOrgId = getActingOrgId();
  const actingOrg = actingOrgId ? orgsData?.data.organizations.find((o) => o.id === actingOrgId) : undefined;

  // ── SHOP-ONLY ACCOUNTS NEVER SEE A PERSONAL PROFILE ─────────────────────
  //
  // Somebody who has never listed, offered or traded as themselves, and who
  // owns or staffs at least one shop, gets the shop HERE, in place of the
  // personal layout: an empty personal shelf would only raise the question
  // "which account am I?". The server decides "never as themselves" (see
  // hasPersonalActivity() in the API); a server that does not send the flag
  // gets the personal profile, which is how this tab always behaved.
  //
  // Not a permanent mode. The flag is recomputed on every profile/me read, so
  // the first personal listing puts the personal profile back.
  //
  // Only shops whose backing account the server names can be shown, hence the
  // orgUserId filter (see ActingOrg.orgUserId).
  const shops = (orgsData?.data.organizations ?? []).filter((o) => !!o.orgUserId);
  const shopOnly = profile?.hasPersonalActivity === false && shops.length > 0;
  const actingShop = actingOrg?.orgUserId ? actingOrg : undefined;
  // One shop: that one. Several: whichever this device is acting as, or the
  // picker until one is chosen.
  const shownShop = actingShop ?? (shops.length === 1 ? shops[0] : undefined);

  // Viewing a shop here also ACTS AS it. Otherwise the Post button would list
  // things on a personal shelf this person has never used, and the first one
  // would quietly bring back the personal profile. Switch, then drop EVERY
  // cache: each list was fetched as somebody, and serving the previous
  // identity's shelf, offers or trades under the new one is how an owner sees
  // the shop's listings labelled as their own. invalidateQueries() with no key
  // is heavy-handed and correct for a rare action -- anything cheaper means
  // auditing every query key for identity-dependence forever. Then re-render.
  // (Settings' "Posting as" card was removed on 20 Oct 2026; this tab and the
  // post flow's "Post as myself" are where an owner switches now.)
  const selectShop = useCallback(async (organizationId: string | null) => {
    setPickingShop(false);
    if (organizationId !== getActingOrgId()) {
      await switchToOrganization(organizationId);
      await qc.invalidateQueries();
    }
    setContextTick((t) => t + 1);
  }, [qc]);
  const [switchingToSelf, setSwitchingToSelf] = useState(false);
  const switchToMyself = useCallback(async () => {
    setSwitchingToSelf(true);
    try {
      await selectShop(null);
    } finally {
      setSwitchingToSelf(false);
    }
  }, [selectShop]);
  // The other direction: into a shop, from the personal profile below.
  const [switchingToShopId, setSwitchingToShopId] = useState<string | null>(null);
  const switchToShop = useCallback(async (organizationId: string) => {
    setSwitchingToShopId(organizationId);
    try {
      await selectShop(organizationId);
    } finally {
      setSwitchingToShopId(null);
    }
  }, [selectShop]);

  // One shop and no context yet (a fresh sign-in clears it): adopt the shop.
  // ONCE per mount, which is once per sign-in because this tab stays mounted.
  // Without the ref, somebody who deliberately switches to "Myself" (from
  // Settings, or "Post as myself instead" when their shop is still in review)
  // would be switched straight back the next time this tab re-rendered.
  const adoptShopId = shopOnly && !actingShop && shops.length === 1 ? shops[0].id : null;
  const adoptedOnce = useRef(false);
  useEffect(() => {
    if (!adoptShopId || adoptedOnce.current) return;
    adoptedOnce.current = true;
    void selectShop(adoptShopId);
  }, [adoptShopId, selectShop]);

  // Two shelves (5 Nov 2026). Listings: what is on the marketplace or on its
  // way (live, in a trade, waiting for review), so the tab's number and its
  // grid agree. Traded: your history, both what you gave away (TRADED) and
  // what you received (OWNED, which can be relisted). Received items used to
  // sit unlabelled among the listings and read as listings.
  const items = profile?.items ?? [];
  const isHistory = (i: Item) => i.status === "TRADED" || i.status === "OWNED";
  // An expired perishable is not a listing any more: it stays on the shelf,
  // last and labelled, so it can be relisted or deleted, but it is not counted.
  const isExpired = (i: Item) => i.status === "EXPIRED";
  const listingItems = [...items.filter((i) => !isHistory(i) && !isExpired(i)), ...items.filter(isExpired)];
  const listingCount = listingItems.filter((i) => !isExpired(i)).length;
  const tradedItems = items.filter(isHistory);
  const rows: ProfileListRow[] = tab === "posts"
    ? chunkItems(listingItems).map((postItems) => ({ kind: "posts", items: postItems }))
    : tab === "traded"
      ? chunkItems(tradedItems).map((postItems) => ({ kind: "posts", items: postItems }))
      : reviews.map((review) => ({ kind: "review", review }));
  const onRefresh = useCallback(() => {
    if (tab === "reviews") void refetchReviews();
    else void refetch();
  }, [refetch, refetchReviews, tab]);
  const onEndReached = useCallback(() => {
    if (tab === "reviews" && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, tab]);
  // Held for the first load of either answer, so a shop-only account does not
  // see its empty personal profile flash first. `isLoading` is false while a
  // query is paused offline, so with no signal this still falls through to the
  // personal layout drawn from the stored session, as the header promises.
  if (profileLoading) {
    return <ProfileSkeleton dark={dark} />;
  }

  if (orgsLoading) {
    return <View style={[s.screen, s.centred]}><ActivityIndicator color={dark ? darkColors.green : color.green} /></View>;
  }

  if (shopOnly) {
    if (pickingShop || !shownShop) {
      return <ShopPicker dark={dark} shops={shops} activeId={actingShop?.id ?? null} onPick={(id) => void selectShop(id)} />;
    }
    return (
      <ShopView
        key={shownShop.orgUserId}
        dark={dark}
        orgUserId={shownShop.orgUserId!}
        viewerId={user?.id ?? null}
        topSlot={shops.length > 1 ? <ShopCard dark={dark} name={shownShop.name} logoUrl={shownShop.logoUrl} actionLabel="Switch shop" onPress={() => setPickingShop(true)} /> : null}
      />
    );
  }

  // A person with their own history, currently acting as one of their shops.
  if (actingShop) {
    return (
      <ShopView
        key={actingShop.orgUserId}
        dark={dark}
        orgUserId={actingShop.orgUserId!}
        viewerId={user?.id ?? null}
        topSlot={<SwitchToMyselfCard dark={dark} shop={actingShop} personName={profile?.user.name ?? user?.name ?? null} busy={switchingToSelf} onPress={() => void switchToMyself()} />}
      />
    );
  }

  if (profileError && !profile) {
    return (
      <View style={[s.screen, s.centred]}>
        <MascotEmptyState
          pose="worry"
          title="Couldn't load your profile"
          message="Check your connection and try again."
          action={{ label: "Try again", onPress: () => void refetch() }}
        />
      </View>
    );
  }

  return (
    <FlatList<ProfileListRow>
      style={s.screen}
      data={rows}
      keyExtractor={(row) => row.kind === "posts" ? row.items.map((item) => item.id).join(":") : row.review.id}
      ListHeaderComponent={<>
        {/* THE WAY INTO A SHOP FROM THE PERSONAL PROFILE (12 Nov 2026).

            Reaching here means this person has their own history and is not
            acting as a shop -- both branches that draw a storefront returned
            above. Until this card, that was a dead end for an owner: the only
            things that ever set the shop context were registering the shop and
            the post flow, and anything that cleared it (signing out, "Switch
            to Myself", "Post as myself instead" while the shop was in review)
            left a profile with no sign a shop existed. Settings said "My
            shop"; this tab said nothing. One card per shop, because nothing
            caps how many a person may own. */}
        {shops.map((shop) => (
          <SwitchToShopCard
            key={shop.id}
            dark={dark}
            shop={shop}
            busy={switchingToShopId === shop.id}
            disabled={switchingToShopId !== null}
            onPress={() => void switchToShop(shop.id)}
          />
        ))}
        <PersonHeader
          userId={profile?.user.id}
          avatar={<Avatar uri={profile?.user.avatar ?? user?.image ?? null} name={profile?.user.name ?? user?.name ?? "Signed in"} />}
          user={{
            bio: profile?.user.bio ?? null,
            location: profile?.user.location ?? null,
            createdAt: profile?.user.createdAt ?? "",
            rating: profile?.user.rating ?? 0,
            trustTier: profile?.reputation.tier ?? null,
            idVerified: profile?.idVerification?.verified ?? false,
          }}
          counts={{
            listed: profile?.counts.listed ?? items.length,
            completedTrades: profile?.counts.completedTrades ?? 0,
            reviews: profile?.counts.reviews ?? 0,
            followers: profile?.counts.followers ?? 0,
            following: profile?.counts.following ?? 0,
          }}
          palette={dark ? { ink: darkColors.ink, secondary: darkColors.muted, control: darkColors.surface } : { ink: color.ink, secondary: color.inkSecondary, control: color.control }}
          locationSlot={
            <Tappable onPress={() => router.push("/edit-profile")} accessibilityRole="button">
              <Text style={{ fontSize: 13, fontWeight: "600", color: color.forest }}>+ Add your location</Text>
            </Tappable>
          }
          onFollowers={() => router.push({ pathname: "/connections", params: { userId: user?.id ?? "", kind: "followers" } })}
          onFollowing={() => router.push({ pathname: "/connections", params: { userId: user?.id ?? "", kind: "following" } })}
        >
          <HeaderButtons
            palette={dark ? { ink: darkColors.ink, control: darkColors.surface, border: darkColors.border } : { ink: color.ink, control: color.control, border: color.controlLine }}
            primary={{ label: "Edit profile", onPress: () => router.push("/edit-profile"), filled: false }}
            secondary={{ label: "Share profile", onPress: () => void shareProfile() }}
          />
          <View style={s.badgeHead}>
            <Text style={[s.badgeHeadText, { color: dark ? darkColors.muted : color.inkSecondary }]}>
              Badges · {profile?.displayedAchievements.length ?? 0} of {DEFAULT_MAX_PROFILE_BADGES} shown
            </Text>
            <Tappable onPress={() => router.push("/achievements")} accessibilityRole="button" accessibilityLabel="Edit badges">
              <Text style={s.badgeEdit}>Edit</Text>
            </Tappable>
          </View>
          <Badges dark={dark} achievements={profile?.displayedAchievements ?? []} onMore={() => router.push("/achievements")} />
          {profile ? <FinishProfile profile={profile} dark={dark} /> : null}
        </PersonHeader>
        <ProfileTabs dark={dark} active={tab} onChange={setTab} counts={{ posts: listingCount, traded: tradedItems.length, reviews: profile?.counts.reviews ?? 0 }} />
        {tab === "reviews" ? <ReviewSummary dark={dark} summary={summary} loadError={reviewsLoadError} onRetry={() => void refetchReviews()} /> : null}
      </>}
      renderItem={({ item: row }) => row.kind === "posts" ? (
        <View style={s.gridRow}>{row.items.map((item) => <ProfileTile key={item.id} dark={dark} item={item}
          // An item got in a trade opens its item page, where Relist lives (7 Nov
          // 2026); the tile no longer carries its own Relist link.
          onPress={() => router.push({ pathname: shelfLabel(item) && item.status !== "OWNED" ? "/listing-review" : "/item", params: { id: item.id } })}
        />)}</View>
      ) : (
        <ReviewRow dark={dark} review={row.review} onReviewer={() => router.push({ pathname: "/user", params: { id: row.review.reviewer.id } })} onItem={() => { const reviewItem = row.review.item; if (reviewItem) router.push({ pathname: "/item", params: { id: reviewItem.id } }); }} />
      )}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={tab === "posts" ? profileRefetching : reviewsRefetching} onRefresh={onRefresh} tintColor={dark ? darkColors.green : color.green} />}
      ListFooterComponent={tab === "reviews" && isFetchingNextPage ? <ActivityIndicator color={dark ? darkColors.green : color.green} style={s.footer} /> : null}
      ListEmptyComponent={tab === "reviews" && reviewsLoadError ? (
        <ReviewLoadError dark={dark} onRetry={() => void refetchReviews()} />
      ) : tab === "reviews" ? (
        <MascotEmptyState pose="search" size={96} title="No reviews yet" message="Reviews appear here after your first completed trade." />
      ) : tab === "traded" ? (
        <MascotEmptyState pose="leaf" size={96} title="No trades yet" message="Items you trade away and items you get show here." />
      ) : (
        <MascotEmptyState
          pose="box"
          size={96}
          title="Your listings show here"
          message="Post something you don't use any more."
          action={{ label: "Post", onPress: () => router.push("/post-item") }}
        />
      )}
    />
  );
}

export function ProfileSkeleton({ dark }: { dark: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(1);
      return;
    }

    pulse.setValue(0);
    const half = motion.skeletonPulseMs / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: half,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: half,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [motion.skeletonFrom, motion.skeletonTo],
  });

  return (
    <View
      style={[s.screen, { backgroundColor: dark ? darkColors.surface : color.surface }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={s.skeletonHeader}>
        <SkeletonBlock opacity={opacity} style={s.skeletonAvatar} />
        <View style={s.skeletonStats}>
          {[0, 1, 2].map((index) => (
            <View key={index} style={s.skeletonStat}>
              <SkeletonBlock opacity={opacity} style={s.skeletonStatValue} />
              <SkeletonBlock opacity={opacity} style={s.skeletonStatLabel} soft />
            </View>
          ))}
        </View>
        <SkeletonBlock opacity={opacity} style={s.skeletonName} />
        <View style={s.skeletonActions}>
          <SkeletonBlock opacity={opacity} style={s.skeletonButton} />
          <SkeletonBlock opacity={opacity} style={s.skeletonButton} />
        </View>
      </View>
      <View style={s.skeletonTabs}>
        <SkeletonBlock opacity={opacity} style={s.skeletonTab} />
        <SkeletonBlock opacity={opacity} style={s.skeletonTab} />
      </View>
      {[0, 1].map((row) => (
        <View key={row} style={s.gridRow}>
          {[0, 1, 2].map((column) => (
            <SkeletonBlock key={column} opacity={opacity} style={s.skeletonTile} />
          ))}
        </View>
      ))}
    </View>
  );
}

function SkeletonBlock({
  opacity,
  style,
  soft = false,
}: {
  opacity: Animated.AnimatedInterpolation<number>;
  style: ViewStyle;
  soft?: boolean;
}) {
  return <Animated.View style={[s.skeletonBlock, style, { backgroundColor: soft ? color.skeletonSoft : color.skeleton, opacity }]} />;
}

/**
 * "You're acting as <shop>". On a personal profile it is the way into the
 * storefront; on a shop-only account's storefront it switches between shops.
 */
function ShopCard({ dark, name, logoUrl, onPress, actionLabel = "View shop" }: { dark: boolean; name: string; logoUrl: string | null; onPress: () => void; actionLabel?: string }) {
  const palette = dark ? darkColors : lightColors;
  const logo = orgLogoUrl(logoUrl);
  return (
    <Pressable onPress={onPress} style={[s.shopCard, { backgroundColor: palette.control }]} accessibilityRole="button" accessibilityLabel={`Acting as ${name}. ${actionLabel}`}>
      {logo ? <Image source={{ uri: sizedImage(logo, "thumb") }} contentFit="cover" style={s.shopLogo} /> : <View style={[s.shopLogo, s.shopLogoFallback]}><StoreIcon size={20} stroke={1.6} color={color.forest} /></View>}
      <View style={s.shopText}>
        <Text style={[s.shopEyebrow, { color: palette.muted }]}>Acting as</Text>
        <Text style={[s.shopName, { color: palette.ink }]} numberOfLines={1}>{name}</Text>
      </View>
      <Text style={[s.shopLink, { color: palette.green }]}>{actionLabel}</Text>
    </Pressable>
  );
}

/**
 * The identity switch, one card for both directions (redrawn 12 Nov 2026).
 *
 * Above a storefront it says whose page this is and offers the way back to
 * the person; on the personal profile it says the person owns a shop and
 * offers the way in. Same card, same place, same button, so the two read as
 * one switch seen from either side.
 *
 * PROMINENT ON PURPOSE. It is also the answer to "why is my profile gone?",
 * and a person who does not see it will think their account changed -- hence
 * a full-width button that names where it goes, not a link in a corner.
 *
 * The shop's logo leads the card because that is how the shop is recognised
 * everywhere else, and the chip carries the one fact people ask after
 * registering: has it been approved?
 */
function IdentitySwitchCard({
  dark,
  eyebrow,
  shop,
  note,
  buttonLabel,
  buttonIcon,
  busy,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  dark: boolean;
  eyebrow: string;
  shop: Pick<ActingOrg, "name" | "logoUrl" | "verified" | "verificationStatus">;
  note: string;
  buttonLabel: string;
  buttonIcon: React.ComponentProps<typeof Ionicons>["name"];
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const palette = dark ? darkColors : lightColors;
  const logo = orgLogoUrl(shop.logoUrl);
  const status = shop.verificationStatus ?? (shop.verified ? "VERIFIED" : "PENDING");
  // Text on its own wash in every case; the pairs are the app's existing ones
  // (green, sand and urgent), so none of them is a new colour to keep in step.
  const chip =
    status === "VERIFIED"
      ? { label: "Verified", bg: dark ? "#244A31" : color.surface, ink: dark ? "#BFE8C7" : color.forest }
      : status === "REJECTED"
        ? { label: "Not approved", bg: color.urgentWash, ink: color.urgent }
        : { label: "Under review", bg: categoryTone.sand.bg, ink: categoryTone.sand.ink };
  const onFill = dark ? "#10210F" : color.surface;
  return (
    <View style={[s.switchCard, { backgroundColor: dark ? "#1F3326" : color.greenWash }]}>
      <View style={s.switchHead}>
        {logo
          ? <Image source={{ uri: sizedImage(logo, "thumb") }} contentFit="cover" style={s.switchLogo} />
          : <View style={[s.switchLogo, s.switchLogoFallback, { backgroundColor: dark ? "#244A31" : color.surface }]}><StoreIcon size={22} stroke={1.6} color={dark ? "#BFE8C7" : color.forest} /></View>}
        <View style={s.switchText}>
          <Text style={[s.switchEyebrow, { color: palette.secondary }]} numberOfLines={1}>{eyebrow}</Text>
          <Text style={[s.switchName, { color: palette.ink }]} numberOfLines={1}>{shop.name}</Text>
        </View>
        <View style={[s.switchChip, { backgroundColor: chip.bg }]}>
          <Text style={[s.switchChipText, { color: chip.ink }]}>{chip.label}</Text>
        </View>
      </View>
      <Text style={[s.switchNote, { color: palette.secondary }]}>{note}</Text>
      <Pressable
        onPress={disabled ? undefined : onPress}
        style={[s.switchButton, { backgroundColor: dark ? palette.green : color.forest, opacity: disabled ? 0.6 : 1 }]}
        accessibilityRole="button"
        accessibilityState={{ busy, disabled }}
        accessibilityLabel={accessibilityLabel}
      >
        <Ionicons name={buttonIcon} size={17} color={onFill} />
        <Text style={[s.switchButtonText, { color: onFill }]}>{busy ? "Switching…" : buttonLabel}</Text>
      </Pressable>
    </View>
  );
}

/** Above the storefront of a shop the person is acting as: the way back. */
function SwitchToMyselfCard({ dark, shop, personName, busy, onPress }: { dark: boolean; shop: ActingOrg; personName: string | null; busy: boolean; onPress: () => void }) {
  return (
    <IdentitySwitchCard
      dark={dark}
      eyebrow="You are acting as"
      shop={shop}
      note="New listings you post go on this shop."
      buttonLabel="Switch to Myself"
      buttonIcon="person-outline"
      busy={busy}
      disabled={busy}
      onPress={onPress}
      accessibilityLabel={`Switch to myself${personName ? `, ${personName}` : ""}. Shows your personal profile`}
    />
  );
}

/**
 * On the personal profile: the way into a shop this person owns. The note is
 * about the review because a shop still in review opens onto an empty
 * storefront that cannot post yet, which is better learnt here than there.
 */
function SwitchToShopCard({ dark, shop, busy, disabled, onPress }: { dark: boolean; shop: ActingOrg; busy: boolean; disabled: boolean; onPress: () => void }) {
  const status = shop.verificationStatus ?? (shop.verified ? "VERIFIED" : "PENDING");
  const note =
    status === "VERIFIED"
      ? "Switch to see its storefront and post as the shop."
      : status === "REJECTED"
        ? "You can still open its storefront, but it cannot post."
        : "You can open its storefront now. It can post once approved.";
  return (
    <IdentitySwitchCard
      dark={dark}
      eyebrow="Your shop"
      shop={shop}
      note={note}
      buttonLabel="Switch to shop"
      buttonIcon="storefront-outline"
      busy={busy}
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={`Switch to ${shop.name}. Shows the shop's storefront`}
    />
  );
}

/** A shop-only account with several shops chooses which one this tab shows, and acts as. */
function ShopPicker({ dark, shops, activeId, onPick }: { dark: boolean; shops: ActingOrg[]; activeId: string | null; onPick: (organizationId: string) => void }) {
  const palette = dark ? darkColors : lightColors;
  return (
    <View style={s.screen}>
      <Text style={[s.pickerTitle, { color: palette.ink }]}>Your shops</Text>
      <Text style={[s.pickerSub, { color: palette.muted }]}>Choose the shop to open. New listings and offers are made as the shop you choose.</Text>
      {shops.map((shop) => {
        const logo = orgLogoUrl(shop.logoUrl);
        const active = shop.id === activeId;
        return (
          <Pressable key={shop.id} onPress={() => onPick(shop.id)} style={[s.shopCard, { backgroundColor: palette.control }]} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`Open ${shop.name}`}>
            {logo ? <Image source={{ uri: sizedImage(logo, "thumb") }} contentFit="cover" style={s.shopLogo} /> : <View style={[s.shopLogo, s.shopLogoFallback]}><StoreIcon size={20} stroke={1.6} color={color.forest} /></View>}
            <View style={s.shopText}>
              <Text style={[s.shopName, { color: palette.ink }]} numberOfLines={1}>{shop.name}</Text>
              <Text style={[s.shopEyebrow, { color: palette.muted }]}>{"Owner"}{active ? " · Acting as" : ""}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.muted} />
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The storefront, as the Profile tab of a shop-only account.
 *
 * The same pieces the public /user screen draws for an organisation, minus the
 * back row, because here it is a tab rather than a pushed screen. A member
 * never sees Follow or Message (OrgStorefrontHeader swaps them for Edit and
 * Share), so those two handlers are inert.
 */
function ShopView({ dark, orgUserId, viewerId, topSlot }: { dark: boolean; orgUserId: string; viewerId: string | null; topSlot: React.ReactNode }) {
  const router = useRouter();
  const [tab, setTab] = useState<ShelfTab>("posts");
  const { data, isPending, isError, refetch, isRefetching } = usePublicProfile(orgUserId);
  const reviewQuery = useProfileReviews(orgUserId, tab === "reviews");
  const palette = dark ? darkColors : lightColors;
  useRefetchOnFocus(refetch);
  // The storefront's invite field needs both: see useStorefrontKeyboard.
  const list = useRef<FlatList<ProfileListRow>>(null);
  const { imeInset } = useStorefrontKeyboard();

  if (isPending) return <View style={[s.screen, s.centred]}><ActivityIndicator color={palette.green} /></View>;
  const org = data?.user.org;
  if (isError || !data || !org) {
    return (
      <View style={s.screen}>
        {topSlot}
        <Text style={[s.empty, { color: palette.muted }]}>Your shop could not be loaded.</Text>
        <Pressable onPress={() => void refetch()} accessibilityRole="button" style={s.retry}><Text style={[s.shopLink, { color: palette.green }]}>Try again</Text></Pressable>
      </View>
    );
  }

  const rows: ProfileListRow[] = tab === "posts"
    ? chunkItems(data.items).map((postItems) => ({ kind: "posts", items: postItems }))
    : tab === "reviews"
      ? reviewQuery.reviews.map((review) => ({ kind: "review", review }))
      : [];
  const inert = () => undefined;

  return (
    <FlatList<ProfileListRow>
      ref={list}
      style={[s.screen, { marginBottom: imeInset }]}
      keyboardShouldPersistTaps="handled"
      data={rows}
      keyExtractor={(row) => row.kind === "posts" ? row.items.map((item) => item.id).join(":") : row.review.id}
      ListHeaderComponent={<>
        {topSlot}
        <OrgStorefrontHeader
          dark={dark}
          org={org}
          counts={data.counts}
          viewerId={viewerId}
          follow={{ label: "", busy: false, disabled: true, primary: false, onPress: inert }}
          onMessage={inert}
          onEdit={() => router.push({ pathname: "/edit-org", params: { id: org.id, userId: data.user.id } })}
          onShare={() => void Share.share({ message: `${org.name} on Baylo\n${getApiBase().replace(/\/+$/, "")}/profile/${encodeURIComponent(data.user.id)}`, title: "Share shop" })}
          onPost={getActingOrgId() === org.id ? () => router.push("/post-item") : undefined}
          location={data.user.location}
          listingValues={data.items.filter((item) => item.status === "AVAILABLE").map((item) => item.valueLeaves)}
        />
        <ProfileTabs dark={dark} active={tab} onChange={setTab} about />
        {tab === "reviews" ? <ReviewSummary dark={dark} summary={reviewQuery.summary} hideTier loadError={reviewQuery.isLoadingError} onRetry={() => void reviewQuery.refetch()} /> : null}
      </>}
      renderItem={({ item: row }) => row.kind === "posts" ? (
        <View style={s.gridRow}>{row.items.map((item) => <ProfileTile key={item.id} dark={dark} item={item} onPress={() => router.push({ pathname: shelfLabel(item) ? "/listing-review" : "/item", params: { id: item.id } })} />)}</View>
      ) : (
        <ReviewRow dark={dark} review={row.review} onReviewer={() => router.push({ pathname: "/user", params: { id: row.review.reviewer.id } })} onItem={() => { const reviewItem = row.review.item; if (reviewItem) router.push({ pathname: "/item", params: { id: reviewItem.id } }); }} />
      )}
      onEndReached={() => { if (tab === "reviews" && reviewQuery.hasNextPage && !reviewQuery.isFetchingNextPage) void reviewQuery.fetchNextPage(); }}
      onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={tab === "reviews" ? reviewQuery.isRefetching : isRefetching} onRefresh={() => { if (tab === "reviews") void reviewQuery.refetch(); else void refetch(); }} tintColor={palette.green} />}
      ListFooterComponent={tab === "reviews" && reviewQuery.isFetchingNextPage ? <ActivityIndicator color={palette.green} style={s.footer} /> : null}
      ListEmptyComponent={tab === "reviews" && reviewQuery.isLoadingError
        ? <ReviewLoadError dark={dark} onRetry={() => void reviewQuery.refetch()} />
        : tab === "about"
          ? <ShopAbout dark={dark} org={org} location={data.user.location} completedTrades={org.completedTrades ?? data.counts.completedTrades} />
          : tab === "reviews"
          ? <StorefrontEmpty dark={dark} title="No reviews yet" body="Reviews appear here after your first completed trade." pose="search" />
          : <StorefrontEmpty dark={dark} title="No listings yet" body="Tap Post to add your first item." pose="box" />}
    />
  );
}

type DisplayedAchievements = ProfileMePayload["displayedAchievements"];

type ProfileListRow =
  | { kind: "posts"; items: Item[] }
  | { kind: "review"; review: ProfileReview };

function chunkItems(items: Item[]): Item[][] {
  const rows: Item[][] = [];
  // Two across (4 Nov 2026): a photo with its title and value under it.
  for (let index = 0; index < items.length; index += 2) rows.push(items.slice(index, index + 2));
  return rows;
}

function ProfileHeader({ dark, name, avatar, bio, tier, posts, followers, following, achievements, onFollowers, onFollowing, onEdit, onShare, onMoreAchievements }: { dark: boolean; name: string; avatar: string | null; bio: string | null | undefined; tier?: string; posts: number; followers: number; following: number; achievements: DisplayedAchievements; onFollowers: () => void; onFollowing: () => void; onEdit: () => void; onShare: () => void; onMoreAchievements: () => void }) {
  const palette = dark ? darkColors : lightColors;
  return <View style={s.header}><View style={s.identityRow}><Avatar uri={avatar} name={name} /><View style={s.stats}><Stat dark={dark} label="Posts" value={posts} /><Pressable onPress={onFollowers} style={s.stat} accessibilityRole="button" accessibilityLabel={`${followers} followers`}><Text style={[s.statValue, { color: palette.ink }]}>{followers}</Text><Text style={[s.statLabel, { color: palette.muted }]}>Followers</Text></Pressable><Pressable onPress={onFollowing} style={s.stat} accessibilityRole="button" accessibilityLabel={`${following} following`}><Text style={[s.statValue, { color: palette.ink }]}>{following}</Text><Text style={[s.statLabel, { color: palette.muted }]}>Following</Text></Pressable></View></View><View style={s.nameRow}><Text style={[s.name, { color: palette.ink }]} numberOfLines={1}>{name}</Text>{tier ? <View style={[s.tier, { backgroundColor: dark ? "#244A31" : color.greenWash }]}><Text style={[s.tierText, { color: dark ? "#BFE8C7" : color.forest }]}>{TIER_LABEL[tier as keyof typeof TIER_LABEL] ?? tier}</Text></View> : null}</View>{bio ? <Text style={[s.bio, { color: palette.secondary }]} numberOfLines={3}>{bio}</Text> : null}<View style={s.actions}><Pressable onPress={onEdit} style={[s.actionButton, { backgroundColor: palette.control }]} accessibilityRole="button"><Text style={[s.actionText, { color: palette.ink }]}>Edit profile</Text></Pressable><Pressable onPress={onShare} style={[s.actionButton, { backgroundColor: palette.control }]} accessibilityRole="button"><Text style={[s.actionText, { color: palette.ink }]}>Share profile</Text></Pressable></View><Badges dark={dark} achievements={achievements} onMore={onMoreAchievements} /></View>;
}

export type ShelfTab = "posts" | "traded" | "reviews" | "about";

/** Your own profile passes `counts.traded` and gets a third tab, Traded. */
export function ProfileTabs({ dark, active, onChange, counts, about = false }: { dark: boolean; active: ShelfTab; onChange: (tab: ShelfTab) => void; counts?: { posts: number; reviews: number; traded?: number }; /** A shop's "About" tab. */ about?: boolean }) {
  const palette = dark ? darkColors : lightColors;
  // Words with counts (4 Nov 2026): "Listings 5   Reviews 2", underlined.
  const tab = (key: ShelfTab, label: string, count: number | undefined) => {
    const on = active === key;
    return (
      <Pressable onPress={() => onChange(key)} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: on }} style={[s.tab, { borderBottomColor: on ? palette.ink : "transparent" }]}>
        <Text style={[s.tabText, { color: on ? palette.ink : palette.secondary, fontFamily: on ? font.sansBold : font.sansMedium }]}>
          {label}
          {count !== undefined ? <Text style={[s.tabCount, { color: palette.muted }]}>{`  ${count}`}</Text> : null}
        </Text>
      </Pressable>
    );
  };
  return (
    <View style={[s.tabs, { borderBottomColor: palette.border }]}>
      {tab("posts", "Listings", counts?.posts)}
      {counts?.traded !== undefined ? tab("traded", "Traded", counts.traded) : null}
      {tab("reviews", "Reviews", counts?.reviews)}
      {about ? tab("about", "About", undefined) : null}
    </View>
  );
}

/**
 * `hideTier` is for an organisation's storefront. Orgs do not climb the trust
 * ladder, so the server's trustTier is null for one, and the fallback below
 * would label a sari-sari store "New Trader".
 */
export function ReviewSummary({ dark, summary, hideTier = false, loadError = false, onRetry }: { dark: boolean; summary: { averageRating: number; totalReviews: number; trustTier: string | null } | null; hideTier?: boolean; loadError?: boolean; onRetry?: () => void }) {
  const palette = dark ? darkColors : lightColors;
  if (loadError) return <ReviewLoadError dark={dark} onRetry={onRetry} />;
  if (!summary) return <View style={s.summaryLoading}><ActivityIndicator color={palette.green} /></View>;
  const tier = summary.trustTier ?? "New Trader";
  return (
    <View style={[s.summary, { backgroundColor: palette.control }]}>
      <Text style={[s.summaryValue, { color: palette.ink }]}>{summary.averageRating > 0 ? summary.averageRating.toFixed(1) : "–"}</Text>
      <View style={s.summaryText}>
        <RatingStars dark={dark} rating={Math.round(summary.averageRating)} size={16} />
        <Text style={[s.summaryLabel, { color: palette.secondary }]}>
          {summary.totalReviews} {summary.totalReviews === 1 ? "review" : "reviews"}
          {hideTier ? "" : ` · ${tier.toLowerCase().replace(/^./, (c) => c.toUpperCase())}`}
        </Text>
      </View>
    </View>
  );
}

export function ReviewLoadError({ dark, onRetry }: { dark: boolean; onRetry?: () => void }) {
  const palette = dark ? darkColors : lightColors;
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, gap: 8 }}>
      <Text style={[s.empty, { color: palette.secondary }]}>Could not load reviews.</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button">
          <Text style={[s.shopLink, { color: palette.green }]}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ReviewRow({ dark, review, onReviewer, onItem }: { dark: boolean; review: import("../../src/api/reviews").ProfileReview; onReviewer: () => void; onItem: () => void }) {
  const palette = dark ? darkColors : lightColors;
  const date = new Date(review.createdAt);
  const when = Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });
  return (
    <View style={[s.reviewRow, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
      <Pressable onPress={onReviewer} style={s.reviewIdentity} accessibilityRole="button" accessibilityLabel={`View ${review.reviewer.name}'s profile`}>
        <ReviewAvatar uri={review.reviewer.avatar} name={review.reviewer.name} dark={dark} />
        <View style={s.reviewIdentityText}>
          <Text style={[s.reviewName, { color: palette.ink }]} numberOfLines={1}>{review.reviewer.name}</Text>
          <View style={s.reviewMetaRow}>
            <RatingStars dark={dark} rating={review.rating} />
            {when ? <Text style={[s.reviewDate, { color: palette.muted }]}>{when}</Text> : null}
          </View>
        </View>
      </Pressable>
      {review.comment ? <Text style={[s.reviewComment, { color: palette.ink }]}>{review.comment}</Text> : null}
      {review.item ? <Pressable onPress={onItem} style={[s.reviewItem, { backgroundColor: palette.control }]} accessibilityRole="button" accessibilityLabel={`Open ${review.item.title}`}>
        {review.item.image ? <Image source={{ uri: sizedImage(review.item.image, "thumb") }} contentFit="cover" style={s.reviewItemImage} /> : <View style={[s.reviewItemImage, s.noImage]}><Ionicons name="image-outline" size={16} color={palette.muted} /></View>}
        <View style={s.reviewItemText}>
          <Text style={[s.reviewItemMeta, { color: palette.muted }]}>Traded</Text>
          <Text style={[s.reviewItemTitle, { color: palette.ink }]} numberOfLines={1}>{review.item.title}</Text>
        </View>
        <Text style={[s.reviewItemMeta, { color: palette.secondary, marginRight: 10 }]}>{review.item.bracket === null ? "Unvalued" : bracketLabel(review.item.bracket)}</Text>
      </Pressable> : null}
    </View>
  );
}

function ReviewAvatar({ uri, name, dark }: { uri: string | null; name: string; dark: boolean }) {
  const palette = dark ? darkColors : lightColors;
  return uri
    ? <Image source={{ uri: sizedImage(uri, "thumb") }} contentFit="cover" style={s.reviewAvatar} />
    : <View style={[s.reviewAvatar, s.reviewAvatarFallback, { backgroundColor: palette.control }]}><Text style={[s.reviewAvatarText, { color: palette.green }]}>{name.trim().charAt(0).toUpperCase() || "?"}</Text></View>;
}

function RatingStars({ dark, rating, size = 13 }: { dark: boolean; rating: number; size?: number }) {
  const palette = dark ? darkColors : lightColors;
  return <View style={s.stars}>{[1, 2, 3, 4, 5].map((star) => <Ionicons key={star} name="star" size={size} color={star <= rating ? "#E0A526" : palette.divider} />)}</View>;
}

function Stat({ dark, label, value }: { dark: boolean; label: string; value: number }) { const palette = dark ? darkColors : lightColors; return <View style={s.stat}><Text style={[s.statValue, { color: palette.ink }]}>{value}</Text><Text style={[s.statLabel, { color: palette.muted }]}>{label}</Text></View>; }

/**
 * A tile the owner has a decision on says so. Until 18 Sep 2026 a listing
 * hidden by a moderator looked like every other tile here and answered
 * "Item not found" when tapped; one parked for a value review was not on the
 * shelf at all. The label is the whole difference, and tapping a labelled tile
 * opens the review screen (what happened, what to do) rather than the item.
 */
export function shelfLabel(item: Item): string | null {
  if (item.hiddenByModerator) return "Hidden by a moderator";
  if (item.status === "PENDING_REVIEW") return "Waiting for review";
  if (item.status === "VALUE_REJECTED") return "Value not approved";
  if (item.status === "IN_TRADE") return "In trade";
  if (item.status === "EXPIRED") return "Expired";
  if (item.status === "TRADED") return "Traded away";
  if (item.status === "OWNED") return "Got in a trade";
  return null;
}

/** One shelf tile. (The owner's Boost pill and Featured pill went with Featured boosts in schema v2.) */
/**
 * `own` (default true: your own shelf) decides the value line. The exact Leaf
 * figure is the OWNER's; everyone else sees the bracket only, the same rule
 * GridTile and the item page follow. Someone else's profile and your Liked
 * list pass `own={false}` (7 Nov 2026: they showed "200 · Bracket 2").
 */
export function ProfileTile({ dark, item, onPress, footer, own = true }: { dark: boolean; item: Item; onPress: () => void; footer?: React.ReactNode; own?: boolean }) {
  const palette = dark ? darkColors : lightColors;
  const label = shelfLabel(item);
  const inTrade = item.status === "IN_TRADE";
  const bracket = item.valueLeaves !== null ? bracketLabel(bracketOfValue(item.valueLeaves)) : null;
  return <Pressable onPress={onPress} style={s.tile} accessibilityRole="button" accessibilityLabel={label ? `${item.title} — ${label}` : `Open ${item.title}`}>
    <View style={[s.tilePhoto, { backgroundColor: palette.control }, inTrade && s.dimmed]}>
      {item.images[0] ? <Image source={{ uri: sizedImage(item.images[0], "card") }} contentFit="cover" style={s.tileImage} /> : <View style={s.noImage}><Ionicons name="image-outline" size={24} color={palette.muted} /></View>}
      {label ? <View style={s.statusPill}><Text style={s.statusText} numberOfLines={1}>{label}</Text></View> : null}
    </View>
    <Text style={[s.tileTitle, { color: palette.ink }]} numberOfLines={1}>{item.title}</Text>
    {item.valueLeaves !== null ? (
      <View style={s.tileValueRow} accessibilityLabel={own ? `${item.valueLeaves} Leaves, ${bracket}` : `${bracket}`}>
        <LeafIcon size={13} stroke={2} color={palette.green} />
        {own ? (
          <Text style={[s.tileValue, { color: palette.ink }]} numberOfLines={1}>
            {item.valueLeaves}
            <Text style={{ color: palette.secondary }}>{`  ·  ${bracket}`}</Text>
          </Text>
        ) : (
          <Text style={[s.tileValue, { color: palette.ink }]} numberOfLines={1}>{bracket}</Text>
        )}
      </View>
    ) : null}
    {footer}
  </Pressable>;
}

/** The server's achievement `icon` keys, drawn with Ionicons. Unknown keys get a trophy. */
const badgeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  check: "shield-checkmark-outline",
  id: "id-card-outline",
  list: "list-outline",
  swap: "swap-horizontal-outline",
};

/**
 * The highlights row.
 *
 * ── ONLY THE PICKED BADGES APPEAR ────────────────────────────────
 *
 * The user picks up to four badges on the achievements screen, and the row
 * renders exactly those -- one pick shows one badge, four show four. There are
 * no empty placeholder slots. `displayedAchievements` is already only the
 * selected rows, in order (see profile/me), so there is nothing to filter here;
 * the slice(0, 4) is a belt-and-braces cap matching the server's.
 *
 * A badge with `imageUrl` shows its art inside the circle; without one it falls
 * back to the Ionicon for its `icon` key. The dashed "More" is a NAVIGATION
 * button that opens the achievements screen, shown only while the user still
 * has room on the shelf, so a full shelf is not cluttered with an invitation to
 * add more.
 *
 * ── TAPPING AN EARNED BADGE ──────────────────────────────────────
 *
 * `displayedAchievements` only carries id/name/icon/imageUrl -- enough to draw
 * the circle, not to explain it. Rather than widen that payload, a tap reuses
 * the SAME ["achievements"] query the Achievements screen runs, so the popup
 * is instant from cache for anyone who opened that screen this session, and
 * costs one request on tap (never on load) for anyone who has not.
 *
 * That list is the whole catalogue, so a badge on SOMEONE ELSE's profile
 * (user.tsx, `own={false}`) resolves too. Its `unlockedAt` is the VIEWER's,
 * though, so the "Earned" date is only shown on your own profile.
 */
const SHELF_CAP = 4;

export function Badges({ dark, achievements, showMore = true, own = true, onMore }: { dark: boolean; achievements: DisplayedAchievements; showMore?: boolean; own?: boolean; onMore: () => void }) {
  const palette = dark ? darkColors : lightColors;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["achievements"],
    queryFn: fetchAchievements,
    staleTime: 30_000,
    enabled: selectedId !== null,
  });
  const selected = detail.data?.achievements.find((a) => a.id === selectedId) ?? null;
  // Until the catalogue answers, the popup still opens with what the circle
  // already knows, so a tap is never met with nothing.
  const tapped = achievements.find((a) => a.id === selectedId) ?? null;
  const dialogBadge = selected ?? tapped;
  const dialogBody = selected
    ? own && selected.unlockedAt
      ? `${selected.description}\n\nEarned ${new Date(selected.unlockedAt).toLocaleDateString()}`
      : selected.description
    : detail.isError
      ? "Could not load this badge's details."
      : "Loading…";
  const shown = achievements.slice(0, SHELF_CAP);
  const hasRoom = showMore && shown.length < SHELF_CAP;
  const data: { key: string; icon: keyof typeof Ionicons.glyphMap; imageUrl: string | null; label: string; more?: boolean }[] = [
    ...shown.map((a) => ({ key: a.id, icon: badgeIcons[a.icon] ?? "trophy-outline", imageUrl: a.imageUrl, label: a.name })),
    ...(hasRoom ? [{ key: "more", icon: "add-outline" as const, imageUrl: null, label: "More", more: true }] : []),
  ];
  return (
    <View style={s.badges}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data}
        keyExtractor={(item) => item.key}
        contentContainerStyle={s.badgesContent}
        renderItem={({ item }) => (
          <Pressable
            onPress={item.more ? onMore : () => setSelectedId(item.key)}
            accessibilityRole="button"
            accessibilityLabel={item.more ? "More achievements" : `${item.label}, view details`}
            style={s.badgeItem}
          >
            <View style={[s.badgeCircle, { backgroundColor: palette.surface, borderColor: item.more ? palette.muted : palette.green }, item.more && s.moreBadge]}>
              {item.more ? (
                <Ionicons name={item.icon} size={24} color={palette.muted} />
              ) : (
                <View style={[s.badgeInner, { backgroundColor: palette.surface }]}>
                  {item.imageUrl ? <Image source={{ uri: sizedImage(item.imageUrl, "thumb") }} contentFit="cover" style={s.badgeArt} /> : <Ionicons name={item.icon} size={24} color={palette.green} />}
                </View>
              )}
            </View>
            <Text style={[s.badgeLabel, { color: palette.muted }]} numberOfLines={2} ellipsizeMode="tail">{shortBadgeLabel(item.label)}</Text>
          </Pressable>
        )}
      />
      {dialogBadge ? (
        <NoticeDialog
          visible
          title={dialogBadge.name}
          body={dialogBody}
          icon={
            dialogBadge.imageUrl ? (
              <Image source={{ uri: sizedImage(dialogBadge.imageUrl, "thumb") }} contentFit="cover" style={s.badgeDialogArt} />
            ) : (
              <Ionicons name={badgeIcons[dialogBadge.icon] ?? "trophy-outline"} size={24} color={color.green} />
            )
          }
          // The badge itself is the hero, never the duck (owner's call, 4 Nov
          // 2026). The celebrate pose stays only for its entrance bounce.
          hero={
            dialogBadge.imageUrl ? (
              <Image source={{ uri: sizedImage(dialogBadge.imageUrl, "card") }} contentFit="cover" style={StyleSheet.absoluteFill} />
            ) : undefined
          }
          pose={own && !!selected?.unlockedAt ? "celebrate" : undefined}
          onDismiss={() => setSelectedId(null)}
        />
      ) : null}
    </View>
  );
}

/**
 * New accounts: a short checklist instead of empty space. Each row opens the
 * place to do it; the whole card goes away when all four are done.
 */
function FinishProfile({ profile, dark }: { profile: ProfileMePayload; dark: boolean }) {
  const router = useRouter();
  const steps = [
    { key: "photo", label: "Add a photo", done: !!profile.user.avatar, go: "/edit-profile" },
    { key: "bio", label: "Write a short bio", done: !!profile.user.bio?.trim(), go: "/edit-profile" },
    { key: "city", label: "Add your city", done: !!profile.user.location?.trim(), go: "/edit-profile" },
    {
      key: "id",
      label: "Verify your ID",
      sub: "Needed before you can post",
      done: profile.idVerification.verified,
      go: "/verify-id",
    },
  ];
  const done = steps.filter((x) => x.done).length;
  if (done === steps.length) return null;
  const ink = dark ? darkColors.ink : color.ink;
  return (
    <View style={[s.finish, { backgroundColor: dark ? darkColors.surface : color.searchSurface, borderColor: dark ? darkColors.border : color.controlLine }]}>
      <View style={s.finishHead}>
        <Text style={[s.finishTitle, { color: ink }]}>Finish your profile</Text>
        <Text style={s.finishCount}>{done} of {steps.length}</Text>
      </View>
      {steps.map((x) => (
        <Tappable
          key={x.key}
          onPress={x.done ? undefined : () => router.push(x.go as never)}
          disabled={x.done}
          accessibilityRole="button"
          accessibilityState={{ checked: x.done }}
          style={s.finishRow}
        >
          <View style={[s.finishMark, x.done && s.finishMarkDone]}>
            {x.done ? <CheckIcon size={12} stroke={3} color={color.surface} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.finishLabel, { color: x.done ? color.inkMuted : ink }, x.done && { textDecorationLine: "line-through" }]}>{x.label}</Text>
            {x.sub && !x.done ? <Text style={s.finishSub}>{x.sub}</Text> : null}
          </View>
          {!x.done ? <ChevronRightIcon size={16} stroke={2} color={color.inkMuted} /> : null}
        </Tappable>
      ))}
    </View>
  );
}

function shortBadgeLabel(label: string): string {
  return label.replace(/^Trusted Trader$/, "Trusted").replace(/^First Offer$/, "First offer");
}

/** The same fallback-to-initial avatar FeedCard uses, at the size this screen wants. */
export function Avatar({ uri, name }: { uri: string | null; name: string }) {
  if (uri) {
    return (
      <Image
        source={{ uri: sizedImage(uri, "thumb") }}
        contentFit="cover"
        style={s.avatar}
      />
    );
  }
  return (
    <View style={s.avatarFallback}>
      <Text style={s.avatarText}>
        {name.trim().charAt(0).toUpperCase() || "?"}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  skeletonHeader: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  skeletonAvatar: { width: 76, height: 76, borderRadius: 38 },
  skeletonStats: { position: "absolute", left: 112, right: 12, top: 20, flexDirection: "row", justifyContent: "space-evenly" },
  skeletonStat: { alignItems: "center" },
  skeletonStatValue: { width: 28, height: 18, borderRadius: 4 },
  skeletonStatLabel: { width: 42, height: 10, borderRadius: 4, marginTop: 6 },
  skeletonName: { width: 140, height: 16, borderRadius: 4, marginTop: 10 },
  skeletonActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  skeletonButton: { flex: 1, height: 44, borderRadius: 8 },
  skeletonTabs: { height: 45, flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color.divider },
  skeletonTab: { flex: 1, height: 20, marginHorizontal: 48, borderRadius: 4 },
  skeletonTile: { flexGrow: 1, flexBasis: 0, minWidth: 0, aspectRatio: 1 },
  skeletonBlock: { backgroundColor: color.skeleton },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  centred: { alignItems: "center", justifyContent: "center" },
  retry: { alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: 16 },
  pickerTitle: { fontFamily: font.sansSemi, fontSize: 18, marginHorizontal: 16, marginTop: 16 },
  pickerSub: { fontFamily: font.sans, fontSize: 13, lineHeight: 18, marginHorizontal: 16, marginTop: 4, marginBottom: 4 },
  shopCard: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 8, padding: 10, borderRadius: 10, minHeight: 56 },
  shopLogo: { width: 36, height: 36, borderRadius: 8 },
  shopLogoFallback: { alignItems: "center", justifyContent: "center", backgroundColor: color.greenWash },
  shopText: { flex: 1, minWidth: 0 },
  shopEyebrow: { fontFamily: font.sans, fontSize: 11 },
  switchCard: { marginHorizontal: 16, marginTop: 10, marginBottom: 4, padding: 14, borderRadius: 18, gap: 12 },
  switchHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  switchLogo: { width: 46, height: 46, borderRadius: 13 },
  switchLogoFallback: { alignItems: "center", justifyContent: "center" },
  switchText: { flex: 1, minWidth: 0, gap: 2 },
  switchEyebrow: { fontFamily: font.sans, fontSize: 12 },
  switchName: { fontFamily: font.displaySemi, fontSize: 17 },
  switchChip: { height: 24, paddingHorizontal: 10, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  switchChipText: { fontFamily: font.sansSemi, fontSize: 11 },
  switchNote: { fontFamily: font.sans, fontSize: 13, lineHeight: 18 },
  switchButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, height: 46, borderRadius: 23 },
  switchButtonText: { fontFamily: font.sansSemi, fontSize: 15 },
  shopName: { fontFamily: font.sansSemi, fontSize: 14, marginTop: 1 },
  shopLink: { fontFamily: font.sansSemi, fontSize: 13 },
  identityRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 76, height: 76, borderRadius: 38 },
  badgeHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: -4 },
  badgeHeadText: { fontSize: 13, fontWeight: "600" },
  badgeEdit: { fontSize: 14, fontWeight: "600", color: color.forest },
  finish: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 6 },
  finishHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingBottom: 4 },
  finishTitle: { fontSize: 15, fontWeight: "700" },
  finishCount: { fontSize: 13, fontWeight: "600", color: color.forest },
  finishRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  finishMark: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: color.dashed, alignItems: "center", justifyContent: "center" },
  finishMarkDone: { backgroundColor: color.forest, borderColor: color.forest },
  finishLabel: { fontSize: 14, fontWeight: "500" },
  finishSub: { fontSize: 12, color: color.inkSecondary },
  avatarFallback: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", backgroundColor: color.green },
  avatarText: { color: color.onGreen, fontFamily: font.sansBold, fontSize: 26 },
  stats: { flex: 1, flexDirection: "row", justifyContent: "space-evenly", marginLeft: 20 },
  stat: { alignItems: "center", minWidth: 58 },
  statValue: { fontFamily: font.sansSemi, fontSize: 18 },
  statLabel: { fontFamily: font.sans, fontSize: 12, marginTop: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 8 },
  name: { fontFamily: font.sansSemi, fontSize: 15, maxWidth: "75%" },
  tier: { alignSelf: "flex-start", borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6, marginTop: 6 },
  tierText: { fontFamily: font.sansSemi, fontSize: 11 },
  bio: { fontFamily: font.sans, fontSize: 14, lineHeight: 20, marginTop: 6 },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
  actionButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  actionText: { fontFamily: font.sansSemi, fontSize: 14 },
  badges: { marginTop: 8, marginHorizontal: -16 },
  badgesContent: { paddingHorizontal: 16, gap: 18 },
  badgeItem: { width: 76, alignItems: "center" },
  badgeCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, padding: 3, alignItems: "center", justifyContent: "center" },
  badgeInner: { width: "100%", height: "100%", borderRadius: 28, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  badgeArt: { width: "100%", height: "100%" },
  badgeDialogArt: { width: "100%", height: "100%", borderRadius: 24 },
  moreBadge: { borderStyle: "dashed", borderWidth: 1, padding: 0 },
  badgeLabel: { width: 76, fontFamily: font.sans, fontSize: 11, lineHeight: 14, marginTop: 4, textAlign: "center" },
  tabs: { marginTop: 14, paddingHorizontal: 20, flexDirection: "row", gap: 22, borderBottomWidth: 1 },
  tab: { height: 42, justifyContent: "center", borderBottomWidth: 2, marginBottom: -1 },
  tabText: { fontSize: 15 },
  tabCount: { fontFamily: font.sansSemi, fontSize: 15 },
  tabUnderline: { position: "absolute", bottom: -StyleSheet.hairlineWidth, width: 24, height: 2 },
  summary: { flexDirection: "row", alignItems: "center", gap: 14, marginHorizontal: 16, marginTop: 14, marginBottom: 6, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16 },
  summaryLoading: { height: 64, alignItems: "center", justifyContent: "center" },
  summaryValue: { fontFamily: font.displayBold, fontSize: 34, lineHeight: 38 },
  summaryLabel: { fontFamily: font.sans, fontSize: 13 },
  summaryText: { flex: 1, minWidth: 0, gap: 4 },
  reviewRow: { marginHorizontal: 16, marginTop: 10, padding: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  reviewIdentity: { flexDirection: "row", alignItems: "center" },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18 },
  reviewAvatarFallback: { alignItems: "center", justifyContent: "center" },
  reviewAvatarText: { fontFamily: font.sansBold, fontSize: 15 },
  reviewMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  reviewIdentityText: { flex: 1, minWidth: 0, marginLeft: 10 },
  reviewName: { fontFamily: font.sansSemi, fontSize: 14 },
  stars: { flexDirection: "row", gap: 2, marginTop: 3 },
  reviewDate: { fontFamily: font.sans, fontSize: 12 },
  reviewComment: { fontFamily: font.sans, fontSize: 14, lineHeight: 20, marginTop: 10 },
  reviewItem: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, borderRadius: 12, overflow: "hidden" },
  reviewItemImage: { width: 44, height: 44 },
  reviewItemText: { flex: 1, minWidth: 0 },
  reviewItemTitle: { fontFamily: font.sansSemi, fontSize: 13 },
  reviewItemMeta: { fontFamily: font.sans, fontSize: 11 },
  footer: { paddingVertical: 18 },
  gridRow: { width: "100%", flexDirection: "row", gap: 12, paddingHorizontal: 20, marginTop: 12 },
  tile: { flexGrow: 0, flexBasis: "48%", width: "48%", minWidth: 0, gap: 6 },
  tilePhoto: { aspectRatio: 1, borderRadius: 14, overflow: "hidden" },
  tileTitle: { fontFamily: font.sansSemi, fontSize: 14 },
  relist: { alignSelf: "flex-start", marginTop: 2, height: 32, paddingHorizontal: 16, borderRadius: 16, backgroundColor: color.green, justifyContent: "center" },
  relistText: { fontFamily: font.sansBold, fontSize: 13, color: color.onGreen },
  tileValueRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: -2 },
  tileValue: { flexShrink: 1, fontFamily: font.sansSemi, fontSize: 12 },
  tileContent: { flex: 1 },
  tileImage: { width: "100%", height: "100%" },
  noImage: { flex: 1, alignItems: "center", justifyContent: "center" },
  dimmed: { opacity: 0.55 },
  statusPill: { position: "absolute", top: 6, left: 6, maxWidth: "88%", backgroundColor: "rgba(0,0,0,0.62)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  statusText: { color: "#FFFFFF", fontFamily: font.sansSemi, fontSize: 11 },
  leavesPill: { position: "absolute", bottom: 6, left: 6, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3 },
  leavesText: { color: "#FFFFFF", fontFamily: font.sansSemi, fontSize: 10 },
  empty: { color: color.inkMuted, fontFamily: font.sans, fontSize: 14, textAlign: "center", paddingVertical: 48 },
});

const lightColors = { surface: color.surface, control: color.control, ink: color.ink, secondary: color.inkSecondary, muted: color.inkMuted, divider: color.divider, border: color.controlLine, green: color.green };
const darkColors = { surface: "#171A17", control: "#252A25", ink: "#F4F5F0", secondary: "#B6BDB3", muted: "#929B91", divider: "#343A34", border: "#596159", green: "#72D681" };
