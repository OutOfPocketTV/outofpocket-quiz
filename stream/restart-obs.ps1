# Restart OBS without losing the overlays.
#
# Clicking X makes the OBS window vanish in about 4 seconds, but the process
# keeps tearing down its three canvases for roughly another 110. Launching a
# new OBS during that gap is what blanks every overlay: the old process still
# holds the browser cache, the new one's CEF cannot initialise, and every
# browser source -- theme, meters, chat, ticker, alerts -- paints nothing.
# Confirmed twice on 2026-08-25 (logs 22-16-53 and 23-15-05).
#
# So: close, WAIT for the process to actually be gone, clear the cache, start.

$ErrorActionPreference = 'Stop'
$obsDir  = 'C:\Program Files\obs-studio\bin\64bit'
$obsExe  = Join-Path $obsDir 'obs64.exe'
$appData = Join-Path $env:APPDATA 'obs-studio'

Write-Host ''
Write-Host '  Out Of Pocket - safe OBS restart' -ForegroundColor Cyan
Write-Host ''

# Every obs64, not just the one caught at the top. An accidental double
# launch leaves a second instance holding the browser cache, and waiting on
# a single PID walks straight past it -- which blanks every overlay exactly
# the way this script exists to prevent. Seen 2026-08-26.
$p = @(Get-Process obs64 -ErrorAction SilentlyContinue)
if ($p.Count) {
  Write-Host "  Closing OBS ($($p.Count) instance(s): $($p.Id -join ', '))..." -NoNewline
  $p | ForEach-Object { $_.CloseMainWindow() | Out-Null }
  $waited = 0
  while (@(Get-Process obs64 -ErrorAction SilentlyContinue).Count -and $waited -lt 240) {
    Start-Sleep -Seconds 3; $waited += 3
    if ($waited % 15 -eq 0) { Write-Host " ${waited}s" -NoNewline }
  }
  if (@(Get-Process obs64 -ErrorAction SilentlyContinue).Count) {
    Write-Host ''
    Write-Host '  Still running after 4 minutes - forcing it.' -ForegroundColor Yellow
    Get-Process obs64 -ErrorAction SilentlyContinue | Stop-Process -Force
    # A killed OBS is still unmapping the browser cache for a good few
    # seconds. Clearing or relaunching inside that window is the blanking
    # bug, so block until the process table is genuinely clear.
    while (@(Get-Process obs64 -ErrorAction SilentlyContinue).Count) { Start-Sleep -Seconds 3 }
    Start-Sleep -Seconds 20
  } else {
    Write-Host ''
    Write-Host "  OBS exited after ${waited}s." -ForegroundColor Green
  }
  Start-Sleep -Seconds 5
} else {
  Write-Host '  OBS was not running.'
}

# The cache only holds cookies for browser sources. The overlays are local and
# stateless, so clearing it costs nothing and guarantees a clean CEF start.
$cache = Join-Path $appData 'plugin_config\obs-browser'
if (Test-Path $cache) { Remove-Item $cache -Recurse -Force; Write-Host '  Browser cache cleared.' }

# A leftover sentinel makes OBS open the "recover in safe mode?" prompt, which
# silently blocks startup until someone clicks it.
$sent = Join-Path $appData '.sentinel'
if (Test-Path $sent) { Get-ChildItem $sent -File | Remove-Item -Force }

Write-Host '  Starting OBS...'
Start-Process -FilePath $obsExe -WorkingDirectory $obsDir
Start-Sleep -Seconds 25

$log = Get-ChildItem (Join-Path $appData 'logs') -Filter *.txt | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($log -and (Select-String -Path $log.FullName -Pattern 'CEF failed to initialize' -Quiet)) {
  Write-Host '  WARNING: browser engine failed again - overlays will be blank.' -ForegroundColor Red
  Write-Host '  Run this script once more.' -ForegroundColor Red
} else {
  Write-Host '  Browser engine started - overlays are live.' -ForegroundColor Green
}
Write-Host ''
Write-Host '  Done. This window can be closed.'
Start-Sleep -Seconds 4
