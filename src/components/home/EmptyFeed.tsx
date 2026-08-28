import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LeafIcon } from "../icons";
import { border, color, icon, radius, size, space, textStyle, type } from "../../theme/tokens";
import { Tappable } from "../Tappable";

/**
 * The signup grant, as the copy names it.
 *
 * Mirrors SIGNUP_GRANT_LEAVES in the server's task-constants.ts, and mirrors is
 * the honest word — /api/v1/home does not return it, so this is a hand-kept
 * copy that goes stale silently if the grant ever changes. It is written as a
 * named constant rather than inlined in the sentence so that the day someone
 * greps for the number, this is one of the places they find.
 */
const SIGNUP_GRANT_LEAVES = 50;

/**
 * Nothing in the feed, one thing to do about it.
 *
 * The screen still teaches what the app trades in even with zero rows — the
 * suggested-traders row above it and the trending strip below it both render,
 * so this is never a lone piece of text on an empty canvas. That is why the
 * strip is not hidden when the feed is empty: it is the only content a brand
 * new account has, and it is what makes the ask specific rather than abstract.
 *
 * One primary action, one secondary. Widening the search is the second thing
 * someone tries when their own area is quiet, and it goes to Marketplace rather
 * than re-querying home, which has no radius to widen.
 */
export function EmptyFeed({ location }: { location: string | null }) {
  const router = useRouter();
  const place = location?.trim();

  return (
    <View style={s.wrap}>
      <View style={s.circle}>
        <LeafIcon size={icon.emptyLeaf.size} stroke={icon.emptyLeaf.stroke} color={color.forest} />
      </View>

      <Text style={[textStyle(type.emptyHeadline), s.headline]}>
        Your feed starts with one item
      </Text>

      <Text style={[textStyle(type.emptyBody), s.body]}>
        Post something you no longer use. We&apos;ll estimate its worth in Leaves and show it to
        {/* `location` is the viewer's OWN stated location — their claim about
            themselves, not a claim about who is in the feed — so naming it here
            is safe where naming it over the trending counts would not be. It is
            also nullable, and the sentence has to end cleanly without it. */}
        {place ? ` traders near you in ${place}.` : " traders near you."}
      </Text>

      <Tappable
        onPress={() => router.push("/post")}
        accessibilityRole="button"
        accessibilityLabel="Post your first item"
        style={s.primary}
        pressedStyle={s.primaryPressed}
      >
        <Text style={[textStyle(type.emptyPrimaryButton), { color: color.onGreen }]}>
          Post your first item
        </Text>
      </Tappable>

      <Pressable
        onPress={() => router.push("/marketplace")}
        accessibilityRole="button"
        style={s.secondary}
      >
        <Text style={[textStyle(type.secondaryButton), { color: color.forest }]}>
          {place ? `Browse ${place}-wide instead` : "Browse the marketplace instead"}
        </Text>
      </Pressable>

      <Text style={[textStyle(type.sectionSubcopy), s.note]}>
        You start with {SIGNUP_GRANT_LEAVES} Leaves. You earn more by completing trades, never by
        paying.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: "center",
    backgroundColor: color.surface,
    paddingHorizontal: space.empty.x,
    paddingVertical: space.empty.bodyToButton,
  },
  circle: {
    width: size.emptyIconCircle,
    height: size.emptyIconCircle,
    borderRadius: size.emptyIconCircle / 2,
    borderWidth: border.chip,
    borderColor: color.greenLine,
    backgroundColor: color.greenWash,
    alignItems: "center",
    justifyContent: "center",
  },
  headline: {
    marginTop: space.empty.iconToHeadline,
    textAlign: "center",
    color: color.ink,
  },
  body: {
    marginTop: space.empty.headlineToBody,
    textAlign: "center",
    color: color.inkSecondary,
  },
  primary: {
    marginTop: space.empty.bodyToButton,
    width: "100%",
    height: size.control.emptyPrimaryButton,
    borderRadius: radius.emptyPrimaryButton,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryPressed: { opacity: 0.85 },
  // Full width and no fill, per the spec — it is a 48 px target that happens to
  // look like a line of text, which is what a secondary action should be here.
  secondary: {
    width: "100%",
    height: size.control.secondaryButton,
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    marginTop: space.empty.buttonToNote,
    textAlign: "center",
    color: color.inkMuted,
  },
});
