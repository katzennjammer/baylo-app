import type { BrowseFilters } from "../api/browse";
import type { Category } from "../api/post";
import { BRACKET_COUNT, bracketOf, bracketRange, type Bracket } from "../lib/brackets";
import {
  WANTED_KEYWORDS,
  buildKeywordTable,
  normalise,
  scanCategories,
} from "../post/wanted-keywords";

/**
 * The free search helper: typed words in, Marketplace filters out.
 * Deterministic, on the phone, no model and no request.
 *
 * ── WHAT IT UNDERSTANDS, EXACTLY ────────────────────────────────────────────
 *
 * Only what is written below. Categories come from the SAME keyword table the
 * post wizard reads "what are you hoping to get" with (wanted-keywords.ts),
 * plus a handful of search-only words. Around them, a short list of modifiers,
 * each one an explicit pattern:
 *
 *   value      "under 50 leaves", "over 1000", "between 1000 and 2000 leaves",
 *              "around 300 leaves", "bracket 3", "brackets 2 to 4", "cheap"
 *   condition  "brand new", "like new", "good condition", "for parts"...
 *   shops      "from shops", "store", "sari-sari", "cooperative", "farm"...
 *   perishable "fresh", "ulam", "home cooked"...
 *
 * There is no grammar and no negation: "not shoes" matches Fashion. That is
 * the honest limit of a keyword table, and the helper says so on screen -- it
 * shows what it understood as removable chips, and lists the words it did not
 * use, rather than pretending it understood the sentence.
 *
 * ── VALUE IS BRACKETS, AND ONLY BRACKET EDGES LEAVE ─────────────────────────
 *
 * "Under 50 Leaves" becomes Bracket 1 and is sent as that bracket's ceiling,
 * 100 -- never as 50. The FilterSheet's rule, for the FilterSheet's reason: a
 * range that can land on any number lets somebody narrow it until a listing
 * drops out and read its exact value off the edge.
 *
 * ── PURE ────────────────────────────────────────────────────────────────────
 *
 * Type-only imports from the API modules, so this file runs in Node
 * (scripts/verify-search-helper.ts) as well as on the phone. Labels for the
 * chips are resolved by the component, not here.
 */

/** What the helper decided, in its own vocabulary: brackets, not Leaves. */
export interface HelperFilters {
  categories: Category[];
  minBracket: Bracket | null;
  maxBracket: Bracket | null;
  condition: string | null;
  orgsOnly: boolean;
  businessCategories: string[];
  perishable: boolean | null;
  /** One word, only when no category was found. See pickQuery(). */
  q: string | null;
}

export interface HelperMatch {
  filters: HelperFilters;
  /** Words it read and did not use, in the order they were typed. */
  ignored: string[];
  /** Things it recognised but cannot do, said plainly (e.g. "near me"). */
  notes: string[];
  /** False when nothing at all was recognised: the "try simpler words" case. */
  understood: boolean;
}

export const EMPTY_HELPER_FILTERS: HelperFilters = {
  categories: [],
  minBracket: null,
  maxBracket: null,
  condition: null,
  orgsOnly: false,
  businessCategories: [],
  perishable: null,
  q: null,
};

/** Mirrors the server's MAX_CATEGORIES; /browse refuses a sixth. */
const MAX_CATEGORIES = 5;

/**
 * Words the post wizard's table leaves out that a SEARCH plainly means.
 * "Something for my kid" is Kids & Toys when you are looking for it; the
 * wizard's field asks what a poster wants in return, where "kid" is rarer.
 */
const SEARCH_EXTRA_KEYWORDS: Partial<Record<Category, readonly string[]>> = {
  TOYS: ["kid", "child", "toddler", "anak", "bata"],
};

const TABLE = buildKeywordTable(mergeTables(WANTED_KEYWORDS, SEARCH_EXTRA_KEYWORDS));

function mergeTables(
  a: Partial<Record<Category, readonly string[]>>,
  b: Partial<Record<Category, readonly string[]>>,
): Partial<Record<Category, readonly string[]>> {
  const out: Partial<Record<Category, readonly string[]>> = { ...a };
  for (const [k, words] of Object.entries(b) as [Category, readonly string[]][]) {
    out[k] = [...(out[k] ?? []), ...words];
  }
  return out;
}

/* ─────────────────────────── modifiers ─────────────────────────── */

/**
 * Longest phrases first within each list, because a match blanks its words:
 * "like new" must be read before "new" can claim half of it.
 */
const CONDITION_PHRASES: readonly [string, string][] = [
  ["brand new", "NEW"],
  ["like new", "LIKE_NEW"],
  ["almost new", "LIKE_NEW"],
  ["barely used", "LIKE_NEW"],
  ["good condition", "GOOD"],
  ["fair condition", "FAIR"],
  ["for parts", "POOR"],
  ["sealed", "NEW"],
  ["new", "NEW"],
  ["broken", "POOR"],
  ["sira", "POOR"],
];

/** Kinds of shop. Each one also means "from shops". */
const SHOP_TYPE_PHRASES: readonly [string, string][] = [
  ["sari sari store", "SARI_SARI"],
  ["sari sari", "SARI_SARI"],
  ["sarisari", "SARI_SARI"],
  ["repair shop", "ELECTRONICS_REPAIR"],
  ["non profit", "NONPROFIT"],
  ["nonprofit", "NONPROFIT"],
  ["charity", "NONPROFIT"],
  ["cooperative", "COOPERATIVE"],
  ["kooperatiba", "COOPERATIVE"],
  ["co op", "COOPERATIVE"],
  ["coop", "COOPERATIVE"],
  ["handicraft", "HANDICRAFT"],
  ["farmers", "AGRICULTURE"],
  ["farmer", "AGRICULTURE"],
  ["farm", "AGRICULTURE"],
];

const SHOP_WORDS: readonly string[] = [
  "organizations", "organisations", "organization", "organisation", "businesses",
  "business", "tindahan", "stores", "store", "shops", "shop", "orgs", "msme",
];

const PERISHABLE_PHRASES: readonly string[] = [
  "lutong bahay", "home cooked", "homecooked", "baked today", "perishables", "perishable",
  "fresh", "ulam", "luto",
];

/** "Cheap" with no number: the bottom two brackets. */
const CHEAP_WORDS: readonly string[] = ["affordable", "budget", "cheaper", "cheap", "murang", "mura"];
const CHEAP_MAX_BRACKET: Bracket = 2;

/** Recognised, not supported here -- said in a note, not silently dropped. */
const NEARBY_PHRASES: readonly string[] = ["near me", "nearby", "malapit", "close to me"];

/** Words that carry no search meaning, English and everyday Filipino. */
const STOPWORDS = new Set([
  "a", "an", "the", "some", "any", "something", "anything", "stuff", "things", "thing", "item",
  "items", "i", "im", "me", "my", "we", "our", "you", "your", "want", "wants", "need", "needs",
  "looking", "look", "find", "search", "show", "get", "buy", "trade", "swap", "have", "has",
  "for", "of", "to", "in", "on", "at", "with", "and", "or", "from", "by", "that", "this", "is",
  "are", "be", "it", "its", "please", "pls", "po", "can", "could", "would", "like", "just",
  "only", "also", "very", "really", "good", "nice", "used", "secondhand", "second", "hand",
  "preloved", "pre", "loved", "leaves", "leaf", "lvs", "condition", "ang", "ng", "mga", "sa",
  "na", "yung", "ung", "ko", "ako", "gusto", "hanap", "naghahanap", "may", "meron", "dito",
  "lang", "sana", "para", "kay", "si", "ba", "magkano", "how", "much", "many", "what", "where",
  "who", "which", "s", "t", "help", "tulong", "birthday", "gift", "gifts", "regalo", "present",
]);

/* ─────────────────────────── scanning ─────────────────────────── */

/** Blanks `phrase` (whole words) out of the padded text; true if it was there. */
function take(text: { v: string }, phrase: string): boolean {
  const needle = ` ${phrase} `;
  const at = text.v.indexOf(needle);
  if (at === -1) return false;
  text.v = text.v.slice(0, at + 1) + " ".repeat(phrase.length) + text.v.slice(at + 1 + phrase.length);
  return true;
}

/** Runs a regex over the padded text, blanking each match; returns the matches. */
function takeAll(text: { v: string }, re: RegExp): RegExpExecArray[] {
  const found: RegExpExecArray[] = [];
  const global = new RegExp(re.source, "g");
  let m: RegExpExecArray | null;
  while ((m = global.exec(text.v)) !== null) found.push(m);
  for (const m2 of found) {
    text.v = text.v.slice(0, m2.index) + " ".repeat(m2[0].length) + text.v.slice(m2.index + m2[0].length);
  }
  return found;
}

const clampBracket = (n: number): Bracket => Math.min(Math.max(Math.trunc(n), 1), BRACKET_COUNT);
const LEAVES = "(?: leaves| leaf| lvs| l)?";

/** Value phrases, most specific first. Numbers are Leaves unless "bracket" says otherwise. */
function readValue(text: { v: string }, f: HelperFilters) {
  const setRange = (a: Bracket, b: Bracket) => {
    f.minBracket = Math.min(a, b);
    f.maxBracket = Math.max(a, b);
  };

  // "bracket 3", "brackets 2 to 4", "bracket 2 and 4"
  for (const m of takeAll(text, / brackets? (\d+)(?: (?:to|and|hanggang) (\d+))?(?= )/)) {
    const a = clampBracket(Number(m[1]));
    setRange(a, m[2] ? clampBracket(Number(m[2])) : a);
  }
  // "between 1000 and 2000 leaves", "from 100 to 300"
  for (const m of takeAll(text, new RegExp(` (?:between|from) (\\d+) (?:and|to) (\\d+)${LEAVES}(?= )`))) {
    setRange(bracketOf(Number(m[1])), bracketOf(Number(m[2])));
  }
  // "1000 to 2000 leaves", "1000 2000 leaves" (a hyphen normalises to a space)
  for (const m of takeAll(text, / (\d+) (?:to )?(\d+) (?:leaves|leaf|lvs)(?= )/)) {
    setRange(bracketOf(Number(m[1])), bracketOf(Number(m[2])));
  }
  // STRICT bounds exclude the number itself, which matters exactly at a
  // bracket edge: 12000 is the top of Bracket 9, so "over 12000" is Bracket
  // 10, and "under 101" is still Bracket 1. INCLUSIVE bounds keep it.
  //
  // "under 50", "less than 100"
  for (const m of takeAll(text, new RegExp(` (?:under|below|less than|wala pang) (\\d+)${LEAVES}(?= )`))) {
    f.maxBracket = bracketOf(Math.max(Number(m[1]) - 1, 0));
  }
  // "up to 300 leaves", "at most 500"
  for (const m of takeAll(
    text,
    new RegExp(` (?:up to|upto|max|maximum|at most|within|hanggang) (\\d+)${LEAVES}(?= )`),
  )) {
    f.maxBracket = bracketOf(Number(m[1]));
  }
  // "over 1000", "more than 500"
  for (const m of takeAll(text, new RegExp(` (?:over|above|more than|higher than) (\\d+)${LEAVES}(?= )`))) {
    f.minBracket = bracketOf(Number(m[1]) + 1);
  }
  // "at least 500 leaves"
  for (const m of takeAll(text, new RegExp(` (?:at least|min|minimum) (\\d+)${LEAVES}(?= )`))) {
    f.minBracket = bracketOf(Number(m[1]));
  }
  // "around 300 leaves", "300 leaves"
  for (const m of takeAll(text, / (?:around |about |mga |nasa )?(\d+) (?:leaves|leaf|lvs)(?= )/)) {
    setRange(bracketOf(Number(m[1])), bracketOf(Number(m[1])));
  }
  // "cheap" only when no number already said it.
  const cheap = CHEAP_WORDS.some((w) => take(text, w));
  if (cheap && f.maxBracket === null) f.maxBracket = CHEAP_MAX_BRACKET;

  // A lower bound above the upper one: keep what was said last as the
  // tighter side rather than send /browse an inverted range.
  if (f.minBracket !== null && f.maxBracket !== null && f.minBracket > f.maxBracket) {
    setRange(f.minBracket, f.maxBracket);
  }
}

/**
 * The one-word search, when the text named no category at all.
 *
 * /browse matches `q` as ONE substring of a title, description or shop name,
 * so a phrase finds nothing. The longest remaining word is the likeliest noun
 * ("drone", "ukulele"). With a category found, no `q` is set: an adjective
 * like "comfy" would narrow a good category search to nothing.
 */
function pickQuery(words: readonly string[]): string | null {
  // Longer than any real word is noise, and /browse refuses a q over 100.
  const candidates = words.filter((w) => w.length >= 3 && w.length <= MAX_Q_CHARS && !/^\d+$/.test(w));
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => b.length - a.length)[0];
}

const MAX_Q_CHARS = 40;

export function matchSearch(input: string): HelperMatch {
  const f: HelperFilters = { ...EMPTY_HELPER_FILTERS, categories: [], businessCategories: [] };
  const notes: string[] = [];
  const text = { v: normalise(input) };

  if (NEARBY_PHRASES.some((p) => take(text, p))) {
    notes.push("Nearby search isn't something I can do. Use the map in Marketplace for that.");
  }

  readValue(text, f);

  for (const [phrase, value] of SHOP_TYPE_PHRASES) {
    if (take(text, phrase) && !f.businessCategories.includes(value)) f.businessCategories.push(value);
  }
  if (SHOP_WORDS.some((w) => take(text, w)) || f.businessCategories.length > 0) f.orgsOnly = true;

  if (PERISHABLE_PHRASES.some((p) => take(text, p))) f.perishable = true;

  for (const [phrase, value] of CONDITION_PHRASES) {
    if (take(text, phrase) && f.condition === null) f.condition = value;
  }

  const scanned = scanCategories(text.v, TABLE);
  f.categories = scanned.categories.slice(0, MAX_CATEGORIES);

  const leftovers = scanned.rest
    .trim()
    .split(/\s+/)
    .filter((w) => w !== "" && !STOPWORDS.has(w));

  if (f.categories.length === 0) f.q = pickQuery(leftovers);
  const ignored = leftovers.filter((w) => w !== f.q);

  const understood =
    f.categories.length > 0 ||
    f.minBracket !== null ||
    f.maxBracket !== null ||
    f.condition !== null ||
    f.orgsOnly ||
    f.perishable !== null ||
    f.q !== null;

  return { filters: f, ignored: [...new Set(ignored)], notes, understood };
}

/** The helper's filters as /api/v1/browse filters: brackets become their edges. */
export function toBrowseFilters(f: HelperFilters): BrowseFilters {
  return {
    ...(f.q ? { q: f.q } : {}),
    categories: f.categories,
    condition: f.condition,
    // The bracket's own bounds, exactly as FilterSheet's Apply sends them.
    minLeaves: f.minBracket !== null ? bracketRange(f.minBracket).min : null,
    maxLeaves: f.maxBracket !== null ? bracketRange(f.maxBracket).max : null,
    orgsOnly: f.orgsOnly,
    businessCategories: f.orgsOnly ? f.businessCategories : [],
    perishable: f.perishable,
  };
}

/* ─────────────────────────── chips ─────────────────────────── */

/**
 * One "understood as" chip. `key` identifies what removing it clears; the
 * component turns `kind` + `value` into a label.
 */
export type HelperChip =
  | { key: string; kind: "category"; value: Category }
  | { key: string; kind: "value"; min: Bracket | null; max: Bracket | null }
  | { key: string; kind: "condition"; value: string }
  | { key: string; kind: "shops" }
  | { key: string; kind: "shopType"; value: string }
  | { key: string; kind: "perishable" }
  | { key: string; kind: "q"; value: string };

export function chipsOf(f: HelperFilters): HelperChip[] {
  const chips: HelperChip[] = [];
  for (const c of f.categories) chips.push({ key: `category:${c}`, kind: "category", value: c });
  if (f.q) chips.push({ key: "q", kind: "q", value: f.q });
  if (f.minBracket !== null || f.maxBracket !== null) {
    chips.push({ key: "value", kind: "value", min: f.minBracket, max: f.maxBracket });
  }
  if (f.condition) chips.push({ key: "condition", kind: "condition", value: f.condition });
  // A shop type already says "shops"; a separate "From shops" chip beside it
  // would be removable while the type chip still implied it.
  if (f.orgsOnly && f.businessCategories.length === 0) chips.push({ key: "shops", kind: "shops" });
  for (const b of f.businessCategories) chips.push({ key: `shopType:${b}`, kind: "shopType", value: b });
  if (f.perishable) chips.push({ key: "perishable", kind: "perishable" });
  return chips;
}

/** `f` with one chip's filter removed. */
export function withoutChip(f: HelperFilters, chip: HelperChip): HelperFilters {
  switch (chip.kind) {
    case "category":
      return { ...f, categories: f.categories.filter((c) => c !== chip.value) };
    case "q":
      return { ...f, q: null };
    case "value":
      return { ...f, minBracket: null, maxBracket: null };
    case "condition":
      return { ...f, condition: null };
    case "shops":
      return { ...f, orgsOnly: false, businessCategories: [] };
    case "shopType": {
      const businessCategories = f.businessCategories.filter((b) => b !== chip.value);
      // The last shop type going leaves "from shops" on, shown as its own chip.
      return { ...f, businessCategories };
    }
    case "perishable":
      return { ...f, perishable: null };
  }
}

/** The value chip's words: "Bracket 1 or lower", "Brackets 5 to 6", "Bracket 3 and up". */
export function valueChipLabel(min: Bracket | null, max: Bracket | null): string {
  if (min !== null && max !== null) {
    return min === max ? `Bracket ${min}` : `Brackets ${min} to ${max}`;
  }
  if (max !== null) return max === 1 ? "Bracket 1" : `Bracket ${max} or lower`;
  if (min !== null) return min === BRACKET_COUNT ? `Bracket ${min}` : `Bracket ${min} and up`;
  return "";
}
