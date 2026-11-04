import { useState } from "react";
import { ActivityIndicator, Linking, Text, View } from "react-native";

import { ApiError } from "../../api/client";
import { fetchPriceReference, type Category, type Condition, type PriceReferencePayload } from "../../api/post";
import { postBorder, postColor, postRadius, postSize, postType, textStyle } from "../../theme/post-tokens";
import { Tappable } from "../Tappable";
import { OutlineButton } from "./ui";

type SearchState =
  | { key: string; status: "loading" }
  | { key: string; status: "error"; message: string }
  | { key: string; status: "ready"; payload: PriceReferencePayload };

function safeHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function formatPhp(value: number): string {
  return `₱${value.toLocaleString("en-PH")}`;
}

function formatCheckedAt(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

export function OnlinePriceReference({
  title,
  category,
  condition,
}: {
  title: string;
  category: Category;
  condition: Condition;
}) {
  const key = JSON.stringify([title.trim(), category, condition]);
  const [search, setSearch] = useState<SearchState | null>(null);
  const [linkErrorKey, setLinkErrorKey] = useState<string | null>(null);
  const currentSearch = search?.key === key ? search : null;
  const loading = currentSearch?.status === "loading";
  const payload = currentSearch?.status === "ready" ? currentSearch.payload : null;
  const error = currentSearch?.status === "error" ? currentSearch.message : null;
  const checkedAt = payload ? formatCheckedAt(payload.checkedAt) : null;

  const searchPrices = async () => {
    setLinkErrorKey(null);
    setSearch({ key, status: "loading" });
    try {
      const result = await fetchPriceReference({ title, category, condition });
      setSearch({ key, status: "ready", payload: result });
    } catch (cause) {
      const message =
        cause instanceof ApiError
          ? cause.message
          : "We couldn't load online price references. Please try again.";
      setSearch({ key, status: "error", message });
    }
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
      <Text style={[textStyle(postType.smallTextLabel), { color: postColor.ink }]}>
        Online price reference
      </Text>
      <Text
        style={[
          textStyle(postType.helper),
          { color: postColor.inkSecondary, marginTop: 4 },
        ]}
      >
        Optional AI estimate from current Philippine listings. Search uses the title, category,
        and condition, not your photo. It is not a Leaves value and does not affect your bracket.
      </Text>

      {!payload ? (
        <OutlineButton
          label={loading ? "Searching online listings..." : "Search online prices"}
          onPress={() => void searchPrices()}
          disabled={loading || title.trim().length === 0}
          icon={loading ? <ActivityIndicator size="small" color={postColor.forest} /> : undefined}
          style={{ marginTop: 12, height: postSize.button.confirm }}
        />
      ) : (
        <>
          {checkedAt ? (
            <Text
              style={[
                textStyle(postType.helper),
                { color: postColor.inkMuted, marginTop: 8 },
              ]}
            >
              Prices checked {checkedAt}
            </Text>
          ) : null}
          {payload.estimate ? (
            <Text
              style={[
                textStyle(postType.provenance),
                { color: postColor.ink, marginTop: 12 },
              ]}
            >
              {formatPhp(payload.estimate.lowPhp)}–{formatPhp(payload.estimate.highPhp)}
            </Text>
          ) : null}
          <Text
            style={[
              textStyle(postType.helper),
              { color: postColor.inkSecondary, marginTop: 6 },
            ]}
          >
            {payload.note}
          </Text>
          {payload.sources.length ? (
            <View style={{ marginTop: 8 }}>
              {payload.sources.map((source) => {
                const url = safeHttpsUrl(source.url);
                if (!url) return null;
                return (
                  <Tappable
                    key={url}
                    accessibilityRole="link"
                    accessibilityLabel={`Open source: ${source.title}`}
                    onPress={() => {
                      setLinkErrorKey(null);
                      void Linking.openURL(url).catch(() => setLinkErrorKey(key));
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
                  </Tappable>
                );
              })}
            </View>
          ) : null}
          {linkErrorKey === key ? (
            <Text style={[textStyle(postType.helper), { color: postColor.inkSecondary }]}>
              Could not open that source link.
            </Text>
          ) : null}
          <Text
            style={[
              textStyle(postType.helper),
              { color: postColor.inkMuted, marginTop: 8 },
            ]}
          >
            These are asking prices, not confirmed sale prices. Your official Leaves value is
            calculated separately.
          </Text>
          <OutlineButton
            label="Search again"
            onPress={() => void searchPrices()}
            disabled={loading}
            style={{ marginTop: 12, height: postSize.button.confirm }}
          />
        </>
      )}

      {error ? (
        <Text
          accessibilityRole="alert"
          style={[
            textStyle(postType.helper),
            { color: postColor.warmInk, marginTop: 8 },
          ]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
