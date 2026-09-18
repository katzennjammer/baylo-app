/**
 * The sentence the owner reads for each value-rejection code.
 *
 * A HAND-KEPT MIRROR of `owner` in baylo/src/lib/value-rejection.ts, like
 * brackets.ts. The server sends the sentence too (`review.reason`), and the
 * screen prefers that; this table is for the notification list, which only
 * carries the code inside the message, and for a code a newer server knows
 * and this build does not, which falls back to OTHER's line. Change one,
 * change the other.
 */
export const VALUE_REJECTION_SENTENCE: Record<string, string> = {
  OVERVALUED_FOR_CONDITION:
    "The value asked for is more than this item's condition supports.",
  ABOVE_MARKET: "Similar items on Baylo list for well below the value asked for.",
  WRONG_CATEGORY:
    "The category chosen doesn't match the item, so the value was judged against the wrong things.",
  PHOTOS_DO_NOT_SUPPORT_VALUE:
    "The photos don't show enough to support the value asked for.",
  OTHER: "The value asked for could not be approved.",
};

export function valueRejectionSentence(code: string | null | undefined): string {
  return VALUE_REJECTION_SENTENCE[code ?? ""] ?? VALUE_REJECTION_SENTENCE.OTHER;
}
