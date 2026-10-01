import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * The old incoming-offer screen. Its decision — the same PATCH, the same
 * consent sheet, the same Premium gate — is `useOfferDecisionFlow()`, drawn
 * by the trade screen's offer panel. See `app/trade.tsx`.
 */
export default function OfferReviewRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (!id) return <Redirect href="/(app)/trades" />;
  return <Redirect href={`/trade?offer=${encodeURIComponent(id)}`} />;
}
