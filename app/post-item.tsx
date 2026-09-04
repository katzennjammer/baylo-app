import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Keyboard,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "../src/api/client";
import { createItem, type Category, type Condition } from "../src/api/post";
import { useKeyboardState } from "../src/components/auth-sheet";
import {
  PostFooter,
  PostHeader,
  PostScreenHost,
  useBoard,
} from "../src/components/post/chrome";
import { CameraSheet } from "../src/components/post/CameraSheet";
import { DraftSheet } from "../src/components/post/DraftSheet";
import { StepCondition } from "../src/components/post/StepCondition";
import { StepHubs } from "../src/components/post/StepHubs";
import { StepPhotos } from "../src/components/post/StepPhotos";
import { StepReturn } from "../src/components/post/StepReturn";
import { StepReview } from "../src/components/post/StepReview";
import { StepValue } from "../src/components/post/StepValue";
import { StepWhatIsIt } from "../src/components/post/StepWhatIsIt";
import { formatCountdown, PrimaryButton, useCountdown } from "../src/components/post/ui";
import { CloseIcon } from "../src/components/icons";
import { Tappable } from "../src/components/Tappable";
import { useDetection } from "../src/post/detection";
import { discardDraft, saveDraft, useAutosave, useStoredDraft } from "../src/post/draft";
import { PhotoPipelineProvider, usePhotos } from "../src/post/photos";
import { useValuation } from "../src/post/valuation";
import {
  canAdvance,
  effectiveValue,
  isPostable,
  LAST_STEP,
  PostStateProvider,
  usePost,
} from "../src/post/state";
import {
  chrome,
  keyboardRule,
  postColor,
  postRadius,
  postSize,
  postType,
  rules,
  textStyle,
} from "../src/theme/post-tokens";

/**
 * Post an item — the whole flow, on one route.
 *
 * ── WHY IT IS A STACK ROUTE AND NOT THE POST TAB ────────────────────────────
 *
 * The spec's chrome is a 44 header with a back chevron and a 90 footer with one
 * button, on all seven steps. A tab screen has neither: it has the app header
 * and, under it, the five-slot bar. Both would have to be hidden for the whole
 * flow, which is the same thing as not being a tab. So the Post tab's FAB
 * pushes this route over the tabs, the wizard owns the full screen, and closing
 * it returns to whichever tab the person was on — which is also the right
 * answer for "I opened Post by mistake".
 *
 * ── THE KEYBOARD ────────────────────────────────────────────────────────────
 *
 * `edgeToEdgeEnabled=true` makes `adjustResize` a no-op from API 35: the window
 * never shrinks and `KeyboardAvoidingView` computes an offset of zero. The
 * correction is a `marginBottom` equal to the IME's real overlap, applied by
 * `PostScreenHost`, and the measurement comes from `useKeyboardState()` in
 * `auth-sheet.tsx` — the same hook the auth screens use, because it is the same
 * piece of platform arithmetic and a second copy would be a second thing to get
 * wrong. The derivation is written out at length there.
 */

export default function PostItemRoute() {
  // `?itemId=` puts the flow in edit mode: the header says "Edit listing", step
  // 4's footer says "Save changes", and a valuation spends the listing's one
  // re-valuation rather than being free.
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const editingItemId = typeof itemId === "string" && itemId ? itemId : null;

  const { status, initial } = useStoredDraft(editingItemId);

  // Held on a blank canvas rather than painting step 1 and then replacing it
  // with a restored step 4. One frame of the wrong screen on every resume is
  // more noticeable than one frame of nothing.
  if (status === "reading") {
    return <View style={{ flex: 1, backgroundColor: postColor.surface }} />;
  }

  return (
    <PostStateProvider editingItemId={editingItemId} initial={initial}>
      {/* The pipeline is mounted HERE, above every step, so an upload survives
          the Next that the spec's own copy promises it will: "Baylo keeps
          trying quietly in the background while you carry on with the next
          steps." A pipeline owned by step 1 aborts on that press. */}
      <PhotoPipelineProvider>
        <Wizard />
      </PhotoPipelineProvider>
    </PostStateProvider>
  );
}

/* ────────────────────────────── the wizard ──────────────────────────── */

function Wizard() {
  const { state, dispatch } = usePost();
  const router = useRouter();
  const board = useBoard();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { keyboardUp, imeHeight, tallIme } = useKeyboardState();
  const { addFromCamera } = usePhotos();
  const saveNow = useAutosave(state);

  /**
   * BOTH AI EFFECTS LIVE HERE, NOT ON THE STEP THAT SHOWS THEIR RESULT.
   *
   * Detection: its cleanup marks the in-flight request settled. Mounted on
   * step 2, pressing Next mid-detection would settle it, strand the phase on
   * "detecting", and leave it unable to restart — the memo has already recorded
   * that this photo was asked about.
   *
   * Valuation: its "already asked" memo is a ref, so a remount clears it and
   * refetches. Free on a new listing; on an EDIT it spends the listing's one
   * and only re-valuation, again, for having gone back a step.
   *
   * Both are cheap here and both are billed or capped there.
   */
  const { retryDetection } = useDetection();
  useValuation();

  const scroller = useRef<ScrollView>(null);
  const titleRef = useRef<TextInput>(null);
  const areaRef = useRef<TextInput>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);

  const step = state.step;
  const busy = state.photos.some((p) => p.upload === "uploading");
  const detecting = state.detection.phase === "detecting";

  /**
   * The IME's overlap of the host, after any window resize.
   *
   * `useKeyboardState` reports the keyboard's GROSS height, which is correct for
   * the edge-to-edge case this app actually runs in: the window does not shrink
   * and the whole of that height has to be given back as margin.
   *
   * On a build where the window DOES resize, the layout has already returned
   * that space and adding the full height again would double it. Rather than
   * branching on a platform or an API level — either of which is a guess about
   * a device this has not run on — the shell subtracts what it actually got.
   * `restHeight` is the window's height with no keyboard up, so anything lost
   * since then is space the IME is no longer covering. Both arrangements land
   * on the same number without being told which they are; it is the same
   * reasoning `auth-sheet.tsx` applies to its own host.
   *
   * The 70 % cap is a guard, not geometry: a bad report from a third-party IME
   * must not be able to push the footer off the top of the screen.
   */
  const restHeight = useRef(height);
  if (!keyboardUp) restHeight.current = height;
  const shrunk = Math.max(0, restHeight.current - height);
  const imeInset = keyboardUp ? Math.max(0, Math.min(imeHeight - shrunk, height * 0.7)) : 0;

  /* ── leaving ── */

  const leave = useCallback(() => {
    // Nothing worth keeping and nothing to ask about.
    if (state.photos.length === 0 && !state.title.trim() && step === 0) {
      router.back();
      return;
    }
    setDraftOpen(true);
  }, [router, state.photos.length, state.title, step]);

  const back = useCallback(() => {
    if (step === 0) {
      leave();
      return;
    }
    Keyboard.dismiss();
    dispatch({ type: "back" });
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, [dispatch, leave, step]);

  const next = useCallback(() => {
    Keyboard.dismiss();
    dispatch({ type: "next" });
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, [dispatch]);

  // Android's hardware back is the same gesture as the header's chevron, so it
  // runs the same function — including the draft prompt on step 1.
  useAndroidBack(back);

  /* ── posting ── */

  const limit = state.rateLimit?.action === "post" ? state.rateLimit : null;
  const postCountdown = useCountdown(limit?.until ?? null, () =>
    dispatch({ type: "rate-limit/clear" }),
  );

  const post = useCallback(async () => {
    const photos = state.photos.filter(isPostable);
    const value = effectiveValue(state);
    if (!state.category || photos.length === 0 || value === null) return;

    dispatch({ type: "post/start" });
    try {
      const created = await createItem({
        title: state.title.trim(),
        // There is no description field in this flow. The server falls back to
        // the title when this is empty, and a listing whose description is its
        // own title reads better than one whose description is "null".
        description: state.title.trim(),
        category: state.category as Category,
        condition: state.condition as Condition,
        valueLeaves: value,
        images: photos.map((p) => p.url!).slice(0, rules.maxPhotos),
        wantedItems: state.wanted.trim() || null,
        // The FIRST postable photo's hash, which is the one the check ran
        // against and the one the next upload will be compared to.
        imageHash: photos[0]?.hash ?? null,
        hubIds: state.hubIds.slice(0, rules.maxHubs),
      });
      // The draft has become a listing. Deleting it here rather than on the way
      // out means a crash between posting and leaving cannot resurrect a draft
      // for an item that already exists.
      await discardDraft();
      dispatch({ type: "post/done", itemId: created.id });
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        dispatch({ type: "rate-limit", action: "post", seconds: e.retryAfter ?? 240 });
        return;
      }
      // The draft is deliberately re-saved on the failure path: the copy
      // promises "Your draft is safe", and that has to be true before the
      // sentence is shown.
      await saveDraft(state);
      dispatch({
        type: "post/fail",
        message:
          e instanceof ApiError && e.status === 0
            ? "No connection. We saved your draft — try again once you are back online."
            : "We could not post this just now. Your draft is safe. Try again in a moment.",
      });
    }
  }, [dispatch, state]);

  /* ── posted ── */

  const postedId = state.postedItemId;
  if (postedId) {
    return (
      <Posted
        itemId={postedId}
        onSeeInFeed={() => router.replace({ pathname: "/item", params: { id: postedId } })}
        onClose={() => router.back()}
      />
    );
  }

  /* ── the footer ── */

  const onTextStep = step === 1 || step === 4;
  const accessoryUp = keyboardUp && onTextStep;

  const footerLabel =
    step === LAST_STEP
      ? state.posting
        ? "Posting…"
        : "Post this item"
      : step === 3 && state.editingItemId
        ? "Save changes"
        : "Next";

  return (
    <PostScreenHost imeInset={imeInset}>
      <PostHeader
        title={state.editingItemId ? "Edit listing" : "Post an item"}
        leading={step === 0 ? "close" : "back"}
        onLeading={back}
        actionLabel="Save draft"
        actionDisabled={busy || detecting}
        onAction={() => {
          saveNow();
          setDraftOpen(true);
        }}
        railTrailing={
          step === 0 && state.photos.length > 0 ? (
            <Text style={[textStyle(postType.photoCounter), { color: postColor.inkMuted }]}>
              {`${state.photos.length} of ${rules.maxPhotos} photos`}
            </Text>
          ) : null
        }
        step={step}
        board={board}
      />

      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
        // Section 6's tall-IME fallback: past 380 the field block becomes the
        // scrolling region and the primary pins to the sheet's bottom. Nothing
        // shrinks — that is the spec's own instruction and it is what keeps the
        // 56 field and the 132 text area identical in every state.
        contentContainerStyle={tallIme ? { paddingBottom: keyboardRule.pinnedY } : undefined}
      >
        {step === 0 ? (
          <StepPhotos
            board={board}
            onOpenCamera={() => setCameraOpen(true)}
            onSeeListing={(id) => router.push({ pathname: "/item", params: { id } })}
          />
        ) : null}
        {step === 1 ? (
          <StepWhatIsIt
            board={board}
            keyboardUp={keyboardUp}
            titleRef={titleRef}
            onFieldBlur={saveNow}
            retryDetection={retryDetection}
          />
        ) : null}
        {step === 2 ? <StepCondition board={board} /> : null}
        {step === 3 ? <StepValue board={board} /> : null}
        {step === 4 ? (
          <StepReturn
            board={board}
            keyboardUp={keyboardUp}
            areaRef={areaRef}
            onFieldBlur={saveNow}
          />
        ) : null}
        {step === 5 ? <StepHubs board={board} /> : null}
        {step === 6 ? <StepReview board={board} /> : null}
      </ScrollView>

      {accessoryUp ? (
        <ImeAccessory
          label={step === 1 ? "Next" : "Done"}
          disabled={step === 1 && !canAdvance(state)}
          onPress={() => {
            // Step 5's button DISMISSES rather than advances. The chips below
            // the fold are optional and reachable only once the keyboard is
            // gone, and an accessory that skipped past them would make the
            // group unreachable for anyone who started typing.
            if (step === 4) Keyboard.dismiss();
            else next();
          }}
        />
      ) : (
        <PostFooter board={board} safeBottom={insets.bottom}>
          {step === 5 ? (
            <View
              style={{
                height: chrome.hubFooterCounterRow,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={[textStyle(postType.hubCounter), { color: postColor.inkMuted }]}>
                {`${state.hubIds.length} of ${rules.maxHubs} chosen`}
              </Text>
              <Tappable
                onPress={() => dispatch({ type: "hub/skip" })}
                accessibilityRole="button"
                style={{ minHeight: 44, justifyContent: "center", paddingLeft: 12 }}
              >
                <Text
                  style={[textStyle(postType.smallTextLabel), { color: postColor.forest }]}
                >
                  Skip for now
                </Text>
              </Tappable>
            </View>
          ) : null}

          {state.postError ? (
            <Text
              style={[
                textStyle(postType.fieldError),
                { color: postColor.warmInk, marginBottom: 10 },
              ]}
            >
              {state.postError}
            </Text>
          ) : null}

          {limit ? (
            <Text
              style={[
                textStyle(postType.helper),
                { color: postColor.inkSecondary, marginBottom: 10 },
              ]}
            >
              {`You have posted several items quickly. You can post again in ${formatCountdown(
                postCountdown,
              )}.`}
            </Text>
          ) : null}

          <View style={{ marginTop: step === 5 ? chrome.hubFooterGap : 0 }}>
            <PrimaryButton
              label={footerLabel}
              loading={state.posting}
              disabled={!canAdvance(state) || (limit !== null && postCountdown > 0)}
              onPress={step === LAST_STEP ? () => void post() : next}
            />
          </View>
        </PostFooter>
      )}

      <CameraSheet
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCaptured={addFromCamera}
      />

      <DraftSheet
        open={draftOpen}
        state={state}
        onKeepAndLeave={() => {
          void saveDraft(state);
          setDraftOpen(false);
          router.back();
        }}
        onCarryOn={() => setDraftOpen(false)}
        onDiscard={() => {
          void discardDraft();
          setDraftOpen(false);
          router.back();
        }}
        onClose={() => setDraftOpen(false)}
      />
    </PostScreenHost>
  );
}

/* ─────────────────────── the IME accessory bar ──────────────────────── */

/**
 * The 56 bar that replaces the 90 footer when the keyboard is up.
 *
 * ── THE SUGGESTION WORDS ARE NOT DRAWN ──────────────────────────────────────
 *
 * Section 6 shows two suggestion words at 13 to the left of the button. Those
 * belong to the KEYBOARD, not to us: the strip is drawn by the IME above its
 * own keys, and there is no API that hands an app the candidate list to
 * re-render. Fabricating two plausible words would be an autocomplete that does
 * not complete anything. The bar is therefore the rule, the fill and the
 * button, and the system's own strip sits above it where it always did.
 */
function ImeAccessory({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <View
      style={{
        height: postSize.button.imeBar,
        backgroundColor: postColor.imeBar,
        borderBottomWidth: 1,
        borderBottomColor: postColor.imeLine,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        paddingHorizontal: 12,
      }}
    >
      <Tappable
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        style={{
          height: postSize.button.ime,
          paddingHorizontal: postSize.button.imeX,
          borderRadius: postRadius.confirmButton,
          backgroundColor: disabled ? postColor.disabledFill : postColor.green,
          alignItems: "center",
          justifyContent: "center",
        }}
        pressedStyle={disabled ? undefined : { backgroundColor: postColor.primaryPressed }}
      >
        <Text
          style={[
            textStyle(postType.imeLabel),
            { color: disabled ? postColor.inkDisabled : postColor.onGreen },
          ]}
        >
          {label}
        </Text>
      </Tappable>
    </View>
  );
}

/* ──────────────────────────── after posting ─────────────────────────── */

/**
 * After the listing is up.
 *
 * The spec gives this screen two strings and no more: `Your listing is up.` and
 * `See it in the feed` as a TEXT button. It is deliberately not a celebration —
 * the item is posted, the work is over, and a full-width primary here would be
 * a fourth call to action after a seven-step form.
 *
 * The close cross is the only thing added, because without it "See it in the
 * feed" is the sole exit and somebody who does not want to look at their own
 * listing has nowhere to go. It is the same 44 target and the same glyph as the
 * wizard's own header, so it does not read as a new control.
 */
function Posted({
  itemId,
  onSeeInFeed,
  onClose,
}: {
  itemId: string;
  onSeeInFeed: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: postColor.surface,
        paddingTop: Math.max(insets.top, chrome.statusBar),
      }}
    >
      <View
        style={{
          height: chrome.headerRow,
          justifyContent: "center",
          paddingHorizontal: chrome.headerX,
        }}
      >
        <Tappable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{
            width: chrome.headerRow,
            height: chrome.headerRow,
            alignItems: "center",
            justifyContent: "center",
            marginLeft: -chrome.headerX + 4,
          }}
        >
          <CloseIcon size={22} stroke={1.9} color={postColor.ink} />
        </Tappable>
      </View>

      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
        }}
      >
        <Text
          style={[
            textStyle(postType.stepHeading),
            { color: postColor.ink, textAlign: "center" },
          ]}
        >
          Your listing is up.
        </Text>
        <Tappable
          onPress={onSeeInFeed}
          accessibilityRole="button"
          accessibilityLabel={`See listing ${itemId} in the feed`}
          style={{
            height: postSize.button.text,
            justifyContent: "center",
            marginTop: 10,
          }}
        >
          <Text style={[textStyle(postType.textLabel), { color: postColor.forest }]}>
            See it in the feed
          </Text>
        </Tappable>
      </View>
    </View>
  );
}

/* ──────────────────────── Android hardware back ─────────────────────── */

/**
 * The hardware back button runs the SAME handler as the header chevron.
 *
 * Without this it pops the route directly and the draft prompt never appears —
 * which on Android is how most people leave a screen, so the one prompt that
 * protects the work would be the one nobody ever sees.
 */
function useAndroidBack(handler: () => void) {
  // The handler is held in a ref rather than being a dependency, so the native
  // listener is registered exactly once. Re-registering it on every render —
  // which is what a `[handler]` dependency would do, since the callback closes
  // over `state` — races the native listener list and, on Android, sometimes
  // leaves two live subscriptions that both pop the route.
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      ref.current();
      return true; // Handled. Do not also pop the route.
    });
    return () => subscription.remove();
  }, []);
}
