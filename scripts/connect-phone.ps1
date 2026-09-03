<#
.SYNOPSIS
  Gets the Baylo dev build talking to Metro and the API, and keeps it that way.

.DESCRIPTION
  There is ONE supported path, and it is the default: `wireless`.

  -- WHY WIRELESS, AND WHY HOTSPOT STOPPED BEING THE ANSWER ------------------

  Four routes exist. Three of them are traps on this machine.

    tunnel    `adb reverse tcp:8081` makes the phone's own localhost:8081 point
              at this machine. Correct, elegant, and it dies the moment the USB
              cable twitches. It also silently lapses on unplug, reboot, or
              `adb kill-server`, and the failure looks like a white screen
              rather than an error.

    lan       Metro on this laptop's Wi-Fi address, with the cable needed again
              every time that address changes. Works until DHCP hands out a
              different lease.

    hotspot   This laptop's OWN Mobile Hotspot, pinned by Windows to
              192.168.137.1. This was the documented path and it is now
              UNAVAILABLE here, for a reason no amount of retrying fixes:
              Windows will not share a connection with itself. When the
              laptop's only uplink is the phone's hotspot, there is nothing to
              share, so Mobile Hotspot refuses to start and 192.168.137.1 never
              carries traffic.

              Worse, it fails QUIETLY. Internet Connection Sharing parks
              192.168.137.1 on a disconnected virtual adapter anyway, so the
              address is present in ipconfig while nothing is behind it. The
              old check asked only whether the address existed and therefore
              answered yes. Test-HotspotUp now also requires AddressState
              'Preferred' on an adapter that is Up.

    wireless  (default)  Android 11+ wireless debugging. The phone is the
              access point; this laptop is a client on it. Same topology as
              hotspot mode with the roles the right way round -- which is the
              way round they were always going to be, since the phone is where
              the internet comes from.

  -- WHY WIRELESS IS THE STABLE ONE -----------------------------------------

  Because the phone is this laptop's DEFAULT GATEWAY, and a gateway address is
  not leased to us. The phone chooses it and holds it for the life of the
  hotspot, so `adb connect <gateway>` has a fixed target that needs neither a
  cable that stays up nor a hosted network Windows will not start.

  The pairing is the other half. Android 11 (API 30) added a TLS pairing code
  that does what the cable used to do -- authorise this host's key, once. It is
  stored on the phone and survives reboots and toggling the setting off and on.
  Before API 30 a key could only be authorised over USB. That makes API 30 a
  hard floor, and Assert-WirelessCapable checks it rather than assuming it.

  What is NOT stable, and how each is handled:

    the wireless-debugging PORT   Android randomises it on every toggle and
                                  every reboot. Discovered over mDNS each run;
                                  -PinPort trades it for a fixed 5555.

    this laptop's OWN address     Leased by the phone. Still drifts -- but the
                                  drift is now cheap, because rewriting
                                  debug_http_host no longer needs a cable. It
                                  costs one command instead of a hunt for a
                                  cable that still works.

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
  wireless (default)  adb over Wi-Fi. Android 11+. No cable, ever.
  hotspot             Metro on 192.168.137.1. Needs Windows Mobile Hotspot,
                      which cannot start when the phone is the uplink.
  tunnel              adb reverse; localhost:8081. Needs the cable to stay up.
  lan                 This machine's Wi-Fi DHCP address. Goes stale; avoid.

.PARAMETER Pair
  Force the pairing walkthrough even if a connection could be made. Pairing is
  normally automatic on first use -- this is for re-pairing after the phone's
  "Forget" button, or after a factory reset.

.PARAMETER PhoneIp
  The phone's address. Defaults to this machine's default gateway, which in the
  topology wireless mode exists for IS the phone.

.PARAMETER ConnectPort
  The port under "IP address & Port" on the phone's Wireless debugging screen.
  Only needed when mDNS discovery cannot find it, which happens on Android
  builds that do not forward multicast to their own hotspot clients.

.PARAMETER PinPort
  After connecting, run `adb tcpip 5555` so the port stops being random. Lasts
  until the phone reboots. Worth it when mDNS is unreliable on this hotspot.

.PARAMETER Unpair
  Disconnect and forget the remembered port. The pairing itself lives on the
  phone; drop it there under Wireless debugging > this laptop > Forget.

.PARAMETER WriteEnv
  Rewrite EXPO_PUBLIC_API_URL in .env to match this run. Off by default,
  because the gear's SecureStore override outranks .env anyway and needs no
  rebuild.

.PARAMETER ClearBundleHost
  Removes the persisted `debug_http_host` preference and stops. Use this when
  the app is reaching for an address you no longer recognise -- a stale value
  from an earlier attempt is invisible from the laptop and survives a rebuild,
  because it is app data rather than anything in the APK.

.PARAMETER ShowOnly
  Report what is set on the device and change nothing. Will not start a pairing
  walkthrough.

.EXAMPLE
  npm run phone
  The documented path. Wireless mode: connects over Wi-Fi, pairing first if it
  has to, persists the host, starts Metro and the API if they are not up.

.EXAMPLE
  npm run phone:pair
  Just the pairing walkthrough. Run this once, with the phone's "Pair device
  with pairing code" dialog open.

.EXAMPLE
  npm run phone:reset
  Forget the persisted host. Run this first if the app reaches a stale IP.
#>

[CmdletBinding()]
param(
  [ValidateSet('hotspot', 'tunnel', 'lan', 'wireless')]
  [string] $Mode      = 'wireless',
  [int]    $ApiPort   = 3000,
  [int]    $MetroPort = 8081,
  [string] $Adb       = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
  [string] $BundleHost,
  [switch] $ClearBundleHost,
  [switch] $ShowOnly,
  [switch] $NoStart,
  [int]    $StartTimeoutSec = 120,
  [string] $Package   = "com.baylo.app",

  # -- wireless mode (Android 11+ adb-over-Wi-Fi) ------------------------------
  # PhoneIp defaults to this machine's default gateway, which in the topology
  # this mode exists for IS the phone: the laptop is a DHCP client on the
  # phone's hotspot, so the phone is the router. Override it if the two are on
  # some other shared network instead.
  [string] $PhoneIp,
  [int]    $PairPort,
  [string] $PairCode,
  [int]    $ConnectPort,
  [switch] $Pair,
  [switch] $PinPort,
  [switch] $Unpair,
  [int]    $DiscoverTimeoutSec = 25,
  [switch] $WriteEnv
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

# 1b -- wireless debugging (Android 11+) --------------------------------------
#
# -- WHY THIS MODE EXISTS ----------------------------------------------------
#
# `hotspot` assumed this laptop could BE an access point. It cannot, when its
# only uplink is the phone's own hotspot: Windows will not share a connection
# with itself, so Mobile Hotspot refuses to start. Note that the failure is
# QUIET -- the Internet Connection Sharing service still parks 192.168.137.1 on
# a disconnected virtual adapter, so "does 192.168.137.1 exist" answers YES for
# an address nothing can reach. Test-HotspotUp below is the fix for that.
#
# That inverts the topology, and the inversion is an improvement. The PHONE is
# the access point; this laptop is a client on it. Which means the phone is
# this machine's DEFAULT GATEWAY -- and a gateway address is not leased to us.
# The phone picks it and keeps it for the life of the hotspot. So there is a
# stable target for `adb connect` needing neither a cable nor a hosted network,
# which is exactly what each of the other three modes failed to provide.
#
# Android 11 (API 30) supplies the missing half. Wireless debugging lets a
# pairing code over TLS do the job the cable used to do -- authorise this
# host's key, once. Before API 30 a key could only be authorised over USB, so
# even `adb tcpip` needed the cable first. API 30 is therefore a hard floor,
# and it is CHECKED rather than assumed: see Assert-WirelessCapable.
#
# -- WHAT IS STABLE HERE AND WHAT IS NOT -------------------------------------
#
#   stable   the phone's address -- it is the gateway
#            the pairing -- a stored host key; survives reboots and re-toggles
#
#   NOT      the wireless-debugging PORT. Android randomises it on every toggle
#            of the setting and on every reboot. So this mode DISCOVERS it over
#            mDNS instead of remembering one, and -PinPort exists to trade that
#            away for a fixed 5555.
#
#            this laptop's own address -- the phone's DHCP leases it. But that
#            is cheap now in a way it never was under -Mode lan: with adb over
#            Wi-Fi, re-running this script rewrites debug_http_host with no
#            cable at all. Drift costs one command instead of a hunt for a
#            cable that still works.

$stateDir  = Join-Path $projectRoot '.expo'
$statePath = Join-Path $stateDir 'wireless-adb.json'
$wirelessSerial = $null

function Read-WirelessState {
  if (-not (Test-Path $statePath)) { return $null }
  try { return (Get-Content $statePath -Raw | ConvertFrom-Json) } catch { return $null }
}

function Write-WirelessState([string] $DeviceIp, [int] $Port) {
  if (-not (Test-Path $stateDir)) {
    New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
  }
  [pscustomobject]@{
    phoneIp     = $DeviceIp
    connectPort = $Port
    written     = (Get-Date).ToString('s')
  } | ConvertTo-Json | Set-Content -Path $statePath -Encoding UTF8
}

# The gateway IS the phone in this topology.
function Get-PhoneIpGuess {
  $gw = @(Get-NetIPConfiguration -ErrorAction SilentlyContinue |
          Where-Object { $_.IPv4DefaultGateway } |
          ForEach-Object { $_.IPv4DefaultGateway.NextHop })
  if ($gw.Count -gt 0) { return $gw[0] }
  return $null
}

# This machine's source address for packets aimed at the phone. In wireless
# mode that is the address Metro must advertise, and asking the routing table
# is the only way to get it right on a box with seven IPv4 addresses -- six of
# which (link-local, VirtualBox, the dead hotspot) are wrong answers.
function Get-LocalIpToward([string] $Remote) {
  $r = @(Find-NetRoute -RemoteIPAddress $Remote -ErrorAction SilentlyContinue)
  if ($r.Count -gt 0 -and $r[0].IPAddress) { return $r[0].IPAddress }
  return $null
}

# `adb mdns services` prints one tab-separated row per service:
#   adb-<serial>-<rand>   _adb-tls-connect._tcp   10.141.155.223:41235
function Get-MdnsRows([string] $ServiceType) {
  $raw = @(& $Adb mdns services 2>&1 | Where-Object { $_ -match [Regex]::Escape($ServiceType) })
  $out = @()
  foreach ($row in $raw) {
    $pattern = '(\S+)\s+' + [Regex]::Escape($ServiceType) + '\.?\s+(\d{1,3}(?:\.\d{1,3}){3}):(\d+)'
    if ("$row" -match $pattern) {
      $out += [pscustomobject]@{ Name = $Matches[1]; Address = $Matches[2]; Port = [int]$Matches[3] }
    }
  }
  return $out
}

function Wait-MdnsService([string] $ServiceType, [int] $TimeoutSec, [string] $What) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $spun = $false
  while ((Get-Date) -lt $deadline) {
    $rows = @(Get-MdnsRows $ServiceType)
    if ($rows.Count -gt 0) {
      if ($spun) { Write-Host "" }
      return $rows
    }
    if (-not $spun) {
      Write-Host "        waiting for $What over mDNS" -NoNewline -ForegroundColor DarkGray
      $spun = $true
    }
    Write-Host "." -NoNewline -ForegroundColor DarkGray
    Start-Sleep -Milliseconds 1200
  }
  if ($spun) { Write-Host "" }
  return @()
}

# @() around the pipeline, for the reason documented in section 2: a single
# matching line comes back as a bare string, and indexing a string yields a
# character rather than the line.
function Get-AdbNetworkSerial {
  $rows = @(& $Adb devices 2>$null | Select-Object -Skip 1 |
            Where-Object { $_ -match '^\d{1,3}(\.\d{1,3}){3}:\d+\s' -and $_ -match "\sdevice(\s|$)" })
  if ($rows.Count -eq 0) { return $null }
  return ($rows[0] -split "\s+")[0]
}

# adb connect exits 0 even when it fails, so its OUTPUT is the return value.
# And confirm the device that appeared is the one we asked for: on a machine
# with a stale entry from an earlier port, "some network device is present" is
# not the same claim as "the connect worked".
function Invoke-AdbConnect([string] $DeviceIp, [int] $Port) {
  $target = "${DeviceIp}:${Port}"
  $out = (& $Adb connect $target 2>&1 | Out-String).Trim()
  if ($out -notmatch 'connected to' -or $out -match 'failed|cannot|refused|unable') { return $null }
  Start-Sleep -Milliseconds 700
  $exact = @(& $Adb devices 2>$null | Select-Object -Skip 1 |
             Where-Object { $_ -match ('^' + [Regex]::Escape($target) + '\s') -and $_ -match "\sdevice(\s|$)" })
  if ($exact.Count -gt 0) { return $target }
  return Get-AdbNetworkSerial
}

# THE GATE. Wireless debugging is API 30; below that the pairing screen does
# not exist and no amount of retrying conjures it, so say so plainly and hand
# back the options that DO still work rather than looping.
function Assert-WirelessCapable([string] $Serial) {
  $sdk     = (& $Adb -s $Serial shell getprop ro.build.version.sdk 2>$null | Out-String).Trim()
  $release = (& $Adb -s $Serial shell getprop ro.build.version.release 2>$null | Out-String).Trim()
  $phone   = (& $Adb -s $Serial shell getprop ro.product.model 2>$null | Out-String).Trim()
  $n = 0
  if (-not [int]::TryParse($sdk, [ref] $n)) {
    Warn "could not read ro.build.version.sdk from $Serial - skipping the version check"
    return
  }
  if ($n -lt 30) {
    Fail @"
this phone CANNOT do wireless debugging.

    $phone reports Android $release (API $n). Wireless debugging -- the
    "Pair device with pairing code" screen this mode drives -- arrived in
    Android 11 (API 30). It is not a hidden setting on API ${n}: the screen, and
    the adbd TLS pairing service behind it, are not in that build at all.

    Given a hotspot this laptop cannot host, what is actually left on API ${n}:

      1  adb tcpip over the cable ONCE per boot, then connect over Wi-Fi. The
         cable is needed for one command and can come straight back out; the
         connection then survives until the phone reboots.
           "$Adb" tcpip 5555
           "$Adb" connect <phone-ip>:5555
           npm run phone:lan

      2  npm run phone:lan on its own, re-run whenever the lease changes.

    Neither is as good as wireless debugging. API 30 is the floor, and this
    device is below it.
"@
  }
  Ok "Android $release (API $n) - wireless debugging supported"
}

function Show-PairingInstructions {
  Write-Host ""
  Write-Host "  On the phone, in this order:" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "    1  Settings > About phone > tap 'Build number' seven times" -ForegroundColor Gray
  Write-Host "       (only if Developer options is not already unlocked)" -ForegroundColor Gray
  Write-Host "    2  Settings > System > Developer options > Wireless debugging > ON" -ForegroundColor Gray
  Write-Host "    3  Tap 'Pair device with pairing code'" -ForegroundColor Gray
  Write-Host ""
  Write-Host "  Leave that dialog OPEN. The six-digit code and the port it shows are" -ForegroundColor Gray
  Write-Host "  valid only while it is on screen." -ForegroundColor Gray
  Write-Host ""
  Write-Host "  If Developer options has no 'Wireless debugging' entry at all, this" -ForegroundColor Gray
  Write-Host "  phone is below Android 11 and this mode cannot work. See README." -ForegroundColor Gray
  Write-Host ""
}

function Invoke-Pairing([string] $DeviceIp) {
  Step "pairing  (the once-only part)"
  Show-PairingInstructions

  if (-not [Environment]::UserInteractive) {
    Fail "pairing needs an interactive terminal - it has to read the six-digit code. Run 'npm run phone:pair' from a console."
  }

  Read-Host "  Press Enter once the pairing dialog is open on the phone" | Out-Null

  $pairHost = $DeviceIp
  $pPort    = $PairPort

  if (-not $pPort) {
    # The pairing port is per-dialog and random. mDNS learns it without the
    # user transcribing anything -- but see the fallback: multicast is the
    # first thing a phone-hosted hotspot tends not to forward.
    $rows = @(Wait-MdnsService '_adb-tls-pairing._tcp' $DiscoverTimeoutSec 'the pairing dialog')
    if ($rows.Count -gt 0) {
      $pairHost = $rows[0].Address
      $pPort    = $rows[0].Port
      Ok "found the pairing service at ${pairHost}:${pPort}"
    } else {
      Warn "mDNS did not surface the pairing service"
      Note "Common on a phone-hosted hotspot: some Android builds do not forward"
      Note "multicast to their own clients. Read the address off the dialog instead."
      $typed = (Read-Host "  'IP address & Port' shown in the dialog (e.g. ${DeviceIp}:37129)").Trim()
      if ($typed -match '^(\d{1,3}(?:\.\d{1,3}){3}):(\d+)$') {
        $pairHost = $Matches[1]
        $pPort    = [int]$Matches[2]
      } elseif ($typed -match '^(\d+)$') {
        $pPort = [int]$Matches[1]
      } else {
        Fail "could not read an address or a port from '$typed'"
      }
    }
  }

  $code = $PairCode
  if (-not $code) { $code = (Read-Host "  Six-digit pairing code").Trim() }
  if ($code -notmatch '^\d{6}$') { Fail "'$code' is not a six-digit pairing code" }

  Note "adb pair ${pairHost}:${pPort}"
  $out = (& $Adb pair "${pairHost}:${pPort}" $code 2>&1 | Out-String).Trim()

  if ($out -match 'Successfully paired') {
    Ok "paired - this host's key is trusted by the phone from now on"
    return
  }

  Fail @"
pairing failed. adb said:

    $out

    The usual causes, in the order they actually happen:
      -  the dialog closed or timed out. Its code and port live only while it
         is on screen, so re-run and enter the code promptly.
      -  the code was mistyped.
      -  this laptop dropped off the phone's hotspot. Re-join it and re-run.
      -  a VPN adapter is holding the route to $pairHost.
"@
}

# -- establish the wireless connection ---------------------------------------
if ($Mode -eq 'wireless' -or $Pair -or $Unpair) {

  Step "wireless adb"

  $state = Read-WirelessState

  if (-not $PhoneIp) { $PhoneIp = if ($state) { $state.phoneIp } else { $null } }
  if (-not $PhoneIp) { $PhoneIp = Get-PhoneIpGuess }
  if (-not $PhoneIp) {
    Fail @"
could not work out the phone's address.

    This mode assumes the laptop is a CLIENT on the phone's hotspot, which
    makes the phone this machine's default gateway. No default gateway was
    found, so either the Wi-Fi is off or the laptop is not on the hotspot.

    Join the phone's hotspot and re-run, or name the address yourself:
      powershell -ExecutionPolicy Bypass -File scripts/connect-phone.ps1 -Mode wireless -PhoneIp 192.168.43.1
"@
  }

  if ($state -and $state.phoneIp -and $state.phoneIp -ne $PhoneIp) {
    Note "phone was at $($state.phoneIp) last time, is at $PhoneIp now"
  }
  Ok "phone address: $PhoneIp"

  if (-not (Test-Connection -ComputerName $PhoneIp -Count 1 -Quiet -ErrorAction SilentlyContinue)) {
    Fail @"
$PhoneIp does not answer a ping.

    The laptop is not on the same network as the phone. Turn the phone's
    hotspot on, join this laptop to it, and re-run.

    If it IS joined and this still fails, the phone may be blocking ICMP; pass
    the address explicitly to skip this check being the thing that stops you:
      powershell -ExecutionPolicy Bypass -File scripts/connect-phone.ps1 -Mode wireless -PhoneIp $PhoneIp -ConnectPort <port>
"@
  }
  Ok "phone answers at $PhoneIp"

  # THE VERSION QUESTION, ANSWERED AS EARLY AS IT CAN BE.
  #
  # If the cable happens to be up at this moment -- it does not have to stay up,
  # and this mode exists precisely because it will not -- then a definitive
  # answer costs one getprop. Take it. The alternative is walking someone
  # through "Settings > Developer options > Wireless debugging" and letting them
  # discover for themselves that the entry is not there, which is both slower
  # and a worse way to find out.
  $usb = @(& $Adb devices 2>$null | Select-Object -Skip 1 |
           Where-Object { $_ -notmatch '^\d{1,3}(\.\d{1,3}){3}:\d+\s' -and $_ -match "\sdevice(\s|$)" })
  if ($usb.Count -gt 0 -and -not $Unpair) {
    Note "a cable is up right now - using it to settle the Android version first"
    Assert-WirelessCapable (($usb[0] -split "\s+")[0])
  }

  if ($Unpair) {
    Step "forgetting the wireless connection"
    & $Adb disconnect 2>&1 | Out-Null
    if (Test-Path $statePath) { Remove-Item $statePath -Force }
    Ok "disconnected, and the remembered port is gone"
    Note "The PAIRING itself lives on the phone. To drop it there:"
    Note "  Developer options > Wireless debugging > tap this laptop > Forget"
    exit 0
  }

  # Already connected from an earlier run? adb's own mDNS auto-connect
  # (ADB_MDNS_AUTO_CONNECT, default adb-tls-connect) often gets there first.
  $wirelessSerial = Get-AdbNetworkSerial

  if ($wirelessSerial -and -not $Pair) {
    Ok "already connected: $wirelessSerial"
  }
  elseif (-not $Pair) {
    # Candidate ports, cheapest first. The remembered one usually still works
    # within a session; 5555 is there for a phone that has been -PinPort'ed.
    $candidates = @()
    if ($ConnectPort) { $candidates += [int]$ConnectPort }
    if ($state -and $state.connectPort) { $candidates += [int]$state.connectPort }
    $candidates += 5555
    $candidates = @($candidates | Select-Object -Unique)

    foreach ($p in $candidates) {
      Note "trying ${PhoneIp}:${p}"
      $wirelessSerial = Invoke-AdbConnect $PhoneIp $p
      if ($wirelessSerial) { Ok "connected on port $p"; Write-WirelessState $PhoneIp $p; break }
    }

    # Nothing known worked. The port has been reshuffled, so discover it.
    if (-not $wirelessSerial) {
      Note "no remembered port answered - the phone reshuffles it on every toggle and reboot"
      Note "make sure Developer options > Wireless debugging is ON, then wait"
      $rows = @(Wait-MdnsService '_adb-tls-connect._tcp' $DiscoverTimeoutSec 'wireless debugging')
      foreach ($row in $rows) {
        $wirelessSerial = Invoke-AdbConnect $row.Address $row.Port
        if ($wirelessSerial) {
          Ok "connected on discovered port $($row.Port)"
          Write-WirelessState $row.Address $row.Port
          break
        }
      }
    }
  }

  # -ShowOnly promises to change nothing and is the first thing you reach for
  # when something is wrong. Dragging it into an interactive pairing walkthrough
  # would break both halves of that. Report and move on -- a USB device, if one
  # happens to be attached, still answers the question.
  if (-not $wirelessSerial -and $ShowOnly) {
    Warn "not connected over Wi-Fi (run 'npm run phone:pair' to set that up)"
  }
  # Still nothing: either never paired, or the pairing was forgotten.
  elseif (-not $wirelessSerial) {
    if (-not $Pair) {
      Warn "could not connect with an existing pairing - falling through to pairing"
    }
    Invoke-Pairing $PhoneIp

    # After pairing, adb's mDNS auto-connect frequently lands the device
    # before we ask. Give it a moment, then discover and connect explicitly.
    Start-Sleep -Seconds 2
    $wirelessSerial = Get-AdbNetworkSerial

    if (-not $wirelessSerial) {
      $rows = @(Wait-MdnsService '_adb-tls-connect._tcp' $DiscoverTimeoutSec 'wireless debugging')
      foreach ($row in $rows) {
        $wirelessSerial = Invoke-AdbConnect $row.Address $row.Port
        if ($wirelessSerial) { Write-WirelessState $row.Address $row.Port; break }
      }
    }

    if (-not $wirelessSerial -and $ConnectPort) {
      $wirelessSerial = Invoke-AdbConnect $PhoneIp $ConnectPort
      if ($wirelessSerial) { Write-WirelessState $PhoneIp $ConnectPort }
    }

    if (-not $wirelessSerial) {
      Fail @"
paired, but could not then CONNECT.

    Pairing and connecting are two different services on two different ports,
    and only pairing is the one the code applies to. The connect port is the
    one printed under 'IP address & Port' on the Wireless debugging screen
    ITSELF -- not the one in the pairing dialog, which is now gone.

    Read that port off the phone and pass it once:
      powershell -ExecutionPolicy Bypass -File scripts/connect-phone.ps1 -Mode wireless -ConnectPort <port>

    The pairing is done and does not need repeating.
"@
    }
  }

  # Everything below needs a device to talk to. -ShowOnly can legitimately get
  # this far without one, having declined to pair, so guard rather than assume:
  # an unguarded Assert-WirelessCapable would shell out with an empty -s and
  # report "could not read the SDK" about a device that was never there.
  if ($wirelessSerial) {
    Ok "wireless device: $wirelessSerial"

    # The version gate runs HERE rather than earlier because reading a build
    # property needs a device to read it from, and in this mode the wireless
    # connection is the first one there is. A phone that got this far has
    # already proved API 30 by answering a TLS pairing -- this turns that
    # inference into a stated fact, and it catches an unrelated USB device
    # having been picked up by accident.
    Assert-WirelessCapable $wirelessSerial

    if ($PinPort) {
      # Trades Android's randomised port for a fixed 5555, so later runs skip
      # mDNS entirely. It lasts until the phone reboots and no longer: adbd
      # returns to its normal mode on boot. Worth doing when mDNS is flaky on
      # this hotspot; unnecessary otherwise.
      Step "pinning the port to 5555"
      & $Adb -s $wirelessSerial tcpip 5555 2>&1 | Out-String | ForEach-Object { Note $_.Trim() }
      Start-Sleep -Seconds 3
      $pinned = Invoke-AdbConnect $PhoneIp 5555
      if ($pinned) {
        $wirelessSerial = $pinned
        Write-WirelessState $PhoneIp 5555
        Ok "adbd is on ${PhoneIp}:5555 until the phone reboots"
      } else {
        Warn "could not reconnect on 5555 - staying on the discovered port"
        Note "some OEM builds refuse 'adb tcpip' over a wireless connection; run it on the cable if you want this"
      }
    }
  }
}

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
  Fail @"
no device attached.

    Cable: plug the phone in and follow the USB-debugging steps in README.md.
    No cable: npm run phone:wireless  (Android 11 or newer, pairs over Wi-Fi)
"@
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
if ($devices.Count -gt 1 -and -not $wirelessSerial) { Warn "more than one device attached; using the first" }

# In wireless mode the device that matters is the one over Wi-Fi, and there is
# very often a USB device listed beside it -- half-connected on a cable that is
# on its way out, which is the whole reason this mode exists. Picking [0] would
# silently do all the work over that cable and prove nothing.
if ($wirelessSerial) {
  $serial = $wirelessSerial
} else {
  $serial = ($devices[0] -split "\s+")[0]
}
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

# A hotspot address EXISTING is not a hotspot being up. When Windows refuses to
# start Mobile Hotspot -- which it does whenever the only uplink is itself a
# tethered connection, because it will not share a connection with itself --
# the Internet Connection Sharing service has already parked 192.168.137.1 on
# the virtual adapter. That adapter then sits Disconnected with the address in
# AddressState 'Tentative', and the old presence-only check happily returned
# true for an address with nothing behind it. Both extra conditions are load-
# bearing: a live hotspot is 'Preferred' on an adapter that is Up.
function Test-HotspotUp {
  $addr = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -eq $hotspotIp })
  if ($addr.Count -eq 0) { return $false }
  if ($addr[0].AddressState -ne 'Preferred') { return $false }
  $ad = @(Get-NetAdapter -IncludeHidden -ErrorAction SilentlyContinue |
          Where-Object { $_.ifIndex -eq $addr[0].InterfaceIndex })
  if ($ad.Count -eq 0) { return $false }
  return ($ad[0].Status -eq 'Up')
}

if ($BundleHost) {
  $metroHost = $BundleHost
  Note "using -BundleHost override: $metroHost"
}
elseif ($Mode -eq 'tunnel') {
  $metroHost = 'localhost'
}
elseif ($Mode -eq 'wireless') {
  # Not Get-LanIp. On this machine that picks *a* DHCP address, and there is
  # more than one candidate; the right answer is specifically the address this
  # box would use to reach the phone, which is a routing-table question.
  $metroHost = Get-LocalIpToward $PhoneIp
  if (-not $metroHost) {
    Fail "could not find this machine's address on the phone's network (route to $PhoneIp)"
  }
  Note "this laptop is $metroHost on the phone's hotspot; the phone is $PhoneIp"
  Note "that lease can change - but re-running this over Wi-Fi fixes it without a cable"
}
elseif ($Mode -eq 'hotspot') {
  if (-not (Test-HotspotUp)) {
    Fail @"
Mobile Hotspot is not up.

    Turn it on:  Settings > Network & Internet > Mobile hotspot
                 (or the Mobile hotspot tile in the Win+A quick settings panel)
    Then join the PHONE to that hotspot and re-run this script.

    IF WINDOWS REFUSES TO TURN IT ON, that is expected rather than broken: it
    will not share a connection with itself, so a laptop whose only internet
    comes from the phone's own hotspot has nothing to share and this mode
    cannot work at all. Use wireless debugging instead -- the phone becomes
    the access point and this laptop the client, which is the same topology
    with the roles the right way round:

        npm run phone:wireless

    (Do not be reassured by $hotspotIp showing up in ipconfig. ICS parks that
    address on a disconnected virtual adapter whether or not the hotspot ever
    started, which is exactly what this check now looks past.)
"@
  }
  $metroHost = $hotspotIp
}
else {
  $metroHost = Get-LanIp
  if (-not $metroHost) { Fail "no DHCP IPv4 address found for -Mode lan" }
  Warn "-Mode lan pins $metroHost, which changes on the next DHCP lease. Prefer -Mode wireless."
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

# 8 -- the OTHER host, the one this script does not own ----------------------
#
# debug_http_host gets the app's JS bundle. It does not get the app to the API:
# that address is EXPO_PUBLIC_API_URL, inlined into the bundle at build time,
# and it has its own way of going stale. Under -Mode hotspot the two agreed by
# accident, because 192.168.137.1 was hard-coded in both. Under wireless they
# cannot agree by accident, because the address is a lease.
#
# So check, and say so. A silent mismatch here looks exactly like a broken
# login rather than a wrong address, and that has cost hours before.
$envPath = Join-Path $projectRoot '.env'
if ($Mode -ne 'tunnel' -and (Test-Path $envPath)) {
  $envText  = Get-Content $envPath -Raw
  $wantApi  = "http://${metroHost}:${ApiPort}"
  if ($envText -match '(?m)^\s*EXPO_PUBLIC_API_URL\s*=\s*(\S+)\s*$') {
    $haveApi = $Matches[1]
    if ($haveApi -ne $wantApi) {
      Step "the API address in .env does not match"
      Warn ".env has EXPO_PUBLIC_API_URL=$haveApi"
      Warn "this run needs        EXPO_PUBLIC_API_URL=$wantApi"
      Write-Host ""
      Write-Host "    Two ways out, and the first needs no rebuild:" -ForegroundColor Gray
      Write-Host ""
      Write-Host "      1  The gear on the login screen. Set the base URL to" -ForegroundColor Gray
      Write-Host "         $wantApi there. It writes an override to SecureStore" -ForegroundColor Gray
      Write-Host "         that OUTRANKS .env, so nothing has to be rebuilt -- and note" -ForegroundColor Gray
      Write-Host "         that while it is set, editing .env does nothing at all." -ForegroundColor Gray
      Write-Host ""
      Write-Host "      2  Edit .env, then restart Metro with --clear. The value is" -ForegroundColor Gray
      Write-Host "         inlined at BUILD time, so a Metro already running serves the" -ForegroundColor Gray
      Write-Host "         old one no matter what the file says." -ForegroundColor Gray
      Write-Host ""
      Write-Host "         Or have this script do both:" -ForegroundColor Gray
      Write-Host "         powershell -ExecutionPolicy Bypass -File scripts/connect-phone.ps1 -Mode $Mode -WriteEnv" -ForegroundColor Gray
      Write-Host ""
      if ($WriteEnv) {
        $updated = $envText -replace '(?m)^(\s*EXPO_PUBLIC_API_URL\s*=\s*)\S+\s*$', "`${1}$wantApi"
        Set-Content -Path $envPath -Value $updated -Encoding UTF8 -NoNewline
        Ok "wrote EXPO_PUBLIC_API_URL=$wantApi into .env"
        Warn "Metro must be restarted with --clear for that to reach the bundle."
        Warn "Close the Metro window this script opened and re-run, or run: npx expo start --clear"
        Note "a gear override, if one is set, still outranks this"
      }
    } else {
      Ok "EXPO_PUBLIC_API_URL agrees with this run ($wantApi)"
      Note "unless the gear's override is set - that outranks .env and only the phone can show it"
    }
  }
}

# -- done --------------------------------------------------------------------
Write-Host ""
Write-Host "  Ready." -ForegroundColor Green
if ($Mode -eq 'hotspot') {
  Write-Host "  Force-close Baylo on the phone and reopen it. The cable is no longer needed." -ForegroundColor Green
  Write-Host "  Keep the phone on this laptop's hotspot; $metroHost does not change." -ForegroundColor Green
} elseif ($Mode -eq 'tunnel') {
  Write-Host "  Force-close Baylo and reopen it. Keep the cable in - the tunnel dies with it." -ForegroundColor Green
} elseif ($Mode -eq 'wireless') {
  Write-Host "  Force-close Baylo on the phone and reopen it. No cable, now or later." -ForegroundColor Green
  Write-Host "  Keep the laptop on the phone's hotspot." -ForegroundColor Green
  Write-Host ""
  Write-Host "  Next time: npm run phone:wireless. The pairing is stored on the phone" -ForegroundColor Green
  Write-Host "  and does not need repeating - not after a reboot, not after toggling" -ForegroundColor Green
  Write-Host "  wireless debugging off and on. Only the PORT changes, and that is what" -ForegroundColor Green
  Write-Host "  the mDNS discovery step is for." -ForegroundColor Green
  Write-Host ""
  Write-Host "  If it ever cannot find the port, the phone's Wireless debugging screen" -ForegroundColor DarkGray
  Write-Host "  prints it under 'IP address & Port':" -ForegroundColor DarkGray
  Write-Host "    npm run phone:wireless -- -ConnectPort <port>" -ForegroundColor DarkGray
} else {
  Write-Host "  Force-close Baylo and reopen it. Re-run after any DHCP change." -ForegroundColor Green
}
Write-Host ""
