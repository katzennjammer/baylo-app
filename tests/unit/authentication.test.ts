import assert from "node:assert/strict";
import { beforeEach } from "node:test";

import { ApiError, registerAccount, requestPasswordReset, signIn } from "../../src/api/client";
import { setApiBase } from "../../src/api/config";
import { INDIVIDUAL_COPY, OWNER_COPY, canSubmitLogin, validate, type FormState } from "../../src/auth/form-validation";
import { ageOn, clampDay, daysInMonth, defaultDobParts, isAdult, isRealPastDate, isoDate, todayParts } from "../../src/lib/dob";
import { suspensionFrom } from "../../src/lib/suspension";
import { mockFetch, secureStore } from "../support/net";
import { suite } from "../support/case";

const c = suite("Authentication");

const VALID: FormState = {
  name: "Juan Dela Cruz",
  email: "juan@example.com",
  password: "hunter2hunter2",
  confirm: "hunter2hunter2",
  dob: { year: 1995, month: 5, day: 15 },
};
const form = (over: Partial<FormState>): FormState => ({ ...VALID, ...over });
const errorsFor = (over: Partial<FormState>) => validate(form(over), INDIVIDUAL_COPY);

beforeEach(async () => {
  secureStore.clear();
  await setApiBase("http://api.test");
});

// ── Register: the form's own checks ─────────────────────────────────────────
c("Register", "User inputs an invalid email format", "Account will not be successfully registered", () => {
  assert.equal(errorsFor({ email: "juan@@example" }).email, "That does not look like an email address.");
});
c("Register", "User inputs an email with no domain dot (juan@example)", "Account will not be successfully registered", () => {
  assert.equal(errorsFor({ email: "juan@example" }).email, "That does not look like an email address.");
});
c("Register", "User inputs missing email", "Account will not be successfully registered", () => {
  assert.equal(errorsFor({ email: "" }).email, "Enter your email.");
});
c("Register", "User inputs an email made only of spaces", "Account will not be successfully registered", () => {
  assert.equal(errorsFor({ email: "   " }).email, "Enter your email.");
});
c("Register", "User inputs missing name", "Account will not be successfully registered", () => {
  assert.equal(errorsFor({ name: "" }).name, INDIVIDUAL_COPY.nameMissing);
});
c("Register", "User inputs a name made only of spaces", "Account will not be successfully registered", () => {
  assert.equal(errorsFor({ name: "    " }).name, INDIVIDUAL_COPY.nameMissing);
});
c("Register", "User inputs a name longer than 100 characters", "Account will not be successfully registered", () => {
  assert.equal(errorsFor({ name: "A".repeat(101) }).name, "That name is too long (100 max).");
});
c("Register", "User inputs a name of exactly 100 characters", "Name is accepted", () => {
  assert.equal(errorsFor({ name: "A".repeat(100) }).name, undefined);
});
c("Register", "User inputs a password shorter than 8 characters", "Account will not be successfully registered", () => {
  assert.equal(errorsFor({ password: "short12", confirm: "short12" }).password, "At least 8 characters.");
});
c("Register", "User inputs a password of exactly 8 characters", "Password is accepted", () => {
  assert.equal(errorsFor({ password: "abcdefgh", confirm: "abcdefgh" }).password, undefined);
});
c("Register", "User leaves confirm password empty", "Account will not be successfully registered", () => {
  assert.equal(errorsFor({ confirm: "" }).confirm, "Type your password again.");
});
c("Register", "User inputs a confirm password that does not match", "Account will not be successfully registered", () => {
  assert.equal(errorsFor({ confirm: "different-password" }).confirm, "These don't match yet.");
});
c("Register", "User does not pick a date of birth", "Account will not be successfully registered", () => {
  assert.equal(errorsFor({ dob: null }).dateOfBirth, INDIVIDUAL_COPY.dobMissing);
});
c("Register", "MSME owner leaves the name empty", "Owner-specific message is shown and registration is blocked", () => {
  assert.equal(validate(form({ name: "" }), OWNER_COPY).name, "Enter the owner's name.");
});
c("Register", "User leaves every field empty", "Every field reports an error", () => {
  const e = validate({ name: "", email: "", password: "", confirm: "", dob: null }, INDIVIDUAL_COPY);
  assert.deepEqual(Object.keys(e).sort(), ["confirm", "dateOfBirth", "email", "name", "password"]);
});
c("Register", "User enters all valid credentials", "No errors, account details are sent for registration", () => {
  assert.deepEqual(validate(VALID, INDIVIDUAL_COPY), {});
});
c("Register", "User enters a valid email surrounded by spaces", "Email is accepted after trimming", () => {
  assert.equal(errorsFor({ email: "  juan@example.com  " }).email, undefined);
});

// ── Register: how the client handles the server's answers ───────────────────
const NEW_ACCOUNT = { name: "Juan Dela Cruz", email: "juan@example.com", password: "hunter2hunter2", dateOfBirth: "1995-05-15" };

c("Register", "Server rejects the email with a field-level validation error (400)", "ApiError carries the field issue; account is not registered", async () => {
  mockFetch(() => ({ status: 400, body: { error: "Invalid input", issues: [{ field: "email", message: "Invalid email" }] } }));
  await assert.rejects(registerAccount(NEW_ACCOUNT), (e: ApiError) => {
    assert.equal(e.status, 400);
    assert.deepEqual(e.issues, [{ field: "email", message: "Invalid email" }]);
    return true;
  });
});
c("Register", "Email is already registered (409)", "ApiError 409 is raised; no duplicate account", async () => {
  mockFetch(() => ({ status: 409, body: { error: "Email already registered", code: "CONFLICT" } }));
  await assert.rejects(registerAccount(NEW_ACCOUNT), (e: ApiError) => e.status === 409 && e.code === "CONFLICT");
});
c("Register", "User under 18 submits a date of birth", "Server refusal UNDER_18 is surfaced; account is not registered", async () => {
  mockFetch(() => ({ status: 400, body: { error: "You must be 18", code: "UNDER_18" } }));
  await assert.rejects(registerAccount({ ...NEW_ACCOUNT, dateOfBirth: "2015-01-01" }), (e: ApiError) => e.code === "UNDER_18");
});
c("Register", "Too many sign-ups from one address (429 with Retry-After)", "ApiError reports RATE_LIMITED and the wait in seconds", async () => {
  mockFetch(() => ({ status: 429, body: { error: "Slow down" }, headers: { "Retry-After": "120" } }));
  await assert.rejects(registerAccount(NEW_ACCOUNT), (e: ApiError) => e.code === "RATE_LIMITED" && e.retryAfter === 120);
});
c("Register", "Server cannot be reached", "A network ApiError is raised instead of an unhandled crash", async () => {
  mockFetch(() => new TypeError("Network request failed"));
  await assert.rejects(registerAccount(NEW_ACCOUNT), (e: unknown) => e instanceof ApiError && e.status === 0);
});
c("Register", "Server answers 200 but leaves out required fields", "MALFORMED_RESPONSE is raised, not a half-built account", async () => {
  mockFetch(() => ({ body: { id: "u1" } }));
  await assert.rejects(registerAccount(NEW_ACCOUNT), (e: ApiError) => e.code === "MALFORMED_RESPONSE");
});
c("Register", "User enters all valid credentials and the server accepts them", "Account details are posted to /api/auth/register and the new account is returned", async () => {
  const calls = mockFetch(() => ({
    body: { id: "u1", name: "Juan Dela Cruz", email: "juan@example.com", isVerified: false, verificationEmailSent: true },
  }));
  const res = await registerAccount(NEW_ACCOUNT);
  assert.equal(res.id, "u1");
  assert.equal(calls[0].url, "http://api.test/api/auth/register");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].body, NEW_ACCOUNT);
});

// ── Login ───────────────────────────────────────────────────────────────────
c("Login", "User input empty fields", "Account will not be successfully logged in", () => {
  assert.equal(canSubmitLogin("", ""), false);
});
c("Login", "User inputs email only", "Account will not be successfully logged in", () => {
  assert.equal(canSubmitLogin("juan@example.com", ""), false);
});
c("Login", "User inputs password only", "Account will not be successfully logged in", () => {
  assert.equal(canSubmitLogin("", "secret"), false);
});
c("Login", "User inputs an email made only of spaces", "Account will not be successfully logged in", () => {
  assert.equal(canSubmitLogin("   ", "secret"), false);
});
c("Login", "User inputs both email and password", "Log in button is enabled", () => {
  assert.equal(canSubmitLogin("juan@example.com", "secret"), true);
});
c("Login", "User inputs a wrong password (401)", "The server's vague 'Invalid email or password' is shown unchanged", async () => {
  mockFetch(() => ({ status: 401, body: { error: "Invalid email or password" } }));
  await assert.rejects(signIn("juan@example.com", "wrong"), (e: ApiError) => e.status === 401 && e.message === "Invalid email or password");
  assert.equal(secureStore.has("baylo.accessToken"), false);
});
c("Login", "User inputs valid credentials", "Session is returned and saved to secure storage", async () => {
  const calls = mockFetch(() => ({
    body: { accessToken: "AT", refreshToken: "RT", user: { id: "u1", name: "Juan", email: "juan@example.com", image: null } },
  }));
  const s = await signIn("juan@example.com", "hunter2hunter2");
  assert.equal(s.accessToken, "AT");
  assert.equal(calls[0].url, "http://api.test/api/auth/token");
  assert.equal(secureStore.get("baylo.accessToken"), "AT");
  assert.equal(secureStore.get("baylo.refreshToken"), "RT");
});
c("Login", "Server answers 200 without tokens", "MALFORMED_RESPONSE is raised and nothing is saved", async () => {
  mockFetch(() => ({ body: { user: { id: "u1" } } }));
  await assert.rejects(signIn("juan@example.com", "x"), (e: ApiError) => e.code === "MALFORMED_RESPONSE");
  assert.equal(secureStore.has("baylo.accessToken"), false);
});
c("Login", "Suspended account signs in (403 ACCOUNT_SUSPENDED)", "Sign-in is refused and the suspension notice is readable", async () => {
  mockFetch(() => ({ status: 403, body: { error: "Suspended", code: "ACCOUNT_SUSPENDED", reason: "Spam", level: 1 } }));
  await assert.rejects(signIn("juan@example.com", "x"), (e: unknown) => {
    const n = suspensionFrom(e);
    return n !== null && n.reason === "Spam" && n.level === 1;
  });
  assert.equal(secureStore.has("baylo.accessToken"), false);
});
c("Login", "User requests a password reset", "Request is posted to /api/auth/forgot-password", async () => {
  const calls = mockFetch(() => ({ body: { ok: true } }));
  await requestPasswordReset("juan@example.com");
  assert.equal(calls[0].url, "http://api.test/api/auth/forgot-password");
  assert.deepEqual(calls[0].body, { email: "juan@example.com" });
});

// ── Date of birth (age rule) ────────────────────────────────────────────────
c("Date of Birth", "User turns 18 today", "Counted as 18 and allowed", () => {
  assert.equal(ageOn({ year: 2008, month: 6, day: 10 }, { year: 2026, month: 6, day: 10 }), 18);
});
c("Date of Birth", "User turns 18 tomorrow", "Counted as 17 and refused", () => {
  assert.equal(ageOn({ year: 2008, month: 6, day: 11 }, { year: 2026, month: 6, day: 10 }), 17);
});
c("Date of Birth", "User is 17 years old", "isAdult is false", () => {
  const t = todayParts();
  assert.equal(isAdult({ year: t.year - 17, month: t.month, day: t.day }), false);
});
c("Date of Birth", "User is exactly 18 years old", "isAdult is true", () => {
  assert.equal(isAdult(defaultDobParts()), true);
});
c("Date of Birth", "User picks a date in the future", "Date is not a real past date", () => {
  const t = todayParts();
  assert.equal(isRealPastDate({ year: t.year + 1, month: 1, day: 1 }), false);
});
c("Date of Birth", "User picks 31 February", "Date is not a real past date", () => {
  assert.equal(isRealPastDate({ year: 1990, month: 2, day: 31 }), false);
});
c("Date of Birth", "User picks month 13", "Date is not a real past date", () => {
  assert.equal(isRealPastDate({ year: 1990, month: 13, day: 1 }), false);
});
c("Date of Birth", "User picks a year more than 110 years ago", "Date is not a real past date", () => {
  assert.equal(isRealPastDate({ year: todayParts().year - 111, month: 1, day: 1 }), false);
});
c("Date of Birth", "User picks 15 May 1995", "Date is a real past date", () => {
  assert.equal(isRealPastDate({ year: 1995, month: 5, day: 15 }), true);
});
c("Date of Birth", "User changes the month from March 31 to February", "Day is clamped to the last day of February", () => {
  assert.deepEqual(clampDay({ year: 2023, month: 2, day: 31 }), { year: 2023, month: 2, day: 28 });
  assert.deepEqual(clampDay({ year: 2024, month: 2, day: 31 }), { year: 2024, month: 2, day: 29 });
});
c("Date of Birth", "Leap-year check for February", "2024 has 29 days, 2023 and 1900 have 28", () => {
  assert.deepEqual([daysInMonth(2024, 2), daysInMonth(2023, 2), daysInMonth(1900, 2)], [29, 28, 28]);
});
c("Date of Birth", "Date of birth is sent to the server", "Formatted as zero-padded YYYY-MM-DD", () => {
  assert.equal(isoDate({ year: 2001, month: 3, day: 7 }), "2001-03-07");
});
