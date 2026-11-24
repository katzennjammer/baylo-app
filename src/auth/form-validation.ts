import type { DateParts } from "../lib/dob";

/**
 * Sign-up and sign-in form rules, kept free of React and React Native so they
 * can be unit-tested (tests/unit). Moved verbatim out of app/(auth)/register.tsx
 * and app/(auth)/login.tsx; behaviour is unchanged.
 */

export interface FormState {
  name: string;
  email: string;
  password: string;
  confirm: string;
  dob: DateParts | null;
}

export interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
  dateOfBirth?: string;
}

/**
 * Client-side validation, matching the server's schema rather than guessing at
 * it.
 *
 * The server is the authority — `registerSchema` in `../baylo/src/lib/
 * validation.ts` — and these rules are a copy of it, kept deliberately narrow:
 * a non-empty name up to 100 characters, something with an @ in it, eight
 * characters of password, and a real past date of birth. Validating MORE than
 * the server does is the trap. A client that insists on a symbol and a digit
 * rejects passwords the backend would have accepted, and the user has no way to
 * discover that the rule is imaginary.
 *
 * The confirm field has no server counterpart at all — the server never sees it
 * — which is exactly why it must be checked here.
 *
 * THE AGE RULE IS NOT IN HERE. It is checked at submission and answered with a
 * whole screen rather than a red line under a field, because "you are sixteen"
 * is not the same kind of problem as "that is not an email address" and putting
 * them in the same list would say that it is.
 */
export function validate(input: FormState, copy: FormCopy): FieldErrors {
  const errors: FieldErrors = {};

  if (!input.name.trim()) errors.name = copy.nameMissing;
  else if (input.name.trim().length > 100) errors.name = "That name is too long (100 max).";

  // Loose on purpose. The server's zod `.email()` is the real check, and a
  // stricter regex here would reject valid addresses nobody can then explain.
  if (!input.email.trim()) errors.email = "Enter your email.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))
    errors.email = "That does not look like an email address.";

  if (input.password.length < 8) errors.password = "At least 8 characters.";

  if (!input.confirm) errors.confirm = "Type your password again.";
  else if (input.confirm !== input.password) errors.confirm = "These don't match yet.";

  if (!input.dob) errors.dateOfBirth = copy.dobMissing;

  return errors;
}

/**
 * The form's words, for a person and for an MSME owner.
 *
 * The account being created is the OWNER's own login either way — the
 * organisation is a separate row made on the next step — so the fields do not
 * change, only whose they say they are. Email, password and confirm are not in
 * here: they are the login either way, and "Owner's email" read as a separate
 * business contact address, just as "the owner's password" would suggest the
 * business has one of its own.
 */
export interface FormCopy {
  headline: string;
  subhead: string;
  name: string;
  nameMissing: string;
  dob: string;
  dobMissing: string;
}

export const INDIVIDUAL_COPY: FormCopy = {
  headline: "Create your account",
  subhead: "Set up once, then trade for good.",
  name: "Full name",
  nameMissing: "Enter your name.",
  dob: "Date of birth",
  dobMissing: "Pick your date of birth.",
};

export const OWNER_COPY: FormCopy = {
  headline: "Owner's details",
  subhead: "Your business details come next.",
  name: "Owner's full name",
  nameMissing: "Enter the owner's name.",
  dob: "Owner's date of birth",
  dobMissing: "Pick the owner's date of birth.",
};

/** The Log in button is live once both fields have something in them. */
export function canSubmitLogin(email: string, password: string): boolean {
  return email.trim().length > 0 && password.length > 0;
}
