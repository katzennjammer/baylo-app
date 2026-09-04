import { Text, View } from "react-native";

import { useHubs } from "../../api/hubs";
import type { SafeZoneHub } from "../../api/types";
import { usePost } from "../../post/state";
import {
  postColor,
  postIcon,
  postLines,
  postRadius,
  postSize,
  postSpace,
  postType,
  rules,
  textStyle,
  type Board,
} from "../../theme/post-tokens";
import { CheckIcon } from "../icons";
import { Tappable } from "../Tappable";
import { CheckboxIcon } from "./post-icons";
import { HelperRow, Skeleton } from "./ui";

/**
 * Step 6 — where you'll meet.
 *
 * ── THE ROWS ARE EDGE TO EDGE AND THE TEXT ABOVE THEM IS NOT ────────────────
 *
 * The heading block keeps the 20 gutter; the rows run the full width with a
 * hairline above and below each. That is the spec's arrangement and it is the
 * one that makes a list of twenty-two feel like a list rather than like twenty-
 * two cards: the hairlines are continuous, so the eye reads one column of
 * places instead of a stack of objects.
 *
 * ── "SKIP FOR NOW" IS A REAL ROUTE, NOT AN ESCAPE ───────────────────────────
 *
 * It sits in the footer beside the counter, at the same weight as the counter,
 * and taking it advances the step exactly as Next does. The listing is posted
 * with no meeting places and the review step says so plainly — "None chosen —
 * you can agree a place in chat." A hub is genuinely optional to the server,
 * and pretending otherwise here would strand anybody who lives away from the
 * twenty-two seeded places.
 *
 * ── THE FIVE-HUB CAP IS THE SERVER'S, EXPRESSED BEFORE IT BITES ─────────────
 *
 * `resolveHubIds` rejects a sixth and the item is not created. So the sixth
 * checkbox does not submit and fail — the reducer refuses it and the helper
 * says why. Same principle as the value slider's band.
 */

export function StepHubs({ board }: { board: Board }) {
  const { state, dispatch } = usePost();

  // The same query key and the same 30-minute staleTime the marketplace map
  // uses. A session that has opened the map paints this step with no request.
  const { data, isPending, isError } = useHubs();

  const hubs = data?.hubs ?? [];
  const atLimit = state.hubIds.length >= rules.maxHubs;

  return (
    <View>
      <View style={{ paddingHorizontal: board.hubX }}>
        <Text
          style={[
            textStyle(postType.stepHeading),
            { color: postColor.ink, fontSize: board.stepHeading },
          ]}
        >
          Where can you meet?
        </Text>
        <Text
          style={[
            textStyle(postType.stepSub),
            { color: postColor.inkSecondary, marginTop: postSpace.hubs.headingToSub },
          ]}
        >
          Pick up to five public places near you. Traders will choose from these when they make
          an offer.
        </Text>

        {atLimit ? (
          <View style={{ marginTop: 14 }}>
            <HelperRow>That is five places. Uncheck one to add another.</HelperRow>
          </View>
        ) : null}

        <View style={{ height: postSpace.hubs.subToEnd }} />
      </View>

      {isPending ? (
        <HubSkeleton board={board} />
      ) : isError || hubs.length === 0 ? (
        <View style={{ paddingHorizontal: board.hubX, paddingTop: 4 }}>
          <HelperRow>
            No Safe-Zone Hubs near you yet. You can post without one and agree a place in chat.
          </HelperRow>
        </View>
      ) : (
        <View>
          {/* The first hairline. Every row draws its own bottom rule, so this is
              the only one that has to be declared separately. */}
          <View style={{ height: 1, backgroundColor: postColor.divider }} />
          {hubs.map((hub) => (
            <HubRow
              key={hub.id}
              hub={hub}
              board={board}
              selected={state.hubIds.includes(hub.id)}
              // A row that would be the sixth is not merely refused by the
              // reducer — it is not offered. Disabling it is what makes the cap
              // visible before it is reached.
              disabled={atLimit && !state.hubIds.includes(hub.id)}
              onPress={() => dispatch({ type: "hub/toggle", id: hub.id })}
            />
          ))}
        </View>
      )}

      <View style={{ height: 24 }} />
    </View>
  );
}

/**
 * One hub. 76 tall, name and type eyebrow on one line, landmark note under it.
 *
 * The landmark is the field that actually gets two people to the same spot —
 * "Safe-Zone Hub" and a mall's name do not distinguish one of four entrances —
 * so it is on the row rather than behind a tap, and it truncates to one line
 * rather than wrapping and pushing the row off its 76.
 */
function HubRow({
  hub,
  board,
  selected,
  disabled,
  onPress,
}: {
  hub: SafeZoneHub;
  board: Board;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Tappable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={`${hub.name}. ${hub.typeLabel}. ${hub.landmark}`}
      style={{
        height: postSize.hub.row,
        paddingHorizontal: board.hubX,
        flexDirection: "row",
        alignItems: "center",
        gap: postSpace.hubs.controlGap,
        backgroundColor: selected ? postColor.greenWash : postColor.surface,
        borderBottomWidth: 1,
        borderBottomColor: postColor.divider,
        borderRadius: postRadius.hubRow,
        opacity: disabled ? 0.5 : 1,
      }}
      pressedStyle={selected ? undefined : { backgroundColor: postColor.inset }}
    >
      <View style={{ flex: 1 }}>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: postSpace.hubs.nameGap }}
        >
          <Text
            style={[
              textStyle(postType.hubName),
              { color: postColor.ink, flexShrink: 1 },
            ]}
            numberOfLines={postLines.hubName}
          >
            {hub.name}
          </Text>
          <Text
            style={[
              textStyle(postType.hubEyebrow),
              { color: selected ? postColor.forest : postColor.inkMuted },
            ]}
          >
            {hub.typeLabel.toUpperCase()}
          </Text>
        </View>
        <Text
          style={[
            textStyle(postType.hubNote),
            {
              color: selected ? postColor.forest : postColor.inkMuted,
              marginTop: postSpace.hubs.nameToNote,
            },
          ]}
          numberOfLines={postLines.hubNote}
        >
          {hub.landmark}
        </Text>
      </View>

      {selected ? (
        <CheckIcon
          size={postSize.hub.check}
          stroke={postIcon.check.stroke}
          color={postColor.forest}
        />
      ) : (
        <CheckboxIcon
          size={postSize.hub.checkbox}
          stroke={postSize.hub.checkboxBorder}
          color={postColor.lineStrong}
        />
      )}
    </Tappable>
  );
}

/** Five rows of the real geometry, so the list does not jump when it lands. */
function HubSkeleton({ board }: { board: Board }) {
  return (
    <View>
      <View style={{ height: 1, backgroundColor: postColor.divider }} />
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={{
            height: postSize.hub.row,
            paddingHorizontal: board.hubX,
            justifyContent: "center",
            borderBottomWidth: 1,
            borderBottomColor: postColor.divider,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: postSpace.hubs.nameGap }}>
            <Skeleton width={148} height={15} />
            <Skeleton width={54} height={10} tone="soft" />
          </View>
          <View style={{ marginTop: postSpace.hubs.nameToNote }}>
            <Skeleton width={196} height={12} tone="soft" />
          </View>
        </View>
      ))}
    </View>
  );
}
