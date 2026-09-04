import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GridIcon, HomeIcon, PersonIcon, PlusIcon, SwapIcon, type IconProps } from "./icons";
import {
  border,
  color,
  icon,
  radius,
  shadow,
  size,
  space,
  textStyle,
  type,
} from "../theme/tokens";

/**
 * The bottom bar, drawn rather than configured.
 *
 * WHY A CUSTOM BAR. react-navigation's own bar owns its paddings, its icon box
 * and the vertical relationship between icon and label, and none of those are
 * exposed as the numbers the spec states — a 56 px item row, 8 above it, a
 * 22 px safe floor, and a 58 px circle that overhangs the bar's top edge by
 * exactly 20. Configuring around that is a stack of magic offsets that drift
 * with every navigation release; drawing it is five flex children and the
 * numbers straight from `tokens`.
 *
 * ACTIVE IS A STROKE WEIGHT, NOT A DIFFERENT GLYPH. 22 px at 1.9 selected,
 * 22 px at 1.6 not, with the label's weight moving 600/500 alongside it. This
 * is the single most characteristic thing about Direction 1's chrome and it is
 * the thing an icon font cannot do — see the note at the top of `icons.tsx`.
 *
 * ORDER: Home, Marketplace, Post, Trades, Profile. Messages used to hold the
 * fourth slot and is now a header icon; see AppHeader.
 */

/** The props this bar actually uses out of BottomTabBarProps. See the cast in _layout. */
export interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string; href?: string | null } }>;
  navigation: {
    emit(event: {
      type: "tabPress";
      target: string;
      canPreventDefault: true;
    }): { defaultPrevented: boolean };
    navigate(name: string): void;
  };
}

type Glyph = (props: IconProps) => React.JSX.Element;

/**
 * Route name → glyph and label.
 *
 * The label is here rather than read from each screen's `title` because the bar
 * and the screen want different words: the second tab's screen is Marketplace
 * and its tab says "Market", which is what fits a fifth of a 390 px bar without
 * eliding. A route with no entry here is not drawn — that is what keeps
 * /messages off the bar even if `href: null` stops filtering it upstream.
 */
const TABS: Record<string, { label: string; Glyph: Glyph }> = {
  index: { label: "Home", Glyph: HomeIcon },
  marketplace: { label: "Market", Glyph: GridIcon },
  post: { label: "Post", Glyph: PlusIcon },
  trades: { label: "Trades", Glyph: SwapIcon },
  profile: { label: "Profile", Glyph: PersonIcon },
};

/** The one route whose icon slot is replaced by the raised circle. */
const FAB_ROUTE = "post";

export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // The spec's 22 is a floor, not a constant. A phone with a gesture bar
  // reserves more than that and a phone with hardware keys reserves none;
  // taking the larger keeps the bar off the system affordance without opening
  // a gap above it on the devices that need nothing.
  const bottom = Math.max(insets.bottom, space.tab.bottom);

  return (
    <View style={[s.bar, { paddingBottom: bottom }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab || descriptors[route.key]?.options?.href === null) return null;

        const focused = state.index === index;

        // emit-then-navigate, in that order, because a screen may have
        // registered a tabPress listener that scrolls to top and cancels the
        // navigation. Calling navigate() first would make that listener
        // pointless.
        const onPress = () => {
          // POST IS NOT A TAB SWITCH. The listing wizard owns the whole screen
          // — its own 44 header and 90 footer, on all seven steps — and a tab
          // screen has the app header above it and this bar below it. Both
          // would have to be hidden for the entire flow, which is the same
          // thing as not being a tab. So the FAB pushes the wizard OVER the
          // tabs and closing it returns to whichever tab was underneath, which
          // is also the right answer for "I hit Post by mistake".
          //
          // The route stays registered so the bar keeps its five slots and its
          // centre circle; it is simply never the focused screen.
          if (route.name === FAB_ROUTE) {
            router.push("/post-item");
            return;
          }

          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        const isFab = route.name === FAB_ROUTE;
        const spec = focused ? icon.tabActive : icon.tabInactive;
        const ink = focused ? color.forest : color.inkMuted;

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={isFab ? "Post an item" : tab.label}
            style={s.item}
          >
            {isFab ? <Fab /> : <tab.Glyph size={spec.size} stroke={spec.stroke} color={ink} />}

            <Text
              style={[
                textStyle(focused ? type.tabActive : type.tabInactive),
                { color: ink, marginTop: space.tab.iconToLabel },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The raised centre circle.
 *
 * It is absolutely positioned against the tab ITEM and a 22 px spacer holds its
 * place in the column, rather than the circle being laid out inline. A negative
 * margin would drag the label up with it; this way the label lands exactly
 * where its four neighbours put theirs, which is what the artboard shows — the
 * circle rises, the word does not.
 *
 * IT IS ANCHORED TO THE ITEM, NOT TO THE SPACER, and that distinction is the
 * whole of the "Post" label being clipped. The offset is stated relative to the
 * bar's top edge, and only the item's top edge is a fixed distance from it; the
 * spacer's is wherever the column put it. Measuring from the spacer meant the
 * circle inherited the row's own vertical offset and hung that much lower —
 * 7 px, straight through the top of the word underneath. See `iconTop`.
 *
 * The ring is a surface-coloured disc BEHIND the green one, not a border on it.
 * That way the green stays the specified 58 across and the ring is what
 * interrupts the bar's top rule, which is the effect: the circle reads as
 * sitting in front of the bar rather than as a bump in it.
 *
 * THE HIT AREA IS THE TAB ITEM, NOT THE CIRCLE. The Pressable is the full
 * 56 px-tall item inside the bar, and the circle is a child that happens to
 * stick out of the top of it. That ordering matters on Android, where a touch
 * outside a parent's bounds is not guaranteed to reach a child that overflows
 * it: what someone must be able to hit is a 78 × 56 box that is entirely inside
 * the bar, and the overhanging 20 px of circle is a bonus rather than the
 * target. Hanging the Pressable off the circle instead would look identical and
 * leave a third of the control unreliable.
 *
 * ON ANDROID THE GLOW IS GREY. `shadowColor` is honoured by iOS; Android draws
 * `elevation` in its own shadow colour and ignores the tint below API 28, so
 * the specified green cast is an iOS-only detail. The alternative — faking it
 * with stacked translucent circles — costs three extra views on the busiest
 * screen in the app for a halo most people will never consciously see.
 */
function Fab() {
  return (
    <>
      {/* Holds the column open to exactly one icon's height, so the centre
          item measures the same as its four neighbours and their labels agree
          on a baseline. It draws nothing; the circle is its sibling. */}
      <View style={s.fabSlot} />
      <View style={s.fabRing}>
        <View style={s.fab}>
          <PlusIcon size={icon.fabPlus.size} stroke={icon.fabPlus.stroke} color={color.onGreen} />
        </View>
      </View>
    </>
  );
}

const ringSize = size.control.fab + border.fabRing * 2;

/**
 * How far the ring's bottom edge reaches INTO the bar, measured from the top of
 * a tab item.
 *
 * A tab item starts `space.tab.top` below the bar's top edge, and the ring is
 * pinned that much higher again plus the specified lift, so the circle clears
 * the bar's rule by exactly `fabLift`. What is left of the 66 px ring below
 * that line is this — 34 px with the spec's numbers, which is more than the
 * 22 px icon slot the circle nominally occupies. That overhang is the whole
 * problem the next constant solves.
 */
const ringBottom = ringSize - (size.control.fabLift + space.tab.top + border.fabRing);

/**
 * Where the icon row starts, and why the item is not simply centred.
 *
 * Centring put the label's line box 7 px inside the ring, which is what clipped
 * the word "Post" — and it did it invisibly, because the amount depended on the
 * label font's own line height. So the icon row is positioned from the
 * constraint that actually matters instead: the label under it has to clear the
 * ring by `fabToLabel`, and the label sits `iconToLabel` below an icon that is
 * `tabActive.size` tall. Every tab uses this, not just the centre one, because
 * five labels on five different baselines is a worse bug than the one being
 * fixed.
 *
 * The floor matters if anyone shrinks the circle: once the ring no longer
 * reaches past the icon slot there is nothing to clear, and the row should sit
 * at the top of the item rather than at a negative offset.
 */
const iconTop = Math.max(
  0,
  ringBottom + space.tab.fabToLabel - space.tab.iconToLabel - icon.tabActive.size,
);

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: color.surface,
    borderTopWidth: border.hairline,
    borderTopColor: color.divider,
    paddingTop: space.tab.top,
    // Explicit, because the FAB is drawn outside these bounds and the default
    // is worth stating where something depends on it.
    overflow: "visible",
  },
  item: {
    flex: 1,
    height: space.tab.row,
    alignItems: "center",
    // Not `justifyContent: "center"`. See `iconTop` — where this row starts is
    // decided by the FAB's footprint, not by what is left over.
    paddingTop: iconTop,
  },

  // The same height as a tab icon, so the column measures identically to its
  // four neighbours and the label lands on their baseline.
  fabSlot: {
    width: icon.tabActive.size,
    height: icon.tabActive.size,
  },
  fabRing: {
    position: "absolute",
    // Measured from the ITEM's top edge — which is a fixed `space.tab.top`
    // below the bar's — and NOT from the icon slot. The slot's own position is
    // whatever the column layout gives it, so anchoring to it made the lift
    // drift by however far the row happened to be pushed down.
    top: -(size.control.fabLift + space.tab.top + border.fabRing),
    // Centred by hand rather than by the parent's alignItems, which absolute
    // children only honour when neither edge is pinned. Pinning one is what
    // makes this independent of that.
    left: "50%",
    marginLeft: -ringSize / 2,
    width: ringSize,
    height: ringSize,
    borderRadius: ringSize / 2,
    backgroundColor: color.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    width: size.control.fab,
    height: size.control.fab,
    borderRadius: radius.fab,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.fab,
  },
});
