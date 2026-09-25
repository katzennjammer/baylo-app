import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { CloseIcon, FilterIcon, GridIcon, PinIcon, SearchIcon } from "../icons";
import { Tappable } from "../Tappable";
import {
  border,
  color,
  icon,
  radius,
  size,
  space,
  textStyle,
  type,
} from "../../theme/tokens";

/**
 * The search row and the category rail — everything above the grid.
 *
 * ON THE PLACEHOLDER TEXT. It reads "Search items", not "Search by title".
 * The server's `q` matches title OR DESCRIPTION, and a placeholder promising
 * titles would make a correct result look like a bug the first time a match
 * came from the body of a description. The field is labelled for what it does.
 */

export function SearchField({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View style={s.field}>
      <SearchIcon size={icon.search.size} stroke={icon.search.stroke} color={color.inkMuted} />

      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        // "search" puts a magnifier on the return key instead of a newline, and
        // `returnKeyType` is the only part of this a user ever sees.
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Search items"
        placeholderTextColor={color.inkMuted}
        style={[textStyle(type.searchInput), s.input]}
        accessibilityLabel="Search items by title or description"
      />

      {value.length > 0 ? (
        <Tappable
          onPress={() => onChange("")}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          // 44 wide, pulled into the field's own padding so the glyph sits
          // where the eye expects while the target stays full size.
          style={s.clear}
          hitSlop={8}
        >
          <CloseIcon size={icon.clear.size} stroke={icon.clear.stroke} color={color.inkMuted} />
        </Tappable>
      ) : null}
    </View>
  );
}

/** Opens the filter sheet. Carries a count when anything is set. */
export function FilterButton({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Filters, ${count} active` : "Filters"}
      style={[s.filterButton, count > 0 && s.filterButtonActive]}
      pressedStyle={s.filterButtonPressed}
    >
      <FilterIcon
        size={icon.filter.size}
        stroke={icon.filter.stroke}
        color={count > 0 ? color.forest : color.inkSecondary}
      />
      {count > 0 ? (
        <Text style={[textStyle(type.gridLeaves), { color: color.forest }]}>{count}</Text>
      ) : null}
    </Tappable>
  );
}

/**
 * The category rail.
 *
 * FED FROM THE SERVER'S FACETS, not from a hardcoded copy of the enum. Two
 * reasons, and the second is the one that matters: the labels stay whatever the
 * server says they are (CLOTHING reads "Fashion", and the app has no business
 * deciding that), and a category with nothing visible in it never appears — a
 * chip that leads to an empty grid is a worse control than a chip that is not
 * there. The server computes facets UNFILTERED on purpose, so they do not
 * vanish as you use them.
 *
 * MULTI-SELECT, capped by the server at five. Tapping a selected chip clears
 * it, which is the only affordance a chip row needs.
 */
export function CategoryRail({
  facets,
  selected,
  onToggle,
  max,
  orgsOnly,
  onToggleOrgs,
}: {
  facets: { category: string; label: string; count: number }[];
  selected: readonly string[];
  onToggle: (category: string) => void;
  max: number;
  /** The Organizations pill's state. See the note on its chip below. */
  orgsOnly: boolean;
  onToggleOrgs: () => void;
}) {
  // The org pill survives an empty facet list, which the categories do not.
  // Facets are "categories with something visible in them", so an empty rail
  // means an empty marketplace -- but "show me organisations" is still a
  // question worth being able to ask, and hiding the only control that answers
  // it is how a filter becomes undiscoverable.
  if (facets.length === 0 && !orgsOnly) return null;

  const atCap = selected.length >= max;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.rail}
      // Chips are 36 tall inside a 44 row; the extra is the touch target.
      style={s.railOuter}
    >
      {/*
        FIRST IN THE RAIL, AND NOT SORTED IN AMONG THE CATEGORIES. It is a
        different KIND of filter -- a fact about the poster rather than about
        the item -- and putting it at the head is what keeps it from reading as
        a twenty-first category. It carries no count, for the same reason: the
        facet counts come from the category groupBy, and inventing a number
        here would mean a second aggregate on every browse request to answer a
        question the pill does not need answered.

        It also does NOT respect `atCap`: the cap is five CATEGORIES, and this
        is not one of them. A user with five categories chosen must still be
        able to narrow those five to organisations.
      */}
      <Tappable
        onPress={onToggleOrgs}
        accessibilityRole="button"
        accessibilityState={{ selected: orgsOnly }}
        accessibilityLabel="Organizations only"
        style={[s.chip, orgsOnly && s.chipOn]}
        pressedStyle={s.chipPressed}
      >
        <Text
          style={[
            textStyle(type.trendingChip),
            { color: orgsOnly ? color.onGreen : color.inkSecondary },
          ]}
        >
          Organizations
        </Text>
      </Tappable>

      {facets.map((f) => {
        const on = selected.includes(f.category);
        // A chip that cannot be selected because the cap is reached is dimmed
        // rather than hidden — vanishing chips would make the rail reflow under
        // the user's finger the moment they picked a fifth.
        const blocked = !on && atCap;

        return (
          <Tappable
            key={f.category}
            onPress={() => onToggle(f.category)}
            disabled={blocked}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled: blocked }}
            accessibilityLabel={`${f.label}, ${f.count} items`}
            style={[s.chip, on && s.chipOn, blocked && s.chipBlocked]}
            pressedStyle={s.chipPressed}
          >
            <Text
              style={[
                textStyle(type.trendingChip),
                { color: on ? color.onGreen : blocked ? color.inkStale : color.inkSecondary },
              ]}
            >
              {f.label}
            </Text>
          </Tappable>
        );
      })}
    </ScrollView>
  );
}

/**
 * The second rail, under the first while the Organizations pill is on: what
 * KIND of shop. Sari-sari store, Apparel, Food & beverage...
 *
 * FROM THE SERVER'S FACETS, like the category rail and for the same reason --
 * a category only appears when some shop in it has something available, so no
 * chip leads to an empty grid, and a kind of shop nobody runs yet never shows.
 *
 * Styled a step quieter than the rail above (a green wash when on, not a solid
 * green) because it REFINES the pill rather than standing beside it. It sits
 * under Organizations and only exists while that is on; turning the pill off
 * clears these too, since a shop category without "organisations only" is a
 * filter the server refuses.
 */
export function BusinessCategoryRail({
  facets,
  selected,
  onToggle,
}: {
  facets: { businessCategory: string; label: string; count: number }[];
  selected: readonly string[];
  onToggle: (businessCategory: string) => void;
}) {
  if (facets.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.rail}
      style={s.railOuter}
      accessibilityLabel="Kind of shop"
    >
      <Text style={[textStyle(type.photoCaption), { color: color.inkMuted }]}>Shop type</Text>
      {facets.map((f) => {
        const on = selected.includes(f.businessCategory);
        return (
          <Tappable
            key={f.businessCategory}
            onPress={() => onToggle(f.businessCategory)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${f.label}, ${f.count} ${f.count === 1 ? "shop" : "shops"}`}
            style={[s.chip, s.subChip, on && s.subChipOn]}
            pressedStyle={s.chipPressed}
          >
            <Text
              style={[
                textStyle(type.trendingChip),
                { color: on ? color.forest : color.inkSecondary },
              ]}
            >
              {f.label}
            </Text>
          </Tappable>
        );
      })}
    </ScrollView>
  );
}

/* ─────────────────────────── grid ⇄ map ─────────────────────────────── */

export type BrowseView = "grid" | "map";

/**
 * The two ways to look at the marketplace.
 *
 * ── THE FILTERS DO NOT APPLY TO THE MAP, AND THE SCREEN SAYS SO BY HIDING THEM
 *
 * Worth stating here because the toggle is what makes it visible: the search
 * box, the category rail and the filter sheet all narrow ITEMS. The map pins
 * HUBS, which come from a different endpoint that takes none of those
 * parameters — GET /api/v1/hubs accepts `city` and `type` and nothing else.
 *
 * Leaving the item controls on screen in map mode would be a promise the map
 * cannot keep: somebody types "bicycle", sees 22 pins unchanged, and reasonably
 * concludes the search is broken. The marketplace screen therefore swaps them
 * out rather than disabling them, because a greyed-out search box is still an
 * invitation to wonder why.
 */
export function ViewToggle({
  view,
  onChange,
}: {
  view: BrowseView;
  onChange: (next: BrowseView) => void;
}) {
  return (
    <View
      style={s.toggle}
      accessibilityRole="tablist"
      accessibilityLabel="Show listings as a grid or on a map"
    >
      <ToggleSegment
        label="Grid"
        selected={view === "grid"}
        onPress={() => onChange("grid")}
        glyph={
          <GridIcon
            size={icon.filter.size - 2}
            stroke={icon.filter.stroke}
            color={view === "grid" ? color.onGreen : color.inkSecondary}
          />
        }
      />
      <ToggleSegment
        label="Map"
        selected={view === "map"}
        onPress={() => onChange("map")}
        glyph={
          <PinIcon
            size={icon.filter.size - 2}
            stroke={icon.filter.stroke}
            color={view === "map" ? color.onGreen : color.inkSecondary}
          />
        }
      />
    </View>
  );
}

function ToggleSegment({
  label,
  glyph,
  selected,
  onPress,
}: {
  label: string;
  glyph: React.ReactNode;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[s.segment, selected && s.segmentOn]}
      pressedStyle={s.segmentPressed}
    >
      {glyph}
      <Text
        style={[
          textStyle(type.chip),
          { color: selected ? color.onGreen : color.inkSecondary },
        ]}
      >
        {label}
      </Text>
    </Tappable>
  );
}

const s = StyleSheet.create({
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.browse.searchGap,
    height: size.browse.searchField,
    paddingLeft: space.browse.searchGap + 4,
    paddingRight: 4,
    borderRadius: radius.searchField,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    backgroundColor: color.control,
  },
  // `padding: 0` because Android's TextInput carries its own and would push the
  // text off the vertical centre of a fixed-height field.
  input: { flex: 1, padding: 0, color: color.ink },
  clear: {
    width: size.browse.searchField,
    height: size.browse.searchField,
    alignItems: "center",
    justifyContent: "center",
  },

  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: size.browse.filterButton,
    paddingHorizontal: 13,
    borderRadius: radius.filterButton,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    backgroundColor: color.control,
  },
  filterButtonActive: { borderColor: color.greenLine, backgroundColor: color.greenWash },
  filterButtonPressed: { opacity: 0.75 },

  railOuter: { flexGrow: 0 },
  rail: {
    paddingHorizontal: space.screenX,
    gap: space.browse.chipGap,
    alignItems: "center",
  },
  chip: {
    height: size.browse.chip,
    paddingHorizontal: size.browse.chipX,
    borderRadius: radius.trendingChip,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    backgroundColor: color.control,
    alignItems: "center",
    justifyContent: "center",
  },
  chipOn: { backgroundColor: color.green, borderColor: "transparent" },
  chipBlocked: { opacity: 0.5 },
  subChip: { height: size.browse.chip - 6 },
  subChipOn: { backgroundColor: color.greenWash, borderColor: color.forest },
  chipPressed: { opacity: 0.75 },

  toggle: {
    flexDirection: "row",
    gap: 3,
    padding: 3,
    borderRadius: radius.filterButton,
    backgroundColor: color.control,
    borderWidth: border.chip,
    borderColor: color.controlLine,
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: size.browse.chip - 8,
    paddingHorizontal: 11,
    borderRadius: radius.filterButton - 3,
  },
  segmentOn: { backgroundColor: color.green },
  segmentPressed: { opacity: 0.75 },
});
