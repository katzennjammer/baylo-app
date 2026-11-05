import { createContext, useContext, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useRouter } from "expo-router";

import { goBack } from "../src/lib/go-back";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError, resendVerificationSignedIn } from "../src/api/client";
import { getApiBase } from "../src/api/config";
import { fetchIdVerification, type IdVerificationStatus } from "../src/api/id-verification";
import { useOrganizations, type ActingOrg } from "../src/api/organizations";
import { getActingOrgId } from "../src/api/org-context";
import { useProfileMe } from "../src/api/profile";
import type { ViewerReputation } from "../src/api/types";
import { useSession } from "../src/auth/session";
import { BackHeader } from "../src/components/BackHeader";
import { showDialog } from "../src/components/dialog";
import { SectionHeader } from "../src/components/home-redesign/SectionHeader";
import { ChevronRightIcon, SearchIcon } from "../src/components/icons";
import { Ionicons } from "@expo/vector-icons";
import { sizedImage } from "../src/media/image-url";
import { HowTradingWorksSheet } from "../src/components/offer/OfferSheet";
import { Tappable } from "../src/components/Tappable";
import { openPremium } from "../src/lib/premium";
import { resetReachExplainerSeen } from "../src/lib/reach-flag";
import { TRADING_POLICY_PATH } from "../src/lib/trade-rules";
import { border, color, font, icon, size, space, textStyle, type } from "../src/theme/tokens";

/**
 * Settings.
 *
 * ── EVERY ROW OPENS SOMETHING THAT ALREADY EXISTED (3 Oct 2026) ─────────────
 *
 * Until this pass the Account card held the shop switcher and the sentence
 * "More account settings are coming soon", while four things the app already
 * did had no way in from here:
 *
 *   Register your shop     the business form was a step of signup only, so
 *                          "Decide later" was permanent. See /register-shop.
 *   Email verification     the only prompt was a bar on the Community feed.
 *   Premium                reachable from the header menu alone.
 *   Sign out               likewise.
 *
 * Nothing here is a new capability. Email and how the account signs in are
 * read off GET /api/v1/profile/me; the stored session supplies the email while
 * that loads, so the row is never blank for somebody checking whose account
 * this is on a slow connection.
 *
 * ── DRAWN THE WAY THE REST OF THE APP IS (3 Oct 2026) ───────────────────────
 *
 * This screen used to be five tinted, bordered, rounded cards. Direction 1 has
 * no such thing: a card is the canvas colour and a hairline says where it
 * ends (tokens.js, `color.surface` and `radius.card`). So:
 *
 *   the back row    BackHeader, shared with the screens this one opens.
 *   section titles  the shared SectionHeader, as Trades uses it. Sentence
 *                   case, no accent colour: these are plain lists.
 *   rows            full-width on the canvas, a hairline under each, the
 *                   app's own chevron. The finished-trades list's row.
 *
 * ROWS ARE `Tappable`, NOT `Pressable` WITH A STYLE FUNCTION. The old rows
 * passed `style={({ pressed }) => ...}`, which NativeWind's wrapper replaces
 * with an empty object — the whole style, not just the pressed half. See the
 * note in Tappable.tsx.
 */
export default function SettingsScreen() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  // The app is edge-to-edge and this screen has no AppHeader to inset it, so
  // the top padding is the status bar's, same as `AppHeader` does.
  const insets = useSafeAreaInsets();
  const { session, signOut } = useSession();
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [resending, setResending] = useState(false);

  // Same key and fetcher as verify-id and the post wizard, so the three share
  // one cache entry and this row never disagrees with the screen it opens.
  const idVerification = useQuery({
    queryKey: ["id-verification"],
    queryFn: fetchIdVerification,
    staleTime: 60_000,
  });

  const { data: profile, refetch: refetchProfile } = useProfileMe();
  const organizationsQuery = useOrganizations();
  const organizations = organizationsQuery.data?.data.organizations ?? [];
  const myShop =
    organizations.find((organization) => organization.id === getActingOrgId()) ??
    organizations[0] ??
    null;

  const email = profile?.user.email ?? session?.user.email ?? "";
  const version = Constants.expoConfig?.version ?? "unknown";

  async function resendVerification() {
    if (resending) return;
    setResending(true);
    try {
      const result = await resendVerificationSignedIn();
      if (result.alreadyVerified) {
        // The cached profile was stale; correct the row before saying so.
        void refetchProfile();
        showDialog("Already verified", "Your email address is already verified.");
      } else {
        showDialog("Email sent", `We sent a verification link to ${email}. Open it on this phone to finish.`);
      }
    } catch (e) {
      showDialog(
        "Could not send the email",
        e instanceof ApiError && e.status < 500 ? e.message : "Check your connection and try again.",
        [{ text: "Got it" }],
        { pose: "worry" },
      );
    } finally {
      setResending(false);
    }
  }

  // The same words and the same two buttons as the header menu's Sign out.
  //
  // THIS SCREEN HAS TO LEAVE ON ITS OWN, for the reason delete-account.tsx
  // gives: it is a root Stack route pushed over the tabs, so the session guard
  // swaps the tabs to the login screen underneath while this one stays on top.
  // Pop the stack, then land on sign-in explicitly.
  async function signOutAndLeave() {
    await signOut();
    if (router.canDismiss()) router.dismissAll();
    router.replace("/(auth)/login");
  }

  function confirmSignOut() {
    showDialog(
      "Sign out?",
      "This device will forget your tokens, and the session is revoked on the server so it cannot be resumed.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => void signOutAndLeave() },
      ],
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <BackHeader title="Settings" onBack={() => goBack(router)} />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.home.sectionTop }} keyboardShouldPersistTaps="handled">
        <View style={styles.searchBox}>
          <SearchIcon size={18} stroke={2} color={color.inkSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search settings"
            placeholderTextColor={color.inkMuted}
            style={styles.searchInput}
            accessibilityLabel="Search settings"
          />
        </View>
        {/* You, at the top: the way in to Edit profile. */}
        {!query ? (
          <Tappable onPress={() => router.push("/edit-profile")} accessibilityRole="button" style={styles.me} pressedStyle={styles.pressed}>
            {profile?.user.avatar ? (
              <Image source={{ uri: sizedImage(profile.user.avatar, "thumb") }} contentFit="cover" style={styles.meAvatar} />
            ) : (
              <View style={[styles.meAvatar, styles.meFallback]}>
                <Text style={styles.meInitials}>{(profile?.user.name ?? "?").slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.meName} numberOfLines={1}>{profile?.user.name ?? "Your account"}</Text>
              <Text style={styles.meSub} numberOfLines={1}>{email} · Edit profile</Text>
            </View>
            <ChevronRightIcon size={icon.chevron.size} stroke={icon.chevron.stroke} color={color.inkMuted} />
          </Tappable>
        ) : null}
        <SettingsQuery.Provider value={query.trim().toLowerCase()}>
        {/* The design's six groups (4 Nov 2026), each one card of rows with an
            icon square, a value on the right, and ↗ for browser pages. */}
        <Group title="Your account" hidden={!!query}>
          {profile ? (
            profile.user.isVerified ? (
              <InfoRow icon="mail-outline" label="Email verification" value="Verified" good sub={email} />
            ) : (
              <SettingsRow
                icon="mail-outline"
                label="Verify your email"
                sub={resending ? "Sending…" : "Not verified yet. Tap to send the link again"}
                onPress={() => void resendVerification()}
              />
            )
          ) : null}
          <SettingsRow
            icon="key-outline"
            label="Change password"
            sub={signInLine(profile?.user.hasPassword) ?? "Or set one if you signed up with Google"}
            onPress={() => router.push("/change-password")}
          />
          <SettingsRow
            icon="id-card-outline"
            label="ID verification"
            value={idVerification.data?.verified || idVerification.data?.status === "approved" ? "Verified" : undefined}
            good
            sub={idVerification.data?.verified || idVerification.data?.status === "approved" ? undefined : idStatusLine(idVerification.data?.status, idVerification.data?.verified)}
            onPress={() => router.push("/verify-id")}
          />
          <SettingsRow
            icon="phone-portrait-outline"
            label="Active sessions"
            sub="Where you're signed in"
            onPress={() => router.push("/active-sessions")}
          />
        </Group>

        <Group title="Your profile" hidden={!!query}>
          <SettingsRow
            icon="ribbon-outline"
            label="Achievements"
            value={profile ? `${profile.displayedAchievements.length} shown` : undefined}
            onPress={() => router.push("/achievements")}
          />
          {myShop ? (
            <SettingsRow
              icon="storefront-outline"
              label="My shop"
              sub={`${myShop.name} · ${organizationStatusLine(myShop)}`}
              onPress={() =>
                router.push({
                  pathname: "/edit-org",
                  params: {
                    id: myShop.id,
                    userId: myShop.orgUserId ?? profile?.user.id ?? session?.user.id ?? "",
                  },
                })
              }
            />
          ) : organizationsQuery.isSuccess && organizations.length === 0 ? (
            <SettingsRow
              icon="storefront-outline"
              label="Register your shop"
              sub="For MSMEs: trade as a shop, co-op or non-profit"
              onPress={() => router.push("/register-shop")}
            />
          ) : null}
        </Group>

        <Group title="Trading" hidden={!!query}>
          <SettingsRow
            icon="swap-horizontal"
            label="How trading works"
            sub="Brackets, bridging fees, your tier"
            onPress={() => setExplainerOpen(true)}
          />
          <SettingsRow icon="star-outline" label="Premium" value={premiumValue(profile?.reputation)} onPress={() => openPremium(router)} />
          <SettingsRow icon="document-text-outline" label="Trading policy" external onPress={() => openPage(TRADING_POLICY_PATH)} />
        </Group>

        <Group title="Activity" hidden={!!query}>
          <SettingsRow icon="heart-outline" label="Your activity" sub="Listings you liked" onPress={() => router.push("/activity")} />
        </Group>

        <Group title="Privacy" hidden={!!query}>
          <SettingsRow icon="ban-outline" label="Blocked users" onPress={() => router.push("/blocked-users")} />
        </Group>

        <Group title="Support and about" hidden={!!query}>
          <SettingsRow icon="help-circle-outline" label="Help" sub="Common questions and how to reach us" onPress={() => openPage(HELP_PATH)} />
          <SettingsRow icon="document-text-outline" label="Terms of service" external onPress={() => openPage(TERMS_PATH)} />
          <SettingsRow icon="lock-closed-outline" label="Privacy policy" external onPress={() => openPage(PRIVACY_PATH)} />
          <InfoRow icon="information-circle-outline" label="Version" value={version} />
        </Group>

        <Group title="Signing out" hidden={!!query}>
          <SettingsRow icon="log-out-outline" label="Sign out" sub="On this device" plain onPress={confirmSignOut} />
          <SettingsRow icon="trash-outline" danger label="Delete account" onPress={() => router.push("/delete-account")} />
        </Group>

        </SettingsQuery.Provider>

        {/* Dev builds only. `__DEV__` is a compile-time constant, so the release
            minifier drops this block and the reset never ships. */}
        {__DEV__ ? (
          <>
            <SectionHeader accent="Developer" />
            <SettingsRow
              icon="construct-outline"
              label="Reset “How trading works” seen flag"
              sub={
                resetDone
                  ? "Reset. It will open again on the next marketplace visit with a faded tile."
                  : "Shows the first-run sheet again on the marketplace"
              }
              onPress={() => {
                resetReachExplainerSeen();
                setResetDone(true);
              }}
            />
          </>
        ) : null}
      </ScrollView>

      {/* Reopened from here, `Got it` only closes it: the seen flag is the
          marketplace's to write, and it is already set by the time anyone
          finds this row. */}
      {explainerOpen ? <HowTradingWorksSheet onGotIt={() => setExplainerOpen(false)} /> : null}
    </View>
  );
}

/** Served by the API beside /policy/trading: public pages, no sign-in. */
const HELP_PATH = "/policy/help";
const TERMS_PATH = "/policy/terms";
const PRIVACY_PATH = "/policy/privacy";

/** Opens one of the server's public pages in the phone's browser. */
function openPage(path: string) {
  void Linking.openURL(`${getApiBase()}${path}`).catch(() => {});
}

/**
 * A row that opens something. `danger` draws the label and the chevron in the
 * urgent colour, for the one irreversible action on this screen.
 */
/** What is typed in "Search settings"; rows that do not match it hide. */
const SettingsQuery = createContext("");
const matches = (q: string, ...text: (string | null | undefined)[]) =>
  !q || text.some((t) => t?.toLowerCase().includes(q));

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** A titled group: the title above, the rows in one rounded card. */
function Group({ title, hidden, children }: { title: string; hidden: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      {hidden ? null : <Text style={styles.groupTitle}>{title}</Text>}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function RowIcon({ name, danger }: { name: IconName; danger?: boolean }) {
  return (
    <View style={styles.rowIcon}>
      <Ionicons name={name} size={18} color={danger ? color.urgent : color.ink} />
    </View>
  );
}

function SettingsRow({
  icon: iconName,
  label,
  sub,
  value,
  good = false,
  external = false,
  plain = false,
  onPress,
  danger = false,
}: {
  icon: IconName;
  label: string;
  sub?: string;
  value?: string;
  good?: boolean;
  /** Opens in the browser: ↗ instead of a chevron. */
  external?: boolean;
  /** No chevron at all (Sign out). */
  plain?: boolean;
  onPress: () => void;
  danger?: boolean;
}) {
  const q = useContext(SettingsQuery);
  if (!matches(q, label, sub, value)) return null;
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={sub}
      style={styles.row}
      pressedStyle={styles.pressed}
    >
      <RowIcon name={iconName} danger={danger} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && styles.danger]}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {value ? <Text style={[styles.rowValue, good && value === "Verified" && { color: color.forest }]}>{value}</Text> : null}
      {external ? (
        <Ionicons name="arrow-up-outline" size={15} color={color.inkMuted} style={{ transform: [{ rotate: "45deg" }] }} />
      ) : plain || danger ? null : (
        <ChevronRightIcon size={icon.chevron.size} stroke={icon.chevron.stroke} color={color.inkMuted} />
      )}
    </Tappable>
  );
}

/** A fact, not a destination: no chevron and not pressable. */
function InfoRow({ icon: iconName, label, value, sub, good = false }: { icon: IconName; label: string; value: string; sub?: string | null; good?: boolean }) {
  const q = useContext(SettingsQuery);
  if (!matches(q, label, value, sub)) return null;
  return (
    <View style={styles.row} accessible accessibilityRole="text" accessibilityLabel={`${label}: ${value}${sub ? `. ${sub}` : ""}`}>
      <RowIcon name={iconName} />
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Text style={[styles.rowValue, good && { color: color.forest }]}>{value}</Text>
    </View>
  );
}

function premiumValue(rep: ViewerReputation | undefined): string | undefined {
  if (!rep) return undefined;
  if (rep.vip) return "VIP";
  if (rep.premium) return rep.premiumLifetime ? "Lifetime" : "Active";
  return "Not subscribed";
}


/** The Verify-your-ID row's second line, from the same state verify-id renders. */
function idStatusLine(status: IdVerificationStatus | undefined, verified: boolean | undefined): string {
  if (verified || status === "approved") return "Verified";
  switch (status) {
    case "pending":
      return "Submitted, waiting for review";
    case "rejected":
      return "Not approved. Tap to see why and try again";
    case "exhausted":
      return "Not approved. Contact support";
    default:
      return "Needed to post items";
  }
}

/**
 * How this account signs in, under the email. Null — no line at all — when the
 * server did not say (an older server, or still loading): the app has never
 * known this, and a guess here would be a wrong statement about somebody's own
 * account.
 */
function organizationStatusLine(organization: ActingOrg): string {
  switch (organization.verificationStatus ?? (organization.verified ? "VERIFIED" : "PENDING")) {
    case "PENDING":
      return "Under review";
    case "VERIFIED":
      return "Verified";
    case "REJECTED":
      return "Rejected";
  }
}

function signInLine(hasPassword: boolean | undefined): string | null {
  if (hasPassword === undefined) return null;
  return hasPassword ? "Signs in with a password" : "Signs in with Google";
}

/** The Premium row's second line: the server's own verdict, never inferred. */
function premiumLine(rep: ViewerReputation | undefined): string {
  if (!rep) return "See what Premium includes";
  if (rep.vip) return "VIP active";
  if (rep.premium) return rep.premiumLifetime ? "Active (lifetime)" : "Active";
  return "Not active. See what it includes";
}

const styles = StyleSheet.create({
  group: { marginTop: 18, gap: 4 },
  groupTitle: { marginHorizontal: 20, marginBottom: 4, fontFamily: font.sansBold, fontSize: 13, color: color.inkSecondary },
  rowIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: color.control, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontFamily: font.sansMedium, fontSize: 15, color: color.ink },
  rowSub: { fontFamily: font.sans, fontSize: 12, color: color.inkSecondary },
  rowValue: { fontFamily: font.sansSemi, fontSize: 13, color: color.inkSecondary },
  screen: { flex: 1, backgroundColor: color.surface },


  // The finished-trades row: on the canvas, the gutter inside it so the held
  // fill runs edge to edge, a hairline underneath.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: border.hairline,
    borderBottomColor: color.divider,
  },
  pressed: { backgroundColor: color.control },
  rowText: { flex: 1, minWidth: 0, gap: 2 },

  leaving: { marginTop: space.home.sectionTop },
  // Each section is one rounded card (4 Nov 2026), Instagram-settings style.
  card: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: border.hairline,
    borderColor: color.controlLine,
    backgroundColor: color.searchSurface,
    overflow: "hidden",
  },
  searchBox: { marginHorizontal: 16, marginTop: 12, height: 42, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: color.control },
  searchInput: { flex: 1, fontFamily: font.sans, fontSize: 15, color: color.ink, paddingVertical: 0 },
  me: { marginHorizontal: 16, marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, borderWidth: border.hairline, borderColor: color.controlLine, backgroundColor: color.searchSurface },
  meAvatar: { width: 52, height: 52, borderRadius: 26 },
  meFallback: { backgroundColor: color.greenWash, alignItems: "center", justifyContent: "center" },
  meInitials: { fontFamily: font.displayBold, fontSize: 18, color: color.forest },
  meName: { fontFamily: font.sansBold, fontSize: 16, color: color.ink },
  meSub: { fontFamily: font.sans, fontSize: 13, color: color.inkSecondary },

  ink: { color: color.ink },
  secondary: { color: color.inkSecondary },
  danger: { color: color.urgent },
});
