import { Redirect, Tabs } from "expo-router";

import { AppHeader } from "../../src/components/AppHeader";
import { Splash } from "../../src/components/Splash";
import { TabBar, type TabBarProps } from "../../src/components/TabBar";
import { useSession } from "../../src/auth/session";

/**
 * The (app) group: everything behind the session gate.
 *
 * ONE guard, at the group root, rather than a check inside each screen. Every
 * route in this tree is reached through this layout, so a screen added tomorrow
 * is protected by having been put in the folder — which is the only kind of
 * guard that stays correct as screens get added.
 *
 * The redirect is not the security boundary and is not pretending to be one.
 * Every /api/v1 route calls resolveSession() and answers 401 without a valid
 * Bearer token; this only decides which screen a person looks at. It is also
 * what handles a mid-session logout: when the refresh interceptor gives up on a
 * revoked token it clears the session, this layout re-renders with none, and
 * whatever tab was open is replaced by the login screen.
 *
 * THE BAR, left to right: Home, Marketplace, Post, Trades, Profile.
 *
 * Messages used to hold the fourth slot and is now a header icon. A bottom tab
 * costs a fifth of the bar permanently, and the bar is for the places you go to
 * do the app's job — look at what is offered, list a thing, run a trade.
 * Messages is where you go when a trade is already happening, which is a
 * notification-shaped need rather than a destination-shaped one: as a header
 * icon it keeps its unread count visible from every tab and gives the slot to
 * Marketplace.
 *
 * The route itself is untouched. `href: null` takes it off the bar and leaves
 * it navigable, so router.push("/messages") from the header still lands, deep
 * links still resolve, and the screen keeps its place in the group's guard.
 * `TabBar` also refuses to draw any route it has no entry for, so the two
 * mechanisms agree even if `href: null` changes behaviour upstream.
 *
 * THE BAR IS DRAWN, NOT CONFIGURED. See the note at the top of TabBar — the
 * spec's geometry is not reachable through screenOptions. Everything the
 * navigator would style is therefore left alone here.
 */
export default function AppLayout() {
  const { session, isLoading } = useSession();

  if (isLoading) return <Splash />;
  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{ header: () => <AppHeader /> }}
      // The cast, and why it is here rather than an import. BottomTabBarProps
      // lives inside expo-router's vendored copy of react-navigation and has no
      // importable path; reaching into expo-router/build/… for it buys a type
      // that can move on any patch release. TabBarProps declares the four
      // members this bar actually touches, and the object the navigator passes
      // structurally contains all four — the cast is asserting that and nothing
      // more. Same reasoning as the tabBarButton props in the previous version
      // of this file.
      tabBar={(props) => <TabBar {...(props as unknown as TabBarProps)} />}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="marketplace" options={{ title: "Marketplace" }} />
      <Tabs.Screen name="post" options={{ title: "Post" }} />
      <Tabs.Screen name="trades" options={{ title: "Trades" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />

      {/* Reachable, not listed. See the header note above. */}
      <Tabs.Screen name="messages" options={{ href: null, title: "Messages" }} />
    </Tabs>
  );
}
