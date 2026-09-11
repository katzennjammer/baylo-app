import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { ApiError } from "../src/api/client";
import { useHubs } from "../src/api/hubs";
import { useItem, useUpdateItem } from "../src/api/item";
import type { SafeZoneHub } from "../src/api/types";
import { Splash } from "../src/components/Splash";
import { Tappable } from "../src/components/Tappable";
import { CheckIcon } from "../src/components/icons";
import {
  Hairline,
  OfferScreenHost,
  PrimaryButton,
  SectionLabel,
} from "../src/components/offer/chrome";
import { CheckboxIcon } from "../src/components/post/post-icons";
import { Gutter, TradesBackTitle } from "../src/components/trades/chrome";
import { TradesErrorPanel, TradesSkeleton } from "../src/components/trades/states";
import { offerColor, offerSpace, offerType, textStyle } from "../src/theme/offer-tokens";
import { rules } from "../src/theme/post-tokens";

/**
 * The Safe-Zone hubs on a listing you already posted.
 *
 * ══ WHY THIS IS A SCREEN AND NOT A WIZARD STEP ══════════════════════════════
 *
 * Until this existed, nothing on the phone could change a posted listing's
 * hubs. `EditListingSheet` edits the three text fields on purpose (see its
 * header), and the post wizard has no edit mode — `?itemId=` was a header
 * label over an empty form whose only exit created a second listing. So the
 * meetup screen's "Add a hub to my listing" pointed at a promise nothing could
 * keep.
 *
 * The server side has always been fine: PATCH /api/items/[id] with `hubIds`
 * alone replaces the association set and touches nothing else — no
 * re-valuation, no photo-hash rewrite. This screen sends exactly that.
 *
 * ══ REACHED FROM TWO PLACES ═════════════════════════════════════════════════
 *
 *   /edit-hubs?itemId=…                 the listing menu, on your own card.
 *   /edit-hubs?itemId=…&suggest=a,b     the meetup screen, when your listing and
 *                                       the other one share no hub. `suggest` is
 *                                       what THEIR listing names; adding one of
 *                                       those is what makes a hub shared, and it
 *                                       is what earns the Safe-Zone reward — so
 *                                       those sort first, under their own label.
 *
 * ══ A HUB THAT CLOSED AFTER THE LISTING NAMED IT ════════════════════════════
 *
 * `useHubs()` is active hubs only. A listing can still name a hub that has since
 * closed — the association survives deactivation deliberately, so the listing
 * is not silently stripped of a meetup point. Those are drawn here too, from
 * the listing's own hubs, marked closed, so that the owner can see and uncheck
 * them. Leaving one checked is fine: the server keeps an inactive hub the
 * listing already had and only refuses a NEWLY chosen one.
 */
export default function EditHubsScreen() {
  const router = useRouter();
  const { itemId, suggest } = useLocalSearchParams<{ itemId?: string; suggest?: string }>();

  const item = useItem(itemId);
  const all = useHubs();
  const update = useUpdateItem(itemId ?? null);

  const [chosen, setChosen] = useState<string[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  // Seeded from the listing once, keyed on its id rather than the object — a
  // background refetch hands this a new object with identical contents, and
  // reseeding on that would drop whatever the owner had just ticked.
  const loadedId = item.data?.item.id ?? null;
  useEffect(() => {
    if (!loadedId) return;
    setChosen((item.data?.item.safeZones ?? []).map((h) => h.id));
  }, [loadedId]);

  const suggested = useMemo(
    () => new Set((suggest ?? "").split(",").filter((s) => s.length > 0)),
    [suggest],
  );

  /*
   * The rows: every active hub, plus any closed hub the listing already names.
   * Suggested ones first, then the rest alphabetical (the server's order),
   * closed ones last — a stable sort keeps each group's order.
   */
  const rows = useMemo(() => {
    const active = all.data?.hubs ?? [];
    const seen = new Set(active.map((h) => h.id));
    const closedButNamed = (item.data?.item.safeZones ?? []).filter((h) => !seen.has(h.id));
    const rank = (h: SafeZoneHub) => (!h.isActive ? 2 : suggested.has(h.id) ? 0 : 1);
    return [...active, ...closedButNamed].sort((a, b) => rank(a) - rank(b));
  }, [all.data, item.data, suggested]);

  const apiError = item.error instanceof ApiError ? item.error : null;
  if (apiError?.code === "UNAUTHENTICATED") return <Splash waitingOn="Signing you back in" />;

  const title = "Where you can meet";

  if (item.isPending || all.isPending || chosen === null) {
    return (
      <OfferScreenHost imeInset={0}>
        <TradesBackTitle title={title} onBack={() => router.back()} />
        {item.isError || all.isError ? (
          <TradesErrorPanel
            onRetry={() => {
              void item.refetch();
              void all.refetch();
            }}
          />
        ) : (
          <TradesSkeleton />
        )}
      </OfferScreenHost>
    );
  }

  // Not the owner's listing. The server would refuse the PATCH with a 403
  // anyway; saying so here rather than after five taps is the courtesy.
  if (!item.data?.viewer.isOwner) {
    return (
      <OfferScreenHost imeInset={0}>
        <TradesBackTitle title={title} onBack={() => router.back()} />
        <Gutter style={{ paddingTop: 18 }}>
          <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
            Only the listing's owner can change where it can be met.
          </Text>
        </Gutter>
      </OfferScreenHost>
    );
  }

  const original = (item.data.item.safeZones ?? []).map((h) => h.id);
  const dirty =
    chosen.length !== original.length || chosen.some((id) => !original.includes(id));
  const atLimit = chosen.length >= rules.maxHubs;
  const hasSuggested = rows.some((h) => suggested.has(h.id) && h.isActive);

  const toggle = (id: string) => {
    setFailure(null);
    setChosen((cur) => {
      const now = cur ?? [];
      if (now.includes(id)) return now.filter((h) => h !== id);
      // The cap is the server's (`resolveHubIds` refuses a sixth), expressed
      // before it bites: the row is disabled below, and this is the backstop.
      if (now.length >= rules.maxHubs) return now;
      return [...now, id];
    });
  };

  const save = () => {
    setFailure(null);
    update.mutate(
      { hubIds: chosen.slice(0, rules.maxHubs) },
      {
        onSuccess: () => router.back(),
        onError: (e) =>
          setFailure(e instanceof ApiError ? e.message : "We could not save that just now."),
      },
    );
  };

  return (
    <OfferScreenHost imeInset={0} dimmed={update.isPending}>
      <TradesBackTitle title={title} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        <Gutter style={{ paddingTop: 14, gap: 6 }}>
          <Text style={[textStyle(offerType.itemTitleRow), { color: offerColor.ink }]}>
            {item.data.item.title}
          </Text>
          <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
            Pick up to five public places. Traders will choose from these when they arrange to
            meet, and a meeting at a hub you both offer earns the Safe-Zone reward.
          </Text>
          {atLimit ? (
            <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}>
              That is five places. Uncheck one to add another.
            </Text>
          ) : null}
        </Gutter>

        {failure ? (
          <Gutter style={{ paddingTop: 12 }}>
            <Text style={[textStyle(offerType.body), { color: offerColor.warm }]}>{failure}</Text>
          </Gutter>
        ) : null}

        <View style={{ height: 14 }} />

        {rows.length === 0 ? (
          <Gutter>
            <Text style={[textStyle(offerType.body), { color: offerColor.inkSecondary }]}>
              No Safe-Zone hubs to choose from right now.
            </Text>
          </Gutter>
        ) : (
          <>
            {hasSuggested ? <SectionLabel>They already offer — adding one makes it shared</SectionLabel> : null}
            <Hairline />
            {rows.map((hub, i) => {
              const selected = chosen.includes(hub.id);
              // The one label change on the way down the list: the first row
              // that is not a suggestion, when suggestions came first.
              const firstOther =
                hasSuggested && i > 0 && !suggested.has(hub.id) && suggested.has(rows[i - 1]!.id);
              return (
                <View key={hub.id}>
                  {firstOther ? (
                    <>
                      <View style={{ height: 14 }} />
                      <SectionLabel>All hubs</SectionLabel>
                      <Hairline />
                    </>
                  ) : null}
                  <HubRow
                    hub={hub}
                    selected={selected}
                    disabled={atLimit && !selected}
                    onPress={() => toggle(hub.id)}
                  />
                  <Hairline />
                </View>
              );
            })}
          </>
        )}

        <Gutter style={{ paddingTop: 20 }}>
          <PrimaryButton
            label={update.isPending ? "Saving…" : "Save"}
            onPress={save}
            disabled={!dirty || update.isPending}
            disabledHint="Nothing has changed yet"
          />
        </Gutter>
      </ScrollView>
    </OfferScreenHost>
  );
}

/**
 * One hub, as a checkbox. The meetup screen's row is a radio; this is the
 * listing's own set and several can be on at once.
 */
function HubRow({
  hub,
  selected,
  disabled,
  onPress,
}: {
  hub: SafeZoneHub;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Tappable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={`${hub.name}, ${hub.city}${hub.isActive ? "" : ", closed"}`}
      style={{
        paddingHorizontal: offerSpace.screenX,
        paddingVertical: 12,
        backgroundColor: selected ? offerColor.tintGreen : undefined,
        opacity: disabled ? 0.5 : 1,
      }}
      pressedStyle={{ opacity: 0.85 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={[textStyle(offerType.body), { color: offerColor.ink }]} numberOfLines={1}>
            {hub.name}
          </Text>
          <Text
            style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}
            numberOfLines={1}
          >
            {hub.landmark}
          </Text>
          {!hub.isActive ? (
            <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.warm }]}>
              Closed — still on your listing until you uncheck it
            </Text>
          ) : null}
        </View>
        {selected ? (
          <CheckIcon size={18} stroke={2} color={offerColor.green} />
        ) : (
          <CheckboxIcon size={18} stroke={1.5} color={offerColor.hairline} />
        )}
      </View>
    </Tappable>
  );
}
