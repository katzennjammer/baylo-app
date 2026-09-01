import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { ChevronLeftIcon, PersonIcon } from "../../src/components/icons";
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
 * Another trader's profile — a placeholder, and labelled as one.
 *
 * Item detail's owner row has to go somewhere: a name that looks tappable and
 * is not is a worse control than a plain label. This is where it goes until the
 * real screen exists.
 *
 * Same rule as app/(app)/offer.tsx — it says it is unbuilt rather than
 * pretending. During testing, a screen that silently does nothing and a screen
 * that crashed look identical.
 *
 * WHAT IT WOULD BE BUILT FROM: /api/v1/profile/[id] already exists and returns
 * the user with their listings. Note it sends `trustTier: null` — the same gap
 * item detail had until /items/[id] was changed to resolve it — so whoever
 * builds this decides then whether a profile is a screen where the badge is
 * worth three aggregates. It is the same judgement, and the answer is probably
 * yes for the same reason: a profile is read before deciding to trade.
 */
export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

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
          <PersonIcon size={icon.emptyGrid.size} stroke={icon.emptyGrid.stroke} color={color.inkMuted} />
        </View>

        <Text style={[textStyle(type.emptyHeadline), s.headline]}>
          Profiles aren&apos;t built yet
        </Text>

        <Text style={[textStyle(type.emptyBody), s.body]}>
          This is where {id ? "this trader" : "a trader"}&apos;s profile and their other listings
          will be. The screen has not been written — nothing is broken.
        </Text>

        <View style={s.note}>
          <Text style={[textStyle(type.sectionEyebrow), { color: color.inkMuted }]}>
            NOT A BUG — PLACEHOLDER
          </Text>
        </View>

        <Tappable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={s.primary}
          pressedStyle={s.primaryPressed}
        >
          <Text style={[textStyle(type.emptyPrimaryButton), { color: color.onGreen }]}>Back</Text>
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
