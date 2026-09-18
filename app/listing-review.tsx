import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";

import { ApiError } from "../src/api/client";
import { APPEAL_MESSAGE_MAX, useAppealListing, useDeleteItem, useItem, useUpdateItem } from "../src/api/item";
import type { ListingReview } from "../src/api/types";
import { Splash } from "../src/components/Splash";
import { Hairline, OfferScreenHost, PrimaryButton, SecondaryButton, Section, SectionLabel } from "../src/components/offer/chrome";
import { Gutter, TradesBackTitle } from "../src/components/trades/chrome";
import { TradesErrorPanel, TradesSkeleton } from "../src/components/trades/states";
import { Tappable } from "../src/components/Tappable";
import { bracketLabel, bracketOf, bracketRange } from "../src/lib/brackets";
import { valueRejectionSentence } from "../src/lib/value-rejection";
import { offerBorder, offerColor, offerRadius, offerSpace, offerType, textStyle } from "../src/theme/offer-tokens";

/**
 * /listing-review?id=<itemId> — what happened to your listing, and what you
 * can do about it.
 *
 * ── THREE STATES, ONE SCREEN ────────────────────────────────────────────────
 *
 *   waiting    parked for a value review; an admin has not answered.
 *   rejected   the review said no, with a reason. The three exits the
 *              notification promised — list at the suggestion, set a value
 *              within the cap, delete — plus Appeal.
 *   hidden     a moderator takedown. Nothing to edit your way out of: Appeal
 *              or delete.
 *
 * The whole screen is drawn from `review` on the item detail. Everything the
 * owner is shown here is what the server decided to show — the reason CODE
 * (never the moderator's note, never their name) and both numbers with both
 * brackets, because the cap is a bracket and the owner is being asked to move
 * a number inside one.
 *
 * ── WHY THE VALUE FIELD IS HERE AND NOT IN EditListingSheet ─────────────────
 *
 * That sheet deliberately edits nothing that re-prices a listing, and says so.
 * This screen exists BECAUSE the price is the problem, so the field lives with
 * the explanation of what number would be accepted. It PATCHes valueLeaves
 * only; the server re-judges, and if the suggestion has moved since and the
 * number lands above the cap again, `valueReview.pending` says so and the
 * screen tells the truth rather than "Saved".
 *
 * ── THE APPEAL BOX ──────────────────────────────────────────────────────────
 *
 * Inline, 300 characters, one per decision. Filing changes nothing you can
 * see — the listing stays hidden — and locks the value until an admin
 * decides, which the screen says before the button. Deleting withdraws.
 */
export default function ListingReviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const detail = useItem(id);

  const apiError = detail.error instanceof ApiError ? detail.error : null;
  if (apiError?.code === "UNAUTHENTICATED") return <Splash waitingOn="Signing you back in" />;

  const item = detail.data?.item;
  const review = detail.data?.review ?? null;

  return (
    <OfferScreenHost imeInset={0}>
      <TradesBackTitle title="Your listing" onBack={() => router.back()} />
      {detail.isError ? (
        <TradesErrorPanel onRetry={() => void detail.refetch()} />
      ) : detail.isPending || !item ? (
        <TradesSkeleton />
      ) : !detail.data.viewer.isOwner || review === null ? (
        /*
         * Reached with a stale notification — the listing has since been
         * published, restored or deleted — or by somebody who is not the
         * owner. Say so rather than draw an empty review.
         */
        <Gutter style={{ paddingTop: 18, gap: 14 }}>
          <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
            {detail.data.viewer.isOwner
              ? "Nothing is waiting on this listing any more."
              : "Only the owner can see this."}
          </Text>
          <SecondaryButton label="Open the listing" onPress={() => router.replace({ pathname: "/item", params: { id: item.id } })} />
        </Gutter>
      ) : (
        <ReviewBody
          itemId={item.id}
          title={item.title}
          image={item.images[0] ?? null}
          review={review}
          onGone={() => router.back()}
        />
      )}
    </OfferScreenHost>
  );
}

function ReviewBody({
  itemId,
  title,
  image,
  review,
  onGone,
}: {
  itemId: string;
  title: string;
  image: string | null;
  review: ListingReview;
  onGone: () => void;
}) {
  const router = useRouter();
  const update = useUpdateItem(itemId);
  const remove = useDeleteItem();
  const appeal = useAppealListing(itemId);
  const [valueText, setValueText] = useState("");
  const [appealText, setAppealText] = useState("");
  const [appealOpen, setAppealOpen] = useState(false);

  const locked = review.appeal.status === "OPEN";
  const busy = update.isPending || remove.isPending || appeal.isPending;

  const cap = review.capBracket;
  const capMax = cap !== null ? bracketRange(cap).max : null;
  const typed = Number.parseInt(valueText, 10);
  const typedOk = Number.isFinite(typed) && typed > 0 && (cap === null || bracketOf(typed) <= cap);

  const fail = (heading: string, e: unknown) =>
    Alert.alert(heading, e instanceof ApiError ? e.message : "Something went wrong. Please try again.");

  /** PATCH the value; say what the server decided. */
  const setValue = (valueLeaves: number, what: string) =>
    update.mutate(
      { valueLeaves },
      {
        onSuccess: (r) => {
          if (r.valueReview?.pending) {
            Alert.alert(
              "Sent for review again",
              "The suggestion has moved since, and that value is now more than one bracket above it. A person will look at it.",
            );
            return;
          }
          Alert.alert("Listed", `${what}. Your listing is live.`, [{ text: "OK", onPress: onGone }]);
        },
        onError: (e) => fail("Could not change the value", e),
      },
    );

  const confirmDelete = () =>
    Alert.alert(
      "Delete this listing?",
      locked
        ? "This withdraws your appeal as well. The listing is removed for good."
        : "The listing is removed for good.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => remove.mutate(itemId, { onSuccess: onGone, onError: (e) => fail("Could not delete that", e) }),
        },
      ],
    );

  const sendAppeal = () => {
    const message = appealText.trim();
    if (!message) return;
    appeal.mutate(message, {
      onSuccess: () => {
        setAppealOpen(false);
        setAppealText("");
        Alert.alert("Appeal sent", "An admin will look at it. The listing stays hidden until then, and its value can't be changed while they do.");
      },
      onError: (e) => fail("Could not send the appeal", e),
    });
  };

  const headline =
    review.state === "hidden"
      ? "Hidden by a moderator"
      : review.state === "waiting"
        ? "Waiting for a value review"
        : "Value not approved";

  const explanation =
    review.state === "hidden"
      ? "A moderator has taken this listing down. Nobody else can see it, and it can't be relisted. If you think that was wrong, you can appeal once; otherwise you can delete it."
      : review.state === "waiting"
        ? "You asked for a value more than one bracket above the suggestion, so a person checks it before it goes live. Until then only you can see it. You don't have to wait: list it at the suggestion, or set a value within the cap, and it goes live now."
        : (review.reason ?? valueRejectionSentence(review.reasonCode)) +
          " The listing stays hidden until you choose what to do with it.";

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {/* The listing */}
      <Section pad={{ top: 14, bottom: 14 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View style={{ width: 56, height: 56, borderRadius: offerRadius.button, overflow: "hidden", backgroundColor: offerColor.photoPlaceholder }}>
            {image ? <Image source={{ uri: image }} contentFit="cover" style={{ width: "100%", height: "100%" }} /> : null}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[textStyle(offerType.itemTitleRow), { color: offerColor.ink }]} numberOfLines={2}>{title}</Text>
            <Tappable onPress={() => router.push({ pathname: "/item", params: { id: itemId } })} accessibilityRole="link">
              <Text style={[textStyle(offerType.rowSubtitle), { color: offerColor.deep, marginTop: 2 }]}>Open the listing</Text>
            </Tappable>
          </View>
        </View>
      </Section>
      <Hairline />

      {/* What happened */}
      <Section pad={{ top: 18, bottom: 14 }}>
        <Text style={[textStyle(offerType.sheetHeading), { color: offerColor.ink }]}>{headline}</Text>
        <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary, marginTop: 8 }]}>{explanation}</Text>

        {review.state !== "hidden" && review.requestedLeaves !== null ? (
          <View style={{ marginTop: 16, gap: 8 }}>
            <ValueLine label="You asked for" value={review.requestedLeaves} bracket={review.requestedBracket} strong />
            {review.suggestedLeaves !== null ? (
              <ValueLine label="Suggested" value={review.suggestedLeaves} bracket={review.suggestedBracket} />
            ) : null}
            {cap !== null ? (
              <Text style={[textStyle(offerType.helper), { color: offerColor.inkTertiary }]}>
                Goes live without a review up to {bracketLabel(cap)}{capMax !== null ? ` (${capMax.toLocaleString()} Leaves)` : ""}.
              </Text>
            ) : null}
          </View>
        ) : null}
      </Section>

      {/* An appeal already filed */}
      {review.appeal.status ? (
        <>
          <Hairline />
          <Section pad={{ top: 16, bottom: 14 }}>
            <SectionLabel>Your appeal</SectionLabel>
            <Text style={[textStyle(offerType.body), { color: offerColor.ink, marginTop: offerSpace.labelToContent }]}>
              {review.appeal.status === "OPEN"
                ? "Waiting for an admin. The value can't be changed until they decide; you can still delete the listing, which withdraws the appeal."
                : review.appeal.status === "UPHELD"
                  ? "Reviewed — the decision stands. It can't be appealed again."
                  : review.appeal.status === "OVERTURNED"
                    ? "Accepted."
                    : "Withdrawn."}
            </Text>
            {review.appeal.message ? (
              <Text style={[textStyle(offerType.bodyDense), { color: offerColor.inkSecondary, marginTop: 8, fontStyle: "italic" }]}>
                “{review.appeal.message}”
              </Text>
            ) : null}
          </Section>
        </>
      ) : null}

      {/* The exits */}
      <Hairline />
      <Section pad={{ top: 16, bottom: 8 }}>
        <SectionLabel>What you can do</SectionLabel>
      </Section>

      {review.state !== "hidden" && !locked && review.suggestedLeaves !== null ? (
        <Section pad={{ top: 4, bottom: 12 }}>
          <PrimaryButton
            label={`List it at the suggested ${review.suggestedLeaves.toLocaleString()}`}
            onPress={() => setValue(review.suggestedLeaves as number, `Listed at ${(review.suggestedLeaves as number).toLocaleString()} Leaves`)}
            disabled={busy}
          />
        </Section>
      ) : null}

      {review.state !== "hidden" && !locked && cap !== null ? (
        <Section pad={{ top: 4, bottom: 12 }}>
          <Text style={[textStyle(offerType.bodyDense), { color: offerColor.inkSecondary }]}>
            Or set your own value, up to {capMax !== null ? `${capMax.toLocaleString()} Leaves` : bracketLabel(cap)}:
          </Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 10, alignItems: "center" }}>
            <TextInput
              value={valueText}
              onChangeText={(t) => setValueText(t.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              placeholder={capMax !== null ? `1–${capMax}` : "Leaves"}
              placeholderTextColor={offerColor.inkDisabled}
              editable={!busy}
              accessibilityLabel="Your value in Leaves"
              style={[
                textStyle(offerType.body),
                {
                  flex: 1, color: offerColor.ink, paddingHorizontal: 12, paddingVertical: 10,
                  borderRadius: offerRadius.button, borderWidth: offerBorder.strong, borderColor: offerColor.strong, backgroundColor: offerColor.paper,
                },
              ]}
            />
            <View style={{ width: 120 }}>
              <SecondaryButton label="Set value" onPress={() => typedOk && setValue(typed, `Listed at ${typed.toLocaleString()} Leaves`)} />
            </View>
          </View>
          {valueText.length > 0 && !typedOk ? (
            <Text style={[textStyle(offerType.errorText), { color: offerColor.warm, marginTop: 6 }]}>
              That is {Number.isFinite(typed) && typed > 0 ? bracketLabel(bracketOf(typed)) : "not a number"} — above the cap, so it would go to review again.
            </Text>
          ) : null}
        </Section>
      ) : null}

      {review.appeal.canAppeal ? (
        <Section pad={{ top: 4, bottom: 12 }}>
          {!appealOpen ? (
            <SecondaryButton label="Appeal this decision" onPress={() => setAppealOpen(true)} />
          ) : (
            <View>
              <Text style={[textStyle(offerType.bodyDense), { color: offerColor.inkSecondary }]}>
                Say why the decision should be looked at again. One appeal per decision; the listing stays hidden and its value is locked until an admin answers.
              </Text>
              <TextInput
                value={appealText}
                onChangeText={(t) => setAppealText(t.slice(0, APPEAL_MESSAGE_MAX))}
                multiline
                maxLength={APPEAL_MESSAGE_MAX}
                placeholder="What the reviewer should know"
                placeholderTextColor={offerColor.inkDisabled}
                editable={!busy}
                autoFocus
                accessibilityLabel="Your appeal"
                style={[
                  textStyle(offerType.body),
                  {
                    minHeight: 110, textAlignVertical: "top", color: offerColor.ink, marginTop: 10,
                    paddingHorizontal: 12, paddingVertical: 10, borderRadius: offerRadius.button,
                    borderWidth: offerBorder.strong, borderColor: offerColor.strong, backgroundColor: offerColor.paper,
                  },
                ]}
              />
              <Text style={[textStyle(offerType.helper), { color: offerColor.inkTertiary, marginTop: 4, textAlign: "right" }]}>
                {appealText.length}/{APPEAL_MESSAGE_MAX}
              </Text>
              <View style={{ marginTop: 8 }}>
                <PrimaryButton label={appeal.isPending ? "Sending…" : "Send appeal"} onPress={sendAppeal} disabled={busy || appealText.trim().length === 0} disabledHint="Write your appeal first" />
              </View>
            </View>
          )}
        </Section>
      ) : null}

      <Section pad={{ top: 4, bottom: 12 }}>
        <Tappable onPress={busy ? undefined : confirmDelete} accessibilityRole="button" accessibilityState={{ disabled: busy }}>
          <Text style={[textStyle(offerType.buttonSecondary), { color: offerColor.warm, textAlign: "center", paddingVertical: 12 }]}>
            Delete this listing
          </Text>
        </Tappable>
      </Section>
    </ScrollView>
  );
}

function ValueLine({ label, value, bracket, strong }: { label: string; value: number; bracket: number | null; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
      <Text style={[textStyle(offerType.bodyDense), { color: offerColor.inkSecondary }]}>{label}</Text>
      <Text style={[textStyle(strong ? offerType.itemTitleRow : offerType.bodyDense), { color: offerColor.ink }]}>
        {value.toLocaleString()} Leaves{bracket !== null ? ` · ${bracketLabel(bracket)}` : ""}
      </Text>
    </View>
  );
}
