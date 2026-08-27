import { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Link } from "expo-router";

import { ApiError } from "../../src/api/client";
import { ApiUrlGear } from "../../src/components/ApiUrlGear";
import { useGoogleSignIn } from "../../src/auth/google";
import { useSession } from "../../src/auth/session";
import {
  AuthCard,
  AuthHeader,
  AuthScreen,
  Divider,
  ErrorBanner,
  Field,
  GoogleMark,
  PasswordField,
  PrimaryButton,
  SecondaryButton,
} from "../../src/components/auth-ui";

/**
 * Sign in — POST /api/auth/token, or the Google exchange.
 *
 * There is no navigation call at the end of a successful sign-in, and that is
 * deliberate. signIn() writes the session, the module publishes the change, the
 * (auth) guard one level up sees a session and redirects. Routing from here as
 * well would mean two things deciding where the user goes, and they would
 * disagree the first time a token turned out to be unusable. The Google path
 * ends the same way, through the same guard.
 */
export default function LoginScreen() {
  const { signIn } = useSession();
  const google = useGoogleSignIn();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const passwordRef = useRef<TextInput>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy && !google.busy;

  async function onSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    google.reset();
    try {
      await signIn(email.trim(), password);
      // No redirect here — see the note above.
    } catch (err) {
      // The server's message is shown verbatim for a reason: 401 is always the
      // deliberately vague "Invalid email or password" (telling the two apart
      // would make this endpoint an account-enumeration oracle), while 403
      // carries the real reason — suspended, or deleted — and that message is
      // the ONLY place a user is ever told which. Rewriting either one here
      // would throw away the only explanation they get.
      setError(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  // One banner, not two stacked ones. Whichever path was tried last is the one
  // the user is waiting on an answer about.
  const banner = error ?? google.error;

  return (
    <AuthScreen>
      <AuthHeader tagline="Sign in to trade what you have for what you need." />

      <AuthCard>
        <View className="gap-4">
          <Field
            label="Email"
            value={email}
            onChangeText={(next) => {
              setEmail(next);
              if (error) setError(null);
            }}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            // Nothing typed into this screen should ever be corrected by the
            // keyboard — an autocorrected email is a login that fails for a
            // reason the user cannot see.
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
            onChangeText={(next) => {
              setPassword(next);
              if (error) setError(null);
            }}
            placeholder="••••••••"
            autoComplete="current-password"
            editable={!busy}
            onSubmitEditing={onSubmit}
            returnKeyType="go"
            visible={showPassword}
            onToggleVisible={() => setShowPassword((v) => !v)}
          />
        </View>

        {banner ? (
          <View className="mt-4">
            <ErrorBanner message={banner} />
          </View>
        ) : null}

        <View className="mt-5 gap-3">
          <PrimaryButton label="Sign in" onPress={onSubmit} disabled={!canSubmit} busy={busy} />

          <Divider label="or" />

          <SecondaryButton
            label="Continue with Google"
            leading={<GoogleMark />}
            onPress={google.start}
            busy={google.busy}
            disabled={busy || !google.configured}
          />
          {google.unavailableReason ? (
            <Text className="text-ink-muted text-[11px] leading-4 text-center">
              {google.unavailableReason}
            </Text>
          ) : null}
        </View>
      </AuthCard>

      <View className="mt-5 flex-row items-center justify-center">
        <Text className="text-on-green-muted text-[14px]">New to Baylo? </Text>
        {/*
          A route, not a toggle on this screen. The two flows have different
          fields, different errors and different endings — register finishes on
          a "check your email" step that sign-in has no equivalent of — and
          collapsing them behind a switch makes the back button ambiguous for
          the entire life of the app.
        */}
        <Link
          href="/(auth)/register"
          className="text-on-green text-[14px] font-bold underline"
          // Text links are small targets. The hit area is padded out to 44px
          // without moving the baseline.
          style={{ paddingVertical: 12, paddingHorizontal: 4 }}
        >
          Create an account
        </Link>
      </View>

      <View className="mt-2 items-center">
        <ApiUrlGear />
      </View>
    </AuthScreen>
  );
}
