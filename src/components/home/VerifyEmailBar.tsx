import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ApiError, resendVerificationSignedIn } from "../../api/client";
import { CloseIcon, LeafIcon } from "../icons";
import { border, color, icon, space, textStyle, type } from "../../theme/tokens";
import { Tappable } from "../Tappable";

/**
 * The quiet reminder for an account that skipped its verification email.
 *
 * WHY HOME AND NOT PROFILE. Someone who tapped "Continue to Baylo" on the
 * check-email screen is not going to go looking in Profile for the thing they
 * skipped; Home is where they are. It sits at the top of the feed and scrolls
 * away with it, so it is visible on arrival and gone the moment they engage
 * with the app — which is the right weight for a reminder about something that
 * gates the Leaves and nothing else. It is NOT the offline bar: that one is
 * pinned in the header and painted in the urgency colour because it describes
 * a condition. This is painted in the green wash because it describes a reward
 * that is still on the table.
 *
 * WHAT VERIFYING IS WORTH is deliberately not quoted here. The register screen
 * already named the figure, and the balance will name it again when it lands;
 * a third copy of the number is a third place for it to go stale.
 *
 * DISMISSAL IS PER PROCESS, NOT PERSISTED. The reminder comes back on the next
 * cold start, which is the point of a reminder — and cheap: a module variable
 * keyed by viewer id, so a sign-out and a sign-in as someone else does not
 * inherit the dismissal. Persisting it would need storage, a schema and an
 * expiry for what is one line of text.
 *
 * The resend reuses the account's own 3-an-hour limit, so a 429 is shown as
 * the wait it is rather than retried through. On `alreadyVerified` the server
 * is ahead of the cache — say so and hide, and the next home refetch agrees.
 */
export function VerifyEmailBar({ viewerId }: { viewerId: string }) {
  const [hidden, setHidden] = useState(() => dismissed.has(viewerId));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (hidden) return null;

  function dismiss() {
    dismissed.add(viewerId);
    setHidden(true);
  }

  async function onResend() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await resendVerificationSignedIn();
      if (result.alreadyVerified) {
        setNote("Already verified — you're all set.");
        dismissed.add(viewerId);
        setTimeout(() => setHidden(true), 1500);
      } else {
        setNote("Sent. Check spam if it isn't there in a minute.");
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setNote(`Limited to 3 emails an hour.${retrySuffix(err.retryAfter)}`);
      } else {
        setNote(err instanceof ApiError ? err.message : "Could not send that email.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.bar} accessibilityRole="summary">
      <LeafIcon size={icon.offlineWarning.size} stroke={icon.offlineWarning.stroke} color={color.forest} />
      <View style={s.body}>
        <Text style={[textStyle(type.offlineText), s.text]}>
          {note ?? "Verify your email to collect your welcome Leaves."}
        </Text>
        {note ? null : (
          <Tappable
            onPress={onResend}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Resend verification email"
            hitSlop={8}
            style={{ opacity: busy ? 0.45 : 1 }}
          >
            <Text style={[textStyle(type.offlineText), s.link]}>
              {busy ? "Sending…" : "Resend email"}
            </Text>
          </Tappable>
        )}
      </View>
      <Tappable
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        hitSlop={10}
        style={s.close}
      >
        <CloseIcon size={icon.clear.size} stroke={icon.clear.stroke} color={color.inkSecondary} />
      </Tappable>
    </View>
  );
}

/** Viewer ids whose reminder was dismissed since the app process started. */
const dismissed = new Set<string>();

/** " Try again in 12 minutes." — or nothing, when the server did not say. */
function retrySuffix(retryAfter: number | null): string {
  if (!retryAfter || retryAfter <= 0) return "";
  const minutes = Math.ceil(retryAfter / 60);
  return minutes <= 1 ? " Try again in a minute." : ` Try again in ${minutes} minutes.`;
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.offline.gap,
    paddingHorizontal: space.screenX,
    paddingVertical: space.offline.y,
    backgroundColor: color.greenWash,
    borderBottomWidth: border.hairline,
    borderColor: color.greenLine,
  },
  body: { flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: space.offline.gap },
  text: { color: color.forest, flexShrink: 1 },
  link: { color: color.forest, textDecorationLine: "underline" },
  close: { padding: 2 },
});
