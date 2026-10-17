import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Linking, ScrollView, Text, View } from "react-native";

import { ApiError, apiV1 } from "../src/api/client";
import { Splash } from "../src/components/Splash";
import { Hairline, OfferScreenHost, SecondaryButton } from "../src/components/offer/chrome";
import { Gutter, TradesBackTitle } from "../src/components/trades/chrome";
import { TradesErrorPanel, TradesSkeleton } from "../src/components/trades/states";
import { formatLongDate } from "../src/lib/dob";
import { SUPPORT_EMAIL } from "../src/lib/suspension";
import { offerColor, offerSpace, offerType, textStyle } from "../src/theme/offer-tokens";

/** GET /api/v1/suspensions/[id]. Dates are ISO strings on the wire. */
interface SuspensionDetail {
  id: string;
  level: number;
  reason: string;
  startsAt: string;
  endsAt: string | null;
  liftedAt: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const longDate = (iso: string) => {
  const d = new Date(iso);
  return formatLongDate({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });
};

const ordinal = (n: number) =>
  n === 1 ? "First" : n === 2 ? "Second" : n === 3 ? "Third" : `Number ${n}`;

/**
 * One past suspension, in full — where the "Welcome back" notification lands.
 *
 * The notification row is a sentence; this is the record behind it: the reason
 * in the admin's own words, the dates, how it ended and which suspension it was
 * for the account. It exists so that the account holder can read the whole of
 * what was decided about them, and knows where to answer it.
 *
 * Read-only. There is nothing to do here except disagree, and the one control
 * is the address to do that at.
 */
export default function SuspensionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const detail = useQuery({
    queryKey: ["suspension", id ?? ""],
    queryFn: () =>
      apiV1<{ suspension: SuspensionDetail }>(`/api/v1/suspensions/${encodeURIComponent(id!)}`),
    enabled: !!id,
    select: (r) => r.data.suspension,
  });

  const apiError = detail.error instanceof ApiError ? detail.error : null;
  if (apiError?.code === "UNAUTHENTICATED") return <Splash waitingOn="Signing you back in" />;

  const s = detail.data;

  return (
    <OfferScreenHost imeInset={0}>
      <TradesBackTitle title="Suspension" onBack={() => router.back()} />
      {apiError?.status === 404 ? (
        <Gutter style={{ paddingTop: 18 }}>
          <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
            This suspension record is no longer available.
          </Text>
        </Gutter>
      ) : detail.isError ? (
        <TradesErrorPanel onRetry={() => void detail.refetch()} />
      ) : detail.isPending || !s ? (
        <TradesSkeleton />
      ) : (
        <SuspensionBody s={s} />
      )}
    </OfferScreenHost>
  );
}

function SuspensionBody({ s }: { s: SuspensionDetail }) {
  // Lifted by staff before it would have run out (or it had no end date).
  const liftedEarly =
    s.liftedAt !== null && (s.endsAt === null || new Date(s.liftedAt) < new Date(s.endsAt));
  const endedOn = liftedEarly ? s.liftedAt! : s.endsAt;
  const over = endedOn !== null && new Date(endedOn).getTime() <= Date.now();

  const plannedDays = s.endsAt
    ? Math.max(1, Math.round((new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / DAY_MS))
    : null;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      <Gutter style={{ paddingTop: 18, paddingBottom: 16, gap: 6 }}>
        <Text style={[textStyle(offerType.body), { color: offerColor.ink }]}>
          {over ? "This suspension is over. Welcome back." : "This suspension is in force."}
        </Text>
        <Text style={[textStyle(offerType.helper), { color: offerColor.inkSecondary }]}>
          {liftedEarly
            ? "Our team lifted it before its end date."
            : over
              ? "It ran for the full period that was set."
              : "You will be able to use Baylo again when it ends."}
        </Text>
      </Gutter>

      <Hairline />
      <Line label="Reason" value={s.reason} />
      <Hairline />
      <Line label="Which suspension" value={`${ordinal(s.level)} on this account`} />
      <Hairline />
      <Line label="Started" value={longDate(s.startsAt)} />
      <Hairline />
      <Line
        label="Set to last"
        value={plannedDays === null ? "Until our team lifted it" : `${plannedDays} day${plannedDays === 1 ? "" : "s"}`}
      />
      <Hairline />
      <Line
        label={liftedEarly ? "Lifted" : "Ended"}
        value={endedOn ? longDate(endedOn) : "Not yet"}
      />
      <Hairline />

      <Gutter style={{ paddingTop: 16, gap: 14 }}>
        <Text style={[textStyle(offerType.helper), { color: offerColor.inkSecondary }]}>
          Further breaches of the community rules can lead to a longer or permanent suspension.
          Nothing was deleted — your listings and Leaves were kept.{"\n\n"}
          If you think this was a mistake, write to {SUPPORT_EMAIL} from the email on this account
          and a person will review it.
        </Text>
        <SecondaryButton
          label="Email support"
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => undefined)}
        />
      </Gutter>
    </ScrollView>
  );
}

/** A label over its value; the value wraps, because a reason is a sentence. */
function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ paddingHorizontal: offerSpace.screenX, paddingVertical: 12, gap: 3 }}>
      <Text style={[textStyle(offerType.helper), { color: offerColor.inkTertiary }]}>{label}</Text>
      <Text style={[textStyle(offerType.body), { color: offerColor.ink }]}>{value}</Text>
    </View>
  );
}
