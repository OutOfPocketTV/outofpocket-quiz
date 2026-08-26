# The only thing that should ever start OBS.
#
# Four separate problems, one script, because they all come from the same
# place -- OBS being launched without anyone checking the state around it.
#
# 0. BLANK OVERLAYS. Every overlay is a browser source on 127.0.0.1:4700, so
#    OBS starting before the relay means every scene comes up empty except
#    the camera. Worse, a source that loaded against a dead port stays blank
#    even once the relay is up and the page reconnects -- the page runs, the
#    texture never comes back. So the relay goes up first, and the browser
#    cache is cleared on the way past.
#
# 1. THE SAFE MODE PROMPT. OBS drops a run-file in %APPDATA%\obs-studio\
#    .sentinel while it is alive and deletes it on a clean exit. If it is
#    still there at the next launch, OBS opens "Crash or unclean shutdown
#    detected -- run in safe mode?" and BLOCKS startup until someone clicks.
#    That happens after a crash, after a force-kill, and after restarting
#    Windows with OBS still open. There is no command-line flag to skip it
#    (checked against obs64.exe 32.2.2 -- --disable-shutdown-check does not
#    exist in this build). Clearing the stale sentinel first is the fix.
#    Note this hides nothing: real crashes still write to \crashes.
#
# 2. THE SECOND INSTANCE. OBS warns about an existing instance but will
#    still start if the dialog gets answered yes, and then TWO processes
#    share one config directory. Both write basic/scenes/Untitled.json,
#    aitum.json and user.ini at exit, and the last one out wins -- so the
#    instance that has been sitting on a stale copy since it launched can
#    overwrite an evening of work when you close it. This is the actual
#    mechanism behind "all my scenes get deleted when I exit OBS".
#    Confirmed in the logs 2026-08-26: three obs64 lifetimes overlapping,
#    03:38-03:47 with two more started inside it at 03:45.
#
# 3. NO WAY BACK. Nothing was keeping a copy of the scene collection, so a
#    bad exit meant re-building by hand. Now every launch stamps one.
#
# If OBS is already running this script does NOT start another one -- it
# brings the existing window to the front and exits.

param(
  # Only for the case where OBS has genuinely died but Windows has not
  # reaped the process yet. It still refuses to run two live instances.
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$obsDir  = 'C:\Program Files\obs-studio\bin\64bit'
$obsExe  = Join-Path $obsDir 'obs64.exe'
$appData = Join-Path $env:APPDATA 'obs-studio'
$backups = Join-Path $appData '_backups'

function Say($msg, $colour = 'Gray') { Write-Host "  $msg" -ForegroundColor $colour }

Write-Host ''
Write-Host '  Out Of Pocket - start OBS' -ForegroundColor Cyan
Write-Host ''

# ----------------------------------------------------------------- 0. relay
# Every overlay in every scene is a browser source pointing at
# 127.0.0.1:4700. With nothing listening there they all render NOTHING --
# the sources are still in the list, the scene is just empty apart from the
# camera. That reads as "OBS lost my scenes and sources", which is the exact
# panic this script exists to end, so the relay comes up FIRST.
#
# Order matters. A browser source that loads while the port is dead does not
# retry on its own; it sits on its error page until something reloads it. If
# the relay is already listening before OBS launches, nothing needs refreshing.
function Test-Relay {
  $c = New-Object System.Net.Sockets.TcpClient
  try { $c.Connect('127.0.0.1', 4700); $c.Close(); return $true }
  catch { return $false }
}

if (Test-Relay) {
  Say 'Relay already listening on 4700.' Green
} else {
  Say 'Relay is down - starting it first...' Yellow
  Start-Process -FilePath (Join-Path $PSScriptRoot 'start-stream-kit.cmd')
  $waited = 0
  while (-not (Test-Relay) -and $waited -lt 20) { Start-Sleep -Seconds 1; $waited++ }
  if (Test-Relay) { Say "Relay up after ${waited}s." Green }
  else { Say 'Relay did NOT come up - overlays will be blank. Check the relay window.' Red }
}

# ---------------------------------------------------------------- 1. guard
Add-Type -Namespace Win -Name Api -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
'@

$running = @(Get-Process obs64 -ErrorAction SilentlyContinue)
if ($running.Count -and -not $Force) {
  Say "OBS is already running (PID $($running.Id -join ', ')) - not starting another." Yellow
  $h = ($running | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1).MainWindowHandle
  if ($h) {
    # SW_RESTORE, because a minimised window ignores SetForegroundWindow.
    if ([Win.Api]::IsIconic($h)) { [void][Win.Api]::ShowWindow($h, 9) }
    [void][Win.Api]::SetForegroundWindow($h)
    Say 'Brought the existing window to the front.' Green
  } else {
    # No window yet means it is still starting up, or still shutting down --
    # OBS keeps the process alive with no window for well over a minute
    # while it tears down its canvases. Either way, do not launch into that.
    Say 'It has no window yet - it is still starting or still shutting down.' Yellow
    Say 'Give it a minute. Use restart-obs.ps1 if it never comes back.' Yellow
  }
  Write-Host ''
  exit 0
}

if ($running.Count -and $Force) {
  Say 'Force: another obs64 is alive. Refusing anyway - two instances is the bug.' Red
  Say 'Close it properly, or run restart-obs.ps1.' Red
  Write-Host ''
  exit 1
}

# --------------------------------------------------------------- 2. backup
# Deliberately NOT inside basic\scenes: OBS treats every .json in that folder
# as a scene collection and would list each backup in the Scene Collection
# menu. Kept flat here instead, newest 30 retained.
if (-not (Test-Path $backups)) { New-Item -ItemType Directory -Path $backups | Out-Null }
$stamp   = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$targets = @(
  @{ From = Join-Path $appData 'basic\scenes\Untitled.json';            Name = "scenes_$stamp.json" }
  @{ From = Join-Path $appData 'basic\profiles\Untitled\aitum.json';    Name = "aitum_$stamp.json"  }
)
foreach ($t in $targets) {
  if (Test-Path $t.From) { Copy-Item $t.From (Join-Path $backups $t.Name) -Force }
}
$kept = Get-ChildItem $backups -Filter '*.json' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending
if ($kept.Count -gt 60) { $kept | Select-Object -Skip 60 | Remove-Item -Force }
$sceneSize = (Get-Item (Join-Path $appData 'basic\scenes\Untitled.json') -ErrorAction SilentlyContinue).Length
Say "Scene collection backed up ($([math]::Round($sceneSize/1KB)) KB) -> _backups\scenes_$stamp.json" Green

# ----------------------------------------------------------- 3. CEF cache
# The failure this prevents: every browser source loads its page, connects to
# the relay and runs -- and produces no video texture at all. The scene shows
# the camera and nothing else, which reads as "OBS didn't load my sources".
# Seen 2026-08-26: obs-browser-page held six live connections to 4700 while
# `Theme OmeTV` screenshotted completely blank, and refreshing the sources
# reconnected the pages without bringing the picture back. Only a restart
# with this cache cleared fixed it.
#
# It comes from starting OBS on a dirty browser cache -- after an unclean
# exit, or after a run where the relay was down. Safe to clear on every
# launch: the cache only holds cookies and storage for browser sources, and
# every overlay here is local and stateless. restart-obs.ps1 has always done
# this; start-obs.ps1 not doing it is why clicking the new shortcut still
# came up blank.
$cache = Join-Path $appData 'plugin_config\obs-browser'
if (Test-Path $cache) {
  Remove-Item $cache -Recurse -Force -ErrorAction SilentlyContinue
  Say 'Browser cache cleared - overlays get a clean CEF start.' Green
}

# ------------------------------------------------------------- 4. sentinel
# Only safe to clear because we have already established no OBS is running.
$sentDir = Join-Path $appData '.sentinel'
if (Test-Path $sentDir) {
  $stale = @(Get-ChildItem $sentDir -File -ErrorAction SilentlyContinue)
  if ($stale.Count) {
    $stale | Remove-Item -Force
    Say "Cleared $($stale.Count) stale sentinel file(s) - no safe-mode prompt." Green
  }
}

# ---------------------------------------------------------------- 5. launch
Say 'Starting OBS...'
Start-Process -FilePath $obsExe -WorkingDirectory $obsDir
Start-Sleep -Seconds 22

# CEF failing to initialise is the "all my overlays are blank but OBS looks
# fine" failure. Worth saying out loud at launch rather than discovering it
# on air -- see restart-obs.ps1, which is the recovery for it.
$log = Get-ChildItem (Join-Path $appData 'logs') -Filter *.txt -ErrorAction SilentlyContinue |
       Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($log -and (Select-String -Path $log.FullName -Pattern 'CEF failed to initialize' -Quiet)) {
  Say 'WARNING: browser engine failed - overlays will be blank.' Red
  Say 'Run restart-obs.cmd once.' Red
} else {
  Say 'OBS is up, browser engine started.' Green
}
Write-Host ''
Start-Sleep -Seconds 3
