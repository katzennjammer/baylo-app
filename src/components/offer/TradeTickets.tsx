import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { sizedImage } from "../../media/image-url";
import { color, textStyle, type } from "../../theme/tokens";
import { SwapIcon } from "../icons";
import { Tappable } from "../Tappable";

/**
 * The trade as two equal tickets: what you give on the left, what you get on
 * the right, a round swap mark between them. The same picture the offer keeps
 * after it is sent, so "what did I offer?" always looks one way.
 *
 * `onChange` puts a Change button on YOUR ticket only; theirs is fixed by the
 * listing you came from.
 */
export function TradeTickets({
  give,
  get,
  onChange,
}: {
  give: { title: string; image: string | null; meta: string };
  get: { title: string; image: string | null; meta: string };
  onChange?: () => void;
}) {
  return (
    <View style={s.row}>
      <Ticket label="YOU GIVE" lit {...give} onChange={onChange} />
      <Ticket label="YOU GET" {...get} />
      <View style={s.swap} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <SwapIcon size={15} stroke={2.2} color={color.surface} />
      </View>
    </View>
  );
}

function Ticket({
  label,
  title,
  image,
  meta,
  lit = false,
  onChange,
}: {
  label: string;
  title: string;
  image: string | null;
  meta: string;
  lit?: boolean;
  onChange?: () => void;
}) {
  return (
    <View style={[s.ticket, lit ? s.ticketLit : null]} accessible accessibilityLabel={`${label.toLowerCase()}: ${title}, ${meta}`}>
      <View style={s.photo}>
        {image ? <Image source={{ uri: sizedImage(image, "card") }} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
      </View>
      <View style={s.copy}>
        <Text style={[s.label, { color: lit ? color.forest : color.inkSecondary }]}>{label}</Text>
        <Text style={[textStyle(type.itemTitle), s.title]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[textStyle(type.gridMeta), { color: color.inkSecondary }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {onChange ? (
        <Tappable onPress={onChange} accessibilityRole="button" accessibilityLabel="Change the item you give" style={s.change}>
          <Text style={s.changeText}>Change</Text>
        </Tappable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  ticket: {
    flex: 1,
    gap: 8,
    padding: 8,
    paddingBottom: 12,
    borderRadius: 18,
    backgroundColor: color.searchSurface,
    borderWidth: 1,
    borderColor: color.controlLine,
  },
  ticketLit: { borderColor: color.green, borderWidth: 1.5 },
  photo: { height: 96, borderRadius: 12, overflow: "hidden", backgroundColor: color.control },
  copy: { paddingHorizontal: 4, gap: 2 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  title: { color: color.ink, fontSize: 14, lineHeight: 18 },
  change: {
    marginHorizontal: 4,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: color.controlLine,
    alignItems: "center",
    justifyContent: "center",
  },
  changeText: { fontSize: 13, fontWeight: "600", color: color.ink },
  swap: {
    position: "absolute",
    left: "50%",
    top: 56,
    width: 42,
    height: 42,
    marginLeft: -21,
    borderRadius: 21,
    backgroundColor: color.ink,
    borderWidth: 4,
    borderColor: color.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});
