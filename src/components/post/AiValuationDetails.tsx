import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Text, View } from "react-native";

import { ApiError } from "../../api/client";
import { fetchAiValuation, type Category } from "../../api/post";
import { aiKeyOf, currentAi, effectiveValue, usePost } from "../../post/state";
import { bracketLabel, bracketOf } from "../../lib/brackets";
import { postColor, postSpace, postType, textStyle } from "../../theme/post-tokens";
import { Tappable } from "../Tappable";
import { HelperRow, TextButton } from "./ui";

/**
 * The online-price half of step 4: asks /api/ai/valuation once per (title,
 * category, condition), and shows what came back — the typical asking price,
 * the suggested value at 1 Leaf = ₱1 and its bracket, and the listings it came from — or why
 * there is no online-price value.
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

const php = (n: number) => `₱${n.toLocaleString("en-PH")}`;


function SectionLabel({ children, top = 20 }: { children: string; top?: number }) {
  return (
    <Text style={[textStyle(postType.sectionLabel), { color: postColor.inkMuted, marginTop: top }]}>
      {children}
    </Text>
  );
}

const Divider = ({ top = 20 }: { top?: number }) => (
  <View style={{ height: 1, backgroundColor: postColor.divider, marginTop: top }} />
);

/**
 * Under the slider, in the flow's own register: hairlines, mono section
 * labels, no card.
 *
 *   ONLINE ASKING PRICE       what the AI found (median, count)
 *   SUGGESTED VALUE           the typical price in Leaves (1 Leaf = ₱1) and
 *                             its bracket
 *   LISTINGS CHECKED          each listing, its site and its price
 */
export function AiValuationDetails() {
  const { state, dispatch } = usePost();
  const [linkError, setLinkError] = useState(false);
  const ai = state.aiValuation;
  const result = currentAi(state);

  if (state.revaluationSpent) return null;

  const notice = state.aiNotice ? (
    <Text
      accessibilityRole="alert"
      style={[textStyle(postType.fieldError), { color: postColor.warmInk, marginTop: 16 }]}
    >
      {state.aiNotice}
    </Text>
  ) : null;

  if (ai === null || ai.status === "loading") {
    return (
      <View>
        <Divider top={24} />
        {notice}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 20 }}>
          <ActivityIndicator size="small" color={postColor.forest} />
          <Text style={[textStyle(postType.helper), { color: postColor.inkSecondary, flex: 1 }]}>
            Checking online prices for this item. This can take up to a minute. Only the title,
            category and condition are sent, not your photo.
          </Text>
        </View>
      </View>
    );
  }

  if (!result) {
    return (
      <View>
        <Divider top={24} />
        {notice}
        <SectionLabel>ONLINE PRICE CHECK</SectionLabel>
        <Text style={[textStyle(postType.helper), { color: postColor.inkSecondary, marginTop: 6 }]}>
          {ai.status === "fallback" ? `${ai.message} ` : ""}The value above is Baylo&apos;s standard
          estimate from the category, condition and completed trades. It is not based on online
          prices.
        </Text>
        <View style={{ alignItems: "flex-start", marginTop: 4 }}>
          <TextButton
            label="Check online prices again"
            onPress={() => dispatch({ type: "ai/reset", notice: "" })}
          />
        </View>
      </View>
    );
  }

  const { market, sources } = result;
  const suggested = result.valuation?.suggestedLeaves ?? Math.round(market.typicalPhp);
  const chosen = effectiveValue(state);
  const checkedAt = formatCheckedAt(result.checkedAt);

  return (
    <View>
      <Divider top={24} />
      {notice}

      <SectionLabel>ONLINE ASKING PRICE</SectionLabel>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 }}>
        <Text style={[textStyle(postType.detectResult), { color: postColor.ink }]}>
          {php(market.typicalPhp)}
        </Text>
        <Text style={[textStyle(postType.helper), { color: postColor.inkSecondary }]}>
          typical · {market.listingCount} listing{market.listingCount === 1 ? "" : "s"}
        </Text>
      </View>

      {/*
        1 Leaf = ₱1. Not an exchange rate (Leaves are never bought or cashed
        out); it is the scale the brackets are drawn in. So the online price
        is the suggested value, and its bracket follows from it.
      */}
      <SectionLabel>{"SUGGESTED VALUE"}</SectionLabel>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 }}>
        <Text style={[textStyle(postType.detectResult), { color: postColor.ink }]}>
          {`${suggested.toLocaleString("en-US")} Leaves`}
        </Text>
        <Text style={[textStyle(postType.helper), { color: postColor.inkSecondary }]}>
          {bracketLabel(bracketOf(suggested))}
        </Text>
      </View>
      <View style={{ marginTop: 10 }}>
        <HelperRow gap={postSpace.value.helperIconGap}>
          {`1 Leaf = ₱1, so a typical online price of ${php(market.typicalPhp)} suggests ${suggested.toLocaleString("en-US")} Leaves.` +
            (chosen !== null && chosen !== suggested
              ? ` You set ${chosen.toLocaleString("en-US")} Leaves, which is ${bracketLabel(bracketOf(chosen))}.`
              : "")}
        </HelperRow>
      </View>

      {sources.length ? (
        <>
          <Divider />
          <SectionLabel>LISTINGS CHECKED</SectionLabel>
          <View style={{ marginTop: 4 }}>
            {sources.map((source, i) => {
              const url = safeHttpsUrl(source.url);
              if (!url) return null;
              return (
                <Tappable
                  key={url}
                  accessibilityRole="link"
                  accessibilityLabel={`Open listing: ${source.title}, ${php(source.pricePhp)}`}
                  onPress={() => {
                    setLinkError(false);
                    void Linking.openURL(url).catch(() => setLinkError(true));
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    minHeight: 56,
                    gap: 12,
                    borderTopWidth: i ? 1 : 0,
                    borderTopColor: postColor.divider,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={[textStyle(postType.draftRowTitle), { color: postColor.forest }]}
                    >
                      {`${source.title} ↗`}
                    </Text>
                    <Text
                      style={[textStyle(postType.draftRowMeta), { color: postColor.inkMuted, marginTop: 2 }]}
                    >
                      {hostOf(url)}
                    </Text>
                  </View>
                  <Text style={[textStyle(postType.bandValue), { color: postColor.ink }]}>
                    {php(source.pricePhp)}
                  </Text>
                </Tappable>
              );
            })}
          </View>
          {linkError ? (
            <Text style={[textStyle(postType.helper), { color: postColor.inkSecondary }]}>
              Could not open that listing.
            </Text>
          ) : null}
        </>
      ) : null}

      <Text style={[textStyle(postType.helper), { color: postColor.inkMuted, marginTop: 8 }]}>
        {`Asking prices found by AI${checkedAt ? ` on ${checkedAt}` : ""}, not confirmed sales.`}
      </Text>
    </View>
  );
}
