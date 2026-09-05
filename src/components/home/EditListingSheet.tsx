import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Tappable } from "../Tappable";
import { ApiError } from "../../api/client";
import { EDIT_LIMITS, useUpdateItem } from "../../api/item";
import {
  border,
  color,
  radius,
  size,
  space,
  textStyle,
  type,
} from "../../theme/tokens";
import type { Item } from "../../api/types";

/**
 * Editing a listing you own — the three fields that are safe to change here.
 *
 * ── WHY THREE FIELDS AND NOT SEVEN ──────────────────────────────────────────
 *
 * Title, description, and what you want in return. NOT photos, category,
 * condition, value or meetup points, and the reason is the server's, not a
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
 * So this sheet sends exactly what it shows, and the wizard keeps the rest. A
 * full edit mode is its own task; this is the one that stops "Edit listing"
 * being another control that does nothing.
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
}: {
  /** The listing being edited. Null closes the sheet. */
  item: Item | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [wanted, setWanted] = useState("");

  const update = useUpdateItem(item?.id ?? null);

  // Reseeded on each open, keyed on the item's id rather than on the object —
  // a background refetch of /home hands this component a NEW item object with
  // identical contents, and depending on the object would wipe whatever the
  // owner had typed the instant the feed refreshed underneath them.
  useEffect(() => {
    if (!item) return;
    setTitle(item.title);
    // The server falls back to the title when a listing is created without a
    // description, so the two are often the same string. Shown as stored: an
    // empty box here would read as "no description" and Save would then write
    // one, which is a change the owner did not ask for.
    setDescription(item.description);
    setWanted(item.wanted ?? "");
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;

  const trimmedTitle = title.trim();
  const dirty =
    trimmedTitle !== item.title ||
    description.trim() !== item.description ||
    wanted.trim() !== (item.wanted ?? "");

  // A listing with no title is not a listing. Everything else may be empty:
  // `wanted` is optional, and the server fills an empty description from the
  // title the same way it does on create.
  const blocked = trimmedTitle.length === 0 || !dirty || update.isPending;

  const close = () => {
    if (!dirty || update.isPending) {
      onClose();
      return;
    }
    Alert.alert("Discard your changes?", "What you have typed will not be saved.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: onClose },
    ]);
  };

  const save = () => {
    if (blocked) return;
    update.mutate(
      {
        title: trimmedTitle,
        description: description.trim(),
        wantedItems: wanted.trim(),
      },
      {
        onSuccess: onClose,
        onError: (e) =>
          Alert.alert(
            "Could not save that",
            e instanceof ApiError ? e.message : "Something went wrong. Please try again.",
          ),
      },
    );
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
        <View style={s.sheet}>
          <View style={s.handle} />

          <Text style={[textStyle(type.sheetTitle), s.title]}>Edit listing</Text>

          <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
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

            {/*
              Said rather than left to be discovered. Somebody who opens this
              looking for the value slider needs to know where it is, not to
              conclude the app cannot do it.
            */}
            <Text style={[textStyle(type.gridMeta), s.note]}>
              Photos, category, condition and the Leaf value are not edited here — changing
              any of them re-prices the listing, which happens in the posting flow.
            </Text>
          </ScrollView>

          <View style={s.actions}>
            <Tappable
              onPress={close}
              accessibilityRole="button"
              style={s.secondary}
              pressedStyle={s.secondaryPressed}
            >
              <Text style={[textStyle(type.secondaryButton), { color: color.inkSecondary }]}>
                Cancel
              </Text>
            </Tappable>

            <Tappable
              onPress={save}
              disabled={blocked}
              accessibilityRole="button"
              accessibilityState={{ disabled: blocked }}
              style={[s.primary, blocked && s.primaryDisabled]}
              pressedStyle={s.primaryPressed}
            >
              {update.isPending ? (
                <ActivityIndicator color={color.onGreen} />
              ) : (
                <Text style={[textStyle(type.primaryButton), { color: color.onGreen }]}>
                  Save
                </Text>
              )}
            </Tappable>
          </View>
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
    maxHeight: "88%",
  },
  handle: {
    alignSelf: "center",
    width: size.sheet.handleW,
    height: size.sheet.handleH,
    borderRadius: size.sheet.handleH / 2,
    backgroundColor: color.controlLineStrong,
  },
  title: { marginTop: space.sheet.top, paddingHorizontal: space.sheet.x, color: color.ink },

  body: { marginTop: space.sheet.titleToBody },
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

  note: { color: color.inkMuted },

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
