import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CheckIcon } from "../icons";
import { Tappable } from "../Tappable";
import {
  dColor,
  font,
  icon,
  marketplaceUi,
  textStyle,
  type,
} from "../../theme/tokens";
import { CONDITIONS, MAX_CATEGORIES, type BrowseFilters } from "../../api/browse";
import { BRACKET_COUNT, bracketOf, bracketRange, type Bracket } from "../../lib/brackets";
import { Button } from "../ui/Button";

/**
 * Category, condition and value bracket, in a sheet.
 *
 * ── IT EDITS A DRAFT ────────────────────────────────────────────────────────
 *
 * Nothing here touches the live filters until Apply. The sheet holds its own
 * copy, seeded from the current filters each time it opens, and Cancel throws
 * it away. That is the difference between a control panel and a slot machine:
 * live-applying a range as somebody narrows it fires a query per tap, most of
 * them for ranges they never meant.
 *
 * The category RAIL outside the sheet is the opposite — one tap, applied
 * immediately — and the two are not inconsistent. A chip is a single complete
 * decision; a range is not complete until the person stops adjusting it.
 *
 * ── THE RANGE IS IN BRACKETS, NOT LEAVES ────────────────────────────────────
 *
 * Other people's listings show a bracket, not a figure (`src/lib/brackets.ts`),
 * so a "Min Leaves / Max Leaves" pair of number fields would be asking for a
 * unit the results never display — and would let somebody bisect a listing's
 * exact value by narrowing the range until it dropped out. Two rows of bracket
 * chips instead: pick a lowest, pick a highest. Nothing typed.
 *
 * THE WIRE IS UNCHANGED. `/api/v1/browse` still takes `minLeaves`/`maxLeaves`;
 * Apply converts the chosen brackets to their Leaf bounds, and reopening
 * converts the live bounds back to brackets with `bracketOf`, so a range set by
 * any older build still reads correctly here. An inverted pair cannot be
 * built: tapping a lowest above the highest drags the highest with it.
 */

export function FilterSheet({
  visible,
  filters,
  facets,
  onApply,
  onClose,
}: {
  visible: boolean;
  filters: BrowseFilters;
  facets: { category: string; label: string; count: number }[];
  onApply: (next: BrowseFilters) => void;
  onClose: () => void;
}) {
  const [categories, setCategories] = useState<string[]>([]);
  const [condition, setCondition] = useState<string | null>(null);
  /** Lowest and highest bracket, or null for "no bound on that side". */
  const [minBracket, setMinBracket] = useState<Bracket | null>(null);
  const [maxBracket, setMaxBracket] = useState<Bracket | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Reseed on each open. Without the `visible` dependency the draft would keep
  // whatever the last session left in it, so reopening after a Cancel would
  // show the discarded edits as though they had been applied.
  useEffect(() => {
    if (!visible) return;
    setShowAllCategories(false);
    setCategories([...(filters.categories ?? [])]);
    setCondition(filters.condition ?? null);
    setMinBracket(filters.minLeaves != null ? bracketOf(filters.minLeaves) : null);
    setMaxBracket(filters.maxLeaves != null ? bracketOf(filters.maxLeaves) : null);
  }, [visible, filters]);

  const apply = () => {
    onApply({
      // `q` is owned by the search field, not by this sheet. Carrying it
      // through unchanged is what stops Apply from clearing the search box.
      q: filters.q,
      // Same for the Organizations pill and the shop-type chips under it:
      // they live on the rail, and Apply used to switch the pill off.
      orgsOnly: filters.orgsOnly,
      businessCategories: filters.businessCategories,
      // And perishable, which has no control here at all: it only arrives
      // from the search helper, and Apply must not quietly drop it.
      perishable: filters.perishable,
      categories,
      condition,
      // The bracket's own bounds, so the server's inclusive range covers
      // exactly the brackets chosen. The open top has no ceiling to send.
      minLeaves: minBracket !== null ? bracketRange(minBracket).min : null,
      maxLeaves: maxBracket !== null ? bracketRange(maxBracket).max : null,
    });
  };

  const clearAll = () => {
    setCategories([]);
    setCondition(null);
    setMinBracket(null);
    setMaxBracket(null);
  };

  // Tapping the selected chip clears that side. A lowest above the current
  // highest drags the highest up to it, and the reverse, so the pair can
  // never invert — which is the 400 the server would otherwise answer.
  const pickMin = (b: Bracket) => {
    if (minBracket === b) return setMinBracket(null);
    setMinBracket(b);
    if (maxBracket !== null && maxBracket < b) setMaxBracket(b);
  };
  const pickMax = (b: Bracket) => {
    if (maxBracket === b) return setMaxBracket(null);
    setMaxBracket(b);
    if (minBracket !== null && minBracket > b) setMinBracket(b);
  };

  const toggleCategory = (c: string) =>
    setCategories((prev) =>
      prev.includes(c)
        ? prev.filter((x) => x !== c)
        : prev.length >= MAX_CATEGORIES
          ? prev
          : [...prev, c],
    );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      // Android's hardware back button reaches onRequestClose; without it the
      // sheet would trap the user until they found Cancel.
      statusBarTranslucent
    >
      {/* The scrim is a plain Pressable: it has no held state to draw, so
          Tappable would be ceremony. Tapping it is the same as Cancel. */}
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close filters" />

      <View style={s.sheet}>
        <View style={s.handle} />

        <View style={s.header}>
          <Text style={s.title}>Filters</Text>
          <Tappable
            onPress={clearAll}
            accessibilityRole="button"
            style={s.clearAll}
            pressedStyle={s.clearAllPressed}
          >
            <Text style={s.clearAllLabel}>Clear all</Text>
          </Tappable>
        </View>

        <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
          {/* ── category ── */}
          <View style={s.group}>
            <Text style={[textStyle(type.sheetLabel), s.label]}>
              Category
              <Text style={[textStyle(type.gridMeta), { color: dColor.mutedText }]}>
                {`   up to ${MAX_CATEGORIES}`}
              </Text>
            </Text>

            <View style={s.options}>
              {(showAllCategories ? facets : facets.slice(0, marketplaceUi.size.initialCategories)).map((f) => {
                const on = categories.includes(f.category);
                const blockedChip = !on && categories.length >= MAX_CATEGORIES;
                return (
                  <Option
                    key={f.category}
                    label={f.label}
                    selected={on}
                    disabled={blockedChip}
                    showCheck
                    onPress={() => toggleCategory(f.category)}
                  />
                );
              })}
            </View>
            {facets.length > marketplaceUi.size.initialCategories ? (
              <Tappable
                onPress={() => setShowAllCategories((previous) => !previous)}
                accessibilityRole="button"
                accessibilityLabel={
                  showAllCategories ? "Show fewer categories" : `Show all ${facets.length} categories`
                }
                style={s.showAll}
              >
                <Text style={s.showAllLabel}>
                  {showAllCategories ? "Show fewer" : `Show all ${facets.length}`}
                </Text>
              </Tappable>
            ) : null}
          </View>

          {/* ── condition ── */}
          <View style={s.group}>
            <Text style={[textStyle(type.sheetLabel), s.label]}>Condition</Text>
            <View style={s.conditionSegments}>
              {CONDITIONS.map((c) => (
                <Tappable
                  key={c.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: condition === c.value }}
                  accessibilityLabel={c.label}
                  style={[s.conditionSegment, condition === c.value && s.conditionSegmentOn]}
                  // Tapping the selected one clears it. The server takes a
                  // single condition, so there is no "all" value to send —
                  // absence IS all, and that is what null means here.
                  onPress={() => setCondition((prev) => (prev === c.value ? null : c.value))}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[s.conditionLabel, condition === c.value && s.conditionLabelOn]}
                  >
                    {c.label}
                  </Text>
                </Tappable>
              ))}
            </View>
          </View>

          {/* ── value bracket ── */}
          <View style={s.group}>
            <Text style={[textStyle(type.sheetLabel), s.label]}>
              Lowest bracket
              <Text style={[textStyle(type.gridMeta), { color: dColor.mutedText }]}>
                {"   1 is the smallest"}
              </Text>
            </Text>
            <BracketRail
              prefix="min"
              selected={minBracket}
              onPick={pickMin}
            />
          </View>

          <View style={s.group}>
            <Text style={[textStyle(type.sheetLabel), s.label]}>Highest bracket</Text>
            <BracketRail
              prefix="max"
              selected={maxBracket}
              onPick={pickMax}
            />

            {/*
              Said plainly because the server's behaviour is not guessable: a
              range EXCLUDES listings with no value at all, rather than treating
              them as bracket 1. An unpriced item is not an item worth nothing.
            */}
            <Text style={[textStyle(type.gridMeta), s.note]}>
              Listings with no value set are hidden while a bracket range is on.
            </Text>
          </View>
        </ScrollView>

        <View style={s.actions}>
          <Button label="Show results" onPress={apply} style={s.primary} />
        </View>
      </View>
    </Modal>
  );
}

function Option({
  label,
  selected,
  disabled = false,
  showCheck = false,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  showCheck?: boolean;
  onPress: () => void;
}) {
  return (
    <Tappable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={[s.option, selected && s.optionOn, disabled && s.optionBlocked]}
      pressedStyle={s.optionPressed}
    >
      {showCheck && selected ? (
        <CheckIcon size={icon.check.size} stroke={icon.check.stroke} color={dColor.primaryText} />
      ) : null}
      <Text
        style={[
          textStyle(type.chip),
          { color: selected ? dColor.primaryText : disabled ? dColor.mutedText : dColor.text },
        ]}
      >
        {label}
      </Text>
    </Tappable>
  );
}

function BracketRail({
  prefix,
  selected,
  onPick,
}: {
  prefix: string;
  selected: Bracket | null;
  onPick: (bracket: Bracket) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.bracketRail}
      accessibilityLabel={`${prefix === "min" ? "Lowest" : "Highest"} value brackets`}
    >
      {BRACKETS.map((bracket) => (
        <Tappable
          key={`${prefix}-${bracket}`}
          onPress={() => onPick(bracket)}
          accessibilityRole="button"
          accessibilityState={{ selected: selected === bracket }}
          accessibilityLabel={`Bracket ${bracket}`}
          style={[s.bracket, selected === bracket && s.bracketOn]}
          pressedStyle={s.optionPressed}
        >
          <Text style={[s.bracketLabel, selected === bracket && s.bracketLabelOn]}>
            {bracket}
          </Text>
        </Tappable>
      ))}
    </ScrollView>
  );
}

/** 1..BRACKET_COUNT, once. */
const BRACKETS: readonly Bracket[] = Array.from({ length: BRACKET_COUNT }, (_, i) => i + 1);

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: dColor.captionFill },
  sheet: {
    backgroundColor: dColor.surface,
    borderTopLeftRadius: marketplaceUi.radius.sheet,
    borderTopRightRadius: marketplaceUi.radius.sheet,
    paddingTop: marketplaceUi.space.sheetTop,
    maxHeight: "85%",
  },
  handle: {
    alignSelf: "center",
    width: marketplaceUi.size.sheetHandleWidth,
    height: marketplaceUi.size.sheetHandleHeight,
    borderRadius: marketplaceUi.size.sheetHandleHeight / 2,
    backgroundColor: dColor.border,
  },
  header: {
    marginTop: marketplaceUi.space.sheetTop,
    paddingHorizontal: marketplaceUi.space.sheetX,
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: font.figtreeBold,
    fontSize: marketplaceUi.type.sheetTitle,
    lineHeight: 26,
    color: dColor.text,
  },
  clearAll: { minHeight: 36, justifyContent: "center", paddingHorizontal: 4 },
  clearAllPressed: { opacity: 0.7 },
  clearAllLabel: {
    fontFamily: font.figtreeMedium,
    fontSize: 14,
    color: dColor.primary,
  },

  body: { flexShrink: 1, marginTop: marketplaceUi.space.titleToBody },
  bodyContent: { paddingHorizontal: marketplaceUi.space.sheetX, paddingBottom: marketplaceUi.space.groupGap },

  group: { marginBottom: marketplaceUi.space.groupGap },
  label: { color: dColor.text },
  options: {
    marginTop: marketplaceUi.space.labelToOptions,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: marketplaceUi.space.optionGap,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: marketplaceUi.size.chipHeight,
    paddingHorizontal: marketplaceUi.space.chipX,
    borderRadius: marketplaceUi.radius.chip,
    borderWidth: 1,
    borderColor: dColor.border,
    backgroundColor: dColor.surface,
  },
  optionOn: { backgroundColor: dColor.primary, borderColor: dColor.primary },
  optionBlocked: { opacity: 0.5 },
  optionPressed: { opacity: 0.75 },

  showAll: { alignSelf: "flex-start", marginTop: marketplaceUi.space.labelToOptions, minHeight: 32, justifyContent: "center" },
  showAllLabel: { fontFamily: font.figtreeMedium, color: dColor.primary, fontSize: 14 },
  conditionSegments: {
    marginTop: marketplaceUi.space.labelToOptions,
    minHeight: marketplaceUi.size.conditionHeight,
    flexDirection: "row",
    borderRadius: marketplaceUi.radius.control,
    borderWidth: 1,
    borderColor: dColor.border,
    overflow: "hidden",
  },
  conditionSegment: {
    flex: 1,
    minWidth: 0,
    height: marketplaceUi.size.conditionHeight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  conditionSegmentOn: { backgroundColor: dColor.primary },
  conditionLabel: {
    fontFamily: font.figtreeMedium,
    fontSize: marketplaceUi.type.conditionLabel,
    color: dColor.mutedText,
  },
  conditionLabelOn: { color: dColor.primaryText },
  bracketRail: {
    marginTop: marketplaceUi.space.labelToOptions,
    gap: marketplaceUi.space.bracketGap,
  },
  bracket: {
    width: marketplaceUi.size.bracketSize,
    height: marketplaceUi.size.bracketSize,
    borderRadius: marketplaceUi.radius.bracket,
    borderWidth: 1,
    borderColor: dColor.border,
    backgroundColor: dColor.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  bracketOn: { backgroundColor: dColor.primary, borderColor: dColor.primary },
  bracketLabel: { fontFamily: font.figtreeMedium, fontSize: 13, color: dColor.text },
  bracketLabelOn: { color: dColor.primaryText },
  note: { marginTop: 8, color: dColor.mutedText },

  actions: {
    paddingHorizontal: marketplaceUi.space.sheetX,
    paddingTop: marketplaceUi.space.footerTop,
    paddingBottom: marketplaceUi.space.footerBottom,
    borderTopWidth: 1,
    borderTopColor: dColor.border,
  },
  primary: { height: marketplaceUi.size.sheetFooterButton, minHeight: marketplaceUi.size.sheetFooterButton },
});
