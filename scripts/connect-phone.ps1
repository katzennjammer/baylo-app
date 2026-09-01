<#
.SYNOPSIS
  Gets the Baylo dev build talking to Metro and the API, and keeps it that way.

.DESCRIPTION
  There is ONE supported path, and it is the default: `hotspot`.

  -- WHY HOTSPOT IS THE ONE PATH --------------------------------------------

  Three routes exist and two of them are traps.

    tunnel   `adb reverse tcp:8081` makes the phone's own localhost:8081 point
             at this machine. Correct, elegant, and it dies the moment the USB
             cable twitches. It also silently lapses on unplug, reboot, or
             `adb kill-server`, and the failure looks like a white screen
             rather than an error.

    lan      Metro on this laptop's Wi-Fi address. Works until DHCP hands out a
             different lease. This is where 10.141.155.88 came from, and why it
             stopped working.

    hotspot  This laptop's OWN Mobile Hotspot. Windows pins the hosted network
             to 192.168.137.1 and has done since ICS shipped: it is not a DHCP
             lease, it is a fixed address on a virtual adapter. The phone joins
             it, and Metro is at 192.168.137.1:8081 today, tomorrow, and after
             every reboot.

  Hotspot is the only one of the three that needs neither a cable that stays up
  nor an address that stays leased. That is the whole argument for it.

  -- WHY THE HOST HAS TO BE PERSISTED, NOT TYPED ----------------------------

  In React Native 0.86, `PackagerConnectionSettings.debugServerHost` -- the
  value the dev menu's "Change Bundle Location" writes -- has a setter that
  assigns to a static field in a companion object AND NOTHING ELSE. It never
  touches SharedPreferences. So the host you type survives exactly as long as
  the process does; on force-close the static dies, the getter falls through to
  the `debug_http_host` preference, and then to
  AndroidInfoHelpers.getServerHost(), which on a physical device is `localhost`.

  That is not fixable from JavaScript. `DevSettings` exposes only
  addMenuItem/reload/onFastRefresh, and in any case the bundle host is chosen
  before any of this app's JS exists.

  So this script writes `debug_http_host` directly. RN never writes that
  preference but it DOES read it -- DevServerHelper's own doc comment names it
  as the supported way to hand the debug server a host. `run-as` makes it
  writable without root on any debuggable build, which every `expo run:android`
  debug APK is. A preference is real storage: it survives force-close, reboot,
  and the cable falling out.

.PARAMETER Mode
  hotspot  (default)  Metro on 192.168.137.1. No cable needed after setup.
  tunnel               adb reverse; localhost:8081. Needs the cable to stay up.
  lan                  This machine's Wi-Fi DHCP address. Goes stale; avoid.

.PARAMETER ClearBundleHost
  Removes the persisted `debug_http_host` preference and stops. Use this when
  the app is reaching for an address you no longer recognise -- a stale value
  from an earlier attempt is invisible from the laptop and survives a rebuild,
  because it is app data rather than anything in the APK.

.PARAMETER ShowOnly
  Report what is set on the device and change nothing.

.EXAMPLE
  npm run phone
  The documented path. Hotspot mode, persists the host, starts Metro if needed.

.EXAMPLE
  npm run phone:tunnel
  Cable mode, for when the phone cannot join the hotspot.

.EXAMPLE
  npm run phone:reset
  Forget the persisted host. Run this first if the app reaches a stale IP.
#>

[CmdletBinding()]
param(
  [ValidateSet('hotspot', 'tunnel', 'lan')]
  [string] $Mode      = 'hotspot',
  [int]    $ApiPort   = 3000,
  [int]    $MetroPort = 8081,
  [string] $Adb       = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
  [string] $BundleHost,
  [switch] $ClearBundleHost,
  [switch] $ShowOnly,
  [switch] $NoStart,
  [int]    $StartTimeoutSec = 120,
  [string] $Package   = "com.baylo.app"
)

function Fail([string] $m) { Write-Host "  FAIL  $m" -ForegroundColor Red; exit 1 }
function Ok  ([string] $m) { Write-Host "  OK    $m" -ForegroundColor Green }
function Warn([string] $m) { Write-Host "  WARN  $m" -ForegroundColor Yellow }
function Note([string] $m) { Write-Host "  NOTE  $m" -ForegroundColor DarkGray }
function Step([string] $m) { Write-Host ""; Write-Host "  $m" -ForegroundColor Cyan }

$projectRoot = Split-Path -Parent $PSScriptRoot
$hotspotIp   = '192.168.137.1'

Step "phone connection check  (mode: $Mode)"

# 1 -- adb -------------------------------------------------------------------
if (-not (Test-Path $Adb)) {
  Fail "adb not found at $Adb  (install Android Platform Tools, or pass -Adb <path>)"
}
Ok "adb found"

# 2 -- the device ------------------------------------------------------------
#
# @() IS LOAD-BEARING. `Where-Object` returns a bare [string] when exactly one
# line matches, and indexing a string yields a CHARACTER -- so `$devices[0]`
# was "R", every subsequent `adb -s R ...` failed with "device 'R' not found",
# and the script reported a connected phone it could not actually talk to.
# Wrapping in @() forces an array whether one line matches or five, which is
# the only form where [0] means "the first device".
$lines = @(& $Adb devices | Select-Object -Skip 1 | Where-Object { $_.Trim() })

if ($lines.Count -eq 0) {
  Fail "no device attached. Plug the phone in, then see the USB-debugging steps in README.md"
}
if (@($lines | Where-Object { $_ -match "unauthorized" }).Count -gt 0) {
  Fail "phone attached but UNAUTHORISED - unlock it and tap 'Allow' on the 'Allow USB debugging?' dialog, then re-run"
}
if (@($lines | Where-Object { $_ -match "offline" }).Count -gt 0) {
  Fail @"
phone is 'offline' - adb sees it but cannot talk to it.

    In order, these fix it:
      1  unplug and replug the cable, then re-run
      2  "$Adb" kill-server ; "$Adb" start-server
      3  on the phone: Developer options > Revoke USB debugging
         authorisations, then replug and tap Allow

    A cable that reports 'offline' repeatedly is usually the cable, not the
    phone. That is the reason -Mode hotspot exists: it needs the cable ONCE,
    to write the host, and never again.
"@
}

$devices = @($lines | Where-Object { $_ -match "\sdevice(\s|$)" })
if ($devices.Count -eq 0) { Fail "device present but not ready: $($lines -join '; ')" }
if ($devices.Count -gt 1) { Warn "more than one device attached; using the first" }

$serial = ($devices[0] -split "\s+")[0]
if ([string]::IsNullOrWhiteSpace($serial) -or $serial.Length -lt 4) {
  Fail "could not parse a device serial from: $($devices[0])"
}
$model = (& $Adb -s $serial shell getprop ro.product.model 2>$null | Out-String).Trim()
Ok "device $serial ($model)"

# -- the persisted preference, read BEFORE anything is changed ---------------
#
# "Which host is this app actually reaching for" is the question every
# white-screen session starts with, and it is answerable only from the device.
$prefsPath = "shared_prefs/${Package}_preferences.xml"

function Read-PrefsXml {
  $raw = (& $Adb -s $serial shell "run-as $Package cat $prefsPath 2>/dev/null" | Out-String).Trim()
  if ($raw -match "run-as: |not debuggable|unknown package|is not debuggable") { return "" }
  return $raw
}

$existingXml = Read-PrefsXml
if ($existingXml -match '<string name="debug_http_host">([^<]*)</string>') {
  Note "device currently has debug_http_host = $($Matches[1])"
} else {
  Note "device has no persisted debug_http_host (RN falls back to localhost)"
}

# -- -ClearBundleHost / -ShowOnly: do that and stop --------------------------
if ($ClearBundleHost) {
  Step "clearing the persisted bundle host"
  if (-not $existingXml) {
    Ok "nothing to clear - no readable preferences file"
    exit 0
  }
  $cleared = $existingXml -replace '\s*<string name="debug_http_host">[^<]*</string>', ''
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($cleared))
  & $Adb -s $serial shell "run-as $Package sh -c 'echo $b64 | base64 -d > $prefsPath'" | Out-Null
  if ((Read-PrefsXml) -match 'debug_http_host') {
    Fail "the preference is still present after the write - clear it by hand, or reinstall the app"
  }
  Ok "debug_http_host removed"
  Note "force-close the app for this to take effect; RN reads the preference at startup"
  exit 0
}

if ($ShowOnly) {
  Step "nothing changed (-ShowOnly)"
  exit 0
}

# 3 -- work out the host Metro must advertise --------------------------------
#
# The old version picked `PrefixOrigin -eq 'Dhcp'`, which on this machine
# selects the Wi-Fi lease -- the single most volatile address available, and
# the exact reason a hard-coded 10.141.x.x kept turning up. The hotspot is a
# fixed *Manual* address, so the filter that used to find the answer now
# excludes the only stable candidate.
function Get-LanIp {
  (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -ne '127.0.0.1' -and
      $_.IPAddress -notlike '169.254.*' -and
      $_.PrefixOrigin -eq 'Dhcp'
    } | Select-Object -First 1).IPAddress
}

if ($BundleHost) {
  $metroHost = $BundleHost
  Note "using -BundleHost override: $metroHost"
}
elseif ($Mode -eq 'tunnel') {
  $metroHost = 'localhost'
}
elseif ($Mode -eq 'hotspot') {
  $haveHotspot = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
                   Where-Object { $_.IPAddress -eq $hotspotIp }).Count -gt 0
  if (-not $haveHotspot) {
    Fail @"
Mobile Hotspot is not up - no adapter holds $hotspotIp.

    Turn it on:  Settings > Network & Internet > Mobile hotspot
                 (or the Mobile hotspot tile in the Win+A quick settings panel)
    Then join the PHONE to that hotspot and re-run this script.

    Windows always assigns the hosted network $hotspotIp. That it cannot drift
    is the entire reason this mode is the supported one.
"@
  }
  $metroHost = $hotspotIp
}
else {
  $metroHost = Get-LanIp
  if (-not $metroHost) { Fail "no DHCP IPv4 address found for -Mode lan" }
  Warn "-Mode lan pins $metroHost, which changes on the next DHCP lease. Prefer -Mode hotspot."
}

Ok "Metro host for this run: ${metroHost}:${MetroPort}"

# 4 -- the servers, started rather than complained about ---------------------
#
# The old version failed with "start Metro first", which is a script telling
# you to go and do the thing it was run in order to do.
function Test-Listening([int] $Port) {
  $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Wait-ForPort([int] $Port, [int] $TimeoutSec) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (Test-Listening $Port) { return $true }
    Start-Sleep -Milliseconds 1000
  }
  return $false
}

Step "servers"

if (Test-Listening $MetroPort) {
  Ok "Metro already listening on $MetroPort"
  Note "if that Metro was started WITHOUT REACT_NATIVE_PACKAGER_HOSTNAME=$metroHost"
  Note "it is advertising a different host. Close its window and re-run this"
  Note "script if the app reaches for an address you do not expect."
}
elseif ($NoStart) {
  Fail "nothing is listening on $MetroPort and -NoStart was given"
}
else {
  # REACT_NATIVE_PACKAGER_HOSTNAME is the documented lever for the host Expo
  # advertises. Setting it here means Metro, the QR code, and every URL the CLI
  # prints all agree with the host about to be persisted -- that disagreement
  # is what made tunnel and lan mode interfere with each other.
  $hostFlag = if ($Mode -eq 'tunnel') { 'localhost' } else { 'lan' }
  Note "starting Metro with REACT_NATIVE_PACKAGER_HOSTNAME=$metroHost --host $hostFlag"
  Start-Process -FilePath 'cmd.exe' `
                -ArgumentList '/c', "set REACT_NATIVE_PACKAGER_HOSTNAME=$metroHost && npx expo start --host $hostFlag" `
                -WorkingDirectory $projectRoot | Out-Null

  if (Wait-ForPort $MetroPort $StartTimeoutSec) {
    Ok "Metro came up on $MetroPort"
  } else {
    Fail "Metro did not start within ${StartTimeoutSec}s - check the window it opened"
  }
}

if (Test-Listening $ApiPort) {
  Ok "API already listening on $ApiPort"
}
elseif ($NoStart) {
  Warn "nothing is listening on $ApiPort and -NoStart was given; login will fail"
}
else {
  $apiDir = Join-Path (Split-Path -Parent $projectRoot) 'baylo'
  if (-not (Test-Path $apiDir)) {
    Warn "API project not found at $apiDir - start it yourself"
  } else {
    # -H 0.0.0.0 matters in hotspot and lan mode: Next binds localhost by
    # default, and a server bound to localhost is unreachable from the phone no
    # matter how correct the address it is dialling.
    Note "starting the API in $apiDir on 0.0.0.0:$ApiPort"
    Start-Process -FilePath 'cmd.exe' `
                  -ArgumentList '/c', "npx next dev -H 0.0.0.0 -p $ApiPort" `
                  -WorkingDirectory $apiDir | Out-Null

    if (Wait-ForPort $ApiPort $StartTimeoutSec) {
      Ok "API came up on $ApiPort"
    } else {
      Warn "the API did not come up within ${StartTimeoutSec}s - the app will reach the login screen but not get past it"
    }
  }
}

# 5 -- reachability plumbing -------------------------------------------------
if ($Mode -eq 'tunnel') {
  Step "tunnels"
  foreach ($port in @($MetroPort, $ApiPort)) {
    & $Adb -s $serial reverse "tcp:$port" "tcp:$port" | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "adb reverse failed for tcp:$port" }
  }
  Ok "tunnels open: $((& $Adb -s $serial reverse --list) -join ', ')"
  Note "these lapse on unplug, reboot, or adb kill-server, and the failure looks like a white screen"
}
else {
  Step "firewall"
  # The reason lan and hotspot mode "just do not work" for most people: Metro
  # is listening, the phone has a route, and Windows drops the SYN in silence.
  foreach ($port in @($MetroPort, $ApiPort)) {
    if (Get-NetFirewallRule -DisplayName "Baylo dev $port" -ErrorAction SilentlyContinue) {
      Ok "firewall rule present for $port"
    } else {
      try {
        New-NetFirewallRule -DisplayName "Baylo dev $port" -Direction Inbound `
          -Action Allow -Protocol TCP -LocalPort $port -Profile Any -ErrorAction Stop | Out-Null
        Ok "opened inbound TCP $port"
      } catch {
        Warn "could not open inbound TCP $port (needs an elevated shell). Run ONCE as Administrator:"
        Warn "  New-NetFirewallRule -DisplayName 'Baylo dev $port' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -Profile Any"
      }
    }
  }
}

# 6 -- prove it from the phone's own network stack ---------------------------
#
# This Android image has no curl or wget, so the probe is a raw HTTP/1.1
# request through toybox nc. `-w` matters: without a timeout nc waits on a
# half-closed socket and the check hangs instead of failing.
Step "reachability from the phone"

$probeHost = if ($Mode -eq 'tunnel') { 'localhost' } else { $metroHost }

function Invoke-PhoneProbe([string] $HostName, [int] $Port, [string] $Path) {
  & $Adb -s $serial shell "(printf 'GET $Path HTTP/1.1\r\nHost: $HostName\r\nConnection: close\r\n\r\n'; sleep 2) | nc -w 4 $HostName $Port 2>&1 | head -c 64"
}

$metroProbe = Invoke-PhoneProbe $probeHost $MetroPort '/status'
if ("$metroProbe" -match "200 OK") {
  Ok "phone reached Metro on ${probeHost}:${MetroPort}"
} elseif ("$metroProbe" -match "not found") {
  Note "no nc on this Android image - could not probe Metro"
} else {
  Warn "phone could not reach Metro at ${probeHost}:${MetroPort}. Got: $metroProbe"
  if ($Mode -ne 'tunnel') {
    Warn "check the phone is joined to this laptop's hotspot and not on mobile data"
  }
}

# A 401 here is a SUCCESS: it means /api/v1/hubs was reached and correctly
# refused an unauthenticated request.
$apiProbe = Invoke-PhoneProbe $probeHost $ApiPort '/api/v1/hubs'
if ("$apiProbe" -match "401") {
  Ok "phone reached /api/v1/hubs and got 401 (correct: no Bearer token yet)"
} elseif ("$apiProbe" -match "HTTP/1\.1 (\d{3})") {
  Warn "phone reached the API but got HTTP $($Matches[1]) (expected 401)"
} elseif ("$apiProbe" -match "not found") {
  Note "no nc on this Android image - could not probe the API"
} else {
  Warn "phone could not reach the API at ${probeHost}:${ApiPort}. Got: $apiProbe"
}

# 7 -- persist the host ------------------------------------------------------
#
# Always, in every mode. In tunnel mode the persisted value is `localhost`,
# which is what RN would have fallen back to anyway -- writing it explicitly
# costs nothing and means neither mode can leave the other's value behind.
# That mutual contamination is what made switching between them unpredictable.
Step "persisting the bundle host"

$hostValue = "${metroHost}:${MetroPort}"
$xml = Read-PrefsXml

# Read-modify-write rather than overwrite. RN's own DevInternalSettings keeps
# its toggles (hot reloading, the perf monitor, the element inspector) in this
# same default-preferences file, so clobbering it would silently reset them.
if ($xml -match "<map") {
  if ($xml -match 'name="debug_http_host"') {
    $xml = $xml -replace '<string name="debug_http_host">[^<]*</string>', "<string name=`"debug_http_host`">$hostValue</string>"
  } else {
    $xml = $xml -replace '</map>', "  <string name=`"debug_http_host`">$hostValue</string>`n</map>"
  }
} else {
  $xml = "<?xml version='1.0' encoding='utf-8' standalone='yes' ?>`n<map>`n  <string name=`"debug_http_host`">$hostValue</string>`n</map>"
}

# base64 over the wire so no quoting, newline or XML character has to survive
# two shells. Verified by reading the value back -- if the device image has no
# `base64`, that read is what tells you, rather than a silent no-op.
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($xml))
& $Adb -s $serial shell "run-as $Package sh -c 'echo $b64 | base64 -d > $prefsPath'" | Out-Null

if ((Read-PrefsXml) -match [Regex]::Escape($hostValue)) {
  Ok "debug_http_host = $hostValue  (survives force-close)"
} else {
  Warn "could not verify the preference was written - the app will fall back to localhost"
  Warn "if 'run-as' was refused, the installed APK is not a debuggable build"
}

# -- done --------------------------------------------------------------------
Write-Host ""
Write-Host "  Ready." -ForegroundColor Green
if ($Mode -eq 'hotspot') {
  Write-Host "  Force-close Baylo on the phone and reopen it. The cable is no longer needed." -ForegroundColor Green
  Write-Host "  Keep the phone on this laptop's hotspot; $metroHost does not change." -ForegroundColor Green
} elseif ($Mode -eq 'tunnel') {
  Write-Host "  Force-close Baylo and reopen it. Keep the cable in - the tunnel dies with it." -ForegroundColor Green
} else {
  Write-Host "  Force-close Baylo and reopen it. Re-run after any DHCP change." -ForegroundColor Green
}
Write-Host ""
