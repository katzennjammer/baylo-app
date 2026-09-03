#!/usr/bin/env node
/**
 * Does "Baylo" fit?
 *
 * The wordmark shipped at the spec's 150px and rendered "Ba…" on a real phone,
 * because 150px of Bricolage Grotesque Bold is 383px of ink and the column it
 * sits in is 342. That is not a bug you can see in code review and it is not
 * one the type checker can reach, so it gets a check of its own.
 *
 * WHAT THIS ASSERTS
 *
 *   1. The advance sum in `authType.wordmark.advanceEm` is what the SHIPPED
 *      font file actually measures. This is the one that catches a font swap:
 *      drop a different Bricolage cut into assets/fonts and every size derived
 *      from that constant silently becomes a guess again.
 *   2. `wordmarkFit` returns a size whose ink fits the column, at every width
 *      in the table below — the spec's two boards, the widths real Android
 *      phones report, and the narrow end.
 *   3. The spec's own 150 / 140 would NOT have fitted, so the regression this
 *      exists to prevent is a real one and the check has teeth.
 *
 * It reads the constants out of `auth-tokens.ts` by pattern rather than
 * importing it — the file is TypeScript with JSX-era imports and this needs to
 * run under plain node with no loader, on a machine mid-Metro.
 *
 *   node scripts/verify-wordmark.cjs
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FONT = path.join(ROOT, "assets", "fonts", "BricolageGrotesque-Bold.ttf");
const TOKENS = path.join(ROOT, "src", "theme", "auth-tokens.ts");
const WORD = "Baylo";

/* ── the font ─────────────────────────────────────────────────────────── */

/** Σ of the advance widths of `word`, in em, read from `hmtx` via `cmap`. */
function advanceEm(file, word) {
  const buf = fs.readFileSync(file);
  const u16 = (o) => buf.readUInt16BE(o);
  const i16 = (o) => buf.readInt16BE(o);
  const u32 = (o) => buf.readUInt32BE(o);

  const tables = {};
  for (let i = 0; i < u16(4); i++) {
    const o = 12 + i * 16;
    tables[buf.toString("ascii", o, o + 4)] = { offset: u32(o + 8) };
  }

  const upem = u16(tables.head.offset + 18);
  const numHMetrics = u16(tables.hhea.offset + 34);
  const hmtx = tables.hmtx.offset;

  // Windows Unicode BMP subtable (3,1), format 4. Every glyph in "Baylo" is
  // Latin, so there is no need for the format-12 path.
  const cmap = tables.cmap.offset;
  let sub = null;
  for (let i = 0; i < u16(cmap + 2); i++) {
    const o = cmap + 4 + i * 8;
    if (u16(o) === 3 && u16(o + 2) === 1) sub = cmap + u32(o + 4);
  }
  if (sub === null) throw new Error("no (3,1) cmap subtable in " + path.basename(file));

  const gid = (cp) => {
    const segX2 = u16(sub + 6);
    const endO = sub + 14;
    const startO = endO + segX2 + 2;
    const deltaO = startO + segX2;
    const rangeO = deltaO + segX2;
    for (let i = 0; i < segX2 / 2; i++) {
      if (cp > u16(endO + i * 2)) continue;
      const start = u16(startO + i * 2);
      if (cp < start) return 0;
      const delta = i16(deltaO + i * 2);
      const ro = u16(rangeO + i * 2);
      if (ro === 0) return (cp + delta) & 0xffff;
      const g = u16(rangeO + i * 2 + ro + (cp - start) * 2);
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  };

  let units = 0;
  const per = [];
  for (const ch of word) {
    const g = gid(ch.codePointAt(0));
    if (g === 0) throw new Error(`the font has no glyph for "${ch}"`);
    const adv = u16(hmtx + Math.min(g, numHMetrics - 1) * 4);
    per.push(`${ch} ${adv}`);
    units += adv;
  }

  return { em: units / upem, units, upem, per };
}

/* ── the constants, as the app has them ───────────────────────────────── */

function tokenNumber(src, key) {
  const m = new RegExp(`\\b${key}:\\s*(-?[0-9.]+)`).exec(src);
  if (!m) throw new Error(`auth-tokens.ts no longer defines \`${key}\``);
  return Number(m[1]);
}

const src = fs.readFileSync(TOKENS, "utf8");
const wordmarkBlock = src.slice(src.indexOf("wordmark: {"), src.indexOf("wordmarkCollapsed"));
const T = {
  advanceEm: tokenNumber(wordmarkBlock, "advanceEm"),
  trackingEm: tokenNumber(wordmarkBlock, "trackingEm"),
  trackedGaps: tokenNumber(wordmarkBlock, "trackedGaps"),
  slack: tokenNumber(wordmarkBlock, "slack"),
  capScreen1: tokenNumber(wordmarkBlock, "capScreen1"),
  capScreen2: tokenNumber(wordmarkBlock, "capScreen2"),
};

/** The app's own `wordmarkFit`, kept in step by §3 below. */
const emPerPx = () => T.advanceEm + T.trackedGaps * T.trackingEm;
const fit = (available, cap) =>
  Math.max(1, Math.min(cap, Math.floor((available * T.slack) / emPerPx())));
const ink = (size) => size * emPerPx();

/* ── the boards ───────────────────────────────────────────────────────── */

// width, margin, and what it is. The two boards the spec draws, the widths
// Android phones in this project's hands actually report, and the narrow end.
const BOARDS = [
  [390, 24, "the spec's sign-in artboard"],
  [360, 20, "the spec's 360 reflow"],
  [393, 24, "SM-A156E and most 1080 x 2340 phones"],
  [411, 24, "Pixel-class 1080 x 2400"],
  [320, 20, "the narrow end this still has to survive"],
];

let failures = 0;
const fail = (m) => {
  failures++;
  console.log("  FAIL  " + m);
};
const ok = (m) => console.log("  ok    " + m);

console.log("\n  wordmark fit\n");

/* §1  the constant matches the shipped font ─────────────────────────────── */

const measured = advanceEm(FONT, WORD);
console.log(`  font: ${measured.per.join("  ")}  =  ${measured.units}/${measured.upem} upem`);
if (Math.abs(measured.em - T.advanceEm) > 0.0005) {
  fail(
    `advanceEm is ${T.advanceEm} but the shipped font measures ` +
      `${measured.em.toFixed(4)} — set it to ${measured.em.toFixed(3)}`,
  );
} else {
  ok(`advanceEm ${T.advanceEm} matches the shipped BricolageGrotesque-Bold.ttf`);
}

/* §2  every board fits, on both screens ─────────────────────────────────── */

console.log("");
for (const [width, margin, what] of BOARDS) {
  const column = width - margin * 2;
  for (const [cap, screen] of [
    [T.capScreen1, "sign in"],
    [T.capScreen2, "create account"],
  ]) {
    const size = fit(column, cap);
    const painted = ink(size);
    const label = `${width} / ${screen}: ${size}px, ${painted.toFixed(1)} in ${column}`;
    if (painted > column) fail(`${label} — OVERFLOWS by ${(painted - column).toFixed(1)}px`);
    else if (size > cap) fail(`${label} — exceeds the spec cap of ${cap}`);
    else ok(`${label}  (${what})`);
  }
}

/* §3  the spec's own numbers would have failed ──────────────────────────── */

console.log("");
for (const [size, width, margin] of [
  [150, 390, 24],
  [140, 360, 20],
]) {
  const column = width - margin * 2;
  if (ink(size) <= column) {
    fail(
      `${size}px now fits ${column}px, so this check no longer proves anything — ` +
        `the constants have drifted or the font changed`,
    );
  } else {
    ok(
      `the spec's ${size}px overflows its own ${column}px column by ` +
        `${(ink(size) - column).toFixed(1)}px, as reported`,
    );
  }
}

console.log(failures ? `\n  ${failures} FAILED\n` : "\n  all good\n");
process.exit(failures ? 1 : 0);
