import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { ApiError } from "../src/api/client";
import {
  currentConsent,
  termsFor,
  useOfferContext,
  useSendOffer,
  useWithdrawOffer,
  MAX_OFFER_MESSAGE,
  type OfferDraft,
  type OfferableItem,
} from "../src/api/offer";
import { useKeyboardState } from "../src/components/auth-sheet";
import { Splash } from "../src/components/Splash";
import { BridgeConsentSheet } from "../src/components/offer/BridgeConsentSheet";
import {
  Hairline,
  NavDone,
  OfferBottomBar,
  OfferNav,
  OfferScreenHost,
  PrimaryButton,
  Section,
  SectionLabel,
  SendingButton,
  useOfferBoard,
} from "../src/components/offer/chrome";
import * as copy from "../src/components/offer/copy";
import { OfferSheet, PickerBody } from "../src/components/offer/OfferSheet";
import { PickerRow } from "../src/components/offer/PickerRow";
import { ChangeLink, HubRow, ItemRow } from "../src/components/offer/rows";
import {
  LoadFailedPanel,
  NoItemsState,
  PendingOfferState,
  PremiumLockedPanel,
  SendFailedPanel,
  SettlementSkeleton,
} from "../src/components/offer/states";
import { bracketLabel } from "../src/lib/brackets";
import { grouped, shelfMisses } from "../src/lib/gap";
import { offerAllowed, type OfferTerms } from "../src/lib/trade-rules";
import {
  offerColor,
  offerKeyboard,
  offerSpace,
  offerType,
  textStyle,
} from "../src/theme/offer-tokens";

/**
 * The offer flow, bracket-based. One scrolling screen.
 *
 * ══ WHAT AN OFFER IS ════════════════════════════════════════════════════════
 *
 * One item for one item. The two items' brackets decide everything the screen
 * has to say: the same bracket is a straight swap; one below means this
 * proposer pays a bridging fee on send; one above means the RECEIVER pays one
 * on accept; two or more apart cannot be sent. `termsFor()` answers all of
 * that in one call and every section below reads its answer — there is no
 * gap to classify, no shortfall to settle, no promise to set up.
 *
 * ══ WHAT THIS SCREEN IS RESPONSIBLE FOR ══════════════════════════════════════
 *
 * Choosing which item is offered, holding the draft, and putting the consent
 * sheet between a paying proposer and their tap. Every piece of geometry,
 * every string and all the arithmetic live elsewhere — `offer-tokens.ts`,
 * `copy.ts`, `lib/trade-rules.ts` — so this file reads as a state machine
 * rather than as a layout.
 *
 * ══ NO EXACT VALUE FOR EITHER ITEM ═════════════════════════════════════════
 *
 * The listing header, the offering row, the picker, the bracket section and
 * the pinned line all name both items by BRACKET. Exact values live on the
 * owner's own listing page and in the post wizard, and nowhere in this flow.
 *
 * ══ A ROOT ROUTE, NOT A TAB SCREEN ═══════════════════════════════════════════
 *
 * Pushed over the tabs, so the bottom bar IS the bottom of the screen and
 * closing it returns to whichever tab was underneath.
 */
export default function OfferScreen() {
  const router = useRouter();
  const { itemId } = useLocalSearchParams<{ itemId?: string; title?: string }>();

  const { context, isPending, isError, error, refetch } = useOfferContext(itemId);
  const send = useSendOffer();
  const withdraw = useWithdrawOffer();

  /* ── the IME. See the note on `OfferScreenHost`. ────────────────────── */
  const { keyboardUp, imeHeight } = useKeyboardState();
  const [messageFocused, setMessageFocused] = useState(false);

  const board = useOfferBoard();

  /* ── the draft ──────────────────────────────────────────────────────── */
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [hubId, setHubId] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const owner = context ? copy.firstName(context.item.owner.name) : "";

  /* ── which item is being offered ────────────────────────────────────── */
  const chosen: OfferableItem | null = useMemo(() => {
    if (!context) return null;
    if (chosenId) {
      const selected = context.myItems.find((i) => i.id === chosenId) ?? null;
      return selected && !context.pendingOfferedItemIds.has(selected.id) ? selected : null;
    }
    // Default: the closest LEGAL item — same bracket first, then one apart.
    // A person is overwhelmingly likely to make that choice, and it saves a
    // sheet on the way in. If nothing on the shelf is legal, nothing is
    // preselected and the screen says so instead of composing a refusal.
    const legal = context.myItems.filter((i) => {
      if (context.pendingOfferedItemIds.has(i.id)) return false;
      const t = termsFor(context, i);
      return t !== null && t.allowed;
    });
    if (legal.length === 0) return null;
    const target = context.targetBracket ?? 0;
    return legal.reduce((a, b) =>
      Math.abs((a.bracket ?? 0) - target) <= Math.abs((b.bracket ?? 0) - target) ? a : b,
    );
  }, [context, chosenId]);

  const terms: OfferTerms | null = context && chosen ? termsFor(context, chosen) : null;
  const proposerFee = terms?.payer === "proposer" ? terms.fee : 0;
  const receiverFee = terms?.payer === "receiver" ? terms.fee : 0;

  const hub = context?.hubs.find((h) => h.id === hubId) ?? null;

  /* ── sending ────────────────────────────────────────────────────────── */
  const draft: OfferDraft | null =
    context && chosen && terms?.allowed
      ? {
          postId: context.item.id,
          offeredItem: chosen,
          // Consent rides only on a proposer-pays bridge, and only after the
          // sheet has been through. `onSend` is reached from the sheet's
          // Propose in that case and from the bottom bar otherwise.
          consent: proposerFee > 0 ? currentConsent() : null,
          hubName: hub?.name ?? null,
          message,
        }
      : null;

  const onSend = useCallback(() => {
    if (!draft) return;
    setFailed(null);
    send.mutate(draft, {
      onSuccess: () => {
        setConsentOpen(false);
        router.back();
      },
      onError: (e) => {
        setConsentOpen(false);
        // The server's own sentence when it refused, because it carries the
        // numbers this client cannot predict — see `SendFailedPanel`.
        if (e instanceof ApiError) {
          setFailed(e.status >= 400 && e.status < 500 ? e.message : null);
          return;
        }
        setFailed(e instanceof Error && e.message ? e.message : null);
      },
    });
  }, [draft, send, router]);

  /** The bottom-bar press. A paying proposer goes through the sheet first. */
  const onPrimary = useCallback(() => {
    if (proposerFee > 0) {
      setConsentOpen(true);
      return;
    }
    onSend();
  }, [proposerFee, onSend]);

  /* ── 401 → the session guard is about to take over ──────────────────── */
  const apiError = error instanceof ApiError ? error : null;
  if (isError && apiError?.code === "UNAUTHENTICATED") {
    return <Splash waitingOn="Signing you back in" />;
  }

  /* ── loading ────────────────────────────────────────────────────────── */
  if (isPending || !context) {
    return (
      <OfferScreenHost imeInset={0}>
        <OfferNav title={copy.chrome.navTitle} onBack={() => router.back()} />
        {isError ? (
          <LoadFailedPanel
            heading="Can't open this offer"
            body={
              apiError?.message ??
              "The connection dropped. Nothing has changed on your side — the listing is still there."
            }
            onRetry={refetch}
          />
        ) : (
          <View>
            <Hairline />
            <Section pad={offerSpace.section.gap}>
              <SectionLabel>{copy.label.brackets}</SectionLabel>
              <View style={{ marginTop: offerSpace.gapBlock.labelToFigure }}>
                <SettlementSkeleton rows={2} />
              </View>
            </Section>
          </View>
        )}
      </OfferScreenHost>
    );
  }

  /* ═══ the blocking states, in the order they take precedence ══════════ */

  /**
   * A PENDING offer already stands. "Status, not error." First, because
   * everything below it would be composing a second offer on the same
   * listing, which the server refuses with OFFER_ALREADY_PENDING.
   */
  const pendingId = context.existingOffer?.id ?? context.viewer.existingOfferId;
  if (pendingId) {
    const existing = context.existingOffer;
    const existingTerms =
      existing && existing.bridgeFeeLeaves && existing.bridgeFeePayer
        ? existing.bridgeFeePayer === "proposer"
          ? copy.pending.termsHeld(existing.bridgeFeeLeaves)
          : copy.pending.termsTheyPay(owner, existing.bridgeFeeLeaves)
        : copy.pending.termsFree;
    return (
      <OfferScreenHost imeInset={0}>
        <OfferNav title={copy.chrome.navTitle} onBack={() => router.back()} />
        <ScrollView>
          <ListingHeader context={context} />
          <Hairline />
          {failed ? (
            <Section pad={offerSpace.section.offering}>
              <Text style={[textStyle(offerType.errorText), { color: offerColor.warm }]}>
                {failed}
              </Text>
            </Section>
          ) : null}

          {existing ? (
            <PendingOfferState
              owner={owner}
              sentIso={existing.createdAt}
              offeredItems={existing.offeredItems}
              termsLine={
                existing.offeredBracket !== null && existing.targetBracket !== null
                  ? `${copy.bracket.suffix(existing.offeredBracket, existing.targetBracket)} · ${existingTerms}`
                  : existingTerms
              }
              message={existing.message}
              hubName={context.hubs[0]?.name ?? null}
              withdrawLabel={board.withdraw}
              withdrawing={withdraw.isPending}
              onWithdraw={() =>
                withdraw.mutate(
                  { offerId: pendingId, postId: context.item.id },
                  { onError: (e) => setFailed(e instanceof ApiError ? e.message : null) },
                )
              }
              onLeaveIt={() => router.back()}
            />
          ) : (
            <Section pad={offerSpace.section.gap}>
              <Text style={[textStyle(offerType.screenHeading), { color: offerColor.ink }]}>
                {copy.pending.heading}
              </Text>
            </Section>
          )}
        </ScrollView>
      </OfferScreenHost>
    );
  }

  /** No items to offer. Keyed on the SHELF, not on `chosen`. */
  if (context.myItems.length === 0) {
    return (
      <OfferScreenHost imeInset={0}>
        <OfferNav title={copy.chrome.navTitle} onBack={() => router.back()} />
        <ScrollView>
          <ListingHeader context={context} />
          <Hairline />
          <NoItemsState
            owner={owner}
            theirItem={context.item.title}
            onPost={() => router.push("/post-item")}
          />
        </ScrollView>
      </OfferScreenHost>
    );
  }

  /**
   * The premium lock: bracket 7 and above, no live subscription. ABOVE the
   * tier cap, matching `enforceInitiateTrade()`'s order on the server.
   */
  if (context.premiumLocked && context.targetBracket !== null) {
    return (
      <OfferScreenHost imeInset={0}>
        <OfferNav title={copy.chrome.navTitle} onBack={() => router.back()} />
        <ScrollView>
          <ListingHeader context={context} />
          <Hairline />
          <PremiumLockedPanel
            bracket={context.targetBracket}
            owner={owner}
            onBack={() => router.back()}
          />
        </ScrollView>
      </OfferScreenHost>
    );
  }

  /** The tier's item cap, in brackets. `enforceItemValueCeiling()` on the server. */
  if (context.tierItemCapExceeded && context.maxItemBracket !== null && context.targetBracket !== null) {
    return (
      <OfferScreenHost imeInset={0}>
        <OfferNav title={copy.chrome.navTitle} onBack={() => router.back()} />
        <ScrollView>
          <ListingHeader context={context} />
          <Hairline />
          <LoadFailedPanel
            heading={copy.tierCap.heading(context.reputation.tier, context.maxItemBracket)}
            body={copy.tierCap.body(context.targetBracket)}
            onRetry={() => router.back()}
          />
        </ScrollView>
      </OfferScreenHost>
    );
  }

  /**
   * A shelf with items, none of them within a bracket of this listing. The
   * picker would open with every row greyed; this says why first, and the
   * picker stays reachable so the person can see their shelf against it.
   */
  if (!chosen || !terms || !terms.allowed) {
    const miss = context.targetBracket === null ? null : shelfMisses(context.myItems.map((i) => i.valueLeaves), context.targetBracket);
    return (
      <OfferScreenHost imeInset={0}>
        <OfferNav title={copy.chrome.navTitle} onBack={() => router.back()} />
        <ScrollView>
          <ListingHeader context={context} />
          <Hairline />
          <LoadFailedPanel
            heading={
              context.targetBracket === null
                ? "This listing has no value yet"
                : copy.noneInRange.heading(context.targetBracket)
            }
            body={
              context.targetBracket === null
                ? "An offer is judged on brackets, and a listing with no value has none. Ask the owner to set one."
                : `${copy.noneInRange.body} ${miss === "above" ? copy.noneInRange.above : miss === "below" ? copy.noneInRange.below : ""}`.trim()
            }
            onRetry={() => router.back()}
          />
          {context.targetBracket !== null ? (
            <Section pad={offerSpace.section.offering}>
              <ChangeLink onPress={() => setPicker(true)} />
            </Section>
          ) : null}
        </ScrollView>
        {picker ? <Picker context={context} chosen={chosen} owner={owner} onPick={(id) => { setChosenId(id); }} onClose={() => setPicker(false)} /> : null}
      </OfferScreenHost>
    );
  }

  const yourBracket = chosen.bracket as number;
  const theirBracket = context.targetBracket as number;

  /* ═══ the message field, keyboard up ═════════════════════════════════ */

  if (keyboardUp && messageFocused) {
    return (
      <OfferScreenHost imeInset={imeHeight}>
        <OfferNav
          title={copy.chrome.navTitle}
          onBack={null}
          trailing={<NavDone onPress={() => setMessageFocused(false)} />}
        />

        {/* The pinned mono line holds the offer's terms while everything else
            is off screen: `Vans · Bracket 2 → Air Max · Bracket 3 · 20-Leaf fee`. */}
        <View
          style={{
            minHeight: offerKeyboard.pinnedLine.height,
            paddingTop: offerKeyboard.pinnedLine.top,
            paddingBottom: offerKeyboard.pinnedLine.bottom,
            paddingHorizontal: offerKeyboard.pinnedLine.x,
            justifyContent: "center",
          }}
        >
          <Text
            style={[textStyle(offerType.leavesRow), { color: offerColor.inkSecondary }]}
            numberOfLines={1}
          >
            {`${chosen.title} · ${bracketLabel(yourBracket)} → ${context.item.title} · ${bracketLabel(theirBracket)}` +
              (proposerFee > 0 ? ` · ${grouped(proposerFee)}-Leaf fee` : "") +
              (receiverFee > 0 ? ` · ${owner} pays ${grouped(receiverFee)}` : "")}
          </Text>
        </View>
        <Hairline />

        <MessageField
          value={message}
          onChange={setMessage}
          autoFocus
          onFocus={() => setMessageFocused(true)}
          onBlur={() => setMessageFocused(false)}
          expand
        />
      </OfferScreenHost>
    );
  }

  /* ═══ the offer screen at rest ═══════════════════════════════════════ */

  const sending = send.isPending;

  return (
    <OfferScreenHost imeInset={0} dimmed={sending}>
      <OfferNav
        title={copy.chrome.navTitle}
        // "Sending": the back control is REMOVED, not disabled.
        onBack={sending ? null : () => router.back()}
      />

      <ScrollView scrollEnabled={!sending} keyboardShouldPersistTaps="handled">
        <ListingHeader context={context} />
        <Hairline />

        {/* `You're offering` — the viewer's own item, value and bracket both. */}
        <Section pad={offerSpace.section.offering}>
          <SectionLabel>{copy.label.offering}</SectionLabel>
          <View style={{ marginTop: offerSpace.labelToContent }}>
            <ItemRow
              image={chosen.image}
              title={chosen.title}
              meta={copy.picker.rowMeta(yourBracket)}
              trailing={sending ? undefined : <ChangeLink onPress={() => setPicker(true)} />}
            />
          </View>
        </Section>
        <Hairline />

        {/* `The brackets` — the relationship, and what it costs whom. */}
        <Section pad={offerSpace.section.gap}>
          <SectionLabel>{copy.label.brackets}</SectionLabel>

          <View style={{ marginTop: offerSpace.gapBlock.labelToFigure }}>
            <Text style={[textStyle(offerType.gapWord), { color: terms.fee > 0 ? offerColor.deep : offerColor.ink }]}>
              {copy.bracket.figure(terms.legality)}
            </Text>
            <Text
              style={[
                textStyle(offerType.leavesRow),
                { color: offerColor.inkSecondary, marginTop: 6 },
              ]}
            >
              {copy.bracket.suffix(yourBracket, theirBracket)}
            </Text>
          </View>

          <Text
            style={[
              textStyle(offerType.body),
              { color: offerColor.inkSecondary, marginTop: offerSpace.gapBlock.legendToCopy },
            ]}
          >
            {terms.legality === "same"
              ? copy.bracket.same(owner)
              : terms.legality === "bridgeUp"
                ? context.balance >= proposerFee
                  ? copy.bracket.bridgeUp(proposerFee, context.balance, owner)
                  : copy.bracket.short(proposerFee, context.balance)
                : copy.bracket.bridgeDown(receiverFee, owner)}
          </Text>
        </Section>

        {/* The meet-up section. Always drawn when the listing names a hub. */}
        {context.hubs.length > 0 ? (
          <>
            <Hairline />
            <Section pad={offerSpace.section.settle}>
              <SectionLabel>{copy.label.meet}</SectionLabel>
              <View style={{ marginTop: offerSpace.labelToContent, gap: offerSpace.rowGap }}>
                {context.hubs.map((h) => (
                  <HubRow
                    key={h.id}
                    name={h.name}
                    active={h.isActive}
                    selected={hubId === h.id}
                    onPress={() => setHubId(hubId === h.id ? null : h.id)}
                  />
                ))}
              </View>
            </Section>
          </>
        ) : null}

        <Hairline />

        <Section pad={offerSpace.section.settle}>
          <SectionLabel>{copy.label.message}</SectionLabel>
          <MessageField
            value={message}
            onChange={setMessage}
            onFocus={() => setMessageFocused(true)}
            onBlur={() => setMessageFocused(false)}
          />
        </Section>
      </ScrollView>

      <OfferBottomBar
        above={
          failed !== null || send.isError ? (
            <SendFailedPanel
              owner={owner}
              heldLeaves={proposerFee}
              serverMessage={failed}
              onRetry={onPrimary}
              onKeep={() => {
                setFailed(null);
                send.reset();
              }}
            />
          ) : undefined
        }
        footnote={
          sending
            ? copy.sending.footnote(proposerFee)
            : proposerFee > 0
              ? context.balance >= proposerFee
                ? copy.footnote.heldFrom(proposerFee, context.balance, owner)
                : copy.consent.shortBody(proposerFee, context.balance)
              : receiverFee > 0
                ? copy.footnote.theyPay(owner, receiverFee)
                : copy.footnote.threeDays(owner)
        }
      >
        {sending ? (
          <SendingButton label={copy.sending.label} />
        ) : (
          <PrimaryButton
            label={proposerFee > 0 ? copy.button.sendWithFee(proposerFee) : copy.button.send}
            onPress={onPrimary}
          />
        )}
      </OfferBottomBar>

      {picker ? (
        <Picker
          context={context}
          chosen={chosen}
          owner={owner}
          onPick={(id) => setChosenId(id)}
          onClose={() => setPicker(false)}
        />
      ) : null}

      {consentOpen ? (
        <BridgeConsentSheet
          side="send"
          otherName={owner}
          yourBracket={yourBracket}
          theirBracket={theirBracket}
          fee={proposerFee}
          balance={context.balance}
          busy={sending}
          onConfirm={onSend}
          onDismiss={() => setConsentOpen(false)}
        />
      ) : null}
    </OfferScreenHost>
  );
}

/* ───────────────────────────── the picker ───────────────────────────── */

/**
 * The `Change item` sheet. Every AVAILABLE item on the shelf, in order; the
 * ones within a bracket of the listing are selectable, the rest are greyed
 * with the reason. See `PickerRow`.
 */
function Picker({
  context,
  chosen,
  owner,
  onPick,
  onClose,
}: {
  context: NonNullable<ReturnType<typeof useOfferContext>["context"]>;
  chosen: OfferableItem | null;
  owner: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const target = context.targetBracket as number;
  return (
    <OfferSheet dismissible onDismiss={onClose}>
      <PickerBody
        heading={copy.chrome.sheetHeading}
        subtitle={copy.sheetSubtitle(owner, context.item.title, target)}
        footnote={copy.chrome.sheetFootnote}
        buttonLabel={copy.chrome.sheetButton}
        canUse={chosen !== null}
        onUse={onClose}
      >
        {context.myItems.filter((item) => !context.pendingOfferedItemIds.has(item.id)).map((item) => {
          const t = termsFor(context, item);
          const reason =
            item.bracket === null || item.valueLeaves === null
              ? copy.picker.unvalued
              : t === null
                ? copy.picker.unvalued
                : !offerAllowed(t.legality)
                  ? t.legality === "tooLow"
                    ? copy.picker.tooLow
                    : copy.picker.tooHigh
                  : null;
          return (
            <PickerRow
              key={item.id}
              title={item.title}
              image={item.image}
              meta={item.bracket !== null ? copy.picker.rowMeta(item.bracket) : ""}
              reason={reason}
              selected={chosen?.id === item.id}
              onPress={() => onPick(item.id)}
            />
          );
        })}
      </PickerBody>
    </OfferSheet>
  );
}

/* ─────────────────────── the listing header ─────────────────────────── */

/**
 * A 56px photo with a title and a mono line, then a hairline. The listing is
 * named by BRACKET: `Bracket 3 · Marco`.
 */
function ListingHeader({
  context,
}: {
  context: NonNullable<ReturnType<typeof useOfferContext>["context"]>;
}) {
  const { item } = context;
  return (
    <Section pad={offerSpace.section.listingHeader}>
      <ItemRow
        image={item.images[0] ?? null}
        title={item.title}
        meta={
          context.targetBracket !== null
            ? `${bracketLabel(context.targetBracket)} · ${copy.firstName(item.owner.name)}`
            : `${copy.firstName(item.owner.name)}`
        }
      />
    </Section>
  );
}

/* ────────────────────── §10.1's message field ───────────────────────── */

/**
 * `Add a message (optional)` with §10.1's counter row.
 *
 * The keyboard-up version is the same component with `expand`, which lets the
 * text area fill the free space and pins the counter to the bottom of it.
 */
function MessageField({
  value,
  onChange,
  autoFocus = false,
  onFocus,
  onBlur,
  expand = false,
}: {
  value: string;
  onChange: (s: string) => void;
  autoFocus?: boolean;
  onFocus: () => void;
  onBlur: () => void;
  expand?: boolean;
}) {
  return (
    <View
      style={
        expand
          ? { flex: 1, paddingHorizontal: offerSpace.screenX, paddingTop: offerSpace.section.settle.top }
          : { marginTop: offerSpace.labelToContent }
      }
    >
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        autoFocus={autoFocus}
        multiline
        // The server's own MAX_MESSAGE, so the composer stops rather than being
        // refused. Mirrored in `src/api/offer.ts`.
        maxLength={MAX_OFFER_MESSAGE}
        placeholder={copy.chrome.messagePlaceholder}
        placeholderTextColor={offerColor.inkTertiary}
        textAlignVertical="top"
        style={[
          textStyle(offerType.body),
          {
            color: offerColor.ink,
            ...(expand ? { flex: 1 } : { minHeight: 72 }),
            padding: 0,
          },
        ]}
        cursorColor={offerColor.green}
        selectionColor={offerColor.green}
        accessibilityLabel={copy.label.message}
      />

      <View
        style={{
          marginTop: offerSpace.labelToContent,
          paddingBottom: expand ? offerSpace.section.settle.bottom : 0,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}>
          {copy.chrome.messageOptional}
        </Text>
        <Text style={[textStyle(offerType.footnoteMono), { color: offerColor.inkTertiary }]}>
          {copy.messageCounter(value.length, MAX_OFFER_MESSAGE)}
        </Text>
      </View>
    </View>
  );
}
