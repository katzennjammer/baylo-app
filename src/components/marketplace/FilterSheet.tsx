import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CheckIcon } from "../icons";
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
import { CONDITIONS, MAX_CATEGORIES, type BrowseFilters } from "../../api/browse";
import { BRACKET_COUNT, bracketOf, bracketRange, type Bracket } from "../../lib/brackets";

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

  // Reseed on each open. Without the `visible` dependency the draft would keep
  // whatever the last session left in it, so reopening after a Cancel would
  // show the discarded edits as though they had been applied.
  useEffect(() => {
    if (!visible) return;
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

        <Text style={[textStyle(type.sheetTitle), s.title]}>Filters</Text>

        <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
          {/* ── category ── */}
          <View style={s.group}>
            <Text style={[textStyle(type.sheetLabel), s.label]}>
              Category
              <Text style={[textStyle(type.gridMeta), { color: color.inkMuted }]}>
                {`   up to ${MAX_CATEGORIES}`}
              </Text>
            </Text>

            <View style={s.options}>
              {facets.map((f) => {
                const on = categories.includes(f.category);
                const blockedChip = !on && categories.length >= MAX_CATEGORIES;
                return (
                  <Option
                    key={f.category}
                    label={f.label}
                    selected={on}
                    disabled={blockedChip}
                    onPress={() => toggleCategory(f.category)}
                  />
                );
              })}
            </View>
          </View>

          {/* ── condition ── */}
          <View style={s.group}>
            <Text style={[textStyle(type.sheetLabel), s.label]}>Condition</Text>
            <View style={s.options}>
              {CONDITIONS.map((c) => (
                <Option
                  key={c.value}
                  label={c.label}
                  selected={condition === c.value}
                  // Tapping the selected one clears it. The server takes a
                  // single condition, so there is no "all" value to send —
                  // absence IS all, and that is what null means here.
                  onPress={() => setCondition((prev) => (prev === c.value ? null : c.value))}
                />
              ))}
            </View>
          </View>

          {/* ── value bracket ── */}
          <View style={s.group}>
            <Text style={[textStyle(type.sheetLabel), s.label]}>
              Lowest bracket
              <Text style={[textStyle(type.gridMeta), { color: color.inkMuted }]}>
                {"   1 is the smallest"}
              </Text>
            </Text>
            <View style={s.options}>
              {BRACKETS.map((b) => (
                <Option
                  key={`min-${b}`}
                  label={String(b)}
                  selected={minBracket === b}
                  onPress={() => pickMin(b)}
                />
              ))}
            </View>
          </View>

          <View style={s.group}>
            <Text style={[textStyle(type.sheetLabel), s.label]}>Highest bracket</Text>
            <View style={s.options}>
              {BRACKETS.map((b) => (
                <Option
                  key={`max-${b}`}
                  label={String(b)}
                  selected={maxBracket === b}
                  onPress={() => pickMax(b)}
                />
              ))}
            </View>

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
          <Tappable
            onPress={clearAll}
            accessibilityRole="button"
            style={s.secondary}
            pressedStyle={s.secondaryPressed}
          >
            <Text style={[textStyle(type.secondaryButton), { color: color.inkSecondary }]}>
              Clear all
            </Text>
          </Tappable>

          <Tappable
            onPress={apply}
            accessibilityRole="button"
            style={s.primary}
            pressedStyle={s.primaryPressed}
          >
            <Text style={[textStyle(type.primaryButton), { color: color.onGreen }]}>
              Show results
            </Text>
          </Tappable>
        </View>
      </View>
    </Modal>
  );
}

function Option({
  label,
  selected,
  disabled = false,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
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
      {selected ? (
        <CheckIcon size={icon.check.size} stroke={icon.check.stroke} color={color.forest} />
      ) : null}
      <Text
        style={[
          textStyle(type.chip),
          { color: selected ? color.forest : disabled ? color.inkStale : color.inkSecondary },
        ]}
      >
        {label}
      </Text>
    </Tappable>
  );
}

/** 1..BRACKET_COUNT, once. */
const BRACKETS: readonly Bracket[] = Array.from({ length: BRACKET_COUNT }, (_, i) => i + 1);

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: color.captionFill },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: space.sheet.top,
    paddingBottom: space.sheet.bottom,
    maxHeight: "85%",
  },
  handle: {
    alignSelf: "center",
    width: size.sheet.handleW,
    height: size.sheet.handleH,
    borderRadius: size.sheet.handleH / 2,
    backgroundColor: color.controlLineStrong,
  },
  title: {
    marginTop: space.sheet.top,
    paddingHorizontal: space.sheet.x,
    color: color.ink,
  },

  body: { marginTop: space.sheet.titleToBody },
  bodyContent: { paddingHorizontal: space.sheet.x, paddingBottom: space.sheet.actionsTop },

  group: { marginBottom: space.sheet.groupGap },
  label: { color: color.ink },
  options: {
    marginTop: space.sheet.labelToOptions,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sheet.optionGap,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: size.sheet.option,
    paddingHorizontal: size.sheet.optionX,
    borderRadius: radius.sheetOption,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    backgroundColor: color.control,
  },
  optionOn: { backgroundColor: color.greenWash, borderColor: color.greenLine },
  optionBlocked: { opacity: 0.5 },
  optionPressed: { opacity: 0.75 },

  note: { marginTop: 8, color: color.inkMuted },

  actions: {
    flexDirection: "row",
    gap: space.sheet.actionGap,
    paddingHorizontal: space.sheet.x,
    paddingTop: space.sheet.actionsTop,
    borderTopWidth: border.hairline,
    borderTopColor: color.divider,
  },
  secondary: {
    height: size.sheet.action,
    paddingHorizontal: 18,
    borderRadius: radius.primaryButton,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryPressed: { backgroundColor: color.control },
  primary: {
    flex: 1,
    height: size.sheet.action,
    borderRadius: radius.primaryButton,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryPressed: { opacity: 0.85 },
});
