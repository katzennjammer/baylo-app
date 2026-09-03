import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { router } from "expo-router";

import {
  ApiError,
  requestPasswordReset,
  submitDateOfBirth,
  type GoogleExchange,
} from "../../src/api/client";
import { getApiBase } from "../../src/api/config";
import { ApiUrlGear } from "../../src/components/ApiUrlGear";
import { useGoogleSignIn } from "../../src/auth/google";
import { useSession } from "../../src/auth/session";
import { UnderAgeSheet } from "../../src/components/auth-under-age";
import {
  AuthScreen,
  BandBackButton,
  BandEyebrow,
  BandRow,
  Banner,
  Body,
  CebuPill,
  DateRow,
  Declaration,
  DevChip,
  EnvelopeGlyph,
  Field,
  FooterPrompt,
  GoogleAccountCard,
  GoogleGlyph,
  Headline,
  LegalCopy,
  OrDivider,
  OutlineButton,
  PrimaryButton,
  TextButton,
  Wordmark,
  bandHeight,
  gap,
  keyboardRule,
} from "../../src/components/auth-sheet";
import { isAdult, isoDate, type DateParts } from "../../src/lib/dob";

/**
 * Sign in, and the three screens that hang off it.
 *
 * ── ONE ROUTE, FOUR STATES, AND WHY THEY ARE NOT FOUR ROUTES ────────────────
 *
 *   choose    the entry screen — Google, or email
 *   email     email and password
 *   dob       the date of birth a Google account still owes
 *   rejected  under 18
 *
 * `dob` and `rejected` are the reason. Both are reached holding a token pair
 * that has deliberately NOT been installed, and a pair in component state does
 * not survive a route change: pushing a route would mean either putting an
 * access token in a URL parameter or hoisting it into a module singleton, and
 * both are worse than a switch statement. `choose` and `email` then join them
 * because splitting two of four across a route boundary buys nothing.
 *
 * ── THERE IS NO NAVIGATION CALL AFTER A SUCCESSFUL SIGN-IN ──────────────────
 *
 * signIn() writes the session, the module publishes the change, and the (auth)
 * guard one level up sees a session and redirects. Routing from here as well
 * would mean two things deciding where the user goes, and they would disagree
 * the first time a token turned out to be unusable. Every path out of this file
 * ends the same way, through the same guard — the Google exchange included.
 */

type Mode = "choose" | "email" | "dob" | "rejected";

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>("choose");

  /** The Google pair being held while the date-of-birth step is on screen. */
  const [pending, setPending] = useState<GoogleExchange | null>(null);
  /** The date that was refused, so the rejection screen can show its working. */
  const [refused, setRefused] = useState<DateParts | null>(null);

  const google = useGoogleSignIn({
    onNeedsDateOfBirth: (exchange) => {
      setPending(exchange);
      setMode("dob");
    },
  });

  if (mode === "rejected") {
    return (
      <UnderAgeSheet
        dob={refused}
        onCorrect={() => setMode(pending ? "dob" : "choose")}
        secondary={{
          label: pending ? "Use a different account" : "Back to sign in",
          onPress: () => {
            setPending(null);
            setRefused(null);
            setMode("choose");
          },
        }}
        onBack={() => setMode(pending ? "dob" : "choose")}
      />
    );
  }

  if (mode === "dob" && pending) {
    return (
      <GoogleDateOfBirth
        pending={pending}
        // Seeded with whatever the rejection screen just refused, so "correct
        // my date of birth" comes back to a picker that still holds the wrong
        // year rather than to three empty columns.
        initialDob={refused}
        onRejected={(dob) => {
          setRefused(dob);
          setMode("rejected");
        }}
        onAbandon={() => {
          setPending(null);
          setMode("choose");
        }}
      />
    );
  }

  if (mode === "email") {
    return <EmailLogIn google={google} onBack={() => setMode("choose")} />;
  }

  return <ChooseHowToSignIn google={google} onEmail={() => setMode("email")} />;
}

/* ─────────────────────── 4a — the entry screen ──────────────────────── */

/**
 * Two ways in, and a wordmark over footage.
 *
 * Google takes the PRIMARY button and email the outline one, which is a claim
 * about what most people should tap rather than about which the app prefers:
 * one tap and no password beats five fields, and the account it lands on is the
 * same account either way — the exchange creates one when there is not one
 * already. Email keeps a full-width 52px control beneath it rather than being
 * demoted to a link, because "no Google account" is not a minority case here.
 *
 * ── THERE IS NO "ALREADY HAVE AN ACCOUNT?" FOOTER, AND THAT IS THE FIX ──────
 *
 * There was one, and it made the screen lie about itself. A footer offering
 * "Log in" implies everything ABOVE it is the sign-up path — so "Continue with
 * email" reads as "create an account with email". It is not: it opens
 * <EmailLogIn>, which asks for a password a new user has never chosen. The
 * footer also pointed at the same place the email button did, so the screen
 * carried two labels for one destination and gave the wrong one the last word.
 *
 * This screen asks ONE question — how do you want to continue — and does not
 * claim to know whether the person answering it already has an account. Google
 * settles that server-side (the exchange creates one when there is not one
 * already); email settles it on the next screen, which carries the real
 * "New to Baylo? / Create an account" link. Registration is one tap further
 * either way, and it is a tap taken from a screen that is honest about itself.
 */
function ChooseHowToSignIn({
  google,
  onEmail,
}: {
  google: ReturnType<typeof useGoogleSignIn>;
  onEmail: () => void;
}) {
  const { hydrationError } = useSession();

  // hydrationError is LAST on purpose. It explains why this screen is showing
  // at all — boot could not read the stored session — which matters right up
  // until the user tries something and not one moment after.
  const banner = google.error ?? hydrationError;

  return (
    <AuthScreen
      scrim="signIn"
      band={bandHeight.signIn}
      padTop={keyboardRule.sheetPadTopSignIn}
      bandContent={
        <>
          <BandRow trailing={<ApiUrlGear variant="band" />}>
            <Wordmark large />
            <CebuPill />
          </BandRow>
          <DevChip>{getApiBase() || "no API URL set"}</DevChip>
        </>
      }
    >
      <Headline variant="signIn">Barter, not buy.</Headline>

      <View style={{ height: gap.headlineToBody }} />
      <Body large>
        Trade what you have for what you need — no cash, no fees, just neighbours in Cebu.
      </Body>

      <View style={{ height: gap.bodyToControl.signIn }} />
      <PrimaryButton
        label="Continue with Google"
        onPress={google.start}
        busy={google.busy}
        disabled={!google.configured}
        leading={<GoogleGlyph />}
      />

      <View style={{ height: gap.buttonToDivider }} />
      <OrDivider />

      <View style={{ height: gap.buttonToDivider }} />
      <OutlineButton
        label="Continue with email"
        onPress={onEmail}
        disabled={google.busy}
        leading={<EnvelopeGlyph />}
      />

      <View style={{ height: gap.outlineToLegal }} />
      {banner ? (
        <View style={{ marginBottom: gap.outlineToLegal }}>
          <Banner message={banner} />
        </View>
      ) : null}

      <LegalCopy>
        By continuing you agree to Baylo&rsquo;s Terms of Service and Privacy Policy. Baylo is an
        18+ marketplace — you will be asked for your date of birth.
      </LegalCopy>
    </AuthScreen>
  );
}

/* ──────────────────────────── 4d — log in ───────────────────────────── */

function EmailLogIn({
  google,
  onBack,
}: {
  google: ReturnType<typeof useGoogleSignIn>;
  onBack: () => void;
}) {
  const { signIn, hydrationError } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  const passwordRef = useRef<TextInput>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy && !google.busy;

  async function onSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    google.reset();
    try {
      await signIn(email.trim(), password);
      // No redirect here — see the note at the top of the file.
    } catch (err) {
      // The server's message is shown verbatim for a reason: 401 is always the
      // deliberately vague "Invalid email or password" (telling the two apart
      // would make this endpoint an account-enumeration oracle), while 403
      // carries the real reason — suspended, or deleted — and that message is
      // the ONLY place a user is ever told which. Rewriting either one here
      // would throw away the only explanation they get.
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * The reset link goes to the WEB page, and the notice says so.
   *
   * The endpoint always answers 200 whether or not the address has an account —
   * that is what stops it being an enumeration oracle — so the message here is
   * carefully phrased as "if that address has an account". Saying "sent" would
   * quietly leak the thing the 200 is protecting.
   */
  async function onForgotPassword() {
    const address = email.trim();
    if (!address) {
      setError("Type your email address first, then tap Forgot password.");
      return;
    }
    setResetting(true);
    setError(null);
    setNotice(null);
    try {
      await requestPasswordReset(address);
      setNotice(
        `If ${address} has an account, a reset link is on its way. Open it on this phone — the reset page is on the Baylo website.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the reset email.");
    } finally {
      setResetting(false);
    }
  }

  // One message, and the error outranks the notice: a failure is what the user
  // is waiting on an answer about, a success they can see.
  const banner = error ?? google.error ?? notice ?? hydrationError;

  return (
    <AuthScreen
      scrim="logIn"
      band={bandHeight.logIn}
      bandContent={
        <>
          <BandRow
            leading={<BandBackButton onPress={onBack} label="Back" />}
            trailing={<ApiUrlGear variant="band" />}
          >
            <Wordmark />
          </BandRow>
          <DevChip>{getApiBase() || "no API URL set"}</DevChip>
        </>
      }
    >
      <Headline variant="logIn">Log in</Headline>

      <View style={{ height: gap.headlineToBody }} />
      <Body>Use the email and password you signed up with.</Body>

      <View style={{ height: gap.bodyToControl.logIn }} />
      <Field
        label="Email"
        value={email}
        onChangeText={(next) => {
          setEmail(next);
          if (error) setError(null);
        }}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        // Nothing typed into this screen should ever be corrected by the
        // keyboard — an autocorrected email is a login that fails for a reason
        // the user cannot see.
        autoCorrect={false}
        editable={!busy}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />

      <View style={{ height: gap.betweenInputsLogIn }} />
      <Field
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={(next) => {
          setPassword(next);
          if (error) setError(null);
        }}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        editable={!busy}
        onSubmitEditing={onSubmit}
        returnKeyType="go"
        reveal={{ visible: showPassword, onToggle: () => setShowPassword((v) => !v) }}
      />

      {/* Right-aligned, under the "Show" button it sits beneath. The spec
          gives this control its type and its 44 target and not its side. */}
      <TextButton
        label={resetting ? "Sending…" : "Forgot password?"}
        onPress={onForgotPassword}
        disabled={resetting || busy}
        align="right"
      />

      {banner ? (
        <View style={{ marginBottom: gap.inputsToDeclaration }}>
          <Banner message={banner} />
        </View>
      ) : null}

      <PrimaryButton label="Log in" onPress={onSubmit} disabled={!canSubmit} busy={busy} />

      <View style={{ height: gap.buttonToDividerLogIn }} />
      <OrDivider />

      <View style={{ height: gap.buttonToDividerLogIn }} />
      <OutlineButton
        label="Continue with Google"
        onPress={google.start}
        busy={google.busy}
        disabled={busy || !google.configured}
        leading={<GoogleGlyph color="#14140F" />}
      />

      <FooterPrompt
        prompt="New to Baylo?"
        label="Create an account"
        onPress={() => router.push("/(auth)/register")}
        disabled={busy || google.busy}
      />
    </AuthScreen>
  );
}

/* ───────────────────── 4e — date of birth, after Google ─────────────── */

/**
 * The one fact a Google account cannot supply.
 *
 * The pair in `pending` is real and valid and is NOT installed — the guard in
 * (auth)/_layout would redirect the instant it were, and the user would land in
 * the app having never been asked. It is adopted at the end of a successful
 * submit and at no other point, so backing out of this screen leaves nothing
 * behind but an account with no date of birth, which is exactly the state the
 * server will ask about again next time.
 */
function GoogleDateOfBirth({
  pending,
  initialDob,
  onRejected,
  onAbandon,
}: {
  pending: GoogleExchange;
  initialDob: DateParts | null;
  onRejected: (dob: DateParts) => void;
  onAbandon: () => void;
}) {
  const { adoptSession } = useSession();

  const [dob, setDob] = useState<DateParts | null>(initialDob);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (busy) return;
    if (!dob) {
      setError("Pick your date of birth to continue.");
      return;
    }

    // Checked here so the refusal is instant and explicable, and checked again
    // by the server, which is the one that decides. A client-only gate is a
    // gate anybody can skip by calling the endpoint directly.
    if (!isAdult(dob)) {
      onRejected(dob);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await submitDateOfBirth(pending.session.accessToken, isoDate(dob));
      // Only now. Adopting installs the session and the guard routes into the
      // app; doing it before the date was accepted would leave an account in
      // exactly the state this screen exists to fix.
      await adoptSession(pending.session);
    } catch (err) {
      if (err instanceof ApiError && err.code === "UNDER_18") {
        onRejected(dob);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not save that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScreen
      scrim="googleDob"
      band={bandHeight.googleDob}
      bandContent={
        <>
          <BandRow leading={<BandBackButton onPress={onAbandon} label="Back to sign in" />}>
            <Wordmark />
          </BandRow>
          <BandEyebrow>step 2 of 2</BandEyebrow>
          <GoogleAccountCard
            name={pending.session.user.name}
            email={pending.session.user.email}
            avatarUrl={pending.session.user.image}
          />
        </>
      }
    >
      <Headline variant="googleDob">Your date of birth</Headline>

      <View style={{ height: gap.headlineToBody }} />
      <Body>
        Baylo is 18+. We use this to check your age once — it is never shown on your profile.
      </Body>

      <View style={{ height: gap.bodyToControl.googleDob }} />
      <DateRow
        value={dob}
        onChange={(next) => {
          setDob(next);
          if (error) setError(null);
        }}
        disabled={busy}
      />

      <View style={{ height: gap.inputsToDeclarationGoogleDob }} />
      <Declaration>
        You must be 18 or older to trade on Baylo. We check this against the date you enter.
      </Declaration>

      {error ? (
        <View style={{ marginTop: gap.inputsToDeclaration }}>
          <Banner message={error} />
        </View>
      ) : null}

      <View style={{ height: gap.declarationToPrimaryGoogleDob }} />
      <PrimaryButton label="Continue" onPress={onSubmit} busy={busy} />

      <View style={{ height: gap.primaryToTextButton }} />
      <TextButton
        label="Use a different account"
        size="footer"
        onPress={onAbandon}
        disabled={busy}
        align="center"
      />
    </AuthScreen>
  );
}
