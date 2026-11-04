import { useRouter } from "expo-router";
import { ScrollView } from "react-native";

import { useTradeHistory } from "../src/api/trades";
import { OfferScreenHost } from "../src/components/offer/chrome";
import { TradesBackTitle } from "../src/components/trades/chrome";
import * as copy from "../src/components/trades/copy";
import { HistoryContent } from "../src/components/trades/HistoryContent";
import { TradesSkeleton } from "../src/components/trades/states";

/** Finished trades, as its own screen. The list itself: `HistoryContent`. */
export default function TradesHistoryScreen() {
  const router = useRouter();
  const history = useTradeHistory();

  if (history.isPending && !history.data) {
    return (
      <OfferScreenHost imeInset={0}>
        <TradesBackTitle title={copy.nav.history} onBack={() => router.back()} />
        <TradesSkeleton />
      </OfferScreenHost>
    );
  }

  return (
    <OfferScreenHost imeInset={0}>
      <TradesBackTitle title={copy.nav.history} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <HistoryContent history={history} />
      </ScrollView>
    </OfferScreenHost>
  );
}
