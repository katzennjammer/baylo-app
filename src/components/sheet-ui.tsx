import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { ChevronLeftIcon } from "./icons";
import { Tappable } from "./Tappable";
import {
  border,
  color,
  icon,
  radius,
  size,
  space,
  textStyle,
  type,
} from "../theme/tokens";

/**
 * The bottom-sheet chrome and its rows, in one place.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * A menu of actions in a sheet is now drawn on two screens — the feed's
 * overflow menu and the item detail screen's report picker — and both of them
 * render the SAME six report reasons. Two copies of a scrim, a grab handle, a
 * title row and a Cancel button is two places for a spacing tweak to land in
 * one of, and the failure is the kind nobody files a bug for: the sheet is 2 px
 * different depending on where you opened it from.
 *
 * FilterSheet, EditListingSheet and CommentsSheet are deliberately NOT
 * refactored onto this. Each of them has a body that is not a list of rows — a
 * wrapped chip grid, a form with a keyboard-avoiding view, a paginated list
 * with a composer pinned under it — and bending a shared shell around all three
 * would produce a component with six escape-hatch props, which is worse than
 * the duplication. This covers the shape that actually repeats: a title, a
 * column of tappable rows, and a way out.
 */

/**
 * Modal, scrim, handle, title, body, footer.
 *
 * `onBack` is what makes a sheet that swaps PANELS rather than stacking modals.
 * A second Modal over the first is a scrim over a scrim, and on Android the
 * inner one's hardware back dismisses both — so a sheet that needs a second
 * step renders it in place, with this chevron and a hardware-back that returns
 * a panel instead of closing. When it is absent the hardware back closes, which
 * is what a single-panel sheet should do.
 */
export function SheetShell({
  title,
  onBack,
  onClose,
  busy = false,
  closeLabel = "Cancel",
  children,
}: {
  title: string;
  /** Present only while a sub-panel is showing. See the note above. */
  onBack?: () => void;
  onClose: () => void;
  /** Replaces the footer control with a spinner while a request is in flight. */
  busy?: boolean;
  closeLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={() => (onBack ? onBack() : onClose())}
      statusBarTranslucent
    >
      {/* A plain Pressable: it has no held state to draw, so Tappable would be
          ceremony. Tapping it is the same as Cancel. */}
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />

      <View style={s.sheet}>
        <View style={s.handle} />

        <View style={s.titleRow}>
          {onBack ? (
            <Tappable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={s.back}
              pressedStyle={s.rowPressed}
            >
              <ChevronLeftIcon size={icon.back.size} stroke={icon.back.stroke} color={color.ink} />
            </Tappable>
          ) : null}

          <Text style={[textStyle(type.sheetTitle), s.title]} numberOfLines={2}>
            {title}
          </Text>
        </View>

        {children}

        <View style={s.footer}>
          {busy ? (
            <ActivityIndicator color={color.green} />
          ) : (
            <Tappable
              onPress={onClose}
              accessibilityRole="button"
              style={s.cancel}
              pressedStyle={s.cancelPressed}
            >
              <Text style={[textStyle(type.secondaryButton), { color: color.inkSecondary }]}>
                {closeLabel}
              </Text>
            </Tappable>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** A column of rows, inset to the sheet's gutter. */
export function SheetRows({ children }: { children: React.ReactNode }) {
  return <View style={s.rows}>{children}</View>;
}

/**
 * One row.
 *
 * The glyph well is a FIXED width whether or not there is a glyph in it, so a
 * panel of labelled actions and a panel of bare choices start on the same x —
 * the two swap in place, and a label that shifted left on the swap would read
 * as the sheet jumping.
 */
export function SheetRow({
  glyph = null,
  label,
  destructive = false,
  disabled = false,
  onPress,
}: {
  glyph?: React.ReactNode;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Tappable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[s.row, disabled && s.rowDisabled]}
      pressedStyle={s.rowPressed}
    >
      <View style={s.glyph}>{glyph}</View>
      <Text
        style={[
          textStyle(type.dangerAction),
          { color: destructive ? color.urgent : color.ink },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Tappable>
  );
}

/** An explanatory line under a group of rows. */
export function SheetNote({ children }: { children: React.ReactNode }) {
  return <Text style={[textStyle(type.gridMeta), s.note]}>{children}</Text>;
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

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sheet.menuTop,
    marginTop: space.sheet.top,
    paddingHorizontal: space.sheet.x,
  },
  // Pulled left by its own padding so the chevron lands on the sheet's gutter
  // while keeping a real target — the same trick the card's kebab uses.
  back: {
    width: size.sheet.menuIcon + space.sheet.menuTop,
    height: size.sheet.menuRow,
    marginLeft: -space.sheet.menuTop,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, color: color.ink },

  rows: { marginTop: space.sheet.menuTop, paddingHorizontal: space.sheet.x },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sheet.menuGap,
    height: size.sheet.menuRow,
  },
  rowPressed: { opacity: 0.6 },
  rowDisabled: { opacity: 0.45 },
  glyph: { width: size.sheet.menuIcon, alignItems: "center" },

  note: {
    marginTop: space.sheet.menuTop,
    paddingHorizontal: space.sheet.x,
    color: color.inkMuted,
  },

  footer: {
    marginTop: space.sheet.actionsTop,
    paddingHorizontal: space.sheet.x,
    paddingTop: space.sheet.actionsTop,
    borderTopWidth: border.hairline,
    borderTopColor: color.divider,
    alignItems: "center",
    justifyContent: "center",
    minHeight: size.sheet.action,
  },
  cancel: {
    alignSelf: "stretch",
    height: size.sheet.action,
    borderRadius: radius.primaryButton,
    borderWidth: border.chip,
    borderColor: color.controlLine,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelPressed: { backgroundColor: color.control },
});
