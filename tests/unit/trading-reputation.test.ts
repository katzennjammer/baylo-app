import assert from "node:assert/strict";

import { ApiError } from "../../src/api/client";
import {
  BRACKET_COUNT, bracketNeedsPremium, bracketOf, bracketRange, bracketsWord, valueNeedsPremium,
} from "../../src/lib/brackets";
import { displayedBridgeFee, hasPremiumAccess } from "../../src/lib/premium";
import { suspensionFrom } from "../../src/lib/suspension";
import { bridgingFee, classifyValue, offerLegality, offerTerms, tradeReward, valueCap } from "../../src/lib/trade-rules";
import { giveGet, viewerIsSender } from "../../src/lib/trade-sides";
import { getTrustTier, resolveTier } from "../../src/lib/trust";
import { valueRejectionSentence } from "../../src/lib/value-rejection";
import { suite } from "../support/case";

const trade = suite("Trading and Offers");
const rep = suite("Reputation and Premium");
const mod = suite("Moderation and Suspension");

// ── Brackets ────────────────────────────────────────────────────────────────
trade("Value Brackets", "Item is worth exactly 100 Leaves", "It is in Bracket 1 (ceiling is inclusive)", () => {
  assert.equal(bracketOf(100), 1);
});
trade("Value Brackets", "Item is worth 101 Leaves", "It is in Bracket 2", () => {
  assert.equal(bracketOf(101), 2);
});
trade("Value Brackets", "Item is worth 12,000 Leaves", "It is in Bracket 9", () => {
  assert.equal(bracketOf(12000), 9);
});
trade("Value Brackets", "Item is worth 12,001 Leaves", "It is in the top bracket (10)", () => {
  assert.equal(bracketOf(12001), BRACKET_COUNT);
});
trade("Value Brackets", "Range of Bracket 1 is requested", "Range is 1 to 100", () => {
  assert.deepEqual(bracketRange(1), { min: 1, max: 100 });
});
trade("Value Brackets", "Range of the top bracket is requested", "Range is 12,001 and up, with no maximum", () => {
  assert.deepEqual(bracketRange(10), { min: 12001, max: null });
});
trade("Value Brackets", "Bracket number outside 1 to 10 is requested", "It is clamped, never out of range", () => {
  assert.deepEqual(bracketRange(0), bracketRange(1));
  assert.deepEqual(bracketRange(99), bracketRange(10));
});
trade("Value Brackets", "Bracket count is displayed", "Singular for 1, plural otherwise", () => {
  assert.equal(bracketsWord(1), "1 bracket");
  assert.equal(bracketsWord(3), "3 brackets");
});

// ── Offer legality, fees, rewards ───────────────────────────────────────────
trade("Offer Rules", "Offer is in the same bracket as the item", "Offer is legal with no fee", () => {
  const t = offerTerms(3, 3);
  assert.deepEqual([t.legality, t.allowed, t.fee, t.payer], ["same", true, 0, null]);
});
trade("Offer Rules", "Offer is one bracket below the item", "Allowed as a bridge-up; the proposer pays", () => {
  const t = offerTerms(3, 4);
  assert.deepEqual([t.legality, t.allowed, t.payer], ["bridgeUp", true, "proposer"]);
});
trade("Offer Rules", "Offer is one bracket above the item", "Allowed as a bridge-down; the receiver pays", () => {
  const t = offerTerms(4, 3);
  assert.deepEqual([t.legality, t.allowed, t.payer], ["bridgeDown", true, "receiver"]);
});
trade("Offer Rules", "Offer is two brackets below the item", "Offer is refused as too low", () => {
  assert.equal(offerLegality(2, 4), "tooLow");
  assert.equal(offerTerms(2, 4).allowed, false);
});
trade("Offer Rules", "Offer is two brackets above the item", "Offer is refused as too high", () => {
  assert.equal(offerLegality(5, 3), "tooHigh");
  assert.equal(offerTerms(5, 3).fee, 0);
});
trade("Offer Rules", "Bridge between Bracket 3 and 4", "Fee is 10 Leaves per lower bracket (30)", () => {
  assert.equal(offerTerms(3, 4).fee, 30);
  assert.equal(offerTerms(4, 3).feeBracket, 3);
});
trade("Offer Rules", "Fee for a bracket that does not exist", "No fee is returned (null)", () => {
  assert.equal(bridgingFee(0), null);
  assert.equal(bridgingFee(BRACKET_COUNT), null);
});
trade("Offer Rules", "Trade completes for a Bracket 5 item", "Reward is 2 Leaves per bracket (10)", () => {
  assert.equal(tradeReward(5), 10);
});
trade("Offer Rules", "Trade reward for an out-of-range bracket", "Reward is clamped to the valid range", () => {
  assert.equal(tradeReward(0), 2);
  assert.equal(tradeReward(99), 20);
});

// ── Item value review ───────────────────────────────────────────────────────
trade("Item Value Check", "Owner keeps the suggested value", "Decision is 'suggested'", () => {
  assert.equal(classifyValue(400, 400), "suggested");
  assert.equal(classifyValue(null, 400), "suggested");
});
trade("Item Value Check", "Owner lowers the value", "Decision is 'lowered'", () => {
  assert.equal(classifyValue(300, 400), "lowered");
});
trade("Item Value Check", "Owner raises the value by one bracket", "Decision is 'raisedWithinCap'", () => {
  assert.equal(classifyValue(800, 400), "raisedWithinCap");
});
trade("Item Value Check", "Owner raises the value by two brackets", "Decision is 'needsReview'", () => {
  assert.equal(classifyValue(1000, 400), "needsReview");
});
trade("Item Value Check", "Cap is computed for a 400-Leaf suggestion", "One bracket of headroom: maximum 900 Leaves without review", () => {
  assert.equal(valueCap(400).maxValueWithoutReview, 900);
});

// ── Which side is "give" and which is "get" ─────────────────────────────────
trade("Trade Sides", "Viewer sent the offer", "They give what they offered and get what they asked for", () => {
  assert.deepEqual(giveGet(true, { offered: "A", requested: "B" } as never), { give: "A", get: "B" });
});
trade("Trade Sides", "Viewer received the offer", "Sides are swapped", () => {
  assert.deepEqual(giveGet(false, { offered: "A", requested: "B" } as never), { give: "B", get: "A" });
});
trade("Trade Sides", "Direction is 'sent' or 'received'", "viewerIsSender is true only for 'sent'", () => {
  assert.equal(viewerIsSender("sent"), true);
  assert.equal(viewerIsSender("received"), false);
});

// ── Premium gates ───────────────────────────────────────────────────────────
rep("Premium Gates", "Item is in Bracket 6", "No Premium needed", () => {
  assert.equal(bracketNeedsPremium(6), false);
});
rep("Premium Gates", "Item is in Bracket 7", "Premium is needed", () => {
  assert.equal(bracketNeedsPremium(7), true);
});
rep("Premium Gates", "Item value is not known yet (null)", "Premium is not demanded", () => {
  assert.equal(valueNeedsPremium(null), false);
  assert.equal(valueNeedsPremium(4001), true);
});
rep("Premium Access", "Profile is not loaded yet", "Treated as no Premium access", () => {
  assert.equal(hasPremiumAccess(null), false);
  assert.equal(hasPremiumAccess(undefined), false);
});
rep("Premium Access", "User has Premium only", "Access is granted", () => {
  assert.equal(hasPremiumAccess({ premium: true, vip: false }), true);
});
rep("Premium Access", "User has VIP only", "Access is granted (VIP includes Premium)", () => {
  assert.equal(hasPremiumAccess({ premium: false, vip: true }), true);
});
rep("Premium Access", "User has neither", "Access is not granted", () => {
  assert.equal(hasPremiumAccess({ premium: false, vip: false }), false);
});
rep("Premium Fee", "Premium user bridges up from Bracket 3", "Shown fee is 8 per bracket (24), not 30", () => {
  assert.equal(displayedBridgeFee({ fee: 30, feeBracket: 3 }, true), 24);
});
rep("Premium Fee", "Free user bridges up from Bracket 3", "Shown fee is the full 30", () => {
  assert.equal(displayedBridgeFee({ fee: 30, feeBracket: 3 }, false), 30);
});
rep("Premium Fee", "Offer has no bridge fee", "Fee stays 0 even for Premium", () => {
  assert.equal(displayedBridgeFee({ fee: 0, feeBracket: null }, true), 0);
});

// ── Trust tiers ─────────────────────────────────────────────────────────────
rep("Trust Tier", "Trader has 2 completed trades", "Tier is New Trader", () => {
  assert.equal(getTrustTier(2, 5), "New Trader");
});
rep("Trust Tier", "Trader has 3 trades", "Tier is Rising Trader", () => {
  assert.equal(getTrustTier(3, 0), "Rising Trader");
});
rep("Trust Tier", "Trader has 10 trades and a 4.2 rating", "Tier is Trusted Trader", () => {
  assert.equal(getTrustTier(10, 4.2), "Trusted Trader");
});
rep("Trust Tier", "Trader has 10 trades but a 3.5 rating", "Tier stays Rising Trader", () => {
  assert.equal(getTrustTier(10, 3.5), "Rising Trader");
});
rep("Trust Tier", "Trader has 25 trades and a 4.8 rating", "Tier is Top Trader", () => {
  assert.equal(getTrustTier(25, 4.8), "Top Trader");
});
rep("Trust Tier", "Trader has 25 trades but a 4.4 rating", "Tier is Trusted Trader, not Top", () => {
  assert.equal(getTrustTier(25, 4.4), "Trusted Trader");
});
rep("Trust Tier", "Server sends a tier", "The server's tier is used over the local calculation", () => {
  assert.equal(resolveTier({ trustTier: "Top Trader", totalTrades: 0, rating: 0 }), "Top Trader");
  assert.equal(resolveTier({ trustTier: null, totalTrades: 3, rating: 0 }), "Rising Trader");
});

// ── Moderation ──────────────────────────────────────────────────────────────
mod("Suspension", "Sign-in fails with an ordinary error (not a suspension)", "No suspension notice is produced", () => {
  assert.equal(suspensionFrom(new Error("boom")), null);
  assert.equal(suspensionFrom(new ApiError(401, "UNAUTHORIZED", "no")), null);
});
mod("Suspension", "Server sends ACCOUNT_SUSPENDED with reason, level and dates", "Notice carries the reason, level, since and until", () => {
  const n = suspensionFrom(new ApiError(403, "ACCOUNT_SUSPENDED", "x", [], null, {
    reason: "  Spam  ", level: 2, since: "2026-01-01T00:00:00Z", until: "2026-02-01T00:00:00Z",
  }));
  assert.equal(n?.reason, "Spam");
  assert.equal(n?.level, 2);
  assert.equal(n?.since?.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(n?.until?.toISOString(), "2026-02-01T00:00:00.000Z");
});
mod("Suspension", "Older server sends only the code", "Notice still opens, with empty reason and no dates", () => {
  const n = suspensionFrom(new ApiError(403, "ACCOUNT_SUSPENDED", "x"));
  assert.deepEqual(n, { reason: null, since: null, until: null, level: null });
});
mod("Suspension", "Suspension has no end date", "'until' is null (indefinite)", () => {
  assert.equal(suspensionFrom(new ApiError(403, "ACCOUNT_SUSPENDED", "x", [], null, { until: null }))?.until, null);
});
mod("Suspension", "Suspension date is garbage", "Date is treated as unknown (null)", () => {
  assert.equal(suspensionFrom(new ApiError(403, "ACCOUNT_SUSPENDED", "x", [], null, { since: "not-a-date" }))?.since, null);
});
mod("Suspension", "Reason is blank spaces", "Reason is null", () => {
  assert.equal(suspensionFrom(new ApiError(403, "ACCOUNT_SUSPENDED", "x", [], null, { reason: "   " }))?.reason, null);
});
mod("Value Rejection", "Listing is rejected as ABOVE_MARKET", "The matching explanation is shown", () => {
  assert.match(valueRejectionSentence("ABOVE_MARKET"), /list for well below/);
});
mod("Value Rejection", "Rejection code is unknown or missing", "The generic OTHER explanation is shown", () => {
  const other = valueRejectionSentence("OTHER");
  assert.equal(valueRejectionSentence("SOMETHING_NEW"), other);
  assert.equal(valueRejectionSentence(null), other);
  assert.equal(valueRejectionSentence(undefined), other);
});
