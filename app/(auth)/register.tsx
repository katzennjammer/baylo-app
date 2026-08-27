import { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Link, router } from "expo-router";

import {
  ApiError,
  authenticate,
  registerAccount,
  resendVerification,
} from "../../src/api/client";
import { ApiUrlGear } from "../../src/components/ApiUrlGear";
import { useSession } from "../../src/auth/session";
import type { StoredSession } from "../../src/auth/storage";
import {
  AuthCard,
  AuthHeader,
  AuthScreen,
  ErrorBanner,
  Field,
  NoticeBanner,
  PasswordField,
  PrimaryButton,
  SecondaryButton,
} from "../../src/components/auth-ui";

/**
 * Create an account — POST /api/auth/register, then the "check your email" step.
 *
 * Registration used to exist only on the web, which meant a tester's first
 * instruction was "go and find a website". It is the same endpoint; the only
 * thing that was missing was a screen.
 *
 * THE SHAPE OF THIS SCREEN IS DECIDED BY TWO SERVER FACTS.
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
 * unlocks the 50-Leaf welcome grant; not verifying costs only that.
 */
export default function RegisterScreen() {
  const [pending, setPending] = useState<PendingSignup | null>(null);

  return pending ? (
    <CheckYourEmail state={pending} />
  ) : (
    <RegisterForm onRegistered={setPending} />
  );
}

interface PendingSignup {
  email: string;
  /** A real, valid session — deliberately NOT installed. See the note above. */
  session: StoredSession | null;
  /** False when the server could not send the mail. Offer a resend at once. */
  emailSent: boolean;
}

// ── The form ─────────────────────────────────────────────────────────────────

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
}

/**
 * Client-side validation, matching the server's schema rather than guessing at
 * it.
 *
 * The server is the authority — `registerSchema` in `../baylo/src/lib/
 * validation.ts` — and these rules are a copy of it, kept deliberately narrow:
 * a non-empty name up to 100 characters, something with an @ in it, and eight
 * characters of password. Validating MORE than the server does is the trap.
 * A client that insists on a symbol and a digit rejects passwords the backend
 * would have accepted, and the user has no way to discover that the rule is
 * imaginary.
 *
 * The confirm field has no server counterpart at all — the server never sees it
 * — which is exactly why it must be checked here.
 */
function validate(input: {
  name: string;
  email: string;
  password: string;
  confirm: string;
}): FieldErrors {
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
  else if (input.confirm !== input.password) errors.confirm = "The two passwords do not match.";

  return errors;
}

function RegisterForm({ onRegistered }: { onRegistered: (p: PendingSignup) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  /** Clears one field's error as it is edited. Nothing is angrier than a form
   *  that keeps shouting about something already fixed. */
  function edit<T>(setter: (v: T) => void, key: keyof FieldErrors) {
    return (value: T) => {
      setter(value);
      setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
      if (banner) setBanner(null);
    };
  }

  async function onSubmit() {
    if (busy) return;

    const errors = validate({ name, email, password, confirm });
    if (Object.values(errors).some(Boolean)) {
      setFieldErrors(errors);
      setBanner(null);
      return;
    }

    setBusy(true);
    setFieldErrors({});
    setBanner(null);

    const trimmedEmail = email.trim();

    try {
      const created = await registerAccount({
        name: name.trim(),
        email: trimmedEmail,
        password,
      });

      // Sign in straight away, and DO NOT install the session — the resend
      // button on the next step needs a Bearer token, and the (auth) guard
      // would redirect the moment one existed. A failure here is not a failed
      // registration: the account is created either way, so the next step is
      // shown regardless, just without a resend option.
      let session: StoredSession | null = null;
      try {
        session = await authenticate(trimmedEmail, password);
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
        // A 400 from parseBody() names the field it rejected. Put it there.
        const fromServer: FieldErrors = {
          name: err.issueFor("name"),
          email: err.issueFor("email"),
          password: err.issueFor("password"),
        };

        if (Object.values(fromServer).some(Boolean)) {
          setFieldErrors(fromServer);
        } else if (err.status === 409) {
          // "Email already in use" is about one field, and the server does not
          // send it as an issue. Route it to the field anyway — with a way out,
          // since the likeliest reader is somebody who already has an account.
          setFieldErrors({ email: "That email already has an account." });
          setBanner("Already registered? Go back and sign in instead.");
        } else {
          setBanner(
            err.status === 429
              ? `${err.message}${retrySuffix(err.retryAfter)}`
              : err.message,
          );
        }
      } else {
        setBanner("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScreen>
      <AuthHeader tagline="Create an account and start trading." />

      <AuthCard>
        <View className="gap-4">
          <Field
            label="Name"
            value={name}
            onChangeText={edit(setName, "name")}
            error={fieldErrors.name}
            placeholder="Juan dela Cruz"
            autoCapitalize="words"
            autoComplete="name"
            autoCorrect={false}
            editable={!busy}
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            submitBehavior="submit"
          />
          <Field
            ref={emailRef}
            label="Email"
            value={email}
            onChangeText={edit(setEmail, "email")}
            error={fieldErrors.email}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            autoCorrect={false}
            editable={!busy}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            submitBehavior="submit"
          />
          <PasswordField
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={edit(setPassword, "password")}
            error={fieldErrors.password}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            editable={!busy}
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            submitBehavior="submit"
            visible={showPassword}
            onToggleVisible={() => setShowPassword((v) => !v)}
          />
          <PasswordField
            ref={confirmRef}
            label="Confirm password"
            value={confirm}
            onChangeText={edit(setConfirm, "confirm")}
            error={fieldErrors.confirm}
            placeholder="Type it again"
            autoComplete="new-password"
            editable={!busy}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            visible={showPassword}
            onToggleVisible={() => setShowPassword((v) => !v)}
          />
        </View>

        {banner ? (
          <View className="mt-4">
            <ErrorBanner message={banner} />
          </View>
        ) : null}

        <View className="mt-5">
          <PrimaryButton
            label="Create account"
            onPress={onSubmit}
            disabled={busy}
            busy={busy}
          />
        </View>

        <Text className="text-ink-muted text-[12px] leading-4 text-center mt-4">
          We send one email to confirm the address. Confirming it credits your
          50-Leaf welcome grant.
        </Text>
      </AuthCard>

      <View className="mt-5 flex-row items-center justify-center">
        <Text className="text-on-green-muted text-[14px]">Already have an account? </Text>
        <Link
          href="/(auth)/login"
          className="text-on-green text-[14px] font-bold underline"
          style={{ paddingVertical: 12, paddingHorizontal: 4 }}
        >
          Sign in
        </Link>
      </View>

      <View className="mt-2 items-center">
        <ApiUrlGear />
      </View>
    </AuthScreen>
  );
}

// ── The "check your email" step ──────────────────────────────────────────────

/**
 * What happens after the account exists.
 *
 * It says three things, in this order, because that is the order they matter:
 * where the email went, what confirming it is worth, and that sign-in works
 * regardless. The last one is not filler — a screen that only says "check your
 * email" reads as a wall, and this one is not: verification gates the grant,
 * not access.
 */
function CheckYourEmail({ state }: { state: PendingSignup }) {
  const { adoptSession } = useSession();

  const [sent, setSent] = useState(state.emailSent);
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
        setNotice("This account is already verified. Nothing else to do — sign in.");
      } else {
        setSent(true);
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
        setError("Could not open your session. Sign in with your new password.");
      }
      return;
    }

    // No session, because the sign-in after registration failed. The account
    // exists, so the honest next step is the login screen with the credentials
    // they just chose.
    router.replace("/(auth)/login");
  }

  return (
    <AuthScreen>
      <AuthHeader tagline="One more step." />

      <AuthCard>
        <Text className="text-ink text-xl font-bold">Check your email</Text>
        <Text className="text-ink-muted text-[14px] leading-5 mt-2">
          We sent a confirmation link to{" "}
          <Text className="text-ink font-semibold">{state.email}</Text>. Open it
          on this phone and your account is verified.
        </Text>

        <View className="mt-4 rounded-2xl bg-ok-wash px-4 py-3">
          <Text className="text-ok-ink text-[13px] font-bold leading-5">
            Verifying credits 50 Leaves
          </Text>
          <Text className="text-ok-ink text-[13px] leading-5 mt-1">
            The welcome grant is paid once, when the address is confirmed. Leaves
            are what you top up a trade with when the two items are not quite
            worth the same.
          </Text>
        </View>

        <Text className="text-ink-muted text-[13px] leading-5 mt-3">
          You can sign in and look around before confirming — verification is
          what unlocks the grant, not the app.
        </Text>

        {notice ? (
          <View className="mt-4">
            <NoticeBanner message={notice} />
          </View>
        ) : null}
        {error ? (
          <View className="mt-4">
            <ErrorBanner message={error} />
          </View>
        ) : null}

        <View className="mt-5 gap-3">
          <PrimaryButton
            label={state.session ? "Continue to Baylo" : "Go to sign in"}
            onPress={onContinue}
            busy={continuing}
          />
          <SecondaryButton
            label={sent ? "Resend email" : "Send it again"}
            onPress={onResend}
            busy={busy}
            // Without a session there is no way to call the endpoint — it is
            // authenticated. Signing in first is the route back to it.
            disabled={!state.session || continuing}
          />
          {!state.session ? (
            <Text className="text-ink-muted text-[11px] leading-4 text-center">
              Sign in first to resend the email — the endpoint needs your session.
            </Text>
          ) : null}
        </View>
      </AuthCard>

      <View className="mt-2 items-center">
        <ApiUrlGear />
      </View>
    </AuthScreen>
  );
}

/** " Try again in 12 minutes." — or nothing, when the server did not say. */
function retrySuffix(retryAfter: number | null): string {
  if (!retryAfter || retryAfter <= 0) return "";
  const minutes = Math.ceil(retryAfter / 60);
  return minutes <= 1 ? " Try again in a minute." : ` Try again in ${minutes} minutes.`;
}
