/**
 * The password strength hint (Oct 2026), checked without a phone:
 *
 *   node --import tsx scripts/verify-password-strength.ts
 *
 *   1. Weak: under 8, common passwords (with digits/symbols tacked on), one kind
 *      of character under 12, repeats and digit runs.
 *   2. Fair: 8-11 with variety, or 12-15 short on variety.
 *   3. Strong: 12+ with three kinds, or 16+ with two.
 *   4. The message always names the level, and only "weak" mentions a fix
 *      that changes the kind of password rather than its length.
 */
import { passwordStrength } from "../src/lib/password-strength";

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
const level = (pw: string) => passwordStrength(pw).level;

// 1. Weak
for (const pw of ["", "abc", "Ab1!xyz", "password", "Password123!", "baylo2026", "qwertyuiop", "aaaaaaaaaaaa", "12345678", "1234567890", "abcdefghijk"]) {
  eq(`weak: ${JSON.stringify(pw)}`, level(pw), "weak");
}
eq("common names it", passwordStrength("Password1!").message.includes("common"), true);
eq("weak is 1 bar", passwordStrength("abc").bars, 1);

// 2. Fair
eq("fair: 8 with three kinds", level("Mangga7!"), "fair");
eq("fair: 10 letters+digits", level("tindahan42"), "fair");
eq("fair: 12 letters only", level("kalamansijuice"), "fair");
eq("fair, short: says length", passwordStrength("Mangga7!").message, "Fair: make it 12 or more characters.");
eq("fair, long: says variety", passwordStrength("kalamansijuice").message, "Fair: add a number or a symbol.");
eq("fair is 2 bars", passwordStrength("Mangga7!").bars, 2);

// 3. Strong
eq("strong: 12 with three kinds", level("Lapu-Lapu2026"), "strong");
eq("strong: 16 with two kinds", level("bisayang tindahan"), "strong");
eq("strong message", passwordStrength("Lapu-Lapu2026").message, "Strong password.");
eq("strong is 3 bars", passwordStrength("Lapu-Lapu2026").bars, 3);

// 4. Every message leads with its level.
for (const pw of ["abc", "Mangga7!", "Lapu-Lapu2026"]) {
  const s = passwordStrength(pw);
  eq(`message leads with level: ${pw}`, s.message.toLowerCase().startsWith(s.level), true);
}

console.log(failures === 0 ? `verify-password-strength: all ${checks} checks passed` : `verify-password-strength: ${failures} of ${checks} FAILED`);
if (failures > 0) (globalThis as { process?: { exitCode?: number } }).process!.exitCode = 1;
