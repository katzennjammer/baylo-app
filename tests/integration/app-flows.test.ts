import assert from "node:assert/strict";
import { beforeEach } from "node:test";

import { ApiError, currentSession, onSessionChange, registerAccount, request, signIn, signOut } from "../../src/api/client";
import { getApiBase, resetApiBase, setApiBase } from "../../src/api/config";
import { loadSession } from "../../src/auth/storage";
import { distanceKm } from "../../src/lib/hub-distance";
import { bracketOf } from "../../src/lib/brackets";
import { marketplaceWithFilters, parseMarketplaceFilters } from "../../src/lib/marketplace-link";
import { groupHubs, meetupGap } from "../../src/lib/meetup-when";
import { displayedBridgeFee } from "../../src/lib/premium";
import { suspensionFrom } from "../../src/lib/suspension";
import { offerTerms } from "../../src/lib/trade-rules";
import { matchSearch, toBrowseFilters } from "../../src/search-helper/match";
import { integration as it } from "../support/case";
import { mockFetch, secureStore } from "../support/net";

const USER = { id: "u1", name: "Juan Dela Cruz", email: "juan@example.com", image: null };
const TOKENS = { accessToken: "AT-1", refreshToken: "RT-1", user: USER };

beforeEach(async () => {
  await signOut({ revoke: false });
  secureStore.clear();
  await setApiBase("http://api.test");
});

it("Register Process", "Test integration when a new user registers and then signs in with the same credentials", "Login Process",
  "User is not registered yet and enters a valid name, email, password and date of birth",
  "Verify the account is created, then the same email and password are used to sign in and a session is returned",
  async () => {
    const calls = mockFetch((s) =>
      s.url.endsWith("/api/auth/register")
        ? { body: { id: "u1", name: USER.name, email: USER.email, isVerified: false, verificationEmailSent: true } }
        : { body: TOKENS },
    );
    await registerAccount({ name: USER.name, email: USER.email, password: "hunter2hunter2", dateOfBirth: "1995-05-15" });
    const session = await signIn(USER.email, "hunter2hunter2");
    assert.equal(session.user.email, USER.email);
    assert.deepEqual(calls.map((c) => c.url), ["http://api.test/api/auth/register", "http://api.test/api/auth/token"]);
    assert.deepEqual((calls[1].body as { email: string }).email, (calls[0].body as { email: string }).email);
  });

it("Login Process", "Test integration when a user signs in, the session is kept in secure storage", "Session Storage",
  "User is signed out and enters correct credentials",
  "Verify the session is held in memory and can be loaded back from secure storage after an app restart",
  async () => {
    mockFetch(() => ({ body: TOKENS }));
    await signIn(USER.email, "hunter2hunter2");
    assert.equal(currentSession()?.accessToken, "AT-1");
    assert.deepEqual(await loadSession(), TOKENS);
  });

it("Login Process", "Test integration when a user signs in and out, the screens that watch the session are told", "Session Listener",
  "A screen has subscribed to session changes",
  "Verify the listener receives the session on sign-in and null on sign-out",
  async () => {
    const seen: (string | null)[] = [];
    const off = onSessionChange((s) => seen.push(s?.accessToken ?? null));
    mockFetch(() => ({ body: TOKENS }));
    await signIn(USER.email, "hunter2hunter2");
    await signOut({ revoke: false });
    off();
    assert.deepEqual(seen, ["AT-1", null]);
  });

it("Login Process", "Test integration when a suspended user tries to sign in, the suspension notice is built from the server's refusal", "Suspension Notice",
  "User's account is suspended with a reason and level",
  "Verify no session is saved and the suspension screen receives the reason and level",
  async () => {
    mockFetch(() => ({ status: 403, body: { error: "Suspended", code: "ACCOUNT_SUSPENDED", reason: "Spam listings", level: 2 } }));
    let caught: unknown;
    await signIn(USER.email, "x").catch((e) => (caught = e));
    assert.ok(caught instanceof ApiError);
    assert.deepEqual([suspensionFrom(caught)?.reason, suspensionFrom(caught)?.level], ["Spam listings", 2]);
    assert.equal(currentSession(), null);
    assert.equal(await loadSession(), null);
  });

it("API Client", "Test integration when an access token has expired during a request, the client refreshes it and retries", "Session Storage",
  "User is signed in and the server rejects the old access token with 401",
  "Verify the request is retried with the new token and the new token pair is saved to secure storage",
  async () => {
    mockFetch(() => ({ body: TOKENS }));
    await signIn(USER.email, "x");
    const bearers: string[] = [];
    mockFetch((s) => {
      if (s.url.endsWith("/api/auth/refresh")) return { body: { accessToken: "AT-2", refreshToken: "RT-2", user: USER } };
      return { status: bearers.push(String((s as unknown as { auth?: string }).auth)) === 1 ? 401 : 200, body: {} };
    });
    const res = await request("/api/v1/home");
    assert.equal(res.status, 200);
    assert.equal(currentSession()?.accessToken, "AT-2");
    assert.equal(secureStore.get("baylo.accessToken"), "AT-2");
    assert.equal(secureStore.get("baylo.refreshToken"), "RT-2");
  });

it("API Client", "Test integration when the refresh token is rejected, the user is signed out everywhere", "Session Storage",
  "User is signed in and both the access token and the refresh token are no longer valid",
  "Verify the 401 is handed back, memory is cleared and secure storage no longer holds a session",
  async () => {
    mockFetch(() => ({ body: TOKENS }));
    await signIn(USER.email, "x");
    mockFetch((s) => (s.url.endsWith("/api/auth/refresh") ? { status: 401, body: { error: "Invalid" } } : { status: 401, body: {} }));
    const res = await request("/api/v1/home");
    assert.equal(res.status, 401);
    assert.equal(currentSession(), null);
    assert.equal(await loadSession(), null);
  });

it("Logout Process", "Test integration when a user logs out, the server is told to revoke the sign-in", "Session Storage",
  "User is signed in",
  "Verify a revoke request is sent with the refresh token and the saved session is cleared",
  async () => {
    mockFetch(() => ({ body: TOKENS }));
    await signIn(USER.email, "x");
    const calls = mockFetch(() => ({ body: { ok: true } }));
    await signOut();
    assert.equal(calls[0].url, "http://api.test/api/auth/revoke");
    assert.equal((calls[0].body as { refreshToken: string }).refreshToken, "RT-1");
    assert.equal(await loadSession(), null);
  });

it("API Address Setting", "Test integration when the developer changes the API address, later requests use it", "API Client",
  "App is pointed at http://api.test",
  "Verify requests go to the new host after the change and the setting is kept in secure storage",
  async () => {
    const calls = mockFetch(() => ({ body: {} }));
    await setApiBase("http://other.test/");
    await request("/api/v1/home");
    assert.equal(getApiBase(), "http://other.test");
    assert.equal(calls[0].url, "http://other.test/api/v1/home");
    assert.equal(secureStore.get("baylo.apiBaseUrl"), "http://other.test");
    await resetApiBase();
  });

it("Search Helper", "Test integration when a user types a search and the Marketplace opens with the suggested filters", "Marketplace Filters",
  "User types 'cheap secondhand iphone' in the search helper",
  "Verify the filters handed to the Marketplace screen are read back as the same category and price limit",
  () => {
    const browse = toBrowseFilters(matchSearch("cheap secondhand iphone").filters);
    const parsed = parseMarketplaceFilters(marketplaceWithFilters(browse).params.filters);
    assert.deepEqual(parsed?.categories, ["ELECTRONICS"]);
    assert.equal(parsed?.maxLeaves, browse.maxLeaves);
  });

it("Item Values", "Test integration when two items are in neighbouring value brackets, the offer rules price the bridge", "Offer Rules",
  "User offers a 450-Leaf item for a 520-Leaf item",
  "Verify the items fall in Brackets 3 and 4, the offer is a bridge-up and the proposer owes 30 Leaves",
  () => {
    const t = offerTerms(bracketOf(450), bracketOf(520));
    assert.deepEqual([bracketOf(450), bracketOf(520)], [3, 4]);
    assert.deepEqual([t.legality, t.payer, t.fee], ["bridgeUp", "proposer", 30]);
  });

it("Offer Rules", "Test integration when a Premium user sees the bridging fee for the same offer", "Premium Access",
  "User offers a Bracket 3 item for a Bracket 4 item and has Premium",
  "Verify the standard fee is 30 Leaves and the Premium user is shown the reduced fee of 24",
  () => {
    const t = offerTerms(3, 4);
    assert.equal(displayedBridgeFee(t, false), 30);
    assert.equal(displayedBridgeFee(t, true), 24);
  });

it("Safe-zone Hubs", "Test integration when a user plans a meetup, hubs are ordered by distance and the nearest can be booked", "Meetup Scheduling",
  "User is in Cebu City and two hubs exist, one near and one far",
  "Verify the nearer hub is listed first and choosing it with a future day and time leaves no missing item",
  () => {
    const me = { latitude: 10.3157, longitude: 123.8854 };
    const hubs = [
      { id: "far", name: "Far Plaza", city: "Mandaue", typeLabel: "Plaza", latitude: 10.36, longitude: 123.93 },
      { id: "near", name: "Near Plaza", city: "Mandaue", typeLabel: "Plaza", latitude: 10.32, longitude: 123.89 },
    ];
    const groups = groupHubs({ hubs, shared: new Set(), suggestedId: null, km: (h) => distanceKm(me.latitude, me.longitude, h as never) });
    assert.deepEqual(groups[0].hubs.map((h) => h.id), ["near", "far"]);
    const now = new Date(2026, 5, 10, 9, 0);
    assert.equal(meetupGap({ hubId: groups[0].hubs[0].id, day: new Date(2026, 5, 12), time: { h: 14, m: 0 }, now }), null);
  });
