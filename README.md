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
    _layout.tsx        the session gate, and the bottom tab bar
    index.tsx          Home — GET /api/v1/home
    trades|post|messages|profile.tsx   placeholders
src/
  api/client.ts        Bearer injection, the refresh interceptor, the auth calls
  api/config.ts        the base URL: compiled-in default + SecureStore override
  api/home.ts          the /home infinite query
  api/queryClient.ts   retry policy
  api/types.ts         the v1 wire shapes
  auth/storage.ts      expo-secure-store
  auth/session.tsx     React's view of the session
  auth/google.ts       the expo-auth-session flow, and nothing it decides
  components/LoginBackground.tsx  the auth background LAYER — video goes here
  components/auth-ui.tsx          the shell, fields, buttons and banners
  components/ApiUrlGear.tsx       the gear, and the URL label under it
  theme/palette.js     Baylo's palette, plus the green/white auth surface
```

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
adb reverse tcp:3000 tcp:3000      # re-run after every replug or adb restart
```

with `.env` holding:

```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

`adb reverse` is not persistent. Unplugging the phone, rebooting it, or
restarting the adb server drops the tunnel, and the app then fails with a
connection error against a URL that is still correct. Re-run the command.

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
