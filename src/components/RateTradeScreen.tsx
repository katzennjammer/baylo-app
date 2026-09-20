import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "../api/client";
import { useSubmitTradeReview, useTradeHistory } from "../api/trades";
import { Gutter } from "./trades/chrome";
import { Splash } from "./Splash";
import { offerType, textStyle } from "../theme/offer-tokens";
import { offerColor } from "../theme/offer-tokens";
import { font } from "../theme/tokens";

const labels = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

export default function RateTradeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === "dark";
  const { id } = useLocalSearchParams<{ id?: string }>();
  const history = useTradeHistory(!!id);
  const submit = useSubmitTradeReview();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);

  const colors = useMemo(
    () => dark
      ? {
          background: "#14140F",
          surface: "#211F18",
          ink: "#FAFAF7",
          secondary: "#C5C1B5",
          tertiary: "#999487",
          border: "#4A473C",
          field: "#2C2A22",
          gold: "#F4B942",
          disabled: "#676257",
          onGold: "#211A08",
        }
      : {
          background: offerColor.paper,
          surface: "#FFFFFF",
          ink: offerColor.ink,
          secondary: offerColor.inkSecondary,
          tertiary: offerColor.inkTertiary,
          border: offerColor.rule,
          field: "#FFFFFF",
          gold: "#B7791F",
          disabled: "#B8B5AA",
          onGold: "#FFFFFF",
        },
    [dark],
  );

  const trade = history.data?.trades.find((item) => item.id === id) ?? null;
  const partnerName = trade?.counterparty.name ?? "your trading partner";

  function goBack() {
    router.back();
  }

  function submitReview() {
    if (!id || stars === 0) {
      setError("Choose a star rating to continue.");
      return;
    }
    setError(null);
    submit.mutate(
      { tradeId: id, stars, comment },
      {
        onSuccess: goBack,
        onError: (cause) => {
          if (cause instanceof ApiError && cause.status === 409) {
            setDuplicate(true);
            setError("This trade has already been rated.");
            void history.refetch();
            return;
          }
          setError(cause instanceof ApiError ? cause.message : "Could not submit your review.");
        },
      },
    );
  }

  if (history.isPending && !history.data) return <Splash waitingOn="Loading this trade" />;

  if (!id || (!trade && !history.isError)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <Header title="Rate trade" onBack={goBack} colors={colors} />
        <Gutter style={{ paddingTop: 28 }}>
          <Text style={[textStyle(offerType.body), { color: colors.secondary }]}>That completed trade is no longer available.</Text>
        </Gutter>
      </View>
    );
  }

  const alreadyRated = duplicate || !!trade?.myReview;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <Header title="Rate trade" onBack={goBack} colors={colors} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 28, gap: 10 }}>
          <Text accessibilityRole="header" style={[textStyle(offerType.screenHeading), { color: colors.ink }]}>How was trading with {partnerName}?</Text>
          <Text style={[textStyle(offerType.body), { color: colors.secondary }]}>Your review helps keep Baylo trustworthy.</Text>
        </View>

        <View style={{ alignItems: "center", paddingTop: 28, paddingBottom: 20 }}>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                onPress={() => { setStars(value); setError(null); }}
                disabled={alreadyRated}
                accessibilityRole="button"
                accessibilityLabel={`${value} star${value === 1 ? "" : "s"}`}
                style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons
                  name={value <= (trade?.myReview?.rating ?? stars) ? "star" : "star-outline"}
                  size={38}
                  color={value <= (trade?.myReview?.rating ?? stars) ? colors.gold : colors.disabled}
                />
              </Pressable>
            ))}
          </View>
          <Text style={[textStyle(offerType.buttonSecondary), { color: colors.gold, minHeight: 22, marginTop: 8 }]}>
            {trade?.myReview?.rating ? `${trade.myReview.rating} stars` : stars ? labels[stars] : "Select a rating"}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 8 }}>
          <Text style={[textStyle(offerType.buttonTertiary), { color: colors.ink }]}>Comment <Text style={{ color: colors.tertiary }}>(optional)</Text></Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            editable={!alreadyRated}
            maxLength={400}
            multiline
            numberOfLines={4}
            placeholder="Describe your experience"
            placeholderTextColor={colors.tertiary}
            textAlignVertical="top"
            style={{
              minHeight: 112,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              backgroundColor: colors.field,
              color: colors.ink,
              padding: 14,
              fontFamily: font.sans,
              fontSize: 15,
              lineHeight: 22,
            }}
          />
          <Text style={[textStyle(offerType.deadline), { color: colors.tertiary, textAlign: "right" }]}>{comment.length}/400</Text>
        </View>

        {error ? (
          <Text accessibilityLiveRegion="polite" style={[textStyle(offerType.errorText), { color: colors.gold, paddingHorizontal: 20, paddingTop: 18 }]}>{error}</Text>
        ) : null}

        {history.isError ? (
          <Text style={[textStyle(offerType.errorText), { color: colors.gold, paddingHorizontal: 20, paddingTop: 18 }]}>Could not load this trade. Try again from Trades history.</Text>
        ) : null}
      </ScrollView>

      <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16), gap: 8 }}>
        {alreadyRated ? (
          <Pressable onPress={goBack} style={{ minHeight: 52, borderRadius: 12, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" }} accessibilityRole="button">
            <Text style={[textStyle(offerType.buttonPrimary), { color: colors.onGold }]}>Back to trades</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              onPress={submitReview}
              disabled={submit.isPending || stars === 0}
              style={{ minHeight: 52, borderRadius: 12, backgroundColor: stars > 0 ? colors.gold : colors.disabled, alignItems: "center", justifyContent: "center" }}
              accessibilityRole="button"
            >
              <Text style={[textStyle(offerType.buttonPrimary), { color: colors.onGold }]}>{submit.isPending ? "Submitting" : "Submit review"}</Text>
            </Pressable>
            <Pressable onPress={goBack} disabled={submit.isPending} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }} accessibilityRole="button">
              <Text style={[textStyle(offerType.buttonSecondary), { color: colors.secondary }]}>Skip</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function Header({ title, onBack, colors }: { title: string; onBack: () => void; colors: { ink: string; border: string } }) {
  return (
    <View style={{ height: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Pressable onPress={onBack} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }} accessibilityRole="button" accessibilityLabel="Go back">
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </Pressable>
      <Text style={[textStyle(offerType.navTitle), { color: colors.ink, marginLeft: 4 }]}>{title}</Text>
    </View>
  );
}
