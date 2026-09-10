import { Image } from "expo-image";
import { Text, View } from "react-native";

import { ImageIcon } from "../icons";
import { Tappable } from "../Tappable";
import { Radio } from "./rows";
import { useOfferBoard } from "./chrome";
import { grouped } from "../../lib/gap";
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
 * ── THE VALUE LINE IS THE ROW'S SUBJECT ─────────────────────────────────────
 *
 * The picker's job is "which of my things is worth about what theirs is worth",
 * so the mono figure is the second line and nothing else competes for it — no
 * condition, no category, no date. §12 records Direction B's version of this
 * row, which drew each item as a mini-column against theirs with `440 · reaches
 * 92%`; that is not built and the percentage is not shown here.
 */
export function PickerRow({
  title,
  image,
  valueLeaves,
  selected,
  multi,
  onPress,
  unvaluedNote,
}: {
  title: string;
  image: string | null;
  /** Null means the value did not load. See the note on `PickerItem`. */
  valueLeaves: number | null;
  selected: boolean;
  /** Checkbox semantics instead of radio. See the note in `OfferSheet.tsx`. */
  multi: boolean;
  onPress: () => void;
  /** What stands in for the figure when there is none. */
  unvaluedNote: string;
}) {
  const board = useOfferBoard();
  const selectable = valueLeaves !== null;

  return (
    <Tappable
      onPress={selectable ? onPress : undefined}
      disabled={!selectable}
      accessibilityRole={multi ? "checkbox" : "radio"}
      accessibilityState={{ selected, disabled: !selectable }}
      accessibilityLabel={
        selectable ? `${title}, ${grouped(valueLeaves)} Leaves` : `${title}. ${unvaluedNote}`
      }
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
          // An unvalued item is dimmed rather than greyed. §1.9's grayscale is
          // the reach signal and reusing it here would say something about
          // reach, which this is not — this is "we do not know its value".
          opacity: selectable ? 1 : 0.6,
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
            { color: selectable ? offerColor.ink : offerColor.inkSecondary },
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
            {grouped(valueLeaves)} Leaves
          </Text>
        ) : (
          <Text
            style={[
              textStyle(offerType.footnoteMono),
              { color: offerColor.inkTertiary, marginTop: 4 },
            ]}
          >
            {unvaluedNote}
          </Text>
        )}
      </View>

      {selectable ? <Radio selected={selected} size={offerSize.pickerRow.radio} /> : null}
    </Tappable>
  );
}
