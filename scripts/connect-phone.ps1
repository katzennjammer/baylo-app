<#
.SYNOPSIS
  Confirms a USB-connected Android phone is ready and opens the port tunnel.

.DESCRIPTION
  Four things have to be true before the app can talk to the Next.js dev server
  over USB, and when one of them is not, the app shows the same generic network
  error for all four. This checks them in the order they fail and says which.

    1  adb exists
    2  exactly one phone is attached AND authorised
    3  the dev server is actually listening on this machine
    4  the reverse tunnel is open

  Step 4 is the one that silently lapses: `adb reverse` does not survive
  unplugging the phone, rebooting it, or restarting the adb server. Re-run this
  script whenever the app stops reaching the API for no apparent reason.
#>

[CmdletBinding()]
param(
  [int]    $Port = 3000,
  [string] $Adb  = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
)

function Fail([string] $m) { Write-Host "  FAIL  $m" -ForegroundColor Red; exit 1 }
function Ok([string] $m)   { Write-Host "  OK    $m" -ForegroundColor Green }

Write-Host ""
Write-Host "  phone connection check" -ForegroundColor Cyan

# 1 ── adb
if (-not (Test-Path $Adb)) {
  Fail "adb not found at $Adb  (install Android Platform Tools, or pass -Adb <path>)"
}
Ok "adb found"

# 2 ── the device
$lines = & $Adb devices | Select-Object -Skip 1 | Where-Object { $_.Trim() }
if (-not $lines) {
  Fail "no device attached. Plug the phone in, then see the USB-debugging steps in README.md"
}

$unauthorised = $lines | Where-Object { $_ -match "unauthorized" }
if ($unauthorised) {
  Fail "phone attached but UNAUTHORISED - unlock it and tap 'Allow' on the 'Allow USB debugging?' dialog, then re-run"
}

$offline = $lines | Where-Object { $_ -match "offline" }
if ($offline) {
  Fail "phone is 'offline' - unplug, replug, and re-run. If it persists: adb kill-server; adb start-server"
}

$devices = $lines | Where-Object { $_ -match "\sdevice$" }
if ($devices.Count -eq 0) { Fail "device present but not ready: $lines" }
if ($devices.Count -gt 1) {
  Write-Host "  WARN  more than one device attached; adb reverse will need -s <serial>" -ForegroundColor Yellow
}
$serial = ($devices[0] -split "\s+")[0]
$model  = (& $Adb -s $serial shell getprop ro.product.model 2>$null).Trim()
Ok "device $serial ($model)"

# 3 ── the dev server. Tunnelling to a port nothing listens on produces a
#      connection error on the phone that looks exactly like a bad URL.
$listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
  Fail "nothing is listening on localhost:$Port - start the API first:  cd ..\baylo; npx next dev"
}
Ok "dev server listening on localhost:$Port"

# 4 ── the tunnel
& $Adb -s $serial reverse "tcp:$Port" "tcp:$Port" | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "adb reverse failed" }
$active = & $Adb -s $serial reverse --list
Ok "tunnel open: $active"

# Prove it end to end from the phone's own network stack rather than asserting
# it. A 401 here is a SUCCESS: it means /api/v1/home was reached and correctly
# refused an unauthenticated request.
$probe = & $Adb -s $serial shell "curl -s -o /dev/null -w '%{http_code}' http://localhost:$Port/api/v1/home" 2>$null
if ($probe -match "401") {
  Ok "phone reached /api/v1/home and got 401 (correct: no Bearer token yet)"
} elseif ($probe -match "^\d{3}$") {
  Write-Host "  WARN  phone reached the API but got HTTP $probe (expected 401)" -ForegroundColor Yellow
} else {
  Write-Host "  NOTE  could not probe from the device (no curl in this Android image) - the tunnel is open regardless" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "  Ready. Now:  npx expo start --clear   then press 'a'" -ForegroundColor Green
Write-Host ""
