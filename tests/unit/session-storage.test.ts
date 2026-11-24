import assert from "node:assert/strict";
import { beforeEach } from "node:test";

import { getApiBase, resetApiBase, setApiBase, validateApiBase } from "../../src/api/config";
import { signedUpAsOrganization, rememberSignedUpAsOrganization } from "../../src/auth/signup-kind";
import { clearSession, loadSession, saveSession, saveTokens, type StoredSession } from "../../src/auth/storage";
import { suite } from "../support/case";
import { secureStore } from "../support/net";

const c = suite("Session and Storage");

const SESSION: StoredSession = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  user: { id: "u1", name: "Juan", email: "juan@example.com", image: null },
};

beforeEach(() => secureStore.clear());

c("Session", "No session has been saved", "loadSession returns null", async () => {
  assert.equal(await loadSession(), null);
});
c("Session", "User logs in and the session is saved", "loadSession returns the same tokens and user", async () => {
  await saveSession(SESSION);
  assert.deepEqual(await loadSession(), SESSION);
});
c("Session", "Token refresh saves a new token pair", "Tokens change, stored user is kept", async () => {
  await saveSession(SESSION);
  await saveTokens({ accessToken: "access-2", refreshToken: "refresh-2" });
  assert.deepEqual(await loadSession(), { ...SESSION, accessToken: "access-2", refreshToken: "refresh-2" });
});
c("Session", "User logs out", "Stored session is cleared and loadSession returns null", async () => {
  await saveSession(SESSION);
  await clearSession();
  assert.equal(await loadSession(), null);
});
c("Session", "Stored refresh token is missing", "Session is treated as signed out", async () => {
  await saveSession(SESSION);
  secureStore.delete("baylo.refreshToken");
  assert.equal(await loadSession(), null);
});
c("Session", "Stored user record is corrupted JSON", "Session is treated as signed out, no crash", async () => {
  await saveSession(SESSION);
  secureStore.set("baylo.user", "{not json");
  assert.equal(await loadSession(), null);
});

c("Account Type", "MSME owner signs up with an email", "Email is remembered as an organization signup", async () => {
  await rememberSignedUpAsOrganization("Shop@Example.com");
  assert.equal(await signedUpAsOrganization("shop@example.com"), true);
});
c("Account Type", "Email is checked with different case and spaces", "Lookup still matches", async () => {
  await rememberSignedUpAsOrganization("shop@example.com");
  assert.equal(await signedUpAsOrganization("  SHOP@example.com "), true);
});
c("Account Type", "Individual user email is checked", "Not reported as an organization", async () => {
  assert.equal(await signedUpAsOrganization("juan@example.com"), false);
});
c("Account Type", "Email is null or empty", "Not reported as an organization", async () => {
  assert.equal(await signedUpAsOrganization(null), false);
  assert.equal(await signedUpAsOrganization(""), false);
});

c("API Address", "Developer enters a valid http URL", "No validation problem is reported", () => {
  assert.equal(validateApiBase("http://192.168.1.10:3000"), null);
});
c("API Address", "Developer enters an empty URL", "A message asks for a URL", () => {
  assert.match(validateApiBase("   ") ?? "", /Enter a URL/);
});
c("API Address", "Developer enters text that is not a URL", "A 'not a URL' message is shown", () => {
  assert.match(validateApiBase("not a url") ?? "", /not a URL/);
});
c("API Address", "Developer enters an ftp:// URL", "Only http and https are accepted", () => {
  assert.match(validateApiBase("ftp://host.test") ?? "", /Only http/);
});
c("API Address", "Developer saves a URL with trailing slashes", "Slashes are removed so requests never contain //api", async () => {
  await setApiBase("http://api.test///");
  assert.equal(getApiBase(), "http://api.test");
  await resetApiBase();
});
c("API Address", "Developer saves an invalid URL", "setApiBase rejects and keeps the current address", async () => {
  await setApiBase("http://api.test");
  await assert.rejects(setApiBase("nope"));
  assert.equal(getApiBase(), "http://api.test");
  await resetApiBase();
});
c("API Address", "Developer resets the address", "The saved override is deleted from storage", async () => {
  await setApiBase("http://api.test");
  await resetApiBase();
  assert.equal(secureStore.has("baylo.apiBaseUrl"), false);
});
