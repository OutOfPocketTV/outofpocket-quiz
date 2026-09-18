# Out Of Pocket -- one-click show start. THE button; there is no other.
#
# Replaces the sequence that was previously four manual steps and produced a
# blank white iPad whenever any of them was skipped or done out of order:
#   kill whatever relay is already running -> start it bound to the LAN ->
#   wait for the port -> start OBS safely -> open the operator console.
#
# The old "Start OBS" desktop shortcut is folded in here (2026-09-18). It
# still exists as start-obs.cmd, and is still the only way OBS gets started,
# but it is no longer something to click on its own.
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

# --- 3. Open everything else once the port is accepting ------------------
# Detached, because node below blocks this window. It polls rather than
# sleeping a fixed guess, so a slow start does not open the panels into a
# connection error.
#
# In order: Social Stream Ninja (chat), OBS, then the quiz console and
# Stream Control. The two panels wait for OBS's window to appear first, so
# they land ON TOP of it instead of being buried behind it -- which is how a
# panel that did open gets reported as one that didn't.
#
# Anything already open is brought to the front instead of opened twice, so
# clicking START SHOW again mid-evening (to restart the relay) does not pile
# up duplicate windows. The panels reconnect to the new relay by themselves.
#
# Stream Control is here because the old Start OBS shortcut used to open it
# as a side effect (start-stream-kit.cmd opens the control panel), and
# folding that shortcut in on 2026-09-18 quietly lost it.
#
# OBS goes through start-obs.cmd, never obs64.exe directly -- that script is
# still the only thing allowed to start OBS (second-instance guard, scene
# backup, safe-mode sentinel, browser cache). This used to be a separate
# desktop shortcut, and having two buttons that both started a relay meant
# the ORDER you clicked them in mattered:
#
#   Start OBS first  -> it found no relay and started its own, loopback-only
#                       one, so the iPad could not connect; then START SHOW
#                       killed that relay out from under every overlay.
#   START SHOW first -> fine, but only if you remembered.
#
# So OBS is launched from here, and only AFTER this relay is answering.
# start-obs.ps1 starts a relay of its own when it finds the port dead, and a
# second relay alongside this one is the silent split described above. If
# the port never comes up, OBS is not started at all: the relay window says
# why, and overlays loaded against a dead port stay blank until reloaded.
#
# Written to a FILE and run with -File, not passed inline with -Command:
# Start-Process flattens -ArgumentList into one string and re-quotes it, which
# mangles any multi-line script containing quotes. The first version of this
# did exactly that and the console silently never opened.
$opener = Join-Path $env:TEMP "oop-open-console.ps1"
$startObs = Join-Path $PSScriptRoot "start-obs.cmd"
@'
$up = $false
for ($i = 0; $i -lt 120; $i++) {
  try {
    $c = New-Object Net.Sockets.TcpClient
    $c.Connect("127.0.0.1", 4700)
    $c.Close()
    $up = $true
    break
  } catch { Start-Sleep -Milliseconds 250 }
}
if (-not $up) { exit }

# Finds a visible window by title and brings it forward. False when there is
# none, which is the signal to open one.
Add-Type @"
using System; using System.Text; using System.Runtime.InteropServices;
public static class OopWin {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  public static bool Raise(string needle) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      var sb = new StringBuilder(512);
      GetWindowText(h, sb, 512);
      if (sb.ToString().IndexOf(needle, StringComparison.OrdinalIgnoreCase) >= 0) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    if (found == IntPtr.Zero) return false;
    if (IsIconic(found)) ShowWindow(found, 9);
    SetForegroundWindow(found);
    return true;
  }
}
"@

# 1. Social Stream Ninja -- chat does not reach the overlays without it, and
#    it is the one thing that has always had to be remembered by hand.
$ssn = "$env:ProgramFiles\socialstream\socialstream.exe"
if ((Test-Path $ssn) -and -not (Get-Process socialstream -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath $ssn -WorkingDirectory (Split-Path $ssn)
}

# 2. OBS, in its own visible window: it prints the scene backup and warns if
#    the browser engine failed, then closes itself after about 25 seconds.
$obsWasUp = [bool](Get-Process obs64 -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 })
Start-Process -FilePath "__START_OBS__"
if (-not $obsWasUp) {
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    if (Get-Process obs64 -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }) { break }
  }
  # OBS draws its window before it finishes loading scenes and grabs focus
  # again when it does. A beat later, the panels stay on top.
  Start-Sleep -Seconds 4
}

# 3. The two panels, as chromeless app windows.
$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
function Open-Panel($title, $url, $size) {
  if ([OopWin]::Raise($title)) { return }
  if ($chrome) { Start-Process $chrome -ArgumentList "--app=$url", "--window-size=$size" }
  else { Start-Process $url }
}
Open-Panel "stream control" "http://127.0.0.1:4700/" "1320,960"
Open-Panel "quiz console" "http://127.0.0.1:4700/console.html" "560,860"
'@.Replace("__START_OBS__", $startObs) | Set-Content -Path $opener -Encoding UTF8

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
Line "  Opening Social Stream Ninja, OBS, Stream Control and the quiz console." "DarkGray"
Line "  Anything already open is brought to the front, not opened twice." "DarkGray"
Line "  CLOSE THIS WINDOW TO END THE SHOW." "Yellow"
Line "  ============================================================" "DarkMagenta"
Line ""

$env:OOP_STREAM_HOST = "0.0.0.0"
node stream\relay.js

Line ""
Line "  The relay has stopped." "Yellow"
Read-Host "  Press Enter to close"
