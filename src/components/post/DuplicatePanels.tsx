import { Image } from "expo-image";
import { Text, View } from "react-native";

import type { MatchedListing } from "../../api/post";
import { PHASH_APPEAL_SUPPORTED } from "../../api/post";
import {
  postBorder,
  postColor,
  postIcon,
  postLines,
  postRadius,
  postSize,
  postSpace,
  postType,
  textStyle,
} from "../../theme/post-tokens";
import { RefreshIcon, SearchIcon } from "../icons";
import {
  Divider,
  NoticePanel,
  OutlineButton,
  PrimaryButton,
  ProgressBar,
  SectionLabel,
  TextButton,
  WarmNotice,
} from "./ui";
import { AlertCircleIcon, RelistIcon } from "./post-icons";

/**
 * The four outcomes of /api/ai/phash, drawn.
 *
 * ── THE CHECK FAILS CLOSED, AND THE COPY IS WHAT PAYS FOR THAT ──────────────
 *
 * Any error, timeout or non-response resolves to `failed`. That is the right
 * default — a duplicate-photo check that opens on failure protects nothing —
 * but it means a real share of blocks land on honest photos. The spec's `failed`
 * copy is built for that case and does four things on purpose:
 *
 *   1. It describes what the CHECK did, not what the user did. "Our check
 *      matched it to a photo already on Baylo" is a statement about our system.
 *   2. It names the innocent and the guilty explanation in the same breath —
 *      saved from the internet, taken from another listing, or our check being
 *      wrong — so the honest user is not the one who has to raise the third.
 *   3. It admits the check can be wrong BEFORE the user has to argue.
 *   4. The reference code lets support find the decision without the user
 *      having to describe it.
 *
 * Change any of those and the fail-closed default starts costing users instead
 * of costing us.
 *
 * ── WARNING VERSUS BLOCK IS CARRIED BY THE CONTAINER ────────────────────────
 *
 * `warned` gets a 2 px rule, a warm heading and NO box. `failed` gets a 3 px
 * rule and a warm box. `self` gets a grey box and no warm anything, because
 * re-posting your own item is a normal thing to do. `passed` shows nothing, at
 * any point, ever — a check that announces its successes teaches people that
 * their photos are under suspicion.
 */

/* ─────────────────────────── running ────────────────────────────────── */

/**
 * The check in flight: a 2 px determinate bar and one mono line.
 *
 * NEVER A MODAL, and more photos can be added while it runs. It is a background
 * check on one photo, not a gate on the step.
 *
 * The bar is determinate at a FIXED fraction because the endpoint reports no
 * progress — it is one request whose duration is a full-catalogue scan plus up
 * to two vision calls. A quarter-filled bar that does not move is honest about
 * that ("something is happening, we cannot tell you how far"); an animated one
 * would be inventing a rate.
 */
export function DuplicateRunning() {
  return (
    <View>
      <ProgressBar
        fraction={0.25}
        height={postSize.photo.dupBar}
        track={postColor.line}
        fill={postColor.forest}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10 }}>
        <SearchIcon
          size={postIcon.magnifier.size}
          stroke={postIcon.magnifier.stroke}
          color={postColor.inkMuted}
        />
        <Text style={[textStyle(postType.checkLine), { color: postColor.inkMuted }]}>
          Checking this photo against existing listings
        </Text>
      </View>
    </View>
  );
}

/* ──────────────────── the matched listing's card ────────────────────── */

/**
 * "Traded · 12 July 2026", "Still posted", "Taken down · 3 August 2026".
 *
 * The three the spec names, from the two fields the API actually returns —
 * `status` and `updatedAt`. There is no separate "traded on" timestamp, and
 * `updatedAt` is when the row last changed, which for a settled or removed
 * listing IS the date it settled or was removed.
 */
function listingMeta(listing: MatchedListing): string {
  const date = new Date(listing.updatedAt);
  const when = Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  if (listing.status === "TRADED") return when ? `Traded · ${when}` : "Traded";
  if (listing.status === "REMOVED") return when ? `Taken down · ${when}` : "Taken down";
  return "Still posted";
}

function ListingRow({ listing, meta }: { listing: MatchedListing; meta: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: postSpace.draft.rowGap,
        backgroundColor: postColor.surface,
        borderRadius: postRadius.innerListingRow,
        padding: postSpace.draft.rowPadding,
      }}
    >
      {listing.image ? (
        <Image
          source={{ uri: listing.image }}
          style={{
            width: postSize.draft.thumb,
            height: postSize.draft.thumb,
            borderRadius: postRadius.thumb,
            backgroundColor: postColor.inset,
          }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: postSize.draft.thumb,
            height: postSize.draft.thumb,
            borderRadius: postRadius.thumb,
            backgroundColor: postColor.inset,
          }}
        />
      )}
      <View style={{ flex: 1 }}>
        <Text
          style={[textStyle(postType.draftRowTitle), { color: postColor.ink }]}
          numberOfLines={postLines.draftRowTitle}
        >
          {listing.title}
        </Text>
        <Text
          style={[
            textStyle(postType.draftRowMeta),
            { color: postColor.inkMuted, marginTop: 5 },
          ]}
        >
          {meta}
        </Text>
      </View>
    </View>
  );
}

/* ───────────────────────────── self ─────────────────────────────────── */

/**
 * `self` — the photo matched one of the user's own listings.
 *
 * A GREY NOTICE, not a warning. Re-posting the same item is a legitimate thing
 * to do and the photo is attached either way; the note exists only because the
 * OTHER reading — two different items sharing one photo — is the one that
 * confuses a trader. "Keep this photo" is the primary, and that ordering is the
 * whole message.
 */
export function DuplicateSelf({
  listing,
  onKeep,
  onDifferent,
  onSeeListing,
}: {
  listing: MatchedListing | null;
  onKeep: () => void;
  onDifferent: () => void;
  onSeeListing: () => void;
}) {
  return (
    <View style={{ gap: 16 }}>
      <NoticePanel
        icon={
          <RelistIcon
            size={postIcon.relist.size}
            stroke={postIcon.relist.stroke}
            color={postColor.inkSecondary}
          />
        }
        heading="You used this photo before"
        body="It is from your own listing below. If you are posting the same item again, carry on. If this is a different item, use a new photo so traders can tell them apart."
      >
        {listing ? (
          <View style={{ marginTop: 14 }}>
            <ListingRow listing={listing} meta={listingMeta(listing)} />
          </View>
        ) : null}
      </NoticePanel>

      <View style={{ gap: 9 }}>
        <PrimaryButton label="Keep this photo" onPress={onKeep} />
        <OutlineButton label="Use a different photo" onPress={onDifferent} />
        {listing ? <TextButton label="See my old listing" onPress={onSeeListing} /> : null}
      </View>
    </View>
  );
}

/* ──────────────────────────── warned ────────────────────────────────── */

/**
 * `warned` — close to somebody else's photo, but not confirmed as the same.
 *
 * 2 px rule, warm heading, NO box. The listing goes on being postable and the
 * copy says so plainly: "You can post it as it is." What it does not do is
 * pretend the flag has no consequence — "If someone reports the listing, we may
 * check it against the other one" is the honest description of what a warned
 * row means downstream.
 *
 * The closing helper is the one piece of copy in the flow that ADVERTISES the
 * camera path, and it earns its place: it is the only moment where a user is
 * looking at a cost and the in-app camera is the thing that avoids it.
 */
export function DuplicateWarned({
  listing,
  onKeep,
  onTakeOwn,
}: {
  listing: MatchedListing | null;
  onKeep: () => void;
  onTakeOwn: () => void;
}) {
  return (
    <View style={{ gap: 16 }}>
      <View
        style={{
          height: postBorder.ruleWarned,
          backgroundColor: postColor.warm,
        }}
      />
      <WarmNotice
        icon={
          <AlertCircleIcon
            size={postIcon.alertWarned.size}
            stroke={postIcon.alertWarned.stroke}
            color={postColor.warmInk}
          />
        }
        heading="This photo looks close to one already on Baylo"
        body="As far as we can tell it is not the same photo, and similar items do look alike. You can post it as it is. If someone reports the listing, we may check it against the other one."
      />

      {listing ? (
        <View
          style={{
            borderRadius: postRadius.otherListingCard,
            borderWidth: postBorder.field,
            borderColor: postColor.divider,
            padding: 12,
            gap: 10,
          }}
        >
          <SectionLabel>THE OTHER LISTING</SectionLabel>
          <ListingRow
            listing={listing}
            meta={
              listing.ownerLocation
                ? `Posted by another trader in ${listing.ownerLocation}`
                : "Posted by another trader"
            }
          />
        </View>
      ) : null}

      <View style={{ gap: 9 }}>
        <PrimaryButton label="Keep this photo" onPress={onKeep} />
        <OutlineButton label="Take my own photo instead" onPress={onTakeOwn} />
      </View>

      <Text style={[textStyle(postType.helperLong), { color: postColor.inkMuted }]}>
        Photos you take in Baylo are not flagged this way, because we know they came from your
        camera.
      </Text>
    </View>
  );
}

/* ──────────────────────────── failed ────────────────────────────────── */

/**
 * `failed` — the photo was not added.
 *
 * The only place in the flow with a warm CONTAINER, and the only place a photo
 * is refused. The panel carries the two paragraphs verbatim because they are
 * doing the work described at the top of this file, and the closing helper —
 * "Your other photos and everything you filled in are still saved" — is what
 * stops a block reading as the whole form being lost.
 *
 * ── THE REFERENCE CODE AND THE APPEAL ARE BEHIND A FLAG, OFF ────────────────
 *
 * /api/ai/phash returns no reference code and there is no appeal route. Both
 * are built and both are hidden by `PHASH_APPEAL_SUPPORTED`, because a code
 * generated on the device is an identifier support cannot look up and an appeal
 * button wired to nothing would print "Sent. A person will look at this photo"
 * when nothing was sent. See the note on that constant for exactly what the
 * server would have to add.
 */
export function DuplicateFailed({
  reference,
  appealSent,
  onTakePhoto,
  onChooseAnother,
  onAppeal,
}: {
  reference: string | null;
  appealSent: boolean;
  onTakePhoto: () => void;
  onChooseAnother: () => void;
  onAppeal: () => void;
}) {
  const showReference = PHASH_APPEAL_SUPPORTED && reference !== null;

  return (
    <View style={{ gap: 16 }}>
      <View style={{ height: postBorder.ruleBlocked, backgroundColor: postColor.warm }} />

      <NoticePanel
        tone="fail"
        icon={
          <AlertCircleIcon
            size={postIcon.alertFailed.size}
            stroke={postIcon.alertFailed.stroke}
            color={postColor.warmInk}
          />
        }
        heading="We cannot use this photo"
      >
        <Text
          style={[
            textStyle(postType.noticeBody),
            { color: postColor.inkSecondary, marginTop: 6 },
          ]}
        >
          Our check matched it to a photo already on Baylo, so it was not added. This usually
          happens with photos saved from the internet or taken from another listing. Sometimes
          our check is simply wrong.
        </Text>
        <Text
          style={[
            textStyle(postType.noticeBody),
            { color: postColor.inkSecondary, marginTop: 12 },
          ]}
        >
          The quickest way through is a photo of the item taken with your own camera. If this
          photo is yours, tell us and a person will look at it.
        </Text>

        {showReference ? (
          <View style={{ marginTop: 14 }}>
            <Divider style={{ backgroundColor: postColor.warmLine, marginBottom: 12 }} />
            <Text style={[textStyle(postType.refLabel), { color: postColor.warmInk }]}>
              REFERENCE
            </Text>
            <Text
              style={[textStyle(postType.refCode), { color: postColor.ink, marginTop: 6 }]}
              selectable
            >
              {reference}
            </Text>
          </View>
        ) : null}
      </NoticePanel>

      <View style={{ gap: 9 }}>
        <PrimaryButton label="Take a photo now" onPress={onTakePhoto} />
        <OutlineButton label="Choose another photo" onPress={onChooseAnother} />
        {PHASH_APPEAL_SUPPORTED && !appealSent ? (
          <TextButton label="This photo is mine — get it checked" onPress={onAppeal} />
        ) : null}
      </View>

      {appealSent ? (
        <NoticePanel
          heading="Sent. A person will look at this photo within one working day."
          body="We will message you in Baylo either way. You can carry on posting with your other photos while you wait."
        />
      ) : null}

      <Text style={[textStyle(postType.helperLong), { color: postColor.inkMuted }]}>
        Your other photos and everything you filled in are still saved. Only this one photo was
        left out.
      </Text>
    </View>
  );
}

/* ─────────────────────── the failed upload ──────────────────────────── */

/**
 * A failed UPLOAD, which is not a failed check and does not look like one.
 *
 * 3 px rule, warm heading, no container — the same grammar as `warned`, because
 * it is the same kind of statement: something is wrong and the listing is not
 * blocked. THE PHOTO IS NEVER REMOVED. It is held locally and retried in the
 * background, and the background note says so, because a person who has just
 * been told an upload failed will otherwise sit on this screen waiting rather
 * than carrying on to step 2 as the flow intends.
 */
export function UploadFailed({
  onRetry,
  onRemove,
}: {
  onRetry: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={{ gap: 16 }}>
      <View
        style={{ height: postBorder.ruleUploadFailed, backgroundColor: postColor.warm }}
      />
      <WarmNotice
        icon={
          <AlertCircleIcon
            size={postIcon.alertUpload.size}
            stroke={postIcon.alertUpload.stroke}
            color={postColor.warmInk}
          />
        }
        heading="This photo did not finish uploading"
        body="Your photo is still here on your phone. Check your data or Wi-Fi and send it again."
      />
      <View style={{ gap: 6 }}>
        <PrimaryButton
          label="Try again"
          onPress={onRetry}
          icon={
            <RefreshIcon
              size={postIcon.retry.size}
              stroke={postIcon.retry.stroke}
              color={postColor.onGreen}
            />
          }
        />
        <TextButton label="Remove this photo" onPress={onRemove} />
      </View>
      <Text style={[textStyle(postType.helperLong), { color: postColor.inkMuted }]}>
        Baylo keeps trying quietly in the background while you carry on with the next steps.
      </Text>
    </View>
  );
}
