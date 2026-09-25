import type { Category } from "../api/post";

/**
 * Step 5's free text, read for categories — deterministic, no model.
 *
 * "A bag, shoes, something for the kitchen…" says Bags, Fashion and Home &
 * Garden as plainly as tapping three chips would, and until now only the chips
 * reached the matcher. This reads the text against a fixed keyword table and
 * adds what it finds to the SAME `lookingForCategories` the chips fill. Same
 * field, same server matcher, nothing new on the wire.
 *
 * ── NO AI, ON PURPOSE ───────────────────────────────────────────────────────
 *
 * The matcher downstream decides who gets a notification. A table can be read,
 * diffed and argued with; a model's reading of "something for my dog" cannot,
 * and it would answer differently next week. Every word below is a decision
 * someone can point at.
 *
 * ── WHOLE WORDS ONLY ────────────────────────────────────────────────────────
 *
 * The text is lowercased, stripped of accents and punctuation, and matched on
 * word boundaries — so "art" does not fire inside "party", "pet" inside
 * "carpet", or "bag" inside "cabbage". A trailing "s"/"es" is allowed, so
 * "shoe" and "shoes", "dress" and "dresses" are one entry.
 *
 * ── LONGER PHRASES WIN, AND CONSUME THEIR WORDS ─────────────────────────────
 *
 * "rice cooker" is kitchenware, not Food; "dog food" is Pets, not Food. Phrases
 * are tried longest first and blank out the words they matched, so the shorter
 * keyword inside them ("rice", "food") cannot fire a second, wrong category.
 *
 * ── WHAT IS LEFT OUT, AND WHY ───────────────────────────────────────────────
 *
 * Words that genuinely mean two categories are omitted, not guessed: "mouse"
 * (pet or computer), "keyboard" (piano or computer), "case" (phone or
 * pencil), "fish" (pet or dinner), "switch" alone (console or light switch —
 * "nintendo switch" is in). A missed match costs one notification; a wrong one
 * spends one of six slots on something the poster did not ask for.
 *
 * Negation is not read: "no shoes please" matches Fashion. Rare in a field
 * that asks what you WANT, and the chips remain the precise instrument.
 *
 * A few Filipino words are included where they are the everyday word for the
 * thing (damit, sapatos, libro, pagkain) — first pass, not exhaustive.
 */
export const WANTED_KEYWORDS: Record<Category, readonly string[]> = {
  ELECTRONICS: [
    "phone", "iphone", "android phone", "smartphone", "cellphone", "cp", "laptop", "computer",
    "pc", "tablet", "ipad", "headphone", "headset", "earbud", "earphone", "airpods", "camera",
    "charger", "power bank", "powerbank", "speaker", "bluetooth speaker", "tv", "television",
    "monitor", "smartwatch", "gadget", "electronics", "router", "printer",
  ],
  CLOTHING: [
    "clothes", "clothing", "shoe", "sneaker", "shirt", "tshirt", "blouse", "dress", "jeans",
    "pants", "shorts", "skirt", "jacket", "hoodie", "sweater", "uniform", "heels", "sandal",
    "slipper", "boots", "fashion", "outfit", "damit", "sapatos", "tsinelas",
  ],
  BAGS: [
    "bag", "backpack", "handbag", "purse", "tote", "luggage", "suitcase", "duffel", "pouch",
  ],
  BEAUTY: [
    "makeup", "make up", "cosmetic", "skincare", "skin care", "perfume", "fragrance",
    "lipstick", "lotion", "shampoo", "nail polish", "beauty", "serum", "sunscreen",
  ],
  ACCESSORIES: [
    "watch", "jewelry", "jewellery", "necklace", "bracelet", "earring", "sunglasses", "wallet",
    "belt", "hat", "scarf", "phone case", "accessories", "accessory", "hair clip",
  ],
  FURNITURE: [
    "kitchen", "kitchenware", "cookware", "utensil", "plate", "mug", "pan", "rice cooker",
    "furniture", "chair", "table", "sofa", "couch", "bed", "mattress", "cabinet", "shelf",
    "lamp", "decor", "home decor", "curtain", "pillow", "blanket", "bedsheet", "appliance",
    "electric fan", "blender", "oven", "microwave", "refrigerator", "ref", "garden",
    "gardening", "kusina",
  ],
  BOOKS: [
    "book", "novel", "textbook", "comic", "manga", "magazine", "dvd", "vinyl", "reviewer",
    "libro",
  ],
  GAMING: [
    "game", "video game", "gaming", "console", "playstation", "ps4", "ps5", "xbox", "nintendo",
    "nintendo switch", "controller", "board game",
  ],
  SPORTS: [
    "sports", "basketball", "football", "soccer", "volleyball", "badminton", "tennis",
    "racket", "yoga mat", "dumbbell", "gym", "fitness", "treadmill", "skateboard", "jersey",
    "swimming", "goggles",
  ],
  BIKES: [
    "bike", "bicycle", "mtb", "mountain bike", "road bike", "bike parts", "bisikleta",
  ],
  TOYS: [
    "toy", "lego", "doll", "plushie", "stuffed toy", "stroller", "baby", "kids", "children",
    "laruan",
  ],
  TOOLS: [
    "tool", "power tool", "drill", "hammer", "screwdriver", "wrench", "pliers", "ladder",
    "toolbox", "diy",
  ],
  MUSIC: [
    "guitar", "ukulele", "piano", "drum", "violin", "microphone", "amplifier", "amp",
    "instrument", "musical instrument", "music",
  ],
  ART: [
    "art", "art supplies", "painting", "paint", "canvas", "sketchbook", "crafts", "craft",
    "yarn", "sewing", "fabric", "colored pencil", "watercolor", "calligraphy",
  ],
  COLLECTIBLES: [
    "collectible", "collection", "figurine", "action figure", "funko", "coin", "stamp",
    "trading card", "pokemon card", "antique", "memorabilia",
  ],
  PETS: [
    "pet", "dog", "cat", "puppy", "kitten", "pet food", "dog food", "cat food", "leash",
    "collar", "aquarium", "pet cage", "litter", "pet supplies",
  ],
  PLANTS: [
    "plant", "succulent", "cactus", "orchid", "seed", "seedling", "herb", "halaman",
  ],
  FOOD: [
    "food", "snack", "rice", "fruit", "vegetable", "veggies", "coffee", "baked goods",
    "bread", "pastry", "pastries", "meat", "egg", "canned goods", "ulam", "pagkain",
  ],
  SERVICES: [
    "service", "tutoring", "tutor", "lesson", "haircut", "cleaning", "repair", "laundry",
    // Not "delivery": in this field it is as often logistics ("no delivery,
    // meetup only") as a service anyone wants.
    "massage", "babysitting", "photography",
  ],
  OTHER: ["misc", "miscellaneous"],
};

/** Lowercase, accents off, every non-alphanumeric run to one space, padded. */
function normalise(text: string): string {
  const flat = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return ` ${flat} `;
}

/** Every keyword once, normalised, longest phrase first. Built once at import. */
const TABLE: readonly { phrase: string; category: Category }[] = (
  Object.entries(WANTED_KEYWORDS) as [Category, readonly string[]][]
)
  .flatMap(([category, words]) =>
    words.map((w) => ({ phrase: normalise(w).trim(), category })),
  )
  .sort(
    (a, b) =>
      b.phrase.split(" ").length - a.phrase.split(" ").length || b.phrase.length - a.phrase.length,
  );

/**
 * The categories the free text names, in the order they first appear in it.
 *
 * Order is by POSITION IN THE TEXT, not table order, because when the six-slot
 * cap binds (see `mergeLookingFor`) the thing the poster wrote first is the
 * thing most likely to be what they meant.
 */
export function categoriesFromWanted(text: string): Category[] {
  let rest = normalise(text);
  if (rest.trim() === "") return [];

  const hits: { at: number; category: Category }[] = [];
  for (const { phrase, category } of TABLE) {
    for (const form of [phrase, `${phrase}s`, `${phrase}es`]) {
      const needle = ` ${form} `;
      let at = rest.indexOf(needle);
      while (at !== -1) {
        hits.push({ at, category });
        // Blank the words out, keeping length so later positions stay true.
        rest = rest.slice(0, at + 1) + " ".repeat(form.length) + rest.slice(at + 1 + form.length);
        at = rest.indexOf(needle);
      }
    }
  }

  const out: Category[] = [];
  for (const h of hits.sort((a, b) => a.at - b.at)) {
    if (!out.includes(h.category)) out.push(h.category);
  }
  return out;
}

/**
 * The chips, then whatever the text adds — deduplicated, and within `max`.
 *
 * TAPPED CHIPS COME FIRST AND ARE NEVER DISPLACED. A tap is an explicit answer;
 * a keyword is an inference from prose. The server refuses more than six
 * (`MAX_LOOKING_FOR` in validation.ts, mirrored as `rules.maxReturnCategories`),
 * so an inferred category only takes a slot the chips left empty — a naive
 * union would turn a valid post into a 400 at the last step of the wizard.
 */
export function mergeLookingFor(
  chips: readonly Category[],
  wanted: string,
  max: number,
): Category[] {
  const out: Category[] = [];
  for (const c of [...chips, ...categoriesFromWanted(wanted)]) {
    if (out.length >= max) break;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

/**
 * The listing's categories after its free text is edited.
 *
 * The stored list is ONE array — chips and keyword matches merged at post time,
 * with no record of which was which — and the edit sheet has no chips. So the
 * chips are recovered by subtraction: whatever the stored list holds that the
 * OLD text does not name was tapped, and is kept; whatever the old text named
 * is re-derived from the NEW text, then merged exactly as at post time.
 *
 * THE ONE AMBIGUITY, AND WHICH WAY IT FALLS: a category that was both tapped
 * and named in the old text ("Bags" chip, "a bag" typed) is indistinguishable
 * from a keyword match, so if the new text stops naming it, it goes. That is
 * the right side to err on — the bug being fixed is a listing matched forever
 * against a want its owner has since rewritten.
 */
export function relookingFor(
  stored: readonly string[],
  oldWanted: string,
  newWanted: string,
  max: number,
): Category[] {
  const fromOldText = new Set<string>(categoriesFromWanted(oldWanted));
  const chips = stored.filter((c) => !fromOldText.has(c)) as Category[];
  return mergeLookingFor(chips, newWanted, max);
}
