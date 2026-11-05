import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import { Tappable } from "../Tappable";
import { PinIcon, TrashIcon } from "../icons";
import { LockIcon } from "../offer/icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sizedImage } from "../../media/image-url";
import { bracketLabel, bracketOf } from "../../lib/brackets";
import { ApiError } from "../../api/client";
import { EDIT_LIMITS, useDeleteItem, useUpdateItem } from "../../api/item";
import { useActiveTrades } from "../../api/trades";
import { listingRemovalCheck } from "../../lib/listing-removal";
import {
  border,
  color,
  font,
  icon,
  radius,
  size,
  space,
  textStyle,
  type,
} from "../../theme/tokens";
import type { Item } from "../../api/types";
import { relookingFor } from "../../post/wanted-keywords";
import { rules } from "../../theme/post-tokens";
import { showDialog } from "../dialog";

function normalizeListingText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Editing a listing you own — safe text edits, with a route to manage hubs.
 *
 * ── WHY THREE FIELDS AND NOT SEVEN ──────────────────────────────────────────
 *
 * Title, description, and what you want in return. NOT photos, category,
 * condition or value, and the reason is the server's, not a
 * matter of screen space: PATCH /api/items/[id] re-runs the valuation model the
 * moment `category`, `condition` or `valueLeaves` appears in the body — and can
 * then REFUSE the request, because the price you already had may no longer sit
 * inside the band the new condition implies. That refusal needs the slider, the
 * band and the "you have used your one re-valuation" panel to be answerable,
 * and those are steps 4 and 5 of the post wizard.
 *
 * Photos are worse: sending `images` at all is read as a photo restatement and
 * rewrites the per-photo hash rows, so a five-photo listing edited through a
 * client that only knows the lead hash loses four entries from the duplicate
 * pool. See the note in `src/api/item.ts`.
 *
 * Meeting hubs are managed in the dedicated `/edit-hubs` screen, which can
 * also be opened from a trade when the two listings have no hub in common.
 * This sheet links to that screen rather than duplicating its picker.
 *
 * ── IT EDITS A DRAFT ────────────────────────────────────────────────────────
 *
 * Same rule as FilterSheet: nothing is sent until Save, the draft is reseeded
 * on each open, and Cancel throws it away. The one addition is a guard on
 * discarding — see `close()` — because a listing description is somebody's
 * paragraph, not a filter they can re-tick in two taps.
 */
export function EditListingSheet({
  item,
  onClose,
  onEditHubs,
}: {
  /** The listing being edited. Null closes the sheet. */
  item: Item | null;
  onClose: () => void;
  onEditHubs: (item: Item) => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [wanted, setWanted] = useState("");

  const update = useUpdateItem(item?.id ?? null);
  const remove = useDeleteItem();
  // The owner's pending offers and active trades, for the remove guard. The
  // same cached query as the Trades tab, fetched only while the sheet is open:
  // the sheet stays mounted, hidden, on the feed and the listing screen.
  const active = useActiveTrades(item !== null);

  // Reseeded on each open, keyed on the item's id rather than on the object —
  // a background refetch of /home hands this component a NEW item object with
  // identical contents, and depending on the object would wipe whatever the
  // owner had typed the instant the feed refreshed underneath them.
  useEffect(() => {
    if (!item) return;
    setTitle(item.title);
    // The server falls back to the title when a listing is created without a
    // description, so the two are often the same string. Shown as stored: an
    // empty box here would read as "no description" and Save would clear it.
    setDescription(item.description);
    setWanted(item.wanted ?? "");
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;
  const hubs = item.safeZones ?? [];
  const bracket = item.valueLeaves !== null ? bracketLabel(bracketOf(item.valueLeaves)) : null;

  const trimmedTitle = title.trim();
  const dirty =
    trimmedTitle !== item.title ||
    description.trim() !== item.description ||
    wanted.trim() !== (item.wanted ?? "");

  // A listing with no title is not a listing. Everything else may be empty:
  // `wanted` is optional, and the server fills an empty description from the
  // title the same way it does on create.
  const busy = update.isPending || remove.isPending;
  const blocked = trimmedTitle.length === 0 || !dirty || busy;

  const close = () => {
    if (!dirty || busy) {
      onClose();
      return;
    }
    showDialog("Discard your changes?", "What you have typed will not be saved.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: onClose },
    ]);
  };

  const editHubs = () => {
    if (busy) return;
    if (!dirty) {
      onEditHubs(item);
      return;
    }
    showDialog(
      "Discard your changes?",
      "Your text edits won't be saved before you change the meeting locations.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => onEditHubs(item),
        },
      ],
    );
  };

  const save = () => {
    if (blocked) return;
    const wantedChanged = wanted.trim() !== (item.wanted ?? "");
    const descriptionIsUnchangedTitle =
      description.trim() === item.description &&
      normalizeListingText(item.description) === normalizeListingText(item.title);
    update.mutate(
      {
        title: trimmedTitle,
        description:
          trimmedTitle !== item.title && descriptionIsUnchangedTitle ? "" : description.trim(),
        wantedItems: wanted.trim(),
        // The matcher reads the categories, not this text, so a rewritten want
        // has to move them too or the listing keeps matching its ORIGINAL
        // categories. Sent only when the text changed: an edit to the title
        // alone leaves them exactly as stored.
        ...(wantedChanged && {
          lookingForCategories: relookingFor(
            item.lookingFor,
            item.wanted ?? "",
            wanted,
            rules.maxReturnCategories,
          ),
        }),
      },
      {
        onSuccess: onClose,
        onError: (e) =>
          showDialog(
            "Could not save that",
            e instanceof ApiError ? e.message : "Something went wrong. Please try again.",
            [{ text: "Got it" }],
            { pose: "worry" },
          ),
      },
    );
  };

  // The same soft delete as the listing's ⋯ menu, guarded: never while the
  // listing is in a trade, and always confirmed first. See lib/listing-removal.
  const confirmRemove = () => {
    if (busy) return;
    const check = listingRemovalCheck(item, active.data);
    if (check.kind === "blocked") {
      showDialog(check.title, check.body);
      return;
    }
    showDialog(check.title, check.body, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          remove.mutate(item.id, {
            onSuccess: onClose,
            onError: (e) =>
              showDialog(
                "Could not remove that",
                e instanceof ApiError ? e.message : "Something went wrong. Please try again.",
              ),
          }),
      },
    ]);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <Pressable style={s.scrim} onPress={close} accessibilityLabel="Close editor" />

      {/*
        The description box is three lines tall and sits near the bottom of the
        screen, so on iOS the keyboard covers it outright. `padding` is the
        behaviour that works for a sheet anchored to the bottom edge; Android
        resizes the window itself (`softwareKeyboardLayoutMode: "resize"` in
        app.json) and needs nothing here, which is why the behaviour is null
        there rather than "height".
      */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/*
          maxHeight in pixels, not "88%": a percentage of the keyboard
          wrapper, which grows to fill the modal, left a band at the bottom
          where the listing behind showed through.
        */}
        <View style={[s.sheet, { paddingBottom: insets.bottom + 12, maxHeight: Math.round(windowHeight * 0.9) }]}>
          <View style={s.handle} />

          {/*
            Cancel and Save in the header, so the form ends where the content
            ends. The old bottom bar sat above Android's navigation area and
            let the listing behind show through under it.
          */}
          <View style={s.header}>
            <Tappable onPress={close} accessibilityRole="button" style={s.headerSide} pressedStyle={s.pressedText}>
              <Text style={[textStyle(type.secondaryButton), { color: color.inkSecondary }]}>Cancel</Text>
            </Tappable>
            <Text style={[textStyle(type.sheetTitle), s.title]}>Edit listing</Text>
            <Tappable
              onPress={save}
              disabled={blocked}
              accessibilityRole="button"
              accessibilityState={{ disabled: blocked }}
              style={[s.headerSide, { alignItems: "flex-end" }]}
              pressedStyle={s.pressedText}
            >
              {update.isPending ? (
                <ActivityIndicator color={color.forest} />
              ) : (
                <Text style={[textStyle(type.primaryButton), { color: blocked ? color.inkMuted : color.forest }]}>Save</Text>
              )}
            </Tappable>
          </View>

          <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
            {/*
              What this screen does not change, shown as the listing itself
              rather than a paragraph of small print. Changing any of it
              re-prices the listing, which happens in the posting flow.
            */}
            <View style={s.locked} accessible accessibilityLabel={`${item.categoryLabel}, ${item.conditionLabel}${bracket ? `, ${bracket}` : ""}. Photos, category, condition and value are set when you post.`}>
              {item.images[0] ? (
                <Image source={{ uri: sizedImage(item.images[0], "thumb") }} contentFit="cover" style={s.lockedThumb} />
              ) : (
                <View style={s.lockedThumb} />
              )}
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={s.lockedFacts} numberOfLines={1}>
                  {[item.categoryLabel, item.conditionLabel, bracket].filter(Boolean).join(" · ")}
                </Text>
                <Text style={s.lockedNote}>Photos, category, condition and value are set when you post.</Text>
              </View>
              <LockIcon size={16} stroke={2} color={color.inkMuted} />
            </View>

            <Field
              label="Title"
              value={title}
              onChange={setTitle}
              maxLength={EDIT_LIMITS.title}
              placeholder="What is it?"
            />

            <Field
              label="Description"
              value={description}
              onChange={setDescription}
              maxLength={EDIT_LIMITS.description}
              placeholder="Anything a trader should know — marks, missing parts, how long you have had it."
              multiline
            />

            <Field
              label="What you want in return"
              value={wanted}
              onChange={setWanted}
              maxLength={EDIT_LIMITS.wanted}
              placeholder="Optional. Leave empty and you are open to offers."
              multiline
            />

            <View style={s.locationGroup}>
              <View style={s.labelRow}>
                <Text style={[textStyle(type.sheetLabel), s.label]}>Meeting locations</Text>
                <Tappable onPress={editHubs} disabled={busy} accessibilityRole="button" accessibilityLabel="Change meeting locations" pressedStyle={s.pressedText}>
                  <Text style={[textStyle(type.secondaryButton), { color: color.forest }]}>Change</Text>
                </Tappable>
              </View>
              {hubs.length > 0 ? (
                hubs.map((h, i) => (
                  <View key={h.id} style={[s.hubRow, i > 0 && s.hubDivider]}>
                    <PinIcon size={16} stroke={2} color={color.forest} />
                    <Text style={[textStyle(type.detailBody), { flex: 1, color: color.ink }]} numberOfLines={1}>{h.name}</Text>
                  </View>
                ))
              ) : (
                <Text style={[textStyle(type.gridMeta), s.locationHint]}>
                  None yet. Add up to five public hubs where traders can meet you.
                </Text>
              )}
            </View>

            {/* At the end of the form, away from Save. The dialog does the asking. */}
            <Tappable
              onPress={confirmRemove}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Remove listing"
              style={s.remove}
              pressedStyle={s.pressedText}
            >
              {remove.isPending ? (
                <ActivityIndicator color={color.urgent} />
              ) : (
                <>
                  <TrashIcon size={18} stroke={2} color={color.urgent} />
                  <Text style={[textStyle(type.secondaryButton), { color: color.urgent }]}>Remove listing</Text>
                </>
              )}
            </Tappable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * One labelled input, with its remaining-characters count.
 *
 * `maxLength` is the server's own cap, mirrored from EDIT_LIMITS, so the field
 * stops at the boundary instead of letting somebody write 300 characters of
 * "what I want" and be told no by a 400. The counter appears only in the last
 * fifth of the allowance — a permanent "0 / 5000" is noise on a field nobody
 * will fill.
 */
function Field({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  maxLength: number;
  placeholder: string;
  multiline?: boolean;
}) {
  const left = maxLength - value.length;
  const near = left <= Math.round(maxLength / 5);

  return (
    <View style={s.group}>
      <View style={s.labelRow}>
        <Text style={[textStyle(type.sheetLabel), s.label]}>{label}</Text>
        {near ? (
          <Text
            style={[
              textStyle(type.gridMeta),
              { color: left === 0 ? color.urgent : color.inkMuted },
            ]}
          >
            {`${left} left`}
          </Text>
        ) : null}
      </View>

      <TextInput
        value={value}
        onChangeText={onChange}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={color.inkMuted}
        accessibilityLabel={label}
        multiline={multiline}
        style={[textStyle(type.detailBody), s.input, multiline && s.inputMulti]}
      />
    </View>
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
  },
  handle: {
    alignSelf: "center",
    width: size.sheet.handleW,
    height: size.sheet.handleH,
    borderRadius: size.sheet.handleH / 2,
    backgroundColor: color.controlLineStrong,
  },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.sheet.x, marginTop: 10, paddingBottom: 12, borderBottomWidth: border.hairline, borderBottomColor: color.divider },
  headerSide: { width: 72, minHeight: 44, justifyContent: "center" },
  title: { flex: 1, textAlign: "center", color: color.ink },
  pressedText: { opacity: 0.6 },
  locked: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, marginBottom: space.sheet.groupGap, borderRadius: 14, borderWidth: border.chip, borderColor: color.controlLine },
  lockedThumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: color.control },
  lockedFacts: { fontFamily: font.sansSemi, fontSize: 14, color: color.ink },
  lockedNote: { fontFamily: font.sans, fontSize: 12, lineHeight: 16, color: color.inkMuted },
  hubRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  hubDivider: { borderTopWidth: border.hairline, borderTopColor: color.divider },
  body: { marginTop: 16 },
  bodyContent: { paddingHorizontal: space.sheet.x, paddingBottom: space.sheet.actionsTop },

  group: { marginBottom: space.sheet.groupGap },
  labelRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  label: { color: color.ink },
  input: {
    marginTop: space.sheet.labelToOptions,
    minHeight: size.sheet.rangeInput,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.rangeInput,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    backgroundColor: color.control,
    color: color.ink,
  },
  // textAlignVertical is the Android-only fix for multiline text starting
  // vertically centred; iOS already tops it out and ignores the property.
  inputMulti: { minHeight: 96, textAlignVertical: "top" },

  locationGroup: { marginBottom: space.sheet.groupGap },
  locationHint: { color: color.inkMuted, marginTop: 4 },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 56,
    marginTop: 10,
    paddingHorizontal: 12,
    borderRadius: radius.filterButton,
    borderWidth: border.chip,
    borderColor: color.greenLine,
    backgroundColor: color.greenWash,
  },
  locationPressed: { opacity: 0.8 },
  locationIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surface,
  },
  locationButtonText: { color: color.forest, flex: 1 },

  note: { color: color.inkMuted },
  remove: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, marginTop: 4 },
  removePressed: { opacity: 0.8 },

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
