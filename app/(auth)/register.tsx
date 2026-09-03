import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { router } from "expo-router";

import {
  ApiError,
  authenticate,
  registerAccount,
  resendVerification,
} from "../../src/api/client";
import { getApiBase } from "../../src/api/config";
import { ApiUrlGear } from "../../src/components/ApiUrlGear";
import { useSession } from "../../src/auth/session";
import type { StoredSession } from "../../src/auth/storage";
import { UnderAgeSheet } from "../../src/components/auth-under-age";
import {
  AuthScreen,
  BandBackButton,
  BandRow,
  Banner,
  Body,
  CompactHeader,
  DateOfBirthField,
  Declaration,
  DevChip,
  Field,
  FooterPrompt,
  Headline,
  LegalCopy,
  PrimaryButton,
  Subhead,
  Wordmark,
  bandHeight,
  gap,
  keyboardRule,
  useKeyboardState,
} from "../../src/components/auth-sheet";
import { MIN_AGE, isAdult, isoDate, type DateParts } from "../../src/lib/dob";

/**
 * Create an account, and the two screens that hang off it.
 *
 * ── THE SHAPE OF THIS SCREEN IS DECIDED BY TWO SERVER FACTS ─────────────────
 *
 * First, /api/auth/register returns no tokens. Registration and authentication
 * are separate on this backend, so this screen registers and then immediately
 * calls authenticate() with the credentials it already has in state — one extra
 * round trip, and no password is stored anywhere it was not already.
 *
 * Second, /api/auth/resend-verification is AUTHENTICATED. It has to be: taking
 * an email address in the body would make it an open relay for mailing
 * arbitrary addresses and an account-existence oracle at the same time. So the
 * resend button needs a session — which is why this screen holds one without
 * installing it. Installing it would trip the guard in (auth)/_layout, which
 * redirects the instant a session exists, and the user would be thrown into the
 * app mid-sentence without ever reading what the email is for. The pending pair
 * lives in state; `Continue` is what adopts it.
 *
 * Login is not gated on verification, so nothing here is a wall. Verifying
 * unlocks the welcome grant; not verifying costs only that.
 *
 * ── THE FORM'S STATE LIVES IN THE PARENT, AND THAT IS LOAD-BEARING ──────────
 *
 * An under-18 date of birth swaps the form out for the rejection screen, and
 * the rejection screen's primary action is "correct my date of birth" — which
 * has to come back to a form that still has the other four fields in it.
 * Holding the fields one level up is what makes that a state change rather than
 * a re-typing exercise. It is also why the rejection is checked BEFORE
 * anything is posted: nothing has been created, so there is nothing to undo.
 */

/**
 * The welcome grant, in Leaves.
 *
 * A SERVER FACT, NOT A DESIGN VALUE. The backend pays this in
 * `../baylo/src/lib/verification.ts`, gated on `signupGrantClaimed`, and a
 * screen that promises a different number than the API pays is a bug no amount
 * of visual polish covers. It lives here as a named constant so the next person
 * to change the grant has one obvious place to look, and it should become an
 * API-supplied value the first time the two are allowed to disagree.
 */
const WELCOME_GRANT_LEAVES = 50;

interface PendingSignup {
  email: string;
  /** A real, valid session — deliberately NOT installed. See the note above. */
  session: StoredSession | null;
  /** False when the server could not send the mail. Offer a resend at once. */
  emailSent: boolean;
}

interface FormState {
  name: string;
  email: string;
  password: string;
  confirm: string;
  dob: DateParts | null;
}

const EMPTY_FORM: FormState = { name: "", email: "", password: "", confirm: "", dob: null };

export default function RegisterScreen() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [pending, setPending] = useState<PendingSignup | null>(null);
  const [refused, setRefused] = useState<DateParts | null>(null);

  if (refused) {
    return (
      <UnderAgeSheet
        dob={refused}
        onCorrect={() => setRefused(null)}
        secondary={{ label: "Back to sign in", onPress: () => router.back() }}
        onBack={() => setRefused(null)}
      />
    );
  }

  if (pending) return <CheckYourEmail state={pending} />;

  return (
    <RegisterForm
      form={form}
      setForm={setForm}
      onRegistered={setPending}
      onRejected={setRefused}
    />
  );
}

// ── The form ─────────────────────────────────────────────────────────────────

interface FieldErrors {
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
function validate(input: FormState): FieldErrors {
  const errors: FieldErrors = {};

  if (!input.name.trim()) errors.name = "Enter your name.";
  else if (input.name.trim().length > 100) errors.name = "That name is too long (100 max).";

  // Loose on purpose. The server's zod `.email()` is the real check, and a
  // stricter regex here would reject valid addresses nobody can then explain.
  if (!input.email.trim()) errors.email = "Enter your email.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))
    errors.email = "That does not look like an email address.";

  if (input.password.length < 8) errors.password = "At least 8 characters.";

  if (!input.confirm) errors.confirm = "Type your password again.";
  else if (input.confirm !== input.password) errors.confirm = "These don't match yet.";

  if (!input.dob) errors.dateOfBirth = "Pick your date of birth.";

  return errors;
}

function RegisterForm({
  form,
  setForm,
  onRegistered,
  onRejected,
}: {
  form: FormState;
  setForm: (next: FormState) => void;
  onRegistered: (p: PendingSignup) => void;
  onRejected: (dob: DateParts) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Which of the five the caret is in, for the compact header's counter. */
  const [focusedField, setFocusedField] = useState(1);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // Read one level ABOVE <AuthScreen>, because the layout it selects is passed
  // to that component as props. See `useKeyboardState`.
  const { keyboardUp, tallIme } = useKeyboardState();

  /** Clears one field's error as it is edited. Nothing is angrier than a form
   *  that keeps shouting about something already fixed. */
  function edit<K extends keyof FormState>(key: K, errorKey: keyof FieldErrors) {
    return (value: FormState[K]) => {
      setForm({ ...form, [key]: value });
      setFieldErrors((prev) => (prev[errorKey] ? { ...prev, [errorKey]: undefined } : prev));
      if (banner) setBanner(null);
    };
  }

  async function onSubmit() {
    if (busy) return;

    const errors = validate(form);
    if (Object.values(errors).some(Boolean)) {
      setFieldErrors(errors);
      setBanner(null);
      return;
    }

    // The gate, before anything is posted. The server enforces the same rule —
    // a client-only check is one anybody can skip by calling the endpoint
    // directly — but doing it here first means the refusal is instant and no
    // half-made account is left behind by it.
    if (form.dob && !isAdult(form.dob)) {
      onRejected(form.dob);
      return;
    }

    setBusy(true);
    setFieldErrors({});
    setBanner(null);

    const trimmedEmail = form.email.trim();

    try {
      const created = await registerAccount({
        name: form.name.trim(),
        email: trimmedEmail,
        password: form.password,
        dateOfBirth: isoDate(form.dob!),
      });

      // Sign in straight away, and DO NOT install the session — the resend
      // button on the next step needs a Bearer token, and the (auth) guard
      // would redirect the moment one existed. A failure here is not a failed
      // registration: the account is created either way, so the next step is
      // shown regardless, just without a resend option.
      let session: StoredSession | null = null;
      try {
        session = await authenticate(trimmedEmail, form.password);
      } catch {
        session = null;
      }

      onRegistered({
        email: created.email,
        session,
        emailSent: created.verificationEmailSent,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        // The server reached the same conclusion the client did, which in
        // practice means a clock disagreement or a client older than the rule.
        // Its answer wins, and it gets the same screen.
        if (err.code === "UNDER_18" && form.dob) {
          onRejected(form.dob);
          return;
        }

        // A 400 from parseBody() names the field it rejected. Put it there.
        const fromServer: FieldErrors = {
          name: err.issueFor("name"),
          email: err.issueFor("email"),
          password: err.issueFor("password"),
          dateOfBirth: err.issueFor("dateOfBirth"),
        };

        if (Object.values(fromServer).some(Boolean)) {
          setFieldErrors(fromServer);
        } else if (err.status === 409) {
          // "Email already in use" is about one field, and the server does not
          // send it as an issue. Route it to the field anyway — with a way out,
          // since the likeliest reader is somebody who already has an account.
          setFieldErrors({ email: "That email already has an account." });
          setBanner("Already registered? Go back and log in instead.");
        } else {
          setBanner(
            err.status === 429 ? `${err.message}${retrySuffix(err.retryAfter)}` : err.message,
          );
        }
      } else {
        setBanner("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  const reveal = { visible: showPassword, onToggle: () => setShowPassword((v) => !v) };

  const fields = (
    <>
      <Field
        label="Full name"
        value={form.name}
        onChangeText={edit("name", "name")}
        onFocus={() => setFocusedField(1)}
        error={fieldErrors.name}
        autoCapitalize="words"
        autoComplete="name"
        autoCorrect={false}
        editable={!busy}
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        submitBehavior="submit"
      />

      <View style={{ height: gap.betweenInputs }} />
      <Field
        ref={emailRef}
        label="Email"
        value={form.email}
        onChangeText={edit("email", "email")}
        onFocus={() => setFocusedField(2)}
        error={fieldErrors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        autoCorrect={false}
        editable={!busy}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />

      <View style={{ height: gap.betweenInputs }} />
      <Field
        ref={passwordRef}
        label="Password"
        value={form.password}
        onChangeText={edit("password", "password")}
        onFocus={() => setFocusedField(3)}
        error={fieldErrors.password}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        editable={!busy}
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        submitBehavior="submit"
        reveal={reveal}
      />

      <View style={{ height: gap.betweenInputs }} />
      <Field
        ref={confirmRef}
        label="Confirm password"
        value={form.confirm}
        onChangeText={edit("confirm", "confirm")}
        onFocus={() => setFocusedField(4)}
        error={fieldErrors.confirm}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        editable={!busy}
        returnKeyType="done"
        onSubmitEditing={() => confirmRef.current?.blur()}
        // The check replaces "Show" once the two agree, per the spec — a state
        // the eye can read without tapping anything.
        matched={form.confirm.length > 0 && form.confirm === form.password}
        reveal={reveal}
      />

      <View style={{ height: gap.betweenInputs }} />
      <DateOfBirthField
        value={form.dob}
        onChange={(next) => {
          edit("dob", "dateOfBirth")(next);
          setFocusedField(5);
        }}
        error={fieldErrors.dateOfBirth}
        disabled={busy}
      />
    </>
  );

  const primary = (
    <PrimaryButton label="Create account" onPress={onSubmit} busy={busy} disabled={busy} />
  );

  /*
   * ── ONE TREE, NOT TWO. THIS IS THE BUG THAT WOULD OTHERWISE BITE ──────────
   *
   * The tempting shape is `if (keyboardUp) return <AuthScreen>…4c…</AuthScreen>`
   * with a second return for 4b, and it flickers forever. React reconciles a
   * children array BY POSITION: the field stack sits at index 4 in the resting
   * layout (headline, gap, subhead, gap, fields) and at index 2 in the compact
   * one. Switching branches therefore unmounts and remounts all five
   * TextInputs, which drops focus, which closes the IME, which flips
   * `keyboardUp` back, which switches the branch again.
   *
   * So the slots are fixed and only their CONTENTS change. Each `keyboardUp`
   * conditional below is a single child expression, so the fragment holding the
   * five fields keeps the same index — and the same component instances — in
   * both states. That is what lets the headline shrink, the subhead vanish and
   * the band collapse without the caret ever leaving the field being typed in.
   */
  return (
    <AuthScreen
      scrim="createAccount"
      band={bandHeight.createAccount}
      padTop={keyboardUp ? keyboardRule.sheetPadTopCompact : keyboardRule.sheetPadTopRest}
      // Past a 380px IME the button cannot stay in the flow: it pins to the
      // sheet's bottom edge and the fields become the scrolling region. The
      // fields do not shrink — the spec is explicit about that.
      pinned={tallIme ? primary : undefined}
      // Passed in both states rather than dropped when the keyboard is up. The
      // shell cross-fades it and slides the sheet over it; unmounting it would
      // take the video with it and restart the loop on every dismissal.
      bandContent={
        <>
          <BandRow
            leading={<BandBackButton onPress={() => router.back()} label="Back to sign in" />}
            trailing={<ApiUrlGear variant="band" />}
          >
            <Wordmark />
          </BandRow>
          <DevChip>{getApiBase() || "no API URL set"}</DevChip>
        </>
      }
    >
      {/* slot 0 — the header block */}
      {keyboardUp ? (
        <CompactHeader
          title="Create your account"
          counter={`${focusedField} of 5`}
          onBack={() => router.back()}
          backLabel="Back to sign in"
        />
      ) : (
        <View>
          <Headline variant="createAccount">Create your account</Headline>
          <View style={{ height: gap.headlineToSubhead }} />
          <Subhead>Set up once, then trade for good.</Subhead>
        </View>
      )}

      {/* slot 1 — the gap above the fields */}
      <View
        style={{
          height: keyboardUp ? gap.bodyToControl.compact : gap.bodyToControl.createAccount,
        }}
      />

      {/* slot 2 — the five fields. IDENTICAL in both states; see the note. */}
      {fields}

      {/* slot 3 — the screen-level message */}
      {banner ? (
        <View style={{ marginTop: gap.inputsToDeclaration }}>
          <Banner message={banner} />
        </View>
      ) : null}

      {/* slot 4 — everything below the stack */}
      {keyboardUp ? (
        <View>
          {tallIme ? null : (
            <>
              <View style={{ height: gap.inputsToDeclaration }} />
              {primary}
              <View style={{ height: gap.primaryToDeclarationCompact }} />
              <Declaration compact>You must be {MIN_AGE} or older to use Baylo.</Declaration>
            </>
          )}
        </View>
      ) : (
        <View style={{ flexGrow: 1 }}>
          <View style={{ height: gap.inputsToDeclaration }} />
          <Declaration>
            By creating an account you confirm you are {MIN_AGE} or older. We check this against
            the date above and never show it on your profile.
          </Declaration>

          <View style={{ height: gap.declarationToPrimary }} />
          {primary}

          <View style={{ height: gap.primaryToLegal }} />
          <LegalCopy>
            By creating an account you agree to Baylo&rsquo;s Terms of Service and Privacy Policy.
          </LegalCopy>

          <FooterPrompt
            prompt="Already have an account?"
            label="Log in"
            onPress={() => router.back()}
            disabled={busy}
          />
        </View>
      )}
    </AuthScreen>
  );
}

// ── The "check your email" step ──────────────────────────────────────────────

/**
 * What happens after the account exists.
 *
 * NOT A SCREEN THE SPEC DRAWS. The spec covers the five states of getting in;
 * this is the sixth, it already existed, and deleting it would delete the
 * resend path with it. It is rebuilt out of the same components as everything
 * else here rather than left on the previous direction's dark shell, so the two
 * do not sit next to each other in the same flow.
 *
 * It says three things, in this order, because that is the order they matter:
 * where the email went, what confirming it is worth, and that logging in works
 * regardless. The last one is not filler — a screen that only says "check your
 * email" reads as a wall, and this one is not: verification gates the grant,
 * not access.
 *
 * WHICH ACTION GETS THE BUTTON. Continue is unambiguously the more important —
 * it adopts the session and opens the app, while Resend is the recovery path
 * for a mail that did not arrive. Putting the recovery path on the primary
 * control and hiding the way forward in a link would be a worse screen.
 */
function CheckYourEmail({ state }: { state: PendingSignup }) {
  const { adoptSession } = useSession();

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    state.emailSent
      ? null
      : "We could not send the verification email just now. Try Resend in a moment — your account is already created.",
  );
  const [busy, setBusy] = useState(false);
  const [continuing, setContinuing] = useState(false);

  async function onResend() {
    if (busy || !state.session) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const result = await resendVerification(state.session.accessToken);
      if (result.alreadyVerified) {
        setNotice("This account is already verified. Nothing else to do — continue.");
      } else {
        setNotice(`Sent again to ${state.email}. Check spam if it is not there in a minute.`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        // The limit is three per hour, per USER. It is not a bug and not
        // something to retry through, so say what it is.
        setError(
          `${err.message} Verification emails are limited to 3 an hour.${retrySuffix(err.retryAfter)}`,
        );
      } else {
        setError(err instanceof ApiError ? err.message : "Could not send that email.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onContinue() {
    if (continuing) return;

    // With a session in hand, adopting it routes into the app through the
    // (auth) guard — no navigation call here, same contract as sign-in.
    if (state.session) {
      setContinuing(true);
      try {
        await adoptSession(state.session);
      } catch {
        setContinuing(false);
        setError("Could not open your session. Log in with your new password.");
      }
      return;
    }

    // No session, because the sign-in after registration failed. The account
    // exists, so the honest next step is the login screen with the credentials
    // they just chose.
    router.replace("/(auth)/login");
  }

  // One message, and the error outranks the notice: a failed resend is what the
  // user is waiting on an answer about, a successful one they can see.
  const message = error ?? notice;

  return (
    <AuthScreen
      scrim="signIn"
      band={bandHeight.signIn}
      padTop={keyboardRule.sheetPadTopSignIn}
      bandContent={
        <BandRow trailing={<ApiUrlGear variant="band" />}>
          <Wordmark />
        </BandRow>
      }
    >
      <Headline variant="logIn">Check your email</Headline>

      <View style={{ height: gap.headlineToBody }} />
      <Body>
        We sent a verification link to {state.email}. Open it and {WELCOME_GRANT_LEAVES} Leaves land
        in your balance. You can log in either way — verifying is what unlocks the grant.
      </Body>

      {message ? (
        <View style={{ marginTop: gap.bodyToControl.logIn }}>
          <Banner message={message} />
        </View>
      ) : null}

      <View style={{ height: gap.bodyToControl.signIn }} />
      <PrimaryButton
        label={state.session ? "Continue to Baylo" : "Go to log in"}
        onPress={onContinue}
        busy={continuing}
      />

      <FooterPrompt
        prompt={state.emailSent ? "Didn't arrive?" : "Not sent yet."}
        label={busy ? "Sending…" : "Resend email"}
        onPress={onResend}
        // Without a session there is no way to call the endpoint — it is
        // authenticated. Logging in first is the route back to it.
        disabled={!state.session || busy || continuing}
      />
    </AuthScreen>
  );
}

/** " Try again in 12 minutes." — or nothing, when the server did not say. */
function retrySuffix(retryAfter: number | null): string {
  if (!retryAfter || retryAfter <= 0) return "";
  const minutes = Math.ceil(retryAfter / 60);
  return minutes <= 1 ? " Try again in a minute." : ` Try again in ${minutes} minutes.`;
}
