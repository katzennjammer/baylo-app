import { Image } from "expo-image";
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
  dColor,
  icon,
  marketplaceUi,
  radius,
  size,
  space,
  textStyle,
  type,
} from "../../theme/tokens";
import { ArrowRightIcon, ArrowUpRightIcon, CloseIcon, SearchIcon } from "../icons";
import { bracketLabel, bracketOf } from "../../lib/brackets";
import { bracketsBeyondReach } from "../../lib/gap";
import { MASCOT } from "../../media/mascots";
import { sizedImage } from "../../media/image-url";
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
  collapsed = false,
}: {
  /**
   * What "See all" does. Marketplace passes its own setter so the grid under
   * the sheet changes in place; elsewhere it navigates to Marketplace.
   */
  onSeeAll?: (filters: BrowseFilters) => void;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // "HELP ME FIND", WITH A MAGNIFIER (1 Oct 2026). Deliberately modest: the
  // sheet is the keyword matcher described above, not a conversation. It
  // calls no model and needs no API credit; it turns words into /browse
  // filters on the phone. A sparkle and "Ask Baylo" read as an AI assistant,
  // which this is not. The Premium assistant (POST /api/v1/assistant) is a
  // separate backend, not wired here; when it is, this label can grow up.
  return (
    <>
      <Tappable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Help me find"
        accessibilityHint="Opens the search helper. Type what you're looking for in simple words"
        style={[s.fab, collapsed && s.fabCollapsed]}
        pressedStyle={s.fabPressed}
      >
        <SearchIcon size={FAB_ICON} stroke={2.1} color={dColor.primaryText} />
        {!collapsed ? (
          <Text
            style={[textStyle(type.heroCta), { color: dColor.primaryText }]}
            maxFontSizeMultiplier={size.home.headingMaxFontScale}
            numberOfLines={1}
          >
            Help me find
          </Text>
        ) : null}
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
  const peopleQuery = draft.trim();
  const isPeopleSearch = peopleQuery.startsWith("@");
  const canSearchPeople = peopleQuery.slice(1).trim().length >= 2;

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

  const searchPeople = useCallback(() => {
    const query = draft.trim().slice(0, 101);
    if (!query.startsWith("@") || query.slice(1).trim().length < 2) return;

    onClose();
    if (onSeeAll) {
      onSeeAll({ q: query });
    } else {
      router.push({
        pathname: "/(app)/marketplace",
        params: { q: query, applyAt: String(Date.now()) },
      });
    }
  }, [draft, onClose, onSeeAll, router]);

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
  // With results showing, the sheet is about the results (4 Nov 2026): no
  // title row, the close button beside the field, See all pinned at the foot.
  const showingResults = !isPeopleSearch && !!match && match.understood && chips.length > 0;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close search helper" />

      <View style={s.sheet}>
        <View style={s.handle} />

        {/* The magnifier duck sets the tone; one short line instead of a paragraph. */}
        {showingResults ? null : (
        <View style={s.titleRow}>
          <Image source={MASCOT.search} contentFit="contain" style={s.titleDuck} accessible={false} />
          <View style={{ flex: 1 }}>
            <Text style={[textStyle(type.sheetTitle), { color: color.ink }]}>Help me find</Text>
            <Text style={[textStyle(type.gridMeta), s.muted]}>Say it the way you&apos;d say it to a friend.</Text>
          </View>
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
        )}

        {/* Input at the TOP, so the keyboard never covers what is being typed. */}
        <View style={s.inputRow}>
          <View style={s.field}>
            <SearchIcon size={icon.search.size} stroke={icon.search.stroke} color={color.inkMuted} />
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => (isPeopleSearch ? searchPeople() : run(draft))}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={200}
              placeholder="e.g. bike or @name"
              placeholderTextColor={color.inkMuted}
              style={[textStyle(type.searchInput), s.input]}
              accessibilityLabel="What are you looking for?"
            />
            {/* The search button sits inside the field, so the field gets the width. */}
            <Tappable
              onPress={() => (isPeopleSearch ? searchPeople() : run(draft))}
              accessibilityRole="button"
              accessibilityLabel={isPeopleSearch ? "Find people" : "Search"}
              disabled={isPeopleSearch ? !canSearchPeople : !draft.trim()}
              style={[
                s.go,
                (isPeopleSearch ? !canSearchPeople : !draft.trim()) && s.goDisabled,
              ]}
              pressedStyle={s.goPressed}
            >
              <ArrowRightIcon size={20} stroke={2.4} color={color.onGreen} />
            </Tappable>
          </View>
          {showingResults ? (
            <Tappable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={6} style={s.close}>
              <CloseIcon size={icon.clear.size + 2} stroke={icon.clear.stroke} color={color.ink} />
            </Tappable>
          ) : null}
        </View>

        <ScrollView
          style={s.body}
          contentContainerStyle={s.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {isPeopleSearch ? (
            <Text style={[textStyle(type.emptyBody), s.muted]}>
              {canSearchPeople
                ? "Search public profiles by display name. Open a profile to see their listings and contact options."
                : "Add at least two characters after @ to search for people."}
            </Text>
          ) : !match ? (
            <Intro onExample={run} />
          ) : !match.understood ? (
            <NotUnderstood onExample={run} />
          ) : (
            <>
              {chips.length > 0 ? (
                <View style={[s.chips, { alignItems: "center", marginTop: 0 }]}>
                  <Text style={[textStyle(type.gridMeta), s.muted]}>Showing</Text>
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
                />
              ) : null}
            </>
          )}
        </ScrollView>
        {showingResults && match ? <SeeAllBar filters={match.filters} onSeeAll={() => seeAll(match.filters)} /> : null}
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

/** Tappable example searches, as rows. */
function Examples({ onExample }: { onExample: (text: string) => void }) {
  return (
    <View style={s.exampleList}>
      {EXAMPLES.map((e, i) => (
        <Tappable
          key={e}
          onPress={() => onExample(e)}
          accessibilityRole="button"
          accessibilityLabel={`Try: ${e}`}
          style={[s.exampleRow, i > 0 && s.exampleRowLine]}
          pressedStyle={s.examplePressed}
        >
          <View style={s.exampleIcon}>
            <SearchIcon size={16} stroke={2} color={color.ink} />
          </View>
          <Text style={[textStyle(type.emptyBody), { flex: 1, color: color.ink }]}>{e}</Text>
          <ArrowUpRightIcon size={16} stroke={2} color={color.inkMuted} />
        </Tappable>
      ))}
    </View>
  );
}

/** What the matcher picks up on, shown as the chips it would make. */
const PICKS_UP = ["Item type", "Bracket", "Condition", "Shops", "Fresh food", "@username"];

function Intro({ onExample }: { onExample: (text: string) => void }) {
  return (
    <View>
      <Text style={[textStyle(type.sheetLabel), s.label]}>Try one</Text>
      <Examples onExample={onExample} />
      <Text style={[textStyle(type.sheetLabel), s.label, { marginTop: space.sheet.groupGap }]}>
        I pick up on
      </Text>
      <View style={[s.chips, { marginTop: 8 }]}>
        {PICKS_UP.map((tag) => (
          <View key={tag} style={s.pickTag}>
            <Text style={[textStyle(type.chip), { color: color.forest }]}>{tag}</Text>
          </View>
        ))}
      </View>
      <Text style={[textStyle(type.gridMeta), s.muted, { marginTop: 8 }]}>
        You&apos;ll see exactly what I picked up, and can remove any of it.
      </Text>
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
/** Out-of-reach rows shown under the preview. */
const BEYOND_COUNT = 3;

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
}: {
  filters: HelperFilters;
  viewerId: string | null;
  onOpen: (item: Item) => void;
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
  // What you can offer on first; what is beyond your reach after, compact.
  // An unknown reach counts as reachable: never grey on a guess.
  const isBeyond = (item: Item) =>
    gridReach != null && item.valueLeaves !== null && item.owner.id !== viewerId
      ? bracketsBeyondReach(item.valueLeaves, gridReach) > 0
      : false;
  const reachable = items.filter((i) => !isBeyond(i));
  const beyond = items.filter(isBeyond);
  return (
    <View style={s.results}>
      {reachable.length > 0 ? (
        <>
          <Text style={[textStyle(type.sheetLabel), s.label]}>
            {gridReach != null ? "You can offer on these" : "Results"}
          </Text>
          <View style={s.grid}>
            {reachable.slice(0, PREVIEW_COUNT).map((item) => (
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
        </>
      ) : null}
      {beyond.length > 0 ? (
        <>
          <Text style={[textStyle(type.sheetLabel), s.label, { marginTop: space.sheet.groupGap }]}>
            Above your reach for now
          </Text>
          <Text style={[textStyle(type.gridMeta), s.muted]}>Post a higher-bracket item to offer on these.</Text>
          <View style={s.beyondList}>
            {beyond.slice(0, BEYOND_COUNT).map((item, i) => (
              <Tappable
                key={item.id}
                onPress={() => onOpen(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${bracketLabel(bracketOf(item.valueLeaves as number))}, above your reach`}
                style={[s.beyondRow, i > 0 && s.exampleRowLine]}
                pressedStyle={s.examplePressed}
              >
                <View style={s.beyondThumb}>
                  {item.images[0] ? (
                    <Image source={{ uri: sizedImage(item.images[0], "thumb") }} contentFit="cover" style={StyleSheet.absoluteFill} />
                  ) : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[textStyle(type.emptyBody), { color: color.ink, fontWeight: "600" }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[textStyle(type.gridMeta), s.muted]} numberOfLines={1}>
                    {item.conditionLabel}
                  </Text>
                </View>
                <Text style={[textStyle(type.gridMeta), { color: color.inkSecondary, fontWeight: "700" }]}>
                  {bracketLabel(bracketOf(item.valueLeaves as number))}
                </Text>
              </Tappable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** "See all N in Marketplace", pinned under the results. Same query, so no extra request. */
function SeeAllBar({ filters, onSeeAll }: { filters: HelperFilters; onSeeAll: () => void }) {
  const browseFilters = useMemo(() => toBrowseFilters(filters), [filters]);
  const { items, hasNextPage } = useBrowse(browseFilters);
  if (items.length === 0) return null;
  const count = `${items.length}${hasNextPage ? "+" : ""}`;
  return (
    <View style={s.seeAllBar}>
      <Tappable
        onPress={onSeeAll}
        accessibilityRole="button"
        accessibilityLabel={`See all ${count} results in Marketplace`}
        style={[s.seeAll, { marginTop: 0 }]}
        pressedStyle={s.goPressed}
      >
        <Text style={[textStyle(type.primaryButton), { color: color.onGreen }]}>
          {`See all ${count} in Marketplace`}
        </Text>
      </Tappable>
    </View>
  );
}

/** The extended pill's height, and its magnifier. */
const FAB = marketplaceUi.size.helperExpanded;
const COLLAPSED_FAB = marketplaceUi.size.helperCollapsed;
const FAB_ICON = 18;

/**
 * Bottom padding a scrolling screen adds so its last row is never under the
 * button: the pill (48), its margin from the screen's bottom edge (16), and
 * the same again as clear space above it, so a card's title in the last row
 * ends above the pill rather than just touching it. Home and Marketplace both
 * read this, so the two screens stay in step with the button.
 */
export const SEARCH_HELPER_CLEARANCE = FAB + space.screenX * 2;

const s = StyleSheet.create({
  fab: {
    position: "absolute",
    right: space.screenX,
    bottom: space.screenX,
    height: FAB,
    paddingHorizontal: 18,
    flexDirection: "row",
    gap: 8,
    borderRadius: FAB / 2,
    backgroundColor: dColor.primary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
    elevation: 6,
    shadowColor: dColor.text,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  fabCollapsed: {
    width: COLLAPSED_FAB,
    height: COLLAPSED_FAB,
    paddingHorizontal: 0,
    borderRadius: marketplaceUi.radius.helperCollapsed,
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
    gap: 12,
  },
  titleDuck: { width: 44, height: 60 },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: color.control,
    alignItems: "center",
    justifyContent: "center",
  },

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
    height: 54,
    paddingLeft: 16,
    paddingRight: 5,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: color.green,
    backgroundColor: color.searchSurface,
  },
  input: { flex: 1, color: color.ink, paddingVertical: 0 },
  go: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
  seeAllBar: { paddingHorizontal: space.sheet.x, paddingTop: 12, paddingBottom: 28, borderTopWidth: border.hairline, borderTopColor: color.divider, backgroundColor: color.surface },
  exampleList: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: border.hairline,
    borderColor: color.controlLine,
    backgroundColor: color.searchSurface,
    overflow: "hidden",
  },
  exampleRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 12 },
  exampleRowLine: { borderTopWidth: border.hairline, borderTopColor: color.divider },
  exampleIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: color.control,
    alignItems: "center",
    justifyContent: "center",
  },
  pickTag: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: color.greenWash,
    justifyContent: "center",
  },
  beyondList: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: border.hairline,
    borderColor: color.controlLine,
    backgroundColor: color.searchSurface,
    overflow: "hidden",
  },
  beyondRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  beyondThumb: { width: 52, height: 52, borderRadius: 10, overflow: "hidden", backgroundColor: color.control },

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
