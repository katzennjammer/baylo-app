import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { ChevronLeftIcon, SwapIcon } from "../../src/components/icons";
import { Tappable } from "../../src/components/Tappable";
import {
  border,
  color,
  icon,
  radius,
  size,
  space,
  textStyle,
  type,
} from "../../src/theme/tokens";

/**
 * The offer flow — NOT BUILT YET, and this screen says so out loud.
 *
 * ── WHY IT SAYS SO ──────────────────────────────────────────────────────────
 *
 * The alternative was a button that navigates nowhere, which is what "Offer
 * Trade" did on the Home tab before item detail existed. During testing an
 * inert control is indistinguishable from a broken one: somebody taps it,
 * nothing happens, and the only way to find out whether that is a missing
 * screen or a swallowed exception is to read the source. This screen is here so
 * that question never has to be asked — it costs one file and removes an entire
 * class of false bug report.
 *
 * IT IS NOT A FAKE. There is deliberately no mocked item picker, no disabled
 * "Send offer" button, and no spinner. A placeholder that LOOKS like the
 * feature is worse than this: it invites someone to test a flow that has no
 * server behind it, and every finding from that test would be about the mock.
 *
 * ── WHAT BUILDING IT ACTUALLY NEEDS ─────────────────────────────────────────
 *
 * Written down here because it is the question anyone opening this file next
 * will have. /api/v1/items/[id] ALREADY returns everything the sheet needs —
 * `viewer.tradeableItems` (the picker's rows), `viewer.leaves` (the balance),
 * and `viewer.existingOfferId` (whether this is a new offer or an edit). What
 * is missing is the write: there is no POST /api/v1/offers. The legacy
 * `POST /api/offers` exists and takes `{ postId, offeredItems[], offeredLeaves,
 * message }`, but it answers in the old bare-object error shape rather than the
 * v1 envelope, so apiV1() cannot unwrap it. That endpoint is the piece of work,
 * not this screen.
 */
export default function OfferScreen() {
  const router = useRouter();
  const { title } = useLocalSearchParams<{ itemId?: string; title?: string }>();

  return (
    <View style={s.screen}>
      <View style={s.backRow}>
        <Tappable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={s.back}
          pressedStyle={s.backPressed}
        >
          <ChevronLeftIcon size={icon.back.size} stroke={icon.back.stroke} color={color.ink} />
        </Tappable>
      </View>

      <View style={s.wrap}>
        <View style={s.circle}>
          <SwapIcon size={icon.emptyGrid.size} stroke={icon.emptyGrid.stroke} color={color.inkMuted} />
        </View>

        <Text style={[textStyle(type.emptyHeadline), s.headline]}>
          Offers aren&apos;t built yet
        </Text>

        <Text style={[textStyle(type.emptyBody), s.body]}>
          {title
            ? `You got here from “${title}”, and that part works — this is the screen that has not been written.`
            : "This is the screen that has not been written yet."}
          {" "}
          Nothing is broken and nothing was sent.
        </Text>

        <View style={s.note}>
          <Text style={[textStyle(type.sectionEyebrow), { color: color.inkMuted }]}>
            NOT A BUG — PLACEHOLDER
          </Text>
        </View>

        <Tappable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to the listing"
          style={s.primary}
          pressedStyle={s.primaryPressed}
        >
          <Text style={[textStyle(type.emptyPrimaryButton), { color: color.onGreen }]}>
            Back to the listing
          </Text>
        </Tappable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  backRow: { paddingHorizontal: space.screenXTight, paddingTop: 4 },
  back: {
    width: size.detail.backButton,
    height: size.detail.backButton,
    alignItems: "center",
    justifyContent: "center",
  },
  backPressed: { opacity: 0.6 },

  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.empty.x,
  },
  circle: {
    width: size.emptyIconCircle,
    height: size.emptyIconCircle,
    borderRadius: size.emptyIconCircle / 2,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    backgroundColor: color.control,
    alignItems: "center",
    justifyContent: "center",
  },
  headline: { marginTop: space.empty.iconToHeadline, textAlign: "center", color: color.ink },
  body: { marginTop: space.empty.headlineToBody, textAlign: "center", color: color.inkSecondary },
  note: {
    marginTop: space.empty.headlineToBody,
    paddingHorizontal: space.chip.x,
    paddingVertical: space.chip.y,
    borderRadius: radius.chip,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    backgroundColor: color.control,
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
});
