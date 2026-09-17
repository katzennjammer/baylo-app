import { Image } from "expo-image";
import { Text, View } from "react-native";

import { ImageIcon } from "../icons";
import { Tappable } from "../Tappable";
import { Radio } from "./rows";
import { useOfferBoard } from "./chrome";
import {
  offerBorder,
  offerColor,
  offerRadius,
  offerSize,
  offerType,
  textStyle,
} from "../../theme/offer-tokens";

/**
 * §4's item picker row: a 60px photo, a 12 gap, a text stack and a 22px radio,
 * on an 84px row with 12 of padding above and below.
 *
 * 60 + 12 + 12 = 84 exactly, which is why the photo is the row's height rather
 * than the row being sized independently — the two cannot drift.
 *
 * ── SELECTABLE, OR GREYED WITH A REASON ─────────────────────────────────────
 *
 * The picker's job is "which of my things is within a bracket of theirs". A
 * row that is not — two or more brackets away in either direction, unvalued,
 * or already promised to another trade — stays VISIBLE and greyed, with one
 * short line saying why. Hiding it would read as "that item is gone"; greying
 * it without a reason would read as broken. The reason is the second line in
 * place of the bracket, so the row's shape never changes.
 *
 * Greyed rows are not tappable and say so to the accessibility layer, rather
 * than accepting a tap that the send would then refuse.
 */
export function PickerRow({
  title,
  image,
  meta,
  reason,
  selected,
  onPress,
}: {
  title: string;
  image: string | null;
  /** The mono line under the title when the row is selectable: `Bracket 3 · 300 Leaves`. */
  meta: string;
  /** Non-null greys the row and replaces `meta` with this short line. */
  reason: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  const board = useOfferBoard();
  const selectable = reason === null;

  return (
    <Tappable
      onPress={selectable ? onPress : undefined}
      disabled={!selectable}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !selectable }}
      accessibilityLabel={selectable ? `${title}, ${meta}` : `${title}. ${reason}`}
      style={{
        height: offerSize.pickerRow.height,
        borderRadius: offerRadius.row,
        borderWidth: selected ? offerBorder.selected : offerBorder.rule,
        borderColor: selected ? offerColor.selected : offerColor.rule,
        backgroundColor: selected ? offerColor.tintGreen : offerColor.paper,
        // The border eats into the 84 when it is 1.5 rather than 1, so the
        // padding is stated and the photo takes the remainder. 12/12 either way.
        paddingVertical: offerSize.pickerRow.padY,
        paddingHorizontal: offerSize.settleRow.padX,
        flexDirection: "row",
        alignItems: "center",
        gap: offerSize.pickerRow.gap,
      }}
      pressedStyle={selectable ? { backgroundColor: offerColor.quiet } : undefined}
    >
      <View
        style={{
          width: board.pickerPhoto,
          height: board.pickerPhoto,
          borderRadius: offerRadius.thumbnail,
          backgroundColor: offerColor.photoPlaceholder,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          // Dimmed, not §1.9's grayscale: that filter is the grid's reach
          // signal and reusing it here would say something about reach, which
          // this is not — this is "not for this listing".
          opacity: selectable ? 1 : 0.55,
        }}
      >
        {image ? (
          <Image
            source={{ uri: image }}
            contentFit="cover"
            style={{ width: "100%", height: "100%" }}
            transition={120}
          />
        ) : (
          <ImageIcon size={22} stroke={1.5} color={offerColor.inkDisabled} />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={[
            textStyle(offerType.itemTitleRow),
            { color: selectable ? offerColor.ink : offerColor.inkTertiary },
          ]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {selectable ? (
          <Text
            style={[
              textStyle(offerType.leavesRow),
              { color: offerColor.inkSecondary, marginTop: 4 },
            ]}
          >
            {meta}
          </Text>
        ) : (
          <Text
            style={[
              textStyle(offerType.footnoteMono),
              { color: offerColor.inkTertiary, marginTop: 4 },
            ]}
          >
            {reason}
          </Text>
        )}
      </View>

      {selectable ? <Radio selected={selected} size={offerSize.pickerRow.radio} /> : null}
    </Tappable>
  );
}
