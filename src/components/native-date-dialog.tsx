import { Platform } from "react-native";

import { MAX_AGE, clampDay, todayParts, type DateParts } from "../lib/dob";

type PickerModule = typeof import("@react-native-community/datetimepicker");

/**
 * The system date picker, behind a load that cannot take the app down with it.
 *
 * ── WHAT THIS FILE IS AND IS NOT ────────────────────────────────────────────
 *
 * It is the NATIVE half only: the platform's own picker, plus the two
 * conversions it needs. It deliberately renders no chrome — no modal, no
 * header, no confirm button — because auth-sheet.tsx already owns all three and
 * a second set drawn here would be a second visual language for the same job.
 * iOS gets `NativeDateSpinner` to drop inside the sheet it already has; Android
 * gets `openAndroidDatePicker`, because there the picker IS a dialog and
 * wrapping a dialog in a sheet would stack two of them.
 *
 * Keeping the chrome out is also what keeps the import graph acyclic:
 * auth-sheet imports this file, and this file imports nothing of auth-sheet's.
 *
 * ── WHY THE REQUIRE IS GUARDED ──────────────────────────────────────────────
 *
 * Same reason as `media/video-kit.ts`, and on this project it is not a
 * hypothetical: the normal working state here is Metro serving fresh JS to an
 * installed shell that was built before the newest native module was added. A
 * top-level `import` of a missing native module throws during module
 * evaluation, before any error boundary exists, and the whole screen goes
 * blank. A guarded require turns that into `nativeDatePickerAvailable === false`
 * and the three-column picker that was already there keeps working.
 *
 * So the native picker is an ENHANCEMENT, never a dependency. Nothing in the
 * sign-up flow requires it to be present.
 *
 * ── DATE ↔ DateParts, AND WHY THE ROUND TRIP IS SAFE ────────────────────────
 *
 * `lib/dob.ts` explains at length why a date of birth is a {year, month, day}
 * triple and not a `Date`: a `Date` is an instant, and an instant crossing a
 * time zone can land on the previous day, which for somebody born exactly
 * eighteen years ago decides whether they are let in.
 *
 * The native pickers speak `Date`, so a conversion is unavoidable. It is safe
 * here for one specific reason: the `Date` is constructed and read back in the
 * SAME local zone, within one user interaction, and is never serialised. Local
 * midnight on the 3rd reads back as the 3rd on the device that made it. The
 * triple is what leaves this function, and `isoDate()` is still the only thing
 * that crosses the wire.
 */

let picker: PickerModule | null = null;
let failure: string | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const loaded = require("@react-native-community/datetimepicker") as PickerModule;

  // A resolved module is not a working one — Metro hands back a half-built
  // object when the native side is missing. Checked here, where the answer can
  // still be "use the picker that does not need native code".
  if (!loaded?.default) {
    failure = "datetimepicker resolved without a default export — native module missing";
  } else {
    picker = loaded;
  }
} catch (err) {
  failure = err instanceof Error ? err.message : String(err);
}

if (failure) {
  console.warn(`[dob] native date picker unavailable, using the column picker: ${failure}`);
}

/** True when the platform's own picker can be used. */
export const nativeDatePickerAvailable =
  picker !== null && (Platform.OS === "ios" || Platform.OS === "android");

/** Why it is not available. Null when it is. */
export const nativeDatePickerFailure = failure;

/**
 * The iOS inline picker, to be placed inside a sheet the caller already owns.
 *
 * Null on Android and when the module did not load. iOS renders the picker in
 * place rather than as a dialog, so it needs a host; that host is auth-sheet's
 * `ModalSheet`, which already has the title, the scrim and the safe-area
 * padding this would otherwise have to reinvent.
 */
export const NativeDateSpinner = Platform.OS === "ios" ? (picker?.default ?? null) : null;

/** Local midnight on that calendar day. Never serialised — see the note above. */
export function partsToDate(parts: DateParts): Date {
  return new Date(parts.year, parts.month - 1, parts.day);
}

/** The calendar day that `Date` names in the device's own zone. */
export function dateToParts(date: Date): DateParts {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

/**
 * The bounds both platforms get, and the same ones `selectableYears()` draws.
 *
 * The floor is `MAX_AGE` years back, and the ceiling is TODAY rather than the
 * 18-years-ago line. That is deliberate and matches the column picker: somebody
 * under 18 has to be able to enter their real date of birth and be told why the
 * answer is no. A picker that refused to show their birth year would leave them
 * guessing which field was wrong, and the rejection screen exists precisely so
 * the refusal is legible.
 */
export function dateBounds(): { minimumDate: Date; maximumDate: Date } {
  const today = todayParts();
  return {
    minimumDate: partsToDate(clampDay({ ...today, year: today.year - MAX_AGE })),
    maximumDate: partsToDate(today),
  };
}

/**
 * Opens Android's own date dialog. Returns false if it could not be attempted.
 *
 * ── TWO FAILURE PATHS, AND THEY ARE NOT THE SAME SHAPE ──────────────────────
 *
 * The return value covers only what is knowable SYNCHRONOUSLY: wrong platform,
 * module absent, `open()` throwing outright. The caller reads it on the same
 * tick and opens the column sheet instead, so the tap always does something.
 *
 * `onFailed` covers the rest. `open()` needs a live Activity and there are
 * moments — a dialog racing a screen transition, the app being torn down —
 * when there is not one, and the library reports that through `onError` some
 * time after `open()` has already returned. By then the boolean is long spent,
 * so the fallback needs its own way in. A caller that ignored `onFailed` would
 * leave a tap that appears to do nothing at all.
 *
 * `display: "spinner"` and not the calendar, because this is a date of BIRTH:
 * three wheels reach 1994 in one gesture, while a calendar grid starts on this
 * month and asks for about three hundred taps to get there.
 */
export function openAndroidDatePicker({
  value,
  onConfirm,
  onCancel,
  onFailed,
}: {
  value: DateParts;
  onConfirm: (next: DateParts) => void;
  onCancel: () => void;
  /** The native dialog failed after opening was attempted. Fall back. */
  onFailed: () => void;
}): boolean {
  const api = picker?.DateTimePickerAndroid;
  if (Platform.OS !== "android" || !api) return false;

  try {
    api.open({
      value: partsToDate(value),
      mode: "date",
      display: "spinner",
      ...dateBounds(),
      onValueChange: (_event, date) => onConfirm(dateToParts(date)),
      onDismiss: onCancel,
      onError: (err) => {
        console.warn("[dob] native date dialog failed, falling back:", err.message);
        onFailed();
      },
    });
  } catch (err) {
    console.warn(
      "[dob] native date dialog threw on open:",
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }

  return true;
}
