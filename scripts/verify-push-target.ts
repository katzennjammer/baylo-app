/**
 * Where a tapped push opens (Oct 2026), checked without a phone:
 *
 *   node --require ./scripts/rn-stub.cjs --require ./scripts/securestore-fake.cjs --import tsx scripts/verify-push-target.ts
 *
 *   1. Each kind of push opens the same screen as the bell's row for it,
 *      built from the fields baylo-api's @/lib/push puts in the data.
 *   2. Anything missing or malformed has no route.
 *   3. The notification id is read back for marking the row read.
 */
// The API client reads React Native's __DEV__ at load; plain Node has none.
// Set first, then import, which is why the import is dynamic.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;
void (async () => {
const { pushMessagePartnerId, pushNotificationId, pushTarget, shouldSuppressMessageNotification } = await import("../src/notifications/push-target");

let failures = 0;
let checks = 0;
function eq<T>(label: string, got: T, want: T) {
  checks++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) {
    failures++;
    console.log(`FAIL ${label}\n  got  ${a}\n  want ${b}`);
  }
}

// 1. Real shapes, from the live Notification table on 20 Oct 2026.
eq("chat message (conversation)", pushTarget({ type: "NEW_MESSAGE", entityType: "conversation", entityId: "u2", actorId: "u2" }), "/messages/thread?partner=u2");
eq("chat message (legacy, no entity)", pushTarget({ type: "NEW_MESSAGE", entityType: null, entityId: null, actorId: "u9" }), "/messages/thread?partner=u9");
eq("chat message prefers explicit partnerId", pushMessagePartnerId({ type: "NEW_MESSAGE", partnerId: "u4", entityId: "u2", actorId: "u3" }), "u4");
eq("chat message falls back to entityId", pushMessagePartnerId({ type: "NEW_MESSAGE", entityId: "u2", actorId: "u3" }), "u2");
eq("chat message falls back to actorId", pushMessagePartnerId({ type: "NEW_MESSAGE", actorId: "u3" }), "u3");
eq("a listing comment (NEW_MESSAGE on an item) is not a chat", pushMessagePartnerId({ type: "NEW_MESSAGE", entityType: "item", entityId: "item9", actorId: "u3" }), null);
eq("a listing comment push opens the listing with its comments", pushTarget({ type: "NEW_MESSAGE", entityType: "item", entityId: "item9", actorId: "u3" })?.startsWith("/item?id=item9"), true);
eq("shop conversation routes using its peer partner id", pushTarget({ type: "NEW_MESSAGE", entityType: "conversation", entityId: "shop-peer", actorId: "sender" }), "/messages/thread?partner=shop-peer");
eq("same active partner message is suppressed", shouldSuppressMessageNotification({ type: "NEW_MESSAGE", partnerId: "u2" }, "u2", true), true);
eq("different partner message is shown", shouldSuppressMessageNotification({ type: "NEW_MESSAGE", entityId: "u3" }, "u2", true), false);
eq("non-message notification is shown", shouldSuppressMessageNotification({ type: "FOLLOW_REQUEST", actorId: "u2" }, "u2", true), false);
eq("other notification with conversation entity is shown", shouldSuppressMessageNotification({ type: "NEW_REVIEW", entityType: "conversation", entityId: "u2" }, "u2", true), false);
eq("message with no active conversation is shown", shouldSuppressMessageNotification({ type: "NEW_MESSAGE", partnerId: "u2" }, null, true), false);
eq("follow", pushTarget({ type: "FOLLOW_REQUEST", entityType: null, entityId: null, actorId: "u3" }), "/user?id=u3");
eq("trade accepted", pushTarget({ type: "TRADE_ACCEPTED", entityType: "trade", entityId: "t1", actorId: "u2" }), "/trade?id=t1"); // not handoff=1: opening the codes issues them (7 Nov 2026)
eq("trade completed", pushTarget({ type: "TRADE_COMPLETED", entityType: "trade", entityId: "t1", actorId: "u2" }), "/rate-trade?id=t1");
eq("meetup", pushTarget({ type: "MEETUP_PROPOSED", entityType: "meetup", entityId: "t1", actorId: "u2" }), "/trade?id=t1");
eq("shop verified -> Profile (Posting as is gone)", pushTarget({ type: "ID_VERIFICATION_APPROVED", entityType: "organization", entityId: "o1", actorId: null }), "/(app)/profile");

// 2. Fallbacks
eq("no data", pushTarget(undefined), null);
eq("no type", pushTarget({ entityType: "trade", entityId: "t1" }), null);
eq("wrong types", pushTarget({ type: 42 as unknown, entityType: {} as unknown }), null);
eq("unplaceable", pushTarget({ type: "SUSPENSION_LIFTED", entityType: null, entityId: null, actorId: null }), null);

// 3.
eq("id", pushNotificationId({ notificationId: "n1" }), "n1");
eq("no id", pushNotificationId({}), null);

console.log(failures === 0 ? `verify-push-target: all ${checks} checks passed` : `verify-push-target: ${failures} of ${checks} FAILED`);
if (failures > 0) (globalThis as { process?: { exitCode?: number } }).process!.exitCode = 1;
})();
