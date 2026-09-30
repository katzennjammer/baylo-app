import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import { CONDITIONS, useBrowse, type BrowseFilters } from "../../api/browse";
import { useReach } from "../../api/offer";
import { CATEGORY_LABELS } from "../../api/post";
import type { Item } from "../../api/types";
import { useSession } from "../../auth/session";
import { businessCategoryLabel } from "../../lib/business-category";
import { marketplaceWithFilters } from "../../lib/marketplace-link";
import {
  chipsOf,
  matchSearch,
  toBrowseFilters,
  valueChipLabel,
  withoutChip,
  type HelperChip,
  type HelperFilters,
} from "../../search-helper/match";
import { setHelperState, useHelperState } from "../../search-helper/store";
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
import { CloseIcon, SearchIcon } from "../icons";
import { GridTile } from "../marketplace/GridTile";
import { RemovableChip } from "../RemovableChip";
import { Tappable } from "../Tappable";

/**
 * The free "Search helper": a floating button and the sheet it opens.
 *
 * ── HONEST ABOUT WHAT IT IS ─────────────────────────────────────────────────
 *
 * A keyword matcher (src/search-helper/match.ts), not a conversation. So the
 * sheet has no chat bubbles and no "assistant" voice. It shows what was typed,
 * what the helper UNDERSTOOD AS as removable chips, and the words it did not
 * use -- the whole of its reasoning, on screen, with each piece undoable.
 *
 * When it understands nothing it says so and shows examples of what it does
 * understand. It does not suggest Premium (option A, decided 27 Sep 2026).
 *
 * ── SEARCH ONLY ─────────────────────────────────────────────────────────────
 *
 * It sets browse filters and nothing else: the preview runs the ordinary
 * GET /api/v1/browse, and "See all" opens Marketplace with the same filters.
 *
 * ── WHERE IT LIVES ──────────────────────────────────────────────────────────
 *
 * Mounted by Home and by Marketplace's grid (not its map, whose bottom edge is
 * the nearby-hubs strip). Absolutely positioned inside the SCREEN, which ends
 * above the tab bar, so it never covers a tab.
 */
export function SearchHelper({
  onSeeAll,
}: {
  /**
   * What "See all" does. Marketplace passes its own setter so the grid under
   * the sheet changes in place; elsewhere it navigates to Marketplace.
   */
  onSeeAll?: (filters: BrowseFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tappable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Search helper"
        accessibilityHint="Type what you're looking for in simple words"
        style={s.fab}
        pressedStyle={s.fabPressed}
      >
        <SearchIcon size={24} stroke={2.1} color={color.onGreen} />
      </Tappable>
      {open ? <HelperSheet onClose={() => setOpen(false)} onSeeAll={onSeeAll} /> : null}
    </>
  );
}

const EXAMPLES = ["bike", "books under bracket 2", "fresh food from shops", "like new phone"];

function HelperSheet({
  onClose,
  onSeeAll,
}: {
  onClose: () => void;
  onSeeAll?: (filters: BrowseFilters) => void;
}) {
  const router = useRouter();
  const { session } = useSession();
  const viewerId = session?.user.id ?? null;
  const last = useHelperState(viewerId);

  const [draft, setDraft] = useState(last.text);
  const inputRef = useRef<TextInput>(null);

  // Straight to the keyboard on a fresh sheet; a sheet reopened on an earlier
  // search shows that search instead.
  useEffect(() => {
    if (!last.match) {
      const t = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      setDraft(trimmed);
      if (!trimmed) return;
      setHelperState({ owner: viewerId, text: trimmed, match: matchSearch(trimmed) });
    },
    [viewerId],
  );

  const setFilters = useCallback(
    (filters: HelperFilters) => {
      if (!last.match) return;
      setHelperState({ ...last, match: { ...last.match, filters } });
    },
    [last],
  );

  const seeAll = useCallback(
    (filters: HelperFilters) => {
      const browse = toBrowseFilters(filters);
      onClose();
      if (onSeeAll) onSeeAll(browse);
      else router.push(marketplaceWithFilters(browse));
    },
    [onClose, onSeeAll, router],
  );

  const openItem = useCallback(
    (item: Item) => {
      onClose();
      router.push({ pathname: "/item", params: { id: item.id } });
    },
    [onClose, router],
  );

  const match = last.match;
  const chips = match ? chipsOf(match.filters) : [];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close search helper" />

      <View style={s.sheet}>
        <View style={s.handle} />

        <View style={s.titleRow}>
          <Text style={[textStyle(type.sheetTitle), { color: color.ink }]}>Search helper</Text>
          <Tappable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={10}
            style={s.close}
          >
            <CloseIcon size={icon.clear.size + 2} stroke={icon.clear.stroke} color={color.inkSecondary} />
          </Tappable>
        </View>

        {/* Input at the TOP, so the keyboard never covers what is being typed. */}
        <View style={s.inputRow}>
          <View style={s.field}>
            <SearchIcon size={icon.search.size} stroke={icon.search.stroke} color={color.inkMuted} />
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => run(draft)}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={200}
              placeholder="e.g. books under bracket 2"
              placeholderTextColor={color.inkMuted}
              style={[textStyle(type.searchInput), s.input]}
              accessibilityLabel="What are you looking for?"
            />
          </View>
          <Tappable
            onPress={() => run(draft)}
            accessibilityRole="button"
            accessibilityLabel="Search"
            disabled={!draft.trim()}
            style={[s.go, !draft.trim() && s.goDisabled]}
            pressedStyle={s.goPressed}
          >
            <Text style={[textStyle(type.secondaryButton), { color: color.onGreen }]}>Search</Text>
          </Tappable>
        </View>

        <ScrollView
          style={s.body}
          contentContainerStyle={s.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {!match ? (
            <Intro onExample={run} />
          ) : !match.understood ? (
            <NotUnderstood onExample={run} />
          ) : (
            <>
              <Text style={[textStyle(type.sheetLabel), s.label]}>Understood as</Text>
              {chips.length > 0 ? (
                <View style={s.chips}>
                  {chips.map((chip) => (
                    <RemovableChip
                      key={chip.key}
                      label={chipLabel(chip)}
                      onRemove={() => setFilters(withoutChip(match.filters, chip))}
                    />
                  ))}
                </View>
              ) : (
                <Text style={[textStyle(type.emptyBody), s.muted]}>
                  Nothing left to search by. Type a new search above.
                </Text>
              )}

              {match.ignored.length > 0 ? (
                <Text style={[textStyle(type.gridMeta), s.ignored]}>
                  {`Didn't use: ${match.ignored.join(", ")}`}
                </Text>
              ) : null}
              {match.notes.map((n) => (
                <Text key={n} style={[textStyle(type.gridMeta), s.ignored]}>
                  {n}
                </Text>
              ))}

              {chips.length > 0 ? (
                <Results
                  filters={match.filters}
                  viewerId={viewerId}
                  onOpen={openItem}
                  onSeeAll={() => seeAll(match.filters)}
                />
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function chipLabel(chip: HelperChip): string {
  switch (chip.kind) {
    case "category":
      return CATEGORY_LABELS[chip.value] ?? chip.value;
    case "value":
      return valueChipLabel(chip.min, chip.max);
    case "condition":
      return CONDITIONS.find((c) => c.value === chip.value)?.label ?? chip.value;
    case "shops":
      return "From shops";
    case "shopType":
      return businessCategoryLabel(chip.value);
    case "perishable":
      return "Perishables only";
    case "q":
      return `"${chip.value}"`;
  }
}

function Examples({ onExample }: { onExample: (text: string) => void }) {
  return (
    <View style={s.chips}>
      {EXAMPLES.map((e) => (
        <Tappable
          key={e}
          onPress={() => onExample(e)}
          accessibilityRole="button"
          accessibilityLabel={`Try: ${e}`}
          style={s.example}
          pressedStyle={s.examplePressed}
        >
          <Text style={[textStyle(type.chip), { color: color.inkSecondary }]}>{e}</Text>
        </Tappable>
      ))}
    </View>
  );
}

function Intro({ onExample }: { onExample: (text: string) => void }) {
  return (
    <View>
      <Text style={[textStyle(type.emptyBody), s.muted]}>
        Type what you&apos;re looking for in simple words. I match item types, brackets, condition,
        shops and fresh food, and show you exactly what I picked up.
      </Text>
      <Text style={[textStyle(type.sheetLabel), s.label, { marginTop: space.sheet.groupGap }]}>
        Try
      </Text>
      <Examples onExample={onExample} />
    </View>
  );
}

/** Option A: say plainly what went wrong and what does work. No upsell. */
function NotUnderstood({ onExample }: { onExample: (text: string) => void }) {
  return (
    <View>
      <Text style={[textStyle(type.emptyBody), { color: color.ink }]}>
        I couldn&apos;t pick out anything to search by.
      </Text>
      <Text style={[textStyle(type.emptyBody), s.muted, { marginTop: 6 }]}>
        I only understand simple words: a kind of item, a bracket, a condition, &quot;from shops&quot;
        or &quot;fresh&quot;. Try something like:
      </Text>
      <View style={{ marginTop: space.sheet.labelToOptions }}>
        <Examples onExample={onExample} />
      </View>
    </View>
  );
}

/** How many results the preview shows before "See all". */
const PREVIEW_COUNT = 4;

/**
 * The first few results, from the same query Marketplace would run.
 *
 * Mounted only once there is something to search by, so opening the sheet
 * costs no request. The count is the first page and whether there is more:
 * /browse has no total, so "20+" is as exact as it gets, and it is what
 * Marketplace's own result line says.
 */
function Results({
  filters,
  viewerId,
  onOpen,
  onSeeAll,
}: {
  filters: HelperFilters;
  viewerId: string | null;
  onOpen: (item: Item) => void;
  onSeeAll: () => void;
}) {
  const browseFilters = useMemo(() => toBrowseFilters(filters), [filters]);
  const { items, hasNextPage, isPending, isError, refetch } = useBrowse(browseFilters);
  const { gridReach } = useReach();
  const { width } = useWindowDimensions();
  const tileWidth = Math.floor((width - space.sheet.x * 2 - space.browse.gridGap) / 2);

  if (isPending && items.length === 0) {
    return <ActivityIndicator color={color.green} style={s.loading} />;
  }
  if (isError && items.length === 0) {
    return (
      <View style={s.resultsState}>
        <Text style={[textStyle(type.emptyBody), s.muted]}>Couldn&apos;t load results.</Text>
        <Tappable onPress={() => void refetch()} accessibilityRole="button" style={s.retry}>
          <Text style={[textStyle(type.homeSeeAll), { color: color.forest }]}>Try again</Text>
        </Tappable>
      </View>
    );
  }
  if (items.length === 0) {
    return (
      <View style={s.resultsState}>
        <Text style={[textStyle(type.emptyBody), { color: color.ink }]}>Nothing matches that yet.</Text>
        <Text style={[textStyle(type.emptyBody), s.muted, { marginTop: 4 }]}>
          Remove a chip above to widen the search.
        </Text>
      </View>
    );
  }

  const count = `${items.length}${hasNextPage ? "+" : ""}`;
  return (
    <View style={s.results}>
      <View style={s.grid}>
        {items.slice(0, PREVIEW_COUNT).map((item) => (
          <GridTile
            key={item.id}
            item={item}
            width={tileWidth}
            onPress={onOpen}
            reach={gridReach}
            viewerId={viewerId}
          />
        ))}
      </View>
      <Tappable
        onPress={onSeeAll}
        accessibilityRole="button"
        accessibilityLabel={`See all ${count} results in Marketplace`}
        style={s.seeAll}
        pressedStyle={s.goPressed}
      >
        <Text style={[textStyle(type.primaryButton), { color: color.onGreen }]}>
          {`See all ${count} in Marketplace`}
        </Text>
      </Tappable>
    </View>
  );
}

const FAB = 56;

/**
 * Bottom padding a scrolling screen adds so its last row is never under the
 * button: the button (56) and its margin (16).
 */
export const SEARCH_HELPER_CLEARANCE = FAB + 16;

const s = StyleSheet.create({
  fab: {
    position: "absolute",
    right: space.screenX,
    bottom: space.screenX,
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  fabPressed: { opacity: 0.85 },

  scrim: { flex: 1, backgroundColor: color.captionFill },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: space.sheet.top,
    paddingBottom: space.sheet.bottom,
    height: "85%",
  },
  handle: {
    alignSelf: "center",
    width: size.sheet.handleW,
    height: size.sheet.handleH,
    borderRadius: size.sheet.handleH / 2,
    backgroundColor: color.controlLineStrong,
  },
  titleRow: {
    marginTop: space.sheet.top,
    paddingHorizontal: space.sheet.x,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  close: { padding: 4 },

  inputRow: {
    marginTop: space.sheet.titleToBody,
    paddingHorizontal: space.sheet.x,
    flexDirection: "row",
    gap: space.sheet.actionGap,
  },
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.browse.searchGap,
    height: size.sheet.action,
    paddingLeft: space.browse.searchGap + 4,
    paddingRight: 4,
    borderRadius: radius.searchField,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    backgroundColor: color.control,
  },
  input: { flex: 1, color: color.ink, paddingVertical: 0 },
  go: {
    height: size.sheet.action,
    paddingHorizontal: 16,
    borderRadius: radius.primaryButton,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
  },
  goDisabled: { opacity: 0.45 },
  goPressed: { opacity: 0.85 },

  body: { flex: 1, marginTop: space.sheet.groupGap },
  bodyContent: { paddingHorizontal: space.sheet.x, paddingBottom: space.sheet.actionsTop },

  label: { color: color.ink },
  muted: { color: color.inkSecondary },
  chips: {
    marginTop: space.sheet.labelToOptions,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sheet.optionGap,
  },
  ignored: { marginTop: 10, color: color.inkMuted },
  example: {
    height: 32,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: radius.sheetOption,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    backgroundColor: color.control,
  },
  examplePressed: { opacity: 0.75 },

  loading: { marginTop: space.sheet.groupGap },
  resultsState: { marginTop: space.sheet.groupGap },
  retry: { marginTop: 8, alignSelf: "flex-start" },
  results: { marginTop: space.sheet.groupGap },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.browse.gridGap },
  seeAll: {
    marginTop: space.sheet.groupGap,
    height: size.sheet.action,
    borderRadius: radius.primaryButton,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
  },
});
