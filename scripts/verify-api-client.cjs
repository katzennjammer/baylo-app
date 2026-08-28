/**
 * Acceptance harness for src/api/client.ts.
 *
 * Run:  npx tsx scripts/verify-api-client.cjs
 *
 * Drives the REAL client module — not a reimplementation of it — against a
 * local server that copies the parts of the Next.js API this client depends on,
 * including the one that makes the interceptor hard: refresh tokens here are
 * single-use and rotating, and presenting a spent one revokes the whole family
 * exactly as /api/auth/refresh does.
 *
 * That is the point. A refresh interceptor that races itself does not look
 * broken against a forgiving mock; it looks broken against a server that
 * punishes a replay, which is the server this app actually talks to. The
 * concurrency checks below (§3, §4) fail loudly on the naive implementation and
 * are the reason this file exists.
 *
 * What it cannot check: nothing here proves the real server agrees with this
 * mock. It is a test of the client's behaviour given the documented contract.
 *
 * CommonJS on purpose. The stub for expo-secure-store is installed by
 * intercepting Module._load before the client is required — the real package
 * pulls in React Native's native module bridge and cannot load under Node.
 */

const http = require("http");
const assert = require("assert");
const Module = require("module");

// ── expo-secure-store stub ───────────────────────────────────────────────────

const secureStore = new Map();
const secureStoreStub = {
  async getItemAsync(key) {
    return secureStore.has(key) ? secureStore.get(key) : null;
  },
  async setItemAsync(key, value) {
    secureStore.set(key, value);
  },
  async deleteItemAsync(key) {
    secureStore.delete(key);
  },
};

const load = Module._load;
Module._load = function (request, ...rest) {
  if (request === "expo-secure-store") return secureStoreStub;
  return load.call(this, request, ...rest);
};

// ── A stand-in for the Next.js API ───────────────────────────────────────────

const USER = { id: "u_1", name: "Test User", email: "test@example.com", image: null };
const PASSWORD = "correct-horse";

let nextId = 0;
/** familyId -> { revoked: boolean } */
const families = new Map();
/** refresh token -> { familyId, spent: boolean } */
const refreshTokens = new Map();
/** The access token the server currently accepts. */
let liveAccessToken = null;

/** Every request the client made, for assertions about headers. */
const seen = [];
let refreshCallCount = 0;

function issuePair(familyId) {
  const family = familyId ?? `fam_${++nextId}`;
  if (!families.has(family)) families.set(family, { revoked: false });
  const accessToken = `access_${++nextId}`;
  const refreshToken = `refresh_${++nextId}`;
  refreshTokens.set(refreshToken, { familyId: family, spent: false });
  liveAccessToken = accessToken;
  return { accessToken, refreshToken, user: USER };
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

/** Latency on the refresh, so concurrent 401s genuinely overlap. */
const REFRESH_DELAY_MS = 60;

const server = http.createServer(async (req, res) => {
  seen.push({
    method: req.method,
    url: req.url,
    authorization: req.headers.authorization ?? null,
    cookie: req.headers.cookie ?? null,
  });

  if (req.url === "/api/auth/token" && req.method === "POST") {
    const body = await readBody(req);
    if (body.password !== PASSWORD) {
      return json(res, 401, { error: "Invalid email or password" });
    }
    return json(res, 200, issuePair());
  }

  if (req.url === "/api/auth/refresh" && req.method === "POST") {
    refreshCallCount++;
    const body = await readBody(req);
    const stored = refreshTokens.get(body.refreshToken);
    await new Promise((r) => setTimeout(r, REFRESH_DELAY_MS));

    if (!stored) return json(res, 401, { error: "Invalid refresh token" });
    const family = families.get(stored.familyId);
    if (family.revoked) return json(res, 401, { error: "Invalid refresh token" });

    // The replay rule, copied from the real route: a token presented twice
    // kills the family and logs everyone out.
    if (stored.spent) {
      family.revoked = true;
      return json(res, 401, { error: "Invalid refresh token" });
    }

    stored.spent = true;
    return json(res, 200, issuePair(stored.familyId));
  }

  if (req.url === "/api/auth/revoke" && req.method === "POST") {
    const body = await readBody(req);
    const stored = refreshTokens.get(body.refreshToken);
    if (stored) families.get(stored.familyId).revoked = true;
    return json(res, 200, { ok: true, revoked: stored ? 1 : 0 });
  }

  if (req.url.startsWith("/api/v1/home")) {
    const header = req.headers.authorization ?? "";
    const token = /^Bearer (.+)$/.exec(header)?.[1];
    if (!token || token !== liveAccessToken) {
      return json(res, 401, {
        data: null,
        error: { code: "UNAUTHENTICATED", message: "Sign in to continue" },
        meta: {},
      });
    }
    return json(res, 200, {
      data: { viewer: { id: USER.id, leaves: 42 }, feed: [], trending: [], matches: [] },
      error: null,
      meta: { nextCursor: null },
    });
  }

  return json(res, 404, { data: null, error: { code: "NOT_FOUND", message: "no" }, meta: {} });
});

// ── Checks ───────────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;

function check(name, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? `  — ${detail}` : ""}`);
  }
}

async function main() {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  // Read at module scope by the client, so it must be set before the require.
  process.env.EXPO_PUBLIC_API_URL = base;
  const client = require("../src/api/client.ts");

  console.log(`Driving ${base}\n`);

  // ── 1. Sign in ─────────────────────────────────────────────────────────────
  console.log("[1] sign in");
  const badCreds = await client.signIn("test@example.com", "wrong").then(
    () => null,
    (e) => e,
  );
  check("wrong password rejects with the server's message", badCreds?.status === 401, String(badCreds));

  const session = await client.signIn("test@example.com", PASSWORD);
  check("returns the token pair and user", !!session.accessToken && session.user.id === USER.id);
  check(
    "tokens landed in SecureStore, not anywhere else",
    secureStore.get("baylo.accessToken") === session.accessToken &&
      secureStore.get("baylo.refreshToken") === session.refreshToken,
  );

  // ── 2. Bearer, and no cookie ───────────────────────────────────────────────
  console.log("\n[2] the request contract");
  const home = await client.apiV1("/api/v1/home");
  check("200 with the payload unwrapped from its envelope", home.data.viewer.leaves === 42);

  const homeReq = seen.filter((r) => r.url.startsWith("/api/v1/home")).pop();
  check(
    "carries Authorization: Bearer <accessToken>",
    homeReq.authorization === `Bearer ${client.currentSession().accessToken}`,
    homeReq.authorization,
  );
  check("carries NO Cookie header", homeReq.cookie === null, String(homeReq.cookie));
  check(
    "no request in the whole run has sent a cookie",
    seen.every((r) => r.cookie === null),
  );

  // ── 3. Concurrent 401s ─────────────────────────────────────────────────────
  // The case the interceptor exists for, and the one a naive implementation
  // fails: six requests in flight when the access token stops being accepted.
  console.log("\n[3] six simultaneous 401s");
  refreshCallCount = 0;
  liveAccessToken = "something-else"; // every in-flight token is now stale

  const results = await Promise.allSettled(
    Array.from({ length: 6 }, () => client.apiV1("/api/v1/home")),
  );
  const fulfilled = results.filter((r) => r.status === "fulfilled");

  check("all six requests succeeded", fulfilled.length === 6, `${fulfilled.length}/6`);
  check(
    "EXACTLY ONE refresh was issued for the six",
    refreshCallCount === 1,
    `refresh called ${refreshCallCount}x — a second call is the replay that revokes the family`,
  );
  check(
    "the token family was never revoked",
    [...families.values()].every((f) => !f.revoked),
  );
  check("the session survived", client.currentSession() !== null);
  check(
    "SecureStore holds the rotated pair",
    secureStore.get("baylo.accessToken") === client.currentSession().accessToken,
  );

  // ── 4. The late 401 ────────────────────────────────────────────────────────
  // A request that was already on the wire when someone else's refresh landed.
  // It must retry with the new token, NOT rotate a perfectly good one again.
  console.log("\n[4] a 401 that arrives after someone else refreshed");
  refreshCallCount = 0;
  liveAccessToken = "stale-again";

  const first = client.apiV1("/api/v1/home");
  await new Promise((r) => setTimeout(r, REFRESH_DELAY_MS * 3)); // let it finish
  const late = await client.apiV1("/api/v1/home").then(
    () => "ok",
    (e) => e.message,
  );
  await first;

  check("the late request succeeded", late === "ok", String(late));
  check(
    "still only one refresh",
    refreshCallCount === 1,
    `refresh called ${refreshCallCount}x`,
  );

  // ── 5. A refresh that cannot succeed ───────────────────────────────────────
  console.log("\n[5] refresh refused");
  const familyId = refreshTokens.get(client.currentSession().refreshToken).familyId;
  families.get(familyId).revoked = true;
  liveAccessToken = "no-longer-valid";

  const refused = await client.apiV1("/api/v1/home").then(
    () => null,
    (e) => e,
  );
  check("the request fails with UNAUTHENTICATED", refused?.code === "UNAUTHENTICATED", String(refused));
  check("the session was cleared", client.currentSession() === null);
  check(
    "SecureStore was emptied",
    secureStore.size === 0,
    `${secureStore.size} keys left: ${[...secureStore.keys()].join(", ")}`,
  );

  // ── 6. Sign out ────────────────────────────────────────────────────────────
  // The contract the Profile tab depends on: the family dies server-side AND
  // the tokens leave the device.
  console.log("\n[6] sign out");

  const live = await client.signIn("test@example.com", PASSWORD);
  const liveFamily = refreshTokens.get(live.refreshToken).familyId;
  const revokesBefore = seen.filter((r) => r.url === "/api/auth/revoke").length;

  await client.signOut();

  const revokes = seen.filter((r) => r.url === "/api/auth/revoke");
  check(
    "POSTed /api/auth/revoke exactly once",
    revokes.length === revokesBefore + 1,
    `${revokes.length - revokesBefore} calls`,
  );
  check("the server revoked the whole family", families.get(liveFamily).revoked === true);
  check("the in-memory session is gone", client.currentSession() === null);
  check(
    "SecureStore was emptied",
    secureStore.size === 0,
    `${secureStore.size} keys left: ${[...secureStore.keys()].join(", ")}`,
  );

  const afterSignOut = await client.apiV1("/api/v1/home").then(
    () => null,
    (e) => e,
  );
  check(
    "a request afterwards is UNAUTHENTICATED, which is what routes to login",
    afterSignOut?.code === "UNAUTHENTICATED",
    String(afterSignOut),
  );

  // ── 7. Sign out with nothing on the other end ──────────────────────────────
  // The rule the Profile tab's button is written around: a user who taps sign
  // out ENDS UP SIGNED OUT. An unreachable server costs the server-side revoke
  // and nothing else — not the local clear, and not by throwing.
  console.log("\n[7] sign out while offline");

  const config = require("../src/api/config.ts");
  const stranded = await client.signIn("test@example.com", PASSWORD);
  const strandedFamily = refreshTokens.get(stranded.refreshToken).familyId;

  // Port 1 is not listening. ECONNREFUSED is the fast version of offline; the
  // slow one — a captive portal that accepts the connection and then never
  // answers — is what the AbortController in revokeFamily() covers, and
  // asserting it here would cost the length of that timeout.
  await config.setApiBase("http://127.0.0.1:1");

  const offline = await client.signOut().then(
    () => "resolved",
    (e) => e.message,
  );
  check("signOut() resolved rather than throwing", offline === "resolved", String(offline));
  check("the session is gone from memory anyway", client.currentSession() === null);
  check(
    "the tokens are gone from SecureStore anyway",
    // setApiBase() just wrote a key of its own, so "cleared" here means no
    // TOKENS rather than no keys at all.
    !secureStore.has("baylo.accessToken") &&
      !secureStore.has("baylo.refreshToken") &&
      !secureStore.has("baylo.user"),
    [...secureStore.keys()].join(", "),
  );
  check(
    "the family is still alive server-side — the known, accepted cost",
    families.get(strandedFamily).revoked === false,
  );

  await config.resetApiBase();

  console.log(`\n${pass} passed, ${fail} failed`);
  server.close();
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
