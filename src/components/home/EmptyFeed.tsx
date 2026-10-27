import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { color, size, space, textStyle, type } from "../../theme/tokens";
import { MascotEmptyState } from "../MascotEmptyState";

/**
 * What a verified account starts with, as the copy names it.
 *
 * Mirrors VERIFY_CREDIT_LEAVES in the server's task-constants.ts — the 20-Leaf
 * signup grant plus the 10-Leaf VERIFY_ACCOUNT task, paid together at
 * verification — and mirrors is the honest word: /api/v1/home does not return
 * it, so this is a hand-kept copy that goes stale silently if either half ever
 * changes. It quotes the total rather than the grant because the total is what
 * the balance actually shows. It is written as a named constant rather than
 * inlined in the sentence so that the day someone greps for the number, this
 * is one of the places they find.
 */
const VERIFY_CREDIT_LEAVES = 30;

/**
 * Nothing in the feed, one thing to do about it.
 *
 * The suggested-traders row above it still renders with zero rows, so this is
 * never a lone piece of text on an empty canvas.
 *
 * One primary action, one secondary. Widening the search is the second thing
 * someone tries when their own area is quiet, and it goes to Marketplace rather
 * than re-querying home, which has no radius to widen.
 */
export function EmptyFeed({ location }: { location: string | null }) {
  const router = useRouter();
  const place = location?.trim();

  return (
    <View style={s.surface}>
    <MascotEmptyState
      pose="box"
      title="Your feed starts with one item"
      message={`Post something you no longer use. We'll estimate its worth in Leaves and show it to traders near you${place ? ` in ${place}` : ""}.`}
      action={{
        label: "Post your first item",
        accessibilityLabel: "Post your first item",
        onPress: () => router.push("/post"),
      }}
    >
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
        You start with {VERIFY_CREDIT_LEAVES} Leaves once your email is verified. You earn more by
        completing trades, never by paying.
      </Text>
    </MascotEmptyState>
    </View>
  );
}

const s = StyleSheet.create({
  surface: { backgroundColor: color.surface },
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
