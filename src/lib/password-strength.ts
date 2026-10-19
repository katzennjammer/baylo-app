/**
 * How strong a new password looks, for the hint under the field on Register
 * and Change password.
 *
 * A RECOMMENDATION, NEVER A RULE. The server's only rule is 8 to 200
 * characters (passwordSchema in baylo-api), and the demo accounts depend on
 * that staying true, so nothing here blocks a submit. It nudges toward length
 * and variety, which is what actually makes a password hard to guess.
 *
 * Deliberately small: no dictionary beyond the handful of passwords people
 * really type first. Length counts most, then how many kinds of character.
 */

export type StrengthLevel = "weak" | "fair" | "strong";

export interface PasswordStrength {
  level: StrengthLevel;
  /** Filled bars out of 3. */
  bars: 1 | 2 | 3;
  /** One short line: the level, then the single most useful next step. */
  message: string;
}

/** Lowercased, compared after stripping digits and symbols at the ends. */
const COMMON = new Set([
  "password", "passw0rd", "qwerty", "qwertyuiop", "letmein", "welcome", "iloveyou",
  "admin", "abc123", "baylo", "monkey", "dragon", "sunshine", "princess", "football",
]);

function kinds(pw: string): number {
  return [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
}

function isCommon(pw: string): boolean {
  const core = pw.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, "");
  return COMMON.has(core) || /^(.)\1+$/.test(pw) || /^(0123456789|1234567890|12345678\d*)$/.test(pw);
}

export function passwordStrength(pw: string): PasswordStrength {
  const k = kinds(pw);

  if (pw.length < 8 || isCommon(pw) || (k === 1 && pw.length < 12)) {
    return {
      level: "weak",
      bars: 1,
      message: isCommon(pw)
        ? "Weak: this is a common password. Try a phrase only you would use."
        : "Weak: try 12 or more characters with letters, numbers and a symbol.",
    };
  }

  if ((pw.length >= 12 && k >= 3) || (pw.length >= 16 && k >= 2)) {
    return { level: "strong", bars: 3, message: "Strong password." };
  }

  return {
    level: "fair",
    bars: 2,
    message: pw.length < 12 ? "Fair: make it 12 or more characters." : "Fair: add a number or a symbol.",
  };
}
