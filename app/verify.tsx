import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { ApiError, verifyEmailToken } from "../src/api/client";
import { useSession } from "../src/auth/session";
import {
  AuthCard,
  AuthHeader,
  AuthScreen,
  ErrorBanner,
  NoticeBanner,
  PrimaryButton,
} from "../src/components/auth-ui";

/**
 * Where a verification link lands when it opens the app.
 *
 * `baylo://verify?token=…`, or `https://<host>/verify?token=…` once Android App
 * Links are configured (see README). The token is POSTed to
 * /api/auth/verify-email, which is the same code path the emailed link's GET
 * uses — one place where a token is validated and spent, two transports.
 *
 * OUTSIDE BOTH ROUTE GROUPS, deliberately. (auth) redirects away when a session
 * exists and (app) redirects away when one does not, and this screen has to
 * work in both states: the link is opened by a signed-out tester on a fresh
 * install just as often as by someone already signed in. A route at the top
 * level is subject to neither guard.
 *
 * The redemption runs whether or not anyone is signed in, because the token IS
 * the credential — it identifies the account by itself. Being signed in only
 * changes where "Continue" goes afterwards.
 *
 * IT IS SAFE THAT THIS MIGHT RUN TWICE. `consumeVerificationToken()` deletes
 * the row conditionally and only the caller whose delete reported one row
 * proceeds, and `markVerified()` credits nothing on an account already
 * verified. A second redemption of the same token answers "invalid", and this
 * screen says so plainly rather than pretending — a user who taps the link
 * twice has, in fact, already verified.
 */
export default function VerifyScreen() {
  const { session } = useSession();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token.trim() : "";

  const [state, setState] = useState<
    | { status: "working" }
    | { status: "done"; alreadyVerified: boolean; leaves: number }
    | { status: "failed"; message: string }
  >({ status: "working" });

  useEffect(() => {
    if (!token) {
      setState({
        status: "failed",
        message: "That link had no verification token in it. Open the link from the email again.",
      });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await verifyEmailToken(token);
        if (cancelled) return;
        setState({
          status: "done",
          alreadyVerified: result.alreadyVerified,
          leaves: result.leavesAwarded,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "failed",
          message:
            err instanceof ApiError
              ? err.message
              : "Could not reach the server to check that link.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Signed in → the app. Signed out → sign in, which is the only useful place
  // to be: verification does not create a session, it only marks an account.
  const onContinue = () => router.replace(session ? "/(app)" : "/(auth)/login");
  const continueLabel = session ? "Continue to Baylo" : "Sign in";

  return (
    <AuthScreen>
      <AuthHeader tagline="Email verification" />

      <AuthCard>
        {state.status === "working" ? (
          <>
            <Text className="text-ink text-xl font-bold">Checking your link…</Text>
            <Text className="text-ink-muted text-[14px] leading-5 mt-2">
              One moment.
            </Text>
          </>
        ) : null}

        {state.status === "done" ? (
          <>
            <Text className="text-ink text-xl font-bold">
              {state.alreadyVerified ? "Already verified" : "You're verified"}
            </Text>
            <Text className="text-ink-muted text-[14px] leading-5 mt-2">
              {state.alreadyVerified
                ? "This account was already confirmed, so nothing was credited twice."
                : "Your email address is confirmed."}
            </Text>

            {state.leaves > 0 ? (
              <View className="mt-4">
                <NoticeBanner
                  message={`${state.leaves} Leaves credited to your balance.`}
                />
              </View>
            ) : null}

            <View className="mt-5">
              <PrimaryButton label={continueLabel} onPress={onContinue} />
            </View>
          </>
        ) : null}

        {state.status === "failed" ? (
          <>
            <Text className="text-ink text-xl font-bold">That link did not work</Text>
            <View className="mt-3">
              <ErrorBanner message={state.message} />
            </View>
            <Text className="text-ink-muted text-[13px] leading-5 mt-3">
              Links expire after 24 hours and can be used once. Sign in and ask
              for a new one from your profile.
            </Text>
            <View className="mt-5">
              <PrimaryButton label={continueLabel} onPress={onContinue} />
            </View>
          </>
        ) : null}
      </AuthCard>
    </AuthScreen>
  );
}
