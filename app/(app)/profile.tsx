import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Share, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { useProfileMe, usePublicProfile } from "../../src/api/profile";
import { canBoost } from "../../src/api/featured";
import { useConfirmBoost } from "../../src/components/useConfirmBoost";
import { useProfileReviews, type ProfileReview } from "../../src/api/reviews";
import { useRefetchOnFocus } from "../../src/lib/refetch-on-focus";
import { useSession } from "../../src/auth/session";
import type { Item, ProfileMePayload } from "../../src/api/types";
import { bracketLabel } from "../../src/lib/brackets";
import { color, font } from "../../src/theme/tokens";
import { orgLogoUrl, switchToOrganization, useOrganizations, type ActingOrg } from "../../src/api/organizations";
import { getActingOrgId } from "../../src/api/org-context";
import { StoreIcon } from "../../src/components/icons";
import { OrgStorefrontHeader } from "../../src/components/OrgStorefrontHeader";
import { GridIcon } from "../../src/components/icons";
import { useColorScheme } from "react-native";
import { TIER_LABEL } from "../../src/lib/trust";
import { getApiBase } from "../../src/api/config";

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
  const { data: profile, refetch, isRefetching: profileRefetching, isLoading: profileLoading } = useProfileMe();
  const dark = useColorScheme() === "dark";
  const [tab, setTab] = useState<"posts" | "reviews">("posts");

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
    isRefetching: reviewsRefetching,
  } = useProfileReviews(user?.id, tab === "reviews");

  const shareProfile = useCallback(async () => {
    const profileUrl = `${getApiBase().replace(/\/+$/, "")}/profile/${encodeURIComponent(user?.id ?? "")}`;
    await Share.share({
      message: `${profile?.user.name ?? user?.name ?? "A Baylo trader"} on Baylo\n${profileUrl}`,
      title: "Share profile",
    });
  }, [profile?.user.name, user?.id, user?.name]);

  // The shop this device is ACTING AS, if any. For somebody who also trades as
  // themselves this tab stays the PERSON'S profile -- profile/me is about the
  // signed-in human (their Leaves, their shelf, their achievements) and does
  // not read X-Baylo-Org -- so the storefront is one tap away rather than
  // swapped in underneath them. getActingOrgId() is read per render, not
  // mirrored: see OrgSwitcher.
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
  // would quietly bring back the personal profile. Same steps as OrgSwitcher:
  // switch, drop every cache fetched as the previous identity, re-render.
  const selectShop = useCallback(async (organizationId: string) => {
    setPickingShop(false);
    if (organizationId !== getActingOrgId()) {
      await switchToOrganization(organizationId);
      await qc.invalidateQueries();
    }
    setContextTick((t) => t + 1);
  }, [qc]);

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

  const items = profile?.items ?? [];
  const { confirmBoost, isBoosting } = useConfirmBoost();
  const rows: ProfileListRow[] = tab === "posts"
    ? chunkItems(items).map((postItems) => ({ kind: "posts", items: postItems }))
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
  if (profileLoading || orgsLoading) {
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

  return (
    <FlatList<ProfileListRow>
      style={s.screen}
      data={rows}
      keyExtractor={(row) => row.kind === "posts" ? row.items.map((item) => item.id).join(":") : row.review.id}
      ListHeaderComponent={<>
        {actingOrg?.orgUserId ? <ShopCard dark={dark} name={actingOrg.name} logoUrl={actingOrg.logoUrl} onPress={() => router.push({ pathname: "/user", params: { id: actingOrg.orgUserId } })} /> : null}
        <ProfileHeader dark={dark} name={profile?.user.name ?? user?.name ?? "Signed in"} avatar={profile?.user.avatar ?? user?.image ?? null} bio={profile?.user.bio} tier={profile?.reputation.tier} followers={profile?.counts.followers ?? 0} following={profile?.counts.following ?? 0} posts={profile?.counts.listed ?? items.length} achievements={profile?.displayedAchievements ?? []} onFollowers={() => router.push({ pathname: "/connections", params: { userId: user?.id ?? "", kind: "followers" } })} onFollowing={() => router.push({ pathname: "/connections", params: { userId: user?.id ?? "", kind: "following" } })} onEdit={() => router.push("/edit-profile")} onShare={() => void shareProfile()} onMoreAchievements={() => router.push("/achievements")} />
        <ProfileTabs dark={dark} active={tab} onChange={setTab} />
        {tab === "reviews" ? <ReviewSummary dark={dark} summary={summary} /> : null}
      </>}
      renderItem={({ item: row }) => row.kind === "posts" ? (
        <View style={s.gridRow}>{row.items.map((item) => <ProfileTile key={item.id} dark={dark} item={item} onPress={() => router.push({ pathname: shelfLabel(item) ? "/listing-review" : "/item", params: { id: item.id } })} onBoost={canBoost(item) && !isBoosting ? () => confirmBoost(item) : undefined} />)}</View>
      ) : (
        <ReviewRow dark={dark} review={row.review} onReviewer={() => router.push({ pathname: "/user", params: { id: row.review.reviewer.id } })} onItem={() => { const reviewItem = row.review.item; if (reviewItem) router.push({ pathname: "/item", params: { id: reviewItem.id } }); }} />
      )}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={tab === "posts" ? profileRefetching : reviewsRefetching} onRefresh={onRefresh} tintColor={dark ? darkColors.green : color.green} />}
      ListFooterComponent={tab === "reviews" && isFetchingNextPage ? <ActivityIndicator color={dark ? darkColors.green : color.green} style={s.footer} /> : null}
      ListEmptyComponent={<Text style={[s.empty, { color: dark ? darkColors.muted : color.inkMuted }]}>{tab === "reviews" ? "No reviews yet." : "Your listings will appear here."}</Text>}
    />
  );
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
      {logo ? <Image source={{ uri: logo }} contentFit="cover" style={s.shopLogo} /> : <View style={[s.shopLogo, s.shopLogoFallback]}><StoreIcon size={20} stroke={1.6} color={color.forest} /></View>}
      <View style={s.shopText}>
        <Text style={[s.shopEyebrow, { color: palette.muted }]}>Acting as</Text>
        <Text style={[s.shopName, { color: palette.ink }]} numberOfLines={1}>{name}</Text>
      </View>
      <Text style={[s.shopLink, { color: palette.green }]}>{actionLabel}</Text>
    </Pressable>
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
            {logo ? <Image source={{ uri: logo }} contentFit="cover" style={s.shopLogo} /> : <View style={[s.shopLogo, s.shopLogoFallback]}><StoreIcon size={20} stroke={1.6} color={color.forest} /></View>}
            <View style={s.shopText}>
              <Text style={[s.shopName, { color: palette.ink }]} numberOfLines={1}>{shop.name}</Text>
              <Text style={[s.shopEyebrow, { color: palette.muted }]}>{shop.role === "OWNER" ? "Owner" : "Staff"}{active ? " · Acting as" : ""}</Text>
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
  const [tab, setTab] = useState<"posts" | "reviews">("posts");
  const { data, isPending, isError, refetch, isRefetching } = usePublicProfile(orgUserId);
  const reviewQuery = useProfileReviews(orgUserId, tab === "reviews");
  const palette = dark ? darkColors : lightColors;
  useRefetchOnFocus(refetch);

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
    : reviewQuery.reviews.map((review) => ({ kind: "review", review }));
  const inert = () => undefined;

  return (
    <FlatList<ProfileListRow>
      style={s.screen}
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
        />
        <ProfileTabs dark={dark} active={tab} onChange={setTab} />
        {tab === "reviews" ? <ReviewSummary dark={dark} summary={reviewQuery.summary} hideTier /> : null}
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
      ListEmptyComponent={<Text style={[s.empty, { color: palette.muted }]}>{tab === "reviews" ? "No reviews yet." : "Your shop's listings will appear here."}</Text>}
    />
  );
}

type DisplayedAchievements = ProfileMePayload["displayedAchievements"];

type ProfileListRow =
  | { kind: "posts"; items: Item[] }
  | { kind: "review"; review: ProfileReview };

function chunkItems(items: Item[]): Item[][] {
  const rows: Item[][] = [];
  for (let index = 0; index < items.length; index += 3) rows.push(items.slice(index, index + 3));
  return rows;
}

function ProfileHeader({ dark, name, avatar, bio, tier, posts, followers, following, achievements, onFollowers, onFollowing, onEdit, onShare, onMoreAchievements }: { dark: boolean; name: string; avatar: string | null; bio: string | null | undefined; tier?: string; posts: number; followers: number; following: number; achievements: DisplayedAchievements; onFollowers: () => void; onFollowing: () => void; onEdit: () => void; onShare: () => void; onMoreAchievements: () => void }) {
  const palette = dark ? darkColors : lightColors;
  return <View style={s.header}><View style={s.identityRow}><Avatar uri={avatar} name={name} /><View style={s.stats}><Stat dark={dark} label="Posts" value={posts} /><Pressable onPress={onFollowers} style={s.stat} accessibilityRole="button" accessibilityLabel={`${followers} followers`}><Text style={[s.statValue, { color: palette.ink }]}>{followers}</Text><Text style={[s.statLabel, { color: palette.muted }]}>Followers</Text></Pressable><Pressable onPress={onFollowing} style={s.stat} accessibilityRole="button" accessibilityLabel={`${following} following`}><Text style={[s.statValue, { color: palette.ink }]}>{following}</Text><Text style={[s.statLabel, { color: palette.muted }]}>Following</Text></Pressable></View></View><View style={s.nameRow}><Text style={[s.name, { color: palette.ink }]} numberOfLines={1}>{name}</Text>{tier ? <View style={[s.tier, { backgroundColor: dark ? "#244A31" : color.greenWash }]}><Text style={[s.tierText, { color: dark ? "#BFE8C7" : color.forest }]}>{TIER_LABEL[tier as keyof typeof TIER_LABEL] ?? tier}</Text></View> : null}</View>{bio ? <Text style={[s.bio, { color: palette.secondary }]} numberOfLines={3}>{bio}</Text> : null}<View style={s.actions}><Pressable onPress={onEdit} style={[s.actionButton, { backgroundColor: palette.control }]} accessibilityRole="button"><Text style={[s.actionText, { color: palette.ink }]}>Edit profile</Text></Pressable><Pressable onPress={onShare} style={[s.actionButton, { backgroundColor: palette.control }]} accessibilityRole="button"><Text style={[s.actionText, { color: palette.ink }]}>Share profile</Text></Pressable></View><Badges dark={dark} achievements={achievements} onMore={onMoreAchievements} /></View>;
}

export function ProfileTabs({ dark, active, onChange }: { dark: boolean; active: "posts" | "reviews"; onChange: (tab: "posts" | "reviews") => void }) {
  const palette = dark ? darkColors : lightColors;
  return (
    <View style={[s.tabs, { borderTopColor: palette.divider, borderBottomColor: palette.divider }]}>
      <Pressable onPress={() => onChange("posts")} accessibilityRole="tab" accessibilityLabel="Posts" accessibilityState={{ selected: active === "posts" }} style={s.tab}>
        <GridIcon size={20} stroke={1.7} color={active === "posts" ? palette.green : palette.muted} />
        <View style={[s.tabUnderline, { backgroundColor: active === "posts" ? palette.green : "transparent" }]} />
      </Pressable>
      <Pressable onPress={() => onChange("reviews")} accessibilityRole="tab" accessibilityLabel="Reviews" accessibilityState={{ selected: active === "reviews" }} style={s.tab}>
        <Ionicons name="star-outline" size={21} color={active === "reviews" ? palette.green : palette.muted} />
        <View style={[s.tabUnderline, { backgroundColor: active === "reviews" ? palette.green : "transparent" }]} />
      </Pressable>
    </View>
  );
}

/**
 * `hideTier` is for an organisation's storefront. Orgs do not climb the trust
 * ladder, so the server's trustTier is null for one, and the fallback below
 * would label a sari-sari store "New Trader".
 */
export function ReviewSummary({ dark, summary, hideTier = false }: { dark: boolean; summary: { averageRating: number; totalReviews: number; trustTier: string | null } | null; hideTier?: boolean }) {
  const palette = dark ? darkColors : lightColors;
  if (!summary) return <View style={s.summaryLoading}><ActivityIndicator color={palette.green} /></View>;
  return (
    <View style={[s.summary, { backgroundColor: palette.surface }]}>
      <View><Text style={[s.summaryValue, { color: palette.ink }]}>{summary.averageRating > 0 ? summary.averageRating.toFixed(1) : "-"}</Text><Text style={[s.summaryLabel, { color: palette.muted }]}>average rating</Text></View>
      <View><Text style={[s.summaryValue, { color: palette.ink }]}>{summary.totalReviews}</Text><Text style={[s.summaryLabel, { color: palette.muted }]}>reviews</Text></View>
      {hideTier ? null : <View style={s.summaryTier}><Text style={[s.summaryTierText, { color: palette.green }]} numberOfLines={1}>{summary.trustTier ?? "New Trader"}</Text><Text style={[s.summaryLabel, { color: palette.muted }]}>trust tier</Text></View>}
    </View>
  );
}

export function ReviewRow({ dark, review, onReviewer, onItem }: { dark: boolean; review: import("../../src/api/reviews").ProfileReview; onReviewer: () => void; onItem: () => void }) {
  const palette = dark ? darkColors : lightColors;
  return (
    <View style={[s.reviewRow, { borderBottomColor: palette.divider }]}>
      <Pressable onPress={onReviewer} style={s.reviewIdentity} accessibilityRole="button" accessibilityLabel={`View ${review.reviewer.name}'s profile`}>
        <ReviewAvatar uri={review.reviewer.avatar} name={review.reviewer.name} dark={dark} />
        <View style={s.reviewIdentityText}><Text style={[s.reviewName, { color: palette.ink }]} numberOfLines={1}>{review.reviewer.name}</Text><RatingStars dark={dark} rating={review.rating} /></View>
        <Text style={[s.reviewDate, { color: palette.muted }]}>{new Date(review.createdAt).toLocaleDateString()}</Text>
      </Pressable>
      {review.comment ? <Text style={[s.reviewComment, { color: palette.secondary }]}>{review.comment}</Text> : null}
      {review.item ? <Pressable onPress={onItem} style={[s.reviewItem, { backgroundColor: palette.control }]} accessibilityRole="button" accessibilityLabel={`Open ${review.item.title}`}>
        {review.item.image ? <Image source={{ uri: review.item.image }} contentFit="cover" style={s.reviewItemImage} /> : <View style={[s.reviewItemImage, s.noImage]}><Ionicons name="image-outline" size={18} color={palette.muted} /></View>}
        <View style={s.reviewItemText}><Text style={[s.reviewItemTitle, { color: palette.ink }]} numberOfLines={1}>{review.item.title}</Text><Text style={[s.reviewItemMeta, { color: palette.muted }]}>{review.item.bracket === null ? "Unvalued" : bracketLabel(review.item.bracket)}</Text></View>
      </Pressable> : null}
    </View>
  );
}

function ReviewAvatar({ uri, name, dark }: { uri: string | null; name: string; dark: boolean }) {
  const palette = dark ? darkColors : lightColors;
  return uri
    ? <Image source={{ uri }} contentFit="cover" style={s.reviewAvatar} />
    : <View style={[s.reviewAvatar, s.reviewAvatarFallback, { backgroundColor: palette.control }]}><Text style={[s.reviewAvatarText, { color: palette.green }]}>{name.trim().charAt(0).toUpperCase() || "?"}</Text></View>;
}

function RatingStars({ dark, rating }: { dark: boolean; rating: number }) {
  const palette = dark ? darkColors : lightColors;
  return <View style={s.stars}>{[1, 2, 3, 4, 5].map((star) => <Ionicons key={star} name={star <= rating ? "star" : "star-outline"} size={14} color={star <= rating ? "#C58A24" : palette.muted} />)}</View>;
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
  if (item.status === "TRADED") return "Traded";
  return null;
}

/**
 * `onBoost` is passed by the OWNER'S shelf only (Profile → My Listings), and
 * only for a listing canBoost() allows; user.tsx never passes it. A listing
 * already featured shows a "Featured" pill instead, on the owner's shelf alone.
 */
export function ProfileTile({ dark, item, onPress, onBoost, showFeatured = !!onBoost }: { dark: boolean; item: Item; onPress: () => void; onBoost?: () => void; showFeatured?: boolean }) {
  const palette = dark ? darkColors : lightColors;
  const label = shelfLabel(item);
  const featured = label === null && item.featuredUntil !== null;
  return <Pressable onPress={onPress} style={[s.tile, { backgroundColor: palette.control }, label !== null && s.dimmed]} accessibilityRole="button" accessibilityLabel={label ? `${item.title} — ${label}` : `Open ${item.title}`}>
    {item.images[0] ? <Image source={{ uri: item.images[0] }} contentFit="cover" style={s.tileImage} /> : <View style={s.noImage}><Ionicons name="image-outline" size={24} color={palette.muted} /></View>}
    {label ? <View style={s.statusPill}><Text style={s.statusText} numberOfLines={1}>{label}</Text></View> : null}
    {featured && showFeatured ? <View style={s.featuredPill}><Ionicons name="leaf" size={11} color="#FFFFFF" /><Text style={s.statusText} numberOfLines={1}>Featured</Text></View> : null}
    {onBoost && !featured ? <Pressable onPress={onBoost} hitSlop={8} style={({ pressed }) => [s.boostPill, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={`Boost ${item.title}`}><Ionicons name="leaf-outline" size={11} color="#FFFFFF" /><Text style={s.statusText}>Boost</Text></Pressable> : null}
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
 */
const SHELF_CAP = 4;

export function Badges({ dark, achievements, showMore = true, onMore }: { dark: boolean; achievements: DisplayedAchievements; showMore?: boolean; onMore: () => void }) {
  const palette = dark ? darkColors : lightColors;
  const shown = achievements.slice(0, SHELF_CAP);
  const hasRoom = showMore && shown.length < SHELF_CAP;
  const data: { key: string; icon: keyof typeof Ionicons.glyphMap; imageUrl: string | null; label: string; more?: boolean }[] = [
    ...shown.map((a) => ({ key: a.id, icon: badgeIcons[a.icon] ?? "trophy-outline", imageUrl: a.imageUrl, label: a.name })),
    ...(hasRoom ? [{ key: "more", icon: "add-outline" as const, imageUrl: null, label: "More", more: true }] : []),
  ];
  return <View style={s.badges}><FlatList horizontal showsHorizontalScrollIndicator={false} data={data} keyExtractor={(item) => item.key} contentContainerStyle={s.badgesContent} renderItem={({ item }) => <Pressable onPress={item.more ? onMore : undefined} disabled={!item.more} accessibilityRole={item.more ? "button" : undefined} accessibilityLabel={item.more ? "More achievements" : item.label} style={s.badgeItem}><View style={[s.badgeCircle, { backgroundColor: palette.surface, borderColor: item.more ? palette.muted : (dark ? darkColors.border : color.controlLine) }, item.more && s.moreBadge]}>{item.imageUrl ? <Image source={{ uri: item.imageUrl }} contentFit="cover" style={s.badgeArt} /> : <Ionicons name={item.icon} size={24} color={item.more ? palette.muted : palette.green} />}</View><Text style={[s.badgeLabel, { color: palette.muted }]} numberOfLines={2} ellipsizeMode="tail">{shortBadgeLabel(item.label)}</Text></Pressable>} /></View>;
}

function shortBadgeLabel(label: string): string {
  return label.replace(/^Trusted Trader$/, "Trusted").replace(/^First Offer$/, "First offer");
}

/** The same fallback-to-initial avatar FeedCard uses, at the size this screen wants. */
export function Avatar({ uri, name }: { uri: string | null; name: string }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
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
  shopName: { fontFamily: font.sansSemi, fontSize: 14, marginTop: 1 },
  shopLink: { fontFamily: font.sansSemi, fontSize: 13 },
  identityRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 76, height: 76, borderRadius: 38 },
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
  badgeCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  badgeArt: { width: "100%", height: "100%" },
  moreBadge: { borderStyle: "dashed" },
  badgeLabel: { width: 76, fontFamily: font.sans, fontSize: 11, lineHeight: 14, marginTop: 4, textAlign: "center" },
  tabs: { height: 45, flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", position: "relative" },
  tabUnderline: { position: "absolute", bottom: -StyleSheet.hairlineWidth, width: 24, height: 2 },
  summary: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingVertical: 16, paddingHorizontal: 16 },
  summaryLoading: { height: 64, alignItems: "center", justifyContent: "center" },
  summaryValue: { fontFamily: font.displaySemi, fontSize: 20, textAlign: "center" },
  summaryLabel: { fontFamily: font.sans, fontSize: 11, marginTop: 3, textAlign: "center" },
  summaryTier: { maxWidth: 130, alignItems: "center" },
  summaryTierText: { fontFamily: font.sansSemi, fontSize: 13, textAlign: "center" },
  reviewRow: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  reviewIdentity: { minHeight: 44, flexDirection: "row", alignItems: "center" },
  reviewAvatar: { width: 40, height: 40, borderRadius: 20 },
  reviewAvatarFallback: { alignItems: "center", justifyContent: "center" },
  reviewAvatarText: { fontFamily: font.sansBold, fontSize: 15 },
  reviewIdentityText: { flex: 1, minWidth: 0, marginLeft: 10 },
  reviewName: { fontFamily: font.sansSemi, fontSize: 14 },
  stars: { flexDirection: "row", gap: 2, marginTop: 3 },
  reviewDate: { fontFamily: font.sans, fontSize: 11, marginLeft: 8 },
  reviewComment: { fontFamily: font.sans, fontSize: 14, lineHeight: 20, marginTop: 10 },
  reviewItem: { minHeight: 52, flexDirection: "row", alignItems: "center", marginTop: 12, borderRadius: 6, overflow: "hidden" },
  reviewItemImage: { width: 52, height: 52 },
  reviewItemText: { flex: 1, minWidth: 0, paddingHorizontal: 10 },
  reviewItemTitle: { fontFamily: font.sansSemi, fontSize: 13 },
  reviewItemMeta: { fontFamily: font.sans, fontSize: 11, marginTop: 3 },
  footer: { paddingVertical: 18 },
  gridRow: { width: "100%", flexDirection: "row", gap: 2, marginBottom: 2 },
  tile: { flexGrow: 1, flexBasis: 0, minWidth: 0, aspectRatio: 1 },
  tileImage: { width: "100%", height: "100%" },
  noImage: { flex: 1, alignItems: "center", justifyContent: "center" },
  dimmed: { opacity: 0.6 },
  statusPill: { position: "absolute", top: 6, left: 6, maxWidth: "88%", backgroundColor: "rgba(0,0,0,0.62)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  featuredPill: { position: "absolute", top: 6, left: 6, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: color.forest, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  boostPill: { position: "absolute", right: 6, bottom: 6, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: color.forest, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 4 },
  statusText: { color: "#FFFFFF", fontFamily: font.sansSemi, fontSize: 11 },
  empty: { color: color.inkMuted, fontFamily: font.sans, fontSize: 14, textAlign: "center", paddingVertical: 48 },
});

const lightColors = { surface: color.surface, control: color.control, ink: color.ink, secondary: color.inkSecondary, muted: color.inkMuted, divider: color.divider, border: color.controlLine, green: color.green };
const darkColors = { surface: "#171A17", control: "#252A25", ink: "#F4F5F0", secondary: "#B6BDB3", muted: "#929B91", divider: "#343A34", border: "#596159", green: "#72D681" };
