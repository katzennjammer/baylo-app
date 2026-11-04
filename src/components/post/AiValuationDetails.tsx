import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Text, View } from "react-native";

import { ApiError } from "../../api/client";
import { fetchAiValuation, type Category } from "../../api/post";
import { aiKeyOf, currentAi, usePost } from "../../post/state";
import { postBorder, postColor, postRadius, postSize, postType, textStyle } from "../../theme/post-tokens";
import { Tappable } from "../Tappable";
import { OutlineButton } from "./ui";

/**
 * The AI half of step 4: asks /api/ai/valuation once per (title, category,
 * condition), and shows what came back — the reason, the online listings it
 * was based on, or why there is no AI number.
 *
 * ── WHAT IS SENT ────────────────────────────────────────────────────────────
 *
 * The title, category and condition. Never the photo.
 *
 * ── ASKED ONCE ──────────────────────────────────────────────────────────────
 *
 * The answer lives in wizard state (`aiValuation`), not here, so leaving the
 * step and coming back does not ask again — each ask is a billed web search
 * and the route allows ten an hour. Changing the title, category or condition
 * clears it (see `reduce`), and the next visit asks about the new item.
 *
 * ── SOURCES ARE SHOWN, NOT KEPT ─────────────────────────────────────────────
 *
 * The links are for the person deciding on a value now. The listing stores
 * only the number and that it came from AI.
 */

function safeHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatCheckedAt(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

/** Asks for the AI valuation when the step needs one. Safe to remount. */
export function useAiValuation() {
  const { state, dispatch } = usePost();
  const key = aiKeyOf(state);
  const asked = useRef<string | null>(null);
  const ready =
    !!state.category &&
    !!state.valuation &&
    !state.revaluationSpent &&
    state.title.trim().length > 0 &&
    state.aiValuation === null;

  // `asked` only guards the gap between dispatching "ai/pending" and the
  // re-render that makes `ready` false (React runs effects twice in dev). Once
  // there is any answer it is released, so "Try again" — which clears the
  // answer — asks again.
  useEffect(() => {
    if (state.aiValuation !== null) asked.current = null;
  }, [state.aiValuation]);

  useEffect(() => {
    if (!ready || asked.current === key || !state.category) return;
    asked.current = key;
    dispatch({ type: "ai/pending", key });
    fetchAiValuation({
      title: state.title.trim(),
      category: state.category as Category,
      condition: state.condition,
    })
      .then((result) => dispatch({ type: "ai/done", key, result }))
      .catch((cause) => {
        dispatch({
          type: "ai/failed",
          key,
          message:
            cause instanceof ApiError && cause.status === 429
              ? "You have used the AI estimates available for now."
              : cause instanceof ApiError && cause.status !== 0 && cause.message
                ? cause.message
                : "AI valuation is unavailable right now.",
        });
      });
  }, [ready, key, state.title, state.category, state.condition, dispatch]);
}

export function AiValuationDetails() {
  const { state, dispatch } = usePost();
  const [linkError, setLinkError] = useState(false);
  const ai = state.aiValuation;
  const result = currentAi(state);

  if (state.revaluationSpent) return null;

  const retry = () => {
    // Clearing the state re-arms useAiValuation, which asks again.
    dispatch({ type: "ai/reset", notice: "" });
  };

  return (
    <View
      style={{
        marginTop: 18,
        padding: 14,
        borderWidth: postBorder.field,
        borderColor: postColor.line,
        borderRadius: postRadius.button,
        backgroundColor: postColor.inset,
      }}
    >
      {state.aiNotice ? (
        <Text
          accessibilityRole="alert"
          style={[textStyle(postType.helper), { color: postColor.warmInk, marginBottom: 8 }]}
        >
          {state.aiNotice}
        </Text>
      ) : null}

      {ai === null || ai.status === "loading" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <ActivityIndicator size="small" color={postColor.forest} />
          <Text style={[textStyle(postType.helper), { color: postColor.inkSecondary, flex: 1 }]}>
            Checking current online listings for this item. This can take up to 20 seconds. Only
            the title, category and condition are sent, not your photo.
          </Text>
        </View>
      ) : result ? (
        <>
          <Text style={[textStyle(postType.smallTextLabel), { color: postColor.ink }]}>
            Why this estimate
          </Text>
          <Text style={[textStyle(postType.helper), { color: postColor.inkSecondary, marginTop: 4 }]}>
            {result.explanation}
          </Text>
          {result.sources.length ? (
            <View style={{ marginTop: 8 }}>
              {result.sources.map((source) => {
                const url = safeHttpsUrl(source.url);
                if (!url) return null;
                return (
                  <Tappable
                    key={url}
                    accessibilityRole="link"
                    accessibilityLabel={`Open source: ${source.title}`}
                    onPress={() => {
                      setLinkError(false);
                      void Linking.openURL(url).catch(() => setLinkError(true));
                    }}
                    style={{ minHeight: 40, justifyContent: "center" }}
                  >
                    <Text
                      numberOfLines={2}
                      style={[
                        textStyle(postType.smallTextLabel),
                        { color: postColor.forest, textDecorationLine: "underline" },
                      ]}
                    >
                      {source.title}
                    </Text>
                    <Text style={[textStyle(postType.helper), { color: postColor.inkMuted }]}>
                      {hostOf(url)}
                    </Text>
                  </Tappable>
                );
              })}
            </View>
          ) : null}
          {linkError ? (
            <Text style={[textStyle(postType.helper), { color: postColor.inkSecondary }]}>
              Could not open that source link.
            </Text>
          ) : null}
          <Text style={[textStyle(postType.helper), { color: postColor.inkMuted, marginTop: 8 }]}>
            An AI estimate{formatCheckedAt(result.checkedAt) ? `, checked ${formatCheckedAt(result.checkedAt)}` : ""}.
            These are online asking prices, not confirmed sales, and Leaves are not pesos: the
            listings only place your item within Baylo&apos;s range for its category and condition.
          </Text>
        </>
      ) : (
        <>
          <Text style={[textStyle(postType.smallTextLabel), { color: postColor.ink }]}>
            Baylo standard estimate
          </Text>
          <Text style={[textStyle(postType.helper), { color: postColor.inkSecondary, marginTop: 4 }]}>
            {ai.status === "fallback" ? `${ai.message} ` : ""}This value is Baylo&apos;s standard
            estimate from the category, condition and completed trades. It is not an AI estimate.
          </Text>
          <OutlineButton
            label="Try the AI estimate again"
            onPress={retry}
            style={{ marginTop: 12, height: postSize.button.confirm }}
          />
        </>
      )}
    </View>
  );
}
