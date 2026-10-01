import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * The old code screen's address, kept for the links that still use it (a
 * trade notification). The codes now live in the trade screen's handoff
 * panel; `handoff=1` opens it there directly, which is what arriving here
 * always did — including issuing the codes. See `app/trade.tsx`.
 */
export default function TradeCodeRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (!id) return <Redirect href="/(app)/trades" />;
  return <Redirect href={`/trade?id=${encodeURIComponent(id)}&handoff=1`} />;
}
