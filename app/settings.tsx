import { useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useRouter } from "expo-router";

import { goBack } from "../src/lib/go-back";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError, resendVerificationSignedIn } from "../src/api/client";
import { getApiBase } from "../src/api/config";
import { fetchIdVerification, type IdVerificationStatus } from "../src/api/id-verification";
import { useOrganizations } from "../src/api/organizations";
import { useProfileMe } from "../src/api/profile";
import type { ViewerReputation } from "../src/api/types";
import { useSession } from "../src/auth/session";
import { BackHeader } from "../src/components/BackHeader";
import { showDialog } from "../src/components/dialog";
import { SectionHeader } from "../src/components/home-redesign/SectionHeader";
import { ChevronRightIcon } from "../src/components/icons";
import { HowTradingWorksSheet } from "../src/components/offer/OfferSheet";
import { OrgSwitcher } from "../src/components/OrgSwitcher";
import { Tappable } from "../src/components/Tappable";
import { openPremium } from "../src/lib/premium";
import { resetReachExplainerSeen } from "../src/lib/reach-flag";
import { TRADING_POLICY_PATH } from "../src/lib/trade-rules";
import { border, color, icon, size, space, textStyle, type } from "../src/theme/tokens";

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
  const organizations = useOrganizations().data?.data.organizations;

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

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.home.sectionTop }}>
        <SectionHeader accent="Account" top={space.home.headingToContent} />
        <InfoRow label="Email" value={email} sub={signInLine(profile?.user.hasPassword)} />
        {profile ? (
          profile.user.isVerified ? (
            <InfoRow label="Email verification" value="Verified" />
          ) : (
            <SettingsRow
              label="Verify your email"
              sub={resending ? "Sending…" : "Not verified yet. Tap to send the link again"}
              onPress={() => void resendVerification()}
            />
          )
        ) : null}
        {/* Only once the list has loaded and is empty: somebody who owns a shop
            has the switcher below instead, and a row that flashes in while the
            list loads would be a row that then disappears under a thumb. */}
        {organizations && organizations.length === 0 ? (
          <SettingsRow
            label="Register your shop"
            sub="For MSMEs: trade as a shop, co-op or non-profit"
            onPress={() => router.push("/register-shop")}
          />
        ) : null}
        {/*
          Renders nothing at all unless this person owns an organisation --
          which is almost everybody. See the note
          on OrgSwitcher: a card explaining a feature you are not using, on a
          screen you opened to do something else, is worse than no card.
        */}
        <View style={styles.gutter}>
          <OrgSwitcher />
        </View>

        <SectionHeader accent="Profile and security" />
        <SettingsRow
          label="Edit profile"
          sub="Name, photo, bio and location"
          onPress={() => router.push("/edit-profile")}
        />
        <SettingsRow
          label="Change password"
          sub="Or set one if you signed up with Google"
          onPress={() => router.push("/change-password")}
        />
        <SettingsRow
          label="Verify your ID"
          sub={idStatusLine(idVerification.data?.status, idVerification.data?.verified)}
          onPress={() => router.push("/verify-id")}
        />
        <SettingsRow
          label="Achievements"
          sub="Choose which badges show on your profile"
          onPress={() => router.push("/achievements")}
        />

        <SectionHeader accent="Trading" />
        <SettingsRow
          label="How trading works"
          sub="Brackets, bridging fees and your tier's ceiling"
          onPress={() => setExplainerOpen(true)}
        />
        <SettingsRow
          label="Trading policy"
          sub="Opens in your browser"
          // The same page the bridging-fee consent sheet links to.
          onPress={() => openPage(TRADING_POLICY_PATH)}
        />
        <SettingsRow label="Premium" sub={premiumLine(profile?.reputation)} onPress={() => openPremium(router)} />

        <SectionHeader accent="Privacy and safety" />
        <SettingsRow
          label="Active sessions"
          sub="See where you're signed in and log out other devices"
          onPress={() => router.push("/active-sessions")}
        />
        <SettingsRow
          label="Blocked users"
          sub="See who you have blocked and unblock them"
          onPress={() => router.push("/blocked-users")}
        />

        <SectionHeader accent="About" />
        {/* Three pages beside the trading policy, opened the same way. Help is
            where "Contact support" leads: several refusals say it, and until
            that page nothing said how. */}
        <SettingsRow label="Help" sub="Common questions and how to contact us" onPress={() => openPage(HELP_PATH)} />
        <SettingsRow label="Terms of service" sub="Opens in your browser" onPress={() => openPage(TERMS_PATH)} />
        <SettingsRow label="Privacy policy" sub="Opens in your browser" onPress={() => openPage(PRIVACY_PATH)} />
        <InfoRow label="Version" value={version} />

        {/* No title: the two rows that end the session say what they are. The
            section gap alone sets them apart from About. */}
        <View style={styles.leaving}>
          <SettingsRow label="Sign out" sub="On this device" onPress={confirmSignOut} />
          <SettingsRow
            danger
            label="Delete account"
            sub="Permanently erase your account and listings"
            onPress={() => router.push("/delete-account")}
          />
        </View>

        {/* Dev builds only. `__DEV__` is a compile-time constant, so the release
            minifier drops this block and the reset never ships. */}
        {__DEV__ ? (
          <>
            <SectionHeader accent="Developer" />
            <SettingsRow
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
function SettingsRow({
  label,
  sub,
  onPress,
  danger = false,
}: {
  label: string;
  sub: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={sub}
      style={styles.row}
      pressedStyle={styles.pressed}
    >
      <View style={styles.rowText}>
        <Text style={[textStyle(type.username), danger ? styles.danger : styles.ink]}>{label}</Text>
        <Text style={[textStyle(type.sectionSubcopy), styles.secondary]}>{sub}</Text>
      </View>
      <ChevronRightIcon
        size={icon.chevron.size}
        stroke={icon.chevron.stroke}
        color={danger ? color.urgent : color.inkMuted}
      />
    </Tappable>
  );
}

/**
 * A fact, not a destination: no chevron and not pressable, so it does not
 * promise a screen behind it. The value sits where a SettingsRow keeps its
 * second line when there is a `sub` to carry, and on the right when there is
 * not (Version).
 */
function InfoRow({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}${sub ? `. ${sub}` : ""}`}
    >
      <View style={styles.rowText}>
        <Text style={[textStyle(type.username), styles.ink]}>{label}</Text>
        {sub ? (
          <>
            <Text style={[textStyle(type.sectionSubcopy), styles.ink]} numberOfLines={1}>
              {value}
            </Text>
            <Text style={[textStyle(type.sectionSubcopy), styles.secondary]}>{sub}</Text>
          </>
        ) : null}
      </View>
      {sub ? null : <Text style={[textStyle(type.sectionSubcopy), styles.secondary]}>{value}</Text>}
    </View>
  );
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
  screen: { flex: 1, backgroundColor: color.surface },

  gutter: { paddingHorizontal: space.screenX },

  // The finished-trades row: on the canvas, the gutter inside it so the held
  // fill runs edge to edge, a hairline underneath.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.home.tileBody,
    minHeight: size.control.tabItem,
    paddingHorizontal: space.screenX,
    paddingVertical: space.home.tileBody,
    borderBottomWidth: border.hairline,
    borderBottomColor: color.divider,
  },
  pressed: { backgroundColor: color.control },
  rowText: { flex: 1, minWidth: 0, gap: 2 },

  leaving: { marginTop: space.home.sectionTop, borderTopWidth: border.hairline, borderTopColor: color.divider },

  ink: { color: color.ink },
  secondary: { color: color.inkSecondary },
  danger: { color: color.urgent },
});
