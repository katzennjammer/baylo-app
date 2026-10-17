/**
 * Offline checks for the free search helper's matcher (src/search-helper/match.ts)
 * and the Marketplace filter hand-off (src/lib/marketplace-link.ts, parse side).
 * Pure functions, no device, no network:
 *
 *   npx tsx scripts/verify-search-helper.ts
 */
import { matchSearch, toBrowseFilters, chipsOf, withoutChip, valueChipLabel } from "../src/search-helper/match";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}`, detail === undefined ? "" : JSON.stringify(detail));
  }
}

console.log("phrasings");
{
  const m = matchSearch("something for my kid's birthday under 50 Leaves");
  check("kid's birthday -> TOYS", m.filters.categories.includes("TOYS"), m);
  check("under 50 Leaves -> max Bracket 1", m.filters.maxBracket === 1 && m.filters.minBracket === null, m.filters);
  const b = toBrowseFilters(m.filters);
  check("sent as the bracket edge (100), never 50", b.maxLeaves === 100 && b.minLeaves === null, b);
  check("nothing left unexplained", m.ignored.length === 0, m.ignored);
}
{
  const m = matchSearch("cheap secondhand iphone");
  check("iphone -> ELECTRONICS", m.filters.categories[0] === "ELECTRONICS", m.filters);
  check("cheap -> Bracket 2 or lower", m.filters.maxBracket === 2, m.filters);
  check("no q when a category matched", m.filters.q === null, m.filters);
}
{
  const m = matchSearch("fresh vegetables from a sari-sari store");
  check("vegetables -> FOOD", m.filters.categories.includes("FOOD"), m.filters);
  check("fresh -> perishable", m.filters.perishable === true, m.filters);
  check("sari-sari -> shops + SARI_SARI", m.filters.orgsOnly && m.filters.businessCategories[0] === "SARI_SARI", m.filters);
}
{
  const m = matchSearch("anything between 1000 and 2000 leaves in good condition");
  check("1000..2000 -> Brackets 5 to 6", m.filters.minBracket === 5 && m.filters.maxBracket === 6, m.filters);
  check("good condition -> GOOD", m.filters.condition === "GOOD", m.filters);
  const b = toBrowseFilters(m.filters);
  check("sent as 901..2500", b.minLeaves === 901 && b.maxLeaves === 2500, b);
}
{
  const m = matchSearch("books bracket 2");
  check("bracket 2 -> exactly Bracket 2", m.filters.minBracket === 2 && m.filters.maxBracket === 2, m.filters);
  const m2 = matchSearch("guitar brackets 3 to 5");
  check("brackets 3 to 5", m2.filters.minBracket === 3 && m2.filters.maxBracket === 5 && m2.filters.categories[0] === "MUSIC", m2.filters);
  const m3 = matchSearch("bracket 40");
  check("bracket 40 clamped to 10", m3.filters.minBracket === 10 && m3.filters.maxBracket === 10, m3.filters);
}
{
  // Bracket edges: 100 is the top of Bracket 1, 12000 the top of Bracket 9.
  check("over 12000 -> Bracket 10 (strict)", matchSearch("over 12000 leaves").filters.minBracket === 10);
  check("at least 12000 -> Bracket 9 (inclusive)", matchSearch("at least 12000 leaves").filters.minBracket === 9);
  check("under 101 -> Bracket 1 (strict)", matchSearch("under 101 leaves").filters.maxBracket === 1);
  check("up to 101 -> Bracket 2 (inclusive)", matchSearch("up to 101 leaves").filters.maxBracket === 2);
  check("under 0 -> Bracket 1, not a crash", matchSearch("under 0 leaves").filters.maxBracket === 1);
  const junk = matchSearch("x".repeat(150));
  check("a 150-char word is not a q (browse caps q at 100)", junk.filters.q === null && !junk.understood, junk.filters);
}
{
  const m = matchSearch("brand new lego from shops");
  check("brand new -> NEW (not left as 'brand')", m.filters.condition === "NEW" && !m.ignored.includes("brand"), m);
  check("lego -> TOYS", m.filters.categories[0] === "TOYS", m.filters);
  check("from shops -> orgsOnly, no shop type", m.filters.orgsOnly && m.filters.businessCategories.length === 0, m.filters);
  const m2 = matchSearch("like new sneakers");
  check("like new -> LIKE_NEW, not NEW", m2.filters.condition === "LIKE_NEW", m2.filters);
}
{
  const m = matchSearch("looking for a drone");
  check("drone -> q, no category", m.filters.q === "drone" && m.filters.categories.length === 0, m.filters);
  const m2 = matchSearch("red nike shoes");
  check("shoes -> CLOTHING, red/nike listed as unused", m2.filters.categories[0] === "CLOTHING" && m2.ignored.includes("nike") && m2.ignored.includes("red"), m2);
}
{
  const m = matchSearch("Gusto ko ng mountain bike na mura");
  check("Taglish: mountain bike -> BIKES", m.filters.categories[0] === "BIKES", m.filters);
  check("Taglish: mura -> cheap", m.filters.maxBracket === 2, m.filters);
}
{
  const m = matchSearch("bikes near me");
  check("near me -> a note, not a silent drop", m.notes.length === 1 && m.filters.categories[0] === "BIKES", m);
}
{
  const m = matchSearch("show me stuff");
  check("nothing recognisable -> understood=false", !m.understood, m);
  const m2 = matchSearch("   ");
  check("blank -> understood=false", !m2.understood, m2);
  const m3 = matchSearch("pls help ??");
  check("'help' shows the tips, not a search for the word", !m3.understood, m3);
}
{
  const m = matchSearch("books games toys art music pets plants");
  check("categories capped at 5", m.filters.categories.length === 5, m.filters.categories);
}

console.log("chips");
{
  const m = matchSearch("fresh fruit from a farm under 100 leaves");
  const chips = chipsOf(m.filters);
  const kinds = chips.map((c) => c.kind).join(",");
  check("chips: category, value, shopType, perishable (no separate 'shops' chip)", kinds === "category,value,shopType,perishable", kinds);
  const noValue = withoutChip(m.filters, chips.find((c) => c.kind === "value")!);
  check("removing the value chip clears both bounds", noValue.minBracket === null && noValue.maxBracket === null, noValue);
  const noType = withoutChip(m.filters, chips.find((c) => c.kind === "shopType")!);
  check("removing the last shop type leaves 'from shops' as its own chip", noType.orgsOnly && chipsOf(noType).some((c) => c.kind === "shops"), chipsOf(noType));
  check("value labels", valueChipLabel(null, 1) === "Bracket 1" && valueChipLabel(5, 6) === "Brackets 5 to 6" && valueChipLabel(3, null) === "Bracket 3 and up" && valueChipLabel(null, 4) === "Bracket 4 or lower");
}

console.log("post wizard unchanged");
{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { categoriesFromWanted, mergeLookingFor } = require("../src/post/wanted-keywords");
  check("rice cooker is kitchenware, not food", JSON.stringify(categoriesFromWanted("a rice cooker")) === '["FURNITURE"]');
  check("dog food is pets", JSON.stringify(categoriesFromWanted("dog food")) === '["PETS"]');
  check("order by position", JSON.stringify(categoriesFromWanted("a bag, shoes, something for the kitchen")) === '["BAGS","CLOTHING","FURNITURE"]');
  check("'kid' is NOT a wizard keyword (search-only)", categoriesFromWanted("for my kid").length === 0);
  check("mergeLookingFor still caps", mergeLookingFor(["BOOKS"], "bag shoes phone guitar bike toy", 3).length === 3);
}

if (failures) {
  console.log(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("\nall checks passed");
