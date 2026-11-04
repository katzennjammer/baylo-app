import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Share, StyleSheet, Text, View } from "react-native";
import { useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { followButtonLabel, useFollow, usePublicProfile, useUnfollow } from "../../src/api/profile";
import { ApiError } from "../../src/api/client";
import { useBlockUser, useReport } from "../../src/api/item";
import { useSession } from "../../src/auth/session";
import { useProfileReviews, type ProfileReview } from "../../src/api/reviews";
import { Avatar, Badges, ProfileSkeleton, ProfileTabs, ProfileTile, ReviewLoadError, ReviewRow, ReviewSummary, shelfLabel } from "./profile";
import { BlockIcon, ChevronLeftIcon, FlagIcon, KebabIcon } from "../../src/components/icons";
import { MascotEmptyState } from "../../src/components/MascotEmptyState";
import { OrgStorefrontHeader, StorefrontEmpty, useStorefrontKeyboard } from "../../src/components/OrgStorefrontHeader";
import { getApiBase } from "../../src/api/config";
import { getActingOrgId } from "../../src/api/org-context";
import { Tappable } from "../../src/components/Tappable";
import { ReportSheet } from "../../src/components/ReportSheet";
import { SheetRow, SheetRows, SheetShell } from "../../src/components/sheet-ui";
import { showDialog } from "../../src/components/dialog";
import { bracketLabel } from "../../src/lib/brackets";
import { HeaderButtons, PersonHeader } from "../../src/components/profile/PersonHeader";
import type { Item } from "../../src/api/types";
import { color, dark as darkTokens, font, icon, space } from "../../src/theme/tokens";

type ProfileRow = { kind: "posts"; items: Item[] } | { kind: "review"; review: ProfileReview };

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const isOwnProfile = !!id && id === session?.user.id;
  const { data, isPending, isError, error, refetch, isRefetching } = usePublicProfile(isOwnProfile ? undefined : id);
  const follow = useFollow();
  const unfollow = useUnfollow();
  const block = useBlockUser();
  const report = useReport();
  const dark = useColorScheme() === "dark";
  const palette = dark ? darkColors : lightColors;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"posts" | "reviews">("posts");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [acted, setActed] = useState<"reported" | null>(null);
  const reviewQuery = useProfileReviews(id, tab === "reviews");
  // The storefront's invite field needs both: see useStorefrontKeyboard.
  const list = useRef<FlatList<ProfileRow>>(null);
  const { imeInset } = useStorefrontKeyboard();

  useEffect(() => {
    if (isOwnProfile) router.replace("/(app)/profile");
  }, [isOwnProfile, router]);

  const onRefresh = useCallback(() => {
    if (tab === "reviews") void reviewQuery.refetch();
    else void refetch();
  }, [refetch, reviewQuery, tab]);

  if (isOwnProfile) return null;

  if (isPending) return <View style={[s.screen, { backgroundColor: palette.surface }]}><BackRow title="Profile" insetsTop={insets.top} dark={dark} onPress={() => router.back()} /><ProfileSkeleton dark={dark} /></View>;
  if (isError || !data) {
    const unavailable = error instanceof ApiError && (error.status === 403 || error.status === 404);
    const canRetry = isError && !unavailable;
    return (
      <View style={[s.screen, { backgroundColor: palette.surface }]}>
        <BackRow title="Profile" insetsTop={insets.top} dark={dark} onPress={() => router.back()} />
        <MascotEmptyState
          pose="worry"
          title={canRetry ? "Couldn't load this profile" : "Profile unavailable"}
          message={canRetry ? "Check your connection and try again." : "This trader profile is unavailable."}
          action={canRetry ? { label: "Try again", onPress: () => void refetch() } : undefined}
        />
      </View>
    );
  }

  const status = data.follow.status;
  /** Non-null exactly when this profile is an organisation. See the header block. */
  const org = data.user.org;
  const busy = follow.isPending || unfollow.isPending;
  const rows: ProfileRow[] = tab === "posts"
    ? chunkItems(data.items).map((items) => ({ kind: "posts", items }))
    : reviewQuery.reviews.map((review) => ({ kind: "review", review }));

  function toggleFollow() {
    if (!data || busy || status === "PENDING") return;
    if (status === "ACCEPTED") unfollow.mutate({ userId: data.user.id });
    else follow.mutate({ userId: data.user.id });
  }

  const openMessage = () => router.push({ pathname: "/messages/thread", params: { partner: data.user.id, partnerName: data.user.name, partnerAvatar: data.user.avatar ?? "" } });
  const onBlock = () => {
    showDialog(
      `Block ${data.user.name}?`,
      "You will not see each other's listings and neither of you can message the other. " +
        "Trades already in progress are not cancelled — a block cannot undo a handover " +
        "that has already happened.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () =>
            block.mutate(data.user.id, {
              onSuccess: () => {
                setActionsOpen(false);
                setActed(null);
                router.back();
              },
              onError: (error) => {
                setActionsOpen(false);
                showDialog(
                  "Could not block",
                  error instanceof ApiError ? error.message : "Something went wrong.",
                );
              },
            }),
        },
      ],
    );
  };
  const onPickReportReason = (category: string) => {
    report.mutate(
      { targetType: "user", targetId: data.user.id, category },
      {
        onSuccess: () => {
          setReportOpen(false);
          setActed("reported");
          showDialog(
            "Thanks — that is with a moderator",
            "They review every report and will let you know the outcome.",
          );
        },
        onError: (error) => {
          setReportOpen(false);
          showDialog(
            error instanceof ApiError && error.code === "CONFLICT"
              ? "Already reported"
              : "Could not send that report",
            error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
          );
        },
      },
    );
  };

  /*
    AN ORGANISATION GETS THE STOREFRONT HEADER, a different layout rather than
    this one with a square avatar: banner + anchored logo, business identity,
    Active listings / Trades completed.
    See OrgStorefrontHeader. Everything from the tabs down -- the posts grid
    and the reviews list -- is the same code path as a person's.
  */
  const header = org ? (
    <OrgStorefrontHeader
      dark={dark}
      org={org}
      counts={data.counts}
      viewerId={session?.user.id ?? null}
      follow={{ label: followButtonLabel(status, data.follow.followsYou), busy, disabled: busy || status === "PENDING", primary: status === "NONE", onPress: toggleFollow }}
      onMessage={openMessage}
      onEdit={() => router.push({ pathname: "/edit-org", params: { id: org.id, userId: data.user.id } })}
      onShare={() => void Share.share({ message: `${org.name} on Baylo
${getApiBase().replace(/\/+$/, "")}/profile/${encodeURIComponent(data.user.id)}`, title: "Share shop" })}
      // Only while acting AS this shop -- otherwise Post lists on the viewer's
      // personal shelf. getActingOrgId() is read per render, as elsewhere.
      onPost={getActingOrgId() === org.id ? () => router.push("/post-item") : undefined}
    />
  ) : null;
  const emptyList = org ? (
    tab === "reviews"
      ? <StorefrontEmpty dark={dark} title="No reviews yet" body="Reviews appear here after a completed trade." />
      : <StorefrontEmpty dark={dark} title="No listings yet" body={org.viewerRole ? "Listings posted as this shop appear here." : "This shop hasn't listed anything yet."} pose="box" />
  ) : tab === "reviews" ? (
    <Text style={[s.empty, { color: palette.muted }]}>No reviews yet.</Text>
  ) : (
    // Nothing listed: still a whole profile. Only this area says so.
    <MascotEmptyState
      pose="box"
      size={96}
      title="Nothing listed yet"
      message={`Follow ${data.user.name.split(/\s+/)[0]} to see new listings in your feed when they post.`}
    />
  );

  return <>
  <FlatList<ProfileRow>
    ref={list}
    style={[s.screen, { backgroundColor: palette.surface, marginBottom: imeInset }]}
    keyboardShouldPersistTaps="handled"
    data={rows}
    keyExtractor={(row) => row.kind === "posts" ? row.items.map((item) => item.id).join(":") : row.review.id}
    ListHeaderComponent={<>
      <BackRow title={data.user.name} insetsTop={insets.top} dark={dark} onPress={() => router.back()} onMenu={org ? undefined : () => setActionsOpen(true)} />
      {header ?? (
      <PersonHeader
        avatar={<Avatar uri={data.user.avatar} name={data.user.name} />}
        user={{ ...data.user, trustTier: data.user.trustTier }}
        counts={data.counts}
        palette={palette}
        onFollowers={() => router.push({ pathname: "/connections", params: { userId: data.user.id, kind: "followers" } })}
        onFollowing={() => router.push({ pathname: "/connections", params: { userId: data.user.id, kind: "following" } })}
      >
        <HeaderButtons
          palette={palette}
          primary={{
            label: busy ? "Updating..." : followButtonLabel(status, data.follow.followsYou),
            onPress: toggleFollow,
            filled: status === "NONE",
            disabled: busy || status === "PENDING",
          }}
          secondary={{ label: "Message", onPress: openMessage }}
        />
        {/* Badges they chose to show. Tap one to see what it is for. */}
        {data.displayedAchievements.length > 0 ? <Badges dark={dark} achievements={data.displayedAchievements} showMore={false} own={false} onMore={() => undefined} /> : null}
      </PersonHeader>
      )}
      <ProfileTabs dark={dark} active={tab} onChange={setTab} />
      {tab === "reviews" ? <ReviewSummary dark={dark} summary={reviewQuery.summary} hideTier={!!org} loadError={reviewQuery.isLoadingError} onRetry={() => void reviewQuery.refetch()} /> : null}
    </>}
    renderItem={({ item: row }) => row.kind === "posts" ? <View style={s.gridRow}>{row.items.map((item) => <ProfileTile key={item.id} dark={dark} item={item} onPress={() => router.push({ pathname: shelfLabel(item) ? "/listing-review" : "/item", params: { id: item.id } })} />)}</View> : <ReviewRow dark={dark} review={row.review} onReviewer={() => router.push({ pathname: "/user", params: { id: row.review.reviewer.id } })} onItem={() => { if (row.review.item) router.push({ pathname: "/item", params: { id: row.review.item.id } }); }} />}
    onEndReached={() => { if (tab === "reviews" && reviewQuery.hasNextPage && !reviewQuery.isFetchingNextPage) void reviewQuery.fetchNextPage(); }}
    onEndReachedThreshold={0.6}
    refreshControl={<RefreshControl refreshing={tab === "reviews" ? reviewQuery.isRefetching : isRefetching} onRefresh={onRefresh} tintColor={palette.green} />}
    ListFooterComponent={tab === "reviews" && reviewQuery.isFetchingNextPage ? <ActivityIndicator color={palette.green} style={s.footer} /> : null}
    ListEmptyComponent={tab === "reviews" && reviewQuery.isLoadingError
      ? <ReviewLoadError dark={dark} onRetry={() => void reviewQuery.refetch()} />
      : emptyList}
  />
    {actionsOpen ? (
      <SheetShell
        title={data.user.name}
        onClose={() => setActionsOpen(false)}
        busy={block.isPending || report.isPending}
        colors={{ surface: palette.surface, ink: palette.ink, inkSecondary: palette.secondary, divider: palette.divider, controlLine: palette.border }}
      >
        <SheetRows>
          <SheetRow
            glyph={<FlagIcon size={icon.menuRow.size} stroke={icon.menuRow.stroke} color={palette.secondary} />}
            label={acted === "reported" ? "Reported — a moderator will review it" : "Report"}
            disabled={acted === "reported" || report.isPending}
            colors={{ ink: palette.ink, urgent: color.urgent }}
            onPress={() => {
              setActionsOpen(false);
              setReportOpen(true);
            }}
          />
          <SheetRow
            glyph={<BlockIcon size={icon.menuRow.size} stroke={icon.menuRow.stroke} color={color.urgent} />}
            label="Block"
            destructive
            disabled={block.isPending}
            colors={{ ink: palette.ink, urgent: color.urgent }}
            onPress={onBlock}
          />
        </SheetRows>
      </SheetShell>
    ) : null}
    {reportOpen ? (
      <ReportSheet
        target="user"
        targetName={data.user.name}
        busy={report.isPending}
        onPick={onPickReportReason}
        onClose={() => setReportOpen(false)}
      />
    ) : null}
  </>;
}

function chunkItems(items: Item[]): Item[][] { const rows: Item[][] = []; for (let index = 0; index < items.length; index += 3) rows.push(items.slice(index, index + 3)); return rows; }
function BackRow({ title, insetsTop, dark, onPress, onMenu }: { title: string; insetsTop: number; dark: boolean; onPress: () => void; onMenu?: () => void }) {
  const palette = dark ? darkColors : lightColors;
  return (
    <View style={[s.top, { borderBottomColor: palette.divider, paddingTop: insetsTop, height: insetsTop + 64 }]}>
      <Tappable onPress={onPress} accessibilityRole="button" accessibilityLabel="Go back" style={s.back} pressedStyle={s.backPressed}>
        <ChevronLeftIcon size={icon.back.size} stroke={icon.back.stroke} color={palette.ink} />
      </Tappable>
      <Text style={[s.headerTitle, { color: palette.ink }]} numberOfLines={1}>{title}</Text>
      {/* One labelled menu (Report, Block) in the header, not beside the buttons. */}
      {onMenu ? (
        <Tappable onPress={onMenu} accessibilityRole="button" accessibilityLabel="More options" style={s.back} pressedStyle={s.backPressed}>
          <KebabIcon size={icon.kebab.size} color={palette.ink} />
        </Tappable>
      ) : (
        <View style={s.headerSpacer} />
      )}
    </View>
  );
}
function Stat({ dark, label, value, onPress }: { dark: boolean; label: string; value: number; onPress?: () => void }) { const palette = dark ? darkColors : lightColors; const content = <><Text style={[s.statValue, { color: palette.ink }]}>{value}</Text><Text style={[s.statLabel, { color: palette.muted }]}>{label}</Text></>; return onPress ? <Pressable onPress={onPress} style={s.stat} accessibilityRole="button">{content}</Pressable> : <View style={s.stat}>{content}</View>; }

const s = StyleSheet.create({
  screen: { flex: 1 }, top: { flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.screenXTight }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, backPressed: { opacity: 0.6 }, headerTitle: { flex: 1, textAlign: "center", fontFamily: font.displaySemi, fontSize: 18 }, headerSpacer: { width: 44 }, spinner: { marginTop: 40 }, empty: { textAlign: "center", paddingVertical: 48 }, header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }, identityRow: { flexDirection: "row", alignItems: "center" }, stats: { flex: 1, flexDirection: "row", justifyContent: "space-evenly", marginLeft: 20 }, stat: { alignItems: "center", minWidth: 58, minHeight: 44, justifyContent: "center" }, statValue: { fontFamily: font.sansSemi, fontSize: 18 }, statLabel: { fontFamily: font.sans, fontSize: 12, marginTop: 4 }, tier: { alignSelf: "flex-start", borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6, marginTop: 6 }, tierText: { fontFamily: font.sansSemi, fontSize: 11 }, bio: { fontFamily: font.sans, fontSize: 14, lineHeight: 20, marginTop: 6 }, actions: { flexDirection: "row", gap: 8, marginTop: 8 }, actionButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: "transparent" }, menuButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1 }, followButton: { backgroundColor: color.green }, actionText: { fontFamily: font.sansSemi, fontSize: 14 }, followText: { color: color.onGreen }, disabled: { opacity: 0.55 }, gridRow: { width: "100%", flexDirection: "row", gap: 2, marginBottom: 2 }, footer: { paddingVertical: 18 },
});
const lightColors = { surface: color.surface, control: color.control, ink: color.ink, secondary: color.inkSecondary, muted: color.inkMuted, divider: color.divider, border: color.controlLine, green: color.green };
const darkColors = { surface: darkTokens.surface, control: darkTokens.control, ink: darkTokens.ink, secondary: darkTokens.secondary, muted: darkTokens.muted, divider: darkTokens.divider, border: darkTokens.border, green: darkTokens.green };