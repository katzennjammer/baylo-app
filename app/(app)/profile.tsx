import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import { colors } from "../../src/theme/palette";
import { useSession } from "../../src/auth/session";

/**
 * Profile — the account block, and the way out.
 *
 * Everything else this tab will eventually carry (listings, Leaves, rank, trade
 * history) is unbuilt, and the card below says so rather than rendering empty
 * rows that are indistinguishable from a working screen with no data.
 *
 * Sign-out is here now because it is the one control that has nowhere else to
 * live. There is no settings screen yet, and until there is, "I am signed in as
 * an account I did not mean to be" has no remedy inside the app at all.
 *
 * THE IDENTITY BLOCK READS THE STORED SESSION, not useHome(). It costs no
 * request — name, email and avatar were written to SecureStore by the token
 * endpoint at sign-in — and, more to the point, it is still correct on a phone
 * with no signal. Which is exactly the state someone is in when they most want
 * to check whose account this is before signing out of it.
 */
export default function ProfileScreen() {
  const { session, signOut } = useSession();
  const [busy, setBusy] = useState(false);
  // A ref as well as the state flag: Alert's onPress can fire twice on a fast
  // double-tap, before the re-render that disables the button has landed. A
  // second signOut() would post a second revoke with a token already spent.
  const inFlight = useRef(false);

  const user = session?.user;

  const performSignOut = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);

    try {
      await signOut();
    } catch {
      // Nothing to show, and nowhere to show it. signOut() drops the in-memory
      // session and publishes that before anything which can fail is awaited,
      // so by the time an error reaches here the guard in (app)/_layout.tsx has
      // already replaced this entire tree with the login screen.
      //
      // Note there is no router.replace() on the success path either, for the
      // same reason: the redirect is declarative and belongs to the guard.
      // Navigating imperatively from here would race it, and the guard is the
      // path a mid-session logout already takes when the refresh interceptor
      // gives up — one mechanism, not two.
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [signOut]);

  const confirmSignOut = useCallback(() => {
    Alert.alert(
      "Sign out?",
      "This device will forget your tokens, and the session is revoked on the server so it cannot be resumed.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => void performSignOut() },
      ],
    );
  }, [performSignOut]);

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="px-4 py-5 pb-10">
      <View className="flex-row items-center gap-4 rounded-2xl border border-line bg-card px-4 py-4">
        <Avatar uri={user?.image ?? null} name={user?.name ?? "?"} />
        <View className="flex-1">
          <Text className="text-text text-lg font-bold tracking-tight" numberOfLines={1}>
            {user?.name ?? "Signed in"}
          </Text>
          {user?.email ? (
            <Text className="text-muted text-sm mt-0.5" numberOfLines={1}>
              {user.email}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="mt-4 rounded-2xl border border-line bg-card px-4 py-5">
        <View className="flex-row items-center gap-2">
          <Ionicons name="person-outline" size={16} color={colors.accent} />
          <Text className="text-text text-sm font-semibold">Your profile</Text>
        </View>
        <Text className="text-muted text-sm mt-2 leading-5">
          Your listings, your Leaves, your rank and your trade history will live here.
        </Text>
        <Text className="text-muted/60 text-[11px] uppercase tracking-[2px] mt-4">
          Not built yet
        </Text>
      </View>

      <View className="mt-8">
        <SignOutButton onPress={confirmSignOut} busy={busy} />
        <Text className="text-muted/70 text-xs text-center mt-3 leading-4">
          Signing out revokes this device's session on the server. You will need your
          password to get back in.
        </Text>
      </View>
    </ScrollView>
  );
}

/**
 * The destructive action, on the app's dark canvas.
 *
 * Not one of the buttons in `src/components/auth-ui.tsx`: those are built for
 * the white card the auth screens use and hardcode `bg-white` with ink type,
 * which here would be a bright slab in the middle of a very dark screen.
 *
 * Outlined rather than filled. A filled red button is the loudest thing on any
 * screen it is on, and this is not the screen's primary action — it is only its
 * ONLY action, which is an accident of the tab being unbuilt rather than a
 * claim about its importance. h-[52px] matches the auth buttons and clears the
 * 44px tap floor with room for the border.
 */
function SignOutButton({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Sign out"
      accessibilityState={{ disabled: busy, busy }}
      className={`h-[52px] flex-row items-center justify-center gap-2.5 rounded-full border border-danger/50 ${
        busy ? "opacity-50" : "bg-danger/10 active:bg-danger/20"
      }`}
    >
      {busy ? (
        <ActivityIndicator color={colors.danger} />
      ) : (
        <>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text className="text-danger text-[15px] font-bold uppercase tracking-wider">
            Sign out
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** The same fallback-to-initial avatar FeedCard uses, at the size this screen wants. */
function Avatar({ uri, name }: { uri: string | null; name: string }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        contentFit="cover"
        style={{ width: 56, height: 56, borderRadius: 28 }}
      />
    );
  }
  return (
    <View className="h-14 w-14 items-center justify-center rounded-full bg-accent">
      <Text className="text-on-accent text-xl font-bold">
        {name.trim().charAt(0).toUpperCase() || "?"}
      </Text>
    </View>
  );
}
