import { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";

import { CloseIcon, FilterIcon, GridIcon, MapIcon, SearchIcon, StoreIcon } from "../icons";
import { Tappable } from "../Tappable";
import {
  border,
  color,
  dColor,
  font,
  icon,
  marketplaceUi,
  radius,
  size,
  space,
  textStyle,
  type,
} from "../../theme/tokens";

/**
 * The search row and the category rail — everything above the grid.
 *
 * ON THE PLACEHOLDER TEXT. It reads "Search" (1 Oct 2026; it was "Search
 * items"), and never "Search by title": the server's `q` matches title OR
 * DESCRIPTION, and a placeholder promising titles would make a correct result
 * look like a bug the first time a match came from a description. Shortened
 * because the field now shares its row with the Grid/Map toggle, and "Search
 * items" clipped at 320 dp with large text. The screen-reader label keeps the
 * full description.
 */

export function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder = "Search",
  accessibilityLabel = "Search items by title or description",
  variant = "default",
  trailing,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  /** Drawn inside the field at its end -- Home's filter button. */
  trailing?: React.ReactNode;
  /** Map mode searches hubs, not listings, and says so. */
  placeholder?: string;
  accessibilityLabel?: string;
  variant?: "default" | "home" | "marketplace";
}) {
  return (
    <View
      style={[
        s.field,
        variant === "home" && s.homeField,
        variant === "marketplace" && s.marketplaceField,
      ]}
    >
      <SearchIcon
        size={icon.search.size}
        stroke={icon.search.stroke}
        color={variant === "home" ? color.inkSecondary : variant === "marketplace" ? dColor.mutedText : color.inkMuted}
      />

      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        // "search" puts a magnifier on the return key instead of a newline, and
        // `returnKeyType` is the only part of this a user ever sees.
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor={variant === "marketplace" ? dColor.mutedText : color.inkMuted}
        // The field shares its row with the Grid/Map toggle and the filter
        // button, so it is narrower than it was; uncapped, 2x text clips the
        // placeholder hard at 320 dp.
        maxFontSizeMultiplier={size.home.headingMaxFontScale}
        style={[
          textStyle(type.searchInput),
          s.input,
          variant === "home" && s.homeInput,
          variant === "marketplace" && s.marketplaceInput,
        ]}
        accessibilityLabel={accessibilityLabel}
      />

      {value.length > 0 ? (
        <Tappable
          onPress={() => onChange("")}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          // 44 wide, pulled into the field's own padding so the glyph sits
          // where the eye expects while the target stays full size.
          style={[s.clear, variant === "marketplace" && s.marketplaceClear]}
          hitSlop={8}
        >
          <CloseIcon
            size={icon.clear.size}
            stroke={icon.clear.stroke}
            color={variant === "marketplace" ? dColor.mutedText : color.inkMuted}
          />
        </Tappable>
      ) : null}
      {trailing}
    </View>
  );
}

export type SearchMode = "items" | "people";

export function SearchModeToggle({
  mode,
  onChange,
}: {
  mode: SearchMode;
  onChange: (mode: SearchMode) => void;
}) {
  return (
    <View
      style={s.searchModeToggle}
      accessibilityRole="tablist"
      accessibilityLabel="Search items or people"
    >
      {(["items", "people"] as const).map((option) => {
        const selected = mode === option;
        const label = option === "items" ? "Items" : "People";
        return (
          <Tappable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${label} search`}
            style={[s.searchModeSegment, selected && s.searchModeSegmentOn]}
            pressedStyle={s.searchModeSegmentPressed}
          >
            <Text style={[textStyle(type.chip), s.searchModeLabel, selected && s.searchModeLabelOn]}>
              {label}
            </Text>
          </Tappable>
        );
      })}
    </View>
  );
}

/** Opens the filter sheet. Carries a count when anything is set. */
export function FilterButton({
  count,
  onPress,
  variant = "default",
}: {
  count: number;
  onPress: () => void;
  /** "inline" sits inside a search field: no box of its own. */
  variant?: "default" | "home" | "inline";
}) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Filters, ${count} active` : "Filters"}
      style={[
        s.filterButton,
        variant === "home" && s.homeFilter,
        variant === "inline" && s.inlineFilter,
        count > 0 && variant !== "home" && s.filterButtonActive,
      ]}
      pressedStyle={variant === "home" ? s.homeFilterPressed : s.filterButtonPressed}
    >
      <FilterIcon
        size={icon.filter.size}
        stroke={icon.filter.stroke}
        color={count > 0 ? dColor.primary : variant === "home" ? color.homeOnGreen : variant === "inline" ? color.ink : dColor.mutedText}
      />
      {count > 0 ? (
        <View style={s.activeFilterDot} />
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
 *
 * ── THE RAIL, LEFT TO RIGHT (1 Oct 2026) ───────────────────────────────────
 *
 *   Shops only │ All  categories…
 *
 * "All" is lit exactly when no category is chosen, and tapping it clears the
 * categories. It is the rail's default state made visible: without it, "no
 * chip lit" was the only way the rail said "everything", which reads as
 * nothing selected rather than all of it. It leaves "Shops only" alone: that
 * is a different kind of filter, about the poster, not the item.
 *
 * "Shops only" sits FIRST, before a thin divider, and not among the categories
 * for the same reason. It is the old Organizations pill under a clearer name,
 * the same `orgsOnly` filter: listings from shop accounts. It carries no count
 * (inventing one would cost a second aggregate on every browse request) and
 * does NOT respect `atCap`: the cap is five CATEGORIES, and a user with five
 * chosen must still be able to narrow them to shops.
 */
export function CategoryRail({
  facets,
  selected,
  onToggle,
  onClearCategories,
  max,
  orgsOnly,
  onToggleOrgs,
}: {
  facets: { category: string; label: string; count: number }[];
  selected: readonly string[];
  onToggle: (category: string) => void;
  /** "All": clears the chosen categories. */
  onClearCategories: () => void;
  max: number;
  /** "Shops only" -- the `orgsOnly` filter. See the note above. */
  orgsOnly: boolean;
  onToggleOrgs: () => void;
}) {
  const atCap = selected.length >= max;
  const allOn = selected.length === 0;
  const railRef = useRef<ScrollView>(null);
  const chipOffsets = useRef(new Map<string, number>());
  const { width } = useWindowDimensions();
  const selectedKey = selected.length > 0 ? selected[selected.length - 1] : orgsOnly ? "shops" : "all";

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const offset = chipOffsets.current.get(selectedKey);
      if (offset !== undefined) {
        railRef.current?.scrollTo({ x: Math.max(0, offset - space.screenX), animated: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedKey, selected.join("|"), width]);

  const rememberChip = (key: string, x: number) => {
    chipOffsets.current.set(key, x);
    if (key === selectedKey) {
      railRef.current?.scrollTo({ x: Math.max(0, x - space.screenX), animated: true });
    }
  };

  // The shops chip survives an empty facet list, which the categories do not.
  if (facets.length === 0 && !orgsOnly) return null;

  return (
    <ScrollView
      ref={railRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.rail}
      // Chips are 36 tall inside a 44 row; the extra is the touch target.
      style={s.railOuter}
    >
      <Tappable
        onPress={onToggleOrgs}
        accessibilityRole="button"
        accessibilityState={{ selected: orgsOnly }}
        accessibilityLabel="Shops only"
        onLayout={(event) => rememberChip("shops", event.nativeEvent.layout.x)}
        style={[s.categoryChip, s.chipWithIcon, orgsOnly && s.categoryChipOn]}
        pressedStyle={s.chipPressed}
      >
        <StoreIcon
          size={icon.tileBadge.size}
          stroke={icon.tileBadge.stroke}
          color={orgsOnly ? dColor.primaryText : dColor.primary}
        />
        <Text
          style={[s.chipLabel, { color: orgsOnly ? dColor.primaryText : dColor.primary }]}
        >
          Shops only
        </Text>
      </Tappable>

      <View style={s.railDivider} accessible={false} />

      <Tappable
        onPress={onClearCategories}
        accessibilityRole="button"
        accessibilityState={{ selected: allOn }}
        accessibilityLabel="All categories"
        onLayout={(event) => rememberChip("all", event.nativeEvent.layout.x)}
        style={[s.categoryChip, allOn && s.categoryChipOn]}
        pressedStyle={s.chipPressed}
      >
        <Text
          style={[s.chipLabel, { color: allOn ? dColor.primaryText : dColor.primary }]}
        >
          All
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
            onLayout={(event) => rememberChip(f.category, event.nativeEvent.layout.x)}
            style={[s.categoryChip, on && s.categoryChipOn, blocked && s.chipBlocked]}
            pressedStyle={s.chipPressed}
          >
            <Text
              style={[
                s.chipLabel,
                { color: on ? dColor.primaryText : blocked ? dColor.mutedText : dColor.primary },
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
 * The second rail, under the first while "Shops only" is on: what
 * KIND of shop. Sari-sari store, Apparel, Food & beverage...
 *
 * FROM THE SERVER'S FACETS, like the category rail and for the same reason --
 * a category only appears when some shop in it has something available, so no
 * chip leads to an empty grid, and a kind of shop nobody runs yet never shows.
 *
 * Styled a step quieter than the rail above (a green wash when on, not a solid
 * green) because it REFINES the chip rather than standing beside it. It sits
 * under "Shops only" and only exists while that is on; turning the chip off
 * clears these too, since a shop category without `orgsOnly` is a filter the
 * server refuses.
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
      <Text style={[textStyle(type.gridMeta), { color: color.inkMuted }]}>Shop type</Text>
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
  // ICON-ONLY (30 Sep 2026): it shares one row with the search field and the
  // filter button, and at 320 dp the words cost the field its width. The
  // labels stay for screen readers, which is where they were doing the work.
  return (
    <View
      style={s.viewToggle}
      accessibilityRole="tablist"
      accessibilityLabel="Show listings as a grid or on a map"
    >
      <ToggleSegment
        label="Grid view"
        selected={view === "grid"}
        onPress={() => onChange("grid")}
        glyph={
          <GridIcon
            size={icon.filter.size - 2}
            stroke={icon.filter.stroke}
            color={view === "grid" ? dColor.primaryText : dColor.mutedText}
          />
        }
      />
      <ToggleSegment
        label="Map view"
        selected={view === "map"}
        onPress={() => onChange("map")}
        glyph={
          <MapIcon
            size={icon.filter.size - 2}
            stroke={icon.filter.stroke}
            color={view === "map" ? dColor.primaryText : dColor.mutedText}
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
      // The segment is 30 tall; the slop brings the target to the 44 floor.
      hitSlop={7}
      style={[s.viewSegment, selected && s.viewSegmentOn]}
      pressedStyle={s.segmentPressed}
    >
      {glyph}
    </Tappable>
  );
}

/* ─────────────────────────────── sort ──────────────────────────────── */

/**
 * The orders GET /api/v1/browse supports, and which of them this control
 * offers. The API has three (lib/v1/browse-query.ts):
 *
 *   recent    newest first -- the default          -> "Newest"
 *   expiring  soonest trade window first; the server
 *             REQUIRES perishable=true with it     -> "Ending soon"
 *   nearest   by distance; REQUIRES lat and lng     -> not offered yet
 *
 * "Nearest" needs the phone's position, and on this screen position is only
 * ever read by the map's location flow. Wiring the grid to it is its own
 * change, not a line in a sort control.
 */
export type BrowseSort = "newest" | "endingSoon";

export function SortToggle({
  sort,
  onChange,
}: {
  sort: BrowseSort;
  onChange: (next: BrowseSort) => void;
}) {
  const option = (value: BrowseSort, label: string) => {
    const on = sort === value;
    return (
      <Tappable
        key={value}
        onPress={() => onChange(value)}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={label}
        hitSlop={7}
        style={[s.sortSegment, on && s.segmentOn]}
        pressedStyle={s.segmentPressed}
      >
        <Text
          style={[textStyle(type.chip), { color: on ? color.onGreen : color.inkSecondary }]}
          maxFontSizeMultiplier={size.home.headingMaxFontScale}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Tappable>
    );
  };
  return (
    <View style={s.toggle} accessibilityRole="tablist" accessibilityLabel="Sort listings">
      {option("newest", "Newest")}
      {option("endingSoon", "Ending soon")}
    </View>
  );
}

const s = StyleSheet.create({
  // A small pill switch (4 Nov 2026), sharing its row with Grid / Map.
  searchModeToggle: {
    flexDirection: "row",
    alignSelf: "flex-start",
    padding: 3,
    borderRadius: 20,
    backgroundColor: color.control,
  },
  searchModeSegment: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  searchModeSegmentOn: {
    backgroundColor: color.searchSurface,
    shadowColor: "#14140F",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  searchModeSegmentPressed: { opacity: 0.8 },
  searchModeLabel: { color: color.inkSecondary },
  searchModeLabelOn: { color: color.ink, fontWeight: "700" },
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
    borderColor: color.divider,
    backgroundColor: color.searchSurface,
  },
  // `padding: 0` because Android's TextInput carries its own and would push the
  // text off the vertical centre of a fixed-height field.
  input: { flex: 1, padding: 0, color: color.ink },
  // Home's bar: plain white on the green, filters inside it (4 Nov 2026).
  homeField: {
    height: size.home.searchControl,
    borderRadius: size.home.searchControl / 2,
    borderColor: "transparent",
    backgroundColor: color.searchSurface,
    paddingRight: 4,
  },
  homeInput: { color: color.ink },
  // Full width, soft fill, filters inside (4 Nov 2026): the placeholder is
  // never cut by buttons beside it.
  marketplaceField: {
    height: 46,
    borderRadius: 23,
    borderColor: "transparent",
    backgroundColor: color.control,
    borderWidth: 0,
  },
  marketplaceInput: { fontSize: 15 },
  clear: {
    width: size.browse.searchField,
    height: size.browse.searchField,
    alignItems: "center",
    justifyContent: "center",
  },
  marketplaceClear: {
    width: marketplaceUi.size.controlHeight - 4,
    height: marketplaceUi.size.controlHeight - 4,
  },

  inlineFilter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  filterButton: {
    width: marketplaceUi.size.controlHeight,
    height: marketplaceUi.size.controlHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: marketplaceUi.radius.control,
    borderWidth: 1,
    borderColor: dColor.border,
    backgroundColor: dColor.surface,
  },
  filterButtonActive: { borderColor: dColor.primary },
  filterButtonPressed: { opacity: 0.75 },
  activeFilterDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: marketplaceUi.size.activeFilterDot,
    height: marketplaceUi.size.activeFilterDot,
    borderRadius: marketplaceUi.size.activeFilterDot / 2,
    backgroundColor: dColor.primary,
  },
  homeFilter: {
    width: size.home.searchControl,
    height: size.home.searchControl,
    paddingHorizontal: 0,
    justifyContent: "center",
    borderRadius: size.home.searchControl / 2,
    borderColor: color.homeFieldLine,
    backgroundColor: color.homeIconSurface,
  },
  homeFilterPressed: { opacity: 0.75 },

  railOuter: { flexGrow: 0 },
  rail: {
    paddingHorizontal: space.screenX,
    gap: marketplaceUi.space.chipGap,
    alignItems: "center",
  },
  categoryChip: {
    height: marketplaceUi.size.chipHeight,
    paddingHorizontal: marketplaceUi.space.chipX,
    borderRadius: marketplaceUi.radius.chip,
    borderWidth: 1,
    borderColor: dColor.border,
    backgroundColor: dColor.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryChipOn: {
    backgroundColor: dColor.primary,
    borderColor: dColor.primary,
  },
  chipLabel: {
    fontFamily: font.figtreeMedium,
    fontSize: marketplaceUi.type.chip,
    lineHeight: 18,
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
  chipWithIcon: { flexDirection: "row", gap: size.leaves.gap },
  chipBlocked: { opacity: 0.5 },
  // Between the categories and "Shops only": a different kind of filter.
  railDivider: {
    width: border.hairline,
    height: marketplaceUi.space.dividerHeight,
    backgroundColor: color.controlLineStrong,
  },
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
  viewToggle: {
    flexDirection: "row",
    gap: 2,
    padding: 3,
    height: marketplaceUi.size.controlHeight,
    alignItems: "center",
    borderRadius: marketplaceUi.radius.control,
    backgroundColor: dColor.surface,
    borderWidth: 1,
    borderColor: dColor.border,
  },
  // Icon-only: square, so the two segments read as one compact control.
  segment: {
    alignItems: "center",
    justifyContent: "center",
    width: size.browse.chip - 6,
    height: size.browse.chip - 8,
    borderRadius: radius.filterButton - 3,
  },
  viewSegment: {
    alignItems: "center",
    justifyContent: "center",
    width: marketplaceUi.size.controlHeight - 8,
    height: marketplaceUi.size.controlHeight - 8,
    borderRadius: marketplaceUi.radius.control - 3,
  },
  viewSegmentOn: { backgroundColor: dColor.primary },
  sortSegment: {
    alignItems: "center",
    justifyContent: "center",
    height: size.browse.chip - 8,
    paddingHorizontal: 10,
    borderRadius: radius.filterButton - 3,
  },
  segmentOn: { backgroundColor: color.green },
  segmentPressed: { opacity: 0.75 },
});
