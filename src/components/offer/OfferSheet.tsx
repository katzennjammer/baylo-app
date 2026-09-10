import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type FilterFunction,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton, useReducedMotion } from "./chrome";
import {
  offerBorder,
  offerColor,
  offerMotion,
  offerRadius,
  offerSize,
  offerSpace,
  offerType,
  textStyle,
} from "../../theme/offer-tokens";

/**
 * The bottom sheet this flow uses, and why it is not `sheet-ui.tsx`'s.
 *
 * `SheetShell` is built for one shape — a title, a column of tappable rows and
 * a Cancel — and its own header says the sheets whose bodies are not that were
 * deliberately left off it. Both sheets in this spec are not that:
 *
 *   the item picker    a 21px BRICOLAGE heading, a subtitle, radio rows, a
 *                      footnote AND a primary button. `SheetShell`'s footer is
 *                      a text Cancel and its title is 18px Public Sans.
 *   the reach prompt   §7.4 — no close control at all, not dismissible by a
 *                      scrim tap, and a fixed 512px height.
 *
 * Bending one shell around both would give it six escape hatches, which is the
 * trade `sheet-ui.tsx` already declined once. What IS shared is the geometry and
 * the motion, and that lives here rather than being written twice.
 *
 * ── THE MOTION IS §11's, NOT `animationType="slide"`'s ──────────────────────
 *
 * §11 gives the sheet a 260ms translateY and the scrim a 180ms fade — two
 * different durations on two different properties, which `Modal`'s built-in
 * slide cannot express (it moves the whole modal, scrim included, on its own
 * curve). So the Modal is `animationType="none"` and both are driven here.
 * Under `prefers-reduced-motion` §11 makes them instant, which is a `setValue`
 * rather than a zeroed duration — a zeroed duration still schedules frames.
 */

/* ────────────────────────────── the shell ───────────────────────────── */

export function OfferSheet({
  /**
   * §7.4's prompt is `dismissible: false` — no X, and a scrim tap does nothing,
   * "so it can't be missed by accident". The picker is dismissible like any
   * other sheet.
   */
  dismissible,
  onDismiss,
  /** §3.6 fixes the prompt's height at 512. The picker hugs its content. */
  height,
  children,
}: {
  dismissible: boolean;
  onDismiss: () => void;
  height?: number;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const slide = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduced) {
      slide.setValue(0);
      return;
    }
    const anim = Animated.timing(slide, {
      toValue: 0,
      duration: offerMotion.sheetInMs,
      // Nothing bounces — §11. `Easing.out(cubic)` decelerates into place
      // without overshooting, which `Easing.elastic` and `back` both do.
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduced, slide]);

  const scrimOpacity = reduced
    ? 1
    : slide.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Modal
      visible
      transparent
      animationType="none"
      // Android's hardware back. It closes a dismissible sheet and is a no-op on
      // the prompt, which matches §7.4 exactly — `Got it` is the only way out.
      onRequestClose={dismissible ? onDismiss : () => {}}
      statusBarTranslucent
    >
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: offerColor.scrim,
          justifyContent: "flex-end",
          opacity: scrimOpacity,
        }}
      >
        {/* A plain Pressable — it has no held state to draw, so `Tappable`
            would be ceremony. On the prompt it is present and inert, which is
            what stops a stray tap behind the sheet reaching the grid. */}
        <Pressable
          style={{ flex: 1 }}
          onPress={dismissible ? onDismiss : undefined}
          accessibilityLabel={dismissible ? "Close" : undefined}
          // Not announced as a control when it does nothing.
          accessibilityElementsHidden={!dismissible}
          importantForAccessibility={dismissible ? "yes" : "no-hide-descendants"}
        />

        <Animated.View
          style={{
            height,
            backgroundColor: offerColor.paper,
            borderTopLeftRadius: offerRadius.sheet,
            borderTopRightRadius: offerRadius.sheet,
            paddingBottom: Math.max(offerSpace.prompt.bottom, insets.bottom),
            transform: [
              {
                translateY: reduced
                  ? 0
                  : slide.interpolate({
                      inputRange: [0, 1],
                      // The sheet's own height is not known before layout, so
                      // the travel is the prompt's 512 — long enough that
                      // either sheet starts fully off-screen and short enough
                      // that the 260ms reads as a slide rather than a launch.
                      outputRange: [0, offerSpace.prompt.height],
                    }),
              },
            ],
          }}
        >
          {/* §1.1's `surface/quiet` handle track. Present on both sheets: it
              says "this is a sheet" even where it cannot be dragged, and §3.6
              measures the prompt's first gap from it. */}
          <View style={{ alignItems: "center", paddingTop: 10 }}>
            <View
              style={{
                width: offerSize.handle.w,
                height: offerSize.handle.h,
                borderRadius: offerSize.handle.h / 2,
                backgroundColor: offerColor.quiet,
              }}
            />
          </View>

          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/* ─────────────────────── §7.4 the one-time prompt ───────────────────── */

/**
 * `Why some listings look faded`, once per account.
 *
 * §7.4's rules, all four honoured: it is triggered on the first marketplace
 * entry whose visible grid contains at least one out-of-reach tile; it is
 * dismissed ONLY by `Got it`; it is never shown again, including after the
 * threshold moves; and the flag is `seen_reach_explainer`.
 *
 * The example pair is the one place this flow puts a swatch beside a word — two
 * mono labels, `within reach` and `further off`, each next to a small block in
 * the treatment it names. §10.8 writes them as mono, so they are mono, and the
 * greyed one carries the same `filter` the tiles do rather than a hand-picked
 * grey: if §1.9's treatment is tuned, the legend moves with it.
 */
export function ReachPromptSheet({
  heading,
  body,
  exampleNear,
  exampleFar,
  steps,
  button,
  onGotIt,
  photoFilter,
}: {
  heading: string;
  body: string;
  exampleNear: string;
  exampleFar: string;
  steps: readonly string[];
  button: string;
  onGotIt: () => void;
  /** `outOfReach.photoFilter`, threaded so the legend cannot drift from §1.9. */
  photoFilter: readonly FilterFunction[];
}) {
  const p = offerSpace.prompt;

  return (
    <OfferSheet dismissible={false} onDismiss={onGotIt} height={p.height}>
      <View style={{ paddingHorizontal: p.x, paddingTop: p.handleToHeading, flex: 1 }}>
        <Text style={[textStyle(offerType.sheetHeading), { color: offerColor.ink }]}>{heading}</Text>

        <Text
          style={[
            textStyle(offerType.body),
            { color: offerColor.inkSecondary, marginTop: p.headingToBody },
          ]}
        >
          {body}
        </Text>

        {/* The example pair. Two swatches at the tile photo's own radius, so
            they read as miniature tiles rather than as colour chips. */}
        <View
          style={{
            marginTop: p.bodyToExamples,
            flexDirection: "row",
            alignItems: "center",
            gap: 20,
          }}
        >
          <Swatch label={exampleNear} />
          <Swatch label={exampleFar} filter={photoFilter} />
        </View>

        <View style={{ marginTop: p.examplesToList, gap: p.listItemGap }}>
          {steps.map((step, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 12 }}>
              <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}>
                {String(i + 1).padStart(2, "0")}
              </Text>
              <Text
                style={[textStyle(offerType.bodyDense), { color: offerColor.inkSecondary, flex: 1 }]}
              >
                {step}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <View style={{ marginTop: p.listToButton }}>
          <PrimaryButton label={button} onPress={onGotIt} />
        </View>
      </View>
    </OfferSheet>
  );
}

function Swatch({ label, filter }: { label: string; filter?: readonly FilterFunction[] }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: offerRadius.tile,
          backgroundColor: offerColor.photoPlaceholder,
          borderWidth: offerBorder.rule,
          borderColor: offerColor.rule,
          // The greyed swatch wears §1.9's own filter list, not a substitute.
          ...(filter ? { filter } : {}),
        }}
      />
      <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}>
        {label}
      </Text>
    </View>
  );
}

/* ───────────────────────── the picker's own body ────────────────────── */

/**
 * §10.1's item picker.
 *
 * ── ONE SELECTION, OR SEVERAL ───────────────────────────────────────────────
 *
 * §4 gives the row a "22px radio", which is one selection. §10.2's very-large-
 * gap route is `Offer more than one item` with the subtitle `Your four items
 * together come to 1,620.`, which is several — and POST /api/offers takes an
 * `offeredItems` ARRAY (up to 20), so the endpoint has always allowed it.
 *
 * So the control is the same 22px mark in both modes and only its semantics
 * change: `radio` when one item is being chosen, `checkbox` when the route that
 * asked for several opened the sheet. Nothing about the drawing moves, which is
 * why this is one component rather than two.
 *
 * ── AN ITEM WITH NO VALUE IS SHOWN AND NOT HIDDEN ───────────────────────────
 *
 * `valueLeaves: null` means the value did not come back — see gap 1 in
 * `src/api/offer.ts` — not that the item is worth nothing. Hiding it would
 * shorten the picker, which reads as "that listing is gone". It is listed with
 * the reason in place of the figure and cannot be selected, because the gap
 * arithmetic has nothing to work from.
 */
export interface PickerItem {
  id: string;
  title: string;
  image: string | null;
  valueLeaves: number | null;
}

export function PickerBody({
  heading,
  subtitle,
  footnote,
  buttonLabel,
  children,
  onUse,
  canUse,
}: {
  heading: string;
  subtitle: string;
  footnote: string;
  buttonLabel: string;
  children: React.ReactNode;
  onUse: () => void;
  canUse: boolean;
}) {
  const p = offerSpace.prompt;

  return (
    <View style={{ paddingTop: p.handleToHeading }}>
      <View style={{ paddingHorizontal: p.x }}>
        <Text style={[textStyle(offerType.sheetHeading), { color: offerColor.ink }]}>{heading}</Text>
        <Text
          style={[
            textStyle(offerType.body),
            { color: offerColor.inkSecondary, marginTop: p.headingToBody },
          ]}
        >
          {subtitle}
        </Text>
      </View>

      {/* The rows scroll and the heading and button do not. A shelf of thirty
          listings is normal and a sheet that grew past the screen would put
          `Use this item` off the bottom. `maxHeight` rather than a fixed one, so
          a two-item shelf produces a short sheet instead of a mostly empty one. */}
      <ScrollView
        style={{ maxHeight: 360, marginTop: p.bodyToExamples }}
        contentContainerStyle={{ paddingHorizontal: p.x, gap: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      <View style={{ paddingHorizontal: p.x, paddingTop: p.examplesToList }}>
        <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}>
          {footnote}
        </Text>

        <View style={{ marginTop: p.listToButton }}>
          {/*
            §5.1's "no disabled send" is about the SEND, not about this. A picker
            whose button fired with nothing chosen would open a gap screen with
            no item in it, so the control is genuinely unavailable until
            something is selected — and it says so by being inert rather than by
            being absent, because an appearing button moves the sheet's layout.
          */}
          {canUse ? (
            <PrimaryButton label={buttonLabel} onPress={onUse} />
          ) : (
            <View
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              accessibilityLabel={`${buttonLabel}. Choose an item first.`}
              style={{
                height: offerSize.button.primary,
                borderRadius: offerRadius.button,
                backgroundColor: offerColor.quiet,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={[textStyle(offerType.buttonPrimary), { color: offerColor.inkTertiary }]}
              >
                {buttonLabel}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
