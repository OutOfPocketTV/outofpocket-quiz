# Out Of Pocket -- one-click show start.
#
# Replaces the sequence that was previously four manual steps and produced a
# blank white iPad whenever any of them was skipped or done out of order:
#   kill whatever relay is already running -> start it bound to the LAN ->
#   wait for the port -> open the operator console.
#
# The single most important thing this does is KILL FIRST. Windows lets a
# 127.0.0.1:4700 bind and a 0.0.0.0:4700 bind coexist, and loopback traffic
# prefers the specific one -- so launching a second relay silently splits the
# console onto one process and the iPad onto another, with both ends looking
# healthy and nothing flowing between them. Always starting from zero relays
# makes that unreachable.
#
# Close this window to stop the show. That is the whole mental model.

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

function Line($t, $c = "Gray") { Write-Host $t -ForegroundColor $c }

Clear-Host
Line ""
Line "  OUT OF POCKET -- starting the show" "Magenta"
Line "  ============================================================" "DarkMagenta"
Line ""

# --- 1. Clear any relay that is already listening -----------------------
# By PID off the actual listening socket, and only if it is node. Killing by
# image name once took down a live relay and lost a real answer.
$existing = @(Get-NetTCPConnection -LocalPort 4700 -State Listen -ErrorAction SilentlyContinue |
              Select-Object -ExpandProperty OwningProcess -Unique)
$killed = 0
foreach ($procId in $existing) {
  $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
  if ($p -and $p.ProcessName -eq "node") {
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    $killed++
  }
}
if ($killed -gt 0) {
  Line "  Cleared $killed relay(s) that were already running." "DarkGray"
  Start-Sleep -Milliseconds 700
}

# --- 2. Find the LAN address the iPad has to dial -----------------------
# The adapter holding the default route, so VirtualBox's 192.168.56.x and
# any idle Wi-Fi adapter cannot win.
$ip = (Get-NetIPConfiguration |
       Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.IPv4Address } |
       Select-Object -First 1).IPv4Address.IPAddress

if (-not $ip) {
  Line "  Could not find a LAN address -- is the network cable in?" "Red"
  Line "  The console will still work; the iPad will not." "Red"
  Line ""
}

# --- 3. Open the console once the port is actually accepting ------------
# Detached, because node below blocks this window. It polls rather than
# sleeping a fixed guess, so a slow start does not open the console into a
# connection error.
#
# Written to a FILE and run with -File, not passed inline with -Command:
# Start-Process flattens -ArgumentList into one string and re-quotes it, which
# mangles any multi-line script containing quotes. The first version of this
# did exactly that and the console silently never opened.
$opener = Join-Path $env:TEMP "oop-open-console.ps1"
@'
for ($i = 0; $i -lt 60; $i++) {
  try {
    $c = New-Object Net.Sockets.TcpClient
    $c.Connect("127.0.0.1", 4700)
    $c.Close()
    break
  } catch { Start-Sleep -Milliseconds 250 }
}
$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($chrome) {
  Start-Process $chrome -ArgumentList "--app=http://127.0.0.1:4700/console.html","--window-size=560,860"
} else {
  Start-Process "http://127.0.0.1:4700/console.html"
}
'@ | Set-Content -Path $opener -Encoding UTF8

# $opener passed BARE, with no quotes of its own. Start-Process quotes each
# ArgumentList element itself, so adding quotes here produces a triple-quoted
# path that fails without a word of complaint -- the second reason this
# console silently never opened.
Start-Process powershell -WindowStyle Hidden -ArgumentList `
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $opener

# --- 4. Banner, then hand the window to the relay -----------------------
if ($ip) {
  Line "  ON THE IPAD, OPEN THIS:" "White"
  Line ""
  Line "      http://${ip}:4700/ipad.html" "Green"
  Line ""
  Line "  Do it once, then Share > Add to Home Screen and launch it from" "DarkGray"
  Line "  the icon after that. Safari's own bars are 15% of the screen and" "DarkGray"
  Line "  show up on camera." "DarkGray"
  Line ""
  Line "  The iPad must be on the same Wi-Fi as this PC -- not cellular," "DarkGray"
  Line "  and not a phone hotspot." "DarkGray"
}
Line ""
Line "  The operator console opens by itself in a moment." "DarkGray"
Line "  CLOSE THIS WINDOW TO END THE SHOW." "Yellow"
Line "  ============================================================" "DarkMagenta"
Line ""

$env:OOP_STREAM_HOST = "0.0.0.0"
node stream\relay.js

Line ""
Line "  The relay has stopped." "Yellow"
Read-Host "  Press Enter to close"
