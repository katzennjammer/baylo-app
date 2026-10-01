import { Redirect, useLocalSearchParams } from "expo-router";

/** The old finished-trade summary. It is the trade screen's done panel now. */
export default function TradeSummaryRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (!id) return <Redirect href="/trades-history" />;
  return <Redirect href={`/trade?id=${encodeURIComponent(id)}`} />;
}
