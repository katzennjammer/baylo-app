# baylo-mobile

The Expo client for Baylo. Sibling to the Next.js app in `../baylo`, which it
talks to over `/api/v1` with a Bearer token and no cookie.

```
app/
  _layout.tsx          QueryClientProvider → SessionProvider → SafeAreaProvider
  index.tsx            routes to (app) or (auth) once SecureStore has been read
  verify.tsx           where a verification link lands — outside BOTH groups,
                       because it must work signed in and signed out
  (auth)/
    _layout.tsx        redirects to (app) when a session exists
    login.tsx          POST /api/auth/token, and Continue with Google
    register.tsx       POST /api/auth/register, then "check your email"
  (app)/
    _layout.tsx        the session gate; the bar itself is src/components/TabBar
    index.tsx          Home — GET /api/v1/home
    marketplace|trades|post|messages|profile.tsx   placeholders
src/
  api/client.ts        Bearer injection, the refresh interceptor, the auth calls
  api/config.ts        the base URL: compiled-in default + SecureStore override
  api/home.ts          the /home infinite query
  api/queryClient.ts   retry policy
  api/types.ts         the v1 wire shapes
  auth/storage.ts      expo-secure-store
  auth/session.tsx     React's view of the session
  auth/google.ts       the expo-auth-session flow, and nothing it decides
  components/icons.tsx            the drawn icon set — see "Home" below
  components/AppHeader.tsx        wordmark, Leaves, notifications, messages
  components/TabBar.tsx           the bottom bar, drawn rather than configured
  components/Divider.tsx          the 1 px rule the whole direction rests on
  components/home/                the feed and its five states
  components/LoginBackground.tsx  the auth background LAYER — video goes here
  components/auth-ui.tsx          the shell, fields, buttons and banners
  components/ApiUrlGear.tsx       the gear, and the URL label under it
  theme/tokens.js      Direction 1 — every colour, type role, gap and radius
  theme/palette.js     the older palette. (auth) and Profile only.
```

## Home — Direction 1, "Quiet Feed"

The Home tab, the header and the bottom bar are built to one implementation
spec. Two rules carry most of it:

**Cards are not raised, they are ruled.** A card's fill is the same `#FAFAF7`
as the canvas behind it, there is no shadow anywhere except the Post FAB, and
what separates one listing from the next is a single 1 px `#EDEBE3` line. There
is no gap between cards. `<Divider />` exists so that value cannot drift.

**Every value lives in `src/theme/tokens.js`.** Colours, the forty type roles,
gaps, radii, control heights, icon sizes and per-icon stroke weights. Components
build StyleSheets out of it; none of them writes a number. The file is plain
CommonJS because `tailwind.config.js` requires it — Tailwind loads that config
through Node before any TypeScript transform runs — and `tokens.d.ts` is what
gives the app its types. The handful of measurements that are NOT in the spec
(chip padding, the pill's internal gap, the empty state's vertical rhythm) are
marked as artboard-read where they are defined, so a tuning pass can tell which
numbers came from the table and which came from an eye.

**Three fonts, seven static instances**, bundled under `assets/fonts` with their
OFL licences beside them and embedded at build time by the expo-font config
plugin in `app.json`:

| Family | Instances | Role |
|---|---|---|
| Bricolage Grotesque | SemiBold, Bold | wordmark, item titles, state headlines |
| Public Sans | Regular, Medium, SemiBold, Bold | all UI text |
| JetBrains Mono | Regular | eyebrows, timestamps, the expand label |

Each weight is addressed as its own family by PostScript name, never as one
family plus `fontWeight` — these are static instances, and asking Android for
"PublicSans-Regular at 600" gets synthetic emboldening rather than the SemiBold
file. Every file's basename equals its PostScript name, which is what makes one
string resolve on both platforms.

**The icons are drawn, not imported.** `src/components/icons.tsx` is vector
paths because the spec pairs a stroke weight with every mark and the tab bar's
selected state is the SAME glyph at 1.9 instead of 1.6. An icon font has one
baked-in weight per glyph, which is why Ionicons expresses "active" as a filled
variant instead — taking that substitution would redraw the most characteristic
thing about this direction. Stroke widths are converted from real pixels into
the 24-unit viewBox, so the number in `tokens.icon` is what lands on screen.

**The bar** is Home, Marketplace, Post, Trades, Profile, and it is drawn rather
than configured: react-navigation owns the paddings and the icon/label
relationship, and none of those are reachable as the numbers the spec states.
Messages moved out of the bar and into the header, where its unread count is
visible from every tab and it costs no permanent slot.

### Where the artboard and the endpoint disagree

Four things the artboard draws were not in `/api/v1/home`. One of them — the
trust tier — turned out to be worth an endpoint change and got one; the rest are
resolved towards the data rather than away from it:

- **"2.4 km away"** — not built. There is no viewer coordinate anywhere in the
  schema. See [Distance, and why it is not built yet](#distance-and-why-it-is-not-built-yet).
- **"TRUSTED"** — now `owner.trustTier`, resolved server-side. This is the TRUST
  ladder (New / Rising / Trusted / Top Trader, from completed trades and rating)
  and not `owner.rank`, the LEAF ladder (Seedling / Sprout / Grower / Guardian,
  from lifetime earnings) the card used to show. The two answer different
  questions and the card was asking the wrong one: a prolific poster who has
  never completed a trade reads Guardian on the leaf ladder and New Trader on
  the trust one. The artboard's four treatments map onto the four tiers in
  order.
- **"Trending in Lapu-Lapu"** — the trending groupBy has no geographic filter of
  any kind, so the heading keeps the timeframe and drops the place.
- **"Moving out Sunday"** — no urgency field. The chip is built and takes a
  prop; nothing passes one.

Two more are about people. The story rings have a viewed state nothing records,
so every ring renders unviewed and the viewed treatment stays as a prop. And the
"Matches for you" interstitial is drawn as ITEMS with Leaves values where the
payload holds PEOPLE — `MatchesStrip` implements it to the spec's geometry with
the data that exists, but it is deliberately not mounted: `matches` is the only
people list on the endpoint and the ringed row at the top already spends it, so
mounting both would put the same five faces on one screen twice. The reasoning
is written out in `app/(app)/index.tsx`.

The social row is display-only. `stats.likes`, `stats.liked` and
`stats.comments` are real and are rendered; the only like endpoint on this
backend is `/api/posts/[id]/like`, a cookie-session route outside `/api/v1` that
a Bearer client cannot call, so the row reports as text rather than as three
buttons that do nothing.

### Distance, and why it is not built yet

Deferred deliberately, not forgotten. The design below is settled; what is
missing is the permission work, and it should be picked up after the remaining
screens. Writing it down because the central constraint is not obvious and is
easy to get backwards on a second reading of the privacy rules.

**What exists.** `Item.pickupLat` / `pickupLng` are the only coordinates in the
entire schema. `User.location` is free text and is `NULL` for every user in the
database today — which is why the line under a name currently renders as nothing
but a date. So the *item* end of a distance calculation is fully populated and
the *viewer* end does not exist at all.

**The shape.** Compute it CLIENT-SIDE, from the coarsened point the payload
already carries, and render it in buckets.

1. `expo-location` with `ACCESS_COARSE_LOCATION`. Fine precision buys nothing at
   this resolution and is a much harder permission to ask for. The bulk of the
   work is the permission flow — request, denied, "never ask again", the
   settings deep-link — not the arithmetic.
2. Haversine in `src/lib/`, against `pickup.lat` / `pickup.lng`, which
   non-participants already receive.
3. Render a bucket — "~2 km away", "under 1 km" — never "2.4 km". The input is
   rounded to ~1.1 km, so a tenth-of-a-kilometre reading claims a precision that
   was thrown away on purpose, on the one line whose whole job is to be honest
   about what is withheld.
4. Keep a real no-distance state. `pickup` is nullable and the permission can be
   refused, so this is additive to what the line shows now, not a replacement.

**Why it must not be computed server-side.** This is the part worth not
re-deriving. Sending the viewer's coordinates up and measuring against the
*stored precise* pickup point looks strictly better — more accurate, and no
coordinates on the wire at all. It is the opposite. **A distance from a known
point is a circle, and three circles are a fix.** A viewer who moves and
re-reads the same listing, or who runs two accounts, trilaterates the exact
pickup point from three precise distances — which is the seller's front door,
and is precisely what `coarsen()` exists to prevent. A precise distance is a
slower channel for the same leak, not a smaller one.

So: quantise the INPUT, which is what `coarsen()` already does and what makes
the client-side version safe by construction. If a distance is ever computed
server-side anyway, the output must be bucketed before it leaves the process,
and the buckets must not shrink with repeated reads.

Two smaller notes. The address is nulled for non-participants and a distance
must not become a back door to it. And distance leaks in both directions: it
tells the viewer roughly where a seller is, and the request tells the server
where the viewer is — `User.location` is a string someone chose to publish,
whereas GPS is not.

**Cost.** About a day for the client-side bucketed version, almost all of it
permission UX, with no endpoint change and no migration. Several days for the
alternative — a stored `homeLat` / `homeLng` on `User`, set during onboarding,
which avoids the runtime permission but adds two columns, a migration and a
screen.

## The auth screens

Two routes, not one screen with a toggle: `/(auth)/login` and
`/(auth)/register`. They have different fields, different errors and different
endings — register finishes on a "check your email" step that sign-in has no
equivalent of — and collapsing them behind a switch makes the back button
ambiguous for the life of the app.

Everything past the gate is Forest/Cream, a dark olive canvas with cream type.
The auth screens are inverted: green field, white card. That is not a second
theme by accident, it is what `<LoginBackground>` forces. It renders a gradient
today and is meant to render a looping muted video later, and a video frame can
be any brightness at any moment — cream-on-olive would be unreadable over a
bright one. So: a scrim owned by the background layer, a translucent white card
for the fields, and a scrim behind the wordmark, which is the only type that
sits on the background directly.

**Dropping the video in** is a one-component change. Install `expo-video`,
replace the `<LinearGradient>` inside `LoginBackground` with a `<VideoView>`
(`contentFit="cover"`, muted, looping, no controls) and keep the gradient
underneath as the poster so the first frame is never a black rectangle. Nothing
outside that file changes. Pause on blur — a video that keeps decoding behind
the Google consent browser is a battery complaint in a review — and keep the
file small; it plays under a form nobody looks at for fifteen seconds.

## The gear

The API URL is on the sign-in and register screens, shown in full under a gear,
and it is staying. `adb reverse` drops on every replug, reboot and adb-server
restart, and when it does every request fails against a URL that is still
technically correct — which looks exactly like a broken app.

`EXPO_PUBLIC_API_URL` is compiled into the bundle, so it is a DEFAULT, not a
setting. The gear writes an override to SecureStore, which survives a reload and
is layered over that default; **Reset** drops back to it. **Test** POSTs an empty
body to `/api/auth/token` and reports the status — a 400 back is a pass, because
what is being tested is whether anything on the other end parsed the request.

## Reaching the dev server from a phone

### Over USB — the easy path, and the one this repo is configured for

`adb reverse` opens a tunnel from the phone back to this machine: the phone's
own `localhost:3000` becomes this machine's `localhost:3000`. No LAN IP, no
firewall rule, no shared Wi-Fi, and nothing on the network can reach the dev
server. It also survives the laptop changing networks.

```bash
adb devices                        # confirm the phone is listed as "device"
adb reverse tcp:3000 tcp:3000      # the API
adb reverse tcp:8081 tcp:8081      # Metro — see "the bundle location" below
```

or just `npm run phone`, which checks both servers are up, opens both tunnels,
and proves the phone can reach each one through them.

with `.env` holding:

```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

`adb reverse` is not persistent. Unplugging the phone, rebooting it, or
restarting the adb server drops the tunnel, and the app then fails with a
connection error against a URL that is still correct. Re-run the command.

### The bundle location resets to localhost — and that is fine

"Change Bundle Location" in the dev menu does not survive a force-close, and
this is upstream behaviour rather than a misconfiguration. In React Native
0.86, `PackagerConnectionSettings.debugServerHost` has a setter that assigns to
a **static field in a companion object and nothing else** — it never writes
SharedPreferences. On process death the static dies, the getter falls through to
the (never-written) `debug_http_host` preference, and then to
`AndroidInfoHelpers.getServerHost()`, which on a physical device is `localhost`.

There is no fix from JavaScript. `DevSettings` in JS exposes only
`addMenuItem`, `reload` and `onFastRefresh` — there is no host setter — and the
bundle host is chosen *before any of this app's JS exists*, so no app code could
influence it even if there were one. This project has no `expo-dev-client`, so
`expo-dev-launcher`'s remembered-URL list is not available either; adding it
would buy a native dependency and a full rebuild for a list you still have to
pick from, and a saved LAN IP still breaks on the next DHCP lease.

So do not fight the reset — **make the value it resets to correct**:

```bash
adb reverse tcp:8081 tcp:8081
```

The phone's own `localhost:8081` is now this machine's Metro. The dev menu can
reset to `localhost` as often as it likes and it will be right every time, and
because no LAN IP is involved it stays right when this laptop's DHCP lease
changes on a phone hotspot.

**Off the cable.** If the phone has to find Metro over Wi-Fi, seed the
preference RN actually reads:

```bash
npm run phone -- -PersistBundleHost
```

`DevServerHelper`'s own doc comment names `debug_http_host` as the supported way
to hand the debug server a host, and a preference is real persistent storage —
so unlike the dev menu's value, this one survives a force-close. It pins a LAN
IP, so re-run it after a DHCP change. The tunnel is still the better path.

### Over Wi-Fi — when USB is not an option

This is the part that catches people out. `localhost` on a phone is the phone,
so a device pointed at `http://localhost:3000` is talking to itself.

**1. Bind Next.js to every interface.** By default `next dev` listens on
localhost only and will refuse a connection that came from another machine:

```bash
cd ../baylo
npx next dev -H 0.0.0.0 -p 3000
```

**2. Find this machine's LAN IP.**

```bash
ipconfig                      # Windows — the "Wi-Fi" adapter's IPv4 Address
ipconfig getifaddr en0        # macOS
hostname -I | awk '{print $1}'  # Linux
```

Take the address on the same subnet as the phone. On this machine that is
`172.20.248.88` (Wi-Fi). Ignore `192.168.56.x` — that is a VirtualBox host-only
adapter and no phone can reach it.

**3. Put it in `.env`.**

```
EXPO_PUBLIC_API_URL=http://172.20.248.88:3000
```

`EXPO_PUBLIC_*` is read at BUILD time, not at runtime. Changing it means
restarting Metro with `npx expo start --clear` — without `--clear` the old value
stays baked into the cached bundle and you will debug a URL that is no longer in
the file.

**4. Open the Windows Firewall for port 3000.** Windows blocks inbound
connections to Node by default, which presents as a request that hangs and then
times out — indistinguishable from a wrong IP. Once, from an elevated shell:

```powershell
New-NetFirewallRule -DisplayName "Next.js dev 3000" -Direction Inbound `
  -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
```

Keep it to `-Profile Private`. On a public network that rule exposes the dev
server, database-backed API and all, to everyone on the Wi-Fi.

**5. Same network.** Phone and machine on the same SSID, and not a guest network
— guest networks isolate clients from each other by design.

### Per-target cheat sheet

| Target | `EXPO_PUBLIC_API_URL` | Notes |
| --- | --- | --- |
| **Real device over USB** | `http://localhost:3000` | Needs `adb reverse tcp:3000 tcp:3000`. No firewall rule. **Current setting.** |
| Real device, same Wi-Fi | `http://<LAN-IP>:3000` | Needs steps 1 and 4 above |
| Android emulator | `http://10.0.2.2:3000` | `10.0.2.2` is the emulator's alias for the host's loopback; no firewall rule needed |
| iOS simulator | `http://localhost:3000` | Shares the host's network stack |

Whichever you pick, `EXPO_PUBLIC_*` is substituted at BUILD time. Changing it and
restarting Metro is not enough — Metro's transform cache will hand back a bundle
with the old URL still compiled in. This is not hypothetical; it was observed
while writing this file. Always `npx expo start --clear`.

Verify the path before blaming the app — from the phone's browser, open
`http://<LAN-IP>:3000`. If the Baylo landing page does not load there, no amount
of app debugging will help.

## Google sign-in

The app runs the Google flow itself and posts the resulting **ID token** to
`POST /api/auth/google/token`, which verifies its signature against Google's
JWKS plus issuer, audience and expiry before it counts as evidence of anything.
Nothing is trusted on the client: `src/auth/google.ts` never parses the token.

The flow is authorization-code + PKCE, in the system browser (a Custom Tab, not
a WebView — Google refuses to authenticate inside a WebView, and is right to).
There is no client secret, because an installed app is a **public client**:
there is nowhere in an APK to keep one. PKCE is what binds the code to this
request instead.

### It does not work in Expo Go

The redirect URI is derived from this app's own package name, and in Expo Go the
package is Expo's. You need a development build:

```bash
npx expo run:android                       # local dev build, debug-signed
# or
eas build --profile development -p android # cloud dev build
```

Password sign-in works in Expo Go. The Google button disables itself with a
message naming the missing variable when the client id is not set.

### What to create in the Google Cloud console

One thing, in the same project that already holds the Web client the Next.js app
uses: **APIs & Services → Credentials → Create credentials → OAuth client ID →
Application type: Android.** Not Web. A Web client id here comes back without an
`id_token` and the app tells you so.

It asks for exactly two values:

| Field | Value |
| --- | --- |
| Package name | `com.baylo.app` — this is `expo.android.package` in `app.json` |
| SHA-1 certificate fingerprint | the signing certificate's, per build type (below) |

There is no redirect URI field for an Android client. Google derives it from the
package name, and expo-auth-session builds the same string:
`com.baylo.app:/oauthredirect`.

**A client is a (package name, SHA-1) pair, so a debug build and a production
build need TWO Android clients.** Same package name, different fingerprints.
Create both and list both on the server.

Also check **APIs & Services → OAuth consent screen**. While it is in *Testing*,
only the addresses under **Test users** can sign in at all — everyone else gets
"access blocked" and it reads like a bug in the app.

### Getting the SHA-1

**Development build** (`npx expo run:android`) — signed with the Android debug
keystore, which is created for you the first time you build. Same password for
every developer, by design:

```powershell
keytool -list -v `
  -keystore "$env:USERPROFILE\.android\debug.keystore" `
  -alias androiddebugkey -storepass android -keypass android
```

```bash
# macOS / Linux / Git Bash
keytool -list -v \
  -keystore ~/.android/debug.keystore \
  -alias androiddebugkey -storepass android -keypass android
```

Take the line that reads `SHA1: AB:CD:...`.

**EAS build** — EAS generates and holds the upload keystore, so read the
fingerprint from it rather than from a local file:

```bash
npx eas credentials -p android          # pick the profile, then "Keystore: …"
```

The same values are on the web at
`https://expo.dev/accounts/<account>/projects/baylo-mobile/credentials`.

**One more, and it is the one people miss:** if the app is distributed through
Google Play with **Play App Signing** on, Play re-signs the APK with a key you
never see, so the fingerprint users actually run under is Play's, not EAS's.
Take it from **Play Console → your app → Test and release → Setup → App
signing → App signing key certificate → SHA-1**, and create a third Android
client for it. Without this, Google sign-in works in every build you make
yourself and fails for everyone who installs from the store.

### Wiring both ends

The ID token's `aud` is whichever client id performed the exchange — the
**Android** one, not the web one — and the server accepts only audiences it has
been told about. Both files, or the exchange 401s:

```bash
# baylo-mobile/.env  — a client id is public; the SECRET stays on the server
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com

# baylo/.env — comma-separated, one per Android/iOS client you created
GOOGLE_NATIVE_CLIENT_IDS=123456789-abcdef.apps.googleusercontent.com,987654321-uvwxyz.apps.googleusercontent.com
```

Then restart Metro with `--clear` (the value is compiled in) and restart the
Next dev server.

### What the failures look like

| Symptom | Cause |
| --- | --- |
| Button disabled, "not configured" | `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` unset, or Metro not restarted with `--clear` |
| 500 "Google sign-in is not configured" | server has no accepted audiences — set `GOOGLE_NATIVE_CLIENT_IDS` |
| 401 "Invalid Google ID token" | the Android client id is not listed in `GOOGLE_NATIVE_CLIENT_IDS` |
| Google's own "Error 400: redirect_uri_mismatch" | the client is a Web client, not an Android one |
| Consent screen then immediate cancel | this build's SHA-1 is not on any Android client for `com.baylo.app` |
| "Access blocked: app not verified" | consent screen is in Testing and this address is not a test user |
| Returns without an ID token | a Web client id is being used on device |

Signing in with Google marks the account verified server-side — the route calls
the same `markVerified()` the emailed link does — which awards VERIFY_ACCOUNT
and the one-time 50-Leaf signup grant. Idempotent: a returning user's second
Google sign-in credits nothing.

## Creating an account

`/(auth)/register` posts to the same `POST /api/auth/register` the web uses.
Two server facts decide the shape of that screen, and both are worth knowing
before changing it:

**Registration returns no tokens.** So the screen registers and then calls
`authenticate()` with the credentials already in state.

**`POST /api/auth/resend-verification` is authenticated.** It has to be — taking
an email address in the body would make it an open relay and an
account-existence oracle at once. So the resend button needs a session, which is
why the screen holds one *without installing it*: installing it trips the guard
in `(auth)/_layout`, which redirects the instant a session exists, and the user
would be thrown into the app without reading a word of what the email is for.
`Continue to Baylo` is what adopts it.

Resends are limited to **three per hour per user** — registration's own email
does not come out of that budget, since registration is limited separately, per
IP. A 429 carries `Retry-After` and the screen turns it into "try again in N
minutes".

Verification is not a wall. Login works unverified; verifying is what unlocks
the 50-Leaf welcome grant.

### The verification link

The emailed link is `<NEXTAUTH_URL>/api/auth/verify-email?token=…`, an https URL,
so on a phone it opens the browser and the server redirects to the web
dashboard. `app/verify.tsx` handles the same token for the app, over
`POST /api/auth/verify-email` — the other transport for one code path.

To make the link open the app instead, either point the email at
`baylo://verify?token=…` or set up Android App Links: add
`expo.android.intentFilters` for the `NEXTAUTH_URL` host with
`autoVerify: true`, and serve `/.well-known/assetlinks.json` from that host with
the app's package name and signing SHA-256. Until then `app/verify.tsx` is
reachable by deep link (`adb shell am start -a android.intent.action.VIEW -d
"baylo://verify?token=…"`) and is what the App Links setup will land on.

## Running it

```bash
npm start                 # Metro; press a for Android, i for iOS
npm run typecheck         # tsc --noEmit
npm run verify:api        # the API client acceptance harness (see below)
```

## The API client

`src/api/client.ts` is the only place a request leaves the app. Two things in it
are load-bearing rather than incidental:

**No cookies.** Every fetch passes `credentials: "omit"`. React Native's fetch
sits on a native HTTP stack with a real cookie jar, and the server's
`resolveSession()` accepts either a Bearer token *or* a NextAuth cookie — so a
cookie that got into the jar would silently become a second way to authenticate.

**One refresh at a time.** The server's refresh tokens are single-use and rotate,
and presenting a spent one is read as a replay: the whole token family is
revoked and the user is logged out. A refresh-per-401 interceptor therefore does
not merely waste a request — when several requests 401 together, as they do the
moment a 15-minute access token expires under a screen that fetches more than
once, the second one replays the first one's token and logs the user out.
`refreshOnce()` handles both orderings; the comment above it explains which.

`scripts/verify-api-client.cjs` drives the real client module against a local
server that copies those rules, including the replay punishment. Removing either
half of the lock turns §3 of that harness red.

## What is not here, and must not be

This project's `.env` holds four variables and all four are public: the API base
URL and three OAuth **client ids**. Anything prefixed `EXPO_PUBLIC_` is
substituted into the JavaScript bundle at build time and ships inside the APK,
where it takes about ten seconds to read back out — so the prefix is a
distribution mechanism, not a secret store.

A base URL is public by nature; so is an OAuth client id, which appears in the
URL of every consent screen Google shows. `GOOGLE_CLIENT_SECRET` is not, and it
is not here: it belongs to the web app and stays on the Next.js server. The
native flow needs no secret at all — an installed app is a public client, and
PKCE takes the secret's place.

Cloudinary, Pusher, Anthropic and the database URL are not public either, and
none of them belongs in `.env`, in `app.json`'s `extra`, or anywhere else in
this project — the app reaches those capabilities through server routes in
`../baylo` that hold the keys.
