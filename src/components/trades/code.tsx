import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Text, TextInput, View, useWindowDimensions } from "react-native";

import * as copy from "./copy";
import { CODE_LENGTH } from "../../api/trades";
import { useReducedMotion } from "../offer/chrome";
import {
  offerBoard,
  offerBorder,
  offerColor,
  offerRadius,
  offerSize,
  offerSpace,
  offerType,
  textStyle,
} from "../../theme/offer-tokens";

/**
 * §6.1 — the two blocks of digits, and the arithmetic that makes them fit.
 *
 * ══ THE MOMENT THIS IS BUILT FOR ════════════════════════════════════════════
 *
 * Somebody is standing in a mall car park next to a stranger, about to hand over
 * a jacket. Three things have to be true at arm's length: the code is READABLE
 * across a table, entry is SIMPLE enough to do one-handed while holding a bag,
 * and WHOSE TURN IT IS is obvious without reading a sentence. §6.1's four states
 * are that last requirement written down, and the layout order is how it is
 * answered — the block you have to act on is on top, always.
 *
 * ══ SIX CELLS, NOT FOUR, AND WHAT THAT COSTS ════════════════════════════════
 *
 * §6.1 and every frame draw four digits. The server issues six —
 * `randomDigits(6)` in `confirm/start`, `^\\d{6}$` in `confirmSubmitSchema` — so
 * a four-cell entry is a control that can never succeed. `CODE_LENGTH` is the
 * one place that count lives.
 *
 * Six cells do not fit at the spec's widths. 6 × 68 + 5 × 12 is 468 into the 358
 * a 390 device leaves inside its gutters, and 6 × 56 + 5 × 14 is 406 into the
 * same 358. So the WIDTH flexes and everything else holds:
 *
 *   HEIGHT       72 display, 84 entry — §4's figures, untouched.
 *   RADIUS       8 — §3.7, untouched.
 *   TYPE         40px mono +4 on the display, 34px mono +3 on entry — §2,
 *                untouched. A 40px JetBrains digit advances ~24px, so it clears
 *                a 48-wide cell with room; the type never shrinks.
 *   FILL / RULE  `#EDEBE3` display, 1px `#E2E0D6` entry, 1.5px `#1B4D2B` active
 *                — §1.5 and §1.6, untouched.
 *
 * At `CODE_LENGTH = 4` the arithmetic lands back on 56 and 68 exactly, because
 * both are capped at the spec's own figure. The day the server issues four
 * digits this file is pixel-identical to §6.1 with no edit.
 *
 * ══ ENTRY IS ONE HIDDEN FIELD, NOT SIX ══════════════════════════════════════
 *
 * Six `TextInput`s means six focus states, a backspace that has to hop
 * backwards by hand, and a paste that lands entirely in the first box. One
 * transparent field over the whole row means the OS does all of that — selection,
 * backspace, paste, the numeric pad — and the cells are a drawing of its value.
 *
 * NO `autoComplete="one-time-code"`. That reads a code out of an SMS, and this
 * one arrives by email; declaring it would put an autofill bar over the keyboard
 * that never fills anything.
 */

/* ─────────────────────────── the cell arithmetic ────────────────────── */

/**
 * How wide one cell is, given how many there are and how much room there is.
 *
 * Capped at the spec's width so a four-digit code is drawn at exactly §4's
 * figures; floored at 40 so a hypothetical longer code degrades into something
 * still touchable rather than into slivers.
 */
function cellWidth(available: number, count: number, gap: number, max: number): number {
  const fits = (available - gap * (count - 1)) / count;
  return Math.max(40, Math.min(max, Math.floor(fits)));
}

/** The width inside the screen's gutters, which is what §4's 358 and §9's 328 are. */
function useTrackWidth(): number {
  const { width } = useWindowDimensions();
  return width - offerSpace.screenX * 2;
}

/** §9's board, for the two cell sizes that shrink at 360. */
function useCodeBoard() {
  const { width } = useWindowDimensions();
  return width <= offerBoard.breakpoint ? offerBoard.tight : offerBoard.wide;
}

/* ──────────────────────── §6.1 the display block ────────────────────── */

/**
 * The viewer's OWN code, at 40px mono in `#EDEBE3` cells.
 *
 * ── `code` IS NULL, ALWAYS, AND THAT IS NOT A BUG IN THIS COMPONENT ─────────
 *
 * The plaintext of a confirmation code exists in exactly two places: the email
 * `confirm/start` sends, and a bcrypt hash in `SwapConfirmationCode`. No route
 * returns it and none could — the hash is one-way, deliberately, for the reason
 * `swap-code.ts` gives about a participant with partial observation of the
 * stream that produced their partner's code.
 *
 * So this component takes `string | null` rather than `string`. Given digits it
 * draws §6.1 exactly. Given null it says where the code actually is, in one
 * sentence written to §10's rules — no apology, no `unfortunately`, states the
 * fact and hands over the route. Four invented digits would be worse than any
 * sentence: somebody would read them out across a table and the trade would
 * fail on the other person's phone.
 *
 * `ownCode()` in `src/api/trades.ts` reads it off `confirm/status`, which does
 * return it now — the caller's own row only, never the partner's. THIS COMPONENT
 * DID NOT CHANGE WHEN THAT LANDED, which was the point of taking `string | null`
 * from the start: every one of §6.1's four states was already drawn for both
 * branches, so turning the field on was one function body.
 */
export function CodeDisplay({
  code,
  partner,
  spent,
}: {
  code: string | null;
  partner: string;
  /** True once the partner has typed this code in. Frame 9g's second block. */
  spent?: boolean;
}) {
  const board = useCodeBoard();
  const track = useTrackWidth();
  const gap = offerSize.codeDisplay.gap;
  const w = cellWidth(track, CODE_LENGTH, gap, board.codeDisplay.w);
  const h = board.codeDisplay.h;

  if (!code) {
    return (
      <View style={{ gap: 10 }}>
        <Text style={[textStyle(offerType.body), { color: offerColor.ink }]}>
          {copy.code.whereYourCodeIs(partner)}
        </Text>
        {spent ? (
          <Text style={[textStyle(offerType.helper), { color: offerColor.inkTertiary }]}>
            {copy.code.alreadyTyped(partner)}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <View
        style={{ flexDirection: "row", gap }}
        // Read as one number, not as six separate cells. A screen reader walking
        // "4, 1, 8, 2, 6, 0" as six labels is unusable in the situation this
        // screen exists for.
        accessible
        accessibilityLabel={`Your code is ${code.split("").join(" ")}`}
      >
        {code.split("").map((digit, i) => (
          <View
            key={i}
            style={{
              width: w,
              height: h,
              borderRadius: offerRadius.codeCell,
              backgroundColor: offerColor.quiet,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={[
                textStyle(offerType.codeDigits),
                {
                  color: offerColor.ink,
                  // The tracking is trailing space on the last glyph as well as
                  // between them, so the digit sits 2px right of centre in its
                  // own box. Pulling it back is what centres the FIGURE rather
                  // than centring the figure-plus-its-tracking.
                  marginLeft: offerType.codeDigits.letterSpacing,
                },
              ]}
            >
              {digit}
            </Text>
          </View>
        ))}
      </View>
      {spent ? (
        <Text style={[textStyle(offerType.helper), { color: offerColor.inkTertiary }]}>
          {copy.code.alreadyTyped(partner)}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * §6.1's collapsed form: `Your code is 4182` as one 15px line, not a block.
 *
 * §6.1's "They're waiting for you" state drops the display block to this, so the
 * entry cells get the top of the screen. Same null case as `CodeDisplay`.
 */
export function CodeDisplayLine({ code }: { code: string | null }) {
  return (
    <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
      {code ? `Your code is ${code}` : copy.code.whereYourCodeIsShort}
    </Text>
  );
}

/* ───────────────────────── §6.1 the entry block ─────────────────────── */

/** What `useCodeEntry` hands the screen. */
export interface CodeEntryState {
  value: string;
  setValue: (next: string) => void;
  clear: () => void;
  complete: boolean;
  focused: boolean;
  setFocused: (on: boolean) => void;
  inputRef: React.RefObject<TextInput | null>;
  focus: () => void;
}

/**
 * The entry field's state, and the one rule it enforces: digits only, capped.
 *
 * `replace(/\D/g, "")` rather than a numeric keyboard alone. The number pad on
 * Android carries a comma or a minus on some OEM skins, and a paste can carry
 * anything at all — a code copied out of an email arrives with a trailing space
 * more often than not.
 */
export function useCodeEntry(): CodeEntryState {
  const [value, setRaw] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput | null>(null);

  const setValue = useCallback((next: string) => {
    setRaw(next.replace(/\D/g, "").slice(0, CODE_LENGTH));
  }, []);

  const clear = useCallback(() => setRaw(""), []);
  const focus = useCallback(() => inputRef.current?.focus(), []);

  return {
    value,
    setValue,
    clear,
    complete: value.length === CODE_LENGTH,
    focused,
    setFocused,
    inputRef,
    focus,
  };
}

/**
 * The partner's digits, typed in. §4: cells 68 × 84, radius 8, 1px `#E2E0D6`,
 * active cell 1.5px `#1B4D2B`, 34px mono.
 *
 * ── §6.1's WRONG-CODE STATE IS THREE PROPERTIES AND NO MORE ─────────────────
 *
 * "Cells keep their digits, underline `#C56A4B`, mono counter `#C56A4B`: `Not a
 * match · 2 tries left`. No shake, no toast."
 *
 * THE DIGITS STAY. Frame 9g's note says why, and it is the whole of the
 * reasoning: clearing them would make the other person read all six out again,
 * standing there, for a mistake that was probably one transposed digit. So
 * `rejected` recolours the rule and changes nothing else — the caller clears the
 * value only when the code is burned and a new pair has to be issued.
 *
 * NO SHAKE. A shake is an animation that says "wrong" to somebody who is already
 * looking at the word. §11 has no entry for it, and §1.10 rules out the toast in
 * the same breath.
 */
export function CodeEntry({
  entry,
  rejected,
  onSubmit,
  label,
}: {
  entry: CodeEntryState;
  /** §6.1's wrong-code treatment: the rule goes terracotta, nothing else moves. */
  rejected?: boolean;
  onSubmit?: () => void;
  /** The accessible name for the whole field. */
  label: string;
}) {
  const board = useCodeBoard();
  const track = useTrackWidth();
  const gap = 12;
  const w = cellWidth(track, CODE_LENGTH, gap, board.codeEntry.w);
  const h = board.codeEntry.h;

  // The cell the next digit lands in. Clamped so a full value keeps the caret in
  // the last cell rather than pointing past the end of the row.
  const active = Math.min(entry.value.length, CODE_LENGTH - 1);

  return (
    <View>
      <View style={{ flexDirection: "row", gap }}>
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const digit = entry.value[i];
          const isActive = entry.focused && i === active;
          return (
            <View
              key={i}
              style={{
                width: w,
                height: h,
                borderRadius: offerRadius.codeCell,
                borderWidth: rejected
                  ? offerBorder.promise
                  : isActive
                    ? offerBorder.selected
                    : offerBorder.rule,
                borderColor: rejected
                  ? offerColor.promise
                  : isActive
                    ? offerColor.selected
                    : offerColor.rule,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {digit ? (
                <Text
                  style={[
                    textStyle(offerType.codeEntry),
                    { color: offerColor.ink, marginLeft: offerType.codeEntry.letterSpacing },
                  ]}
                >
                  {digit}
                </Text>
              ) : isActive ? (
                <Caret />
              ) : null}
            </View>
          );
        })}
      </View>

      {/*
        The real field, transparent, over the whole row.

        `opacity: 0` rather than `position: absolute` off-screen: an off-screen
        input is what TalkBack cannot reach, and this element IS the control —
        it carries the accessible name and takes the focus. Zero opacity keeps it
        in the tree, in place, and hit-testable.

        `caretHidden` because the caret is drawn in the cell. `contextMenuHidden`
        because a long-press menu offering "Share" on a confirmation code is an
        invitation nobody needs at a meet-up.
      */}
      <TextInput
        ref={entry.inputRef}
        value={entry.value}
        onChangeText={entry.setValue}
        onFocus={() => entry.setFocused(true)}
        onBlur={() => entry.setFocused(false)}
        onSubmitEditing={onSubmit}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={CODE_LENGTH}
        caretHidden
        contextMenuHidden
        accessibilityLabel={label}
        accessibilityHint={`${CODE_LENGTH} digits`}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: h,
          opacity: 0,
          // A zero-opacity field still shows a selection highlight on some
          // Android builds if it has a text colour, so it is given none.
          color: "transparent",
        }}
      />
    </View>
  );
}

/**
 * §11's caret: 2 × 34, `#3DBE5A`, blinking.
 *
 * The frame animates it `1.1s steps(1,end)` — a hard on/off, not a fade, which
 * is what a text caret does everywhere else in the OS. `prefers-reduced-motion`
 * holds it solid rather than running a zeroed animation, which is §11's own rule
 * for every transition in this system: a zeroed duration still runs a loop.
 *
 * `useNativeDriver: true` — opacity is one of the two properties the native
 * driver carries, and this loop runs for as long as somebody has the field open.
 */
function Caret() {
  const reduced = useReducedMotion();
  const blink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduced) {
      blink.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0, duration: 0, delay: 550, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 0, delay: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, blink]);

  return (
    <Animated.View
      style={{
        width: offerSize.amountField.caretW,
        height: offerSize.amountField.caretH,
        backgroundColor: offerColor.green,
        opacity: blink,
      }}
    />
  );
}

/**
 * §6.1's counter: `Not a match · 2 tries left`, mono, `#C56A4B`.
 *
 * The count is the SERVER's `remaining`, never a local tally. §6.1 writes "2
 * tries left" against a budget of three; `MAX_CODE_ATTEMPTS` on the server is
 * five, and a screen counting its own guesses would disagree with the row that
 * actually decides — including across a reinstall, a second device, or the
 * partner's own attempts on the same code.
 *
 * `remaining: null` means the server sent no count, which happens on the 429
 * that ends the budget. The plain form says the same thing without a number it
 * does not have.
 */
export function CodeCounter({ remaining }: { remaining: number | null }) {
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[textStyle(offerType.leavesRow), { color: offerColor.warm }]}
    >
      {remaining === null ? copy.code.notAMatchPlain : copy.code.notAMatch(remaining)}
    </Text>
  );
}
