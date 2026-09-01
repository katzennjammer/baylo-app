import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

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

/**
 * Category, condition and Leaf range, in a sheet.
 *
 * ── IT EDITS A DRAFT ────────────────────────────────────────────────────────
 *
 * Nothing here touches the live filters until Apply. The sheet holds its own
 * copy, seeded from the current filters each time it opens, and Cancel throws
 * it away. That is the difference between a control panel and a slot machine:
 * live-applying a Leaf range as somebody types "1", "12", "120" fires three
 * queries, two of which are for numbers they never meant.
 *
 * The category RAIL outside the sheet is the opposite — one tap, applied
 * immediately — and the two are not inconsistent. A chip is a single complete
 * decision; a range is not complete until the person stops typing, and there is
 * no reliable way to know when that is.
 *
 * ── THE RANGE INPUTS ────────────────────────────────────────────────────────
 *
 * Kept as STRINGS in state and only parsed on Apply. Holding them as numbers
 * means an empty field has to be represented as null and "0" and "" become
 * indistinguishable while typing — the field would erase itself the moment
 * somebody cleared it to start again.
 *
 * The server refuses min > max with a 400. Rather than let that reach the user
 * as an error banner, Apply is disabled while the pair is inverted and the
 * reason is said under the inputs.
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
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

  // Reseed on each open. Without the `visible` dependency the draft would keep
  // whatever the last session left in it, so reopening after a Cancel would
  // show the discarded edits as though they had been applied.
  useEffect(() => {
    if (!visible) return;
    setCategories([...(filters.categories ?? [])]);
    setCondition(filters.condition ?? null);
    setMin(filters.minLeaves != null ? String(filters.minLeaves) : "");
    setMax(filters.maxLeaves != null ? String(filters.maxLeaves) : "");
  }, [visible, filters]);

  const minN = min.trim() === "" ? null : Number(min);
  const maxN = max.trim() === "" ? null : Number(max);

  const badNumber =
    (minN !== null && !Number.isFinite(minN)) || (maxN !== null && !Number.isFinite(maxN));
  const inverted = minN !== null && maxN !== null && minN > maxN;
  const blocked = badNumber || inverted;

  const apply = () => {
    if (blocked) return;
    onApply({
      // `q` is owned by the search field, not by this sheet. Carrying it
      // through unchanged is what stops Apply from clearing the search box.
      q: filters.q,
      categories,
      condition,
      minLeaves: minN,
      maxLeaves: maxN,
    });
  };

  const clearAll = () => {
    setCategories([]);
    setCondition(null);
    setMin("");
    setMax("");
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

          {/* ── leaf range ── */}
          <View style={s.group}>
            <Text style={[textStyle(type.sheetLabel), s.label]}>Value in Leaves</Text>
            <View style={s.range}>
              <RangeInput value={min} onChange={setMin} placeholder="Min" label="Minimum Leaves" />
              <Text style={[textStyle(type.detailBody), { color: color.inkMuted }]}>to</Text>
              <RangeInput value={max} onChange={setMax} placeholder="Max" label="Maximum Leaves" />
            </View>

            {inverted ? (
              <Text style={[textStyle(type.gridMeta), s.warning]}>
                The minimum is above the maximum, so nothing could match.
              </Text>
            ) : null}
            {badNumber ? (
              <Text style={[textStyle(type.gridMeta), s.warning]}>
                Leaf values have to be whole numbers.
              </Text>
            ) : null}

            {/*
              Said plainly because the server's behaviour is not guessable: a
              range EXCLUDES listings with no value at all, rather than treating
              them as zero. An unpriced item is not an item worth nothing.
            */}
            <Text style={[textStyle(type.gridMeta), s.note]}>
              Listings with no value set are hidden while a range is on.
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
            disabled={blocked}
            accessibilityRole="button"
            accessibilityState={{ disabled: blocked }}
            style={[s.primary, blocked && s.primaryDisabled]}
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

function RangeInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <TextInput
      value={value}
      // Stripped to digits on the way in rather than validated on the way out.
      // `keyboardType` is a hint, not a constraint — a hardware keyboard, a
      // paste, or several Android IMEs will all happily deliver letters.
      onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ""))}
      keyboardType="number-pad"
      inputMode="numeric"
      placeholder={placeholder}
      placeholderTextColor={color.inkMuted}
      accessibilityLabel={label}
      style={[textStyle(type.searchInput), s.rangeInput]}
    />
  );
}

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

  range: {
    marginTop: space.sheet.labelToOptions,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sheet.rangeGap,
  },
  rangeInput: {
    flex: 1,
    height: size.sheet.rangeInput,
    paddingHorizontal: 12,
    borderRadius: radius.rangeInput,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    backgroundColor: color.control,
    color: color.ink,
  },
  warning: { marginTop: 8, color: color.urgent },
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
  primaryDisabled: { opacity: 0.45 },
  primaryPressed: { opacity: 0.85 },
});
