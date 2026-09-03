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

**There is one supported path. It is `npm run phone`. Read the next paragraph
and then run that command.**

Four routes to Metro exist, this repo used to document three of them, and
switching between them is what broke this setup repeatedly — each leaves state
the next one does not clear, so the app ends up dialling an address that no
longer means anything. What follows picks one, explains why, and makes the rest
explicitly unsupported fallbacks.

### The one path: wireless debugging

```bash
npm run phone
```

First run walks you through pairing the phone over Wi-Fi. Every run after that
just connects. The script then starts Metro and the API if they are not already
up, opens the firewall, checks the phone can actually reach both, and writes the
host into the app so it survives a force-close.

**Requires Android 11 (API 30) or newer.** That is a hard floor, not a
preference — see [below](#if-the-phone-is-below-android-11). The script checks
`ro.build.version.sdk` and says so plainly rather than failing sideways.

### Why this, and why the hotspot stopped being the answer

The laptop's hotspot **was** the documented path. It is now unavailable here,
for a reason no amount of retrying fixes: **Windows will not share a connection
with itself.** When the laptop's only uplink is the phone's own hotspot, there
is nothing to share, so Mobile Hotspot refuses to start and `192.168.137.1`
never carries traffic.

That failure is quiet, which is what makes it expensive. Internet Connection
Sharing parks `192.168.137.1` on a *disconnected* virtual adapter regardless, so
the address shows up in `ipconfig` with nothing behind it:

```
IPAddress       InterfaceAlias            PrefixOrigin   AddressState
192.168.137.1   Local Area Connection* 1  Manual         Tentative      <- dead
10.141.155.88   Wi-Fi                     Dhcp           Preferred      <- real
```

The old check asked only whether the address existed, and so answered yes.
`Test-HotspotUp` now also requires `AddressState` `Preferred` on an adapter that
is `Up`.

**The fix is to turn the topology around.** In wireless mode the *phone* is the
access point and the laptop is the client — which is the way round it was always
going to be, because the phone is where the internet comes from. And that
inversion hands over the one thing every other mode lacked:

> The phone is the laptop's **default gateway**, and a gateway address is not
> leased to us. The phone chooses it and holds it for the life of the hotspot.

So `adb connect <gateway>` has a fixed target needing neither a cable that stays
up nor a hosted network Windows will not start.

| | needs the cable up | breaks when an address changes | needs a hosted network |
|---|---|---|---|
| `adb reverse` (`phone:tunnel`) | **yes — constantly** | no | no |
| LAN / Wi-Fi IP (`phone:lan`) | **yes, on every change** | **yes** | no |
| laptop hotspot (`phone:hotspot`) | once | no | **yes — impossible here** |
| **wireless (`npm run phone`)** | **never** | **no** ¹ | **no** |

¹ The laptop's own address is still a lease from the phone and can still drift.
The difference is that the drift is now *cheap*: rewriting `debug_http_host` no
longer needs a cable, so it costs one command rather than a hunt for a cable
that still works.

### What is stable here and what is not

| | stable? | |
|---|---|---|
| the phone's address | **yes** | it is the gateway; not leased to us |
| the pairing | **yes** | a host key stored on the phone; survives reboots and re-toggling |
| the wireless-debugging **port** | **no** | Android randomises it on every toggle and every reboot |
| this laptop's own address | **no** | leased by the phone — but see ¹ above |

The port is the only one that needs machinery. The script discovers it over
mDNS each run rather than remembering one. If mDNS is unreliable on your hotspot
— some Android builds do not forward multicast to their own clients — pin it:

```bash
npm run phone:pin     # adb tcpip 5555; lasts until the phone reboots
```

### Pairing, once

`npm run phone` does this for you the first time. To do it deliberately:

```bash
npm run phone:pair
```

On the phone, in this order:

1. **Settings → About phone → tap "Build number" seven times** (only if
   Developer options is not already unlocked)
2. **Settings → System → Developer options → Wireless debugging → ON**
3. **Tap "Pair device with pairing code"**

Leave that dialog open — its six-digit code and port are valid only while it is
on screen. The script finds the port over mDNS and asks you for the code.

**Pairing and connecting are two different services on two different ports**,
and this is the single most confusing thing about wireless debugging. The
pairing code applies only to the pairing port, which is per-dialog and dies with
it. The *connect* port is the one printed under "IP address & Port" on the
Wireless debugging screen itself. If pairing succeeds but connecting does not,
that is the number to pass:

```bash
npm run phone:wireless -- -ConnectPort 41235
```

The pairing itself does not need repeating — not after a reboot, not after
toggling wireless debugging off and on. Only after the phone's **Forget**
button, or a factory reset.

### If the phone is below Android 11

<a id="if-the-phone-is-below-android-11"></a>

Wireless debugging arrived in Android 11 (API 30). Below that it is not a hidden
setting — the "Pair device with pairing code" screen and the adbd TLS pairing
service behind it are not in the build at all. A quick check either way:

```bash
adb shell getprop ro.build.version.release   # needs the cable once
```

Or just look: if Developer options has no **Wireless debugging** entry, the
phone is below 11.

What is left, given a hotspot this laptop cannot host:

1. **`adb tcpip` over the cable once per boot.** The cable is needed for one
   command and can come straight back out; the connection then lasts until the
   phone reboots.
   ```bash
   adb tcpip 5555
   adb connect <phone-ip>:5555
   npm run phone:lan
   ```
2. **`npm run phone:lan` on its own**, re-run whenever the lease changes — which
   needs the cable each time, and is why this is last.

### Why the host has to be written, not typed

The dev menu's **Change Bundle Location** does not persist. In React Native
0.86, `PackagerConnectionSettings.debugServerHost` has a setter that assigns to
a static field in a companion object and does nothing else — it never touches
SharedPreferences. The host you type lives exactly as long as the process does.
On force-close the static dies, the getter falls through to the never-written
`debug_http_host` preference, and then to `AndroidInfoHelpers.getServerHost()`,
which on a physical device is `localhost`.

That is not fixable from JavaScript. `DevSettings` exposes only
`addMenuItem`/`reload`/`onFastRefresh`, and the bundle host is chosen before any
of this app's JS exists, so no amount of app code can influence it.

So `npm run phone` writes `debug_http_host` itself, through `run-as`, which
works on any debuggable build — which every `expo run:android` debug APK is. RN
never writes that preference but it does read it: `DevServerHelper`'s own doc
comment names it as the supported way to hand the debug server a host. A
preference is real storage. It survives force-close, reboot, and the cable
falling out.

### The other commands

```bash
npm run phone           # wireless. the supported path.
npm run phone:pair      # just the pairing walkthrough.
npm run phone:pin       # pin adbd to 5555 (until reboot) when mDNS is flaky.
npm run phone:unpair    # disconnect and forget the remembered port.
npm run phone:show      # what is set on the device right now. changes nothing.
npm run phone:reset     # forget the persisted host.

npm run phone:hotspot   # the old path. needs a hotspot Windows will not start.
npm run phone:tunnel    # adb reverse + localhost. needs the cable to stay up.
npm run phone:lan       # this machine's Wi-Fi IP. goes stale; avoid.
```

`npm run phone:show` first, always. It prints the `debug_http_host` the phone is
actually holding, which is the only thing that answers "why is it reaching for
*that* address" — and it is not visible from the laptop any other way. It will
not drag you into a pairing walkthrough.

> **Flags do not pass through npm without `--`.** `npm run phone -ConnectPort 5`
> silently drops the flag; npm forwards nothing after the script name unless you
> separate it. Both of these work:
>
> ```bash
> npm run phone:wireless -- -ConnectPort 41235
> powershell -ExecutionPolicy Bypass -File scripts/connect-phone.ps1 -Mode wireless -ConnectPort 41235
> ```

### When the app reaches an address you do not recognise

Work down this list. Every step is a thing that can supply a host, in the order
they are worth checking.

1. **`npm run phone:show`** — the persisted `debug_http_host`. If this is stale,
   `npm run phone:reset` and then `npm run phone`.
2. **The gear's API override.** `EXPO_PUBLIC_API_URL` is compiled into the
   bundle and is only a default; the gear writes an override to SecureStore that
   outranks it. Editing `.env` has **no effect** while an override is set. The
   boot diagnostic says `from the gear's override, NOT .env` when this is the
   case. **Reset** in the gear drops it.
3. **`.env` itself.** In wireless mode the API lives at the laptop's *leased*
   address, so `EXPO_PUBLIC_API_URL` cannot be right by accident the way it was
   under the hotspot's fixed `192.168.137.1`. `npm run phone` compares the two
   and prints both if they disagree; `-WriteEnv` makes it fix the file.
4. **Metro's advertised host.** `npx expo start` defaults to `--host lan`, which
   makes Metro advertise this laptop's Wi-Fi address without asking which one.
   `npm run phone` sets `REACT_NATIVE_PACKAGER_HOSTNAME` so Metro, the QR code,
   and the persisted preference all name the same host. A Metro started by hand
   in another window does not, and a Metro already running is the one thing the
   script cannot fix for you — close that window and let the script start it.
5. **A stale bundle.** `EXPO_PUBLIC_API_URL` is inlined at build time, so a
   Metro started before an `.env` edit serves the old value. Always
   `npx expo start --clear` after touching `.env`.

Verify the path before blaming the app — from the phone's browser, open
`http://<the address npm run phone printed>:3000`. If the Baylo landing page
does not load there, no amount of app debugging will help.

### Not installed: `expo-dev-client`

Worth knowing what it would and would not buy, because it looks like the fix and
is only half of one.

It **would** solve the reset: it adds a launcher that keeps recently-used dev
server URLs in its own persistent storage, so a force-close returns you to a
screen listing them rather than to a silent fallback to `localhost`.

It **would not** solve either thing that actually breaks this setup. The URL it
remembers is still a URL: point it at a LAN IP and the next DHCP lease still
kills it; point it at `localhost` and it still needs `adb reverse` and a cable
that stays plugged in. It also adds a build step and a native dependency.

Writing `debug_http_host` gets the same persistence with no new dependency — and
under wireless mode, re-running `npm run phone` re-writes it without a cable, so
a lease change costs one command instead of a plugged-in phone. Install
`expo-dev-client` if you want its launcher UI and its other tooling — not as a
fix for this.

## Cloud builds — EAS

`eas.json` is checked in with two Android profiles. `preview` is the one that
replaces the cable: a **release APK, internally distributed**, installed once and
run with no Metro, no `adb reverse` and no dev client. `production` builds the
AAB the Play Store wants.

```sh
npm run build:apk      # eas build --platform android --profile preview
npm run build:aab      # eas build --platform android --profile production
npm run build:status   # last five Android builds
```

### What it removes, and what it does not

It removes **Metro**. A release APK carries its own JavaScript bundle, so the
laptop no longer has to be serving one and the cable no longer has to survive.

It does not remove the **backend**. The app still talks to Next.js on the laptop,
so `next dev -H 0.0.0.0` still has to be running and the phone still has to be
able to reach it. That part works without any cable already: the phone is the
hotspot and the laptop is a client on it, so the phone can reach the laptop at
its address on that network — `10.141.155.88:3000` at the time of writing, which
is what `preview`'s `EXPO_PUBLIC_API_URL` is set to. That address is a DHCP
lease and will change. When it does, **use the gear** — it outranks the compiled
default and costs no rebuild. Rebuilding for an address change is the wrong move;
that is the whole reason the gear exists.

One thing does go missing in a release build: the dev caption chip that prints
the current server under the sheet is `__DEV__`-only. The gear still opens and
still shows you the value — you just have to tap it to read it.

### One-time setup

1. An Expo account — free, sign up at [expo.dev](https://expo.dev/signup).
2. `npm install --global eas-cli`
3. `eas login`
4. `eas init` — from this directory, once. It creates the project on Expo's side
   and writes `extra.eas.projectId` into `app.json`. **Commit that change.**

### Commit first — this is the one that will bite

EAS builds from a **clean git clone** of this repo. Uncommitted edits and
untracked files are not uploaded, and `eas.json` sets `"requireCommit": true` so
the CLI refuses to start rather than quietly building last week's code.

That matters right now more than it usually would: the auth kit
(`src/components/auth-sheet.tsx`, `auth-thumbbar.tsx`, `auth-under-age.tsx`,
`src/theme/auth-*.ts`, `src/lib/dob.ts` and the rest) is **untracked**. Build
without adding it and you get an APK of the old dark auth screens. `git status`
before every build until that settles.

### Where the environment comes from

`.env` is gitignored, so it does not reach the builder — there is no `.env` in
the clone EAS makes. `EXPO_PUBLIC_*` values for cloud builds live in each
profile's `env` block in `eas.json` instead. Same rule as always applies to what
may go there: `EXPO_PUBLIC_*` is inlined into the bundle and ships inside the
APK, so it holds public values only. `eas.json` is committed, which makes that
rule stricter, not looser.

`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` is left blank in both profiles. Password
sign-in works without it; Google sign-in does not. Fill it in — a client id is
public — or, if you would rather it not sit in the repo, keep it out of
`eas.json` and set it on Expo's side instead:

```sh
eas env:create --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value <the id> --environment preview
```

Note that the SHA-1 in the Google console must match the keystore that signed
the APK. EAS generates and holds its own upload keystore, which is **not** the
debug keystore under `android/`, so Google sign-in needs that build's SHA-1
added — `eas credentials` prints it.

### Cleartext HTTP, and the one thing that had to be added

This is the trap in the whole exercise, and it is silent.

Debug builds talk plain HTTP because `expo prebuild` writes
`android:usesCleartextTraffic="true"` into `android/app/src/debug/AndroidManifest.xml`.
**Release builds do not get that**, and Android has blocked cleartext by default
since API 28. So the `preview` APK — a release build pointed at
`http://10.141.155.88:3000` — would fail every single request, with a network
error indistinguishable from "the laptop is not running the server."

`expo.android.usesCleartextTraffic` is not a key the Expo config schema accepts,
so app.json cannot say this. `expo-build-properties` is the supported route, and
it is now a dependency for that one reason.

Which build gets the exemption is decided in `app.config.js`. It reads app.json
as its base and appends the plugin only when `BAYLO_ALLOW_CLEARTEXT=1`, which
only the `preview` profile sets. `production` must never set it: a store build
talks HTTPS to a deployed backend, and a blanket cleartext exemption in a Play
Store upload is a security-review failure waiting to happen.

Nothing about local development changes. The variable is unset, `app.config.js`
returns app.json untouched, and debug builds keep getting cleartext from the
debug manifest exactly as before.

### `/android` is not the source of truth

`/android` is gitignored, so the builder never sees it and regenerates it from
`app.json` plus `app.config.js` with `expo prebuild`. Nothing in the local
`android/` directory affects a cloud build, and nothing hand-edited there would
survive — including the debug manifest above, which is why the cleartext
permission had to be expressed as config rather than left where it sits. Native
config goes in `app.json`, and in a config plugin when app.json has no key for
it.

### The build, and getting it onto the phone

```sh
npm run build:apk
```

The CLI uploads, queues, and prints a build page URL. Android internal
distribution needs no device registration — that is an iOS ad-hoc constraint, not
this one. When the build finishes the page offers an **Install** button and a QR
code; open that page in the phone's browser, download, and allow "install
unknown apps" for the browser when Android asks. The phone hosts the hotspot, so
it has mobile data for the download and the laptop is not involved at all.

Expect **10–25 minutes** on the free tier, most of it queueing rather than
compiling. Free accounts get 15 Android builds a month, one at a time, on the
low-priority queue, with a 45-minute build ceiling — comfortably enough for this,
as long as you do not treat a rebuild as the way to change a URL.

### Toward the Play Store

`production` is already shaped for it: an AAB, `distribution: "store"`, and
`autoIncrement` against `"appVersionSource": "remote"`, which means Expo keeps
the `versionCode` and bumps it each build rather than leaving it to a field in
`app.json` that someone forgets. `version` in `app.json` stays the human-facing
string you set by hand.

Two things are deliberately unfinished there. `EXPO_PUBLIC_API_URL` is
`https://CHANGE-ME.example.com` — a store build must point at a deployed HTTPS
backend, and Android blocks cleartext HTTP by default, so a LAN address is not
merely wrong, it will not connect. And `submit.production` is empty; it wants a
Google service-account key before `eas submit --platform android` can upload.
Neither blocks the APK work, and both are the right shape to fill in when
there is something to ship.

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
