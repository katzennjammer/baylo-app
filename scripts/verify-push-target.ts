/**
 * Where a tapped push opens (Oct 2026), checked without a phone:
 *
 *   node --require ./scripts/rn-stub.cjs --require ./scripts/securestore-fake.cjs --import tsx scripts/verify-push-target.ts
 *
 *   1. Each kind of push opens the same screen as the bell's row for it,
 *      built from the fields baylo-api's @/lib/push puts in the data.
 *   2. Anything missing or malformed opens the notifications list.
 *   3. The notification id is read back for marking the row read.
 */
// The API client reads React Native's __DEV__ at load; plain Node has none.
// Set first, then import, which is why the import is dynamic.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;
void (async () => {
const { pushNotificationId, pushTarget } = await import("../src/notifications/push-target");

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
eq("chat message (conversation)", pushTarget({ type: "NEW_MESSAGE", entityType: "conversation", entityId: "u2", actorId: "u2" }), "/messages?partner=u2");
eq("chat message (no entity, older row)", pushTarget({ type: "NEW_MESSAGE", entityType: null, entityId: null, actorId: "u9" }), "/messages?partner=u9");
eq("follow", pushTarget({ type: "FOLLOW_REQUEST", entityType: null, entityId: null, actorId: "u3" }), "/user?id=u3");
eq("trade accepted", pushTarget({ type: "TRADE_ACCEPTED", entityType: "trade", entityId: "t1", actorId: "u2" }), "/trade?id=t1&handoff=1");
eq("trade completed", pushTarget({ type: "TRADE_COMPLETED", entityType: "trade", entityId: "t1", actorId: "u2" }), "/rate-trade?id=t1");
eq("meetup", pushTarget({ type: "MEETUP_PROPOSED", entityType: "meetup", entityId: "t1", actorId: "u2" }), "/trade?id=t1");

// 2. Fallbacks
eq("no data", pushTarget(undefined), "/notifications");
eq("no type", pushTarget({ entityType: "trade", entityId: "t1" }), "/notifications");
eq("wrong types", pushTarget({ type: 42 as unknown, entityType: {} as unknown }), "/notifications");
eq("unplaceable", pushTarget({ type: "SUSPENSION_LIFTED", entityType: null, entityId: null, actorId: null }), "/notifications");

// 3.
eq("id", pushNotificationId({ notificationId: "n1" }), "n1");
eq("no id", pushNotificationId({}), null);

console.log(failures === 0 ? `verify-push-target: all ${checks} checks passed` : `verify-push-target: ${failures} of ${checks} FAILED`);
if (failures > 0) (globalThis as { process?: { exitCode?: number } }).process!.exitCode = 1;
})();
