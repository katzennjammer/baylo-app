import * as SecureStore from "expo-secure-store";

/**
 * "This account was signed up as an Organization / MSME", remembered ON THIS
 * PHONE (16 Oct 2026).
 *
 * ── WHY ON THE PHONE ────────────────────────────────────────────────────────
 *
 * The account-type choice is never sent to the server: register takes a name,
 * an email, a password and a date of birth, and "Do this later" on the
 * business step creates nothing. So an MSME that skipped Business Details is,
 * to the server, an ordinary person, and Post showed them "Verify your ID" --
 * the individual gate an MSME never goes through. Recording the choice there
 * would need a column, and the schema is frozen until the defense; no existing
 * column or status means "chose MSME, details not sent" (an Organization row
 * needs a name and a business category, and every PENDING one is in the
 * admin queue and the Organizations browse list).
 *
 * What this costs: a reinstall or a second phone forgets it. The individual ID
 * screen therefore also carries "Posting for a business? Register it instead",
 * which is the same door without the memory.
 *
 * Once the person owns a shop this flag is never consulted: the shop's own
 * status decides the Post screen. It is not cleared on sign-out, because it
 * describes the account, not the session, and is keyed by its email.
 */

const PREFIX = "baylo.signupKind.";

/** SecureStore keys allow only [A-Za-z0-9._-]. */
function keyFor(email: string): string {
  return PREFIX + email.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}

export async function rememberSignedUpAsOrganization(email: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(keyFor(email), "organization");
  } catch {
    // Losing it costs the "finish your business verification" wording on Post,
    // and the ID screen's link still leads to the same form.
  }
}

export async function signedUpAsOrganization(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  try {
    return (await SecureStore.getItemAsync(keyFor(email))) === "organization";
  } catch {
    return false;
  }
}
