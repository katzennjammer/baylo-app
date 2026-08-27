import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { Platform, Pressable, View, type GestureResponderEvent } from "react-native";

import { AppHeader } from "../../src/components/AppHeader";
import { Splash } from "../../src/components/Splash";
import { colors } from "../../src/theme/palette";
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
 */
export default function AppLayout() {
  const { session, isLoading } = useSession();

  if (isLoading) return <Splash />;
  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        header: () => <AppHeader />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors["bg-2"],
          borderTopColor: colors.line,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="trades"
        options={{
          title: "Trades",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="swap-horizontal" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: "",
          // The centre action is raised out of the bar, so it cannot use the
          // normal icon slot — the bar clips to its own height. Replacing the
          // whole button is what lets the circle overhang the top edge.
          //
          // The two props are passed by name rather than spread. expo-router
          // vendors react-navigation inside its own build output, so
          // BottomTabBarButtonProps has no importable path; PostButton declares
          // the shape it actually uses instead of reaching into
          // expo-router/build/… for a type that may move on any patch release.
          tabBarButton: ({ onPress, accessibilityState }) => (
            <PostButton onPress={onPress} accessibilityState={accessibilityState} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

/** The two props the raised centre button actually needs from the tab bar. */
interface PostButtonProps {
  onPress?: ((event: GestureResponderEvent) => void) | null;
  accessibilityState?: { selected?: boolean };
}

/** The raised centre button. Only the rendering is replaced; navigation is the bar's. */
function PostButton({ onPress, accessibilityState }: PostButtonProps) {
  const focused = accessibilityState?.selected ?? false;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Post an item"
      className="flex-1 items-center justify-center"
    >
      <View
        className={`h-14 w-14 -mt-8 items-center justify-center rounded-full border-4 border-bg-2 ${
          focused ? "bg-accent-2" : "bg-accent"
        }`}
        // The tab bar has no elevation of its own; without this the circle
        // reads as a flat hole punched in the bar rather than a raised control.
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={30} color={colors["on-accent"]} />
      </View>
    </Pressable>
  );
}
