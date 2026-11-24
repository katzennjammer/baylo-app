import assert from "node:assert/strict";

import { marketplaceWithFilters, parseMarketplaceFilters } from "../../src/lib/marketplace-link";
import { businessCategoryLabel, isKnownBusinessCategory } from "../../src/lib/business-category";
import { listingArea } from "../../src/lib/listing-area";
import { matchSearch, toBrowseFilters, chipsOf, withoutChip } from "../../src/search-helper/match";
import { suite } from "../support/case";

const c = suite("Marketplace and Search");

c("Search Helper", "User types \"cheap secondhand iphone\"", "Category ELECTRONICS and a low price bracket are suggested", () => {
  const m = matchSearch("cheap secondhand iphone");
  assert.equal(m.filters.categories[0], "ELECTRONICS");
  assert.equal(m.filters.maxBracket, 2);
});
c("Search Helper", "User types \"under 50 Leaves\"", "Search is capped at Bracket 1 and sent as 100 Leaves", () => {
  const m = matchSearch("something for my kid's birthday under 50 Leaves");
  assert.ok(m.filters.categories.includes("TOYS"));
  const b = toBrowseFilters(m.filters);
  assert.equal(b.maxLeaves, 100);
  assert.equal(b.minLeaves, null);
});
c("Search Helper", "User types \"between 1000 and 2000 leaves in good condition\"", "Brackets 5 to 6, GOOD condition, sent as 901 to 2500", () => {
  const m = matchSearch("anything between 1000 and 2000 leaves in good condition");
  assert.equal(m.filters.condition, "GOOD");
  const b = toBrowseFilters(m.filters);
  assert.deepEqual([b.minLeaves, b.maxLeaves], [901, 2500]);
});
c("Search Helper", "User types \"like new sneakers\"", "Condition is LIKE_NEW, not NEW", () => {
  assert.equal(matchSearch("like new sneakers").filters.condition, "LIKE_NEW");
});
c("Search Helper", "User types \"fresh vegetables from a sari-sari store\"", "FOOD, perishable and shops-only SARI_SARI are suggested", () => {
  const f = matchSearch("fresh vegetables from a sari-sari store").filters;
  assert.ok(f.categories.includes("FOOD"));
  assert.equal(f.perishable, true);
  assert.equal(f.orgsOnly, true);
  assert.equal(f.businessCategories[0], "SARI_SARI");
});
c("Search Helper", "User types Taglish \"mountain bike na mura\"", "BIKES category and cheap price are understood", () => {
  const m = matchSearch("Gusto ko ng mountain bike na mura");
  assert.equal(m.filters.categories[0], "BIKES");
  assert.equal(m.filters.maxBracket, 2);
});
c("Search Helper", "User types \"over 12000 leaves\"", "Minimum is Bracket 10 (strictly above the top of Bracket 9)", () => {
  assert.equal(matchSearch("over 12000 leaves").filters.minBracket, 10);
});
c("Search Helper", "User types \"bracket 40\"", "Bracket is clamped to 10, no crash", () => {
  const f = matchSearch("bracket 40").filters;
  assert.deepEqual([f.minBracket, f.maxBracket], [10, 10]);
});
c("Search Helper", "User types \"looking for a drone\"", "Free-text query 'drone' is used when no category matches", () => {
  const f = matchSearch("looking for a drone").filters;
  assert.equal(f.q, "drone");
  assert.equal(f.categories.length, 0);
});
c("Search Helper", "User types words that match nothing (\"show me stuff\")", "Search is reported as not understood", () => {
  assert.equal(matchSearch("show me stuff").understood, false);
});
c("Search Helper", "User types only spaces", "Search is reported as not understood", () => {
  assert.equal(matchSearch("   ").understood, false);
});
c("Search Helper", "User types a 150-character word", "It is not sent as a query (the server caps queries at 100)", () => {
  const m = matchSearch("x".repeat(150));
  assert.equal(m.filters.q, null);
  assert.equal(m.understood, false);
});
c("Search Helper", "User types seven categories at once", "Categories are capped at 5", () => {
  assert.equal(matchSearch("books games toys art music pets plants").filters.categories.length, 5);
});
c("Search Helper", "User removes a filter chip", "That filter is cleared and the other chips remain", () => {
  const f = matchSearch("cheap secondhand iphone").filters;
  const chips = chipsOf(f);
  assert.ok(chips.length >= 2);
  const after = withoutChip(f, chips[0]);
  assert.equal(chipsOf(after).length, chips.length - 1);
});

c("Marketplace Filters", "Search helper hands filters to the Marketplace screen and back", "Parsed filters equal the filters that were sent", () => {
  const sent = { q: "bike", categories: ["BIKES"], condition: "GOOD", minLeaves: 101, maxLeaves: 250, perishable: false };
  const { params } = marketplaceWithFilters(sent);
  assert.deepEqual(parseMarketplaceFilters(params.filters), sent);
});
c("Marketplace Filters", "Filter parameter is empty or missing", "No filters are applied", () => {
  assert.equal(parseMarketplaceFilters(undefined), null);
  assert.equal(parseMarketplaceFilters(""), null);
});
c("Marketplace Filters", "Filter parameter is invalid JSON", "No filters are applied, no crash", () => {
  assert.equal(parseMarketplaceFilters("{oops"), null);
});
c("Marketplace Filters", "Filter parameter is an array instead of an object", "No filters are applied", () => {
  assert.equal(parseMarketplaceFilters("[1,2]"), null);
});
c("Marketplace Filters", "Filter contains an unknown category", "Unknown category is dropped", () => {
  const f = parseMarketplaceFilters(JSON.stringify({ categories: ["BIKES", "NOT_A_CATEGORY"] }));
  assert.deepEqual(f?.categories, ["BIKES"]);
});
c("Marketplace Filters", "Filter has minimum price above maximum price", "Both bounds are dropped instead of sending a 400", () => {
  const f = parseMarketplaceFilters(JSON.stringify({ minLeaves: 500, maxLeaves: 100 }));
  assert.equal(f?.minLeaves, undefined);
  assert.equal(f?.maxLeaves, undefined);
});
c("Marketplace Filters", "Filter has a negative or fractional price", "The bad bound is ignored", () => {
  const f = parseMarketplaceFilters(JSON.stringify({ minLeaves: -5, maxLeaves: 10.5 }));
  assert.equal(f?.minLeaves, undefined);
  assert.equal(f?.maxLeaves, undefined);
});
c("Marketplace Filters", "Filter query is 300 characters long", "Query is cut to 100 characters", () => {
  const f = parseMarketplaceFilters(JSON.stringify({ q: "a".repeat(300) }));
  assert.equal(f?.q?.length, 100);
});

c("Shop Categories", "Known business category is shown", "A friendly label is returned (SARI_SARI -> Sari-sari store)", () => {
  assert.equal(businessCategoryLabel("SARI_SARI"), "Sari-sari store");
});
c("Shop Categories", "Business category from a newer server is shown", "It is title-cased instead of leaking raw SNAKE_CASE", () => {
  assert.equal(businessCategoryLabel("PET_SUPPLIES"), "Pet supplies");
});
c("Shop Categories", "Unknown category is checked", "isKnownBusinessCategory is false", () => {
  assert.equal(isKnownBusinessCategory("PET_SUPPLIES"), false);
  assert.equal(isKnownBusinessCategory("RETAIL"), true);
});
c("Listing Area", "Listing has an active safe-zone hub in 'Cebu City'", "Area shown is 'Cebu' (city suffix removed)", () => {
  const item = { safeZones: [{ city: "Cebu City", isActive: true }], owner: { location: "Mandaue City" } } as never;
  assert.equal(listingArea(item), "Cebu");
});
c("Listing Area", "Listing has no hubs", "Area falls back to the owner's location", () => {
  assert.equal(listingArea({ safeZones: [], owner: { location: "Mandaue City" } } as never), "Mandaue");
});
c("Listing Area", "Listing has no hubs and no owner location", "Area is null", () => {
  assert.equal(listingArea({ safeZones: [], owner: { location: "  " } } as never), null);
});
